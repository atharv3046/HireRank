/**
 * HeadToHeadComparison Component
 * ========================================================
 * Feature 6: Head-to-Head Comparison
 * (Recruiter moment: "Down to a few finalists — how do I decide between them?")
 * 
 * Specifically designed to be glanced at right before a hiring-manager meeting:
 *   - One screen, tight zero-scroll layout
 *   - Radar chart on 5 score components (Semantic, Skills, Experience, Title, Education)
 *   - 3-column skill overlap breakdown (Common / Only A / Only B)
 *   - Templated non-generative gap sentences: "{name} scores {delta} points higher on {component}."
 *   - One-click copy summary for hiring manager briefing
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, ComparisonResult } from '../api/client';
import { CareerPatternChip } from './CareerPatternChip';

interface HeadToHeadComparisonProps {
  candidateIds: number[];
  blindScreening?: boolean;
  onClose: () => void;
}

const CANDIDATE_COLORS = [
  { stroke: 'var(--accent)', fill: 'rgba(6, 182, 212, 0.25)', bg: 'bg-[var(--accent-dim)]', text: 'text-[var(--accent)]', border: 'border-[var(--accent)]/30', hex: 'var(--accent)' },
  { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.25)', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', hex: '#10b981' },
  { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.25)', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', hex: '#f59e0b' },
];

export const HeadToHeadComparison: React.FC<HeadToHeadComparisonProps> = ({
  candidateIds,
  blindScreening = false,
  onClose,
}) => {
  const [data, setData] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.compareCandidates(candidateIds, blindScreening)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.response?.data?.detail || 'Failed to compare selected candidates.');
        setLoading(false);
      });
  }, [candidateIds, blindScreening]);

  const handleCopyBriefing = () => {
    if (!data) return;
    const lines = [
      `=== HireRank Finalist Comparison: ${data.candidates.map((c) => c.name).join(' vs ')} ===`,
      '',
      '--- Scores & Tiers ---',
      ...data.candidates.map((c) => `• ${c.name} (${c.detected_title}): ${c.overall_score}% (${c.tier})`),
      '',
      '--- Key Score Differentials ---',
      ...data.score_deltas.map((d) => `• ${d.sentence}`),
      '',
      '--- Skill Overlap Summary ---',
      `• Common Skills (${data.skill_overlap.common_skills.length}): ${data.skill_overlap.common_skills.join(', ') || 'None'}`,
      ...data.candidates.map((c) => {
        const u = data.skill_overlap.unique_skills[String(c.id)] || [];
        return `• Only ${c.name} (${u.length}): ${u.join(', ') || 'None'}`;
      }),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-6xl max-h-[96vh] rounded-2xl border border-white/[0.1] bg-[#0d0f14] flex flex-col shadow-2xl shadow-none overflow-hidden"
      >
        {/* Header Bar */}
        <div className="px-5 py-3.5 border-b border-[var(--line)] flex items-center justify-between shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <span className="p-1.5 rounded-lg bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/30 text-base">
              ⚔️
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white tracking-tight">
                  Head-to-Head Finalist Matrix
                </h2>
                <span className="text-[11px] font-semibold text-[var(--accent)] bg-[var(--accent-dim)] px-2 py-0.5 rounded-full border border-[var(--accent)]/30">
                  Feature 6: Selection
                </span>
                {blindScreening && (
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Blind Screening Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-white/50">
                Glanceable decision brief for your hiring-manager meeting. Pure non-generative metrics.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyBriefing}
              disabled={!data || loading}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-white/80 hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-40"
              title="Copy bullet points to clipboard for Slack / Email"
            >
              {copied ? '✓ Copied Briefing' : '📋 Copy Briefing'}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/[0.04] text-white/50 hover:text-white hover:bg-white/[0.08] flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
          {loading ? (
            <div className="py-24 text-center">
              <div className="w-10 h-10 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-white/40">Calculating radar matrix and skill differentials…</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center">
              {error}
            </div>
          ) : data ? (
            <>
              {/* Row 1: Finalist Candidate Cards Side-by-Side */}
              <div className={`grid gap-3 ${data.candidate_count === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
                {data.candidates.map((c, i) => {
                  const style = CANDIDATE_COLORS[i % CANDIDATE_COLORS.length];
                  return (
                    <div
                      key={c.id}
                      className={`p-3.5 rounded-xl border ${style.border} ${style.bg} relative overflow-hidden flex flex-col justify-between`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-lg font-black text-xs flex items-center justify-center text-white border"
                            style={{ backgroundColor: style.hex, borderColor: style.hex }}
                          >
                            {String.fromCharCode(65 + i)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white">{c.name}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${style.border} ${style.text}`}>
                                {c.tier}
                              </span>
                            </div>
                            <div className="text-xs text-white/50 truncate max-w-[200px]">
                              {c.detected_title}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-lg font-black text-white font-mono leading-none">
                            {c.overall_score}%
                          </div>
                          <span className="text-[10px] text-white/40 uppercase font-semibold">
                            Match Score
                          </span>
                        </div>
                      </div>

                      {/* Career Pattern Chip */}
                      <div className="mt-2.5 pt-2 border-t border-[var(--line)] flex items-center justify-between text-[11px]">
                        <span className="text-white/40">{c.experience_years} yrs exp</span>
                        <CareerPatternChip
                          summary={c.career_pattern_summary}
                          experienceYears={c.experience_years}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Row 2: 2-Column Split: Radar Chart (Left) + Templated Deltas & Skill Overlap (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left: 5-Factor Radar Chart & Numerical Bars (5 cols) */}
                <div className="lg:col-span-5 rounded-xl border border-[var(--line)] bg-white/[0.02] p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-white/60">
                      5-Component Fit Radar
                    </span>
                    <div className="flex items-center gap-2.5">
                      {data.candidates.map((c, i) => (
                        <span key={c.id} className="flex items-center gap-1 text-[11px] font-semibold text-white/70">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: CANDIDATE_COLORS[i % CANDIDATE_COLORS.length].hex }}
                          />
                          {c.name.split(' ')[0]}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* SVG Radar Matrix */}
                  <div className="relative flex items-center justify-center my-1">
                    <RadarSvgChart
                      candidates={data.candidates}
                      axes={data.radar_axes}
                    />
                  </div>

                  {/* Side-by-side component scores */}
                  <div className="space-y-2 mt-2 pt-2 border-t border-[var(--line)] text-xs">
                    {data.radar_axes.map((axis) => (
                      <div key={axis.key} className="flex items-center justify-between text-[11px]">
                        <span className="text-white/50 w-28 truncate">{axis.label}</span>
                        <div className="flex items-center gap-3">
                          {data.candidates.map((c, i) => {
                            const val = (c.scores as any)[axis.key] ?? 0;
                            const color = CANDIDATE_COLORS[i % CANDIDATE_COLORS.length];
                            return (
                              <span key={c.id} className={`font-mono font-bold ${color.text} w-12 text-right`}>
                                {val}%
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Score Gap Sentences & 3-Column Skill Breakdown (7 cols) */}
                <div className="lg:col-span-7 flex flex-col gap-3">
                  {/* Templated Non-Generative Gap Sentences (Prompt Specification) */}
                  <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-dim)] p-3.5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                        Score Differentials (Meeting Talking Points)
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {data.score_deltas.map((d, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-xs text-white/90 bg-white/[0.03] px-2.5 py-1.5 rounded-lg border border-white/[0.04]"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${d.delta > 0 ? 'bg-[var(--accent)]' : 'bg-slate-500'}`} />
                          <span className="font-medium">{d.sentence}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3-Column Skill Overlap Matrix */}
                  <div className="rounded-xl border border-[var(--line)] bg-white/[0.02] p-3.5 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-white/60">
                        Skill Overlap Breakdown
                      </span>
                      <span className="text-[11px] text-white/40">
                        {data.skill_overlap.common_skills.length} shared competencies
                      </span>
                    </div>

                    {/* Columns grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 flex-1 text-xs">
                      {/* Column 1: Common Skills */}
                      <div className="p-2.5 rounded-lg bg-white/[0.02] border border-[var(--line)] flex flex-col">
                        <div className="flex items-center justify-between text-[11px] font-bold text-[var(--accent)] pb-1.5 border-b border-[var(--line)] mb-2">
                          <span>Common to Both</span>
                          <span className="px-1.5 py-0.2 rounded bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/30 text-[10px]">
                            {data.skill_overlap.common_skills.length}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 overflow-y-auto max-h-36 pr-1">
                          {data.skill_overlap.common_skills.length > 0 ? (
                            data.skill_overlap.common_skills.map((s) => (
                              <span
                                key={s}
                                className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/30"
                              >
                                ✓ {s}
                              </span>
                            ))
                          ) : (
                            <span className="text-white/30 text-[11px] italic">No common skills</span>
                          )}
                        </div>
                      </div>

                      {/* Column 2: Only Candidate A */}
                      {data.candidates[0] && (
                        <div className="p-2.5 rounded-lg bg-white/[0.02] border border-[var(--line)] flex flex-col">
                          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300 pb-1.5 border-b border-[var(--line)] mb-2">
                            <span className="truncate">Only {data.candidates[0].name.split(' ')[0]}</span>
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                              {(data.skill_overlap.unique_skills[String(data.candidates[0].id)] || []).length}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 overflow-y-auto max-h-36 pr-1">
                            {(data.skill_overlap.unique_skills[String(data.candidates[0].id)] || []).length > 0 ? (
                              data.skill_overlap.unique_skills[String(data.candidates[0].id)].map((s) => (
                                <span
                                  key={s}
                                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                >
                                  + {s}
                                </span>
                              ))
                            ) : (
                              <span className="text-white/30 text-[11px] italic">No unique skills</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Column 3: Only Candidate B */}
                      {data.candidates[1] && (
                        <div className="p-2.5 rounded-lg bg-white/[0.02] border border-[var(--line)] flex flex-col">
                          <div className="flex items-center justify-between text-[11px] font-bold text-amber-300 pb-1.5 border-b border-[var(--line)] mb-2">
                            <span className="truncate">Only {data.candidates[1].name.split(' ')[0]}</span>
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px]">
                              {(data.skill_overlap.unique_skills[String(data.candidates[1].id)] || []).length}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 overflow-y-auto max-h-36 pr-1">
                            {(data.skill_overlap.unique_skills[String(data.candidates[1].id)] || []).length > 0 ? (
                              data.skill_overlap.unique_skills[String(data.candidates[1].id)].map((s) => (
                                <span
                                  key={s}
                                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20"
                                >
                                  + {s}
                                </span>
                              ))
                            ) : (
                              <span className="text-white/30 text-[11px] italic">No unique skills</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* If 3 candidates, render Candidate C row/box */}
                    {data.candidates[2] && (
                      <div className="mt-2 p-2 rounded-lg bg-white/[0.02] border border-[var(--line)]">
                        <div className="flex items-center justify-between text-[11px] font-bold text-purple-300 mb-1">
                          <span>Only {data.candidates[2].name}</span>
                          <span className="text-[10px] text-white/40">
                            {(data.skill_overlap.unique_skills[String(data.candidates[2].id)] || []).length} unique
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(data.skill_overlap.unique_skills[String(data.candidates[2].id)] || []).map((s) => (
                            <span
                              key={s}
                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20"
                            >
                              + {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
};

interface RadarSvgChartProps {
  candidates: ComparisonResult['candidates'];
  axes: ComparisonResult['radar_axes'];
}

const RadarSvgChart: React.FC<RadarSvgChartProps> = ({ candidates, axes }) => {
  const size = 260;
  const center = size / 2;
  const radius = 95;
  const numAxes = axes.length;

  const getCoordinates = (index: number, value: number) => {
    const angle = (index * 2 * Math.PI) / numAxes - Math.PI / 2;
    const r = (value / 100) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  // Concentric background pentagons
  const levels = [25, 50, 75, 100];

  return (
    <svg width={size} height={size} className="overflow-visible">
      {/* Background concentric web lines */}
      {levels.map((lvl) => {
        const points = axes
          .map((_, i) => {
            const { x, y } = getCoordinates(i, lvl);
            return `${x},${y}`;
          })
          .join(' ');
        return (
          <polygon
            key={lvl}
            points={points}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={lvl === 100 ? '1.5' : '1'}
            strokeDasharray={lvl < 100 ? '2 2' : undefined}
          />
        );
      })}

      {/* Axis lines */}
      {axes.map((axis, i) => {
        const { x, y } = getCoordinates(i, 100);
        const labelCoord = getCoordinates(i, 118);
        return (
          <g key={axis.key}>
            <line
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth="1"
            />
            <text
              x={labelCoord.x}
              y={labelCoord.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[9px] fill-white/50 font-semibold"
            >
              {axis.label.split(' ')[0]}
            </text>
          </g>
        );
      })}

      {/* Candidate Polygons */}
      {candidates.map((c, cIdx) => {
        const color = CANDIDATE_COLORS[cIdx % CANDIDATE_COLORS.length];
        const points = axes
          .map((axis, i) => {
            const val = (c.scores as any)[axis.key] ?? 0;
            const { x, y } = getCoordinates(i, val);
            return `${x},${y}`;
          })
          .join(' ');

        return (
          <g key={c.id}>
            <polygon
              points={points}
              fill={color.fill}
              stroke={color.stroke}
              strokeWidth="2"
              className="transition-all duration-300"
            />
            {axes.map((axis, i) => {
              const val = (c.scores as any)[axis.key] ?? 0;
              const { x, y } = getCoordinates(i, val);
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="3"
                  fill={color.stroke}
                  stroke="#0d0d16"
                  strokeWidth="1.5"
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
};
