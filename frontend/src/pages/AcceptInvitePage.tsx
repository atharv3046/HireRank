import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { fadeInUpVariants } from '../utils/animations';

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { login } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteDetails, setInviteDetails] = useState<{
    email: string;
    name?: string;
    role: string;
    workspace_name: string;
    inviter_email?: string;
  } | null>(null);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('No invitation token was provided in the link. Please check the URL.');
      setLoading(false);
      return;
    }

    const verify = async () => {
      try {
        setLoading(true);
        const res = await api.verifyInviteToken(token);
        setInviteDetails(res);
        setName(res.name || '');
      } catch (err: any) {
        setError(err.response?.data?.detail || 'This invitation is invalid or has expired.');
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (password.length < 6) {
      setSubmitError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await api.acceptTeamInvite({
        token,
        password,
        name: name.trim() || undefined,
      });

      // Log in the user directly
      login(res.access_token, {
        id: res.user_id,
        email: res.email,
        role: res.role,
        company_name: res.workspace_name,
      });

      navigate('/dashboard');
    } catch (err: any) {
      setSubmitError(err.response?.data?.detail || 'Failed to accept invitation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 font-sans text-white relative overflow-hidden"
      style={{ background: 'transparent' }}
    >
      {/* Background glow accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[var(--accent-dim)] rounded-full blur-3xl pointer-events-none" />
      

      <motion.div
        variants={fadeInUpVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md rounded-2xl border border-white/[0.1] p-8 shadow-2xl relative z-10 space-y-6"
        style={{ background: '#0d0d14' }}
      >
        {/* Logo / Header */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] font-bold text-xs">HR</div><span className="font-bold text-lg tracking-tight text-[var(--text)] font-sans">Hire<span className="text-[var(--accent)]">Rank</span></span>
        </div>

        {loading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-white/50">Verifying your workspace invitation…</p>
          </div>
        ) : error ? (
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              <div className="font-bold text-sm mb-1 text-rose-400">Invitation Unavailable</div>
              {error}
            </div>
            <p className="text-xs text-white/40">
              If this invitation link has expired, please ask the workspace owner to send you a new invitation link.
            </p>
            <div className="pt-2">
              <Link
                to="/login"
                className="block text-center py-2.5 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-white text-xs font-bold border border-white/[0.1] transition-all"
              >
                Go to Sign In
              </Link>
            </div>
          </div>
        ) : inviteDetails && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-widest">
                WORKSPACE COLLABORATION
              </span>
              <h2 className="text-xl font-extrabold text-white mt-0.5">
                Join {inviteDetails.workspace_name}
              </h2>
              <p className="text-xs text-white/50 mt-1">
                You’ve been invited as a{' '}
                <span className="text-[var(--accent)] font-semibold">{inviteDetails.role}</span>. Set your
                password to complete your onboarding.
              </p>
            </div>

            {submitError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {submitError}
              </div>
            )}

            <div className="space-y-3.5">
              {/* Email (Readonly) */}
              <div>
                <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5">
                  Your Email
                </label>
                <input
                  type="email"
                  readOnly
                  value={inviteDetails.email}
                  className="w-full px-3.5 py-2 text-xs bg-white/[0.02] border border-[var(--line)] rounded-xl text-white/60 cursor-not-allowed select-none"
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5">
                  Your Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Sarah Connor"
                  className="w-full px-3.5 py-2 text-xs bg-white/[0.04] border border-white/[0.1] rounded-xl text-white placeholder-[#7d838f] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5">
                  Create Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3.5 py-2 text-xs bg-white/[0.04] border border-white/[0.1] rounded-xl text-white placeholder-[#7d838f] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className="w-full px-3.5 py-2 text-xs bg-white/[0.04] border border-white/[0.1] rounded-xl text-white placeholder-[#7d838f] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-[var(--accent)] text-[#04110f] font-semibold disabled:opacity-45 shadow-none transition-all flex items-center justify-center gap-2"
            >
              {submitting && (
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              Accept Invitation & Join Workspace
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
