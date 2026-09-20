/**
 * Screen 5 — Signup / Create Workspace
 * ======================================
 * Split-layout design inspired by the reference image:
 *  LEFT  — Marketing copy: headline, sub, 3 feature bullets
 *  RIGHT — "Create Workspace" form card (dark glass style)
 *
 * Color palette: #0a0a0f bg, cyan-400→blue-500 gradient accent,
 * white/10 borders, white/[0.04] card surfaces.
 *
 * Guest session handoff is preserved exactly as before:
 *  POST /api/guest/session/:id/claim → transfers batch ownership → no reprocessing.
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
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
    title: 'Instant AI Screening',
    desc: 'Paste a JD and upload resumes — our NLP pipeline scores and ranks every candidate in seconds.',
  },
  {
    icon: Shield,
    title: 'Bias-Free Scoring',
    desc: 'Scores are derived from skills, experience, and semantic fit — never demographics.',
  },
  {
    icon: BarChart3,
    title: 'Explainable Rankings',
    desc: 'Every match score breaks down into four traceable components visible to recruiters.',
  },
];

/* ── Form input component ─────────────────────────────────────────────── */
const Field = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) => (
  <div>
    <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
      {label}
    </label>
    <input
      type={type}
      required={required}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-3 text-sm text-white placeholder-white/20 bg-white/[0.04] border border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/30 transition-all"
    />
  </div>
);

/* ── Main page ────────────────────────────────────────────────────────── */
const SignupPage = () => {
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName,     setCompanyName]     = useState('');
  const [error,           setError]           = useState('');
  const [loading,         setLoading]         = useState(false);
  const [googleLoading,   setGoogleLoading]   = useState(false);

  const { login }  = useAuth();
  const navigate   = useNavigate();
  const shouldReduce = useReducedMotion();

  const hasGoogleClientId = Boolean(
    import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  );

  const googleSignup = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      setError('');
      try {
        const data = await api.googleSignin(tokenResponse.access_token, companyName);
        login(data.access_token, { id: data.user_id, email: data.email, role: data.role });
        navigate('/dashboard');
      } catch (err: any) {
        setError(err?.response?.data?.detail || 'Google sign-up failed. Please try again.');
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: (error) => {
      console.error('Google signup error:', error);
      setError('Google sign-up was cancelled or failed.');
      setGoogleLoading(false);
    },
  });

  const handleGoogleSignup = () => {
    if (!hasGoogleClientId) {
      setError('Google Client ID is not set. Please paste your Google Client ID into .env');
      return;
    }
    googleSignup();
  };

  // Did the user arrive from a guest screening session?
  const guestSessionId = localStorage.getItem('guest_session_id');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      // 1. Create account
      const data = await api.signup(email, password, companyName);
      login(data.access_token, { id: data.user_id, email: data.email, role: data.role });

      // 2. Claim the guest batch (ownership transfer, no re-scoring)
      if (guestSessionId) {
        try {
          await axios.post(
            `/api/guest/session/${guestSessionId}/claim`,
            null,
            { headers: { Authorization: `Bearer ${data.access_token}` } }
          );
        } catch {
          // session expired or already claimed — not a blocker
        } finally {
          localStorage.removeItem('guest_session_id');
        }
      }

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen font-sans antialiased text-white flex flex-col"
      style={{ background: '#0a0a0f' }}
    >
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/[0.05]">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold">
            Hire<span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Rank</span>
          </span>
        </Link>

        {/* Back to home */}
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
          {/* Badge */}
          <motion.div
            variants={fadeInUpVariants}
            className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold px-4 py-1.5 rounded-full"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            AI-Powered Recruitment
          </motion.div>

          {/* Headline */}
          <motion.div variants={fadeInUpVariants} className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-extrabold leading-[1.1] tracking-tight">
              Empower your{' '}
              <span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
                Hiring Team
              </span>
              {' '}with AI.
            </h1>
            <p className="text-base text-white/35 leading-relaxed max-w-md">
              Screen resumes, rank candidates, and explain every score — all in
              under a minute. No bias. No black boxes.
            </p>
          </motion.div>

          {/* Feature bullets */}
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

        {/* ────────────── RIGHT: Signup card ───────────────────────── */}
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
                    Create an account and they'll be transferred instantly — no reprocessing.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main card */}
          <div
            className="relative rounded-2xl border border-white/[0.08] p-8 overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
              boxShadow: '0 0 0 1px rgba(34,211,238,0.08), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            {/* Subtle teal glow top-right */}
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative">
              {/* Card header */}
              <h2 className="text-2xl font-extrabold text-white mb-1">Create Workspace</h2>
              <p className="text-sm text-white/30 mb-8">
                Set up your company profile to start hiring.
              </p>

              {/* Google OAuth button */}
              {true && (
                <>
                  <motion.button
                    type="button"
                    whileHover={!googleLoading && !shouldReduce ? { scale: 1.01 } : undefined}
                    whileTap={!googleLoading && !shouldReduce ? { scale: 0.99 } : undefined}
                    onClick={handleGoogleSignup}
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
                    {googleLoading ? 'Redirecting to Google…' : 'Sign up with Google'}
                  </motion.button>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-white/[0.06]" />
                    <span className="text-[10px] font-semibold text-white/20 uppercase tracking-widest">or sign up with email</span>
                    <div className="flex-1 h-px bg-white/[0.06]" />
                  </div>
                </>
              )}

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

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <Field
                  label="Work email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@company.com"
                  required
                />
                <Field
                  label="Company / team name"
                  value={companyName}
                  onChange={setCompanyName}
                  placeholder="Acme Corp"
                />
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    label="Password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    placeholder="Min. 8 chars"
                    required
                  />
                  <Field
                    label="Confirm password"
                    type="password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    placeholder="Repeat"
                    required
                  />
                </div>

                {/* Submit */}
                <motion.button
                  whileHover={!loading && !shouldReduce ? { scale: 1.01 } : undefined}
                  whileTap={!loading && !shouldReduce ? { scale: 0.99 } : undefined}
                  type="submit"
                  disabled={loading}
                  className="relative w-full group mt-2"
                >
                  {/* Glow layer */}
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl opacity-40 blur group-hover:opacity-60 transition-opacity" />
                  <span className="relative flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold py-3.5 rounded-xl text-sm shadow-lg disabled:opacity-60 transition-all">
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Creating workspace…
                      </>
                    ) : (
                      <>
                        {guestSessionId ? 'Create workspace & claim results' : 'Create free workspace'}
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </>
                    )}
                  </span>
                </motion.button>
              </form>

              {/* Terms */}
              <p className="text-center text-[10px] text-white/15 uppercase tracking-wider mt-6">
                By creating a workspace, you agree to the{' '}
                <span className="text-cyan-500/60 cursor-pointer hover:text-cyan-400 transition-colors">
                  Terms of Service
                </span>
              </p>

              {/* Divider */}
              <div className="my-6 border-t border-white/[0.06]" />

              {/* Login link */}
              <p className="text-center text-xs text-white/20 uppercase tracking-wider">
                Already have an organization?{' '}
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1 text-cyan-400 font-semibold hover:text-cyan-300 transition-colors"
                >
                  Log in to your workspace
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default SignupPage;
