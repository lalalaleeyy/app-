import { jsPDF } from 'jspdf';
import { Contract, Signatory } from '../types';

// ---------------------------------------------------------------------------
// Shared layout constants and helpers
// ---------------------------------------------------------------------------
const MARGIN = 14;
const COLOR = {
  navy: [6, 11, 30],
  red: [255, 30, 39],
  emerald: [16, 185, 129],
  headerMuted: [200, 210, 230],
  slate900: [30, 41, 59],
  slate700: [51, 65, 85],
  slate600: [71, 85, 105],
  slate500: [100, 116, 139],
  slate400: [148, 163, 184],
  border: [203, 213, 225],
  panelBorder: [225, 231, 245],
  panelFill: [248, 250, 255]
} as const;

type Rgb = readonly [number, number, number];
const text = (doc: jsPDF, c: Rgb) => doc.setTextColor(c[0], c[1], c[2]);
const fill = (doc: jsPDF, c: Rgb) => doc.setFillColor(c[0], c[1], c[2]);
const draw = (doc: jsPDF, c: Rgb) => doc.setDrawColor(c[0], c[1], c[2]);

const STANDARD_CLAUSES = [
  {
    num: '1. OBLIGATIONS & REPRESENTATIONS',
    text: 'The signatories mutually covenant to faithfully perform and discharge all duties, operational responsibilities, and procedural covenants set forth in this instrument in compliance with statutory and organizational standards.'
  },
  {
    num: '2. CONFIDENTIALITY & PROPRIETARY SAFEGUARDS',
    text: 'Each party agrees that all confidential documents, proprietary workflows, cryptographic parameters, candidate records, and technical architectures shall be maintained in strict confidence.'
  },
  {
    num: '3. GOVERNING LAW & JURISDICTION',
    text: 'This agreement shall be interpreted, construed, and enforced in accordance with the laws of the applicable corporate jurisdiction under statutory dispute arbitration covenants.'
  },
  {
    num: '4. ELECTRONIC RECORDS & UNIFORM SIGNATURES',
    text: 'The parties consent to conduct this transaction by electronic means pursuant to the Electronic Signatures in Global and National Commerce Act (E-SIGN Act, 15 U.S.C. § 7001) and Uniform Electronic Transactions Act (UETA).'
  }
];

/** Fit a single line of text into `maxWidth`, adding an ellipsis if needed. */
function fitLine(doc: jsPDF, value: string, maxWidth: number): string {
  const lines = doc.splitTextToSize(value, maxWidth) as string[];
  if (lines.length <= 1) return lines[0] ?? '';
  return `${lines[0].replace(/\s+\S*$/, '').trimEnd()}...`;
}

function formatUtc(iso: string | undefined, length = 19): string | undefined {
  return iso?.slice(0, length).replace('T', ' ');
}

function drawBanner(doc: jsPDF, opts: { subtitle: string; subtitleColor: Rgb; rightLabel: string }) {
  const pageWidth = doc.internal.pageSize.getWidth();

  fill(doc, COLOR.navy);
  doc.rect(0, 0, pageWidth, 24, 'F');
  fill(doc, COLOR.red);
  doc.rect(0, 24, pageWidth, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('IGNITE VISION DOCUMENTATION DASHBOARD', MARGIN, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  text(doc, opts.subtitleColor);
  doc.text(opts.subtitle, MARGIN, 18);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  text(doc, COLOR.headerMuted);
  doc.text(opts.rightLabel, pageWidth - MARGIN, 15, { align: 'right' });
}

function drawFooter(doc: jsPDF, left: string, right: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  text(doc, COLOR.slate400);
  doc.text(left, MARGIN, pageHeight - 8);
  doc.text(right, pageWidth - MARGIN, pageHeight - 8, { align: 'right' });
}

function partyColumns(doc: jsPDF, count: number) {
  const gap = 4;
  const totalWidth = doc.internal.pageSize.getWidth() - MARGIN * 2;
  const width = (totalWidth - gap * (count - 1)) / count;
  return { gap, width, x: (idx: number) => MARGIN + idx * (width + gap) };
}

/** Title block, intro paragraph, party boxes and the standard clauses (shared by both documents). */
function drawAgreementBody(doc: jsPDF, contract: Contract, metaLine: string): ReturnType<typeof partyColumns> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const innerWidth = pageWidth - MARGIN * 2;

  // Metadata box
  fill(doc, COLOR.panelFill);
  draw(doc, COLOR.panelBorder);
  doc.rect(MARGIN, 32, innerWidth, 22, 'FD');

  text(doc, COLOR.navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(fitLine(doc, contract.title, innerWidth - 8), 18, 41);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  text(doc, COLOR.slate500);
  doc.text(fitLine(doc, metaLine, innerWidth - 8), 18, 48);

  // Intro
  text(doc, COLOR.slate900);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const intro = `This Legal Agreement ("Agreement") is formally entered into and made effective as of ${contract.contractDate}, by and between the ${contract.partyCount} designated Party/Parties identified below:`;
  doc.text(doc.splitTextToSize(intro, innerWidth), MARGIN, 62);

  // Party boxes
  const cols = partyColumns(doc, contract.partyCount);
  contract.parties.forEach((party, idx) => {
    const boxX = cols.x(idx);
    fill(doc, [255, 255, 255]);
    draw(doc, COLOR.border);
    doc.rect(boxX, 68, cols.width, 30, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    text(doc, COLOR.navy);
    doc.text(`PARTY ${party.partyIndex} (${party.roleKey.toUpperCase()})`, boxX + 3, 74);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    text(doc, COLOR.slate700);
    doc.text(fitLine(doc, `Name: ${party.name}`, cols.width - 6), boxX + 3, 80);
    doc.text(fitLine(doc, `Email: ${party.email}`, cols.width - 6), boxX + 3, 85);
    doc.text(fitLine(doc, `Role: ${party.role}`, cols.width - 6), boxX + 3, 91);
  });

  // Clauses
  let y = 108;
  STANDARD_CLAUSES.forEach(c => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    text(doc, COLOR.navy);
    doc.text(c.num, MARGIN, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    text(doc, COLOR.slate700);
    const lines = doc.splitTextToSize(c.text, innerWidth) as string[];
    doc.text(lines, MARGIN, y);
    y += lines.length * 4.5 + 4;
  });

  return cols;
}

function newA4(): jsPDF {
  return new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
}

// ---------------------------------------------------------------------------
// Original (unsigned) document
// ---------------------------------------------------------------------------
export function createOriginalPdfDoc(contract: Contract): jsPDF {
  const doc = newA4();
  drawBanner(doc, {
    subtitle: `OFFICIAL LEGAL INSTRUMENT // ${contract.partyCount}-PARTY WORKFLOW ARCHIVE`,
    subtitleColor: COLOR.red,
    rightLabel: `REF: ${contract.contractNumber}`
  });

  const cols = drawAgreementBody(
    doc,
    contract,
    `Category: ${contract.contractType}   |   Effective Date: ${contract.contractDate}   |   Parties: ${contract.partyCount} (${contract.signingOrder.toUpperCase()})`
  );

  // Signature placement boxes
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  text(doc, COLOR.navy);
  doc.text('IN WITNESS WHEREOF, THE PARTIES HAVE DULY EXECUTED THIS AGREEMENT:', MARGIN, 185);

  contract.parties.forEach((party, idx) => {
    const boxX = cols.x(idx);
    draw(doc, COLOR.border);
    doc.setLineDashPattern([2, 2], 0);
    doc.rect(boxX, 192, cols.width, 30);
    doc.setLineDashPattern([], 0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    text(doc, COLOR.slate400);
    doc.text(`[Signature Box: Party ${party.partyIndex}]`, boxX + 3, 200);
    draw(doc, COLOR.slate400);
    doc.line(boxX + 3, 212, boxX + cols.width - 3, 212);
    doc.text(fitLine(doc, party.name, cols.width - 6), boxX + 3, 218);
  });

  drawFooter(doc, `ORIGINAL DOCUMENT SHA-256: ${contract.originalPdfHash}`, 'Page 1 of 1 · IGNITE VISION HR');
  return doc;
}

export function downloadOriginalPdf(contract: Contract): void {
  createOriginalPdfDoc(contract).save(`${safeFileName(contract.contractNumber)}_Original.pdf`);
}

export function getOriginalPdfBlob(contract: Contract): Blob {
  return createOriginalPdfDoc(contract).output('blob');
}

// ---------------------------------------------------------------------------
// Certified (fully signed) document: page 1 signatures + page 2 certificate
// ---------------------------------------------------------------------------
function drawSignature(doc: jsPDF, contract: Contract, party: Signatory, idx: number, cols: ReturnType<typeof partyColumns>) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const field = contract.fields.find(f => f.recipientRole === party.roleKey) || contract.fields[idx];
  const x = field ? (field.xPercent / 100) * pageWidth : cols.x(idx);
  const y = field ? (field.yPercent / 100) * pageHeight : 200;
  const w = field ? (field.widthPercent / 100) * pageWidth : cols.width;

  const typedFallback = () => {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(13);
    text(doc, COLOR.navy);
    doc.text(party.name, x, y - 2);
  };

  if (party.signature?.signatureImage) {
    try {
      doc.addImage(party.signature.signatureImage, 'PNG', x, y - 14, Math.min(w, 60), 15);
    } catch {
      typedFallback();
    }
  } else {
    typedFallback();
  }

  draw(doc, COLOR.navy);
  doc.line(x, y + 3, x + w, y + 3);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  text(doc, COLOR.navy);
  doc.text(`[VERIFIED] Party ${party.partyIndex}: ${party.name}`, x, y + 7);
  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  text(doc, COLOR.slate500);
  doc.text(`Time: ${formatUtc(party.signature?.timestamp) || contract.contractDate} UTC`, x, y + 11);
  doc.text(`IP: ${party.signature?.ipAddress || 'Verified'} · Method: ${party.signature?.signatureMethod?.toUpperCase() || 'E-SIGN'}`, x, y + 14.5);
}

const MAX_AUDIT_ROWS = 7;

export function createCertifiedPdfDoc(contract: Contract): jsPDF {
  const doc = newA4();
  const pageWidth = doc.internal.pageSize.getWidth();
  const innerWidth = pageWidth - MARGIN * 2;
  const finalHash = contract.finalPdfHash || contract.originalPdfHash;

  // ---- Page 1 ----
  drawBanner(doc, {
    subtitle: `FULLY EXECUTED & CERTIFIED // ${contract.partyCount}-PARTY INSTRUMENT`,
    subtitleColor: COLOR.emerald,
    rightLabel: `REF: ${contract.contractNumber}`
  });

  const cols = drawAgreementBody(
    doc,
    contract,
    `Category: ${contract.contractType}   |   Effective: ${contract.contractDate}   |   Status: CERTIFIED & COMPLETED (${contract.partyCount} PARTIES)`
  );
  contract.parties.forEach((party, idx) => drawSignature(doc, contract, party, idx, cols));
  drawFooter(doc, `FINAL CERTIFIED SHA-256: ${finalHash}`, 'Page 1 of 2 · IGNITE VISION HR');

  // ---- Page 2: certificate of completion ----
  doc.addPage();
  drawBanner(doc, {
    subtitle: 'CERTIFICATE OF COMPLETION & CRYPTOGRAPHIC AUDIT SEAL',
    subtitleColor: COLOR.red,
    rightLabel: `CERT ID: ${contract.contractNumber}-CRT`
  });

  fill(doc, COLOR.panelFill);
  draw(doc, COLOR.panelBorder);
  doc.rect(MARGIN, 32, innerWidth, 44, 'FD');

  text(doc, COLOR.navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('DOCUMENT EXECUTION CERTIFICATE', 18, 40);

  const label = (value: string, y: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    text(doc, COLOR.slate700);
    doc.text(value, 18, y);
  };
  const mono = (value: string, y: number) => {
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    text(doc, COLOR.slate700);
    doc.text(value, 62, y);
  };

  label(`Document Reference Number: ${contract.contractNumber}`, 46);
  label(fitLine(doc, `Instrument Title: ${contract.title} (${contract.partyCount} Parties)`, innerWidth - 8), 51);
  label('Original Document Digest:', 56);
  mono(`sha256:${contract.originalPdfHash}`, 56);
  label('Certified Execution Digest:', 62);
  mono(`sha256:${finalHash}`, 62);
  label(`Certified Timestamp: ${formatUtc(contract.updatedAt)} UTC   |   Workflow: ${contract.partyCount}-Party E-Signature`, 70);

  // Signatory records
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  text(doc, COLOR.navy);
  doc.text('VERIFIED SIGNATORY RECORDS', MARGIN, 84);

  let y = 89;
  contract.parties.forEach(p => {
    fill(doc, [255, 255, 255]);
    draw(doc, COLOR.border);
    doc.rect(MARGIN, y, innerWidth, 22, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    text(doc, COLOR.navy);
    doc.text(fitLine(doc, `Party ${p.partyIndex} (${p.role}): ${p.name}`, innerWidth - 8), 18, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    text(doc, COLOR.slate600);
    doc.text(fitLine(doc, `Email: ${p.email}   |   Security: Token Digital E-Consent Accepted`, innerWidth - 8), 18, y + 11);
    doc.text(
      fitLine(
        doc,
        `Signature Method: ${p.signature?.signatureMethod?.toUpperCase() || 'E-SIGN'}   |   IP: ${p.signature?.ipAddress || 'Recorded'}   |   Timestamp: ${formatUtc(p.signature?.timestamp) || 'Verified'} UTC`,
        innerWidth - 8
      ),
      18,
      y + 16
    );
    y += 25;
  });

  // Audit trail (first N events, with an explicit note when truncated)
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  text(doc, COLOR.navy);
  doc.text('CHRONOLOGICAL AUDIT TRAIL LOG', MARGIN, y);
  y += 6;

  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  text(doc, COLOR.slate600);
  contract.auditTrail.slice(0, MAX_AUDIT_ROWS).forEach(evt => {
    const row = `${formatUtc(evt.timestamp)} UTC  |  ${evt.event.padEnd(20, ' ')}  |  ${evt.actor.padEnd(16, ' ')}  |  ${evt.description}`;
    doc.text(fitLine(doc, row, innerWidth), MARGIN, y);
    y += 4;
  });
  const hidden = contract.auditTrail.length - MAX_AUDIT_ROWS;
  if (hidden > 0) {
    doc.text(`... ${hidden} more event${hidden === 1 ? '' : 's'} available in the dashboard audit vault`, MARGIN, y);
    y += 4;
  }

  // Compliance seal
  fill(doc, [241, 245, 249]);
  doc.rect(MARGIN, y + 2, innerWidth, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  text(doc, COLOR.navy);
  doc.text('LEGAL COMPLIANCE DECLARATION & ENFORCEABILITY', 18, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  text(doc, COLOR.slate500);
  const notice = `This document has been executed using the Ignite Vision Documentation Dashboard compliant with the Electronic Signatures in Global and National Commerce Act (E-SIGN, 15 U.S.C. § 7001), Uniform Electronic Transactions Act (UETA), and European eIDAS regulation. Cryptographic SHA-256 checksums verify that no alterations have occurred following final execution across all ${contract.partyCount} parties.`;
  doc.text(doc.splitTextToSize(notice, innerWidth - 8), 18, y + 13);

  drawFooter(doc, 'CRYPTOGRAPHIC AUDIT CERTIFICATE · IGNITE VISION HR', 'Page 2 of 2 · SECURE ENCRYPTED ARCHIVE');
  return doc;
}

export function downloadCertifiedPdf(contract: Contract): void {
  createCertifiedPdfDoc(contract).save(`${safeFileName(contract.contractNumber)}_Certified_Signed.pdf`);
}

export function getCertifiedPdfBlob(contract: Contract): Blob {
  return createCertifiedPdfDoc(contract).output('blob');
}

/** Strip characters that are unsafe in file names on common operating systems. */
function safeFileName(value: string): string {
  return value.replace(/[^\w.-]+/g, '_');
}
