import { useEffect, useRef, type ReactNode } from "react";
import { HeroBackdrop } from "./hero-backdrop";

type Particle = { x: number; y: number; speed: number; opacity: number; fadeStart: number; fadingOut: boolean };

export function MinimalHero({ children }: { children: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let particles: Particle[] = [];
    let animationFrame = 0;
    const reset = (particle: Particle) => {
      particle.x = Math.random() * canvas.width;
      particle.y = Math.random() * canvas.height;
      particle.speed = Math.random() / 5 + 0.1;
      particle.opacity = 0.14;
      particle.fadeStart = Date.now() + Math.random() * 2000 + 1000;
      particle.fadingOut = false;
    };
    const setSize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      particles = Array.from({ length: Math.min(35, Math.floor(canvas.width * canvas.height / 20000)) }, () => {
        const particle: Particle = { x: 0, y: 0, speed: 0, opacity: 0, fadeStart: 0, fadingOut: false };
        reset(particle);
        return particle;
      });
    };
    const draw = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      for (const particle of particles) {
        particle.y -= particle.speed;
        if (particle.y < 0) reset(particle);
        if (Date.now() > particle.fadeStart) particle.fadingOut = true;
        if (particle.fadingOut) {
          particle.opacity -= 0.002;
          if (particle.opacity <= 0) reset(particle);
        }
        context.fillStyle = `rgba(34, 102, 235, ${particle.opacity})`;
        context.fillRect(particle.x, particle.y, 1, 1.5);
      }
      animationFrame = requestAnimationFrame(draw);
    };
    const syncMotion = () => {
      cancelAnimationFrame(animationFrame);
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (!motionPreference.matches && document.visibilityState === "visible") animationFrame = requestAnimationFrame(draw);
    };
    setSize();
    syncMotion();
    const resizeObserver = new ResizeObserver(setSize);
    resizeObserver.observe(canvas);
    motionPreference.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncMotion);
    return () => {
      resizeObserver.disconnect();
      motionPreference.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncMotion);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return <section className="minimal-root"><HeroBackdrop /><canvas ref={canvasRef} className="hero-particles" aria-hidden="true" />{children}</section>;
}
