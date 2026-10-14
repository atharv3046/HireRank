import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Lock,
  EyeOff,
  Terminal,
  Info,
  X
} from 'lucide-react';

export interface AdversarialDetection {
  type: string;
  rule: string;
  snippet?: string;
  matched_text?: string;
  explanation?: string;
  page?: number;
}

export interface AdversarialDetails {
  is_flagged?: boolean;
  threat_level?: string;
  threat_count?: number;
  detections?: AdversarialDetection[];
  action_taken?: string;
  sanitized_text?: string;
}

interface AdversarialShieldBadgeProps {
  isAdversarial?: boolean;
  details?: AdversarialDetails | null;
  mode?: 'chip' | 'panel';
  candidateName?: string;
  className?: string;
}

export const AdversarialShieldBadge: React.FC<AdversarialShieldBadgeProps> = ({
  isAdversarial = false,
  details,
  mode = 'chip',
  candidateName = 'Candidate',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const threatCount = details?.threat_count || details?.detections?.length || (isAdversarial ? 1 : 0);
  const threatLevel = details?.threat_level || 'HIGH';
  const detections = details?.detections || [];

  if (mode === 'chip') {
    if (!isAdversarial) {
      return (
        <span
          title="Passed automated prompt injection & hidden text scans"
          className={`inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full cursor-help ${className}`}
        >
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          Shield Clean
        </span>
      );
    }

    return (
      <div className={`relative inline-block ${className}`}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-0.5 rounded-full hover:bg-rose-500/30 transition-all shadow-sm shadow-rose-500/20 animate-pulse"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>Shield Alert ({threatCount})</span>
          {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 4 }}
              className="absolute left-0 mt-2 z-50 w-80 sm:w-96 p-3.5 rounded-xl bg-slate-900 border border-rose-500/30 shadow-2xl space-y-2 text-xs"
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                <div className="flex items-center gap-1.5 text-rose-300 font-bold">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  Adversarial Attempt Detected
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-white/70 text-[11px] leading-relaxed">
                Resume contained prompt injection or invisible text patterns designed to game automated screening algorithms.
              </p>

              {detections.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {detections.map((det, idx) => (
                    <div key={idx} className="p-2 rounded bg-black/40 border border-rose-500/20 text-[11px] space-y-1 font-mono">
                      <div className="flex items-center justify-between text-rose-400 font-bold font-sans">
                        <span>{det.rule}</span>
                        <span className="text-[10px] text-white/40 uppercase">{det.type}</span>
                      </div>
                      {det.snippet && (
                        <div className="text-white/80 italic text-[10px] truncate select-all">
                          "{det.snippet}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-1 text-[10px] text-amber-300/80 flex items-center gap-1 border-t border-white/[0.06]">
                <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                Quarantined for recruiter review. Generative interview prep locked.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Mode: Panel (Expanded Candidate Drawer View) ──
  if (!isAdversarial) {
    return (
      <div className={`p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs flex items-center justify-between ${className}`}>
        <div className="flex items-center gap-2 text-emerald-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold">Adversarial Shield: Integrity Verified</span>
          <span className="text-[11px] text-emerald-400/60">• Clean of prompt injection & hidden text</span>
        </div>
        <span className="text-[10px] text-white/40 font-mono bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06]">
          Status: Clean
        </span>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs space-y-3 shadow-lg shadow-rose-950/30 ${className}`}>
      {/* Alert Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-rose-500/20">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-rose-500/20 flex items-center justify-center border border-rose-500/30">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-rose-300 flex items-center gap-2">
              Adversarial Shield Alert: Gamed Resume Attempt Detected
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-rose-500/30 text-rose-200 border border-rose-400/40">
                {threatLevel} Threat
              </span>
            </div>
            <div className="text-[11px] text-white/60">
              Candidate {candidateName}'s resume contains deceptive instructions or hidden text designed to hijack AI ranking.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <span className="text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-md flex items-center gap-1">
            <Lock className="w-3 h-3 text-amber-400" />
            AI Gen Locked
          </span>
        </div>
      </div>

      {/* Quarantined Detections */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
          Detected Adversarial Vectors ({threatCount}):
        </div>

        {detections.length > 0 ? (
          detections.map((det, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg bg-black/60 border border-rose-500/20 space-y-1.5 font-mono"
            >
              <div className="flex items-center justify-between text-xs font-sans font-bold">
                <span className="text-rose-300 flex items-center gap-1.5">
                  {det.type === 'invisible_text' ? (
                    <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <Terminal className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  {det.rule}
                </span>
                <span className="text-[10px] text-white/40 bg-white/[0.04] px-1.5 py-0.5 rounded">
                  Type: {det.type}
                </span>
              </div>

              {det.snippet && (
                <div className="p-2 rounded bg-rose-950/30 border border-rose-500/20 text-xs text-rose-200 italic font-mono select-all">
                  "{det.snippet}"
                </div>
              )}

              {det.explanation && (
                <div className="text-[11px] text-white/60 font-sans leading-relaxed">
                  {det.explanation}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="p-2.5 rounded bg-black/40 border border-rose-500/20 text-xs text-white/70">
            Candidate resume flagged by automated adversarial heuristic scan.
          </div>
        )}
      </div>

      {/* Recruiter Protection Summary */}
      <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[11px] text-white/70 flex items-start gap-2">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-white/90">HireRank Shield Action: </span>
          Scores have been quarantined and marked as <em>Needs Review</em>. Downstream generative interview question synthesis (OpenAI API) is locked for this profile to prevent prompt escape.
        </div>
      </div>
    </div>
  );
};
