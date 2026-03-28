import { useEffect, useRef } from "react";

interface Bubble {
  x: number;
  y: number;
  radius: number;
  dx: number;
  dy: number;
  opacity: number;
  hue: number;
  pulseSpeed: number;
  pulsePhase: number;
}

interface Props {
  darkMode: boolean;
  animationStyle: "float" | "pulse" | "orbit" | "minimal";
}

export default function AnimatedBubbles({ darkMode, animationStyle }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const count = animationStyle === "minimal" ? 10 : animationStyle === "orbit" ? 24 : 20;
    if (bubblesRef.current.length === 0) {
      for (let i = 0; i < count; i++) {
        bubblesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: 15 + Math.random() * 40,
          dx: (Math.random() - 0.5) * (animationStyle === "minimal" ? 0.25 : 0.6),
          dy: (Math.random() - 0.5) * (animationStyle === "minimal" ? 0.25 : 0.6),
          opacity: animationStyle === "minimal" ? 0.05 + Math.random() * 0.08 : 0.08 + Math.random() * 0.12,
          hue: Math.random() * 360,
          pulseSpeed: 0.01 + Math.random() * 0.02,
          pulsePhase: Math.random() * Math.PI * 2,
        });
      }
    }

      let time = 0;
    const animate = () => {
      time += 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      bubblesRef.current.forEach((b, i) => {
        if (animationStyle === "orbit") {
          const cx = canvas.width * 0.5;
          const cy = canvas.height * 0.5;
          const orbitR = 80 + (i % 12) * 40;
          const speed = 0.002 + (i % 5) * 0.0006;
          b.x = cx + Math.cos(time * speed + i) * orbitR;
          b.y = cy + Math.sin(time * speed + i) * orbitR * 0.7;
        } else {
          b.x += b.dx;
          b.y += b.dy;
        }
        b.pulsePhase += b.pulseSpeed;

        if (b.x < -b.radius) b.x = canvas.width + b.radius;
        if (b.x > canvas.width + b.radius) b.x = -b.radius;
        if (b.y < -b.radius) b.y = canvas.height + b.radius;
        if (b.y > canvas.height + b.radius) b.y = -b.radius;

        const pulseAmount = animationStyle === "pulse" ? 9 : animationStyle === "minimal" ? 2.5 : 5;
        const pulseRadius = b.radius + Math.sin(b.pulsePhase) * pulseAmount;
        const gradient = ctx.createRadialGradient(
          b.x,
          b.y,
          0,
          b.x,
          b.y,
          pulseRadius
        );

        if (darkMode) {
          gradient.addColorStop(0, `hsla(${b.hue}, 80%, 60%, ${b.opacity * 1.5})`);
          gradient.addColorStop(1, `hsla(${b.hue}, 80%, 60%, 0)`);
        } else {
          gradient.addColorStop(0, `hsla(${b.hue}, 70%, 50%, ${b.opacity})`);
          gradient.addColorStop(1, `hsla(${b.hue}, 70%, 50%, 0)`);
    }

        ctx.beginPath();
        ctx.arc(b.x, b.y, pulseRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [darkMode, animationStyle]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.7 }}
    />
  );
}
