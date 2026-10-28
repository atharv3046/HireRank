/**
 * Screen 2 — Guest Triage
 * =======================
 * Restyled to HireRank Editorial Core theme:
 *  - Instrument Serif page title with tight tracking
 *  - Unified HR monogram logo navigation
 *  - Outlined step indicator circles with var(--accent)
 *  - Flat card surfaces with 1px var(--line) borders
 *  - High-contrast inputs and readable placeholders (#7d838f)
 *  - Quiet, single privacy disclosure in sticky bottom bar
 *  - Flat .btn-primary with disabled states
 */

import React, { useState, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileText, X, Check, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  useReducedMotion,
  fadeInUpVariants,
  staggerContainerVariants,
} from '../utils/animations';
import Navbar from '../components/Navbar';

const MAX_FILES = 10;
const MIN_JD_CHARS = 50;
const ALLOWED_TYPES = ['.pdf', '.docx', '.doc'];

interface QueuedFile {
  id: string;
  file: File;
  error: string | null;
}

function fileExt(name: string) {
  return name.slice(name.lastIndexOf('.')).toLowerCase();
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function GuestTriagePage() {
  const navigate = useNavigate();
  const shouldReduce = useReducedMotion();
  const { user, token, isAuthenticated } = useAuth();

  const [jd, setJd] = useState('');
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Validation state ───────────────────────────────────────────────── */
  const jdOk = jd.trim().length >= MIN_JD_CHARS;
  const validFiles = files.filter((f) => !f.error);
  const filesOk = validFiles.length > 0;
  const canSubmit = jdOk && filesOk && !submitting;
  const remaining = MAX_FILES - files.length;

  /* ── File processing ────────────────────────────────────────────────── */
  const processFiles = useCallback((incoming: File[]) => {
    const entries: QueuedFile[] = incoming.map((f) => {
      let error: string | null = null;
      if (!ALLOWED_TYPES.includes(fileExt(f.name))) {
        error = 'Only PDF or DOCX allowed';
      } else if (f.size > 10 * 1024 * 1024) {
        error = 'File exceeds 10 MB limit';
      }
      return { id: Math.random().toString(36).slice(2), file: f, error };
    });

    setFiles((prev) => {
      const combined = [...prev, ...entries];
      return combined.map((e, i) =>
        i >= MAX_FILES ? { ...e, error: `Exceeds ${MAX_FILES}-file limit` } : e
      );
    });
  }, []);

  /* ── Drag-and-drop handlers ─────────────────────────────────────────── */
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const removeFile = (id: string) =>
    setFiles((prev) => prev.filter((f) => f.id !== id));

  /* ── Submit ─────────────────────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setServerError(null);

    const formData = new FormData();
    formData.append('job_description', jd.trim());
    validFiles.forEach((qf) => formData.append('files', qf.file));

    const headers: Record<string, string> = {
      'Content-Type': 'multipart/form-data',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await axios.post('/api/guest/screen', formData, {
        headers,
      });
      const { session_id } = res.data;
      localStorage.setItem('guest_session_id', session_id);
      navigate(`/processing/${session_id}`);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Something went wrong. Please try again.';
      setServerError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen font-sans flex flex-col bg-transparent text-[var(--text)]">
      {/* ── Global Header ─────────────────────────────────────────────── */}
      <Navbar minimal />

      {/* ── Page Title Header ──────────────────────────────────────────── */}
      <motion.div
        variants={fadeInUpVariants}
        initial={shouldReduce ? false : 'hidden'}
        animate="visible"
        className="max-w-6xl mx-auto w-full px-6 pt-10 pb-6"
      >
        <div className="flex items-center gap-3 mb-2">
          <span className="badge-mono text-[10px] text-[var(--accent)] border-[var(--accent)]/30">
            {isAuthenticated ? 'Recruiter Pipeline' : 'Instant Triage'}
          </span>
        </div>
        <h1 className="font-serif-display text-3xl md:text-5xl font-normal text-[var(--text)] tracking-tight">
          {isAuthenticated ? 'Instant Resume Screening' : 'Screen & Rank Resumes'}
        </h1>
        <p className="text-[var(--muted)] text-sm md:text-base mt-2 max-w-2xl leading-relaxed">
          {isAuthenticated
            ? 'Paste your requirements and upload resumes to generate semantic match scores and sync candidates to your workspace.'
            : 'No account needed. Paste a job description, drop candidate resumes, and receive an explainable ranking in seconds.'}
        </p>
      </motion.div>

      {/* ── Two-column layout ──────────────────────────────────────────── */}
      <motion.div
        variants={staggerContainerVariants}
        initial={shouldReduce ? false : 'hidden'}
        animate="visible"
        className="max-w-6xl mx-auto w-full px-6 pb-24 grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1"
      >
        {/* ── LEFT: Job Description ──────────────────────────────────── */}
        <motion.div
          variants={fadeInUpVariants}
          className="card-surface flex flex-col"
        >
          <div className="px-6 py-5 border-b border-[var(--line)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="step-num w-7 h-7 text-xs">1</div>
              <div>
                <h2 className="font-medium text-[var(--text)] text-base">Job Description</h2>
                <p className="text-xs text-[var(--muted)] mt-0.5">Skills, experience, and domain are parsed automatically</p>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col px-6 py-5">
            <textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder={`e.g. Senior Software Engineer\n\nRequirements:\n• 5+ years experience building web applications in Python\n• Deep understanding of FastAPI, Docker, and PostgreSQL\n• Hands-on AWS or cloud deployment experience\n• Strong communication and team mentorship skills`}
              className="flex-1 w-full min-h-[360px] text-sm resize-none focus:outline-none leading-relaxed text-[var(--text)] placeholder-[#7d838f] bg-transparent font-sans"
            />
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line)]">
              <span
                className={`text-xs font-mono ${
                  jd.trim().length < MIN_JD_CHARS ? 'text-[var(--muted)]' : 'text-emerald-400 font-medium'
                }`}
              >
                {jd.trim().length < MIN_JD_CHARS
                  ? `${MIN_JD_CHARS - jd.trim().length} more characters required`
                  : '✓ Job description verified'}
              </span>
              <span className="text-xs font-mono tabular-nums text-[var(--muted)]">
                {jd.length} chars
              </span>
            </div>
          </div>
        </motion.div>

        {/* ── RIGHT: File Upload ─────────────────────────────────────── */}
        <motion.div
          variants={fadeInUpVariants}
          className="card-surface flex flex-col"
        >
          <div className="px-6 py-5 border-b border-[var(--line)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="step-num w-7 h-7 text-xs">2</div>
              <div>
                <h2 className="font-medium text-[var(--text)] text-base">Candidate Resumes</h2>
                <p className="text-xs text-[var(--muted)] mt-0.5">PDF or DOCX format, up to 10 MB each</p>
              </div>
            </div>
            <span
              className={`text-xs font-mono px-2.5 py-1 rounded-md border ${
                remaining <= 2
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                  : 'bg-white/[0.04] text-[var(--muted)] border-[var(--line)]'
              }`}
            >
              {remaining}/{MAX_FILES} slots
            </span>
          </div>

          <div className="flex-1 flex flex-col px-6 py-5 gap-4">
            {/* Drop zone */}
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => remaining > 0 && fileInputRef.current?.click()}
              className={`
                border border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-150
                ${
                  isDragging
                    ? 'border-[var(--accent)] bg-[var(--accent-dim)]'
                    : remaining === 0
                    ? 'border-[var(--line)] opacity-50 cursor-not-allowed'
                    : 'border-[var(--line)] hover:border-[var(--accent)]/40 hover:bg-white/[0.02]'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc"
                multiple
                className="sr-only"
                onChange={onInputChange}
              />
              <div
                className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center transition-colors ${
                  isDragging ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'bg-white/[0.04] text-[var(--muted)]'
                }`}
              >
                <UploadCloud className="w-6 h-6 stroke-[1.8]" />
              </div>
              {remaining === 0 ? (
                <p className="text-sm text-[var(--muted)]">Batch limit reached ({MAX_FILES} files)</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-[var(--text)]">
                    Drop resumes here or{' '}
                    <span className="text-[var(--accent)] underline underline-offset-4 hover:opacity-80">
                      browse
                    </span>
                  </p>
                  <p className="text-xs text-[var(--muted)] mt-1.5 font-mono">
                    PDF · DOCX · up to 10 MB per file
                  </p>
                </>
              )}
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-1">
                <AnimatePresence initial={false}>
                  {files.map((qf) => (
                    <motion.div
                      key={qf.id}
                      initial={shouldReduce ? false : { opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.15 }}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        qf.error
                          ? 'border-rose-500/25 bg-rose-500/10'
                          : 'border-[var(--line)] bg-white/[0.02]'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${
                          fileExt(qf.file.name) === '.pdf'
                            ? 'bg-rose-500/15 text-rose-400'
                            : 'bg-[var(--accent-dim)] text-[var(--accent)]'
                        }`}
                      >
                        <FileText className="w-4 h-4 stroke-[1.8]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--text)] truncate">{qf.file.name}</p>
                        {qf.error ? (
                          <p className="text-xs text-rose-400 mt-0.5">{qf.error}</p>
                        ) : (
                          <p className="text-xs font-mono text-[var(--muted)]">{humanSize(qf.file.size)}</p>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(qf.id);
                        }}
                        className="text-[var(--muted)] hover:text-[var(--text)] p-1.5 transition-colors"
                        aria-label="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {files.length === 0 && (
              <div className="flex-1 flex items-center justify-center py-8">
                <p className="text-xs font-mono text-[var(--muted)] text-center">
                  Uploaded resumes will appear here
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* ── Sticky Bottom Action Bar ───────────────────────────────────── */}
      <div className="fixed bottom-0 inset-x-0 border-t border-[var(--line)] bg-[#08090c]/95 backdrop-blur-md z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Quiet, Single Disclosure (no orange lock emoji) */}
          <div className="text-xs text-[var(--muted)] leading-relaxed max-w-md">
            {isAuthenticated ? (
              <span>
                Logged in as <strong className="text-[var(--text)] font-medium">{user?.email}</strong>. Screening results sync directly to your workspace.
              </span>
            ) : (
              <span>
                Resumes are processed ephemerally and automatically removed within 24 hours unless saved to an account.
              </span>
            )}
          </div>

          <div className="flex items-center gap-5 flex-shrink-0 w-full sm:w-auto justify-between sm:justify-end">
            {/* Readiness indicators */}
            <div className="hidden md:flex items-center gap-3 text-xs font-mono">
              <span className={`flex items-center gap-1.5 ${jdOk ? 'text-emerald-400' : 'text-[var(--muted)]'}`}>
                <Check className={`w-3.5 h-3.5 ${jdOk ? 'text-emerald-400' : 'text-[var(--muted)]/40'}`} />
                JD requirements
              </span>
              <span className="text-[var(--line)]">•</span>
              <span className={`flex items-center gap-1.5 ${filesOk ? 'text-emerald-400' : 'text-[var(--muted)]'}`}>
                <Check className={`w-3.5 h-3.5 ${filesOk ? 'text-emerald-400' : 'text-[var(--muted)]/40'}`} />
                {validFiles.length} file{validFiles.length !== 1 ? 's' : ''}
              </span>
            </div>

            {serverError && (
              <p className="text-xs text-rose-400 max-w-xs">{serverError}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="btn-primary text-xs py-3 px-6 gap-2 w-full sm:w-auto"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#04110f]" />
                  Screening Resumes…
                </>
              ) : (
                <>
                  Screen {validFiles.length > 0 ? `${validFiles.length} resume${validFiles.length !== 1 ? 's' : ''}` : 'Resumes'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
