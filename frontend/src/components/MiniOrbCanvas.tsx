import { useRef, useEffect } from 'react';

interface MiniOrbCanvasProps {
  color?: string;
  reduced?: boolean;
  className?: string;
}

export default function MiniOrbCanvas({ color = '#5eead4', reduced = false, className = '' }: MiniOrbCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let isVisible = true;

    // Pause rendering when this mini canvas is not in the viewport
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
      canvas.width  = canvas.offsetWidth  || 128;
      canvas.height = canvas.offsetHeight || 128;
    };
    resize();
    window.addEventListener('resize', resize);

    /* Icosahedron vertices (normalized) */
    const phi = (1 + Math.sqrt(5)) / 2;
    const raw = [
      [-1,  phi, 0], [ 1,  phi, 0], [-1, -phi, 0], [ 1, -phi, 0],
      [ 0, -1,  phi], [ 0,  1,  phi], [ 0, -1, -phi], [ 0,  1, -phi],
      [ phi, 0, -1], [ phi, 0,  1], [-phi, 0, -1], [-phi, 0,  1],
    ];
    const len = Math.sqrt(1 + phi * phi);
    const verts = raw.map(([x, y, z]) => ({ x: x / len, y: y / len, z: z / len }));

    const edges = [
      [0,1],[0,5],[0,7],[0,10],[0,11],
      [1,5],[1,7],[1,8],[1,9],
      [2,3],[2,4],[2,6],[2,10],[2,11],
      [3,4],[3,6],[3,8],[3,9],
      [4,5],[4,9],[4,11],
      [5,9],[5,11],
      [6,7],[6,8],[6,10],
      [7,8],[7,10],
      [8,9],[10,11],
    ];

    /* Torus ring points — two rings */
    const ringPts = Array.from({ length: 80 }, (_, i) => {
      const a = (i / 80) * Math.PI * 2;
      return { x: Math.cos(a) * 0.9, y: Math.sin(a) * 0.9, z: 0 };
    });
    const ring2Pts = Array.from({ length: 60 }, (_, i) => {
      const a = (i / 60) * Math.PI * 2;
      return { x: Math.cos(a) * 0.7, y: 0, z: Math.sin(a) * 0.7 };
    });

    /* Orbiting satellites */
    const satellites = [
      { radius: 0.95, speed: 0.8,  size: 1.8, phase: 0,    tiltX: 1.2  },
      { radius: 0.75, speed: -0.5, size: 1.4, phase: 2.1,  tiltX: 0.5  },
      { radius: 1.05, speed: 0.35, size: 1.2, phase: 4.2,  tiltX: -0.8 },
    ];

    const project = (x: number, y: number, z: number, cx: number, cy: number, rx: number, ry: number, scale: number) => {
      const cosY = Math.cos(ry), sinY = Math.sin(ry);
      const x2 = x * cosY - z * sinY, z2 = x * sinY + z * cosY;
      const cosX = Math.cos(rx), sinX = Math.sin(rx);
      const y2 = y * cosX - z2 * sinX, z3 = y * sinX + z2 * cosX;
      const fov = 2.2 / (2.2 + z3 * 0.3);
      return { sx: cx + x2 * scale * fov, sy: cy + y2 * scale * fov, depth: z3 };
    };

    let t = 0;
    const draw = () => {
      if (!canvas || !ctx || !isVisible) return;
      const W = canvas.width, H = canvas.height;
      const cx = W / 2, cy = H / 2;
      const scale = Math.min(W, H) * 0.32;
      const ry  = reduced ? 0.3  : t * 0.4;
      const rx  = reduced ? 0.3  : Math.sin(t * 0.22) * 0.35;
      const ry2 = reduced ? 0    : t * -0.45;
      const rx2 = reduced ? 0.5  : t * 0.3;

      ctx.clearRect(0, 0, W, H);

      /* Wireframe icosahedron */
      edges.forEach(([a, b]) => {
        const va = verts[a], vb = verts[b];
        const pa = project(va.x, va.y, va.z, cx, cy, rx, ry, scale);
        const pb = project(vb.x, vb.y, vb.z, cx, cy, rx, ry, scale);
        const alpha = Math.max(0.08, Math.min(0.8, 0.35 + (pa.depth + pb.depth) * 0.25));
        ctx.beginPath();
        ctx.moveTo(pa.sx, pa.sy);
        ctx.lineTo(pb.sx, pb.sy);
        ctx.strokeStyle = color + Math.round(alpha * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      /* Glow ring 1 */
      ctx.beginPath();
      ringPts.forEach((p, i) => {
        const { sx, sy } = project(p.x, p.y, p.z, cx, cy, 1.1, ry2, scale);
        i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
      });
      ctx.closePath();
      ctx.strokeStyle = color + '50';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      /* Glow ring 2 (equatorial, different tilt) */
      ctx.beginPath();
      ring2Pts.forEach((p, i) => {
        const { sx, sy } = project(p.x, p.y, p.z, cx, cy, rx2, ry + 0.8, scale);
        i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
      });
      ctx.closePath();
      ctx.strokeStyle = color + '35';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      /* Orbiting satellite dots */
      satellites.forEach(s => {
        const angle = reduced ? s.phase : t * s.speed + s.phase;
        const { sx, sy, depth } = project(
          Math.cos(angle) * s.radius,
          Math.sin(angle * 0.4) * 0.2,
          Math.sin(angle) * s.radius,
          cx, cy, rx + s.tiltX, ry, scale
        );
        const alpha = Math.max(0.2, Math.min(1, 0.5 + depth * 0.5));
        const pulse = Math.sin(t * 2 + s.phase) * 0.25 + 0.75;
        // Outer halo
        ctx.beginPath();
        ctx.arc(sx, sy, s.size * pulse * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = color + '45';
        ctx.fill();
        // Core dot
        ctx.beginPath();
        ctx.arc(sx, sy, s.size * pulse, 0, Math.PI * 2);
        ctx.fillStyle = color + Math.round(alpha * 255).toString(16).padStart(2, '0');
        ctx.fill();
      });

      /* Glowing center core */
      const coreSize = scale * 0.08 * (Math.sin(t * 1.5) * 0.1 + 0.9);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreSize * 3);
      grad.addColorStop(0, color + 'cc');
      grad.addColorStop(0.3, color + '55');
      grad.addColorStop(1, color + '00');
      ctx.beginPath();
      ctx.arc(cx, cy, coreSize * 3, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      /* Solid core dot with subtle outer halo */
      ctx.beginPath();
      ctx.arc(cx, cy, coreSize * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = color + '55';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, coreSize, 0, Math.PI * 2);
      ctx.fillStyle = color + 'ee';
      ctx.fill();

      if (!reduced) t += 0.012;
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [reduced, color]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none select-none ${className}`}
      aria-hidden="true"
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
}
