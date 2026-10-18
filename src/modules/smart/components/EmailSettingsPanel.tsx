"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  Info,
  Loader2,
  Mail,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  ALERT_CONFIG_DEFAULTS,
  ALERT_TYPE_LABELS,
  normalizeStoredEmailSettings,
  type AlertType,
  type EmailSecurity,
  type EmailSettingsDraft,
} from "@/shared/utils/prioritization";
import type { AlertSweepResult, EmailSettingsResponse } from "../types";

const MsgBanner = ({ msg }: { msg: { type: "success" | "error" | "info"; text: string } | null }) => {
  if (!msg) return null;
  const styles = {
    success: "bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]",
    error: "bg-error-container text-on-error-container border-error/20",
    info: "bg-surface-container-low text-on-surface border-outline-variant/60",
  } as const;
  const Icon = msg.type === "success" ? CheckCircle2 : msg.type === "error" ? AlertCircle : Info;
  return (
    <div className={`p-md rounded-xl flex items-start gap-sm font-medium text-label-md border ${styles[msg.type]}`}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <span>{msg.text}</span>
    </div>
  );
};

const SECURITY_PRESETS: Record<EmailSecurity, { label: string; port: number }> = {
  tls: { label: "TLS (puerto 587)", port: 587 },
  ssl: { label: "SSL (puerto 465)", port: 465 },
  none: { label: "Sin cifrado", port: 25 },
};

/**
 * Configuración del correo saliente (ítem 23).
 * Réplica funcional del panel "Correo saliente": servidor SMTP,
 * seguridad, puerto, usuario, contraseña de aplicación, remitente,
 * alertas por correo y correo de prueba.
 */
export function EmailSettingsPanel() {
  const [settings, setSettings] = useState<EmailSettingsDraft>(() => normalizeStoredEmailSettings(null));
  const [hasPassword, setHasPassword] = useState(false);
  const [migrationPending, setMigrationPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [testMsg, setTestMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchSettings = useCallback(async (): Promise<EmailSettingsResponse> => {
    const response = await fetch("/api/admin/email-settings", { cache: "no-store" });
    const data = await response.json() as EmailSettingsResponse & { error?: string };
    if (!response.ok) throw new Error(data.error || "No se pudo cargar la configuración de correo.");
    return data;
  }, []);

  const applySettings = useCallback((data: EmailSettingsResponse) => {
    setSettings(data.settings);
    setHasPassword(data.hasPassword);
    setMigrationPending(Boolean(data.migrationPending));
    setTestTo(previous => previous || data.settings.from_email || data.settings.smtp_user || "");
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    fetchSettings()
      .then(applySettings)
      .catch(error => setMsg({
        type: "error",
        text: error instanceof Error ? error.message : "No se pudo cargar la configuración.",
      }))
      .finally(() => setLoading(false));
  }, [fetchSettings, applySettings]);

  useEffect(() => {
    let active = true;
    fetchSettings()
      .then(data => {
        if (active) applySettings(data);
      })
      .catch(error => {
        if (active) setMsg({
          type: "error",
          text: error instanceof Error ? error.message : "No se pudo cargar la configuración.",
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchSettings, applySettings]);

  const isGmail = useMemo(() => /(^|\.)gmail\.com$/i.test(settings.smtp_host.trim()), [settings.smtp_host]);

  const update = (patch: Partial<EmailSettingsDraft>) => setSettings(previous => ({ ...previous, ...patch }));

  const handleSecurityChange = (security: EmailSecurity) => {
    const preset = SECURITY_PRESETS[security];
    const standardPorts = Object.values(SECURITY_PRESETS).map(value => value.port);
    update({
      smtp_security: security,
      smtp_port: standardPorts.includes(settings.smtp_port) ? preset.port : settings.smtp_port,
    });
  };

  const handleToggleAlert = (key: AlertType) => {
    update({ alert_config: { ...settings.alert_config, [key]: !settings.alert_config[key] } });
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const response = await fetch("/api/admin/email-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          ...(password.trim() ? { smtp_password: password } : {}),
        }),
      });
      const data = await response.json() as (EmailSettingsResponse & { error?: string; errors?: string[] });
      if (response.status === 502 && data.settings) {
        setSettings(data.settings);
        setHasPassword(data.hasPassword);
        setMsg({ type: "error", text: data.error || "La configuración se guardó, pero la contraseña no." });
        return;
      }
      if (!response.ok) {
        throw new Error(data.errors?.length ? data.errors.join(" ") : data.error || "No se pudo guardar.");
      }
      setSettings(data.settings);
      setHasPassword(data.hasPassword);
      setMigrationPending(false);
      setPassword("");
      setMsg({ type: "success", text: "Configuración de correo guardada correctamente." });
    } catch (error) {
      setMsg({ type: "error", text: error instanceof Error ? error.message : "No se pudo guardar." });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestMsg(null);
    try {
      const response = await fetch("/api/admin/email-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo }),
      });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error || "No se pudo enviar la prueba.");
      setTestMsg({ type: "success", text: data.message || "Correo de prueba enviado." });
    } catch (error) {
      setTestMsg({ type: "error", text: error instanceof Error ? error.message : "No se pudo enviar la prueba." });
    } finally {
      setTesting(false);
    }
  };

  const handleSweep = async () => {
    setSweeping(true);
    setMsg(null);
    try {
      const response = await fetch("/api/alerts/sweep", { method: "POST" });
      const data = await response.json() as { error?: string; result?: AlertSweepResult };
      if (!response.ok || !data.result) throw new Error(data.error || "No se pudieron generar las alertas.");
      const { generated, duplicates, emailsSent, emailsFailed, emailEnabled } = data.result;
      setMsg({
        type: emailsFailed > 0 ? "error" : "success",
        text: emailEnabled
          ? `Alertas nuevas: ${generated} · repetidas omitidas: ${duplicates} · correos enviados: ${emailsSent}${emailsFailed ? ` · fallidos: ${emailsFailed}` : ""}.`
          : `Alertas nuevas: ${generated} · repetidas omitidas: ${duplicates}. El correo está desactivado; las alertas quedaron visibles en la plataforma.`,
      });
    } catch (error) {
      setMsg({ type: "error", text: error instanceof Error ? error.message : "No se pudieron generar las alertas." });
    } finally {
      setSweeping(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-sm p-xl flex items-center justify-center gap-md">
        <Loader2 className="animate-spin text-primary" size={22} />
        <span className="text-body-md font-medium text-on-surface-variant">Cargando configuración de correo…</span>
      </div>
    );
  }

  const inputClass =
    "w-full bg-surface border border-outline-variant rounded-xl px-3.5 py-2.5 text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:ring-2 focus:ring-primary/25 focus:border-primary outline-none transition-all";

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-sm overflow-hidden">
      {/* Encabezado */}
      <div className="px-lg py-md border-b border-outline-variant/30 bg-surface-container-low/60 flex items-start justify-between gap-md flex-wrap">
        <div className="flex items-start gap-md min-w-0">
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
            <Mail size={22} />
          </div>
          <div className="min-w-0">
            <h3 className="text-title-lg font-bold text-on-surface">Correo saliente</h3>
            <p className="text-body-md text-on-surface-variant mt-0.5">
              Cuenta con la que la plataforma envía credenciales, recuperación de contraseña y notificaciones.
            </p>
          </div>
        </div>
      </div>

      <div className="p-lg space-y-lg">
        <MsgBanner msg={msg} />

        {migrationPending && (
          <div className="p-md rounded-xl bg-amber-400/15 text-amber-700 dark:text-amber-300 border border-amber-400/30 flex items-start gap-sm text-label-md font-medium">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>
              Falta aplicar la migración <code className="font-mono">20261018000000_iteracion_4_priorizacion_correo.sql</code> en Supabase.
              Los campos se pueden revisar, pero aún no se guardan.
            </span>
          </div>
        )}

        {/* Estado del envío */}
        <div className={`p-md rounded-xl border flex items-start gap-sm ${settings.enabled ? "bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]" : "bg-surface-container-low text-on-surface border-outline-variant/60"}`}>
          <Info size={18} className="mt-0.5 shrink-0" />
          <span className="text-label-md font-medium">
            {settings.enabled
              ? "El envío está activado: la plataforma enviará las alertas de seguimiento con esta cuenta."
              : "El envío está desactivado: la plataforma no envía correos. Actívalo cuando la cuenta esté lista."}
          </span>
        </div>

        {/* Interruptor general */}
        <label className="flex items-center justify-between gap-md p-md rounded-xl border border-outline-variant/40 bg-surface-container-low/40 cursor-pointer">
          <span className="flex items-center gap-sm">
            {settings.enabled ? <Zap size={18} className="text-primary" /> : <Zap size={18} className="text-on-surface-variant/60" />}
            <span className="text-body-md font-bold text-on-surface">Enviar correos</span>
          </span>
          <span className="relative inline-flex items-center">
            <input
              className="sr-only peer"
              type="checkbox"
              checked={settings.enabled}
              onChange={event => update({ enabled: event.target.checked })}
            />
            <span className="w-11 h-6 bg-outline-variant rounded-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full inline-block transition-colors" />
          </span>
        </label>

        {/* Servidor / seguridad / puerto */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-md">
          <div className="xl:col-span-2">
            <label className="block text-label-md font-bold text-on-surface mb-xs">Servidor SMTP</label>
            <input
              className={inputClass}
              value={settings.smtp_host}
              onChange={event => update({ smtp_host: event.target.value })}
              placeholder="smtp.gmail.com"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-label-md font-bold text-on-surface mb-xs">Seguridad</label>
            <select
              className={inputClass}
              value={settings.smtp_security}
              onChange={event => handleSecurityChange(event.target.value as EmailSecurity)}
            >
              {(Object.keys(SECURITY_PRESETS) as EmailSecurity[]).map(security => (
                <option key={security} value={security}>{SECURITY_PRESETS[security].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-label-md font-bold text-on-surface mb-xs">Puerto</label>
            <input
              className={inputClass}
              type="number"
              min={1}
              max={65535}
              value={settings.smtp_port}
              onChange={event => update({ smtp_port: Number.parseInt(event.target.value || "0", 10) || 0 })}
            />
          </div>
        </div>

        {/* Usuario / contraseña */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          <div>
            <label className="block text-label-md font-bold text-on-surface mb-xs">Usuario</label>
            <input
              className={inputClass}
              value={settings.smtp_user || ""}
              onChange={event => update({ smtp_user: event.target.value || null })}
              placeholder="notificaciones@instituto.edu.pe"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-label-md font-bold text-on-surface mb-xs">Contraseña</label>
            <div className="relative">
              <input
                className={`${inputClass} pr-11`}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder={hasPassword ? "Contraseña guardada · escribe para reemplazarla" : "Contraseña de aplicación"}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(previous => !previous)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface-variant hover:text-on-surface transition-colors"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {hasPassword && (
              <p className="text-label-sm text-on-surface-variant mt-1 flex items-center gap-1">
                <CheckCircle2 size={12} className="text-secondary" /> Contraseña de aplicación guardada en el servidor.
              </p>
            )}
          </div>
        </div>

        {/* Remitente */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          <div>
            <label className="block text-label-md font-bold text-on-surface mb-xs">Correo remitente</label>
            <input
              className={inputClass}
              value={settings.from_email || ""}
              onChange={event => update({ from_email: event.target.value || null })}
              placeholder="notificaciones@instituto.edu.pe"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-label-md font-bold text-on-surface mb-xs">Nombre del remitente</label>
            <input
              className={inputClass}
              value={settings.from_name || ""}
              onChange={event => update({ from_name: event.target.value || null })}
              placeholder="Vacío: el nombre de la institución"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Nota Gmail */}
        <div className="p-md rounded-xl bg-surface-container-low border border-outline-variant/50 flex items-start gap-sm">
          <HelpCircle size={18} className="text-primary mt-0.5 shrink-0" />
          <p className="text-label-md text-on-surface-variant leading-relaxed">
            Con Gmail o Google Workspace usa <strong className="text-on-surface">smtp.gmail.com</strong>, puerto{" "}
            <strong className="text-on-surface">587</strong> con TLS y una{" "}
            <strong className="text-on-surface">contraseña de aplicación</strong> (requiere la verificación en dos pasos),
            no la contraseña normal de la cuenta. El remitente debe ser la misma cuenta del usuario.
          </p>
        </div>

        {/* Alertas por correo */}
        <div className="rounded-xl border border-outline-variant/40 overflow-hidden">
          <div className="px-md py-sm bg-surface-container-low border-b border-outline-variant/30 flex items-center gap-sm">
            <Sparkles size={16} className="text-primary" />
            <span className="text-label-md font-bold text-on-surface">Alertas inteligentes que se envían por correo</span>
          </div>
          <div className="p-md grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-sm">
            {(Object.keys(ALERT_CONFIG_DEFAULTS) as AlertType[]).map(key => (
              <label key={key} className="flex items-center gap-sm p-sm rounded-lg border border-outline-variant/40 bg-surface-container-low/30 cursor-pointer hover:border-primary/40 transition-colors">
                <input
                  type="checkbox"
                  className="accent-[#005c55] w-4 h-4"
                  checked={settings.alert_config[key]}
                  onChange={() => handleToggleAlert(key)}
                />
                <span className="text-label-md font-semibold text-on-surface">{ALERT_TYPE_LABELS[key]}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Guardar / ejecutar */}
        <div className="flex flex-wrap items-center gap-sm">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-sm bg-primary text-on-primary font-bold text-label-md py-2.5 px-lg rounded-xl hover:bg-primary-container transition-colors disabled:opacity-50 active:scale-95"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button
            onClick={handleSweep}
            disabled={sweeping}
            className="inline-flex items-center gap-sm border border-primary/40 text-primary font-bold text-label-md py-2.5 px-lg rounded-xl hover:bg-primary/10 transition-colors disabled:opacity-50 active:scale-95"
            title="Genera las alertas pendientes y, si el correo está activo, envía los resúmenes."
          >
            {sweeping ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            {sweeping ? "Ejecutando…" : "Ejecutar alertas ahora"}
          </button>
        </div>

        {/* Prueba */}
        <div className="pt-lg border-t border-outline-variant/30 space-y-sm">
          <p className="text-label-md font-bold text-on-surface">Enviar un correo de prueba a</p>
          <div className="flex flex-wrap items-center gap-sm">
            <input
              className={`${inputClass} max-w-xs`}
              type="email"
              value={testTo}
              onChange={event => setTestTo(event.target.value)}
              placeholder="tu@correo.com"
            />
            <button
              onClick={handleTest}
              disabled={testing || !testTo.trim()}
              className="inline-flex items-center gap-sm bg-surface-container-high text-on-surface font-bold text-label-md py-2.5 px-lg rounded-xl hover:bg-surface-container-highest transition-colors disabled:opacity-50 active:scale-95"
            >
              {testing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {testing ? "Enviando…" : "Enviar Prueba"}
            </button>
            <span className="text-label-sm text-on-surface-variant">Activa y guarda antes de probar</span>
            <button
              onClick={reload}
              className="ml-auto inline-flex items-center gap-1.5 text-label-md font-bold text-primary hover:underline"
            >
              <RefreshCw size={14} /> Recargar
            </button>
          </div>
          {testMsg && <MsgBanner msg={testMsg} />}
          {isGmail && (
            <p className="text-label-sm text-on-surface-variant">
              Gmail detectado: recuerda generar la contraseña de aplicación en tu Cuenta de Google.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
