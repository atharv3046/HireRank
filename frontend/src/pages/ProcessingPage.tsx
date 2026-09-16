/**
 * Screen 3 — Live Processing State
 * ==================================
 * Polls GET /api/guest/session/:sessionId/status every 1.5 s.
 * Reflects REAL backend stage — does NOT use a fake timer.
 * Navigates to /results/:sessionId once status === "done".
 *
 * Fully styled in HireRank dark theme (#0a0a0f, #0d0d14, cyan/blue accent).
 */

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useReducedMotion,
  fadeInUpVariants,
  staggerContainerVariants,
  useCountUp,
  pulseGlowVariants,
} from '../utils/animations';

interface SessionStatus {
  session_id: string;
  status: string;
  stage: string;
  total: number;
  done: number;
  progress_pct: number;
}

const STAGES = [
  { key: 'parsing',    label: 'Parsing resume files',          desc: 'Extracting text from PDF and DOCX files' },
  { key: 'extracting', label: 'Extracting skills & experience', desc: 'Running NLP to identify skills, dates, education' },
  { key: 'scoring',    label: 'Computing match scores',         desc: 'Semantic similarity + skill coverage + experience fit' },
  { key: 'ranking',    label: 'Ranking candidates',             desc: 'Ordering by score and assigning tier badges' },
];

const stageIndex = (stage: string) =>
  STAGES.findIndex(s => s.key === stage);

type StageStatus = 'done' | 'active' | 'pending';

function stageStatusFor(currentStage: string, stageKey: string, overallDone: boolean): StageStatus {
  if (overallDone) return 'done';
  const current = stageIndex(currentStage);
  const idx     = stageIndex(stageKey);
  if (idx < current) return 'done';
  if (idx === current) return 'active';
  return 'pending';
}

const StageIcon = ({ status, shouldReduce }: { status: StageStatus; shouldReduce: boolean }) => {
  if (status === 'done') {
    return (
      <motion.div
        initial={shouldReduce ? false : { scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 shadow-sm shadow-emerald-500/20"
      >
        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </motion.div>
    );
  }
  if (status === 'active') {
    return (
      <div className="relative flex items-center justify-center">
        {!shouldReduce && (
          <motion.div
            variants={pulseGlowVariants}
            initial="initial"
            animate="animate"
            className="absolute inset-0 rounded-xl bg-cyan-400/20 blur-sm pointer-events-none"
          />
        )}
        <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center flex-shrink-0 relative z-10">
          <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
      <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
    </div>
  );
};

export default function ProcessingPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const shouldReduce = useReducedMotion();

  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const poll = async () => {
      try {
        const res = await axios.get(`/api/guest/session/${sessionId}/status`);
        const data: SessionStatus = res.data;
        setStatus(data);

        if (data.status === 'done') {
          clearInterval(intervalRef.current!);
          setTimeout(() => navigate(`/results/${sessionId}`), 800);
        }

        if (data.status === 'error') {
          clearInterval(intervalRef.current!);
          setError('Processing failed. Please try again.');
        }
      } catch (e: any) {
        if (e.response?.status === 404) {
          clearInterval(intervalRef.current!);
          localStorage.removeItem('guest_session_id');
          setError('Session not found. It may have expired.');
        }
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 1500);
    return () => clearInterval(intervalRef.current!);
  }, [sessionId, navigate]);

  const allDone = status?.status === 'done';
  const currentPct = allDone ? 100 : (status?.progress_pct ?? 0);
  const animatedPct = useCountUp(currentPct, 0.6);
  const isReduced = Boolean(shouldReduce);

  return (
    <div className="min-h-screen font-sans flex flex-col antialiased text-white" style={{ background: '#0a0a0f' }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="border-b border-white/[0.06] px-8 py-4 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-bold text-white text-lg group-hover:text-cyan-400 transition-colors">
            Hire<span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Rank</span>
          </span>
        </button>
        <span className="text-xs font-mono text-white/30">Guest Session</span>
      </header>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg">

          {/* Error state */}
          {error && (
            <motion.div
              variants={fadeInUpVariants}
              initial={shouldReduce ? false : "hidden"}
              animate="visible"
              className="rounded-2xl border border-red-500/20 bg-red-950/20 p-8 text-center space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-white/80">{error}</p>
              <button
                onClick={() => navigate('/screen')}
                className="text-xs bg-white/[0.06] hover:bg-white/[0.1] text-white px-4 py-2 rounded-xl transition-colors font-medium"
              >
                ← Start over
              </button>
            </motion.div>
          )}

          {/* Processing card */}
          {!error && (
            <motion.div
              variants={fadeInUpVariants}
              initial={shouldReduce ? false : "hidden"}
              animate="visible"
              className="rounded-2xl border border-white/[0.08] p-8 shadow-2xl relative overflow-hidden"
              style={{ background: '#0d0d14' }}
            >
              {/* Subtle gradient glow behind card */}
              <div className="absolute -top-20 -left-20 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative">
                {/* ── Title ───────────────────────────────────────────────── */}
                <div className="text-center mb-8">
                  <motion.div
                    className={`w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center border ${
                      allDone
                        ? 'bg-emerald-500/15 border-emerald-500/30 shadow-lg shadow-emerald-500/20'
                        : 'bg-cyan-500/15 border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                    }`}
                    animate={allDone ? { scale: [1, 1.1, 1] } : undefined}
                    transition={{ duration: 0.4 }}
                  >
                    {allDone ? (
                      <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <div className="w-6 h-6 border-[2.5px] border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    )}
                  </motion.div>
                  <h2 className="text-xl font-extrabold text-white mb-1.5 tracking-tight">
                    {allDone ? 'All done!' : 'Processing your resumes…'}
                  </h2>
                  <p className="text-xs text-white/40">
                    {allDone
                      ? 'Redirecting to your results…'
                      : status
                        ? `${status.done} of ${status.total} candidates scored`
                        : 'Starting pipeline…'
                    }
                  </p>
                </div>

                {/* ── Progress bar ─────────────────────────────────────────── */}
                <div className="mb-8">
                  <div className="flex justify-between text-xs text-white/40 mb-2 font-medium">
                    <span>Overall progress</span>
                    <span className="text-cyan-400 font-semibold">{animatedPct}%</span>
                  </div>
                  <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full shadow-sm shadow-cyan-500/50"
                      initial={{ width: 0 }}
                      animate={{ width: `${currentPct}%` }}
                      transition={{ duration: shouldReduce ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </div>

                {/* ── Stage checklist ──────────────────────────────────────── */}
                <motion.div
                  variants={staggerContainerVariants}
                  initial={shouldReduce ? false : "hidden"}
                  animate="visible"
                  className="space-y-3.5"
                >
                  {STAGES.map(stage => {
                    const ss = stageStatusFor(status?.stage ?? 'parsing', stage.key, allDone);
                    return (
                      <motion.div
                        variants={fadeInUpVariants}
                        key={stage.key}
                        className={`flex items-start gap-4 p-3 rounded-xl border transition-all ${
                          ss === 'active'
                            ? 'bg-cyan-500/[0.05] border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                            : ss === 'done'
                              ? 'bg-white/[0.01] border-white/[0.05]'
                              : 'border-transparent'
                        }`}
                      >
                        <StageIcon status={ss} shouldReduce={isReduced} />
                        <div className="flex-1 pt-0.5 min-w-0">
                          <p className={`text-sm font-semibold ${
                            ss === 'done'    ? 'text-emerald-400' :
                            ss === 'active'  ? 'text-cyan-300' :
                            'text-white/30'
                          }`}>
                            {stage.label}
                          </p>
                          <p className="text-xs text-white/30 mt-0.5 leading-relaxed">{stage.desc}</p>
                        </div>
                        {ss === 'active' && (
                          <span className="text-[10px] font-semibold tracking-wider text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full flex-shrink-0 pt-0.5 animate-pulse">
                            RUNNING
                          </span>
                        )}
                      </motion.div>
                    );
                  })}
                </motion.div>

                {/* ── Session note ─────────────────────────────────────────── */}
                <div className="mt-8 p-3.5 bg-white/[0.02] rounded-xl border border-white/[0.05]">
                  <p className="text-[11px] text-white/30 text-center leading-relaxed">
                    🔒 Results are kept in-memory for this session.
                    Create a free workspace to unlock full names and export to CSV.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
