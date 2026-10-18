/**
 * Ejecución del motor de alertas inteligentes (ítems 21–23).
 *
 * Autorización doble:
 *   - Sesión de un administrador (botón "Ejecutar alertas ahora").
 *   - Token de automatización (`Authorization: Bearer …`) con las variables
 *     ALERTS_CRON_SECRET o CRON_SECRET, para cron/servicios programados.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AdminDataError } from "@/modules/smart/services/adminData";
import { runAlertSweep } from "@/modules/smart/services/alertEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cronSecret(): string | null {
  return process.env.ALERTS_CRON_SECRET || process.env.CRON_SECRET || null;
}

async function authorized(request: Request): Promise<{ ok: true; via: "admin" | "cron" } | { ok: false; response: NextResponse }> {
  const secret = cronSecret();
  const header = request.headers.get("authorization") || "";
  if (secret && header === `Bearer ${secret}`) return { ok: true, via: "cron" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "Acceso denegado: solo la dirección ejecuta las alertas." }, { status: 403 }) };
  }
  return { ok: true, via: "admin" };
}

export async function POST(request: Request) {
  const auth = await authorized(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await runAlertSweep();
    return NextResponse.json(
      { ok: true, via: auth.via, result },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof AdminDataError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "No se pudieron generar las alertas.";
    const pending = /relation .* does not exist|42P01|could not find the table|PGRST205/i.test(message);
    return NextResponse.json(
      { error: pending ? "Falta aplicar la migración 20261018000000_iteracion_4_priorizacion_correo.sql en Supabase." : message },
      { status: pending ? 503 : 500 },
    );
  }
}

/** Vercel Cron invoca la ruta con GET; la autorización es idéntica. */
export async function GET(request: Request) {
  return POST(request);
}
