"use client";

import React, { useState } from "react";
import { Mail, Lock, User, Phone, Users, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function RegisterParentForm() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("padre");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register-parent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          relationship,
          email,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al crear la cuenta");
      }

      // Auto sign in parent immediately
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      setSuccess(true);

      setTimeout(() => {
        router.push("/parent/onboarding");
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Error al procesar el registro");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-surface-container-lowest rounded-3xl p-8 md:p-10 w-full max-w-[460px] shadow-2xl border border-outline-variant animate-fade-in text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 text-primary mb-6 animate-bounce">
          <CheckCircle2 size={48} />
        </div>
        <h2 className="font-headline-md text-headline-md text-on-surface mb-2 font-bold">¡Bienvenido a InfoTarea!</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mb-6">
          Tu cuenta de padre de familia ha sido creada. Te redirigiremos para vincular a tu(s) hijo(s)...
        </p>
        <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
          <div className="w-full h-full bg-primary animate-[loading_2s_linear]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-3xl p-8 md:p-10 w-full max-w-[480px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-outline-variant animate-fade-in relative overflow-hidden">
      {/* Decorative Top Accent */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-primary-container to-secondary"></div>

      <div className="text-center mb-8">
        <img src="/assets/logo.png" alt="InfoTarea" className="mx-auto mb-4 h-24 w-auto object-contain" />
        <h1 className="font-headline-md text-2xl font-bold text-on-surface mb-1">Registro de Padres</h1>
        <p className="font-body-md text-sm text-on-surface-variant font-medium">
          Accede a notas, tareas, asistencia y chat con los docentes
        </p>
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        {error && (
          <div className="bg-error/10 border border-error/20 text-error p-3.5 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle size={20} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Nombre Completo */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant" htmlFor="fullName">
            Nombre Completo
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline-variant group-focus-within:text-primary transition-colors">
              <User size={18} />
            </div>
            <input
              id="fullName"
              type="text"
              required
              placeholder="Ej: Roberto Quispe Huamán"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-surface border border-outline-variant rounded-xl text-sm text-on-surface placeholder:text-outline-variant focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Parentesco y Teléfono en dos columnas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant" htmlFor="relationship">
              Parentesco
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline-variant group-focus-within:text-primary transition-colors">
                <Users size={18} />
              </div>
              <select
                id="relationship"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full pl-10 pr-3 py-3 bg-surface border border-outline-variant rounded-xl text-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all shadow-sm appearance-none cursor-pointer"
              >
                <option value="padre">Padre</option>
                <option value="madre">Madre</option>
                <option value="tutor">Tutor / Apoderado</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant" htmlFor="phone">
              Teléfono / Celular
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline-variant group-focus-within:text-primary transition-colors">
                <Phone size={18} />
              </div>
              <input
                id="phone"
                type="tel"
                placeholder="987 654 321"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-surface border border-outline-variant rounded-xl text-sm text-on-surface placeholder:text-outline-variant focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Correo Electrónico */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant" htmlFor="email">
            Correo Electrónico
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline-variant group-focus-within:text-primary transition-colors">
              <Mail size={18} />
            </div>
            <input
              id="email"
              type="email"
              required
              placeholder="padre@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-surface border border-outline-variant rounded-xl text-sm text-on-surface placeholder:text-outline-variant focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Contraseña */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant" htmlFor="password">
            Contraseña
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline-variant group-focus-within:text-primary transition-colors">
              <Lock size={18} />
            </div>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-11 py-3 bg-surface border border-outline-variant rounded-xl text-sm text-on-surface placeholder:text-outline-variant focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all shadow-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline-variant hover:text-on-surface focus:outline-none transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Confirmar Contraseña */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant" htmlFor="confirmPassword">
            Confirmar Contraseña
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline-variant group-focus-within:text-primary transition-colors">
              <Lock size={18} />
            </div>
            <input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              required
              placeholder="Repite tu contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-surface border border-outline-variant rounded-xl text-sm text-on-surface placeholder:text-outline-variant focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Botón de Enviar */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 py-3.5 px-6 rounded-xl shadow-lg font-bold text-sm text-on-primary bg-primary-container hover:bg-primary focus:ring-2 focus:ring-primary transition-all active:scale-[0.98] disabled:opacity-70 cursor-pointer"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={20} />}
            <span>{loading ? "Creando cuenta..." : "Crear Cuenta de Padre"}</span>
          </button>
        </div>
      </form>

      <div className="mt-6 text-center border-t border-outline-variant/40 pt-4">
        <p className="text-sm text-on-surface-variant">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-primary font-bold hover:underline">
            Inicia sesión aquí
          </Link>
        </p>
      </div>
    </div>
  );
}
