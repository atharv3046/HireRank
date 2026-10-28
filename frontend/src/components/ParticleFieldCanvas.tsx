import { useRef, useEffect } from 'react';

interface ParticleFieldCanvasProps {
  reduced?: boolean;
  className?: string;
  color?: string;
  particleCount?: number;
  connectDistance?: number;
}

/**
 * Full-width floating particle constellation canvas.
 * Particles drift slowly, connect to neighbors within connectDistance.
 * Reacts subtly to mouse position.
 */
export default function ParticleFieldCanvas({
  reduced = false,
  className = '',
  color = '#5eead4',
  particleCount = 80,
  connectDistance = 0.18,
}: ParticleFieldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let isVisible = true;
    const mouse = { x: 0.5, y: 0.5 };

    // Pause rendering when this particle field is not in the viewport
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
      canvas.width  = canvas.offsetWidth  || 800;
      canvas.height = canvas.offsetHeight || 300;
    };
    resize();
    window.addEventListener('resize', resize);

    const onMouse = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) / (canvas.width  || 800);
      mouse.y = (e.clientY - r.top)  / (canvas.height || 300);
    };
    if (!reduced) window.addEventListener('mousemove', onMouse, { passive: true });

    // Parse hex color to rgb components
    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    };
    const rgb = hexToRgb(color);

    type Particle = {
      x: number; y: number;
      vx: number; vy: number;
      r: number;
      alpha: number;
    };

    const particles: Particle[] = Array.from({ length: reduced ? 30 : particleCount }, () => ({
      x:  Math.random(),
      y:  Math.random(),
      vx: (Math.random() - 0.5) * 0.00015,
      vy: (Math.random() - 0.5) * 0.00015,
      r:  Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.4 + 0.1,
    }));

    let t = 0;

    const draw = () => {
      if (!canvas || !ctx || !isVisible) return;
      const W = canvas.width, H = canvas.height;

      ctx.clearRect(0, 0, W, H);

      // Update positions
      if (!reduced) {
        particles.forEach(p => {
          // Gentle attraction toward mouse
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 0.09) {
            const dist = Math.sqrt(distSq) + 0.001;
            p.vx += (dx / dist) * 0.000008;
            p.vy += (dy / dist) * 0.000008;
          }
          p.vx *= 0.998;
          p.vy *= 0.998;
          p.x += p.vx;
          p.y += p.vy;
          // Wrap around edges
          if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0;
          if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;
        });
      }

      // Draw connections
      const cd2 = connectDistance * connectDistance;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < cd2) {
            const strength = 1 - Math.sqrt(d2) / connectDistance;
            ctx.beginPath();
            ctx.moveTo(particles[i].x * W, particles[i].y * H);
            ctx.lineTo(particles[j].x * W, particles[j].y * H);
            ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${strength * 0.18})`;
            ctx.lineWidth = strength * 1.2;
            ctx.stroke();
          }
        }
      }

      // Draw particles (fast dual-arc halo without allocating new radial gradients)
      particles.forEach((p, i) => {
        const pulse = Math.sin(t * 1.2 + i * 0.8) * 0.15 + 0.85;
        const alpha = p.alpha * pulse;
        const px = p.x * W;
        const py = p.y * H;

        // Outer glow halo
        ctx.beginPath();
        ctx.arc(px, py, p.r * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha * 0.25})`;
        ctx.fill();

        // Inner particle core
        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
        ctx.fill();
      });

      if (!reduced) t += 0.01;
      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      window.removeEventListener('resize', resize);
      if (!reduced) window.removeEventListener('mousemove', onMouse);
    };
  }, [reduced, color, particleCount, connectDistance]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none select-none ${className}`}
      aria-hidden="true"
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
}
