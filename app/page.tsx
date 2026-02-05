import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardList, BarChart3, QrCode, Plus, AlertTriangle, Users, Calendar, Pencil } from 'lucide-react';
import { DeleteSurveyButton } from '@/components/DeleteSurveyButton';
import { SurveyList } from '@/components/SurveyList';

export default async function Dashboard() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch surveys with response counts
  const { data: surveys, error } = await supabase
    .from('surveys')
    .select(`
      *,
      responses (count)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching surveys:', error);
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">แบบสอบถามของคุณ</h1>
            <p className="text-slate-500">จัดการและดูสถิติของแบบสอบถามทั้งหมด</p>
          </div>
        </div>
        <Card className="flex flex-col items-center justify-center p-12 text-center border-red-200 bg-red-50">
          <div className="bg-red-100 p-4 rounded-full mb-4">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <CardTitle className="text-red-700">
            {error.code === 'PGRST205' ? 'ยังไม่ได้ตั้งค่าฐานข้อมูล' : 'เกิดข้อผิดพลาดในการโหลดข้อมูล'}
          </CardTitle>
          <CardDescription className="mt-2 max-w-lg text-red-600">
            {error.code === 'PGRST205' 
              ? 'ระบบไม่พบตารางข้อมูลที่จำเป็น (Error: PGRST205) กรุณาไปที่ Supabase Dashboard แล้วรันคำสั่ง SQL เพื่อสร้างตาราง' 
              : `ข้อความจากระบบ: ${error.message}`}
          </CardDescription>
          {error.code === 'PGRST205' && (
            <div className="mt-6 p-4 bg-white rounded border border-red-200 text-left text-sm font-mono overflow-auto max-w-full">
              ดูโค้ด SQL ได้ที่ไฟล์ SCHEMA.sql ในโปรเจกต์นี้
            </div>
          )}
        </Card>
      </div>
    );
  }

  const totalSurveys = surveys?.length || 0;
  const totalResponses = surveys?.reduce((acc, s: any) => acc + (s.responses?.[0]?.count || 0), 0) || 0;

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">แดชบอร์ดเจ้าหน้าที่</h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg">ยินดีต้อนรับกลับมาครับ คุณหมอ</p>
        </div>
        <Link href="/create">
          <Button className="gap-2 h-11 px-6 font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105">
            <Plus className="h-5 w-5" />
            สร้างแบบสอบถามใหม่
          </Button>
        </Link>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/10 dark:bg-primary/10 dark:border-primary/20">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="bg-primary p-3 rounded-xl text-primary-foreground shadow-sm">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">แบบสอบถามทั้งหมด</p>
              <p className="text-2xl font-bold text-primary dark:text-primary/90">{totalSurveys}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/50">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="bg-emerald-500 p-3 rounded-xl text-white shadow-sm">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">จำนวนการตอบกลับ</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{totalResponses}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">แบบสอบถามล่าสุด</h2>
        </div>

        <SurveyList initialSurveys={surveys || []} />
      </div>
    </div>
  );
}
