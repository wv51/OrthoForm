'use client';

import Link from 'next/link';
import { Stethoscope, LogOut, LayoutDashboard, PlusCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/mode-toggle';

export function Navbar() {
  const [session, setSession] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <div className="bg-primary p-1.5 rounded-lg shadow-sm">
            <Stethoscope className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">OrthoForm</span>
        </Link>
        
        <div className="flex items-center gap-2 sm:gap-6">
          <ModeToggle />
          {session ? (
            <>
              <Link href="/" className="hidden sm:flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                <LayoutDashboard className="h-4 w-4" />
                แดชบอร์ด
              </Link>
              <Link href="/create" className="hidden sm:flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                <PlusCircle className="h-4 w-4" />
                สร้างแบบสอบถาม
              </Link>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout}
                className="text-muted-foreground hover:text-destructive gap-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">ออกจากระบบ</span>
              </Button>
            </>
          ) : (
            <Link href="/login">
              <Button variant="outline" size="sm" className="font-bold border-primary/20 text-primary hover:bg-primary/5">
                เข้าสู่ระบบเจ้าหน้าที่
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
