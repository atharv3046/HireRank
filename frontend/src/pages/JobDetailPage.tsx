/**
 * Screen 7 — Candidate List / Batch Detail (/jobs/:jobId)
 * ========================================================
 * Framer Motion animation pass with:
 *  - Smooth accordion expand/collapse via AnimatePresence
 *  - Staggered candidate row entrance
 *  - Interactive button states & spinning rerank icon
 *  - prefers-reduced-motion safety
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import { api, JobPosting, CandidateWithScore } from '../api/client';
import {
  useReducedMotion,
  fadeInUpVariants,
  staggerContainerVariants,
  accordionVariants,
} from '../utils/animations';

const TIER_BADGES: Record<string, string> = {
  Strong: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Potential: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Low: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  'Needs Review': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

const TIER_DOTS: Record<string, string> = {
  Strong: 'bg-emerald-500',
  Potential: 'bg-amber-400',
  Low: 'bg-slate-400',
  'Needs Review': 'bg-rose-500',
};

const ScoreBadge: React.FC<{ score: number | null; needsReview?: boolean }> = ({ score, needsReview }) => {
  if (needsReview || score === null || score === undefined) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border bg-rose-500/10 text-rose-400 border-rose-500/20">
        <svg className="w-3.5 h-3.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        Needs Review
      </span>
    );
  }
  const s = Math.round(score);
  const style = s >= 75
    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : s >= 55
    ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    : 'text-slate-400 bg-slate-500/10 border-slate-500/20';

  return (
    <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-black border ${style}`}>
      {s}%
    </span>
  );
};

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const shouldReduce = useReducedMotion();

  const [job, setJob] = useState<JobPosting | null>(null);
  const [candidates, setCandidates] = useState<CandidateWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [reranking, setReranking] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filters & Sorting state
  const [tierFilter, setTierFilter] = useState<'all' | 'Strong' | 'Potential' | 'Low' | 'Needs Review'>('all');
  const [skillFilter, setSkillFilter] = useState('');
  const [sortBy, setSortBy] = useState<'score_desc' | 'score_asc' | 'exp_desc'>('score_desc');

  // Expanded rows state
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJob = useCallback(async () => {
    if (!jobId) return;
    try {
      const data = await api.getJob(jobId);
      setJob(data);
    } catch {
      setJob(null);
    }
  }, [jobId]);

  const fetchCandidates = useCallback(async () => {
    if (!jobId) return;
    try {
      const data = await api.getRankedCandidates(jobId);
      setCandidates(data || []);
    } catch (e) {
      console.error('Failed to load candidates', e);
    }
  }, [jobId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchJob(), fetchCandidates()]).finally(() => setLoading(false));
  }, [fetchJob, fetchCandidates]);

  // Polling for processing candidates
  useEffect(() => {
    const hasUnfinished = candidates.some(
      c => c.processing_status !== 'done' && c.processing_status !== 'error' && c.processing_status !== 'needs_manual_review'
    );
    if (hasUnfinished) {
      pollingRef.current = setInterval(() => {
        fetchCandidates();
      }, 2500);
    } else if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [candidates, fetchCandidates]);

  const handleRerank = async () => {
    if (!jobId) return;
    setReranking(true);
    try {
      await api.rerankAll(jobId);
      await fetchCandidates();
    } finally {
      setReranking(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // CSV Export
  const handleExportCsv = async () => {
    if (!jobId) return;
    setExporting(true);
    try {
      const blob = await api.exportJobCsv(jobId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(job?.title || 'batch').replace(/\s+/g, '_')}_candidates.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV export failed', err);
    } finally {
      setExporting(false);
    }
  };

  // Filter & sort logic
  const filteredCandidates = candidates.filter(c => {
    const candidateTier = c.tier || (c.needs_manual_review ? 'Needs Review' : (c.overall_score && c.overall_score >= 75 ? 'Strong' : c.overall_score && c.overall_score >= 55 ? 'Potential' : 'Low'));
    if (tierFilter !== 'all' && candidateTier !== tierFilter) return false;

    if (skillFilter.trim()) {
      const q = skillFilter.toLowerCase().trim();
      const hasSkill =
        c.extracted_skills?.some(s => s.toLowerCase().includes(q)) ||
        c.matched_skills?.some(s => s.toLowerCase().includes(q));
      if (!hasSkill) return false;
    }
    return true;
  });

  filteredCandidates.sort((a, b) => {
    if (sortBy === 'score_desc') {
      return (b.overall_score !== null ? 1 : 0) - (a.overall_score !== null ? 1 : 0) || ((b.overall_score ?? 0) - (a.overall_score ?? 0));
    }
    if (sortBy === 'score_asc') {
      return (a.overall_score ?? 999) - (b.overall_score ?? 999);
    }
    if (sortBy === 'exp_desc') {
      return (b.experience_years ?? -1) - (a.experience_years ?? -1);
    }
    return 0;
  });

  const selectAll = () => {
    if (selectedIds.size === filteredCandidates.length && filteredCandidates.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCandidates.map(c => c.id)));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen font-sans text-white" style={{ background: '#0a0a0f' }}>
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-white/40">Loading candidate roster…</p>
          </div>
        </main>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex min-h-screen font-sans text-white" style={{ background: '#0a0a0f' }}>
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-white font-bold text-lg mb-2">Screening Batch Not Found</p>
            <button onClick={() => navigate('/dashboard')} className="text-cyan-400 text-sm font-semibold hover:underline">
              ← Return to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen font-sans text-white" style={{ background: '#0a0a0f' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <motion.div
          initial={shouldReduce ? false : "hidden"}
          animate="visible"
          variants={staggerContainerVariants}
          className="px-8 py-8 max-w-6xl mx-auto"
        >
          {/* Breadcrumb */}
          <motion.button
            variants={fadeInUpVariants}
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-xs font-semibold text-white/40 hover:text-white mb-6 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </motion.button>

          {/* Batch header card */}
          <motion.div
            variants={fadeInUpVariants}
            className="rounded-2xl border border-white/[0.08] p-6 shadow-sm mb-6"
            style={{ background: '#0d0d14' }}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold tracking-wider text-cyan-400 uppercase bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/20">
                    SCREENING BATCH #{job.id}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {job.status.toUpperCase()}
                  </span>
                </div>
                <h1 className="text-2xl font-black text-white mt-2">{job.title}</h1>
                <div className="flex flex-wrap items-center gap-4 text-xs text-white/40 mt-2">
                  <span>⏱️ Min. {job.min_experience_years} years experience</span>
                  {job.education_requirement && (
                    <span className="capitalize">🎓 {job.education_requirement.replace('_', ' ')} required</span>
                  )}
                  <span>👥 {candidates.length} total candidates</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                <motion.button
                  onClick={handleExportCsv}
                  disabled={exporting || candidates.length === 0}
                  whileHover={shouldReduce ? undefined : { scale: 1.02 }}
                  whileTap={shouldReduce ? undefined : { scale: 0.98 }}
                  className="flex items-center gap-2 border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
                >
                  <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {exporting ? 'Exporting…' : 'Export CSV'}
                </motion.button>

                <motion.button
                  onClick={handleRerank}
                  disabled={reranking || candidates.length === 0}
                  whileHover={shouldReduce ? undefined : { scale: 1.02 }}
                  whileTap={shouldReduce ? undefined : { scale: 0.98 }}
                  className="flex items-center gap-2 border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
                >
                  <svg className={`w-4 h-4 ${reranking ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {reranking ? 'Re-ranking…' : 'Re-rank All'}
                </motion.button>

                <motion.button
                  onClick={() => navigate(`/jobs/${jobId}/upload`)}
                  whileHover={shouldReduce ? undefined : { scale: 1.02 }}
                  whileTap={shouldReduce ? undefined : { scale: 0.98 }}
                  className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-cyan-500/20"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Resumes
                </motion.button>
              </div>
            </div>

            {/* Required skills tags */}
            {job.required_skills && job.required_skills.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center gap-2 flex-wrap text-xs">
                <span className="font-semibold text-white/50">Required Must-Have Skills:</span>
                {job.required_skills.map(s => (
                  <span key={s} className="bg-white/[0.04] text-white/80 border border-white/[0.06] px-2.5 py-0.5 rounded-md font-medium">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </motion.div>

          {/* Filters and controls */}
          <motion.div
            variants={fadeInUpVariants}
            className="rounded-2xl border border-white/[0.08] p-4 shadow-sm mb-6"
            style={{ background: '#0d0d14' }}
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Skill search */}
              <div className="relative w-full md:w-72">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={skillFilter}
                  onChange={e => setSkillFilter(e.target.value)}
                  placeholder="Filter by skill (e.g. React, Python)..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>

              {/* 4-Tier Filter Buttons */}
              <div className="flex items-center gap-1.5 p-1 bg-white/[0.04] rounded-xl text-xs font-semibold border border-white/[0.06]">
                {(['all', 'Strong', 'Potential', 'Low', 'Needs Review'] as const).map(tier => (
                  <button
                    key={tier}
                    onClick={() => setTierFilter(tier)}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      tierFilter === tier
                        ? 'bg-white text-black font-bold shadow-sm'
                        : 'text-white/40 hover:text-white'
                    }`}
                  >
                    {tier === 'all' ? 'All Tiers' : tier}
                  </button>
                ))}
              </div>

              {/* Sort By */}
              <div className="flex items-center gap-2 text-xs text-white/40">
                <span className="font-semibold uppercase tracking-wider">Sort:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="bg-[#14141f] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                >
                  <option value="score_desc">Highest Match Score</option>
                  <option value="score_asc">Lowest Match Score</option>
                  <option value="exp_desc">Most Experience (Years)</option>
                </select>
              </div>
            </div>

            {/* Selection info bar */}
            {selectedIds.size > 0 && (
              <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
                <span className="font-bold text-cyan-300">
                  {selectedIds.size} of {filteredCandidates.length} candidate(s) selected
                </span>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-white/40 hover:text-white font-medium"
                >
                  Clear Selection
                </button>
              </div>
            )}
          </motion.div>

          {/* Candidates Full Table */}
          <motion.div
            variants={fadeInUpVariants}
            className="rounded-2xl border border-white/[0.08] overflow-hidden shadow-sm"
            style={{ background: '#0d0d14' }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[11px] font-bold text-white/40 uppercase tracking-wider">
                    <th className="py-4 pl-6 pr-2 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === filteredCandidates.length && filteredCandidates.length > 0}
                        onChange={selectAll}
                        className="rounded bg-white/[0.04] border-white/[0.2] text-cyan-500 focus:ring-cyan-500/50 accent-cyan-500"
                      />
                    </th>
                    <th className="py-4 px-4">Candidate & Contact (Unblurred)</th>
                    <th className="py-4 px-4 text-center">Experience & Degree</th>
                    <th className="py-4 px-4 text-center">Score</th>
                    <th className="py-4 px-4 text-center">Tier</th>
                    <th className="py-4 pr-6 pl-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-sm">
                  {filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <div className="max-w-md mx-auto space-y-3">
                          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto text-cyan-400">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <p className="text-base font-bold text-white">
                            {candidates.length === 0 ? 'No resumes uploaded yet' : 'No candidates match filter'}
                          </p>
                          <p className="text-xs text-white/40 leading-relaxed">
                            {candidates.length === 0
                              ? 'Upload candidate resumes (PDF or DOCX) to automatically score and rank them against this role’s criteria.'
                              : 'Try adjusting your search query or tier filters above.'}
                          </p>
                          {candidates.length === 0 && (
                            <button
                              onClick={() => navigate(`/jobs/${jobId}/upload`)}
                              className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-md shadow-cyan-500/20 mt-2"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              Upload Resumes for this Job
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map(c => {
                      const tier = c.tier || (c.needs_manual_review ? 'Needs Review' : (c.overall_score && c.overall_score >= 75 ? 'Strong' : c.overall_score && c.overall_score >= 55 ? 'Potential' : 'Low'));
                      const isExpanded = expandedIds.has(c.id);
                      const isSelected = selectedIds.has(c.id);

                      // Bonus strengths beyond JD: extracted skills not in JD required skills
                      const reqSkillsLower = (job.required_skills || []).map(s => s.toLowerCase());
                      const beyondSkills = (c.extracted_skills || []).filter(
                        s => !reqSkillsLower.includes(s.toLowerCase())
                      );

                      return (
                        <React.Fragment key={c.id}>
                          <tr
                            className={`transition-colors hover:bg-white/[0.02] ${
                              isSelected ? 'bg-cyan-500/10' : ''
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="py-4 pl-6 pr-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(c.id)}
                                className="rounded bg-white/[0.04] border-white/[0.2] text-cyan-500 focus:ring-cyan-500/50 accent-cyan-500"
                              />
                            </td>

                            {/* Candidate name & contact — FULL UNBLURRED */}
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0 shadow-md shadow-cyan-500/20">
                                  {c.name ? c.name.slice(0, 2).toUpperCase() : 'CD'}
                                </div>
                                <div>
                                  <div className="font-bold text-white flex items-center gap-2">
                                    <span>{c.name || `Candidate #${c.id}`}</span>
                                    {c.detected_title && (
                                      <span className="text-[11px] text-white/40 font-normal">
                                        • {c.detected_title}
                                      </span>
                                    )}
                                    {c.is_capped && (
                                      <span
                                        title={c.cap_reason || 'Score capped at 59.9% due to missing must-have skill'}
                                        className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.5 rounded cursor-help"
                                      >
                                        ⚠ Capped 59.9%
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-white/40 mt-0.5 flex items-center gap-2">
                                    <span>{c.email || 'No email detected'}</span>
                                    {c.phone && <span>· {c.phone}</span>}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Experience */}
                            <td className="py-4 px-4 text-center">
                              <div className="font-bold text-white">
                                {c.experience_years !== null ? `${c.experience_years} yrs` : '—'}
                              </div>
                              {c.education_level && (
                                <div className="text-[11px] text-white/40 capitalize">
                                  {c.education_level.replace('_', ' ')}
                                </div>
                              )}
                            </td>

                            {/* Score */}
                            <td className="py-4 px-4 text-center">
                              <ScoreBadge score={c.overall_score} needsReview={c.needs_manual_review} />
                            </td>

                            {/* 4-Tier Badge */}
                            <td className="py-4 px-4 text-center">
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                                  TIER_BADGES[tier] || TIER_BADGES.Low
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${TIER_DOTS[tier] || TIER_DOTS.Low}`} />
                                {tier}
                              </span>
                            </td>

                            {/* Expand toggle */}
                            <td className="py-4 pr-6 pl-4 text-right">
                              <button
                                onClick={() => toggleExpand(c.id)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                              >
                                {isExpanded ? 'Hide' : 'Explain'}
                                <svg
                                  className={`w-3.5 h-3.5 transition-transform ${
                                    isExpanded ? 'rotate-180' : ''
                                  }`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </td>
                          </tr>

                          {/* ── EXPANDABLE EXPLANATION ROW WITH ANIMATION ── */}
                          {isExpanded && (
                            <tr className="bg-white/[0.015] border-b border-white/[0.06]">
                              <td colSpan={6} className="p-0">
                                <motion.div
                                  variants={accordionVariants}
                                  initial={shouldReduce ? false : "hidden"}
                                  animate="visible"
                                  exit="exit"
                                  className="px-8 py-5"
                                >
                                  <div className="space-y-4">
                                    {/* Unparseable warning if needs_manual_review */}
                                    {c.needs_manual_review ? (
                                      <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                                        <div className="font-bold mb-1 flex items-center gap-2 text-rose-400">
                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                          </svg>
                                          Resume Requires Manual Review
                                        </div>
                                        <p>{c.error_message || 'The resume file could not be parsed cleanly. Zero synthetic scores were assigned to protect data integrity.'}</p>
                                      </div>
                                    ) : (
                                      <>
                                        {/* Capping Note */}
                                        {c.is_capped && c.cap_reason && (
                                          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                                            <span className="font-bold">Must-Have Penalty:</span> {c.cap_reason}
                                          </div>
                                        )}

                                        {/* 5-Factor Score Breakdown */}
                                        <div>
                                          <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">
                                            Traceable Component Breakdown
                                          </div>
                                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                              <div className="text-[11px] text-white/40">Semantic Fit (35%)</div>
                                              <div className="text-base font-black text-white mt-0.5">
                                                {c.semantic_score != null ? `${Math.round(c.semantic_score)}%` : '—'}
                                              </div>
                                            </div>
                                            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                              <div className="text-[11px] text-white/40">Skill Coverage (30%)</div>
                                              <div className="text-base font-black text-white mt-0.5">
                                                {c.skills_score != null ? `${Math.round(c.skills_score)}%` : '—'}
                                              </div>
                                            </div>
                                            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                              <div className="text-[11px] text-white/40">Experience (20%)</div>
                                              <div className="text-base font-black text-white mt-0.5">
                                                {c.experience_score != null ? `${Math.round(c.experience_score)}%` : '—'}
                                              </div>
                                            </div>
                                            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                              <div className="text-[11px] text-white/40">Title Relevance (10%)</div>
                                              <div className="text-base font-black text-white mt-0.5">
                                                {c.title_score != null ? `${Math.round(c.title_score)}%` : '—'}
                                              </div>
                                            </div>
                                            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                              <div className="text-[11px] text-white/40">Education (5%)</div>
                                              <div className="text-base font-black text-white mt-0.5">
                                                {c.education_score != null ? `${Math.round(c.education_score)}%` : '—'}
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Matched vs Missing vs Beyond Skills */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                                          {/* Matched Required Skills */}
                                          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 mb-2.5">
                                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                              Matched Required Skills ({c.matched_skills?.length || 0})
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                              {c.matched_skills && c.matched_skills.length > 0 ? (
                                                c.matched_skills.map(s => (
                                                  <span
                                                    key={s}
                                                    className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded text-xs font-medium"
                                                  >
                                                    ✓ {s}
                                                  </span>
                                                ))
                                              ) : (
                                                <span className="text-xs text-white/30 italic">None matched</span>
                                              )}
                                            </div>
                                          </div>

                                          {/* Missing Required Skills */}
                                          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400 mb-2.5">
                                              <span className="w-2 h-2 rounded-full bg-rose-500" />
                                              Missing Required Skills ({c.missing_skills?.length || 0})
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                              {c.missing_skills && c.missing_skills.length > 0 ? (
                                                c.missing_skills.map(s => (
                                                  <span
                                                    key={s}
                                                    className="bg-rose-500/10 text-rose-300 border border-rose-500/20 px-2 py-0.5 rounded text-xs font-medium"
                                                  >
                                                    ✗ {s}
                                                  </span>
                                                ))
                                              ) : (
                                                <span className="text-xs text-white/30 italic">No missing skills</span>
                                              )}
                                            </div>
                                          </div>

                                          {/* Beyond JD Strengths */}
                                          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 mb-2.5">
                                              <span className="w-2 h-2 rounded-full bg-cyan-400" />
                                              Bonus Strengths Beyond JD ({beyondSkills.length})
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                              {beyondSkills.length > 0 ? (
                                                beyondSkills.slice(0, 8).map(s => (
                                                  <span
                                                    key={s}
                                                    className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-2 py-0.5 rounded text-xs font-medium"
                                                  >
                                                    ★ {s}
                                                  </span>
                                                ))
                                              ) : (
                                                <span className="text-xs text-white/30 italic">No bonus skills detected</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
