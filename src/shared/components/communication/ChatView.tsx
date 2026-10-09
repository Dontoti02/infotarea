"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, Search, User, CheckCheck, Clock, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export interface ChatContact {
  id: string;
  name: string;
  subtitle?: string;
  avatarUrl?: string;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read?: boolean;
}

interface ChatViewProps {
  channelType: string;
  myId: string;
  myName: string;
  myRole: string;
  contacts: ChatContact[];
  accentColor?: string;
  emptyPlaceholder?: string;
}

export function ChatView({
  channelType,
  myId,
  myName,
  myRole,
  contacts,
  accentColor = "teal",
  emptyPlaceholder = "Selecciona un contacto para iniciar el chat",
}: ChatViewProps) {
  const supabase = createClient();
  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(
    contacts.length > 0 ? contacts[0] : null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-select first contact when contacts load
  useEffect(() => {
    if (contacts.length > 0 && !selectedContact) {
      setSelectedContact(contacts[0]);
    }
  }, [contacts]);

  // Load messages when contact changes
  const loadMessages = useCallback(async () => {
    if (!selectedContact || !myId) return;
    setLoadingMessages(true);
    const { data, error } = await supabase
      .from("communication_messages")
      .select("*")
      .eq("channel_type", channelType)
      .or(
        `and(sender_id.eq.${myId},receiver_id.eq.${selectedContact.id}),and(sender_id.eq.${selectedContact.id},receiver_id.eq.${myId})`
      )
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(
        data.map((m) => ({
          id: m.id,
          sender_id: m.sender_id,
          content: m.content,
          created_at: new Date(m.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          is_read: m.is_read,
        }))
      );
    } else {
      setMessages([]);
    }
    setLoadingMessages(false);
  }, [selectedContact, myId, channelType, supabase]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!selectedContact || !myId) return;
    const contactId = selectedContact.id;

    const channel = supabase
      .channel(`chat_${channelType}_${myId}_${contactId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "communication_messages" },
        (payload) => {
          const row = payload.new as any;
          if (row.channel_type !== channelType) return;
          const isOurs =
            (row.sender_id === myId && row.receiver_id === contactId) ||
            (row.sender_id === contactId && row.receiver_id === myId);
          if (!isOurs) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [
              ...prev,
              {
                id: row.id,
                sender_id: row.sender_id,
                content: row.content,
                created_at: new Date(row.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                is_read: row.is_read,
              },
            ];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedContact, myId, channelType, supabase]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !selectedContact || !myId || sending) return;

    const text = newMessage.trim();
    setNewMessage("");
    setSending(true);

    // Optimistic insert
    const tempId = "tmp-" + Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        sender_id: myId,
        content: text,
        created_at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        is_read: false,
      },
    ]);

    try {
      const { data, error } = await supabase
        .from("communication_messages")
        .insert({
          sender_id: myId,
          receiver_id: selectedContact.id,
          channel_type: channelType,
          content: text,
          is_read: false,
        })
        .select("*")
        .single();

      if (error) {
        console.error("Error al enviar mensaje:", error.message);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setNewMessage(text);
      } else if (data) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  id: data.id,
                  sender_id: data.sender_id,
                  content: data.content,
                  created_at: new Date(data.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                  is_read: data.is_read,
                }
              : m
          )
        );
      }
    } finally {
      setSending(false);
    }
  };

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.subtitle && c.subtitle.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const accentClasses: Record<string, { bubble: string; header: string; badge: string; btn: string }> = {
    teal: {
      bubble: "bg-primary text-white",
      header: "from-primary/10 to-secondary/5",
      badge: "bg-primary/10 text-primary",
      btn: "bg-primary hover:bg-primary/90 text-white",
    },
    amber: {
      bubble: "bg-amber-600 text-white",
      header: "from-amber-50 to-orange-50",
      badge: "bg-amber-100 text-amber-800",
      btn: "bg-amber-600 hover:bg-amber-700 text-white",
    },
    violet: {
      bubble: "bg-violet-600 text-white",
      header: "from-violet-50 to-purple-50",
      badge: "bg-violet-100 text-violet-800",
      btn: "bg-violet-600 hover:bg-violet-700 text-white",
    },
    emerald: {
      bubble: "bg-emerald-600 text-white",
      header: "from-emerald-50 to-teal-50",
      badge: "bg-emerald-100 text-emerald-800",
      btn: "bg-emerald-600 hover:bg-emerald-700 text-white",
    },
  };

  const theme = accentClasses[accentColor] || accentClasses.teal;

  const getInitials = (name: string) =>
    name
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();

  return (
    <div className="bg-white border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden flex h-[660px]">
      {/* Contact sidebar */}
      <div className="w-72 border-r border-outline-variant/20 flex flex-col bg-surface-container-lowest/60 shrink-0">
        <div className="p-4 border-b border-outline-variant/20">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline-variant" />
            <input
              className="w-full pl-9 pr-3 py-2 text-sm bg-surface border border-outline-variant/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 text-on-surface placeholder:text-outline-variant"
              placeholder="Buscar contacto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredContacts.length === 0 ? (
            <div className="p-6 text-center text-sm text-on-surface-variant">
              {contacts.length === 0 ? "No hay contactos disponibles" : "Sin resultados"}
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => setSelectedContact(contact)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-all border-l-2 ${
                  selectedContact?.id === contact.id
                    ? "bg-primary/5 border-l-primary"
                    : "border-l-transparent hover:bg-surface-container"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                    selectedContact?.id === contact.id
                      ? theme.bubble
                      : "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  {contact.avatarUrl ? (
                    <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    getInitials(contact.name)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-on-surface truncate">{contact.name}</p>
                  {contact.subtitle && (
                    <p className="text-xs text-on-surface-variant truncate">{contact.subtitle}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedContact ? (
          <>
            {/* Chat header */}
            <div className={`px-5 py-4 border-b border-outline-variant/20 bg-gradient-to-r ${theme.header} flex items-center gap-3`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${theme.bubble}`}>
                {selectedContact.avatarUrl ? (
                  <img src={selectedContact.avatarUrl} alt={selectedContact.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  getInitials(selectedContact.name)
                )}
              </div>
              <div>
                <p className="font-bold text-on-surface text-sm">{selectedContact.name}</p>
                {selectedContact.subtitle && (
                  <p className="text-xs text-on-surface-variant">{selectedContact.subtitle}</p>
                )}
              </div>
              <div className="ml-auto">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${theme.badge}`}>
                  En línea
                </span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center">
                    <Send className="w-6 h-6 text-outline-variant" />
                  </div>
                  <div>
                    <p className="font-semibold text-on-surface text-sm">Inicia la conversación</p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      Envía tu primer mensaje a {selectedContact.name}
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender_id === myId;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      {!isMe && (
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs mr-2 mt-1 shrink-0 ${theme.badge}`}>
                          {getInitials(selectedContact.name)}
                        </div>
                      )}
                      <div className={`max-w-[70%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
                        <div
                          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            isMe
                              ? `${theme.bubble} rounded-br-sm`
                              : "bg-surface-container text-on-surface rounded-bl-sm"
                          }`}
                        >
                          {msg.content}
                        </div>
                        <div className={`flex items-center gap-1 text-[10px] text-on-surface-variant ${isMe ? "flex-row-reverse" : ""}`}>
                          <span>{msg.created_at}</span>
                          {isMe && (
                            msg.id.startsWith("tmp-")
                              ? <Clock className="w-3 h-3" />
                              : <CheckCheck className="w-3 h-3 text-primary" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="px-4 py-3 border-t border-outline-variant/20 bg-surface">
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 px-4 py-2.5 text-sm bg-surface-container border border-outline-variant/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 text-on-surface placeholder:text-outline-variant"
                  placeholder={`Escribe un mensaje a ${selectedContact.name}...`}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${theme.btn} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center">
              <User className="w-8 h-8 text-outline-variant" />
            </div>
            <div>
              <p className="font-semibold text-on-surface">{emptyPlaceholder}</p>
              <p className="text-sm text-on-surface-variant mt-1">
                Elige un contacto de la lista de la izquierda
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
