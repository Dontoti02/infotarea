"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Send, 
  Search, 
  User, 
  CheckCheck, 
  Clock, 
  Sparkles, 
  BookOpen, 
  Smile, 
  Paperclip, 
  Check, 
  RefreshCw, 
  MessageCircle, 
  HelpCircle,
  ShieldAlert
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Message {
  id: string;
  sender_id: string;
  sender_name?: string;
  sender_role: "teacher" | "student";
  content: string;
  created_at: string;
  is_read?: boolean;
}

interface Contact {
  id: string;
  name: string;
  role: "teacher" | "student";
  courseName: string;
  avatarUrl?: string;
  lastMessage?: string;
  lastTime?: string;
  unreadCount?: number;
}

interface TeacherStudentChatProps {
  userRole?: "teacher" | "student" | "admin";
  userId?: string;
  userName?: string;
}

export function TeacherStudentChat({ 
  userRole = "teacher", 
  userId,
  userName 
}: TeacherStudentChatProps) {
  const supabase = createClient();
  // El rol es ESTRICTO y propio de la sesión autenticada: el estudiante NO puede cambiar a docente
  const currentRole: "teacher" | "student" = userRole === "student" ? "student" : "teacher";
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Lista de contactos según el rol
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Carga inicial y contactos desde Supabase
  useEffect(() => {
    async function initUserAndContacts() {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      const effectiveUserId = userId || user?.id;

      if (currentRole === "student") {
        // En rol estudiante: cargar los docentes reales del sistema
        const { data: teacherProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, email, role")
          .eq("role", "teacher");

        if (teacherProfiles && teacherProfiles.length > 0) {
          const mapped: Contact[] = teacherProfiles.map((t) => ({
            id: t.id,
            name: t.full_name || "Profesor",
            role: "teacher",
            courseName: "Docente Titular",
            lastMessage: "Canal oficial activo",
            lastTime: "En línea",
            unreadCount: 0
          }));
          setContacts(mapped);
          setSelectedContact(mapped[0]);
        } else {
          // Fallback a docente institucional predeterminado
          const defaultTeacher: Contact = {
            id: "3c47941b-6528-4115-8296-6f23c7b33fd9",
            name: "Prof. Carlos Ruiz",
            role: "teacher",
            courseName: "Docente de Aula",
            lastMessage: "Consulta académica abierta",
            lastTime: "En línea",
            unreadCount: 0
          };
          setContacts([defaultTeacher]);
          setSelectedContact(defaultTeacher);
        }
      } else {
        // En rol docente: cargar los estudiantes reales del sistema
        const { data: studentProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, email, role")
          .eq("role", "student");

        if (studentProfiles && studentProfiles.length > 0) {
          const mapped: Contact[] = studentProfiles.map((s) => ({
            id: s.id,
            name: s.full_name || "Estudiante",
            role: "student",
            courseName: "Aula 1A",
            lastMessage: "Matriculado",
            lastTime: "En línea",
            unreadCount: 0
          }));
          setContacts(mapped);
          setSelectedContact(mapped[0]);
        } else {
          const defaultStudent: Contact = {
            id: "e865db26-c1f9-45cc-a419-66601f2c494a",
            name: "luis vera",
            role: "student",
            courseName: "Aula 1A",
            lastMessage: "Estudiante matriculado",
            lastTime: "En línea",
            unreadCount: 0
          };
          setContacts([defaultStudent]);
          setSelectedContact(defaultStudent);
        }
      }
    }

    initUserAndContacts();
  }, [currentRole, supabase, userId]);

  // Carga de historial de mensajes desde communication_messages
  useEffect(() => {
    if (!selectedContact) return;
    const currentContact = selectedContact;

    async function loadMessages() {
      const { data: { user } } = await supabase.auth.getUser();
      const myId = userId || user?.id;

      if (myId && currentContact.id) {
        const { data: dbMsgs, error } = await supabase
          .from("communication_messages")
          .select("*")
          .eq("channel_type", "teacher_student")
          .or(`and(sender_id.eq.${myId},receiver_id.eq.${currentContact.id}),and(sender_id.eq.${currentContact.id},receiver_id.eq.${myId})`)
          .order("created_at", { ascending: true });

        if (dbMsgs && dbMsgs.length > 0) {
          const formatted: Message[] = dbMsgs.map((m) => ({
            id: m.id,
            sender_id: m.sender_id,
            sender_name: m.sender_id === myId 
              ? (userName || (currentRole === "student" ? "Yo (Estudiante)" : "Yo (Docente)"))
              : currentContact.name,
            sender_role: m.sender_id === myId ? currentRole : (currentRole === "student" ? "teacher" : "student"),
            content: m.content,
            created_at: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            is_read: m.is_read
          }));
          setMessages(formatted);
          return;
        }
      }

      // Mensaje de bienvenida inicial según el rol
      setMessages([
        {
          id: "m-welcome",
          sender_id: currentContact.id,
          sender_name: currentContact.name,
          sender_role: currentRole === "student" ? "teacher" : "student",
          content: currentRole === "student"
            ? `Hola ${userName || "estudiante"}, ¿en qué tema o consulta puedo ayudarte hoy?`
            : `Profesor, buenas tardes. Gracias por la atención.`,
          created_at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          is_read: true
        }
      ]);
    }

    loadMessages();
  }, [selectedContact, currentRole, userId, userName, supabase]);

  // Suscripción Realtime a communication_messages
  useEffect(() => {
    if (!selectedContact) return;
    const currentContact = selectedContact;

    const channel = supabase
      .channel("realtime_comm_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "communication_messages" },
        (payload) => {
          const newRow = payload.new as any;
          if (newRow.channel_type === "teacher_student") {
            const myId = userId || currentUser?.id;
            if (
              (newRow.sender_id === currentContact.id && newRow.receiver_id === myId) ||
              (newRow.sender_id === myId && newRow.receiver_id === currentContact.id)
            ) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === newRow.id)) return prev;
                return [
                  ...prev,
                  {
                    id: newRow.id,
                    sender_id: newRow.sender_id,
                    sender_name: newRow.sender_id === myId ? (userName || "Yo") : currentContact.name,
                    sender_role: newRow.sender_id === myId ? currentRole : (currentRole === "student" ? "teacher" : "student"),
                    content: newRow.content,
                    created_at: new Date(newRow.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    is_read: newRow.is_read
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
  }, [selectedContact, userId, currentUser, userName, currentRole, supabase]);

  // Auto-scroll al final del chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !selectedContact) return;
    const currentContact = selectedContact;

    const messageText = newMessage.trim();
    setNewMessage("");

    const myId = userId || currentUser?.id || "e865db26-c1f9-45cc-a419-66601f2c494a";
    const tempId = "msg-" + Date.now();

    const newMsgObj: Message = {
      id: tempId,
      sender_id: myId,
      sender_name: userName || (currentRole === "student" ? "Estudiante" : "Profesor"),
      sender_role: currentRole,
      content: messageText,
      created_at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      is_read: false
    };

    setMessages((prev) => [...prev, newMsgObj]);

    // Persistencia directa en Supabase PostgreSQL communication_messages
    try {
      const { data: dbMsg, error } = await supabase
        .from("communication_messages")
        .insert({
          sender_id: myId,
          receiver_id: currentContact.id,
          channel_type: "teacher_student",
          content: messageText
        })
        .select("*")
        .single();

      if (error) {
        console.warn("DB insert fallback:", error.message);
        // Fallback vía API Route
        await fetch("/api/communication/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            senderId: myId,
            receiverId: currentContact.id,
            channelType: "teacher_student",
            content: messageText,
            senderRole: currentRole
          })
        });
      } else if (dbMsg) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, id: dbMsg.id } : m)));
      }
    } catch (err) {
      console.error("Error al persistir mensaje:", err);
    }
  };

  const quickReplies = currentRole === "teacher" ? [
    "Revisado, buen trabajo.",
    "Por favor sube la entrega antes de las 11:59 PM.",
    "Te comparto las indicaciones en el archivo adjunto.",
    "Coordinamos en la hora de tutoría."
  ] : [
    "¿Podría revisar mi entrega preliminar?",
    "Tengo una duda con el ejercicio asignado.",
    "Muchas gracias por la explicación.",
    "¿Habrá examen o repaso este viernes?"
  ];

  const filteredContacts = contacts.filter((c) => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.courseName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden flex flex-col md:flex-row h-[650px]">
      
      {/* Barra lateral de contactos */}
      <div className="w-full md:w-80 border-r border-outline-variant/20 flex flex-col bg-surface-container-lowest/50">
        
        {/* Cabecera de contactos con visualización fija del Rol */}
        <div className="p-4 border-b border-outline-variant/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-on-surface text-title-sm">
                Chat Pedagógico
              </h3>
            </div>
            
            {/* Rol estricto e inmutable para el usuario logueado */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
              <User className="w-3.5 h-3.5" />
              <span>{currentRole === "student" ? "Rol: Estudiante" : "Rol: Docente"}</span>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input 
              type="text"
              placeholder={currentRole === "teacher" ? "Buscar estudiante..." : "Buscar docente..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-outline-variant/40 bg-surface-container text-xs focus:outline-none focus:border-primary text-on-surface"
            />
          </div>
        </div>

        {/* Lista scrollable de conversaciones */}
        <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/10">
          {filteredContacts.map((contact) => {
            const isSelected = selectedContact?.id === contact.id;
            return (
              <button
                key={contact.id}
                onClick={() => setSelectedContact(contact)}
                className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors ${
                  isSelected ? "bg-primary/5 border-l-4 border-primary" : "hover:bg-surface-container/40"
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                  {contact.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-semibold text-on-surface text-sm truncate">
                      {contact.name}
                    </span>
                    <span className="text-[11px] text-on-surface-variant shrink-0">
                      {contact.lastTime}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-primary font-medium mb-1 truncate">
                    <BookOpen className="w-3 h-3 shrink-0" />
                    <span>{contact.courseName}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant truncate">
                    {contact.lastMessage}
                  </p>
                </div>
                {contact.unreadCount ? (
                  <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {contact.unreadCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Área principal del hilo de chat */}
      <div className="flex-1 flex flex-col bg-stone-50/50">
        {selectedContact ? (
          <>
            {/* Cabecera del chat activo */}
            <div className="p-4 border-b border-outline-variant/20 bg-surface-container-lowest flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                  {selectedContact.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-on-surface text-body-md flex items-center gap-2">
                    {selectedContact.name}
                    <span className="px-2 py-0.5 text-[10px] rounded-full bg-surface-container font-medium text-on-surface-variant">
                      {selectedContact.role === "teacher" ? "Docente Asignado" : "Estudiante Matriculado"}
                    </span>
                  </h4>
                  <p className="text-xs text-on-surface-variant flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                    <span>En línea • {selectedContact.courseName}</span>
                  </p>
                </div>
              </div>

              <div className="text-right text-xs text-on-surface-variant hidden sm:block">
                <span>Canal Oficial de Consulta Académica</span>
              </div>
            </div>

            {/* Mensajes del hilo */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              <div className="text-center my-2">
                <span className="text-[11px] bg-stone-200/60 text-stone-600 px-3 py-1 rounded-full font-medium">
                  Inicio del flujo de comunicación pedagógica oficial
                </span>
              </div>

              {messages.map((msg) => {
                const isMine = msg.sender_role === currentRole;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-[11px] text-on-surface-variant px-1">
                      <span>{msg.sender_name}</span>
                      <span>•</span>
                      <span>{msg.created_at}</span>
                    </div>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-xs ${
                        isMine
                          ? "bg-primary text-white rounded-br-xs"
                          : "bg-white text-stone-900 border border-outline-variant/30 rounded-bl-xs"
                      }`}
                    >
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-on-surface-variant px-1">
                      {isMine && <CheckCheck className="w-3 h-3 text-primary" />}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Respuestas rápidas sugeridas según el rol */}
            <div className="px-4 py-2 bg-surface-container-lowest/70 border-t border-outline-variant/15 flex items-center gap-1.5 overflow-x-auto text-xs">
              <span className="text-[11px] font-semibold text-on-surface-variant shrink-0 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" /> Respuestas rápidas:
              </span>
              {quickReplies.map((qr, idx) => (
                <button
                  key={idx}
                  onClick={() => setNewMessage(qr)}
                  className="px-2.5 py-1 rounded-full border border-outline-variant/30 bg-surface-container text-on-surface hover:border-primary shrink-0 transition-colors text-xs"
                >
                  {qr}
                </button>
              ))}
            </div>

            {/* Input para redactar y enviar */}
            <form onSubmit={handleSendMessage} className="p-3 bg-surface-container-lowest border-t border-outline-variant/20 flex items-center gap-2">
              <input
                type="text"
                placeholder={currentRole === "teacher" ? `Escribe una indicación a ${selectedContact.name}...` : `Escribe tu consulta al ${selectedContact.name}...`}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container text-sm focus:outline-none focus:border-primary text-on-surface"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="px-4 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Enviar</span>
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-on-surface-variant">
            <MessageCircle className="w-12 h-12 text-outline-variant mb-2" />
            <p className="font-semibold text-sm">Selecciona una conversación para abrir el chat</p>
          </div>
        )}
      </div>
    </div>
  );
}
