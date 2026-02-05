'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, Lock, ChevronDown, Calendar as CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface Question {
  id: string;
  label: string;
  hint?: string;
  type: 'text' | 'choice' | 'rating' | 'checkboxes' | 'date' | 'dropdown';
  options: string[];
  required: boolean;
  allow_other?: boolean;
  logic?: {
    action: 'show';
    condition: {
      questionOrder: number;
      operator: 'equals' | 'not_equals';
      value: string;
    };
  };
}

interface Survey {
  id: string;
  title: string;
  description: string;
  is_active: boolean;
  theme_color: string;
  logo_url?: string;
}

export default function PatientSurvey({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const surveyId = resolvedParams.id;
  
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
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

        if (surveyData) setSurvey(surveyData);
        if (questionsData) setQuestions(questionsData);
      } catch (err: any) {
        console.error('Error fetching survey:', err);
        setError(err.message || 'เกิดข้อผิดพลาดในการโหลดแบบสอบถาม');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [surveyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation for visible required questions
    const missingRequired = visibleQuestions.filter(q => q.required && !answers[q.id]);
    if (missingRequired.length > 0) {
      toast.error(`กรุณาตอบคำถามที่จำเป็น: ${missingRequired[0].label}`);
      return;
    }

    setSubmitting(true);

    try {
      // 1. Create response record
      const { data: response, error: responseError } = await supabase
        .from('responses')
        .insert([{ survey_id: surveyId }])
        .select()
        .single();

      if (responseError) throw responseError;

      // 2. Insert answers (only for visible questions to keep data clean)
      const answersToInsert = visibleQuestions
        .filter(q => answers[q.id])
        .map(q => ({
          response_id: response.id,
          question_id: q.id,
          answer_value: answers[q.id]
        }));

      const { error: answersError } = await supabase
        .from('answers')
        .insert(answersToInsert);

      if (answersError) throw answersError;

      setSubmitted(true);
    } catch (error: any) {
      console.error('Error submitting survey:', error);
      alert('เกิดข้อผิดพลาดในการส่งข้อมูล: ' + (error.message || 'กรุณาลองใหม่อีกครั้ง'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  
  // Logic to determine which questions should be visible
  const visibleQuestions = questions.filter((q, idx) => {
    if (!q.logic) return true;
    
    const { condition } = q.logic;
    const triggerQuestion = questions[condition.questionOrder];
    if (!triggerQuestion) return true;
    
    const triggerAnswer = answers[triggerQuestion.id];
    if (!triggerAnswer) return false;

    // Check checkboxes (can have multiple values separated by |||)
    if (triggerQuestion.type === 'checkboxes') {
      const selectedValues = triggerAnswer.split('|||');
      if (condition.operator === 'equals') {
        return selectedValues.includes(condition.value);
      } else {
        return !selectedValues.includes(condition.value);
      }
    }

    // Standard comparison for other types
    if (condition.operator === 'equals') {
      return triggerAnswer === condition.value || triggerAnswer === `OTHER:${condition.value}`;
    } else {
      return triggerAnswer !== condition.value && triggerAnswer !== `OTHER:${condition.value}`;
    }
  });

  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  if (error) {
    return (
      <div className="flex flex-col h-[60vh] items-center justify-center space-y-4 text-center px-4">
        <div className="bg-red-50 p-4 rounded-full">
          <Loader2 className="h-8 w-8 text-red-500 animate-spin" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">ไม่สามารถโหลดแบบสอบถามได้</h2>
          <p className="text-slate-500 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-4xl opacity-30 pointer-events-none">
        <div className="absolute top-0 left-0 w-72 h-72 bg-emerald-200 rounded-full filter blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-green-200 rounded-full filter blur-[120px] animate-pulse"></div>
      </div>

      <div className="max-w-2xl w-full relative z-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white/40 backdrop-blur-xl border border-white/20 rounded-[3rem] p-12 md:p-16 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] text-center"
        >
          {/* Animated Success Icon */}
          <div className="relative w-32 h-32 mx-auto mb-10">
            <motion.div
              initial={{ rotate: -10, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ 
                type: "spring",
                stiffness: 260,
                damping: 20,
                delay: 0.2 
              }}
              className="relative z-10 w-full h-full bg-gradient-to-tr from-emerald-500 to-green-400 rounded-3xl shadow-lg flex items-center justify-center rotate-6"
            >
              <CheckCircle2 className="h-16 w-16 text-white" strokeWidth={2.5} />
            </motion.div>
            
            {/* Soft Shadow Ring */}
            <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full transform scale-150 -z-10"></div>
          </div>

          {/* Content */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
              <span className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 bg-clip-text text-transparent">
                ส่งข้อมูลเรียบร้อยแล้ว
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-600 font-light leading-relaxed mb-10">
              ขอบคุณสำหรับข้อมูลและการสละเวลาทำแบบสอบถามค่ะ <br className="hidden md:block" />
              ความเห็นของคุณช่วยให้เราพัฒนาได้ดียิ่งขึ้น
            </p>

            {/* Decorative Divider & Footer */}
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "100%", opacity: 1 }}
              transition={{ delay: 0.8, duration: 1 }}
              className="flex flex-col items-center gap-6"
            >
              <div className="h-px w-24 bg-gradient-to-r from-transparent via-emerald-200 to-transparent"></div>
              
              <div className="flex items-center gap-2 text-emerald-600 font-semibold tracking-widest text-xs uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                Submission Received
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
        
        {/* Secondary Action (Optional) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-8 text-center"
        >
          
        </motion.div>
      </div>
    </div>
  );
}

  if (!survey) return <div>ไม่พบแบบสอบถาม</div>;

  if (survey.is_active === false) {
    return (
      <div className="max-w-2xl mx-auto py-24 px-4 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-slate-200/30 to-slate-300/30 rounded-full blur-3xl"></div>
          <div className="relative bg-gradient-to-br from-slate-100 to-slate-200 w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl">
            <Lock className="h-12 w-12 text-slate-500" />
          </div>
        </motion.div>
        
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="space-y-6"
        >
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-slate-700 to-slate-900 bg-clip-text text-transparent">
            แบบสอบถามปิดให้บริการ
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed max-w-lg mx-auto">
            ขออภัยค่ะ แบบสอบถามนี้ได้ปิดรับการตอบกลับชั่วคราว หากต้องการสอบถามข้อมูลเพิ่มเติม กรุณาติดต่อเจ้าหน้าที่
          </p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="pt-8"
          >
            
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950/20">
      {/* Enhanced Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-50 shadow-sm">
        <div 
          className="h-full transition-all duration-500 ease-out shadow-lg"
          style={{ 
            width: `${progress}%`, 
            background: `linear-gradient(90deg, ${survey.theme_color || '#0ea5e9'}, ${survey.theme_color || '#0ea5e9'}dd)`
          }}
        />
      </div>

      {/* Floating Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-8"
      >
        <Card className="border-none shadow-xl overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">
          <CardHeader className="text-center bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50 py-8">
            <div className="relative">
              <div className="absolute -top-2 -left-2 w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full blur-xl"></div>
              {survey.logo_url && (
                <div className="mb-4 flex justify-center">
                  <img 
                    src={survey.logo_url} 
                    alt="Clinic Logo" 
                    className="h-16 object-contain drop-shadow-sm" 
                  />
                </div>
              )}
              <CardTitle className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent leading-tight">
                {survey.title}
              </CardTitle>
            </div>
            {survey.description && (
              <CardDescription className="text-lg mt-3 text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto">
                {survey.description}
              </CardDescription>
            )}
          </CardHeader>
        </Card>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-12 pb-24">
        {visibleQuestions.map((q, idx) => {
          // Find actual index in original questions array for numbering
          const originalIdx = questions.findIndex(origQ => origQ.id === q.id);
          
          return (
            <motion.div
              key={q.id}
              layout
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ 
                duration: 0.4,
                ease: "easeOut"
              }}
              className="relative"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-accent/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <Card className="relative overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all duration-300 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm group">
                <CardContent className="pt-8 pb-8 space-y-6 px-6 sm:px-8">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {originalIdx + 1}
                      </div>
                      <div className="flex-1">
                        <Label className="text-xl font-semibold text-slate-900 dark:text-slate-100 block leading-tight">
                          {q.label} {q.required && <span className="text-destructive ml-2">*</span>}
                        </Label>
                        {q.hint && <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mt-1.5">{q.hint}</p>}
                      </div>
                    </div>
                  </div>

                {q.type === 'text' && (
                  <div className="relative group">
                    <Input 
                      required={q.required}
                      placeholder="พิมพ์คำตอบของคุณที่นี่..."
                      value={answers[q.id] || ''}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                      className="bg-white dark:bg-slate-950 h-12 rounded-xl border-2 border-slate-200 dark:border-slate-800 focus:border-primary focus:ring-4 focus:ring-primary/20 text-base pl-4 pr-4 transition-all duration-300 focus:shadow-lg dark:text-slate-100"
                    />
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                  </div>
                )}

                {q.type === 'choice' && (
                  <div className="space-y-4">
                    <RadioGroup 
                      required={q.required}
                      value={answers[q.id]?.startsWith('OTHER:') ? 'OTHER' : answers[q.id]}
                      onValueChange={(val) => {
                        if (val === 'OTHER') {
                          setAnswers({ ...answers, [q.id]: 'OTHER:' });
                        } else {
                          setAnswers({ ...answers, [q.id]: val });
                        }
                      }}
                      className="space-y-4"
                    >
                      {q.options.map((opt, i) => (
                        <div key={i} className="relative">
                          <label 
                            className="flex items-center gap-4 w-full p-4 rounded-xl border-2 border-slate-200 dark:border-slate-800 hover:border-primary/30 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent cursor-pointer transition-all duration-300 has-[:checked]:bg-gradient-to-r has-[:checked]:from-primary/10 has-[:checked]:to-primary/5 has-[:checked]:border-primary has-[:checked]:shadow-lg has-[:checked]:scale-[1.01] group dark:hover:border-primary/50 dark:has-[:checked]:from-primary/20 dark:has-[:checked]:to-primary/10"
                            style={{ 
                              borderColor: answers[q.id] === opt ? survey.theme_color : undefined,
                              background: answers[q.id] === opt ? `linear-gradient(to right, ${survey.theme_color}10, ${survey.theme_color}05)` : undefined
                            }}
                          >
                            <div className="relative">
                              <RadioGroupItem value={opt} id={`${q.id}-${i}`} className="size-5 border-2 data-[state=checked]:border-primary data-[state=checked]:bg-primary" />
                              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </div>
                            <span className="text-slate-800 dark:text-slate-200 font-medium text-base flex-1">{opt}</span>
                            {answers[q.id] === opt && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                              </motion.div>
                            )}
                          </label>
                        </div>
                      ))}
                      {q.allow_other && (
                        <div className="flex flex-col gap-2">
                          <label 
                            className="flex items-center gap-3 w-full p-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 cursor-pointer transition-all has-[:checked]:bg-slate-50 dark:has-[:checked]:bg-slate-800/50 has-[:checked]:shadow-inner"
                            style={{ borderColor: answers[q.id]?.startsWith('OTHER:') ? survey.theme_color : undefined }}
                          >
                            <RadioGroupItem value="OTHER" id={`${q.id}-other`} className="size-4" />
                            <span className="text-slate-700 dark:text-slate-300 font-medium text-base">อื่นๆ...</span>
                          </label>
                          {answers[q.id]?.startsWith('OTHER:') && (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                              <Input 
                                placeholder="โปรดระบุ..."
                                value={answers[q.id].replace('OTHER:', '')}
                                onChange={(e) => setAnswers({ ...answers, [q.id]: `OTHER:${e.target.value}` })}
                                className="ml-8 w-[calc(100%-2rem)] h-10 rounded-lg text-base bg-white dark:bg-slate-950 dark:border-slate-800 dark:text-slate-100"
                                autoFocus
                              />
                            </motion.div>
                          )}
                        </div>
                      )}
                    </RadioGroup>
                  </div>
                )}

                {q.type === 'checkboxes' && (
                  <div className="space-y-3">
                    {q.options.map((opt, i) => {
                      const currentAnswers = answers[q.id] ? answers[q.id].split('|||') : [];
                      const isChecked = currentAnswers.includes(opt);
                      return (
                        <label 
                          key={i}
                          className="flex items-center gap-3 w-full p-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 cursor-pointer transition-all"
                          style={{ borderColor: isChecked ? survey.theme_color : undefined }}
                        >
                          <Checkbox 
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              let newAnswers;
                              if (checked) {
                                newAnswers = [...currentAnswers, opt];
                              } else {
                                newAnswers = currentAnswers.filter(a => a !== opt);
                              }
                              setAnswers({ ...answers, [q.id]: newAnswers.join('|||') });
                            }}
                            className="size-5"
                          />
                          <span className="text-slate-700 dark:text-slate-200 font-medium text-base">{opt}</span>
                        </label>
                      );
                    })}
                    {q.allow_other && (
                      <div className="flex flex-col gap-2">
                        {(() => {
                          const currentAnswers = answers[q.id] ? answers[q.id].split('|||') : [];
                          const otherAns = currentAnswers.find(a => a.startsWith('OTHER:'));
                          const isOtherChecked = !!otherAns;
                          return (
                            <>
                              <label 
                                className="flex items-center gap-3 w-full p-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 cursor-pointer transition-all"
                                style={{ borderColor: isOtherChecked ? survey.theme_color : undefined }}
                              >
                                <Checkbox 
                                  checked={isOtherChecked}
                                  onCheckedChange={(checked) => {
                                    let newAnswers;
                                    if (checked) {
                                      newAnswers = [...currentAnswers, 'OTHER:'];
                                    } else {
                                      newAnswers = currentAnswers.filter(a => !a.startsWith('OTHER:'));
                                    }
                                    setAnswers({ ...answers, [q.id]: newAnswers.join('|||') });
                                  }}
                                  className="size-4"
                                />
                                <span className="text-slate-700 dark:text-slate-300 font-medium text-base">อื่นๆ...</span>
                              </label>
                              {isOtherChecked && (
                                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                                  <Input 
                                    placeholder="โปรดระบุ..."
                                    value={otherAns?.replace('OTHER:', '') || ''}
                                    onChange={(e) => {
                                      const newAnswers = currentAnswers.map(a => a.startsWith('OTHER:') ? `OTHER:${e.target.value}` : a);
                                      setAnswers({ ...answers, [q.id]: newAnswers.join('|||') });
                                    }}
                                    className="ml-8 w-[calc(100%-2rem)] h-10 rounded-lg text-base bg-white dark:bg-slate-950 dark:border-slate-800 dark:text-slate-100"
                                    autoFocus
                                  />
                                </motion.div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {q.type === 'dropdown' && (
                  <Select 
                    required={q.required}
                    value={answers[q.id]} 
                    onValueChange={(val) => setAnswers({ ...answers, [q.id]: val })}
                  >
                    <SelectTrigger className="w-full h-12 rounded-xl border-2 border-slate-100 dark:border-slate-800 text-base px-4 bg-white dark:bg-slate-950 dark:text-slate-100">
                      <SelectValue placeholder="เลือกคำตอบ..." />
                    </SelectTrigger>
                    <SelectContent>
                      {q.options.map((opt, i) => (
                        <SelectItem key={i} value={opt} className="text-base py-2.5">{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {q.type === 'date' && (
                  <div className="relative">
                    <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                    <Input 
                      type="date"
                      required={q.required}
                      value={answers[q.id] || ''}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                      className="pl-12 h-12 rounded-xl border-2 border-slate-100 dark:border-slate-800 text-base bg-white dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                )}

                {q.type === 'rating' && (
                  <div className="flex justify-between gap-2 max-w-sm mx-auto py-2">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAnswers({ ...answers, [q.id]: val.toString() })}
                        className={`w-12 h-12 rounded-xl border-2 transition-all flex items-center justify-center font-bold text-lg shadow-sm
                          ${answers[q.id] === val.toString() 
                            ? 'scale-110 text-white shadow-lg' 
                            : 'border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 bg-slate-50/30 dark:bg-slate-800/30 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        style={{ 
                          backgroundColor: answers[q.id] === val.toString() ? survey.theme_color : undefined,
                          borderColor: answers[q.id] === val.toString() ? survey.theme_color : undefined
                        }}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        );
      })}

        <div className="pt-12 text-center">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button 
                type="submit" 
                disabled={submitting} 
                size="lg" 
                className="px-12 py-6 text-lg font-semibold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-r from-primary to-primary/90 hover:from-primary hover:to-primary/80"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                    กำลังส่ง...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-3 h-5 w-5" />
                    ส่งคำตอบ
                  </>
                )}
              </Button>
            </motion.div>
            <p className="text-center text-slate-400 text-xs mt-6 font-medium tracking-widest uppercase">
              Powered by Wick
            </p>
          </div>
      </form>
    </div>
  );
}
