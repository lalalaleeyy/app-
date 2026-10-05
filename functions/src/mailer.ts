import nodemailer, { Transporter } from 'nodemailer';
import { SENDER_NAME, SMTP_PASSWORD, SMTP_USER } from './config';

export interface OutgoingMail {
  to: { name: string; address: string };
  subject: string;
  html: string;
  text: string;
}

export interface MailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    // Gmail / Google Workspace SMTP over TLS. To switch provider (Resend, SendGrid, ...), only this
    // file needs to change: keep the `sendMail` signature below.
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: SMTP_USER.value(), pass: SMTP_PASSWORD.value() }
    });
  }
  return transporter;
}

/** Never throws: callers record the outcome in the outbox log instead. */
export async function sendMail(mail: OutgoingMail): Promise<MailResult> {
  try {
    const info = await getTransporter().sendMail({
      from: { name: SENDER_NAME, address: SMTP_USER.value() },
      to: { name: mail.to.name.replace(/[\r\n"]/g, ' '), address: mail.to.address },
      subject: mail.subject.replace(/[\r\n]+/g, ' '),
      html: mail.html,
      text: mail.text
    });
    const rejected = Array.isArray(info.rejected) ? info.rejected : [];
    if (rejected.length > 0) return { ok: false, error: 'The mail server rejected the recipient address.' };
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error('SMTP send failed:', err);
    transporter = null; // rebuild on next attempt in case credentials changed
    const message = err instanceof Error ? err.message : 'Unknown mail error';
    return { ok: false, error: message.slice(0, 300) };
  }
}
