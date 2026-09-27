// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: AuthPanel.tsx
// PURPOSE: Manifest-styled authentication panel (Sign In / Create Account)
//   supporting email and password authentication with Supabase.
// =============================================================================

import { useState } from 'react';
import { X, Lock, Mail, AlertCircle, CheckCircle2, Shield, Eye, EyeOff } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import PlanBLogo from './PlanBLogo';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: (email: string) => void;
}

export default function AuthPanel({ isOpen, onClose, onAuthSuccess }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isConfigured = isSupabaseConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isConfigured || !supabase) {
      setErrorMessage(
        'Supabase credentials are not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env.local file.'
      );
      return;
    }

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setErrorMessage('Invalid email or password. Please verify your credentials.');
          } else {
            setErrorMessage(error.message);
          }
          return;
        }

        if (data.user?.email) {
          setSuccessMessage(`Authenticated as ${data.user.email}`);
          onAuthSuccess?.(data.user.email);
          setTimeout(() => {
            onClose();
          }, 800);
        }
      } else {
        // Sign up
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
        });

        if (error) {
          if (error.message.toLowerCase().includes('already registered')) {
            setErrorMessage('An account with this email already exists. Please sign in instead.');
          } else {
            setErrorMessage(error.message);
          }
          return;
        }

        if (data.session) {
          setSuccessMessage('Account created and logged in successfully.');
          onAuthSuccess?.(data.user?.email || email);
          setTimeout(() => {
            onClose();
          }, 800);
        } else if (data.user) {
          // If Supabase project has email confirmation enabled
          setSuccessMessage('Account created! You can now log in with your password.');
          setMode('signin');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-lenis-prevent
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-fade-in"
      onClick={onClose}
    >
      <div
        data-lenis-prevent
        className="w-full max-w-md bg-white rounded-[2px] shadow-2xl border overflow-hidden"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-bg-surface)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-panel-title"
      >
        {/* Top Operations Telemetry Strip */}
        <div
          className="flex items-center justify-between px-5 py-2.5 border-b font-mono text-2xs uppercase tracking-wider text-[#8896A4]"
          style={{
            backgroundColor: 'var(--color-bg-surface-alt)',
            borderColor: 'var(--color-border-subtle)',
          }}
        >
          <div className="flex items-center gap-1.5 text-[#0A1E30] font-semibold">
            <Shield size={11} />
            <span>DISPATCH IDENTITY SERVICE</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#8896A4] hover:text-[#17212B] p-1 cursor-pointer transition-colors"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Header content */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3 mb-3">
            <PlanBLogo size={28} />
            <div>
              <h2
                id="auth-panel-title"
                className="font-display text-lg font-bold tracking-tight text-[#17212B]"
              >
                {mode === 'signin' ? 'Operator Sign In' : 'Create Dispatch Account'}
              </h2>
              <p className="font-mono text-2xs text-[#4A5568] uppercase tracking-wide">
                Cloud Sync & Cross-Device Persistence
              </p>
            </div>
          </div>

          <p className="font-body text-xs text-[#4A5568] leading-relaxed">
            Sign in to automatically sync your disruption itineraries and recovery scenarios across
            devices. Zero login is required to test demo features.
          </p>
        </div>

        {/* Tab switcher: Sign In / Sign Up */}
        <div className="flex border-y mx-6" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorMessage(null);
            }}
            className="flex-1 py-2 font-mono text-2xs font-semibold uppercase tracking-wider transition-colors cursor-pointer border-b-2"
            style={{
              borderColor: mode === 'signin' ? 'var(--color-confirmed)' : 'transparent',
              color: mode === 'signin' ? 'var(--color-confirmed)' : '#8896A4',
            }}
          >
            SIGN IN
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMessage(null);
            }}
            className="flex-1 py-2 font-mono text-2xs font-semibold uppercase tracking-wider transition-colors cursor-pointer border-b-2"
            style={{
              borderColor: mode === 'signup' ? 'var(--color-confirmed)' : 'transparent',
              color: mode === 'signup' ? 'var(--color-confirmed)' : '#8896A4',
            }}
          >
            CREATE ACCOUNT
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Email input */}
          <div className="space-y-1">
            <label className="block font-mono text-2xs uppercase tracking-wider text-[#4A5568] font-semibold">
              EMAIL ADDRESS
            </label>
            <div className="relative flex items-center">
              <Mail size={14} className="absolute left-3 text-[#8896A4]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@planb.internal"
                className="w-full pl-9 pr-3 py-2 text-xs font-mono rounded-[2px] border bg-white focus:outline-hidden focus:border-[#0A1E30] transition-colors"
                style={{ borderColor: 'var(--color-border)' }}
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password input */}
          <div className="space-y-1">
            <label className="block font-mono text-2xs uppercase tracking-wider text-[#4A5568] font-semibold">
              PASSWORD
            </label>
            <div className="relative flex items-center">
              <Lock size={14} className="absolute left-3 text-[#8896A4]" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-10 py-2 text-xs font-mono rounded-[2px] border bg-white focus:outline-hidden focus:border-[#0A1E30] transition-colors"
                style={{ borderColor: 'var(--color-border)' }}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2.5 text-[#8896A4] hover:text-[#17212B] p-1 cursor-pointer transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {mode === 'signup' && (
              <p className="font-mono text-2xs text-[#8896A4] pt-0.5">
                Minimum 6 characters. No magic link or OTP required.
              </p>
            )}
          </div>

          {/* Inline Error State */}
          {errorMessage && (
            <div
              className="flex items-start gap-2 p-2.5 rounded-[2px] font-mono text-2xs border"
              style={{
                backgroundColor: 'var(--color-disrupted-bg)',
                borderColor: 'var(--color-disrupted-border)',
                color: 'var(--color-disrupted)',
              }}
            >
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Inline Success State */}
          {successMessage && (
            <div
              className="flex items-start gap-2 p-2.5 rounded-[2px] font-mono text-2xs border"
              style={{
                backgroundColor: 'var(--color-confirmed-bg)',
                borderColor: 'var(--color-confirmed-border)',
                color: 'var(--color-confirmed)',
              }}
            >
              <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Submit CTA */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-[2px] font-mono text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors shadow-xs flex items-center justify-center gap-2"
            style={{
              backgroundColor: 'var(--color-confirmed)',
              color: '#FFFFFF',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <span>VERIFYING CREDENTIALS...</span>
            ) : mode === 'signin' ? (
              <span>SIGN IN TO DISPATCH</span>
            ) : (
              <span>CREATE ACCOUNT & SYNC</span>
            )}
          </button>

          {/* Guest fallback button */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={onClose}
              className="font-mono text-2xs uppercase tracking-wider text-[#8896A4] hover:text-[#17212B] cursor-pointer transition-colors underline underline-offset-2"
            >
              Continue as Guest (No Account)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
