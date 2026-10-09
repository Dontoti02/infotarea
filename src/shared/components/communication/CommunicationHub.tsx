"use client";

import React, { useState, useEffect } from "react";
import { MessageSquare, Users, Building2, Loader2, Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ChatView, ChatContact } from "./ChatView";

type UserRole = "teacher" | "student" | "admin" | "parent";
type TabId = "teacher_student" | "admin_teacher" | "teacher_parent";

interface CommunicationHubProps {
  userRole: UserRole;
  userId: string;
  userName?: string;
}

export function CommunicationHub({
  userRole,
  userId,
  userName = "Usuario",
}: CommunicationHubProps) {
  const supabase = createClient();
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("teacher_student");

  // Determine available tabs per role
  const tabs: { id: TabId; label: string; icon: React.ElementType; color: string; accentColor: string; channel: string }[] = (() => {
    if (userRole === "admin") {
      return [
        {
          id: "admin_teacher" as TabId,
          label: "Chat con Docentes",
          icon: Users,
          color: "amber",
          accentColor: "amber",
          channel: "admin_teacher",
        },
      ];
    }
    if (userRole === "teacher") {
      return [
        {
          id: "teacher_student" as TabId,
          label: "Alumnos",
          icon: MessageSquare,
          color: "teal",
          accentColor: "teal",
          channel: "teacher_student",
        },
        {
          id: "admin_teacher" as TabId,
          label: "Dirección",
          icon: Building2,
          color: "amber",
          accentColor: "amber",
          channel: "admin_teacher",
        },
        {
          id: "teacher_parent" as TabId,
          label: "Padres / Apoderados",
          icon: Heart,
          color: "violet",
          accentColor: "violet",
          channel: "teacher_parent",
        },
      ];
    }
    if (userRole === "student") {
      return [
        {
          id: "teacher_student" as TabId,
          label: "Mis Docentes",
          icon: MessageSquare,
          color: "teal",
          accentColor: "teal",
          channel: "teacher_student",
        },
      ];
    }
    if (userRole === "parent") {
      return [
        {
          id: "teacher_parent" as TabId,
          label: "Docentes de mis hijos",
          icon: MessageSquare,
          color: "violet",
          accentColor: "violet",
          channel: "teacher_parent",
        },
      ];
    }
    return [];
  })();

  // Set default tab
  useEffect(() => {
    if (tabs.length > 0) {
      setActiveTab(tabs[0].id);
    }
  }, [userRole]);

  // Load contacts for the active tab
  useEffect(() => {
    async function loadContacts() {
      setLoading(true);
      setContacts([]);

      try {
        const activeTabInfo = tabs.find(t => t.id === activeTab);
        if (!activeTabInfo) { setLoading(false); return; }

        if (activeTab === "teacher_student") {
          if (userRole === "teacher") {
            // Load students enrolled in teacher's courses
            const { data: coursesData } = await supabase
              .from("courses")
              .select("id, name, section")
              .eq("teacher_id", userId);

            if (coursesData && coursesData.length > 0) {
              const courseIds = coursesData.map(c => c.id);
              const { data: members } = await supabase
                .from("course_members")
                .select("profile_id, profiles:profile_id(id, full_name, role)")
                .in("course_id", courseIds);

              if (members) {
                const seen = new Set<string>();
                const studentContacts: ChatContact[] = [];
                for (const m of members) {
                  const p = m.profiles as any;
                  if (p && p.role === "student" && !seen.has(p.id)) {
                    seen.add(p.id);
                    const course = coursesData.find(c => courseIds.includes(c.id));
                    studentContacts.push({
                      id: p.id,
                      name: p.full_name || "Estudiante",
                      subtitle: "Estudiante",
                    });
                  }
                }
                setContacts(studentContacts);
              }
            } else {
              // Fallback: all students
              const { data: students } = await supabase
                .from("profiles")
                .select("id, full_name")
                .eq("role", "student")
                .order("full_name");
              setContacts(
                (students || []).map(s => ({ id: s.id, name: s.full_name || "Estudiante", subtitle: "Estudiante" }))
              );
            }
          } else if (userRole === "student") {
            // Load teachers from student's courses
            const { data: memberships } = await supabase
              .from("course_members")
              .select("course_id, courses:course_id(id, name, section, teacher_id)")
              .eq("profile_id", userId);

            if (memberships && memberships.length > 0) {
              const teacherIds = new Set<string>();
              const courseMap: Record<string, string> = {};
              for (const m of memberships) {
                const c = m.courses as any;
                if (c?.teacher_id) {
                  teacherIds.add(c.teacher_id);
                  courseMap[c.teacher_id] = `${c.name} - Sección ${c.section}`;
                }
              }

              if (teacherIds.size > 0) {
                const { data: teachers } = await supabase
                  .from("profiles")
                  .select("id, full_name")
                  .in("id", Array.from(teacherIds));
                setContacts(
                  (teachers || []).map(t => ({
                    id: t.id,
                    name: t.full_name || "Docente",
                    subtitle: courseMap[t.id] || "Docente",
                  }))
                );
              } else {
                // Fallback: all teachers
                const { data: teachers } = await supabase
                  .from("profiles")
                  .select("id, full_name")
                  .eq("role", "teacher")
                  .order("full_name");
                setContacts(
                  (teachers || []).map(t => ({ id: t.id, name: t.full_name || "Docente", subtitle: "Docente" }))
                );
              }
            } else {
              const { data: teachers } = await supabase
                .from("profiles")
                .select("id, full_name")
                .eq("role", "teacher")
                .order("full_name");
              setContacts(
                (teachers || []).map(t => ({ id: t.id, name: t.full_name || "Docente", subtitle: "Docente" }))
              );
            }
          }
        } else if (activeTab === "admin_teacher") {
          if (userRole === "admin") {
            // Admin sees all teachers
            const { data: teachers } = await supabase
              .from("profiles")
              .select("id, full_name")
              .eq("role", "teacher")
              .order("full_name");
            setContacts(
              (teachers || []).map(t => ({ id: t.id, name: t.full_name || "Docente", subtitle: "Docente" }))
            );
          } else if (userRole === "teacher") {
            // Teacher sees all admins
            const { data: admins } = await supabase
              .from("profiles")
              .select("id, full_name")
              .eq("role", "admin")
              .order("full_name");
            setContacts(
              (admins || []).map(a => ({ id: a.id, name: a.full_name || "Administrador", subtitle: "Dirección Académica" }))
            );
          }
        } else if (activeTab === "teacher_parent") {
          if (userRole === "teacher") {
            // Teacher sees parents of their students
            const { data: coursesData } = await supabase
              .from("courses")
              .select("id")
              .eq("teacher_id", userId);

            if (coursesData && coursesData.length > 0) {
              const courseIds = coursesData.map(c => c.id);
              const { data: members } = await supabase
                .from("course_members")
                .select("profile_id")
                .in("course_id", courseIds);

              if (members && members.length > 0) {
                const studentIds = members.map(m => m.profile_id);
                const { data: links } = await supabase
                  .from("parent_children")
                  .select("parent_profile_id, student_profile_id, parent:parent_profile_id(id, full_name)")
                  .in("student_profile_id", studentIds);

                if (links && links.length > 0) {
                  const seen = new Set<string>();
                  const parentContacts: ChatContact[] = [];
                  for (const l of links) {
                    const p = l.parent as any;
                    if (p && !seen.has(p.id)) {
                      seen.add(p.id);
                      parentContacts.push({ id: p.id, name: p.full_name || "Apoderado", subtitle: "Padre / Apoderado" });
                    }
                  }
                  setContacts(parentContacts);
                }
              }
            }
          } else if (userRole === "parent") {
            // Parent sees teachers of their children's courses
            const { data: children } = await supabase
              .from("parent_children")
              .select("student_profile_id")
              .eq("parent_profile_id", userId);

            if (children && children.length > 0) {
              const studentIds = children.map(c => c.student_profile_id);
              const { data: memberships } = await supabase
                .from("course_members")
                .select("course_id, courses:course_id(id, name, section, teacher_id)")
                .in("profile_id", studentIds);

              if (memberships && memberships.length > 0) {
                const teacherIds = new Set<string>();
                const courseMap: Record<string, string> = {};
                for (const m of memberships) {
                  const c = m.courses as any;
                  if (c?.teacher_id) {
                    teacherIds.add(c.teacher_id);
                    courseMap[c.teacher_id] = `${c.name} - Sección ${c.section}`;
                  }
                }

                if (teacherIds.size > 0) {
                  const { data: teachers } = await supabase
                    .from("profiles")
                    .select("id, full_name")
                    .in("id", Array.from(teacherIds));
                  setContacts(
                    (teachers || []).map(t => ({
                      id: t.id,
                      name: t.full_name || "Docente",
                      subtitle: courseMap[t.id] || "Docente",
                    }))
                  );
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("Error loading contacts:", err);
      }

      setLoading(false);
    }

    if (userId) loadContacts();
  }, [activeTab, userRole, userId]);

  const activeTabInfo = tabs.find(t => t.id === activeTab);

  const tabColorMap: Record<string, { active: string; hover: string }> = {
    teal: { active: "bg-primary/10 text-primary border-primary", hover: "hover:bg-primary/5" },
    amber: { active: "bg-amber-100 text-amber-800 border-amber-400", hover: "hover:bg-amber-50" },
    violet: { active: "bg-violet-100 text-violet-800 border-violet-400", hover: "hover:bg-violet-50" },
    emerald: { active: "bg-emerald-100 text-emerald-800 border-emerald-400", hover: "hover:bg-emerald-50" },
  };

  return (
    <div className="space-y-5">
      {/* Tab navigation */}
      {tabs.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const colors = tabColorMap[tab.color] || tabColorMap.teal;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                  isActive
                    ? `${colors.active} shadow-sm`
                    : `bg-white text-on-surface-variant border-outline-variant/30 ${colors.hover}`
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Chat */}
      {loading ? (
        <div className="flex items-center justify-center h-[550px] bg-white rounded-2xl border border-outline-variant/30">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-on-surface-variant">Cargando contactos...</p>
          </div>
        </div>
      ) : (
        <ChatView
          channelType={activeTabInfo?.channel || activeTab}
          myId={userId}
          myName={userName}
          myRole={userRole}
          contacts={contacts}
          accentColor={activeTabInfo?.accentColor || "teal"}
          emptyPlaceholder={
            contacts.length === 0
              ? activeTab === "teacher_parent"
                ? "No hay padres vinculados a sus alumnos aún"
                : "No hay contactos disponibles"
              : "Selecciona un contacto para chatear"
          }
        />
      )}
    </div>
  );
}
