import { useRef, useEffect } from 'react';

interface HeroCanvasProps {
  reduced?: boolean;
  className?: string;
}

export default function HeroCanvas({ reduced = false, className = '' }: HeroCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let isVisible = true;
    const mouse = { x: 0, y: 0 };
    let scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    let targetScrollY = scrollY;

    // Pause rendering when hero scrolls out of view
    const observer = new IntersectionObserver(([entry]) => {
      const wasVisible = isVisible;
      isVisible = entry.isIntersecting;
      if (isVisible && !wasVisible) {
        cancelAnimationFrame(animId);
        animId = requestAnimationFrame(draw);
      }
    }, { threshold: 0.05 });
    observer.observe(canvas);

    const resize = () => {
      canvas.width  = window.innerWidth  || canvas.offsetWidth  || 800;
      canvas.height = window.innerHeight || canvas.offsetHeight || 600;
    };
    resize();
    window.addEventListener('resize', resize);

    const onScroll = () => { targetScrollY = window.scrollY || 0; };
    window.addEventListener('scroll', onScroll, { passive: true });

    const onMouse = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const w = canvas.width || 800;
      const h = canvas.height || 600;
      mouse.x = (e.clientX - r.left - w / 2) / (w / 2);
      mouse.y = (e.clientY - r.top  - h / 2) / (h / 2);
    };
    if (!reduced) window.addEventListener('mousemove', onMouse, { passive: true });

    /* ── Particles ─────────────────────────────────────── */
    const particles = Array.from({ length: reduced ? 50 : 130 }, () => ({
      x:  (Math.random() - 0.5) * 2.8,
      y:  (Math.random() - 0.5) * 2.8,
      z:  Math.random() - 0.5,
      vx: (Math.random() - 0.5) * 0.0003,
      vy: (Math.random() - 0.5) * 0.0003,
      r:  Math.random() * 1.8 + 0.4,
      color: ['#22d3ee', '#3b82f6', '#a78bfa', '#ffffff', '#06b6d4'][Math.floor(Math.random() * 5)],
      phase: Math.random() * Math.PI * 2,
    }));

    /* ── Torus knot path ───────────────────────────────── */
    const STEPS = 220;
    const torusPath = Array.from({ length: STEPS + 1 }, (_, i) => {
      const t = (i / STEPS) * 2 * Math.PI;
      const p = 2, q = 3, R = 0.36, r = 0.1;
      const phi = t * q;
      return {
        x: (R + r * Math.cos(phi)) * Math.cos(t * p),
        y: (R + r * Math.cos(phi)) * Math.sin(t * p),
        z: r * Math.sin(phi),
      };
    });

    /* ── DNA Double Helix ──────────────────────────────── */
    const DNA_STEPS = 120;
    const dnaA = Array.from({ length: DNA_STEPS }, (_, i) => {
      const t = (i / DNA_STEPS) * Math.PI * 4;
      const radius = 0.18;
      const height = 0.7;
      return {
        x:  Math.cos(t) * radius,
        y: (i / DNA_STEPS - 0.5) * height,
        z:  Math.sin(t) * radius,
      };
    });
    const dnaB = Array.from({ length: DNA_STEPS }, (_, i) => {
      const t = (i / DNA_STEPS) * Math.PI * 4 + Math.PI; // offset by π
      const radius = 0.18;
      const height = 0.7;
      return {
        x:  Math.cos(t) * radius,
        y: (i / DNA_STEPS - 0.5) * height,
        z:  Math.sin(t) * radius,
      };
    });

    /* ── Orbiting dots ─────────────────────────────────── */
    const orbits = [
      { radius: 0.38, speed: 0.55, size: 4,   color: '#22d3ee', phase: 0,   tiltX: 0    },
      { radius: 0.46, speed: 0.38, size: 6,   color: '#3b82f6', phase: 1,   tiltX: 0.3  },
      { radius: 0.55, speed: 0.28, size: 3,   color: '#a78bfa', phase: 2.5, tiltX: -0.2 },
      { radius: 0.32, speed: 0.70, size: 2.5, color: '#06b6d4', phase: 1.2, tiltX: 0.5  },
      { radius: 0.62, speed: 0.18, size: 2,   color: '#f472b6', phase: 0.8, tiltX: 0.8  },
      { radius: 0.42, speed: 0.44, size: 3.5, color: '#34d399', phase: 3.1, tiltX: -0.6 },
    ];

    /* ── Glow rings config ─────────────────────────────── */
    const glowRings = [
      { rr: 0.44, color: 'rgba(34,211,238,0.22)',  w: 1.5, phase: 0.12,  tiltAdd: 0,   tiltX: 0    },
      { rr: 0.58, color: 'rgba(59,130,246,0.16)',  w: 1.0, phase: -0.08, tiltAdd: 0.9, tiltX: 0.4  },
      { rr: 0.65, color: 'rgba(167,139,250,0.10)', w: 0.8, phase: 0.06,  tiltAdd: 1.6, tiltX: -0.3 },
      { rr: 0.28, color: 'rgba(52,211,153,0.18)',  w: 1.2, phase: -0.15, tiltAdd: 2.3, tiltX: 0.7  },
    ];

    /* ── 3-D projection ────────────────────────────────── */
    const project = (
      x: number, y: number, z: number,
      cx: number, cy: number,
      rotY: number, rotX: number, scale: number
    ) => {
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      const x2 = x * cosY - z * sinY;
      const z2 = x * sinY + z * cosY;
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      const y2 = y * cosX - z2 * sinX;
      const z3 = y * sinX + z2 * cosX;
      const fov = 1.4 / (1.4 + z3 * 0.3);
      return { sx: cx + x2 * scale * fov, sy: cy + y2 * scale * fov, depth: z3 };
    };

    let t = 0;

    const draw = () => {
      if (!canvas || !ctx || !isVisible) return;
      const W = canvas.width, H = canvas.height;
      const cx = W / 2;
      const cy = H / 2 + (reduced ? 0 : Math.sin(t * 0.8) * 8);
      const scale = Math.min(W, H) * 0.42;

      if (!reduced) {
        scrollY += (targetScrollY - scrollY) * 0.07;
      }
      const rotY = reduced ? 0.3  : t * 0.25 + mouse.x * 0.45 + scrollY * 0.0008;
      const rotX = reduced ? 0.4  : 0.35 + mouse.y * 0.35 + scrollY * 0.0004;

      ctx.clearRect(0, 0, W, H);

      /* ── Particles with pulse ────────────────────────── */
      particles.forEach(p => {
        if (!reduced) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x > 1.4) p.x = -1.4; if (p.x < -1.4) p.x = 1.4;
          if (p.y > 1.4) p.y = -1.4; if (p.y < -1.4) p.y = 1.4;
        }
        const { sx, sy, depth } = project(p.x, p.y, p.z, cx, cy, rotY * 0.15, rotX * 0.15, scale * 2.2);
        const pulse = Math.sin(t * 1.5 + p.phase) * 0.12 + 0.88;
        const alpha = Math.max(0, Math.min(1, 0.15 + (depth + 0.5) * 0.45)) * pulse;
        ctx.beginPath();
        ctx.arc(sx, sy, p.r * pulse, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
        ctx.fill();
      });

      /* ── Constellation connections (optimized) ───────── */
      if (!reduced) {
        const visiblePts = particles
          .filter((_, i) => i % 3 === 0) // every 3rd for performance
          .map(p => project(p.x, p.y, p.z, cx, cy, rotY * 0.15, rotX * 0.15, scale * 2.2));

        const MAX_D_SQ = 90 * 90;
        ctx.lineWidth = 0.5;
        for (let i = 0; i < visiblePts.length; i++) {
          const pi = visiblePts[i];
          for (let j = i + 1; j < visiblePts.length; j++) {
            const pj = visiblePts[j];
            const dx = pi.sx - pj.sx;
            const dy = pi.sy - pj.sy;
            const dSq = dx * dx + dy * dy;
            if (dSq < MAX_D_SQ) {
              const dist = Math.sqrt(dSq);
              const alpha = (1 - dist / 90) * 0.06;
              ctx.beginPath();
              ctx.moveTo(pi.sx, pi.sy);
              ctx.lineTo(pj.sx, pj.sy);
              ctx.strokeStyle = `rgba(34,211,238,${alpha})`;
              ctx.stroke();
            }
          }
        }
      }

      /* ── Glow rings ──────────────────────────────────── */
      glowRings.forEach(({ rr, color, w, phase, tiltAdd, tiltX }) => {
        const ph = reduced ? 0 : t * phase;
        ctx.beginPath();
        for (let s = 0; s <= 120; s++) {
          const a = (s / 120) * Math.PI * 2;
          const { sx, sy } = project(
            Math.cos(a) * rr, 0, Math.sin(a) * rr,
            cx, cy, rotY + ph, rotX + tiltAdd + tiltX, scale
          );
          s === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.stroke();
      });

      /* ── Torus knot ──────────────────────────────────── */
      let prev: { sx: number; sy: number; depth: number } | null = null;
      torusPath.forEach(pt => {
        const { sx, sy, depth } = project(pt.x, pt.y, pt.z, cx, cy, rotY, rotX, scale);
        const norm = Math.max(0, Math.min(1, (depth + 0.6) / 1.2));
        const alpha = norm * 0.92;
        const rr = Math.round(34  + norm * 20);
        const gg = Math.round(211 - norm * 80);
        const bb = Math.round(238 - norm * 60);
        if (prev) {
          ctx.beginPath();
          ctx.moveTo(prev.sx, prev.sy);
          ctx.lineTo(sx, sy);
          ctx.strokeStyle = `rgba(${rr},${gg},${bb},${alpha})`;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
        prev = { sx, sy, depth };
      });

      /* ── DNA Double Helix ────────────────────────────── */
      // Strand A
      let prevA: { sx: number; sy: number } | null = null;
      dnaA.forEach((pt, i) => {
        const { sx, sy, depth } = project(pt.x, pt.y, pt.z, cx, cy, rotY + Math.PI * 0.5, rotX + 0.3, scale * 0.75);
        const norm = Math.max(0, Math.min(1, (depth + 0.6) / 1.2));
        const alpha = norm * 0.7;
        if (prevA) {
          ctx.beginPath();
          ctx.moveTo(prevA.sx, prevA.sy);
          ctx.lineTo(sx, sy);
          ctx.strokeStyle = `rgba(52,211,153,${alpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        // Nodes on helix (fast hardware-accelerated halo)
        if (i % 12 === 0) {
          ctx.beginPath();
          ctx.arc(sx, sy, 5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(52,211,153,${alpha * 0.35})`;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(52,211,153,${alpha + 0.2})`;
          ctx.fill();
        }
        prevA = { sx, sy };
      });

      // Strand B
      let prevB: { sx: number; sy: number } | null = null;
      dnaB.forEach((pt, i) => {
        const { sx, sy, depth } = project(pt.x, pt.y, pt.z, cx, cy, rotY + Math.PI * 0.5, rotX + 0.3, scale * 0.75);
        const norm = Math.max(0, Math.min(1, (depth + 0.6) / 1.2));
        const alpha = norm * 0.7;
        if (prevB) {
          ctx.beginPath();
          ctx.moveTo(prevB.sx, prevB.sy);
          ctx.lineTo(sx, sy);
          ctx.strokeStyle = `rgba(167,139,250,${alpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        if (i % 12 === 0) {
          ctx.beginPath();
          ctx.arc(sx, sy, 5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(167,139,250,${alpha * 0.35})`;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(167,139,250,${alpha + 0.2})`;
          ctx.fill();
        }
        prevB = { sx, sy };
      });

      // DNA rungs (cross bridges between strands)
      for (let i = 0; i < DNA_STEPS; i += 8) {
        const ptA = dnaA[i];
        const ptB = dnaB[i];
        const prjA = project(ptA.x, ptA.y, ptA.z, cx, cy, rotY + Math.PI * 0.5, rotX + 0.3, scale * 0.75);
        const prjB = project(ptB.x, ptB.y, ptB.z, cx, cy, rotY + Math.PI * 0.5, rotX + 0.3, scale * 0.75);
        const avgDepth = (prjA.depth + prjB.depth) / 2;
        const norm = Math.max(0, Math.min(1, (avgDepth + 0.6) / 1.2));
        ctx.beginPath();
        ctx.moveTo(prjA.sx, prjA.sy);
        ctx.lineTo(prjB.sx, prjB.sy);
        ctx.strokeStyle = `rgba(255,255,255,${norm * 0.15})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      /* ── Orbiting dots with glow trails ─────────────── */
      orbits.forEach((o, oi) => {
        const angle = reduced ? o.phase : t * o.speed + o.phase;
        const { sx, sy, depth } = project(
          Math.cos(angle) * o.radius,
          Math.sin(angle * 0.3) * 0.05,
          Math.sin(angle) * o.radius,
          cx, cy, rotY + o.tiltX, rotX, scale
        );
        const alpha = Math.max(0.3, Math.min(1, 0.5 + depth * 0.5));
        const pulse = Math.sin(t * 2.5 + oi * 1.1) * 0.3 + 0.7;

        // Trail
        if (!reduced) {
          for (let tr = 1; tr <= 6; tr++) {
            const trAngle = angle - tr * 0.04 * o.speed;
            const trPt = project(
              Math.cos(trAngle) * o.radius,
              Math.sin(trAngle * 0.3) * 0.05,
              Math.sin(trAngle) * o.radius,
              cx, cy, rotY + o.tiltX, rotX, scale
            );
            ctx.beginPath();
            ctx.arc(trPt.sx, trPt.sy, o.size * (1 - tr / 7), 0, Math.PI * 2);
            ctx.fillStyle = o.color + Math.round(alpha * (1 - tr / 7) * 0.4 * 255).toString(16).padStart(2, '0');
            ctx.fill();
          }
        }

        // Main dot with vivid outer glow halo
        ctx.beginPath();
        ctx.arc(sx, sy, o.size * pulse * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = o.color + '45';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sx, sy, o.size * pulse, 0, Math.PI * 2);
        ctx.fillStyle = o.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
        ctx.fill();
      });

      if (!reduced) t += 0.006;
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
      if (!reduced) window.removeEventListener('mousemove', onMouse);
    };
  }, [reduced]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none select-none ${className}`}
      aria-hidden="true"
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
}
