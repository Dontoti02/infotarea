/**
 * API de configuración del correo saliente (ítem 23).
 * Solo la dirección puede leer o guardar la cuenta con la que la plataforma
 * envía credenciales, recuperación de contraseña y alertas de seguimiento.
 * La contraseña de aplicación nunca se devuelve: solo se informa si existe.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeStoredEmailSettings, validateEmailSettingsInput } from "@/shared/utils/prioritization";
import { readEmailPasswordPresence, writeEmailPassword } from "@/modules/smart/services/adminData";
import type { EmailSettingsResponse } from "@/modules/smart/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Acceso denegado: solo la dirección gestiona el correo saliente." }, { status: 403 }) };
  }
  return { supabase, user };
}

const MISSING_MIGRATION = "Falta aplicar la migración 20261018000000_iteracion_4_priorizacion_correo.sql en Supabase.";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  const { data, error } = await supabase.from("email_settings").select("*").eq("id", true).maybeSingle();
  if (error && error.code !== "42P01" && error.code !== "PGRST205") {
    return NextResponse.json({ error: `No se pudo leer la configuración de correo: ${error.message}` }, { status: 503 });
  }

  const presence = await readEmailPasswordPresence();
  const response: EmailSettingsResponse = {
    settings: normalizeStoredEmailSettings(data),
    hasPassword: presence.hasPassword,
    migrationPending: !data,
    backend: presence.available ? "elevated" : "session",
  };
  return NextResponse.json(response, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { supabase, user } = auth;

  const body = await request.json().catch(() => null);
  const validation = validateEmailSettingsInput(body);
  if (!validation.valid || !validation.settings) {
    return NextResponse.json({ error: "Revisa la configuración.", errors: validation.errors }, { status: 400 });
  }

  const presence = await readEmailPasswordPresence();
  let passwordSaved = presence.hasPassword;

  const { data, error } = await supabase
    .from("email_settings")
    .update({
      enabled: validation.settings.enabled,
      smtp_host: validation.settings.smtp_host,
      smtp_port: validation.settings.smtp_port,
      smtp_security: validation.settings.smtp_security,
      smtp_user: validation.settings.smtp_user,
      from_email: validation.settings.from_email,
      from_name: validation.settings.from_name,
      reply_to: validation.settings.reply_to,
      alert_config: validation.settings.alert_config,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", true)
    .select("*")
    .maybeSingle();

  if (error) {
    const pending = error.code === "42P01" || error.code === "PGRST205";
    return NextResponse.json(
      { error: pending ? MISSING_MIGRATION : `No se pudo guardar la configuración: ${error.message}` },
      { status: pending ? 503 : error.code === "42501" ? 403 : 503 },
    );
  }

  if (validation.passwordAction !== "keep") {
    try {
      await writeEmailPassword(validation.passwordAction === "clear" ? null : validation.password ?? null);
      passwordSaved = validation.passwordAction === "set";
    } catch (passwordError) {
      return NextResponse.json(
        {
          error: `La configuración se guardó, pero la contraseña de aplicación no: ${passwordError instanceof Error ? passwordError.message : "error desconocido"}`,
          settings: normalizeStoredEmailSettings(data),
          hasPassword: passwordSaved,
        },
        { status: 502 },
      );
    }
  }

  const response: EmailSettingsResponse = {
    settings: normalizeStoredEmailSettings(data),
    hasPassword: passwordSaved,
    backend: "elevated",
  };
  return NextResponse.json(response);
}
