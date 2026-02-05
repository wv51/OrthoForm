'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Stethoscope, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/');
      } else {
        setCheckingAuth(false);
      }
    }
    checkUser();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success('เข้าสู่ระบบสำเร็จ');
      router.push('/');
      router.refresh();
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
      toast.error('ไม่สามารถเข้าสู่ระบบได้');
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-lg border-primary/10 dark:border-primary/20 dark:bg-slate-900">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto bg-primary/10 dark:bg-primary/20 p-3 rounded-full w-fit mb-2">
            <Stethoscope className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-primary">เข้าสู่ระบบเจ้าหน้าที่</CardTitle>
          <CardDescription>
            กรุณาเข้าสู่ระบบเพื่อจัดการแบบสอบถามและดูสถิติ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {error === 'Invalid login credentials' ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">อีเมล</Label>
              <Input
                id="email"
                type="email"
                placeholder="doctor@orthoform.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-50/50 dark:bg-slate-800/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">รหัสผ่าน</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-slate-50/50 dark:bg-slate-800/50"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full font-bold shadow-md shadow-primary/20" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังเข้าสู่ระบบ...
                </>
              ) : 'เข้าสู่ระบบ'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-slate-50 dark:border-slate-800 pt-4">
          <p className="text-xs text-muted-foreground text-center">
            ระบบจัดการแบบสอบถามสำหรับคลินิกกระดูกและข้อ<br/>
            หากลืมรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบ
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
