import { env } from '@/config/env';
import { logger } from '@/lib/logger';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export function emailEnabled(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

/**
 * Envia e-mail via Resend (https://resend.com). Sem RESEND_API_KEY configurada,
 * roda em modo stub (apenas loga) — útil em dev/teste. Para trocar de provedor
 * (SES, etc.), reimplemente apenas esta função.
 */
export async function sendEmail(msg: EmailMessage): Promise<void> {
  if (!env.RESEND_API_KEY) {
    logger.info({ to: msg.to, subject: msg.subject }, 'E-mail em modo stub (RESEND_API_KEY ausente)');
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      ...(msg.text ? { text: msg.text } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend respondeu ${res.status}: ${detail}`);
  }
  logger.info({ to: msg.to }, 'E-mail enviado');
}

/** Layout simples e reutilizável para e-mails transacionais. */
export function baseEmailLayout(opts: { heading: string; body: string; cta?: { label: string; url: string } }): string {
  const button = opts.cta
    ? `<a href="${opts.cta.url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${opts.cta.label}</a>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#2563eb">● CondoHub</div>
    <div style="padding:24px">
      <h1 style="font-size:18px;margin:0 0 12px">${opts.heading}</h1>
      <div style="font-size:14px;line-height:1.6;color:#334155">${opts.body}</div>
      ${button ? `<div style="margin-top:20px">${button}</div>` : ''}
    </div>
  </div></body></html>`;
}
