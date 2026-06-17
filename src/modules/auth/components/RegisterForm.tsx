"use client";

import React, { useState } from "react";
import { Mail, Lock, User, UserPlus, Loader2, AlertCircle, School, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Register with metadata so the trigger sets the role correctly
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: 'admin', // Force admin role for this special registration
          },
        },
      });

      if (authError) throw authError;

      if (data.user) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      }
    } catch (err: any) {
      setError(err.message || "Error al crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-surface-container-lowest rounded-3xl p-8 md:p-10 w-full max-w-[440px] shadow-2xl border border-outline-variant animate-fade-in text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-secondary/10 text-secondary mb-6">
          <CheckCircle2 size={48} />
        </div>
        <h2 className="font-headline-md text-headline-md text-on-surface mb-2">¡Cuenta Creada!</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mb-6">
          Tu cuenta administrativa ha sido registrada con éxito. Redirigiendo al login...
        </p>
        <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
          <div className="w-full h-full bg-secondary animate-[loading_3s_linear]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-3xl p-8 md:p-10 w-full max-w-[440px] shadow-2xl border border-outline-variant animate-fade-in relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-primary-container to-secondary"></div>
      
      <div className="text-center mb-8">
        <img src="/assets/logo.png" alt="Logo" className="mx-auto mb-4 h-28 w-auto object-contain" />
        <h1 className="font-headline-md text-headline-md text-on-surface mb-1">Registro Admin</h1>
        <p className="font-body-md text-body-md text-on-surface-variant font-medium">Crea una cuenta administrativa maestra</p>
      </div>

      <form onSubmit={handleRegister} className="space-y-5">
        {error && (
          <div className="bg-error/10 border border-error/20 text-error p-4 rounded-xl flex items-center gap-3">
            <AlertCircle size={20} />
            <span className="font-label-md text-label-md">{error}</span>
          </div>
        )}

        <div className="space-y-2">
          <label className="font-label-md text-label-md text-on-surface" htmlFor="fullName">Nombre Completo</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-outline-variant group-focus-within:text-primary transition-colors">
              <User size={20} />
            </div>
            <input 
              className="block w-full pl-12 pr-4 py-3.5 font-body-md text-body-md bg-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-on-surface outline-none transition-all" 
              id="fullName" 
              placeholder="Ej: Administrador Maestro" 
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="font-label-md text-label-md text-on-surface" htmlFor="email">Correo electrónico</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-outline-variant group-focus-within:text-primary transition-colors">
              <Mail size={20} />
            </div>
            <input 
              className="block w-full pl-12 pr-4 py-3.5 font-body-md text-body-md bg-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-on-surface outline-none transition-all" 
              id="email" 
              placeholder="admin@infotarea.com" 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="font-label-md text-label-md text-on-surface" htmlFor="password">Contraseña</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-outline-variant group-focus-within:text-primary transition-colors">
              <Lock size={20} />
            </div>
            <input 
              className="block w-full pl-12 pr-4 py-3.5 font-body-md text-body-md bg-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-on-surface outline-none transition-all" 
              id="password" 
              placeholder="Min. 6 caracteres" 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
        </div>

        <div className="pt-4">
          <button 
            disabled={loading}
            className="w-full flex justify-center items-center gap-3 py-4 px-6 border border-transparent rounded-xl shadow-xl font-bold font-label-md text-label-md text-on-primary bg-primary-container hover:bg-primary transition-all active:scale-[0.98] disabled:opacity-70" 
            type="submit"
          >
            {loading ? <Loader2 className="animate-spin" size={22} /> : <UserPlus size={22} />}
            <span>{loading ? "Creando cuenta..." : "Registrar Administrador"}</span>
          </button>
        </div>
      </form>

      <div className="mt-8 text-center">
        <Link href="/login" className="font-label-md text-label-md text-primary hover:underline font-bold">
          ¿Ya tienes cuenta? Inicia sesión
        </Link>
      </div>
    </div>
  );
}
