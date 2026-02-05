'use client';

import { usePathname } from "next/navigation";
import { Navbar } from "./ui/navbar";

export function NavbarWrapper() {
  const pathname = usePathname();
  
  // ตรวจสอบว่าเป็นหน้าทำแบบสอบถามของคนไข้หรือไม่
  // รูปแบบคือ /survey/[id] แต่ไม่ใช่ /survey/[id]/stats หรือ /survey/[id]/share
  const isPatientSurveyPage = /^\/survey\/[^\/]+$/.test(pathname);

  if (isPatientSurveyPage) return null;

  return <Navbar />;
}
