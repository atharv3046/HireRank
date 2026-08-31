import React, { useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { api } from '../api/client';

type FileStatus = 'queued' | 'uploading' | 'extracting' | 'scoring' | 'done' | 'error';

interface QueueFile {
  id: string;
  file: File;
  status: FileStatus;
  progress: number;        // upload progress 0–100
  score: number | null;
  candidateId: number | null;
  errorMsg: string | null;
}

const STATUS_LABELS: Record<FileStatus, string> = {
  queued:     'Queued',
  uploading:  'Uploading…',
  extracting: 'Extracting text…',
  scoring:    'Scoring…',
  done:       'Done',
  error:      'Error',
};

const STATUS_COLORS: Record<FileStatus, string> = {
  queued:     'bg-gray-200',
  uploading:  'bg-indigo-500 progress-animated',
  extracting: 'bg-blue-500 progress-animated',
  scoring:    'bg-purple-500 progress-animated',
  done:       'bg-green-500',
  error:      'bg-red-400',
};

const FileIcon = ({ ext }: { ext: string }) => {
  const isPdf = ext === '.pdf';
  return (
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isPdf ? 'bg-red-100' : 'bg-blue-100'}`}>
      <svg className={`w-5 h-5 ${isPdf ? 'text-red-500' : 'text-blue-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
  const [jobTitle, setJobTitle] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRefs = useRef<Record<string, NodeJS.Timeout>>({});

  // Load job title
  React.useEffect(() => {
    if (jobId) api.getJob(jobId).then(j => setJobTitle(j.title));
  }, [jobId]);

  const updateFile = (id: string, patch: Partial<QueueFile>) =>
    setQueue(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));

  const pollCandidate = (fileId: string, candidateId: number) => {
    const iv = setInterval(async () => {
      try {
        const status = await api.getCandidateStatus(candidateId);
        const ps = status.processing_status as string;
        if (ps === 'extracting' || ps === 'extracted_fields') {
          updateFile(fileId, { status: 'extracting', progress: 70 });
        } else if (ps === 'scoring') {
          updateFile(fileId, { status: 'scoring', progress: 90 });
        } else if (ps === 'done') {
          clearInterval(iv);
          delete pollingRefs.current[fileId];
          updateFile(fileId, { status: 'done', progress: 100, score: status.overall_score ?? null });
        } else if (ps === 'error') {
          clearInterval(iv);
          delete pollingRefs.current[fileId];
          updateFile(fileId, { status: 'error', errorMsg: 'Processing failed' });
        }
      } catch {}
    }, 2000);
    pollingRefs.current[fileId] = iv;
  };

  const processFile = async (qf: QueueFile) => {
    if (!jobId) return;
    updateFile(qf.id, { status: 'uploading', progress: 0 });
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
      file: f, status: 'queued', progress: 0, score: null, candidateId: null, errorMsg: null,
    }));
    setQueue(prev => [...prev, ...newEntries]);
    newEntries.forEach(qf => processFile(qf));
  }, [jobId]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const removeFile = (id: string) => {
    if (pollingRefs.current[id]) { clearInterval(pollingRefs.current[id]); delete pollingRefs.current[id]; }
    setQueue(prev => prev.filter(f => f.id !== id));
  };

  const doneCount = queue.filter(f => f.status === 'done').length;
  const allDone = queue.length > 0 && queue.every(f => f.status === 'done' || f.status === 'error');

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="px-8 py-8 max-w-3xl">
          {/* Back */}
          <button onClick={() => navigate(`/jobs/${jobId}`)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-6 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Job
          </button>

          {/* Header */}
          <div className="mb-6 animate-fade-up">
            <h1 className="text-2xl font-bold text-gray-900">Upload Candidates</h1>
            {jobTitle && (
              <p className="text-gray-500 mt-1 text-sm">
                For Role: <span className="font-semibold text-gray-800">{jobTitle}</span>
              </p>
            )}
          </div>

          {/* Drop zone */}
          <div
            className={`animate-fade-up border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 mb-6 ${
              isDragging
                ? 'border-indigo-400 bg-indigo-50 scale-[1.01] shadow-lg shadow-indigo-100'
                : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50'
            }`}
            style={{ animationDelay: '60ms' }}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file" multiple accept=".pdf,.docx" className="sr-only"
              onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
            />
            <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-all duration-200 ${isDragging ? 'bg-indigo-100 scale-110' : 'bg-gray-100'}`}>
              <svg className={`w-8 h-8 transition-colors duration-200 ${isDragging ? 'text-indigo-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-gray-700 font-medium mb-1">Drop PDF or DOCX files here</p>
            <p className="text-sm text-indigo-500 font-medium mb-2">or click to browse from your computer</p>
            <p className="text-xs text-gray-400">Max file size: 10MB per document</p>
          </div>

          {/* Processing Queue */}
          {queue.length > 0 && (
            <div className="animate-fade-up bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm" style={{ animationDelay: '120ms' }}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Processing Queue</h2>
                <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded-full">
                  {queue.length} {queue.length === 1 ? 'File' : 'Files'}
                </span>
              </div>

              <div className="divide-y divide-gray-50 stagger-children">
                {queue.map(qf => {
                  const ext = qf.file.name.match(/\.[^.]+$/)?.[0] ?? '.pdf';
                  const isDone = qf.status === 'done';
                  const isErr = qf.status === 'error';
                  const inProgress = !isDone && !isErr && qf.status !== 'queued';

                  return (
                    <div key={qf.id} className="px-5 py-4 animate-fade-up">
                      <div className="flex items-center gap-3">
                        <FileIcon ext={ext} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-900 truncate">{qf.file.name}</span>
                            <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                              {isDone && qf.score !== null && (
                                <span className={`text-sm font-bold tabular-nums animate-score-pop ${qf.score >= 80 ? 'text-green-600' : qf.score >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
                                  {Math.round(qf.score)}
                                  <span className="text-xs font-normal text-gray-400 ml-0.5">Match Score</span>
                                </span>
                              )}
                              {isErr && <span className="text-xs text-red-500">{qf.errorMsg}</span>}
                              <button
                                onClick={() => removeFile(qf.id)}
                                className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-gray-500 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* Status + progress bar */}
                          <div className="flex items-center gap-2">
                            {isDone ? (
                              <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            ) : isErr ? (
                              <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                            ) : inProgress ? (
                              <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                            ) : null}
                            <span className={`text-xs ${isDone ? 'text-green-600 font-medium' : isErr ? 'text-red-500' : 'text-gray-400'}`}>
                              {STATUS_LABELS[qf.status]}
                            </span>

                            {!isDone && !isErr && (
                              <>
                                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 animate-bar ${STATUS_COLORS[qf.status]}`}
                                    style={{ width: `${qf.progress}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-400 tabular-nums w-8 text-right">{qf.progress}%</span>
                              </>
                            )}
                            {isDone && qf.progress === 100 && (
                              <div className="flex-1 h-1.5 bg-green-100 rounded-full overflow-hidden">
                                <div className="h-full w-full bg-green-400 rounded-full" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50/60">
                <div className="text-xs text-gray-400">
                  {doneCount} of {queue.length} processed
                  {allDone && <span className="ml-2 text-green-600 font-medium">· All done!</span>}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate(`/jobs/${jobId}`)}
                    className="text-sm text-gray-600 border border-gray-200 hover:bg-gray-100 px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => navigate(`/jobs/${jobId}`)}
                    className={`text-sm text-white px-5 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      allDone
                        ? 'bg-gray-900 hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                        : 'bg-gray-400 cursor-not-allowed opacity-70'
                    }`}
                    disabled={!allDone}
                  >
                    View Results
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
