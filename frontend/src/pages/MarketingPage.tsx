/**
 * MarketingPage.tsx - HireRank Landing Page
 *
 * Redesigned per modern editorial aesthetic:
 *  - Left-aligned headline with Instrument Serif typography
 *  - Single unified accent (--accent: #5eead4)
 *  - Flat, crisp buttons without neon glows or 3D extrusions
 *  - Authentic product mock card on the right with 84 match score ring & parsed skills
 *  - Wireframe sphere canvas positioned softly behind the mock (keeping text crystal clear)
 *  - Single row stats with dividers and credible metrics
 *  - Numbered steps joined by connecting line with simple Lucide icons
 *  - Single marquee row with CSS mask fade and deduplicated roles
 *  - High-contrast body text with readable muted tones
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ChevronDown, Menu, X, ArrowRight,
  Shield, Brain, BarChart3, FileSearch, Sparkles, CheckCircle2,
  UploadCloud, Cpu, Layers, ListOrdered
} from 'lucide-react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import HeroCanvas from '../components/HeroCanvas';

/* ── Reduced-motion hook ─────────────────────────────────────────── */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const h = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return reduced;
}

/* ── Card Spotlight Hover Effect ─────────────────────────────────── */
function SpotlightCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: -1000, y: -1000 });
  const [isHovered, setIsHovered] = useState(false);

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={onMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setPos({ x: -1000, y: -1000 });
      }}
      className={`relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[#0d0f14]/80 backdrop-blur-sm transition-colors duration-200 ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(380px circle at ${pos.x}px ${pos.y}px, rgba(94, 234, 212, 0.08), transparent 75%)`,
        }}
      />
      {children}
    </div>
  );
}

/* ── CSS KEYFRAMES ───────────────────────────────────────────────── */
const GLOBAL_STYLES = `
  @keyframes marqueeLeft {
    from { transform: translate3d(0, 0, 0); }
    to   { transform: translate3d(-50%, 0, 0); }
  }
`;

/* ── Logo ────────────────────────────────────────────────────────── */
function HireRankLogo({ height = 28 }: { height?: number }) {
  const fontSize = Math.round(height * 0.58);
  return (
    <span
      style={{
        fontSize: `${fontSize}px`,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        lineHeight: 1,
      }}
      className="text-[var(--text)] tracking-tight font-sans"
    >
      Hire<span className="text-[var(--accent)]">Rank</span>
    </span>
  );
}

/* ── Navbar ──────────────────────────────────────────────────────── */
const NAV_LINKS = [
  { label: 'How It Works', href: '#how', chevron: false },
  { label: 'Features', href: '#features', chevron: false },
  { label: 'Demo', href: '#demo', chevron: false },
  { label: 'FAQ', href: '#faq', chevron: false },
];

function Navbar() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <nav
        className={`sticky top-0 z-50 flex items-center justify-between px-6 md:px-12 h-18 transition-all duration-200 ${
          scrolled
            ? 'bg-[#08090c]/85 backdrop-blur-xl border-b border-[var(--line)] shadow-sm'
            : 'bg-transparent'
        }`}
        style={{ height: '4.5rem' }}
      >
        <Link to="/" className="flex items-center gap-2.5" aria-label="HireRank home">
          <div className="w-7 h-7 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] font-bold text-xs">
            HR
          </div>
          <HireRankLogo height={32} />
        </Link>

        <div className="hidden md:flex items-center gap-8 text-[14px]">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-[var(--muted)] hover:text-[var(--text)] transition-colors duration-150"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <Link
            to="/login"
            className="text-[14px] text-[var(--muted)] hover:text-[var(--text)] transition-colors duration-150 px-2 py-1"
          >
            Sign In
          </Link>
          <button
            id="navbar-cta"
            onClick={() => navigate(isAuthenticated ? '/dashboard' : '/screen')}
            className="btn-primary text-xs py-2.5 px-4.5"
          >
            {isAuthenticated ? 'Dashboard' : 'Get Started'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          id="mobile-menu-open"
          onClick={() => setMobileOpen(true)}
          className="md:hidden text-[var(--muted)] hover:text-[var(--text)] p-2 transition-colors rounded-lg border border-[var(--line)]"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" strokeWidth={1.8} />
        </button>
      </nav>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-50 bg-[#08090c]/98 backdrop-blur-2xl flex flex-col px-8 pt-8 pb-12"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <div className="flex items-center justify-between mb-12">
              <Link to="/" onClick={() => setMobileOpen(false)}>
                <HireRankLogo height={28} />
              </Link>
              <button
                id="mobile-menu-close"
                onClick={() => setMobileOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--text)] p-2 rounded-lg border border-[var(--line)]"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" strokeWidth={1.8} />
              </button>
            </div>
            <div className="flex flex-col gap-6 flex-1">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-xl text-[var(--muted)] hover:text-[var(--text)] transition-colors"
                >
                  {l.label}
                </a>
              ))}
            </div>
            <div className="border-t border-[var(--line)] pt-8 flex flex-col gap-4">
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="text-base text-[var(--muted)] hover:text-[var(--text)] py-2"
              >
                Sign In
              </Link>
              <button
                onClick={() => {
                  setMobileOpen(false);
                  navigate('/screen');
                }}
                className="btn-primary w-full"
              >
                Get Started Free
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ── Hero Product Mock Component ─────────────────────────────────── */
function HeroProductMock({ reduced }: { reduced: boolean }) {
  return (
    <div className="relative w-full max-w-lg mx-auto lg:max-w-none">
      {/* 3D Wireframe sphere positioned softly behind the mock */}
      <div className="absolute -inset-10 opacity-30 pointer-events-none -z-10 flex items-center justify-center overflow-visible">
        <HeroCanvas reduced={reduced} className="w-[125%] h-[125%]" />
      </div>

      {/* Product mock card */}
      <div className="relative rounded-2xl bg-[#0d0f14]/95 border border-white/[0.1] p-6 shadow-2xl backdrop-blur-xl">
        {/* Candidate header + match ring */}
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-[var(--line)]">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-[var(--accent-dim)] border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] font-semibold text-sm">
              AC
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-[var(--text)]">Alex Chen</h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  Verified
                </span>
              </div>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Senior Backend Engineer · 6 yrs exp · San Francisco, CA
              </p>
            </div>
          </div>

          {/* 84 Strong Match Ring */}
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="relative w-14 h-14 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="3.5"
                  fill="none"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="var(--accent)"
                  strokeWidth="3.5"
                  fill="none"
                  strokeDasharray="125.6"
                  strokeDashoffset={125.6 * (1 - 0.84)}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-base font-bold text-[var(--text)] tabular-nums">
                84
              </span>
            </div>
            <span className="text-[10px] font-semibold text-[var(--accent)] tracking-wider uppercase mt-1">
              Strong match
            </span>
          </div>
        </div>

        {/* Applied role & multi-factor breakdown */}
        <div className="py-4 border-b border-[var(--line)]">
          <div className="flex items-center justify-between text-xs mb-3">
            <span className="text-[var(--muted)]">
              Target Role:{' '}
              <strong className="text-[var(--text)] font-medium">
                Senior Python / Distributed Systems
              </strong>
            </span>
            <span className="text-[11px] text-[var(--muted)] font-mono">Rank #1 of 50</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-[var(--line)]">
              <span className="text-[11px] text-[var(--muted)] block">Semantic Fit</span>
              <span className="text-xs font-bold text-[var(--text)] mt-0.5 block">88%</span>
            </div>
            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-[var(--line)]">
              <span className="text-[11px] text-[var(--muted)] block">Skill Match</span>
              <span className="text-xs font-bold text-[var(--text)] mt-0.5 block">84%</span>
            </div>
            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-[var(--line)]">
              <span className="text-[11px] text-[var(--muted)] block">Experience</span>
              <span className="text-xs font-bold text-[var(--text)] mt-0.5 block">80%</span>
            </div>
          </div>
        </div>

        {/* Parsed skills section */}
        <div className="py-4 border-b border-[var(--line)]">
          <span className="text-[11px] font-medium text-[var(--muted)] uppercase tracking-wider block mb-2.5">
            Parsed Skills Coverage
          </span>
          <div className="flex flex-wrap gap-1.5">
            {['Python', 'FastAPI', 'PostgreSQL', 'Docker', 'Redis', 'Celery'].map((s) => (
              <span
                key={s}
                className="text-xs px-2.5 py-1 rounded-md bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/20 font-medium"
              >
                ✓ {s}
              </span>
            ))}
            <span className="text-xs px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/25 font-medium flex items-center gap-1">
              ✕ Missing: Kubernetes
            </span>
          </div>
        </div>

        {/* Evidence extraction snippet */}
        <div className="pt-3.5 flex items-center justify-between text-xs">
          <p className="text-[var(--muted)] truncate max-w-[300px]">
            <span className="text-[var(--text)] font-medium">Evidence:</span> "Scaled async pipelines to 15k req/s using FastAPI & Redis..."
          </p>
          <span className="text-[var(--accent)] font-medium hover:underline cursor-pointer flex-shrink-0">
            View breakdown →
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Hero Section ────────────────────────────────────────────────── */
function Hero({ reduced }: { reduced: boolean }) {
  const navigate = useNavigate();

  return (
    <section id="hero" className="relative px-6 md:px-12 pt-8 pb-20 min-h-[85vh] flex items-center">
      <div className="max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Headline and Actions */}
          <div className="lg:col-span-7 text-left">
            {/* Plain text eyebrow badge */}
            <div className="inline-flex items-center text-xs tracking-wider uppercase text-[var(--muted)] border border-[var(--line)] px-3 py-1 rounded-md mb-6 font-mono bg-white/[0.02]">
              Resume screening, explained
            </div>

            {/* Editorial Headline */}
            <h1 className="hero-title mb-6">
              Screen Smart.<br />
              <em>Hire Better.</em>
            </h1>

            {/* High-contrast subtitle */}
            <p className="text-[17px] leading-relaxed text-[var(--muted)] mb-8 max-w-lg">
              Instant multi-factor resume ranking with explainable AI scores.
              Upload candidates, paste a JD, and get your shortlist in 60 seconds.
            </p>

            {/* Flat CTA row */}
            <div className="flex flex-wrap items-center gap-4 mb-8">
              <button
                id="hero-cta"
                onClick={() => navigate('/screen')}
                className="btn-primary"
              >
                Get Started Free
                <ArrowRight className="w-4 h-4" />
              </button>

              <a href="#how" className="btn-ghost">
                See how it works
              </a>
            </div>

            {/* Plain trust facts */}
            <div className="flex flex-wrap items-center gap-6 text-xs text-[var(--muted)]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                60s processing
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                Bias-free blind mode
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                No credit card required
              </span>
            </div>
          </div>

          {/* Right Column: Real Product Mock */}
          <div className="lg:col-span-5">
            <HeroProductMock reduced={reduced} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Stats Section (Single Row with Dividers) ────────────────────── */
function StatsSection() {
  return (
    <section className="border-t border-b border-[var(--line)] my-12 bg-transparent">
      <div className="max-w-6xl mx-auto stats-grid">
        <div className="hover:bg-white/[0.02]">
          <b>50</b>
          <span>resumes per batch</span>
        </div>
        <div className="hover:bg-white/[0.02]">
          <b>~4×</b>
          <span>faster than manual review</span>
        </div>
        <div className="hover:bg-white/[0.02]">
          <b>PDF · DOCX</b>
          <span>supported formats</span>
        </div>
        <div className="hover:bg-white/[0.02]">
          <b>Per-skill</b>
          <span>score breakdown</span>
        </div>
      </div>
    </section>
  );
}

/* ── How It Works (Numbered Steps with Connecting Line) ──────────── */
const STEPS = [
  {
    num: '01',
    icon: UploadCloud,
    title: 'Upload resumes and JD',
    desc: 'Drop in candidate resumes in PDF or DOCX format alongside the target job description. No signup needed.',
  },
  {
    num: '02',
    icon: Cpu,
    title: 'NLP entity extraction',
    desc: 'Dual-engine parser extracts technical skills, career timelines, and education qualifications automatically.',
  },
  {
    num: '03',
    icon: Layers,
    title: 'Multi-factor scoring',
    desc: 'Dense sentence embeddings measure semantic depth, skill coverage, and experience requirements.',
  },
  {
    num: '04',
    icon: ListOrdered,
    title: 'Ranked candidate shortlist',
    desc: 'Receive transparent tiered rankings with verified matches and missing requirements in under 60 seconds.',
  },
];

function HowItWorks() {
  return (
    <section id="how" className="py-24 px-6 md:px-12 border-t border-[var(--line)]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)] mb-3">
            Workflow
          </p>
          <h2 className="text-3xl md:text-5xl font-extrabold text-[var(--text)] tracking-tight">
            From JD to ranked shortlist in 60s
          </h2>
          <p className="text-[var(--muted)] mt-3 text-base max-w-md mx-auto">
            Four transparent steps. Zero guesswork. Every score explained.
          </p>
        </div>

        <div className="steps-row">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.num} className="flex flex-col items-center text-center">
                <div className="step-num mb-6">
                  {step.num}
                </div>
                <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-[var(--line)] flex items-center justify-center mb-4 text-[var(--accent)]">
                  <Icon className="w-5 h-5" strokeWidth={1.8} />
                </div>
                <h3 className="text-base font-semibold text-[var(--text)] mb-2">
                  {step.title}
                </h3>
                <p className="step-desc max-w-[240px]">
                  {step.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Marquee Section (Single Row, No Duplicates, CSS Mask Fade) ──── */
const MARQUEE_ROLES = [
  'Backend Engineers',
  'Frontend Developers',
  'Full-Stack Engineers',
  'DevOps Engineers',
  'Data Scientists',
  'Machine Learning Engineers',
  'Site Reliability Engineers',
  'Cloud Architects',
  'Product Managers',
  'Security Engineers',
  'QA Automation Engineers',
  'Engineering Managers',
  'AI Researchers',
  'UI/UX Designers',
];

function MarqueeSection() {
  const row = [...MARQUEE_ROLES, ...MARQUEE_ROLES];
  return (
    <section className="py-16 overflow-hidden border-t border-[var(--line)] group/marquee">
      <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-[var(--muted)] mb-7">
        Screening talent across technical disciplines
      </p>
      <div
        className="relative overflow-hidden"
        style={{
          maskImage: 'linear-gradient(to right, transparent, black 12%, black 88%, transparent)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, black 12%, black 88%, transparent)',
        }}
      >
        <div
          className="marquee-track flex gap-3 w-max group-hover/marquee:[animation-play-state:paused]"
          style={{ animation: 'marqueeLeft 36s linear infinite' }}
        >
          {row.map((r, i) => (
            <span
              key={i}
              className="px-4 py-2 rounded-lg border border-[var(--line)] bg-white/[0.02] text-sm text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent-dim)] transition-colors duration-150 whitespace-nowrap cursor-default"
            >
              {r}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Feature Grid (Spotlight Cards, Crisp Typography) ────────────── */
const FEATURES = [
  {
    icon: FileSearch,
    title: 'Intelligent Parsing',
    desc: 'Extracts skills, career timelines, education, and credentials from any PDF or DOCX using rule-based NLP with fuzzy alias matching.',
    detail: 'Handles aliases like ReactJS, React.js, and React automatically.',
  },
  {
    icon: Brain,
    title: 'Semantic Matching',
    desc: 'Dense sentence-transformer embeddings compare contextual depth of each resume against the JD, beyond mere keywords.',
    detail: 'Composite score: 50% semantic + 25% skills + 15% experience + 10% education.',
  },
  {
    icon: BarChart3,
    title: 'Explainable Ranking',
    desc: 'Every score breaks down into traceable components. Inspect verified matched skills, missing requirements, and bonus strengths.',
    detail: 'Tiered classification: Strong (75+), Potential (55-74), Low (<55).',
  },
  {
    icon: Shield,
    title: 'Bias-Free Screening',
    desc: 'Blind mode masks candidate names, contact details, institution prestige, and graduation years to mitigate unconscious hiring bias.',
    detail: 'NYC Local Law 144 compliance support built in.',
  },
];

function FeatureGrid() {
  return (
    <section id="features" className="py-24 px-6 md:px-12 border-t border-[var(--line)]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)] mb-3">
            Under the hood
          </p>
          <h2 className="text-3xl md:text-5xl font-extrabold text-[var(--text)] tracking-tight">
            Engineered for transparent accuracy
          </h2>
          <p className="text-[var(--muted)] mt-3 text-base max-w-lg mx-auto">
            Zero hallucinated scores. Every decision is verifiable and traceable back to the JD.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <SpotlightCard key={feat.title} className="p-8 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)]/20 flex items-center justify-center mb-6 text-[var(--accent)]">
                    <Icon className="w-6 h-6" strokeWidth={1.8} />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--text)] mb-2.5">
                    {feat.title}
                  </h3>
                  <p className="text-sm text-[var(--muted)] leading-relaxed mb-6">
                    {feat.desc}
                  </p>
                </div>
                <div className="pt-4 border-t border-[var(--line)]">
                  <p className="text-xs text-[var(--accent)] font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                    {feat.detail}
                  </p>
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Live Demo Preview Section ───────────────────────────────────── */
function DemoSection() {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const [activeTab, setActiveTab] = useState<'preview' | 'video'>('preview');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setVideoPlaying(true);
    } else {
      v.pause();
      setVideoPlaying(false);
    }
  };
  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setVideoMuted(v.muted);
  };

  const MOCK = [
    { name: 'Sarah Chen', score: 94, label: 'Strong' },
    { name: 'Alex Rivera', score: 86, label: 'Strong' },
    { name: 'David Kim', score: 72, label: 'Potential' },
    { name: 'Elena Rostova', score: 64, label: 'Potential' },
    { name: 'Marcus Brody', score: 48, label: 'Low' },
  ];

  return (
    <section id="demo" className="py-24 px-6 md:px-12 border-t border-[var(--line)]">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)] mb-3">
            Interactive Preview
          </p>
          <h2 className="text-3xl md:text-5xl font-extrabold text-[var(--text)] tracking-tight">
            From upload to shortlist in 60s
          </h2>
          <p className="text-[var(--muted)] mt-3 text-base max-w-md mx-auto">
            Instant multi-candidate evaluation with ranked score distributions.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex justify-center mb-8">
          <div className="flex gap-1 bg-white/[0.03] border border-[var(--line)] rounded-xl p-1">
            {([
              { key: 'preview', label: '⚡ Live Preview' },
              { key: 'video',   label: '▶ Watch Demo' },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-5 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  activeTab === tab.key
                    ? 'text-[var(--text)] bg-[var(--accent-dim)] border border-[var(--accent)]/30'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div ref={ref} className="mb-10">
          {activeTab === 'preview' ? (
            <SpotlightCard className="overflow-hidden">
              {/* Header bar */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line)] bg-white/[0.01]">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                  <span className="text-xs text-[var(--muted)] font-medium uppercase tracking-wider">
                    Senior Backend Engineer Screening
                  </span>
                </div>
                <span className="text-xs text-[var(--accent)] font-mono bg-[var(--accent-dim)] px-2.5 py-0.5 rounded-md border border-[var(--accent)]/20">
                  5 Resumes Ranked
                </span>
              </div>

              {/* Candidate list */}
              <div className="p-6 space-y-3.5">
                {MOCK.map((c, i) => (
                  <div
                    key={c.name}
                    className="flex items-center gap-4 p-2.5 rounded-lg hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="w-7 h-7 rounded-md bg-white/[0.04] border border-[var(--line)] flex items-center justify-center flex-shrink-0 text-xs font-semibold text-[var(--muted)]">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-[var(--text)]">{c.name}</span>
                        <span className="text-sm font-semibold tabular-nums text-[var(--text)]">
                          {c.score}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-[var(--accent)]"
                          initial={{ width: 0 }}
                          animate={inView ? { width: `${c.score}%` } : { width: 0 }}
                          transition={{ duration: 0.8, delay: 0.2 + i * 0.1, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-medium rounded px-2 py-0.5 border ${
                        c.label === 'Strong'
                          ? 'bg-[var(--accent-dim)] text-[var(--accent)] border-[var(--accent)]/20'
                          : c.label === 'Potential'
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                      }`}
                    >
                      {c.label}
                    </span>
                  </div>
                ))}
              </div>
            </SpotlightCard>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border border-[var(--line)] bg-black shadow-2xl group/video">
              <video
                ref={videoRef}
                src="/demo.mp4"
                className="w-full aspect-video object-cover"
                loop
                playsInline
                preload="metadata"
                onPlay={() => setVideoPlaying(true)}
                onPause={() => setVideoPlaying(false)}
              />

              {!videoPlaying && (
                <div
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center cursor-pointer bg-black/50 backdrop-blur-sm"
                  onClick={togglePlay}
                >
                  <div className="w-20 h-20 rounded-full bg-white/10 border border-white/20 backdrop-blur flex items-center justify-center hover:scale-110 hover:bg-[var(--accent-dim)] hover:border-[var(--accent)]/40 transition-all duration-200">
                    <svg className="w-8 h-8 text-white ml-1" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <p className="mt-4 text-sm text-[var(--muted)] font-medium">Watch the 60-second platform walkthrough</p>
                </div>
              )}

              <div className="absolute bottom-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover/video:opacity-100 transition-opacity duration-200">
                <button
                  onClick={togglePlay}
                  className="flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium transition-colors"
                >
                  {videoPlaying ? (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  )}
                  {videoPlaying ? 'Pause' : 'Play'}
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-[var(--accent)] font-mono bg-[var(--accent-dim)] border border-[var(--accent)]/20 px-2 py-0.5 rounded-full">Platform Demo • 60s</span>
                  <button
                    onClick={toggleMute}
                    className="text-white/60 hover:text-white transition-colors"
                    title={videoMuted ? 'Unmute' : 'Mute'}
                  >
                    {videoMuted ? (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
                    ) : (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z" /></svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="text-center">
          <button
            id="demo-cta"
            onClick={() => navigate('/screen')}
            className="btn-primary"
          >
            Start a free screening
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

/* ── FAQ Section ─────────────────────────────────────────────────── */
const FAQ_ITEMS = [
  {
    q: 'Do I need an account to try HireRank?',
    a: 'No. You can paste a job description, upload up to 10 resumes, and view the full ranked shortlist instantly, no signup required. Create an account only when you want to save results to a persistent workspace.',
  },
  {
    q: 'What file formats are supported?',
    a: 'PDF and DOCX files up to 10 MB each. Standard resume layouts parse cleanly with our dual-engine extraction pipeline.',
  },
  {
    q: 'How is the match score calculated?',
    a: 'Each candidate receives an explainable composite score: 50% semantic similarity, 25% required skill coverage, 15% experience fit (parsed date ranges), and 10% education match.',
  },
  {
    q: 'Can the score be gamed by keyword stuffing?',
    a: 'Dense sentence embeddings evaluate context and semantic relevance, not raw keyword repetitions. Career depth is validated against parsed chronological milestones.',
  },
  {
    q: 'How many resumes can I screen at once?',
    a: 'Guest sessions support up to 10 resumes per batch. Authenticated recruiter workspaces support up to 50 resumes per batch.',
  },
  {
    q: 'Is my data stored on your servers?',
    a: 'Guest session files are processed in-memory and never stored to disk. Authenticated workspace uploads are encrypted and associated strictly with your workspace.',
  },
];

function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24 px-6 md:px-12 border-t border-[var(--line)]">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)] mb-3">
            FAQ
          </p>
          <h2 className="text-3xl md:text-5xl font-extrabold text-[var(--text)] tracking-tight">
            Frequently asked questions
          </h2>
          <p className="text-[var(--muted)] mt-3 text-base">
            Essential facts about the screening and scoring engine.
          </p>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div
                key={item.q}
                className="border border-[var(--line)] rounded-xl overflow-hidden bg-white/[0.01]"
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-white/[0.02] transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-semibold text-[var(--text)]">{item.q}</span>
                  <span className="text-[var(--accent)] text-lg leading-none font-mono">
                    {isOpen ? '−' : '+'}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 pt-1 text-sm text-[var(--muted)] leading-relaxed border-t border-[var(--line)]">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Final CTA Band ──────────────────────────────────────────────── */
function CtaBand() {
  const navigate = useNavigate();

  return (
    <section className="py-24 px-6 md:px-12 border-t border-[var(--line)] text-center">
      <div className="max-w-3xl mx-auto space-y-6">
        <h2 className="text-3xl md:text-5xl font-extrabold text-[var(--text)] leading-tight tracking-tight">
          Ready to find your best candidates faster?
        </h2>
        <p className="text-[var(--muted)] text-base md:text-lg max-w-xl mx-auto leading-relaxed">
          Paste your job description, upload resumes, and receive your ranked shortlist free in under a minute.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <button
            id="final-cta-primary"
            onClick={() => navigate('/screen')}
            className="btn-primary"
          >
            Start screening free
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            id="final-cta-secondary"
            onClick={() => navigate('/login')}
            className="btn-ghost"
          >
            Sign in
          </button>
        </div>
        <p className="text-xs text-[var(--muted)] pt-2 flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[var(--accent)]" />
          No account required to test. Processed securely in-memory.
        </p>
      </div>
    </section>
  );
}

/* ── Footer ──────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="border-t border-[var(--line)] px-6 md:px-12 py-16 text-xs text-[var(--muted)]">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div>
            <div className="mb-4">
              <HireRankLogo height={28} />
            </div>
            <p className="leading-relaxed max-w-[240px]">
              AI-powered resume screening, explainable candidate ranking, and skill gap assessment for engineering hiring teams.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text)] mb-4">Product</p>
            <ul className="space-y-2.5">
              {['How it Works', 'Features', 'Demo', 'FAQ'].map((l) => (
                <li key={l}>
                  <a href={`#${l.toLowerCase().replace(/\s+/g, '')}`} className="hover:text-[var(--text)] transition-colors">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text)] mb-4">Application</p>
            <ul className="space-y-2.5">
              {[
                { label: 'Screen Resumes', href: '/screen' },
                { label: 'Dashboard', href: '/dashboard' },
                { label: 'Sign Up', href: '/signup' },
                { label: 'Log In', href: '/login' },
              ].map((l) => (
                <li key={l.label}>
                  <Link to={l.href} className="hover:text-[var(--text)] transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text)] mb-4">Legal & Source</p>
            <ul className="space-y-2.5">
              <li>
                <Link to="/privacy" className="hover:text-[var(--text)] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-[var(--text)] transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/atharv3046/HireRank"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[var(--text)] transition-colors"
                >
                  GitHub Repository
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[var(--line)] pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} HireRank. Final-Year Engineering Project. Built with React, FastAPI, and spaCy.</p>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="hover:text-[var(--text)] transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-[var(--text)] transition-colors">Terms</Link>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              All systems operational
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ── Page Root ───────────────────────────────────────────────────── */
export default function MarketingPage() {
  const reduced = usePrefersReducedMotion();

  return (
    <div className="text-[var(--text)] min-h-screen font-sans antialiased overflow-x-hidden selection:bg-[var(--accent)]/20">
      <style>{GLOBAL_STYLES}</style>

      <Navbar />
      <Hero reduced={reduced} />
      <StatsSection />
      <HowItWorks />
      <MarqueeSection />
      <FeatureGrid />
      <DemoSection />
      <FaqSection />
      <CtaBand />
      <Footer />
    </div>
  );
}
