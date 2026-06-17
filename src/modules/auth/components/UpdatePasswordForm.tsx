"use client";

import { useState, useEffect } from "react";
import { Lock, ArrowRight, Loader2, AlertCircle, CheckCircle2, School } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Check if the user has a valid session (from the password reset link)
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setError("El enlace ha expirado o es inválido. Por favor, solicita uno nuevo.");
      }
    };
    checkSession();
  }, [supabase.auth]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;
      
      setSuccess(true);
      // Wait a moment before redirecting to let them see the success message
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Error al actualizar la contraseña");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-full max-w-[440px] bg-surface rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
      <div className="p-lg md:p-xl flex flex-col gap-xl">
        <div className="flex flex-col items-center text-center gap-sm">
          <div className="w-12 h-12 bg-primary-container rounded-lg flex items-center justify-center mb-sm shadow-sm">
            <Lock className="text-white w-7 h-7" />
          </div>
          <h1 className="text-headline-md font-bold text-on-surface">Nueva Contraseña</h1>
          <p className="text-body-md text-on-surface-variant max-w-[320px] mx-auto">
            Ingresa tu nueva contraseña para acceder a la plataforma.
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
            <h3 className="text-title-md font-bold">¡Contraseña actualizada!</h3>
            <p className="text-body-md text-green-700 mb-4">
              Tu contraseña ha sido cambiada exitosamente. Serás redirigido al inicio de sesión en unos segundos.
            </p>
            <Link href="/login" className="text-label-md font-bold text-primary hover:underline">
              Ir al inicio de sesión ahora
            </Link>
          </div>
        ) : (
          <form className="flex flex-col gap-lg" onSubmit={handleUpdatePassword}>
            <div className="flex flex-col gap-xs">
              <label className="text-label-md font-bold text-on-surface" htmlFor="password">
                Nueva contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-sm flex items-center pointer-events-none">
                  <Lock className="text-outline w-5 h-5" />
                </div>
                <input 
                  className="w-full pl-[40px] pr-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 outline-none" 
                  id="password" 
                  placeholder="••••••••" 
                  required 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                />
              </div>
            </div>

            <div className="flex flex-col gap-xs">
              <label className="text-label-md font-bold text-on-surface" htmlFor="confirm-password">
                Confirmar contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-sm flex items-center pointer-events-none">
                  <Lock className="text-outline w-5 h-5" />
                </div>
                <input 
                  className="w-full pl-[40px] pr-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 outline-none" 
                  id="confirm-password" 
                  placeholder="••••••••" 
                  required 
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                />
              </div>
            </div>
            
            <button 
              disabled={loading || error === "El enlace ha expirado o es inválido. Por favor, solicita uno nuevo."}
              className="w-full flex items-center justify-center gap-sm bg-primary-container text-white font-bold text-label-md rounded-lg py-sm px-lg transition-colors hover:bg-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100" 
              type="submit"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin w-5 h-5" />
                  <span>Actualizando...</span>
                </>
              ) : (
                <>
                  <span>Actualizar contraseña</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}
      </div>
      
      <div className="bg-surface-container-low px-lg py-md flex justify-center items-center gap-sm">
        <img src="/assets/logo.png" alt="Logo" className="w-12 h-12 object-contain" />
        <span className="text-title-lg font-bold text-primary">InfoTarea</span>
      </div>
    </main>
  );
}
