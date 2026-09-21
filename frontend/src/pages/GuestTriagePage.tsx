/**
 * Screen 2 — Guest Triage
 * =======================
 * Left:  Job Description textarea (paste or type)
 * Right: Drag-and-drop file upload, max 10 files (PDF/DOCX)
 *
 * No login required.
 * Submit is disabled until BOTH a JD (≥ 50 chars) AND ≥ 1 file are present.
 * On submit → POST /api/guest/screen → navigate to /processing/:sessionId
 *
 * Backend contract expected:
 *   POST /api/guest/screen  (multipart/form-data)
 *   Fields:
 *     job_description: string
 *     files[]:         File[]   (max 10, PDF/DOCX)
 *   Response 200:
 *     { session_id: string, job_id: number, candidate_count: number, skipped: string[] }
 *   Response 422:
 *     { detail: string }
 */

import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
  useReducedMotion,
  fadeInUpVariants,
  staggerContainerVariants,
} from '../utils/animations';

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


/* ── Main page ──────────────────────────────────────────────────────────── */
export default function GuestTriagePage() {
  const navigate = useNavigate();
  const shouldReduce = useReducedMotion();
  const { user, token, isAuthenticated } = useAuth();

  const [jd, setJd]               = useState('');
  const [files, setFiles]         = useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Validation state ───────────────────────────────────────────────── */
  const jdOk    = jd.trim().length >= MIN_JD_CHARS;
  const validFiles = files.filter(f => !f.error);
  const filesOk = validFiles.length > 0;
  const canSubmit = jdOk && filesOk && !submitting;
  const remaining = MAX_FILES - files.length;

  /* ── File processing ────────────────────────────────────────────────── */
  const processFiles = useCallback((incoming: File[]) => {
    const entries: QueuedFile[] = incoming.map(f => {
      let error: string | null = null;
      if (!ALLOWED_TYPES.includes(fileExt(f.name))) {
        error = 'Only PDF or DOCX allowed';
      } else if (f.size > 10 * 1024 * 1024) {
        error = 'File exceeds 10 MB limit';
      }
      return { id: Math.random().toString(36).slice(2), file: f, error };
    });

    setFiles(prev => {
      const combined = [...prev, ...entries];
      return combined.map((e, i) =>
        i >= MAX_FILES ? { ...e, error: `Exceeds ${MAX_FILES}-file limit` } : e
      );
    });
  }, []);

  /* ── Drag-and-drop handlers ─────────────────────────────────────────── */
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
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
    setFiles(prev => prev.filter(f => f.id !== id));

  /* ── Submit ─────────────────────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setServerError(null);

    const formData = new FormData();
    formData.append('job_description', jd.trim());
    validFiles.forEach(qf => formData.append('files', qf.file));

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

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen font-sans" style={{ background: '#0a0a0f' }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="border-b border-white/[0.06] px-8 py-4 flex items-center justify-between">
        <button onClick={() => navigate(isAuthenticated ? '/dashboard' : '/')} className="flex items-center gap-2 group">
          <div className="w-7 h-7 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-md flex items-center justify-center">
            <span className="text-white text-xs font-bold">H</span>
          </div>
          <span className="font-semibold text-white text-lg group-hover:text-cyan-400 transition-colors">HireRank</span>
        </button>
        {isAuthenticated ? (
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08]">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-white/70 text-xs font-medium">{user?.email || 'Recruiter'}</span>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 border border-cyan-500/25 transition-all"
            >
              Dashboard →
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-white/30">Already have an account?</span>
            <button onClick={() => navigate('/login')} className="text-cyan-400 font-medium hover:text-cyan-300 transition-colors">
              Sign in
            </button>
          </div>
        )}
      </header>

      {/* ── Page title ───────────────────────────────────────────────────── */}
      <motion.div
        variants={fadeInUpVariants}
        initial={shouldReduce ? false : "hidden"}
        animate="visible"
        className="max-w-6xl mx-auto px-6 pt-10 pb-4"
      >
        <h1 className="text-2xl font-bold text-white mb-1">
          {isAuthenticated ? 'Instant Resume Screening' : 'Screen candidates'}
        </h1>
        <p className="text-white/40 text-sm">
          {isAuthenticated
            ? 'Paste a job description and upload resumes to get instant AI rankings saved directly to your workspace.'
            : 'No account needed — paste a JD and upload resumes to get instant rankings.'}
        </p>
      </motion.div>

      {/* ── Two-column layout ────────────────────────────────────────────── */}
      <motion.div
        variants={staggerContainerVariants}
        initial={shouldReduce ? false : "hidden"}
        animate="visible"
        className="max-w-6xl mx-auto px-6 pb-16 grid grid-cols-1 lg:grid-cols-2 gap-6"
      >

        {/* ── LEFT: Job Description ────────────────────────────────────── */}
        <motion.div
          variants={fadeInUpVariants}
          className="rounded-2xl border border-white/[0.07] flex flex-col"
          style={{ background: '#0d0d14' }}
        >
          <div className="px-6 pt-6 pb-4 border-b border-white/[0.05]">
            <h2 className="font-semibold text-white text-base flex items-center gap-2">
              <span className="w-6 h-6 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-full text-xs font-bold flex items-center justify-center">1</span>
              Job Description
            </h2>
            <p className="text-xs text-white/30 mt-1">Paste the full JD — skills, experience, and education will be extracted automatically.</p>
          </div>

          <div className="flex-1 flex flex-col px-6 py-4">
            <textarea
              value={jd}
              onChange={e => setJd(e.target.value)}
              placeholder={`e.g. Senior Python Engineer\n\nWe are looking for...\n\nRequirements:\n• 5+ years Python experience\n• FastAPI, Docker, PostgreSQL\n• Bachelor's degree required`}
              style={{ background: 'transparent', color: 'rgba(255,255,255,0.8)' }}
              className="flex-1 w-full min-h-[360px] text-sm resize-none focus:outline-none leading-relaxed placeholder-white/15"
            />
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.05]">
              <span className={`text-xs ${jd.trim().length < MIN_JD_CHARS ? 'text-white/30' : 'text-emerald-400 font-medium'}`}>
                {jd.trim().length < MIN_JD_CHARS
                  ? `${MIN_JD_CHARS - jd.trim().length} more characters needed`
                  : '✓ Job description ready'
                }
              </span>
              <span className="text-xs text-white/25">{jd.length} chars</span>
            </div>
          </div>
        </motion.div>

        {/* ── RIGHT: File Upload ───────────────────────────────────────── */}
        <motion.div
          variants={fadeInUpVariants}
          className="rounded-2xl border border-white/[0.07] flex flex-col"
          style={{ background: '#0d0d14' }}
        >
          <div className="px-6 pt-6 pb-4 border-b border-white/[0.05]">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white text-base flex items-center gap-2">
                <span className="w-6 h-6 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-full text-xs font-bold flex items-center justify-center">2</span>
                Upload Resumes
              </h2>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                remaining <= 2
                  ? 'bg-orange-500/15 text-orange-400 border border-orange-500/20'
                  : 'bg-white/[0.04] text-white/40 border border-white/[0.06]'
              }`}>
                {remaining}/{MAX_FILES} remaining
              </span>
            </div>
            <p className="text-xs text-white/30 mt-1">PDF or DOCX, up to 10 MB each, max {MAX_FILES} files.</p>
          </div>

          <div className="flex-1 flex flex-col px-6 py-4 gap-4">
            {/* Drop zone */}
            <motion.div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => remaining > 0 && fileInputRef.current?.click()}
              whileHover={!shouldReduce && remaining > 0 ? { borderColor: 'rgba(6, 182, 212, 0.45)' } : undefined}
              animate={{
                scale: isDragging && !shouldReduce ? 1.012 : 1,
              }}
              transition={{ duration: 0.15 }}
              className={`
                border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
                ${isDragging
                  ? 'border-cyan-400 bg-cyan-500/[0.06]'
                  : remaining === 0
                    ? 'border-white/[0.05] bg-white/[0.02] cursor-not-allowed'
                    : 'border-white/[0.07] hover:bg-cyan-500/[0.02]'
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
              <div className={`w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center transition-colors ${isDragging ? 'bg-cyan-500/20' : 'bg-white/[0.04]'}`}>
                <svg className={`w-6 h-6 ${isDragging ? 'text-cyan-400' : 'text-white/30'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              {remaining === 0 ? (
                <p className="text-sm text-white/30">Maximum {MAX_FILES} files reached</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-white/70">
                    Drop resumes here or <span className="text-cyan-400">browse</span>
                  </p>
                  <p className="text-xs text-white/30 mt-1">PDF · DOCX · up to 10 MB each</p>
                </>
              )}
            </motion.div>

            {/* Retention / workspace policy disclosure */}
            <div className="flex items-center gap-2 px-1 text-xs text-white/40">
              {isAuthenticated ? (
                <>
                  <span className="text-emerald-400">✓</span>
                  <span>Resumes will be parsed, scored with AI, and synced directly to your recruiter workspace.</span>
                </>
              ) : (
                <>
                  <span className="text-cyan-400">🔒</span>
                  <span>Your resumes are processed to generate this shortlist and are automatically deleted within 24 hours unless you create a free workspace.</span>
                </>
              )}
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-1">
                <AnimatePresence initial={false}>
                  {files.map(qf => (
                    <motion.div
                      key={qf.id}
                      initial={shouldReduce ? false : { opacity: 0, y: -8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -12, transition: { duration: 0.15 } }}
                      transition={{ duration: 0.2 }}
                      className={`flex items-center gap-3 p-3 rounded-xl border ${
                        qf.error
                          ? 'border-red-500/20 bg-red-500/10'
                          : 'border-white/[0.06] bg-white/[0.03]'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        fileExt(qf.file.name) === '.pdf' ? 'bg-red-500/15' : 'bg-blue-500/15'
                      }`}>
                        <svg className={`w-5 h-5 ${fileExt(qf.file.name) === '.pdf' ? 'text-red-400' : 'text-blue-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/80 truncate">{qf.file.name}</p>
                        {qf.error
                          ? <p className="text-xs text-red-400 mt-0.5">{qf.error}</p>
                          : <p className="text-xs text-white/30">{humanSize(qf.file.size)}</p>
                        }
                      </div>
                      <motion.button
                        whileHover={!shouldReduce ? { scale: 1.15 } : undefined}
                        whileTap={!shouldReduce ? { scale: 0.9 } : undefined}
                        onClick={() => removeFile(qf.id)}
                        className="text-white/20 hover:text-white/50 transition-colors flex-shrink-0 p-1"
                        aria-label="Remove file"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </motion.button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {files.length === 0 && (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-white/20 text-center">
                  Your uploaded resumes will appear here
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* ── Submit bar (sticky bottom) ───────────────────────────────────── */}
      <div
        className="fixed bottom-0 inset-x-0 border-t border-white/[0.07] z-10 backdrop-blur-md"
        style={{ background: 'rgba(10,10,15,0.92)' }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">

          {/* Compliance / workspace note */}
          {isAuthenticated ? (
            <p className="text-xs text-white/35 max-w-md leading-relaxed">
              ✨ Logged in as <strong className="font-medium text-white/70">{user?.email}</strong>. This batch will be added directly to your workspace pipeline.
            </p>
          ) : (
            <p className="text-xs text-white/35 max-w-md leading-relaxed">
              🔒 Your resumes are processed to generate this shortlist and are <strong className="font-medium text-white/60">automatically deleted within 24 hours</strong> unless you create a free workspace.
            </p>
          )}

          <div className="flex items-center gap-4 flex-shrink-0">
            {/* Readiness indicators */}
            <div className="hidden sm:flex items-center gap-3 text-xs">
              <span className={`flex items-center gap-1 ${jdOk ? 'text-emerald-400' : 'text-white/25'}`}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={jdOk ? 'M5 13l4 4L19 7' : 'M20 12H4'} />
                </svg>
                JD ready
              </span>
              <span className={`flex items-center gap-1 ${filesOk ? 'text-emerald-400' : 'text-white/25'}`}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={filesOk ? 'M5 13l4 4L19 7' : 'M20 12H4'} />
                </svg>
                {validFiles.length} file{validFiles.length !== 1 ? 's' : ''} ready
              </span>
            </div>

            <AnimatePresence>
              {serverError && (
                <motion.p
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-xs text-red-400 max-w-xs"
                >
                  {serverError}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.button
              whileHover={canSubmit && !shouldReduce ? { scale: 1.02 } : undefined}
              whileTap={canSubmit && !shouldReduce ? { scale: 0.98 } : undefined}
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`
                flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all
                ${canSubmit
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white shadow-lg shadow-cyan-500/20'
                  : 'bg-white/[0.04] text-white/20 cursor-not-allowed border border-white/[0.06]'
                }
              `}
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  Screen {validFiles.length > 0 ? `${validFiles.length} resume${validFiles.length !== 1 ? 's' : ''}` : 'resumes'}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Padding for fixed bottom bar */}
      <div className="h-24" />
    </div>
  );
}
