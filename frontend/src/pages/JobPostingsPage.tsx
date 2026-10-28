/**
 * Job Postings Page — /jobs
 * =========================
 * Framer Motion animation pass with:
 *  - AnimatePresence modal transitions
 *  - Staggered job posting row entries
 *  - Micro-interactions on buttons
 *  - prefers-reduced-motion safety
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import { api, JobPosting } from '../api/client';
import { CreateJobModal } from '../components/CreateJobModal';
import {
  useReducedMotion,
  fadeInUpVariants,
  staggerContainerVariants,
} from '../utils/animations';

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  closed: 'bg-white/[0.04] text-white/40 border-[var(--line)]',
  draft:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

/* ── Main Page ────────────────────────────────────────────────────────── */
export default function JobPostingsPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();
  const shouldReduce = useReducedMotion();

  useEffect(() => {
    api.getJobs()
      .then(data => { setJobs(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="flex min-h-screen font-sans text-white" style={{ background: 'transparent' }}>
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
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
          >
            <div>
              <div className="text-xs text-[var(--accent)] font-semibold uppercase tracking-wider mb-1">MANAGE</div>
              <h1 className="font-serif-display text-3xl font-normal text-[var(--text)] tracking-tight">Job Postings</h1>
              <p className="text-sm text-white/40 mt-1">All screening batches and hiring criteria configured for your organization.</p>
            </div>
            <motion.button
              onClick={() => setShowCreate(true)}
              whileHover={shouldReduce ? undefined : { scale: 1.02 }}
              whileTap={shouldReduce ? undefined : { scale: 0.98 }}
              className="flex items-center gap-2 bg-[var(--accent)] text-[#04110f] font-semibold text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-none"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Job Batch
            </motion.button>
          </motion.div>

          {/* Table / List */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-2xl border border-[var(--line)] p-5 animate-pulse" style={{ background: '#0d0d14' }}>
                  <div className="h-4 bg-white/[0.08] rounded w-1/3 mb-3" />
                  <div className="h-3 bg-white/[0.04] rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <motion.div
              variants={fadeInUpVariants}
              viewport={{ once: true }}
              className="rounded-2xl border border-[var(--line)] p-16 text-center shadow-sm"
              style={{ background: '#0d0d14' }}
            >
              <div className="w-14 h-14 bg-[var(--accent-dim)] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[var(--accent)]/30">
                <svg className="w-7 h-7 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-white font-bold text-lg mb-1.5">No job postings yet</h3>
              <p className="text-white/40 text-sm mb-6 max-w-sm mx-auto">Create your first job posting to start screening and ranking candidates.</p>
              <motion.button
                onClick={() => setShowCreate(true)}
                whileHover={shouldReduce ? undefined : { scale: 1.02 }}
                whileTap={shouldReduce ? undefined : { scale: 0.98 }}
                className="bg-[var(--accent)] text-[#04110f] font-semibold text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-none"
              >
                Create First Job
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              variants={fadeInUpVariants}
              viewport={{ once: true }}
              className="rounded-2xl border border-[var(--line)] overflow-hidden shadow-sm"
              style={{ background: '#0d0d14' }}
            >
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-white/[0.02] text-[11px] font-bold text-white/40 uppercase tracking-wider">
                    <th className="py-4 pl-6 pr-4">Job Title</th>
                    <th className="py-4 px-4 text-center">Candidates</th>
                    <th className="py-4 px-4 text-center">Min. Exp</th>
                    <th className="py-4 px-4 text-center">Status</th>
                    <th className="py-4 pr-6 pl-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-sm">
                  {jobs.map(job => (
                    <motion.tr
                      key={job.id}
                      whileHover={shouldReduce ? undefined : { backgroundColor: 'rgba(6, 182, 212, 0.04)' }}
                      onClick={() => navigate(`/jobs/${job.id}`)}
                      className="cursor-pointer transition-colors group"
                    >
                      <td className="py-4 pl-6 pr-4">
                        <div className="font-bold text-white group-hover:text-[var(--accent)] transition-colors">{job.title}</div>
                        <div className="text-xs text-white/40 mt-1 line-clamp-1">{job.description}</div>
                        {job.required_skills && job.required_skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {job.required_skills.slice(0, 4).map(s => (
                              <span key={s} className="text-[10px] bg-white/[0.04] text-white/60 px-2 py-0.5 rounded border border-[var(--line)]">
                                {s}
                              </span>
                            ))}
                            {job.required_skills.length > 4 && (
                              <span className="text-[10px] text-white/30">+{job.required_skills.length - 4}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="font-extrabold text-white bg-white/[0.04] px-3 py-1 rounded-lg border border-[var(--line)]">
                          {job.candidate_count || 0}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center text-white/50 font-medium">
                        {job.min_experience_years}+ yrs
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${statusColors[job.status] || 'bg-white/[0.04] text-white/40 border-[var(--line)]'}`}>
                          {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                        </span>
                      </td>
                      <td className="py-4 pr-6 pl-4 text-right">
                        <span className="text-xs text-[var(--accent)] font-semibold group-hover:underline flex items-center justify-end gap-1">
                          View Shortlist
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}
        </motion.div>
      </main>

      <AnimatePresence>
        {showCreate && (
          <CreateJobModal
            onClose={() => setShowCreate(false)}
            onCreated={job => {
              setJobs(prev => [job, ...prev]);
              setShowCreate(false);
              navigate(`/jobs/${job.id}`);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
