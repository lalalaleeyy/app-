import React, { useState, useRef, useEffect } from 'react';
import { 
  PenTool, 
  Type, 
  Upload as UploadIcon, 
  RotateCcw, 
  Image as ImageIcon, 
  FileText, 
  Sparkles, 
  CircleCheck 
} from 'lucide-react';
import { getErrorMessage } from '../services/security';

interface SignaturePadProps {
  signerName: string;
  onSignatureReady: (signature: { signatureImage: string; signatureMethod: 'draw' | 'type' | 'upload' }) => void;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  signerName,
  onSignatureReady
}) => {
  const [activeTab, setActiveTab] = useState<'draw' | 'type' | 'upload'>('draw');
  const [selectedColor, setSelectedColor] = useState('#060b1e');
  const [typedName, setTypedName] = useState(signerName || '');
  const [isDrawn, setIsDrawn] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedSignatureUrl, setUploadedSignatureUrl] = useState<string | null>(null);
  const [removeBackground, setRemoveBackground] = useState(true);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Setup canvas
  useEffect(() => {
    if (activeTab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = selectedColor;
    }
  }, [activeTab, selectedColor]);

  // Generate typed signature when tab or name changes
  useEffect(() => {
    if (activeTab === 'type' && typedName.trim()) {
      const canvas = document.createElement('canvas');
      canvas.width = 460;
      canvas.height = 120;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = selectedColor;
        ctx.font = 'italic 44px "Dancing Script", cursive';
        ctx.textBaseline = 'middle';
        ctx.fillText(typedName, 20, 60);

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(6, 11, 30, 0.2)';
        ctx.lineWidth = 1;
        ctx.moveTo(20, 95);
        ctx.lineTo(420, 95);
        ctx.stroke();

        onSignatureReady({
          signatureImage: canvas.toDataURL('image/png'),
          signatureMethod: 'type'
        });
      }
    }
  }, [activeTab, typedName, selectedColor, onSignatureReady]);

  const getCanvasPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const { x, y } = getCanvasPos(e);
    ctx.strokeStyle = selectedColor;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawn(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.closePath();
    isDrawingRef.current = false;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {}

    onSignatureReady({
      signatureImage: canvas.toDataURL('image/png'),
      signatureMethod: 'draw'
    });
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setIsDrawn(false);
    }
  };

  // Upload handler
  const processUploadedImage = (file: File, isTransparent: boolean) => {
    setIsProcessingUpload(true);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = e => {
      const img = new window.Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let w = img.width;
          let h = img.height;

          if (w > 500 || h > 150) {
            const scale = Math.min(500 / w, 150 / h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }

          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas context unavailable');

          ctx.drawImage(img, 0, 0, w, h);

          if (isTransparent) {
            const imgData = ctx.getImageData(0, 0, w, h);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
              if (brightness > 200) {
                data[i + 3] = 0;
              } else {
                data[i] = Math.min(r, 20);
                data[i + 1] = Math.min(g, 30);
                data[i + 2] = Math.min(b, 50);
              }
            }
            ctx.putImageData(imgData, 0, 0);
          }

          const signatureDataUrl = canvas.toDataURL('image/png');
          setUploadedSignatureUrl(signatureDataUrl);
          onSignatureReady({
            signatureImage: signatureDataUrl,
            signatureMethod: 'upload'
          });
        } catch (err) {
          setUploadError('Failed to process image: ' + getErrorMessage(err));
        } finally {
          setIsProcessingUpload(false);
        }
      };
      img.onerror = () => {
        setUploadError('Invalid image file format');
        setIsProcessingUpload(false);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      setUploadError('Failed to read file');
      setIsProcessingUpload(false);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      processUploadedImage(file, removeBackground);
    }
  };

  return (
    <div className="space-y-3">
      {/* Tab Selector & Ink Color */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-[#060b1e] p-1 rounded-lg text-xs border border-[#162354]">
          <button
            type="button"
            onClick={() => setActiveTab('draw')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold transition-all uppercase tracking-wider text-[11px] cursor-pointer ${
              activeTab === 'draw'
                ? 'bg-[#ff1e27] text-white shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Draw</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('type')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold transition-all uppercase tracking-wider text-[11px] cursor-pointer ${
              activeTab === 'type'
                ? 'bg-[#ff1e27] text-white shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span>Type Name</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold transition-all uppercase tracking-wider text-[11px] cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-[#ff1e27] text-white shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <UploadIcon className="w-3.5 h-3.5" />
            <span>Upload Photo / Scan</span>
          </button>
        </div>

        {activeTab !== 'upload' && (
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span className="text-[10px] uppercase font-bold text-[#060b1e]">INK:</span>
            <button
              type="button"
              onClick={() => setSelectedColor('#060b1e')}
              className={`w-5 h-5 rounded-full border-2 cursor-pointer ${
                selectedColor === '#060b1e'
                  ? 'ring-2 ring-[#ff1e27] ring-offset-1 border-white'
                  : 'border-slate-300'
              }`}
              style={{ backgroundColor: '#060b1e' }}
              title="Navy Black"
            />
            <button
              type="button"
              onClick={() => setSelectedColor('#162354')}
              className={`w-5 h-5 rounded-full border-2 cursor-pointer ${
                selectedColor === '#162354'
                  ? 'ring-2 ring-[#ff1e27] ring-offset-1 border-white'
                  : 'border-slate-300'
              }`}
              style={{ backgroundColor: '#162354' }}
              title="Dark Blue"
            />
            <button
              type="button"
              onClick={() => setSelectedColor('#ff1e27')}
              className={`w-5 h-5 rounded-full border-2 cursor-pointer ${
                selectedColor === '#ff1e27'
                  ? 'ring-2 ring-[#060b1e] ring-offset-1 border-white'
                  : 'border-slate-300'
              }`}
              style={{ backgroundColor: '#ff1e27' }}
              title="Ignite Red Ink"
            />
          </div>
        )}
      </div>

      {/* DRAW TAB */}
      {activeTab === 'draw' && (
        <div>
          <div className="relative border-2 border-dashed border-slate-300 rounded-lg bg-slate-50/50 overflow-hidden touch-none">
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="w-full h-36 cursor-crosshair block"
            />
            {!isDrawn && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-xs text-slate-400">
                Use your finger, stylus, or mouse to draw your signature here
              </div>
            )}
            <div className="absolute bottom-2 left-3 text-[10px] text-slate-400 pointer-events-none font-mono">
              x ──────────────────────────────
            </div>
          </div>
          <div className="flex justify-end mt-1.5">
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear Canvas</span>
            </button>
          </div>
        </div>
      )}

      {/* TYPE TAB */}
      {activeTab === 'type' && (
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Enter Your Full Legal Name
            </label>
            <input
              type="text"
              value={typedName}
              onChange={e => setTypedName(e.target.value)}
              placeholder="Enter your full legal name"
              className="w-full text-xs px-3 py-2 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
            />
          </div>

          <div className="border border-slate-200 rounded-lg p-6 bg-slate-50/60 text-center min-h-[90px] flex flex-col justify-center">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
              Handwritten Typography Preview
            </div>
            <div
              className="text-4xl text-slate-900 select-none py-2"
              style={{ fontFamily: "'Dancing Script', cursive", color: selectedColor }}
            >
              {typedName || 'Your Signature'}
            </div>
            <div className="border-b border-slate-300 w-3/4 mx-auto mt-1" />
          </div>
        </div>
      )}

      {/* UPLOAD TAB */}
      {activeTab === 'upload' && (
        <div className="space-y-3">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-lg p-5 text-center bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex items-center justify-center gap-2 mb-2 text-slate-500">
              <ImageIcon className="w-5 h-5 text-blue-600" />
              <FileText className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-xs font-semibold text-slate-900">
              {uploadedFile ? uploadedFile.name : 'Upload Photo of Signature or Scan'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Supports Smartphone Photos, Scanned Documents, PNG or JPG signatures
            </p>
            <button
              type="button"
              className="mt-3 px-3 py-1 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded hover:bg-slate-50 shadow-xs cursor-pointer"
            >
              {uploadedFile ? 'Change File' : 'Browse Files / Take Photo'}
            </button>
          </div>

          {uploadError && (
            <div className="text-xs text-rose-600 p-2 bg-rose-50 border border-rose-200 rounded">
              {uploadError}
            </div>
          )}

          {uploadedSignatureUrl && (
            <div className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <CircleCheck className="w-4 h-4 text-emerald-600" />
                  <span>Captured Signature Preview</span>
                </span>
                <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-600 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Remove Paper Background</span>
                  <input
                    type="checkbox"
                    checked={removeBackground}
                    onChange={e => {
                      setRemoveBackground(e.target.checked);
                      if (uploadedFile) processUploadedImage(uploadedFile, e.target.checked);
                    }}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                </label>
              </div>

              <div
                className="w-full h-24 rounded border border-slate-200 flex items-center justify-center p-3 relative overflow-hidden"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)',
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
                }}
              >
                <img
                  src={uploadedSignatureUrl}
                  alt="Uploaded signature"
                  className="max-h-full max-w-full object-contain filter drop-shadow-xs"
                />
              </div>
              <p className="text-[10px] text-slate-400">
                This uploaded signature will be embedded onto the designated signature field and cryptographically sealed on the Audit Certificate of Completion.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
