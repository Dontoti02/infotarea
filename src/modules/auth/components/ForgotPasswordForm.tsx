"use client";

import { useEffect, useState } from "react";
import { Mail, ArrowRight, ArrowLeft, LockKeyhole, Loader2, AlertCircle, MailCheck, RefreshCw } from "lucide-react";
import Link from "next/link";
import { RECOVERY_GENERIC_MESSAGE } from "@/shared/utils/passwordRecovery";

const RESEND_COOLDOWN_SECONDS = 60;

export function ForgotPasswordForm({ linkError = false }: { linkError?: boolean }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    linkError ? "El enlace de recuperación venció o ya fue utilizado. Solicita uno nuevo." : null,
  );
  const [success, setSuccess] = useState(false);
  const [serverMessage, setServerMessage] = useState(RECOVERY_GENERIC_MESSAGE);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!success || secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [success, secondsLeft]);

  const requestRecovery = async (targetEmail: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail.trim() }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo solicitar la recuperación. Inténtalo de nuevo.");
      }

      if (payload?.message) setServerMessage(payload.message);
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo solicitar la recuperación. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || secondsLeft > 0) return;
    await requestRecovery(email);
  };

  const handleResend = () => {
    if (loading || secondsLeft > 0) return;
    void requestRecovery(email);
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
            Escribe tu correo y te enviaremos un enlace para crear una nueva contraseña.
          </p>
        </div>

        {error && (
          <div className="bg-error/10 border border-error/20 text-error p-4 rounded-xl flex items-center gap-3">
            <AlertCircle size={20} className="shrink-0" />
            <span className="font-label-md text-label-md">{error}</span>
          </div>
        )}

        {success ? (
          <div className="flex flex-col gap-md">
            <div className="bg-green-50 border border-green-200 text-green-800 p-6 rounded-xl flex flex-col items-center gap-3 text-center">
              <MailCheck size={32} className="text-green-600 mb-2" />
              <h3 className="text-title-md font-bold">Revisa tu correo</h3>
              <p className="text-body-md text-green-700">{serverMessage}</p>
              <p className="text-label-sm text-green-700/80">
                El enlace es personal y de un solo uso: vence en 60 minutos (1 hora).
              </p>
              <p className="text-label-sm text-green-700/80">
                Si pides otro enlace, usa siempre el más reciente: los anteriores dejan de funcionar.
              </p>
            </div>

            <div className="flex flex-col gap-xs">
              <button
                className="w-full flex items-center justify-center gap-sm bg-surface-container-lowest border border-outline-variant text-on-surface font-bold text-label-md rounded-lg py-sm px-lg transition-colors hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
                disabled={loading || secondsLeft > 0}
                onClick={handleResend}
                type="button"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin w-5 h-5" />
                    <span>Reenviando...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={18} />
                    <span>Reenviar enlace</span>
                  </>
                )}
              </button>
              {secondsLeft > 0 && (
                <p className="text-label-sm text-on-surface-variant text-center">
                  Podrás reenviar en {secondsLeft} s.
                </p>
              )}
            </div>
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
                  autoComplete="email"
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
