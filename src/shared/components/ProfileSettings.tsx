"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Settings, Mail, Palette, Lock,
  Bell, ShieldCheck, Eye, CheckCircle2,
  Loader2, AlertCircle, Camera, EyeOff, KeyRound, AtSign,
  User as UserIcon
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type TabId = "perfil" | "cuenta" | "notificaciones" | "seguridad";

const MsgBanner = ({ msg }: { msg: { type: "success" | "error"; text: string } | null }) => {
  if (!msg) return null;
  const ok = msg.type === "success";
  return (
    <div className={`p-4 rounded-xl flex items-start gap-3 font-medium text-label-md mb-md ${ok ? "bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]" : "bg-error-container text-on-error-container border border-error/20"}`}>
      {ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <AlertCircle size={18} className="mt-0.5 shrink-0" />}
      <span>{msg.text}</span>
    </div>
  );
};

interface ProfileSettingsProps {
  /** Optional extra content rendered inside the "Cuenta" tab (e.g., admin-only forms). */
  extraCuentaContent?: React.ReactNode;
}

const TABS: { id: TabId; label: string }[] = [
  { id: "perfil",         label: "Perfil"         },
  { id: "cuenta",         label: "Cuenta"         },
  { id: "notificaciones", label: "Notificaciones" },
  { id: "seguridad",      label: "Seguridad"      },
];

export function ProfileSettings({ extraCuentaContent }: ProfileSettingsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("perfil");

  const [profile, setProfile]     = useState<any>(null);
  const [email, setEmail]         = useState("");
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Perfil fields
  const [fullName, setFullName] = useState("");
  const [bio, setBio]           = useState("");
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Email fields
  const [newEmail, setNewEmail]       = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [emailMsg, setEmailMsg]         = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password fields
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg]           = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showPwd, setShowPwd]         = useState(false);
  const [showConfPwd, setShowConfPwd] = useState(false);

  // Notifications
  const [notifSystem, setNotifSystem]   = useState(true);
  const [notifTasks, setNotifTasks]     = useState(true);
  const [notifMessages, setNotifMessages] = useState(false);

  // Security
  const [visibility, setVisibility] = useState("institution");

  // Dark Mode
  const [isDarkMode, setIsDarkMode] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || "");
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        setProfile(data);
        setFullName(data.full_name || "");
        setBio(data.bio || "");
      }
      setLoading(false);
    }
    loadProfile();

    if (typeof window !== "undefined") {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    }
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const toggleDarkMode = (checked: boolean) => {
    setIsDarkMode(checked);
    if (typeof window !== "undefined") {
      if (checked) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    setProfileMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, bio, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      setProfileMsg({ type: "error", text: "Error al guardar: " + error.message });
    } else {
      setProfileMsg({ type: "success", text: "Perfil actualizado correctamente." });
      setProfile({ ...profile, full_name: fullName, bio });
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploadingAvatar(true);
    setProfileMsg(null);
    const fileExt = file.name.split(".").pop();
    const filePath = `${profile.id}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from("img_perfiles").upload(filePath, file);
    if (uploadError) {
      setProfileMsg({ type: "error", text: "Error al subir imagen: " + uploadError.message });
      setUploadingAvatar(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("img_perfiles").getPublicUrl(filePath);
    const { error: updateError } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", profile.id);
    if (updateError) {
      setProfileMsg({ type: "error", text: "Error al actualizar foto: " + updateError.message });
    } else {
      setProfileMsg({ type: "success", text: "Foto de perfil actualizada." });
      setProfile({ ...profile, avatar_url: publicUrl });
    }
    setUploadingAvatar(false);
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailMsg(null);
    if (!newEmail.trim()) { setEmailMsg({ type: "error", text: "Ingresa un correo electrónico." }); return; }
    if (newEmail !== confirmEmail) { setEmailMsg({ type: "error", text: "Los correos no coinciden." }); return; }
    if (newEmail === email) { setEmailMsg({ type: "error", text: "El correo nuevo debe ser diferente al actual." }); return; }
    setUpdatingEmail(true);

    try {
      // Force loading/refreshing session on the client
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        setEmailMsg({ type: "error", text: "Sesión no encontrada o expirada. Por favor, inicia sesión de nuevo." });
        setUpdatingEmail(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) {
        setEmailMsg({ type: "error", text: "Error al actualizar correo: " + error.message });
      } else {
        setEmailMsg({ type: "success", text: "Se envió un enlace de confirmación al nuevo correo. Revisa tu bandeja." });
        setNewEmail(""); setConfirmEmail("");
      }
    } catch (err: any) {
      setEmailMsg({ type: "error", text: "Error: " + (err.message || "No se pudo actualizar el correo") });
    } finally {
      setUpdatingEmail(false);
    }
  };

  const getPasswordStrength = (pwd: string) => {
    if (pwd.length === 0) return { label: "", color: "", width: "0%" };
    if (pwd.length < 6)   return { label: "Muy débil", color: "#ba1a1a", width: "20%" };
    if (pwd.length < 8)   return { label: "Débil",     color: "#e85d04", width: "40%" };
    if (pwd.length < 10)  return { label: "Media",     color: "#f59e0b", width: "60%" };
    const extras = [/[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(pwd)).length;
    if (extras >= 2) return { label: "Fuerte", color: "#005c55", width: "100%" };
    return               { label: "Buena",  color: "#006e2d", width: "80%" };
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (!newPassword) { setPasswordMsg({ type: "error", text: "Ingresa una contraseña." }); return; }
    if (newPassword.length < 6) { setPasswordMsg({ type: "error", text: "Mínimo 6 caracteres." }); return; }
    if (newPassword !== confirmPassword) { setPasswordMsg({ type: "error", text: "Las contraseñas no coinciden." }); return; }
    setUpdatingPassword(true);

    try {
      // Force loading/refreshing session on the client
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        setPasswordMsg({ type: "error", text: "Sesión no encontrada o expirada. Por favor, inicia sesión de nuevo." });
        setUpdatingPassword(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordMsg({ type: "error", text: "Error al actualizar contraseña: " + error.message });
      } else {
        setPasswordMsg({ type: "success", text: "¡Contraseña actualizada correctamente!" });
        setNewPassword(""); setConfirmPassword("");
      }
    } catch (err: any) {
      setPasswordMsg({ type: "error", text: "Error: " + (err.message || "No se pudo actualizar la contraseña") });
    } finally {
      setUpdatingPassword(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getInitials = (name: string) =>
    name ? name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() : "U";



  const pwdStrength = getPasswordStrength(newPassword);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  // ── TAB CONTENT ───────────────────────────────────────────────────────────

  const TabPerfil = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
      {/* Profile Card */}
      <div className="lg:col-span-1">
        <div className="bg-surface-container-lowest rounded-xl p-lg shadow-sm border border-outline-variant/30 flex flex-col items-center text-center relative overflow-hidden hover:shadow-md transition-shadow">
          <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-primary-container/20 to-tertiary-container/20" />
          <div className="relative z-10 mt-4 mb-md">
            <div className="w-32 h-32 rounded-full border-4 border-surface-container-lowest shadow-sm bg-surface-variant overflow-hidden flex items-center justify-center">
              {profile?.avatar_url
                ? <img alt="Foto de Perfil" className="w-full h-full object-cover" src={profile.avatar_url} />
                : <span className="text-display-sm font-bold text-on-surface-variant">{getInitials(profile?.full_name)}</span>
              }
            </div>
            <label className="absolute bottom-0 right-0 p-2 bg-primary text-on-primary rounded-full cursor-pointer shadow-lg hover:bg-primary-container transition-colors">
              {uploadingAvatar ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
            </label>
          </div>
          <h2 className="text-headline-md font-bold text-on-surface relative z-10">{profile?.full_name}</h2>
          <p className="text-body-md font-medium text-on-surface-variant mb-sm relative z-10 capitalize">
            {profile?.role === "admin" ? "Administrador" : profile?.role === "teacher" ? "Docente" : "Estudiante"}
          </p>
          <div className="flex items-center gap-xs text-primary bg-surface-container-high px-3 py-1 rounded-full relative z-10">
            <Mail size={14} />
            <span className="text-label-sm font-bold truncate max-w-[200px]">{email}</span>
          </div>
        </div>
      </div>

      {/* Edit Info */}
      <div className="lg:col-span-2 space-y-lg">
        <MsgBanner msg={profileMsg} />
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
          <div className="bg-surface-container-low px-lg py-md border-b border-outline-variant/30 flex items-center gap-sm">
            <UserIcon className="text-primary" size={20} />
            <h3 className="text-title-lg font-bold text-on-surface">Información Personal</h3>
          </div>
          <div className="p-lg space-y-md">
            <div>
              <label className="block text-label-md font-bold text-on-surface mb-xs">Nombre Completo</label>
              <input
                className="w-full bg-surface border border-outline-variant rounded-lg p-sm text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all"
                type="text" value={fullName} onChange={e => setFullName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-label-md font-bold text-on-surface mb-xs">Biografía / Notas</label>
              <textarea
                className="w-full bg-surface border border-outline-variant rounded-lg p-sm text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all resize-none"
                rows={4} value={bio} onChange={e => setBio(e.target.value)} placeholder="Escribe algo sobre ti..."
              />
            </div>
            <div className="flex justify-end pt-md border-t border-outline-variant/30">
              <button onClick={handleSaveProfile} disabled={saving}
                className="bg-primary text-on-primary font-bold text-label-md py-sm px-lg rounded-lg hover:bg-primary-container transition-colors disabled:opacity-50 flex items-center gap-2 active:scale-95">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>

        {/* Visual Preferences */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 to-transparent px-lg py-md border-b border-outline-variant/30 flex items-center gap-sm">
            <div className="bg-primary/10 p-2 rounded-full">
              <Palette className="text-primary" size={20} />
            </div>
            <h3 className="text-title-lg font-bold text-on-surface">Apariencia Visual</h3>
          </div>
          <div className="p-lg">
            <div className="flex items-center justify-between py-sm bg-surface-container-low p-md rounded-xl border border-outline-variant/50 shadow-sm transition-all hover:border-primary/30">
              <div className="flex flex-col gap-1">
                <p className="text-body-lg font-bold text-on-surface">Modo Oscuro</p>
                <p className="text-body-sm font-medium text-on-surface-variant max-w-sm">
                  Cambia el aspecto de la interfaz a colores más oscuros para relajar la vista en entornos de poca luz.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer group hover:scale-105 transition-transform">
                <input
                  className="sr-only peer"
                  type="checkbox"
                  checked={isDarkMode}
                  onChange={(e) => toggleDarkMode(e.target.checked)}
                />
                <div className="w-14 h-7 bg-outline-variant rounded-full peer peer-focus:ring-4 peer-focus:ring-primary/20 peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:border-white shadow-inner" />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const TabCuenta = () => (
    <div className="space-y-lg">
      {/* Change Email */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
        <div className="bg-surface-container-low px-lg py-md border-b border-outline-variant/30 flex items-center gap-sm">
          <AtSign className="text-primary" size={20} />
          <h3 className="text-title-lg font-bold text-on-surface">Cambiar Correo Electrónico</h3>
        </div>
        <div className="p-lg">
          <MsgBanner msg={emailMsg} />
          <form onSubmit={handleUpdateEmail} className="space-y-md">
            <div className="p-md bg-surface-container-low/40 rounded-lg border border-outline-variant/30 flex items-center gap-sm">
              <Mail size={16} className="text-on-surface-variant shrink-0" />
              <div>
                <p className="text-label-sm font-bold text-on-surface-variant">Correo actual</p>
                <p className="text-body-md font-medium text-on-surface">{email}</p>
              </div>
            </div>
            <div>
              <label className="block text-label-md font-bold text-on-surface mb-xs">Nuevo correo electrónico</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline-variant"><Mail size={18} /></div>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                  placeholder="nuevo@correo.com"
                  className="w-full pl-10 bg-surface border border-outline-variant rounded-lg p-sm text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all" />
              </div>
            </div>
            <div>
              <label className="block text-label-md font-bold text-on-surface mb-xs">Confirmar nuevo correo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline-variant"><Mail size={18} /></div>
                <input type="email" value={confirmEmail} onChange={e => setConfirmEmail(e.target.value)}
                  placeholder="nuevo@correo.com"
                  className="w-full pl-10 bg-surface border border-outline-variant rounded-lg p-sm text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all" />
              </div>
            </div>
            <p className="text-label-sm font-medium text-on-surface-variant">
              ⚠️ Se enviará un enlace de confirmación a ambos correos para aprobar el cambio.
            </p>
            <div className="flex justify-end pt-sm border-t border-outline-variant/30">
              <button type="submit" disabled={updatingEmail}
                className="bg-primary text-on-primary font-bold text-label-md py-sm px-lg rounded-lg hover:bg-primary-container transition-colors disabled:opacity-50 flex items-center gap-2 active:scale-95">
                {updatingEmail && <Loader2 size={16} className="animate-spin" />}
                {updatingEmail ? "Actualizando..." : "Actualizar Correo"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
        <div className="bg-surface-container-low px-lg py-md border-b border-outline-variant/30 flex items-center gap-sm">
          <KeyRound className="text-primary" size={20} />
          <h3 className="text-title-lg font-bold text-on-surface">Cambiar Contraseña</h3>
        </div>
        <div className="p-lg">
          <MsgBanner msg={passwordMsg} />
          <form onSubmit={handleUpdatePassword} className="space-y-md">
            <div>
              <label className="block text-label-md font-bold text-on-surface mb-xs">Nueva contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline-variant"><Lock size={18} /></div>
                <input type={showPwd ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 bg-surface border border-outline-variant rounded-lg p-sm text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all" />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline-variant hover:text-on-surface transition-colors">
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {newPassword.length > 0 && (
                <div className="mt-xs">
                  <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: pwdStrength.width, backgroundColor: pwdStrength.color }} />
                  </div>
                  <p className="text-label-sm font-bold mt-1" style={{ color: pwdStrength.color }}>{pwdStrength.label}</p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-label-md font-bold text-on-surface mb-xs">Confirmar nueva contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline-variant"><Lock size={18} /></div>
                <input type={showConfPwd ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-10 bg-surface border rounded-lg p-sm text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all ${confirmPassword && newPassword !== confirmPassword ? "border-error focus:ring-error" : "border-outline-variant"}`} />
                <button type="button" onClick={() => setShowConfPwd(!showConfPwd)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline-variant hover:text-on-surface transition-colors">
                  {showConfPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-label-sm font-bold text-error mt-xs">Las contraseñas no coinciden.</p>
              )}
            </div>
            <div className="flex justify-end pt-sm border-t border-outline-variant/30">
              <button type="submit" disabled={updatingPassword}
                className="bg-primary text-on-primary font-bold text-label-md py-sm px-lg rounded-lg hover:bg-primary-container transition-colors disabled:opacity-50 flex items-center gap-2 active:scale-95">
                {updatingPassword && <Loader2 size={16} className="animate-spin" />}
                {updatingPassword ? "Actualizando..." : "Cambiar Contraseña"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Extra content injected by parent (e.g., admin create-admin form) */}
      {extraCuentaContent && (
        <>
          <div className="flex items-center gap-sm">
            <div className="flex-1 h-px bg-outline-variant/40" />
            <div className="flex items-center gap-xs px-md py-xs rounded-full bg-primary/5 border border-primary/20">
              <ShieldCheck size={14} className="text-primary" />
              <span className="text-label-sm font-bold text-primary uppercase tracking-wider">Solo Administradores</span>
            </div>
            <div className="flex-1 h-px bg-outline-variant/40" />
          </div>
          {extraCuentaContent}
        </>
      )}
    </div>
  );

  const TabNotificaciones = () => (
    <div className="max-w-2xl space-y-lg">
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
        <div className="bg-surface-container-low px-lg py-md border-b border-outline-variant/30 flex items-center gap-sm">
          <Bell className="text-primary" size={20} />
          <div>
            <h3 className="text-title-lg font-bold text-on-surface">Preferencias de Notificaciones</h3>
            <p className="text-label-sm font-medium text-on-surface-variant">Elige qué alertas deseas recibir</p>
          </div>
        </div>
        <div className="p-lg space-y-md">
          {[
            { id: "notif-system", label: "Notificaciones del Sistema", desc: "Alertas sobre actividad general de la plataforma.", checked: notifSystem, onChange: setNotifSystem },
            { id: "notif-tasks",  label: "Tareas y Entregas",          desc: "Recordatorios de fechas límite y nuevas asignaciones.", checked: notifTasks,  onChange: setNotifTasks  },
            { id: "notif-msgs",   label: "Mensajes y Avisos",          desc: "Avisos publicados por docentes o administradores.",    checked: notifMessages, onChange: setNotifMessages },
          ].map(item => (
            <div key={item.id} className="flex items-start justify-between p-md bg-surface-container-low/30 border border-outline-variant/30 rounded-lg hover:border-primary/50 transition-colors">
              <div className="flex gap-md">
                <Bell className="text-on-surface-variant mt-0.5 shrink-0" size={20} />
                <div>
                  <p className="text-body-md font-bold text-on-surface">{item.label}</p>
                  <p className="text-body-md font-medium text-on-surface-variant">{item.desc}</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer mt-1 shrink-0">
                <input className="sr-only peer" type="checkbox" checked={item.checked} onChange={e => item.onChange(e.target.checked)} />
                <div className="w-11 h-6 bg-outline-variant rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
              </label>
            </div>
          ))}
        </div>
        <div className="px-lg pb-lg flex justify-end border-t border-outline-variant/30 pt-md">
          <button className="bg-primary text-on-primary font-bold text-label-md py-sm px-lg rounded-lg hover:bg-primary-container transition-colors active:scale-95">
            Guardar Preferencias
          </button>
        </div>
      </div>
    </div>
  );

  const TabSeguridad = () => (
    <div className="max-w-2xl space-y-lg">
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
        <div className="bg-surface-container-low px-lg py-md border-b border-outline-variant/30 flex items-center gap-sm">
          <ShieldCheck className="text-primary" size={20} />
          <div>
            <h3 className="text-title-lg font-bold text-on-surface">Privacidad y Seguridad</h3>
            <p className="text-label-sm font-medium text-on-surface-variant">Controla quién puede ver tu información</p>
          </div>
        </div>
        <div className="p-lg space-y-md">
          {/* Visibility */}
          <div className="flex items-start justify-between p-md bg-surface-container-low/30 border border-outline-variant/30 rounded-lg hover:border-primary/50 transition-colors">
            <div className="flex gap-md">
              <Eye className="text-on-surface-variant mt-1 shrink-0" size={20} />
              <div>
                <p className="text-body-md font-bold text-on-surface">Visibilidad del Perfil</p>
                <p className="text-body-md font-medium text-on-surface-variant">Define quién puede ver tu información de contacto en el directorio escolar.</p>
              </div>
            </div>
            <select value={visibility} onChange={e => setVisibility(e.target.value)}
              className="bg-surface border border-outline-variant text-on-surface font-bold text-label-md rounded-lg py-1 px-3 outline-none focus:ring-2 focus:ring-primary shrink-0 ml-md">
              <option value="public">Público</option>
              <option value="institution">Solo Institución</option>
              <option value="private">Privado</option>
            </select>
          </div>

          {/* Sessions info */}
          <div className="p-md bg-surface-container-low/30 border border-outline-variant/30 rounded-lg">
            <div className="flex gap-md">
              <Settings className="text-on-surface-variant mt-0.5 shrink-0" size={20} />
              <div className="flex-1">
                <p className="text-body-md font-bold text-on-surface mb-xs">Sesiones Activas</p>
                <p className="text-body-md font-medium text-on-surface-variant mb-md">Tu sesión actual es la única registrada en este dispositivo.</p>
                <div className="flex items-center gap-sm p-sm bg-primary/5 rounded-lg border border-primary/10">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                  <span className="text-label-sm font-bold text-on-surface">Este dispositivo — Sesión activa ahora</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="px-lg pb-lg flex justify-end border-t border-outline-variant/30 pt-md">
          <button className="bg-primary text-on-primary font-bold text-label-md py-sm px-lg rounded-lg hover:bg-primary-container transition-colors active:scale-95">
            Guardar Configuración
          </button>
        </div>
      </div>
    </div>
  );

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-lg">
      {/* Tab Bar */}
      <div className="flex items-end gap-0 border-b border-outline-variant">
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-lg pb-md pt-sm font-bold text-label-md transition-all relative outline-none ${
                active
                  ? "text-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {tab.label}
              {active && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {activeTab === "perfil"         && TabPerfil()}
        {activeTab === "cuenta"         && TabCuenta()}
        {activeTab === "notificaciones" && TabNotificaciones()}
        {activeTab === "seguridad"      && TabSeguridad()}
      </div>
    </div>
  );
}
