'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { motion } from 'framer-motion';

interface SurveyToggleButtonProps {
  surveyId: string;
  isActive: boolean;
  onToggle?: (newStatus: boolean) => void;
}

export function SurveyToggleButton({ surveyId, isActive, onToggle }: SurveyToggleButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [active, setActive] = useState(isActive);

  const handleToggle = async () => {
    setIsLoading(true);
    
    try {
      const newStatus = !active;
      const { error } = await supabase
        .from('surveys')
        .update({ is_active: newStatus })
        .eq('id', surveyId);

      if (error) {
        throw error;
      }

      setActive(newStatus);
      onToggle?.(newStatus);
      
      toast.success(newStatus ? 'เปิดใช้งานแบบสอบถามแล้ว' : 'ปิดใช้งานแบบสอบถามแล้ว', {
        description: newStatus ? 'ผู้ป่วยสามารถเข้าถึงแบบสอบถามได้' : 'ผู้ป่วยไม่สามารถเข้าถึงแบบสอบถามได้'
      });
    } catch (error) {
      console.error('Error toggling survey status:', error);
      toast.error('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ', {
        description: error instanceof Error ? error.message : 'กรุณาลองใหม่อีกครั้ง'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="flex items-center gap-3 p-2 rounded-2xl bg-gradient-to-r from-white to-slate-50 shadow-sm border border-slate-200"
    >
      <Switch
        checked={active}
        onCheckedChange={handleToggle}
        disabled={isLoading}
        className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-emerald-500 data-[state=checked]:to-green-500 data-[state=unchecked]:bg-slate-300 shadow-inner"
      />
      <span className={`text-sm font-bold transition-colors ${
        active ? 'text-emerald-700' : 'text-slate-500'
      }`}>
        {active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
      </span>
      {isLoading && (
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      )}
    </motion.div>
  );
}