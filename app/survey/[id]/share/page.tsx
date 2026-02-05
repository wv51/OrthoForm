'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, ArrowLeft, ExternalLink, Download } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function ShareSurvey({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const surveyId = resolvedParams.id;
  
  const [survey, setSurvey] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    setBaseUrl(window.location.origin);
    async function fetchSurvey() {
      const { data } = await supabase
        .from('surveys')
        .select('*')
        .eq('id', surveyId)
        .single();
      setSurvey(data);
    }
    fetchSurvey();
  }, [surveyId]);

  const surveyUrl = `${baseUrl}/survey/${surveyId}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    toast.success('คัดลอกลิงก์แล้ว');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQR = () => {
    const svg = document.getElementById('qr-code');
    if (!svg) return;
    try {
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        const pngFile = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = `QR-${survey?.title || 'Survey'}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
        toast.success('ดาวน์โหลดภาพ QR Code เรียบร้อย');
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    } catch (err) {
      toast.error('ไม่สามารถดาวน์โหลดภาพได้');
    }
  };

  if (!survey) return null;

  return (
    <div className="container mx-auto py-8 px-4 max-w-xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">แชร์แบบสอบถาม</h1>
      </div>

      <Card className="overflow-hidden shadow-lg border-primary/10">
        <CardHeader className="bg-primary/5 border-b border-primary/10">
          <CardTitle className="text-primary">{survey.title}</CardTitle>
          <CardDescription>แชร์ลิงก์หรือ QR Code ให้คนไข้สแกนเพื่อเริ่มทำแบบสอบถาม</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-8 space-y-8">
          <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 ring-4 ring-primary/5">
            <QRCodeSVG 
              id="qr-code"
              value={surveyUrl} 
              size={200} 
              level="H"
              includeMargin={false}
              className="mx-auto"
            />
          </div>

          <div className="w-full space-y-3">
            <label className="text-sm font-bold text-foreground">ลิงก์สำหรับแชร์</label>
            <div className="flex gap-2">
              <div className="flex-1 bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-muted-foreground truncate font-mono">
                {surveyUrl}
              </div>
              <Button variant="outline" size="icon" onClick={copyToClipboard} className="shrink-0">
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full">
            <Button variant="outline" className="gap-2 h-11 border-primary/20 text-primary hover:bg-primary/5" onClick={downloadQR}>
              <Download className="h-4 w-4" />
              โหลดภาพ QR
            </Button>
            <Link href={`/survey/${surveyId}`} target="_blank" className="w-full">
              <Button className="w-full gap-2 h-11 shadow-md shadow-primary/20">
                <ExternalLink className="h-4 w-4" />
                ดูหน้าเว็บจริง
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-primary/5 border-primary/10">
        <CardContent className="p-4 flex items-start gap-3 text-primary">
          <div className="bg-primary p-1 rounded text-primary-foreground mt-0.5">
            <ExternalLink className="h-3 w-3" />
          </div>
          <div className="text-sm leading-relaxed">
            <strong>คำแนะนำ:</strong> คุณสามารถพิมพ์ QR Code แปะไว้ที่หน้าเคาน์เตอร์คลินิกเพื่อให้คนไข้สแกนได้สะดวกระหว่างรอรับบริการครับ
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
