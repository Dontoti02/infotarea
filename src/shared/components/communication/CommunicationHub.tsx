"use client";

import React, { useState, useEffect } from "react";
import { MessageSquare, Building2, Loader2, Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { describeClassroom, queryFamilyLinks, FAMILY_VERIFICATION_NOTICE } from "@/shared/utils/communication";
import { ChatView, type ChatContact } from "./ChatView";

type UserRole = "teacher" | "student" | "admin" | "parent";
type TabId = "teacher_student" | "admin_teacher" | "teacher_parent";
interface CommunicationHubProps { userRole: UserRole; userId: string; userName?: string }
interface Profile { id: string; full_name: string | null; role?: string }
interface Course { id: string; name: string; section: string | null; teacher_id?: string | null }
interface Member { course_id: string; profile_id: string; profiles?: Profile | Profile[] | null; courses?: Course | Course[] | null }
interface LinkedParent { parent: Profile | Profile[] | null; student: Profile | Profile[] | null; student_profile_id: string }
interface ChildSummary {
  id: string; full_name: string; email?: string; classroomLabel: string;
  verificationPending?: boolean;
  teachers: { id: string; full_name: string; courseName: string; classroomLabel: string }[];
}
const relation = <T,>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] || null : value || null;
async function checked<T>(request: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T | null> {
  const result = await request;
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
const roleTabs: Record<UserRole, TabId[]> = {
  admin: ["admin_teacher"], teacher: ["teacher_student", "admin_teacher", "teacher_parent"],
  student: ["teacher_student"], parent: ["teacher_parent"],
};
const tabInfo: Record<TabId, { icon: React.ElementType; color: string }> = {
  teacher_student: { icon: MessageSquare, color: "teal" },
  admin_teacher: { icon: Building2, color: "amber" },
  teacher_parent: { icon: Heart, color: "violet" },
};

export function CommunicationHub({ userRole, userId, userName = "Usuario" }: CommunicationHubProps) {
  const supabase = createClient();
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [familyNotice, setFamilyNotice] = useState("");
  const [tab, setTab] = useState<TabId>(roleTabs[userRole][0]);
  const tabs = roleTabs[userRole];
  const activeTab = tabs.includes(tab) ? tab : tabs[0];

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const deadline = window.setTimeout(() => controller.abort(), 15_000);
    const load = async () => {
      setLoading(true);
      setError("");
      setFamilyNotice("");
      setContacts([]);
      setChildren([]);
      try {
        let result: ChatContact[] = [];
        if (activeTab === "admin_teacher") {
          const targetRole = userRole === "admin" ? "teacher" : "admin";
          const profiles = await checked(supabase.from("profiles").select("id,full_name").eq("role", targetRole).order("full_name").abortSignal(controller.signal));
          result = (profiles || []).map(profile => ({ id: profile.id, name: profile.full_name || "Usuario", subtitle: targetRole === "teacher" ? "Docente" : "Dirección Académica" }));
        } else if (userRole === "parent") {
          const response = await fetch("/api/parents/children", { cache: "no-store", signal: controller.signal });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "No se pudo consultar la ficha de tus hijos");
          const linkedChildren: ChildSummary[] = data.children;
          if (alive) setFamilyNotice(data.notice || "");
          const teachers = new Map<string, ChatContact & { details: Set<string> }>();
          for (const child of linkedChildren) {
            for (const teacher of child.teachers) {
              const entry = teachers.get(teacher.id) || { id: teacher.id, name: teacher.full_name || "Docente", details: new Set<string>() };
              entry.details.add(`${child.full_name} · ${teacher.courseName} · ${teacher.classroomLabel}`);
              teachers.set(teacher.id, entry);
            }
          }
          result = [...teachers.values()].map(teacher => ({ id: teacher.id, name: teacher.name, subtitle: [...teacher.details].join(" / ") }));
          if (alive) setChildren(linkedChildren);
        } else if (userRole === "student") {
          const rows = await checked(supabase.from("course_members").select("course_id,courses:course_id(id,name,section,teacher_id)").eq("profile_id", userId).abortSignal(controller.signal));
          const courses = ((rows || []) as unknown as Member[]).map(row => relation(row.courses)).filter((course): course is Course => Boolean(course));
          const teacherIds = [...new Set(courses.flatMap(course => course.teacher_id ? [course.teacher_id] : []))];
          if (teacherIds.length) {
            const teachers = await checked(supabase.from("profiles").select("id,full_name").eq("role", "teacher").in("id", teacherIds).abortSignal(controller.signal));
            result = (teachers || []).map(teacher => ({ id: teacher.id, name: teacher.full_name || "Docente", subtitle: courses.filter(course => course.teacher_id === teacher.id).map(course => `${course.name} · ${describeClassroom(course.section).label}`).join(" / ") }));
          }
        } else if (userRole === "teacher") {
          const courses = await checked(supabase.from("courses").select("id,name,section").eq("teacher_id", userId).abortSignal(controller.signal));
          if (courses?.length) {
            const rows = await checked(supabase.from("course_members").select("course_id,profile_id,profiles:profile_id(id,full_name,role)").in("course_id", courses.map(course => course.id)).abortSignal(controller.signal));
            const members = ((rows || []) as unknown as Member[]).filter(member => relation(member.profiles)?.role === "student");
            if (activeTab === "teacher_student") {
              const students = new Map<string, ChatContact & { details: Set<string> }>();
              for (const member of members) {
                const profile = relation(member.profiles)!;
                const course = courses.find(item => item.id === member.course_id);
                const entry = students.get(profile.id) || { id: profile.id, name: profile.full_name || "Estudiante", details: new Set<string>() };
                if (course) entry.details.add(describeClassroom(course.section).label);
                students.set(profile.id, entry);
              }
              result = [...students.values()].map(student => ({ id: student.id, name: student.name, subtitle: `Estudiante · ${[...student.details].join(" / ")}` }));
            } else if (members.length) {
              const studentIds = [...new Set(members.map(member => member.profile_id))];
              const family = await queryFamilyLinks<LinkedParent[]>(includeVerification => {
                const query = supabase.from("parent_children");
                return (includeVerification
                  ? query.select("student_profile_id,parent:parent_profile_id(id,full_name,role),student:student_profile_id(id,full_name,role)").in("student_profile_id", studentIds).not("verified_at", "is", null)
                  : query.select("student_profile_id,parent:parent_profile_id(id,full_name,role),student:student_profile_id(id,full_name,role)").in("student_profile_id", studentIds)
                ).abortSignal(controller.signal) as unknown as PromiseLike<{ data: LinkedParent[] | null; error: { code?: string; message: string } | null }>;
              });
              if (family.error) throw new Error(family.error.message);
              if (!family.verificationAvailable && alive) setFamilyNotice(FAMILY_VERIFICATION_NOTICE);
              const rows = family.verificationAvailable ? family.data : [];
              const parents = new Map<string, ChatContact & { details: Set<string> }>();
              for (const link of (rows || []) as unknown as LinkedParent[]) {
                const parent = relation(link.parent);
                const student = relation(link.student);
                if (!parent || parent.role !== "parent" || !student || student.role !== "student") continue;
                const entry = parents.get(parent.id) || { id: parent.id, name: parent.full_name || "Apoderado", details: new Set<string>() };
                const classrooms = members.filter(member => member.profile_id === link.student_profile_id).flatMap(member => {
                  const course = courses.find(item => item.id === member.course_id);
                  return course ? [describeClassroom(course.section).label] : [];
                });
                entry.details.add(`${student.full_name || "Estudiante"} · ${[...new Set(classrooms)].join(" / ")}`);
                parents.set(parent.id, entry);
              }
              result = [...parents.values()].map(parent => ({ id: parent.id, name: parent.name, subtitle: [...parent.details].join(" / ") }));
            }
          }
        }
        if (alive) setContacts(result.sort((a, b) => a.name.localeCompare(b.name, "es")));
      } catch (error) {
        if (alive) setError(controller.signal.aborted ? "Se agotó el tiempo de consulta. Recarga la página para reintentar." : error instanceof Error ? error.message : "No se pudieron cargar los contactos");
      } finally { window.clearTimeout(deadline); if (alive) setLoading(false); }
    };
    if (userId) void load();
    return () => { alive = false; window.clearTimeout(deadline); controller.abort(); };
  }, [activeTab, userRole, userId, supabase]);

  const label = (id: TabId) => id === "teacher_student" ? (userRole === "teacher" ? "Alumnos" : "Mis docentes") : id === "teacher_parent" ? (userRole === "parent" ? "Docentes de mis hijos" : "Padres / Apoderados") : userRole === "admin" ? "Docentes" : "Dirección";
  return <div className="space-y-5">
    {familyNotice && <p role="status" className="rounded-2xl p-4 bg-amber-50 text-amber-900">{familyNotice}</p>}
    {tabs.length > 1 && <div className="flex flex-wrap gap-2">{tabs.map(id => {
      const Icon = tabInfo[id].icon;
      return <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border ${activeTab === id ? "bg-primary/10 border-primary text-primary" : "bg-white border-outline-variant/30"}`}><Icon size={16} />{label(id)}</button>;
    })}</div>}
    {userRole === "parent" && children.length > 0 && <div className="grid gap-3 md:grid-cols-2">{children.map(child => <article key={child.id} className="rounded-2xl border border-outline-variant/30 bg-white p-4 space-y-1">
      <p className="text-xs font-semibold text-primary">Estudiante vinculado</p><h2 className="font-bold">{child.full_name}</h2><p className="text-sm">{child.classroomLabel}</p>{child.email && <p className="text-xs text-on-surface-variant">{child.email}</p>}
      {child.verificationPending ? <p className="text-sm text-amber-800">Solicita al colegio verificar este vínculo para consultar sus datos académicos y docentes.</p> : child.teachers.length ? <ul className="text-sm space-y-1 pt-2">{child.teachers.map((teacher, index) => <li key={`${teacher.id}:${index}`}><span className="font-semibold">{teacher.full_name}</span> · {teacher.courseName} · {teacher.classroomLabel}</li>)}</ul> : <p className="text-sm text-on-surface-variant">Sin docente asignado a sus cursos.</p>}
    </article>)}</div>}
    {error ? <div role="alert" className="p-5 rounded-2xl border border-red-200 bg-red-50 text-red-800">No se pudieron cargar los contactos: {error}</div> : loading ? <div className="flex items-center justify-center h-72 bg-white rounded-2xl border"><Loader2 className="animate-spin mr-2" />Cargando contactos...</div> : <ChatView key={`${userId}:${activeTab}`} channelType={activeTab} myId={userId} myName={userName} myRole={userRole} contacts={contacts} accentColor={tabInfo[activeTab].color} emptyPlaceholder="No hay contactos académicos vinculados" />}
  </div>;
}
