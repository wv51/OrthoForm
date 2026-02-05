'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { ArrowLeft, Users, MessageSquare, Star, Loader2, Download, CheckCircle2, Circle, TrendingUp, Calendar, FileText, Sparkles, CalendarDays, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from 'next/link';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { summarizeFeedback, extractKeywords, WordCloudItem } from '@/lib/gemini';

// Helper to load Thai font for jsPDF with multiple sources and timeout
const loadThaiFont = async (doc: any) => {
  const fetchWithTimeout = async (url: string, timeout = 10000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: { 'Accept': 'application/x-font-ttf,application/octet-stream' }
      });
      clearTimeout(id);
      return response;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  };

  try {
    const fonts = [
      { 
        name: 'Sarabun-Regular.ttf', 
        style: 'normal', 
        urls: [
          'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/sarabun/Sarabun-Regular.ttf',
          'https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun/Sarabun-Regular.ttf',
          'https://fonts.gstatic.com/s/sarabun/v13/dt0965S_9S6S-mXmXW8.ttf'
        ] 
      },
      { 
        name: 'Sarabun-Bold.ttf', 
        style: 'bold', 
        urls: [
          'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/sarabun/Sarabun-Bold.ttf',
          'https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun/Sarabun-Bold.ttf',
          'https://fonts.gstatic.com/s/sarabun/v13/dt0465S_9S6S-mXmXW9ob60.ttf'
        ] 
      }
    ];

    for (const fontConfig of fonts) {
      let response = null;
      let lastError = null;

      for (const url of fontConfig.urls) {
        try {
          console.log(`Attempting to fetch font: ${fontConfig.name} from ${url}`);
          response = await fetchWithTimeout(url);
          if (response.ok) {
            console.log(`Successfully fetched font: ${fontConfig.name}`);
            break;
          } else {
            console.warn(`Failed to fetch from ${url}: ${response.status} ${response.statusText}`);
            lastError = `Status ${response.status}`;
          }
        } catch (e: any) {
          console.warn(`Error fetching from ${url}:`, e.message || e);
          lastError = e.message || e;
          continue;
        }
      }

      if (!response || !response.ok) {
        throw new Error(`Failed to fetch font ${fontConfig.name}. Last error: ${lastError}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunk = 8192;
      for (let i = 0; i < uint8Array.length; i += chunk) {
        const subArray = uint8Array.slice(i, i + chunk);
        binary += String.fromCharCode.apply(null, Array.from(subArray));
      }
      const base64String = btoa(binary);
      
      doc.addFileToVFS(fontConfig.name, base64String);
      doc.addFont(fontConfig.name, 'Sarabun', fontConfig.style);
    }
    
    doc.setFont('Sarabun', 'normal');
    return true;
  } catch (err: any) {
    console.error('Error loading Thai font:', err);
    toast.error(`ไม่สามารถโหลดฟอนต์ได้: ${err.message || 'Unknown error'}`);
    return false;
  }
};

const COLORS = ['var(--primary)', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e'];

export default function SurveyStats({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const surveyId = resolvedParams.id;
  const router = useRouter();
  
  const [survey, setSurvey] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [responsesCount, setResponsesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>({});
  const [allAnswers, setAllAnswers] = useState<any[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [dateRange, setDateRange] = useState('all');
  const [filteredAnswers, setFilteredAnswers] = useState<any[]>([]);
  const [filteredCount, setFilteredCount] = useState(0);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [ratingTrendData, setRatingTrendData] = useState<any[]>([]);
  const [keywords, setKeywords] = useState<WordCloudItem[]>([]);

  // Calculate stats and trends whenever allAnswers, questions, or dateRange changes
  useEffect(() => {
    if (!allAnswers.length || !questions.length) return;

    // 1. Filter answers based on date range
    const now = new Date();
    const filtered = allAnswers.filter(a => {
      if (dateRange === 'all') return true;
      const answerDate = new Date(a.responses.created_at);
      const diffTime = Math.abs(now.getTime() - answerDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (dateRange === '7d') return diffDays <= 7;
      if (dateRange === '30d') return diffDays <= 30;
      return true;
    });

    setFilteredAnswers(filtered);

    // 2. Calculate unique responses count (filtered)
    const uniqueResponseIds = new Set(filtered.map(a => a.response_id));
    setFilteredCount(uniqueResponseIds.size);

    // 3. Process Stats
    const processedStats: any = {};
    questions.forEach(q => {
      const qAnswers = filtered.filter(a => a.question_id === q.id);
      
      if (q.type === 'choice' || q.type === 'dropdown') {
        const counts: any = {};
        q.options.forEach((opt: string) => counts[opt] = 0);
        if (q.allow_other) counts['อื่นๆ'] = 0;

        qAnswers.forEach(a => {
          if (a.answer_value.startsWith('OTHER:')) {
            counts['อื่นๆ']++;
          } else if (counts[a.answer_value] !== undefined) {
            counts[a.answer_value]++;
          }
        });
        processedStats[q.id] = Object.entries(counts).map(([name, value]) => ({ name, value }));
      } else if (q.type === 'checkboxes') {
        const counts: any = {};
        q.options.forEach((opt: string) => counts[opt] = 0);
        if (q.allow_other) counts['อื่นๆ'] = 0;

        qAnswers.forEach(a => {
          const values = a.answer_value.split('|||');
          values.forEach((v: string) => {
            if (v.startsWith('OTHER:')) {
              counts['อื่นๆ']++;
            } else if (counts[v] !== undefined) {
              counts[v]++;
            }
          });
        });
        processedStats[q.id] = Object.entries(counts).map(([name, value]) => ({ name, value }));
      } else if (q.type === 'rating') {
        const counts: any = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
        qAnswers.forEach(a => {
          if (counts[a.answer_value] !== undefined) counts[a.answer_value]++;
        });
        processedStats[q.id] = Object.entries(counts).map(([name, value]) => ({ name, value }));
      } else if (q.type === 'date') {
        const dateCounts: any = {};
        qAnswers.forEach(a => {
          const date = a.answer_value;
          if (date) {
            dateCounts[date] = (dateCounts[date] || 0) + 1;
          }
        });
        processedStats[q.id] = Object.entries(dateCounts)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => a.name.localeCompare(b.name));
      } else {
        processedStats[q.id] = qAnswers.map(a => a.answer_value).slice(-10);
      }
    });
    setStats(processedStats);

    // 4. Calculate Trend Data
    const trends: any = {};
    const ratingTrends: any = {}; // { "2024-02-05": { sum: 15, count: 3 } }

    filtered.forEach(a => {
      // Group by response_id to count unique responses per day
      const date = new Date(a.responses.created_at).toLocaleDateString('en-CA');
      if (!trends[date]) trends[date] = new Set();
      trends[date].add(a.response_id);

      // Calculate rating trend
      if (a.questions.type === 'rating') {
        if (!ratingTrends[date]) ratingTrends[date] = { sum: 0, count: 0 };
        ratingTrends[date].sum += parseInt(a.answer_value, 10) || 0;
        ratingTrends[date].count += 1;
      }
    });

    const trendChartData = Object.entries(trends).map(([date, set]: [string, any]) => ({
      date: new Date(date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
      count: set.size,
      rawDate: date
    })).sort((a, b) => a.rawDate.localeCompare(b.rawDate));

    const ratingChartData = Object.entries(ratingTrends).map(([date, data]: [string, any]) => ({
      date: new Date(date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
      score: (data.sum / data.count).toFixed(1),
      rawDate: date
    })).sort((a, b) => a.rawDate.localeCompare(b.rawDate));

    // Fill in missing dates if range is 7d or 30d
    if (dateRange !== 'all') {
      const days = dateRange === '7d' ? 7 : 30;
      const filledData = [];
      const filledRatingData = [];
      
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString('en-CA');
        
        // Count Trend
        const existing = trendChartData.find(t => t.rawDate === dateStr);
        filledData.push(existing || {
          date: d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
          count: 0,
          rawDate: dateStr
        });

        // Rating Trend
        const existingRating = ratingChartData.find(t => t.rawDate === dateStr);
        filledRatingData.push(existingRating || {
          date: d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
          score: 0,
          rawDate: dateStr
        });
      }
      setTrendData(filledData);
      setRatingTrendData(filledRatingData);
    } else {
      setTrendData(trendChartData);
      setRatingTrendData(ratingChartData);
    }

  }, [allAnswers, questions, dateRange]);

  const handleSummarize = async () => {
    const textAnswers = allAnswers
      .filter(a => a.questions.type === 'text')
      .map(a => a.answer_value)
      .filter(val => val.trim().length > 0);

    if (textAnswers.length === 0) {
      toast.error('ยังไม่มีข้อมูลคำตอบแบบข้อความเพียงพอที่จะสรุป');
      return;
    }

    setIsSummarizing(true);
    try {
      // Run both tasks in parallel
      const [summary, keywordsData] = await Promise.all([
        summarizeFeedback(textAnswers),
        extractKeywords(textAnswers)
      ]);
      
      setAiSummary(summary);
      setKeywords(keywordsData);
      toast.success('วิเคราะห์ข้อมูลด้วย AI สำเร็จ');
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการวิเคราะห์ด้วย AI');
    } finally {
      setIsSummarizing(false);
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        // Fetch Survey & Questions
        const { data: surveyData, error: surveyError } = await supabase
          .from('surveys')
          .select('*')
          .eq('id', surveyId)
          .single();
        
        if (surveyError) throw surveyError;

        const { data: questionsData, error: questionsError } = await supabase
          .from('questions')
          .select('*')
          .eq('survey_id', surveyId)
          .order('order', { ascending: true });

        if (questionsError) throw questionsError;

        // Fetch Responses Count
        const { count, error: countError } = await supabase
          .from('responses')
          .select('*', { count: 'exact', head: true })
          .eq('survey_id', surveyId);

        if (countError) throw countError;

        // Fetch Answers
        const { data: answersData, error: answersError } = await supabase
          .from('answers')
          .select('*, responses!inner(*), questions!inner(*)')
          .eq('questions.survey_id', surveyId);

        if (answersError) throw answersError;

        setSurvey(surveyData);
        setQuestions(questionsData || []);
        setResponsesCount(count || 0);
        setAllAnswers(answersData || []);
        
        // Initial stats processing will be handled by the useEffect above
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [surveyId, router]);

  const exportToCSV = () => {
    // Use filteredAnswers instead of allAnswers to respect the date filter
    const answersToExport = filteredAnswers.length > 0 ? filteredAnswers : allAnswers;
    
    if (answersToExport.length === 0) {
      toast.error('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }

    try {
      // 1. Group answers by response_id
      const responseMap: Record<string, any> = {};
      answersToExport.forEach(ans => {
        if (!responseMap[ans.response_id]) {
          responseMap[ans.response_id] = {
            id: ans.response_id,
            created_at: new Date(ans.responses.created_at).toLocaleString('th-TH'),
          };
        }
        // Use question label as key
        const qLabel = questions.find((q: any) => q.id === ans.question_id)?.label || ans.question_id;
        responseMap[ans.response_id][qLabel] = ans.answer_value;
      });

      const data = Object.values(responseMap);
      const headers = ['id', 'created_at', ...questions.map(q => q.label)];
      
      const csvRows = [];
      csvRows.push(headers.join(','));

      for (const row of data) {
        const values = headers.map(header => {
          const val = row[header] || '';
          const escaped = ('' + val).replace(/"/g, '""');
          return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
      }

      const csvContent = "\ufeff" + csvRows.join('\n'); // Add BOM for Excel Thai support
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const filterSuffix = dateRange === 'all' ? '' : `-${dateRange}`;
      link.setAttribute('download', `Survey-${survey.title}${filterSuffix}-${new Date().toLocaleDateString()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('ส่งออกไฟล์ CSV เรียบร้อยแล้ว');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('เกิดข้อผิดพลาดในการส่งออกข้อมูล');
    }
  };

  const exportSummaryPDF = async () => {
    try {
      const toastId = toast.loading('กำลังสร้าง PDF...');
      const doc = new jsPDF();
      
      // Load Thai font
      const fontLoaded = await loadThaiFont(doc);
      if (!fontLoaded) {
        toast.error('ไม่สามารถโหลดฟอนต์ภาษาไทยได้', { id: toastId });
        return;
      }
      
      doc.setFont('Sarabun');
      
      // Add Logo if available
      if (survey.logo_url) {
        try {
          const img = new Image();
          img.src = survey.logo_url;
          // Wait for image to load? jspdf addImage usually needs loaded data or base64. 
          // Since it's a URL, we might need to fetch it.
          // However, for simplicity in client-side jsPDF, passing the URL might work if CORS allows, 
          // but often it's safer to fetch it as blob/base64 first.
          
          // Using fetch to get blob and convert to base64
          const response = await fetch(survey.logo_url);
          const blob = await response.blob();
          const reader = new FileReader();
          
          await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          
          if (reader.result) {
             const imgProps = doc.getImageProperties(reader.result as string);
             const pdfWidth = doc.internal.pageSize.getWidth();
             const imgWidth = 30;
             const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
             doc.addImage(reader.result as string, 'PNG', (pdfWidth - imgWidth) / 2, 10, imgWidth, imgHeight);
          }
        } catch (e) {
          console.warn('Could not add logo to PDF', e);
        }
      }

      // Add Thai font (using a standard font and descriptive text)
      doc.setFontSize(22);
      // Adjust Y position if logo exists
      const titleY = survey.logo_url ? 45 : 20;
      doc.text('Survey Summary Report', 105, titleY, { align: 'center' });
      
      doc.setFontSize(16);
      doc.text(survey.title, 105, titleY + 10, { align: 'center' });
      
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString('th-TH')}`, 105, titleY + 18, { align: 'center' });
      
      // Show filter info if active
      let filterText = 'All Time';
      if (dateRange === '7d') filterText = 'Last 7 Days';
      if (dateRange === '30d') filterText = 'Last 30 Days';
      
      doc.text(`Filter: ${filterText}`, 105, titleY + 24, { align: 'center' });
      doc.text(`Total Responses: ${dateRange === 'all' ? responsesCount : filteredCount}`, 105, titleY + 30, { align: 'center' });

      let yPos = titleY + 45;

      questions.forEach((q, idx) => {
        if (yPos > 250) {
          doc.addPage();
          doc.setFont('Sarabun'); // Re-set font for new page
          yPos = 20;
        }

        doc.setFontSize(12);
        doc.text(`${idx + 1}. ${q.label}`, 20, yPos);
        yPos += 10;

        if (q.type === 'choice' || q.type === 'dropdown' || q.type === 'checkboxes' || q.type === 'rating') {
          const data = stats[q.id] || [];
          autoTable(doc, {
            startY: yPos,
            head: [['ตัวเลือก (Option)', 'จำนวน (Count)']],
            body: data.map((d: any) => [d.name, d.value]),
            margin: { left: 25 },
            theme: 'striped',
            styles: { font: 'Sarabun', fontSize: 10 },
            headStyles: { font: 'Sarabun', fontStyle: 'bold' }
          });
          yPos = (doc as any).lastAutoTable.finalY + 15;
        } else {
          const answers = stats[q.id] || [];
          autoTable(doc, {
            startY: yPos,
            head: [['คำตอบล่าสุด (Latest Answers)']],
            body: answers.map((a: string) => [a]),
            margin: { left: 25 },
            theme: 'plain',
            styles: { font: 'Sarabun', fontSize: 9, fontStyle: 'italic' },
            headStyles: { font: 'Sarabun', fontStyle: 'bold' }
          });
          yPos = (doc as any).lastAutoTable.finalY + 15;
        }
      });

      doc.save(`Summary-${survey.title}.pdf`);
      toast.success('ส่งออก PDF สรุปผลเรียบร้อยแล้ว', { id: toastId });
    } catch (err) {
      console.error('PDF Export error:', err);
      toast.error('เกิดข้อผิดพลาดในการส่งออก PDF');
    }
  };

  const exportResponsePDF = async (responseId: string) => {
    try {
      const toastId = toast.loading('กำลังสร้าง PDF...');
      const doc = new jsPDF();
      
      // Load Thai font
      const fontLoaded = await loadThaiFont(doc);
      if (!fontLoaded) {
        toast.error('ไม่สามารถโหลดฟอนต์ภาษาไทยได้', { id: toastId });
        return;
      }
      
      doc.setFont('Sarabun');
      
      // Add Logo if available
      if (survey.logo_url) {
        try {
          const response = await fetch(survey.logo_url);
          const blob = await response.blob();
          const reader = new FileReader();
          await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          
          if (reader.result) {
             const imgProps = doc.getImageProperties(reader.result as string);
             const pdfWidth = doc.internal.pageSize.getWidth();
             const imgWidth = 30;
             const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
             doc.addImage(reader.result as string, 'PNG', (pdfWidth - imgWidth) / 2, 10, imgWidth, imgHeight);
          }
        } catch (e) {
          console.warn('Could not add logo to PDF', e);
        }
      }

      const responseAnswers = allAnswers.filter(a => a.response_id === responseId);
      const responseDate = new Date(responseAnswers[0]?.responses.created_at).toLocaleString('th-TH');

      doc.setFontSize(20);
      // Adjust Y position if logo exists
      const titleY = survey.logo_url ? 45 : 20;
      doc.text('Patient Response Report', 105, titleY, { align: 'center' });
      
      doc.setFontSize(14);
      doc.text(survey.title, 105, titleY + 10, { align: 'center' });
      
      doc.setFontSize(10);
      doc.text(`Response ID: ${responseId}`, 20, titleY + 25);
      doc.text(`Date: ${responseDate}`, 20, titleY + 32);

      const tableData = questions.map(q => {
        const ans = responseAnswers.find(a => a.question_id === q.id);
        let val = ans?.answer_value || '-';
        if (val.startsWith('OTHER:')) val = val.replace('OTHER:', '(อื่นๆ) ');
        if (val.includes('|||')) val = val.split('|||').join(', ');
        return [q.label, val];
      });

      autoTable(doc, {
        startY: titleY + 45,
        head: [['คำถาม (Question)', 'คำตอบ (Answer)']],
        body: tableData,
        styles: { font: 'Sarabun', cellPadding: 5, fontSize: 10 },
        headStyles: { font: 'Sarabun', fontStyle: 'bold' },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } }
      });

      doc.save(`Response-${responseId.slice(0, 8)}.pdf`);
      toast.success('ส่งออก PDF คำตอบรายบุคคลเรียบร้อยแล้ว', { id: toastId });
    } catch (err) {
      console.error('Individual PDF Export error:', err);
      toast.error('เกิดข้อผิดพลาดในการส่งออก PDF');
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-[60vh] items-center justify-center space-y-4 text-center">
        <div className="bg-red-50 p-4 rounded-full">
          <Loader2 className="h-8 w-8 text-red-500 animate-spin" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">เกิดข้อผิดพลาด</h2>
          <p className="text-slate-500 max-w-md mx-auto mt-2">{error}</p>
          {error.includes('table') && (
             <div className="mt-4 p-4 bg-slate-50 rounded text-sm text-left">
               <strong>คำแนะนำ:</strong> ดูเหมือนว่ายังไม่ได้สร้างตารางใน Database
               <br/>กรุณารันคำสั่ง SQL ใน Supabase Dashboard เพื่อเริ่มต้นใช้งาน
             </div>
          )}
        </div>
        <Link href="/">
          <Button variant="outline">กลับหน้าหลัก</Button>
        </Link>
      </div>
    );
  }

  if (!survey) return <div>ไม่พบข้อมูล</div>;

  return (
    <div className="container mx-auto py-12 px-4 max-w-6xl space-y-12 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 min-h-screen">
      {/* Enhanced Header */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-8 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm p-8 rounded-3xl shadow-2xl border border-white/20 dark:border-slate-800"
      >
        <div className="flex items-center gap-6">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 h-14 w-14 transition-all duration-300">
              <ArrowLeft className="h-7 w-7" />
            </Button>
          </Link>
          <div className="space-y-2">
            <div className="flex items-center gap-4 mb-3">
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                {survey.title}
              </h1>
            </div>
            {survey.description && (
              <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                {survey.description}
              </p>
            )}
            <div className="flex items-center gap-6 text-slate-500 dark:text-slate-400">
              <p className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                สร้างเมื่อ {new Date(survey.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <div className="bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-700 shadow-sm p-1">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[180px] h-9 text-sm border-none focus:ring-0 bg-transparent">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-slate-500" />
                    <SelectValue placeholder="เลือกช่วงเวลา" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">7 วันล่าสุด</SelectItem>
                  <SelectItem value="30d">30 วันล่าสุด</SelectItem>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={exportSummaryPDF} variant="outline" size="sm" className="gap-2 font-bold border-primary/20 text-primary hover:bg-primary/5 h-11 px-4 rounded-xl transition-all">
                <FileText className="h-4 w-4" />
                PDF
              </Button>
              <Button onClick={exportToCSV} size="sm" className="gap-2 font-bold bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200/50 h-11 px-4 rounded-xl transition-all hover:scale-105">
                <Download className="h-4 w-4" />
                Excel
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="h-full"
        >
          <Card className="h-full border-none shadow-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground overflow-hidden relative group hover:scale-105 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Users className="absolute -right-4 -bottom-4 h-24 w-24 opacity-15 rotate-12" />
            <CardContent className="pt-8 pb-6 flex flex-col justify-between h-full">
              <div>
                <p className="text-primary-foreground/80 text-sm font-bold uppercase tracking-wider mb-2">ผู้ตอบแบบสอบถาม</p>
                <div className="flex items-end gap-3">
                  <p className="text-5xl font-black">
                    {dateRange === 'all' ? responsesCount : filteredCount}
                  </p>
                  <p className="text-primary-foreground/70 pb-1 text-lg">คน</p>
                </div>
              </div>
              {dateRange !== 'all' && (
                <p className="text-xs text-primary-foreground/60 mt-2">
                  จากทั้งหมด {responsesCount} คน
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="h-full"
        >
          <Card className="h-full border-none shadow-xl bg-white dark:bg-slate-900 overflow-hidden relative group hover:scale-105 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <MessageSquare className="absolute -right-4 -bottom-4 h-24 w-24 text-slate-100 dark:text-slate-800 rotate-12" />
            <CardContent className="pt-8 pb-6 flex flex-col justify-between h-full">
              <div>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider mb-2">จำนวนคำถาม</p>
                <div className="flex items-end gap-3">
                  <p className="text-5xl font-black text-slate-900 dark:text-slate-100">{questions.length}</p>
                  <p className="text-slate-400 dark:text-slate-500 pb-1 text-lg">ข้อ</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="h-full"
        >
          <Card className="h-full border-none shadow-xl bg-white dark:bg-slate-900 overflow-hidden relative group hover:scale-105 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <TrendingUp className="absolute -right-4 -bottom-4 h-24 w-24 text-slate-100 dark:text-slate-800 rotate-12" />
            <CardContent className="pt-8 pb-6 flex flex-col justify-between h-full">
              <div>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider mb-2">อัตราการตอบ</p>
                <div className="flex items-end gap-3">
                  <p className="text-5xl font-black text-slate-900 dark:text-slate-100">100</p>
                  <p className="text-slate-400 dark:text-slate-500 pb-1 text-lg">%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="h-full"
        >
          <Card className="h-full border-none shadow-xl bg-white dark:bg-slate-900 overflow-hidden relative group hover:scale-105 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-amber/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Star className="absolute -right-4 -bottom-4 h-24 w-24 text-slate-100 dark:text-slate-800 rotate-12" />
            <CardContent className="pt-8 pb-6 flex flex-col justify-between h-full">
              <div>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider mb-2">สถานะระบบ</p>
                <div className="flex items-end gap-2">
                  {survey.is_active !== false ? (
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                      <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">Active</p>
                      <p className="text-sm text-emerald-600/70 dark:text-emerald-400/70 font-medium">(เปิดรับข้อมูล)</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-slate-400" />
                      <p className="text-2xl font-black text-slate-500 dark:text-slate-400 uppercase tracking-tight">Inactive</p>
                      <p className="text-sm text-slate-500/70 dark:text-slate-400/70 font-medium">(ปิดรับข้อมูล)</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Trend Analysis Charts */}
      {(trendData.length > 0 || ratingTrendData.length > 0) && (
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Response Count Trend */}
          {trendData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              <Card className="border-none shadow-xl bg-white dark:bg-slate-900 overflow-hidden h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    จำนวนผู้ตอบแบบสอบถาม (คน)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="count" 
                          stroke="var(--primary)" 
                          strokeWidth={3}
                          activeDot={{ r: 8 }}
                          name="จำนวนคนตอบ"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Average Rating Trend */}
          {ratingTrendData.length > 0 && ratingTrendData.some(d => parseFloat(d.score) > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
            >
              <Card className="border-none shadow-xl bg-white dark:bg-slate-900 overflow-hidden h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Star className="h-5 w-5 text-amber-500" />
                    คะแนนความพึงพอใจเฉลี่ย (คะแนนเต็ม 5)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={ratingTrendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 5]} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="score" 
                          stroke="#f59e0b" 
                          strokeWidth={3}
                          activeDot={{ r: 8 }}
                          name="คะแนนเฉลี่ย"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      )}

      {responsesCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="border-none shadow-2xl bg-white dark:bg-slate-900 overflow-hidden relative group border-t-4 border-t-indigo-500">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-transparent opacity-100 dark:opacity-10"></div>
            <Sparkles className="absolute -right-8 -bottom-8 h-40 w-40 opacity-5 text-indigo-500 rotate-12" />
            <CardHeader className="pb-4 relative z-10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-bold flex items-center gap-3 text-slate-800 dark:text-slate-100">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  AI วิเคราะห์สรุปความคิดเห็น
                </CardTitle>
                {!aiSummary && (
                  <Button 
                    onClick={handleSummarize} 
                    disabled={isSummarizing}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl px-6 py-2 shadow-lg shadow-indigo-200 dark:shadow-none"
                  >
                    {isSummarizing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    เริ่มการวิเคราะห์
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6 relative z-10">
              {aiSummary ? (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 border border-indigo-100 dark:border-indigo-900 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-indigo-500" />
                      สรุปประเด็นสำคัญ
                    </h3>
                    <div className="prose prose-slate dark:prose-invert max-w-none">
                      {aiSummary.split('\n').map((line, i) => (
                        <motion.p 
                          key={i} 
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="mb-4 last:mb-0 text-slate-700 dark:text-slate-300 leading-relaxed text-lg flex gap-3"
                        >
                          <span className="text-indigo-500 font-bold">•</span>
                          {line.replace(/^[•-]\s*/, '')}
                        </motion.p>
                      ))}
                    </div>
                  </div>

                  {keywords.length > 0 && (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 border border-indigo-100 dark:border-indigo-900 shadow-sm">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-indigo-500" />
                        คำที่คนไข้พูดถึงบ่อย (Word Cloud)
                      </h3>
                      <div className="flex flex-wrap gap-3 justify-center py-4">
                        {keywords.map((word, idx) => {
                          const sizeClass = word.value >= 9 ? 'text-4xl' : 
                                          word.value >= 7 ? 'text-3xl' : 
                                          word.value >= 5 ? 'text-2xl' : 
                                          'text-lg';
                          const colorClass = word.value >= 8 ? 'text-indigo-600 dark:text-indigo-400 font-black' : 
                                           word.value >= 6 ? 'text-indigo-500 dark:text-indigo-300 font-bold' : 
                                           'text-indigo-400 dark:text-indigo-200 font-medium';
                          return (
                            <motion.span
                              key={idx}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: idx * 0.05 }}
                              className={`${sizeClass} ${colorClass} cursor-default hover:scale-110 transition-transform duration-300`}
                              title={`ความถี่: ${word.value}`}
                            >
                              {word.text}
                            </motion.span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <Button 
                    onClick={() => { setAiSummary(null); setKeywords([]); }}
                    variant="ghost" 
                    size="sm"
                    className="mt-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl px-4 py-2 w-full"
                  >
                    วิเคราะห์ใหม่
                  </Button>
                </div>
              ) : (
                <div className="py-8 text-center bg-indigo-50/50 dark:bg-indigo-900/20 rounded-2xl border border-dashed border-indigo-200 dark:border-indigo-800">
                  <p className="text-indigo-400 font-medium">
                    กดปุ่มเพื่อเริ่มให้ AI สรุปใจความสำคัญจากคำตอบแบบข้อความทั้งหมดของคนไข้
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-1 h-14 rounded-2xl shadow-sm">
          <TabsTrigger value="summary" className="rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-white h-full">สรุปผลภาพรวม</TabsTrigger>
          <TabsTrigger value="responses" className="rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-white h-full">คำตอบรายบุคคล</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-8 space-y-8">
          <div className="grid grid-cols-1 gap-8">
            {questions.map((q, index) => (
              <Card key={q.id} className="border-none shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 overflow-hidden bg-white dark:bg-slate-900">
                <div className="h-1.5 bg-gradient-to-r from-primary/50 to-primary w-full" />
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-black text-sm">
                      {index + 1}
                    </span>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-widest font-black py-0">
                      {q.type === 'text' ? 'ข้อความ' : q.type === 'choice' ? 'ตัวเลือกเดียว' : q.type === 'checkboxes' ? 'หลายตัวเลือก' : q.type === 'dropdown' ? 'รายการเลือก' : q.type === 'date' ? 'วันที่' : 'คะแนน'}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">{q.label}</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {(q.type === 'choice' || q.type === 'dropdown') && stats[q.id] && (
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats[q.id]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }: any) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {stats[q.id].map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {q.type === 'checkboxes' && stats[q.id] && (
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats[q.id]} layout="vertical" margin={{ left: 40, right: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" width={100} />
                          <Tooltip />
                          <Bar dataKey="value" fill="var(--primary)" radius={[0, 4, 4, 0]} label={{ position: 'right' }} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {q.type === 'rating' && stats[q.id] && (
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats[q.id]}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {q.type === 'date' && stats[q.id] && (
                    <div className="space-y-4">
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats[q.id]}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
                        {stats[q.id].length > 0 ? (
                          stats[q.id].slice(0, 6).map((item: any, i: number) => (
                            <div key={i} className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 text-center">
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">{item.name}</p>
                              <p className="text-lg font-black text-primary">{item.value} <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">ครั้ง</span></p>
                            </div>
                          ))
                        ) : (
                          <p className="col-span-full text-center text-sm text-slate-400 italic py-4">ยังไม่มีการเลือกวันที่</p>
                        )}
                      </div>
                    </div>
                  )}

                  {q.type === 'text' && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">คำตอบล่าสุด:</p>
                      {stats[q.id] && stats[q.id].length > 0 ? (
                        stats[q.id].map((ans: string, i: number) => (
                          <div key={i} className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg text-sm text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-700">
                            {ans}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400 italic">ยังไม่มีคำตอบ</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="responses" className="mt-8">
          <Card className="border-none shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">รายการคำตอบทั้งหมด</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-400 text-sm">
                      <th className="pb-4 font-bold uppercase tracking-wider">วันเวลาที่ตอบ</th>
                      <th className="pb-4 font-bold uppercase tracking-wider">รหัสคำตอบ</th>
                      <th className="pb-4 font-bold uppercase tracking-wider text-right">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {(() => {
                      const responseIds = Array.from(new Set(allAnswers.map(a => a.response_id)));
                      if (responseIds.length === 0) {
                        return (
                          <tr>
                            <td colSpan={3} className="py-12 text-center text-slate-400 italic">
                              ยังไม่มีคนไข้ตอบแบบสอบถามนี้
                            </td>
                          </tr>
                        );
                      }
                      return responseIds.map(rid => {
                        const date = allAnswers.find(a => a.response_id === rid)?.responses.created_at;
                        return (
                          <tr key={rid} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="py-4 text-slate-600 dark:text-slate-300 font-medium">
                              {new Date(date).toLocaleString('th-TH')}
                            </td>
                            <td className="py-4 font-mono text-xs text-slate-400">
                              {rid.slice(0, 8)}...
                            </td>
                            <td className="py-4 text-right">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="gap-2 text-primary hover:bg-primary/10"
                                onClick={() => exportResponsePDF(rid)}
                              >
                                <Download className="h-4 w-4" />
                                โหลด PDF
                              </Button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
