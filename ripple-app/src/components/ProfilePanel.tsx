// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: ProfilePanel.tsx
// PURPOSE: Full-page Profile view — clean, expanded, human-readable design.
// =============================================================================

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Calendar,
  Edit3,
  Check,
  X,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  BarChart2,
  Layers,
  Shield,
  MapPin,
  TrendingUp,
  Plane,
} from 'lucide-react';
import { useAppState } from '../App';
import { supabase } from '../lib/supabase';
import { calculateTripRiskScore } from '../lib/impactEngine';
import * as cloudTripStorage from '../lib/cloudTripStorage';

// ---------------------------------------------------------------------------
// Inline alert
// ---------------------------------------------------------------------------
type AlertKind = 'error' | 'success' | 'warning';

function InlineAlert({ kind, message }: { kind: AlertKind; message: string }) {
  const cfg = {
    error:   { bg: '#FEF2F2', border: '#FECACA', color: '#DC2626', Icon: AlertCircle },
    success: { bg: '#F0FDF4', border: '#BBF7D0', color: '#16A34A', Icon: CheckCircle2 },
    warning: { bg: '#FFFBEB', border: '#FDE68A', color: '#D97706', Icon: AlertTriangle },
  }[kind];

  return (
    <div
      className="flex items-start gap-2 p-3 rounded-xl text-sm border"
      style={{ backgroundColor: cfg.bg, borderColor: cfg.border, color: cfg.color }}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <cfg.Icon size={14} className="flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------
function StatCard({
  label,
  value,
  sub,
  Icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  Icon: React.ElementType;
  accent: { color: string; bg: string; border: string };
}) {
  return (
    <div
      className="flex-1 rounded-2xl p-5 border flex flex-col gap-3"
      style={{ backgroundColor: accent.bg, borderColor: accent.border }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: accent.color + '20', color: accent.color }}
      >
        <Icon size={18} />
      </div>
      <div>
        <div className="text-2xl font-bold" style={{ color: accent.color }}>{value}</div>
        <div className="text-sm font-medium text-gray-700 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Identity card
// ---------------------------------------------------------------------------
function IdentityCard({
  email,
  createdAt,
  initialDisplayName,
}: {
  email: string;
  createdAt: string | null;
  initialDisplayName: string;
}) {
  const { updateDisplayName } = useAppState();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(initialDisplayName);
  const [nameLoading, setNameLoading] = useState(false);
  const [nameStatus, setNameStatus] = useState<{ kind: AlertKind; msg: string } | null>(null);

  // Keep in sync if parent updates initialDisplayName after Supabase fetch
  useEffect(() => {
    setDisplayName(initialDisplayName);
    setNameInput(initialDisplayName);
  }, [initialDisplayName]);

  const initials = (displayName || email || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const formattedCreated = useMemo(() => {
    if (!createdAt) return null;
    try {
      return new Date(createdAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      });
    } catch { return null; }
  }, [createdAt]);

  const handleSave = useCallback(async () => {
    if (!supabase) return;
    setNameLoading(true);
    setNameStatus(null);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: nameInput.trim() },
      });
      if (error) throw error;
      setDisplayName(nameInput.trim());
      updateDisplayName?.(nameInput.trim());
      setEditing(false);
      setNameStatus({ kind: 'success', msg: 'Display name updated.' });
    } catch (err: unknown) {
      setNameStatus({ kind: 'error', msg: err instanceof Error ? err.message : 'Update failed.' });
    } finally {
      setNameLoading(false);
    }
  }, [nameInput, updateDisplayName]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Cover strip */}
      <div
        className="h-24 w-full"
        style={{ background: 'linear-gradient(135deg, #0A1E30 0%, #1D4ED8 60%, #7C3AED 100%)' }}
      />

      <div className="px-6 pb-6">
        {/* Avatar — overlaps the cover */}
        <div className="flex items-end justify-between -mt-10 mb-4">
          <div
            className="w-20 h-20 rounded-2xl border-4 border-white flex items-center justify-center text-2xl font-bold text-white shadow-md"
            style={{ background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)' }}
          >
            {initials}
          </div>
          {/* Edit name button — top right of card body */}
          {!editing && (
            <button
              id="profile-edit-name-btn"
              onClick={() => { setEditing(true); setNameInput(displayName); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 hover:bg-white cursor-pointer transition-colors"
            >
              <Edit3 size={12} />
              Edit profile
            </button>
          )}
        </div>

        {/* Name + edit */}
        {editing ? (
          <div className="flex items-center gap-2 mb-1">
            <input
              id="profile-display-name-input"
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') setEditing(false);
              }}
              autoFocus
              maxLength={60}
              placeholder="Your name"
              className="flex-1 px-3 py-2 text-sm rounded-xl border border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
            />
            <button
              id="profile-save-name-btn"
              onClick={handleSave}
              disabled={nameLoading}
              className="p-2 rounded-xl bg-green-50 border border-green-200 text-green-700 cursor-pointer hover:bg-green-100 transition-colors"
              title="Save"
            >
              <Check size={14} />
            </button>
            <button
              onClick={() => { setEditing(false); setNameInput(displayName); }}
              className="p-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-500 cursor-pointer hover:bg-gray-100 transition-colors"
              title="Cancel"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">
            {displayName || <span className="text-gray-400 font-normal italic">No name set</span>}
          </h2>
        )}

        {nameStatus && (
          <div className="mb-3">
            <InlineAlert kind={nameStatus.kind} message={nameStatus.msg} />
          </div>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-2">
          <span className="flex items-center gap-1.5">
            <Mail size={13} className="text-gray-400" />
            {email}
          </span>
          {formattedCreated && (
            <span className="flex items-center gap-1.5">
              <Calendar size={13} className="text-gray-400" />
              Joined {formattedCreated}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Change password section
// ---------------------------------------------------------------------------
function ChangePasswordSection() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ kind: AlertKind; msg: string } | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    if (newPassword.length < 6) {
      setStatus({ kind: 'error', msg: 'Password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus({ kind: 'error', msg: 'Passwords do not match.' });
      return;
    }
    if (!supabase) {
      setStatus({ kind: 'error', msg: 'Supabase is not configured.' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setStatus({ kind: 'success', msg: 'Password updated. Sign in again on other devices.' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setStatus({ kind: 'error', msg: err instanceof Error ? err.message : 'Update failed.' });
    } finally {
      setLoading(false);
    }
  }, [newPassword, confirmPassword]);

  const ready = newPassword.length >= 6 && confirmPassword.length >= 6;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Lock size={16} className="text-gray-500" />
          <h3 className="font-semibold text-gray-900">Change password</h3>
        </div>
        <p className="text-sm text-gray-400 mt-0.5">Update your account password anytime.</p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {/* New password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
          <div className="relative">
            <input
              id="profile-new-password"
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full pr-10 pl-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 focus:bg-white transition-all"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowNew((p) => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              tabIndex={-1}
            >
              {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* Confirm password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm password</label>
          <div className="relative">
            <input
              id="profile-confirm-password"
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full pr-10 pl-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 focus:bg-white transition-all"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((p) => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {status && <InlineAlert kind={status.kind} message={status.msg} />}

        <button
          id="profile-change-password-btn"
          type="submit"
          disabled={loading || !ready}
          className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold cursor-pointer transition-all"
          style={{
            backgroundColor: ready && !loading ? '#0A1E30' : '#F3F4F6',
            color: ready && !loading ? '#FFFFFF' : '#9CA3AF',
            cursor: !ready || loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sign out section
// ---------------------------------------------------------------------------
function SessionSection({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <LogOut size={16} className="text-gray-500" />
          <h3 className="font-semibold text-gray-900">Sign out</h3>
        </div>
        <p className="text-sm text-gray-400 mt-0.5">Your data remains saved in your account.</p>
      </div>
      <div className="px-6 py-5 flex items-center justify-between gap-4">
        <p className="text-sm text-gray-600">
          Signed in as <span className="font-medium text-gray-900">{email}</span>
        </p>
        <button
          id="profile-signout-btn"
          onClick={onSignOut}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 cursor-pointer transition-colors flex-shrink-0"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete account — danger zone
// ---------------------------------------------------------------------------
function DeleteAccountSection({
  email,
  onAccountDeleted,
}: {
  email: string;
  onAccountDeleted: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ kind: AlertKind; msg: string } | null>(null);

  const emailMatches = confirmEmail.trim().toLowerCase() === email.toLowerCase();

  const handleDelete = useCallback(async () => {
    if (!emailMatches || !supabase) return;
    setLoading(true);
    setStatus(null);
    try {
      await cloudTripStorage.deleteAllTrips();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Session expired. Sign in again.');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        if (res.status === 404) {
          setStatus({
            kind: 'warning',
            msg: 'Account deletion requires the delete-account Edge Function to be deployed. Your trips were cleared but the auth account was not deleted.',
          });
          setLoading(false);
          return;
        }
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Error ${res.status}`);
      }
      await supabase.auth.signOut();
      onAccountDeleted();
    } catch (err: unknown) {
      setStatus({ kind: 'error', msg: err instanceof Error ? err.message : 'Deletion failed.' });
      setLoading(false);
    }
  }, [email, emailMatches, onAccountDeleted]);

  return (
    <div className="rounded-2xl border border-red-200 overflow-hidden">
      <button
        id="profile-danger-zone-toggle"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-6 py-4 cursor-pointer transition-colors text-left"
        style={{ backgroundColor: expanded ? '#FEF2F2' : '#FFFBFA' }}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} className="text-red-500" />
          <span className="font-semibold text-red-700 text-sm">Delete account</span>
        </div>
        <span className="text-xs text-red-400">{expanded ? 'Collapse ↑' : 'Expand ↓'}</span>
      </button>

      {expanded && (
        <div className="px-6 pb-6 pt-4 bg-white space-y-4 border-t border-red-100 animate-slide-down">
          <p className="text-sm text-gray-600 leading-relaxed">
            This permanently deletes all your saved trips and your account. You'll be signed out immediately. <strong className="text-red-600">This cannot be undone.</strong>
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Type your email to confirm
            </label>
            <input
              id="profile-delete-confirm-email"
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={email}
              className="w-full px-4 py-2.5 text-sm rounded-xl border bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-200 transition-all"
              style={{ borderColor: emailMatches && confirmEmail ? '#FCA5A5' : '#E5E7EB' }}
              autoComplete="off"
            />
            {confirmEmail && !emailMatches && (
              <p className="text-xs text-gray-400 mt-1">Email doesn't match.</p>
            )}
          </div>

          {status && <InlineAlert kind={status.kind} message={status.msg} />}

          <button
            id="profile-delete-account-btn"
            onClick={handleDelete}
            disabled={!emailMatches || loading}
            className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all"
            style={{
              backgroundColor: emailMatches && !loading ? '#DC2626' : '#F3F4F6',
              color: emailMatches && !loading ? '#FFFFFF' : '#9CA3AF',
              cursor: !emailMatches || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Deleting…' : 'Permanently delete my account'}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ProfilePanel
// ---------------------------------------------------------------------------
export default function ProfilePanel() {
  const navigate = useNavigate();
  const { currentUser, importedItineraries, signOut } = useAppState();

  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    if (!supabase || !currentUser) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setCreatedAt(user.created_at ?? null);
      setDisplayName((user.user_metadata?.display_name as string | undefined) ?? '');
    });
  }, [currentUser]);

  const stats = useMemo(() => {
    const totalTrips = importedItineraries.length;
    const totalBookings = importedItineraries.reduce((sum, it) => sum + it.bookings.length, 0);
    const scores = importedItineraries.map((it) => calculateTripRiskScore(it).overallScore);
    const avgRiskScore = totalTrips === 0 ? 0 : Math.round(scores.reduce((a, b) => a + b, 0) / totalTrips);
    const destinations = new Set(importedItineraries.map((it) => it.destination.split(',')[0].trim())).size;
    return { totalTrips, totalBookings, avgRiskScore, destinations };
  }, [importedItineraries]);

  const handleAccountDeleted = useCallback(() => navigate('/'), [navigate]);

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
          <User size={28} className="text-gray-400" />
        </div>
        <div>
          <p className="font-semibold text-gray-700">Sign in to view your profile</p>
          <p className="text-sm text-gray-400 mt-1">Your account details and trip stats live here.</p>
        </div>
        <button
          onClick={() => navigate('/app/dashboard')}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer underline"
        >
          ← Back to dashboard
        </button>
      </div>
    );
  }

  const riskColor =
    stats.avgRiskScore >= 75
      ? { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' }
      : stats.avgRiskScore >= 40
      ? { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' }
      : { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' };

  return (
    <div className="space-y-6">
      {/* ── Identity card ───────────────────────────────────────── */}
      <IdentityCard
        email={currentUser.email}
        createdAt={createdAt}
        initialDisplayName={displayName}
      />

      {/* ── Stats row ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-4">
        <StatCard
          label="Trips saved"
          value={stats.totalTrips}
          sub={stats.totalTrips === 1 ? '1 trip in your account' : `${stats.totalTrips} trips in your account`}
          Icon={Layers}
          accent={{ color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' }}
        />
        <StatCard
          label="Total bookings"
          value={stats.totalBookings}
          sub="Flights, hotels, transfers & more"
          Icon={BarChart2}
          accent={{ color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' }}
        />
        <StatCard
          label="Avg resilience score"
          value={stats.totalTrips === 0 ? '—' : `${stats.avgRiskScore}`}
          sub={stats.totalTrips === 0 ? 'Import a trip to see your score' : stats.avgRiskScore >= 75 ? 'Your trips look robust' : stats.avgRiskScore >= 40 ? 'Some trips have risk exposure' : 'High risk — check your itineraries'}
          Icon={Shield}
          accent={riskColor}
        />
        <StatCard
          label="Destinations"
          value={stats.destinations}
          sub="Unique cities across all trips"
          Icon={MapPin}
          accent={{ color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC' }}
        />
      </div>

      {/* ── Two-column layout for password + session ─────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChangePasswordSection />
        <SessionSection email={currentUser.email} onSignOut={signOut} />
      </div>

      {/* ── Danger zone ──────────────────────────────────────────── */}
      <DeleteAccountSection
        email={currentUser.email}
        onAccountDeleted={handleAccountDeleted}
      />

      {/* Footer */}
      <p className="text-xs text-gray-300 text-center pb-2">
        Account ID: {currentUser.id.slice(0, 16)}… · planB Dispatch Platform
      </p>
    </div>
  );
}
