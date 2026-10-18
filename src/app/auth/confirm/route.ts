/**
 * Confirmación del enlace de recuperación de contraseña.
 *
 * El correo enviado por la plataforma apunta aquí con `token_hash` y `type`.
 *
 * Importante: el token es de un solo uso y los escáneres de correo (Gmail,
 * Outlook, antivirus) visitan los enlaces automáticamente. Por eso el `GET`
 * NO verifica nada: solo devuelve una página intermedia que envía el
 * formulario por `POST` desde el navegador real. Así el token no se consume
 * antes de que la persona lo use, y el enlace no "aparece vencido" al abrirlo.
 *
 * El `POST` verifica el token con GoTrue (queda una sesión de recuperación en
 * cookies) y redirige con `303` a la pantalla de nueva contraseña. Si el
 * enlace venció o fue alterado, se vuelve al formulario con un aviso.
 */

import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RECOVERY_UPDATE_PATH, safeInternalPath } from "@/shared/utils/passwordRecovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FAILURE_PATH = "/forgot-password?error=enlace";

function requestOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || url.host;
  const protocol = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  return `${protocol}://${host}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function confirmationPage(input: { tokenHash: string; type: string; next: string }): string {
  const tokenHash = escapeHtml(input.tokenHash);
  const type = escapeHtml(input.type);
  const next = escapeHtml(input.next);
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>InfoTarea · Confirmando tu enlace</title>
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8f9ff;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0d1c2e;padding:24px}
    .card{background:#ffffff;border:1px solid #e6eeff;border-radius:16px;padding:32px 28px;max-width:420px;width:100%;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.06)}
    .brand{margin:0;font-size:18px;font-weight:700;color:#005c55}
    .spinner{width:34px;height:34px;margin:16px auto 0;border:3px solid #d5f5f1;border-top-color:#005c55;border-radius:50%;animation:spin 1s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    p{margin:10px 0 0;font-size:14px;line-height:1.6;color:#3e4947}
    button{margin-top:18px;background:#005c55;color:#ffffff;border:0;border-radius:10px;padding:12px 22px;font-weight:700;font-size:14px;cursor:pointer}
  </style>
</head>
<body>
  <main class="card">
    <p class="brand">InfoTarea</p>
    <div class="spinner" aria-hidden="true"></div>
    <p>Confirmando tu enlace…</p>
    <form id="confirm-form" method="post" action="/auth/confirm">
      <input type="hidden" name="token_hash" value="${tokenHash}">
      <input type="hidden" name="type" value="${type}">
      <input type="hidden" name="next" value="${next}">
      <noscript><button type="submit">Continuar</button></noscript>
    </form>
  </main>
  <script>document.getElementById("confirm-form").submit();</script>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash") ?? "";
  const type = url.searchParams.get("type") ?? "";
  const next = safeInternalPath(url.searchParams.get("next"), RECOVERY_UPDATE_PATH);

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${requestOrigin(request)}${FAILURE_PATH}`, 303);
  }

  return new NextResponse(confirmationPage({ tokenHash, type, next }), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function POST(request: NextRequest) {
  const origin = requestOrigin(request);
  const failure = () => NextResponse.redirect(`${origin}${FAILURE_PATH}`, 303);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return failure();
  }

  const tokenHash = String(form.get("token_hash") ?? "");
  const type = String(form.get("type") ?? "");
  const next = safeInternalPath(String(form.get("next") ?? ""), RECOVERY_UPDATE_PATH);

  if (!tokenHash || !type) return failure();

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: type as EmailOtpType,
    token_hash: tokenHash,
  });

  if (error) return failure();
  return NextResponse.redirect(`${origin}${next}`, 303);
}
