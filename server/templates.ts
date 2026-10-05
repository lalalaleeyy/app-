import { Contract, Signatory } from '../src/types';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

function escapeHtml(unsafe: string): string {
  return String(unsafe ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const h = escapeHtml;

function shell(accent: string, title: string, tagline: string, body: string, padding = 28): string {
  return `
<div style="font-family:${FONT};max-width:580px;margin:0 auto;color:#060b1e;line-height:1.6;">
  <div style="background-color:#060b1e;padding:24px;text-align:center;border-radius:8px 8px 0 0;border-bottom:3px solid ${accent};">
    <h2 style="color:#ffffff;margin:0;font-size:18px;letter-spacing:0.5px;">${title}</h2>
    <p style="color:${accent};margin:4px 0 0 0;font-size:11px;font-weight:700;letter-spacing:1px;">${tagline}</p>
  </div>
  <div style="padding:${padding}px;background:#ffffff;border:1px solid #e1e7f5;border-top:none;border-radius:0 0 8px 8px;">
    ${body}
  </div>
</div>`;
}

function button(link: string, label: string): string {
  return `
<div style="text-align:center;margin:28px 0;">
  <a href="${h(link)}" style="background-color:#ff1e27;color:#ffffff;padding:13px 28px;font-size:13px;font-weight:700;text-decoration:none;border-radius:6px;display:inline-block;">${label}</a>
</div>`;
}

export function invitationEmail(contract: Contract, recipient: Signatory, link: string): RenderedEmail {
  const subject = `Action Required: Please sign ${contract.title} (${contract.contractNumber})`;
  const html = shell(
    '#ff1e27',
    'IGNITE VISION DOCUMENTATION DASHBOARD',
    'SECURE ELECTRONIC SIGNING PORTAL',
    `
<p style="font-size:15px;font-weight:600;margin-top:0;">Dear ${h(recipient.name)},</p>
<p style="font-size:13px;color:#334155;">You have been requested to review and electronically sign the following document (${contract.partyCount}-Party Agreement):</p>
<div style="background:#f8faff;border:1px solid #e1e7f5;border-left:4px solid #ff1e27;padding:16px;border-radius:6px;margin:20px 0;">
  <div style="font-size:14px;font-weight:700;">${h(contract.title)}</div>
  <div style="font-size:12px;color:#64748b;margin-top:4px;font-family:monospace;">Ref: ${h(contract.contractNumber)} · Effective: ${h(contract.contractDate)}</div>
  <div style="font-size:12px;color:#64748b;margin-top:2px;">Assigned Role: <strong>${h(recipient.role)}</strong> (Party ${recipient.partyIndex})</div>
</div>
<p style="font-size:13px;color:#334155;">Please click the secure button below to review the terms and add your electronic signature.</p>
${button(link, 'REVIEW &amp; SIGN DOCUMENT')}
<p style="font-size:11px;color:#94a3b8;margin-top:28px;border-top:1px solid #f1f5f9;padding-top:14px;">
  If the button does not work, copy and paste this URL into your browser:<br />
  <a href="${h(link)}" style="color:#ff1e27;word-break:break-all;">${h(link)}</a><br /><br />
  This link is personal to you. Please do not forward it.
</p>`
  );
  const text = `Dear ${recipient.name},\n\nYou have been requested to sign "${contract.title}" (${contract.contractNumber}) as ${recipient.role}.\n\nReview and sign: ${link}\n\nThis link is personal to you. Please do not forward it.`;
  return { subject, html, text };
}

export function reminderEmail(contract: Contract, recipient: Signatory, link: string): RenderedEmail {
  const subject = `Reminder: Please sign ${contract.title} (${contract.contractNumber})`;
  const html = shell(
    '#f59e0b',
    'IGNITE VISION DOCUMENTATION DASHBOARD',
    'SIGNATURE REMINDER NOTIFICATION',
    `
<p style="font-size:14px;font-weight:600;margin-top:0;">Dear ${h(recipient.name)},</p>
<p style="font-size:13px;color:#334155;">This is a friendly reminder that your electronic signature is pending on <strong>${h(contract.title)}</strong> (${h(contract.contractNumber)}).</p>
${button(link, 'PROCEED TO SIGN')}
<p style="font-size:11px;color:#94a3b8;">Or open: <a href="${h(link)}" style="color:#ff1e27;word-break:break-all;">${h(link)}</a></p>`,
    24
  );
  const text = `Dear ${recipient.name},\n\nReminder: your signature is pending on "${contract.title}" (${contract.contractNumber}).\n\nSign here: ${link}`;
  return { subject, html, text };
}

export function completionEmail(contract: Contract, recipient: Signatory): RenderedEmail {
  const subject = `Completed: ${contract.title} (${contract.contractNumber}) is fully executed`;
  const rows = contract.parties
    .map(
      p =>
        `<div style="margin-bottom:6px;">✓ <strong>Party ${p.partyIndex} (${h(p.name)}):</strong> Signed at ${h(
          p.signature?.timestamp.slice(0, 16).replace('T', ' ') || contract.contractDate
        )} UTC (${h(p.role)})</div>`
    )
    .join('');
  const html = shell(
    '#10b981',
    'DOCUMENT FULLY EXECUTED &amp; SEALED',
    'CERTIFIED AUDIT TRAIL RECORDED',
    `
<p style="font-size:15px;font-weight:600;margin-top:0;">Hello ${h(recipient.name)},</p>
<p style="font-size:13px;color:#334155;">All designated signatories (${contract.partyCount} Parties) have completed their electronic signatures for <strong>${h(contract.title)}</strong> (${h(contract.contractNumber)}).</p>
<div style="background:#ecfdf5;border:1px solid #a7f3d0;padding:16px;border-radius:6px;margin:20px 0;font-size:12px;color:#065f46;">
  ${rows}
  <div style="margin-top:10px;font-family:monospace;font-size:11px;color:#047857;word-break:break-all;">Final Hash: ${h(contract.finalPdfHash ?? '')}</div>
</div>
<p style="font-size:13px;color:#334155;">A certified copy with the Certificate of Completion is archived in the Ignite Vision Documentation Dashboard.</p>`
  );
  const text = `Hello ${recipient.name},\n\nAll ${contract.partyCount} parties have signed "${contract.title}" (${contract.contractNumber}).\nFinal hash: ${contract.finalPdfHash}`;
  return { subject, html, text };
}
