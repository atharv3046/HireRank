/**
 * CreateJobModal Component
 * ========================================================
 * Feature 5: Weight Customizer on Job Creation
 * Allows recruiters to configure job requirements and custom scoring factor weights
 * (Semantic, Skills, Experience, Title, Education) right when creating a new role.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, JobPosting } from '../api/client';
import { useReducedMotion, modalBackdropVariants, modalContentVariants } from '../utils/animations';

interface CreateJobModalProps {
  onClose: () => void;
  onCreated: (job: JobPosting) => void;
}

const PRESETS = [
  {
    name: 'Balanced',
    tag: 'Default',
    weights: { semantic: 35, skills: 30, experience: 20, title: 10, education: 5 },
  },
  {
    name: 'Junior / Growth',
    tag: 'High-Potential',
    weights: { semantic: 45, skills: 30, experience: 10, title: 5, education: 10 },
  },
  {
    name: 'Senior / Staff',
    tag: 'Deep Tenure',
    weights: { semantic: 15, skills: 20, experience: 45, title: 15, education: 5 },
  },
  {
    name: 'Tech Specialist',
    tag: 'Tooling Overlap',
    weights: { semantic: 20, skills: 55, experience: 15, title: 5, education: 5 },
  },
];

export const CreateJobModal: React.FC<CreateJobModalProps> = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({
    title: '',
    description: '',
    required_skills: '',
    min_experience_years: 0,
    education_requirement: 'bachelors',
    status: 'active',
  });

  const [showWeights, setShowWeights] = useState(false);
  const [weights, setWeights] = useState({
    semantic: 35,
    skills: 30,
    experience: 20,
    title: 10,
    education: 5,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shouldReduce = useReducedMotion();

  const totalPoints = weights.semantic + weights.skills + weights.experience + weights.title + weights.education;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const sum = totalPoints > 0 ? totalPoints : 100;
      const normalizedWeights = {
        semantic: Math.round((weights.semantic / sum) * 1000) / 1000,
        skills: Math.round((weights.skills / sum) * 1000) / 1000,
        experience: Math.round((weights.experience / sum) * 1000) / 1000,
        title: Math.round((weights.title / sum) * 1000) / 1000,
        education: Math.round((weights.education / sum) * 1000) / 1000,
      };

      const job = await api.createJob({
        ...form,
        required_skills: form.required_skills.split(',').map((s) => s.trim()).filter(Boolean),
        weights: normalizedWeights,
      });
      onCreated(job);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to create job posting.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      variants={modalBackdropVariants}
      initial={shouldReduce ? false : 'hidden'}
      animate="visible"
      exit="exit"
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
    >
      <motion.div
        variants={modalContentVariants}
        initial={shouldReduce ? false : 'hidden'}
        animate="visible"
        exit="exit"
        className="rounded-2xl border border-white/[0.08] w-full max-w-lg shadow-2xl shadow-black/80 overflow-hidden my-8"
        style={{ background: '#0d0d14' }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <div>
            <h2 className="text-lg font-bold text-white">Create New Job Posting</h2>
            <p className="text-xs text-white/40 mt-0.5">Define role specifications and candidate scoring weights</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/[0.04] text-white/40 hover:text-white hover:bg-white/[0.08] flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">
              Job Title *
            </label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Senior Full-Stack Engineer"
              className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">
              Description *
            </label>
            <textarea
              required
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Paste full job description with responsibilities and requirements…"
              className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">
              Required Must-Have Skills
            </label>
            <input
              value={form.required_skills}
              onChange={(e) => setForm((f) => ({ ...f, required_skills: e.target.value }))}
              placeholder="Python, React, TypeScript, Docker"
              className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
            />
            <p className="text-[11px] text-white/30 mt-1">Comma-separated (missing any required skill caps candidate match at 59.9%)</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">
                Min. Experience (yrs)
              </label>
              <input
                type="number"
                min={0}
                max={30}
                value={form.min_experience_years}
                onChange={(e) => setForm((f) => ({ ...f, min_experience_years: +e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">
                Education Requirement
              </label>
              <select
                value={form.education_requirement}
                onChange={(e) => setForm((f) => ({ ...f, education_requirement: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-[#14141f] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
              >
                <option value="high_school">High School</option>
                <option value="associate">Associate</option>
                <option value="bachelors">Bachelor's</option>
                <option value="masters">Master's</option>
                <option value="phd">PhD</option>
              </select>
            </div>
          </div>

          {/* Feature 5: Weight Customizer Accordion */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowWeights((prev) => !prev)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-cyan-400">⚖️</span>
                <span className="text-xs font-bold text-white">
                  Customize Scoring Factor Weights (Optional)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-cyan-400 font-mono">
                  {showWeights ? 'Hide Sliders' : 'Configure Weights'}
                </span>
                <svg
                  className={`w-4 h-4 text-white/40 transition-transform ${showWeights ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            <AnimatePresence>
              {showWeights && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-4 pb-4 pt-1 border-t border-white/[0.06] space-y-3"
                >
                  <div className="flex items-center justify-between text-[11px] text-white/50">
                    <span>Quick presets:</span>
                    <span className="font-mono text-cyan-400 font-semibold">Total: {totalPoints}%</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {PRESETS.map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => setWeights(p.weights)}
                        className="text-left px-2.5 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] text-[11px] text-white/80"
                      >
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-[10px] text-white/40">{p.tag}</div>
                      </button>
                    ))}
                  </div>

                  {/* Sliders */}
                  <div className="space-y-2.5 pt-2">
                    <MiniSlider
                      label="Semantic Context"
                      value={weights.semantic}
                      onChange={(v) => setWeights((prev) => ({ ...prev, semantic: v }))}
                      color="accent-cyan-400"
                    />
                    <MiniSlider
                      label="Technical Skills"
                      value={weights.skills}
                      onChange={(v) => setWeights((prev) => ({ ...prev, skills: v }))}
                      color="accent-emerald-400"
                    />
                    <MiniSlider
                      label="Years Experience"
                      value={weights.experience}
                      onChange={(v) => setWeights((prev) => ({ ...prev, experience: v }))}
                      color="accent-indigo-400"
                    />
                    <MiniSlider
                      label="Job Title / Seniority"
                      value={weights.title}
                      onChange={(v) => setWeights((prev) => ({ ...prev, title: v }))}
                      color="accent-purple-400"
                    />
                    <MiniSlider
                      label="Education Level"
                      value={weights.education}
                      onChange={(v) => setWeights((prev) => ({ ...prev, education: v }))}
                      color="accent-amber-400"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-3 pt-3 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-white/[0.08] text-white/60 rounded-xl text-sm font-medium hover:bg-white/[0.04] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={shouldReduce ? undefined : { scale: 1.01 }}
              whileTap={shouldReduce ? undefined : { scale: 0.98 }}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-60"
            >
              {loading ? 'Creating…' : 'Create Job'}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

const MiniSlider: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
}> = ({ label, value, onChange, color }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-white/70">{label}</span>
      <span className="font-mono font-bold text-white/90">{value}%</span>
    </div>
    <input
      type="range"
      min={0}
      max={100}
      step={5}
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value, 10))}
      className={`w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer ${color}`}
    />
  </div>
);
