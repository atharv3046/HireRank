/**
 * Screen 4 — Shortlist Preview (Guest, no login)
 * ================================================
 * Displays masked ranked candidate results with:
 *   - 4-tier model: Strong (>= 75), Potential (55-74.9), Low (< 55), Needs Review
 *   - Masked name & email ("Candidate #1", "c****@***.com")
 *   - Shared batch stats (counts, avg score, tier distribution)
 *   - Unparseable files clearly flagged with "Unable to parse — review manually"
 *   - CTA to /signup with session_id persisted in localStorage
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useReducedMotion,
  fadeInUpVariants,
  staggerContainerVariants,
  accordionVariants,
} from '../utils/animations';

/* ── Types ──────────────────────────────────────────────────────────────── */
export type CandidateTier = 'Strong' | 'Potential' | 'Low' | 'Needs Review';

export interface PreviewCandidate {
  id: number;
  name_masked: string;
  email_masked: string;
  score: number | null;
  tier: CandidateTier;
  needs_manual_review?: boolean;
  skills_score: number | null;
  experience_score: number | null;
  matched_skills: string[];
  missing_skills: string[];
  years_experience: number | null;
  explanation?: Record<string, any>;
}

export interface PreviewStats {
  total_processed: number;
  strong_count: number;
  potential_count: number;
  low_count: number;
  needs_review_count?: number;
  average_score: number | null;
  tier_distribution?: Record<string, number>;
}

export interface PreviewData {
  session_id: string;
  job_id: number;
  job_title: string;
  candidates: PreviewCandidate[];
  stats: PreviewStats;
}

/* ── Tier config ─────────────────────────────────────────────────────────── */
const TIER_CONFIG: Record<CandidateTier, { pill: string; dot: string; bar: string; scoreColor: string }> = {
  Strong:         { pill: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-400', bar: 'bg-emerald-500', scoreColor: 'text-emerald-400' },
  Potential:      { pill: 'bg-amber-500/15 text-amber-400 border-amber-500/25',       dot: 'bg-amber-400',   bar: 'bg-amber-400',   scoreColor: 'text-amber-400'   },
  Low:            { pill: 'bg-white/[0.05] text-white/30 border-white/[0.08]',        dot: 'bg-white/20',    bar: 'bg-white/20',    scoreColor: 'text-white/40'    },
  'Needs Review': { pill: 'bg-purple-500/15 text-purple-300 border-purple-500/25',     dot: 'bg-purple-400',  bar: 'bg-purple-400',  scoreColor: 'text-purple-400'  },
};

/* ── Logo ────────────────────────────────────────────────────────────────── */
const Logo = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} className="flex items-center gap-2.5 group">
    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    </div>
    <span className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">
      Hire<span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Rank</span>
    </span>
  </button>
);

/* ── Blurred name/email ──────────────────────────────────────────────────── */
const BlurredCell = ({ text }: { text: string }) => (
  <span className="relative inline-block">
    <span className="select-none" style={{ filter: 'blur(6px)', userSelect: 'none' }}>{text}</span>
    <span className="absolute inset-0 flex items-center justify-center">
      <svg className="w-3 h-3 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    </span>
  </span>
);

/* ── Skill pill ──────────────────────────────────────────────────── */
const SkillPill = ({ name, matched }: { name: string; matched: boolean }) => (
  <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium ${
    matched
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      : 'bg-red-500/10 text-red-400 border-red-500/20'
  }`}>
    {matched ? '✓' : '✗'} {name}
  </span>
);

/* ── Score display ───────────────────────────────────────────────────────── */
const Score = ({ score, tier, isUnparseable }: { score: number | null; tier: CandidateTier; isUnparseable?: boolean }) => {
  if (isUnparseable || score === null) {
    return <span className="text-white/30 text-xs font-semibold uppercase tracking-wider">Review</span>;
  }
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG.Low;
  return (
    <span className={`text-xl font-extrabold tabular-nums ${cfg.scoreColor}`}>
      {score.toFixed(1)}
      <span className="text-xs font-normal text-white/25 ml-0.5">%</span>
    </span>
  );
};

/* ── Candidate card ──────────────────────────────────────────────────────── */
const CandidateCard = ({
  c, rank, expanded, onToggle, onSignup,
}: {
  c: PreviewCandidate;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
  onSignup: () => void;
}) => {
  const isUnparseable = c.tier === 'Needs Review' || c.needs_manual_review || c.score === null;
  const cfg = TIER_CONFIG[c.tier] || TIER_CONFIG.Low;
  const shouldReduce = useReducedMotion();

  return (
    <motion.div
      variants={fadeInUpVariants}
      whileHover={!shouldReduce ? { borderColor: 'rgba(255,255,255,0.14)' } : undefined}
      className={`rounded-2xl border transition-colors ${
        isUnparseable ? 'border-purple-500/20 bg-purple-950/10' : 'border-white/[0.07]'
      }`}
      style={{ background: isUnparseable ? 'rgba(30, 20, 50, 0.4)' : '#0d0d14' }}
    >
      {/* Summary row */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={onToggle}
      >
        {/* Rank bubble */}
        <div className="w-7 h-7 rounded-full bg-white/[0.05] border border-white/[0.07] flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-white/30">#{rank}</span>
        </div>

        {/* Avatar + name */}
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${
            isUnparseable
              ? 'bg-purple-500/20 border-purple-500/30'
              : 'bg-gradient-to-br from-cyan-500/30 to-blue-600/30 border-cyan-500/20'
          }`}>
            {isUnparseable ? (
              <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white/80">
              <BlurredCell text={c.name_masked} />
            </p>
            <p className="text-xs text-white/25 mt-0.5">
              <BlurredCell text={c.email_masked} />
            </p>
          </div>
        </div>

        {/* Experience */}
        <div className="hidden sm:block w-14 text-center">
          <span className="text-xs font-medium text-white/30">
            {c.years_experience != null ? `${c.years_experience}y` : '—'}
          </span>
        </div>

        {/* Score */}
        <div className="w-16 text-center">
          <Score score={c.score} tier={c.tier} isUnparseable={isUnparseable} />
        </div>

        {/* Tier badge */}
        <div className="w-28 flex justify-center">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.pill}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {c.tier}
          </span>
        </div>

        {/* Chevron */}
        <svg
          className={`w-4 h-4 text-white/20 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded detail with AnimatePresence */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            variants={accordionVariants}
            initial={shouldReduce ? false : "hidden"}
            animate="visible"
            exit="exit"
            className="border-t border-white/[0.05] px-5 py-5 space-y-5 bg-white/[0.01]"
          >
            {isUnparseable ? (
              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200 text-xs leading-relaxed">
                ⚠️ <strong>Unable to parse text cleanly:</strong> This resume may be a scanned image or protected document.
                Please inspect the original document directly.
              </div>
            ) : (
              <>
                {/* Score breakdown bars */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Skills match',   val: c.skills_score },
                    { label: 'Experience fit', val: c.experience_score },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs text-white/30 mb-1.5">
                        <span>{label}</span>
                        <span className="font-semibold text-white/50">{val != null ? `${val.toFixed(0)}%` : '—'}</span>
                      </div>
                      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${cfg.bar}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${val ?? 0}%` }}
                          transition={{ duration: shouldReduce ? 0 : 0.5, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Skills */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {c.matched_skills.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-2">
                        Matched skills
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {c.matched_skills.slice(0, 10).map(s => (
                          <SkillPill key={s} name={s} matched />
                        ))}
                      </div>
                    </div>
                  )}
                  {c.missing_skills.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-2">
                        Missing skills
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {c.missing_skills.slice(0, 10).map(s => (
                          <SkillPill key={s} name={s} matched={false} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Row-level CTA */}
            <div className="flex items-center justify-between pt-3 border-t border-white/[0.05]">
              <p className="text-xs text-white/20">
                🔒 Name and contact info hidden until you create a workspace.
              </p>
              <motion.button
                whileHover={!shouldReduce ? { x: 2 } : undefined}
                onClick={e => { e.stopPropagation(); onSignup(); }}
                className="text-xs text-cyan-400 font-semibold hover:text-cyan-300 transition-colors flex items-center gap-1"
              >
                Unlock
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/* ── Stat card ───────────────────────────────────────────────────────────── */
const StatCard = ({ value, label, sub, color }: {
  value: string | number; label: string; sub?: string; color: string;
}) => {
  const shouldReduce = useReducedMotion();
  return (
    <motion.div
      variants={fadeInUpVariants}
      whileHover={!shouldReduce ? { y: -2, borderColor: 'rgba(255,255,255,0.12)' } : undefined}
      transition={{ duration: 0.2 }}
      className="rounded-2xl border border-white/[0.07] p-5 text-center transition-colors"
      style={{ background: '#0d0d14' }}
    >
      <div className={`text-3xl font-extrabold mb-1 ${color}`}>{value}</div>
      <div className="text-sm font-medium text-white/50">{label}</div>
      {sub && <div className="text-xs text-white/20 mt-0.5">{sub}</div>}
    </motion.div>
  );
};

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function ResultsPreviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const shouldReduce = useReducedMotion();

  const [data, setData]         = useState<PreviewData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    axios.get(`/api/guest/session/${sessionId}/results`)
      .then(res => { setData(res.data); setLoading(false); })
      .catch(err => {
        if (err.response?.status === 202) {
          navigate(`/processing/${sessionId}`, { replace: true });
        } else if (err.response?.status === 404) {
          localStorage.removeItem('guest_session_id');
          setError('Session not found or expired. Please start a new screening.');
        } else {
          setError('Could not load results. Please try again.');
        }
        setLoading(false);
      });
  }, [sessionId, navigate]);

  const goSignup = () => {
    if (sessionId) {
      localStorage.setItem('guest_session_id', sessionId);
    }
    navigate('/signup');
  };

  /* ── Loading ─────────────────────────────────────────────────────────── */
  if (loading) return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: '#0a0a0f' }}>
      <header className="border-b border-white/[0.06] px-8 py-4">
        <Logo onClick={() => navigate('/')} />
      </header>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-white/30">Loading your results…</p>
        </div>
      </div>
    </div>
  );

  /* ── Error ───────────────────────────────────────────────────────────── */
  if (error || !data) return (
    <div className="min-h-screen flex flex-col items-center justify-center font-sans gap-5 px-6 text-center" style={{ background: '#0a0a0f' }}>
      <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center">
        <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <p className="text-white/60 font-medium max-w-sm">{error || 'No results found.'}</p>
      <button
        onClick={() => navigate('/screen')}
        className="text-sm bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-6 py-3 rounded-xl font-semibold hover:from-cyan-400 hover:to-blue-400 transition-all"
      >
        ← Start new screening
      </button>
    </div>
  );

  const { stats, candidates, job_title } = data;

  return (
    <div className="min-h-screen font-sans antialiased text-white" style={{ background: '#0a0a0f' }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-20 border-b border-white/[0.06] px-8 py-4 backdrop-blur-md"
        style={{ background: 'rgba(10,10,15,0.9)' }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Logo onClick={() => navigate('/')} />

          <motion.button
            whileHover={!shouldReduce ? { scale: 1.02 } : undefined}
            whileTap={!shouldReduce ? { scale: 0.98 } : undefined}
            onClick={goSignup}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-cyan-500/15"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            Create free workspace to unlock
          </motion.button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">

        {/* ── Page title ───────────────────────────────────────────────── */}
        <motion.div
          variants={fadeInUpVariants}
          initial={shouldReduce ? false : "hidden"}
          animate="visible"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
              Screening results
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">{job_title}</h1>
          <p className="text-sm text-white/30 mt-1.5 max-w-lg">
            Names and contact info are blurred. Create a free account to unlock the full shortlist, export CSV, and save this batch.
          </p>
        </motion.div>

        {/* ── Stats grid ───────────────────────────────────────────────── */}
        <motion.div
          variants={staggerContainerVariants}
          initial={shouldReduce ? false : "hidden"}
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <StatCard value={stats.total_processed} label="Screened" color="text-white" />
          <StatCard value={stats.strong_count} label="Strong ≥75" sub="top tier" color="text-emerald-400" />
          <StatCard value={stats.potential_count} label="Potential 55–74" color="text-amber-400" />
          <StatCard
            value={stats.average_score != null ? `${stats.average_score}%` : '—'}
            label="Avg. score"
            color="text-cyan-400"
          />
        </motion.div>

        {/* ── Tier distribution bar ────────────────────────────────────── */}
        {stats.total_processed > 0 && (
          <motion.div
            variants={fadeInUpVariants}
            initial={shouldReduce ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true }}
            className="rounded-2xl border border-white/[0.07] p-5"
            style={{ background: '#0d0d14' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white/60">Tier distribution</h3>
              <div className="flex items-center gap-4 text-xs text-white/25">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" />Strong</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" />Potential</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-white/20" />Low</span>
                {(stats.needs_review_count ?? 0) > 0 && (
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-400" />Needs Review</span>
                )}
              </div>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden flex bg-white/[0.04] gap-0.5">
              {stats.strong_count > 0 && (
                <motion.div
                  className="h-full bg-emerald-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(stats.strong_count / stats.total_processed) * 100}%` }}
                  transition={{ duration: shouldReduce ? 0 : 0.6, ease: 'easeOut' }}
                />
              )}
              {stats.potential_count > 0 && (
                <motion.div
                  className="h-full bg-amber-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(stats.potential_count / stats.total_processed) * 100}%` }}
                  transition={{ duration: shouldReduce ? 0 : 0.6, ease: 'easeOut' }}
                />
              )}
              {stats.low_count > 0 && (
                <motion.div
                  className="h-full bg-white/20 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(stats.low_count / stats.total_processed) * 100}%` }}
                  transition={{ duration: shouldReduce ? 0 : 0.6, ease: 'easeOut' }}
                />
              )}
              {(stats.needs_review_count ?? 0) > 0 && (
                <motion.div
                  className="h-full bg-purple-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${((stats.needs_review_count ?? 0) / stats.total_processed) * 100}%` }}
                  transition={{ duration: shouldReduce ? 0 : 0.6, ease: 'easeOut' }}
                />
              )}
            </div>
            <div className="flex justify-between mt-2 text-xs text-white/20">
              <span>{stats.strong_count} Strong</span>
              <span>{stats.potential_count} Potential</span>
              <span>{stats.low_count} Low</span>
              {(stats.needs_review_count ?? 0) > 0 && (
                <span>{stats.needs_review_count} Needs Review</span>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Candidate list ────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">
              Ranked candidates
              <span className="ml-2 text-sm text-white/25 font-normal">({candidates.length} total)</span>
            </h2>
            <div className="hidden md:flex items-center gap-6 text-[10px] font-bold text-white/20 uppercase tracking-widest pr-8">
              <span className="w-14 text-center">Exp.</span>
              <span className="w-16 text-center">Score</span>
              <span className="w-28 text-center">Tier</span>
            </div>
          </div>

          {candidates.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.07] p-12 text-center" style={{ background: '#0d0d14' }}>
              <p className="text-white/30 text-sm">No candidates were successfully processed.</p>
              <button
                onClick={() => navigate('/screen')}
                className="mt-4 text-cyan-400 text-sm font-medium hover:text-cyan-300 transition-colors"
              >
                ← Try uploading again
              </button>
            </div>
          ) : (
            <motion.div
              variants={staggerContainerVariants}
              initial={shouldReduce ? false : "hidden"}
              whileInView="visible"
              viewport={{ once: true }}
              className="space-y-3"
            >
              {candidates.map((c, i) => (
                <CandidateCard
                  key={c.id}
                  c={c}
                  rank={i + 1}
                  expanded={expanded === c.id}
                  onToggle={() => setExpanded(prev => prev === c.id ? null : c.id)}
                  onSignup={goSignup}
                />
              ))}
            </motion.div>
          )}
        </div>

        {/* ── Bottom CTA band ───────────────────────────────────────────── */}
        <motion.div
          variants={fadeInUpVariants}
          initial={shouldReduce ? false : "hidden"}
          whileInView="visible"
          viewport={{ once: true }}
          className="relative rounded-2xl overflow-hidden p-10 text-center border border-white/[0.08]"
          style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.12) 0%, rgba(59,130,246,0.12) 100%)' }}
        >
          <div className="relative">
            <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold px-3 py-1 rounded-full mb-4">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
              Results locked
            </div>

            <h2 className="text-2xl font-extrabold text-white mb-2 tracking-tight">
              Ready to see the full picture?
            </h2>
            <p className="text-white/40 text-sm mb-8 max-w-md mx-auto leading-relaxed">
              Create a free workspace to unlock candidate names, contact details,
              download a CSV shortlist, and save this batch for your team.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <motion.button
                whileHover={!shouldReduce ? { scale: 1.02 } : undefined}
                whileTap={!shouldReduce ? { scale: 0.98 } : undefined}
                onClick={goSignup}
                className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold px-8 py-3.5 rounded-xl text-sm shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-400 transition-all"
              >
                Create free workspace →
              </motion.button>

              <button
                onClick={() => navigate('/screen')}
                className="border border-white/[0.10] hover:border-white/20 text-white/50 hover:text-white font-semibold px-6 py-3.5 rounded-xl text-sm transition-all hover:bg-white/[0.03]"
              >
                Screen another batch
              </button>
            </div>

            <p className="text-white/20 text-xs mt-5">
              ✓ Your already-scored results won't be reprocessed — they transfer instantly.
            </p>
          </div>
        </motion.div>
      </div>

      <div className="h-12" />
    </div>
  );
}
