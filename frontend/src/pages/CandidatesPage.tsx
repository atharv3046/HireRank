/**
 * Screen — All Candidates Page (/candidates)
 * ==========================================
 * Framer Motion animation pass with:
 *  - Staggered candidate row entries
 *  - Interactive filter buttons & hover effects
 *  - prefers-reduced-motion safety
 *  - viewport={{ once: true }}
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import { api, CandidateWithScore } from '../api/client';
import {
  useReducedMotion,
  fadeInUpVariants,
  staggerContainerVariants,
  modalBackdropVariants,
  modalContentVariants,
} from '../utils/animations';

const TIER_STYLES: Record<string, string> = {
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

export default function CandidatesPage() {
  const navigate = useNavigate();
  const shouldReduce = useReducedMotion();

  const [candidates, setCandidates] = useState<CandidateWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState<'all' | 'Strong' | 'Potential' | 'Low' | 'Needs Review'>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'score_desc' | 'score_asc' | 'exp_desc' | 'newest'>('score_desc');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);

  const fetchCandidates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getCandidates({
        search: search.trim() || undefined,
        tier: tierFilter !== 'all' ? tierFilter : undefined,
        sort_by: sortBy,
      });
      setCandidates(data || []);
    } catch (e) {
      console.error('Failed to load cross-batch candidates', e);
    } finally {
      setLoading(false);
    }
  }, [search, tierFilter, sortBy]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchCandidates();
    }, 200);
    return () => clearTimeout(handler);
  }, [fetchCandidates]);

  // Counts across current result set
  const strongCount = candidates.filter(c => c.tier === 'Strong').length;
  const potentialCount = candidates.filter(c => c.tier === 'Potential').length;
  const lowCount = candidates.filter(c => c.tier === 'Low').length;
  const needsReviewCount = candidates.filter(c => c.tier === 'Needs Review' || c.needs_manual_review).length;

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === candidates.length && candidates.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map(c => c.id)));
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const idsToExport = selectedIds.size > 0 ? Array.from(selectedIds) : undefined;
      const blob = await api.exportCandidatesCsv(idsToExport);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hirerank_candidates_${new Date().toISOString().slice(0, 10)}.csv`;
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

  const [deleting, setDeleting] = useState(false);

  // ── Invite Modal State ───────────────────────────────────────────────────
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateWithScore | null>(null);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Recruiter (Can screen & invite candidates)');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const handleOpenInviteModal = (candidate?: CandidateWithScore) => {
    if (candidate) {
      setSelectedCandidate(candidate);
      setInviteName(candidate.name || '');
      setInviteEmail(candidate.email || '');
    } else {
      setSelectedCandidate(null);
      setInviteName('');
      setInviteEmail('');
    }
    setInviteRole('Recruiter (Can screen & invite candidates)');
    setInviteError(null);
    setInviteSuccess(false);
    setShowInviteModal(true);
  };

  const handleSendCandidateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSendingInvite(true);
    setInviteError(null);
    try {
      if (selectedCandidate) {
        await api.bulkInviteCandidates([selectedCandidate.id], `Invited as ${inviteRole}`);
        setCandidates(prev =>
          prev.map(c => (c.id === selectedCandidate.id ? { ...c, pipeline_status: 'Invited' } : c))
        );
      } else {
        const match = candidates.find(
          c => (c.email || '').toLowerCase() === inviteEmail.trim().toLowerCase()
        );
        if (match) {
          await api.bulkInviteCandidates([match.id], `Invited as ${inviteRole}`);
          setCandidates(prev =>
            prev.map(c => (c.id === match.id ? { ...c, pipeline_status: 'Invited' } : c))
          );
        }
      }
      setInviteSuccess(true);
    } catch (err: any) {
      console.error('Candidate invite failed', err);
      setInviteError(err.response?.data?.detail || 'Failed to send invitation');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size > 0 ? selectedIds.size : candidates.length;
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : candidates.map(c => c.id);
    if (ids.length === 0) return;

    if (!window.confirm(`Are you sure you want to delete ${count} candidate(s) and their resume files? This action cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      await api.deleteCandidatesBulk(ids);
      setCandidates(prev => prev.filter(c => !ids.includes(c.id)));
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to delete candidates', err);
      alert('Failed to delete candidate(s)');
    } finally {
      setDeleting(false);
    }
  };

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
          {/* Header */}
          <motion.div
            variants={fadeInUpVariants}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
          >
            <div>
              <div className="text-xs text-cyan-400 font-semibold uppercase tracking-wider mb-1">ALL BATCHES</div>
              <h1 className="text-2xl font-extrabold text-white">All Candidates</h1>
              <p className="text-sm text-white/40 mt-1">Cross-batch candidate database across all evaluated job postings.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {strongCount} Strong
              </span>
              <span className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                {potentialCount} Potential
              </span>
              <span className="flex items-center gap-1.5 text-slate-400 bg-slate-500/10 px-3 py-1 rounded-lg border border-slate-500/20">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                {lowCount} Low
              </span>
              <span className="flex items-center gap-1.5 text-rose-400 bg-rose-500/10 px-3 py-1 rounded-lg border border-rose-500/20">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                {needsReviewCount} Needs Review
              </span>
            </div>
          </motion.div>

          {/* Filters and Search */}
          <motion.div
            variants={fadeInUpVariants}
            className="rounded-2xl border border-white/[0.08] p-4 shadow-sm mb-6 flex flex-col md:flex-row items-center gap-4"
            style={{ background: '#0d0d14' }}
          >
            <div className="relative w-full md:w-80">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search candidate, email, title, skill…"
                className="w-full pl-9 pr-4 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>

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

            <div className="flex items-center gap-2 text-xs text-white/40 ml-auto">
              <span className="font-semibold uppercase tracking-wider">Sort:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-[#14141f] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              >
                <option value="score_desc">Highest Match Score</option>
                <option value="score_asc">Lowest Match Score</option>
                <option value="exp_desc">Most Experience (Years)</option>
                <option value="newest">Most Recent</option>
              </select>

              <motion.button
                onClick={handleExportCsv}
                disabled={exporting || candidates.length === 0}
                whileHover={shouldReduce ? undefined : { scale: 1.02 }}
                whileTap={shouldReduce ? undefined : { scale: 0.98 }}
                className="ml-2 flex items-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white px-3 py-1.5 rounded-xl font-semibold transition-colors disabled:opacity-50"
              >
                <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {exporting ? 'Exporting…' : selectedIds.size > 0 ? `Export (${selectedIds.size})` : 'Export All'}
              </motion.button>

              {candidates.length > 0 && (
                <motion.button
                  onClick={handleBulkDelete}
                  disabled={deleting}
                  whileHover={shouldReduce ? undefined : { scale: 1.02 }}
                  whileTap={shouldReduce ? undefined : { scale: 0.98 }}
                  className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 px-3 py-1.5 rounded-xl font-semibold transition-colors disabled:opacity-50 text-xs ml-1"
                >
                  <svg className="w-3.5 h-3.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {deleting ? 'Deleting…' : selectedIds.size > 0 ? `Delete (${selectedIds.size})` : 'Delete Resumes'}
                </motion.button>
              )}
            </div>
          </motion.div>

          {/* Table */}
          {loading ? (
            <div className="rounded-2xl border border-white/[0.08] p-16 text-center shadow-sm" style={{ background: '#0d0d14' }}>
              <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-white/40">Loading candidate database…</p>
            </div>
          ) : candidates.length === 0 ? (
            <motion.div
              variants={fadeInUpVariants}
              className="rounded-2xl border border-white/[0.08] p-16 text-center shadow-sm"
              style={{ background: '#0d0d14' }}
            >
              <div className="w-14 h-14 bg-cyan-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-cyan-500/20">
                <svg className="w-7 h-7 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-white font-bold text-lg mb-1.5">No candidates found</h3>
              <p className="text-white/40 text-sm mb-6 max-w-sm mx-auto">No candidate matches the search criteria across your job postings.</p>
              <motion.button
                onClick={() => navigate('/screen')}
                whileHover={shouldReduce ? undefined : { scale: 1.02 }}
                whileTap={shouldReduce ? undefined : { scale: 0.98 }}
                className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-cyan-500/20"
              >
                Screen Resumes Now
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              variants={fadeInUpVariants}
              viewport={{ once: true }}
              className="rounded-2xl border border-white/[0.08] overflow-hidden shadow-sm"
              style={{ background: '#0d0d14' }}
            >
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[11px] font-bold text-white/40 uppercase tracking-wider">
                    <th className="py-4 pl-6 pr-2 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === candidates.length && candidates.length > 0}
                        onChange={selectAll}
                        className="rounded bg-white/[0.04] border-white/[0.2] text-cyan-500 focus:ring-cyan-500/50 accent-cyan-500"
                      />
                    </th>
                    <th className="py-4 px-4">Candidate & Contact</th>
                    <th className="py-4 px-4">Job Batch</th>
                    <th className="py-4 px-4 text-center">Experience</th>
                    <th className="py-4 px-4 text-center">Score</th>
                    <th className="py-4 px-4 text-center">Tier</th>
                    <th className="py-4 pr-6 pl-4 text-center">Top Skills</th>
                    <th className="py-4 pr-6 pl-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-sm">
                  {candidates.map(c => {
                    const tier = c.tier || (c.needs_manual_review ? 'Needs Review' : (c.overall_score && c.overall_score >= 75 ? 'Strong' : c.overall_score && c.overall_score >= 55 ? 'Potential' : 'Low'));
                    const isSelected = selectedIds.has(c.id);

                    return (
                      <motion.tr
                        key={`${c.job_posting_id}-${c.id}`}
                        whileHover={shouldReduce ? undefined : { backgroundColor: 'rgba(6, 182, 212, 0.04)' }}
                        className={`cursor-pointer transition-colors group ${
                          isSelected ? 'bg-cyan-500/10' : ''
                        }`}
                      >
                        {/* Selection Checkbox */}
                        <td className="py-4 pl-6 pr-2" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(c.id)}
                            className="rounded bg-white/[0.04] border-white/[0.2] text-cyan-500 focus:ring-cyan-500/50 accent-cyan-500"
                          />
                        </td>

                        {/* Candidate info */}
                        <td className="py-4 px-4" onClick={() => navigate(`/jobs/${c.job_posting_id}`)}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-black flex-shrink-0 shadow-md shadow-cyan-500/20">
                              {c.name ? c.name.slice(0, 2).toUpperCase() : 'CD'}
                            </div>
                            <div>
                              <div className="font-bold text-white group-hover:text-cyan-400 transition-colors flex items-center gap-1.5">
                                <span>{c.name || `Candidate #${c.id}`}</span>
                                {c.detected_title && (
                                  <span className="text-[11px] text-white/40 font-normal">
                                    • {c.detected_title}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-white/40 mt-0.5">{c.email || 'No email'} {c.phone && `· ${c.phone}`}</div>
                            </div>
                          </div>
                        </td>

                        {/* Batch Job Title */}
                        <td className="py-4 px-4" onClick={() => navigate(`/jobs/${c.job_posting_id}`)}>
                          <span className="text-xs bg-white/[0.04] text-white/70 border border-white/[0.06] px-2.5 py-1 rounded-lg font-medium group-hover:border-cyan-500/30 transition-colors">
                            {c.job_title || `Job #${c.job_posting_id}`}
                          </span>
                        </td>

                        {/* Experience */}
                        <td className="py-4 px-4 text-center font-bold text-white" onClick={() => navigate(`/jobs/${c.job_posting_id}`)}>
                          {c.experience_years !== null ? `${c.experience_years} yrs` : '—'}
                        </td>

                        {/* Score */}
                        <td className="py-4 px-4 text-center" onClick={() => navigate(`/jobs/${c.job_posting_id}`)}>
                          {c.needs_manual_review ? (
                            <span className="text-xs text-rose-400 font-semibold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                              Needs Review
                            </span>
                          ) : c.overall_score !== null ? (
                            <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-black border ${
                              c.overall_score >= 75
                                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                : c.overall_score >= 55
                                ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                                : 'text-slate-400 bg-slate-500/10 border-slate-500/20'
                            }`}>
                              {Math.round(c.overall_score)}%
                            </span>
                          ) : (
                            <span className="text-xs text-white/30">—</span>
                          )}
                        </td>

                        {/* Tier */}
                        <td className="py-4 px-4 text-center" onClick={() => navigate(`/jobs/${c.job_posting_id}`)}>
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${TIER_STYLES[tier] || TIER_STYLES.Low}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${TIER_DOTS[tier] || TIER_DOTS.Low}`} />
                            {tier}
                          </span>
                        </td>

                        {/* Top Skills */}
                        <td className="py-4 pr-6 pl-4 text-center" onClick={() => navigate(`/jobs/${c.job_posting_id}`)}>
                          <div className="flex flex-wrap gap-1 justify-center">
                            {(c.matched_skills && c.matched_skills.length > 0 ? c.matched_skills : c.extracted_skills || []).slice(0, 3).map(s => (
                              <span key={s} className="text-[10px] bg-white/[0.04] text-white/70 border border-white/[0.06] px-1.5 py-0.5 rounded font-medium">
                                {s}
                              </span>
                            ))}
                            {((c.matched_skills?.length || 0) + (c.extracted_skills?.length || 0)) > 3 && (
                              <span className="text-[10px] text-white/30">+more</span>
                            )}
                          </div>
                        </td>

                        {/* Invite Action */}
                        <td className="py-4 pr-6 pl-2 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenInviteModal(c)}
                            title="Invite candidate"
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 transition-colors mx-auto"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                            Invite
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-6 py-3 border-t border-white/[0.06] text-xs text-white/40 flex items-center justify-between">
                <span>Showing {candidates.length} candidate(s)</span>
                <span>Click any row to open full batch shortlist</span>
              </div>
            </motion.div>
          )}
        </motion.div>
      </main>

      {/* ── INVITE CANDIDATE MODAL ── */}
      <AnimatePresence>
        {showInviteModal && (
          <motion.div
            variants={modalBackdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              variants={modalContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full max-w-md rounded-2xl border border-white/[0.1] p-6 shadow-2xl space-y-5"
              style={{ background: '#0d0d14' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
                    CANDIDATE INVITATION
                  </span>
                  <h3 className="text-lg font-extrabold text-white">Invite to Assessment & Interview</h3>
                </div>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>

              {inviteSuccess ? (
                <div className="space-y-4 py-2">
                  <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                      ✓
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">Invitation Sent!</div>
                      <p className="text-white/60 text-xs mt-1">
                        <strong className="text-white">{inviteName || inviteEmail}</strong> has been marked as <span className="text-cyan-400 font-bold">Invited</span> in the pipeline.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setShowInviteModal(false)}
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-white/[0.08] hover:bg-white/[0.12] text-white transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSendCandidateInvite} className="space-y-4">
                  {inviteError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                      {inviteError}
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5">
                      Candidate Name
                    </label>
                    <input
                      type="text"
                      value={inviteName}
                      onChange={e => setInviteName(e.target.value)}
                      placeholder="e.g. Sarah Connor"
                      className="w-full px-3.5 py-2 text-xs bg-white/[0.04] border border-white/[0.1] rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="candidate@company.com"
                      className="w-full px-3.5 py-2 text-xs bg-white/[0.04] border border-white/[0.1] rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5">
                      Assessment Stage
                    </label>
                    <select
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-[#14141f] border border-white/[0.1] rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50 cursor-pointer"
                    >
                      <option value="Screening">Screening</option>
                      <option value="Technical Assessment">Technical Assessment</option>
                      <option value="Interview">Interview</option>
                      <option value="Recruiter (Can screen & invite candidates)">Full Pipeline Access</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-white/40 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={sendingInvite}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:opacity-50 text-white shadow-lg shadow-cyan-500/20 transition-all"
                    >
                      {sendingInvite && (
                        <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      )}
                      Send Invitation
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
