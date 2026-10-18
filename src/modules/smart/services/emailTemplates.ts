/**
 * Plantillas de correo del seguimiento académico (ítem 23).
 * HTML y texto plano, sin dependencias, con escape para datos de usuarios.
 */

import type { AlertSeverity, EmailDigest } from "@/shared/utils/prioritization";
import { SEVERITY_LABELS } from "@/shared/utils/prioritization";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export const SEVERITY_COLORS: Record<AlertSeverity, { text: string; background: string }> = {
  critica: { text: "#93000a", background: "#ffdad6" },
  alta: { text: "#8a4b00", background: "#ffddb8" },
  media: { text: "#005c55", background: "#d5f5f1" },
  informativa: { text: "#1c2744", background: "#e6eeff" },
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function institutionName(fromName?: string | null): string {
  const value = (fromName || "").trim();
  return value || "InfoTarea";
}

export function renderAlertDigest(
  digest: EmailDigest,
  options: { fromName?: string | null; generatedAt?: Date } = {},
): RenderedEmail {
  const institution = institutionName(options.fromName);
  const generatedAt = options.generatedAt || new Date();
  const rows = digest.alerts.map(alert => `
    <tr>
      <td style="padding:14px 16px;border-bottom:1px solid #e6eeff;vertical-align:top;">
        <span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.02em;background:${SEVERITY_COLORS[alert.severity].background};color:${SEVERITY_COLORS[alert.severity].text};">
          ${escapeHtml(SEVERITY_LABELS[alert.severity])}
        </span>
        <p style="margin:8px 0 2px;font-size:14px;font-weight:700;color:#0d1c2e;">${escapeHtml(alert.title)}</p>
        <p style="margin:0;font-size:13px;line-height:1.5;color:#3e4947;">${escapeHtml(alert.message)}</p>
      </td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:24px;background:#f8f9ff;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6eeff;">
    <div style="background:#005c55;padding:20px 24px;">
      <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a3faef;">${escapeHtml(institution)}</p>
      <h1 style="margin:6px 0 0;font-size:20px;color:#ffffff;">Alertas de seguimiento académico</h1>
    </div>
    <div style="padding:20px 24px 4px;">
      <p style="margin:0;font-size:14px;line-height:1.6;color:#0d1c2e;">
        Hola, este resumen reúne ${digest.alerts.length === 1 ? "una alerta" : `${digest.alerts.length} alertas`} generadas automáticamente por el componente inteligente de InfoTarea.
      </p>
    </div>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin-top:12px;">${rows}</table>
    <div style="padding:16px 24px 24px;">
      <p style="margin:0;font-size:12px;line-height:1.6;color:#6e7977;">
        Fecha del análisis: ${escapeHtml(generatedAt.toLocaleString("es-ES"))}.<br/>
        Ingresa a la plataforma para revisar el detalle, calificar entregas o actualizar el seguimiento.
      </p>
    </div>
  </div>
</body>
</html>`;

  const text = [
    `${institution} · Alertas de seguimiento académico`,
    "",
    ...digest.alerts.map(alert => `- [${SEVERITY_LABELS[alert.severity]}] ${alert.title}\n  ${alert.message}`),
    "",
    `Fecha del análisis: ${generatedAt.toISOString()}`,
    "Ingresa a la plataforma para revisar el detalle.",
  ].join("\n");

  return { subject: digest.subject, html, text };
}

/**
 * Correo de recuperación de contraseña (ítem 23 ampliado).
 * El enlace es propio (`/auth/confirm`) y verifica el token de un solo uso.
 */
export function renderPasswordResetEmail(
  options: {
    link: string;
    fromName?: string | null;
    accountEmail?: string | null;
    expiresMinutes?: number;
  },
): RenderedEmail {
  const institution = institutionName(options.fromName);
  const expires = options.expiresMinutes && options.expiresMinutes > 0 ? options.expiresMinutes : 60;
  const expiryLabel = expires === 60 ? "60 minutos (1 hora)" : `${expires} minutos`;
  const subject = `InfoTarea · Restablece tu contraseña (${institution})`;
  const html = `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:24px;background:#f8f9ff;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6eeff;">
    <div style="background:#005c55;padding:20px 24px;">
      <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a3faef;">${escapeHtml(institution)}</p>
      <h1 style="margin:6px 0 0;font-size:20px;color:#ffffff;">Restablece tu contraseña</h1>
    </div>
    <div style="padding:20px 24px 24px;">
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#0d1c2e;">
        Recibimos una solicitud para restablecer la contraseña de${options.accountEmail ? ` <strong>${escapeHtml(options.accountEmail)}</strong>` : " tu cuenta"} en InfoTarea.
      </p>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#0d1c2e;">
        Pulsa el botón para elegir una nueva contraseña. El enlace es personal y vence en ${expiryLabel}.
      </p>
      <p style="margin:0 0 20px;">
        <a href="${escapeHtml(options.link)}" style="display:inline-block;background:#005c55;color:#ffffff;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px;text-decoration:none;">
          Elegir nueva contraseña
        </a>
      </p>
      <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:#3e4947;">
        Si el botón no funciona, copia y pega este enlace en tu navegador:
      </p>
      <p style="margin:0 0 18px;font-size:12px;line-height:1.6;color:#005c55;word-break:break-all;">${escapeHtml(options.link)}</p>
      <p style="margin:0;font-size:12px;line-height:1.6;color:#6e7977;">
        Si no solicitaste este cambio, ignora el mensaje: tu contraseña actual seguirá funcionando.
      </p>
    </div>
  </div>
</body>
</html>`;
  const text = [
    `${institution} · Restablece tu contraseña`,
    "",
    `Recibimos una solicitud para restablecer la contraseña${options.accountEmail ? ` de ${options.accountEmail}` : ""} en InfoTarea.`,
    `Abre este enlace para elegir una nueva (vence en ${expiryLabel}):`,
    options.link,
    "",
    "Si no solicitaste este cambio, ignora el mensaje: tu contraseña actual seguirá funcionando.",
  ].join("\n");
  return { subject, html, text };
}

export function renderTestEmail(
  options: { fromName?: string | null; to?: string | null; generatedAt?: Date } = {},
): RenderedEmail {
  const institution = institutionName(options.fromName);
  const generatedAt = options.generatedAt || new Date();
  const subject = `InfoTarea · Prueba de correo saliente (${institution})`;
  const html = `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:24px;background:#f8f9ff;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6eeff;">
    <div style="background:#005c55;padding:20px 24px;">
      <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a3faef;">InfoTarea</p>
      <h1 style="margin:6px 0 0;font-size:20px;color:#ffffff;">Prueba de correo saliente</h1>
    </div>
    <div style="padding:20px 24px 24px;">
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#0d1c2e;">
        Si estás leyendo este mensaje, la cuenta <strong>${escapeHtml(institution)}</strong> quedó bien configurada y puede enviar credenciales, recuperación de contraseña y alertas de seguimiento.
      </p>
      <p style="margin:0;font-size:12px;color:#6e7977;">Enviado el ${escapeHtml(generatedAt.toLocaleString("es-ES"))}.</p>
    </div>
  </div>
</body>
</html>`;
  const text = [
    "InfoTarea · Prueba de correo saliente",
    "",
    `Si estás leyendo este mensaje, la cuenta ${institution} quedó bien configurada.`,
    `Enviado el ${generatedAt.toISOString()}.`,
  ].join("\n");
  return { subject, html, text };
}
