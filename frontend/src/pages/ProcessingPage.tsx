/**
 * Screen 3 — Live Processing State
 * ==================================
 * Restyled to HireRank Editorial Core theme:
 *  - Instrument Serif title
 *  - Unified Navbar minimal header
 *  - Single-accent progress bar (--accent: #5eead4)
 *  - Flat card surfaces with 1px var(--line) borders
 *  - Clean status icons with zero glow effects
 */

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Check, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  useReducedMotion,
  fadeInUpVariants,
  staggerContainerVariants,
  useCountUp,
} from '../utils/animations';
import Navbar from '../components/Navbar';

interface SessionStatus {
  session_id: string;
  status: string;
  stage: string;
  total: number;
  done: number;
  progress_pct: number;
}

const STAGES = [
  { key: 'parsing', label: 'Parsing resume files', desc: 'Extracting text and structure from PDF and DOCX documents' },
  { key: 'extracting', label: 'Extracting skills & experience', desc: 'Running NLP to identify technical skills and tenure' },
  { key: 'scoring', label: 'Computing match scores', desc: 'Comparing dense semantic embeddings and requirements' },
  { key: 'ranking', label: 'Ranking candidates', desc: 'Normalizing match scores and building ranked tiers' },
];

const stageIndex = (stage: string) => STAGES.findIndex((s) => s.key === stage);

type StageStatus = 'done' | 'active' | 'pending';

function stageStatusFor(currentStage: string, stageKey: string, overallDone: boolean): StageStatus {
  if (overallDone) return 'done';
  const current = stageIndex(currentStage);
  const idx = stageIndex(stageKey);
  if (idx < current) return 'done';
  if (idx === current) return 'active';
  return 'pending';
}

const StageIcon = ({ status }: { status: StageStatus }) => {
  if (status === 'done') {
    return (
      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center flex-shrink-0 text-emerald-400">
        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
      </div>
    );
  }
  if (status === 'active') {
    return (
      <div className="w-7 h-7 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent)]/30 flex items-center justify-center flex-shrink-0 text-[var(--accent)]">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-lg bg-white/[0.03] border border-[var(--line)] flex items-center justify-center flex-shrink-0 text-[var(--muted)]/40">
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
    </div>
  );
};

export default function ProcessingPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const shouldReduce = useReducedMotion();
  const { isAuthenticated } = useAuth();

  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const MAX_POLLS = 120; // 3 minutes max

  useEffect(() => {
    if (!sessionId) {
      navigate('/screen');
      return;
    }

    const poll = async () => {
      pollCountRef.current += 1;
      if (pollCountRef.current > MAX_POLLS) {
        clearInterval(pollIntervalRef.current!);
        setError('Processing is taking longer than expected. Please check back shortly.');
        return;
      }

      try {
        const res = await axios.get<SessionStatus>(`/api/guest/session/${sessionId}/status`);
        const data = res.data;
        setStatus(data);

        if (data.status === 'done') {
          clearInterval(pollIntervalRef.current!);
          setTimeout(() => {
            navigate(`/results/${sessionId}`);
          }, 800);
        } else if (data.status === 'error') {
          clearInterval(pollIntervalRef.current!);
          setError('An error occurred during resume processing. Please try again.');
        }
      } catch (err: any) {
        if (err.response?.status === 404) {
          clearInterval(pollIntervalRef.current!);
          setError('Session not found or has expired.');
        }
      }
    };

    poll();
    pollIntervalRef.current = setInterval(poll, 1500);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [sessionId, navigate]);

  const allDone = status?.status === 'done';

  const computeProgressPct = (s: SessionStatus | null): number => {
    if (!s) return 8;
    const total = s.total || 1;
    const scoredRatio = (s.done || 0) / total;

    const stageFloors: Record<string, number> = {
      parsing: 10,
      extracting: 35,
      scoring: 60,
      ranking: 90,
      done: 100,
    };
    const floor = stageFloors[s.stage] ?? 8;

    if (typeof s.progress_pct === 'number' && s.progress_pct > 0) {
      return Math.max(floor, s.progress_pct);
    }

    switch (s.stage) {
      case 'parsing':
        return Math.max(12, Math.round(10 + ((s.done || 0) / total) * 15));
      case 'extracting':
        return Math.max(35, Math.round(35 + ((s.done || 0) / total) * 20));
      case 'scoring':
        return Math.max(60, Math.round(60 + scoredRatio * 32));
      case 'ranking':
        return 96;
      case 'done':
        return 100;
      default:
        return Math.max(8, Math.round(scoredRatio * 100));
    }
  };

  const currentPct = allDone ? 100 : computeProgressPct(status);
  const animatedPct = useCountUp(currentPct, 0.6);

  return (
    <div className="min-h-screen font-sans flex flex-col bg-transparent text-[var(--text)] antialiased">
      <Navbar minimal />

      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg">
          {/* Error State */}
          {error && (
            <motion.div
              variants={fadeInUpVariants}
              initial={shouldReduce ? false : 'hidden'}
              animate="visible"
              className="card-surface p-8 text-center space-y-4 border-rose-500/25 bg-rose-500/5"
            >
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
                <AlertCircle className="w-6 h-6 stroke-[1.8]" />
              </div>
              <p className="text-sm font-medium text-[var(--text)]">{error}</p>
              <button
                onClick={() => navigate('/screen')}
                className="btn-ghost text-xs py-2 px-4"
              >
                ← Return to screening
              </button>
            </motion.div>
          )}

          {/* Processing Card */}
          {!error && (
            <motion.div
              variants={fadeInUpVariants}
              initial={shouldReduce ? false : 'hidden'}
              animate="visible"
              className="card-surface p-8"
            >
              <div className="text-center mb-8">
                <div
                  className={`w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center border ${
                    allDone
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : 'bg-[var(--accent-dim)] border-[var(--accent)]/30 text-[var(--accent)]'
                  }`}
                >
                  {allDone ? (
                    <Check className="w-6 h-6 stroke-[2.5]" />
                  ) : (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  )}
                </div>
                <h2 className="font-serif-display text-2xl md:text-3xl text-[var(--text)] font-normal tracking-tight mb-1.5">
                  {allDone ? 'Screening Complete' : 'Analyzing Candidates…'}
                </h2>
                <p className="text-xs text-[var(--muted)] font-mono">
                  {allDone
                    ? 'Redirecting to ranked shortlist…'
                    : status
                    ? status.stage === 'scoring' || status.done > 0
                      ? `${status.done} of ${status.total} candidates scored`
                      : status.stage === 'extracting'
                      ? `Extracting skills & experience (${status.total} resumes)`
                      : `Parsing ${status.total} resume files…`
                    : 'Initializing pipeline…'}
                </p>
              </div>

              {/* Progress bar */}
              <div className="mb-8">
                <div className="flex justify-between text-xs text-[var(--muted)] mb-2 font-mono">
                  <span>Pipeline progress</span>
                  <span className="text-[var(--accent)] tabular-nums">{animatedPct}%</span>
                </div>
                <div className="h-1.5 bg-white/[0.05] border border-[var(--line)] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-[var(--accent)] rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${currentPct}%` }}
                    transition={{ duration: shouldReduce ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>

              {/* Stages checklist */}
              <motion.div
                variants={staggerContainerVariants}
                initial={shouldReduce ? false : 'hidden'}
                animate="visible"
                className="space-y-3"
              >
                {STAGES.map((stage) => {
                  const ss = stageStatusFor(status?.stage ?? 'parsing', stage.key, allDone);
                  return (
                    <div
                      key={stage.key}
                      className={`flex items-start gap-3.5 p-3 rounded-lg border transition-all ${
                        ss === 'active'
                          ? 'bg-[var(--accent-dim)]/50 border-[var(--accent)]/30'
                          : ss === 'done'
                          ? 'bg-white/[0.01] border-[var(--line)]'
                          : 'border-transparent opacity-40'
                      }`}
                    >
                      <StageIcon status={ss} />
                      <div className="flex-1 pt-0.5 min-w-0">
                        <p
                          className={`text-sm font-medium ${
                            ss === 'done'
                              ? 'text-emerald-400'
                              : ss === 'active'
                              ? 'text-[var(--accent)]'
                              : 'text-[var(--muted)]'
                          }`}
                        >
                          {stage.label}
                        </p>
                        <p className="text-xs text-[var(--muted)] mt-0.5 leading-relaxed">
                          {stage.desc}
                        </p>
                      </div>
                      {ss === 'active' && (
                        <span className="badge-mono text-[9px] text-[var(--accent)] border-[var(--accent)]/30">
                          RUNNING
                        </span>
                      )}
                    </div>
                  );
                })}
              </motion.div>

              {/* Session note */}
              <div className="mt-8 p-3 rounded-lg bg-white/[0.02] border border-[var(--line)]">
                <p className="text-[11px] text-[var(--muted)] text-center leading-relaxed">
                  Results are stored for this session. Save to a workspace to access permanent history and export full reports.
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
