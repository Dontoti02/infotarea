"use client";

import React, { useState } from "react";
import { MessageSquare, Megaphone, Users } from "lucide-react";
import { TeacherStudentChat } from "./TeacherStudentChat";
import { AdminTeacherMessaging } from "./AdminTeacherMessaging";
import { StudentParentFlow } from "./StudentParentFlow";

interface CommunicationHubProps {
  userRole: "teacher" | "student" | "admin";
  userId?: string;
  userName?: string;
  defaultTab?: "teacher_student" | "admin_teacher" | "student_parent";
}

export function CommunicationHub({
  userRole,
  userId,
  userName = "Usuario",
  defaultTab
}: CommunicationHubProps) {
  const getInitialTab = (): "teacher_student" | "admin_teacher" | "student_parent" => {
    if (defaultTab) return defaultTab;
    if (userRole === "student") return "teacher_student";
    if (userRole === "admin") return "admin_teacher";
    return "teacher_student";
  };

  const [activeTab, setActiveTab] = useState<"teacher_student" | "admin_teacher" | "student_parent">(getInitialTab());

  // Si es administrador, renderizar directamente su módulo institucional sin barras adicionales
  if (userRole === "admin") {
    return (
      <AdminTeacherMessaging 
        userRole="admin"
        userId={userId}
        userName={userName}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Navegación sutil y limpia propia de cada rol */}
      {userRole === "student" && (
        <div className="flex bg-surface-container rounded-xl p-1 text-xs font-semibold max-w-fit">
          <button
            onClick={() => setActiveTab("teacher_student")}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
              activeTab === "teacher_student"
                ? "bg-white text-primary shadow-xs font-bold"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <MessageSquare className="w-4 h-4 text-primary" />
            <span>Chat con Docentes</span>
          </button>
          <button
            onClick={() => setActiveTab("student_parent")}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
              activeTab === "student_parent"
                ? "bg-white text-emerald-700 shadow-xs font-bold"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <Users className="w-4 h-4 text-emerald-600" />
            <span>Enlace con Apoderado</span>
          </button>
        </div>
      )}

      {userRole === "teacher" && (
        <div className="flex bg-surface-container rounded-xl p-1 text-xs font-semibold max-w-fit">
          <button
            onClick={() => setActiveTab("teacher_student")}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
              activeTab === "teacher_student"
                ? "bg-white text-primary shadow-xs font-bold"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <MessageSquare className="w-4 h-4 text-primary" />
            <span>Chat con Estudiantes</span>
          </button>
          <button
            onClick={() => setActiveTab("admin_teacher")}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
              activeTab === "admin_teacher"
                ? "bg-white text-amber-800 shadow-xs font-bold"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <Megaphone className="w-4 h-4 text-amber-600" />
            <span>Avisos de Dirección</span>
          </button>
        </div>
      )}

      {/* Contenido según pestaña activa */}
      {activeTab === "teacher_student" && (
        <TeacherStudentChat 
          userRole={userRole}
          userId={userId}
          userName={userName}
        />
      )}

      {activeTab === "admin_teacher" && (
        <AdminTeacherMessaging 
          userRole="teacher"
          userId={userId}
          userName={userName}
        />
      )}

      {activeTab === "student_parent" && (
        <StudentParentFlow 
          studentId={userId}
          studentName={userName}
        />
      )}
    </div>
  );
}
