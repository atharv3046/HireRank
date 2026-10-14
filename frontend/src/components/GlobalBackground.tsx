/**
 * GlobalBackground — site-wide animated reactive cosmic canvas.
 *
 * Features:
 *  - High-visibility multi-layer glowing cursor spotlight (cyan, indigo, purple)
 *  - Dynamic constellation laser beams actively connecting cursor to nearby particles
 *  - Responsive particle physics: particles smoothly drift and swirl toward cursor
 *  - Particles near cursor brighten and expand with glowing halos
 *  - Subtle 3D parallax depth: foreground particles shift more than background
 *  - 3 large drifting cosmic ambient orbs with soft atmospheric color
 *  - Inter-particle constellation web connections
 *  - Smooth lerp tracking (60fps) + touch support + prefers-reduced-motion check
 */
import { useRef, useEffect } from 'react';

interface GlobalBackgroundProps {
  reduced?: boolean;
}

export default function GlobalBackground({ reduced = false }: GlobalBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    // Mouse coordinates in pixels
    const mouse = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      targetX: window.innerWidth / 2,
      targetY: window.innerHeight / 2,
      active: true,
      speed: 0,
    };

    let lastMouseX = mouse.x;
    let lastMouseY = mouse.y;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const onMouseMove = (e: MouseEvent) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      mouse.active = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        mouse.targetX = e.touches[0].clientX;
        mouse.targetY = e.touches[0].clientY;
        mouse.active = true;
      }
    };

    const onMouseLeave = () => {
      // Keep active true but drift back toward center slowly
      mouse.targetX = window.innerWidth / 2;
      mouse.targetY = window.innerHeight / 2;
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);

    /* ── Particles Definition ── */
    type Particle = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      baseR: number;
      baseAlpha: number;
      phase: number;
      depth: number; // 0.4 (far) to 1.0 (near)
      color: string;
      rgb: { r: number; g: number; b: number };
    };

    const PALETTE = [
      { hex: '#22d3ee', r: 34, g: 211, b: 238 },   // Cyan
      { hex: '#38bdf8', r: 56, g: 189, b: 248 },   // Sky blue
      { hex: '#818cf8', r: 129, g: 140, b: 248 },  // Indigo
      { hex: '#c084fc', r: 192, g: 132, b: 252 },  // Purple
      { hex: '#ffffff', r: 255, g: 255, b: 255 },  // White spark
    ];

    const COUNT = reduced ? 30 : 85;

    const particles: Particle[] = Array.from({ length: COUNT }, () => {
      const c = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      const depth = Math.random() * 0.6 + 0.4;
      return {
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.4 * depth,
        vy: (Math.random() - 0.5) * 0.4 * depth,
        baseR: (Math.random() * 1.6 + 0.6) * depth,
        baseAlpha: Math.random() * 0.35 + 0.15,
        phase: Math.random() * Math.PI * 2,
        depth,
        color: c.hex,
        rgb: { r: c.r, g: c.g, b: c.b },
      };
    });

    /* ── Large Cosmic Ambient Orbs ── */
    const orbs = [
      { xPct: 0.18, yPct: 0.22, rPct: 0.32, r: 6, g: 182, b: 212, speed: 0.0003, phase: 0 },
      { xPct: 0.82, yPct: 0.72, rPct: 0.28, r: 99, g: 102, b: 241, speed: 0.00025, phase: 2.1 },
      { xPct: 0.50, yPct: 0.15, rPct: 0.22, r: 168, g: 85, b: 247, speed: 0.00035, phase: 4.2 },
    ];

    let t = 0;

    /* ── Render Loop ── */
    const draw = () => {
      if (!canvas || !ctx) return;
      const W = canvas.width;
      const H = canvas.height;

      ctx.clearRect(0, 0, W, H);

      // Smooth cursor lerp
      if (!reduced) {
        const lerpFactor = 0.12;
        mouse.x += (mouse.targetX - mouse.x) * lerpFactor;
        mouse.y += (mouse.targetY - mouse.y) * lerpFactor;

        // Calculate cursor speed for dynamic flare
        const dxM = mouse.x - lastMouseX;
        const dyM = mouse.y - lastMouseY;
        const instSpeed = Math.sqrt(dxM * dxM + dyM * dyM);
        mouse.speed += (instSpeed - mouse.speed) * 0.1;
        lastMouseX = mouse.x;
        lastMouseY = mouse.y;
      } else {
        mouse.x = W / 2;
        mouse.y = H / 2;
      }

      // Parallax offsets
      const parallaxX = (mouse.x - W / 2) * 0.04;
      const parallaxY = (mouse.y - H / 2) * 0.04;

      /* ── 1. Drifting Ambient Cosmic Orbs ── */
      orbs.forEach((orb, i) => {
        if (!reduced) {
          orb.xPct += Math.sin(t * 0.4 + orb.phase + i) * orb.speed;
          orb.yPct += Math.cos(t * 0.35 + orb.phase + i * 1.3) * orb.speed;
          if (orb.xPct < 0.05) orb.xPct = 0.05;
          if (orb.xPct > 0.95) orb.xPct = 0.95;
          if (orb.yPct < 0.05) orb.yPct = 0.05;
          if (orb.yPct > 0.95) orb.yPct = 0.95;
        }

        const orbX = orb.xPct * W + parallaxX * 0.4;
        const orbY = orb.yPct * H + parallaxY * 0.4;
        const orbR = orb.rPct * Math.min(W, H);

        const grd = ctx.createRadialGradient(orbX, orbY, 0, orbX, orbY, orbR);
        grd.addColorStop(0, `rgba(${orb.r}, ${orb.g}, ${orb.b}, 0.08)`);
        grd.addColorStop(0.5, `rgba(${orb.r}, ${orb.g}, ${orb.b}, 0.03)`);
        grd.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.beginPath();
        ctx.arc(orbX, orbY, orbR, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      });

      /* ── 2. High-Visibility Cursor Glowing Spotlight ── */
      if (!reduced) {
        const speedBoost = Math.min(mouse.speed * 0.02, 0.4);

        // A. Wide Atmospheric Halo (~500px radius)
        const outerR = Math.min(W, H) * 0.55;
        const outerGrd = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, outerR);
        outerGrd.addColorStop(0, `rgba(34, 211, 238, ${0.12 + speedBoost * 0.1})`);
        outerGrd.addColorStop(0.25, `rgba(59, 130, 246, ${0.08 + speedBoost * 0.06})`);
        outerGrd.addColorStop(0.55, `rgba(168, 85, 247, ${0.04 + speedBoost * 0.03})`);
        outerGrd.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, outerR, 0, Math.PI * 2);
        ctx.fillStyle = outerGrd;
        ctx.fill();

        // B. Vibrant Mid Spotlight (~240px radius)
        const midR = Math.min(W, H) * 0.26;
        const midGrd = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, midR);
        midGrd.addColorStop(0, `rgba(34, 211, 238, ${0.26 + speedBoost * 0.15})`);
        midGrd.addColorStop(0.4, `rgba(99, 102, 241, ${0.14 + speedBoost * 0.08})`);
        midGrd.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, midR, 0, Math.PI * 2);
        ctx.fillStyle = midGrd;
        ctx.fill();

        // C. Bright Focal Core (~90px radius)
        const coreR = Math.min(W, H) * 0.10;
        const coreGrd = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, coreR);
        coreGrd.addColorStop(0, `rgba(165, 243, 252, ${0.35 + speedBoost * 0.2})`);
        coreGrd.addColorStop(0.5, `rgba(34, 211, 238, 0.15)`);
        coreGrd.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, coreR, 0, Math.PI * 2);
        ctx.fillStyle = coreGrd;
        ctx.fill();
      }

      /* ── 3. Update Particles & Physics ── */
      const CURSOR_INTERACTION_RADIUS = 260;

      particles.forEach(p => {
        if (!reduced) {
          // Responsive attraction toward cursor
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;

          if (dist < CURSOR_INTERACTION_RADIUS) {
            const force = (1 - dist / CURSOR_INTERACTION_RADIUS) * 0.35 * p.depth;
            // Gentle pull + subtle perpendicular swirl
            p.vx += (dx / dist) * force * 0.18 + (-dy / dist) * force * 0.06;
            p.vy += (dy / dist) * force * 0.18 + (dx / dist) * force * 0.06;
          }

          // Damping to keep motion buttery smooth
          p.vx *= 0.97;
          p.vy *= 0.97;

          // Natural background float velocity
          p.x += p.vx + Math.sin(t * 0.5 + p.phase) * 0.15 * p.depth;
          p.y += p.vy + Math.cos(t * 0.4 + p.phase) * 0.15 * p.depth;

          // Wrap edges with buffer
          if (p.x < -30) p.x = W + 20;
          if (p.x > W + 30) p.x = -20;
          if (p.y < -30) p.y = H + 20;
          if (p.y > H + 30) p.y = -20;
        }
      });

      /* ── 4. Inter-Particle Constellation Connections (Optimized) ── */
      const MAX_CONNECT = 130;
      const MAX_CONNECT_SQ = MAX_CONNECT * MAX_CONNECT;
      ctx.lineWidth = 0.8;

      for (let i = 0; i < particles.length; i++) {
        const pi = particles[i];
        const pix = pi.x + parallaxX * pi.depth;
        const piy = pi.y + parallaxY * pi.depth;

        for (let j = i + 1; j < particles.length; j++) {
          const pj = particles[j];
          const dx = pi.x - pj.x;
          const dy = pi.y - pj.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < MAX_CONNECT_SQ) {
            const dist = Math.sqrt(distSq);
            const alpha = (1 - dist / MAX_CONNECT) * 0.16 * pi.depth * pj.depth;
            const rgb = pi.rgb;
            ctx.beginPath();
            ctx.moveTo(pix, piy);
            ctx.lineTo(pj.x + parallaxX * pj.depth, pj.y + parallaxY * pj.depth);
            ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
            ctx.stroke();
          }
        }
      }

      /* ── 5. Dynamic Constellation Rays from Cursor to Nearby Particles ── */
      if (!reduced) {
        // Find particles near cursor and connect with glowing laser beams
        const nearParticles = particles
          .map(p => {
            const px = p.x + parallaxX * p.depth;
            const py = p.y + parallaxY * p.depth;
            const dx = mouse.x - px;
            const dy = mouse.y - py;
            const distSq = dx * dx + dy * dy;
            return { p, px, py, distSq };
          })
          .filter(item => item.distSq < 230 * 230)
          .sort((a, b) => a.distSq - b.distSq)
          .slice(0, 6); // Connect up to 6 nearest particles

        nearParticles.forEach(({ p, px, py, distSq }) => {
          const dist = Math.sqrt(distSq);
          const beamAlpha = (1 - dist / 230) * 0.45;
          const rgb = p.rgb;

          // Glowing laser line from cursor to particle
          ctx.beginPath();
          ctx.moveTo(mouse.x, mouse.y);
          ctx.lineTo(px, py);
          ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${beamAlpha})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // Subtle bright spark at midpoint
          const midX = (mouse.x + px) * 0.5;
          const midY = (mouse.y + py) * 0.5;
          ctx.beginPath();
          ctx.arc(midX, midY, 1.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${beamAlpha * 0.8})`;
          ctx.fill();
        });

        // Pulsing neon cursor reticle / ring
        const ringPulse = Math.sin(t * 3.5) * 4 + 20;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, ringPulse, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.28)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Tiny center spark
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fill();
      }

      /* ── 6. Render Particles with Pulsing & Proximity Flare ── */
      const PROXIMITY_RADIUS_SQ = 220 * 220;
      particles.forEach((p, i) => {
        const px = p.x + parallaxX * p.depth;
        const py = p.y + parallaxY * p.depth;

        // Proximity to cursor calculation (squared distance first)
        const dx = mouse.x - px;
        const dy = mouse.y - py;
        const distSq = dx * dx + dy * dy;
        const isNear = distSq < PROXIMITY_RADIUS_SQ;
        const dist = isNear ? Math.sqrt(distSq) : 999;
        const proximityBoost = isNear ? (1 - dist / 220) * 2.2 : 0;

        const pulse = Math.sin(t * 1.4 + p.phase + i * 0.2) * 0.15 + 0.85;
        const radius = Math.max(0.6, (p.baseR * pulse) + (proximityBoost * 1.5));
        const alpha = Math.min(1, (p.baseAlpha * pulse) + (proximityBoost * 0.6));

        // Particle core
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.rgb.r}, ${p.rgb.g}, ${p.rgb.b}, ${alpha})`;
        ctx.fill();

        // Halo for particles near cursor
        if (isNear && proximityBoost > 0.4) {
          ctx.beginPath();
          ctx.arc(px, py, radius * 2.8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${p.rgb.r}, ${p.rgb.g}, ${p.rgb.b}, ${alpha * 0.25})`;
          ctx.fill();
        }
      });

      if (!reduced) t += 0.012;
      animId = requestAnimationFrame(draw);
    };

    let isVisible = !document.hidden;
    const onVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible) {
        lastMouseX = mouse.x;
        lastMouseY = mouse.y;
        cancelAnimationFrame(animId);
        animId = requestAnimationFrame(draw);
      } else {
        cancelAnimationFrame(animId);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    draw();

    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [reduced]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none select-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
