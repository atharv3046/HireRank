/**
 * Login Page — matching the new dark split-layout design
 * ========================================================
 * LEFT  — Marketing copy mirroring SignupPage bullets
 * RIGHT — "Log in to your workspace" dark glass card
 *
 * Color palette: #0a0a0f bg, cyan-400→blue-500 gradient accent.
 * All logic (regular + demo login) preserved exactly.
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Zap, BarChart3, Shield, Brain, ArrowLeft, ArrowRight } from 'lucide-react';
import {
  useReducedMotion,
  fadeInUpVariants,
  staggerContainerVariants,
} from '../utils/animations';
import { useGoogleLogin } from '@react-oauth/google';

/* ── Feature bullets (left panel) ─────────────────────────────────────── */
const BULLETS = [
  {
    icon: Brain,
    title: 'Semantic Skill Matching',
    desc: 'Dense embeddings compare the full meaning of each resume to your JD — not just keyword overlap.',
  },
  {
    icon: Shield,
    title: 'Explainable Every Step',
    desc: 'Score breakdown: semantic fit, skill coverage, experience, and education — all visible.',
  },
  {
    icon: BarChart3,
    title: 'Ranked Shortlist Instantly',
    desc: 'Strong / Potential / Low tiers across your entire batch, ready to export as CSV.',
  },
];

/* ── Field component ──────────────────────────────────────────────────── */
const Field = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) => (
  <div>
    <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
      {label}
    </label>
    <input
      type={type}
      required
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-3 text-sm text-white placeholder-white/20 bg-white/[0.04] border border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/30 transition-all"
    />
  </div>
);

export default function LoginPage() {
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login }  = useAuth();
  const navigate   = useNavigate();
  const shouldReduce = useReducedMotion();

  // Did the user arrive here after a guest screening session?
  const guestSessionId = localStorage.getItem('guest_session_id');

  const hasGoogleClientId = Boolean(
    import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  );

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
    onError: (error) => {
      console.error('Google login error:', error);
      setError('Google sign-in was cancelled or failed.');
      setGoogleLoading(false);
    },
  });

  const handleGoogleLogin = () => {
    if (!hasGoogleClientId) {
      setError('Google Client ID is not set. Please paste your Google Client ID into .env');
      return;
    }
    googleLogin();
  };

  // Claim any pending guest screening session after login.
  // Identity is derived from the JWT on the server — no user_id param sent.
  const claimGuestSession = async (accessToken: string) => {
    const guestSessionId = localStorage.getItem('guest_session_id');
    if (!guestSessionId) return;
    try {
      await axios.post(
        `/api/guest/session/${guestSessionId}/claim`,
        null,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
    } catch {
      // Session may have already expired or been claimed — not a login blocker
    } finally {
      localStorage.removeItem('guest_session_id');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
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
    setDemoLoading(true); setError('');
    try {
      const data = await api.demoLogin();
      login(data.access_token, { id: data.user_id, email: data.email, role: data.role });
      await claimGuestSession(data.access_token);
      navigate('/dashboard');
    } catch {
      setError('Demo login failed. Make sure the backend is running.');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen font-sans antialiased text-white flex flex-col"
      style={{ background: '#0a0a0f' }}
    >
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/[0.05]">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold">
            Hire<span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Rank</span>
          </span>
        </Link>

        <Link
          to="/marketing"
          className="flex items-center gap-1.5 text-sm text-white/30 hover:text-white/60 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </header>

      {/* ── Main split layout ─────────────────────────────────────────── */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 max-w-6xl mx-auto w-full px-6 py-12 md:py-20 gap-12 lg:gap-20 items-center">

        {/* ────────────── LEFT: Marketing copy ─────────────────────── */}
        <motion.div
          variants={staggerContainerVariants}
          initial={shouldReduce ? false : "hidden"}
          animate="visible"
          className="space-y-10"
        >
          <motion.div
            variants={fadeInUpVariants}
            className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold px-4 py-1.5 rounded-full"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            AI-Powered Recruitment
          </motion.div>

          <motion.div variants={fadeInUpVariants} className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-extrabold leading-[1.1] tracking-tight">
              Welcome back to{' '}
              <span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
                HireRank.
              </span>
            </h1>
            <p className="text-base text-white/35 leading-relaxed max-w-md">
              Your ranked shortlists, candidate scores, and batch history are waiting.
              Log in to pick up where you left off.
            </p>
          </motion.div>

          <motion.div variants={staggerContainerVariants} className="space-y-5">
            {BULLETS.map(({ icon: Icon, title, desc }) => (
              <motion.div variants={fadeInUpVariants} key={title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/15 to-blue-500/10 border border-white/[0.07] flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-cyan-400" strokeWidth={1.8} />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{title}</div>
                  <div className="text-xs text-white/30 leading-relaxed mt-0.5">{desc}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* ────────────── RIGHT: Login card ────────────────────────── */}
        <motion.div
          variants={fadeInUpVariants}
          initial={shouldReduce ? false : "hidden"}
          animate="visible"
          transition={{ delay: 0.1 }}
          className="w-full"
        >
          {/* Guest session banner */}
          <AnimatePresence>
            {guestSessionId && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-4 flex items-start gap-3 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl px-5 py-4"
              >
                <div className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-cyan-300">Your screening results are ready</p>
                  <p className="text-xs text-cyan-400/60 mt-0.5">
                    Log in and they'll be transferred to your account instantly — no reprocessing.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div
            className="relative rounded-2xl border border-white/[0.08] p-8 overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
              boxShadow: '0 0 0 1px rgba(34,211,238,0.08), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            {/* Glow */}
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative">
              <h2 className="text-2xl font-extrabold text-white mb-1">Log in to your workspace</h2>
              <p className="text-sm text-white/30 mb-8">
                Access your recruiter dashboard and screening history.
              </p>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="mb-5 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Google OAuth button */}
              {true && (
                <>
                  <motion.button
                    whileHover={!googleLoading && !shouldReduce ? { scale: 1.01 } : undefined}
                    whileTap={!googleLoading && !shouldReduce ? { scale: 0.99 } : undefined}
                    onClick={handleGoogleLogin}
                    disabled={googleLoading}
                    className="w-full flex items-center justify-center gap-3 bg-white hover:bg-white/90 text-gray-800 font-semibold py-3 rounded-xl text-sm transition-all disabled:opacity-60 mb-3 shadow-lg"
                  >
                    {googleLoading ? (
                      <span className="w-4 h-4 border-2 border-gray-400 border-t-gray-800 rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    )}
                    {googleLoading ? 'Redirecting to Google…' : 'Continue with Google'}
                  </motion.button>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 h-px bg-white/[0.06]" />
                    <span className="text-[10px] font-semibold text-white/20 uppercase tracking-widest">or</span>
                    <div className="flex-1 h-px bg-white/[0.06]" />
                  </div>
                </>
              )}

              {/* Demo button */}
              <motion.button
                whileHover={!demoLoading && !shouldReduce ? { scale: 1.01 } : undefined}
                whileTap={!demoLoading && !shouldReduce ? { scale: 0.99 } : undefined}
                onClick={handleDemo}
                disabled={demoLoading}
                className="w-full flex items-center justify-center gap-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-300 font-semibold py-3 rounded-xl text-sm transition-all disabled:opacity-60 mb-6"
              >
                {demoLoading ? (
                  <span className="w-4 h-4 border-2 border-cyan-400/40 border-t-cyan-400 rounded-full animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" strokeWidth={2} />
                )}
                {demoLoading ? 'Loading demo…' : 'Enter Demo Dashboard'}
              </motion.button>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-[10px] font-semibold text-white/20 uppercase tracking-widest">or sign in with email</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>

              {/* Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                <Field
                  label="Work email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@company.com"
                />
                <Field
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="••••••••"
                />

                <motion.button
                  whileHover={!loading && !shouldReduce ? { scale: 1.01 } : undefined}
                  whileTap={!loading && !shouldReduce ? { scale: 0.99 } : undefined}
                  type="submit"
                  disabled={loading}
                  className="relative w-full group mt-2"
                >
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl opacity-40 blur group-hover:opacity-60 transition-opacity" />
                  <span className="relative flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold py-3.5 rounded-xl text-sm shadow-lg disabled:opacity-60 transition-all">
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Signing in…
                      </>
                    ) : (
                      <>
                        Sign in
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </>
                    )}
                  </span>
                </motion.button>
              </form>

              {/* Footer links */}
              <div className="my-6 border-t border-white/[0.06]" />
              <p className="text-center text-xs text-white/20 uppercase tracking-wider">
                Don't have an organization?{' '}
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-1 text-cyan-400 font-semibold hover:text-cyan-300 transition-colors"
                >
                  Create a free workspace
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
