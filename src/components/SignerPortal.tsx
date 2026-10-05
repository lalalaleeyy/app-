import React, { useState, useEffect } from 'react';
import { getSigningSession, signContract } from '../services/storage';
import { downloadCertifiedPdf, downloadOriginalPdf } from '../services/pdfGenerator';
import { SignaturePad } from './SignaturePad';
import { PartyRoleKey, SigningSession } from '../types';
import { getErrorMessage } from '../services/security';
import { 
  FileText, 
  CircleCheck, 
  Clock, 
  ShieldCheck, 
  Lock, 
  Download, 
  Info, 
  TriangleAlert, 
  ArrowRight, 
  X 
} from 'lucide-react';

interface SignerPortalProps {
  token: string;
  onExit?: () => void;
}

export const SignerPortal: React.FC<SignerPortalProps> = ({ token, onExit }) => {
  const [sessionData, setSessionData] = useState<SigningSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [signatureData, setSignatureData] = useState<{ signatureImage: string; signatureMethod: 'draw' | 'type' | 'upload' } | null>(null);
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [confirmedName, setConfirmedName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasJustSigned, setHasJustSigned] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const applySession = (data: SigningSession) => {
    setSessionData(data);
    setConfirmedName(prev => prev || data.signer.name);
    if (data.signer.status === 'signed') setHasJustSigned(true);
  };

  const loadSession = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      applySession(await getSigningSession(token));
    } catch (err) {
      setErrorMsg(getErrorMessage(err, 'Error loading document session'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSession();
  }, [token]);

  const handleExecuteSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!signatureData || !signatureData.signatureImage) {
      setSubmitError('Please provide or draw your signature before submitting.');
      return;
    }
    if (!consentAgreed) {
      setSubmitError('You must accept the Electronic Signatures consent declaration.');
      return;
    }
    if (!confirmedName.trim()) {
      setSubmitError('Please enter your full legal name.');
      return;
    }

    try {
      setIsSubmitting(true);
      const updated = await signContract({
        token,
        fullName: confirmedName.trim(),
        signatureImage: signatureData.signatureImage,
        signatureMethod: signatureData.signatureMethod,
        consentAgreed
      });

      applySession(updated);
      setHasJustSigned(true);
      setIsSignModalOpen(false);
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Error recording signature'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium text-slate-600">
            Verifying secure signing token and document...
          </p>
        </div>
      </div>
    );
  }

  if (errorMsg || !sessionData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full p-6 rounded-lg border border-slate-200 shadow-sm text-center space-y-3">
          <TriangleAlert className="w-8 h-8 text-amber-500 mx-auto" />
          <h2 className="text-base font-bold text-slate-900">Signing Link Notice</h2>
          <p className="text-xs text-slate-600">{errorMsg || 'Unable to access signing session'}</p>
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="mt-4 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
            >
              Return to HR Portal
            </button>
          )}
        </div>
      </div>
    );
  }

  const { contract, signer, otherSigners, canSignNow, waitingMessage, role } = sessionData;
  const isFullySigned = contract.status === 'fully_signed';
  const targetField = contract.fields.find(f => f.recipientRole === role) || contract.fields[0];
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
    id: p.id || p.signingToken || `signer-p-${idx}`,
    roleKey: (p.roleKey || (idx === 0 ? 'party1' : idx === 1 ? 'party2' : 'party3')) as PartyRoleKey,
    partyIndex: p.partyIndex || idx + 1,
  }));

  return (
    <div className="min-h-screen bg-[#f4f6fb] flex flex-col font-sans text-[#060b1e]">
      {/* Top Header */}
      <header className="bg-[#060b1e] border-b border-[#14204c] text-white sticky top-0 z-20 shadow-md">
        <div className="bg-[#ff1e27] h-0.5 w-full" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#ff1e27] flex items-center justify-center text-white font-extrabold text-xs shadow-md shadow-red-500/30">
              IV
            </div>
            <div>
              <span className="text-xs font-extrabold text-white block uppercase tracking-tight">
                IGNITE VISION <span className="text-[#ff1e27]">DOCUMENTATION DASHBOARD</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                REF // {contract.contractNumber} ({contract.partyCount || parties.length} PARTIES)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block text-xs">
              <span className="text-slate-400">Signing as: </span>
              <span className="font-bold text-white">{signer.name}</span>
              <span className="text-slate-400 block text-[10px] uppercase font-mono">
                ({signer.role})
              </span>
            </div>

            {signer.status === 'signed' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 text-emerald-400 text-xs font-bold border border-emerald-800">
                <CircleCheck className="w-4 h-4 text-emerald-400" />
                <span>SIGNED &amp; RECORDED</span>
              </span>
            ) : canSignNow ? (
              <button
                type="button"
                onClick={() => setIsSignModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-white bg-[#ff1e27] hover:bg-[#e0121b] rounded-lg transition-all shadow-lg shadow-red-500/30 hover:scale-105 cursor-pointer"
              >
                <span>Sign Document</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0c1536] text-amber-400 text-xs font-bold border border-amber-900/50">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>PENDING PRECEDING SIGNER</span>
              </span>
            )}

            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 font-bold uppercase transition-colors cursor-pointer"
              >
                HR View
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-4">
        {/* Waiting notification if sequential order not reached */}
        {!canSignNow && signer.status !== 'signed' && waitingMessage && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 text-xs text-amber-900">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-sm">Sequential Signature Order Enforced</h3>
              <p className="mt-1 leading-relaxed">{waitingMessage}</p>
            </div>
          </div>
        )}

        {/* Success banner if signed */}
        {signer.status === 'signed' && (
          <div className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CircleCheck className="w-7 h-7 text-emerald-600 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-emerald-950">
                  {isFullySigned
                    ? 'Document Fully Executed & Certified'
                    : 'Your Signature Has Been Recorded'}
                </h3>
                <p className="text-xs text-emerald-800 mt-0.5">
                  {isFullySigned
                    ? `All ${contract.partyCount || parties.length} parties have completed their electronic signatures. The tamper-evident audit certificate is attached.`
                    : otherSigners.length > 0
                    ? `Awaiting execution from remaining signatories (${otherSigners.filter(s => s.status !== 'signed').map(s => s.name).join(', ')}). You will receive an email upon finalization.`
                    : 'Your signature has been securely committed and cryptographically sealed.'}
                </p>
              </div>
            </div>

            {isFullySigned && (
              <button
                type="button"
                onClick={() => downloadCertifiedPdf(contract)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors whitespace-nowrap shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Certified PDF</span>
              </button>
            )}
          </div>
        )}

        {/* Contract summary bar */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div>
            <div className="text-slate-400 uppercase text-[10px] font-bold tracking-wider">
              {contract.contractType}
            </div>
            <h1 className="text-sm font-bold text-slate-900 mt-0.5">{contract.title}</h1>
            <div className="flex items-center gap-3 text-slate-500 mt-1">
              <span>Date: {contract.contractDate}</span>
              <span>·</span>
              <span>Ref: {contract.contractNumber}</span>
              <span>·</span>
              <span>Parties: {contract.partyCount || parties.length}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-100 pt-2 md:pt-0 md:pl-4 text-slate-600">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                Your Status
              </span>
              <span className="font-semibold text-slate-900 capitalize">{signer.status}</span>
            </div>
            {otherSigners.length > 0 && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                  Other Parties
                </span>
                <span className="font-medium text-slate-800">
                  {otherSigners.map(os => `${os.name} (${os.status})`).join(' · ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Document Review Window */}
        <div className="bg-white rounded-xl border border-[#e1e7f5] overflow-hidden shadow-md">
          <div className="p-3.5 bg-[#060b1e] border-b border-[#14204c] text-white flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-bold tracking-tight">
              <FileText className="w-4 h-4 text-[#ff1e27]" />
              <span>OFFICIAL DOCUMENT REVIEW WINDOW</span>
            </div>

            {targetField && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-[#0c1536] border border-[#162354] rounded-md text-red-400 text-[11px] font-mono font-bold">
                <span className="w-2 h-2 rounded-full bg-[#ff1e27] animate-ping" />
                <span>SIGNATURE TARGET: PAGE {targetField.page} (X: {targetField.xPercent}%, Y: {targetField.yPercent}%)</span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">
                SHA-256: {contract.originalPdfHash.slice(0, 16)}...
              </span>
              {canSignNow && signer.status !== 'signed' && (
                <button
                  type="button"
                  onClick={() => setIsSignModalOpen(true)}
                  className="px-3.5 py-1.5 bg-[#ff1e27] hover:bg-[#e0121b] text-white font-extrabold uppercase tracking-wider text-[11px] rounded-md transition-all shadow-md shadow-red-500/30 cursor-pointer"
                >
                  Adopt &amp; Sign
                </button>
              )}
            </div>
          </div>

          {/* Document Content View */}
          <div className="p-6 sm:p-10 bg-slate-50 flex justify-center overflow-x-auto min-h-[600px] relative">
            <div className="w-[640px] bg-white rounded shadow-lg border border-slate-300 p-8 sm:p-12 relative text-slate-800 font-sans text-xs leading-relaxed select-none">
              
              {/* Document Header */}
              <div className="border-b-2 border-slate-900 pb-3 mb-6 flex justify-between items-center">
                <div>
                  <div className="font-extrabold text-sm text-slate-900">
                    IGNITE VISION DOCUMENTATION DASHBOARD
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Ref: {contract.contractNumber} · Effective: {contract.contractDate}
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 rounded text-slate-700 uppercase">
                  {contract.contractType}
                </span>
              </div>

              {/* Title & Preamble */}
              <h1 className="text-base font-extrabold text-slate-900 uppercase tracking-tight mb-2">
                {contract.title}
              </h1>
              <p className="text-[11px] text-slate-600 mb-6 leading-relaxed">
                This Legal Agreement is entered into by and between the {contract.partyCount || parties.length} designated signatories: {parties.map(p => `${p.name} (${p.role})`).join(', ')} in accordance with statutory corporate governance regulations.
              </p>

              {/* Clauses */}
              <div className="space-y-4 text-[10.5px] text-slate-700">
                <div>
                  <h4 className="font-bold text-slate-900 mb-0.5">1. SCOPE OF ENGAGEMENT &amp; SERVICE TERMS</h4>
                  <p>
                    The parties hereby covenant to discharge all responsibilities, standards, and milestones established in this instrument in full fidelity and compliance.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 mb-0.5">2. CONFIDENTIALITY &amp; PROPRIETARY ASSETS</h4>
                  <p>
                    Each party agrees to hold in strict confidence all proprietary technical, financial, and strategic information disclosed during the term of this relationship.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 mb-0.5">3. GOVERNING LAW &amp; ELECTRONIC CONSENT</h4>
                  <p>
                    Executed under applicable legal jurisdiction pursuant to the federal Electronic Signatures in Global and National Commerce Act (E-SIGN 15 U.S.C. § 7001).
                  </p>
                </div>
              </div>

              {/* Witness Section */}
              <div className="mt-12 pt-4 border-t border-slate-200">
                <div className="text-[10px] font-bold text-slate-900 uppercase tracking-wider mb-8">
                  IN WITNESS WHEREOF, THE PARTIES HAVE DULY EXECUTED THIS INSTRUMENT:
                </div>
              </div>

              {/* Dynamic Signature Boxes for all Parties */}
              {parties.map((p, idx) => {
                const fld = contract.fields.find(f => f.recipientRole === p.roleKey) || contract.fields[idx] || contract.fields[0];
                const x = fld?.xPercent || (idx === 0 ? 8 : idx === 1 ? 52 : 30);
                const y = fld?.yPercent || 78;
                const w = fld?.widthPercent || 38;

                return (
                  <div
                    key={`signer-box-${p.id || p.signingToken || idx}`}
                    style={{
                      position: 'absolute',
                      left: `${x}%`,
                      top: `${y}%`,
                      width: `${w}%`
                    }}
                    className="flex flex-col justify-end"
                  >
                    {p.signature?.signatureImage ? (
                      <img
                        src={p.signature.signatureImage}
                        alt={`${p.name} Signature`}
                        className="max-h-12 object-contain select-none pb-1"
                      />
                    ) : (
                      <div className="h-10 border-2 border-dashed border-blue-400 bg-blue-50/50 rounded flex items-center justify-center text-[10px] font-semibold text-blue-700">
                        Signature Box ({p.name})
                      </div>
                    )}
                    <div className="border-b border-slate-900 w-full" />
                    <div className="text-[8px] font-bold text-slate-800 mt-1 flex justify-between">
                      <span>Party {p.partyIndex}: {p.name}</span>
                      <span className="font-mono text-slate-500">
                        {p.signature ? p.signature.timestamp.slice(0, 10) : 'Pending'}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Footer */}
              <div className="absolute bottom-6 left-8 right-8 border-t border-slate-200 pt-2 flex justify-between text-[8px] text-slate-400 font-mono">
                <span>Page 1 of 1</span>
                <span>SHA-256 Integrity Verified</span>
                <span>Ignite Vision HR</span>
              </div>
            </div>

            {/* Floating Sign Action Button for Signer */}
            {canSignNow && signer.status !== 'signed' && (
              <div className="fixed bottom-6 right-6 z-30">
                <button
                  type="button"
                  onClick={() => setIsSignModalOpen(true)}
                  className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#ff1e27] hover:bg-[#e0121b] text-white font-extrabold uppercase tracking-wider text-xs shadow-xl shadow-red-500/40 transition-all hover:scale-105 active:scale-95 animate-pulse border-2 border-white/30 cursor-pointer"
                >
                  <Lock className="w-4 h-4 stroke-[3]" />
                  <span>Click to Sign Document</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Signature Execution Modal */}
      {isSignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060b1e]/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col border border-[#e1e7f5] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-[#060b1e] border-b border-[#14204c] text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#ff1e27]" />
                  <span>Execute Electronic Signature</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sign as {signer.name} ({signer.role})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSignModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded text-sm font-bold cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteSignature} className="p-5 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Legal Name Confirmation
                </label>
                <input
                  type="text"
                  value={confirmedName}
                  onChange={e => setConfirmedName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Provide Signature
                </label>
                <SignaturePad
                  signerName={confirmedName}
                  onSignatureReady={sig => setSignatureData(sig)}
                />
              </div>

              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentAgreed}
                    onChange={e => setConsentAgreed(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    required
                  />
                  <div className="text-[11px] text-slate-600 leading-relaxed">
                    <span className="font-semibold text-slate-900 block mb-0.5">
                      Electronic Signature &amp; Records Consent
                    </span>
                    I explicitly consent to conduct business electronically. I acknowledge and agree that my electronic signature constitutes my legally binding assent to the terms of this document, equivalent to a physical handwritten signature pursuant to the Electronic Signatures in Global and National Commerce Act (E-SIGN 15 U.S.C. § 7001) and Uniform Electronic Transactions Act (UETA).
                  </div>
                </label>
              </div>

              <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Audit details (timestamp, IP address, user-agent, cryptographic SHA-256 hash) will be recorded permanently upon submission.
                </span>
              </div>

              {submitError && (
                <div role="alert" className="p-2.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded">
                  {submitError}
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSignModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-extrabold uppercase tracking-wider text-white bg-[#ff1e27] hover:bg-[#e0121b] rounded-lg transition-all shadow-md shadow-red-500/25 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Authenticating & Recording...' : 'Adopt & Sign Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
