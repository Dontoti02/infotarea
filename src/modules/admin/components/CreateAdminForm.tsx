"use client";

import React, { useState } from "react";
import {
  ShieldCheck, UserPlus, Mail, Lock, User,
  Loader2, CheckCircle2, AlertCircle, Eye, EyeOff
} from "lucide-react";

export function CreateAdminForm() {
  const [fullName, setFullName]         = useState("");
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [loading, setLoading]           = useState(false);
  const [message, setMessage]           = useState<{ type: "success" | "error"; text: string } | null>(null);

  const getPasswordStrength = (pwd: string): { label: string; color: string; width: string } => {
    if (pwd.length === 0) return { label: "", color: "", width: "0%" };
    if (pwd.length < 6)   return { label: "Muy débil", color: "#ba1a1a", width: "20%" };
    if (pwd.length < 8)   return { label: "Débil",     color: "#e85d04", width: "40%" };
    if (pwd.length < 10)  return { label: "Media",     color: "#f59e0b", width: "60%" };
    const hasUpper  = /[A-Z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    const hasSymbol = /[^A-Za-z0-9]/.test(pwd);
    const extras = (hasUpper ? 1 : 0) + (hasNumber ? 1 : 0) + (hasSymbol ? 1 : 0);
    if (extras >= 2) return { label: "Fuerte",    color: "#005c55", width: "100%" };
    return              { label: "Buena",     color: "#006e2d", width: "80%"  };
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!fullName.trim()) {
      setMessage({ type: "error", text: "El nombre completo es obligatorio." });
      return;
    }
    if (!email.trim()) {
      setMessage({ type: "error", text: "El correo electrónico es obligatorio." });
      return;
    }
    if (password.length < 6) {
      setMessage({ type: "error", text: "La contraseña debe tener al menos 6 caracteres." });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Las contraseñas no coinciden." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, email, password, role: "admin" }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Error al crear la cuenta." });
      } else {
        setMessage({
          type: "success",
          text: `✅ Cuenta de administrador creada exitosamente para "${fullName}" (${email}).`,
        });
        setFullName("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
      }
    } catch (err: any) {
      setMessage({ type: "error", text: "Error de red: " + err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
      {/* Header */}
      <div className="bg-surface-container-low px-lg py-md border-b border-outline-variant/30 flex items-center gap-sm">
        <ShieldCheck className="text-primary" size={20} />
        <div>
          <h3 className="text-title-lg font-bold text-on-surface">Crear Cuenta de Administrador</h3>
          <p className="text-label-sm font-medium text-on-surface-variant">
            Los administradores tienen acceso completo al sistema
          </p>
        </div>
      </div>

      <div className="p-lg">
        {/* Warning banner */}
        <div className="mb-lg flex items-start gap-sm p-md rounded-xl bg-error-container/40 border border-error/20">
          <AlertCircle className="text-error shrink-0 mt-0.5" size={18} />
          <p className="text-label-sm font-medium text-on-error-container">
            <span className="font-bold">Precaución:</span> Las cuentas de administrador tienen acceso total a la gestión de usuarios, cursos y configuración del sistema. Crea estas cuentas solo para personal de confianza.
          </p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-lg p-4 rounded-xl flex items-start gap-3 font-medium text-label-md ${
            message.type === "success"
              ? "bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]"
              : "bg-error-container text-on-error-container border border-error/20"
          }`}>
            {message.type === "success"
              ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              : <AlertCircle size={18} className="mt-0.5 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-md">
          {/* Full name */}
          <div>
            <label className="block text-label-md font-bold text-on-surface mb-xs" htmlFor="admin-fullname">
              Nombre completo <span className="text-error">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline-variant">
                <User size={18} />
              </div>
              <input
                id="admin-fullname"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej. María González"
                className="w-full pl-10 bg-surface border border-outline-variant rounded-lg p-sm text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-label-md font-bold text-on-surface mb-xs" htmlFor="admin-email">
              Correo electrónico <span className="text-error">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline-variant">
                <Mail size={18} />
              </div>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@institucion.edu"
                className="w-full pl-10 bg-surface border border-outline-variant rounded-lg p-sm text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-label-md font-bold text-on-surface mb-xs" htmlFor="admin-password">
              Contraseña <span className="text-error">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline-variant">
                <Lock size={18} />
              </div>
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 bg-surface border border-outline-variant rounded-lg p-sm text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline-variant hover:text-on-surface transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {/* Strength bar */}
            {password.length > 0 && (
              <div className="mt-xs">
                <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: strength.width, backgroundColor: strength.color }}
                  />
                </div>
                <p className="text-label-sm font-bold mt-1" style={{ color: strength.color }}>
                  {strength.label}
                </p>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-label-md font-bold text-on-surface mb-xs" htmlFor="admin-confirm-password">
              Confirmar contraseña <span className="text-error">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline-variant">
                <Lock size={18} />
              </div>
              <input
                id="admin-confirm-password"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full pl-10 pr-10 bg-surface border rounded-lg p-sm text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all ${
                  confirmPassword && password !== confirmPassword
                    ? "border-error focus:ring-error"
                    : "border-outline-variant"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline-variant hover:text-on-surface transition-colors"
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="text-label-sm font-bold text-error mt-xs">Las contraseñas no coinciden.</p>
            )}
          </div>

          {/* Role badge (fixed to admin) */}
          <div className="flex items-center gap-sm p-sm rounded-lg bg-primary/5 border border-primary/20">
            <ShieldCheck size={18} className="text-primary shrink-0" />
            <div>
              <p className="text-label-md font-bold text-on-surface">Rol: Administrador</p>
              <p className="text-label-sm font-medium text-on-surface-variant">Este formulario crea cuentas exclusivamente de tipo admin</p>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-sm border-t border-outline-variant/30">
            <button
              type="submit"
              disabled={loading}
              className="bg-primary text-on-primary font-bold text-label-md py-sm px-lg rounded-lg hover:bg-primary-container transition-colors disabled:opacity-50 flex items-center gap-2 active:scale-95"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              {loading ? "Creando cuenta..." : "Crear Administrador"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
