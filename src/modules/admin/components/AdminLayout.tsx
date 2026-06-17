"use client";

import { DashboardLayout, NavItem } from "@/shared/components/layout/DashboardLayout";
import { 
  LayoutDashboard, 
  Megaphone, 
  School, 
  BookOpen, 
  FileCheck, 
  BarChart3, 
  Users, 
  ShieldCheck, 
  Bell, 
  Settings,
  Archive
} from "lucide-react";

const adminMainNavItems: NavItem[] = [
  { label: "Panel de Control", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Avisos", href: "/admin/avisos", icon: Megaphone },
  { label: "Cursos", href: "/admin/cursos", icon: School },
  { label: "Contenido", href: "/admin/contenido", icon: BookOpen },
  { label: "Tareas", href: "/admin/tareas", icon: FileCheck },
  { label: "Seguimiento", href: "/admin/seguimiento", icon: BarChart3 },
  { label: "Usuarios", href: "/admin/usuarios", icon: Users },
  { label: "Roles", href: "/admin/roles", icon: ShieldCheck },
  { label: "Periodos Anuales", href: "/admin/periodos", icon: Archive },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout 
      mainNavItems={adminMainNavItems} 
      userName="Admin Infotarea"
      userRole="Administrador"
    >
      {children}
    </DashboardLayout>
  );
}
