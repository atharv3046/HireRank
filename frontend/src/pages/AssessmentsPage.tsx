import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import {
  tabContentVariants,
  useReducedMotion,
} from '../utils/animations';
import {
  api,
  ScreeningBatchOption,
  ExtractedBlueprintResponse,
  BlueprintData,
  PassRatePreview,
  AssessmentRead
} from '../api/client';

export default function AssessmentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const shouldReduce = useReducedMotion();

  // Wizard state: 1 = Basics & JD, 2 = Tune & Blueprint, 3 = Confirm & Launch, 4 = Past Assessments
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Batches for import dropdown
  const [batches, setBatches] = useState<ScreeningBatchOption[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);

  // Step 1 input
  const [jobDescription, setJobDescription] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Step 2 inputs & blueprint state
  const [roleTitle, setRoleTitle] = useState<string>('');
  const [minExperience, setMinExperience] = useState<number>(3);
  const [educationReq, setEducationReq] = useState<string>('bachelors');
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkillInput, setNewSkillInput] = useState<string>('');
  const [blueprint, setBlueprint] = useState<BlueprintData | null>(null);
  const [passPreview, setPassPreview] = useState<PassRatePreview | null>(null);
  const [isRecalculatingPass, setIsRecalculatingPass] = useState<boolean>(false);

  // Step 3 state
  const [isLaunching, setIsLaunching] = useState<boolean>(false);
  const [showComingSoonModal, setShowComingSoonModal] = useState<boolean>(false);
  const [launchSuccessModal, setLaunchSuccessModal] = useState<AssessmentRead | null>(null);

  // Past assessments list
  const [pastAssessments, setPastAssessments] = useState<AssessmentRead[]>([]);
  const [isLoadingPast, setIsLoadingPast] = useState<boolean>(false);

  // Load importable screening batches on mount
  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    try {
      const data = await api.getImportableBatches();
      setBatches(data);
      if (data.length > 0 && !selectedBatchId) {
        // Pre-select first batch if available
        setSelectedBatchId(data[0].id);
        setJobDescription(data[0].description);
      }
    } catch (err) {
      console.error('Failed to load screening batches', err);
    }
  };

  const loadPastAssessments = async () => {
    setIsLoadingPast(true);
    try {
      const data = await api.getAssessments();
      setPastAssessments(data);
    } catch (err) {
      console.error('Failed to load past assessments', err);
    } finally {
      setIsLoadingPast(false);
    }
  };

  // Handle batch selection change in Step 1
  const handleBatchSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) {
      setSelectedBatchId(null);
      return;
    }
    const id = parseInt(val, 10);
    setSelectedBatchId(id);
    const found = batches.find((b) => b.id === id);
    if (found) {
      setJobDescription(found.description);
    }
  };

  // Step 1 -> Step 2: Extract details & build blueprint
  const handleExtractBlueprint = async () => {
    if (!jobDescription.trim() || jobDescription.trim().length < 20) {
      setExtractError('Please enter a job description of at least 20 characters.');
      return;
    }
    setExtractError(null);
    setIsExtracting(true);
    try {
      const res: ExtractedBlueprintResponse = await api.extractBlueprint({
        job_description: jobDescription,
        batch_id: selectedBatchId || undefined
      });

      setRoleTitle(res.detected_title);
      setMinExperience(res.min_experience_years);
      setEducationReq(res.education_requirement || 'bachelors');
      setSkills(res.required_skills);
      setBlueprint(res.blueprint);
      setPassPreview(res.pass_preview);

      setStep(2);
    } catch (err: any) {
      setExtractError(err?.response?.data?.detail || 'Failed to extract blueprint. Please try again.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Recalculate pass preview whenever skills or experience change in Step 2
  const recalculatePass = async (currentSkills: string[], exp: number) => {
    setIsRecalculatingPass(true);
    try {
      const res = await api.simulatePassRate({
        required_skills: currentSkills,
        min_experience_years: exp,
        batch_id: selectedBatchId || undefined
      });
      setPassPreview(res);
    } catch (err) {
      console.error('Pass rate simulation failed', err);
    } finally {
      setIsRecalculatingPass(false);
    }
  };

  const handleAddSkill = () => {
    const trimmed = newSkillInput.trim();
    if (trimmed && !skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      const updated = [...skills, trimmed];
      setSkills(updated);
      setNewSkillInput('');
      recalculatePass(updated, minExperience);
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    const updated = skills.filter((s) => s !== skillToRemove);
    setSkills(updated);
    recalculatePass(updated, minExperience);
  };

  const handleExperienceChange = (newExp: number) => {
    setMinExperience(newExp);
    recalculatePass(skills, newExp);
  };

  // Step 3: Launch Assessment Pipeline
  const handleLaunchAssessment = async () => {
    if (!blueprint) return;
    setIsLaunching(true);
    try {
      const created = await api.createAssessment({
        title: roleTitle || 'Technical Assessment',
        job_description: jobDescription,
        required_skills: skills,
        min_experience_years: minExperience,
        education_requirement: educationReq,
        blueprint: blueprint as any
      });
      setLaunchSuccessModal(created);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to launch assessment pipeline.');
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0a0a0f' }}>
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Top Header Bar */}
        <header className="h-16 flex items-center justify-between px-8 border-b border-white/[0.06] bg-[#0d0d14]/80 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-white/70">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              {user?.company_name || user?.email?.split('@')[1] || 'Recruiter Workspace'}
            </div>
            {step === 4 ? (
              <button
                onClick={() => setStep(1)}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium ml-2 flex items-center gap-1"
              >
                ← Back to Planner Wizard
              </button>
            ) : (
              <button
                onClick={() => {
                  loadPastAssessments();
                  setStep(4);
                }}
                className="text-xs text-white/50 hover:text-white/80 font-medium ml-2 flex items-center gap-1.5 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                View Launched Assessments ({pastAssessments.length || '•'})
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-semibold text-white">
                {user?.email?.split('@')[0] || 'Recruiter'}
              </div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">
                {user?.role || 'Admin'}
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-green-500/20">
              {user?.email?.charAt(0).toUpperCase() || 'A'}
            </div>
          </div>
        </header>

        {/* Wizard Container */}
        <main className="flex-1 px-8 py-10 max-w-5xl w-full mx-auto">
          {step !== 4 && (
            <>
              {/* Title Section */}
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  AI-Powered Assessment Planner
                </h1>
                <p className="text-sm text-white/50 mt-1.5">
                  Define your job description and preview your exact question breakdown in real time.
                </p>
              </div>

              {/* Step Navigation Bar */}
              <div className="flex items-center justify-center max-w-xl mx-auto mb-10">
                {/* Step 1 */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      step === 1
                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-400/40'
                        : step > 1
                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40'
                        : 'bg-white/5 text-white/30 border border-white/10'
                    }`}
                  >
                    {step > 1 ? (
                      <svg className="w-4 h-4 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      '1'
                    )}
                  </div>
                  <span
                    className={`text-xs mt-2 font-medium ${
                      step === 1 ? 'text-white' : 'text-white/40'
                    }`}
                  >
                    Basics & Job Description
                  </span>
                </div>

                {/* Connector 1 */}
                <div
                  className={`flex-1 h-[2px] mx-4 -mt-5 transition-colors ${
                    step > 1 ? 'bg-indigo-500/50' : 'bg-white/10'
                  }`}
                />

                {/* Step 2 */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      step === 2
                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-400/40'
                        : step > 2
                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40'
                        : 'bg-white/5 text-white/30 border border-white/10'
                    }`}
                  >
                    {step > 2 ? (
                      <svg className="w-4 h-4 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      '2'
                    )}
                  </div>
                  <span
                    className={`text-xs mt-2 font-medium ${
                      step === 2 ? 'text-white' : 'text-white/40'
                    }`}
                  >
                    Tune & Blueprint
                  </span>
                </div>

                {/* Connector 2 */}
                <div
                  className={`flex-1 h-[2px] mx-4 -mt-5 transition-colors ${
                    step > 2 ? 'bg-indigo-500/50' : 'bg-white/10'
                  }`}
                />

                {/* Step 3 */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      step === 3
                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-400/40'
                        : 'bg-white/5 text-white/30 border border-white/10'
                    }`}
                  >
                    3
                  </div>
                  <span
                    className={`text-xs mt-2 font-medium ${
                      step === 3 ? 'text-white' : 'text-white/40'
                    }`}
                  >
                    Confirm & Launch
                  </span>
                </div>
              </div>
            </>
          )}

          <AnimatePresence mode="wait">
          {/* ═══════════════════════════════════════════════════════════ */}
          {/* STEP 1: Basics & Job Description                          */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={shouldReduce ? false : "hidden"}
              animate="visible"
              exit="exit"
              variants={tabContentVariants}
              className="bg-[#0f111a] border border-white/[0.08] rounded-2xl p-7 shadow-2xl"
            >
              {/* Card Header */}
              <div className="flex items-start gap-4 mb-6">
                <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 text-indigo-400">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Define Your Assessment</h2>
                  <p className="text-xs text-white/50 mt-0.5">
                    Paste the Job Description to extract requirements and auto-calibrate your live blueprint.
                  </p>
                </div>
              </div>

              {/* Import from Screening Batch Dropdown */}
              <div className="mb-6 p-4 rounded-xl bg-indigo-500/[0.04] border border-indigo-500/20">
                <label className="flex items-center gap-2 text-xs font-medium text-indigo-300 mb-2">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Import Job Description from Resume Screening
                </label>
                <div className="relative">
                  <select
                    value={selectedBatchId || ''}
                    onChange={handleBatchSelect}
                    className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none appearance-none cursor-pointer transition-colors"
                  >
                    <option value="">Select a previous candidate screening batch to import...</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title} ({b.candidate_count} candidate{b.candidate_count === 1 ? '' : 's'})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-white/40">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Job Description Textarea */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-white/80">Job Description</label>
                  <span className="text-[11px] text-white/35 italic">
                    Paste LinkedIn or Job Board description to auto-generate custom rubric and blueprint
                  </span>
                </div>
                <textarea
                  rows={11}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="e.g. We are seeking a Senior Backend Engineer with 5+ years of experience in Python, FastAPI, distributed systems, and PostgreSQL..."
                  className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl p-4 text-sm text-white/90 placeholder-white/20 focus:border-indigo-500 focus:outline-none transition-colors leading-relaxed font-sans resize-y"
                />
                <div className="flex justify-between items-center text-[11px] text-white/30 mt-1">
                  <span>Minimum 20 characters required</span>
                  <span>{jobDescription.length} characters</span>
                </div>
              </div>

              {extractError && (
                <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {extractError}
                </div>
              )}

              {/* Bottom Actions Bar */}
              <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                <button
                  disabled
                  className="px-5 py-2.5 rounded-xl text-xs font-medium text-white/20 border border-white/5 cursor-not-allowed"
                >
                  &lt; Back
                </button>

                <button
                  onClick={handleExtractBlueprint}
                  disabled={isExtracting || jobDescription.trim().length < 20}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25 transition-all"
                >
                  {isExtracting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyzing & Calibrating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                      Extract Details & Build Blueprint
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* STEP 2: Tune & Blueprint                                  */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <motion.div
              key="step-2"
              initial={shouldReduce ? false : "hidden"}
              animate="visible"
              exit="exit"
              variants={tabContentVariants}
              className="space-y-6"
            >
              <div className="bg-[#0f111a] border border-white/[0.08] rounded-2xl p-7 shadow-2xl">
                {/* Header */}
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 text-indigo-400">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Tune & Calibrate Blueprint</h2>
                    <p className="text-xs text-white/50 mt-0.5">
                      Fine-tune extracted parameters. The live candidate pass preview updates in real time.
                    </p>
                  </div>
                </div>

                {/* Form Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* Role Title */}
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-white/70 block mb-1.5">
                      Assessment Role Title
                    </label>
                    <input
                      type="text"
                      value={roleTitle}
                      onChange={(e) => setRoleTitle(e.target.value)}
                      className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none transition-colors"
                      placeholder="e.g. Senior Python Engineer"
                    />
                  </div>

                  {/* Min Experience */}
                  <div>
                    <label className="text-xs font-semibold text-white/70 block mb-1.5">
                      Min Experience (Years)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      step={0.5}
                      value={minExperience}
                      onChange={(e) => handleExperienceChange(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none transition-colors font-mono"
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="text-xs font-semibold text-white/70 block mb-1.5">
                    Education Requirement
                  </label>
                  <select
                    value={educationReq}
                    onChange={(e) => setEducationReq(e.target.value)}
                    className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none transition-colors cursor-pointer capitalize"
                  >
                    <option value="bachelors">Bachelor's Degree or equivalent</option>
                    <option value="masters">Master's Degree (M.S. / M.Tech / MBA)</option>
                    <option value="phd">Doctorate / Ph.D.</option>
                    <option value="associate">Associate Degree</option>
                    <option value="high_school">High School Diploma</option>
                  </select>
                </div>

                {/* Extracted Skills Tag Input */}
                <div className="mb-6">
                  <label className="text-xs font-semibold text-white/70 block mb-1.5">
                    Extracted Skills & Competencies ({skills.length})
                  </label>
                  <div className="p-3 bg-[#0a0a0f] border border-white/10 rounded-xl min-h-[60px] flex flex-wrap gap-2 items-center">
                    {skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-medium"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(skill)}
                          className="hover:text-red-400 text-indigo-300/60 font-bold ml-0.5 transition-colors"
                        >
                          ✕
                        </button>
                      </span>
                    ))}

                    {/* Add Skill Input */}
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={newSkillInput}
                        onChange={(e) => setNewSkillInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSkill();
                          }
                        }}
                        placeholder="+ Add skill..."
                        className="bg-transparent text-xs text-white placeholder-white/30 border-none outline-none px-2 py-1 w-28 focus:w-40 transition-all"
                      />
                      {newSkillInput.trim() && (
                        <button
                          type="button"
                          onClick={handleAddSkill}
                          className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-semibold"
                        >
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-white/30 mt-1">
                    Press Enter to add tags. Removing or adding skills updates the live candidate pass rate preview below.
                  </p>
                </div>

                {/* Live Candidate Pass Preview Widget */}
                {passPreview && (
                  <div className="mb-6 p-5 rounded-xl bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-blue-950/40 border border-indigo-500/30 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                          Live Candidate Match Preview
                        </span>
                      </div>
                      {isRecalculatingPass && (
                        <span className="text-[10px] text-white/40 font-mono">Recalculating...</span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-3 my-2">
                      <span className="text-2xl font-extrabold text-white">
                        {passPreview.passed_count} of {passPreview.total_evaluated}
                      </span>
                      <span className="text-sm font-semibold text-emerald-400">
                        ({passPreview.pass_rate_pct}% pass rate)
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden mb-2">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, passPreview.pass_rate_pct)}%` }}
                      ></div>
                    </div>

                    <p className="text-xs text-white/50">
                      {passPreview.summary} Candidates passing match threshold ({'>='}60% score or {'>='}50% skill match with {minExperience}y exp).
                    </p>
                  </div>
                )}

                {/* Question Blueprint Breakdown */}
                {blueprint && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-white/70">
                        Generated Question Blueprint
                      </h3>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60">
                          ⏱ {blueprint.estimated_duration_minutes} Mins
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                          🎯 {blueprint.difficulty_level}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {blueprint.categories.map((cat, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/10 transition-colors"
                        >
                          <div className="flex items-center justify-between text-xs mb-2">
                            <span className="font-semibold text-white/90">{cat.category}</span>
                            <span className="font-mono text-indigo-400 font-bold">
                              {cat.percentage}% ({cat.count} Qs)
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden mb-2.5">
                            <div
                              className="h-full bg-indigo-500/60 rounded-full"
                              style={{ width: `${cat.percentage}%` }}
                            ></div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {cat.topics.map((top, tIdx) => (
                              <span
                                key={tIdx}
                                className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] text-white/50"
                              >
                                {top}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bottom Actions Bar */}
                <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                  <button
                    onClick={() => setStep(1)}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white/60 hover:text-white border border-white/10 hover:bg-white/[0.04] transition-all"
                  >
                    &lt; Back to Basics
                  </button>

                  <button
                    onClick={() => setStep(3)}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-indigo-500/25 transition-all"
                  >
                    Continue to Confirm & Launch &gt;
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* STEP 3: Confirm & Launch                                  */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <motion.div
              key="step-3"
              initial={shouldReduce ? false : "hidden"}
              animate="visible"
              exit="exit"
              variants={tabContentVariants}
              className="bg-[#0f111a] border border-white/[0.08] rounded-2xl p-7 shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-start gap-4 mb-6">
                <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 text-indigo-400">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Confirm & Launch Assessment</h2>
                  <p className="text-xs text-white/50 mt-0.5">
                    Review your calibrated assessment blueprint before publishing and deploying candidate invites.
                  </p>
                </div>
              </div>

              {/* Summary Card */}
              <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-6 space-y-5">
                <div className="flex items-start justify-between pb-4 border-b border-white/[0.06]">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                      Assessment Target
                    </span>
                    <h3 className="text-xl font-bold text-white mt-0.5">{roleTitle}</h3>
                    <div className="flex items-center gap-4 text-xs text-white/60 mt-2">
                      <span>Experience: <strong className="text-white">{minExperience}+ Years</strong></span>
                      <span>Education: <strong className="text-white capitalize">{educationReq}</strong></span>
                      <span>Format: <strong className="text-white">Online Adaptive Rubric</strong></span>
                    </div>
                  </div>
                  {passPreview && (
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-white/40">
                        Projected Pass Rate
                      </span>
                      <div className="text-2xl font-extrabold text-emerald-400">
                        {passPreview.pass_rate_pct}%
                      </div>
                      <div className="text-[11px] text-white/40">
                        {passPreview.passed_count} / {passPreview.total_evaluated} candidates match
                      </div>
                    </div>
                  )}
                </div>

                {/* Skills */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 block mb-2">
                    Verified Competencies
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((s) => (
                      <span
                        key={s}
                        className="px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Blueprint breakdown */}
                {blueprint && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 block mb-2">
                      Question Blueprint (Total {blueprint.categories.reduce((acc, c) => acc + c.count, 0)} Questions • {blueprint.estimated_duration_minutes} Mins)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {blueprint.categories.map((cat, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                          <div className="text-[11px] text-white/70 font-semibold truncate">{cat.category}</div>
                          <div className="text-xs font-mono font-bold text-indigo-400 mt-1">
                            {cat.percentage}% ({cat.count} Qs)
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons as per spec */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/[0.06]">
                <button
                  onClick={() => setStep(2)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold text-white/60 hover:text-white border border-white/10 hover:bg-white/[0.04] transition-all"
                >
                  &lt; Back to Blueprint
                </button>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {/* Stubbed button as per spec */}
                  <button
                    onClick={() => setShowComingSoonModal(true)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    Generate questions - Coming soon
                  </button>

                  {/* Launch button */}
                  <button
                    onClick={handleLaunchAssessment}
                    disabled={isLaunching}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50"
                  >
                    {isLaunching ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Launching Pipeline...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Launch Assessment Pipeline
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* STEP 4: Past Assessments View                             */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {step === 4 && (
            <motion.div
              key="step-4"
              initial={shouldReduce ? false : "hidden"}
              animate="visible"
              exit="exit"
              variants={tabContentVariants}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Launched Assessments</h2>
                  <p className="text-xs text-white/50 mt-0.5">
                    Manage active assessment blueprints and candidate evaluation rubrics.
                  </p>
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 shadow-md shadow-indigo-500/20"
                >
                  + Create New Assessment
                </button>
              </div>

              {isLoadingPast ? (
                <div className="p-12 text-center text-white/40">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  Loading assessments...
                </div>
              ) : pastAssessments.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-[#0f111a] border border-white/[0.08]">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-white/30 mx-auto mb-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-white">No assessments launched yet</h3>
                  <p className="text-xs text-white/40 mt-1 max-w-sm mx-auto">
                    Use the 3-step AI Assessment Planner to define a job description and launch an assessment.
                  </p>
                  <button
                    onClick={() => setStep(1)}
                    className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
                  >
                    Open Planner Wizard
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pastAssessments.map((a) => (
                    <div
                      key={a.id}
                      className="p-5 rounded-2xl bg-[#0f111a] border border-white/[0.08] hover:border-indigo-500/30 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-base font-bold text-white">{a.title}</h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {a.status}
                          </span>
                        </div>
                        <div className="text-xs text-white/40 mb-3 flex items-center gap-3">
                          <span>Created: {a.created_at}</span>
                          <span>•</span>
                          <span>{a.min_experience_years}+ Yrs Exp</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-4">
                          {a.required_skills.slice(0, 5).map((s) => (
                            <span
                              key={s}
                              className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300"
                            >
                              {s}
                            </span>
                          ))}
                          {a.required_skills.length > 5 && (
                            <span className="text-[10px] px-1.5 py-0.5 text-white/40">
                              +{a.required_skills.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-white/[0.05] flex items-center justify-between">
                        <button
                          onClick={() => navigate('/candidate-pipeline')}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                        >
                          View Candidate Pipeline &rarr;
                        </button>
                        <button
                          onClick={() => setShowComingSoonModal(true)}
                          className="text-[11px] text-white/40 hover:text-white/70"
                        >
                          Questions
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
          </AnimatePresence>
        </main>
      </div>

      {/* ── COMING SOON MODAL (For "Generate questions - Coming soon") ── */}
      {showComingSoonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0f111a] border border-white/10 rounded-2xl p-6 shadow-2xl relative">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              AI Question Generator — Coming Soon in v2.0
            </h3>
            <p className="text-xs text-white/60 leading-relaxed mb-4">
              HireRank's generative code test and technical interview question engine is currently undergoing private beta testing.
              Your blueprint categories, skill rubrics, and time budgets are fully active and calibrated for candidate screening.
            </p>
            <div className="p-3 rounded-xl bg-purple-500/[0.06] border border-purple-500/20 text-xs text-purple-300 mb-5">
              💡 You can proceed to launch your assessment pipeline now, and your candidates will be screened against this custom blueprint.
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowComingSoonModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/15 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LAUNCH SUCCESS MODAL ── */}
      {launchSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#0f111a] border border-indigo-500/30 rounded-2xl p-6 shadow-2xl relative text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-1">
              Assessment Pipeline Launched!
            </h3>
            <p className="text-xs text-white/50 mb-5">
              "{launchSuccessModal.title}" is now live. Candidate evaluations and pass calibration are active.
            </p>

            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-left text-xs space-y-1.5 mb-6">
              <div className="flex justify-between">
                <span className="text-white/40">Assessment ID:</span>
                <span className="text-white font-mono">#ASM-{launchSuccessModal.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Role:</span>
                <span className="text-white font-semibold">{launchSuccessModal.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Target Skills:</span>
                <span className="text-indigo-400 font-medium">{launchSuccessModal.required_skills.length} skills</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Status:</span>
                <span className="text-emerald-400 font-bold capitalize">{launchSuccessModal.status}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setLaunchSuccessModal(null);
                  loadPastAssessments();
                  setStep(4);
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white/70 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                View Assessments
              </button>
              <button
                onClick={() => navigate('/candidate-pipeline')}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 shadow-lg shadow-indigo-500/25 transition-all"
              >
                Go to Pipeline &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
