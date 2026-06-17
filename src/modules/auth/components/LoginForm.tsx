"use client";

import React, { useState, useMemo } from "react";
import { Mail, Lock, LogIn, Loader2, AlertCircle, School } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // Get user profile to determine role and redirect
      let { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      // If profile is missing (PGRST116), create it dynamically using metadata
      if (profileError && profileError.code === "PGRST116") {
        console.warn("Profile not found. Auto-creating profile for user:", data.user.id);
        const fullName = data.user.user_metadata?.full_name || "Nuevo Usuario";
        const role = data.user.user_metadata?.role || "student";
        const userEmail = data.user.email;

        const { data: newProfile, error: insertError } = await supabase
          .from("profiles")
          .insert({
            id: data.user.id,
            full_name: fullName,
            role: role,
            // Do not insert email here since it is missing in the database schema
          })
          .select("role")
          .single();

        if (insertError) {
          console.error("Error creating profile automatically:", insertError);
          throw new Error("No se pudo configurar el perfil de su cuenta. Por favor, contacte al administrador.");
        }

        profile = newProfile;
        profileError = null;
      }

      if (profileError) {
        console.error("Error fetching profile details:", profileError.message, profileError.code);
        throw new Error(profileError.message || "Error al obtener el perfil de usuario");
      }

      // Redirect based on role
      const roleRedirects: Record<string, string> = {
        admin: "/admin/dashboard",
        teacher: "/teacher/dashboard",
        student: "/student/dashboard",
      };

      if (!profile) {
        throw new Error("No se pudo encontrar el perfil de su cuenta.");
      }

      router.push(roleRedirects[profile.role] || "/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Credenciales inválidas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-3xl p-8 md:p-10 w-full max-w-[440px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-outline-variant animate-fade-in relative overflow-hidden">
      {/* Subtle top accent line */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-primary-container to-secondary"></div>
      
      <div className="text-center mb-10">
        <img src="/assets/logo.png" alt="InfoTarea Logo" className="mx-auto mb-6 h-28 w-auto object-contain" />
        <p className="font-body-md text-body-md text-on-surface-variant uppercase tracking-widest font-semibold">Sistema de Gestión Académica</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-6">
        {error && (
          <div className="bg-error/10 border border-error/20 text-error p-4 rounded-xl flex items-center gap-3 animate-pulse">
            <AlertCircle size={20} />
            <span className="font-label-md text-label-md">{error}</span>
          </div>
        )}

        <div className="space-y-2">
          <label className="font-label-md text-label-md text-on-surface" htmlFor="email">Correo electrónico</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-outline-variant group-focus-within:text-primary transition-colors">
              <Mail size={20} />
            </div>
            <input 
              className="block w-full pl-12 pr-4 py-3.5 font-body-md text-body-md bg-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-on-surface placeholder:text-outline-variant outline-none transition-all shadow-sm" 
              id="email" 
              placeholder="usuario@institucion.edu" 
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
              className="block w-full pl-12 pr-4 py-3.5 font-body-md text-body-md bg-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-on-surface placeholder:text-outline-variant outline-none transition-all shadow-sm" 
              id="password" 
              placeholder="••••••••" 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center">
            <input 
              className="h-4.5 w-4.5 text-primary focus:ring-primary border-outline-variant rounded cursor-pointer transition-all" 
              id="remember-me" 
              type="checkbox"
            />
            <label className="ml-3 block font-body-md text-body-md text-on-surface-variant cursor-pointer hover:text-on-surface transition-colors" htmlFor="remember-me">
              Recordarme
            </label>
          </div>
          <Link href="/forgot-password" className="font-label-md text-label-md text-primary hover:text-primary-container transition-colors font-bold">
            Olvidé mi contraseña
          </Link>
        </div>

        <div className="pt-4">
          <button 
            disabled={loading}
            className="w-full flex justify-center items-center gap-3 py-4 px-6 border border-transparent rounded-xl shadow-xl font-bold font-label-md text-label-md text-on-primary bg-primary-container hover:bg-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100" 
            type="submit"
          >
            {loading ? <Loader2 className="animate-spin" size={22} /> : <LogIn size={22} />}
            <span>{loading ? "Iniciando sesión..." : "Ingresar al Sistema"}</span>
          </button>
        </div>
      </form>

      <div className="mt-12 text-center border-t border-outline-variant/30 pt-6">
        <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-[0.2em] font-bold">
          © 2026 InfoTarea
        </p>
      </div>
    </div>
  );
}
