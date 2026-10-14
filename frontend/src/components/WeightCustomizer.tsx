/**
 * WeightCustomizer Component
 * ========================================================
 * Feature 5: Weight Customizer (Recruiter moment: "This role is different from my last one")
 * 
 * Enables recruiters to tune 5 scoring factors:
 *   1. Semantic Match (domain & contextual fit)
 *   2. Skills Match (required/preferred skills)
 *   3. Experience Match (years of tenure)
 *   4. Title Match (seniority & role alignment)
 *   5. Education Match (degree requirement)
 * 
 * UX:
 *   - Shows live recalculation of candidate tiers as sliders drag:
 *     "{X} candidates would now qualify as Strong Match (+Y newly promoted)"
 *   - 1-click recruiter presets (Balanced, Junior Growth, Staff/Senior Depth, Tech Specialist).
 *   - Calls PATCH /jobs/{jobId}/weights to save weights & rerank candidates.
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { api, CandidateWithScore } from '../api/client';

export interface FactorWeights {
  semantic: number;
  skills: number;
  experience: number;
  title: number;
  education: number;
}

interface WeightCustomizerProps {
  jobId: number | string;
  initialWeights?: Record<string, number> | null;
  candidates: CandidateWithScore[];
  onWeightsSaved: (newWeights: FactorWeights, tierImpact: any) => void;
  onClose?: () => void;
}

const DEFAULT_WEIGHTS: FactorWeights = {
  semantic: 35,
  skills: 30,
  experience: 20,
  title: 10,
  education: 5,
};

const PRESETS: Array<{
  name: string;
  tag: string;
  description: string;
  weights: FactorWeights;
}> = [
  {
    name: 'Balanced Default',
    tag: 'Standard',
    description: 'Equally balances holistic contextual fit, technical skills, and verified experience.',
    weights: { semantic: 35, skills: 30, experience: 20, title: 10, education: 5 },
  },
  {
    name: 'Junior / High-Potential',
    tag: 'Growth Focus',
    description: 'Prioritizes raw learning agility and contextual alignment over years of tenure.',
    weights: { semantic: 45, skills: 30, experience: 10, title: 5, education: 10 },
  },
  {
    name: 'Senior / Staff Depth',
    tag: 'Leadership & Tenure',
    description: 'Emphasizes proven tenure, title seniority, and years leading systems.',
    weights: { semantic: 15, skills: 20, experience: 45, title: 15, education: 5 },
  },
  {
    name: 'Tech Stack Specialist',
    tag: 'Skill Mastery',
    description: 'Focuses heavily on exact must-have libraries, tools, and technical competencies.',
    weights: { semantic: 20, skills: 55, experience: 15, title: 5, education: 5 },
  },
];

export const WeightCustomizer: React.FC<WeightCustomizerProps> = ({
  jobId,
  initialWeights,
  candidates,
  onWeightsSaved,
  onClose,
}) => {
  // Normalize initial weights to sum ~100
  const init = useMemo<FactorWeights>(() => {
    if (!initialWeights) return DEFAULT_WEIGHTS;
    const sem = initialWeights.semantic ?? 0.35;
    const ski = initialWeights.skills ?? 0.30;
    const exp = initialWeights.experience ?? 0.20;
    const tit = initialWeights.title ?? 0.10;
    const edu = initialWeights.education ?? 0.05;

    // If decimals (0.35), convert to percentage (35)
    const factor = sem <= 1 && ski <= 1 && exp <= 1 ? 100 : 1;
    return {
      semantic: Math.round(sem * factor),
      skills: Math.round(ski * factor),
      experience: Math.round(exp * factor),
      title: Math.round(tit * factor),
      education: Math.round(edu * factor),
    };
  }, [initialWeights]);

  const [weights, setWeights] = useState<FactorWeights>(init);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totalPoints = weights.semantic + weights.skills + weights.experience + weights.title + weights.education;

  // Normalized percentages (summing to 100%)
  const normalizedPercentages = useMemo(() => {
    const sum = totalPoints > 0 ? totalPoints : 100;
    return {
      semantic: Math.round((weights.semantic / sum) * 100),
      skills: Math.round((weights.skills / sum) * 100),
      experience: Math.round((weights.experience / sum) * 100),
      title: Math.round((weights.title / sum) * 100),
      education: Math.round((weights.education / sum) * 100),
    };
  }, [weights, totalPoints]);

  // Client-side live simulation of candidate scores and tier impacts
  const simulation = useMemo(() => {
    const sum = totalPoints > 0 ? totalPoints : 100;
    const wSem = weights.semantic / sum;
    const wSki = weights.skills / sum;
    const wExp = weights.experience / sum;
    const wTit = weights.title / sum;
    const wEdu = weights.education / sum;

    let initialStrongCount = 0;
    let initialPotentialCount = 0;
    let initialLowCount = 0;

    let simStrongCount = 0;
    let simPotentialCount = 0;
    let simLowCount = 0;

    let promotedToStrong = 0;
    let demotedFromStrong = 0;

    candidates.forEach((c) => {
      // Current tier count
      const currentTier = c.tier || (c.needs_manual_review ? 'Needs Review' : (c.overall_score && c.overall_score >= 75 ? 'Strong' : c.overall_score && c.overall_score >= 55 ? 'Potential' : 'Low'));
      if (currentTier === 'Strong') initialStrongCount++;
      else if (currentTier === 'Potential') initialPotentialCount++;
      else if (currentTier === 'Low') initialLowCount++;

      if (c.needs_manual_review) {
        return; // Stays Needs Review
      }

      const sSem = c.semantic_score ?? (c.overall_score ?? 50);
      const sSki = c.skills_score ?? (c.overall_score ?? 50);
      const sExp = c.experience_score ?? (c.overall_score ?? 50);
      const sTit = c.title_score ?? 0;
      const sEdu = c.education_score ?? (c.overall_score ?? 50);

      let raw = (wSem * sSem) + (wSki * sSki) + (wExp * sExp) + (wTit * sTit) + (wEdu * sEdu);

      // Must-have skills capping logic (mirrors HybridScorer)
      if (c.missing_skills && c.missing_skills.length > 0 && raw >= 60.0) {
        raw = 59.9;
      }

      const simScore = Math.round(raw * 10) / 10;
      let simTier = 'Low';
      if (simScore >= 75.0) {
        simTier = 'Strong';
        simStrongCount++;
      } else if (simScore >= 55.0) {
        simTier = 'Potential';
        simPotentialCount++;
      } else {
        simTier = 'Low';
        simLowCount++;
      }

      if (currentTier !== 'Strong' && simTier === 'Strong') {
        promotedToStrong++;
      } else if (currentTier === 'Strong' && simTier !== 'Strong') {
        demotedFromStrong++;
      }
    });

    const netStrongDiff = simStrongCount - initialStrongCount;

    // Recruiter-oriented sentence generator
    let recruiterHeadline = '';
    if (candidates.length === 0) {
      recruiterHeadline = 'No candidates in this batch yet to simulate tier impact.';
    } else if (promotedToStrong > 0 && demotedFromStrong > 0) {
      recruiterHeadline = `${simStrongCount} candidate${simStrongCount === 1 ? '' : 's'} would now qualify as Strong Match (+${promotedToStrong} promoted, -${demotedFromStrong} demoted).`;
    } else if (promotedToStrong > 0) {
      recruiterHeadline = `${simStrongCount} candidate${simStrongCount === 1 ? '' : 's'} would now qualify as Strong Match (+${promotedToStrong} newly promoted).`;
    } else if (demotedFromStrong > 0) {
      recruiterHeadline = `${simStrongCount} candidate${simStrongCount === 1 ? '' : 's'} would qualify as Strong Match (-${demotedFromStrong} demoted to lower tiers).`;
    } else {
      recruiterHeadline = `${simStrongCount} candidate${simStrongCount === 1 ? '' : 's'} qualify as Strong Match (tier distribution remains stable).`;
    }

    return {
      initialStrongCount,
      simStrongCount,
      promotedToStrong,
      demotedFromStrong,
      netStrongDiff,
      simPotentialCount,
      simLowCount,
      recruiterHeadline,
    };
  }, [weights, totalPoints, candidates]);

  const handleSliderChange = (factor: keyof FactorWeights, value: number) => {
    setWeights((prev) => ({
      ...prev,
      [factor]: value,
    }));
  };

  const applyPreset = (presetWeights: FactorWeights) => {
    setWeights(presetWeights);
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage(null);
    try {
      const sum = totalPoints > 0 ? totalPoints : 100;
      const normalizedPayload = {
        semantic: round4(weights.semantic / sum),
        skills: round4(weights.skills / sum),
        experience: round4(weights.experience / sum),
        title: round4(weights.title / sum),
        education: round4(weights.education / sum),
        rerank: true,
      };

      const res = await api.updateJobWeights(jobId, normalizedPayload);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);

      onWeightsSaved(weights, res.tier_impact);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to save weights and re-rank candidates.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setWeights(DEFAULT_WEIGHTS);
  };

  return (
    <div className="rounded-2xl border border-white/[0.1] bg-[#0d0d16] p-6 shadow-2xl">
      {/* Header with Title and Recruiter Moment */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-black tracking-tight text-white flex items-center gap-2">
              <span className="p-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                ⚖️
              </span>
              Role Scoring Weight Customizer
            </span>
            <span className="text-[11px] font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
              Feature 5: Tuning
            </span>
          </div>
          <p className="text-xs text-white/50 mt-1">
            Tailor scoring priorities to this specific role profile. Adjust sliders to see candidate tier migrations in real time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="text-xs font-semibold text-white/50 hover:text-white px-3 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] transition-colors"
          >
            Reset to Default
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/[0.05]"
              title="Close panel"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Recruiter Presets */}
      <div className="mt-4">
        <label className="text-[11px] font-bold text-white/40 uppercase tracking-wider block mb-2">
          One-Click Role Presets
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {PRESETS.map((p) => {
            const isMatch =
              weights.semantic === p.weights.semantic &&
              weights.skills === p.weights.skills &&
              weights.experience === p.weights.experience &&
              weights.title === p.weights.title &&
              weights.education === p.weights.education;

            return (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p.weights)}
                className={`text-left p-3 rounded-xl border transition-all ${
                  isMatch
                    ? 'border-cyan-500/50 bg-cyan-500/10 shadow-sm'
                    : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isMatch ? 'text-cyan-300' : 'text-white'}`}>
                    {p.name}
                  </span>
                  <span className="text-[10px] text-white/40 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06]">
                    {p.tag}
                  </span>
                </div>
                <p className="text-[11px] text-white/40 mt-1 leading-snug">
                  {p.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Recruiter Impact Banner (Mandatory Prompt Spec) */}
      <div className="mt-5 p-4 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-cyan-900/20 to-blue-950/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-sm shrink-0 border border-cyan-500/30">
              📊
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                Live Recruiter Impact Simulation
              </div>
              <div className="text-sm font-bold text-white mt-0.5">
                {simulation.recruiterHeadline}
              </div>
            </div>
          </div>

          {/* Quick counts pills */}
          <div className="flex items-center gap-2 text-xs font-bold shrink-0">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Strong: {simulation.simStrongCount}
              {simulation.netStrongDiff !== 0 && (
                <span className="ml-1 text-[10px] font-normal">
                  ({simulation.netStrongDiff > 0 ? `+${simulation.netStrongDiff}` : simulation.netStrongDiff})
                </span>
              )}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Potential: {simulation.simPotentialCount}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-500/10 text-slate-300 border border-slate-500/20">
              Low: {simulation.simLowCount}
            </span>
          </div>
        </div>
      </div>

      {/* 5 Interactive Sliders */}
      <div className="mt-6 space-y-4">
        {/* Factor 1: Semantic */}
        <FactorSlider
          label="Semantic Context Match"
          subtitle="Holistic JD alignment, domain vocabulary, and deep contextual role fit"
          icon="🧠"
          value={weights.semantic}
          normalizedPct={normalizedPercentages.semantic}
          onChange={(v) => handleSliderChange('semantic', v)}
          color="accent-cyan-400"
          badgeColor="text-cyan-400 bg-cyan-500/10 border-cyan-500/20"
        />

        {/* Factor 2: Skills */}
        <FactorSlider
          label="Technical Skills Match"
          subtitle="Direct overlap with must-have mandatory competencies and preferred toolkits"
          icon="🛠️"
          value={weights.skills}
          normalizedPct={normalizedPercentages.skills}
          onChange={(v) => handleSliderChange('skills', v)}
          color="accent-emerald-400"
          badgeColor="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
        />

        {/* Factor 3: Experience */}
        <FactorSlider
          label="Years of Experience & Tenure"
          subtitle="Verified total work duration and career history depth"
          icon="⏱️"
          value={weights.experience}
          normalizedPct={normalizedPercentages.experience}
          onChange={(v) => handleSliderChange('experience', v)}
          color="accent-indigo-400"
          badgeColor="text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
        />

        {/* Factor 4: Title */}
        <FactorSlider
          label="Job Title & Seniority Match"
          subtitle="Explicit seniority match (e.g. Lead, Senior, Principal, Director)"
          icon="🏷️"
          value={weights.title}
          normalizedPct={normalizedPercentages.title}
          onChange={(v) => handleSliderChange('title', v)}
          color="accent-purple-400"
          badgeColor="text-purple-400 bg-purple-500/10 border-purple-500/20"
        />

        {/* Factor 5: Education */}
        <FactorSlider
          label="Education & Credentials"
          subtitle="Degree level threshold (Bachelor's, Master's, PhD) and academic domain"
          icon="🎓"
          value={weights.education}
          normalizedPct={normalizedPercentages.education}
          onChange={(v) => handleSliderChange('education', v)}
          color="accent-amber-400"
          badgeColor="text-amber-400 bg-amber-500/10 border-amber-500/20"
        />
      </div>

      {/* Feedback & Error */}
      {errorMessage && (
        <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
          {errorMessage}
        </div>
      )}

      {/* Save Action Footer */}
      <div className="mt-6 pt-4 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-white/50">
          <span>Weights sum:</span>
          <span className={`font-mono font-bold ${totalPoints === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {totalPoints}%
          </span>
          {totalPoints !== 100 && (
            <span className="text-[11px] text-white/40">
              (Will automatically normalize to 100% on save)
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {onClose && (
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 sm:flex-none text-xs font-semibold text-white/60 hover:text-white px-4 py-2.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.04] transition-all"
            >
              Cancel
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg transition-all ${
              saveSuccess
                ? 'bg-emerald-500 text-white'
                : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white shadow-cyan-500/20'
            } disabled:opacity-50`}
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Saving & Re-ranking...
              </>
            ) : saveSuccess ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Weights Saved & Applied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Save Weights & Re-rank All
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

interface FactorSliderProps {
  label: string;
  subtitle: string;
  icon: string;
  value: number;
  normalizedPct: number;
  onChange: (val: number) => void;
  color: string;
  badgeColor: string;
}

const FactorSlider: React.FC<FactorSliderProps> = ({
  label,
  subtitle,
  icon,
  value,
  normalizedPct,
  onChange,
  color,
  badgeColor,
}) => {
  return (
    <div className="p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm">{icon}</span>
          <span className="text-xs font-bold text-white">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md border ${badgeColor}`}>
            {value}% (effective: {normalizedPct}%)
          </span>
        </div>
      </div>

      <p className="text-[11px] text-white/40 mb-2.5">
        {subtitle}
      </p>

      <div className="flex items-center gap-3">
        <span className="text-[10px] text-white/30 font-mono w-4">0%</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className={`flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer ${color}`}
        />
        <span className="text-[10px] text-white/30 font-mono w-7">100%</span>
      </div>
    </div>
  );
};

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
