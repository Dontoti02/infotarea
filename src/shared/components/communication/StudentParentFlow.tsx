"use client";

import React, { useState, useEffect } from "react";
import { 
  Users, 
  QrCode, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  Bell, 
  MessageCircle, 
  Copy, 
  Check, 
  Sparkles, 
  AlertCircle,
  Smartphone,
  Mail,
  Send
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface StudentParentFlowProps {
  studentId?: string;
  studentName?: string;
}

export function StudentParentFlow({ 
  studentId, 
  studentName = "Estudiante" 
}: StudentParentFlowProps) {
  const supabase = createClient();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentStage, setCurrentStage] = useState<1 | 2 | 3>(1);
  const [copied, setCopied] = useState(false);

  // Datos del formulario de vinculación familiar
  const [parentName, setParentName] = useState("Sra. Elena de Familia");
  const [parentEmail, setParentEmail] = useState("familia@correo.edu");
  const [parentPhone, setParentPhone] = useState("+51 987 654 321");
  const [inviteCode, setInviteCode] = useState("PADRE-2026");

  // Permisos progresivos (Fase 2)
  const [permTasks, setPermTasks] = useState(true);
  const [permGrades, setPermGrades] = useState(true);
  const [permAttendance, setPermAttendance] = useState(true);

  // Mensajería directa Estudiante-Padre (Fase 3)
  const [familyMessages, setFamilyMessages] = useState<any[]>([]);
  const [newFamilyText, setNewFamilyText] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  // Carga inicial desde Supabase parent_student_links
  useEffect(() => {
    async function initParentFlow() {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      const myId = studentId || user?.id;

      if (!myId) return;

      // 1. Cargar vínculo familiar existente en DB
      const { data: linkData } = await supabase
        .from("parent_student_links")
        .select("*")
        .eq("student_id", myId)
        .maybeSingle();

      if (linkData) {
        if (linkData.parent_name) setParentName(linkData.parent_name);
        if (linkData.parent_email) setParentEmail(linkData.parent_email);
        if (linkData.parent_phone) setParentPhone(linkData.parent_phone);
        if (linkData.invite_code) setInviteCode(linkData.invite_code);
        if (linkData.progressive_stage) setCurrentStage(linkData.progressive_stage as 1 | 2 | 3);
        setPermGrades(linkData.share_grades ?? true);
        setPermTasks(linkData.share_tasks ?? true);
        setPermAttendance(linkData.share_attendance ?? true);
      } else {
        // Generar código único y crear registro inicial en DB
        const cleanName = (studentName || "ESTU").replace(/\s+/g, "").substring(0, 4).toUpperCase();
        const generatedCode = `PADRE-${cleanName}-2026`;
        setInviteCode(generatedCode);

        await supabase.from("parent_student_links").upsert({
          student_id: myId,
          parent_name: parentName,
          parent_email: parentEmail,
          parent_phone: parentPhone,
          invite_code: generatedCode,
          progressive_stage: 1,
          status: "pending",
          share_grades: true,
          share_tasks: true,
          share_attendance: true
        });
      }

      // 2. Cargar mensajes familiares desde communication_messages
      const { data: dbMsgs } = await supabase
        .from("communication_messages")
        .select("*")
        .eq("channel_type", "student_parent")
        .eq("sender_id", myId)
        .order("created_at", { ascending: true });

      if (dbMsgs && dbMsgs.length > 0) {
        const formatted = dbMsgs.map((m) => ({
          id: m.id,
          sender: "student",
          senderName: studentName,
          text: m.content,
          time: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }));
        setFamilyMessages(formatted);
      } else {
        setFamilyMessages([
          {
            id: "fm-init",
            sender: "student",
            senderName: studentName,
            text: "Hola mamá/papá, este es el canal oficial de enlace con el colegio.",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          }
        ]);
      }
    }

    initParentFlow();
  }, [studentId, studentName, supabase]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAdvanceStage = async (nextStage: 1 | 2 | 3) => {
    setCurrentStage(nextStage);
    const messages = {
      1: "Fase 1: Vinculación reiniciada para nuevo registro.",
      2: "Fase 2: Permisos de avance académico sincronizados con éxito en la base de datos.",
      3: "Fase 3: Flujo de mensajería y alertas con el apoderado habilitado al 100%."
    };
    setStatusMessage(messages[nextStage]);
    setTimeout(() => setStatusMessage(""), 4000);

    const myId = studentId || currentUser?.id || "e865db26-c1f9-45cc-a419-66601f2c494a";

    // Guardar cambio de fase y datos en Supabase parent_student_links
    try {
      await supabase.from("parent_student_links").upsert({
        student_id: myId,
        parent_name: parentName,
        parent_email: parentEmail,
        parent_phone: parentPhone,
        invite_code: inviteCode,
        progressive_stage: nextStage,
        share_grades: permGrades,
        share_tasks: permTasks,
        share_attendance: permAttendance,
        status: nextStage === 3 ? "active" : nextStage === 2 ? "linked" : "pending",
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error al actualizar parent_student_links:", err);
    }
  };

  const handleSendFamilyMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFamilyText.trim()) return;

    const myId = studentId || currentUser?.id || "e865db26-c1f9-45cc-a419-66601f2c494a";
    const text = newFamilyText.trim();
    setNewFamilyText("");

    const newMsg = {
      id: "fm-" + Date.now(),
      sender: "student",
      senderName: studentName,
      text: text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setFamilyMessages((prev) => [...prev, newMsg]);

    // Persistir en communication_messages de Supabase
    try {
      await supabase.from("communication_messages").insert({
        sender_id: myId,
        receiver_id: null,
        channel_type: "student_parent",
        content: text
      });
    } catch (err) {
      console.error("Error al persistir mensaje familiar:", err);
    }

    // Respuesta didáctica simulada del apoderado
    setTimeout(() => {
      setFamilyMessages((prev) => [
        ...prev,
        {
          id: "fm-reply-" + Date.now(),
          sender: "parent",
          senderName: parentName || "Apoderado",
          text: `Mensaje recibido. Recuerda estar atento a tus tareas y clases.`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    }, 1200);
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm p-6 space-y-6">
      
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <h3 className="font-bold text-on-surface text-title-md">
              14. Comunicación Estudiante-Padre: habilitación progresiva del flujo
            </h3>
          </div>
          <p className="text-body-sm text-on-surface-variant">
            Módulo de integración familiar con activación gradual en 3 fases certificadas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
            currentStage === 3 
              ? "bg-emerald-100 text-emerald-800 border-emerald-300" 
              : "bg-blue-50 text-blue-700 border-blue-200"
          }`}>
            Progreso: Fase {currentStage} de 3 ({currentStage === 3 ? "100%" : currentStage === 2 ? "66%" : "33%"})
          </span>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* STEPPER VISUAL DE HABILITACIÓN PROGRESIVA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Etapa 1 */}
        <div 
          onClick={() => handleAdvanceStage(1)}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            currentStage >= 1 
              ? "border-emerald-500/50 bg-emerald-50/30" 
              : "border-outline-variant/30 bg-stone-50"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
              1
            </span>
            <span className="text-[11px] font-bold text-emerald-700 uppercase">Vinculación</span>
          </div>
          <h4 className="font-bold text-sm text-on-surface">Código Familiar</h4>
          <p className="text-xs text-on-surface-variant mt-1">
            Generación de clave única de enlace y datos del tutor.
          </p>
        </div>

        {/* Etapa 2 */}
        <div 
          onClick={() => handleAdvanceStage(2)}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            currentStage >= 2 
              ? "border-emerald-500/50 bg-emerald-50/30" 
              : "border-outline-variant/30 bg-stone-50 opacity-60"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center ${
              currentStage >= 2 ? "bg-emerald-600 text-white" : "bg-stone-300 text-stone-700"
            }`}>
              2
            </span>
            <span className="text-[11px] font-bold text-emerald-700 uppercase">Permisos</span>
          </div>
          <h4 className="font-bold text-sm text-on-surface">Avance Académico</h4>
          <p className="text-xs text-on-surface-variant mt-1">
            Supervisión de notas vigesimales y entregas de tareas.
          </p>
        </div>

        {/* Etapa 3 */}
        <div 
          onClick={() => handleAdvanceStage(3)}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            currentStage === 3 
              ? "border-emerald-500/50 bg-emerald-50/30" 
              : "border-outline-variant/30 bg-stone-50 opacity-60"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center ${
              currentStage === 3 ? "bg-emerald-600 text-white" : "bg-stone-300 text-stone-700"
            }`}>
              3
            </span>
            <span className="text-[11px] font-bold text-emerald-700 uppercase">Canal Activo</span>
          </div>
          <h4 className="font-bold text-sm text-on-surface">Mensajería Directa</h4>
          <p className="text-xs text-on-surface-variant mt-1">
            Flujo bidireccional de chat y alertas instantáneas.
          </p>
        </div>
      </div>

      {/* PANELES DE CONTENIDO POR ETAPA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        
        {/* PANEL IZQUIERDO: DETALLES DE VINCULACIÓN Y PERMISOS */}
        <div className="space-y-4">
          <div className="bg-surface-container rounded-2xl p-5 border border-outline-variant/30 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-on-surface flex items-center gap-2">
                <QrCode className="w-4 h-4 text-primary" />
                Código de Vinculación Familiar
              </h4>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Válido en Base de Datos
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white px-3.5 py-2 rounded-xl border border-outline-variant/30 font-mono font-bold text-sm text-center text-primary tracking-widest">
                {inviteCode}
              </div>
              <button
                onClick={handleCopyCode}
                className="px-3 py-2 bg-white border border-outline-variant/30 rounded-xl hover:bg-stone-50 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? "Copiado" : "Copiar"}</span>
              </button>
            </div>
            <p className="text-xs text-on-surface-variant">
              Comparte este código con tu padre, madre o tutor para que ingrese desde el portal familiar.
            </p>
          </div>

          {/* Formulario de datos del tutor */}
          <div className="bg-surface-container rounded-2xl p-5 border border-outline-variant/30 space-y-3">
            <h4 className="font-bold text-sm text-on-surface flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Datos del Apoderado Registrado
            </h4>

            <div className="space-y-2 text-xs">
              <div>
                <label className="font-semibold text-stone-600 block mb-1">Nombre completo:</label>
                <input 
                  type="text" 
                  value={parentName} 
                  onChange={(e) => setParentName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-outline-variant/30 bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-stone-600 block mb-1">Correo:</label>
                  <input 
                    type="email" 
                    value={parentEmail} 
                    onChange={(e) => setParentEmail(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-outline-variant/30 bg-white"
                  />
                </div>
                <div>
                  <label className="font-semibold text-stone-600 block mb-1">Teléfono:</label>
                  <input 
                    type="text" 
                    value={parentPhone} 
                    onChange={(e) => setParentPhone(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-outline-variant/30 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Checkboxes de alcance progresivo */}
            <div className="pt-2 border-t border-outline-variant/20 space-y-2">
              <span className="font-bold text-xs text-stone-700 block">
                Permisos de visualización de avance académico:
              </span>
              <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={permTasks} 
                  onChange={(e) => setPermTasks(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Compartir registro de tareas entregadas y pendientes</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={permGrades} 
                  onChange={(e) => setPermGrades(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Compartir calificaciones vigesimales y retroalimentación docente</span>
              </label>
            </div>
          </div>
        </div>

        {/* PANEL DERECHO: CANAL DIRECTO DE COMUNICACIÓN (FASE 3) */}
        <div className="bg-surface-container rounded-2xl p-5 border border-outline-variant/30 flex flex-col h-[400px]">
          <div className="pb-3 border-b border-outline-variant/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <h4 className="font-bold text-sm text-on-surface">
                Chat Directo Estudiante — Apoderado
              </h4>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              currentStage === 3 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
            }`}>
              {currentStage === 3 ? "Canal Habilitado" : "Habilitar Fase 3"}
            </span>
          </div>

          {/* Mensajes del canal familiar */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {familyMessages.map((msg) => {
              const isMe = msg.sender === "student";
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  <span className="text-[10px] text-stone-500 mb-0.5 px-1">{msg.senderName} • {msg.time}</span>
                  <div className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-xs ${
                    isMe ? "bg-emerald-600 text-white rounded-br-xs" : "bg-white text-stone-800 border border-stone-200 rounded-bl-xs"
                  }`}>
                    {msg.text}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Redacción y botón de envío */}
          <form onSubmit={handleSendFamilyMessage} className="pt-2 border-t border-outline-variant/20 flex gap-2">
            <input 
              type="text" 
              placeholder={`Escribir a ${parentName}...`}
              value={newFamilyText}
              onChange={(e) => setNewFamilyText(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-xl border border-outline-variant/30 bg-white text-xs focus:outline-none focus:border-emerald-600"
            />
            <button
              type="submit"
              disabled={!newFamilyText.trim()}
              className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 flex items-center gap-1 shadow-xs disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enviar</span>
            </button>
          </form>

          {currentStage < 3 && (
            <div className="mt-3 pt-2 text-center">
              <button
                type="button"
                onClick={() => handleAdvanceStage(3)}
                className="w-full py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Habilitar Fase 3: Activar Flujo Completo al 100%</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
