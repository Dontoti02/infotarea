"use client";

import React, { useEffect, useState } from "react";
import { DashboardLayout, NavItem } from "@/shared/components/layout/DashboardLayout";
import { 
  LayoutDashboard, 
  MessageSquare, 
  Users, 
  BookOpen, 
  FileCheck,
  GraduationCap
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const parentMainNavItems: NavItem[] = [
  { label: "Panel Familiar", href: "/parent/dashboard", icon: LayoutDashboard },
  { label: "Comunicación Docente", href: "/parent/comunicacion", icon: MessageSquare },
  { label: "Mis Hijos", href: "/parent/onboarding", icon: Users },
];

export function ParentLayout({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState("Padre de Familia");
  const supabase = createClient();

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        if (profile?.full_name) {
          setUserName(profile.full_name);
        }
      }
    }
    loadUser();
  }, [supabase]);

  return (
    <DashboardLayout 
      mainNavItems={parentMainNavItems} 
      userName={userName}
      userRole="Padre de Familia"
    >
      {children}
    </DashboardLayout>
  );
}
