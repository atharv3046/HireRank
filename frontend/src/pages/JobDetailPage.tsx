import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { api, JobPosting, CandidateWithScore } from '../api/client';

// ── Animated score bar ───────────────────────────────────────────────────────
const SubBar: React.FC<{ label: string; value: number | null; color: string; delay?: number }> = ({ label, value, color, delay = 0 }) => {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(Math.min(value ?? 0, 100)), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-gray-500">{label}</span>
        <span className="font-semibold text-gray-800">{value !== null ? Math.round(value ?? 0) : '—'}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
};

// ── Score badge for table ────────────────────────────────────────────────────
const ScoreBadge: React.FC<{ score: number | null }> = ({ score }) => {
  if (score === null || score === undefined) return <span className="text-xs text-gray-400">—</span>;
  const s = Math.round(score);
  const cls = s >= 80 ? 'bg-green-100 text-green-700 ring-green-200 glow-green'
            : s >= 60 ? 'bg-yellow-100 text-yellow-700 ring-yellow-200 glow-yellow'
            : 'bg-red-100 text-red-600 ring-red-200';
  return (
    <span className={`inline-flex items-center justify-center w-12 h-8 rounded-lg text-sm font-bold ring-1 ${cls}`}>
      {s}%
    </span>
  );
};

// ── Candidate detail panel ───────────────────────────────────────────────────
const CandidatePanel: React.FC<{ candidate: CandidateWithScore; job: JobPosting; onClose: () => void }> = ({ candidate, job, onClose }) => {
  const initials = candidate.name
    ? candidate.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const overallScore = Math.round(candidate.overall_score ?? 0);
  const scoreColor = overallScore >= 80 ? 'text-green-600' : overallScore >= 60 ? 'text-yellow-600' : 'text-red-500';
  const scoreBg = overallScore >= 80 ? 'bg-green-50 border-green-200' : overallScore >= 60 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';
  const coverage = job.required_skills?.length
    ? Math.round(((candidate.matched_skills?.length || 0) / job.required_skills.length) * 100)
    : 0;

  // Education label map
  const eduLabel: Record<string, string> = {
    high_school: 'High School', associate: 'Associate', bachelors: "Bachelor's Degree",
    masters: "Master's Degree", phd: 'PhD / Doctorate',
  };

  const meetsExp = (candidate.experience_years ?? 0) >= (job.min_experience_years ?? 0);
  const meetsEdu = candidate.education_level !== null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30 backdrop-panel" onClick={onClose} />
      <div className="w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden animate-slide-in">

        {/* ── Header ── */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold shadow-lg flex-shrink-0">
                {initials}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{candidate.name || 'Unknown Candidate'}</h2>
                <div className="text-sm text-gray-400">{candidate.email || '—'}</div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {candidate.experience_years !== null && (
                    <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
                      🕐 {candidate.experience_years} Yrs Exp
                    </span>
                  )}
                  {candidate.education_level && (
                    <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
                      🎓 {candidate.education_level.charAt(0).toUpperCase() + candidate.education_level.slice(1)}
                    </span>
                  )}
                  {candidate.phone && (
                    <span className="text-xs text-gray-400">{candidate.phone}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Score box */}
            <div className="flex items-start gap-2">
              <div className={`border rounded-xl px-4 py-2 text-center animate-score-pop ${scoreBg}`}>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Match Score</div>
                <div className={`text-3xl font-extrabold ${scoreColor} tabular-nums`}>
                  {overallScore}<span className="text-sm font-normal text-gray-400">/100</span>
                </div>
              </div>
              <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors mt-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* AI Summary */}
          {candidate.summary && (
            <div className="px-6 pt-5 animate-fade-up">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs">✦</div>
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">AI Summary</span>
              </div>
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-4">
                <p className="text-sm text-gray-700 leading-relaxed italic">"{candidate.summary}"</p>
              </div>
            </div>
          )}

          {/* Score breakdown + Skills grid */}
          <div className="px-6 pt-5 grid grid-cols-2 gap-4 animate-fade-up" style={{ animationDelay: '60ms' }}>
            {/* Score breakdown */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Score Breakdown</div>
              <div className="space-y-3.5">
                <SubBar label="Semantic Sim. (50%)" value={candidate.semantic_score}  color="bg-indigo-500" delay={100} />
                <SubBar label="Skills Match (25%)"  value={candidate.skills_score}    color="bg-cyan-500"   delay={200} />
                <SubBar label="Experience (15%)"    value={candidate.experience_score} color="bg-teal-500"   delay={300} />
                <SubBar label="Education (10%)"     value={candidate.education_score}  color="bg-sky-400"    delay={400} />
              </div>
            </div>

            {/* Required skills */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Required Skills</div>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{coverage}% Coverage</span>
              </div>

              {(candidate.matched_skills?.length || 0) > 0 && (
                <div className="mb-3">
                  <div className="text-xs text-green-600 font-semibold mb-1.5">Matched</div>
                  <div className="flex flex-wrap gap-1.5">
                    {candidate.matched_skills.map(s => (
                      <span key={s} className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(candidate.missing_skills?.length || 0) > 0 && (
                <div>
                  <div className="text-xs text-red-500 font-semibold mb-1.5">Missing / Legacy</div>
                  <div className="flex flex-wrap gap-1.5">
                    {candidate.missing_skills.slice(0, 6).map(s => (
                      <span key={s} className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-500 border border-red-200 px-2 py-0.5 rounded-full line-through opacity-75">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Candidate vs Requirements table ── */}
          <div className="px-6 pt-5 pb-2 animate-fade-up" style={{ animationDelay: '120ms' }}>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Candidate vs Requirements</div>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide w-1/4">Criteria</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide w-5/12">
                      {candidate.name?.split(' ')[0] || 'Candidate'} (Parsed)
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide w-5/12">Job Req.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {/* Experience row */}
                  <tr className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap">
                      🕐 Experience
                    </td>
                    <td className="px-4 py-3">
                      <div className={`font-semibold ${meetsExp ? 'text-gray-900' : 'text-red-600'}`}>
                        {candidate.experience_years !== null ? `${candidate.experience_years} Years` : '—'}
                        {meetsExp && <span className="ml-1.5 text-green-500">✓</span>}
                        {!meetsExp && candidate.experience_years !== null && <span className="ml-1.5 text-red-400">✗</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {job.min_experience_years}+ years minimum
                    </td>
                  </tr>

                  {/* Education row */}
                  <tr className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-xs font-medium whitespace-nowrap">
                      🎓 Education
                    </td>
                    <td className="px-4 py-3">
                      {candidate.education_level ? (
                        <div className="font-semibold text-gray-900">
                          {eduLabel[candidate.education_level] || candidate.education_level}
                          {meetsEdu && <span className="ml-1.5 text-green-500">✓</span>}
                          {candidate.education_details && (
                            <div className="text-xs text-gray-400 font-normal mt-0.5 truncate">{candidate.education_details}</div>
                          )}
                        </div>
                      ) : <span className="text-gray-400">Not detected</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {job.education_requirement
                        ? (eduLabel[job.education_requirement] || job.education_requirement) + ' or equivalent'
                        : 'Any'}
                    </td>
                  </tr>

                  {/* Core stack row */}
                  <tr className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-xs font-medium whitespace-nowrap">
                      {'<>'} Core Stack
                    </td>
                    <td className="px-4 py-3">
                      {(candidate.matched_skills?.length || 0) > 0 ? (
                        <div>
                          <div className="font-semibold text-gray-900 text-xs">
                            {candidate.matched_skills.slice(0, 4).join(', ')}
                          </div>
                          {(candidate.missing_skills?.length || 0) > 0 && (
                            <div className="text-xs text-red-400 mt-0.5 flex items-center gap-1">
                              ⚠ Missing: {candidate.missing_skills.slice(0, 2).join(', ')}
                            </div>
                          )}
                        </div>
                      ) : <span className="text-gray-400 text-xs">Not extracted</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {job.required_skills?.slice(0, 3).join(', ') || '—'}
                      {(job.required_skills?.length || 0) > 3 && ` +${job.required_skills.length - 3} more`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* All extracted skills */}
          {(candidate.extracted_skills?.length || 0) > 0 && (
            <div className="px-6 pt-4 pb-5 animate-fade-up" style={{ animationDelay: '180ms' }}>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">All Extracted Skills</div>
              <div className="flex flex-wrap gap-1.5">
                {candidate.extracted_skills.map(s => (
                  <span key={s} className={`text-xs border px-2.5 py-1 rounded-full transition-colors ${
                    candidate.matched_skills?.includes(s)
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      : 'bg-white border-gray-200 text-gray-500'
                  }`}>{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer actions ── */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex items-center gap-3">
          <button className="flex-1 flex items-center justify-center gap-2 border border-red-200 text-red-500 hover:bg-red-50 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
            Reject Candidate
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-gray-700 hover:bg-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Message
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-gray-900/20">
            Move to Interview →
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Upload modal ─────────────────────────────────────────────────────────────
const UploadModal: React.FC<{ jobId: string; onClose: () => void; onUploaded: () => void }> = ({ jobId, onClose, onUploaded }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setError(null); setProgress(0);
    try {
      await api.uploadResume(jobId, file, e => setProgress(Math.round((e.loaded * 100) / (e.total || 100))));
      setDone(true);
      setTimeout(() => { onUploaded(); onClose(); }, 1200);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Upload failed');
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Upload Resume</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">
          <label
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors ${
              file ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
            }`}
          >
            <input type="file" accept=".pdf,.docx" className="sr-only" onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
            <svg className="w-10 h-10 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            {file ? (
              <div className="text-center">
                <p className="text-sm font-medium text-indigo-700">{file.name}</p>
                <p className="text-xs text-gray-400 mt-1">Click to change file</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-gray-500">Drop resume here or <span className="text-indigo-600 font-medium">browse</span></p>
                <p className="text-xs text-gray-400 mt-1">PDF or DOCX, up to 10MB</p>
              </div>
            )}
          </label>

          {uploading && (
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-500">{done ? '✅ Uploaded! AI processing in background...' : 'Uploading...'}</span>
                <span className="font-medium text-gray-700">{progress}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 mt-5">
            <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload Resume'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Status pill for processing ───────────────────────────────────────────────
const ProcessingPill: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { label: string; cls: string }> = {
    processing:      { label: 'Processing…', cls: 'bg-blue-50 text-blue-600' },
    extracting:      { label: 'Extracting…', cls: 'bg-purple-50 text-purple-600' },
    extracted_fields:{ label: 'Embedding…',  cls: 'bg-indigo-50 text-indigo-600' },
    scoring:         { label: 'Scoring…',    cls: 'bg-yellow-50 text-yellow-600' },
    needs_ocr:       { label: 'Needs OCR',   cls: 'bg-orange-50 text-orange-600' },
    error:           { label: 'Error',        cls: 'bg-red-50 text-red-600' },
  };
  const info = map[status];
  if (!info) return null;
  return <span className={`text-xs px-2.5 py-1 rounded-full font-medium animate-pulse ${info.cls}`}>{info.label}</span>;
};

// ── Main page ────────────────────────────────────────────────────────────────
export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [job, setJob]               = useState<JobPosting | null>(null);
  const [candidates, setCandidates] = useState<CandidateWithScore[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<CandidateWithScore | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [reranking, setReranking]   = useState(false);
  const [minScore, setMinScore]     = useState<number>(0);
  const [skillFilter, setSkillFilter] = useState('');

  const fetchCandidates = useCallback(async () => {
    if (!jobId) return;
    const data = await api.getRankedCandidates(jobId, 'overall_score');
    setCandidates(data);
    return data;
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    setLoading(true);
    Promise.all([api.getJob(jobId), api.getRankedCandidates(jobId, 'overall_score')])
      .then(([j, c]) => { setJob(j); setCandidates(c); })
      .finally(() => setLoading(false));
  }, [jobId]);

  // Ref-based polling — avoids stale closure, polls every 2.5s until all done
  const candidatesRef = React.useRef<CandidateWithScore[]>([]);
  candidatesRef.current = candidates;
  useEffect(() => {
    if (!jobId) return;
    const id = window.setInterval(async () => {
      const allDone = candidatesRef.current.length > 0 && candidatesRef.current.every(
        c => c.processing_status === 'done' || c.processing_status === 'error' || c.processing_status === 'needs_ocr'
      );
      if (!allDone) {
        await fetchCandidates();
      } else {
        clearInterval(id);
      }
    }, 2500);
    return () => clearInterval(id);
  }, [jobId, fetchCandidates]);

  const handleRerank = async () => {
    if (!jobId) return;
    setReranking(true);
    await api.rerankAll(jobId);
    await fetchCandidates();
    setReranking(false);
  };

  // Always show all candidates; filter score only for scored ones
  const filtered = candidates.filter(c => {
    if (c.overall_score !== null && c.overall_score < minScore) return false;
    if (skillFilter && c.processing_status === 'done' &&
        !c.extracted_skills?.some(s => s.toLowerCase().includes(skillFilter.toLowerCase()))) return false;
    return true;
  });

  if (loading) return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">Loading job data…</p>
        </div>
      </main>
    </div>
  );

  if (!job) return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Job not found.</p>
          <button onClick={() => navigate('/dashboard')} className="mt-4 text-indigo-600 text-sm">← Back to Dashboard</button>
        </div>
      </main>
    </div>
  );

  const doneCount = candidates.filter(c => c.overall_score !== null).length;

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <div className="px-8 py-8">
          {/* Breadcrumb */}
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-6 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Jobs
          </button>

          {/* Job header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="text-xs text-indigo-600 font-semibold uppercase tracking-wide mb-1">ACTIVE JOB POSTING</div>
              <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-sm text-gray-500">{job.min_experience_years}+ years experience</span>
                {job.education_requirement && (
                  <span className="text-sm text-gray-500">· {job.education_requirement}</span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  job.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>{job.status}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRerank}
                disabled={reranking}
                className="flex items-center gap-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <svg className={`w-4 h-4 ${reranking ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {reranking ? 'Reranking…' : 'Re-rank All'}
              </button>
              <button
                onClick={() => navigate(`/jobs/${jobId}/upload`)}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-md shadow-indigo-500/30"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload Resume
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 mb-4 flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Skill Search</label>
              <input
                value={skillFilter}
                onChange={e => setSkillFilter(e.target.value)}
                placeholder="e.g. React, Python, AWS..."
                className="w-full text-sm text-gray-700 focus:outline-none placeholder-gray-300"
              />
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div className="w-48">
              <label className="block text-xs text-gray-400 mb-1">Minimum Match Score</label>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={0} max={100} step={5}
                  value={minScore}
                  onChange={e => setMinScore(+e.target.value)}
                  className="flex-1 accent-indigo-600"
                />
                <span className="text-sm font-bold text-indigo-600 w-10">{minScore}%</span>
              </div>
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div className="text-sm text-gray-400">
              {filtered.length} of {candidates.length} candidates
            </div>
          </div>

          {/* Candidates table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              <div className="col-span-4">Candidate Name</div>
              <div className="col-span-2 text-center">Match Score</div>
              <div className="col-span-4">Key Skills Matched</div>
              <div className="col-span-2 text-right">Experience</div>
            </div>

            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500 mb-1">No candidates yet</p>
                <p className="text-xs text-gray-400">Upload a resume to start screening</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filtered.map((c, idx) => {
                  const initials = c.name
                    ? c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                    : '?';
                  const isDone = c.overall_score !== null;

                  return (
                    <div
                      key={c.id}
                      onClick={() => isDone && setSelected(c)}
                      className={`grid grid-cols-12 gap-4 px-5 py-4 items-center transition-colors ${isDone ? 'cursor-pointer hover:bg-indigo-50/50' : ''}`}
                    >
                      {/* Name + avatar */}
                      <div className="col-span-4 flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          idx === 0 ? 'bg-indigo-100 text-indigo-700'
                          : idx === 1 ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-600'
                        }`}>
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">{c.name || 'Processing…'}</div>
                          {c.education_level && (
                            <div className="text-xs text-gray-400 truncate capitalize">{c.education_level}</div>
                          )}
                        </div>
                      </div>

                      {/* Score */}
                      <div className="col-span-2 flex items-center justify-center">
                        {c.processing_status === 'done' || c.overall_score !== null
                          ? <ScoreBadge score={c.overall_score} />
                          : <ProcessingPill status={c.processing_status} />
                        }
                      </div>

                      {/* Skills */}
                      <div className="col-span-4 flex flex-wrap gap-1.5">
                        {c.matched_skills?.slice(0, 3).map(s => (
                          <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{s}</span>
                        ))}
                        {(c.matched_skills?.length || 0) > 3 && (
                          <span className="text-xs text-gray-400">+{c.matched_skills.length - 3} more</span>
                        )}
                        {(c.missing_skills?.length || 0) > 0 && (
                          <span className="text-xs bg-red-50 text-red-400 line-through px-2 py-0.5 rounded">
                            {c.missing_skills[0]}
                          </span>
                        )}
                      </div>

                      {/* Experience */}
                      <div className="col-span-2 text-right text-sm text-gray-600">
                        {c.experience_years !== null ? `${c.experience_years} Yrs` : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {filtered.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
                Showing {filtered.length} of {candidates.length} candidates · {doneCount} scored
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Candidate detail panel */}
      {selected && (
        <CandidatePanel candidate={selected} job={job} onClose={() => setSelected(null)} />
      )}

      {/* Upload modal */}
      {showUpload && jobId && (
        <UploadModal
          jobId={jobId}
          onClose={() => setShowUpload(false)}
          onUploaded={fetchCandidates}
        />
      )}
    </div>
  );
}
