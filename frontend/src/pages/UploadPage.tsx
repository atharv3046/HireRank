import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { api, JobPosting } from '../api/client';
import { motion, AnimatePresence } from 'framer-motion';

type FileStatus = 'queued' | 'uploading' | 'extracting' | 'scoring' | 'done' | 'error';

interface QueueFile {
  id: string;
  file: File;
  status: FileStatus;
  progress: number;
  score: number | null;
  candidateId: number | null;
  errorMsg: string | null;
}

const STATUS_LABELS: Record<FileStatus, string> = {
  queued:     'Queued',
  uploading:  'Uploading file…',
  extracting: 'Extracting skills & experience…',
  scoring:    'Scoring against job criteria…',
  done:       'Scored & Ready',
  error:      'Processing failed',
};

const FileIcon = ({ ext }: { ext: string }) => {
  const isPdf = ext.toLowerCase() === '.pdf';
  return (
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
      isPdf
        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
        : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
    }`}>
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </div>
  );
};

export default function UploadPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<QueueFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [job, setJob] = useState<JobPosting | null>(null);
  const [loadingJob, setLoadingJob] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // Load target job details
  useEffect(() => {
    if (!jobId) return;
    setLoadingJob(true);
    api.getJob(jobId)
      .then(j => setJob(j))
      .catch(err => console.error('Failed to load job', err))
      .finally(() => setLoadingJob(false));
  }, [jobId]);

  // Cleanup polling timers on unmount
  useEffect(() => {
    return () => {
      Object.values(pollingRefs.current).forEach(clearInterval);
    };
  }, []);

  const updateFile = (id: string, patch: Partial<QueueFile>) =>
    setQueue(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));

  const pollCandidate = (fileId: string, candidateId: number) => {
    const iv = setInterval(async () => {
      try {
        const status = await api.getCandidateStatus(candidateId);
        const ps = (status.processing_status || status.status) as string;
        if (ps === 'extracting' || ps === 'extracted_fields') {
          updateFile(fileId, { status: 'extracting', progress: 70 });
        } else if (ps === 'scoring') {
          updateFile(fileId, { status: 'scoring', progress: 90 });
        } else if (ps === 'done') {
          clearInterval(iv);
          delete pollingRefs.current[fileId];
          updateFile(fileId, { status: 'done', progress: 100, score: status.overall_score ?? null });
        } else if (ps === 'needs_manual_review') {
          clearInterval(iv);
          delete pollingRefs.current[fileId];
          updateFile(fileId, { status: 'done', progress: 100, score: null, errorMsg: 'Requires manual review' });
        } else if (ps === 'error') {
          clearInterval(iv);
          delete pollingRefs.current[fileId];
          updateFile(fileId, { status: 'error', errorMsg: status.error || 'Processing failed' });
        }
      } catch {
        // network retry
      }
    }, 1500);
    pollingRefs.current[fileId] = iv;
  };

  const processFile = async (qf: QueueFile) => {
    if (!jobId) return;
    updateFile(qf.id, { status: 'uploading', progress: 10 });
    try {
      const result = await api.uploadResume(jobId, qf.file, (e) => {
        const pct = Math.round((e.loaded * 100) / (e.total || 100));
        updateFile(qf.id, { progress: Math.min(pct, 60) });
      });
      updateFile(qf.id, { status: 'extracting', progress: 65, candidateId: result.candidate_id });
      pollCandidate(qf.id, result.candidate_id);
    } catch (e: any) {
      updateFile(qf.id, { status: 'error', errorMsg: e.response?.data?.detail || 'Upload failed' });
    }
  };

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => /\.(pdf|docx)$/i.test(f.name));
    if (!arr.length) return;
    const newEntries: QueueFile[] = arr.map(f => ({
      id: Math.random().toString(36).slice(2),
      file: f,
      status: 'queued',
      progress: 0,
      score: null,
      candidateId: null,
      errorMsg: null,
    }));
    setQueue(prev => [...prev, ...newEntries]);
    newEntries.forEach(qf => processFile(qf));
  }, [jobId]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const removeFile = (id: string) => {
    if (pollingRefs.current[id]) {
      clearInterval(pollingRefs.current[id]);
      delete pollingRefs.current[id];
    }
    setQueue(prev => prev.filter(f => f.id !== id));
  };

  const doneCount = queue.filter(f => f.status === 'done').length;
  const inProgressCount = queue.filter(f => f.status !== 'done' && f.status !== 'error').length;
  const allFinished = queue.length > 0 && queue.every(f => f.status === 'done' || f.status === 'error');

  return (
    <div className="flex min-h-screen font-sans antialiased text-white" style={{ background: '#0a0a0f' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="px-8 py-8 max-w-4xl mx-auto">

          {/* ── Breadcrumb & Back button ──────────────────────────────────── */}
          <button
            onClick={() => navigate(`/jobs/${jobId}`)}
            className="flex items-center gap-2 text-xs font-semibold text-white/40 hover:text-cyan-400 mb-6 transition-colors group"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Job Dashboard
          </button>

          {/* ── Header Banner with Target Job Context ───────────────────────── */}
          <div
            className="rounded-2xl border border-white/[0.08] p-6 mb-6 relative overflow-hidden shadow-2xl"
            style={{ background: '#0d0d14' }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    Screening Batch #{jobId}
                  </span>
                  <span className="text-xs text-white/40">· Job Description Linked</span>
                </div>
                <h1 className="text-2xl font-extrabold text-white tracking-tight">
                  {job ? `Upload Resumes for ${job.title}` : 'Upload Resumes'}
                </h1>
                <p className="text-xs text-white/40 mt-1">
                  Upload candidate CVs below. The AI will parse text, match skills, and rank candidates directly against this job's criteria.
                </p>
              </div>

              {job && (
                <div className="flex items-center gap-3 self-start sm:self-center">
                  <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-right">
                    <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Experience</div>
                    <div className="text-sm font-extrabold text-white">{job.min_experience_years}+ yrs</div>
                  </div>
                  {job.education_requirement && (
                    <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-right">
                      <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Education</div>
                      <div className="text-sm font-extrabold text-white capitalize">{job.education_requirement}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Target Criteria Preview */}
            {job?.required_skills && job.required_skills.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center gap-2 flex-wrap text-xs">
                <span className="font-semibold text-white/50">Required Skills Target:</span>
                {job.required_skills.map(s => (
                  <span key={s} className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-2.5 py-0.5 rounded-md font-medium text-xs">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── Drag and Drop Zone ─────────────────────────────────────────── */}
          <div
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 mb-6 relative overflow-hidden ${
              isDragging
                ? 'border-cyan-400 bg-cyan-500/[0.08] scale-[1.01] shadow-2xl shadow-cyan-500/10'
                : 'border-white/[0.1] bg-white/[0.02] hover:border-cyan-400/40 hover:bg-white/[0.04]'
            }`}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx"
              className="sr-only"
              onChange={e => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = '';
              }}
            />

            <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-all duration-300 border ${
              isDragging
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 scale-110 shadow-lg shadow-cyan-500/20'
                : 'bg-white/[0.04] border-white/[0.08] text-white/40 group-hover:text-cyan-400'
            }`}>
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>

            <p className="text-white font-bold text-base mb-1">
              Drop resumes here or <span className="text-cyan-400 underline underline-offset-2">browse files</span>
            </p>
            <p className="text-xs text-white/40 max-w-sm mx-auto mb-3">
              Upload multiple PDF or DOCX candidate resumes (up to 10MB each).
            </p>
            <div className="flex items-center justify-center gap-2 text-[11px] text-white/30">
              <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">.PDF</span>
              <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">.DOCX</span>
              <span>· Auto parsed & scored</span>
            </div>
          </div>

          {/* ── Live Processing Queue ─────────────────────────────────────── */}
          {queue.length > 0 && (
            <div
              className="rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl mb-8"
              style={{ background: '#0d0d14' }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center gap-2.5">
                  <h2 className="font-bold text-white text-sm">Processing Queue</h2>
                  {inProgressCount > 0 && (
                    <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                      {inProgressCount} Processing
                    </span>
                  )}
                </div>
                <span className="text-xs text-white/40">
                  {doneCount} of {queue.length} ready
                </span>
              </div>

              <div className="divide-y divide-white/[0.05]">
                {queue.map(qf => {
                  const ext = qf.file.name.match(/\.[^.]+$/)?.[0] ?? '.pdf';
                  const isDone = qf.status === 'done';
                  const isErr = qf.status === 'error';
                  const inProgress = !isDone && !isErr && qf.status !== 'queued';

                  return (
                    <div key={qf.id} className="px-6 py-4 transition-colors hover:bg-white/[0.01]">
                      <div className="flex items-center gap-4">
                        <FileIcon ext={ext} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-semibold text-white truncate max-w-md">
                              {qf.file.name}
                            </span>

                            <div className="flex items-center gap-3 flex-shrink-0">
                              {isDone && qf.score !== null && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-sm shadow-emerald-500/10">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                  </svg>
                                  {Math.round(qf.score)}% Match
                                </span>
                              )}

                              {isErr && (
                                <span className="text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg">
                                  {qf.errorMsg || 'Failed'}
                                </span>
                              )}

                              <button
                                onClick={() => removeFile(qf.id)}
                                title="Remove from list"
                                className="w-6 h-6 flex items-center justify-center text-white/30 hover:text-white/70 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* Status and Progress */}
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 text-xs">
                              {inProgress && (
                                <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                              )}
                              <span className={`text-xs ${
                                isDone ? 'text-emerald-400 font-medium' : isErr ? 'text-rose-400' : 'text-white/40'
                              }`}>
                                {STATUS_LABELS[qf.status]}
                              </span>
                            </div>

                            {!isDone && !isErr && (
                              <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300"
                                  style={{ width: `${qf.progress}%` }}
                                />
                              </div>
                            )}

                            {isDone && (
                              <div className="flex-1 h-1 bg-emerald-500/20 rounded-full overflow-hidden">
                                <div className="h-full w-full bg-emerald-400 rounded-full" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06] bg-white/[0.02]">
                <div className="text-xs text-white/40">
                  {doneCount} of {queue.length} resumes successfully scored
                  {allFinished && <span className="ml-2 text-emerald-400 font-semibold">· All done!</span>}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate(`/jobs/${jobId}`)}
                    className="text-xs font-semibold text-white/60 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] px-4 py-2 rounded-xl transition-colors"
                  >
                    Back to Job
                  </button>

                  <button
                    onClick={() => navigate(`/jobs/${jobId}`)}
                    className={`text-xs font-semibold px-5 py-2 rounded-xl transition-all flex items-center gap-2 ${
                      doneCount > 0
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white shadow-lg shadow-cyan-500/20'
                        : 'bg-white/[0.05] text-white/30 cursor-not-allowed'
                    }`}
                    disabled={doneCount === 0}
                  >
                    View Ranked Candidates ({doneCount})
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
