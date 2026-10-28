import React, { useState, useEffect, useCallback } from 'react';
import { api, InterviewQuestion, InterviewQuestionsResponse } from '../api/client';

interface InterviewQuestionsCardProps {
  candidateId: number;
  candidateName?: string;
  isAdversarial?: boolean;
  cachedQuestions?: InterviewQuestionsResponse | null;
}

export const InterviewQuestionsCard: React.FC<InterviewQuestionsCardProps> = ({
  candidateId,
  candidateName = 'Candidate',
  isAdversarial = false,
  cachedQuestions = null,
}) => {
  const [data, setData] = useState<InterviewQuestionsResponse | null>(cachedQuestions);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const fetchQuestions = useCallback(async (forceRegenerate = false) => {
    try {
      if (forceRegenerate) {
        setRegenerating(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const res = await api.getInterviewQuestions(candidateId, forceRegenerate);
      setData(res);
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError(err.response?.data?.detail || 'Rate limit reached: Maximum 20 interview generation calls per hour per recruiter.');
      } else {
        setError(err.response?.data?.detail || 'Failed to load interview questions. Please try again.');
      }
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  }, [candidateId]);

  // Load automatically if not already present
  useEffect(() => {
    if (!data) {
      fetchQuestions(false);
    }
  }, [candidateId, data, fetchQuestions]);

  const handleCopyAll = () => {
    if (!data?.questions || data.questions.length === 0) return;

    const lines = [
      `### Interview Prep & Coaching Briefing: ${candidateName}`,
      `Source: ${data.source.toUpperCase()} ${data.is_adversarial_blocked ? '(Deterministic Adversarial Shield Mode)' : ''}`,
      '',
    ];

    data.questions.forEach((q, idx) => {
      lines.push(`${idx + 1}. [${q.based_on}]`);
      lines.push(`Question: ${q.question}`);
      lines.push(`What to listen for: ${q.listen_for}`);
      lines.push('');
    });

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopySingle = (q: InterviewQuestion, idx: number) => {
    const text = `[${q.based_on}]\n${q.question}\n(Listen for: ${q.listen_for})`;
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getTagBadgeStyle = (basedOn: string) => {
    const lower = basedOn.toLowerCase();
    if (lower.includes('missing skill') || lower.includes('missing required')) {
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    }
    if (lower.includes('career trajectory') || lower.includes('promotion') || lower.includes('tenure')) {
      return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
    }
    if (lower.includes('evidence probe') || lower.includes('claim')) {
      return 'bg-[var(--accent-dim)] text-[var(--accent)] border-[var(--accent)]/30';
    }
    return 'bg-white/[0.08] text-white/70 border-white/[0.12]';
  };

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white/[0.015] p-5 backdrop-blur-sm">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--line)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-[var(--line)] text-[var(--accent)] flex items-center justify-center text-lg shadow-sm">
            🎯
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white tracking-wide">
                Targeted Interview Questions
              </h4>
              {data && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                    data.source === 'chatgpt'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : data.source === 'cached'
                      ? 'bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
                >
                  {data.source === 'chatgpt' ? '✨ GPT-4o' : data.source === 'cached' ? '⚡ Cached' : '📋 Template'}
                </span>
              )}
            </div>
            <p className="text-xs text-white/40 mt-0.5">
              Recruiter Moment: "What do I actually ask this person in the interview?"
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {data && data.questions && data.questions.length > 0 && (
            <button
              onClick={handleCopyAll}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-white/80 hover:text-white border border-white/[0.1] transition-all flex items-center gap-1.5"
              title="Copy all 5 questions and coaching notes to clipboard"
            >
              {copiedAll ? (
                <>
                  <span className="text-emerald-400">✓</span>
                  <span className="text-emerald-300">Copied Briefing</span>
                </>
              ) : (
                <>
                  <span>📋</span>
                  <span>Copy All</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={() => fetchQuestions(true)}
            disabled={regenerating || loading || isAdversarial}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              isAdversarial
                ? 'opacity-40 cursor-not-allowed bg-white/[0.02] text-white/40 border border-[var(--line)]'
                : 'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40'
            }`}
            title={isAdversarial ? 'Regeneration disabled for flagged resumes' : 'Refresh questions using ChatGPT (rate limit: 20/hr)'}
          >
            {regenerating ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
                <span>Regenerating...</span>
              </>
            ) : (
              <>
                <span>✨</span>
                <span>Regenerate</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Adversarial Gate Banner */}
      {data?.is_adversarial_blocked && (
        <div className="mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2.5">
          <span className="text-base flex-shrink-0">🛡️</span>
          <div>
            <div className="font-bold text-rose-200">
              Generative prep unavailable — this resume was flagged by the Adversarial Shield. Review that first.
            </div>
            <div className="text-[11px] text-rose-300/80 mt-1 leading-relaxed">
              To eliminate prompt injection risks, OpenAI API was bypassed and deterministic template questions were generated instead.
            </div>
          </div>
        </div>
      )}

      {/* Rate Limit / Error Banner */}
      {error && (
        <div className="mt-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchQuestions(false)}
            className="text-[11px] underline font-medium hover:text-white"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !data && (
        <div className="mt-5 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse space-y-2"
            >
              <div className="h-4 w-1/4 bg-white/[0.08] rounded" />
              <div className="h-5 w-3/4 bg-white/[0.06] rounded" />
              <div className="h-4 w-1/2 bg-white/[0.04] rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Questions List */}
      {data && data.questions && data.questions.length > 0 && (
        <div className="mt-4 space-y-3">
          {data.questions.map((q, idx) => (
            <div
              key={idx}
              className="group p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.035] border border-[var(--line)] transition-all space-y-2.5 relative"
            >
              {/* Question Header & Tag */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-5 h-5 rounded-full bg-white/[0.06] text-white/70 text-[10px] font-black flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span
                    className={`text-[11px] px-2.5 py-0.5 rounded-md font-semibold border ${getTagBadgeStyle(
                      q.based_on
                    )}`}
                  >
                    {q.based_on}
                  </span>
                </div>

                <button
                  onClick={() => handleCopySingle(q, idx)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-white/40 hover:text-white px-2 py-0.5 rounded bg-white/[0.04] border border-[var(--line)]"
                  title="Copy question to clipboard"
                >
                  {copiedIndex === idx ? '✓ Copied' : 'Copy'}
                </button>
              </div>

              {/* The Question */}
              <p className="text-sm font-semibold text-white/90 leading-snug">
                {q.question}
              </p>

              {/* Coaching Note: What to listen for */}
              <div className="p-2.5 rounded-lg bg-indigo-950/20 border-l-2 border-indigo-400/80 text-xs">
                <div className="text-[10px] font-bold text-indigo-300/80 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                  <span>👂</span>
                  <span>What to Listen For</span>
                </div>
                <p className="text-white/60 text-xs leading-relaxed">
                  {q.listen_for}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
