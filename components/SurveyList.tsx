'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, QrCode, Users, Calendar, Pencil, Search, ClipboardList } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DeleteSurveyButton } from '@/components/DeleteSurveyButton';
import { SurveyToggleButton } from '@/components/SurveyToggleButton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Survey {
  id: string;
  title: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  responses?: Array<{ count: number }>;
}

export function SurveyList({ initialSurveys }: { initialSurveys: Survey[] }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSurveys = initialSurveys.filter(survey => 
    survey.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (survey.description && survey.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="ค้นหาแบบสอบถาม..." 
          className="pl-10 h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:border-primary/50"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredSurveys.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-16 text-center border-dashed border-2 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-full mb-4">
            <ClipboardList className="h-12 w-12 text-slate-300 dark:text-slate-600" />
          </div>
          <CardTitle className="text-2xl">ไม่พบแบบสอบถาม</CardTitle>
          <CardDescription className="mt-2 max-w-sm text-base">
            {searchTerm ? `ไม่พบผลลัพธ์สำหรับ "${searchTerm}"` : 'เริ่มต้นสร้างแบบสอบถามแรกของคุณได้ทันที'}
          </CardDescription>
          {!searchTerm && (
            <Link href="/create" className="mt-8">
              <Button variant="outline" size="lg" className="px-8 border-primary text-primary hover:bg-primary/5 dark:hover:bg-primary/10">
                เริ่มสร้างแบบสอบถาม
              </Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredSurveys.map((survey) => (
            <Card key={survey.id} className={`group hover:border-primary/30 transition-all hover:shadow-xl hover:shadow-primary/5 border-2 overflow-hidden flex flex-col ${
                survey.is_active !== false 
                  ? 'border-emerald-200 dark:border-emerald-900 bg-gradient-to-br from-white to-emerald-50/30 dark:from-slate-900 dark:to-emerald-950/20' 
                  : 'border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50/30 dark:from-slate-900 dark:to-slate-900/50'
              }`}>
              <CardHeader className={`flex flex-row items-start justify-between space-y-0 pb-4 ${
                survey.is_active !== false 
                  ? 'bg-gradient-to-r from-emerald-50/50 to-white dark:from-emerald-950/30 dark:to-slate-900' 
                  : 'bg-gradient-to-r from-slate-50/50 to-white dark:from-slate-800/30 dark:to-slate-900'
              }`}>
                <div className="space-y-1 pr-4 flex-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <CardTitle 
                          className={`line-clamp-1 group-hover:text-primary transition-colors text-lg font-bold ${
                            survey.is_active === false ? 'text-slate-500 dark:text-slate-400' : ''
                          }`}
                        >
                          {survey.title}
                        </CardTitle>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>
                        {survey.title}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <CardDescription 
                    className={`line-clamp-2 min-h-[2.5rem] text-sm ${
                      survey.is_active === false ? 'text-slate-400 dark:text-slate-500' : ''
                    }`}
                  >
                    {survey.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
                  </CardDescription>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  
                  <div className="flex items-center gap-1">
                    <Link href={`/edit/${survey.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    <DeleteSurveyButton surveyId={survey.id} surveyTitle={survey.title} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 flex-1">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <SurveyToggleButton 
                      surveyId={survey.id} 
                      isActive={survey.is_active !== false} 
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(survey.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-bold ${
                      survey.is_active !== false 
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 shadow-sm' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}>
                      <Users className="h-3.5 w-3.5" />
                      <span>{survey.responses?.[0]?.count || 0} คนตอบ</span>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className={`grid grid-cols-2 gap-2 border-t p-4 ${
                survey.is_active !== false 
                  ? 'border-emerald-100 dark:border-emerald-900/50 bg-gradient-to-r from-emerald-50/20 to-white dark:from-emerald-950/10 dark:to-slate-900' 
                  : 'border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50/20 to-white dark:from-slate-800/10 dark:to-slate-900'
              }`}>
                <Link href={`/survey/${survey.id}/stats`} className="w-full">
                  <Button variant="outline" size="sm" className="w-full gap-2 font-bold hover:bg-primary/5 dark:hover:bg-primary/10 hover:text-primary hover:border-primary/30 dark:hover:border-primary/50">
                    <BarChart3 className="h-4 w-4" />
                    ดูสถิติ
                  </Button>
                </Link>
                <Link href={`/survey/${survey.id}/share`} className="w-full">
                  <Button variant="outline" size="sm" className="w-full gap-2 font-bold hover:bg-primary/5 dark:hover:bg-primary/10 hover:text-primary hover:border-primary/30 dark:hover:border-primary/50">
                    <QrCode className="h-4 w-4" />
                    แชร์ลิงก์
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
