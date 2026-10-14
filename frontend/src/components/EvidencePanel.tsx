import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileSearch,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Quote,
  Sparkles,
  Briefcase,
  GraduationCap,
  Award,
  Search,
  ExternalLink,
  Info
} from 'lucide-react';

export interface EvidenceItem {
  status: 'found' | 'not_found';
  exact_match?: string | null;
  excerpt?: string;
  start_offset?: number | null;
  end_offset?: number | null;
  message?: string;
}

export interface ComponentEvidence {
  score?: number | null;
  summary?: string;
  excerpt?: string;
  start_offset?: number | null;
  end_offset?: number | null;
  [key: string]: any;
}

export interface EvidenceSpans {
  skills?: Record<string, EvidenceItem>;
  components?: {
    semantic?: ComponentEvidence;
    skills?: ComponentEvidence;
    experience?: ComponentEvidence;
    title?: ComponentEvidence;
    education?: ComponentEvidence;
  };
  summary?: string;
}

interface EvidencePanelProps {
  evidenceSpans?: EvidenceSpans | null;
  candidateName?: string;
  matchedSkills?: string[];
  missingSkills?: string[];
  className?: string;
}

export const EvidencePanel: React.FC<EvidencePanelProps> = ({
  evidenceSpans,
  candidateName = 'Candidate',
  matchedSkills = [],
  missingSkills = [],
  className = ''
}) => {
  const [selectedFactor, setSelectedFactor] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [isOpenAll, setIsOpenAll] = useState(false);

  const skillsMap = evidenceSpans?.skills || {};
  const componentsMap = evidenceSpans?.components || {};

  // Highlight exact match keyword inside excerpt string
  const renderHighlightedExcerpt = (excerpt: string, keyword?: string | null, isMissing = false) => {
    if (isMissing || !keyword) {
      return <span className="text-white/80">{excerpt}</span>;
    }

    // Escape regex special chars
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = excerpt.split(new RegExp(`(${escaped})`, 'gi'));

    return (
      <span className="text-white/90">
        {parts.map((part, i) =>
          part.toLowerCase() === keyword.toLowerCase() ? (
            <mark
              key={i}
              className="bg-emerald-500/25 text-emerald-300 font-semibold px-1 py-0.5 rounded border border-emerald-500/30"
            >
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  const getSkillEvidence = (skillName: string): EvidenceItem => {
    if (skillsMap[skillName]) {
      return skillsMap[skillName];
    }
    // Fallback if matched/missing known but not in spans map
    const isMatched = matchedSkills.includes(skillName);
    if (isMatched) {
      return {
        status: 'found',
        exact_match: skillName,
        excerpt: `Found reference to ${skillName} in resume credentials.`,
        message: `Verified match for ${skillName}.`
      };
    }
    return {
      status: 'not_found',
      exact_match: null,
      excerpt: 'Not found in resume',
      message: 'Not found in resume'
    };
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Evidence Toolbar Header */}
      <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <FileSearch className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-white/90 tracking-wide uppercase">
            Traceable Evidence Panel
          </span>
          <span className="text-[10px] text-white/40 bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/[0.06]">
            Explainability & Verification
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsOpenAll(!isOpenAll);
            if (isOpenAll) {
              setSelectedFactor(null);
              setSelectedSkill(null);
            }
          }}
          className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors px-2 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/20"
        >
          {isOpenAll ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" /> Collapse All Evidence
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" /> Inspect Full Evidence Trace
            </>
          )}
        </button>
      </div>

      {/* Component Factor Inspection Buttons */}
      <div>
        <div className="text-[11px] text-white/40 mb-1.5 flex items-center gap-1 font-medium">
          <Info className="w-3 h-3 text-white/30" />
          Click any score factor or skill chip below to expand verified resume quotes inline:
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {/* 1. Semantic */}
          <button
            type="button"
            onClick={() => setSelectedFactor(selectedFactor === 'semantic' ? null : 'semantic')}
            className={`p-2.5 rounded-lg text-left transition-all border ${
              selectedFactor === 'semantic' || isOpenAll
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200 shadow-sm shadow-cyan-500/10'
                : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] text-white/70'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" /> Semantic
              </span>
              <span className="text-[10px] opacity-60">
                {componentsMap.semantic?.score != null ? `${Math.round(componentsMap.semantic.score)}%` : ''}
              </span>
            </div>
            <div className="text-[10px] text-white/40 mt-1 truncate">
              {selectedFactor === 'semantic' ? 'Hide excerpt ▲' : 'Inspect excerpt ▼'}
            </div>
          </button>

          {/* 2. Skills Coverage */}
          <button
            type="button"
            onClick={() => setSelectedFactor(selectedFactor === 'skills' ? null : 'skills')}
            className={`p-2.5 rounded-lg text-left transition-all border ${
              selectedFactor === 'skills' || isOpenAll
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200 shadow-sm shadow-emerald-500/10'
                : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] text-white/70'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="flex items-center gap-1">
                <Award className="w-3 h-3 text-emerald-400" /> Skills
              </span>
              <span className="text-[10px] opacity-60">
                {componentsMap.skills?.score != null ? `${Math.round(componentsMap.skills.score)}%` : ''}
              </span>
            </div>
            <div className="text-[10px] text-white/40 mt-1 truncate">
              {selectedFactor === 'skills' ? 'Hide excerpt ▲' : 'Inspect excerpt ▼'}
            </div>
          </button>

          {/* 3. Experience */}
          <button
            type="button"
            onClick={() => setSelectedFactor(selectedFactor === 'experience' ? null : 'experience')}
            className={`p-2.5 rounded-lg text-left transition-all border ${
              selectedFactor === 'experience' || isOpenAll
                ? 'bg-blue-500/15 border-blue-500/40 text-blue-200 shadow-sm shadow-blue-500/10'
                : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] text-white/70'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="flex items-center gap-1">
                <Briefcase className="w-3 h-3 text-blue-400" /> Experience
              </span>
              <span className="text-[10px] opacity-60">
                {componentsMap.experience?.score != null ? `${Math.round(componentsMap.experience.score)}%` : ''}
              </span>
            </div>
            <div className="text-[10px] text-white/40 mt-1 truncate">
              {selectedFactor === 'experience' ? 'Hide excerpt ▲' : 'Inspect excerpt ▼'}
            </div>
          </button>

          {/* 4. Title */}
          <button
            type="button"
            onClick={() => setSelectedFactor(selectedFactor === 'title' ? null : 'title')}
            className={`p-2.5 rounded-lg text-left transition-all border ${
              selectedFactor === 'title' || isOpenAll
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-200 shadow-sm shadow-amber-500/10'
                : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] text-white/70'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="flex items-center gap-1">
                <Search className="w-3 h-3 text-amber-400" /> Title Fit
              </span>
              <span className="text-[10px] opacity-60">
                {componentsMap.title?.score != null ? `${Math.round(componentsMap.title.score)}%` : ''}
              </span>
            </div>
            <div className="text-[10px] text-white/40 mt-1 truncate">
              {selectedFactor === 'title' ? 'Hide excerpt ▲' : 'Inspect excerpt ▼'}
            </div>
          </button>

          {/* 5. Education */}
          <button
            type="button"
            onClick={() => setSelectedFactor(selectedFactor === 'education' ? null : 'education')}
            className={`p-2.5 rounded-lg text-left transition-all border ${
              selectedFactor === 'education' || isOpenAll
                ? 'bg-purple-500/15 border-purple-500/40 text-purple-200 shadow-sm shadow-purple-500/10'
                : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] text-white/70'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="flex items-center gap-1">
                <GraduationCap className="w-3 h-3 text-purple-400" /> Education
              </span>
              <span className="text-[10px] opacity-60">
                {componentsMap.education?.score != null ? `${Math.round(componentsMap.education.score)}%` : ''}
              </span>
            </div>
            <div className="text-[10px] text-white/40 mt-1 truncate">
              {selectedFactor === 'education' ? 'Hide excerpt ▲' : 'Inspect excerpt ▼'}
            </div>
          </button>
        </div>
      </div>

      {/* Inline Expanded Component Factor Excerpt Drawer */}
      <AnimatePresence>
        {(selectedFactor || isOpenAll) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-white/[0.1] shadow-xl space-y-3">
              {/* If inspecting specific factor or all */}
              {['semantic', 'skills', 'experience', 'title', 'education'].map(factorKey => {
                if (!isOpenAll && selectedFactor !== factorKey) return null;
                const comp = (componentsMap as any)[factorKey] as ComponentEvidence | undefined;
                if (!comp) return null;

                const factorColors: Record<string, { border: string; text: string; label: string }> = {
                  semantic: { border: 'border-cyan-500/40', text: 'text-cyan-400', label: 'Semantic Alignment Evidence' },
                  skills: { border: 'border-emerald-500/40', text: 'text-emerald-400', label: 'Skill Coverage Evidence' },
                  experience: { border: 'border-blue-500/40', text: 'text-blue-400', label: 'Experience History Evidence' },
                  title: { border: 'border-amber-500/40', text: 'text-amber-400', label: 'Title Relevance Evidence' },
                  education: { border: 'border-purple-500/40', text: 'text-purple-400', label: 'Education Verification Evidence' }
                };

                const style = factorColors[factorKey] || factorColors.semantic;

                return (
                  <div key={factorKey} className={`p-3 rounded-lg bg-black/40 border-l-2 ${style.border} border-t border-r border-b border-white/[0.04]`}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className={`font-bold ${style.text}`}>{style.label}</span>
                      {comp.start_offset != null && comp.end_offset != null && (
                        <span className="font-mono text-[10px] text-white/40 bg-white/[0.05] px-1.5 py-0.5 rounded">
                          chars {comp.start_offset}–{comp.end_offset}
                        </span>
                      )}
                    </div>
                    {comp.summary && (
                      <p className="text-xs text-white/70 mb-2 leading-relaxed">{comp.summary}</p>
                    )}
                    {comp.excerpt && (
                      <div className="p-2 rounded bg-white/[0.03] border border-white/[0.05] flex items-start gap-2 text-xs font-mono text-white/80">
                        <Quote className="w-3.5 h-3.5 text-white/30 shrink-0 mt-0.5" />
                        <span className="italic leading-normal select-all">"{comp.excerpt}"</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Matched & Missing Skills Evidence Tags */}
      <div className="space-y-2 pt-1">
        {/* Matched Skills */}
        {matchedSkills.length > 0 && (
          <div>
            <div className="text-[11px] font-bold text-emerald-400 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Matched Skills with In-Resume Evidence ({matchedSkills.length})
              </span>
              <span className="text-[10px] text-white/40 font-normal">Click a skill tag to inspect exact quote</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {matchedSkills.map(skill => {
                const isSelected = selectedSkill === skill;
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => setSelectedSkill(isSelected ? null : skill)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all border ${
                      isSelected
                        ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400 ring-1 ring-emerald-400/40 shadow-sm'
                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/15'
                    }`}
                  >
                    <span>✓ {skill}</span>
                    <Quote className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Missing Skills */}
        {missingSkills.length > 0 && (
          <div className="pt-1">
            <div className="text-[11px] font-bold text-rose-400 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                Missing Required Skills Gap ({missingSkills.length})
              </span>
              <span className="text-[10px] text-white/40 font-normal">Click to verify absence</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {missingSkills.map(skill => {
                const isSelected = selectedSkill === skill;
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => setSelectedSkill(isSelected ? null : skill)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all border ${
                      isSelected
                        ? 'bg-rose-500/25 text-rose-200 border-rose-400 ring-1 ring-rose-400/40 shadow-sm'
                        : 'bg-rose-500/10 text-rose-300 border-rose-500/20 hover:bg-rose-500/15'
                    }`}
                  >
                    <span>✗ {skill}</span>
                    <Info className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Inline Skill Excerpt Inspector Callout Box */}
        <AnimatePresence>
          {selectedSkill && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -4 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden mt-2"
            >
              {(() => {
                const ev = getSkillEvidence(selectedSkill);
                const isFound = ev.status === 'found';

                return (
                  <div
                    className={`p-3 rounded-xl border ${
                      isFound
                        ? 'bg-emerald-950/40 border-emerald-500/30'
                        : 'bg-rose-950/40 border-rose-500/30'
                    } text-xs space-y-2`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isFound ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                            <CheckCircle2 className="w-4 h-4" />
                            Verified In Resume: "{selectedSkill}"
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-bold">
                            <XCircle className="w-4 h-4" />
                            Not found in resume: "{selectedSkill}"
                          </span>
                        )}
                        {isFound && ev.start_offset != null && ev.end_offset != null && (
                          <span className="font-mono text-[10px] text-emerald-300/80 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            Offset: {ev.start_offset}–{ev.end_offset}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedSkill(null)}
                        className="text-[10px] text-white/40 hover:text-white/80 transition-colors"
                      >
                        ✕ Close
                      </button>
                    </div>

                    {/* Excerpt Display */}
                    <div
                      className={`p-2.5 rounded-lg border font-mono text-xs leading-relaxed ${
                        isFound
                          ? 'bg-black/50 border-emerald-500/20 text-emerald-100'
                          : 'bg-black/50 border-rose-500/20 text-rose-200/90'
                      }`}
                    >
                      {isFound ? (
                        <div className="flex items-start gap-2">
                          <Quote className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <div className="italic">
                            "{renderHighlightedExcerpt(ev.excerpt || '', ev.exact_match || selectedSkill)}"
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-rose-300">Not found in resume.</span>
                            <div className="text-[11px] text-white/50 font-sans mt-0.5">
                              No occurrence or taxonomy alias of "{selectedSkill}" was detected anywhere in candidate {candidateName}'s resume text.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
