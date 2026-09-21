import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Sliders,
  Lock,
  Unlock,
  Sparkles,
  Zap,
  ChevronDown,
  ChevronUp,
  Clock,
  Target,
  Users,
  Mail,
  Edit3,
  Eye,
  Send,
  ArrowRight,
  ArrowLeft,
  BarChart2,
  CheckCircle2,
  Code2,
  MessageSquare,
  Briefcase,
  X,
  RotateCcw,
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import {
  tabContentVariants,
  useReducedMotion,
} from '../utils/animations';
import {
  api,
  JobPosting,
  ExtractedBlueprintResponse,
  BlueprintData,
  PassRatePreview,
  AssessmentRead,
  CandidateWithScore,
} from '../api/client';

/* ── Types & Constants ─────────────────────────────────────────────────── */

export interface SkillWeight {
  id: string;
  name: string;
  categoryKey: string;
  weight: number;
  durationMin: number;
  questionCount: number;
  isPinned: boolean;
  color: string;
  description: string;
}

const DEFAULT_WEIGHTS: SkillWeight[] = [
  {
    id: 'dsa',
    name: 'DSA (Algorithms)',
    categoryKey: 'DSA',
    weight: 0,
    durationMin: 0,
    questionCount: 0,
    isPinned: false,
    color: '#3b82f6',
    description: 'Data structures, computational complexity, problem solving',
  },
  {
    id: 'system_design',
    name: 'System Design',
    categoryKey: 'System Design',
    weight: 0,
    durationMin: 0,
    questionCount: 0,
    isPinned: false,
    color: '#06b6d4',
    description: 'Scalability, microservices, caching, database partitioning',
  },
  {
    id: 'mcq',
    name: 'MCQ (Quiz)',
    categoryKey: 'MCQs',
    weight: 35,
    durationMin: 10,
    questionCount: 5,
    isPinned: false,
    color: '#8b5cf6',
    description: 'Quick technical trivia, syntax, framework APIs',
  },
  {
    id: 'code_quality',
    name: 'Code Quality',
    categoryKey: 'Code Quality',
    weight: 30,
    durationMin: 8,
    questionCount: 1,
    isPinned: false,
    color: '#10b981',
    description: 'Refactoring, clean code, naming conventions, modularity',
  },
  {
    id: 'communication',
    name: 'Communication',
    categoryKey: 'Communication',
    weight: 20,
    durationMin: 5,
    questionCount: 1,
    isPinned: false,
    color: '#f59e0b',
    description: 'Explaining trade-offs, architecture decisions, and code walk...',
  },
  {
    id: 'behavioral',
    name: 'Behavioral',
    categoryKey: 'Behavioral',
    weight: 15,
    durationMin: 4,
    questionCount: 1,
    isPinned: false,
    color: '#ec4899',
    description: 'Past work experience with concrete outcomes',
  },
];

const ALL_FOCUS_AREAS = [
  'Testing & QA',
  'Databases',
  'DevOps / CI/CD',
  'Mobile',
  'AI / ML',
  'System Architecture',
  'API Design',
  'Security & Auth',
  'Cloud Infrastructure',
];

const EMAIL_PRESETS: Record<string, string> = {
  Standard: `Hi {{candidate_name}},

You have been invited to complete a technical assessment for the {{role}} position at {{company_name}}.

Please complete your evaluation via this link:
{{assessment_link}}

Best regards,
Hiring Team at {{company_name}}`,

  'Resume Screening': `Hi {{candidate_name}},

Based on your impressive match results in our initial resume screening for the {{role}} position at {{company_name}}, we'd love to invite you to take the next step.

Please complete your technical evaluation on MockExperts via this link:
{{assessment_link}}`,

  'Formal / Corporate': `Dear {{candidate_name}},

We are pleased to invite you to the technical assessment phase for the {{role}} position with {{company_name}}.

Kindly access your evaluation session at your earliest convenience:
{{assessment_link}}

Sincerely,
Talent Acquisition Team`,

  'Casual / Startup': `Hey {{candidate_name}}!

Loved your profile for our {{role}} opening at {{company_name}}. We've got a quick, hands-on technical challenge set up for you here:
{{assessment_link}}

Looking forward to seeing what you build!`,

  Custom: `Hi {{candidate_name}},

Welcome to the technical evaluation for {{role}} at {{company_name}}.

Assessment Link:
{{assessment_link}}`,
};

export default function AssessmentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const shouldReduce = useReducedMotion();

  // Wizard state: 1 = Basics & JD, 2 = Tune & Blueprint, 3 = Confirm & Launch, 4 = Past Assessments
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [maxStepReached, setMaxStepReached] = useState<number>(1);

  // Batches for import dropdown
  const [batches, setBatches] = useState<JobPosting[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [importedBatchTitle, setImportedBatchTitle] = useState<string | null>(null);
  const [importAnimationKey, setImportAnimationKey] = useState<number>(0);

  // Step 1 input
  const [jobDescription, setJobDescription] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Step 1: Live preview state
  const [livePreview, setLivePreview] = useState<{
    detectedTitle: string;
    skills: string[];
    fullResponse: ExtractedBlueprintResponse;
  } | null>(null);
  const [isLiveAnalyzing, setIsLiveAnalyzing] = useState<boolean>(false);
  const [liveAnalyzeError, setLiveAnalyzeError] = useState<string | null>(null);
  const extractionVersionRef = useRef<number>(0);

  // Step 2 inputs & blueprint state
  const [roleTitle, setRoleTitle] = useState<string>('Backend Engineer');
  const [minExperience, setMinExperience] = useState<number>(3);
  const [educationReq, setEducationReq] = useState<string>('bachelors');
  const [skills, setSkills] = useState<string[]>([
    'Python',
    'Django',
    'Flask',
    'FastAPI',
    'PostgreSQL',
  ]);
  const [newSkillInput, setNewSkillInput] = useState<string>('');
  const [blueprint, setBlueprint] = useState<BlueprintData | null>(null);
  const [passPreview, setPassPreview] = useState<PassRatePreview | null>(null);
  const [isRecalculatingPass, setIsRecalculatingPass] = useState<boolean>(false);

  // Tune & Blueprint features
  const [focusAreas, setFocusAreas] = useState<string[]>([
    'Testing & QA',
    'Databases',
    'DevOps / CI/CD',
  ]);
  const [skillWeights, setSkillWeights] = useState<SkillWeight[]>(DEFAULT_WEIGHTS);
  const [hiringProfile, setHiringProfile] = useState<string>('Product Startup');
  const [passBar, setPassBar] = useState<number>(72);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('mcq');

  // Step 3 state
  const [isLaunching, setIsLaunching] = useState<boolean>(false);
  const [launchSuccessModal, setLaunchSuccessModal] = useState<AssessmentRead | null>(null);

  // Past assessments list
  const [pastAssessments, setPastAssessments] = useState<AssessmentRead[]>([]);
  const [isLoadingPast, setIsLoadingPast] = useState<boolean>(false);

  // Invite Candidates modal state (Image 5)
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [inviteModalStep, setInviteModalStep] = useState<1 | 2>(2); // Default to Step 2 as in screenshot!
  const [invitePreset, setInvitePreset] = useState<string>('Resume Screening');
  const [isBodyEditing, setIsBodyEditing] = useState<boolean>(true);
  const [emailBody, setEmailBody] = useState<string>(EMAIL_PRESETS['Resume Screening']);
  const [candidatePool, setCandidatePool] = useState<CandidateWithScore[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<number>>(new Set());
  const [isSendingInvites, setIsSendingInvites] = useState<boolean>(false);
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState<string | null>(null);

  // Load importable screening batches, past assessments, and candidates on mount
  useEffect(() => {
    loadBatches();
    loadPastAssessments();
    loadCandidatePool();
  }, []);

  const loadBatches = async () => {
    try {
      const data = await api.getJobs();
      setBatches(data || []);
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

  const loadCandidatePool = async (jobId?: number) => {
    try {
      const data = await api.getCandidates(jobId ? { job_id: jobId } : undefined);
      setCandidatePool(data || []);
      if (data && data.length > 0) {
        setSelectedCandidateIds(new Set(data.slice(0, 10).map((c) => c.id)));
      }
    } catch (err) {
      console.error('Failed to load candidates for invite', err);
    }
  };

  // Handle batch selection change in Step 1
  const handleBatchSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) {
      handleClearImport();
      return;
    }
    const batchId = parseInt(val, 10);
    const chosen = batches.find((b) => b.id === batchId);
    if (chosen) {
      setSelectedBatchId(batchId);
      setImportedBatchTitle(chosen.title);
      setImportAnimationKey((prev) => prev + 1);
      setJobDescription(chosen.description || '');
      setRoleTitle(chosen.title);
      if (chosen.required_skills && chosen.required_skills.length > 0) {
        setSkills(chosen.required_skills);
      }
      loadCandidatePool(batchId);
    }
  };

  const handleClearImport = () => {
    setSelectedBatchId(null);
    setImportedBatchTitle(null);
    setJobDescription('');
  };

  // Debounced live blueprint analyzer for Step 1
  useEffect(() => {
    const trimmed = jobDescription.trim();
    if (!trimmed || trimmed.length < 20) {
      setLivePreview(null);
      setIsLiveAnalyzing(false);
      setLiveAnalyzeError(null);
      return;
    }

    extractionVersionRef.current += 1;
    const currentVersion = extractionVersionRef.current;
    setIsLiveAnalyzing(true);
    setLiveAnalyzeError(null);

    const timer = setTimeout(async () => {
      try {
        const res = await api.extractBlueprint({
          job_description: trimmed,
          batch_id: selectedBatchId || undefined,
        });

        if (currentVersion === extractionVersionRef.current) {
          setLivePreview({
            detectedTitle: res.detected_title,
            skills: res.required_skills,
            fullResponse: res,
          });
          setIsLiveAnalyzing(false);
        }
      } catch (err: any) {
        if (currentVersion === extractionVersionRef.current) {
          setLiveAnalyzeError('Preview unavailable');
          setIsLiveAnalyzing(false);
        }
      }
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, [jobDescription, selectedBatchId]);

  // Step 1 -> Step 2: Extract details & build blueprint
  const handleExtractBlueprint = async () => {
    const trimmedJD = jobDescription.trim();
    if (!trimmedJD || trimmedJD.length < 20) {
      setExtractError('Please enter a job description of at least 20 characters.');
      return;
    }
    setExtractError(null);
    setIsExtracting(true);
    try {
      let res: ExtractedBlueprintResponse;
      if (
        livePreview?.fullResponse &&
        livePreview.fullResponse.detected_title &&
        livePreview.fullResponse.blueprint
      ) {
        res = livePreview.fullResponse;
      } else {
        res = await api.extractBlueprint({
          job_description: trimmedJD,
          batch_id: selectedBatchId || undefined,
        });
      }

      setRoleTitle(res.detected_title || 'Backend Engineer');
      setMinExperience(res.min_experience_years || 3);
      setEducationReq(res.education_requirement || 'bachelors');
      if (res.required_skills && res.required_skills.length > 0) {
        setSkills(res.required_skills);
      }
      setBlueprint(res.blueprint);
      setPassPreview(res.pass_preview);

      setMaxStepReached((prev) => Math.max(prev, 2));
      setStep(2);
    } catch (err: any) {
      setExtractError(err?.response?.data?.detail || 'Failed to extract blueprint. Please try again.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Recalculate pass preview
  const recalculatePass = async (currentSkills: string[], exp: number) => {
    setIsRecalculatingPass(true);
    try {
      const res = await api.simulatePassRate({
        required_skills: currentSkills,
        min_experience_years: exp,
        batch_id: selectedBatchId || undefined,
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

  // Focus Area Tag Toggle
  const handleToggleFocusArea = (area: string) => {
    setFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  // Weight Slider Rebalancing Math
  const handleWeightChange = (id: string, newWeight: number) => {
    setSkillWeights((prev) => {
      const targetIdx = prev.findIndex((w) => w.id === id);
      if (targetIdx === -1) return prev;

      const currentTarget = prev[targetIdx];
      const clampedNew = Math.max(0, Math.min(100, Math.round(newWeight)));
      const diff = clampedNew - currentTarget.weight;
      if (diff === 0) return prev;

      const otherUnpinned = prev.filter((w) => w.id !== id && !w.isPinned);
      if (otherUnpinned.length === 0) {
        return prev;
      }

      const otherSum = otherUnpinned.reduce((s, w) => s + w.weight, 0);

      const updated = prev.map((w) => {
        if (w.id === id) {
          const qCount =
            clampedNew === 0
              ? 0
              : w.id === 'mcq'
              ? Math.max(1, Math.round(clampedNew / 7))
              : Math.max(1, Math.round(clampedNew / 25));
          const dur = clampedNew === 0 ? 0 : Math.max(2, Math.round(clampedNew * 0.28));
          return {
            ...w,
            weight: clampedNew,
            questionCount: qCount,
            durationMin: dur,
          };
        }
        if (w.isPinned) return w;

        let adjusted = w.weight;
        if (otherSum > 0) {
          adjusted = w.weight - diff * (w.weight / otherSum);
        } else {
          adjusted = -diff / otherUnpinned.length;
        }
        const finalWeight = Math.max(0, Math.min(100, Math.round(adjusted)));
        const qCount =
          finalWeight === 0
            ? 0
            : w.id === 'mcq'
            ? Math.max(1, Math.round(finalWeight / 7))
            : Math.max(1, Math.round(finalWeight / 25));
        const dur = finalWeight === 0 ? 0 : Math.max(2, Math.round(finalWeight * 0.28));

        return {
          ...w,
          weight: finalWeight,
          questionCount: qCount,
          durationMin: dur,
        };
      });

      // Keep total strictly 100
      const total = updated.reduce((s, w) => s + w.weight, 0);
      const drift = 100 - total;
      if (drift !== 0) {
        const eligible = updated.find(
          (w) => w.id !== id && !w.isPinned && w.weight + drift >= 0
        );
        if (eligible) {
          eligible.weight += drift;
        }
      }

      return updated;
    });
  };

  const handleTogglePin = (id: string) => {
    setSkillWeights((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isPinned: !w.isPinned } : w))
    );
  };

  // Derived calculations for Live Blueprint
  const activeCategories = useMemo(
    () => skillWeights.filter((w) => w.weight > 0),
    [skillWeights]
  );

  const totalQuestions = useMemo(
    () => activeCategories.reduce((s, w) => s + w.questionCount, 0) || 8,
    [activeCategories]
  );

  const totalDuration = useMemo(
    () => activeCategories.reduce((s, w) => s + w.durationMin, 0) || 27,
    [activeCategories]
  );

  const totalWeight = useMemo(
    () => skillWeights.reduce((s, w) => s + w.weight, 0),
    [skillWeights]
  );

  // Step 3: Launch Assessment Pipeline & Open Invite Modal
  const handleLaunchAssessment = async () => {
    setIsLaunching(true);
    try {
      const generatedBlueprint: BlueprintData = {
        estimated_duration_minutes: totalDuration,
        difficulty_level: `${minExperience}-${minExperience + 2} Yrs (${hiringProfile})`,
        categories: activeCategories.map((c) => ({
          category: c.name,
          count: c.questionCount,
          percentage: c.weight,
          topics: [c.description],
        })),
      };

      const created = await api.createAssessment({
        title: `${roleTitle || 'Python Backend Developer'} Assessment`,
        job_description: jobDescription || 'Technical evaluation calibrated for candidate screening.',
        required_skills: skills,
        min_experience_years: minExperience,
        education_requirement: educationReq,
        blueprint: generatedBlueprint as any,
      });

      setLaunchSuccessModal(created);
      // Automatically open the Invite Candidates modal as shown in Screenshot 5!
      setShowInviteModal(true);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to launch assessment pipeline.');
    } finally {
      setIsLaunching(false);
    }
  };

  // Outreach preset selection
  const handleSelectPreset = (name: string) => {
    setInvitePreset(name);
    if (EMAIL_PRESETS[name]) {
      setEmailBody(EMAIL_PRESETS[name]);
    }
  };

  // Dynamic preview text interpolation
  const previewEmailText = useMemo(() => {
    const cName = 'Alex Morgan';
    const role = roleTitle || 'Backend Engineer';
    const company = user?.company_name || 'HireRank';
    const link = 'https://hirerank.app/eval/asm-8812';

    return emailBody
      .replace(/\{\{candidate_name\}\}/g, cName)
      .replace(/\{\{role\}\}/g, role)
      .replace(/\{\{company_name\}\}/g, company)
      .replace(/\{\{assessment_link\}\}/g, link);
  }, [emailBody, roleTitle, user]);

  // Bulk invite dispatch
  const handleSendInvitations = async () => {
    setIsSendingInvites(true);
    setInviteSuccessMsg(null);
    try {
      const candidateIds = Array.from(selectedCandidateIds);
      if (candidateIds.length > 0) {
        const res = await api.bulkInviteCandidates(candidateIds, emailBody);
        setInviteSuccessMsg(res.message || `Successfully invited ${candidateIds.length} candidate(s)!`);
      } else {
        setInviteSuccessMsg('Assessment invite link configured & ready to dispatch!');
      }
      setTimeout(() => {
        setShowInviteModal(false);
        setInviteSuccessMsg(null);
        loadPastAssessments();
        setStep(4);
      }, 1500);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to dispatch invitations.');
    } finally {
      setIsSendingInvites(false);
    }
  };

  /* ── Reusable Live Blueprint Component (Image 1, 2, 4) ────────────────── */
  const renderLiveBlueprintCard = () => (
    <div className="bg-[#0f111a] border border-white/[0.08] rounded-2xl p-6 shadow-2xl flex flex-col justify-between">
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h3 className="text-base font-bold text-white">Live Blueprint</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs font-semibold text-white/80">
              {totalQuestions} Questions
            </span>
            <span className="px-2.5 py-0.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs font-semibold text-white/80 font-mono">
              ~{totalDuration}m
            </span>
          </div>
        </div>

        <p className="text-xs text-white/40 mb-4">
          {minExperience}–{minExperience + 2} years • {hiringProfile}
        </p>

        {/* Multi-Segment Color Progress Bar */}
        <div className="w-full h-2 rounded-full overflow-hidden flex bg-white/5 mb-3">
          {activeCategories.map((cat) => (
            <div
              key={cat.id}
              className="h-full transition-all duration-300"
              style={{
                width: `${(cat.weight / (totalWeight || 100)) * 100}%`,
                backgroundColor: cat.color,
              }}
              title={`${cat.name}: ${cat.weight}%`}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-white/60 mb-5">
          {activeCategories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <span>
                {cat.name} ({cat.weight}%)
              </span>
            </div>
          ))}
        </div>

        {/* Category Accordion Cards */}
        <div className="space-y-2 mb-6">
          {activeCategories.map((cat) => {
            const isExpanded = expandedCategory === cat.id;
            return (
              <div
                key={cat.id}
                className="rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/10 transition-colors overflow-hidden"
              >
                <div
                  onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
                  className="p-3.5 flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: `${cat.color}15`,
                        border: `1px solid ${cat.color}30`,
                        color: cat.color,
                      }}
                    >
                      {cat.id === 'mcq' && <BarChart2 className="w-3.5 h-3.5" />}
                      {cat.id === 'code_quality' && <Check className="w-3.5 h-3.5" />}
                      {cat.id === 'communication' && <Sparkles className="w-3.5 h-3.5" />}
                      {cat.id === 'behavioral' && <Briefcase className="w-3.5 h-3.5" />}
                      {cat.id === 'dsa' && <Code2 className="w-3.5 h-3.5" />}
                      {cat.id === 'system_design' && <Target className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">
                          {cat.name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-white/[0.05] text-[10px] font-medium text-white/70">
                          {cat.questionCount} Q{cat.questionCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/40 mt-0.5 truncate max-w-[220px]">
                        {cat.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="text-right">
                      <div className="text-xs font-bold text-white font-mono">
                        {cat.weight}%
                      </div>
                      <div className="text-[10px] text-white/40 font-mono">
                        ~{cat.durationMin}m
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-white/40 transition-transform ${
                        isExpanded ? 'transform rotate-180 text-white' : ''
                      }`}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-3.5 pb-3.5 pt-1 border-t border-white/[0.04] text-[11px] text-white/50 space-y-1">
                    <div>
                      Focus: <span className="text-white/80">{cat.description}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-white/30 pt-1">
                      <span>Evaluated dynamically by AI model</span>
                      <span className="font-mono">Time budget: {cat.durationMin} mins</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Card Footer */}
      <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between">
        <span className="text-xs text-white/50">
          Candidate Time: <strong className="text-white">~{totalDuration} mins</strong>
        </span>
        <div
          onClick={() => setPassBar((prev) => (prev >= 80 ? 65 : prev + 5))}
          className="px-3 py-1 rounded-lg bg-white/[0.04] border border-white/10 hover:border-cyan-500/40 text-xs font-bold text-cyan-400 cursor-pointer transition-colors"
          title="Click to toggle target pass bar"
        >
          Pass Bar: {passBar}%
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0a0a0f' }}>
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Top Header Bar (Matching Image 2 & 4) */}
        <header className="h-16 flex items-center justify-between px-8 border-b border-white/[0.06] bg-[#0d0d14]/80 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-white/70">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              {user?.company_name || 'mits'}
            </div>
            {step === 4 ? (
              <button
                onClick={() => setStep(1)}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium ml-2 flex items-center gap-1"
              >
                ← Back to Assessment Planner
              </button>
            ) : (
              <button
                onClick={() => {
                  loadPastAssessments();
                  setStep(4);
                }}
                className="text-xs text-white/50 hover:text-white/80 font-medium ml-2 flex items-center gap-1.5 transition-colors"
              >
                <Clock className="w-3.5 h-3.5" />
                View Launched Assessments ({pastAssessments.length || '•'})
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-semibold text-white">
                {(user as any)?.name || user?.email?.split('@')[0] || 'Atharv Ji'}
              </div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">
                {user?.role || 'Admin'}
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-green-500/20">
              {((user as any)?.name || user?.email || 'A').charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Wizard Container */}
        <main className="flex-1 px-6 lg:px-12 py-8 max-w-7xl w-full mx-auto">
          {step !== 4 && (
            <>
              {/* Title Section (Matching Image 2 & 4) */}
              <motion.div
                initial={shouldReduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="text-center mb-8"
              >
                <h1 className="text-3xl font-extrabold text-white tracking-tight">
                  AI-Powered Assessment Planner
                </h1>
                <p className="text-sm text-white/45 mt-1.5">
                  Define your job description and preview your exact question breakdown in real time.
                </p>
              </motion.div>

              {/* Stepper Navigation Bar (Matching Image 1, 2, 4) */}
              <div className="flex items-center justify-center max-w-2xl mx-auto mb-10">
                {/* Step 1 */}
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={step === 1}
                    className={`relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all focus:outline-none ${
                      step > 1
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                        : step === 1
                        ? 'bg-[#6366f1] text-white shadow-lg shadow-indigo-500/40 ring-4 ring-indigo-500/20'
                        : 'bg-white/5 text-white/30 border border-white/10'
                    }`}
                  >
                    {step > 1 ? <Check className="w-4 h-4 text-white" strokeWidth={3} /> : '1'}
                  </button>
                  <span
                    className={`text-xs mt-2 font-medium ${
                      step === 1 ? 'text-white' : 'text-white/40'
                    }`}
                  >
                    Basics & Job Description
                  </span>
                </div>

                {/* Connector 1 */}
                <div className="flex-1 h-[3px] mx-4 -mt-5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      step >= 2 ? 'bg-emerald-500' : 'bg-white/10'
                    }`}
                  />
                </div>

                {/* Step 2 */}
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (maxStepReached >= 2) setStep(2);
                    }}
                    disabled={maxStepReached < 2 || step === 2}
                    className={`relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all focus:outline-none ${
                      step > 2
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                        : step === 2
                        ? 'bg-[#6366f1] text-white shadow-lg shadow-indigo-500/40 ring-4 ring-indigo-500/20'
                        : 'bg-white/[0.06] border border-white/10 text-white/40'
                    }`}
                  >
                    {step > 2 ? <Check className="w-4 h-4 text-white" strokeWidth={3} /> : '2'}
                  </button>
                  <span
                    className={`text-xs mt-2 font-medium ${
                      step === 2 ? 'text-white' : 'text-white/40'
                    }`}
                  >
                    Tune & Blueprint
                  </span>
                </div>

                {/* Connector 2 */}
                <div className="flex-1 h-[3px] mx-4 -mt-5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      step >= 3 ? 'bg-emerald-500' : 'bg-white/10'
                    }`}
                  />
                </div>

                {/* Step 3 */}
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (maxStepReached >= 3) setStep(3);
                    }}
                    disabled={maxStepReached < 3 || step === 3}
                    className={`relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all focus:outline-none ${
                      step === 3
                        ? 'bg-[#6366f1] text-white shadow-lg shadow-indigo-500/40 ring-4 ring-indigo-500/20'
                        : 'bg-white/[0.06] border border-white/10 text-white/40'
                    }`}
                  >
                    3
                  </button>
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
                initial={shouldReduce ? false : 'hidden'}
                animate="visible"
                exit="exit"
                variants={tabContentVariants}
                className="space-y-6 max-w-4xl mx-auto"
              >
                <div className="bg-[#0f111a] border border-white/[0.08] rounded-2xl p-7 shadow-2xl">
                  {/* Step Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0 text-purple-400">
                        <Code2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white">Define Target Role & Job Description</h2>
                        <p className="text-xs text-white/50 mt-0.5">
                          Paste the Job Description to extract requirements and auto-calibrate your live blueprint.
                        </p>
                      </div>
                    </div>

                    {batches.length > 0 && (
                      <div className="w-64">
                        <select
                          value={selectedBatchId || ''}
                          onChange={handleBatchSelect}
                          className="w-full bg-[#141422] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 focus:border-indigo-500 focus:outline-none cursor-pointer"
                        >
                          <option value="">Import from screening batch...</option>
                          {batches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.title} ({b.candidate_count || 0} candidates)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Textarea */}
                  <div className="space-y-2 mb-6">
                    <div className="flex justify-between items-center text-xs">
                      <label className="font-semibold text-white/70">Job Description</label>
                      <span className="text-[11px] text-white/40">
                        {jobDescription.length} characters
                      </span>
                    </div>
                    <textarea
                      rows={9}
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      placeholder="Paste your full job description here (e.g. Senior Backend Engineer with Python, Django, PostgreSQL, and AWS)..."
                      className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl p-4 text-sm text-white placeholder-white/30 focus:border-indigo-500 focus:outline-none transition-colors leading-relaxed resize-y font-mono text-xs"
                    />
                    {extractError && (
                      <p className="text-xs text-red-400 mt-1">{extractError}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                    <span className="text-xs text-white/40">
                      Step 1 of 3: AI extracts role requirements, seniority bar, and question mix.
                    </span>

                    <button
                      onClick={handleExtractBlueprint}
                      disabled={isExtracting || jobDescription.trim().length < 20}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isExtracting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Analyzing JD...
                        </>
                      ) : (
                        <>
                          Extract Details & Build Blueprint
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* STEP 2: Tune & Blueprint (Matching Image 2 & 4)            */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {step === 2 && (
              <motion.div
                key="step-2"
                initial={shouldReduce ? false : 'hidden'}
                animate="visible"
                exit="exit"
                variants={tabContentVariants}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6"
              >
                {/* Left Column: Tune Your Assessment Blueprint (7 cols) */}
                <div className="lg:col-span-7 bg-[#0f111a] border border-white/[0.08] rounded-2xl p-7 shadow-2xl flex flex-col justify-between">
                  <div>
                    {/* Header */}
                    <div className="flex items-start gap-4 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0 text-purple-400">
                        <Sliders className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white">
                          Tune Your Assessment Blueprint
                        </h2>
                        <p className="text-xs text-white/45 mt-0.5">
                          Adjust duration, focus areas, and seniority. Watch your live question breakdown update in real time.
                        </p>
                      </div>
                    </div>

                    {/* Focus Area Tags (Matching Image 2 & 4) */}
                    <div className="mb-6">
                      <div className="flex flex-wrap gap-2">
                        {ALL_FOCUS_AREAS.map((area) => {
                          const isActive = focusAreas.includes(area);
                          return (
                            <button
                              key={area}
                              type="button"
                              onClick={() => handleToggleFocusArea(area)}
                              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                isActive
                                  ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-sm shadow-purple-500/20'
                                  : 'bg-white/[0.03] text-white/50 border border-white/[0.08] hover:bg-white/[0.07] hover:text-white/80'
                              }`}
                            >
                              {isActive && <Check className="w-3 h-3 text-purple-300 stroke-[2.5]" />}
                              {area}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Skill Score Weights (%) Section */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Sliders className="w-4 h-4 text-white/60" />
                          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                            Skill Score Weights (%)
                          </h3>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-bold">
                            Total: {totalWeight}%
                          </span>
                          <span className="text-[11px] text-white/40 italic">
                            Click 🔒 to pin a weight
                          </span>
                        </div>
                      </div>

                      {/* Slider Rows (Matching Image 2 & 4) */}
                      <div className="space-y-3.5">
                        {skillWeights.map((sw) => (
                          <div
                            key={sw.id}
                            className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition-colors flex items-center gap-3.5"
                          >
                            {/* Lock Toggle Button */}
                            <button
                              type="button"
                              onClick={() => handleTogglePin(sw.id)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                sw.isPinned
                                  ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                                  : 'text-white/30 hover:text-white/70'
                              }`}
                              title={sw.isPinned ? 'Unpin weight' : 'Pin weight'}
                            >
                              {sw.isPinned ? (
                                <Lock className="w-3.5 h-3.5" />
                              ) : (
                                <Unlock className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* Label */}
                            <span className="w-36 text-xs font-medium text-white/90 truncate flex-shrink-0">
                              {sw.name}
                            </span>

                            {/* Range Slider */}
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={sw.weight}
                              onChange={(e) =>
                                handleWeightChange(sw.id, parseInt(e.target.value, 10))
                              }
                              className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#6366f1]"
                            />

                            {/* Question / Duration badge */}
                            <span className="w-24 text-right text-[11px] text-white/40 font-mono flex-shrink-0">
                              {sw.weight === 0
                                ? '0 Qs'
                                : `~${sw.durationMin}m (${sw.questionCount} Q${
                                    sw.questionCount !== 1 ? 's' : ''
                                  })`}
                            </span>

                            {/* Percentage Number */}
                            <span className="w-12 text-right text-xs font-bold text-cyan-400 font-mono flex-shrink-0">
                              {sw.weight}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Actions */}
                  <div className="flex items-center justify-between pt-5 border-t border-white/[0.06] mt-4">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-4 py-2 text-xs font-semibold text-white/50 hover:text-white transition-colors"
                    >
                      &lt; Back
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMaxStepReached((prev) => Math.max(prev, 3));
                        setStep(3);
                      }}
                      className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-indigo-500/25 transition-all"
                    >
                      Continue to Final Review...
                    </button>
                  </div>
                </div>

                {/* Right Column: Live Blueprint Card (5 cols) */}
                <div className="lg:col-span-5">{renderLiveBlueprintCard()}</div>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* STEP 3: Confirm & Launch (Matching Image 1 & 3)             */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {step === 3 && (
              <motion.div
                key="step-3"
                initial={shouldReduce ? false : 'hidden'}
                animate="visible"
                exit="exit"
                variants={tabContentVariants}
                className="space-y-6"
              >
                {/* Hero Header (Matching Image 1) */}
                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-3">
                    <Zap className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    Ready to Generate Questions
                  </h2>
                  <p className="text-xs text-white/50 mt-1 max-w-lg mx-auto">
                    Review your finalized blueprint parameters. Clicking generate will construct your AI question bank.
                  </p>
                </div>

                {/* 2-Column Grid (Matching Image 1 & 3) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: 2x3 Grid + Calibration Check (7 cols) */}
                  <div className="lg:col-span-7 space-y-4">
                    {/* 2x3 Summary Parameter Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* 1. Assessment Title */}
                      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                        <span className="text-[11px] font-medium text-white/40 block mb-1">
                          Assessment Title
                        </span>
                        <span className="text-sm font-bold text-white truncate block">
                          {roleTitle || 'Python Backend Developer'} Assess...
                        </span>
                      </div>

                      {/* 2. Target Role */}
                      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                        <span className="text-[11px] font-medium text-white/40 block mb-1">
                          Target Role
                        </span>
                        <span className="text-sm font-bold text-white truncate block">
                          {roleTitle || 'Backend Engineer'}
                        </span>
                      </div>

                      {/* 3. Primary Tech Stack */}
                      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                        <span className="text-[11px] font-medium text-white/40 block mb-1">
                          Primary Tech Stack
                        </span>
                        <span className="text-sm font-bold text-white truncate block">
                          {skills.length > 0
                            ? skills.slice(0, 5).join(', ') + '...'
                            : 'Python, Django, Flask, FastAPI, Pos...'}
                        </span>
                      </div>

                      {/* 4. Seniority Bar */}
                      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                        <span className="text-[11px] font-medium text-white/40 block mb-1">
                          Seniority Bar
                        </span>
                        <span className="text-sm font-bold text-white block">
                          {minExperience}–{minExperience + 2} years
                        </span>
                      </div>

                      {/* 5. Screen Duration */}
                      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                        <span className="text-[11px] font-medium text-white/40 block mb-1">
                          Screen Duration
                        </span>
                        <span className="text-sm font-bold text-white block">
                          30 Mins
                        </span>
                      </div>

                      {/* 6. Hiring Profile */}
                      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                        <span className="text-[11px] font-medium text-white/40 block mb-1">
                          Hiring Profile
                        </span>
                        <span className="text-sm font-bold text-white block">
                          {hiringProfile}
                        </span>
                      </div>
                    </div>

                    {/* Launch Checks & Calibration Card */}
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                      <h4 className="text-xs font-bold text-indigo-400 mb-2.5">
                        Launch Checks & Calibration
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-white/80">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>AI model calibrated to senior bar: {minExperience}–{minExperience + 2} years</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/80">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>Evaluates {activeCategories.length} primary competency tracks</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/80">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>Target passing bar is set to: {passBar}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Live Blueprint (5 cols) */}
                  <div className="lg:col-span-5">{renderLiveBlueprintCard()}</div>
                </div>

                {/* Bottom Action Bar (Matching Image 3) */}
                <div className="flex items-center justify-between pt-6 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-4 py-2 text-xs font-semibold text-white/50 hover:text-white transition-colors"
                  >
                    &lt; Back
                  </button>

                  <div className="flex items-center gap-3">
                    {isLaunching ? (
                      <button
                        disabled
                        className="flex items-center gap-2.5 px-7 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600/60 shadow-lg cursor-not-allowed"
                      >
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Creating Assessment...
                      </button>
                    ) : (
                      <button
                        onClick={handleLaunchAssessment}
                        className="flex items-center gap-2 px-7 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-indigo-500/25 transition-all"
                      >
                        Generate Questions & Launch
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
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
                initial={shouldReduce ? false : 'hidden'}
                animate="visible"
                exit="exit"
                variants={tabContentVariants}
                className="space-y-6 max-w-6xl mx-auto"
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
                      <Clock className="w-6 h-6" />
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
                            onClick={() => {
                              setRoleTitle(a.title);
                              setShowInviteModal(true);
                            }}
                            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1.5"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            Invite Candidates &rarr;
                          </button>
                          <button
                            onClick={() => navigate('/candidate-pipeline')}
                            className="text-[11px] text-white/40 hover:text-white/70"
                          >
                            View Pipeline
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

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* INVITE CANDIDATES MODAL (Matching Image 5)                         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-2xl bg-[#0b0c14] border border-indigo-500/30 rounded-2xl p-6 shadow-2xl relative text-left">
            {/* Modal Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Invite Candidates</h3>
                  <p className="text-xs text-white/40">
                    {inviteModalStep === 1
                      ? 'Step 1: Select candidate recipients'
                      : 'Step 2: Customize Outreach Email template'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowInviteModal(false)}
                className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stepper Navigation inside Modal */}
            <div className="flex items-center gap-2.5 p-1.5 bg-white/[0.02] border border-white/[0.06] rounded-xl mb-5 text-xs">
              <button
                type="button"
                onClick={() => setInviteModalStep(1)}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg font-medium transition-all ${
                  inviteModalStep === 1
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">
                  1
                </span>
                1. Select Recipients ({selectedCandidateIds.size})
              </button>

              <span className="text-white/20">&gt;</span>

              <button
                type="button"
                onClick={() => setInviteModalStep(2)}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg font-medium transition-all ${
                  inviteModalStep === 2
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">
                  2
                </span>
                2. Customize Email Template
              </button>
            </div>

            {/* Step 1 Content: Candidate Selection */}
            {inviteModalStep === 1 && (
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>Available candidates ({candidatePool.length})</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedCandidateIds.size === candidatePool.length) {
                        setSelectedCandidateIds(new Set());
                      } else {
                        setSelectedCandidateIds(new Set(candidatePool.map((c) => c.id)));
                      }
                    }}
                    className="text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    {selectedCandidateIds.size === candidatePool.length
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {candidatePool.length === 0 ? (
                    <div className="p-6 text-center text-xs text-white/40 border border-white/5 rounded-xl">
                      No candidates found. You can still customize the template or share the direct link.
                    </div>
                  ) : (
                    candidatePool.map((c) => {
                      const isSelected = selectedCandidateIds.has(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedCandidateIds((prev) => {
                              const copy = new Set(prev);
                              if (copy.has(c.id)) copy.delete(c.id);
                              else copy.add(c.id);
                              return copy;
                            });
                          }}
                          className={`p-3 rounded-xl border transition-colors cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-indigo-600/10 border-indigo-500/40'
                              : 'bg-white/[0.02] border-white/[0.05] hover:border-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded accent-indigo-500"
                            />
                            <div>
                              <div className="text-xs font-semibold text-white">
                                {c.name || `Candidate #${c.id}`}
                              </div>
                              <div className="text-[11px] text-white/40">
                                {c.email || 'c****@***.com'} • {c.experience_years || 3}y exp
                              </div>
                            </div>
                          </div>

                          {c.overall_score != null && (
                            <span className="text-xs font-bold font-mono text-cyan-400">
                              {c.overall_score}% match
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setInviteModalStep(2)}
                    className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
                  >
                    Next: Customize Email Template &gt;
                  </button>
                </div>
              </div>
            )}

            {/* Step 2 Content: Customize Email Template (Matching Image 5) */}
            {inviteModalStep === 2 && (
              <div className="space-y-4 mb-6">
                {/* TEMPLATE PRESETS */}
                <div>
                  <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">
                    TEMPLATE PRESETS
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {['Standard', 'Resume Screening', 'Formal / Corporate', 'Casual / Startup', 'Custom'].map(
                      (preset) => {
                        const isSelected = invitePreset === preset;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleSelectPreset(preset)}
                            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-center truncate ${
                              isSelected
                                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500 shadow-sm shadow-indigo-500/20 font-bold'
                                : 'bg-white/[0.02] text-white/50 border-white/[0.08] hover:bg-white/[0.05] hover:text-white/80'
                            }`}
                          >
                            {preset}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* EMAIL OUTREACH BODY */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider">
                      EMAIL OUTREACH BODY
                    </label>

                    {/* Edit / Preview Pill Buttons (Matching Image 5) */}
                    <div className="flex items-center gap-1 bg-white/[0.04] border border-white/10 rounded-lg p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setIsBodyEditing(true)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
                          isBodyEditing
                            ? 'bg-indigo-600 text-white font-semibold'
                            : 'text-white/50 hover:text-white'
                        }`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsBodyEditing(false)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
                          !isBodyEditing
                            ? 'bg-indigo-600 text-white font-semibold'
                            : 'text-white/50 hover:text-white'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Preview
                      </button>
                    </div>
                  </div>

                  {/* Body Box */}
                  {isBodyEditing ? (
                    <textarea
                      rows={8}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="w-full bg-[#07080e] border border-white/10 rounded-xl p-4 text-xs font-mono text-white/90 focus:border-indigo-500 focus:outline-none leading-relaxed resize-none selection:bg-indigo-500/30"
                    />
                  ) : (
                    <div className="w-full bg-[#07080e] border border-white/10 rounded-xl p-4 text-xs font-mono text-white/90 leading-relaxed whitespace-pre-line min-h-[170px]">
                      {previewEmailText}
                    </div>
                  )}
                </div>

                {/* Success Feedback */}
                {inviteSuccessMsg && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center text-xs text-emerald-300 font-semibold flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    {inviteSuccessMsg}
                  </div>
                )}

                {/* Full-width Send Invitation Button (Matching Image 5) */}
                <button
                  type="button"
                  onClick={handleSendInvitations}
                  disabled={isSendingInvites}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSendingInvites ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending Invitations...
                    </>
                  ) : (
                    <>
                      Send Invitation
                      <Send className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
