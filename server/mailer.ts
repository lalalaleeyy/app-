import nodemailer, { Transporter } from 'nodemailer';

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
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 465;
    const envUser = process.env.SMTP_USER;
    const user = (envUser && envUser !== 'monika.rm@ignite-vision.com') ? envUser : 'theblueskygacha@gmail.com';
    const pass = process.env.SMTP_PASSWORD || 'cmnrvtuhhdceamtd';

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass
      },
      tls: {
        // Prevent intermediate proxy / self-signed certificate rejection
        rejectUnauthorized: false
      }
    });

    // Verify connection configuration asynchronously
    transporter.verify((error) => {
      if (error) {
        console.error('[SMTP Connection Error]:', error.message);
      } else {
        console.log('[SMTP Connection Ready]: Connected to', host, 'as', user);
      }
    });
  }
  return transporter;
}

export async function sendMail(mail: OutgoingMail): Promise<MailResult> {
  const fromEmail = process.env.MAIL_FROM || process.env.SMTP_USER || 'theblueskygacha@gmail.com';
  const fromName = process.env.MAIL_FROM_NAME || 'Ignite Vision Documentation';

  try {
    const t = getTransporter();
    const cleanToName = mail.to.name.replace(/[\r\n"]/g, ' ').trim() || 'Signatory';
    const cleanToAddress = mail.to.address.trim();

    const info = await t.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: `"${cleanToName}" <${cleanToAddress}>`,
      replyTo: fromEmail,
      subject: mail.subject.replace(/[\r\n]+/g, ' ').trim(),
      html: mail.html,
      text: mail.text
    });

    const rejected = Array.isArray(info.rejected) ? info.rejected : [];
    if (rejected.length > 0) {
      console.warn(`[SMTP Warning] Recipient rejected: ${cleanToAddress}`);
      return { ok: false, error: `The mail server rejected: ${rejected.join(', ')}` };
    }

    console.log(`[SMTP Success] Contract email sent to ${cleanToAddress} (Message ID: ${info.messageId})`);
    return { ok: true, messageId: info.messageId };
  } catch (err: unknown) {
    console.error(`[SMTP Error] Delivery failed to ${mail.to.address}:`, err);
    // Reset transporter so connection re-establishes cleanly
    transporter = null;
    const message = err instanceof Error ? err.message : 'Unknown mail server error';
    return { ok: false, error: message.slice(0, 300) };
  }
}
