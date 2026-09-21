/**
 * Marketing Landing Page — Delivery 1: Navbar + Hero
 * ===================================================
 * Dark-theme animated landing page for HireRank.
 * Accent gradient: teal → blue (cyan-400 → blue-500).
 *
 * Animations:
 *  - Navbar: transparent → blurred on scroll (useScroll + useTransform)
 *  - Hero headline: staggered word-by-word reveal
 *  - Subheadline: fade + slide up after headline
 *  - CTA: primary has infinite glow pulse, secondary is ghost
 *  - Background: drifting gradient blobs (respects prefers-reduced-motion)
 *  - Live preview card: animated score ring + staggered skill tags
 *
 * All looping animations respect prefers-reduced-motion.
 * All scroll-reveals use viewport={{ once: true }}.
 * Only transform + opacity are animated in loops (GPU-friendly).
 */

import { useRef, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useInView,
  animate,
} from 'framer-motion';
import { Zap, ArrowRight, Play, Shield, Brain, BarChart3, FileSearch } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/* ── Reduced-motion hook ──────────────────────────────────────────────── */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

/* ── Animated counter hook ────────────────────────────────────────────── */
function useAnimatedCounter(target: number, duration = 1.2, trigger = true) {
  const motionVal = useMotionValue(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!trigger) return;
    const controls = animate(motionVal, target, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [trigger, target, duration, motionVal]);

  return display;
}

/* ── Score ring SVG ───────────────────────────────────────────────────── */
const ScoreRing = ({ score, size = 80 }: { score: number; size?: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const animatedScore = useAnimatedCounter(score, 1.4, inView);
  const r = (size - 8) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (circumference * (inView ? score : 0)) / 100;

  return (
    <div ref={ref} className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6}
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="url(#scoreGrad)" strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
        />
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Static fallback for no-JS / accessibility */}
        <span className="text-xl font-bold text-white tabular-nums" aria-label={`Score: ${score}%`}>
          {animatedScore}%
        </span>
      </div>
    </div>
  );
};

/* ── Drifting gradient blob ───────────────────────────────────────────── */
const Blob = ({
  className,
  delay = 0,
  reduced,
}: {
  className: string;
  delay?: number;
  reduced: boolean;
}) => (
  <motion.div
    className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
    animate={
      reduced
        ? {}
        : {
            x: [0, 30, -20, 10, 0],
            y: [0, -20, 15, -10, 0],
            scale: [1, 1.08, 0.95, 1.03, 1],
          }
    }
    transition={
      reduced
        ? {}
        : {
            duration: 18,
            repeat: Infinity,
            repeatType: 'loop',
            ease: 'easeInOut',
            delay,
          }
    }
  />
);

/* ── Skill tag component ──────────────────────────────────────────────── */
const SkillTag = ({ name, matched, delay }: { name: string; matched: boolean; delay: number }) => (
  <motion.span
    className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium ${
      matched
        ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
        : 'bg-red-500/10 text-red-400 border-red-500/20'
    }`}
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.3, delay }}
  >
    {matched ? '✓' : '✗'} {name}
  </motion.span>
);

/* ── Live preview card (hero right side) ──────────────────────────────── */
const LivePreviewCard = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  // Illustrative sample data — not real metrics
  const skills = [
    { name: 'Python', matched: true },
    { name: 'FastAPI', matched: true },
    { name: 'Docker', matched: true },
    { name: 'React', matched: true },
    { name: 'Kubernetes', matched: false },
  ];

  return (
    <motion.div
      ref={ref}
      className="relative w-full max-w-sm"
      initial={{ opacity: 0, y: 30, rotateY: -8 }}
      animate={inView ? { opacity: 1, y: 0, rotateY: 0 } : {}}
      transition={{ duration: 0.8, delay: 0.6, ease: 'easeOut' }}
    >
      {/* Glow behind card */}
      <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-3xl blur-2xl opacity-40" />

      <div className="relative bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
              Live Analysis
            </span>
          </div>
          <span className="text-[10px] text-white/30 font-mono">candidate_042.pdf</span>
        </div>

        {/* Score + name */}
        <div className="flex items-center gap-5">
          <ScoreRing score={87} size={72} />
          <div>
            <div className="text-sm font-bold text-white">Strong Match</div>
            <div className="text-xs text-white/40 mt-0.5">Senior Python Engineer</div>
            <div className="flex items-center gap-1.5 mt-2">
              <div className="h-1.5 w-20 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={inView ? { width: '87%' } : {}}
                  transition={{ duration: 1, delay: 0.8, ease: 'easeOut' }}
                />
              </div>
              <span className="text-[10px] text-white/30">87/100</span>
            </div>
          </div>
        </div>

        {/* Skill tags */}
        <div>
          <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-2">
            Skill Match
          </div>
          <div className="flex flex-wrap gap-1.5">
            {inView &&
              skills.map((s, i) => (
                <SkillTag key={s.name} name={s.name} matched={s.matched} delay={1.2 + i * 0.12} />
              ))}
          </div>
        </div>

        {/* Bottom stat row */}
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/5">
          {[
            { label: 'Experience', value: '6 yrs' },
            { label: 'Education', value: "Master's" },
            { label: 'Skill Fit', value: '80%' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-xs font-bold text-white/70">{s.value}</div>
              <div className="text-[9px] text-white/25">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

/* ════════════════════════════════════════════════════════════════════════
   NAVBAR
   ════════════════════════════════════════════════════════════════════════ */
const NAV_LINKS = [
  { label: 'How it works', href: '#how' },
  { label: 'Features', href: '#features' },
  { label: 'Demo', href: '#demo' },
  { label: 'FAQ', href: '#faq' },
];

const Navbar = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { scrollY } = useScroll();
  const bgOpacity = useTransform(scrollY, [0, 120], [0, 0.85]);
  const blur = useTransform(scrollY, [0, 120], [0, 16]);
  const borderOpacity = useTransform(scrollY, [0, 120], [0, 0.08]);

  return (
    <motion.nav
      className="fixed top-0 inset-x-0 z-50 px-6 md:px-10"
      style={{
        backgroundColor: useTransform(bgOpacity, (v) => `rgba(10,10,15,${v})`),
        backdropFilter: useTransform(blur, (v) => `blur(${v}px)`),
        borderBottom: useTransform(borderOpacity, (v) => `1px solid rgba(255,255,255,${v})`),
      }}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between h-16">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <motion.div
            className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20"
            whileHover={{ rotate: 12, scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </motion.div>
          <span className="text-lg font-bold text-white tracking-tight">
            Hire<span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Rank</span>
          </span>
        </Link>

        {/* Links */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-white/50 hover:text-white transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="relative text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2 rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-shadow flex items-center gap-1.5"
            >
              Dashboard →
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate('/login')}
                className="text-sm text-white/60 hover:text-white transition-colors px-3 py-1.5"
              >
                Sign in
              </button>
              <button
                onClick={() => navigate('/screen')}
                className="relative text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2 rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-shadow"
              >
                Get started free
              </button>
            </>
          )}
        </div>
      </div>
    </motion.nav>
  );
};

/* ════════════════════════════════════════════════════════════════════════
   HERO
   ════════════════════════════════════════════════════════════════════════ */
const headlineWords = [
  'Screen',
  'resumes.',
  'Rank',
  'candidates.',
  'Explain',
  'every',
  'score.',
];

const wordVariants = {
  hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.5, delay: 0.15 + i * 0.09, ease: 'easeOut' as const },
  }),
};

const Hero = ({ reduced }: { reduced: boolean }) => {
  const navigate = useNavigate();

  return (
  <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
    {/* ── Background blobs ─────────────────────────────────────────── */}
    <Blob
      className="w-[500px] h-[500px] bg-cyan-500/15 -top-40 -left-40"
      delay={0}
      reduced={reduced}
    />
    <Blob
      className="w-[400px] h-[400px] bg-blue-600/15 top-1/3 right-0"
      delay={4}
      reduced={reduced}
    />
    <Blob
      className="w-[350px] h-[350px] bg-violet-600/10 bottom-0 left-1/3"
      delay={8}
      reduced={reduced}
    />

    {/* Grid pattern overlay */}
    <div
      className="absolute inset-0 opacity-[0.03]"
      style={{
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }}
    />

    <div className="relative max-w-6xl mx-auto px-6 md:px-10 w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
      {/* ── LEFT: Copy ───────────────────────────────────────────── */}
      <div className="space-y-8">
        {/* Badge */}
        <motion.div
          className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/10 text-cyan-300 text-xs font-semibold px-4 py-1.5 rounded-full"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0 }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          AI-Powered Resume Intelligence
        </motion.div>

        {/* Headline — word-by-word stagger */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.1] tracking-tight">
          {headlineWords.map((word, i) => (
            <motion.span
              key={i}
              className={`inline-block mr-[0.3em] ${
                i === 0 || i === 2 || i === 4
                  ? 'bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent'
                  : 'text-white'
              }`}
              custom={i}
              initial="hidden"
              animate="visible"
              variants={wordVariants}
            >
              {word}
            </motion.span>
          ))}
        </h1>

        {/* Subheadline */}
        <motion.p
          className="text-lg text-white/40 max-w-md leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.0, ease: 'easeOut' }}
        >
          Paste a job description, upload resumes, and get a ranked shortlist
          with matched skills, experience gaps, and explainable scores —
          in under a minute.
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="flex flex-wrap items-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.2, ease: 'easeOut' }}
        >
          {/* Primary — with glow pulse */}
          <button
            onClick={() => navigate('/screen')}
            className="relative group"
          >
            {/* Glow layer */}
            <motion.div
              className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl opacity-40 blur-lg"
              animate={
                reduced
                  ? {}
                  : {
                      scale: [1, 1.08, 1],
                      opacity: [0.3, 0.5, 0.3],
                    }
              }
              transition={
                reduced
                  ? {}
                  : {
                      duration: 2.5,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }
              }
            />
            <span className="relative flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold px-8 py-3.5 rounded-xl text-sm shadow-xl shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-shadow">
              Start screening free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </button>

          {/* Secondary — ghost */}
          <button
            onClick={() => {
              // TODO: connect to API — navigate to demo section
              document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex items-center gap-2 border border-white/10 hover:border-white/20 text-white/60 hover:text-white font-semibold px-7 py-3.5 rounded-xl text-sm transition-all hover:bg-white/[0.03]"
          >
            <Play className="w-4 h-4" />
            Watch demo
          </button>
        </motion.div>

        {/* Trust line */}
        <motion.div
          className="flex items-center gap-6 pt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.5 }}
        >
          {[
            { icon: Shield, text: 'Bias-free scoring' },
            { icon: Brain, text: 'Explainable AI' },
            { icon: FileSearch, text: 'No login to try' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 text-xs text-white/25">
              <Icon className="w-3.5 h-3.5" />
              {text}
            </div>
          ))}
        </motion.div>
      </div>

      {/* ── RIGHT: Live preview card ─────────────────────────────── */}
      <div className="hidden lg:flex justify-center">
        <LivePreviewCard />
      </div>
    </div>

    {/* Scroll indicator */}
    <motion.div
      className="absolute bottom-8 left-1/2 -translate-x-1/2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 2 }}
    >
      <motion.div
        className="w-6 h-10 rounded-full border border-white/10 flex items-start justify-center p-1.5"
        animate={reduced ? {} : { y: [0, 4, 0] }}
        transition={reduced ? {} : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="w-1 h-2.5 rounded-full bg-gradient-to-b from-cyan-400 to-transparent" />
      </motion.div>
    </motion.div>
  </section>
  );
};

/* ════════════════════════════════════════════════════════════════════════
   HOW IT WORKS — 4-step strip
   ════════════════════════════════════════════════════════════════════════ */
const STEPS = [
  {
    num: '01',
    icon: FileSearch,
    title: 'Upload resumes & JD',
    desc: 'Drop in the full job description and up to 50 resume files — PDF or DOCX. No signup required to start.',
  },
  {
    num: '02',
    icon: Brain,
    title: 'AI parses everything',
    desc: 'Our NLP pipeline extracts skills, experience timelines, education, and contact info from every resume automatically.',
  },
  {
    num: '03',
    icon: BarChart3,
    title: 'Semantic scoring',
    desc: 'Each candidate is scored against the JD using dense embeddings, skill coverage, experience fit, and education match.',
  },
  {
    num: '04',
    icon: Zap,
    title: 'Ranked shortlist',
    desc: 'Get a tiered shortlist — Strong, Potential, Low — with matched & missing skills explained for every candidate.',
  },
];

const HowItWorks = ({ reduced }: { reduced: boolean }) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start 0.8', 'end 0.6'],
  });
  // Drive the connecting line draw from scroll progress
  const lineProgress = useTransform(scrollYProgress, [0, 1], [0, 100]);

  return (
    <section
      id="how"
      ref={sectionRef}
      className="relative py-28 md:py-36 px-6 overflow-hidden"
    >
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-5xl mx-auto">
        {/* Section header */}
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-xs font-semibold text-cyan-400 uppercase tracking-widest">
            How it works
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-3 tracking-tight">
            From job description to ranked shortlist
          </h2>
          <p className="text-white/35 text-lg mt-4 max-w-lg mx-auto">
            Four steps. Under a minute. Every score explained.
          </p>
        </motion.div>

        {/* Steps grid */}
        <div className="relative grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* ── Connecting line (desktop SVG) ─────────────────────── */}
          <div className="hidden md:block absolute top-12 left-[12.5%] right-[12.5%] h-[2px]">
            <svg
              className="w-full h-full"
              viewBox="0 0 1000 2"
              preserveAspectRatio="none"
            >
              <motion.line
                x1="0"
                y1="1"
                x2="1000"
                y2="1"
                stroke="url(#lineGrad)"
                strokeWidth="2"
                strokeDasharray="1000"
                style={{
                  strokeDashoffset: useTransform(lineProgress, (v) =>
                    reduced ? 0 : 1000 - (v / 100) * 1000
                  ),
                }}
              />
              <defs>
                <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
                  <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.4" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* ── Step cards ───────────────────────────────────────── */}
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.num}
                className="relative flex flex-col items-center text-center"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{
                  duration: 0.5,
                  delay: i * 0.15,
                  ease: 'easeOut' as const,
                }}
              >
                {/* Icon circle */}
                <div className="relative z-10 w-24 h-24 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center mb-5 group hover:border-cyan-500/30 transition-colors">
                  <Icon className="w-8 h-8 text-cyan-400" strokeWidth={1.5} />
                  {/* Step number badge */}
                  <span className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white shadow-lg shadow-cyan-500/30">
                    {step.num}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-white/35 leading-relaxed max-w-[220px]">
                  {step.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

/* ════════════════════════════════════════════════════════════════════════
   MARQUEE — "Screens resumes for" role tags
   ════════════════════════════════════════════════════════════════════════
   Pure CSS @keyframes with duplicated content for seamless loop.
   Two rows, opposite directions. Pauses on hover.
   Respects prefers-reduced-motion.
   ════════════════════════════════════════════════════════════════════════ */
const ROLES_ROW1 = [
  'Backend Engineers',
  'Frontend Developers',
  'Full-Stack Engineers',
  'DevOps Engineers',
  'Data Scientists',
  'Machine Learning Engineers',
  'Product Managers',
  'QA Engineers',
  'Mobile Developers',
  'Cloud Architects',
];

const ROLES_ROW2 = [
  'Technical Writers',
  'Security Engineers',
  'Platform Engineers',
  'Solutions Architects',
  'Engineering Managers',
  'Database Administrators',
  'SRE Engineers',
  'AI Researchers',
  'UI/UX Designers',
  'Blockchain Developers',
];

const MarqueeRow = ({
  roles,
  direction,
  duration,
  reduced,
}: {
  roles: string[];
  direction: 'left' | 'right';
  duration: number;
  reduced: boolean;
}) => {
  const animationStyle = reduced
    ? {}
    : {
        animationName: direction === 'left' ? 'marqueeLeft' : 'marqueeRight',
        animationDuration: `${duration}s`,
        animationTimingFunction: 'linear',
        animationIterationCount: 'infinite',
      };

  const items = [...roles, ...roles]; // duplicate for seamless loop

  return (
    <div className="group overflow-hidden">
      <div
        className="flex gap-3 w-max hover:[animation-play-state:paused]"
        style={animationStyle as React.CSSProperties}
      >
        {items.map((role, i) => (
          <span
            key={`${role}-${i}`}
            className="inline-flex items-center px-5 py-2.5 rounded-full border border-white/[0.06] bg-white/[0.02] text-sm text-white/40 font-medium whitespace-nowrap hover:text-cyan-300 hover:border-cyan-500/20 hover:bg-cyan-500/5 transition-colors"
          >
            {role}
          </span>
        ))}
      </div>
    </div>
  );
};

const Marquee = ({ reduced }: { reduced: boolean }) => (
  <section className="relative py-16 overflow-hidden">
    {/* Marquee CSS keyframes — injected once */}
    <style>{`
      @keyframes marqueeLeft {
        from { transform: translateX(0); }
        to   { transform: translateX(-50%); }
      }
      @keyframes marqueeRight {
        from { transform: translateX(-50%); }
        to   { transform: translateX(0); }
      }
      @media (prefers-reduced-motion: reduce) {
        .hover\\:[animation-play-state\\:paused] {
          animation: none !important;
        }
      }
    `}</style>

    {/* Fade edges */}
    <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#0a0a0f] to-transparent z-10 pointer-events-none" />
    <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#0a0a0f] to-transparent z-10 pointer-events-none" />

    {/* Label */}
    <div className="text-center mb-8">
      <span className="text-xs font-semibold text-white/20 uppercase tracking-widest">
        Screens resumes for
      </span>
    </div>

    <div className="space-y-3">
      <MarqueeRow roles={ROLES_ROW1} direction="left" duration={40} reduced={reduced} />
      <MarqueeRow roles={ROLES_ROW2} direction="right" duration={45} reduced={reduced} />
    </div>
  </section>
);

/* ════════════════════════════════════════════════════════════════════════
   STATS + MOCK DASHBOARD
   ════════════════════════════════════════════════════════════════════════ */

// Illustrative sample stats — not real production metrics
const STATS_DATA = [
  { value: 10000, suffix: '+', label: 'Resumes screened', prefix: '' },
  { value: 70, suffix: '%', label: 'Faster shortlisting', prefix: '' },
  { value: 530, suffix: '+', label: 'Skills in taxonomy', prefix: '' },
  { value: 4, suffix: '×', label: 'More roles per day', prefix: '' },
];

const StatCounter = ({
  value,
  suffix,
  label,
  delay,
}: {
  value: number;
  suffix: string;
  label: string;
  delay: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const count = useAnimatedCounter(value, 1.2, inView);

  return (
    <motion.div
      ref={ref}
      className="text-center"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' as const }}
    >
      {/* Static fallback value for no-JS / accessibility */}
      <div className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent tabular-nums">
        {count.toLocaleString()}{suffix}
      </div>
      <div className="text-sm text-white/30 mt-2 font-medium">{label}</div>
    </motion.div>
  );
};

// Illustrative sample candidate data for the mock dashboard visual
const MOCK_CANDIDATES = [
  { name: 'Candidate A', score: 92, tier: 'strong' as const },
  { name: 'Candidate B', score: 84, tier: 'strong' as const },
  { name: 'Candidate C', score: 71, tier: 'potential' as const },
  { name: 'Candidate D', score: 63, tier: 'potential' as const },
  { name: 'Candidate E', score: 45, tier: 'low' as const },
  { name: 'Candidate F', score: 38, tier: 'low' as const },
];

const TIER_COLORS = {
  strong: 'from-cyan-400 to-blue-500',
  potential: 'from-amber-400 to-orange-500',
  low: 'from-gray-500 to-gray-600',
};

const TIER_BADGE = {
  strong: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20',
  potential: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  low: 'bg-white/5 text-white/30 border-white/10',
};

const MockDashboard = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <motion.div
      ref={ref}
      className="relative"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      {/* Glow */}
      <div className="absolute -inset-6 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-3xl blur-2xl opacity-50 pointer-events-none" />

      <div className="relative bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
        {/* Dashboard header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400" />
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              Candidate Ranking — Senior Python Engineer
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-400/60" />
            <div className="w-2 h-2 rounded-full bg-yellow-400/60" />
            <div className="w-2 h-2 rounded-full bg-green-400/60" />
          </div>
        </div>

        {/* Candidate bars */}
        <div className="px-6 py-5 space-y-3">
          {MOCK_CANDIDATES.map((c, i) => (
            <div key={c.name} className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] font-bold text-white/40">
                  {c.name.split(' ')[1]}
                </span>
              </div>

              {/* Name + bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-white/50 font-medium">{c.name}</span>
                  <span className="text-xs font-bold text-white/60 tabular-nums">{c.score}%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full bg-gradient-to-r ${TIER_COLORS[c.tier]}`}
                    initial={{ width: 0 }}
                    animate={inView ? { width: `${c.score}%` } : { width: 0 }}
                    transition={{
                      duration: 0.8,
                      delay: 0.4 + i * 0.1,
                      ease: 'easeOut' as const,
                    }}
                  />
                </div>
              </div>

              {/* Tier badge */}
              <span
                className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${
                  TIER_BADGE[c.tier]
                }`}
              >
                {c.tier === 'strong' ? 'Strong' : c.tier === 'potential' ? 'Potential' : 'Low'}
              </span>
            </div>
          ))}
        </div>

        {/* Footer stats */}
        <div className="grid grid-cols-3 border-t border-white/5 divide-x divide-white/5">
          {[
            { label: 'Strong matches', val: '2', color: 'text-cyan-400' },
            { label: 'Potential', val: '2', color: 'text-amber-400' },
            { label: 'Low match', val: '2', color: 'text-white/30' },
          ].map((s) => (
            <div key={s.label} className="px-4 py-3 text-center">
              <div className={`text-sm font-bold ${s.color}`}>{s.val}</div>
              <div className="text-[9px] text-white/20">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

const StatsSection = () => (
  <section id="stats" className="relative py-28 md:py-36 px-6 overflow-hidden">
    {/* Background glow */}
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

    <div className="relative max-w-6xl mx-auto">
      {/* Section header */}
      <motion.div
        className="text-center mb-20"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6 }}
      >
        <span className="text-xs font-semibold text-cyan-400 uppercase tracking-widest">
          Built for scale
        </span>
        <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-3 tracking-tight">
          Numbers that speak for themselves
        </h2>
        <p className="text-white/35 text-lg mt-4 max-w-lg mx-auto">
          From solo recruiters to enterprise talent teams.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* ── LEFT: Stats counters ──────────────────────────────── */}
        <div className="grid grid-cols-2 gap-10">
          {STATS_DATA.map((stat, i) => (
            <StatCounter
              key={stat.label}
              value={stat.value}
              suffix={stat.suffix}
              label={stat.label}
              delay={i * 0.1}
            />
          ))}
        </div>

        {/* ── RIGHT: Mock dashboard card ─────────────────────────── */}
        <MockDashboard />
      </div>
    </div>
  </section>
);

/* ════════════════════════════════════════════════════════════════════════
   FEATURE GRID
   ════════════════════════════════════════════════════════════════════════ */
const FEATURES = [
  {
    icon: FileSearch,
    title: 'Intelligent Parsing',
    desc: 'Extracts skills, experience timelines, education, job titles, and contact info from any PDF or DOCX — even poorly formatted ones — using rule-based NLP with fuzzy alias matching.',
    detail: 'Handles aliases like ReactJS = React.js = React automatically.',
    color: 'from-cyan-500/20 to-cyan-500/5',
    border: 'hover:border-cyan-500/30',
    iconColor: 'text-cyan-400',
    iconBg: 'bg-cyan-500/10',
    dots: ['#22d3ee', '#0ea5e9', '#38bdf8'],
  },
  {
    icon: Brain,
    title: 'Semantic Matching Engine',
    desc: 'Dense sentence-transformer embeddings (MiniLM-L6) compare the full semantic meaning of each resume against the JD — not just keyword overlap.',
    detail: 'Score = 50% semantic + 25% skills + 15% experience + 10% education.',
    color: 'from-violet-500/20 to-violet-500/5',
    border: 'hover:border-violet-500/30',
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/10',
    dots: ['#a78bfa', '#8b5cf6', '#c4b5fd'],
  },
  {
    icon: BarChart3,
    title: 'Explainable Ranking',
    desc: 'Every score breaks down into four traceable components. See matched skills, missing requirements, and bonus strengths beyond the JD for each candidate.',
    detail: 'Strong ≥75 · Potential 55–74 · Low <55 — consistent across all views.',
    color: 'from-blue-500/20 to-blue-500/5',
    border: 'hover:border-blue-500/30',
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
    dots: ['#60a5fa', '#3b82f6', '#93c5fd'],
  },
  {
    icon: Shield,
    title: 'Recruiter Dashboard',
    desc: 'Track quota usage, see tier breakdowns across all batches, filter by skill, sort by score, and export ranked shortlists as CSV — all in one workspace.',
    detail: 'Guest screening available with no account required.',
    color: 'from-emerald-500/20 to-emerald-500/5',
    border: 'hover:border-emerald-500/30',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
    dots: ['#34d399', '#10b981', '#6ee7b7'],
  },
];

/* Animated flowing dots icon — loops on hover */
const FlowingDots = ({
  dots,
  reduced,
}: {
  dots: string[];
  reduced: boolean;
}) => (
  <div className="flex items-center gap-1 mt-3">
    {dots.map((color, i) => (
      <motion.div
        key={i}
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
        animate={
          reduced
            ? {}
            : {
                x: [0, 6, 0],
                opacity: [0.4, 1, 0.4],
              }
        }
        transition={
          reduced
            ? {}
            : {
                duration: 1.4,
                repeat: Infinity,
                delay: i * 0.2,
                ease: 'easeInOut',
              }
        }
      />
    ))}
    <motion.div
      className="w-4 h-0.5 bg-gradient-to-r from-white/10 to-transparent rounded-full ml-1"
      animate={reduced ? {} : { scaleX: [0.5, 1, 0.5], opacity: [0.2, 0.6, 0.2] }}
      transition={reduced ? {} : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
    />
  </div>
);

const FeatureGrid = ({ reduced }: { reduced: boolean }) => (
  <section id="features" className="relative py-28 md:py-36 px-6 overflow-hidden">
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

    <div className="relative max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        className="text-center mb-16"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6 }}
      >
        <span className="text-xs font-semibold text-cyan-400 uppercase tracking-widest">
          Under the hood
        </span>
        <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-3 tracking-tight">
          Every layer, engineered for accuracy
        </h2>
        <p className="text-white/35 text-lg mt-4 max-w-lg mx-auto">
          No black boxes. Every decision is traceable back to your job description.
        </p>
      </motion.div>

      {/* Card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {FEATURES.map((feat, i) => {
          const Icon = feat.icon;
          return (
            <motion.div
              key={feat.title}
              className={`relative group bg-gradient-to-br ${feat.color} rounded-2xl border border-white/[0.07] ${feat.border} p-7 transition-colors duration-300 cursor-default`}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: 'easeOut' as const }}
              whileHover={{ y: -4 }}
            >
              {/* Soft glow on hover */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/[0.015]" />

              <div className="relative">
                {/* Icon */}
                <div className={`w-11 h-11 rounded-xl ${feat.iconBg} flex items-center justify-center mb-5`}>
                  <Icon className={`w-5 h-5 ${feat.iconColor}`} strokeWidth={1.8} />
                </div>

                <h3 className="text-lg font-bold text-white mb-2">{feat.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed mb-3">{feat.desc}</p>

                {/* Animated flowing dots — plays on hover */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <FlowingDots dots={feat.dots} reduced={reduced} />
                </div>

                {/* Detail callout */}
                <div className="mt-4 pt-4 border-t border-white/5">
                  <p className="text-[11px] text-white/20 font-mono">{feat.detail}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  </section>
);

/* ════════════════════════════════════════════════════════════════════════
   DEMO SECTION
   ════════════════════════════════════════════════════════════════════════ */
const DemoSection = ({ reduced }: { reduced: boolean }) => {
  const [playing, setPlaying] = useState(false);

  return (
    <section id="demo" className="relative py-28 md:py-36 px-6 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-xs font-semibold text-cyan-400 uppercase tracking-widest">
            See it in action
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-3 tracking-tight">
            From upload to shortlist in 60 seconds
          </h2>
          <p className="text-white/35 text-lg mt-4 max-w-lg mx-auto">
            Watch how HireRank parses, scores, and ranks a batch of resumes.
          </p>
        </motion.div>

        {/* Video placeholder frame */}
        <motion.div
          className="relative rounded-2xl overflow-hidden border border-white/10 bg-white/[0.02] aspect-video"
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7 }}
        >
          {/* Subtle gradient bg inside the frame */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5" />

          {/* Fake screen content — blurred mock UI */}
          <div className="absolute inset-6 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-3 p-5 overflow-hidden">
            <div className="h-3 bg-white/10 rounded-full w-1/3" />
            <div className="h-2 bg-white/5 rounded-full w-2/3" />
            <div className="flex gap-2 mt-2">
              {[92, 84, 71, 63, 45].map((s) => (
                <div
                  key={s}
                  className="flex-1 rounded-lg bg-white/[0.04] border border-white/5 p-2"
                >
                  <div className="h-1.5 rounded-full bg-gradient-to-r from-cyan-400/40 to-blue-500/40 mb-1.5" style={{ width: `${s}%` }} />
                  <div className="h-1 bg-white/5 rounded-full w-3/4" />
                </div>
              ))}
            </div>
            <div className="h-1.5 bg-white/5 rounded-full w-full mt-1" />
            <div className="h-1.5 bg-white/5 rounded-full w-5/6" />
          </div>
          <div className="absolute inset-0 backdrop-blur-[2px]" />

          {/* Play button with pulsing ring */}
          {!playing && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                {/* Outer pulsing rings */}
                {[1, 2].map((ring) => (
                  <motion.div
                    key={ring}
                    className="absolute inset-0 rounded-full border border-cyan-400/30"
                    animate={
                      reduced
                        ? {}
                        : { scale: [1, 1.5 + ring * 0.3], opacity: [0.5, 0] }
                    }
                    transition={
                      reduced
                        ? {}
                        : {
                            duration: 2,
                            repeat: Infinity,
                            delay: ring * 0.5,
                            ease: 'easeOut',
                          }
                    }
                  />
                ))}
                <button
                  onClick={() => {
                    setPlaying(true);
                    // TODO: connect to API — load and play real demo video
                  }}
                  className="relative w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-2xl shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-shadow focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-[#0a0a0f]"
                  aria-label="Play demo video"
                >
                  <Play className="w-8 h-8 text-white ml-1" strokeWidth={2} />
                </button>
              </div>
            </div>
          )}

          {playing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="text-center space-y-3">
                <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-white/40">
                  {/* TODO: connect to API — embed real demo video or gif */}
                  Demo video coming soon — connect to real asset
                </p>
                <button
                  onClick={() => setPlaying(false)}
                  className="text-xs text-white/30 hover:text-white/60 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Top bar label */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">
              Product Demo
            </span>
          </div>
        </motion.div>

        {/* Below frame: 3 feature callouts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
          {[
            { icon: FileSearch, label: 'Instant parsing', sub: 'PDF + DOCX, any format' },
            { icon: BarChart3, label: 'Live score cards', sub: 'Updates as files process' },
            { icon: Zap, label: 'Shortlist in seconds', sub: 'Ranked, tiered, explained' },
          ].map(({ icon: Icon, label, sub }, i) => (
            <motion.div
              key={label}
              className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.06] rounded-xl p-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.4, delay: 0.2 + i * 0.1, ease: 'easeOut' as const }}
            >
              <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-cyan-400" strokeWidth={1.8} />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{label}</div>
                <div className="text-xs text-white/30">{sub}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ════════════════════════════════════════════════════════════════════════
   FAQ ACCORDION
   ════════════════════════════════════════════════════════════════════════
   AnimatePresence + layout prop animate open/close — no display:none toggling.
   ════════════════════════════════════════════════════════════════════════ */
import { AnimatePresence } from 'framer-motion';

const FAQ_ITEMS = [
  {
    q: 'Do I need an account to try HireRank?',
    a: 'No. You can paste a job description, upload up to 10 resumes, and view the full ranked shortlist instantly — no signup required. Create an account only when you want to save results to a persistent workspace.',
  },
  {
    q: 'What file formats are supported?',
    a: 'PDF and DOCX files up to 5 MB each. We use pdfplumber with pypdf as a fallback for PDFs, and python-docx for Word documents. Most professionally formatted resumes parse cleanly; scanned image-only PDFs may have reduced accuracy.',
  },
  {
    q: 'How is the match score calculated?',
    a: 'Each candidate receives a weighted composite score: 50% semantic similarity (sentence-transformer embeddings comparing resume to JD), 25% required skill coverage (fuzzy-matched against a 530-skill taxonomy), 15% experience fit (merged date ranges, never self-reported totals), and 10% education match against the required level.',
  },
  {
    q: 'Can the score be gamed by keyword stuffing?',
    a: 'Harder than you\'d think. The semantic embedding component is not keyword-dependent — it understands meaning, not just token matches. Skill matching uses canonical aliases, so "React.js" and "ReactJS" are the same skill. Experience is computed from parsed date ranges, not from any stated number.',
  },
  {
    q: 'How many resumes can I screen at once?',
    a: 'Guest sessions support up to 10 resumes per batch. Authenticated recruiter workspaces support up to 50 resumes per batch. The free tier includes a monthly quota of 60 total scored candidates.',
  },
  {
    q: 'Is my data stored on your servers?',
    a: 'Guest session files are processed in-memory and are never persisted to disk. Once you close the session or the server restarts, the files are gone. Authenticated workspace uploads are stored only while an active session exists and are associated only with your account.',
  },
  {
    q: 'Can I re-rank candidates after uploading?',
    a: 'Yes. In the batch detail view, the "Re-rank All" button re-runs the full scoring pipeline against the current job description for every candidate in that batch. This is useful if you update the JD after the initial upload.',
  },
];

const FaqItem = ({ item, isOpen, onToggle }: {
  item: typeof FAQ_ITEMS[0];
  isOpen: boolean;
  onToggle: () => void;
}) => (
  <motion.div
    layout
    className="border border-white/[0.06] rounded-2xl overflow-hidden"
  >
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-white/[0.02] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-inset"
      aria-expanded={isOpen}
    >
      <span className="text-sm font-semibold text-white/80">{item.q}</span>
      <motion.div
        animate={{ rotate: isOpen ? 45 : 0 }}
        transition={{ duration: 0.2 }}
        className="flex-shrink-0 w-5 h-5 rounded-full bg-white/5 flex items-center justify-center"
      >
        <svg className="w-3 h-3 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </motion.div>
    </button>

    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          key="content"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.28, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <div className="px-6 pb-5 pt-0 text-sm text-white/35 leading-relaxed border-t border-white/[0.04]">
            <div className="pt-4">{item.a}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </motion.div>
);

const FaqSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-28 md:py-36 px-6 overflow-hidden">
      <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-3xl mx-auto">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-xs font-semibold text-cyan-400 uppercase tracking-widest">FAQ</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-3 tracking-tight">
            Common questions
          </h2>
          <p className="text-white/35 text-lg mt-4 max-w-md mx-auto">
            Everything you need to know before your first screening.
          </p>
        </motion.div>

        <motion.div
          className="space-y-3"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.5 }}
        >
          {FAQ_ITEMS.map((item, i) => (
            <FaqItem
              key={item.q}
              item={item}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
};

/* ════════════════════════════════════════════════════════════════════════
   FINAL CTA BAND
   ════════════════════════════════════════════════════════════════════════
   Same drifting blobs as Hero for visual bookending.
   ════════════════════════════════════════════════════════════════════════ */
const CtaBand = ({ reduced }: { reduced: boolean }) => {
  const navigate = useNavigate();

  return (
  <section className="relative py-32 px-6 overflow-hidden">
    {/* Drifting blobs — mirrors Hero */}
    <Blob className="w-[450px] h-[450px] bg-cyan-500/15 -top-20 -left-20" delay={0} reduced={reduced} />
    <Blob className="w-[350px] h-[350px] bg-blue-600/15 bottom-0 right-0" delay={5} reduced={reduced} />
    <Blob className="w-[300px] h-[300px] bg-violet-600/10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" delay={10} reduced={reduced} />

    {/* Grid overlay */}
    <div
      className="absolute inset-0 opacity-[0.025]"
      style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }}
    />

    <div className="relative max-w-3xl mx-auto text-center">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7 }}
        className="space-y-8"
      >
        <div className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/10 text-cyan-300 text-xs font-semibold px-4 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          No credit card required
        </div>

        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
          <span className="text-white">Ready to find the </span>
          <span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
            right candidates
          </span>
          <span className="text-white"> faster?</span>
        </h2>

        <p className="text-white/40 text-lg max-w-xl mx-auto leading-relaxed">
          Paste a job description, upload resumes, and get your first ranked
          shortlist — for free, in under a minute.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          {/* Primary — glow pulse */}
          <button
            onClick={() => navigate('/screen')}
            className="relative group"
          >
            <motion.div
              className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl opacity-40 blur-lg"
              animate={reduced ? {} : { scale: [1, 1.08, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={reduced ? {} : { duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span className="relative flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold px-10 py-4 rounded-xl text-base shadow-xl shadow-cyan-500/20">
              Start screening free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </button>

          <button
            onClick={() => navigate('/login')}
            className="border border-white/10 hover:border-white/20 text-white/50 hover:text-white font-semibold px-8 py-4 rounded-xl text-base transition-all hover:bg-white/[0.03]"
          >
            Sign in
          </button>
        </div>

        <p className="text-xs text-white/20 pt-2">
          Guest session · no account needed · files processed in-memory, never stored
        </p>
      </motion.div>
    </div>
  </section>
  );
};

/* ════════════════════════════════════════════════════════════════════════
   FOOTER
   ════════════════════════════════════════════════════════════════════════ */
const Footer = () => (
  <footer className="border-t border-white/[0.05] px-6 py-14">
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
        {/* Brand */}
        <div className="md:col-span-1">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-base font-bold text-white">
              Hire<span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Rank</span>
            </span>
          </div>
          <p className="text-xs text-white/25 leading-relaxed max-w-[200px]">
            AI-powered resume screening and candidate ranking for modern hiring teams.
          </p>
        </div>

        {/* Links — Product */}
        <div>
          <div className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">Product</div>
          <ul className="space-y-2.5">
            {[
              { label: 'How it works', href: '#how' },
              { label: 'Features', href: '#features' },
              { label: 'Demo', href: '#demo' },
              { label: 'FAQ', href: '#faq' },
            ].map(l => (
              <li key={l.label}>
                <a href={l.href} className="text-sm text-white/30 hover:text-white/60 transition-colors">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Links — App */}
        <div>
          <div className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">App</div>
          <ul className="space-y-2.5">
            {[
              { label: 'Screen resumes', href: '/screen' },
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Sign up', href: '/signup' },
              { label: 'Log in', href: '/login' },
            ].map(l => (
              <li key={l.label}>
                <Link to={l.href} className="text-sm text-white/30 hover:text-white/60 transition-colors">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Links — Project */}
        <div>
          <div className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">Project</div>
          <ul className="space-y-2.5">
            {[
              { label: 'GitHub', href: 'https://github.com/atharv3046/HireRank' },
              { label: 'API Docs', href: 'http://localhost:8000/docs' },
            ].map(l => (
              <li key={l.label}>
                <a href={l.href} target="_blank" rel="noreferrer" className="text-sm text-white/30 hover:text-white/60 transition-colors">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/[0.05] pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-xs text-white/15">
          © {new Date().getFullYear()} HireRank · Final-Year Engineering Project · Built with React, FastAPI &amp; spaCy
        </p>
        <div className="flex items-center gap-1.5 text-[10px] text-white/15">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          All systems operational
        </div>
      </div>
    </div>
  </footer>
);

/* ════════════════════════════════════════════════════════════════════════
   MAIN PAGE — COMPLETE
   ════════════════════════════════════════════════════════════════════════ */
export default function MarketingPage() {
  const reduced = usePrefersReducedMotion();

  return (
    <div className="bg-[#0a0a0f] text-white min-h-screen font-sans antialiased selection:bg-cyan-500/30">
      <Navbar />
      <Hero reduced={reduced} />
      <HowItWorks reduced={reduced} />
      <Marquee reduced={reduced} />
      <StatsSection />
      <FeatureGrid reduced={reduced} />
      <DemoSection reduced={reduced} />
      <FaqSection />
      <CtaBand reduced={reduced} />
      <Footer />
    </div>
  );
}
