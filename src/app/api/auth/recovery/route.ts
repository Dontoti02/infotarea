/**
 * Solicitud de recuperación de contraseña desde el inicio de sesión
 * (ítem 23 ampliado).
 *
 * Modo propio (recomendado): con `SUPABASE_SERVICE_ROLE_KEY` la plataforma
 * genera el token con GoTrue y envía el correo por la cuenta SMTP guardada en
 * `email_settings` (Gmail / Google Workspace). El enlace apunta a
 * `/auth/confirm`, que verifica el token y abre la pantalla de nueva contraseña.
 *
 * Modo de respaldo: sin clave de servicio, se delega en el correo estándar de
 * Supabase (`/auth/v1/recover`), que exige tener el SMTP configurado en el
 * panel del proyecto.
 *
 * Seguridad: la respuesta es siempre genérica (no revela si el correo existe),
 * hay control de abuso por correo y por solicitante, y nunca se registra el
 * token ni la contraseña.
 */

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { isSmtpConfigured } from "@/shared/utils/prioritization";
import {
  buildRecoveryConfirmUrl,
  normalizeRecoveryEmail,
  recoveryRateLimitExceeded,
  RECOVERY_GENERIC_MESSAGE,
  RECOVERY_LINK_MINUTES,
  RECOVERY_WINDOW_MINUTES,
} from "@/shared/utils/passwordRecovery";
import {
  appendEmailLogs,
  countRecentPasswordResetRequests,
  generateRecoveryToken,
  readEmailConfig,
  recordPasswordResetRequest,
  type RecoveryDelivery,
} from "@/modules/smart/services/adminData";
import { sendPasswordResetEmail } from "@/modules/smart/services/emailService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vafrsmzqzgfuamrrtyob.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_nZncHSR3P5rsiXETvcPCvQ_YpM3YJFi";

function requestOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || url.host;
  const protocol = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  return `${protocol}://${host}`;
}

/** Hash no reversible del solicitante para limitar el abuso sin guardar la IP. */
function requesterHash(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = (forwarded ? forwarded.split(",")[0] : request.headers.get("x-real-ip"))?.trim();
  if (!ip) return null;
  const salt = process.env.RECOVERY_IP_SALT || "infotarea-recovery";
  return createHash("sha256").update(`${salt}|${ip}`).digest("hex").slice(0, 32);
}

/** Respaldo: el correo estándar de Supabase (requiere SMTP del panel). */
async function sendSupabaseRecovery(email: string, origin: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(`${origin}/update-password`)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email }),
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = normalizeRecoveryEmail((body as { email?: unknown } | null)?.email);
  if (!email) {
    return NextResponse.json({ error: "Escribe un correo electrónico válido." }, { status: 400 });
  }

  const origin = requestOrigin(request);
  const requester = requesterHash(request);

  try {
    const counts = await countRecentPasswordResetRequests({
      email,
      requesterHash: requester,
      windowMinutes: RECOVERY_WINDOW_MINUTES,
    });
    if (recoveryRateLimitExceeded(counts)) {
      // Respuesta genérica: no se revela el límite ni se envía otro correo.
      return NextResponse.json(
        { ok: true, message: RECOVERY_GENERIC_MESSAGE },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
  } catch {
    // Si el control de abuso no está disponible, la recuperación continúa.
  }

  const token = await generateRecoveryToken(email);
  let deliveredVia: RecoveryDelivery = "skipped";
  let failure: string | null = null;

  if (token.ok) {
    const link = buildRecoveryConfirmUrl(origin, token.hashedToken);
    try {
      const config = await readEmailConfig();
      if (isSmtpConfigured(config.settings, Boolean(config.password))) {
        const result = await sendPasswordResetEmail(
          { settings: config.settings, password: config.password },
          { to: email, link, expiresMinutes: RECOVERY_LINK_MINUTES, accountEmail: email },
        );
        deliveredVia = "app_smtp";
        await appendEmailLogs([{
          alertIds: [],
          toEmail: email,
          subject: "InfoTarea · Restablece tu contraseña",
          kind: "password_reset",
          status: result.ok ? "sent" : "failed",
          errorMessage: result.error ?? null,
          providerMessageId: result.messageId ?? null,
        }]).catch(() => undefined);
        if (!result.ok) failure = result.error || "No se pudo enviar el correo de recuperación.";
      } else {
        deliveredVia = (await sendSupabaseRecovery(email, origin)) ? "supabase_auth" : "skipped";
      }
    } catch (error) {
      failure = error instanceof Error ? error.message : "No se pudo preparar el correo de recuperación.";
    }
  } else if (token.reason === "unavailable") {
    deliveredVia = (await sendSupabaseRecovery(email, origin)) ? "supabase_auth" : "skipped";
  } else if (token.reason === "error") {
    failure = token.message || "No se pudo generar el enlace de recuperación.";
  }
  // reason === "not_found": respuesta genérica sin enviar (no se revela nada).

  await recordPasswordResetRequest({ email, requesterHash: requester, deliveredVia }).catch(() => undefined);

  if (failure) {
    return NextResponse.json(
      {
        error: "No pudimos enviar el correo de recuperación. Inténtalo de nuevo en unos minutos o avisa a la dirección de la institución.",
        detail: failure,
      },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { ok: true, message: RECOVERY_GENERIC_MESSAGE },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
