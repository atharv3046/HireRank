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

    const observer = new IntersectionObserver(
      ([entry]) => {
        const wasVisible = isVisible;
        isVisible = entry.isIntersecting;
        if (isVisible && !wasVisible) {
          cancelAnimationFrame(animId);
          animId = requestAnimationFrame(draw);
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(canvas);

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 500;
      canvas.height = canvas.parentElement?.clientHeight || 500;
    };
    resize();
    window.addEventListener('resize', resize);

    const onMouse = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const w = canvas.width || 500;
      const h = canvas.height || 500;
      mouse.x = (e.clientX - r.left - w / 2) / (w / 2);
      mouse.y = (e.clientY - r.top - h / 2) / (h / 2);
    };
    if (!reduced) window.addEventListener('mousemove', onMouse, { passive: true });

    /* ── Geodesic Wireframe Sphere Rings ────────────────── */
    const LATITUDES = 7;
    const LONGITUDES = 8;
    const SPHERE_RADIUS = 0.44;

    const project = (
      x: number,
      y: number,
      z: number,
      cx: number,
      cy: number,
      rotY: number,
      rotX: number,
      scale: number
    ) => {
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      const x2 = x * cosY - z * sinY;
      const z2 = x * sinY + z * cosY;
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      const y2 = y * cosX - z2 * sinX;
      const z3 = y * sinX + z2 * cosX;
      const fov = 1.6 / (1.6 + z3 * 0.4);
      return { sx: cx + x2 * scale * fov, sy: cy + y2 * scale * fov, depth: z3 };
    };

    let t = 0;

    const draw = () => {
      if (!canvas || !ctx || !isVisible) return;
      const W = canvas.width;
      const H = canvas.height;
      const cx = W / 2;
      const cy = H / 2;
      const scale = Math.min(W, H) * 0.85;

      const rotY = reduced ? 0.3 : t * 0.35 + mouse.x * 0.25;
      const rotX = reduced ? 0.2 : 0.25 + mouse.y * 0.2 + Math.sin(t * 0.2) * 0.08;

      ctx.clearRect(0, 0, W, H);

      // 1. Draw Longitudes (vertical rings)
      for (let i = 0; i < LONGITUDES; i++) {
        const angle = (i / LONGITUDES) * Math.PI;
        ctx.beginPath();
        for (let s = 0; s <= 60; s++) {
          const a = (s / 60) * Math.PI * 2;
          const x = SPHERE_RADIUS * Math.sin(a) * Math.cos(angle);
          const y = SPHERE_RADIUS * Math.cos(a);
          const z = SPHERE_RADIUS * Math.sin(a) * Math.sin(angle);
          const pt = project(x, y, z, cx, cy, rotY, rotX, scale);
          if (s === 0) ctx.moveTo(pt.sx, pt.sy);
          else ctx.lineTo(pt.sx, pt.sy);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(94, 234, 212, 0.16)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 2. Draw Latitudes (horizontal rings)
      for (let i = 1; i < LATITUDES; i++) {
        const phi = (i / LATITUDES - 0.5) * Math.PI;
        const rSub = SPHERE_RADIUS * Math.cos(phi);
        const y = SPHERE_RADIUS * Math.sin(phi);

        ctx.beginPath();
        for (let s = 0; s <= 60; s++) {
          const theta = (s / 60) * Math.PI * 2;
          const x = rSub * Math.cos(theta);
          const z = rSub * Math.sin(theta);
          const pt = project(x, y, z, cx, cy, rotY, rotX, scale);
          if (s === 0) ctx.moveTo(pt.sx, pt.sy);
          else ctx.lineTo(pt.sx, pt.sy);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(94, 234, 212, 0.13)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 3. Subtle outer orbit ring
      ctx.beginPath();
      for (let s = 0; s <= 60; s++) {
        const a = (s / 60) * Math.PI * 2;
        const x = (SPHERE_RADIUS * 1.15) * Math.cos(a);
        const z = (SPHERE_RADIUS * 1.15) * Math.sin(a);
        const pt = project(x, 0, z, cx, cy, rotY * 0.7, rotX + 0.4, scale);
        if (s === 0) ctx.moveTo(pt.sx, pt.sy);
        else ctx.lineTo(pt.sx, pt.sy);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(94, 234, 212, 0.22)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // 4. Single quiet orbiting satellite dot
      const satAngle = t * 0.8;
      const satPt = project(
        (SPHERE_RADIUS * 1.15) * Math.cos(satAngle),
        0,
        (SPHERE_RADIUS * 1.15) * Math.sin(satAngle),
        cx, cy, rotY * 0.7, rotX + 0.4, scale
      );
      ctx.beginPath();
      ctx.arc(satPt.sx, satPt.sy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#5eead4';
      ctx.fill();

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
  }, [reduced]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none select-none ${className}`}
      aria-hidden="true"
      style={{ display: 'block' }}
    />
  );
}
