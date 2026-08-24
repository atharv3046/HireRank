import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, JobPosting } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import SkillTag from '../components/SkillTag';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

const DashboardPage = () => {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [minExp, setMinExp] = useState<number>(0);
  const [education, setEducation] = useState<string>('none');
  const [status, setStatus] = useState<string>('active');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const data = await api.getJobs();
      setJobs(data);
    } catch (err) {
      console.error('Failed to fetch jobs', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (job?: JobPosting) => {
    if (job) {
      setEditingJob(job);
      setTitle(job.title);
      setDescription(job.description);
      setSkills(job.required_skills || []);
      setMinExp(job.min_experience_years || 0);
      setEducation(job.education_requirement || 'none');
      setStatus(job.status || 'active');
    } else {
      setEditingJob(null);
      setTitle('');
      setDescription('');
      setSkills([]);
      setMinExp(0);
      setEducation('none');
      setStatus('active');
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingJob(null);
  };

  const handleAddSkill = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && skillInput.trim()) {
      e.preventDefault();
      if (!skills.includes(skillInput.trim())) {
        setSkills([...skills, skillInput.trim()]);
      }
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter(s => s !== skillToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        title,
        description,
        required_skills: skills,
        min_experience_years: minExp,
        education_requirement: education === 'none' ? null : education,
        status
      };

      if (editingJob) {
        await api.updateJob(editingJob.id, data);
      } else {
        await api.createJob(data);
      }
      
      handleCloseModal();
      fetchJobs();
    } catch (err) {
      console.error('Failed to save job', err);
      alert('Failed to save job');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteJob = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this job posting?')) {
      try {
        await api.deleteJob(id);
        fetchJobs();
      } catch (err) {
        console.error('Failed to delete job', err);
        alert('Failed to delete job');
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Job Postings</h1>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none"
        >
          <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
          Create New Job
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10">Loading jobs...</div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500 mb-4">You don't have any job postings yet.</p>
          <button
            onClick={() => handleOpenModal()}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
          >
            Create your first job
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <div key={job.id} className="bg-white overflow-hidden shadow rounded-lg border border-gray-200 flex flex-col">
              <div className="p-5 flex-grow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-medium text-gray-900 truncate" title={job.title}>{job.title}</h3>
                  <StatusBadge status={job.status} />
                </div>
                
                <div className="mt-4 mb-4">
                  <p className="text-sm font-medium text-gray-500 mb-1">Required Skills:</p>
                  <div className="flex flex-wrap gap-1">
                    {job.required_skills?.slice(0, 4).map(skill => (
                      <SkillTag key={skill} skill={skill} />
                    ))}
                    {(job.required_skills?.length || 0) > 4 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        +{(job.required_skills?.length || 0) - 4} more
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4 text-sm text-gray-500">
                  <div>
                    <span className="block font-medium text-gray-700">Min Experience:</span>
                    {job.min_experience_years} years
                  </div>
                  <div>
                    <span className="block font-medium text-gray-700">Education:</span>
                    {job.education_requirement ? job.education_requirement.replace('_', ' ') : 'None'}
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 px-5 py-3 border-t border-gray-200 flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  <span className="font-medium text-gray-900">{job.candidate_count || 0}</span> candidates
                </div>
                <div className="flex space-x-2">
                  <Link
                    to={`/jobs/${job.id}`}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none"
                  >
                    View Candidates
                  </Link>
                  <button onClick={() => handleOpenModal(job)} className="p-1.5 text-gray-400 hover:text-gray-500">
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDeleteJob(job.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={handleCloseModal}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    {editingJob ? 'Edit Job Posting' : 'Create New Job Posting'}
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Job Title</label>
                      <input
                        type="text"
                        required
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Description</label>
                      <textarea
                        required
                        rows={3}
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Required Skills</label>
                      <div className="mt-1 flex items-center">
                        <input
                          type="text"
                          value={skillInput}
                          onChange={e => setSkillInput(e.target.value)}
                          onKeyDown={handleAddSkill}
                          placeholder="Type a skill and press Enter"
                          className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {skills.map(skill => (
                          <span key={skill} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                            {skill}
                            <button
                              type="button"
                              onClick={() => handleRemoveSkill(skill)}
                              className="ml-1.5 inline-flex text-primary-500 hover:text-primary-700 focus:outline-none"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Min Experience (Years)</label>
                        <input
                          type="number"
                          min="0"
                          value={minExp}
                          onChange={e => setMinExp(parseInt(e.target.value) || 0)}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Education Requirement</label>
                        <select
                          value={education}
                          onChange={e => setEducation(e.target.value)}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        >
                          <option value="none">None</option>
                          <option value="high_school">High School</option>
                          <option value="associate">Associate Degree</option>
                          <option value="bachelors">Bachelor's Degree</option>
                          <option value="masters">Master's Degree</option>
                          <option value="phd">Ph.D.</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <select
                        value={status}
                        onChange={e => setStatus(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      >
                        <option value="active">Active</option>
                        <option value="draft">Draft</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
