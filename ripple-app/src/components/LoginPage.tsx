// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: LoginPage.tsx
// PURPOSE: Full-page split auth screen (photo + copy / sign-in & sign-up).
// =============================================================================

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Play,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { PlanBLogoMark } from './PlanBLogo';

type AuthMode = 'signin' | 'signup';

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.208 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.188 0-9.624-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.351 3.126-4.177 5.467-7.523 6.57l.001-.001 6.19 5.238C35.088 40.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}

interface Props {
  onAuthSuccess?: (email: string) => void;
}

export default function LoginPage({ onAuthSuccess }: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>(
    searchParams.get('mode') === 'signup' ? 'signup' : 'signin'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isConfigured = isSupabaseConfigured();

  useEffect(() => {
    setMode(searchParams.get('mode') === 'signup' ? 'signup' : 'signin');
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isConfigured || !supabase) {
      setErrorMessage(
        'Supabase credentials are not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to continue.'
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
        }
      } else {
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
        } else if (data.user) {
          setSuccessMessage('Account created. Sign in with your password to continue.');
          setMode('signin');
          navigate('/login', { replace: true });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isConfigured || !supabase) {
      setErrorMessage(
        'Google sign-in needs Supabase configured. You can still try the demo without an account.'
      );
      return;
    }

    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/app/dashboard`,
        },
      });
      if (error) {
        setErrorMessage(error.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setErrorMessage(null);
    setSuccessMessage(null);
    navigate(next === 'signup' ? '/login?mode=signup' : '/login', { replace: true });
  };

  const panelEase = [0.16, 1, 0.3, 1] as const;

  return (
    <div
      className="min-h-screen font-body antialiased lg:h-screen lg:overflow-hidden"
      style={{ backgroundColor: 'var(--color-bg-base)', color: 'var(--color-text-main)' }}
    >
      <div className="grid min-h-screen lg:h-screen lg:grid-cols-2 overflow-x-hidden">
        {/* ── Visual panel ── */}
        <motion.section
          className="relative h-48 sm:h-56 lg:h-full lg:min-h-full overflow-hidden shrink-0"
          initial={{ opacity: 0, x: -28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: panelEase, delay: 0.04 }}
        >
          <img
            src="/London-2048x1506.png"
            alt="London — a trip still worth arriving for"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(18, 22, 24, 0.45) 0%, rgba(18, 22, 24, 0.3) 40%, rgba(18, 22, 24, 0.88) 100%)',
            }}
          />

          <div className="relative z-10 flex h-full flex-col justify-between p-4 sm:p-6 lg:p-10 pb-6 sm:pb-8 lg:pb-10">
            {/* Top Bar Navigation */}
            <div className="flex items-center justify-between w-full">
              {/* Brand mark */}
              <div className="flex items-center gap-2">
                <PlanBLogoMark size={28} />
                <span className="font-display text-white font-bold text-base tracking-tight drop-shadow-sm">
                  planB
                </span>
                <span className="hidden sm:inline-flex ml-1.5 font-mono text-[10px] uppercase tracking-wider text-[#5EEAD4] bg-white/10 px-2 py-0.5 rounded-full border border-white/15">
                  OPS RECOVERY
                </span>
              </div>

              <button
                type="button"
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-3 py-1.5 font-mono text-2xs font-semibold uppercase tracking-wider text-white backdrop-blur-md cursor-pointer transition-colors"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)';
                }}
              >
                <ArrowLeft size={12} />
                <span>Back to home</span>
              </button>
            </div>

            {/* Mobile-only compact punchy headline */}
            <div className="lg:hidden pb-3">
              <p className="font-display text-sm xs:text-base font-bold text-white mt-1 leading-snug drop-shadow-sm">
                When flights slip, your trip stays intact.
              </p>
            </div>

            {/* Desktop-only full editorial narrative */}
            <div className="hidden lg:block max-w-lg pb-2 lg:pb-6">
              <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-[2.7rem]">
                When a flight slips, the rest of the trip should not collapse with it.
              </h1>
              <p className="mt-4 max-w-[46ch] text-sm leading-relaxed text-white/85 sm:text-base">
                Plan B maps every booking as a live dependency graph — flights, trains, hotels,
                transfers — then surfaces recovery options before you are standing in a rebooking queue.
              </p>
            </div>
          </div>
        </motion.section>

        {/* ── Form panel ── */}
        <motion.section
          className="relative z-20 -mt-4 lg:mt-0 rounded-t-[24px] lg:rounded-none flex items-center justify-center px-5 pt-5 pb-8 sm:px-8 sm:py-8 lg:p-10 lg:overflow-y-auto shadow-2xl lg:shadow-none"
          style={{ backgroundColor: 'var(--color-bg-surface)' }}
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: panelEase, delay: 0.08 }}
        >
          <div className="w-full max-w-[420px]">
            {/* Mobile sheet pull indicator */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4 lg:hidden" />

            <div className="relative min-h-[1.75rem] sm:min-h-[2rem]">
              <AnimatePresence mode="wait">
                <motion.h2
                  key={mode}
                  className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#17212B]"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: panelEase }}
                >
                  {mode === 'signin' ? 'Sign in to Plan B' : 'Create your account'}
                </motion.h2>
              </AnimatePresence>
            </div>
            <p className="mt-1 sm:mt-2 text-xs sm:text-sm leading-relaxed text-[#4A5568]">
              Sync itineraries across devices, or skip ahead and explore the demo as a guest.
            </p>

            <div
              className="mt-5 sm:mt-7 flex border-b"
              style={{ borderColor: 'var(--color-border-subtle)' }}
            >
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="flex-1 cursor-pointer border-b-2 py-2 sm:py-2.5 font-mono text-2xs font-semibold uppercase tracking-wider transition-colors"
                style={{
                  borderColor: mode === 'signin' ? 'var(--color-confirmed)' : 'transparent',
                  color: mode === 'signin' ? 'var(--color-confirmed)' : '#8896A4',
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="flex-1 cursor-pointer border-b-2 py-2 sm:py-2.5 font-mono text-2xs font-semibold uppercase tracking-wider transition-colors"
                style={{
                  borderColor: mode === 'signup' ? 'var(--color-confirmed)' : 'transparent',
                  color: mode === 'signup' ? 'var(--color-confirmed)' : '#8896A4',
                }}
              >
                Create account
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 sm:mt-6 space-y-3.5 sm:space-y-4">
              <div className="space-y-1">
                <label className="block font-mono text-2xs font-semibold uppercase tracking-wider text-[#4A5568]">
                  Email address
                </label>
                <div className="relative flex items-center">
                  <Mail size={14} className="absolute left-3 text-[#8896A4]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@planb.travel"
                    className="w-full rounded-[2px] border bg-white py-2 sm:py-2.5 pl-9 pr-3 font-mono text-sm sm:text-xs transition-colors focus:border-[#0A1E30] focus:outline-hidden"
                    style={{ borderColor: 'var(--color-border)' }}
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-mono text-2xs font-semibold uppercase tracking-wider text-[#4A5568]">
                  Password
                </label>
                <div className="relative flex items-center">
                  <Lock size={14} className="absolute left-3 text-[#8896A4]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-[2px] border bg-white py-2 sm:py-2.5 pl-9 pr-10 font-mono text-sm sm:text-xs transition-colors focus:border-[#0A1E30] focus:outline-hidden"
                    style={{ borderColor: 'var(--color-border)' }}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 cursor-pointer p-1 text-[#8896A4] transition-colors hover:text-[#17212B]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {mode === 'signup' && (
                  <p className="pt-0.5 font-mono text-2xs text-[#8896A4]">Minimum 6 characters.</p>
                )}
              </div>

              {errorMessage && (
                <div
                  className="flex items-start gap-2 rounded-[2px] border p-2.5 font-mono text-2xs"
                  style={{
                    backgroundColor: 'var(--color-disrupted-bg)',
                    borderColor: 'var(--color-disrupted-border)',
                    color: 'var(--color-disrupted)',
                  }}
                >
                  <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div
                  className="flex items-start gap-2 rounded-[2px] border p-2.5 font-mono text-2xs"
                  style={{
                    backgroundColor: 'var(--color-confirmed-bg)',
                    borderColor: 'var(--color-confirmed-border)',
                    color: 'var(--color-confirmed)',
                  }}
                >
                  <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full cursor-pointer items-center justify-center rounded-[2px] py-2.5 px-4 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-opacity"
                style={{
                  backgroundColor: 'var(--color-confirmed)',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading
                  ? 'Verifying…'
                  : mode === 'signin'
                    ? 'Sign in'
                    : 'Create account'}
              </button>
            </form>

            <div className="my-4 sm:my-5 flex items-center gap-3">
              <div className="h-px flex-1" style={{ backgroundColor: 'var(--color-border)' }} />
              <span className="font-mono text-2xs uppercase tracking-wider text-[#8896A4]">or</span>
              <div className="h-px flex-1" style={{ backgroundColor: 'var(--color-border)' }} />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading}
              className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-[2px] border bg-white py-2.5 px-4 font-mono text-xs font-semibold uppercase tracking-wider transition-colors"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-main)',
                opacity: googleLoading ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-confirmed)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)';
              }}
            >
              <GoogleMark />
              {googleLoading ? 'Redirecting…' : 'Continue with Google'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/app/dashboard')}
              className="mt-2.5 sm:mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-[2px] py-2.5 px-4 font-mono text-xs font-bold uppercase tracking-wider transition-colors"
              style={{
                backgroundColor: 'var(--color-bg-surface-alt)',
                color: 'var(--color-text-main)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-confirmed-bg)';
                e.currentTarget.style.color = 'var(--color-confirmed)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-alt)';
                e.currentTarget.style.color = 'var(--color-text-main)';
              }}
            >
              <Play size={13} />
              Try demo
            </button>

            <p className="mt-4 sm:mt-6 text-center text-xs text-[#8896A4]">
              Demo mode needs no account. Seed itineraries load instantly so you can trigger a
              disruption and inspect recovery options.
            </p>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
