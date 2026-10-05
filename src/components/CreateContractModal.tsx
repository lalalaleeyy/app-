import React, { useState, useRef, useEffect } from 'react';
import { Contract, SignatureField, PartyRoleKey, ContractCategory } from '../types';
import { createContract, getCategories } from '../services/storage';
import { CategoryManagerModal } from './CategoryManagerModal';
import { 
  X, 
  Move, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Upload, 
  Maximize2, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight,
  Users,
  Settings2,
  FileCheck
} from 'lucide-react';
import { getErrorMessage } from '../services/security';

interface CreateContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newContract: Contract) => void;
}

export const CreateContractModal: React.FC<CreateContractModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Category state
  const [categories, setCategories] = useState<ContractCategory[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  useEffect(() => {
    const list = getCategories();
    setCategories(list);
    if (list.length > 0 && !contractType) {
      setContractType(list[0].name);
    }
  }, [isOpen]);

  const refreshCategories = () => {
    const list = getCategories();
    setCategories(list);
  };

  // Step 1: Terms
  const [contractNumber, setContractNumber] = useState(
    `IGN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [title, setTitle] = useState('');
  const [contractType, setContractType] = useState('Employment Agreement');
  const [contractDate, setContractDate] = useState(new Date().toISOString().slice(0, 10));
  const [signingOrder, setSigningOrder] = useState<'sequential' | 'parallel'>('sequential');

  // Step 2: Number of Signing Parties (1, 2, or 3)
  const [partyCount, setPartyCount] = useState<1 | 2 | 3>(2);

  const [party1Name, setParty1Name] = useState('');
  const [party1Email, setParty1Email] = useState('');
  const [party1Role, setParty1Role] = useState('');

  const [party2Name, setParty2Name] = useState('');
  const [party2Email, setParty2Email] = useState('');
  const [party2Role, setParty2Role] = useState('');

  const [party3Name, setParty3Name] = useState('');
  const [party3Email, setParty3Email] = useState('');
  const [party3Role, setParty3Role] = useState('');

  // Step 3: Document Source (ONLY UPLOAD CUSTOM PDF - Standard Legal Template Removed)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');

  // Step 4: Signature Placements
  const [sendInvitationsNow, setSendInvitationsNow] = useState(true);
  const [notes, setNotes] = useState('');
  const [targetPage, setTargetPage] = useState(1);
  const [activeParty, setActiveParty] = useState<PartyRoleKey>('party1');
  const [stepPercent, setStepPercent] = useState(2);

  // Party 1 coordinates
  const [p1X, setP1X] = useState(9);
  const [p1Y, setP1Y] = useState(78);
  const [p1W, setP1W] = useState(36);
  const [p1H, setP1H] = useState(8);

  // Party 2 coordinates
  const [p2X, setP2X] = useState(55);
  const [p2Y, setP2Y] = useState(78);
  const [p2W, setP2W] = useState(36);
  const [p2H, setP2H] = useState(8);

  // Party 3 coordinates
  const [p3X, setP3X] = useState(32);
  const [p3Y, setP3Y] = useState(65);
  const [p3W, setP3W] = useState(36);
  const [p3H, setP3H] = useState(8);

  // Canvas ref for drag & drop
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingParty, setDraggingParty] = useState<PartyRoleKey | null>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number } | null>(null);

  // Preview toggle
  const [isPreviewFinal, setIsPreviewFinal] = useState(false);

  if (!isOpen) return null;

  // Preset alignments
  const applyPreset = (preset: 'columns' | 'stacked' | 'grid') => {
    if (partyCount === 1) {
      setP1X(25); setP1Y(78); setP1W(50); setP1H(8);
    } else if (partyCount === 2) {
      if (preset === 'columns') {
        setP1X(8); setP1Y(78); setP1W(38); setP1H(8);
        setP2X(54); setP2Y(78); setP2W(38); setP2H(8);
      } else {
        setP1X(10); setP1Y(66); setP1W(80); setP1H(8);
        setP2X(10); setP2Y(78); setP2W(80); setP2H(8);
      }
    } else if (partyCount === 3) {
      if (preset === 'columns') {
        setP1X(4); setP1Y(78); setP1W(28); setP1H(8);
        setP2X(36); setP2Y(78); setP2W(28); setP2H(8);
        setP3X(68); setP3Y(78); setP3W(28); setP3H(8);
      } else {
        setP1X(8); setP1Y(56); setP1W(38); setP1H(7);
        setP2X(54); setP2Y(56); setP2W(38); setP2H(7);
        setP3X(31); setP3Y(74); setP3W(38); setP3H(7);
      }
    }
  };

  // Nudge box
  const nudge = (dir: 'up' | 'down' | 'left' | 'right', delta: number = stepPercent) => {
    if (activeParty === 'party1') {
      if (dir === 'up') setP1Y(prev => Math.max(0, parseFloat((prev - delta).toFixed(1))));
      if (dir === 'down') setP1Y(prev => Math.min(100 - p1H, parseFloat((prev + delta).toFixed(1))));
      if (dir === 'left') setP1X(prev => Math.max(0, parseFloat((prev - delta).toFixed(1))));
      if (dir === 'right') setP1X(prev => Math.min(100 - p1W, parseFloat((prev + delta).toFixed(1))));
    } else if (activeParty === 'party2') {
      if (dir === 'up') setP2Y(prev => Math.max(0, parseFloat((prev - delta).toFixed(1))));
      if (dir === 'down') setP2Y(prev => Math.min(100 - p2H, parseFloat((prev + delta).toFixed(1))));
      if (dir === 'left') setP2X(prev => Math.max(0, parseFloat((prev - delta).toFixed(1))));
      if (dir === 'right') setP2X(prev => Math.min(100 - p2W, parseFloat((prev + delta).toFixed(1))));
    } else if (activeParty === 'party3') {
      if (dir === 'up') setP3Y(prev => Math.max(0, parseFloat((prev - delta).toFixed(1))));
      if (dir === 'down') setP3Y(prev => Math.min(100 - p3H, parseFloat((prev + delta).toFixed(1))));
      if (dir === 'left') setP3X(prev => Math.max(0, parseFloat((prev - delta).toFixed(1))));
      if (dir === 'right') setP3X(prev => Math.min(100 - p3W, parseFloat((prev + delta).toFixed(1))));
    }
  };

  // Snap position
  const snapPosition = (pos: 'top' | 'middle' | 'bottom' | 'left' | 'center' | 'right') => {
    const w = activeParty === 'party1' ? p1W : activeParty === 'party2' ? p2W : p3W;
    const h = activeParty === 'party1' ? p1H : activeParty === 'party2' ? p2H : p3H;

    const setY = (val: number) => {
      if (activeParty === 'party1') setP1Y(val);
      else if (activeParty === 'party2') setP2Y(val);
      else setP3Y(val);
    };

    const setX = (val: number) => {
      if (activeParty === 'party1') setP1X(val);
      else if (activeParty === 'party2') setP2X(val);
      else setP3X(val);
    };

    if (pos === 'top') setY(15);
    else if (pos === 'middle') setY(parseFloat(((100 - h) / 2).toFixed(1)));
    else if (pos === 'bottom') setY(parseFloat((100 - h - 5).toFixed(1)));
    else if (pos === 'left') setX(5);
    else if (pos === 'center') setX(parseFloat(((100 - w) / 2).toFixed(1)));
    else if (pos === 'right') setX(parseFloat((100 - w - 5).toFixed(1)));
  };

  // Adjust width
  const adjustWidth = (delta: number) => {
    if (activeParty === 'party1') setP1W(prev => Math.min(100, Math.max(1, parseFloat((prev + delta).toFixed(1)))));
    else if (activeParty === 'party2') setP2W(prev => Math.min(100, Math.max(1, parseFloat((prev + delta).toFixed(1)))));
    else setP3W(prev => Math.min(100, Math.max(1, parseFloat((prev + delta).toFixed(1)))));
  };

  // Adjust height
  const adjustHeight = (delta: number) => {
    if (activeParty === 'party1') setP1H(prev => Math.min(100, Math.max(1, parseFloat((prev + delta).toFixed(1)))));
    else if (activeParty === 'party2') setP2H(prev => Math.min(100, Math.max(1, parseFloat((prev + delta).toFixed(1)))));
    else setP3H(prev => Math.min(100, Math.max(1, parseFloat((prev + delta).toFixed(1)))));
  };

  // Direct dimension setter
  const setDimensions = (w: number) => {
    if (activeParty === 'party1') setP1W(Math.min(100, Math.max(1, w)));
    else if (activeParty === 'party2') setP2W(Math.min(100, Math.max(1, w)));
    else setP3W(Math.min(100, Math.max(1, w)));
  };

  // Pointer drag events
  const onPointerDownBox = (e: React.PointerEvent, party: PartyRoleKey) => {
    e.stopPropagation();
    setActiveParty(party);
    setDraggingParty(party);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const startX = party === 'party1' ? p1X : party === 'party2' ? p2X : p3X;
    const startY = party === 'party1' ? p1Y : party === 'party2' ? p2Y : p3Y;

    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startX,
      startY
    };
  };

  const onPointerMoveCanvas = (e: React.PointerEvent) => {
    if (!draggingParty || !dragStartRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const deltaXPercent = ((e.clientX - dragStartRef.current.clientX) / rect.width) * 100;
    const deltaYPercent = ((e.clientY - dragStartRef.current.clientY) / rect.height) * 100;

    const w = draggingParty === 'party1' ? p1W : draggingParty === 'party2' ? p2W : p3W;
    const h = draggingParty === 'party1' ? p1H : draggingParty === 'party2' ? p2H : p3H;

    const newX = Math.max(0, Math.min(100 - w, parseFloat((dragStartRef.current.startX + deltaXPercent).toFixed(1))));
    const newY = Math.max(0, Math.min(100 - h, parseFloat((dragStartRef.current.startY + deltaYPercent).toFixed(1))));

    if (draggingParty === 'party1') {
      setP1X(newX);
      setP1Y(newY);
    } else if (draggingParty === 'party2') {
      setP2X(newX);
      setP2Y(newY);
    } else if (draggingParty === 'party3') {
      setP3X(newX);
      setP3Y(newY);
    }
  };

  const onPointerUpCanvas = (e: React.PointerEvent) => {
    if (draggingParty) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setDraggingParty(null);
      dragStartRef.current = null;
    }
  };

  // Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg('Please enter a contract title');
      setStep(1);
      return;
    }
    if (!party1Name.trim() || !party1Email.trim()) {
      setErrorMsg('Please enter Party 1 name and email address');
      setStep(2);
      return;
    }
    if (partyCount >= 2 && (!party2Name.trim() || !party2Email.trim())) {
      setErrorMsg('Please enter Party 2 name and email address');
      setStep(2);
      return;
    }
    if (partyCount === 3 && (!party3Name.trim() || !party3Email.trim())) {
      setErrorMsg('Please enter Party 3 name and email address');
      setStep(2);
      return;
    }

    try {
      setIsSubmitting(true);

      const partiesList: { name: string; email: string; role: string }[] = [
        {
          name: party1Name.trim(),
          email: party1Email.trim(),
          role: party1Role.trim() || 'Primary Signatory'
        }
      ];

      const fields: SignatureField[] = [
        {
          id: `fld_${Date.now()}_p1`,
          recipientRole: 'party1',
          type: 'signature',
          page: targetPage,
          xPercent: p1X,
          yPercent: p1Y,
          widthPercent: p1W,
          heightPercent: p1H,
          required: true
        }
      ];

      if (partyCount >= 2) {
        partiesList.push({
          name: party2Name.trim(),
          email: party2Email.trim(),
          role: party2Role.trim() || 'Counter Signatory'
        });
        fields.push({
          id: `fld_${Date.now()}_p2`,
          recipientRole: 'party2',
          type: 'signature',
          page: targetPage,
          xPercent: p2X,
          yPercent: p2Y,
          widthPercent: p2W,
          heightPercent: p2H,
          required: true
        });
      }

      if (partyCount === 3) {
        partiesList.push({
          name: party3Name.trim(),
          email: party3Email.trim(),
          role: party3Role.trim() || 'Third Signatory / Approver'
        });
        fields.push({
          id: `fld_${Date.now()}_p3`,
          recipientRole: 'party3',
          type: 'signature',
          page: targetPage,
          xPercent: p3X,
          yPercent: p3Y,
          widthPercent: p3W,
          heightPercent: p3H,
          required: true
        });
      }

      const result = await createContract({
        contractNumber,
        title: title.trim(),
        contractType,
        contractDate,
        signingOrder: partyCount === 1 ? 'parallel' : signingOrder,
        sendInvitationsNow,
        notes: notes.trim(),
        partyCount,
        parties: partiesList,
        fields,
        uploadedPdfName: uploadedFileName || (uploadedFile ? uploadedFile.name : undefined)
      });

      onSuccess(result.contract);
      if (result.emailsFailed > 0) {
        window.alert(
          `The contract was created, but ${result.emailsFailed} invitation email(s) could not be delivered. Open the contract and check the Email Outbox to retry.`
        );
      }
      onClose();
    } catch (err) {
      setErrorMsg(getErrorMessage(err, 'Failed to create and dispatch contract'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const curX = activeParty === 'party1' ? p1X : activeParty === 'party2' ? p2X : p3X;
  const curY = activeParty === 'party1' ? p1Y : activeParty === 'party2' ? p2Y : p3Y;
  const curW = activeParty === 'party1' ? p1W : activeParty === 'party2' ? p2W : p3W;
  const curH = activeParty === 'party1' ? p1H : activeParty === 'party2' ? p2H : p3H;
  const curName = activeParty === 'party1' ? party1Name || 'Party 1' : activeParty === 'party2' ? party2Name || 'Party 2' : party3Name || 'Party 3';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060b1e]/75 backdrop-blur-xs p-3 sm:p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[96vh] flex flex-col border border-[#162354] overflow-hidden">
          
          {/* Modal Top Header */}
          <div className="p-4 bg-[#060b1e] border-b border-[#14204c] text-white flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#ff1e27] animate-ping" />
                <span>Create &amp; Configure Contract</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure signatories, document fields, and signing workflow
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step Indicator Navigation */}
          <div className="flex border-b border-[#14204c] bg-[#0c1536] text-xs">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`flex-1 py-3 px-2 text-center font-bold tracking-wider uppercase transition-all cursor-pointer ${
                step === 1 ? 'bg-[#ff1e27] text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              1. Terms
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              className={`flex-1 py-3 px-2 text-center font-bold tracking-wider uppercase transition-all cursor-pointer ${
                step === 2 ? 'bg-[#ff1e27] text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              2. Signatories ({partyCount} {partyCount === 1 ? 'Party' : 'Parties'})
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className={`flex-1 py-3 px-2 text-center font-bold tracking-wider uppercase transition-all cursor-pointer ${
                step === 3 ? 'bg-[#ff1e27] text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              3. Upload PDF
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              className={`flex-1 py-3 px-2 text-center font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                step === 4 ? 'bg-[#ff1e27] text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Move className="w-3.5 h-3.5" />
              <span>4. Place Signatures</span>
            </button>
          </div>

          {/* Main Step Body Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700">
                {errorMsg}
              </div>
            )}

            {/* STEP 1: TERMS & CATEGORY MANAGEMENT */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Contract Reference Number
                    </label>
                    <input
                      type="text"
                      value={contractNumber}
                      onChange={e => setContractNumber(e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Effective Contract Date
                    </label>
                    <input
                      type="date"
                      value={contractDate}
                      onChange={e => setContractDate(e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                      required
                    />
                  </div>
                </div>

                {/* Category Option with Edit/Remove/Add Action */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Contract Agreement Category
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCategoryModalOpen(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#ff1e27] hover:underline cursor-pointer"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      <span>Manage Categories (Add / Edit / Remove)</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={contractType}
                      onChange={e => setContractType(e.target.value)}
                      className="flex-1 text-xs px-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contract Title *
                  </label>
                  <input
                    type="text"
                    placeholder="Enter document title (e.g. Master Services Agreement 2026)"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                    required
                  />
                </div>

                {/* Signing Order Logic */}
                {partyCount > 1 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Signing Order Logic
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                      <label
                        className={`p-3 rounded-md border cursor-pointer text-xs ${
                          signingOrder === 'sequential'
                            ? 'border-slate-900 bg-slate-50'
                            : 'border-slate-200 hover:bg-slate-50/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="signingOrder"
                          checked={signingOrder === 'sequential'}
                          onChange={() => setSigningOrder('sequential')}
                          className="sr-only"
                        />
                        <div className="font-semibold text-slate-900">Sequential Execution</div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Parties sign in order (Party 1 → Party 2 → Party 3). Next party is notified once preceding signature is verified.
                        </div>
                      </label>

                      <label
                        className={`p-3 rounded-md border cursor-pointer text-xs ${
                          signingOrder === 'parallel'
                            ? 'border-slate-900 bg-slate-50'
                            : 'border-slate-200 hover:bg-slate-50/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="signingOrder"
                          checked={signingOrder === 'parallel'}
                          onChange={() => setSigningOrder('parallel')}
                          className="sr-only"
                        />
                        <div className="font-semibold text-slate-900">Parallel Execution</div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          All signatories receive invitations simultaneously and can execute in any order.
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: SIGNING PARTIES (1, 2, OR 3 PARTIES) */}
            {step === 2 && (
              <div className="space-y-4">
                {/* Party Count Selector (1, 2, 3) */}
                <div className="p-3.5 bg-[#060b1e] rounded-xl text-white border border-[#162354]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-extrabold uppercase tracking-wider block text-[#ff1e27]">
                        NUMBER OF SIGNING PARTIES
                      </span>
                      <p className="text-[11px] text-slate-400">
                        Choose whether this agreement requires 1, 2, or 3 authorized signatories.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-[#0c1536] p-1 rounded-lg border border-[#162354]">
                      {[1, 2, 3].map(cnt => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => {
                            setPartyCount(cnt as 1 | 2 | 3);
                            if (activeParty === 'party2' && cnt === 1) setActiveParty('party1');
                            if (activeParty === 'party3' && cnt < 3) setActiveParty('party1');
                          }}
                          className={`px-4 py-1.5 text-xs font-extrabold rounded-md uppercase tracking-wider transition-all cursor-pointer ${
                            partyCount === cnt
                              ? 'bg-[#ff1e27] text-white shadow-md shadow-red-500/30'
                              : 'text-slate-300 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {cnt} {cnt === 1 ? 'Party' : 'Parties'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Party 1 */}
                <div className="p-3.5 bg-slate-50/80 rounded-lg border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span>Party 1 {partyCount === 1 ? '(Single Signatory)' : '(Primary Signer)'}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Signer Full Name *
                      </label>
                      <input
                        type="text"
                        placeholder="Enter signer full legal name"
                        value={party1Name}
                        onChange={e => setParty1Name(e.target.value)}
                        className="w-full text-xs px-3 py-1.5 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Signer Email Address *
                      </label>
                      <input
                        type="email"
                        placeholder="signer1@company.com"
                        value={party1Email}
                        onChange={e => setParty1Email(e.target.value)}
                        className="w-full text-xs px-3 py-1.5 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Designated Signer Role / Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Employee, Contractor, Executive"
                      value={party1Role}
                      onChange={e => setParty1Role(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>

                {/* Party 2 (if partyCount >= 2) */}
                {partyCount >= 2 && (
                  <div className="p-3.5 bg-slate-50/80 rounded-lg border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <Users className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Party 2 (Counter Signer / Authorizer)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Signer Full Name *
                        </label>
                        <input
                          type="text"
                          placeholder="Enter counter signer legal name"
                          value={party2Name}
                          onChange={e => setParty2Name(e.target.value)}
                          className="w-full text-xs px-3 py-1.5 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Signer Email Address *
                        </label>
                        <input
                          type="email"
                          placeholder="signer2@company.com"
                          value={party2Email}
                          onChange={e => setParty2Email(e.target.value)}
                          className="w-full text-xs px-3 py-1.5 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Designated Signer Role / Title
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. VP People Operations, Director"
                        value={party2Role}
                        onChange={e => setParty2Role(e.target.value)}
                        className="w-full text-xs px-3 py-1.5 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                  </div>
                )}

                {/* Party 3 (if partyCount === 3) */}
                {partyCount === 3 && (
                  <div className="p-3.5 bg-slate-50/80 rounded-lg border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <Users className="w-3.5 h-3.5 text-purple-600" />
                      <span>Party 3 (Third Signatory / Legal / Witness)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Signer Full Name *
                        </label>
                        <input
                          type="text"
                          placeholder="Enter third signer legal name"
                          value={party3Name}
                          onChange={e => setParty3Name(e.target.value)}
                          className="w-full text-xs px-3 py-1.5 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Signer Email Address *
                        </label>
                        <input
                          type="email"
                          placeholder="signer3@company.com"
                          value={party3Email}
                          onChange={e => setParty3Email(e.target.value)}
                          className="w-full text-xs px-3 py-1.5 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Designated Signer Role / Title
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Legal Counsel, Guarantor, Trustee"
                        value={party3Role}
                        onChange={e => setParty3Role(e.target.value)}
                        className="w-full text-xs px-3 py-1.5 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: DOCUMENT SOURCE (ONLY UPLOAD CUSTOM PDF - STANDARD LEGAL TEMPLATE REMOVED) */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Upload className="w-4 h-4 text-[#ff1e27]" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Upload Contract Document (PDF)
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Upload the contract PDF for execution. All signatories will view and sign this document.
                  </p>
                </div>

                <div className="border-2 border-dashed border-slate-300 hover:border-[#ff1e27] rounded-xl p-8 text-center bg-white transition-colors cursor-pointer">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                  <label className="cursor-pointer text-xs font-bold text-[#ff1e27] hover:underline">
                    <span>Click to browse and upload contract PDF</span>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={e => {
                        const file = e.target.files?.[0] || null;
                        setUploadedFile(file);
                        if (file) setUploadedFileName(file.name);
                      }}
                      className="sr-only"
                    />
                  </label>
                  <p className="text-[11px] text-slate-400 mt-1">
                    PDF format supported (Up to 25MB). Signatures will be placed on this document.
                  </p>

                  {uploadedFileName ? (
                    <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800">
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      <span>Attached: {uploadedFileName} {uploadedFile && `(${(uploadedFile.size / 1024).toFixed(1)} KB)`}</span>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-3 py-1 rounded">
                        Optional: If no PDF is selected, a blank instrument will be generated.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 4: PLACE SIGNATURES (1, 2, OR 3 PARTIES) */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Move className="w-4 h-4 text-blue-600" />
                      <span>Signature Field Placement ({partyCount} {partyCount === 1 ? 'Party' : 'Parties'})</span>
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Position and size signature boxes for each party with 1% to 100% precision.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 font-medium">Target Page:</span>
                    <select
                      value={targetPage}
                      onChange={e => setTargetPage(parseInt(e.target.value))}
                      className="text-xs px-2.5 py-1 border border-slate-200 rounded-md bg-white font-mono"
                    >
                      <option value={1}>Page 1 (Execution)</option>
                      <option value={2}>Page 2 (Addendum)</option>
                      <option value={3}>Page 3 (Closing)</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => setIsPreviewFinal(!isPreviewFinal)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                        isPreviewFinal
                          ? 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-1'
                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {isPreviewFinal ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Exit Preview</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                          <span>Preview Print</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {isPreviewFinal ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-xs text-blue-900">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="font-semibold">Document Print Output Preview</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsPreviewFinal(false)}
                        className="px-2.5 py-1 bg-white border border-blue-300 hover:bg-blue-100 rounded text-blue-900 text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        ← Back to Position Editor
                      </button>
                    </div>

                    <div className="bg-slate-200/80 p-4 sm:p-6 rounded-lg flex justify-center overflow-x-auto">
                      <div
                        className="w-[600px] min-h-[750px] bg-white rounded shadow-xl border border-slate-300 relative p-8 select-none font-sans text-slate-800"
                      >
                        {/* Top banner */}
                        <div className="border-b-2 border-slate-900 pb-3 mb-5 flex items-center justify-between">
                          <div>
                            <div className="text-xs font-bold text-slate-900 tracking-tight">
                              IGNITE VISION DOCUMENTATION DASHBOARD
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              Ref: {contractNumber} · Effective: {contractDate}
                            </div>
                          </div>
                          <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-semibold rounded uppercase tracking-wider">
                            {contractType}
                          </span>
                        </div>

                        {/* Title */}
                        <div className="mb-4">
                          <h1 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                            {title || 'CONTRACT AGREEMENT'}
                          </h1>
                          <p className="text-[10px] text-slate-600 mt-1">
                            {uploadedFileName ? `Source PDF: ${uploadedFileName}` : 'Uploaded Contract Instrument'}
                          </p>
                        </div>

                        {/* Signatures placed */}
                        {/* Party 1 */}
                        <div
                          style={{
                            position: 'absolute',
                            left: `${p1X}%`,
                            top: `${p1Y}%`,
                            width: `${p1W}%`
                          }}
                          className="flex flex-col justify-end"
                        >
                          <div className="text-xl text-slate-900 leading-none pb-1 select-none" style={{ fontFamily: "'Dancing Script', cursive" }}>
                            {party1Name || 'Party 1 Signatory'}
                          </div>
                          <div className="border-b border-slate-900 w-full" />
                          <div className="text-[7.5px] font-bold text-slate-800 mt-0.5">
                            Party 1: {party1Name || 'Signer 1'} ({party1Role || 'Signatory'})
                          </div>
                        </div>

                        {/* Party 2 */}
                        {partyCount >= 2 && (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${p2X}%`,
                              top: `${p2Y}%`,
                              width: `${p2W}%`
                            }}
                            className="flex flex-col justify-end"
                          >
                            <div className="text-xl text-slate-900 leading-none pb-1 select-none" style={{ fontFamily: "'Dancing Script', cursive" }}>
                              {party2Name || 'Party 2 Signatory'}
                            </div>
                            <div className="border-b border-slate-900 w-full" />
                            <div className="text-[7.5px] font-bold text-slate-800 mt-0.5">
                              Party 2: {party2Name || 'Signer 2'} ({party2Role || 'Signatory'})
                            </div>
                          </div>
                        )}

                        {/* Party 3 */}
                        {partyCount === 3 && (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${p3X}%`,
                              top: `${p3Y}%`,
                              width: `${p3W}%`
                            }}
                            className="flex flex-col justify-end"
                          >
                            <div className="text-xl text-slate-900 leading-none pb-1 select-none" style={{ fontFamily: "'Dancing Script', cursive" }}>
                              {party3Name || 'Party 3 Signatory'}
                            </div>
                            <div className="border-b border-slate-900 w-full" />
                            <div className="text-[7.5px] font-bold text-slate-800 mt-0.5">
                              Party 3: {party3Name || 'Signer 3'} ({party3Role || 'Signatory'})
                            </div>
                          </div>
                        )}

                        <div className="absolute bottom-6 left-8 right-8 border-t border-slate-200 pt-2 flex justify-between text-[8px] text-slate-400 font-mono">
                          <span>Page {targetPage} of 1</span>
                          <span>{partyCount}-Party Agreement</span>
                          <span>Ignite Vision HR</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Party Switcher Bar */}
                    <div className="flex items-center justify-between bg-slate-100 p-1.5 rounded-lg text-xs">
                      <div className="flex items-center gap-1 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => setActiveParty('party1')}
                          className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                            activeParty === 'party1'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-slate-700 hover:bg-white/60'
                          }`}
                        >
                          Party 1: {party1Name || 'Signer 1'}
                        </button>

                        {partyCount >= 2 && (
                          <button
                            type="button"
                            onClick={() => setActiveParty('party2')}
                            className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                              activeParty === 'party2'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-700 hover:bg-white/60'
                            }`}
                          >
                            Party 2: {party2Name || 'Signer 2'}
                          </button>
                        )}

                        {partyCount === 3 && (
                          <button
                            type="button"
                            onClick={() => setActiveParty('party3')}
                            className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                              activeParty === 'party3'
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'text-slate-700 hover:bg-white/60'
                            }`}
                          >
                            Party 3: {party3Name || 'Signer 3'}
                          </button>
                        )}
                      </div>

                      <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                        <span>Step:</span>
                        {[1, 2, 5].map(stepVal => (
                          <button
                            key={stepVal}
                            type="button"
                            onClick={() => setStepPercent(stepVal)}
                            className={`px-1.5 py-0.5 rounded border text-[10px] font-mono cursor-pointer ${
                              stepPercent === stepVal
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-600 border-slate-200'
                            }`}
                          >
                            {stepVal}%
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Presets */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                      <span className="text-[11px] text-slate-500 whitespace-nowrap">Presets:</span>
                      <button
                        type="button"
                        onClick={() => applyPreset('columns')}
                        className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-300 rounded text-slate-700 font-medium whitespace-nowrap shadow-2xs cursor-pointer"
                      >
                        Columns Layout
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('stacked')}
                        className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-300 rounded text-slate-700 font-medium whitespace-nowrap shadow-2xs cursor-pointer"
                      >
                        Stacked Layout
                      </button>
                    </div>

                    {/* Canvas & Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      {/* Document Canvas */}
                      <div className="md:col-span-6 bg-slate-100 p-3 sm:p-4 rounded-lg flex flex-col items-center justify-center">
                        <div className="text-[10px] text-slate-500 mb-1.5 flex items-center gap-1 font-medium">
                          <Move className="w-3 h-3 text-slate-400" />
                          <span>Drag signature boxes directly on document</span>
                        </div>

                        <div
                          ref={canvasRef}
                          onPointerMove={onPointerMoveCanvas}
                          onPointerUp={onPointerUpCanvas}
                          className="w-[280px] sm:w-[320px] h-[420px] bg-white rounded shadow-md border border-slate-300 relative overflow-hidden text-[9px] p-3 select-none touch-none"
                        >
                          <div className="border-b-2 border-slate-800 pb-1 mb-2 font-bold text-slate-800 text-[10px] flex justify-between">
                            <span className="truncate max-w-[200px]">{title || 'CONTRACT AGREEMENT'}</span>
                            <span className="text-[8px] font-normal text-slate-400">Page {targetPage}</span>
                          </div>

                          <div className="h-2 bg-slate-200 rounded w-3/4 mb-1.5" />
                          <div className="h-1.5 bg-slate-100 rounded w-full mb-1" />
                          <div className="h-1.5 bg-slate-100 rounded w-full mb-1" />
                          <div className="h-1.5 bg-slate-100 rounded w-5/6 mb-3" />
                          <div className="h-2 bg-slate-200 rounded w-2/3 mb-1.5" />
                          <div className="h-1.5 bg-slate-100 rounded w-full mb-1" />
                          <div className="h-1.5 bg-slate-100 rounded w-4/5 mb-3" />

                          {/* Party 1 Box */}
                          <div
                            onPointerDown={e => onPointerDownBox(e, 'party1')}
                            style={{
                              position: 'absolute',
                              left: `${p1X}%`,
                              top: `${p1Y}%`,
                              width: `${p1W}%`,
                              height: `${Math.max(4, p1H * 1.5)}%`
                            }}
                            className={`rounded p-1 flex flex-col justify-between cursor-move transition-all select-none shadow-sm ${
                              activeParty === 'party1'
                                ? 'border-2 border-blue-600 bg-blue-500/20 ring-2 ring-blue-400 ring-offset-1 z-10'
                                : 'border-2 border-blue-400/80 bg-blue-50/80 z-0'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[7px] font-bold text-blue-950 truncate">
                              <span className="truncate">P1: {party1Name || 'Signer 1'}</span>
                              <span className="text-[6.5px] font-mono opacity-80">{p1W}%</span>
                            </div>
                            <div className="border-b border-blue-500 border-dashed" />
                            <div className="text-[6.5px] text-blue-800 flex justify-between">
                              <span>Signature</span>
                              <span className="font-mono">{p1X}%, {p1Y}%</span>
                            </div>
                          </div>

                          {/* Party 2 Box */}
                          {partyCount >= 2 && (
                            <div
                              onPointerDown={e => onPointerDownBox(e, 'party2')}
                              style={{
                                position: 'absolute',
                                left: `${p2X}%`,
                                top: `${p2Y}%`,
                                width: `${p2W}%`,
                                height: `${Math.max(4, p2H * 1.5)}%`
                              }}
                              className={`rounded p-1 flex flex-col justify-between cursor-move transition-all select-none shadow-sm ${
                                activeParty === 'party2'
                                ? 'border-2 border-emerald-600 bg-emerald-500/20 ring-2 ring-emerald-400 ring-offset-1 z-10'
                                : 'border-2 border-emerald-400/80 bg-emerald-50/80 z-0'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[7px] font-bold text-emerald-950 truncate">
                                <span className="truncate">P2: {party2Name || 'Signer 2'}</span>
                                <span className="text-[6.5px] font-mono opacity-80">{p2W}%</span>
                              </div>
                              <div className="border-b border-emerald-500 border-dashed" />
                              <div className="text-[6.5px] text-emerald-800 flex justify-between">
                                <span>Signature</span>
                                <span className="font-mono">{p2X}%, {p2Y}%</span>
                              </div>
                            </div>
                          )}

                          {/* Party 3 Box */}
                          {partyCount === 3 && (
                            <div
                              onPointerDown={e => onPointerDownBox(e, 'party3')}
                              style={{
                                position: 'absolute',
                                left: `${p3X}%`,
                                top: `${p3Y}%`,
                                width: `${p3W}%`,
                                height: `${Math.max(4, p3H * 1.5)}%`
                              }}
                              className={`rounded p-1 flex flex-col justify-between cursor-move transition-all select-none shadow-sm ${
                                activeParty === 'party3'
                                ? 'border-2 border-purple-600 bg-purple-500/20 ring-2 ring-purple-400 ring-offset-1 z-10'
                                : 'border-2 border-purple-400/80 bg-purple-50/80 z-0'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[7px] font-bold text-purple-950 truncate">
                                <span className="truncate">P3: {party3Name || 'Signer 3'}</span>
                                <span className="text-[6.5px] font-mono opacity-80">{p3W}%</span>
                              </div>
                              <div className="border-b border-purple-500 border-dashed" />
                              <div className="text-[6.5px] text-purple-800 flex justify-between">
                                <span>Signature</span>
                                <span className="font-mono">{p3X}%, {p3Y}%</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Direction & Sizing Controls */}
                      <div className="md:col-span-6 space-y-3.5 text-xs">
                        <div
                          className={`p-3 rounded-lg border flex items-center justify-between ${
                            activeParty === 'party1'
                              ? 'bg-blue-50/80 border-blue-200 text-blue-950'
                              : activeParty === 'party2'
                              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                              : 'bg-purple-50/80 border-purple-200 text-purple-950'
                          }`}
                        >
                          <div>
                            <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 block">
                              Active Target
                            </span>
                            <strong className="text-sm">{curName}</strong>
                          </div>
                          <div className="text-right font-mono text-[11px]">
                            <div>Pos: X={curX}%, Y={curY}%</div>
                            <div>Size: W={curW}%, H={curH}%</div>
                          </div>
                        </div>

                        {/* Direction Pad */}
                        <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <Move className="w-3.5 h-3.5 text-slate-600" />
                              <span>Position Controls</span>
                            </span>
                            <span className="text-[10px] text-slate-400">Step: {stepPercent}%</span>
                          </div>

                          <div className="flex items-center justify-center gap-4 py-1">
                            <div className="grid grid-cols-3 gap-1 w-32">
                              <div />
                              <button
                                type="button"
                                onClick={() => nudge('up')}
                                className="p-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-800 flex items-center justify-center cursor-pointer"
                              >
                                <ArrowUp className="w-4 h-4" />
                              </button>
                              <div />

                              <button
                                type="button"
                                onClick={() => nudge('left')}
                                className="p-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-800 flex items-center justify-center cursor-pointer"
                              >
                                <ArrowLeft className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => snapPosition('center')}
                                className="p-2 bg-slate-200 hover:bg-slate-300 rounded text-slate-700 text-[10px] font-bold flex items-center justify-center cursor-pointer"
                              >
                                MID
                              </button>
                              <button
                                type="button"
                                onClick={() => nudge('right')}
                                className="p-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-800 flex items-center justify-center cursor-pointer"
                              >
                                <ArrowRight className="w-4 h-4" />
                              </button>

                              <div />
                              <button
                                type="button"
                                onClick={() => nudge('down')}
                                className="p-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-800 flex items-center justify-center cursor-pointer"
                              >
                                <ArrowDown className="w-4 h-4" />
                              </button>
                              <div />
                            </div>

                            <div className="flex flex-col gap-1 text-[11px]">
                              <span className="text-[10px] text-slate-400 font-semibold uppercase">Snap</span>
                              <div className="grid grid-cols-2 gap-1">
                                <button type="button" onClick={() => snapPosition('top')} className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded cursor-pointer">Top</button>
                                <button type="button" onClick={() => snapPosition('bottom')} className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded cursor-pointer">Bottom</button>
                                <button type="button" onClick={() => snapPosition('left')} className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded cursor-pointer">Left</button>
                                <button type="button" onClick={() => snapPosition('right')} className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded cursor-pointer">Right</button>
                              </div>
                            </div>
                          </div>

                          {/* Sliders */}
                          <div className="pt-2 border-t border-slate-100 space-y-2">
                            <div>
                              <div className="flex justify-between text-[11px] text-slate-700 mb-0.5">
                                <span>X Position:</span>
                                <span className="font-mono font-bold">{curX}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="0.5"
                                value={curX}
                                onChange={e => {
                                  const val = parseFloat(e.target.value);
                                  if (activeParty === 'party1') setP1X(val);
                                  else if (activeParty === 'party2') setP2X(val);
                                  else setP3X(val);
                                }}
                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>

                            <div>
                              <div className="flex justify-between text-[11px] text-slate-700 mb-0.5">
                                <span>Y Position:</span>
                                <span className="font-mono font-bold">{curY}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="0.5"
                                value={curY}
                                onChange={e => {
                                  const val = parseFloat(e.target.value);
                                  if (activeParty === 'party1') setP1Y(val);
                                  else if (activeParty === 'party2') setP2Y(val);
                                  else setP3Y(val);
                                }}
                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Sizing Width & Height */}
                        <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
                              <span>Resize Box (1% - 100%)</span>
                            </span>
                            <div className="flex items-center gap-1">
                              {[25, 36, 50, 80].map(wVal => (
                                <button
                                  key={wVal}
                                  type="button"
                                  onClick={() => setDimensions(wVal)}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono border cursor-pointer ${
                                    curW === wVal ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  {wVal}%
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between text-[11px] text-slate-700 mb-1">
                              <span>Width: <strong className="font-mono text-blue-700">{curW}%</strong></span>
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={() => adjustWidth(-2)} className="w-5 h-5 bg-slate-100 hover:bg-slate-200 rounded font-bold cursor-pointer">-</button>
                                <button type="button" onClick={() => adjustWidth(2)} className="w-5 h-5 bg-slate-100 hover:bg-slate-200 rounded font-bold cursor-pointer">+</button>
                              </div>
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="100"
                              step="0.5"
                              value={curW}
                              onChange={e => {
                                const val = parseFloat(e.target.value);
                                if (activeParty === 'party1') setP1W(val);
                                else if (activeParty === 'party2') setP2W(val);
                                else setP3W(val);
                              }}
                              className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between text-[11px] text-slate-700 mb-1">
                              <span>Height: <strong className="font-mono text-blue-700">{curH}%</strong></span>
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={() => adjustHeight(-1)} className="w-5 h-5 bg-slate-100 hover:bg-slate-200 rounded font-bold cursor-pointer">-</button>
                                <button type="button" onClick={() => adjustHeight(1)} className="w-5 h-5 bg-slate-100 hover:bg-slate-200 rounded font-bold cursor-pointer">+</button>
                              </div>
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="100"
                              step="0.5"
                              value={curH}
                              onChange={e => {
                                const val = parseFloat(e.target.value);
                                if (activeParty === 'party1') setP1H(val);
                                else if (activeParty === 'party2') setP2H(val);
                                else setP3H(val);
                              }}
                              className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Dispatch checkbox */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendInvitationsNow}
                      onChange={e => setSendInvitationsNow(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-900">
                        Dispatch Electronic Invitations Immediately
                      </span>
                      <p className="text-[11px] text-slate-500">
                        {partyCount === 1
                          ? 'Party 1 will receive their secure signing token link immediately.'
                          : signingOrder === 'sequential'
                          ? 'Party 1 will receive their invitation immediately. Next parties will be invited in sequential order.'
                          : 'All signatories will receive invitations simultaneously.'}
                      </p>
                    </div>
                  </label>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Internal HR Audit Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter internal audit remarks or approval notes"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full text-xs p-2.5 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                  />
                </div>
              </div>
            )}

            {/* Bottom Dialog Action Footer */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep(step - 1)}
                    className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    ← Back
                  </button>
                )}
              </div>

              {step < 4 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (step === 1 && !title.trim()) {
                      setErrorMsg('Please provide a contract title');
                      return;
                    }
                    if (step === 2) {
                      if (!party1Name || !party1Email) {
                        setErrorMsg('Please fill in Party 1 name and email');
                        return;
                      }
                      if (partyCount >= 2 && (!party2Name || !party2Email)) {
                        setErrorMsg('Please fill in Party 2 name and email');
                        return;
                      }
                      if (partyCount === 3 && (!party3Name || !party3Email)) {
                        setErrorMsg('Please fill in Party 3 name and email');
                        return;
                      }
                    }
                    setErrorMsg(null);
                    setStep(step + 1);
                  }}
                  className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-white bg-[#ff1e27] hover:bg-[#e0121b] rounded-lg transition-all shadow-md shadow-red-500/25 cursor-pointer"
                >
                  Next Step →
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-extrabold uppercase tracking-wider text-white bg-[#ff1e27] hover:bg-[#e0121b] rounded-lg transition-all shadow-lg shadow-red-500/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting
                    ? 'Creating Contract...'
                    : sendInvitationsNow
                    ? 'Create & Dispatch Contract'
                    : 'Save as Draft'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Category Manager Modal */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCategoriesChanged={refreshCategories}
      />
    </>
  );
};
