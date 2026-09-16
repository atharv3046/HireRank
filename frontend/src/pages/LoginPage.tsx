/**
 * Login Page — matching the new dark split-layout design
 * ========================================================
 * LEFT  — Marketing copy mirroring SignupPage bullets
 * RIGHT — "Log in to your workspace" dark glass card
 *
 * Color palette: #0a0a0f bg, cyan-400→blue-500 gradient accent.
 * All logic (regular + demo login) preserved exactly.
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Zap, BarChart3, Shield, Brain, ArrowLeft, ArrowRight } from 'lucide-react';
import {
  useReducedMotion,
  fadeInUpVariants,
  staggerContainerVariants,
} from '../utils/animations';

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
  const { login }  = useAuth();
  const navigate   = useNavigate();
  const shouldReduce = useReducedMotion();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const data = await api.login(email, password);
      login(data.access_token, { id: data.user_id, email: data.email, role: data.role });
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
