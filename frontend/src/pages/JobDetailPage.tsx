import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, JobPosting, CandidateWithScore } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import ScoreBar from '../components/ScoreBar';
import SkillTag from '../components/SkillTag';
import UploadResumePage from './UploadResumePage';

const JobDetailPage = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<JobPosting | null>(null);
  const [candidates, setCandidates] = useState<CandidateWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [sortBy, setSortBy] = useState('overall_score');
  const [minScore, setMinScore] = useState<number | ''>('');
  const [minExp, setMinExp] = useState<number | ''>('');
  
  // Modals
  const [showUpload, setShowUpload] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateWithScore | null>(null);
  const [reranking, setReranking] = useState(false);

  useEffect(() => {
    if (jobId) {
      fetchJobData();
    }
  }, [jobId, sortBy, minScore, minExp]);

  // Polling for processing candidates
  useEffect(() => {
    let interval: number;
    const hasProcessingCandidates = candidates.some(
      c => ['processing', 'extracting', 'scoring', 'embedded'].includes(c.processing_status)
    );

    if (hasProcessingCandidates) {
      interval = window.setInterval(() => {
        fetchCandidatesOnly();
      }, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [candidates]);

  const fetchJobData = async () => {
    try {
      setLoading(true);
      const [jobData, candidatesData] = await Promise.all([
        api.getJob(jobId!),
        api.getRankedCandidates(
          jobId!,
          sortBy,
          minScore === '' ? undefined : minScore,
          minExp === '' ? undefined : minExp
        )
      ]);
      setJob(jobData);
      setCandidates(candidatesData);
    } catch (err) {
      console.error('Error fetching job details', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCandidatesOnly = async () => {
    try {
      const candidatesData = await api.getRankedCandidates(
        jobId!,
        sortBy,
        minScore === '' ? undefined : minScore,
        minExp === '' ? undefined : minExp
      );
      setCandidates(candidatesData);
    } catch (err) {
      console.error('Error fetching candidates', err);
    }
  };

  const handleRerank = async () => {
    try {
      setReranking(true);
      await api.rerankAll(jobId!);
      await fetchCandidatesOnly();
    } catch (err) {
      console.error('Error reranking', err);
      alert('Error reranking candidates');
    } finally {
      setReranking(false);
    }
  };

  const handleUploadComplete = () => {
    setShowUpload(false);
    fetchCandidatesOnly();
  };

  if (loading && !job) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!job) {
    return <div className="p-8 text-center text-red-500">Job not found</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6 border border-gray-200">
        <div className="px-4 py-5 sm:px-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-2xl leading-6 font-bold text-gray-900">{job.title}</h3>
            <StatusBadge status={job.status} />
          </div>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 truncate">{job.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-sm font-medium text-gray-700 mr-2">Required Skills:</span>
            {job.required_skills?.map(skill => (
              <SkillTag key={skill} skill={skill} />
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white shadow rounded-lg p-4 mb-6 border border-gray-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="block w-full pl-3 pr-10 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
            >
              <option value="overall_score">Overall Score</option>
              <option value="experience">Experience</option>
              <option value="skills">Skills Match</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Min Score (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={minScore}
              onChange={e => setMinScore(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0-100"
              className="block w-24 pl-3 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Min Exp (Yrs)</label>
            <input
              type="number"
              min="0"
              value={minExp}
              onChange={e => setMinExp(e.target.value === '' ? '' : Number(e.target.value))}
              className="block w-24 pl-3 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
            />
          </div>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={handleRerank}
            disabled={reranking}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {reranking ? 'Reranking...' : 'Re-rank All'}
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            Upload Resume
          </button>
        </div>
      </div>

      {/* Candidates Table */}
      <div className="flex flex-col">
        <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
            <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
              {candidates.length === 0 ? (
                <div className="bg-white p-12 text-center">
                  <p className="text-gray-500 mb-4">No candidates found for this job.</p>
                  <button
                    onClick={() => setShowUpload(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                  >
                    Upload the first resume
                  </button>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Skills</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exp.</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {candidates.map((candidate, idx) => (
                      <tr key={candidate.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{idx + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{candidate.name || 'Unknown'}</div>
                          <div className="text-sm text-gray-500">{candidate.email || 'No email'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-sm leading-5 font-bold rounded-full ${
                            candidate.overall_score !== null ? (
                              candidate.overall_score >= 0.8 ? 'bg-green-100 text-green-800' :
                              candidate.overall_score >= 0.5 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            ) : 'bg-gray-100 text-gray-800'
                          }`}>
                            {candidate.overall_score !== null ? `${Math.round(candidate.overall_score * 100)}%` : 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {candidate.skills_score !== null ? `${Math.round(candidate.skills_score * 100)}%` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {candidate.experience_years !== null ? `${candidate.experience_years} yrs` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={candidate.processing_status} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => setSelectedCandidate(candidate)}
                            className="text-primary-600 hover:text-primary-900"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Candidate Detail Modal */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setSelectedCandidate(null)}></div>
          <div className="fixed inset-y-0 right-0 max-w-2xl w-full flex">
            <div className="w-full h-full bg-white shadow-xl flex flex-col overflow-y-scroll">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h2 className="text-xl font-bold text-gray-900">Candidate Details</h2>
                <button onClick={() => setSelectedCandidate(null)} className="text-gray-400 hover:text-gray-500">
                  <span className="sr-only">Close panel</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{selectedCandidate.name || 'Unknown Candidate'}</h1>
                    <div className="mt-1 text-sm text-gray-500 flex flex-col space-y-1">
                      <span>Email: {selectedCandidate.email || 'N/A'}</span>
                      <span>Phone: {selectedCandidate.phone || 'N/A'}</span>
                    </div>
                  </div>
                  <StatusBadge status={selectedCandidate.processing_status} />
                </div>

                {selectedCandidate.processing_status === 'done' || selectedCandidate.processing_status === 'scored' ? (
                  <div className="space-y-8">
                    {/* Scores Section */}
                    <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                      <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">Score Breakdown</h3>
                      <div className="mb-6 text-center">
                        <span className="text-sm font-medium text-gray-500 block mb-1">Overall Match Score</span>
                        <span className={`text-4xl font-bold ${
                          selectedCandidate.overall_score! >= 0.8 ? 'text-green-600' :
                          selectedCandidate.overall_score! >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {Math.round((selectedCandidate.overall_score || 0) * 100)}%
                        </span>
                      </div>
                      
                      <ScoreBar label="Semantic Match" score={selectedCandidate.semantic_score} />
                      <ScoreBar label="Skills Match" score={selectedCandidate.skills_score} />
                      <ScoreBar label="Experience Match" score={selectedCandidate.experience_score} />
                      <ScoreBar label="Education Match" score={selectedCandidate.education_score} />
                    </div>

                    {/* Summary */}
                    {selectedCandidate.summary && (
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">AI Summary</h3>
                        <p className="text-sm text-gray-700 bg-blue-50 p-4 rounded-md border border-blue-100">
                          {selectedCandidate.summary}
                        </p>
                      </div>
                    )}

                    {/* Skills */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900 mb-2">Matched Skills</h3>
                        <div className="flex flex-wrap">
                          {selectedCandidate.matched_skills?.map(skill => (
                            <SkillTag key={skill} skill={skill} variant="matched" />
                          ))}
                          {!selectedCandidate.matched_skills?.length && <span className="text-sm text-gray-500">None found</span>}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-900 mb-2">Missing Skills</h3>
                        <div className="flex flex-wrap">
                          {selectedCandidate.missing_skills?.map(skill => (
                            <SkillTag key={skill} skill={skill} variant="missing" />
                          ))}
                          {!selectedCandidate.missing_skills?.length && <span className="text-sm text-gray-500">None</span>}
                        </div>
                      </div>
                    </div>

                    {/* Extracted Details */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-3 border-b pb-2">Extracted Details</h3>
                      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                        <dl className="divide-y divide-gray-200">
                          <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                            <dt className="text-sm font-medium text-gray-500">Experience</dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                              {selectedCandidate.experience_years} years (Req: {job.min_experience_years})
                            </dd>
                          </div>
                          <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                            <dt className="text-sm font-medium text-gray-500">Education Level</dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                              {selectedCandidate.education_level || 'Not detected'} (Req: {job.education_requirement || 'None'})
                            </dd>
                          </div>
                          <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                            <dt className="text-sm font-medium text-gray-500">Education Details</dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                              {selectedCandidate.education_details || '-'}
                            </dd>
                          </div>
                          <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                            <dt className="text-sm font-medium text-gray-500">Other Skills Found</dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 flex flex-wrap">
                              {selectedCandidate.extracted_skills?.filter(s => !selectedCandidate.matched_skills?.includes(s)).map(skill => (
                                <SkillTag key={skill} skill={skill} variant="default" />
                              ))}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-12 text-center text-gray-500">
                    Resume is still processing. Please check back later.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowUpload(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-xl sm:w-full">
              <UploadResumePage jobId={jobId!} onClose={handleUploadComplete} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobDetailPage;
