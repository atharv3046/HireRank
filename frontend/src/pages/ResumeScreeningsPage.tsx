import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import { api, JobPosting, CandidateWithScore, JobStats } from '../api/client';
import {
  useReducedMotion,
  fadeInUpVariants,
  staggerContainerVariants,
  modalBackdropVariants,
  modalContentVariants,
  accordionVariants,
  listItemVariants,
  scoreBarVariants,
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

export default function ResumeScreeningsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const shouldReduce = useReducedMotion();

  // Batches state
  const [batches, setBatches] = useState<JobPosting[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [batchSearch, setBatchSearch] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);

  // Selected batch data
  const [selectedBatch, setSelectedBatch] = useState<JobPosting | null>(null);
  const [batchStats, setBatchStats] = useState<JobStats | null>(null);
  const [candidates, setCandidates] = useState<CandidateWithScore[]>([]);
  const [loadingBatchDetail, setLoadingBatchDetail] = useState(false);
  const [reranking, setReranking] = useState(false);
  const [exportingBatch, setExportingBatch] = useState(false);

  // Filters & sorting for candidates
  const [candidateSearch, setCandidateSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'Strong' | 'Potential' | 'Low' | 'Needs Review'>('all');
  const [sortBy, setSortBy] = useState<'score_desc' | 'score_asc' | 'exp_desc' | 'name'>('score_desc');

  // Interactive selection & expansion
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<number>>(new Set());

  // Bulk invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteStage, setInviteStage] = useState<'screening' | 'assessment' | 'interview'>('assessment');
  const [inviteMessage, setInviteMessage] = useState(
    'Hello, thank you for your application to HireRank. Based on your screening evaluation, we would like to invite you to the next step.'
  );
  const [sendingInvites, setSendingInvites] = useState(false);
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState<string | null>(null);

  // Fetch all batches
  const fetchBatches = useCallback(async () => {
    try {
      setLoadingBatches(true);
      const data = await api.getJobs();
      setBatches(data || []);
      
      // Determine selected batch
      const paramId = searchParams.get('batch');
      if (paramId && data.some((b: JobPosting) => b.id === Number(paramId))) {
        setSelectedBatchId(Number(paramId));
      } else if (data && data.length > 0 && selectedBatchId === null) {
        setSelectedBatchId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load batches', err);
    } finally {
      setLoadingBatches(false);
    }
  }, [searchParams, selectedBatchId]);

  useEffect(() => {
    fetchBatches();
  }, []);

  // Fetch detail for selected batch
  const fetchSelectedBatchData = useCallback(async (jobId: number) => {
    try {
      setLoadingBatchDetail(true);
      setSelectedCandidateIds(new Set());
      setExpandedIds(new Set());
      
      const [jobData, candidateData, statsData] = await Promise.all([
        api.getJob(jobId).catch(() => null),
        api.getRankedCandidates(jobId).catch(() => []),
        api.getJobStats(jobId).catch(() => null),
      ]);

      setSelectedBatch(jobData);
      setCandidates(candidateData || []);
      setBatchStats(statsData);
    } catch (err) {
      console.error('Failed to load batch detail', err);
    } finally {
      setLoadingBatchDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedBatchId !== null) {
      setSearchParams({ batch: selectedBatchId.toString() }, { replace: true });
      fetchSelectedBatchData(selectedBatchId);
    }
  }, [selectedBatchId, fetchSelectedBatchData, setSearchParams]);

  // Rerank candidates
  const handleRerank = async () => {
    if (!selectedBatchId) return;
    setReranking(true);
    try {
      await api.rerankAll(selectedBatchId);
      await fetchSelectedBatchData(selectedBatchId);
    } catch (err) {
      console.error('Rerank failed', err);
    } finally {
      setReranking(false);
    }
  };

  // Export batch CSV
  const handleExportBatchCsv = async () => {
    if (!selectedBatchId) return;
    setExportingBatch(true);
    try {
      const blob = await api.exportJobCsv(selectedBatchId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(selectedBatch?.title || 'batch').replace(/\s+/g, '_')}_candidates.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setExportingBatch(false);
    }
  };

  // Export selected candidates CSV
  const handleExportSelectedCsv = async () => {
    if (selectedCandidateIds.size === 0) return;
    try {
      const blob = await api.exportCandidatesCsv(Array.from(selectedCandidateIds));
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `selected_candidates_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export selected failed', err);
    }
  };

  // Send bulk invitations
  const handleSendBulkInvites = async () => {
    if (selectedCandidateIds.size === 0) return;
    setSendingInvites(true);
    try {
      const res = await api.bulkInviteCandidates(Array.from(selectedCandidateIds), inviteMessage);
      setInviteSuccessMsg(res.message || `Successfully sent invitations to ${res.invited_count} candidate(s)!`);
      setTimeout(() => {
        setShowInviteModal(false);
        setInviteSuccessMsg(null);
        setSelectedCandidateIds(new Set());
      }, 1600);
    } catch (err) {
      console.error('Bulk invite failed', err);
      alert('Failed to send invitations. Please try again.');
    } finally {
      setSendingInvites(false);
    }
  };

  // Toggle row expand
  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle candidate selection
  const toggleSelectCandidate = (id: number) => {
    setSelectedCandidateIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select / Deselect all filtered candidates
  const toggleSelectAll = () => {
    if (selectedCandidateIds.size === filteredCandidates.length && filteredCandidates.length > 0) {
      setSelectedCandidateIds(new Set());
    } else {
      setSelectedCandidateIds(new Set(filteredCandidates.map(c => c.id)));
    }
  };

  // Filtered batches for left panel
  const filteredBatches = batches.filter(b => {
    if (!batchSearch.trim()) return true;
    const q = batchSearch.toLowerCase();
    const titleMatch = b.title.toLowerCase().includes(q);
    const skillMatch = b.required_skills?.some(s => s.toLowerCase().includes(q));
    return titleMatch || skillMatch;
  });

  // Filtered & sorted candidates for right panel
  const filteredCandidates = candidates.filter(c => {
    const tier = c.tier || (c.needs_manual_review ? 'Needs Review' : (c.overall_score && c.overall_score >= 75 ? 'Strong' : c.overall_score && c.overall_score >= 55 ? 'Potential' : 'Low'));
    if (tierFilter !== 'all' && tier !== tierFilter) return false;

    if (candidateSearch.trim()) {
      const q = candidateSearch.toLowerCase().trim();
      const nameMatch = Boolean(c.name && c.name.toLowerCase().includes(q));
      const emailMatch = Boolean(c.email && c.email.toLowerCase().includes(q));
      const titleMatch = Boolean(c.detected_title && c.detected_title.toLowerCase().includes(q));
      const skillMatch = c.extracted_skills?.some(s => s.toLowerCase().includes(q)) || c.matched_skills?.some(s => s.toLowerCase().includes(q));
      if (!nameMatch && !emailMatch && !titleMatch && !skillMatch) return false;
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
    if (sortBy === 'name') {
      return (a.name || '').localeCompare(b.name || '');
    }
    return 0;
  });

  // Derived counts for current batch
  const countStrong = batchStats?.strong_count ?? candidates.filter(c => c.tier === 'Strong').length;
  const countPotential = batchStats?.potential_count ?? candidates.filter(c => c.tier === 'Potential').length;
  const countLow = batchStats?.low_count ?? candidates.filter(c => c.tier === 'Low').length;
  const countNeedsReview = batchStats?.needs_review_count ?? candidates.filter(c => c.tier === 'Needs Review' || c.needs_manual_review).length;
  const avgScore = batchStats?.average_score != null ? Math.round(batchStats.average_score) : null;

  return (
    <div className="flex h-screen overflow-hidden font-sans text-white" style={{ background: '#0a0a0f' }}>
      <Sidebar />

      {/* Main Container: Master-Detail Split */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── LEFT PANEL: BATCHES LIST (CARD VIEW) ── */}
        <div
          className="w-80 lg:w-96 flex-shrink-0 flex flex-col border-r border-white/[0.08]"
          style={{ background: '#0d0d14' }}
        >
          {/* Batches Header */}
          <div className="p-5 border-b border-white/[0.08]">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Pipelines</span>
                <h2 className="text-lg font-extrabold text-white">Screening Batches</h2>
              </div>
              <button
                onClick={() => navigate('/screen')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/25 rounded-xl transition-all shadow-sm"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Batch
              </button>
            </div>

            {/* Search batches */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-3.5 h-3.5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={batchSearch}
                onChange={e => setBatchSearch(e.target.value)}
                placeholder="Search batches or skills..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              />
            </div>
          </div>

          {/* Batches Scrollable List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loadingBatches ? (
              <div className="py-12 text-center text-white/30 text-xs flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                Loading batches...
              </div>
            ) : filteredBatches.length === 0 ? (
              <div className="py-12 text-center text-white/30 text-xs px-4">
                No screening batches found. Click <span className="text-cyan-400 font-semibold cursor-pointer" onClick={() => navigate('/screen')}>+ New Batch</span> to screen resumes.
              </div>
            ) : (
              filteredBatches.map(batch => {
                const isSelected = selectedBatchId === batch.id;
                return (
                  <div
                    key={batch.id}
                    onClick={() => setSelectedBatchId(batch.id)}
                    className={`p-3.5 rounded-xl cursor-pointer transition-all border text-left relative ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/40 shadow-md shadow-cyan-500/10'
                        : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]'
                    }`}
                  >
                    {/* Active indicator pill */}
                    {isSelected && (
                      <div className="absolute left-0 top-3 bottom-3 w-1 bg-cyan-400 rounded-r" />
                    )}

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm text-white truncate">{batch.title}</h3>
                        <p className="text-[11px] text-white/40 mt-0.5">
                          {new Date(batch.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-white/70">
                        {batch.candidate_count} {batch.candidate_count === 1 ? 'candidate' : 'candidates'}
                      </span>
                    </div>

                    {/* Required skills tags */}
                    {batch.required_skills && batch.required_skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {batch.required_skills.slice(0, 3).map((skill: string) => (
                          <span
                            key={skill}
                            className="text-[10px] bg-white/[0.04] text-white/60 px-1.5 py-0.5 rounded border border-white/[0.05]"
                          >
                            {skill}
                          </span>
                        ))}
                        {batch.required_skills.length > 3 && (
                          <span className="text-[10px] text-white/30 px-1 py-0.5">
                            +{batch.required_skills.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL: BATCH DETAIL & SCREENINGS ── */}
        <div className="flex-1 flex flex-col overflow-y-auto" style={{ background: '#0a0a0f' }}>
          {selectedBatchId === null ? (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div className="max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-extrabold text-white mb-2">Select a Screening Batch</h2>
                <p className="text-sm text-white/40 mb-6">
                  Choose an existing batch from the left panel to review ranked candidates, inspect score breakdowns, and invite top talent.
                </p>
                <button
                  onClick={() => navigate('/screen')}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white shadow-lg shadow-cyan-500/20"
                >
                  Start New Resume Screening
                </button>
              </div>
            </div>
          ) : loadingBatchDetail ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-white/40">Loading batch details & candidates...</p>
              </div>
            </div>
          ) : (
            <motion.div
              initial={shouldReduce ? false : 'hidden'}
              animate="visible"
              variants={staggerContainerVariants}
              className="p-8 max-w-6xl w-full mx-auto space-y-6"
            >
              {/* Batch Header Bar */}
              <motion.div
                variants={fadeInUpVariants}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                      Screening Batch #{selectedBatch?.id}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                    <span className="text-xs text-white/40">
                      {selectedBatch?.created_at
                        ? new Date(selectedBatch.created_at).toLocaleDateString()
                        : ''}
                    </span>
                  </div>
                  <h1 className="text-2xl font-extrabold text-white">{selectedBatch?.title}</h1>
                  {selectedBatch?.description && (
                    <p className="text-xs text-white/40 mt-1 line-clamp-1 max-w-xl">
                      {selectedBatch.description}
                    </p>
                  )}
                </div>

                {/* Batch Action Buttons */}
                <div className="flex items-center flex-wrap gap-2.5">
                  {/* Upload Resumes */}
                  <button
                    onClick={() => navigate(`/jobs/${selectedBatch?.id}/upload`)}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.08] text-white border border-white/[0.1] rounded-xl transition-all"
                  >
                    <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload Resumes
                  </button>

                  {/* Export CSV */}
                  <button
                    onClick={handleExportBatchCsv}
                    disabled={exportingBatch || candidates.length === 0}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.08] disabled:opacity-40 text-white border border-white/[0.1] rounded-xl transition-all"
                  >
                    {exportingBatch ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                    Export CSV
                  </button>

                  {/* Rerank */}
                  <button
                    onClick={handleRerank}
                    disabled={reranking || candidates.length === 0}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:opacity-40 text-white rounded-xl transition-all shadow-md shadow-cyan-500/15"
                  >
                    <svg
                      className={`w-3.5 h-3.5 ${reranking ? 'animate-spin' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {reranking ? 'Reranking…' : 'Rerank All'}
                  </button>
                </div>
              </motion.div>

              {/* ── STAT TILES (6 TILES) ── */}
              <motion.div
                variants={fadeInUpVariants}
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
              >
                {/* Total Screened */}
                <div className="p-3.5 rounded-xl border border-white/[0.08]" style={{ background: '#0d0d14' }}>
                  <div className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Screened</div>
                  <div className="text-xl font-extrabold text-white mt-1">{candidates.length}</div>
                  <div className="text-[10px] text-white/30 mt-0.5">Total processed</div>
                </div>

                {/* Strong Candidates */}
                <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Strong
                  </div>
                  <div className="text-xl font-extrabold text-emerald-300 mt-1">{countStrong}</div>
                  <div className="text-[10px] text-emerald-400/50 mt-0.5">≥ 75% match</div>
                </div>

                {/* Potential */}
                <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Potential
                  </div>
                  <div className="text-xl font-extrabold text-amber-300 mt-1">{countPotential}</div>
                  <div className="text-[10px] text-amber-400/50 mt-0.5">55 – 74.9%</div>
                </div>

                {/* Low Fit */}
                <div className="p-3.5 rounded-xl border border-slate-500/20 bg-slate-500/5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    Low Fit
                  </div>
                  <div className="text-xl font-extrabold text-slate-300 mt-1">{countLow}</div>
                  <div className="text-[10px] text-slate-400/50 mt-0.5">&lt; 55% match</div>
                </div>

                {/* Needs Review */}
                <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-400 uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Review
                  </div>
                  <div className="text-xl font-extrabold text-rose-300 mt-1">{countNeedsReview}</div>
                  <div className="text-[10px] text-rose-400/50 mt-0.5">Corrupt/Unparseable</div>
                </div>

                {/* Batch Avg Score */}
                <div className="p-3.5 rounded-xl border border-cyan-500/20 bg-cyan-500/5">
                  <div className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">Avg Score</div>
                  <div className="text-xl font-extrabold text-cyan-300 mt-1">
                    {avgScore !== null ? `${avgScore}%` : '—'}
                  </div>
                  <div className="text-[10px] text-cyan-400/50 mt-0.5">Batch composite</div>
                </div>
              </motion.div>

              {/* ── SEARCH & TIER FILTER TABS ── */}
              <motion.div
                variants={fadeInUpVariants}
                className="p-4 rounded-2xl border border-white/[0.08] flex flex-col md:flex-row items-center justify-between gap-4"
                style={{ background: '#0d0d14' }}
              >
                {/* Search candidate input */}
                <div className="relative w-full md:w-72">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={candidateSearch}
                    onChange={e => setCandidateSearch(e.target.value)}
                    placeholder="Search candidate, skill, title..."
                    className="w-full pl-9 pr-4 py-2 text-xs bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  />
                </div>

                {/* Tier Filter Tabs */}
                <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-xl text-xs font-semibold border border-white/[0.06] overflow-x-auto max-w-full">
                  {(['all', 'Strong', 'Potential', 'Low', 'Needs Review'] as const).map(tier => {
                    const isActive = tierFilter === tier;
                    return (
                      <button
                        key={tier}
                        onClick={() => setTierFilter(tier)}
                        className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                          isActive
                            ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                            : 'text-white/40 hover:text-white border border-transparent'
                        }`}
                      >
                        {tier === 'all' ? 'All Candidates' : tier}
                      </button>
                    );
                  })}
                </div>

                {/* Sort dropdown */}
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <span className="font-semibold uppercase tracking-wider">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as any)}
                    className="bg-[#14141f] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  >
                    <option value="score_desc">Highest Score</option>
                    <option value="score_asc">Lowest Score</option>
                    <option value="exp_desc">Most Experience</option>
                    <option value="name">Candidate Name</option>
                  </select>
                </div>
              </motion.div>

              {/* ── BULK ACTION FLOATING BAR ── */}
              {selectedCandidateIds.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="p-3.5 rounded-xl border border-cyan-500/30 bg-cyan-950/40 flex items-center justify-between text-xs backdrop-blur shadow-lg shadow-cyan-500/10"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-cyan-300">
                      {selectedCandidateIds.size} of {filteredCandidates.length} candidate(s) selected
                    </span>
                    <button
                      onClick={() => setSelectedCandidateIds(new Set())}
                      className="text-white/40 hover:text-white font-medium underline"
                    >
                      Clear Selection
                    </button>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={handleExportSelectedCsv}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.1] transition-all"
                    >
                      Export Selected (CSV)
                    </button>
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white shadow-md shadow-cyan-500/20 transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Bulk Invite ({selectedCandidateIds.size})
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── CANDIDATE TABLE WITH SCORE BARS & VERDICTS ── */}
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
                            checked={
                              selectedCandidateIds.size === filteredCandidates.length &&
                              filteredCandidates.length > 0
                            }
                            onChange={toggleSelectAll}
                            className="rounded bg-white/[0.04] border-white/[0.2] text-cyan-500 focus:ring-cyan-500/50 accent-cyan-500 cursor-pointer"
                          />
                        </th>
                        <th className="py-4 px-4">Candidate & Contact</th>
                        <th className="py-4 px-4 text-center">Exp & Education</th>
                        <th className="py-4 px-4 w-44 text-left">Match Score</th>
                        <th className="py-4 px-4 text-center">Verdict</th>
                        <th className="py-4 pr-6 pl-4 text-right">Details</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-white/[0.06] text-sm">
                      {filteredCandidates.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-16 text-center text-white/30 text-xs">
                            No candidates match your filter or search criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredCandidates.map((c, rowIdx) => {
                          const tier = c.tier || (c.needs_manual_review ? 'Needs Review' : (c.overall_score && c.overall_score >= 75 ? 'Strong' : c.overall_score && c.overall_score >= 55 ? 'Potential' : 'Low'));
                          const isExpanded = expandedIds.has(c.id);
                          const isSelected = selectedCandidateIds.has(c.id);
                          const scoreVal = c.overall_score != null ? Math.round(c.overall_score) : null;

                          return (
                            <React.Fragment key={c.id}>
                              <motion.tr
                                custom={rowIdx}
                                variants={listItemVariants}
                                initial="hidden"
                                animate="visible"
                                className={`transition-colors hover:bg-white/[0.02] ${
                                  isSelected ? 'bg-cyan-500/10' : ''
                                }`}
                              >
                                {/* Checkbox */}
                                <td className="py-4 pl-6 pr-2">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelectCandidate(c.id)}
                                    className="rounded bg-white/[0.04] border-white/[0.2] text-cyan-500 focus:ring-cyan-500/50 accent-cyan-500 cursor-pointer"
                                  />
                                </td>

                                {/* Candidate Contact */}
                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 text-xs font-extrabold flex-shrink-0">
                                      {c.name ? c.name.slice(0, 2).toUpperCase() : 'CD'}
                                    </div>
                                    <div>
                                      <div className="font-bold text-white flex items-center gap-2">
                                        <span>{c.name || `Candidate #${c.id}`}</span>
                                        {c.is_capped && (
                                          <span
                                            title={c.cap_reason || 'Score capped at 59.9% due to missing must-have requirement'}
                                            className="text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.5 rounded cursor-help"
                                          >
                                            ⚠ Capped 59.9%
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-white/40 flex items-center gap-2 mt-0.5">
                                        {c.detected_title && (
                                          <span className="text-cyan-300/80 font-medium">
                                            {c.detected_title}
                                          </span>
                                        )}
                                        {c.email && (
                                          <>
                                            {c.detected_title && <span>•</span>}
                                            <span className="truncate max-w-[160px]">{c.email}</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* Experience & Degree */}
                                <td className="py-4 px-4 text-center">
                                  <div className="font-semibold text-xs text-white">
                                    {c.experience_years != null ? `${c.experience_years} yrs exp` : '—'}
                                  </div>
                                  <div className="text-[11px] text-white/40 capitalize mt-0.5">
                                    {c.education_level ? c.education_level.replace('_', ' ') : 'Not specified'}
                                  </div>
                                </td>

                                {/* Match Score + Visual Score Bar */}
                                <td className="py-4 px-4">
                                  {c.needs_manual_review || scoreVal === null ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                                      Needs Review
                                    </span>
                                  ) : (
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="font-extrabold text-white">{scoreVal}%</span>
                                        <span className="text-[10px] text-white/40">Fit</span>
                                      </div>
                                      <div className="w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
                                        <motion.div
                                          className={`h-full rounded-full ${
                                            scoreVal >= 75
                                              ? 'bg-emerald-400'
                                              : scoreVal >= 55
                                              ? 'bg-amber-400'
                                              : 'bg-slate-400'
                                          }`}
                                          custom={scoreVal}
                                          variants={scoreBarVariants}
                                          initial="hidden"
                                          animate="visible"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </td>

                                {/* Verdict / Tier badge */}
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

                                {/* Expand Accordion Button */}
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
                              </motion.tr>

                              {/* ── EXPANDABLE SCORE BREAKDOWN ROW ── */}
                              {isExpanded && (
                                <tr className="bg-white/[0.015] border-b border-white/[0.06]">
                                  <td colSpan={6} className="p-0">
                                    <motion.div
                                      variants={accordionVariants}
                                      initial={shouldReduce ? false : 'hidden'}
                                      animate="visible"
                                      exit="exit"
                                      className="px-8 py-5 space-y-4"
                                    >
                                      {/* Unparseable warning if needs_manual_review */}
                                      {c.needs_manual_review ? (
                                        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                                          <div className="font-bold mb-1 flex items-center gap-2 text-rose-400">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            Corrupt / Unparseable Resume Document
                                          </div>
                                          <p>
                                            {c.error_message ||
                                              'Text extraction could not extract structured entities from this document. Zero synthetic scores were assigned.'}
                                          </p>
                                        </div>
                                      ) : (
                                        <>
                                          {/* Must-have penalty alert */}
                                          {c.is_capped && c.cap_reason && (
                                            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                                              <span className="font-bold">Must-Have Skill Capping:</span> {c.cap_reason}
                                            </div>
                                          )}

                                          {/* 5-Factor Score Breakdown */}
                                          <div>
                                            <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">
                                              5-Factor Score Decomposition
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
                                                <div className="text-[11px] text-white/40">Title Match (10%)</div>
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

                                          {/* Skills Matched vs Missing */}
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                  <span className="text-xs text-white/30 italic">No required skills matched</span>
                                                )}
                                              </div>
                                            </div>

                                            {/* Missing Required Skills */}
                                            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400 mb-2.5">
                                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                                Missing Skills Gap ({c.missing_skills?.length || 0})
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
                                                  <span className="text-xs text-emerald-400/70 italic">
                                                    All required skills satisfied!
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>

                                          {/* Candidate Summary / Notes */}
                                          {c.summary && (
                                            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-xs text-white/70">
                                              <span className="font-bold text-white/90">Automated Summary: </span>
                                              {c.summary}
                                            </div>
                                          )}
                                        </>
                                      )}
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
          )}
        </div>
      </div>

      {/* ── BULK INVITE MODAL ── */}
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
              className="w-full max-w-lg rounded-2xl border border-white/[0.1] p-6 shadow-2xl space-y-5"
              style={{ background: '#0d0d14' }}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Outreach</span>
                  <h3 className="text-lg font-extrabold text-white">
                    Bulk Invite Candidates ({selectedCandidateIds.size})
                  </h3>
                </div>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>

              {inviteSuccessMsg ? (
                <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                    ✓
                  </div>
                  <h4 className="font-bold text-emerald-300">Invitations Dispatched</h4>
                  <p className="text-xs text-emerald-400/80">{inviteSuccessMsg}</p>
                </div>
              ) : (
                <>
                  {/* Selected candidates summary list */}
                  <div>
                    <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                      Recipients
                    </label>
                    <div className="max-h-24 overflow-y-auto p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] flex flex-wrap gap-1.5">
                      {candidates
                        .filter(c => selectedCandidateIds.has(c.id))
                        .map(c => (
                          <span
                            key={c.id}
                            className="text-xs font-medium px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                          >
                            {c.name || `Candidate #${c.id}`}
                          </span>
                        ))}
                    </div>
                  </div>

                  {/* Stage Selector */}
                  <div>
                    <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                      Interview / Pipeline Stage
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'screening', label: 'Phone Screen' },
                        { id: 'assessment', label: 'Technical Assessment' },
                        { id: 'interview', label: 'Full Interview' },
                      ].map(stage => (
                        <button
                          key={stage.id}
                          type="button"
                          onClick={() => setInviteStage(stage.id as any)}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                            inviteStage === stage.id
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                              : 'bg-white/[0.03] text-white/50 border-white/[0.06] hover:bg-white/[0.05]'
                          }`}
                        >
                          {stage.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Invitation Message */}
                  <div>
                    <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                      Custom Message
                    </label>
                    <textarea
                      rows={3}
                      value={inviteMessage}
                      onChange={e => setInviteMessage(e.target.value)}
                      className="w-full p-3 text-xs bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 resize-none"
                    />
                  </div>

                  {/* Modal Footer */}
                  <div className="flex items-center justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-white/40 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={sendingInvites}
                      onClick={handleSendBulkInvites}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:opacity-50 text-white shadow-lg shadow-cyan-500/20 transition-all"
                    >
                      {sendingInvites && (
                        <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      )}
                      Send {selectedCandidateIds.size} Invitations
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
