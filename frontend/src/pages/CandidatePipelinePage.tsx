import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import { api, JobPosting, CandidateWithScore } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  useReducedMotion,
  fadeInUpVariants,
  staggerContainerVariants,
  tabContentVariants,
  listItemVariants,
} from '../utils/animations';

type PipelineStatusFilter = 'all' | 'Invited' | 'Hire' | 'No Hire';

const AVATAR_COLORS = [
  'from-cyan-500/20 to-blue-600/20 text-cyan-300 border-cyan-500/30',
  'from-purple-500/20 to-indigo-600/20 text-purple-300 border-purple-500/30',
  'from-emerald-500/20 to-teal-600/20 text-emerald-300 border-emerald-500/30',
  'from-rose-500/20 to-pink-600/20 text-rose-300 border-rose-500/30',
  'from-amber-500/20 to-orange-600/20 text-amber-300 border-amber-500/30',
];

export default function CandidatePipelinePage() {
  const { user } = useAuth();
  const shouldReduce = useReducedMotion();

  const [candidates, setCandidates] = useState<CandidateWithScore[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [statusFilter, setStatusFilter] = useState<PipelineStatusFilter>('all');
  const [selectedJobId, setSelectedJobId] = useState<number | 'all'>('all');
  const [searchEmail, setSearchEmail] = useState('');

  // Status updating state
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Fetch all jobs for dropdown filter
  const fetchJobs = useCallback(async () => {
    try {
      const data = await api.getJobs();
      setJobs(data || []);
    } catch (err) {
      console.error('Failed to load jobs', err);
    }
  }, []);

  // Fetch cross-batch candidates
  const fetchCandidates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getCandidates({
        search: searchEmail.trim() || undefined,
        job_id: selectedJobId !== 'all' ? selectedJobId : undefined,
        pipeline_status: statusFilter !== 'all' ? statusFilter : undefined,
        sort_by: 'score_desc',
      });
      setCandidates(data || []);
    } catch (err) {
      console.error('Failed to load candidate pipeline', err);
    } finally {
      setLoading(false);
    }
  }, [searchEmail, selectedJobId, statusFilter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchCandidates();
    }, 150);
    return () => clearTimeout(handler);
  }, [fetchCandidates]);

  // Quick pipeline status updater
  const handleUpdateStatus = async (candidateId: number, newStatus: string) => {
    try {
      setUpdatingId(candidateId);
      await api.updateCandidatePipelineStatus(candidateId, newStatus);
      // Locally update state for snappy feedback
      setCandidates(prev =>
        prev.map(c => (c.id === candidateId ? { ...c, pipeline_status: newStatus } : c))
      );
    } catch (err) {
      console.error('Failed to update candidate status', err);
      alert('Failed to update candidate status');
    } finally {
      setUpdatingId(null);
    }
  };

  // Compute counts for filter tabs
  const countAll = candidates.length;
  const countInvited = candidates.filter(
    c => (c.pipeline_status || '').toLowerCase() === 'invited'
  ).length;
  const countHire = candidates.filter(
    c => (c.pipeline_status || '').toLowerCase() === 'hire'
  ).length;
  const countNoHire = candidates.filter(
    c => (c.pipeline_status || '').toLowerCase().replace(/[\s_]/g, '') === 'nohire'
  ).length;

  const orgName = user?.company_name || user?.email?.split('@')[1]?.split('.')[0] || 'mits';
  const userName = user?.email?.split('@')[0] || 'Atharv Ji';

  return (
    <div className="flex min-h-screen font-sans text-white" style={{ background: '#0a0a0f' }}>
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar */}
        <div className="px-8 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-semibold text-white/80">
              <svg className="w-3.5 h-3.5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>{orgName}</span>
            </div>
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs font-bold text-white capitalize">{userName}</div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">{user?.role || 'Admin'}</div>
            </div>
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-black text-xs font-black">
                {userName.slice(0, 1).toUpperCase()}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0a0a0f]" />
            </div>
          </div>
        </div>

        {/* Page Content Container */}
        <motion.div
          initial={shouldReduce ? false : 'hidden'}
          animate="visible"
          variants={staggerContainerVariants}
          className="p-8 max-w-7xl w-full mx-auto space-y-6"
        >
          {/* Header Title */}
          <motion.div variants={fadeInUpVariants}>
            <h1 className="text-2xl font-extrabold text-white">Candidate Pipeline</h1>
            <p className="text-xs text-white/40 mt-1">
              Global view of all applicants across every active assessment.
            </p>
          </motion.div>

          {/* Filter Tabs & Job Dropdown Bar */}
          <motion.div
            variants={fadeInUpVariants}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            {/* Status Filter Tabs */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* All Candidates */}
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === 'all'
                    ? 'bg-white text-black shadow-md'
                    : 'bg-white/[0.04] text-white/60 hover:text-white border border-white/[0.06]'
                }`}
              >
                All Candidates
              </button>

              {/* Invited */}
              <button
                onClick={() => setStatusFilter('Invited')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  statusFilter === 'Invited'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-white/[0.04] text-white/50 hover:text-white border border-white/[0.06]'
                }`}
              >
                Invited
              </button>

              {/* Hire */}
              <button
                onClick={() => setStatusFilter('Hire')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  statusFilter === 'Hire'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                    : 'bg-emerald-500/5 text-emerald-400/70 hover:text-emerald-300 border border-emerald-500/20'
                }`}
              >
                Hire
              </button>

              {/* No Hire */}
              <button
                onClick={() => setStatusFilter('No Hire')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  statusFilter === 'No Hire'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm shadow-rose-500/10'
                    : 'bg-rose-500/5 text-rose-400/70 hover:text-rose-300 border border-rose-500/20'
                }`}
              >
                No Hire
              </button>
            </div>

            {/* Per-job Filter Dropdown */}
            <div className="relative">
              <select
                value={selectedJobId}
                onChange={e =>
                  setSelectedJobId(e.target.value === 'all' ? 'all' : Number(e.target.value))
                }
                className="bg-[#14141f] border border-white/[0.08] hover:border-white/[0.15] text-white text-xs font-semibold rounded-xl px-4 py-2.5 pr-8 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 cursor-pointer appearance-none shadow-sm"
              >
                <option value="all">All Assessments</option>
                {jobs.map(j => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-white/30">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </motion.div>

          {/* Search candidates by email... */}
          <motion.div
            variants={fadeInUpVariants}
            className="rounded-2xl border border-white/[0.08] p-1.5 flex items-center"
            style={{ background: '#0d0d14' }}
          >
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchEmail}
                onChange={e => setSearchEmail(e.target.value)}
                placeholder="Search candidates by email..."
                className="w-full pl-11 pr-4 py-2.5 text-xs bg-transparent border-0 text-white placeholder-white/25 focus:outline-none focus:ring-0"
              />
            </div>
          </motion.div>

          {/* Candidates Pipeline Table */}
          <motion.div
            variants={fadeInUpVariants}
            className="rounded-2xl border border-white/[0.08] overflow-hidden shadow-sm"
            style={{ background: '#0d0d14' }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.01] text-[11px] font-bold text-white/40 uppercase tracking-wider">
                    <th className="py-4 px-6">CANDIDATE</th>
                    <th className="py-4 px-4">APPLIED TO</th>
                    <th className="py-4 px-4 w-40">SCORE</th>
                    <th className="py-4 px-4 text-center">VERDICT</th>
                    <th className="py-4 px-4 text-center">STATUS</th>
                    <th className="py-4 pr-6 pl-4 text-right">DATE</th>
                  </tr>
                </thead>

                <AnimatePresence mode="wait">
                  <motion.tbody
                    key={`${statusFilter}-${selectedJobId}`}
                    variants={tabContentVariants}
                    initial={shouldReduce ? false : "hidden"}
                    animate="visible"
                    exit="exit"
                    className="divide-y divide-white/[0.06] text-xs"
                  >
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-20 text-center text-white/30">
                        <div className="w-7 h-7 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        Loading candidate pipeline...
                      </td>
                    </tr>
                  ) : candidates.length === 0 ? (
                    /* ── EXACT EMPTY STATE AS PER USER DESIGN (media_1789517575604.png) ── */
                    <tr>
                      <td colSpan={6} className="py-24 text-center">
                        <div className="max-w-md mx-auto space-y-3">
                          <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mx-auto text-white/20">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <h4 className="text-sm font-bold text-white/80">
                            No candidates found matching your criteria.
                          </h4>
                          <p className="text-xs text-white/30">
                            Try a different search term or invite more candidates.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    candidates.map((c, index) => {
                      const colorStyle = AVATAR_COLORS[index % AVATAR_COLORS.length];
                      const initials = c.name
                        ? c.name
                            .split(' ')
                            .map(n => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()
                        : 'CD';
                      const score = c.overall_score != null ? Math.round(c.overall_score) : null;
                      const rawTier = c.tier || (c.needs_manual_review ? 'Needs Review' : (score && score >= 75 ? 'Strong' : score && score >= 55 ? 'Potential' : 'Low'));
                      
                      // Verdict styling
                      const verdict = rawTier === 'Strong' ? 'HIRE' : rawTier === 'Potential' ? 'MAYBE' : rawTier === 'Needs Review' ? 'REVIEW' : 'NO HIRE';
                      const verdictColor =
                        verdict === 'HIRE'
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                          : verdict === 'MAYBE'
                          ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                          : 'text-rose-400 bg-rose-500/10 border-rose-500/20';

                      const pipelineStatus = c.pipeline_status || 'Screened';
                      const isUpdating = updatingId === c.id;

                      const formattedDate = c.created_at
                        ? new Date(c.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '16 Sep 2026';

                      return (
                        <motion.tr
                          key={c.id}
                          variants={listItemVariants}
                          initial={shouldReduce ? false : "hidden"}
                          animate="visible"
                          custom={index}
                          className="hover:bg-white/[0.015] transition-colors"
                        >
                          {/* Candidate Name & Contact */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-full bg-gradient-to-br border flex items-center justify-center text-xs font-extrabold flex-shrink-0 ${colorStyle}`}
                              >
                                {initials}
                              </div>
                              <div>
                                <div className="font-bold text-white text-sm">
                                  {c.name || `Candidate #${c.id}`}
                                </div>
                                <div className="text-white/40 text-[11px] mt-0.5">
                                  {c.email || 'no-email@candidate.internal'}
                                </div>
                                {c.experience_years != null && (
                                  <div className="text-[10px] text-white/30 mt-0.5">
                                    {c.experience_years} {c.experience_years === 1 ? 'year' : 'years'} exp
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Applied To */}
                          <td className="py-4 px-4">
                            <div className="font-medium text-white/90">
                              {c.job_title || 'AI Developer'}
                            </div>
                            <div className="text-[10px] text-white/30">
                              Job #{c.job_posting_id}
                            </div>
                          </td>

                          {/* Score with Progress Bar */}
                          <td className="py-4 px-4">
                            {score !== null ? (
                              <div className="space-y-1">
                                <div className="font-bold text-white text-xs">{score}%</div>
                                <div className="w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
                                  <motion.div
                                    initial={shouldReduce ? { width: `${score}%` } : { width: 0 }}
                                    animate={{ width: `${score}%` }}
                                    transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1], delay: Math.min(index, 12) * 0.035 }}
                                    className={`h-full rounded-full ${
                                      score >= 75
                                        ? 'bg-amber-400'
                                        : score >= 55
                                        ? 'bg-amber-400'
                                        : 'bg-slate-400'
                                    }`}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-[11px] text-white/30">Unrated</span>
                            )}
                          </td>

                          {/* Verdict Badge with colored dot */}
                          <td className="py-4 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${verdictColor}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  verdict === 'HIRE'
                                    ? 'bg-emerald-400'
                                    : verdict === 'MAYBE'
                                    ? 'bg-amber-400'
                                    : 'bg-rose-400'
                                }`}
                              />
                              {verdict}
                            </span>
                          </td>

                          {/* Pipeline Status Selector */}
                          <td className="py-4 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              {isUpdating ? (
                                <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <select
                                  value={pipelineStatus}
                                  onChange={e => handleUpdateStatus(c.id, e.target.value)}
                                  className="bg-white/[0.04] border border-white/[0.1] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer transition-colors"
                                >
                                  <option value="Screened">Screened</option>
                                  <option value="Invited">Invited</option>
                                  <option value="Hire">Hire</option>
                                  <option value="No Hire">No Hire</option>
                                </select>
                              )}
                            </div>
                          </td>

                          {/* Date */}
                          <td className="py-4 pr-6 pl-4 text-right text-white/40 text-[11px]">
                            {formattedDate}
                          </td>
                        </motion.tr>
                      );
                    })
                  )}
                  </motion.tbody>
                </AnimatePresence>
              </table>
            </div>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
