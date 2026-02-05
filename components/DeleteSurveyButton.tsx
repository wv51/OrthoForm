'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DeleteSurveyButtonProps {
  surveyId: string;
  surveyTitle: string;
}

export function DeleteSurveyButton({ surveyId, surveyTitle }: DeleteSurveyButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // Supabase will handle cascading deletes if set up, 
      // otherwise we should delete answers/responses first.
      // Assuming SCHEMA.sql has ON DELETE CASCADE.
      const { error } = await supabase
        .from('surveys')
        .delete()
        .eq('id', surveyId);

      if (error) throw error;

      toast.success('ลบแบบสอบถามเรียบร้อยแล้ว');
      setOpen(false);
      router.refresh();
    } catch (error) {
      console.error('Error deleting survey:', error);
      toast.error('ไม่สามารถลบแบบสอบถามได้');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive transition-colors"
          disabled={isDeleting}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ยืนยันการลบแบบสอบถาม?</DialogTitle>
          <DialogDescription className="py-4">
            คุณกำลังจะลบแบบสอบถาม <span className="font-bold text-slate-900">"{surveyTitle}"</span> <br />
            การกระทำนี้ไม่สามารถย้อนกลับได้ ข้อมูลการตอบกลับทั้งหมดจะถูกลบไปด้วย
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button variant="outline" disabled={isDeleting}>ยกเลิก</Button>
          </DialogClose>
          <Button 
            onClick={handleDelete}
            variant="destructive"
            className="font-bold"
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                กำลังลบ...
              </>
            ) : (
              'ยืนยันการลบ'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
