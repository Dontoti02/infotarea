/**
 * Iteración Nº 4 — Reglas puras de la recuperación de contraseña.
 *
 * Sin dependencias de React, Supabase ni red: valida el correo, construye el
 * enlace de confirmación, protege contra redirecciones abiertas, evalúa la
 * fortaleza de la nueva contraseña y controla el límite de solicitudes.
 */

import { isValidEmail } from "./prioritization";

/** Ventana de control de abuso (minutos). */
export const RECOVERY_WINDOW_MINUTES = 60;
/** Máximo de enlaces solicitados por correo dentro de la ventana. */
export const MAX_RECOVERY_REQUESTS_PER_EMAIL = 3;
/** Máximo de enlaces solicitados por solicitante (IP) dentro de la ventana. */
export const MAX_RECOVERY_REQUESTS_PER_REQUESTER = 10;
/** Vigencia informada del enlace (GoTrue expira antes de 60 minutos). */
export const RECOVERY_LINK_MINUTES = 60;
/** Longitud mínima exigida por la pantalla de nueva contraseña. */
export const MIN_RECOVERY_PASSWORD_LENGTH = 8;
/** Ruta propia que verifica el token antes de pedir la nueva contraseña. */
export const RECOVERY_CONFIRM_PATH = "/auth/confirm";
/** Pantalla final del flujo. */
export const RECOVERY_UPDATE_PATH = "/update-password";

export function normalizeRecoveryEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return isValidEmail(email) ? email : null;
}

/**
 * Solo acepta rutas internas: evita redirecciones abiertas si alguien
 * manipula el parámetro `next` del enlace de confirmación.
 */
export function safeInternalPath(value: unknown, fallback: string = RECOVERY_UPDATE_PATH): string {
  if (typeof value !== "string") return fallback;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(path)) return fallback;
  return path;
}

/** Construye el enlace propio que verifica el token y establece la sesión. */
export function buildRecoveryConfirmUrl(
  origin: string,
  tokenHash: string,
  next: string = RECOVERY_UPDATE_PATH,
): string {
  const base = origin.replace(/\/+$/, "");
  const params = new URLSearchParams({
    token_hash: tokenHash,
    type: "recovery",
    next: safeInternalPath(next),
  });
  return `${base}${RECOVERY_CONFIRM_PATH}?${params.toString()}`;
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  hints: string[];
}

const STRENGTH_LABELS = ["Muy débil", "Débil", "Aceptable", "Buena", "Fuerte"] as const;

/** Fortaleza orientativa de la nueva contraseña (solo para la interfaz). */
export function passwordStrength(value: string): PasswordStrength {
  const hints: string[] = [];
  let score = 0;
  const length = value.length;

  if (length >= MIN_RECOVERY_PASSWORD_LENGTH) score += 1;
  else hints.push(`Usa al menos ${MIN_RECOVERY_PASSWORD_LENGTH} caracteres.`);

  if (length >= 12) score += 1;
  else if (length > 0) hints.push("Cuanto más larga, mejor (12+ caracteres).");

  const varied = /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value);
  if (varied) score += 1;
  else hints.push("Combina mayúsculas, minúsculas y números.");

  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  else hints.push("Agregar un símbolo la hace más segura.");

  if (value.length > 0 && /^(.)\1+$/.test(value)) {
    score = 0;
    hints.unshift("Evita repetir el mismo carácter.");
  }

  const safeScore = Math.min(4, Math.max(0, score)) as PasswordStrength["score"];
  return { score: safeScore, label: STRENGTH_LABELS[safeScore], hints };
}

export interface RecoveryRequestCounts {
  byEmail: number;
  byRequester: number;
}

/** Indica si la solicitud debe omitirse silenciosamente (control de abuso). */
export function recoveryRateLimitExceeded(counts: RecoveryRequestCounts): boolean {
  return counts.byEmail >= MAX_RECOVERY_REQUESTS_PER_EMAIL
    || counts.byRequester >= MAX_RECOVERY_REQUESTS_PER_REQUESTER;
}

export const RECOVERY_GENERIC_MESSAGE =
  "Si el correo pertenece a una cuenta de InfoTarea, recibirás un enlace para restablecer la contraseña en unos minutos. Revisa también la carpeta de spam.";
