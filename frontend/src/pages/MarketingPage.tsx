/**
 * MarketingPage.tsx - HireRank Landing Page
 * Features:
 *  - 3D tactile push-depth buttons with specular light beams and neon glow
 *  - 3D interactive tilt cards with holographic glass glare tracking the cursor
 *  - 3D floating hero headline with animated gradient glow & live pulsing eyebrow badge
 *  - Sweeping cyber laser scanner on the interactive demo card
 *  - Dynamic step connector beam and floating 3D orb icons
 *  - Interactive role marquee with hover freeze & neon highlights
 *  - Transparent outer wrapper ensuring GlobalBackground cursor constellation is visible
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ChevronDown, Menu, X, ArrowRight,
  Shield, Brain, BarChart3, FileSearch, Sparkles, CheckCircle2
} from 'lucide-react';
import { motion, useInView, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import HeroCanvas from '../components/HeroCanvas';
import MiniOrbCanvas from '../components/MiniOrbCanvas';
import ParticleFieldCanvas from '../components/ParticleFieldCanvas';

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

/* ── 3-D mouse-tilt card wrapper with Holographic Glare (Zero Re-render) ── */
function TiltCard({
  children,
  className = '',
  accentColor = '#22d3ee',
}: {
  children: React.ReactNode;
  className?: string;
  accentColor?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef<DOMRect | null>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotX = useSpring(useTransform(y, [-1, 1], [9, -9]), { stiffness: 220, damping: 22 });
  const rotY = useSpring(useTransform(x, [-1, 1], [-9, 9]),  { stiffness: 220, damping: 22 });
  const scale = useSpring(1, { stiffness: 300, damping: 20 });

  const onEnter = useCallback(() => {
    scale.set(1.02);
    if (ref.current) rectRef.current = ref.current.getBoundingClientRect();
  }, [scale]);

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = rectRef.current || (ref.current ? (rectRef.current = ref.current.getBoundingClientRect()) : null);
    if (!rect) return;
    const nx = ((e.clientX - rect.left) / rect.width  - 0.5) * 2;
    const ny = ((e.clientY - rect.top)  / rect.height - 0.5) * 2;
    x.set(nx);
    y.set(ny);

    if (glareRef.current) {
      const gx = ((e.clientX - rect.left) / rect.width) * 100;
      const gy = ((e.clientY - rect.top) / rect.height) * 100;
      glareRef.current.style.background = `radial-gradient(circle 240px at ${gx}% ${gy}%, rgba(255, 255, 255, 0.16), transparent 75%)`;
      glareRef.current.style.opacity = '1';
    }
  }, [x, y]);

  const onLeave = useCallback(() => {
    rectRef.current = null;
    x.set(0);
    y.set(0);
    scale.set(1);
    if (glareRef.current) {
      glareRef.current.style.opacity = '0';
    }
  }, [x, y, scale]);

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onMouseEnter={onEnter}
      style={{
        rotateX: rotX,
        rotateY: rotY,
        scale,
        transformStyle: 'preserve-3d',
        perspective: 900,
        willChange: 'transform',
      }}
      className={`relative overflow-hidden group/card ${className}`}
    >
      {/* Dynamic Specular Holographic Glare that tracks cursor */}
      <div
        ref={glareRef}
        className="absolute inset-0 pointer-events-none transition-opacity duration-300 z-30 opacity-0"
      />
      {/* Subtle glowing accent border on hover */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none z-20"
        style={{
          boxShadow: `inset 0 0 0 1px ${accentColor}40, 0 0 20px ${accentColor}15`,
        }}
      />
      {children}
    </motion.div>
  );
}

/* ── 3-D Tactile Button Component ────────────────────────────────── */
function Button3D({
  children,
  onClick,
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  id,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'secondary' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  id?: string;
}) {
  const ref = useRef<any>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotX = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), { stiffness: 350, damping: 25 });
  const rotY = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), { stiffness: 350, damping: 25 });

  const onEnter = () => {
    if (ref.current) rectRef.current = ref.current.getBoundingClientRect();
  };

  const onMove = (e: React.MouseEvent) => {
    const rect = rectRef.current || (ref.current ? (rectRef.current = ref.current.getBoundingClientRect()) : null);
    if (!rect) return;
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const onLeave = () => {
    rectRef.current = null;
    x.set(0);
    y.set(0);
  };

  const sizeClasses = {
    sm: 'px-4 py-2 text-xs',
    md: 'px-7 py-3.5 text-sm',
    lg: 'px-9 py-4 text-base',
  }[size];

  const motionProps = {
    ref,
    id,
    onMouseEnter: onEnter,
    onMouseMove: onMove,
    onMouseLeave: onLeave,
    style: {
      rotateX: rotX,
      rotateY: rotY,
      transformStyle: 'preserve-3d' as const,
      perspective: 600,
      willChange: 'transform',
    },
    whileHover: { scale: 1.05 },
    whileTap: { scale: 0.96, translateY: 3 },
    transition: { type: 'spring' as const, stiffness: 350, damping: 22 },
  };

  if (variant === 'primary') {
    const inner = (
      <>
        {/* Pulsing neon aura under button */}
        <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 opacity-60 blur-md group-hover:opacity-100 group-hover:blur-xl transition-all duration-300" />

        {/* 3D bottom bevel extrusion */}
        <div className="absolute inset-0 translate-y-1.5 rounded-xl bg-gradient-to-b from-cyan-600 to-blue-800 shadow-lg" />

        {/* Top button surface with tactile gloss */}
        <div className={`relative rounded-xl bg-gradient-to-b from-cyan-300 via-cyan-400 to-blue-500 text-black ${sizeClasses} font-bold flex items-center justify-center gap-2 shadow-[inset_0_1px_2px_rgba(255,255,255,0.95),inset_0_-2px_4px_rgba(0,0,0,0.3)] overflow-hidden transition-all duration-200`}>
          {/* Animated specular light beam sweep */}
          <div className="absolute inset-0 -translate-x-[150%] group-hover:translate-x-[150%] bg-gradient-to-r from-transparent via-white/60 to-transparent transition-transform duration-1000 ease-out pointer-events-none" />
          <span className="relative z-10 flex items-center gap-2 drop-shadow-[0_1px_0_rgba(255,255,255,0.7)]">
            {children}
          </span>
        </div>
      </>
    );

    if (href) {
      return (
        <motion.a
          {...motionProps}
          href={href}
          className={`group relative inline-block select-none cursor-pointer rounded-xl ${className}`}
        >
          {inner}
        </motion.a>
      );
    }

    return (
      <motion.button
        {...motionProps}
        onClick={onClick}
        className={`group relative select-none cursor-pointer rounded-xl ${className}`}
      >
        {inner}
      </motion.button>
    );
  }

  // Secondary / Glass variant
  const glassInner = (
    <>
      <div className="absolute -inset-0.5 rounded-xl bg-cyan-500/25 opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-300" />
      <div className={`relative rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.12] hover:border-cyan-400/50 text-white/80 hover:text-white ${sizeClasses} font-medium flex items-center justify-center gap-2 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.15)] transition-all duration-300 overflow-hidden`}>
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-800 ease-out pointer-events-none" />
        <span className="relative z-10 flex items-center gap-2">
          {children}
        </span>
      </div>
    </>
  );

  if (href) {
    return (
      <motion.a
        {...motionProps}
        href={href}
        className={`group relative inline-block select-none cursor-pointer rounded-xl ${className}`}
      >
        {glassInner}
      </motion.a>
    );
  }

  return (
    <motion.button
      {...motionProps}
      onClick={onClick}
      className={`group relative select-none cursor-pointer rounded-xl ${className}`}
    >
      {glassInner}
    </motion.button>
  );
}

/* ── 3-D floating logo mark ──────────────────────────────────────── */
function FloatingLogoMark({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      className="relative w-12 h-12 rounded-2xl overflow-hidden shadow-lg shadow-cyan-500/20"
      animate={reduced ? {} : { y: [0, -5, 0], rotateZ: [0, 2, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      style={{ transformStyle: 'preserve-3d' }}
    >
      <MiniOrbCanvas color="#22d3ee" reduced={reduced} className="absolute inset-0 w-full h-full" />
    </motion.div>
  );
}

/* === CSS KEYFRAMES === */
const GLOBAL_STYLES = `
  @keyframes marqueeLeft  { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(-50%, 0, 0); } }
  @keyframes marqueeRight { from { transform: translate3d(-50%, 0, 0); } to { transform: translate3d(0, 0, 0); } }
  @keyframes orbitSpin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes laserSweep {
    0%   { top: 0%; opacity: 0; }
    15%  { opacity: 0.85; }
    85%  { opacity: 0.85; }
    100% { top: 100%; opacity: 0; }
  }
  @keyframes pulseNeon {
    0%, 100% { filter: drop-shadow(0 0 15px rgba(34, 211, 238, 0.4)); }
    50%      { filter: drop-shadow(0 0 28px rgba(99, 102, 241, 0.6)); }
  }
  @keyframes shimmerBar {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;

/* === LOGO === */
function HireRankLogo({ height = 28 }: { height?: number }) {
  const fontSize = Math.round(height * 0.58);
  return (
    <span
      style={{
        fontSize: `${fontSize}px`,
        fontWeight: 800,
        letterSpacing: '-0.03em',
        lineHeight: 1,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      Hire<span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Rank</span>
    </span>
  );
}

/* === NAVBAR === */
const NAV_LINKS = [
  { label: 'How It Works', href: '#how',      chevron: false },
  { label: 'Features',     href: '#features', chevron: false },
  { label: 'Demo',         href: '#demo',     chevron: true  },
  { label: 'Resources',    href: '#faq',      chevron: true  },
];

function Navbar({ reduced }: { reduced: boolean }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <nav
        className={`sticky top-0 z-50 flex items-center justify-between px-6 md:px-10 h-18 transition-all duration-300 ${
          scrolled
            ? 'bg-black/70 backdrop-blur-2xl border-b border-white/[0.07] shadow-[0_1px_40px_rgba(0,0,0,0.6)]'
            : 'bg-transparent'
        }`}
        style={{ height: '4.5rem' }}
      >
        <Link to="/" className="text-white flex-shrink-0 flex items-center gap-3 group" aria-label="HireRank home">
          <FloatingLogoMark reduced={reduced} />
          <HireRankLogo height={36} />
        </Link>
        <div className="hidden md:flex items-center gap-8 px-6 py-2 rounded-full bg-white/[0.02] border border-white/[0.06] backdrop-blur-md">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="flex items-center gap-1 text-[14px] font-normal text-white/50 hover:text-white transition-colors duration-200"
            >
              {l.label}
              {l.chevron && <ChevronDown className="w-3.5 h-3.5 opacity-40" strokeWidth={2} />}
            </a>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-5">
          <Link
            to="/login"
            className="text-[14px] font-normal text-white/50 hover:text-white transition-colors duration-200"
          >
            Sign In
          </Link>
          <Button3D
            id="navbar-cta"
            size="sm"
            onClick={() => navigate(isAuthenticated ? '/dashboard' : '/screen')}
          >
            {isAuthenticated ? 'Dashboard' : 'Get Started'}
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Button3D>
        </div>
        <button
          id="mobile-menu-open"
          onClick={() => setMobileOpen(true)}
          className="md:hidden text-white/70 hover:text-white p-2 transition-colors rounded-xl bg-white/[0.04] border border-white/[0.08]"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" strokeWidth={1.8} />
        </button>
      </nav>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col px-8 pt-8 pb-12"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between mb-14">
              <Link to="/" className="text-white" onClick={() => setMobileOpen(false)}>
                <HireRankLogo height={28} />
              </Link>
              <button
                id="mobile-menu-close"
                onClick={() => setMobileOpen(false)}
                className="text-white/40 hover:text-white transition-colors p-2 rounded-xl bg-white/[0.04]"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" strokeWidth={1.8} />
              </button>
            </div>
            <div className="flex flex-col gap-7 flex-1">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-2xl font-normal text-white/60 hover:text-white transition-colors"
                >
                  {l.label}
                </a>
              ))}
            </div>
            <div className="border-t border-white/[0.08] pt-8 flex flex-col gap-4">
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="text-lg font-normal text-white/50 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Button3D
                size="md"
                onClick={() => { setMobileOpen(false); navigate('/screen'); }}
              >
                Get Started Free
              </Button3D>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* === HERO === */
function Hero({ reduced }: { reduced: boolean }) {
  const navigate = useNavigate();

  return (
    <section id="hero" className="relative flex items-center justify-center text-center px-6 pt-4 pb-20" style={{ minHeight: '100svh' }}>
      {/* 3D Canvas — fills the hero section */}
      <HeroCanvas
        reduced={reduced}
        className="absolute inset-0 w-full h-full opacity-70"
      />

      {/* Radial vignette to keep text readable */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 65% at 50% 50%, transparent 30%, rgba(0,0,0,0.75) 100%)' }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto" style={{ perspective: 1000 }}>
        {/* Animated 3D Eyebrow with Neon Dot */}
        <motion.div
          className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold tracking-wider uppercase mb-7 shadow-[0_0_20px_rgba(6,182,212,0.25)] backdrop-blur-md cursor-default"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          whileHover={{ scale: 1.05, borderColor: 'rgba(34,211,238,0.6)' }}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
          </span>
          AI-Powered Resume Screening
        </motion.div>

        {/* Headline with 3D depth and Holographic Gradient Glow */}
        <motion.h1
          className="text-[44px] sm:text-[58px] md:text-[72px] font-extrabold leading-[1.04] tracking-tight mb-7"
          initial={{ opacity: 0, y: 30, rotateX: 14 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <span className="text-white drop-shadow-[0_8px_30px_rgba(0,0,0,0.9)]">Screen Smart. </span>
          <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-400 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(34,211,238,0.45)]">
            Hire Better.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="text-[16px] md:text-[18px] font-light text-white/60 leading-relaxed mb-10 mx-auto max-w-xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
        >
          Instant multi-factor resume ranking with explainable AI scores.
          Upload candidates, paste a JD, and get your shortlist in 60 seconds.
        </motion.p>

        {/* 3D Action CTA Row */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-5"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Button3D
            id="hero-cta"
            size="lg"
            onClick={() => navigate('/screen')}
          >
            <Sparkles className="w-4 h-4 text-cyan-900" />
            Get Started Free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button3D>

          <Button3D
            variant="glass"
            size="lg"
            href="#how"
          >
            See how it works
          </Button3D>
        </motion.div>

        {/* Interactive 3D Trust Badges */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mt-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          {[
            { icon: Shield, text: 'Bias-free scoring', color: '#22d3ee' },
            { icon: Brain,  text: 'Explainable AI',   color: '#818cf8' },
            { icon: FileSearch, text: 'No login to try', color: '#34d399' },
          ].map(({ icon: Icon, text, color }, idx) => (
            <motion.div
              key={text}
              className="flex items-center gap-2 text-[12px] font-medium text-white/50 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.07] hover:border-cyan-500/40 hover:text-white transition-all duration-200 cursor-default shadow-sm backdrop-blur-sm"
              whileHover={{ y: -2, scale: 1.04 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + idx * 0.1 }}
            >
              <Icon className="w-3.5 h-3.5" style={{ color }} strokeWidth={1.8} />
              {text}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* === HOW IT WORKS === */
const STEPS = [
  { num: '01', icon: FileSearch, title: 'Upload resumes and JD',  desc: 'Drop in the job description and resume files (PDF or DOCX). Instant parsing with no signup required.', color: '#22d3ee' },
  { num: '02', icon: Brain,      title: 'AI parses everything',   desc: 'NLP extracts skills, career timelines, education, and credentials from every resume automatically.', color: '#60a5fa' },
  { num: '03', icon: BarChart3,  title: 'Semantic scoring',       desc: 'Dense embeddings measure skill match, experience fit, and semantic relevance against the role requirements.', color: '#34d399' },
  { num: '04', icon: Shield,     title: 'Ranked shortlist',       desc: 'Receive an explainable tiered ranking with matched and missing requirements. Export to CSV in one click.', color: '#f59e0b' },
];

function HowItWorks({ reduced }: { reduced: boolean }) {
  return (
    <section id="how" className="py-28 px-6 border-t border-white/[0.06] relative">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-[11px] font-semibold text-cyan-400 uppercase tracking-[0.2em] mb-4">How it works</p>
          <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">From JD to ranked shortlist in 60s</h2>
          <p className="text-white/40 mt-4 text-base max-w-md mx-auto">Four transparent steps. Zero guesswork. Every score explained.</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 relative">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.num}
                className="flex flex-col items-center text-center"
                initial={{ opacity: 0, y: 35 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
              >
                {/* 3D Tilt Icon Card with Specular Glare */}
                <TiltCard
                  accentColor={step.color}
                  className="relative w-24 h-24 rounded-2xl bg-white/[0.03] border border-white/[0.09] mb-6 flex items-center justify-center shadow-lg"
                >
                  <MiniOrbCanvas color={step.color} reduced={reduced} className="absolute inset-0 w-full h-full opacity-60" />
                  <Icon className="relative z-10 w-8 h-8 text-white" strokeWidth={1.7} />
                  {/* Glowing 3D Number Badge */}
                  <span
                    className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-gradient-to-tr from-cyan-400 to-blue-500 text-black rounded-full text-[10px] font-black flex items-center justify-center shadow-md border-2 border-black z-20"
                  >
                    {step.num}
                  </span>
                </TiltCard>
                <h3 className="text-base font-bold text-white mb-2">{step.title}</h3>
                <p className="text-xs text-white/40 leading-relaxed max-w-[220px]">{step.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* === STATS SECTION === */
const STATS = [
  { value: '50',  suffix: '+', label: 'Resumes per batch',    color: '#22d3ee', icon: '📄' },
  { value: '4',   suffix: 'x', label: 'Faster than manual',   color: '#60a5fa', icon: '⚡' },
  { value: '92',  suffix: '%', label: 'Parse accuracy',       color: '#34d399', icon: '🎯' },
  { value: '100', suffix: '%', label: 'Explainable scores',   color: '#f59e0b', icon: '🔍' },
];

function AnimatedCounter({ target, suffix, inView }: { target: number; suffix: string; inView: boolean }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = target / 40;
    const id = setInterval(() => {
      start = Math.min(start + step, target);
      setVal(Math.round(start));
      if (start >= target) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [inView, target]);
  return <span>{val}{suffix}</span>;
}

function StatsSection({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  return (
    <section className="relative py-24 px-6 border-t border-white/[0.06] overflow-hidden">
      <div className="absolute inset-0 opacity-25 pointer-events-none">
        <ParticleFieldCanvas
          reduced={reduced}
          color="#3b82f6"
          particleCount={50}
          connectDistance={0.22}
          className="w-full h-full"
        />
      </div>
      <div className="max-w-6xl mx-auto relative z-10" ref={ref}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              className="group relative"
              initial={{ opacity: 0, y: 40, rotateX: 20 }}
              animate={inView ? { opacity: 1, y: 0, rotateX: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              style={{ perspective: 600, transformStyle: 'preserve-3d' }}
            >
              <TiltCard
                accentColor={s.color}
                className="relative bg-white/[0.03] border border-white/[0.08] hover:border-white/20 rounded-2xl p-6 flex flex-col items-center text-center gap-3 transition-colors duration-300"
              >
                {/* Colored glow blob */}
                <div
                  className="absolute -inset-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none blur-2xl"
                  style={{ background: `radial-gradient(circle at 50% 50%, ${s.color}35, transparent 70%)` }}
                />
                {!reduced && (
                  <div
                    className="absolute w-24 h-24 rounded-full border border-white/[0.05]"
                    style={{ animation: `orbitSpin ${6 + i * 1.5}s linear infinite`, top: '-16px', left: '-16px' }}
                  />
                )}
                <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-inner">
                  <MiniOrbCanvas color={s.color} reduced={reduced} className="absolute inset-0 w-full h-full" />
                  <span className="absolute inset-0 flex items-center justify-center text-xl">{s.icon}</span>
                </div>
                <div
                  className="text-4xl font-extrabold tracking-tight"
                  style={{
                    background: `linear-gradient(135deg, ${s.color}, #ffffff)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  <AnimatedCounter target={parseInt(s.value)} suffix={s.suffix} inView={inView} />
                </div>
                <p className="text-xs text-white/45 font-medium">{s.label}</p>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* === MARQUEE === */
const ROLES_A = ['Backend Engineers', 'Frontend Developers', 'Full-Stack Engineers', 'DevOps Engineers', 'Data Scientists', 'Machine Learning Engineers', 'Product Managers', 'QA Engineers'];
const ROLES_B = ['Mobile Developers', 'Cloud Architects', 'Security Engineers', 'Solutions Architects', 'Engineering Managers', 'SRE Engineers', 'AI Researchers', 'UI/UX Designers'];

function MarqueeSection() {
  const rowA = [...ROLES_A, ...ROLES_A];
  const rowB = [...ROLES_B, ...ROLES_B];
  return (
    <section className="py-16 overflow-hidden border-t border-white/[0.06] group/marquee">
      <p className="text-center text-[11px] font-semibold text-cyan-400 uppercase tracking-[0.2em] mb-8">Screens resumes for</p>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />
        <div className="space-y-4">
          <div className="marquee-track flex gap-3 w-max group-hover/marquee:[animation-play-state:paused]" style={{ animation: 'marqueeLeft 40s linear infinite' }}>
            {rowA.map((r, i) => (
              <span
                key={i}
                className="px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm text-white/50 hover:text-cyan-300 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all duration-200 cursor-pointer whitespace-nowrap backdrop-blur-sm shadow-sm"
              >
                {r}
              </span>
            ))}
          </div>
          <div className="marquee-track flex gap-3 w-max group-hover/marquee:[animation-play-state:paused]" style={{ animation: 'marqueeRight 46s linear infinite' }}>
            {rowB.map((r, i) => (
              <span
                key={i}
                className="px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm text-white/50 hover:text-cyan-300 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all duration-200 cursor-pointer whitespace-nowrap backdrop-blur-sm shadow-sm"
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* === FEATURES === */
const FEATURES = [
  { icon: FileSearch, title: 'Intelligent Parsing',    desc: 'Extracts skills, career timelines, education, and credentials from any PDF or DOCX using rule-based NLP with fuzzy alias matching.', detail: 'Handles aliases like ReactJS, React.js, and React automatically.', color: '#22d3ee' },
  { icon: Brain,      title: 'Semantic Matching',      desc: 'Dense sentence-transformer embeddings compare contextual depth of each resume against the JD, beyond mere keywords.', detail: 'Score = 50% semantic + 25% skills + 15% experience + 10% education.', color: '#60a5fa' },
  { icon: BarChart3,  title: 'Explainable Ranking',    desc: 'Every score breaks down into four traceable components. See matched skills, missing requirements, and bonus strengths for each candidate.', detail: 'Strong: 75 or above. Potential: 55 to 74. Low: below 55.', color: '#34d399' },
  { icon: Shield,     title: 'Bias-Free Screening',    desc: 'Blind mode masks names, contact details, institution prestige, and graduation years to prevent unconscious hiring bias.', detail: 'NYC Local Law 144 compliance support built in.', color: '#f59e0b' },
];

function FeatureGrid({ reduced }: { reduced: boolean }) {
  return (
    <section id="features" className="py-28 px-6 border-t border-white/[0.06]">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-[11px] font-semibold text-cyan-400 uppercase tracking-[0.2em] mb-4">Under the hood</p>
          <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">Engineered for absolute accuracy</h2>
          <p className="text-white/40 mt-4 text-base max-w-lg mx-auto">Zero hallucinated scores. Every decision is verifiable and traceable back to the JD.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FEATURES.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <TiltCard
                  accentColor={feat.color}
                  className="bg-white/[0.025] border border-white/[0.07] hover:border-white/[0.18] rounded-2xl p-8 transition-colors duration-300 h-full flex flex-col justify-between"
                >
                  <div>
                    {/* 3D icon */}
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden mb-6 flex items-center justify-center shadow-md">
                      <MiniOrbCanvas color={feat.color} reduced={reduced} className="absolute inset-0 w-full h-full opacity-70" />
                      <Icon className="relative z-10 w-6 h-6 text-white" strokeWidth={1.8} />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{feat.title}</h3>
                    <p className="text-sm text-white/45 leading-relaxed mb-6">{feat.desc}</p>
                  </div>
                  <div className="pt-4 border-t border-white/[0.05]">
                    <p className="text-xs text-cyan-400/80 font-mono flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      {feat.detail}
                    </p>
                  </div>
                </TiltCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* === DEMO SECTION WITH SCANNING LASER === */
function DemoSection() {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const MOCK = [
    { name: 'Sarah Chen', score: 94, label: 'Strong', color: '#22d3ee' },
    { name: 'Alex Rivera', score: 86, label: 'Strong', color: '#38bdf8' },
    { name: 'David Kim', score: 72, label: 'Potential', color: '#818cf8' },
    { name: 'Elena Rostova', score: 64, label: 'Potential', color: '#a78bfa' },
    { name: 'Marcus Brody', score: 48, label: 'Low', color: '#f43f5e' },
  ];

  return (
    <section id="demo" className="py-28 px-6 border-t border-white/[0.06] relative">
      <div className="max-w-4xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-[11px] font-semibold text-cyan-400 uppercase tracking-[0.2em] mb-4">See it live</p>
          <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">From upload to shortlist in 60s</h2>
          <p className="text-white/40 mt-4 text-base max-w-md mx-auto">Instant AI matching. Every score categorized and explained.</p>
        </motion.div>

        <motion.div
          ref={ref}
          className="relative mb-12"
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
        >
          <TiltCard
            accentColor="#22d3ee"
            className="bg-white/[0.025] border border-white/[0.09] rounded-2xl overflow-hidden shadow-2xl"
          >
            {/* Animated Laser Sweep Scanner */}
            <div
              className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-75 blur-[1px] pointer-events-none z-20"
              style={{ animation: 'laserSweep 4s ease-in-out infinite' }}
            />

            {/* Header bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-white/50 font-semibold uppercase tracking-wider">Live Screening Preview</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-cyan-400 font-mono bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 rounded-full">5 Resumes Ranked</span>
              </div>
            </div>

            {/* Candidates ranking list */}
            <div className="p-6 space-y-4">
              {MOCK.map((c, i) => (
                <div
                  key={c.name}
                  className="flex items-center gap-4 p-2 rounded-xl hover:bg-white/[0.03] transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-white/[0.08] flex items-center justify-center flex-shrink-0 font-bold text-white text-xs">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-white/90">{c.name}</span>
                      <span className="text-sm font-bold tabular-nums" style={{ color: c.color }}>{c.score}%</span>
                    </div>
                    {/* Animated progress bar */}
                    <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden relative">
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background: `linear-gradient(90deg, ${c.color}, #38bdf8)`,
                        }}
                        initial={{ width: 0 }}
                        animate={inView ? { width: `${c.score}%` } : { width: 0 }}
                        transition={{ duration: 0.9, delay: 0.3 + i * 0.1, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-bold rounded-lg px-2.5 py-1 flex-shrink-0 border"
                    style={{
                      color: c.color,
                      borderColor: `${c.color}35`,
                      backgroundColor: `${c.color}10`,
                    }}
                  >
                    {c.label}
                  </span>
                </div>
              ))}
            </div>
          </TiltCard>
        </motion.div>

        <div className="text-center">
          <Button3D
            id="demo-cta"
            size="md"
            onClick={() => navigate('/screen')}
          >
            Start a free screening
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button3D>
        </div>
      </div>
    </section>
  );
}

/* === FAQ === */
const FAQ_ITEMS = [
  { q: 'Do I need an account to try HireRank?', a: 'No. You can paste a job description, upload up to 10 resumes, and view the full ranked shortlist instantly, no signup required. Create an account only when you want to save results to a persistent workspace.' },
  { q: 'What file formats are supported?', a: 'PDF and DOCX files up to 10 MB each. Most professionally formatted resumes parse cleanly with our dual-engine extraction.' },
  { q: 'How is the match score calculated?', a: 'Each candidate receives a weighted composite score: 50% semantic similarity, 25% required skill coverage, 15% experience fit (parsed date ranges), and 10% education match.' },
  { q: 'Can the score be gamed by keyword stuffing?', a: 'Harder than you would think. The semantic embedding component understands meaning and context, not just keyword counts. Experience is validated from parsed career milestones.' },
  { q: 'How many resumes can I screen at once?', a: 'Guest sessions support up to 10 resumes per batch. Authenticated recruiter workspaces support up to 50 resumes per batch.' },
  { q: 'Is my data stored on your servers?', a: 'Guest session files are processed in-memory and never persisted to disk. Authenticated workspace uploads are encrypted and associated strictly with your workspace.' },
];

function FaqItem({ item, isOpen, onToggle }: { item: (typeof FAQ_ITEMS)[0]; isOpen: boolean; onToggle: () => void }) {
  return (
    <motion.div layout className="border border-white/[0.08] hover:border-cyan-500/30 rounded-xl overflow-hidden transition-colors">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-white/[0.02] transition-colors"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-semibold text-white/85">{item.q}</span>
        <motion.span
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.18 }}
          className="text-cyan-400 flex-shrink-0 text-2xl font-light leading-none"
        >
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 pt-2 text-sm text-white/45 leading-relaxed border-t border-white/[0.04]">
              {item.a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-28 px-6 border-t border-white/[0.06]">
      <div className="max-w-3xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-[11px] font-semibold text-cyan-400 uppercase tracking-[0.2em] mb-4">FAQ</p>
          <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">Frequently asked questions</h2>
          <p className="text-white/40 mt-4 text-base">Everything you need to know before your first screening.</p>
        </motion.div>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <FaqItem key={item.q} item={item} isOpen={open === i} onToggle={() => setOpen(open === i ? null : i)} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* === CTA BAND === */
function CtaBand({ reduced }: { reduced: boolean }) {
  const navigate = useNavigate();
  return (
    <section className="py-28 px-6 border-t border-white/[0.06] relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <ParticleFieldCanvas reduced={reduced} color="#22d3ee" particleCount={60} connectDistance={0.2} className="w-full h-full" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center opacity-15 pointer-events-none">
        <div className="w-[500px] h-[500px]">
          <MiniOrbCanvas color="#22d3ee" reduced={reduced} className="w-full h-full" />
        </div>
      </div>
      <div className="max-w-3xl mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="space-y-8"
        >
          <h2 className="text-4xl md:text-6xl font-extrabold text-white leading-tight tracking-tight">
            Ready to find your best candidates faster?
          </h2>
          <p className="text-white/45 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            Paste your job description, upload resumes, and receive your ranked shortlist free in under a minute.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-5 pt-3">
            <Button3D
              id="final-cta-primary"
              size="lg"
              onClick={() => navigate('/screen')}
            >
              Start screening free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button3D>
            <Button3D
              id="final-cta-secondary"
              variant="glass"
              size="lg"
              onClick={() => navigate('/login')}
            >
              Sign in
            </Button3D>
          </div>
          <p className="text-xs text-white/30 pt-2 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            No account required to test. Processed securely in-memory.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* === FOOTER === */
function Footer() {
  return (
    <footer className="border-t border-white/[0.06] px-6 py-16">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-14">
          <div className="md:col-span-1">
            <div className="text-white mb-4"><HireRankLogo height={28} /></div>
            <p className="text-xs text-white/30 leading-relaxed max-w-[220px]">
              AI-powered resume screening, explainable candidate ranking, and skill gap assessment for high-velocity hiring teams.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-cyan-400 uppercase tracking-[0.2em] mb-4">Product</p>
            <ul className="space-y-3">
              {[{ label: 'How it Works', href: '#how' }, { label: 'Features', href: '#features' }, { label: 'Demo', href: '#demo' }, { label: 'FAQ', href: '#faq' }].map((l) => (
                <li key={l.label}><a href={l.href} className="text-sm text-white/40 hover:text-white transition-colors">{l.label}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-cyan-400 uppercase tracking-[0.2em] mb-4">App</p>
            <ul className="space-y-3">
              {[{ label: 'Screen Resumes', href: '/screen' }, { label: 'Dashboard', href: '/dashboard' }, { label: 'Sign Up', href: '/signup' }, { label: 'Log In', href: '/login' }].map((l) => (
                <li key={l.label}><Link to={l.href} className="text-sm text-white/40 hover:text-white transition-colors">{l.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-cyan-400 uppercase tracking-[0.2em] mb-4">Legal</p>
            <ul className="space-y-3">
              <li><Link to="/privacy" className="text-sm text-white/40 hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="text-sm text-white/40 hover:text-white transition-colors">Terms of Service</Link></li>
              <li><a href="https://github.com/atharv3046/HireRank" target="_blank" rel="noreferrer" className="text-sm text-white/40 hover:text-white transition-colors">GitHub</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/[0.05] pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/20">© {new Date().getFullYear()} HireRank. Final-Year Engineering Project. Built with React, FastAPI, and spaCy.</p>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="text-xs text-white/25 hover:text-white transition-colors">Privacy</Link>
            <Link to="/terms"   className="text-xs text-white/25 hover:text-white transition-colors">Terms</Link>
            <div className="flex items-center gap-2 text-xs text-white/25">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              All systems operational
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* === PAGE ROOT === */
export default function MarketingPage() {
  const reduced = usePrefersReducedMotion();

  return (
    <div className="text-white min-h-screen font-sans antialiased overflow-x-hidden selection:bg-cyan-500/20">
      <style>{GLOBAL_STYLES}</style>

      <Navbar reduced={reduced} />
      <Hero reduced={reduced} />
      <HowItWorks  reduced={reduced} />
      <StatsSection reduced={reduced} />
      <MarqueeSection />
      <FeatureGrid reduced={reduced} />
      <DemoSection />
      <FaqSection />
      <CtaBand reduced={reduced} />
      <Footer />
    </div>
  );
}
