"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Send, 
  MessageSquare, 
  User, 
  Search, 
  Building2, 
  CheckCheck,
  Clock
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Lista de docentes para el Administrador
  const [teachersList, setTeachersList] = useState<{ id: string; name: string; area: string; unread: number }[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<{ id: string; name: string; area: string; unread: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [newDirectText, setNewDirectText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Carga inicial de docentes desde profiles
  useEffect(() => {
    async function loadTeachers() {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

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
        const defaultTeacher = { 
          id: "3c47941b-6528-4115-8296-6f23c7b33fd9", 
          name: "Prof. Carlos Ruiz", 
          area: "Matemática", 
          unread: 0 
        };
        setTeachersList([defaultTeacher]);
        setSelectedTeacher(defaultTeacher);
      }
    }

    loadTeachers();
  }, [supabase]);

  // Cargar mensajes directos de Supabase
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

      // Mensaje de bienvenida inicial
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

  // Suscripción Realtime para mensajes directos
  useEffect(() => {
    if (!selectedTeacher) return;
    const currentTeacher = selectedTeacher;

    const channel = supabase
      .channel("realtime_admin_teacher_chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "communication_messages" },
        (payload) => {
          const newRow = payload.new as any;
          if (newRow.channel_type === "admin_teacher" && newRow.receiver_id) {
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
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTeacher, userRole, userId, currentUser, userName, supabase]);

  // Auto-scroll al final del chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [directMessages]);

  const handleSendDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDirectText.trim() || !selectedTeacher) return;
    const currentTeacher = selectedTeacher;

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

    setDirectMessages((prev) => [...prev, newDm]);

    try {
      const { data: dbMsg, error } = await supabase
        .from("communication_messages")
        .insert({
          sender_id: myId,
          receiver_id: currentTeacher.id,
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

  const filteredTeachers = teachersList.filter((t) => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.area.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[650px]">
      
      {/* Cabecera limpia del chat institucional */}
      <div className="p-4 border-b border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
            <MessageSquare className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-on-surface text-title-sm flex items-center gap-2">
              Chat de Coordinación Institucional
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                {userRole === "admin" ? "Administrador" : "Docente"}
              </span>
            </h3>
            <p className="text-xs text-on-surface-variant">
              Canal directo oficial entre Dirección y Plana Docente
            </p>
          </div>
        </div>
      </div>

      {/* Cuerpo principal del chat */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Barra lateral de docentes (visible si es administrador) */}
        {userRole === "admin" && (
          <div className="w-full md:w-80 border-r border-outline-variant/20 flex flex-col bg-surface-container-lowest/50">
            <div className="p-3 border-b border-outline-variant/20">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input 
                  type="text"
                  placeholder="Buscar docente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-outline-variant/40 bg-surface-container text-xs focus:outline-none focus:border-amber-600 text-on-surface"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/10">
              {filteredTeachers.map((t) => {
                const isSelected = selectedTeacher?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTeacher(t)}
                    className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors ${
                      isSelected ? "bg-amber-50 border-l-4 border-amber-600" : "hover:bg-surface-container/40"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm shrink-0">
                      {t.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-on-surface truncate">{t.name}</p>
                      <p className="text-xs text-on-surface-variant">{t.area}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Hilo de conversación */}
        <div className="flex-1 flex flex-col bg-stone-50/50">
          {selectedTeacher ? (
            <>
              {/* Cabecera del chat activo */}
              <div className="p-3.5 border-b border-outline-variant/20 bg-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
                    {userRole === "admin" ? selectedTeacher.name.charAt(0) : "D"}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-stone-900">
                      {userRole === "admin" ? selectedTeacher.name : "Dirección Académica"}
                    </h4>
                    <p className="text-[11px] text-stone-500">
                      {userRole === "admin" ? selectedTeacher.area : "Canal oficial de coordinación"}
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                  En línea
                </span>
              </div>

              {/* Mensajes del chat */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {directMessages.map((dm) => {
                  const isMine = dm.sender_role === userRole;
                  return (
                    <div key={dm.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                      <span className="text-[10px] text-stone-500 mb-0.5 px-1">
                        {dm.sender_name} • {dm.created_at}
                      </span>
                      <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-xs md:text-sm shadow-xs ${
                        isMine 
                          ? "bg-amber-600 text-white rounded-br-xs" 
                          : "bg-white text-stone-900 border border-stone-200 rounded-bl-xs"
                      }`}>
                        {dm.content}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input para redactar y enviar */}
              <form onSubmit={handleSendDirectMessage} className="p-3 bg-white border-t border-outline-variant/20 flex gap-2">
                <input
                  type="text"
                  placeholder={userRole === "admin" ? `Escribe un mensaje a ${selectedTeacher.name}...` : "Escribe un mensaje a Dirección Académica..."}
                  value={newDirectText}
                  onChange={(e) => setNewDirectText(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-xl border border-stone-300 text-xs md:text-sm focus:outline-none focus:border-amber-600"
                />
                <button
                  type="submit"
                  disabled={!newDirectText.trim()}
                  className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-stone-500">
              Selecciona un docente para iniciar la conversación
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
