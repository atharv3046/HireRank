/**
 * LoginPage.tsx
 * =============
 * Restyled to HireRank Editorial Core theme:
 *  - Instrument Serif editorial heading with italic accent
 *  - Unified HR monogram brand in top bar
 *  - Flat .card-surface and .input-surface controls
 *  - Flat .btn-primary and .btn-ghost buttons (no 3D edges, no cyan neon glows)
 *  - Readable #7d838f placeholder contrast
 *  - Full preservation of authentication logic (Google OAuth, JWT, Demo login)
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Brain, Shield, BarChart3, ArrowLeft, ArrowRight, Zap, Loader2 } from 'lucide-react';
import {
  useReducedMotion,
  fadeInUpVariants,
  staggerContainerVariants,
} from '../utils/animations';
import { useGoogleLogin } from '@react-oauth/google';

const BULLETS = [
  {
    icon: Brain,
    title: 'Semantic Skill Matching',
    desc: 'Dense contextual embeddings evaluate overall candidate profile relevance, not simplistic keyword counts.',
  },
  {
    icon: Shield,
    title: 'Traceable Score Breakdown',
    desc: 'Clear insight into semantic fit, skill coverage, career trajectory, and educational requirements.',
  },
  {
    icon: BarChart3,
    title: 'Instant Ranked Shortlists',
    desc: 'Candidates grouped by Strong, Potential, and Low fit tiers, ready for review or export.',
  },
];

interface FieldProps {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

const Field: React.FC<FieldProps> = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
}) => (
  <div>
    <label className="block text-xs font-mono uppercase tracking-wider text-[var(--muted)] mb-2">
      {label}
    </label>
    <input
      type={type}
      required
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="input-surface w-full px-4 py-3 text-sm"
    />
  </div>
);

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const shouldReduce = useReducedMotion();

  const guestSessionId = localStorage.getItem('guest_session_id');

  const hasGoogleClientId = Boolean(
    import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  );

  const claimGuestSession = async (accessToken: string) => {
    const sid = localStorage.getItem('guest_session_id');
    if (!sid) return;
    try {
      await axios.post(
        `/api/guest/session/${sid}/claim`,
        null,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
    } catch {
      // Non-blocking
    } finally {
      localStorage.removeItem('guest_session_id');
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      setError('');
      try {
        const data = await api.googleSignin(tokenResponse.access_token);
        login(data.access_token, { id: data.user_id, email: data.email, role: data.role });
        await claimGuestSession(data.access_token);
        navigate('/dashboard');
      } catch (err: any) {
        setError(err?.response?.data?.detail || 'Google sign-in failed. Please try again.');
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => {
      setError('Google sign-in was cancelled or failed.');
      setGoogleLoading(false);
    },
  });

  const handleGoogleLogin = () => {
    if (!hasGoogleClientId) {
      setError('Google Client ID is not configured in .env');
      return;
    }
    googleLogin();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api.login(email, password);
      login(data.access_token, { id: data.user_id, email: data.email, role: data.role });
      await claimGuestSession(data.access_token);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setDemoLoading(true);
    setError('');
    try {
      const data = await api.demoLogin();
      login(data.access_token, { id: data.user_id, email: data.email, role: data.role });
      await claimGuestSession(data.access_token);
      navigate('/dashboard');
    } catch {
      setError('Demo login failed. Ensure the backend server is running.');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen font-sans antialiased text-[var(--text)] flex flex-col bg-transparent">
      {/* ── Top Bar ──────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-[var(--line)]">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] font-bold text-xs">
            HR
          </div>
          <span className="font-bold text-lg tracking-tight text-[var(--text)] font-sans">
            Hire<span className="text-[var(--accent)]">Rank</span>
          </span>
        </Link>

        <Link
          to="/"
          className="flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--text)] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Home
        </Link>
      </header>

      {/* ── Main Split Layout ─────────────────────────────────────────── */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 max-w-6xl mx-auto w-full px-6 py-12 md:py-20 gap-12 lg:gap-20 items-center">
        {/* ────────────── LEFT: Editorial Copy ───────────────────────── */}
        <motion.div
          variants={staggerContainerVariants}
          initial={shouldReduce ? false : 'hidden'}
          animate="visible"
          className="space-y-10"
        >
          <motion.div variants={fadeInUpVariants}>
            <span className="badge-mono text-[10px] text-[var(--accent)] border-[var(--accent)]/30">
              Recruiter Authentication
            </span>
          </motion.div>

          <motion.div variants={fadeInUpVariants} className="space-y-4">
            <h1 className="font-serif-display text-4xl md:text-5xl font-normal leading-[1.08] tracking-tight text-[var(--text)]">
              Welcome back to <em>HireRank.</em>
            </h1>
            <p className="text-base text-[var(--muted)] leading-relaxed max-w-md">
              Your screening pipelines, candidate match scores, and interview telemetry are ready. Log in to continue.
            </p>
          </motion.div>

          <motion.div variants={staggerContainerVariants} className="space-y-6">
            {BULLETS.map(({ icon: Icon, title, desc }) => (
              <motion.div variants={fadeInUpVariants} key={title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-[var(--line)] flex items-center justify-center flex-shrink-0 text-[var(--accent)]">
                  <Icon className="w-5 h-5 stroke-[1.8]" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--text)]">{title}</div>
                  <div className="text-xs text-[var(--muted)] leading-relaxed mt-0.5">{desc}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* ────────────── RIGHT: Auth Card ───────────────────────────── */}
        <motion.div
          variants={fadeInUpVariants}
          initial={shouldReduce ? false : 'hidden'}
          animate="visible"
          className="w-full"
        >
          {/* Guest handoff notice */}
          {guestSessionId && (
            <div className="mb-4 flex items-start gap-3 bg-[var(--accent-dim)] border border-[var(--accent)]/30 rounded-xl p-4">
              <div className="w-5 h-5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] flex items-center justify-center flex-shrink-0 mt-0.5 text-xs">
                ✓
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--text)]">Screening batch ready to claim</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Log in to automatically attach your guest screening shortlist to your recruiter account.
                </p>
              </div>
            </div>
          )}

          <div className="card-surface p-8">
            <h2 className="font-serif-display text-2xl md:text-3xl font-normal text-[var(--text)] mb-1">
              Log In
            </h2>
            <p className="text-xs text-[var(--muted)] mb-6">
              Access your team workspaces and candidate pipelines.
            </p>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mb-5 bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs rounded-lg px-4 py-3"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Google OAuth button */}
            <button
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-white/90 text-gray-900 font-semibold py-3 rounded-[10px] text-xs transition-colors mb-3 disabled:opacity-50"
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-900" />
              ) : (
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {googleLoading ? 'Signing in with Google…' : 'Continue with Google'}
            </button>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-[var(--line)]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)]">or</span>
              <div className="flex-1 h-px bg-[var(--line)]" />
            </div>

            {/* Quick Demo button */}
            <button
              onClick={handleDemo}
              disabled={demoLoading}
              className="btn-ghost w-full justify-center text-xs py-2.5 mb-5"
            >
              {demoLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-[var(--accent)]" />
              )}
              {demoLoading ? 'Launching demo…' : 'Explore Demo Workspace'}
            </button>

            {/* Email / Password Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <Field
                label="Work email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="recruiter@company.com"
              />
              <Field
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
              />

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full text-xs py-3.5 mt-2 justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#04110f]" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* Footer switcher */}
            <div className="my-6 border-t border-[var(--line)]" />
            <p className="text-center text-xs text-[var(--muted)] font-mono">
              Don't have a workspace?{' '}
              <Link
                to="/signup"
                className="text-[var(--accent)] font-medium hover:underline underline-offset-2 ml-1"
              >
                Create workspace →
              </Link>
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
