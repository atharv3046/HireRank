/**
 * GlobalBackground — site-wide quiet reactive cursor constellation canvas.
 *
 * Refined per user specifications:
 *  - Crisp ~12px cursor reticle with thin accent ring and center pip (no big blue haze)
 *  - Eased cursor physics (lerp: 0.12)
 *  - Constellation lines brighten selectively near cursor
 *  - Disabled on touch devices and under prefers-reduced-motion
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

    // Check touch devices
    const isTouch =
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0);

    const shouldDisableInteractive = reduced || isTouch;

    let animId: number;

    const mouse = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      targetX: window.innerWidth / 2,
      targetY: window.innerHeight / 2,
      active: !shouldDisableInteractive,
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const onPointerMove = (e: PointerEvent) => {
      if (shouldDisableInteractive) return;
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      mouse.active = true;
    };

    const onMouseLeave = () => {
      mouse.targetX = window.innerWidth / 2;
      mouse.targetY = window.innerHeight / 2;
      mouse.active = false;
    };

    if (!shouldDisableInteractive) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      document.addEventListener('mouseleave', onMouseLeave);
    }

    /* ── Particles Definition ── */
    type Particle = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      baseR: number;
      baseAlpha: number;
      phase: number;
      depth: number;
    };

    const COUNT = shouldDisableInteractive ? 28 : 65;

    const particles: Particle[] = Array.from({ length: COUNT }, () => {
      const depth = Math.random() * 0.6 + 0.4;
      return {
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.25 * depth,
        vy: (Math.random() - 0.5) * 0.25 * depth,
        baseR: (Math.random() * 1.2 + 0.6) * depth,
        baseAlpha: Math.random() * 0.25 + 0.1,
        phase: Math.random() * Math.PI * 2,
        depth,
      };
    });

    let t = 0;

    const draw = () => {
      if (!canvas || !ctx) return;
      const W = canvas.width;
      const H = canvas.height;

      ctx.clearRect(0, 0, W, H);

      // Smooth cursor lerp
      if (!shouldDisableInteractive && mouse.active) {
        mouse.x += (mouse.targetX - mouse.x) * 0.12;
        mouse.y += (mouse.targetY - mouse.y) * 0.12;
      }

      /* ── 1. Update Particles ── */
      const INTERACTION_R = 180;
      particles.forEach((p) => {
        if (!shouldDisableInteractive && mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;

          if (dist < INTERACTION_R) {
            const force = (1 - dist / INTERACTION_R) * 0.15 * p.depth;
            p.vx += (dx / dist) * force * 0.12;
            p.vy += (dy / dist) * force * 0.12;
          }

          p.vx *= 0.96;
          p.vy *= 0.96;
        }

        // Float
        p.x += p.vx + Math.sin(t * 0.4 + p.phase) * 0.08 * p.depth;
        p.y += p.vy + Math.cos(t * 0.35 + p.phase) * 0.08 * p.depth;

        // Wrap around bounds
        if (p.x < -20) p.x = W + 20;
        if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20;
        if (p.y > H + 20) p.y = -20;
      });

      /* ── 2. Inter-Particle Constellation Connections ── */
      const MAX_DIST = 110;
      const MAX_DIST_SQ = MAX_DIST * MAX_DIST;

      for (let i = 0; i < particles.length; i++) {
        const pi = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const pj = particles[j];
          const dx = pi.x - pj.x;
          const dy = pi.y - pj.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < MAX_DIST_SQ) {
            const dist = Math.sqrt(distSq);

            // Check if this connection is near the cursor
            let nearBoost = 0;
            if (!shouldDisableInteractive && mouse.active) {
              const midX = (pi.x + pj.x) * 0.5;
              const midY = (pi.y + pj.y) * 0.5;
              const dCursor = Math.hypot(mouse.x - midX, mouse.y - midY);
              if (dCursor < 170) {
                nearBoost = (1 - dCursor / 170) * 0.35;
              }
            }

            ctx.beginPath();
            ctx.moveTo(pi.x, pi.y);
            ctx.lineTo(pj.x, pj.y);

            if (nearBoost > 0) {
              // Accent color (#5eead4) brightened near cursor
              ctx.strokeStyle = `rgba(94, 234, 212, ${(1 - dist / MAX_DIST) * 0.2 + nearBoost * 0.3})`;
              ctx.lineWidth = 0.9;
            } else {
              // Very subtle background connection
              ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - dist / MAX_DIST) * 0.04})`;
              ctx.lineWidth = 0.6;
            }
            ctx.stroke();
          }
        }
      }

      /* ── 3. Cursor Constellation Rays to Nearest Particles ── */
      if (!shouldDisableInteractive && mouse.active) {
        const near = particles
          .map((p) => {
            const dx = mouse.x - p.x;
            const dy = mouse.y - p.y;
            return { p, dist: Math.sqrt(dx * dx + dy * dy) };
          })
          .filter((item) => item.dist < 160)
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 4);

        near.forEach(({ p, dist }) => {
          const alpha = (1 - dist / 160) * 0.4;
          ctx.beginPath();
          ctx.moveTo(mouse.x, mouse.y);
          ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = `rgba(94, 234, 212, ${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        });

        // ── 4. Crisp 12px Cursor Orb & Ring (no big blue haze) ──
        // Very soft 40px micro-ambient glow
        const microGlow = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 45);
        microGlow.addColorStop(0, 'rgba(94, 234, 212, 0.12)');
        microGlow.addColorStop(1, 'rgba(94, 234, 212, 0)');
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 45, 0, Math.PI * 2);
        ctx.fillStyle = microGlow;
        ctx.fill();

        // 12px outer ring (radius 6px)
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(94, 234, 212, 0.7)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Center pip
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#5eead4';
        ctx.fill();
      }

      /* ── 5. Render Particle Dots ── */
      particles.forEach((p) => {
        let r = p.baseR;
        let a = p.baseAlpha;

        if (!shouldDisableInteractive && mouse.active) {
          const dCursor = Math.hypot(mouse.x - p.x, mouse.y - p.y);
          if (dCursor < 140) {
            const boost = (1 - dCursor / 140);
            r += boost * 1.2;
            a = Math.min(0.9, a + boost * 0.5);
          }
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
        ctx.fill();
      });

      t += 0.01;
      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      if (!shouldDisableInteractive) {
        window.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('mouseleave', onMouseLeave);
      }
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
