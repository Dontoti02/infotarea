/**
 * Envío de la prueba del correo saliente (ítem 23).
 * Verifica credenciales SMTP reales y envía un mensaje al destinatario elegido.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSmtpConfigured, isValidEmail } from "@/shared/utils/prioritization";
import { appendEmailLogs, readEmailConfig } from "@/modules/smart/services/adminData";
import { sendTestEmail } from "@/modules/smart/services/emailService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role, email").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Acceso denegado: solo la dirección puede enviar la prueba." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const defaultTo = profile?.email || user.email || "";
  const to = typeof body?.to === "string" && body.to.trim() ? body.to.trim() : defaultTo;
  if (!isValidEmail(to)) {
    return NextResponse.json({ error: "Escribe un correo de destino válido para la prueba." }, { status: 400 });
  }

  let config;
  try {
    config = await readEmailConfig();
  } catch (configError) {
    return NextResponse.json(
      { error: configError instanceof Error ? configError.message : "No se pudo leer la configuración de correo." },
      { status: 503 },
    );
  }

  if (config.migrationPending) {
    return NextResponse.json(
      { error: "Falta aplicar la migración 20261018000000_iteracion_4_priorizacion_correo.sql en Supabase." },
      { status: 503 },
    );
  }
  if (!isSmtpConfigured(config.settings, Boolean(config.password))) {
    return NextResponse.json(
      { error: "Activa el correo y guarda el servidor, el remitente y la contraseña de aplicación antes de probar." },
      { status: 400 },
    );
  }

  const result = await sendTestEmail({ settings: config.settings, password: config.password }, to);
  await appendEmailLogs([{
    alertIds: [],
    toEmail: to,
    subject: "Prueba de correo saliente",
    kind: "test",
    status: result.ok ? "sent" : "failed",
    errorMessage: result.error ?? null,
    providerMessageId: result.messageId ?? null,
  }]).catch(() => undefined);

  if (!result.ok) {
    return NextResponse.json({ error: result.error || "No se pudo enviar el correo de prueba." }, { status: 502 });
  }
  return NextResponse.json({
    ok: true,
    messageId: result.messageId,
    message: `El correo de prueba se envió a ${to}.`,
  });
}
