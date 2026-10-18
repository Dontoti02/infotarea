"use client";

import { useEffect, useMemo, useState } from "react";
import { Lock, ArrowRight, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff, Link2Off, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { translateErrorMessage } from "@/shared/utils/error-translator";
import { MIN_RECOVERY_PASSWORD_LENGTH, passwordStrength } from "@/shared/utils/passwordRecovery";
import Link from "next/link";

const STRENGTH_BAR_COLORS = ["bg-error", "bg-error", "bg-amber-500", "bg-primary-container", "bg-emerald-600"];
const STRENGTH_TEXT_COLORS = ["text-error", "text-error", "text-amber-600", "text-primary-container", "text-emerald-600"];

export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [linkExpired, setLinkExpired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return;
        if (!data.user) {
          setLinkExpired(true);
        } else {
          setAccountEmail(data.user.email ?? null);
        }
        setChecking(false);
      })
      .catch(() => {
        if (!active) return;
        setLinkExpired(true);
        setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [supabase]);

  const strength = passwordStrength(password);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_RECOVERY_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_RECOVERY_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      // Cierra la sesión de recuperación para que ingrese con la nueva clave.
      await supabase.auth.signOut().catch(() => undefined);
      setSuccess(true);
      window.setTimeout(() => {
        router.push("/login?actualizada=1");
      }, 3000);
    } catch (err) {
      setError(translateErrorMessage(err));
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
            {accountEmail ? (
              <>
                Define la nueva contraseña de <strong className="text-on-surface">{accountEmail}</strong>.
              </>
            ) : (
              "Ingresa tu nueva contraseña para acceder a la plataforma."
            )}
          </p>
        </div>

        {checking && (
          <div className="flex items-center justify-center gap-sm text-on-surface-variant py-md">
            <Loader2 className="animate-spin w-5 h-5" />
            <span className="font-label-md text-label-md">Verificando el enlace...</span>
          </div>
        )}

        {!checking && linkExpired && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-6 rounded-xl flex flex-col items-center gap-3 text-center">
            <Link2Off size={32} className="text-amber-600 mb-1" />
            <h3 className="text-title-md font-bold">El enlace ya no es válido</h3>
            <p className="text-body-md text-amber-700">
              Venció o ya fue utilizado. Solicita uno nuevo y úsalo dentro de la hora siguiente.
            </p>
            <Link
              href="/forgot-password"
              className="inline-flex items-center gap-xs text-label-md font-bold text-primary hover:underline"
            >
              Solicitar un nuevo enlace
              <ArrowRight size={16} />
            </Link>
          </div>
        )}

        {!checking && !linkExpired && error && (
          <div className="bg-error/10 border border-error/20 text-error p-4 rounded-xl flex items-center gap-3">
            <AlertCircle size={20} className="shrink-0" />
            <span className="font-label-md text-label-md">{error}</span>
          </div>
        )}

        {!checking && !linkExpired && success && (
          <div className="bg-green-50 border border-green-200 text-green-800 p-6 rounded-xl flex flex-col items-center gap-3 text-center">
            <CheckCircle2 size={32} className="text-green-600 mb-2" />
            <h3 className="text-title-md font-bold">¡Contraseña actualizada!</h3>
            <p className="text-body-md text-green-700 mb-4">
              Ya puedes iniciar sesión con tu nueva contraseña. Te llevaremos al inicio de sesión en unos segundos.
            </p>
            <Link href="/login?actualizada=1" className="text-label-md font-bold text-primary hover:underline">
              Ir al inicio de sesión ahora
            </Link>
          </div>
        )}

        {!checking && !linkExpired && !success && (
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
                  className="w-full pl-[40px] pr-12 py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 outline-none"
                  id="password"
                  placeholder="••••••••"
                  required
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={MIN_RECOVERY_PASSWORD_LENGTH}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-sm flex items-center text-outline hover:text-on-surface focus:outline-none transition-colors"
                  aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              <div className="flex items-center gap-sm pt-xs">
                <div className="flex gap-1 flex-1">
                  {[1, 2, 3, 4].map((level) => (
                    <span
                      key={level}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        password.length > 0 && strength.score >= level ? STRENGTH_BAR_COLORS[strength.score] : "bg-outline-variant/50"
                      }`}
                    />
                  ))}
                </div>
                {password.length > 0 && (
                  <span className={`text-label-sm font-bold ${STRENGTH_TEXT_COLORS[strength.score]}`}>{strength.label}</span>
                )}
              </div>
              {password.length > 0 && strength.hints.length > 0 && strength.score < 4 && (
                <p className="text-label-sm text-on-surface-variant">{strength.hints[0]}</p>
              )}
            </div>

            <div className="flex flex-col gap-xs">
              <label className="text-label-md font-bold text-on-surface" htmlFor="confirm-password">
                Confirmar contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-sm flex items-center pointer-events-none">
                  <ShieldCheck className="text-outline w-5 h-5" />
                </div>
                <input
                  className="w-full pl-[40px] pr-12 py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 outline-none"
                  id="confirm-password"
                  placeholder="••••••••"
                  required
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={MIN_RECOVERY_PASSWORD_LENGTH}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-sm flex items-center text-outline hover:text-on-surface focus:outline-none transition-colors"
                  aria-label={showConfirmPassword ? "Ocultar contraseña" : "Ver contraseña"}
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {passwordsMatch && (
                <p className="text-label-sm text-emerald-600 font-bold flex items-center gap-xs">
                  <CheckCircle2 size={14} /> Las contraseñas coinciden
                </p>
              )}
              {passwordsMismatch && (
                <p className="text-label-sm text-error font-bold flex items-center gap-xs">
                  <AlertCircle size={14} /> Las contraseñas todavía no coinciden
                </p>
              )}
            </div>

            <button
              disabled={loading}
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
