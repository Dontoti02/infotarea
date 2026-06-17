"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  AlertCircle,
  BookOpen,
  Calendar,
  Megaphone,
  Trash2,
  X,
  Loader2,
  RefreshCw,
  Clock,
  CheckCircle2,
  Pencil,
} from "lucide-react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────
type NoticeCategory = "urgent" | "academic" | "event";

interface Notice {
  id: string;
  author_id: string | null;
  title: string;
  content: string;
  category: NoticeCategory;
  created_at: string;
  expire_at: string | null;
  profiles?: { full_name: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<
  NoticeCategory,
  { label: string; badgeClass: string; accent: string; icon: React.ReactNode }
> = {
  urgent: {
    label: "Urgente",
    badgeClass: "bg-error/10 text-error border-error/20",
    accent: "bg-error",
    icon: <AlertCircle size={13} />,
  },
  academic: {
    label: "Académico",
    badgeClass: "bg-surface-container-high text-on-surface border-outline-variant",
    accent: "bg-outline",
    icon: <BookOpen size={13} />,
  },
  event: {
    label: "Evento",
    badgeClass: "bg-secondary-container/60 text-on-secondary-container border-secondary/20",
    accent: "bg-secondary",
    icon: <Calendar size={13} />,
  },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Ahora mismo";
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Ayer";
  return new Date(dateStr).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ─── Create Modal ─────────────────────────────────────────────────────────────
interface CreateModalProps {
  notice?: Notice;
  onClose: () => void;
  onCreated: () => void;
}

function CreateNoticeModal({ notice, onClose, onCreated }: CreateModalProps) {
  const [title, setTitle] = useState(notice?.title ?? "");
  const [content, setContent] = useState(notice?.content ?? "");
  const [category, setCategory] = useState<NoticeCategory>(notice?.category ?? "academic");
  const [expireAt, setExpireAt] = useState(() => {
    if (notice?.expire_at) {
      const date = new Date(notice.expire_at);
      const tzOffset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    }
    return "";
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const noticeData = {
      title: title.trim(),
      content: content.trim(),
      category,
      expire_at: expireAt ? new Date(expireAt).toISOString() : null,
    };

    let resultError;

    if (notice) {
      const { error: updateError } = await supabase
        .from("notices")
        .update(noticeData)
        .eq("id", notice.id);
      resultError = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("notices")
        .insert({
          ...noticeData,
          author_id: user?.id ?? null,
        });
      resultError = insertError;
    }

    if (resultError) {
      setError(resultError.message);
      setLoading(false);
      return;
    }

    onCreated();
    onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant w-full max-w-[32rem] relative overflow-hidden">
        {/* Top accent line */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-primary-container to-secondary" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Megaphone size={18} />
            </div>
            <div>
              <h3 className="text-title-lg font-bold text-on-surface">
                {notice ? "Editar Aviso" : "Nuevo Aviso"}
              </h3>
              <p className="text-label-sm text-on-surface-variant">
                {notice ? "Modificar comunicado institucional" : "Publicar comunicado institucional"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-error/10 border border-error/20 text-error p-3 rounded-xl flex items-center gap-2 text-label-md">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-label-md font-bold text-on-surface">Categoría</label>
            <div className="flex gap-2">
              {(["urgent", "academic", "event"] as NoticeCategory[]).map((cat) => {
                const cfg = CATEGORY_CONFIG[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-label-md font-bold transition-all ${
                      category === cat
                        ? cfg.badgeClass + " ring-2 ring-primary/40"
                        : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
                    }`}
                  >
                    {cfg.icon} {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-label-md font-bold text-on-surface" htmlFor="notice-title">
              Título
            </label>
            <input
              id="notice-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Cierre de inscripciones"
              maxLength={120}
              required
              className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
            />
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <label className="text-label-md font-bold text-on-surface" htmlFor="notice-content">
              Contenido
            </label>
            <textarea
              id="notice-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Descripción completa del aviso..."
              rows={4}
              required
              className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all resize-none"
            />
          </div>

          {/* Expiration date */}
          <div className="space-y-1.5">
            <label className="text-label-md font-bold text-on-surface" htmlFor="notice-expire-at">
              Fecha y Hora Límite (Opcional)
            </label>
            <input
              id="notice-expire-at"
              type="datetime-local"
              value={expireAt}
              onChange={(e) => setExpireAt(e.target.value)}
              className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-outline-variant text-on-surface-variant font-bold text-label-md hover:bg-surface-container transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim() || !content.trim()}
              className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary-container transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {loading ? (notice ? "Guardando..." : "Publicando...") : (notice ? "Guardar Cambios" : "Publicar Aviso")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ─── Notice Card ──────────────────────────────────────────────────────────────
interface NoticeCardProps {
  notice: Notice;
  onEdit: (notice: Notice) => void;
  onDelete: (id: string) => void;
  isOwner: boolean;
  isAdmin: boolean;
}

function NoticeCard({ notice, onEdit, onDelete, isOwner, isAdmin }: NoticeCardProps) {
  const cfg = CATEGORY_CONFIG[notice.category] ?? CATEGORY_CONFIG.academic;
  const authorName = notice.profiles?.full_name ?? "Sistema";
  const canEditDelete = isOwner || isAdmin;

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group flex flex-col">
      {/* Accent top bar */}
      <div className={`h-1 w-full ${cfg.accent}`} />

      <div className="p-5 flex flex-col flex-1 gap-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1.5 font-bold text-label-sm px-2.5 py-1 rounded-full border ${cfg.badgeClass}`}
          >
            {cfg.icon}
            {cfg.label}
          </span>
          <div className="flex items-center gap-1 text-on-surface-variant">
            <Clock size={11} className="shrink-0" />
            <span className="text-label-sm font-bold whitespace-nowrap">{timeAgo(notice.created_at)}</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-title-lg font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-2 leading-snug">
          {notice.title}
        </h3>

        {/* Content */}
        <p className="text-body-md text-on-surface-variant line-clamp-3 flex-1">
          {notice.content}
        </p>

        {/* Expiration date */}
        {notice.expire_at && (
          <div className="flex items-center gap-1.5 text-label-sm font-semibold mt-auto pt-2">
            <Calendar size={13} className="text-on-surface-variant shrink-0" />
            {new Date(notice.expire_at).getTime() < Date.now() ? (
              <span className="text-error bg-error/10 border border-error/20 px-2 py-0.5 rounded-full font-bold">
                Expirado: {new Date(notice.expire_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
              </span>
            ) : (
              <span className="text-on-surface-variant">
                Expira: {new Date(notice.expire_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-outline-variant/50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-label-sm flex items-center justify-center shrink-0">
              {getInitials(authorName)}
            </div>
            <span className="text-label-md font-bold text-on-surface truncate max-w-[120px]">
              {authorName}
            </span>
          </div>

          {canEditDelete && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onEdit(notice)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                title="Editar aviso"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => onDelete(notice.id)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-error/10 hover:text-error transition-colors opacity-0 group-hover:opacity-100"
                title="Eliminar aviso"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const FILTERS = [
  { key: "all", label: "Todos" },
  { key: "urgent", label: "Urgentes" },
  { key: "academic", label: "Académicos" },
  { key: "event", label: "Eventos" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export function NoticesCenter() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [showModal, setShowModal] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | undefined>(undefined);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  const supabase = createClient();

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("notices")
      .select("*, profiles(full_name)")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setNotices((data as Notice[]) ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchNotices();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profile) {
          setCurrentUserRole(profile.role);
        }
      }
    });
  }, [fetchNotices, supabase]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("notices-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "notices" }, () => {
        fetchNotices();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, fetchNotices]);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este aviso?")) return;
    const { error: delError } = await supabase.from("notices").delete().eq("id", id);
    if (delError) {
      alert("Error al eliminar: " + delError.message);
      return;
    }
    setNotices((prev) => prev.filter((n) => n.id !== id));
  };

  const handleEdit = (notice: Notice) => {
    setEditingNotice(notice);
    setShowModal(true);
  };

  // Derived filtered lists taking expiration into account for students
  const visibleNotices = notices.filter((n) => {
    if (currentUserRole === "student" && n.expire_at) {
      return new Date(n.expire_at).getTime() >= Date.now();
    }
    return true;
  });

  const filtered = visibleNotices.filter((n) => {
    const matchesFilter = filter === "all" || n.category === filter;
    const matchesSearch =
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const counts: Record<string, number> = {
    all: visibleNotices.length,
    urgent: visibleNotices.filter((n) => n.category === "urgent").length,
    academic: visibleNotices.filter((n) => n.category === "academic").length,
    event: visibleNotices.filter((n) => n.category === "event").length,
  };

  return (
    <>
      {showModal && (
        <CreateNoticeModal
          notice={editingNotice}
          onClose={() => {
            setShowModal(false);
            setEditingNotice(undefined);
          }}
          onCreated={fetchNotices}
        />
      )}

      <div className="space-y-xl">
        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-md">
          <div>
            <h2 className="text-headline-lg font-bold text-on-surface">Avisos Institucionales</h2>
            <p className="text-body-md font-medium text-on-surface-variant mt-xs">
              {visibleNotices.length} comunicados publicados
            </p>
          </div>
          <div className="flex items-center gap-sm">
            <button
              onClick={fetchNotices}
              disabled={loading}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50"
              title="Recargar"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            {currentUserRole !== "student" && (
              <button
                onClick={() => {
                  setEditingNotice(undefined);
                  setShowModal(true);
                }}
                className="bg-primary hover:bg-primary-container text-on-primary font-bold text-label-md px-lg py-sm rounded-xl flex items-center gap-sm transition-colors shadow-sm active:scale-[0.98]"
              >
                <Plus size={18} /> Crear Aviso
              </button>
            )}
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="bg-surface-container-lowest p-md rounded-xl shadow-sm border border-outline-variant flex flex-col lg:flex-row justify-between gap-md items-start lg:items-center">
          <div className="flex flex-wrap gap-xs">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-md py-sm rounded-full font-bold text-label-md transition-colors ${
                  filter === f.key
                    ? "bg-primary text-on-primary"
                    : "bg-surface text-on-surface-variant border border-outline-variant hover:bg-surface-container-low"
                }`}
              >
                {f.label}
                <span className="ml-1.5 opacity-60">({counts[f.key] ?? 0})</span>
              </button>
            ))}
          </div>
          <div className="relative w-full lg:w-64">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
              size={16}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar avisos..."
              className="w-full pl-9 pr-4 py-2 bg-surface border border-outline-variant rounded-lg text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>
        </div>

        {/* ── Content ── */}
        {error && (
          <div className="bg-error/10 border border-error/20 text-error p-4 rounded-xl flex items-center gap-3">
            <AlertCircle size={20} />
            <span className="text-body-md font-medium">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-container-lowest rounded-xl border border-outline-variant h-56 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-on-surface-variant">
            <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">
              <Megaphone size={28} className="opacity-40" />
            </div>
            <p className="text-body-lg font-medium">
              {search ? "No se encontraron avisos." : "No hay avisos publicados aún."}
            </p>
            {(!search && currentUserRole !== "student") && (
              <button
                onClick={() => setShowModal(true)}
                className="text-primary font-bold text-label-md hover:underline"
              >
                Crear el primer aviso →
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
            {filtered.map((notice) => (
              <NoticeCard
                key={notice.id}
                notice={notice}
                onEdit={handleEdit}
                onDelete={handleDelete}
                isOwner={notice.author_id === currentUserId}
                isAdmin={currentUserRole === "admin"}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
