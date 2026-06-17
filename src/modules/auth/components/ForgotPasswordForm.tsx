"use client";

import { useState } from "react";
import { Mail, ArrowRight, ArrowLeft, LockKeyhole, School, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (resetError) throw resetError;
      
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Error al solicitar la recuperación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-full max-w-[440px] bg-surface rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
      <div className="p-lg md:p-xl flex flex-col gap-xl">
        <div className="flex flex-col items-center text-center gap-sm">
          <div className="w-12 h-12 bg-primary-container rounded-lg flex items-center justify-center mb-sm shadow-sm">
            <LockKeyhole className="text-white w-7 h-7" />
          </div>
          <h1 className="text-headline-md font-bold text-on-surface">Recuperar Contraseña</h1>
          <p className="text-body-md text-on-surface-variant max-w-[320px] mx-auto">
            Ingresa tu correo institucional para recibir un enlace de recuperación.
          </p>
        </div>

        {error && (
          <div className="bg-error/10 border border-error/20 text-error p-4 rounded-xl flex items-center gap-3">
            <AlertCircle size={20} className="shrink-0" />
            <span className="font-label-md text-label-md">{error}</span>
          </div>
        )}

        {success ? (
          <div className="bg-green-50 border border-green-200 text-green-800 p-6 rounded-xl flex flex-col items-center gap-3 text-center">
            <CheckCircle2 size={32} className="text-green-600 mb-2" />
            <h3 className="text-title-md font-bold">¡Correo enviado!</h3>
            <p className="text-body-md text-green-700">
              Revisa tu bandeja de entrada (y la carpeta de spam). Te hemos enviado un enlace para que puedas establecer una nueva contraseña.
            </p>
          </div>
        ) : (
          <form className="flex flex-col gap-lg" onSubmit={handleResetPassword}>
            <div className="flex flex-col gap-xs">
              <label className="text-label-md font-bold text-on-surface" htmlFor="email">
                Correo electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-sm flex items-center pointer-events-none">
                  <Mail className="text-outline w-5 h-5" />
                </div>
                <input 
                  className="w-full pl-[40px] pr-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 outline-none" 
                  id="email" 
                  placeholder="ejemplo@institucion.edu" 
                  required 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            
            <button 
              disabled={loading}
              className="w-full flex items-center justify-center gap-sm bg-primary-container text-white font-bold text-label-md rounded-lg py-sm px-lg transition-colors hover:bg-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100" 
              type="submit"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin w-5 h-5" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <span>Enviar enlace</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}

        <div className="pt-sm border-t border-outline-variant/50 flex justify-center">
          <Link 
            className="inline-flex items-center gap-xs text-label-md font-bold text-primary hover:text-primary-container transition-colors group" 
            href="/login"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span>Volver al inicio de sesión</span>
          </Link>
        </div>
      </div>
      
      <div className="bg-surface-container-low px-lg py-md flex justify-center items-center gap-sm">
        <img src="/assets/logo.png" alt="Logo" className="w-12 h-12 object-contain" />
        <span className="text-title-lg font-bold text-primary">InfoTarea</span>
      </div>
    </main>
  );
}
