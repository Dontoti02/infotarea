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

const teacherMainNavItems: NavItem[] = [
  { label: "Panel de Control", href: "/teacher/dashboard", icon: LayoutDashboard },
  { label: "Avisos", href: "/teacher/avisos", icon: Megaphone },
  { label: "Mis Cursos", href: "/teacher/cursos", icon: School },
  { label: "Material Didáctico", href: "/teacher/contenido", icon: BookOpen },
  { label: "Gestión de Tareas", href: "/teacher/tareas", icon: FileCheck },
  { label: "Revisión de Entregas", href: "/teacher/entregas", icon: ClipboardList },
  { label: "Seguimiento Grupal", href: "/teacher/seguimiento", icon: BarChart3 },
];

export function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout 
      mainNavItems={teacherMainNavItems} 
      userName="Prof. Carlos Ruiz"
      userRole="Docente Titular"
    >
      {children}
    </DashboardLayout>
  );
}
