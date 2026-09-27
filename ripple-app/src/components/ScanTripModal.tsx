// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: ScanTripModal.tsx
// PURPOSE: Modal for scanning a trip shared by someone else.
//   Two modes:
//     1. QR Camera Scan — uses native BarcodeDetector API (Chrome/Edge/Safari 17+)
//        with a graceful fallback for unsupported browsers.
//     2. 6-digit hex code — manual entry field that resolves to a trip via
//        getSharedTripByCode / getSharedTrip.
//
//   On success resolves the itinerary and hands it to addImportedItinerary.
//   If allowEdit is false the trip is imported read-only (same data, the
//   caller simply doesn't receive edit affordances from SharedTripView).
// =============================================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, QrCode, Hash, Loader2, CheckCircle2, AlertCircle, Camera, CameraOff,
} from 'lucide-react';
import { getSharedTrip, getSharedTripByCode } from '../lib/cloudTripStorage';
import type { Itinerary } from '../lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ScanTab = 'qr' | 'code';
type ScanStatus = 'idle' | 'scanning' | 'loading' | 'success' | 'error';

interface Props {
  onClose: () => void;
  onImport: (itinerary: Itinerary, allowEdit: boolean) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Extract a planB share token from a scanned URL or raw token string. */
function extractTokenFromScan(raw: string): string | null {
  raw = raw.trim();
  // Full URL: https://…/share/<token>
  try {
    const url = new URL(raw);
    const parts = url.pathname.split('/');
    const shareIdx = parts.indexOf('share');
    if (shareIdx !== -1 && parts[shareIdx + 1]) {
      return decodeURIComponent(parts[shareIdx + 1]);
    }
  } catch {
    // Not a URL — treat as raw token
  }
  // Raw token (compressed or cloud hex)
  if (raw.startsWith('z_') || raw.startsWith('local_') || /^[0-9a-f]{12}$/.test(raw)) {
    return raw;
  }
  return null;
}

/** True if BarcodeDetector is available and supports QR codes. */
async function isBarcodeDetectorSupported(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return false;
    // @ts-expect-error — BarcodeDetector is not in TS lib yet
    const formats = await window.BarcodeDetector.getSupportedFormats();
    return (formats as string[]).includes('qr_code');
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// QR Camera Tab
// ---------------------------------------------------------------------------
function QrCameraTab({ onToken }: { onToken: (token: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const detectorRef = useRef<unknown>(null);

  const [camState, setCamState] = useState<'checking' | 'unsupported' | 'denied' | 'active' | 'error'>('checking');
  const [hint, setHint] = useState('Checking camera…');

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startScanning = useCallback(async () => {
    setCamState('checking');
    setHint('Checking camera…');

    const supported = await isBarcodeDetectorSupported();
    if (!supported) {
      setCamState('unsupported');
      setHint('QR scanning isn\'t supported in this browser. Use the code tab instead.');
      return;
    }

    // @ts-expect-error — BarcodeDetector not in TS lib
    detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch (err) {
      const e = err as DOMException;
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setCamState('denied');
        setHint('Camera access was denied. Allow camera access or use the code tab.');
      } else {
        setCamState('error');
        setHint('Could not access camera. Try the code tab instead.');
      }
      return;
    }

    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
    setCamState('active');
    setHint('Point the camera at a planB QR code');

    // Tick — detect every ~300 ms
    let lastTick = 0;
    const tick = async (ts: number) => {
      if (ts - lastTick > 300) {
        lastTick = ts;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const detector = detectorRef.current as { detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } | null;
        if (video && canvas && detector && video.readyState === 4) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            try {
              const codes = await detector.detect(video);
              if (codes.length > 0) {
                const token = extractTokenFromScan(codes[0].rawValue);
                if (token) {
                  stopCamera();
                  onToken(token);
                  return;
                }
              }
            } catch {
              // detection frame error — continue
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopCamera, onToken]);

  useEffect(() => {
    startScanning();
    return () => stopCamera();
  }, [startScanning, stopCamera]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Video preview */}
      <div className="relative w-full max-w-xs aspect-square rounded-2xl overflow-hidden bg-gray-900 border border-gray-200">
        <video
          ref={videoRef}
          muted
          playsInline
          className={`absolute inset-0 w-full h-full object-cover ${camState === 'active' ? 'opacity-100' : 'opacity-0'}`}
          aria-hidden="true"
        />
        {/* Hidden canvas used for BarcodeDetector */}
        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

        {/* Overlay when camera isn't active */}
        {camState !== 'active' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
            {camState === 'checking' ? (
              <Loader2 size={28} className="text-white animate-spin" />
            ) : camState === 'unsupported' ? (
              <QrCode size={28} className="text-white/50" />
            ) : camState === 'denied' ? (
              <CameraOff size={28} className="text-white/50" />
            ) : (
              <Camera size={28} className="text-white/50" />
            )}
          </div>
        )}

        {/* Scan target frame when active */}
        {camState === 'active' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 relative">
              {/* Four corner brackets */}
              {(['tl','tr','bl','br'] as const).map((c) => (
                <span
                  key={c}
                  className="absolute w-8 h-8 border-white"
                  style={{
                    borderTopWidth:    c.startsWith('t') ? 3 : 0,
                    borderBottomWidth: c.startsWith('b') ? 3 : 0,
                    borderLeftWidth:   c.endsWith('l')   ? 3 : 0,
                    borderRightWidth:  c.endsWith('r')   ? 3 : 0,
                    top:    c.startsWith('t') ? 0 : 'auto',
                    bottom: c.startsWith('b') ? 0 : 'auto',
                    left:   c.endsWith('l')   ? 0 : 'auto',
                    right:  c.endsWith('r')   ? 0 : 'auto',
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 text-center max-w-xs">{hint}</p>

      {(camState === 'unsupported' || camState === 'denied' || camState === 'error') && (
        <p className="text-2xs text-gray-400 text-center">
          Chrome, Edge, and Safari 17+ support camera scanning. Switch to the code tab to enter manually.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6-digit code tab
// ---------------------------------------------------------------------------
function CodeEntryTab({
  onToken,
  loading,
}: {
  onToken: (token: string) => void;
  loading: boolean;
}) {
  const [code, setCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow hex chars, max 6
    const val = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
    setCode(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === 6) onToken(code.toLowerCase());
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-5">
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-gray-800">Enter the 6-digit share code</p>
        <p className="text-xs text-gray-500">
          Ask the trip owner to open their itinerary → Share → and copy the code shown there.
        </p>
      </div>

      {/* Large hex input */}
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        value={code}
        onChange={handleChange}
        placeholder="a3f1b9"
        disabled={loading}
        maxLength={6}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="w-48 text-center px-4 py-3 text-2xl font-mono font-bold tracking-[0.35em] uppercase border-2 rounded-2xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all disabled:opacity-50"
        style={{ borderColor: code.length === 6 ? '#2563eb' : '#e5e7eb' }}
        aria-label="6-digit trip share code"
      />

      {/* Character dots */}
      <div className="flex gap-2" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full transition-colors"
            style={{ backgroundColor: i < code.length ? '#2563eb' : '#e5e7eb' }}
          />
        ))}
      </div>

      <button
        type="submit"
        disabled={code.length !== 6 || loading}
        className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        style={{ backgroundColor: '#0A1E30' }}
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Hash size={15} />}
        {loading ? 'Looking up…' : 'Find trip'}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main Modal
// ---------------------------------------------------------------------------
export default function ScanTripModal({ onClose, onImport }: Props) {
  const [tab, setTab] = useState<ScanTab>('qr');
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [resolvedTrip, setResolvedTrip] = useState<Itinerary | null>(null);
  const [resolvedAllowEdit, setResolvedAllowEdit] = useState(false);

  const resolveToken = useCallback(async (token: string) => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const result = await getSharedTrip(token);
      if (!result) {
        setStatus('error');
        setErrorMsg('No trip found for this code. Double-check and try again.');
        return;
      }
      setResolvedTrip(result.itinerary);
      setResolvedAllowEdit(result.allowEdit);
      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong while fetching the trip. Please try again.');
    }
  }, []);

  const resolveCode = useCallback(async (code: string) => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const result = await getSharedTripByCode(code);
      if (!result) {
        setStatus('error');
        setErrorMsg('No trip found for this code. Double-check and try again.');
        return;
      }
      setResolvedTrip(result.itinerary);
      setResolvedAllowEdit(result.allowEdit);
      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong while fetching the trip. Please try again.');
    }
  }, []);

  const handleConfirmImport = useCallback(() => {
    if (!resolvedTrip) return;
    onImport(resolvedTrip, resolvedAllowEdit);
    onClose();
  }, [resolvedTrip, resolvedAllowEdit, onImport, onClose]);

  const handleRetry = useCallback(() => {
    setStatus('idle');
    setErrorMsg('');
    setResolvedTrip(null);
  }, []);

  const isLoading = status === 'loading';

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <QrCode size={16} />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-gray-900">Scan a trip</h3>
              <p className="text-xs text-gray-500">Import a trip shared by someone else</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        {status !== 'success' && (
          <div className="px-6 pt-4 flex gap-2">
            <button
              onClick={() => { setTab('qr'); setStatus('idle'); setErrorMsg(''); }}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                tab === 'qr'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Camera size={13} />
              <span>Scan QR</span>
            </button>
            <button
              onClick={() => { setTab('code'); setStatus('idle'); setErrorMsg(''); }}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                tab === 'code'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Hash size={13} />
              <span>Enter code</span>
            </button>
          </div>
        )}

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <div className="p-6">

          {/* Loading spinner */}
          {isLoading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 size={28} className="text-blue-600 animate-spin" />
              <p className="text-sm text-gray-500">Fetching shared trip…</p>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center">
                <AlertCircle size={22} className="text-rose-500" />
              </div>
              <p className="text-sm text-gray-700 font-medium">{errorMsg}</p>
              <button
                onClick={handleRetry}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          )}

          {/* Success state */}
          {status === 'success' && resolvedTrip && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{resolvedTrip.destination}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {resolvedTrip.travelerName} · {resolvedTrip.bookings.length} segment{resolvedTrip.bookings.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Permission badge */}
              <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-medium ${
                resolvedAllowEdit
                  ? 'bg-blue-50 border-blue-100 text-blue-700'
                  : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}>
                {resolvedAllowEdit ? (
                  <>
                    <span className="text-lg leading-none">✏️</span>
                    <span>The owner has <strong>allowed editing</strong> — you can modify this trip after importing.</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg leading-none">👁️</span>
                    <span>The owner shared this as <strong>view-only</strong>.</span>
                  </>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleRetry}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer transition-colors"
                >
                  Scan another
                </button>
                <button
                  onClick={handleConfirmImport}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer transition-colors"
                  style={{ backgroundColor: '#0A1E30' }}
                >
                  {resolvedAllowEdit ? 'Import & edit' : 'Add to my trips'}
                </button>
              </div>
            </div>
          )}

          {/* Idle tab content */}
          {status === 'idle' && tab === 'qr' && (
            <QrCameraTab onToken={resolveToken} />
          )}
          {status === 'idle' && tab === 'code' && (
            <CodeEntryTab onToken={resolveCode} loading={false} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
