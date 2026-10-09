"use client";

import React, { useState, useEffect } from "react";
import { 
  Megaphone, 
  Send, 
  ShieldCheck, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  FileText, 
  Plus, 
  User, 
  Sparkles,
  Search,
  MessageSquare,
  Building2,
  Calendar
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface AdminNotice {
  id: string;
  title: string;
  content: string;
  priority: "urgente" | "academico" | "general";
  created_at: string;
  sender_name: string;
  is_acknowledged?: boolean;
}

interface DirectMessage {
  id: string;
  sender_role: "admin" | "teacher";
  sender_name: string;
  content: string;
  created_at: string;
}

interface AdminTeacherMessagingProps {
  userRole?: "admin" | "teacher";
  userId?: string;
  userName?: string;
}

export function AdminTeacherMessaging({ 
  userRole = "admin", 
  userId, 
  userName 
}: AdminTeacherMessagingProps) {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<"notices" | "direct">("notices");
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Estados de avisos oficiales
  const [notices, setNotices] = useState<AdminNotice[]>([
    {
      id: "an-1",
      title: "Circular Dir-04: Cierre de Registro de Calificaciones Primer Bimestre",
      content: "Se recuerda a todos los docentes de nivel primario y secundario que la fecha límite para consolidar las calificaciones vigesimales del primer periodo en la plataforma es este viernes 24 a las 18:00 hrs.",
      priority: "urgente",
      created_at: "Hace 2 horas",
      sender_name: "Dirección Académica",
      is_acknowledged: false
    },
    {
      id: "an-2",
      title: "Jornada Pedagógica de Capacitación e Innovación Docente",
      content: "Estimados colegas docentes, este jueves tendremos el taller de uso avanzado de rúbricas en InfoTarea. El enlace de conexión y materiales están disponibles en biblioteca.",
      priority: "academico",
      created_at: "Ayer",
      sender_name: "Coordinación General",
      is_acknowledged: true
    }
  ]);

  // Formulario de nuevo aviso (Administrador)
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newPriority, setNewPriority] = useState<"urgente" | "academico" | "general">("urgente");
  const [isPublishing, setIsPublishing] = useState(false);
  const [showNoticeForm, setShowNoticeForm] = useState(false);

  // Estados de mensajería directa
  const [teachersList, setTeachersList] = useState<{ id: string; name: string; area: string; unread: number }[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<{ id: string; name: string; area: string; unread: number } | null>(null);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [newDirectText, setNewDirectText] = useState("");

  // Carga inicial de datos de Supabase
  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      const myId = userId || user?.id;

      // 1. Cargar avisos desde communication_messages
      const { data: dbNotices } = await supabase
        .from("communication_messages")
        .select("id, title, content, created_at, sender_id, is_read")
        .eq("channel_type", "admin_teacher")
        .is("receiver_id", null)
        .order("created_at", { ascending: false });

      if (dbNotices && dbNotices.length > 0) {
        const formatted: AdminNotice[] = dbNotices.map((n) => ({
          id: n.id,
          title: n.title || "Circular Informativa",
          content: n.content,
          priority: "urgente",
          created_at: new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          sender_name: "Dirección Académica",
          is_acknowledged: n.is_read
        }));
        setNotices(formatted);
      }

      // 2. Cargar docentes reales desde profiles
      const { data: dbTeachers } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("role", "teacher");

      if (dbTeachers && dbTeachers.length > 0) {
        const tList = dbTeachers.map((t) => ({
          id: t.id,
          name: t.full_name || "Docente",
          area: "Plana Docente",
          unread: 0
        }));
        setTeachersList(tList);
        setSelectedTeacher(tList[0]);
      } else {
        const defaultTeacher = { id: "3c47941b-6528-4115-8296-6f23c7b33fd9", name: "Prof. Carlos Ruiz", area: "Matemática", unread: 0 };
        setTeachersList([defaultTeacher]);
        setSelectedTeacher(defaultTeacher);
      }
    }

    loadData();
  }, [supabase, userId]);

  // Cargar mensajes directos al seleccionar docente o al iniciar
  useEffect(() => {
    if (!selectedTeacher) return;
    const currentTeacher = selectedTeacher;

    async function loadDirect() {
      const { data: { user } } = await supabase.auth.getUser();
      const myId = userId || user?.id;

      if (myId && currentTeacher.id) {
        const { data: dbMsgs } = await supabase
          .from("communication_messages")
          .select("*")
          .eq("channel_type", "admin_teacher")
          .not("receiver_id", "is", null)
          .or(`and(sender_id.eq.${myId},receiver_id.eq.${currentTeacher.id}),and(sender_id.eq.${currentTeacher.id},receiver_id.eq.${myId})`)
          .order("created_at", { ascending: true });

        if (dbMsgs && dbMsgs.length > 0) {
          const formatted: DirectMessage[] = dbMsgs.map((m) => ({
            id: m.id,
            sender_role: m.sender_id === myId ? userRole : (userRole === "admin" ? "teacher" : "admin"),
            sender_name: m.sender_id === myId ? (userName || "Dirección") : currentTeacher.name,
            content: m.content,
            created_at: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          }));
          setDirectMessages(formatted);
          return;
        }
      }

      // Mensaje inicial por defecto si aún no hay historial en DB
      setDirectMessages([
        {
          id: "dm-init",
          sender_role: "admin",
          sender_name: "Dirección Académica",
          content: userRole === "admin" 
            ? `Profesor(a) ${currentTeacher.name}, canal oficial de coordinación habilitado.`
            : "Buenos días profesor, confirmamos el canal de enlace con Dirección.",
          created_at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    }

    loadDirect();
  }, [selectedTeacher, userRole, userId, userName, supabase]);

  // Suscripción Realtime para avisos y mensajes directos
  useEffect(() => {
    const channel = supabase
      .channel("realtime_admin_teacher")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "communication_messages" },
        (payload) => {
          const newRow = payload.new as any;
          if (newRow.channel_type === "admin_teacher") {
            if (!newRow.receiver_id) {
              // Nuevo aviso oficial
              setNotices((prev) => {
                if (prev.some((n) => n.id === newRow.id)) return prev;
                return [
                  {
                    id: newRow.id,
                    title: newRow.title || "Nuevo Aviso Oficial",
                    content: newRow.content,
                    priority: "urgente",
                    created_at: new Date(newRow.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    sender_name: "Dirección Académica",
                    is_acknowledged: false
                  },
                  ...prev
                ];
              });
            } else if (selectedTeacher) {
              const currentTeacher = selectedTeacher;
              const myId = userId || currentUser?.id;
              if (
                (newRow.sender_id === currentTeacher.id && newRow.receiver_id === myId) ||
                (newRow.sender_id === myId && newRow.receiver_id === currentTeacher.id)
              ) {
                setDirectMessages((prev) => {
                  if (prev.some((m) => m.id === newRow.id)) return prev;
                  return [
                    ...prev,
                    {
                      id: newRow.id,
                      sender_role: newRow.sender_id === myId ? userRole : (userRole === "admin" ? "teacher" : "admin"),
                      sender_name: newRow.sender_id === myId ? (userName || "Yo") : currentTeacher.name,
                      content: newRow.content,
                      created_at: new Date(newRow.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    }
                  ];
                });
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTeacher, userRole, userId, currentUser, userName, supabase]);

  const handlePublishNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    setIsPublishing(true);
    const myId = userId || currentUser?.id || "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const tempId = "an-" + Date.now();

    const newNoticeObj: AdminNotice = {
      id: tempId,
      title: newTitle.trim(),
      content: newContent.trim(),
      priority: newPriority,
      created_at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      sender_name: userName || "Dirección Académica",
      is_acknowledged: false
    };

    setNotices([newNoticeObj, ...notices]);
    setNewTitle("");
    setNewContent("");
    setShowNoticeForm(false);

    try {
      // Guardar en la base de datos Supabase
      const { data: dbRes, error } = await supabase
        .from("communication_messages")
        .insert({
          sender_id: myId,
          receiver_id: null,
          channel_type: "admin_teacher",
          title: newNoticeObj.title,
          content: newNoticeObj.content
        })
        .select("*")
        .single();

      if (error) {
        console.warn("DB insert notice fallback:", error.message);
      } else if (dbRes) {
        setNotices((prev) => prev.map((n) => (n.id === tempId ? { ...n, id: dbRes.id } : n)));
      }
    } catch (err) {
      console.error("Error al publicar aviso:", err);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSendDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDirectText.trim() || !selectedTeacher) return;

    const myId = userId || currentUser?.id || "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const tempId = "dm-" + Date.now();
    const text = newDirectText.trim();
    setNewDirectText("");

    const newDm: DirectMessage = {
      id: tempId,
      sender_role: userRole,
      sender_name: userRole === "admin" ? (userName || "Dirección Académica") : (userName || "Prof. Carlos Ruiz"),
      content: text,
      created_at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setDirectMessages([...directMessages, newDm]);

    try {
      const { data: dbMsg, error } = await supabase
        .from("communication_messages")
        .insert({
          sender_id: myId,
          receiver_id: selectedTeacher.id,
          channel_type: "admin_teacher",
          content: text
        })
        .select("*")
        .single();

      if (error) {
        console.warn("DB insert direct message fallback:", error.message);
      } else if (dbMsg) {
        setDirectMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, id: dbMsg.id } : m)));
      }
    } catch (err) {
      console.error("Error al enviar mensaje directo:", err);
    }
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden">
      
      {/* Cabecera del módulo */}
      <div className="p-5 border-b border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-50/40">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <h3 className="font-bold text-on-surface text-title-md">
              13. Comunicación Administrador-Docente
            </h3>
          </div>
          <p className="text-body-sm text-on-surface-variant">
            Avisos oficiales de dirección, circulares normativas y mensajería directa con la plana docente
          </p>
        </div>

        {/* Pestañas de Avisos vs Mensajes */}
        <div className="flex bg-surface-container rounded-xl p-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("notices")}
            className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === "notices"
                ? "bg-white text-on-surface shadow-xs font-bold"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <Megaphone className="w-4 h-4 text-amber-600" />
            <span>Avisos y Circulares ({notices.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("direct")}
            className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === "direct"
                ? "bg-white text-on-surface shadow-xs font-bold"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <MessageSquare className="w-4 h-4 text-primary" />
            <span>Mensajes Directos</span>
          </button>
        </div>
      </div>

      {/* CONTENIDO PESTAÑA 1: AVISOS Y CIRCULARES */}
      {activeTab === "notices" && (
        <div className="p-6 space-y-6">
          {/* Botón de publicar aviso SOLO si el usuario autenticado es administrador */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              Circulares Institucionales Dirigidas a Docentes
            </span>
            {userRole === "admin" && (
              <button
                onClick={() => setShowNoticeForm(!showNoticeForm)}
                className="px-3.5 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-semibold hover:bg-amber-700 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>{showNoticeForm ? "Cancelar Redacción" : "Emitir Nuevo Aviso Oficial"}</span>
              </button>
            )}
          </div>

          {/* Formulario desplegable para nuevo comunicado administrativo */}
          {showNoticeForm && userRole === "admin" && (
            <form onSubmit={handlePublishNotice} className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-amber-900 text-sm flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-amber-700" />
                  Redactar Comunicado Oficial de Dirección
                </h4>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-stone-600 font-medium">Prioridad:</span>
                  <select
                    value={newPriority}
                    onChange={(e: any) => setNewPriority(e.target.value)}
                    className="px-2.5 py-1 rounded-lg border border-amber-300 bg-white text-xs font-semibold"
                  >
                    <option value="urgente">Urgente / Crítico</option>
                    <option value="academico">Académico</option>
                    <option value="general">Informativo General</option>
                  </select>
                </div>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Título de la circular o aviso (ej. Fecha límite de entrega de notas)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-amber-300 bg-white text-sm focus:outline-none focus:border-amber-600 text-stone-900"
                  required
                />
              </div>

              <div>
                <textarea
                  placeholder="Cuerpo del mensaje oficial dirigido a la plana docente..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2 rounded-xl border border-amber-300 bg-white text-sm focus:outline-none focus:border-amber-600 text-stone-900"
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNoticeForm(false)}
                  className="px-4 py-1.5 rounded-xl border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-white"
                >
                  Descartar
                </button>
                <button
                  type="submit"
                  disabled={isPublishing}
                  className="px-4 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 shadow-sm flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Publicar a Toda la Plana Docente</span>
                </button>
              </div>
            </form>
          )}

          {/* Lista de avisos institucionales */}
          <div className="grid grid-cols-1 gap-4">
            {notices.map((notice) => (
              <div 
                key={notice.id}
                className="p-5 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest hover:border-amber-400/50 transition-colors space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      notice.priority === "urgente" 
                        ? "bg-red-500/10 text-red-600" 
                        : notice.priority === "academico"
                        ? "bg-blue-500/10 text-blue-600"
                        : "bg-amber-500/10 text-amber-600"
                    }`}>
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          notice.priority === "urgente"
                            ? "bg-red-100 text-red-700"
                            : notice.priority === "academico"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {notice.priority}
                        </span>
                        <span className="text-xs text-on-surface-variant flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {notice.created_at}
                        </span>
                      </div>
                      <h4 className="font-bold text-on-surface text-body-lg">
                        {notice.title}
                      </h4>
                    </div>
                  </div>

                  <span className="text-xs font-medium text-stone-500 shrink-0">
                    Emisor: <strong>{notice.sender_name}</strong>
                  </span>
                </div>

                <p className="text-body-sm text-stone-700 pl-12 leading-relaxed">
                  {notice.content}
                </p>

                <div className="pl-12 pt-2 border-t border-outline-variant/10 flex items-center justify-between text-xs text-on-surface-variant">
                  <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Notificado a todos los docentes titulares
                  </span>
                  {userRole === "teacher" && (
                    <button
                      onClick={() => {
                        setNotices(notices.map((n) => n.id === notice.id ? { ...n, is_acknowledged: true } : n));
                      }}
                      className={`px-3 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                        notice.is_acknowledged 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300 cursor-default" 
                          : "bg-white text-stone-800 border-stone-300 hover:bg-stone-50"
                      }`}
                    >
                      {notice.is_acknowledged ? "✓ Enterado y Confirmado" : "Confirmar Recepción"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONTENIDO PESTAÑA 2: MENSAJERÍA DIRECTA DIRECCIÓN - DOCENTE */}
      {activeTab === "direct" && (
        <div className="flex flex-col md:flex-row h-[500px]">
          {/* Lista de docentes para el Administrador */}
          <div className="w-full md:w-72 border-r border-outline-variant/20 p-4 space-y-3 bg-stone-50/30">
            <h4 className="font-bold text-xs uppercase tracking-wider text-on-surface-variant">
              Docentes de la Institución
            </h4>
            <div className="space-y-1">
              {teachersList.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTeacher(t)}
                  className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition-colors ${
                    selectedTeacher?.id === t.id ? "bg-amber-100/70 border border-amber-300/80" : "hover:bg-surface-container"
                  }`}
                >
                  <div>
                    <p className="font-bold text-sm text-on-surface">{t.name}</p>
                    <p className="text-xs text-on-surface-variant">{t.area}</p>
                  </div>
                  {t.unread > 0 && (
                    <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {t.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Chat directo */}
          <div className="flex-1 flex flex-col bg-stone-50/50">
            {selectedTeacher ? (
              <>
                <div className="p-3.5 border-b border-outline-variant/20 bg-white flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-stone-900">
                      {selectedTeacher.name} • {selectedTeacher.area}
                    </h4>
                    <p className="text-[11px] text-stone-500">
                      Canal oficial de coordinación administrativa
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                    Activo
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {directMessages.map((dm) => {
                    const isMine = dm.sender_role === userRole;
                    return (
                      <div key={dm.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                        <span className="text-[10px] text-stone-500 mb-0.5 px-1">{dm.sender_name} • {dm.created_at}</span>
                        <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-xs md:text-sm shadow-xs ${
                          isMine ? "bg-amber-600 text-white rounded-br-xs" : "bg-white text-stone-900 border border-stone-200 rounded-bl-xs"
                        }`}>
                          {dm.content}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form onSubmit={handleSendDirectMessage} className="p-3 bg-white border-t border-outline-variant/20 flex gap-2">
                  <input
                    type="text"
                    placeholder={`Escribe un mensaje a ${selectedTeacher.name}...`}
                    value={newDirectText}
                    onChange={(e) => setNewDirectText(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-stone-300 text-xs md:text-sm focus:outline-none focus:border-amber-600"
                  />
                  <button
                    type="submit"
                    disabled={!newDirectText.trim()}
                    className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 flex items-center gap-1 shadow-sm disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-stone-500">
                Selecciona un docente para iniciar la coordinación
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
