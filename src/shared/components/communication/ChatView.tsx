"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, Search, User, CheckCheck, Clock, Loader2, X, Pencil, Trash2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { canModifyMessage, MAX_MESSAGE_LENGTH, mergeChatMessage, presenceSnapshotIds, requestCommunicationJson, validatedMessageContent, type PresenceSnapshot } from "@/shared/utils/communication";

export interface ChatContact {
  id: string;
  name: string;
  subtitle?: string;
  avatarUrl?: string;
}
export interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id?: string;
  channel_type?: string;
  content: string;
  created_at: string;
  updated_at?: string | null;
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
interface MessagePage { messages: ChatMessage[]; hasMore: boolean; nextCursor: { createdAt: string; id: string } | null; error?: string }
interface MessageResult { message: ChatMessage; error?: string }

export function ChatView({ channelType, myId, contacts, accentColor = "teal", emptyPlaceholder = "Selecciona un contacto para iniciar el chat" }: ChatViewProps) {
  const supabase = createClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedContact = contacts.find(contact => contact.id === selectedId) || contacts[0] || null;
  const contactId = selectedContact?.id;
  const threadKey = `${channelType}:${myId}:${contactId || ""}`;
  const [conversation, setConversation] = useState<{ key: string; messages: ChatMessage[] }>({ key: threadKey, messages: [] });
  const messages = conversation.key === threadKey ? conversation.messages : [];
  const [draft, setDraft] = useState({ key: threadKey, text: "" });
  const newMessage = draft.key === threadKey ? draft.text : "";
  const [sending, setSending] = useState(false);
  const [mutationId, setMutationId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ key: string; id: string; content: string } | null>(null);
  const [deleteId, setDeleteId] = useState<{ key: string; id: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loadingMessages = loadedKey !== threadKey;
  const [errorState, setErrorState] = useState({ key: threadKey, message: "" });
  const [presence, setPresence] = useState<PresenceSnapshot | null>(null);
  const [presenceClock, setPresenceClock] = useState(() => Date.now());
  const onlineIds = presenceSnapshotIds(presence, presenceClock);
  const [history, setHistory] = useState<{ key: string; hasMore: boolean; cursor: MessagePage["nextCursor"] }>({ key: threadKey, hasMore: false, cursor: null });
  const [loadingOlder, setLoadingOlder] = useState(false);
  const retrySend = useRef<{ key: string; content: string; messageId: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mutationVersion = useRef(0);
  const pendingMutations = useRef(0);

  useEffect(() => {
    if (!contactId || !myId) return;
    let alive = true;
    let inFlight = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (inFlight || pendingMutations.current || document.visibilityState !== "visible") return;
      inFlight = true;
      const version = mutationVersion.current;
      try {
        const query = new URLSearchParams({ channel_type: channelType, other_user_id: contactId });
        const { response, data } = await requestCommunicationJson<MessagePage>(`/api/communication/messages?${query}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(data.error || "No se pudieron cargar los mensajes");
        if (alive && version === mutationVersion.current && !pendingMutations.current) {
          setConversation(prev => {
            const oldest = data.messages[0];
            const older = prev.key === threadKey && oldest ? prev.messages.filter(message => !message.id.startsWith("tmp-") && (message.created_at < oldest.created_at || (message.created_at === oldest.created_at && message.id < oldest.id))) : [];
            return { key: threadKey, messages: [...older, ...data.messages] };
          });
          setHistory(prev => prev.key === threadKey && prev.cursor ? prev : { key: threadKey, hasMore: data.hasMore, cursor: data.nextCursor });
          setErrorState({ key: threadKey, message: "" });
        }
      } catch (error) {
        if (alive && !controller.signal.aborted) setErrorState({ key: threadKey, message: error instanceof Error ? error.message : "Error de conexión" });
      } finally {
        inFlight = false;
        if (alive) setLoadedKey(threadKey);
      }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 5000);
    const onVisible = () => { void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    const channel = supabase.channel(`chat_${channelType}_${myId}_${contactId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "communication_messages" }, payload => {
        if (!alive) return;
        if (payload.eventType === "DELETE") {
          const deleted = (payload.old as { id?: string }).id;
          if (deleted) setConversation(prev => prev.key === threadKey ? { key: threadKey, messages: prev.messages.filter(message => message.id !== deleted) } : prev);
          return;
        }
        const row = payload.new as ChatMessage;
        if (row.channel_type !== channelType || !((row.sender_id === myId && row.receiver_id === contactId) || (row.sender_id === contactId && row.receiver_id === myId))) return;
        setConversation(prev => prev.key === threadKey ? { key: threadKey, messages: mergeChatMessage(prev.messages, row) } : prev);
      }).subscribe();
    return () => {
      alive = false;
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [channelType, contactId, myId, supabase, threadKey]);

  useEffect(() => {
    let alive = true;
    let inFlight = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const { response, data } = await requestCommunicationJson<{ sessions: PresenceSnapshot["sessions"]; serverTime: number }>("/api/communication/presence", { cache: "no-store", signal: controller.signal });
        if (alive) {
          const receivedAt = Date.now();
          setPresence(response.ok ? { sessions: data.sessions, serverTime: data.serverTime, receivedAt } : null);
          setPresenceClock(receivedAt);
        }
      } catch { if (alive) setPresence(null); }
      finally { inFlight = false; }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 10_000);
    const expiryTimer = window.setInterval(() => setPresenceClock(Date.now()), 1000);
    const offline = () => setPresence(null);
    window.addEventListener("offline", offline);
    window.addEventListener("online", refresh);
    return () => { alive = false; controller.abort(); window.clearInterval(timer); window.clearInterval(expiryTimer); window.removeEventListener("offline", offline); window.removeEventListener("online", refresh); };
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, threadKey]);

  const handleSend = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const content = validatedMessageContent(newMessage);
    if (!content || !contactId || !myId || sending || mutationId) return;
    const previousAttempt = retrySend.current;
    const messageId = previousAttempt?.key === threadKey && previousAttempt.content === content ? previousAttempt.messageId : crypto.randomUUID();
    const tempId = `tmp-${messageId}`;
    const key = threadKey;
    const pending: ChatMessage = { id: tempId, sender_id: myId, content, created_at: new Date().toISOString(), is_read: false };
    pendingMutations.current++;
    mutationVersion.current++;
    setDraft({ key, text: "" });
    setSending(true);
    setErrorState({ key, message: "" });
    setConversation(prev => prev.key === key ? { key, messages: [...prev.messages, pending] } : prev);
    try {
      const { response, data } = await requestCommunicationJson<MessageResult>("/api/communication/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, receiverId: contactId, channelType, content }),
      });
      if (!response.ok) throw new Error(data.error || "No se pudo enviar el mensaje");
      setConversation(prev => prev.key === key ? { key, messages: mergeChatMessage(prev.messages, data.message, tempId) } : prev);
      retrySend.current = null;
    } catch (error) {
      retrySend.current = { key, content, messageId };
      setConversation(prev => prev.key === key ? { key, messages: prev.messages.filter(message => message.id !== tempId) } : prev);
      setDraft(prev => prev.key === key && !prev.text ? { key, text: content } : prev);
      setErrorState({ key, message: error instanceof DOMException && error.name === "AbortError" ? "No se confirmó el envío. Puedes reintentarlo; no se duplicará." : error instanceof Error ? error.message : "No se pudo enviar el mensaje" });
    } finally {
      pendingMutations.current--;
      mutationVersion.current++;
      setSending(false);
    }
  };

  const changeMessage = async (message: ChatMessage, remove: boolean) => {
    if (!canModifyMessage(message, myId) || mutationId || sending) return;
    const content = validatedMessageContent(editing?.key === threadKey ? editing.content : null);
    if (!remove && !content) return;
    const key = threadKey;
    pendingMutations.current++;
    mutationVersion.current++;
    setMutationId(message.id);
    setErrorState({ key, message: "" });
    try {
      const { response, data } = await requestCommunicationJson<MessageResult>("/api/communication/messages", {
        method: remove ? "DELETE" : "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: message.id, ...(remove ? {} : { content }) }),
      });
      if (!response.ok) throw new Error(data.error || "No se pudo modificar el mensaje");
      setConversation(prev => prev.key === key ? { key, messages: remove ? prev.messages.filter(item => item.id !== message.id) : mergeChatMessage(prev.messages, data.message) } : prev);
      setEditing(prev => prev?.key === key ? null : prev);
      setDeleteId(prev => prev?.key === key ? null : prev);
    } catch (error) {
      setErrorState({ key, message: error instanceof Error ? error.message : "No se pudo modificar el mensaje" });
    } finally {
      pendingMutations.current--;
      mutationVersion.current++;
      setMutationId(null);
    }
  };

  const loadOlder = async () => {
    if (!contactId || loadingOlder || history.key !== threadKey || !history.cursor || !history.hasMore) return;
    const key = threadKey;
    const version = mutationVersion.current;
    setLoadingOlder(true);
    try {
      const query = new URLSearchParams({ channel_type: channelType, other_user_id: contactId, before_created_at: history.cursor.createdAt, before_id: history.cursor.id });
      const { response, data } = await requestCommunicationJson<MessagePage>(`/api/communication/messages?${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error(data.error || "No se pudo cargar el historial");
      if (version === mutationVersion.current && !pendingMutations.current) {
        setConversation(prev => prev.key === key ? { key, messages: [...new Map([...data.messages, ...prev.messages].map(message => [message.id, message])).values()] } : prev);
        setHistory(prev => prev.key === key ? { key, hasMore: data.hasMore, cursor: data.nextCursor } : prev);
      }
    } catch (error) { setErrorState({ key, message: error instanceof Error ? error.message : "No se pudo cargar el historial" }); }
    finally { setLoadingOlder(false); }
  };

  const filteredContacts = contacts.filter(contact => `${contact.name} ${contact.subtitle || ""}`.toLowerCase().includes(searchQuery.toLowerCase()));
  const accents: Record<string, string> = { teal: "bg-primary text-white", amber: "bg-amber-600 text-white", violet: "bg-violet-600 text-white", emerald: "bg-emerald-600 text-white" };
  const accent = accents[accentColor] || accents.teal;
  const initials = (name: string) => name.split(" ").slice(0, 2).map(word => word[0]).join("").toUpperCase();
  const connected = selectedContact ? onlineIds?.includes(selectedContact.id) : false;
  const currentError = errorState.key === threadKey ? errorState.message : "";

  return (
    <div className="bg-white border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden flex flex-col md:flex-row h-[700px]">
      <aside className="md:w-72 max-h-52 md:max-h-none border-b md:border-b-0 md:border-r border-outline-variant/20 flex flex-col shrink-0">
        <div className="p-3 border-b border-outline-variant/20">
          <label className="relative block"><Search className="absolute left-3 top-2.5 w-4 h-4 text-outline-variant" />
            <input aria-label="Buscar contacto" className="w-full pl-9 pr-3 py-2 text-sm border rounded-xl" placeholder="Buscar contacto..." value={searchQuery} onChange={event => setSearchQuery(event.target.value)} />
          </label>
        </div>
        <div className="flex-1 overflow-y-auto">
          {!filteredContacts.length && <p className="p-5 text-sm text-on-surface-variant">{contacts.length ? "Sin resultados" : "No hay contactos vinculados"}</p>}
          {filteredContacts.map(contact => <button key={contact.id} onClick={() => setSelectedId(contact.id)} className={`w-full text-left px-4 py-3 flex gap-3 border-l-2 ${selectedContact?.id === contact.id ? "bg-primary/5 border-primary" : "border-transparent hover:bg-surface-container"}`}>
            <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold ${accent}`}>{initials(contact.name)}</span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold truncate">{contact.name}</span><span className="block text-xs text-on-surface-variant">{contact.subtitle}</span>
              {onlineIds?.includes(contact.id) && <span className="block text-xs text-emerald-700">● En línea</span>}
            </span>
          </button>)}
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {selectedContact ? <>
          <div className="px-4 py-3 border-b border-outline-variant/20 flex gap-3 items-center">
            <div className="min-w-0"><p className="font-bold text-sm">{selectedContact.name}</p><p className="text-xs text-on-surface-variant">{selectedContact.subtitle}</p></div>
            <span className={`ml-auto shrink-0 text-xs rounded-full px-2 py-1 ${connected ? "bg-emerald-50 text-emerald-800" : "bg-stone-100 text-stone-600"}`} role="status">{onlineIds === null ? "Estado no disponible" : connected ? "En línea" : "Desconectado"}</span>
          </div>
          {currentError && <p role="alert" className="px-4 py-2 text-sm bg-red-50 text-red-800">{currentError}</p>}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" aria-label="Mensajes">
            {history.key === threadKey && history.hasMore && <button type="button" onClick={() => { void loadOlder(); }} disabled={loadingOlder || sending || Boolean(mutationId)} className="block mx-auto text-xs font-semibold p-2 border rounded-xl">{loadingOlder ? "Cargando..." : "Cargar mensajes anteriores"}</button>}
            {loadingMessages ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : !messages.length && !currentError ? <p className="text-center text-sm text-on-surface-variant py-8">Envía tu primer mensaje a {selectedContact.name}</p> : null}
            {messages.map(message => {
              const own = message.sender_id === myId;
              const editable = canModifyMessage(message, myId);
              const isEditing = editing?.key === threadKey && editing.id === message.id;
              const isDeleting = deleteId?.key === threadKey && deleteId.id === message.id;
              return <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}><div className="max-w-[90%] md:max-w-[75%] space-y-1">
                {isEditing ? <form className="space-y-2 border rounded-xl p-3" onSubmit={event => { event.preventDefault(); void changeMessage(message, false); }}>
                  <textarea autoFocus aria-label="Editar mensaje" value={editing.content} maxLength={MAX_MESSAGE_LENGTH} onChange={event => setEditing({ key: threadKey, id: message.id, content: event.target.value })} className="w-full min-w-48 rounded border p-2 text-sm" />
                  <div className="flex gap-2"><button disabled={Boolean(mutationId) || !validatedMessageContent(editing.content)} className="inline-flex items-center gap-1 text-xs font-bold disabled:opacity-40"><Check size={14} />Guardar</button><button type="button" disabled={Boolean(mutationId)} onClick={() => setEditing(null)} className="inline-flex items-center gap-1 text-xs"><X size={14} />Cancelar</button></div>
                </form> : <p className={`px-4 py-2.5 rounded-2xl whitespace-pre-wrap break-words text-sm ${own ? accent : "bg-surface-container text-on-surface"}`}>{message.content}</p>}
                <div className="flex flex-wrap gap-2 text-[10px] text-on-surface-variant items-center">
                  <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</time>
                  {message.updated_at && <span>Editado</span>}
                  {own && (message.id.startsWith("tmp-") ? <Clock size={12} /> : <CheckCheck size={12} />)}
                  {editable && !isEditing && !isDeleting && <><button disabled={Boolean(mutationId) || sending} onClick={() => setEditing({ key: threadKey, id: message.id, content: message.content })} aria-label="Editar mensaje" className="inline-flex gap-1 items-center p-1"><Pencil size={12} />Editar</button><button disabled={Boolean(mutationId) || sending} onClick={() => setDeleteId({ key: threadKey, id: message.id })} aria-label="Eliminar mensaje" className="inline-flex gap-1 items-center p-1 text-red-700"><Trash2 size={12} />Eliminar</button></>}
                </div>
                {isDeleting && <div className="p-3 border border-red-200 rounded-xl text-xs space-y-2"><p>¿Eliminar este mensaje para ambos participantes?</p><div className="flex gap-3"><button disabled={Boolean(mutationId)} onClick={() => { void changeMessage(message, true); }} className="font-bold text-red-700">{mutationId === message.id ? "Eliminando..." : "Eliminar"}</button><button disabled={Boolean(mutationId)} onClick={() => setDeleteId(null)}>Cancelar</button></div></div>}
              </div></div>;
            })}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSend} className="p-3 border-t flex gap-2">
            <input aria-label="Nuevo mensaje" maxLength={MAX_MESSAGE_LENGTH} className="min-w-0 flex-1 px-3 py-2 border rounded-xl text-sm" placeholder={`Escribe a ${selectedContact.name}...`} value={newMessage} onChange={event => setDraft({ key: threadKey, text: event.target.value })} />
            <button type="submit" aria-label="Enviar mensaje" disabled={!validatedMessageContent(newMessage) || sending || Boolean(mutationId) || loadingMessages} className={`w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-40 ${accent}`}>{sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button>
          </form>
        </> : <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center"><User size={30} /><p>{emptyPlaceholder}</p></div>}
      </div>
    </div>
  );
}
