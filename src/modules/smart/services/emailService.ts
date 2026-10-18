/**
 * Servicio de correo saliente (ítem 23).
 * Construye el transporte SMTP con la configuración administrada desde la
 * plataforma (Gmail / Google Workspace con contraseña de aplicación) y envía
 * la prueba de configuración y los resúmenes de alertas.
 *
 * Es server-only: se importa únicamente desde rutas API de Next.js.
 */

import nodemailer from "nodemailer";
import type { EmailDigest } from "@/shared/utils/prioritization";
import { smtpTransportOptions, type EmailSettingsDraft } from "@/shared/utils/prioritization";
import { renderAlertDigest, renderPasswordResetEmail, renderTestEmail } from "./emailTemplates";

export interface SmtpConfig {
  settings: EmailSettingsDraft;
  password: string | null;
}

export function buildTransport(config: SmtpConfig) {
  const options = smtpTransportOptions(config.settings, config.password);
  return nodemailer.createTransport({
    ...options,
    tls: { minVersion: "TLSv1.2" },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 25_000,
  });
}

export function resolveFromAddress(settings: Pick<EmailSettingsDraft, "from_email" | "from_name" | "smtp_user">): string {
  const address = (settings.from_email || settings.smtp_user || "").trim();
  const name = (settings.from_name || "").trim();
  return name ? `"${name.replace(/"/g, "'")}" <${address}>` : address;
}

function transportErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/invalid login|username and password not accepted|badcredentials/i.test(message)) {
    return "Credenciales SMTP rechazadas. Con Gmail usa una contraseña de aplicación vigente (requiere verificación en dos pasos).";
  }
  if (/ETIMEDOUT|timeout/i.test(message)) {
    return "Se agotó el tiempo de espera al conectar con el servidor SMTP. Verifica host y puerto.";
  }
  if (/ENOTFOUND|EAI_AGAIN/i.test(message)) {
    return "No se pudo resolver el servidor SMTP. Verifica el nombre del host.";
  }
  if (/ECONNREFUSED|ECONNECTION/i.test(message)) {
    return "El servidor SMTP rechazó la conexión. Verifica la seguridad (TLS/SSL) y el puerto.";
  }
  if (/self.signed|self signed|certificate/i.test(message)) {
    return "El certificado del servidor SMTP no pudo validarse.";
  }
  return message || "No se pudo enviar el correo.";
}

export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/** Verifica credenciales y envía el correo de prueba solicitado por la dirección. */
export async function sendTestEmail(config: SmtpConfig, to: string): Promise<SendResult> {
  const transporter = buildTransport(config);
  try {
    await transporter.verify();
    const rendered = renderTestEmail({ fromName: config.settings.from_name });
    const info = await transporter.sendMail({
      from: resolveFromAddress(config.settings),
      to,
      replyTo: config.settings.reply_to || undefined,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    return { ok: false, error: transportErrorMessage(error) };
  } finally {
    transporter.close();
  }
}

export interface DigestSendOutcome {
  digest: EmailDigest;
  result: SendResult;
}

/**
 * Envía el correo de recuperación de contraseña con el enlace propio.
 * Verifica las credenciales SMTP antes de enviar, igual que la prueba.
 */
export async function sendPasswordResetEmail(
  config: SmtpConfig,
  options: { to: string; link: string; expiresMinutes?: number; accountEmail?: string | null },
): Promise<SendResult> {
  const transporter = buildTransport(config);
  try {
    await transporter.verify();
    const rendered = renderPasswordResetEmail({
      link: options.link,
      fromName: config.settings.from_name,
      accountEmail: options.accountEmail ?? null,
      expiresMinutes: options.expiresMinutes,
    });
    const info = await transporter.sendMail({
      from: resolveFromAddress(config.settings),
      to: options.to,
      replyTo: config.settings.reply_to || undefined,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    return { ok: false, error: transportErrorMessage(error) };
  } finally {
    transporter.close();
  }
}

/** Envía un resumen por destinatario reutilizando una única conexión SMTP. */
export async function sendDigestEmails(config: SmtpConfig, digests: EmailDigest[]): Promise<DigestSendOutcome[]> {
  if (digests.length === 0) return [];
  const transporter = buildTransport(config);
  const outcomes: DigestSendOutcome[] = [];
  try {
    for (const digest of digests) {
      try {
        const rendered = renderAlertDigest(digest, { fromName: config.settings.from_name });
        const info = await transporter.sendMail({
          from: resolveFromAddress(config.settings),
          to: digest.to,
          replyTo: config.settings.reply_to || undefined,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        });
        outcomes.push({ digest, result: { ok: true, messageId: info.messageId } });
      } catch (error) {
        outcomes.push({ digest, result: { ok: false, error: transportErrorMessage(error) } });
      }
    }
  } finally {
    transporter.close();
  }
  return outcomes;
}
