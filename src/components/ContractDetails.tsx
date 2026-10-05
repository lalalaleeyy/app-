import React, { useState } from 'react';
import { EmailPreviewFrame } from './EmailPreviewFrame';
import { Contract, EmailLog, PartyRoleKey } from '../types';
import { 
  sendInvitations, 
  sendReminder, 
  cancelContract 
} from '../services/storage';
import { 
  downloadOriginalPdf, 
  downloadCertifiedPdf,
  getOriginalPdfBlob,
  getCertifiedPdfBlob
} from '../services/pdfGenerator';
import { 
  uploadPdfToDrive, 
  getOrCreateContractsFolder, 
  getDriveAccessToken, 
  signInWithGoogleDrive 
} from '../services/googleDrive';
import { 
  ArrowLeft, 
  Send, 
  Download, 
  FileText, 
  Ban, 
  Check, 
  Link2, 
  ExternalLink, 
  Clock, 
  CircleCheck, 
  ShieldCheck, 
  Bell, 
  Move, 
  Eye, 
  Mail, 
  X,
  Users,
  HardDrive
} from 'lucide-react';
import { getErrorMessage } from '../services/security';

interface ContractDetailsProps {
  contract: Contract;
  onBack: () => void;
  onOpenSignerPortal: (token: string) => void;
}

export const ContractDetails: React.FC<ContractDetailsProps> = ({
  contract,
  onBack,
  onOpenSignerPortal
}) => {
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [activeEmailPreview, setActiveEmailPreview] = useState<EmailLog | null>(null);
  const [activeReminderMenu, setActiveReminderMenu] = useState<PartyRoleKey | null>(null);

  // In-app cancellation modal state
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelPreset, setCancelPreset] = useState('Terms Renegotiation');
  const [cancelDetails, setCancelDetails] = useState('');

  // Google Drive upload state
  const [driveUploadStatus, setDriveUploadStatus] = useState<string | null>(null);
  const [driveFileLink, setDriveFileLink] = useState<string | null>(null);

  const handleSaveToDrive = async () => {
    try {
      setIsProcessing(true);
      setDriveUploadStatus('Connecting to Google Drive...');
      let token = getDriveAccessToken();
      if (!token) {
        const res = await signInWithGoogleDrive();
        token = res.accessToken;
      }

      setDriveUploadStatus('Locating or creating "Ignite Vision Contracts" folder...');
      const folderId = await getOrCreateContractsFolder();

      setDriveUploadStatus('Uploading PDF document to Google Drive...');
      const blob = contract.status === 'fully_signed'
        ? getCertifiedPdfBlob(contract)
        : getOriginalPdfBlob(contract);

      const suffix = contract.status === 'fully_signed' ? 'Certified_Signed' : 'Original';
      const fileName = `${contract.contractNumber}_${contract.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${suffix}.pdf`;

      const uploaded = await uploadPdfToDrive(fileName, blob, {
        folderId,
        description: `Ignite Vision Contract ${contract.contractNumber} (${contract.title}) - Status: ${contract.status}`
      });

      setDriveFileLink(uploaded.webViewLink || null);
      setDriveUploadStatus(`Saved to Google Drive as "${fileName}"!`);
      setTimeout(() => setDriveUploadStatus(null), 5000);
    } catch (err) {
      console.error('Drive save error:', err);
      setNotice({ kind: 'error', text: getErrorMessage(err, 'Failed to save to Google Drive') });
      setDriveUploadStatus(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/#sign?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const reportEmailResult = (result: { emailsFailed: number }, okText: string) => {
    setNotice(
      result.emailsFailed > 0
        ? {
            kind: 'error',
            text: `${result.emailsFailed} email(s) could not be delivered. Open the Email Outbox to see the error, then send a reminder to retry.`
          }
        : { kind: 'success', text: okText }
    );
    setTimeout(() => setNotice(null), 8000);
  };

  const handleSendInvitations = async () => {
    try {
      setIsProcessing(true);
      setNotice(null);
      const result = await sendInvitations(contract.id);
      reportEmailResult(result, 'Invitation email(s) sent.');
    } catch (err) {
      setNotice({ kind: 'error', text: getErrorMessage(err, 'Failed to dispatch invitations') });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendReminder = async (roleKey: PartyRoleKey, type: 'reminder_24h' | 'reminder_48h' | 'manual_reminder') => {
    try {
      setIsProcessing(true);
      setActiveReminderMenu(null);
      setNotice(null);
      const result = await sendReminder(contract.id, roleKey, type);
      reportEmailResult(result, 'Reminder email sent.');
    } catch (err) {
      setNotice({ kind: 'error', text: getErrorMessage(err, 'Failed to send reminder') });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenCancelModal = () => {
    setCancelPreset('Terms Renegotiation');
    setCancelDetails('');
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    try {
      setIsProcessing(true);
      const finalReason = cancelDetails.trim() ? `${cancelPreset}: ${cancelDetails.trim()}` : cancelPreset;
      await cancelContract(contract.id, finalReason);
      setIsCancelModalOpen(false);
    } catch (err) {
      setNotice({ kind: 'error', text: getErrorMessage(err, 'Failed to cancel contract') });
      setIsCancelModalOpen(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const isFullySigned = contract.status === 'fully_signed';
  const rawParties = (contract.parties && contract.parties.length > 0)
    ? contract.parties
    : [contract.party1, contract.party2, contract.party3].filter((p): p is NonNullable<typeof p> => Boolean(p));

  const parties = rawParties.map((p, idx) => ({
    ...p,
    name: p.name || `Signatory ${idx + 1}`,
    email: p.email || '',
    role: p.role || `Signatory ${idx + 1}`,
    status: p.status || 'pending',
    signingToken: p.signingToken || `token_${idx}`,
    id: p.id || p.signingToken || `party-sig-${idx}`,
    roleKey: (p.roleKey || (idx === 0 ? 'party1' : idx === 1 ? 'party2' : 'party3')) as PartyRoleKey,
    partyIndex: p.partyIndex || idx + 1,
  }));

  return (
    <div className="space-y-6">
      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`p-3 text-xs rounded-lg border ${
            notice.kind === 'error'
              ? 'text-red-700 bg-red-50 border-red-200'
              : 'text-emerald-700 bg-emerald-50 border-emerald-200'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Top Header & Quick Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e1e7f5]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 text-[#060b1e] hover:text-white hover:bg-[#060b1e] rounded-lg transition-colors border border-[#e1e7f5] cursor-pointer"
            title="Return to pipeline"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-extrabold text-[#ff1e27]">
                // {contract.contractNumber}
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-xs font-bold text-[#060b1e] uppercase tracking-wider">
                {contract.contractType}
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                <Users className="w-3 h-3 text-[#ff1e27]" />
                <span>{contract.partyCount || parties.length} {contract.partyCount === 1 ? 'Party' : 'Parties'}</span>
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-[#060b1e] mt-0.5 tracking-tight">
              {contract.title}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {contract.status === 'draft' && (
            <button
              type="button"
              onClick={handleSendInvitations}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white bg-[#ff1e27] hover:bg-[#e0121b] rounded-lg transition-all shadow-md shadow-red-500/25 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Invitations</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => downloadOriginalPdf(contract)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-[#060b1e] bg-white border border-[#e1e7f5] hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Original PDF</span>
          </button>

          {isFullySigned && (
            <button
              type="button"
              onClick={() => downloadCertifiedPdf(contract)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-white bg-[#ff1e27] hover:bg-[#e0121b] rounded-lg transition-all shadow-lg shadow-red-500/30 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Final Certified PDF</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveToDrive}
            disabled={isProcessing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-[#060b1e] bg-white border border-[#e1e7f5] hover:border-amber-400 hover:bg-amber-50/50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            title="Upload and backup this contract PDF to your Google Drive"
          >
            <HardDrive className="w-3.5 h-3.5 text-amber-500" />
            <span>Save to Google Drive</span>
          </button>

          {contract.status !== 'cancelled' && contract.status !== 'fully_signed' && (
            <button
              type="button"
              onClick={handleOpenCancelModal}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Cancel Contract</span>
            </button>
          )}
        </div>
      </div>

      {/* Google Drive Upload Status Alert */}
      {driveUploadStatus && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900 shadow-xs">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-semibold">{driveUploadStatus}</span>
          </div>
          {driveFileLink && (
            <a
              href={driveFileLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-md font-bold text-xs transition-colors"
            >
              <span>View in Drive</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* Prominent Cancellation Banner if Cancelled */}
      {contract.status === 'cancelled' && (
        <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-red-900">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#ff1e27] text-white flex items-center justify-center shrink-0">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-red-950 uppercase tracking-wide">
                CONTRACT OFFICIALLY VOIDED &amp; CANCELLED
              </h3>
              <p className="text-red-800 mt-0.5">
                All electronic signing links have been deactivated. The cancellation event has been permanently timestamped and logged in the cryptographic audit vault.
              </p>
            </div>
          </div>
          <span className="font-mono text-xs font-bold bg-white text-red-700 px-3 py-1 rounded-md border border-red-300 uppercase tracking-wider shrink-0 self-start sm:self-center">
            STATUS: CANCELLED
          </span>
        </div>
      )}

      {/* Execution Workflow Tracker */}
      <div className="bg-white rounded-xl border border-[#e1e7f5] p-5 shadow-xs">
        <div className="text-[11px] font-extrabold text-[#060b1e] mb-3 uppercase tracking-wider flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#ff1e27]" />
          <span>Execution Workflow // ({contract.signingOrder === 'sequential' ? 'Sequential Mode' : 'Parallel Mode'} - {parties.length} Parties)</span>
        </div>

        <div className={`grid grid-cols-1 ${
          parties.length === 1 ? 'sm:grid-cols-3' : parties.length === 2 ? 'sm:grid-cols-4' : 'sm:grid-cols-5'
        } gap-3 text-xs`}>
          {/* Step 1: Draft */}
          <div className="p-3 bg-[#f8faff] rounded-lg border border-[#e1e7f5]">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="font-bold text-[#060b1e]">01. CREATED</span>
              <CircleCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="font-mono tabular-nums text-slate-700 text-[11px]">
              {contract.createdAt.slice(0, 16).replace('T', ' ')}
            </div>
          </div>

          {/* Dynamic Signatory steps */}
          {parties.map((p, idx) => (
            <div
              key={`workflow-step-${p.id || p.signingToken || idx}`}
              className={`p-3 rounded-lg border ${
                p.status === 'signed'
                  ? 'bg-[#f8faff] border-[#e1e7f5]'
                  : 'bg-white border-[#e1e7f5]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[#060b1e]">
                  0{idx + 2}. PARTY {p.partyIndex} ({p.role.toUpperCase()})
                </span>
                {p.status === 'signed' ? (
                  <CircleCheck className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Clock className="w-4 h-4 text-[#ff1e27]" />
                )}
              </div>
              <div className="text-[11px] text-slate-700 font-semibold truncate">
                {p.name} ({p.status.toUpperCase()})
              </div>
            </div>
          ))}

          {/* Final Certification */}
          <div
            className={`p-3 rounded-lg border ${
              isFullySigned
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-white border-[#e1e7f5]'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-[#060b1e]">
                0{parties.length + 2}. AUDIT SEAL
              </span>
              {isFullySigned ? (
                <CircleCheck className="w-4 h-4 text-emerald-600" />
              ) : (
                <Clock className="w-4 h-4 text-slate-400" />
              )}
            </div>
            <div className="text-[11px] text-slate-700 font-semibold truncate">
              {isFullySigned ? 'LOCKED & CERTIFIED' : 'Awaiting Signatures'}
            </div>
          </div>
        </div>
      </div>

      {/* Signatories Grid (1, 2, or 3 cards) */}
      <div className={`grid grid-cols-1 ${
        parties.length === 1 ? 'md:grid-cols-1' : parties.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'
      } gap-4`}>
        {parties.map((p, idx) => {
          const isSigned = p.status === 'signed';

          return (
            <div key={`signatory-card-${p.id || p.signingToken || idx}`} className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Party {p.partyIndex} ({p.roleKey})
                  </span>
                  <h3 className="font-semibold text-sm text-slate-900">{p.name}</h3>
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium ${
                    isSigned ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSigned ? 'bg-emerald-600' : 'bg-amber-500'
                    }`}
                  />
                  {isSigned ? 'Signature Verified' : 'Awaiting Signature'}
                </span>
              </div>

              <div className="text-xs space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">Email:</span>
                  <span className="font-medium text-slate-800">{p.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Role:</span>
                  <span className="text-slate-800">{p.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">First Opened:</span>
                  <span className="font-mono tabular-nums text-slate-700">
                    {p.documentOpenedAt
                      ? p.documentOpenedAt.slice(0, 16).replace('T', ' ')
                      : 'Not yet opened'}
                  </span>
                </div>

                {p.signature && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Signed At:</span>
                      <span className="font-mono tabular-nums text-emerald-700 font-medium">
                        {p.signature.timestamp.slice(0, 16).replace('T', ' ')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Signer IP / Device:</span>
                      <span className="font-mono text-[11px] text-slate-700 truncate max-w-[200px]" title={p.signature.userAgent}>
                        {p.signature.ipAddress} · {p.signature.signatureMethod}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {p.signature && (
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <div className="text-[10px] text-slate-400 mb-1 uppercase font-semibold">
                    Captured Electronic Signature
                  </div>
                  <img
                    src={p.signature.signatureImage}
                    alt={`${p.name} Signature`}
                    className="max-h-12 object-contain"
                  />
                  <div className="text-[10px] text-slate-500 mt-1">
                    ✓ Consent accepted under E-SIGN Act
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyLink(p.signingToken)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                >
                  {copiedToken === p.signingToken ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Copied Link</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-3 h-3" />
                      <span>Copy Sign Link</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onOpenSignerPortal(p.signingToken)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Test Sign as Party {p.partyIndex}</span>
                </button>

                {p.status === 'pending' && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setActiveReminderMenu(activeReminderMenu === p.roleKey ? null : p.roleKey)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 rounded transition-colors cursor-pointer"
                    >
                      <Bell className="w-3 h-3" />
                      <span>Reminder</span>
                    </button>

                    {activeReminderMenu === p.roleKey && (
                      <div className="absolute left-0 mt-1 w-44 bg-white border border-slate-200 rounded-md shadow-lg z-20 py-1 text-xs">
                        <button
                          type="button"
                          onClick={() => handleSendReminder(p.roleKey, 'reminder_24h')}
                          className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 cursor-pointer"
                        >
                          24h Standard Reminder
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendReminder(p.roleKey, 'reminder_48h')}
                          className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 cursor-pointer"
                        >
                          48h Urgent Reminder
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendReminder(p.roleKey, 'manual_reminder')}
                          className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 cursor-pointer"
                        >
                          Manual Instant Reminder
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Signature Placement & Coordinates Details */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Move className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-900">
              Configured Signature Fields &amp; Coordinates ({contract.fields.length} Placement Targets)
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {contract.partyCount}-Party Execution Map
          </span>
        </div>

        <div className={`grid grid-cols-1 ${
          contract.fields.length === 1
            ? 'md:grid-cols-1'
            : contract.fields.length === 2
            ? 'md:grid-cols-2'
            : 'md:grid-cols-3'
        } gap-4`}>
          {contract.fields.map((fld, idx) => {
            const party = parties.find(p => p.roleKey === fld.recipientRole) || parties[idx] || parties[0];
            const colorClass = fld.recipientRole === 'party1' ? 'border-blue-200 bg-blue-50/60 text-blue-950' : fld.recipientRole === 'party2' ? 'border-emerald-200 bg-emerald-50/60 text-emerald-950' : 'border-purple-200 bg-purple-50/60 text-purple-950';

            return (
              <div key={`field-block-${fld.id || idx}`} className={`p-3 rounded border text-xs space-y-1.5 ${colorClass}`}>
                <div className="flex items-center justify-between font-bold">
                  <span>Party {party?.partyIndex || idx + 1} ({party?.name})</span>
                  <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border">
                    Page {fld.page}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                  <div>
                    <span className="text-[10px] opacity-75 block">Pos X:</span>
                    <strong>{fld.xPercent}%</strong>
                  </div>
                  <div>
                    <span className="text-[10px] opacity-75 block">Pos Y:</span>
                    <strong>{fld.yPercent}%</strong>
                  </div>
                  <div>
                    <span className="text-[10px] opacity-75 block">Width:</span>
                    <strong>{fld.widthPercent}%</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cryptographic Document Integrity Card */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-900">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Cryptographic Document Integrity &amp; Legal Hash Record</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded border border-slate-200">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">
              Original Document SHA-256 Checksum
            </span>
            <span className="font-mono text-[11px] text-slate-800 break-all select-all">
              {contract.originalPdfHash}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded border border-slate-200">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">
              Final Certified Execution SHA-256 Checksum
            </span>
            <span className="font-mono text-[11px] text-slate-800 break-all select-all">
              {contract.finalPdfHash || 'Pending execution of all designated signatories'}
            </span>
          </div>
        </div>
      </div>

      {/* Audit Trail Log */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Chronological Audit Trail &amp; Event Vault
          </h3>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {contract.auditTrail.length} recorded events
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Timestamp (UTC)</th>
                <th className="py-2.5 px-4">Event</th>
                <th className="py-2.5 px-4">Description</th>
                <th className="py-2.5 px-4">Actor</th>
                <th className="py-2.5 px-4">Network / IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...contract.auditTrail].reverse().map((evt, idx) => (
                <tr key={`audit-row-${evt.id || idx}`} className="hover:bg-slate-50/60">
                  <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                    {evt.timestamp.slice(0, 19).replace('T', ' ')}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-slate-800 whitespace-nowrap capitalize">
                    {evt.event.replace(/_/g, ' ')}
                  </td>
                  <td className="py-2.5 px-4 text-slate-700">{evt.description}</td>
                  <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">{evt.actor}</td>
                  <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {evt.ipAddress || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispatched Notification History */}
      {contract.invitationHistory.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Email Notifications &amp; Invitation History
            </h3>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {contract.invitationHistory.length} notices dispatched
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Sent Timestamp</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Recipient</th>
                  <th className="py-2.5 px-4">Subject</th>
                  <th className="py-2.5 px-4 text-right">Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contract.invitationHistory.map((email, idx) => (
                  <tr key={`invitation-row-${email.id || idx}`} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {email.sentAt.slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="py-2.5 px-4 text-slate-800 whitespace-nowrap capitalize">
                      {email.type.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                      {email.recipientName} ({email.recipientEmail})
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 truncate max-w-[280px]">
                      {email.subject}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setActiveEmailPreview(email)}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Email</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rendered HTML Email Preview Modal */}
      {activeEmailPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-600" />
                <h3 className="font-semibold text-sm text-slate-900">Email Invitation Preview</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveEmailPreview(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs space-y-1">
              <div>
                <strong>To:</strong> {activeEmailPreview.recipientName} &lt;{activeEmailPreview.recipientEmail}&gt;
              </div>
              <div>
                <strong>Subject:</strong> {activeEmailPreview.subject}
              </div>
              <div>
                <strong>Dispatched:</strong> {activeEmailPreview.sentAt}
              </div>
            </div>
            <div className="p-6 overflow-y-auto">
              <EmailPreviewFrame html={activeEmailPreview.previewContent} title={activeEmailPreview.subject} />
            </div>
            <div className="p-3 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
              <button
                type="button"
                onClick={() => setActiveEmailPreview(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 bg-slate-100 rounded cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Contract Confirmation Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060b1e]/75 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-red-200">
            {/* Modal Header */}
            <div className="p-4 bg-[#060b1e] border-b border-[#14204c] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#ff1e27] text-white rounded-lg">
                  <Ban className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">
                    Cancel &amp; Void Contract
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {contract.contractNumber} · {contract.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-red-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-red-950">
                  <Ban className="w-4 h-4 text-[#ff1e27]" />
                  <span>Permanent Legal Void Action</span>
                </p>
                <p className="text-[11px] text-red-800 leading-relaxed">
                  Cancelling this contract will immediately deactivate all signing links dispatched to signatories. The void event will be permanently committed to the cryptographic audit vault.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Reason for Cancellation
                </label>
                <select
                  value={cancelPreset}
                  onChange={e => setCancelPreset(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#ff1e27] focus:border-[#ff1e27] bg-[#f8faff] text-[#060b1e] font-sans"
                >
                  <option value="Terms Renegotiation">Terms Renegotiation</option>
                  <option value="Signatory Declined / Refused Terms">Signatory Declined / Refused Terms</option>
                  <option value="Drafting Error / Duplicate Document">Drafting Error / Duplicate Document</option>
                  <option value="Agreement Terminated by Mutual Assent">Agreement Terminated by Mutual Assent</option>
                  <option value="Expired / Deadlines Lapsed">Expired / Deadlines Lapsed</option>
                  <option value="Other / Administrative Void">Other / Administrative Void</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Additional Audit Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={cancelDetails}
                  onChange={e => setCancelDetails(e.target.value)}
                  placeholder="Enter specific audit remarks or explanation for permanent record..."
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#ff1e27] focus:border-[#ff1e27] bg-white text-[#060b1e]"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Keep Contract Active
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white bg-[#ff1e27] hover:bg-[#e0121b] rounded-lg transition-all shadow-md shadow-red-500/25 cursor-pointer disabled:opacity-50"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>{isProcessing ? 'Cancelling...' : 'Confirm Cancellation'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
