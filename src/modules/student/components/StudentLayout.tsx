"use client";

import { DashboardLayout, NavItem } from "@/shared/components/layout/DashboardLayout";
import { 
  LayoutDashboard, 
  Megaphone, 
  School, 
  BookOpen, 
  FileCheck, 
  ClipboardList,
  BarChart3, 
  Bell, 
  Settings 
} from "lucide-react";

const studentMainNavItems: NavItem[] = [
  { label: "Panel de Control", href: "/student/dashboard", icon: LayoutDashboard },
  { label: "Centro de Avisos", href: "/student/avisos", icon: Megaphone },
  { label: "Mis Cursos", href: "/student/cursos", icon: School },
  { label: "Biblioteca", href: "/student/biblioteca", icon: BookOpen },
  { label: "Tareas", href: "/student/tareas", icon: FileCheck },
  { label: "Mis Entregas", href: "/student/entregas", icon: ClipboardList },
  { label: "Seguimiento", href: "/student/seguimiento", icon: BarChart3 },
];

export function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout 
      mainNavItems={studentMainNavItems} 
      userName="Ana García"
      userRole="Estudiante"
    >
      {children}
    </DashboardLayout>
  );
}
