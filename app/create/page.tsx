'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ArrowLeft, Save, Eye, Loader2, CheckCircle2, Circle, AlertCircle, ChevronUp, ChevronDown, Palette, Calendar as CalendarIcon, List, CheckSquare, Type, Hash, Languages, Sparkles, GitBranch, Upload, Image as ImageIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { generateSurveyQuestions } from '@/lib/gemini';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from 'next/link';
import { toast } from 'sonner';

type QuestionType = 'text' | 'choice' | 'rating' | 'checkboxes' | 'date' | 'dropdown';

interface QuestionLogic {
  triggerQuestionId: string;
  operator: 'equals' | 'not_equals';
  value: string;
}

interface Question {
  id: string;
  label: string;
  hint: string;
  type: QuestionType;
  options: string[];
  required: boolean;
  allowOther?: boolean;
  logic?: QuestionLogic;
}

export default function CreateSurvey() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [themeColor, setThemeColor] = useState('#0ea5e9');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([
    { id: Math.random().toString(), label: '', hint: '', type: 'text', options: [], required: false }
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [isTranslating, setIsTranslating] = useState<string | null>(null);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiTopic, setAiTopic] = useState('');

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    setIsUploadingLogo(true);
    const toastId = toast.loading('กำลังอัปโหลดโลโก้...');

    try {
      const { error: uploadError } = await supabase.storage
        .from('survey-logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('survey-logos').getPublicUrl(filePath);
      setLogoUrl(data.publicUrl);
      toast.success('อัปโหลดโลโก้สำเร็จ', { id: toastId });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('เกิดข้อผิดพลาดในการอัปโหลดโลโก้', { id: toastId });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const removeLogo = () => {
    setLogoUrl(null);
  };

  const handleAIGenerate = async () => {
    if (!aiTopic.trim()) {
      toast.error('กรุณาระบุหัวข้อที่ต้องการให้ AI ช่วยคิด');
      return;
    }

    setIsAIGenerating(true);
    const toastId = toast.loading('AI กำลังคิดคำถามให้คุณ...');
    try {
      const newQuestions = await generateSurveyQuestions(aiTopic);
      if (newQuestions.length > 0) {
        const formattedQuestions = newQuestions.map(q => ({
          ...q,
          id: Math.random().toString(),
        }));
        setQuestions([...questions, ...formattedQuestions]);
        toast.success(`สร้างคำถามสำเร็จ ${newQuestions.length} ข้อ`, { id: toastId });
        setShowAIDialog(false);
        setAiTopic('');
      } else {
        toast.error('ไม่สามารถสร้างคำถามได้ในขณะนี้', { id: toastId });
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ AI', { id: toastId });
    } finally {
      setIsAIGenerating(false);
    }
  };

  const translateQuestion = async (qId: string) => {
    const q = questions.find(q => q.id === qId);
    if (!q || (!q.label && !q.hint && q.options.length === 0)) return;

    setIsTranslating(qId);
    try {
      const textsToTranslate = [
        q.label,
        q.hint,
        ...q.options
      ].filter(t => t.trim() !== '');

      if (textsToTranslate.length === 0) return;

      const translatedTexts = await Promise.all(
        textsToTranslate.map(async (text) => {
          const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`);
          const data = await res.json();
          return data[0][0][0];
        })
      );

      let index = 0;
      const updates: any = {};
      if (q.label) updates.label = translatedTexts[index++];
      if (q.hint) updates.hint = translatedTexts[index++];
      if (q.options.length > 0) {
        updates.options = q.options.map(opt => opt ? translatedTexts[index++] : '');
      }

      updateQuestion(qId, updates);
      toast.success('แปลเป็นภาษาอังกฤษเรียบร้อยแล้ว');
    } catch (error) {
      console.error('Translation error:', error);
      toast.error('เกิดข้อผิดพลาดในการแปลภาษา');
    } finally {
      setIsTranslating(null);
    }
  };

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
      } else {
        setAuthLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  if (authLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const addQuestion = () => {
    setQuestions([...questions, { id: Math.random().toString(), label: '', hint: '', type: 'text', options: [], required: false }]);
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
     if ((direction === 'up' && index === 0) || (direction === 'down' && index === questions.length - 1)) return;
     const newQuestions = [...questions];
     const targetIndex = direction === 'up' ? index - 1 : index + 1;
     [newQuestions[index], newQuestions[targetIndex]] = [newQuestions[targetIndex], newQuestions[index]];
     setQuestions(newQuestions);
   };

  const removeQuestion = (id: string) => {
    if (questions.length > 1) {
      setQuestions(questions.filter(q => q.id !== id));
      toast.success('ลบคำถามเรียบร้อยแล้ว');
    }
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const addOption = (qId: string) => {
    setQuestions(questions.map(q => q.id === qId ? { ...q, options: [...q.options, ''] } : q));
  };

  const updateOption = (qId: string, optIdx: number, value: string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        const newOptions = [...q.options];
        newOptions[optIdx] = value;
        return { ...q, options: newOptions };
      }
      return q;
    }));
  };

  const removeOption = (qId: string, optIdx: number) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        const newOptions = q.options.filter((_, i) => i !== optIdx);
        return { ...q, options: newOptions };
      }
      return q;
    }));
  };

  const saveSurvey = async () => {
    if (!title) {
      toast.error('กรุณาระบุชื่อแบบสอบถาม');
      return;
    }
    
    const validQuestions = questions.filter(q => q.label.trim() !== '');
    if (validQuestions.length === 0) {
      toast.error('กรุณาเพิ่มคำถามอย่างน้อย 1 ข้อ');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading('กำลังบันทึกแบบสอบถาม...');

    try {
      // 1. Create survey
      const { data: survey, error: surveyError } = await supabase
        .from('surveys')
        .insert([{ title, description, is_active: isActive, theme_color: themeColor, logo_url: logoUrl }])
        .select()
        .single();

      if (surveyError) throw surveyError;

      // 2. Create questions
      const questionsToInsert = validQuestions.map((q, index) => {
        let dbLogic = null;
        if (q.logic && q.logic.triggerQuestionId) {
          const triggerIndex = validQuestions.findIndex(vq => vq.id === q.logic!.triggerQuestionId);
          if (triggerIndex !== -1 && triggerIndex < index) {
            dbLogic = {
              action: 'show',
              condition: {
                questionOrder: triggerIndex,
                operator: q.logic.operator,
                value: q.logic.value
              }
            };
          }
        }

        return {
          survey_id: survey.id,
          label: q.label,
          hint: q.hint,
          type: q.type,
          options: q.options,
          required: q.required,
          allow_other: q.allowOther,
          order: index,
          logic: dbLogic
        };
      });

      const { error: questionsError } = await supabase
        .from('questions')
        .insert(questionsToInsert);

      if (questionsError) throw questionsError;

      toast.success('บันทึกแบบสอบถามเรียบร้อยแล้ว', { id: toastId });
      router.push('/');
    } catch (error) {
      console.error('Error saving survey:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึกแบบสอบถาม', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {isPreview ? 'ตัวอย่างแบบสอบถาม' : 'สร้างแบบสอบถามใหม่'}
          </h1>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setIsPreview(!isPreview)}
          className="gap-2"
        >
          {isPreview ? (
            <>
              <Save className="h-4 w-4" /> แก้ไขต่อ
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" /> ดูตัวอย่าง
            </>
          )}
        </Button>
      </div>

      {isPreview ? (
        <div className="space-y-6">
          <Card className="border-t-4 shadow-lg dark:bg-slate-900" style={{ borderTopColor: themeColor }}>
            <CardHeader>
              {logoUrl && (
                <div className="mb-4 flex justify-center">
                  <img src={logoUrl} alt="Clinic Logo" className="h-20 object-contain" />
                </div>
              )}
              <CardTitle className="text-2xl">{title || 'ชื่อแบบสอบถาม'}</CardTitle>
              {description && <CardDescription className="text-base">{description}</CardDescription>}
            </CardHeader>
          </Card>

          {questions.filter(q => q.label.trim() !== '').map((q, i) => (
            <Card key={q.id} className="shadow-sm border-none bg-white dark:bg-slate-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-start gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs mt-1 shrink-0">
                    {i + 1}
                  </span>
                  <div>
                    {q.label}
                    {q.required && <span className="text-destructive ml-1">*</span>}
                    {q.hint && <p className="text-sm font-normal text-slate-500 dark:text-slate-400 mt-1">{q.hint}</p>}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                {q.type === 'text' && (
                  <Input placeholder="คำตอบของคุณ..." disabled className="bg-slate-50/50 dark:bg-slate-800/50" />
                )}
                {q.type === 'choice' && (
                  <div className="space-y-2">
                    {q.options.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                        <div className="w-4 h-4 rounded-full border-2 border-slate-200 dark:border-slate-600" />
                        <span className="text-slate-600 dark:text-slate-300 text-sm">{opt || `ตัวเลือกที่ ${idx + 1}`}</span>
                      </div>
                    ))}
                    {q.allowOther && (
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                        <div className="w-4 h-4 rounded-full border-2 border-slate-200 dark:border-slate-600" />
                        <span className="text-slate-400 dark:text-slate-500 text-sm italic">อื่นๆ...</span>
                      </div>
                    )}
                  </div>
                )}
                {q.type === 'checkboxes' && (
                  <div className="space-y-2">
                    {q.options.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                        <div className="w-4 h-4 rounded border-2 border-slate-200 dark:border-slate-600" />
                        <span className="text-slate-600 dark:text-slate-300 text-sm">{opt || `ตัวเลือกที่ ${idx + 1}`}</span>
                      </div>
                    ))}
                    {q.allowOther && (
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                        <div className="w-4 h-4 rounded border-2 border-slate-200 dark:border-slate-600" />
                        <span className="text-slate-400 dark:text-slate-500 text-sm italic">อื่นๆ...</span>
                      </div>
                    )}
                  </div>
                )}
                {q.type === 'dropdown' && (
                  <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center text-slate-400 text-sm">
                    เลือกคำตอบ...
                    <ChevronDown className="h-4 w-4" />
                  </div>
                )}
                {q.type === 'date' && (
                  <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center gap-3 text-slate-400 text-sm">
                    <CalendarIcon className="h-4 w-4" />
                    วว/ดด/ปปปป
                  </div>
                )}
                {q.type === 'rating' && (
                  <div className="flex justify-between max-w-sm mx-auto py-4">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <div key={num} className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full border-2 border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-400 font-bold">
                          {num}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          
          <div className="p-4 rounded-xl text-center text-sm italic border-2 border-dashed bg-slate-50 text-slate-400 border-slate-200">
            * นี่คือหน้าตัวอย่าง (Preview)
          </div>
        </div>
      ) : (
        <>
          <Card className="shadow-md border-primary/10 overflow-hidden dark:bg-slate-900">
            <div className="h-2 w-full" style={{ backgroundColor: themeColor }} />
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">ข้อมูลพื้นฐาน</CardTitle>
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                  <Palette className="h-4 w-4 text-slate-400" />
                  <div className="flex gap-1.5 items-center">
                    {['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'].map(color => (
                      <button
                        key={color}
                        onClick={() => setThemeColor(color)}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${themeColor === color ? 'border-slate-900 dark:border-slate-100 scale-110' : 'border-transparent hover:scale-105'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-600 mx-1" />
                    <div className="relative flex items-center">
                      <input
                        type="color"
                        value={themeColor}
                        onChange={(e) => setThemeColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0 overflow-hidden"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>โลโก้คลินิก (Optional)</Label>
                <div className="flex items-center gap-4">
                  {logoUrl ? (
                    <div className="relative group">
                      <div className="w-24 h-24 border rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                        <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                      </div>
                      <button
                        onClick={removeLogo}
                        className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 shadow-md hover:bg-destructive/90 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="w-24 h-24 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-400 hover:text-primary gap-1">
                      {isUploadingLogo ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : (
                        <>
                          <Upload className="h-6 w-6" />
                          <span className="text-[10px]">อัปโหลด</span>
                        </>
                      )}
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleLogoUpload}
                        disabled={isUploadingLogo}
                      />
                    </label>
                  )}
                  <div className="text-sm text-slate-500">
                    <p>รองรับไฟล์รูปภาพ (JPG, PNG)</p>
                    <p className="text-xs text-slate-400 mt-1">ขนาดแนะนำ: 200x200 px</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="survey-title">ชื่อแบบสอบถาม</Label>
                <Input 
                  id="survey-title"
                  placeholder="เช่น แบบประเมินอาการปวดหลัง" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="survey-desc">รายละเอียด (ไม่บังคับ)</Label>
                <Input 
                  id="survey-desc"
                  placeholder="เช่น สำหรับคนไข้ใหม่ที่คลินิก" 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                 <Checkbox 
                   id="survey-active" 
                   checked={isActive}
                   onCheckedChange={(checked) => setIsActive(checked === true)}
                 />
                 <Label htmlFor="survey-active" className="cursor-pointer font-bold select-none flex-1">
                   {isActive ? (
                     <span className="flex items-center text-emerald-600 gap-1.5">
                       <CheckCircle2 className="h-4 w-4" /> เปิดใช้งาน (อนุญาตให้คนไข้ทำแบบสอบถาม)
                     </span>
                   ) : (
                     <span className="flex items-center text-slate-500 gap-1.5">
                       <Circle className="h-4 w-4" /> ปิดใช้งาน (ปิดรับการตอบกลับชั่วคราว)
                     </span>
                   )}
                 </Label>
               </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">คำถามในแบบสอบถาม</h2>
                <Badge variant="outline" className="font-bold">{questions.length} ข้อ</Badge>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 border-primary/20 text-primary hover:bg-primary/5 font-bold"
                onClick={() => setShowAIDialog(true)}
              >
                <Sparkles className="h-4 w-4" />
                ให้ AI ช่วยคิดคำถาม
              </Button>
            </div>
            
            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {questions.map((q, index) => (
                  <motion.div
                    key={q.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="relative group shadow-sm border-slate-200 dark:border-slate-700 overflow-hidden hover:border-slate-300 dark:hover:border-slate-600 transition-all dark:bg-slate-900">
                      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: themeColor }} />
                      <CardContent className="pt-6 space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                          <div className="flex-1 space-y-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="font-bold text-slate-900 dark:text-slate-100">คำถามที่ {index + 1}</Label>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7" 
                                    onClick={() => moveQuestion(index, 'up')}
                                    disabled={index === 0}
                                  >
                                    <ChevronUp className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7" 
                                    onClick={() => moveQuestion(index, 'down')}
                                    disabled={index === questions.length - 1}
                                  >
                                    <ChevronDown className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              <Input 
                                placeholder="ใส่คำถามของคุณที่นี่" 
                                value={q.label}
                                onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                                className="h-11 font-medium"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-500 text-xs">คำอธิบายเพิ่มเติม (Optional)</Label>
                              <Input 
                                placeholder="เช่น ระบุเป็นตัวเลขเท่านั้น" 
                                value={q.hint}
                                onChange={(e) => updateQuestion(q.id, { hint: e.target.value })}
                                className="h-9 text-sm bg-slate-50/50 dark:bg-slate-800/50"
                              />
                            </div>
                          </div>
                          <div className="w-full sm:w-48 space-y-2">
                            <Label>ประเภทคำถาม</Label>
                            <Select
                              value={q.type}
                              onValueChange={(value: QuestionType) => 
                                updateQuestion(q.id, { 
                                  type: value, 
                                  options: value === 'choice' ? [''] : [] 
                                })
                              }
                            >
                              <SelectTrigger className="w-full h-11 bg-white dark:bg-slate-950">
                                <SelectValue placeholder="เลือกประเภท" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">
                                  <div className="flex items-center gap-2"><Type className="h-4 w-4" /> ข้อความ (Text)</div>
                                </SelectItem>
                                <SelectItem value="choice">
                                  <div className="flex items-center gap-2"><Circle className="h-4 w-4" /> ตัวเลือกเดียว (Choice)</div>
                                </SelectItem>
                                <SelectItem value="checkboxes">
                                  <div className="flex items-center gap-2"><CheckSquare className="h-4 w-4" /> หลายตัวเลือก (Checkboxes)</div>
                                </SelectItem>
                                <SelectItem value="dropdown">
                                  <div className="flex items-center gap-2"><List className="h-4 w-4" /> รายการเลือก (Dropdown)</div>
                                </SelectItem>
                                <SelectItem value="rating">
                                  <div className="flex items-center gap-2"><Hash className="h-4 w-4" /> คะแนน (Rating 1-5)</div>
                                </SelectItem>
                                <SelectItem value="date">
                                  <div className="flex items-center gap-2"><CalendarIcon className="h-4 w-4" /> วันที่ (Date)</div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              id={`req-${q.id}`} 
                              checked={q.required}
                              onCheckedChange={(checked) => updateQuestion(q.id, { required: checked === true })}
                            />
                            <Label htmlFor={`req-${q.id}`} className="text-sm font-medium cursor-pointer select-none">
                              จำเป็นต้องตอบ (Required)
                            </Label>
                            {q.required && <AlertCircle className="h-3.5 w-3.5 text-amber-500" />}
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-primary hover:bg-primary/5 gap-2 h-8"
                            onClick={() => translateQuestion(q.id)}
                            disabled={isTranslating === q.id}
                          >
                            {isTranslating === q.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Languages className="h-3.5 w-3.5" />
                            )}
                            <span className="text-xs">แปลเป็นภาษาอังกฤษ</span>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-slate-400 hover:text-destructive gap-2 h-8"
                            onClick={() => removeQuestion(q.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="text-xs">ลบคำถาม</span>
                          </Button>
                        </div>

                        {/* Skip Logic Section */}
                        {index > 0 && (
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                             {!q.logic ? (
                               <Button
                                 variant="ghost"
                                 size="sm"
                                 onClick={() => updateQuestion(q.id, { logic: { triggerQuestionId: '', operator: 'equals', value: '' } })}
                                 className="text-slate-500 hover:text-primary gap-2"
                               >
                                 <GitBranch className="h-4 w-4" />
                                 <span className="text-xs">เพิ่มเงื่อนไขการแสดงผล (Skip Logic)</span>
                               </Button>
                             ) : (
                               <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                                 <div className="flex items-center justify-between">
                                   <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                                     <GitBranch className="h-4 w-4 text-primary" />
                                     แสดงคำถามนี้ก็ต่อเมื่อ...
                                   </div>
                                   <Button
                                     variant="ghost"
                                     size="icon"
                                     className="h-6 w-6 text-slate-400 hover:text-destructive"
                                     onClick={() => updateQuestion(q.id, { logic: undefined })}
                                   >
                                     <Trash2 className="h-3 w-3" />
                                   </Button>
                                 </div>
                                 <div className="flex flex-col sm:flex-row gap-3">
                                   <div className="flex-1">
                                      <Select
                                        value={q.logic.triggerQuestionId}
                                        onValueChange={(val) => updateQuestion(q.id, { logic: { ...q.logic!, triggerQuestionId: val, value: '' } })}
                                      >
                                        <SelectTrigger className="h-9 bg-white dark:bg-slate-950 text-xs">
                                          <SelectValue placeholder="เลือกคำถามก่อนหน้า" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {questions
                                            .slice(0, index)
                                            .filter(prevQ => ['choice', 'dropdown', 'rating', 'checkboxes'].includes(prevQ.type))
                                            .map((prevQ, idx) => (
                                              <SelectItem key={prevQ.id} value={prevQ.id}>
                                                {idx + 1}. {prevQ.label || '(ไม่มีชื่อ)'}
                                              </SelectItem>
                                            ))
                                          }
                                        </SelectContent>
                                      </Select>
                                   </div>
                                   <div className="w-24 shrink-0 flex items-center justify-center text-xs text-slate-500 font-medium">
                                      เท่ากับ
                                   </div>
                                   <div className="flex-1">
                                      <Select
                                        value={q.logic.value}
                                        onValueChange={(val) => updateQuestion(q.id, { logic: { ...q.logic!, value: val } })}
                                        disabled={!q.logic.triggerQuestionId}
                                      >
                                        <SelectTrigger className="h-9 bg-white dark:bg-slate-950 text-xs">
                                          <SelectValue placeholder="เลือกคำตอบ" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {(() => {
                                            const triggerQ = questions.find(vq => vq.id === q.logic!.triggerQuestionId);
                                            if (!triggerQ) return null;
                                            
                                            if (triggerQ.type === 'rating') {
                                              return [1, 2, 3, 4, 5].map(n => (
                                                <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                                              ));
                                            }
                                            
                                            return triggerQ.options.map((opt, i) => (
                                              <SelectItem key={i} value={opt || `ตัวเลือก ${i+1}`}>{opt || `ตัวเลือก ${i+1}`}</SelectItem>
                                            ));
                                          })()}
                                        </SelectContent>
                                      </Select>
                                   </div>
                                 </div>
                               </div>
                             )}
                          </div>
                        )}

                        {(q.type === 'choice' || q.type === 'checkboxes' || q.type === 'dropdown') && (
                          <div className="space-y-3 pl-4 border-l-2 border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30 p-4 rounded-r-lg">
                            <div className="flex items-center justify-between">
                              <Label className="text-muted-foreground text-xs font-bold uppercase tracking-wider">ตัวเลือกคำตอบ</Label>
                              {(q.type === 'choice' || q.type === 'checkboxes') && (
                                <div className="flex items-center gap-2">
                                  <Checkbox 
                                    id={`other-${q.id}`}
                                    checked={q.allowOther}
                                    onCheckedChange={(checked) => updateQuestion(q.id, { allowOther: checked === true })}
                                  />
                                  <Label htmlFor={`other-${q.id}`} className="text-xs cursor-pointer">เพิ่มตัวเลือก "อื่นๆ"</Label>
                                </div>
                              )}
                            </div>
                            <AnimatePresence initial={false}>
                              {q.options.map((opt, optIdx) => (
                                <motion.div 
                                  key={optIdx} 
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: 10 }}
                                  className="flex gap-2"
                                >
                                  <div className="flex items-center justify-center w-10 h-10 shrink-0">
                                    {q.type === 'choice' || q.type === 'dropdown' ? <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600" /> : <CheckSquare className="h-4 w-4 text-slate-300 dark:text-slate-600" />}
                                  </div>
                                  <Input 
                                    placeholder={`ตัวเลือกที่ ${optIdx + 1}`} 
                                    value={opt}
                                    onChange={(e) => updateOption(q.id, optIdx, e.target.value)}
                                    className="bg-white dark:bg-slate-950 h-10"
                                  />
                                  <Button variant="ghost" size="icon" onClick={() => removeOption(q.id, optIdx)} className="text-slate-400 hover:text-destructive h-10 w-10">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                            {q.allowOther && (
                              <div className="flex gap-2 opacity-60">
                                <div className="flex items-center justify-center w-10 h-10 shrink-0">
                                  {q.type === 'choice' ? <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600" /> : <CheckSquare className="h-4 w-4 text-slate-300 dark:text-slate-600" />}
                                </div>
                                <Input value='อื่นๆ...' disabled className="bg-slate-100/50 dark:bg-slate-800/50 h-10" />
                                <div className="w-10" />
                              </div>
                            )}
                            <Button variant="outline" size="sm" className="text-primary border-primary/20 hover:bg-primary/5 h-10 w-full dashed border-2 border-dashed" onClick={() => addOption(q.id)}>
                              <Plus className="h-4 w-4 mr-1" /> เพิ่มตัวเลือก
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <Button 
              type="button" 
              variant="outline" 
              className="w-full py-8 border-dashed border-2 hover:bg-slate-50 dark:hover:bg-slate-900 hover:border-primary/50 transition-all group dark:border-slate-700"
              onClick={addQuestion}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-primary/10 transition-colors">
                  <Plus className="h-6 w-6 text-slate-400 group-hover:text-primary" />
                </div>
                <span className="font-bold text-slate-500 dark:text-slate-400 group-hover:text-primary">เพิ่มคำถามใหม่</span>
              </div>
            </Button>
          </div>

          <div className="flex gap-4 pt-4">
            <Button variant="outline" className="flex-1" onClick={addQuestion}>
              <Plus className="h-4 w-4 mr-2" /> เพิ่มคำถาม
            </Button>
            <Button className="flex-1" onClick={saveSurvey} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" /> 
              {isSaving ? 'กำลังบันทึก...' : 'บันทึกแบบสอบถาม'}
            </Button>
          </div>
        </>
      )}

      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              ให้ AI ช่วยคิดคำถาม
            </DialogTitle>
            <DialogDescription>
              ระบุหัวข้อหรือบริการที่คุณต้องการสำรวจความคิดเห็น เพื่อให้ AI ช่วยร่างคำถามที่เหมาะสมให้ครับ
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ai-topic">หัวข้อที่ต้องการสำรวจ</Label>
              <Input
                id="ai-topic"
                placeholder="เช่น ความพึงพอใจการผ่าตัดเปลี่ยนข้อเข่า"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAIGenerate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAIDialog(false)} disabled={isAIGenerating}>ยกเลิก</Button>
            <Button onClick={handleAIGenerate} disabled={isAIGenerating || !aiTopic.trim()}>
              {isAIGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              สร้างคำถาม
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
