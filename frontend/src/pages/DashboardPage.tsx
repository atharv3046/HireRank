/**
 * Screen 6 — Dashboard (Recruiter Workspace)
 * ==========================================
 * Framer Motion animation pass with:
 *  - AnimatePresence modal transitions
 *  - Staggered KPI card entries
 *  - Animated quota and tier distribution progress bars
 *  - viewport={{ once: true }} for scroll reveals
 *  - prefers-reduced-motion safety
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import { api, JobPosting, DashboardSummary } from '../api/client';
import {
  useReducedMotion,
  fadeInUpVariants,
  staggerContainerVariants,
  modalBackdropVariants,
  modalContentVariants,
  useCountUp,
} from '../utils/animations';

const CreateJobModal: React.FC<{ onClose: () => void; onCreated: (job: JobPosting) => void }> = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({
    title: '',
    description: '',
    required_skills: '',
    min_experience_years: 0,
    education_requirement: 'bachelors',
    status: 'active',
  });
  const [loading, setLoading] = useState(false);
  const shouldReduce = useReducedMotion();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const job = await api.createJob({
        ...form,
        required_skills: form.required_skills.split(',').map(s => s.trim()).filter(Boolean),
      });
      onCreated(job);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      variants={modalBackdropVariants}
      initial={shouldReduce ? false : "hidden"}
      animate="visible"
      exit="exit"
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <motion.div
        variants={modalContentVariants}
        initial={shouldReduce ? false : "hidden"}
        animate="visible"
        exit="exit"
        className="rounded-2xl border border-white/[0.08] w-full max-w-lg shadow-2xl shadow-black/80 overflow-hidden"
        style={{ background: '#0d0d14' }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <div>
            <h2 className="text-lg font-bold text-white">Create Screening Batch</h2>
            <p className="text-xs text-white/40 mt-0.5">Define role criteria to rank and evaluate resumes</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/[0.04] text-white/40 hover:text-white hover:bg-white/[0.08] flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">
              Role / Batch Title *
            </label>
            <input
              required
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Senior Full-Stack Engineer"
              className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">
              Job Description *
            </label>
            <textarea
              required
              rows={4}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Paste full job description with requirements, responsibilities, tech stack..."
              className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">
              Must-Have Skills
            </label>
            <input
              value={form.required_skills}
              onChange={e => setForm(f => ({ ...f, required_skills: e.target.value }))}
              placeholder="Python, React, TypeScript, Docker, SQL"
              className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
            />
            <p className="text-[11px] text-white/30 mt-1">Comma-separated list (missing must-have skills will cap score at 59.9%)</p>
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
                onChange={e => setForm(f => ({ ...f, min_experience_years: +e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">
                Required Degree
              </label>
              <select
                value={form.education_requirement}
                onChange={e => setForm(f => ({ ...f, education_requirement: e.target.value }))}
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
              {loading ? 'Creating...' : 'Create Batch'}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

/* ── Sparkline SVG Component ─────────────────────────────────────────── */
const Sparkline: React.FC<{ data: number[]; color: string; fillId: string }> = ({ data, color, fillId }) => {
  const pts = data && data.length >= 2 ? data : [1, 2, 1, 3, 2, 4, 3];
  const width = 110;
  const height = 34;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;

  const coords = pts.map((val, i) => {
    const x = (i / (pts.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  });

  const pathD = `M ${coords.join(' L ')}`;
  const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

  return (
    <svg className="w-28 h-9 overflow-visible" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${fillId})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/* ── Hiring Velocity Line Chart (Real Timestamps & Continuous Timeline) ─── */
const HiringVelocityChart: React.FC<{
  velocity: { date: string; count: number }[];
  velocityHourly?: { hour: string; count: number }[];
  totalCandidates: number;
}> = ({ velocity, velocityHourly = [], totalCandidates }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'daily' | 'hourly'>('daily');

  // Normalize daily data into at least 7 points so it creates a continuous trajectory
  const dailyPoints = useMemo(() => {
    if (!velocity || velocity.length === 0) {
      if (totalCandidates > 0) {
        const today = new Date();
        return Array.from({ length: 7 }, (_, i) => {
          const d = new Date(today);
          d.setDate(d.getDate() - (6 - i));
          return {
            date: d.toISOString().split('T')[0],
            count: i === 6 ? totalCandidates : 0,
          };
        });
      }
      return [];
    }
    if (velocity.length === 1) {
      const baseDate = new Date(velocity[0].date);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(baseDate);
        d.setDate(d.getDate() - (6 - i));
        return {
          date: d.toISOString().split('T')[0],
          count: i === 6 ? velocity[0].count : 0,
        };
      });
    }
    return velocity;
  }, [velocity, totalCandidates]);

  // Normalize hourly data if available
  const hourlyPoints = useMemo(() => {
    if (!velocityHourly || velocityHourly.length === 0) return [];
    if (velocityHourly.length === 1) {
      const hStr = velocityHourly[0].hour;
      const hNum = parseInt(hStr.split(':')[0], 10) || 12;
      const prevH = `${String(Math.max(0, hNum - 1)).padStart(2, '0')}:00`;
      const nextH = `${String(Math.min(23, hNum + 1)).padStart(2, '0')}:00`;
      return [
        { hour: prevH, count: 0 },
        { hour: hStr, count: velocityHourly[0].count },
        { hour: nextH, count: 0 },
      ];
    }
    return velocityHourly;
  }, [velocityHourly]);

  const hasHourly = hourlyPoints.length > 0;

  // Active dataset according to active tab
  const activePoints = useMemo(() => {
    if (viewMode === 'hourly' && hasHourly) {
      return hourlyPoints.map(p => ({
        label: p.hour,
        sub: 'Intraday Time',
        count: p.count,
      }));
    }
    return dailyPoints.map(p => {
      let formatted = p.date;
      try {
        const parts = p.date.split('-');
        if (parts.length === 3) {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const m = parseInt(parts[1], 10) - 1;
          const d = parseInt(parts[2], 10);
          formatted = `${months[m]} ${d}`;
        }
      } catch (_) {}
      return {
        label: formatted,
        sub: p.date,
        count: p.count,
      };
    });
  }, [viewMode, hasHourly, hourlyPoints, dailyPoints]);

  const maxVal = Math.max(...activePoints.map(p => p.count), 4);
  const peakPoint = activePoints.reduce((max, p) => p.count > max.count ? p : max, activePoints[0] || { label: '', sub: '', count: 0 });
  const totalInPeriod = activePoints.reduce((s, p) => s + p.count, 0) || totalCandidates;

  const width = 600;
  const height = 180;
  const padLeft = 40;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 26;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const baselineY = padTop + chartH;

  const coords = activePoints.map((p, i) => {
    const x = padLeft + (activePoints.length > 1 ? (i / (activePoints.length - 1)) * chartW : chartW / 2);
    const y = padTop + chartH - (p.count / maxVal) * chartH;
    return { x, y, ...p };
  });

  // Cubic Bézier spline smoothing
  const createSplinePath = (pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return pts.length === 1 ? `M ${pts[0].x},${pts[0].y}` : '';
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cx = (p0.x + p1.x) / 2;
      d += ` C ${cx},${p0.y} ${cx},${p1.y} ${p1.x},${p1.y}`;
    }
    return d;
  };

  const pathD = createSplinePath(coords);
  const areaD = coords.length > 1
    ? `${pathD} L ${coords[coords.length - 1].x},${baselineY} L ${coords[0].x},${baselineY} Z`
    : '';

  if (activePoints.length === 0) {
    return (
      <div className="h-44 rounded-xl border border-white/5 bg-white/[0.01] flex flex-col items-center justify-center text-center p-6">
        <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-white/80">No candidate intake yet</p>
        <p className="text-xs text-white/40 mt-0.5">Upload resumes to begin tracking real-time hiring velocity.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {/* Velocity Micro-Stats & View Toggle */}
      <div className="flex items-center justify-between gap-2 mb-3 px-1">
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-white/40 text-[11px] block">Period Intake</span>
            <span className="font-bold text-white text-sm">{totalInPeriod} candidates</span>
          </div>
          <div className="h-6 w-[1px] bg-white/10" />
          <div>
            <span className="text-white/40 text-[11px] block">Peak Velocity</span>
            <span className="font-semibold text-cyan-400 text-sm">
              {peakPoint.count} <span className="text-[11px] font-normal text-white/40">({peakPoint.label})</span>
            </span>
          </div>
        </div>

        {hasHourly && (
          <div className="flex items-center bg-white/[0.04] border border-white/10 rounded-lg p-0.5 text-[11px]">
            <button
              onClick={() => setViewMode('daily')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                viewMode === 'daily'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              7-Day Trend
            </button>
            <button
              onClick={() => setViewMode('hourly')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                viewMode === 'hourly'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Intraday (Hourly)
            </button>
          </div>
        )}
      </div>

      {/* SVG Chart */}
      <div className="relative">
        <svg
          className="w-full h-44 overflow-visible"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="velocityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.32" />
              <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal grid lines with Y-Axis values */}
          {[1, 0.5, 0].map((ratio, idx) => {
            const yPos = padTop + chartH - ratio * chartH;
            const yVal = Math.round(maxVal * ratio);
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={yPos}
                  x2={width - padRight}
                  y2={yPos}
                  stroke="rgba(255,255,255,0.07)"
                  strokeDasharray="4 4"
                />
                <text
                  x={padLeft - 8}
                  y={yPos + 3}
                  textAnchor="end"
                  fill="rgba(255,255,255,0.30)"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {yVal}
                </text>
              </g>
            );
          })}

          {/* Vertical tracker crosshair line when hovered */}
          {hoveredIdx !== null && coords[hoveredIdx] && (
            <line
              x1={coords[hoveredIdx].x}
              y1={padTop}
              x2={coords[hoveredIdx].x}
              y2={baselineY}
              stroke="rgba(6,182,212,0.45)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          )}

          {/* Area gradient fill */}
          {areaD && <path d={areaD} fill="url(#velocityGradient)" />}

          {/* Ambient subtle glow stroke under main line */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="5"
              strokeOpacity="0.15"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Main crisp line path */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Points */}
          {coords.map((c, i) => {
            const isHovered = hoveredIdx === i;
            const hasActivity = c.count > 0;
            return (
              <g key={i} className="cursor-pointer">
                {/* Invisible larger hover hit area */}
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={14}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />

                {/* Outer animated halo on hover */}
                {isHovered && (
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={9}
                    fill="rgba(6,182,212,0.2)"
                    stroke="#06b6d4"
                    strokeWidth="1.5"
                  />
                )}

                {/* Point circle */}
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isHovered ? 5.5 : hasActivity ? 4 : 2.5}
                  fill={hasActivity ? '#06b6d4' : '#1e293b'}
                  stroke={hasActivity ? '#0a0a0f' : '#334155'}
                  strokeWidth={2}
                  className="transition-all duration-150"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip */}
        {hoveredIdx !== null && coords[hoveredIdx] && (
          <div
            className="absolute -top-3 px-3 py-2 bg-[#12121c]/95 border border-cyan-500/40 rounded-xl text-xs shadow-2xl backdrop-blur-md pointer-events-none transform -translate-x-1/2 -translate-y-full z-20 whitespace-nowrap"
            style={{ left: `${(coords[hoveredIdx].x / width) * 100}%` }}
          >
            <div className="flex items-center gap-1.5 font-bold text-cyan-400">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              {coords[hoveredIdx].count} {coords[hoveredIdx].count === 1 ? 'candidate' : 'candidates'}
            </div>
            <div className="text-[11px] text-white/60 mt-0.5 font-medium">
              {coords[hoveredIdx].sub ? `${coords[hoveredIdx].label} • ${coords[hoveredIdx].sub}` : coords[hoveredIdx].label}
            </div>
            {totalInPeriod > 0 && coords[hoveredIdx].count > 0 && (
              <div className="text-[10px] text-cyan-300/80 font-medium mt-1 pt-1 border-t border-white/10">
                {Math.round((coords[hoveredIdx].count / totalInPeriod) * 100)}% of intake in period
              </div>
            )}
          </div>
        )}
      </div>

      {/* X-axis date labels */}
      <div className="flex justify-between text-[11px] text-white/35 px-4 mt-2">
        {coords.map((c, i) => (
          <span
            key={i}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            className={`cursor-pointer transition-colors text-center truncate ${
              hoveredIdx === i ? 'text-cyan-400 font-semibold' : 'hover:text-white/70'
            }`}
            style={{ width: `${100 / coords.length}%` }}
          >
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
};

/* ── Pipeline Health Donut Chart ────────────────────────────────────────── */
const PipelineHealthDonut: React.FC<{
  strong: number;
  potential: number;
  low: number;
  needsReview: number;
  efficiencyPct: number;
}> = ({ strong, potential, low, needsReview, efficiencyPct }) => {
  const animEfficiency = useCountUp(efficiencyPct, 1.0);
  const total = strong + potential + low + needsReview || 1;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  const strongLen = (strong / total) * circumference;
  const potLen = (potential / total) * circumference;
  const lowLen = (low / total) * circumference;
  const nrLen = (needsReview / total) * circumference;

  let offset = 0;
  const strongOffset = offset;
  offset += strongLen;
  const potOffset = offset;
  offset += potLen;
  const lowOffset = offset;
  offset += lowLen;
  const nrOffset = offset;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="12"
          />
          {strong > 0 && (
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="#10b981"
              strokeWidth="12"
              strokeDasharray={`${strongLen} ${circumference}`}
              strokeDashoffset={-strongOffset}
              strokeLinecap="round"
            />
          )}
          {potential > 0 && (
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="12"
              strokeDasharray={`${potLen} ${circumference}`}
              strokeDashoffset={-potOffset}
              strokeLinecap="round"
            />
          )}
          {low > 0 && (
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="#64748b"
              strokeWidth="12"
              strokeDasharray={`${lowLen} ${circumference}`}
              strokeDashoffset={-lowOffset}
              strokeLinecap="round"
            />
          )}
          {needsReview > 0 && (
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="#f43f5e"
              strokeWidth="12"
              strokeDasharray={`${nrLen} ${circumference}`}
              strokeDashoffset={-nrOffset}
              strokeLinecap="round"
            />
          )}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-black text-white">{animEfficiency}%</span>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-cyan-400">Efficiency</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mt-4 w-full">
        <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Strong
          </span>
          <span className="font-bold text-white">{strong}</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
          <span className="flex items-center gap-1.5 text-amber-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> Potential
          </span>
          <span className="font-bold text-white">{potential}</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
          <span className="flex items-center gap-1.5 text-slate-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-slate-400" /> Low
          </span>
          <span className="font-bold text-white">{low}</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
          <span className="flex items-center gap-1.5 text-rose-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> Review
          </span>
          <span className="font-bold text-white">{needsReview}</span>
        </div>
      </div>
    </div>
  );
};

export default function DashboardPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();
  const shouldReduce = useReducedMotion();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [jobsData, summaryData] = await Promise.all([
        api.getJobs(),
        api.getDashboardSummary().catch(() => null)
      ]);
      setJobs(jobsData || []);
      setSummary(summaryData);
    } finally {
      setLoading(false);
    }
  };

  const totalProcessed = summary?.total_candidates ?? jobs.reduce((s, j) => s + (j.candidate_count || 0), 0);
  const quotaUsed = summary?.quota_used ?? totalProcessed;
  const quotaLimit = summary?.quota_limit ?? 60;
  const quotaPct = Math.min(Math.round((quotaUsed / quotaLimit) * 100), 100);

  const strongCount = summary?.total_strong ?? summary?.tier_distribution?.Strong ?? 0;
  const potentialCount = summary?.total_potential ?? summary?.tier_distribution?.Potential ?? 0;
  const lowCount = summary?.total_low ?? summary?.tier_distribution?.Low ?? 0;
  const needsReviewCount = summary?.total_needs_review ?? summary?.tier_distribution?.['Needs Review'] ?? 0;

  const qualifiedCount = strongCount + potentialCount;
  const efficiencyPct = summary?.efficiency_pct ?? (totalProcessed > 0 ? Math.round((qualifiedCount / totalProcessed) * 100) : 0);

  // Animated count-up values
  const animatedTotalProcessed = useCountUp(totalProcessed, 1.0, !loading);
  const animatedQualifiedCount = useCountUp(qualifiedCount, 1.0, !loading);
  const animatedStrongCount = useCountUp(strongCount, 1.0, !loading);
  const animatedQuotaUsed = useCountUp(quotaUsed, 1.0, !loading);
  const animatedEfficiencyPct = useCountUp(efficiencyPct, 1.0, !loading);

  return (
    <div className="flex min-h-screen font-sans text-white" style={{ background: '#0a0a0f' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <motion.div
          initial={shouldReduce ? false : "hidden"}
          animate="visible"
          variants={staggerContainerVariants}
          className="px-8 py-8 max-w-6xl mx-auto"
        >
          {/* Header */}
          <motion.div
            variants={fadeInUpVariants}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
          >
            <div>
              <div className="text-xs text-cyan-400 font-semibold uppercase tracking-wider mb-1">
                RECRUITER WORKSPACE
              </div>
              <h1 className="text-2xl font-extrabold text-white">Overview Dashboard</h1>
              <p className="text-sm text-white/40 mt-1">Screening pipeline performance, hiring velocity, and qualification health.</p>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                onClick={() => navigate('/screen')}
                whileHover={shouldReduce ? undefined : { scale: 1.02 }}
                whileTap={shouldReduce ? undefined : { scale: 0.98 }}
                className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all"
              >
                <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Instant Screen
              </motion.button>
              <motion.button
                onClick={() => setShowCreate(true)}
                whileHover={shouldReduce ? undefined : { scale: 1.02 }}
                whileTap={shouldReduce ? undefined : { scale: 0.98 }}
                className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-cyan-500/20"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Job Batch
              </motion.button>
            </div>
          </motion.div>

          {/* ── THREE STAT CARDS (Funnel, Assessment, Selection) with Sparklines & Quota ── */}
          <motion.div
            variants={staggerContainerVariants}
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8"
          >
            {/* Card 1: Resume Screening Funnel */}
            <motion.div
              variants={fadeInUpVariants}
              className="rounded-2xl border border-white/[0.08] p-6 shadow-sm flex flex-col justify-between"
              style={{ background: '#0d0d14' }}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                      Resume Screening Funnel
                    </span>
                    <div className="text-3xl font-black text-white mt-1">{animatedTotalProcessed}</div>
                  </div>
                  <Sparkline
                    data={[2, 4, 3, 5, 4, totalProcessed || 1]}
                    color="#06b6d4"
                    fillId="funnelGrad"
                  />
                </div>
                <p className="text-xs text-white/40 mt-1.5">
                  Total applicants parsed and scored across {summary?.total_batches ?? jobs.length} active roles
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-white/[0.05]">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-white/40 font-medium">Monthly Screening Quota</span>
                  <span className="text-cyan-400 font-bold">{animatedQuotaUsed} / {quotaLimit}</span>
                </div>
                <div className="w-full bg-white/[0.06] h-2 rounded-full overflow-hidden">
                  <motion.div
                    initial={shouldReduce ? { width: `${quotaPct}%` } : { width: 0 }}
                    animate={{ width: `${quotaPct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className={`h-full rounded-full ${
                      quotaPct > 85 ? 'bg-rose-500' : quotaPct > 60 ? 'bg-amber-500' : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                    }`}
                  />
                </div>
              </div>
            </motion.div>

            {/* Card 2: Assessment Pipeline */}
            <motion.div
              variants={fadeInUpVariants}
              className="rounded-2xl border border-white/[0.08] p-6 shadow-sm flex flex-col justify-between"
              style={{ background: '#0d0d14' }}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                      Assessment Pipeline
                    </span>
                    <div className="text-3xl font-black text-emerald-400 mt-1">{animatedQualifiedCount}</div>
                  </div>
                  <Sparkline
                    data={[1, 2, 3, 2, 4, qualifiedCount || 1]}
                    color="#10b981"
                    fillId="assessmentGrad"
                  />
                </div>
                <p className="text-xs text-white/40 mt-1.5">
                  {strongCount} Strong (≥75%) · {potentialCount} Potential (55–74.9%)
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-white/[0.05]">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-white/40 font-medium">Qualified Benchmark Fit</span>
                  <span className="text-emerald-400 font-bold">
                    {totalProcessed > 0 ? Math.round((qualifiedCount / totalProcessed) * 100) : 0}% pool
                  </span>
                </div>
                <div className="w-full bg-white/[0.06] h-2 rounded-full overflow-hidden">
                  <motion.div
                    initial={shouldReduce ? { width: `${totalProcessed > 0 ? (qualifiedCount / totalProcessed) * 100 : 0}%` } : { width: 0 }}
                    animate={{ width: `${totalProcessed > 0 ? (qualifiedCount / totalProcessed) * 100 : 0}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                    className="h-full bg-emerald-500 rounded-full"
                  />
                </div>
              </div>
            </motion.div>

            {/* Card 3: Candidate Selection */}
            <motion.div
              variants={fadeInUpVariants}
              className="rounded-2xl border border-white/[0.08] p-6 shadow-sm flex flex-col justify-between"
              style={{ background: '#0d0d14' }}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                      Candidate Selection
                    </span>
                    <div className="text-3xl font-black text-purple-400 mt-1">{animatedStrongCount}</div>
                  </div>
                  <Sparkline
                    data={[0, 1, 2, 1, 3, strongCount || 1]}
                    color="#a855f7"
                    fillId="selectionGrad"
                  />
                </div>
                <p className="text-xs text-white/40 mt-1.5">
                  Average match score: <strong className="text-white">{summary?.overall_average_score != null ? `${summary.overall_average_score}%` : '—'}</strong>
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-white/[0.05]">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-white/40 font-medium">Interview Shortlist Yield</span>
                  <span className="text-purple-400 font-bold">
                    {totalProcessed > 0 ? Math.round((strongCount / totalProcessed) * 100) : 0}% yield
                  </span>
                </div>
                <div className="w-full bg-white/[0.06] h-2 rounded-full overflow-hidden">
                  <motion.div
                    initial={shouldReduce ? { width: `${totalProcessed > 0 ? (strongCount / totalProcessed) * 100 : 0}%` } : { width: 0 }}
                    animate={{ width: `${totalProcessed > 0 ? (strongCount / totalProcessed) * 100 : 0}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                    className="h-full bg-purple-500 rounded-full"
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* ── CHARTS ROW: Hiring Velocity (Real Timestamps) & Pipeline Health Donut ── */}
          <motion.div
            variants={staggerContainerVariants}
            viewport={{ once: true }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8"
          >
            {/* Left 2 Cols: Hiring Velocity Line Chart */}
            <motion.div
              variants={fadeInUpVariants}
              className="lg:col-span-2 rounded-2xl border border-white/[0.08] p-6 shadow-sm flex flex-col justify-between"
              style={{ background: '#0d0d14' }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-white">Hiring Velocity</h2>
                  <p className="text-xs text-white/40 mt-0.5">
                    Real-time candidate intake volume derived from timestamps.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  Real timestamps
                </span>
              </div>

              <HiringVelocityChart
                velocity={summary?.velocity ?? []}
                velocityHourly={summary?.velocity_hourly ?? []}
                totalCandidates={totalProcessed}
              />
            </motion.div>

            {/* Right 1 Col: Pipeline Health Donut */}
            <motion.div
              variants={fadeInUpVariants}
              className="rounded-2xl border border-white/[0.08] p-6 shadow-sm flex flex-col justify-between"
              style={{ background: '#0d0d14' }}
            >
              <div className="mb-2">
                <h2 className="text-base font-bold text-white">Pipeline Health</h2>
                <p className="text-xs text-white/40 mt-0.5">
                  Distribution & computed qualification efficiency.
                </p>
              </div>

              <PipelineHealthDonut
                strong={strongCount}
                potential={potentialCount}
                low={lowCount}
                needsReview={needsReviewCount}
                efficiencyPct={efficiencyPct}
              />
            </motion.div>
          </motion.div>

          {/* Screening Batches List */}
          <motion.div variants={fadeInUpVariants} viewport={{ once: true }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white">Screening Batches</h2>
                <p className="text-xs text-white/40 mt-0.5">Click any batch to view unblurred candidate ranking, sub-scores, and explanations.</p>
              </div>
              <span className="text-xs text-white/40 font-semibold">{jobs.length} total batches</span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="rounded-2xl border border-white/[0.08] p-5 animate-pulse" style={{ background: '#0d0d14' }}>
                    <div className="h-4 bg-white/[0.08] rounded w-1/3 mb-3"></div>
                    <div className="h-3 bg-white/[0.04] rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.08] p-16 text-center shadow-sm" style={{ background: '#0d0d14' }}>
                <div className="w-14 h-14 bg-cyan-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-cyan-500/20">
                  <svg className="w-7 h-7 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-white font-bold text-lg mb-1.5">No screening batches found</h3>
                <p className="text-white/40 text-sm mb-6 max-w-sm mx-auto">
                  Create a job batch or run a screening to view ranked candidates and analytics.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <motion.button
                    onClick={() => setShowCreate(true)}
                    whileHover={shouldReduce ? undefined : { scale: 1.02 }}
                    whileTap={shouldReduce ? undefined : { scale: 0.98 }}
                    className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-cyan-500/20"
                  >
                    Create New Batch
                  </motion.button>
                  <motion.button
                    onClick={() => navigate('/screen')}
                    whileHover={shouldReduce ? undefined : { scale: 1.02 }}
                    whileTap={shouldReduce ? undefined : { scale: 0.98 }}
                    className="border border-white/[0.08] hover:bg-white/[0.04] text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
                  >
                    Instant Screen
                  </motion.button>
                </div>
              </div>
            ) : (
              <motion.div
                variants={staggerContainerVariants}
                viewport={{ once: true }}
                className="space-y-3"
              >
                {jobs.map(job => (
                  <motion.div
                    key={job.id}
                    variants={fadeInUpVariants}
                    whileHover={shouldReduce ? undefined : { y: -2, transition: { duration: 0.2 } }}
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    className="rounded-2xl border border-white/[0.08] px-6 py-5 cursor-pointer hover:border-cyan-500/40 hover:bg-white/[0.02] transition-colors group shadow-sm"
                    style={{ background: '#0d0d14' }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1.5">
                          <h3 className="font-bold text-white group-hover:text-cyan-400 transition-colors text-base">
                            {job.title}
                          </h3>
                          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${
                            job.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-white/[0.04] text-white/40 border border-white/[0.06]'
                          }`}>
                            {job.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-white/40 line-clamp-1 mb-3">{job.description}</p>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-white/30">
                          <span className="flex items-center gap-1.5 font-semibold text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-lg">
                            <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {job.candidate_count || 0} candidates
                          </span>
                          <span className="flex items-center gap-1 text-white/40">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {job.min_experience_years}+ yrs exp
                          </span>
                          {job.education_requirement && (
                            <span className="text-white/40 capitalize">🎓 {job.education_requirement.replace('_', ' ')}</span>
                          )}
                          <div className="flex items-center gap-1.5 ml-auto">
                            {job.required_skills?.slice(0, 3).map(s => (
                              <span key={s} className="bg-white/[0.04] text-white/60 px-2 py-0.5 rounded text-[11px] font-medium border border-white/[0.06]">
                                {s}
                              </span>
                            ))}
                            {(job.required_skills?.length || 0) > 3 && (
                              <span className="text-white/30 text-[11px]">+{job.required_skills.length - 3} more</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-center text-white/40 group-hover:text-cyan-400 transition-colors">
                        <span className="text-xs font-semibold">View Shortlist</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </main>

      <AnimatePresence>
        {showCreate && (
          <CreateJobModal
            onClose={() => setShowCreate(false)}
            onCreated={(job) => {
              setJobs(prev => [job, ...prev]);
              setShowCreate(false);
              navigate(`/jobs/${job.id}`);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
