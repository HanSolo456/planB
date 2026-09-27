// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: ImportView.tsx
// PURPOSE: Full import flow — paste OR file upload → extract → review/edit → confirm.
// =============================================================================

import { useState, useCallback, useRef, useDeferredValue } from 'react';
import {
  Sparkles, RotateCcw, Check, AlertTriangle, ChevronRight,
  Paperclip, X, Plane, Train, Hotel, Car, Compass, CalendarClock,
  MapPin, Clock, Wallet, Edit3, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { Itinerary, Booking } from '../lib/types';
import { extractItineraryFromText, IMPORT_PRESETS } from '../lib/importEngine';
import {
  processFiles,
  extractItineraryFromImages,
  ACCEPTED_EXTENSIONS,
  type FileError,
} from '../lib/fileImportEngine';
import { useAppState } from '../App';

type ViewState = 'PASTE' | 'LOADING' | 'REVIEW' | 'ERROR';
type InputTab  = 'paste' | 'upload';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtDateTimeLocal(iso: string): string {
  // Convert ISO → datetime-local input value (YYYY-MM-DDTHH:MM)
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ''; }
}

function localToISO(local: string, originalIso: string): string {
  // Preserve original timezone offset when converting back
  const offsetMatch = originalIso.match(/([+-]\d{2}:\d{2})$/);
  const offset = offsetMatch ? offsetMatch[1] : '+05:30';
  return local ? `${local}:00${offset}` : originalIso;
}

function fmtDisplayTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch { return iso; }
}

const BOOKING_TYPES: Booking['type'][] = ['flight', 'train', 'hotel', 'transfer', 'activity', 'event'];

const TYPE_META: Record<Booking['type'], { label: string; Icon: React.ElementType; color: string; bg: string }> = {
  flight:   { label: 'Flight',   Icon: Plane,         color: '#374151', bg: '#F3F4F6' },
  train:    { label: 'Train',    Icon: Train,         color: '#374151', bg: '#F3F4F6' },
  hotel:    { label: 'Hotel',    Icon: Hotel,         color: '#374151', bg: '#F3F4F6' },
  transfer: { label: 'Transfer', Icon: Car,           color: '#374151', bg: '#F3F4F6' },
  activity: { label: 'Activity', Icon: Compass,       color: '#374151', bg: '#F3F4F6' },
  event:    { label: 'Event',    Icon: CalendarClock, color: '#374151', bg: '#F3F4F6' },
};

// ---------------------------------------------------------------------------
// Type selector dropdown
// ---------------------------------------------------------------------------
function TypeSelector({ value, onChange }: { value: Booking['type']; onChange: (v: Booking['type']) => void }) {
  const [open, setOpen] = useState(false);
  const meta = TYPE_META[value];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border cursor-pointer transition-colors bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"
      >
        <meta.Icon size={12} />
        {meta.label}
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden min-w-[140px]">
          {BOOKING_TYPES.map(t => {
            const m = TYPE_META[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => { onChange(t); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-left text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <m.Icon size={12} className="text-gray-500" />
                {m.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline field component — click label to edit
// ---------------------------------------------------------------------------
function EditableField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  prefix,
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  prefix?: string;
  icon?: React.ElementType;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      <div className="relative flex items-center">
        {Icon && <Icon size={13} className="absolute left-2.5 text-gray-400 pointer-events-none" />}
        {prefix && (
          <span className="absolute left-2.5 text-xs text-gray-400 pointer-events-none select-none">{prefix}</span>
        )}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 focus:bg-white transition-all"
          style={{
            paddingLeft: Icon ? '2rem' : prefix ? `${prefix.length * 0.55 + 1.75}rem` : '0.75rem',
            paddingRight: '0.75rem',
            paddingTop: '0.5rem',
            paddingBottom: '0.5rem',
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReviewCard — full editable booking card
// ---------------------------------------------------------------------------
interface ReviewCardProps {
  booking: Booking;
  index: number;
  total: number;
  onChange: (updated: Booking) => void;
  onDelete: () => void;
}

function ReviewCard({ booking, index, total, onChange, onDelete }: ReviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = TYPE_META[booking.type];
  const locationName =
    booking.location.type === 'named'
      ? booking.location.name
      : (booking.location as { label?: string }).label ?? '';

  const handleLocationChange = (v: string) => {
    onChange({ ...booking, location: { type: 'named', name: v } });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm transition-shadow hover:shadow-md">
      {/* Card header — always visible */}
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          {/* Type icon circle */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ backgroundColor: meta.bg, color: meta.color }}
          >
            <meta.Icon size={16} />
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            {/* Title — always editable inline */}
            <input
              id={`review-title-${booking.id}`}
              type="text"
              value={booking.title}
              onChange={e => onChange({ ...booking, title: e.target.value })}
              className="w-full text-base font-semibold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none transition-colors pb-0.5"
              placeholder="Booking title"
              aria-label="Booking title"
            />
            {/* Provider — always editable inline */}
            <input
              id={`review-provider-${booking.id}`}
              type="text"
              value={booking.provider}
              onChange={e => onChange({ ...booking, provider: e.target.value })}
              className="w-full text-sm text-gray-500 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none transition-colors mt-0.5 pb-0.5"
              placeholder="Provider / operator"
              aria-label="Provider"
            />
          </div>

          {/* Right: index pill + type selector + expand */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs font-semibold text-gray-400 tabular-nums">{index + 1}/{total}</span>
            <TypeSelector value={booking.type} onChange={t => onChange({ ...booking, type: t })} />
            <button
              type="button"
              onClick={() => setExpanded(p => !p)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors"
              title={expanded ? 'Collapse' : 'Edit all fields'}
            >
              {expanded ? <ChevronUp size={15} /> : <Edit3 size={14} />}
            </button>
          </div>
        </div>

        {/* Quick summary row — time + location + cost */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 ml-12">
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Clock size={12} className="text-gray-400" />
            {fmtDisplayTime(booking.startTime)}
            <span className="text-gray-300 mx-1">→</span>
            {fmtDisplayTime(booking.endTime)}
          </span>
          {locationName && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <MapPin size={12} className="text-gray-400" />
              {locationName}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Wallet size={12} className="text-gray-400" />
            ₹{booking.cost.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-4">
          {/* Times row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                {booking.type === 'hotel' ? 'Check-in' : booking.type === 'transfer' ? 'Pickup time' : 'Departure'}
              </label>
              <input
                type="datetime-local"
                value={fmtDateTimeLocal(booking.startTime)}
                onChange={e => onChange({ ...booking, startTime: localToISO(e.target.value, booking.startTime) })}
                className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                {booking.type === 'hotel' ? 'Check-out' : booking.type === 'transfer' ? 'Drop-off time' : 'Arrival'}
              </label>
              <input
                type="datetime-local"
                value={fmtDateTimeLocal(booking.endTime)}
                onChange={e => onChange({ ...booking, endTime: localToISO(e.target.value, booking.endTime) })}
                className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
              />
            </div>
          </div>

          {/* Location + cost row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EditableField
              label="Location"
              value={locationName}
              onChange={handleLocationChange}
              placeholder="City, airport, hotel name…"
              icon={MapPin}
            />
            <EditableField
              label="Cost (₹)"
              value={String(booking.cost)}
              onChange={v => onChange({ ...booking, cost: Number(v) || 0 })}
              type="number"
              placeholder="0"
              prefix="₹"
            />
          </div>

          {/* Buffer + cancellation row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Buffer time (minutes)</label>
              <input
                type="number"
                min="0"
                value={booking.bufferMinutes}
                onChange={e => onChange({ ...booking, bufferMinutes: Number(e.target.value) || 0 })}
                className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                placeholder="e.g. 60"
              />
              <p className="text-xs text-gray-400 mt-1">Minimum buffer needed after the previous booking ends</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Cancellation policy</label>
              <select
                value={booking.cancellationPolicy.policy}
                onChange={e => onChange({
                  ...booking,
                  cancellationPolicy: {
                    ...booking.cancellationPolicy,
                    policy: e.target.value as 'free' | 'partial-refund' | 'non-refundable',
                  },
                })}
                className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all cursor-pointer"
              >
                <option value="free">Free cancellation</option>
                <option value="partial-refund">Partial refund</option>
                <option value="non-refundable">Non-refundable</option>
              </select>
            </div>
          </div>

          {/* Delete booking */}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 cursor-pointer transition-colors"
            >
              <X size={12} />
              Remove this booking
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// File chip
// ---------------------------------------------------------------------------
function FileChip({ file, onRemove }: { file: File; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2 min-w-0">
        <Paperclip size={13} className="text-gray-400 shrink-0" />
        <span className="text-sm text-gray-700 truncate">{file.name}</span>
        <span className="text-xs text-gray-400 shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
      </div>
      <button
        onClick={onRemove}
        className="text-gray-400 hover:text-gray-700 cursor-pointer transition-colors shrink-0"
        aria-label={`Remove ${file.name}`}
      >
        <X size={13} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function ImportView() {
  const { addImportedItinerary } = useAppState();

  const [viewState, setViewState]         = useState<ViewState>('PASTE');
  const [extracted, setExtracted]         = useState<Itinerary | null>(null);
  const [errorMessage, setErrorMessage]   = useState('');
  const [progress, setProgress]           = useState(0);
  const [inputTab, setInputTab]           = useState<InputTab>('paste');
  const [rawText, setRawText]             = useState('');
  const [pendingFiles, setPendingFiles]   = useState<File[]>([]);
  const [dropzoneErrors, setDropzoneErrors] = useState<string[]>([]);
  const [fileErrors, setFileErrors]       = useState<FileError[]>();
  const [isDragOver, setIsDragOver]       = useState(false);
  const [loadingLabel, setLoadingLabel]   = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deferredLabel = useDeferredValue(loadingLabel);

  const getExt = (name: string) => { const dot = name.lastIndexOf('.'); return dot >= 0 ? name.slice(dot).toLowerCase() : ''; };

  const addFilesToQueue = useCallback((incoming: File[]) => {
    const valid: File[] = []; const invalid: string[] = [];
    for (const f of incoming) {
      if (ACCEPTED_EXTENSIONS.has(getExt(f.name))) valid.push(f);
      else invalid.push(`"${f.name}" is not supported — accepted: .png .jpg .jpeg .pdf`);
    }
    setDropzoneErrors(invalid.length > 0 ? invalid : []);
    if (valid.length > 0) {
      setPendingFiles(prev => {
        const keys = new Set(prev.map(f => `${f.name}:${f.size}`));
        return [...prev, ...valid.filter(f => !keys.has(`${f.name}:${f.size}`))];
      });
    }
  }, []);

  const removeFile = useCallback((i: number) => setPendingFiles(prev => prev.filter((_, idx) => idx !== i)), []);

  const handleExtractText = useCallback(async () => {
    if (!rawText.trim()) return;
    setViewState('LOADING'); setLoadingLabel(''); setProgress(0); setErrorMessage('');
    const ticker = setInterval(() => setProgress(p => Math.min(p + 3, 90)), 200);
    try {
      const result = await extractItineraryFromText(rawText);
      clearInterval(ticker); setProgress(100); setExtracted(result);
      setTimeout(() => setViewState('REVIEW'), 300);
    } catch (err) {
      clearInterval(ticker);
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setViewState('ERROR');
    }
  }, [rawText]);

  const handleExtractFiles = useCallback(async () => {
    if (pendingFiles.length === 0) return;
    setViewState('LOADING'); setProgress(0); setErrorMessage(''); setFileErrors(undefined);
    const { images, errors } = await processFiles(pendingFiles, (filename, done, total) => {
      setLoadingLabel(`Processing ${filename}… (${done + 1} of ${total})`);
      setProgress(Math.round((done / total) * 60));
    });
    if (errors.length > 0) setFileErrors(errors);
    if (images.length === 0) {
      setErrorMessage(errors.length > 0 ? `No valid images could be extracted:\n${errors.map(e => e.message).join('\n')}` : 'No valid images could be extracted from the selected files.');
      setViewState('ERROR'); return;
    }
    setLoadingLabel('Extracting itinerary from documents…');
    const ticker = setInterval(() => setProgress(p => Math.min(p + 2, 95)), 300);
    try {
      const result = await extractItineraryFromImages(images);
      clearInterval(ticker); setProgress(100); setExtracted(result);
      setTimeout(() => setViewState('REVIEW'), 300);
    } catch (err) {
      clearInterval(ticker);
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setViewState('ERROR');
    }
  }, [pendingFiles]);

  const handleBookingChange = useCallback((index: number, updated: Booking) => {
    if (!extracted) return;
    const newBookings = [...extracted.bookings];
    newBookings[index] = updated;
    setExtracted({ ...extracted, bookings: newBookings });
  }, [extracted]);

  const handleBookingDelete = useCallback((index: number) => {
    if (!extracted) return;
    setExtracted({ ...extracted, bookings: extracted.bookings.filter((_, i) => i !== index) });
  }, [extracted]);

  const handleConfirm = useCallback(() => {
    if (!extracted) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    addImportedItinerary(extracted);
  }, [extracted, addImportedItinerary]);

  const handleStartOver = useCallback(() => {
    setViewState('PASTE'); setExtracted(null); setRawText('');
    setPendingFiles([]); setDropzoneErrors([]); setFileErrors(undefined);
    setProgress(0); setErrorMessage(''); setLoadingLabel('');
  }, []);

  const handleDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    addFilesToQueue(Array.from(e.dataTransfer.files));
  }, [addFilesToQueue]);
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    addFilesToQueue(Array.from(e.target.files ?? []));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [addFilesToQueue]);

  // ==========================================================================
  return (
    <div className="space-y-6">

      {/* ── PASTE STATE ─────────────────────────────────────────────────────── */}
      {viewState === 'PASTE' && (
        <div className="space-y-5">
          {/* Page title */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Import a trip</h1>
            <p className="text-sm text-gray-500 mt-1">Paste a confirmation email or upload booking documents — the AI extracts everything automatically.</p>
          </div>

          {/* Tab toggle */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
            {(['paste', 'upload'] as InputTab[]).map(tab => (
              <button
                key={tab}
                id={`tab-${tab}`}
                role="tab"
                aria-selected={inputTab === tab}
                onClick={() => setInputTab(tab)}
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all"
                style={{
                  backgroundColor: inputTab === tab ? '#FFFFFF' : 'transparent',
                  color: inputTab === tab ? '#111827' : '#6B7280',
                  boxShadow: inputTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {tab === 'paste' ? 'Paste text' : 'Upload files'}
              </button>
            ))}
          </div>

          {/* ── PASTE TAB ── */}
          {inputTab === 'paste' && (
            <div className="space-y-4">
              {/* Sample presets */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Try a sample</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {IMPORT_PRESETS.map(preset => (
                    <button
                      key={preset.label}
                      id={`preset-${preset.label.toLowerCase().replace(/\s+/g, '-')}`}
                      onClick={() => setRawText(preset.text)}
                      className="text-left p-3.5 rounded-xl border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm cursor-pointer transition-all group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-gray-800">{preset.label}</span>
                        <ChevronRight size={14} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
                      </div>
                      <p className="text-xs text-gray-500">{preset.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Or paste your own</p>
                <textarea
                  id="import-textarea"
                  data-lenis-prevent
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  placeholder="Paste your flight confirmation, hotel booking, train ticket…"
                  rows={10}
                  className="w-full text-sm rounded-2xl p-4 border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all resize-y leading-relaxed text-gray-800 placeholder-gray-400"
                  style={{ minHeight: '180px', maxHeight: '480px' }}
                />
              </div>

              <button
                id="import-extract-btn"
                onClick={handleExtractText}
                disabled={!rawText.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#0A1E30' }}
              >
                <Sparkles size={15} />
                Extract itinerary
              </button>
            </div>
          )}

          {/* ── UPLOAD TAB ── */}
          {inputTab === 'upload' && (
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                id="import-dropzone"
                role="button"
                tabIndex={0}
                aria-label="Drop zone"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                className="relative flex flex-col items-center justify-center gap-3 py-12 rounded-2xl cursor-pointer transition-all select-none border-2 border-dashed"
                style={{
                  borderColor: isDragOver ? '#1D4ED8' : '#D1D5DB',
                  backgroundColor: isDragOver ? '#EFF6FF' : '#F9FAFB',
                }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: isDragOver ? '#DBEAFE' : '#F3F4F6' }}
                >
                  <Paperclip size={22} style={{ color: isDragOver ? '#1D4ED8' : '#9CA3AF' }} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-700">Drop files here</p>
                  <p className="text-xs text-gray-400 mt-0.5">or click to browse · PNG, JPG, PDF</p>
                </div>
                <input
                  ref={fileInputRef}
                  id="import-file-input"
                  type="file"
                  multiple
                  accept=".png,.jpg,.jpeg,.pdf"
                  className="absolute inset-0 opacity-0 cursor-pointer pointer-events-none"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={handleFileInput}
                />
              </div>

              {dropzoneErrors.length > 0 && (
                <div className="space-y-1.5">
                  {dropzoneErrors.map((msg, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-red-600">
                      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                      <span>{msg}</span>
                    </div>
                  ))}
                </div>
              )}

              {pendingFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''} queued
                  </p>
                  {pendingFiles.map((file, i) => (
                    <FileChip key={`${file.name}:${file.size}:${i}`} file={file} onRemove={() => removeFile(i)} />
                  ))}
                </div>
              )}

              {fileErrors && fileErrors.length > 0 && (
                <div className="space-y-1.5">
                  {fileErrors.map(fe => (
                    <div key={fe.filename} className="flex items-start gap-2 text-sm text-red-600">
                      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                      <span>{fe.message}</span>
                    </div>
                  ))}
                </div>
              )}

              <button
                id="import-extract-files-btn"
                onClick={handleExtractFiles}
                disabled={pendingFiles.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#0A1E30' }}
              >
                <Sparkles size={15} />
                Extract itinerary
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── LOADING STATE ─────────────────────────────────────────────────── */}
      {viewState === 'LOADING' && (
        <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #0A1E30, #1D4ED8)' }}
          >
            <Sparkles size={24} className="text-white animate-pulse" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 mb-1">Extracting your itinerary…</p>
            <p className="text-sm text-gray-400">{deferredLabel || 'Reading segments · inferring dependencies · validating'}</p>
          </div>
          <div className="w-64 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{ width: `${progress}%`, backgroundColor: '#1D4ED8' }}
            />
          </div>
        </div>
      )}

      {/* ── ERROR STATE ───────────────────────────────────────────────────── */}
      {viewState === 'ERROR' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
            <div>
              <p className="font-semibold text-red-800 mb-1">Extraction failed</p>
              <p className="text-sm text-red-700 leading-relaxed whitespace-pre-line">{errorMessage}</p>
            </div>
          </div>
          <button
            id="import-retry-btn"
            onClick={handleStartOver}
            className="flex items-center gap-2 text-sm font-medium text-red-700 hover:text-red-900 cursor-pointer transition-colors"
          >
            <RotateCcw size={13} />
            Try again
          </button>
        </div>
      )}

      {/* ── REVIEW STATE ──────────────────────────────────────────────────── */}
      {viewState === 'REVIEW' && extracted && (
        <div className="space-y-5">
          {/* Trip summary header */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div
              className="h-2 w-full"
              style={{ background: 'linear-gradient(90deg, #0A1E30, #1D4ED8, #7C3AED)' }}
            />
            <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-0.5 rounded-full border border-green-200">
                    <Check size={11} />
                    {extracted.bookings.length} bookings extracted
                  </span>
                </div>
                <h2 className="text-xl font-bold text-gray-900">{extracted.destination}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {extracted.travelerName} · {extracted.startDate} → {extracted.endDate}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Editable traveler name */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Traveler name</label>
                  <input
                    type="text"
                    value={extracted.travelerName}
                    onChange={e => setExtracted({ ...extracted, travelerName: e.target.value })}
                    className="text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                    placeholder="Traveler name"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Instruction */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Edit3 size={14} className="text-gray-400" />
            <span>Click the <strong className="text-gray-700">edit icon</strong> on any booking to expand and edit all fields. Titles and providers are always editable inline.</span>
          </div>

          {/* Booking cards */}
          <div className="space-y-3">
            {extracted.bookings.map((booking, i) => (
              <ReviewCard
                key={booking.id}
                booking={booking}
                index={i}
                total={extracted.bookings.length}
                onChange={updated => handleBookingChange(i, updated)}
                onDelete={() => handleBookingDelete(i)}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              id="import-confirm-btn"
              onClick={handleConfirm}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all"
              style={{ backgroundColor: '#0A1E30' }}
            >
              <Check size={15} />
              Confirm &amp; use this trip
            </button>
            <button
              id="import-startover-btn"
              onClick={handleStartOver}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors border border-gray-200"
            >
              <RotateCcw size={13} />
              Start over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
