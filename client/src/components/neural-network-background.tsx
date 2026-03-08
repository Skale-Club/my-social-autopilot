import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type NeuralNetworkBackgroundProps = {
  className?: string;
};

type Star = {
  x: number;
  y: number;
  radius: number;
  baseOpacity: number;
  opacity: number;
  flickerSpeed: number;
  flickerPhase: number;
  vx: number;
  vy: number;
  color: string;
  glow: boolean;
};

type TrailParticle = {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  vx: number;
  vy: number;
};

type ShootingStar = {
  x: number;
  y: number;
  speed: number;
  length: number;
  angle: number;
  opacity: number;
  life: number;
  maxLife: number;
  trail: TrailParticle[];
  color: string;
};

type MilkyWayBand = {
  centerX: number;
  centerY: number;
  width: number;
  length: number;
  angle: number;
};

const NUM_STARS = 600;
const MILKY_WAY_STAR_COUNT = 500;
const SHOOTING_STAR_FREQ = 0.003;
const SPOTLIGHT_RADIUS = 280;
const DIM_OPACITY = 0;
const SPOTLIGHT_EASING = 0.08;
const SKY_SATURATION = 0.42;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function desaturateColor(r: number, g: number, b: number, saturation = SKY_SATURATION) {
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  return {
    r: clamp(gray + (r - gray) * saturation, 0, 255),
    g: clamp(gray + (g - gray) * saturation, 0, 255),
    b: clamp(gray + (b - gray) * saturation, 0, 255),
  };
}

export function NeuralNetworkBackground({ className }: NeuralNetworkBackgroundProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let mouseX = 0;
    let mouseY = 0;
    let parallaxX = 0;
    let parallaxY = 0;
    let rafId = 0;

    const milkyWay: MilkyWayBand = {
      centerX: 0,
      centerY: 0,
      width: 0,
      length: 0,
      angle: -Math.PI / 20,
    };

    let stars: Star[] = [];
    let milkyWayStars: Star[] = [];
    let shootingStars: ShootingStar[] = [];

    const generateStarColor = () => {
      const spectralType = Math.random();
      let r = 255;
      let g = 255;
      let b = 255;

      if (spectralType < 0.01) {
        r = 155 + Math.random() * 20;
        g = 176 + Math.random() * 20;
        b = 255;
      } else if (spectralType < 0.1) {
        r = 170 + Math.random() * 30;
        g = 200 + Math.random() * 40;
        b = 255;
      } else if (spectralType < 0.3) {
        r = 235 + Math.random() * 15;
        g = 240 + Math.random() * 15;
        b = 255;
      } else if (spectralType < 0.5) {
        r = 255;
        g = 245 + Math.random() * 10;
        b = 220 + Math.random() * 20;
      } else if (spectralType < 0.7) {
        r = 255;
        g = 230 + Math.random() * 10;
        b = 180 + Math.random() * 20;
      } else if (spectralType < 0.9) {
        r = 255;
        g = 190 + Math.random() * 20;
        b = 120 + Math.random() * 20;
      } else {
        r = 255;
        g = 120 + Math.random() * 20;
        b = 100 + Math.random() * 20;
      }

      r = clamp(r + Math.random() * 8 - 4, 0, 255);
      g = clamp(g + Math.random() * 8 - 4, 0, 255);
      b = clamp(b + Math.random() * 8 - 4, 0, 255);
      const desaturated = desaturateColor(r, g, b);
      return `${Math.round(desaturated.r)}, ${Math.round(desaturated.g)}, ${Math.round(desaturated.b)}`;
    };

    const createStar = (): Star => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 1.1 + 0.1,
      baseOpacity: Math.random() * 0.7 + 0.3,
      opacity: 0,
      flickerSpeed: Math.random() * 0.1 + 0.02,
      flickerPhase: Math.random() * Math.PI * 2,
      vx: (Math.random() - 0.5) * 0.001,
      vy: (Math.random() - 0.5) * 0.001,
      color: generateStarColor(),
      glow: Math.random() < 0.25,
    });

    const createMilkyWayStar = (): Star => {
      const posX = (Math.random() - 0.5) * milkyWay.length;
      const curvature = 0.00002;
      const curveY = curvature * posX * posX;
      const posY = curveY + (Math.random() - 0.5) * milkyWay.width;

      const rotatedX = posX * Math.cos(milkyWay.angle) - posY * Math.sin(milkyWay.angle);
      const rotatedY = posX * Math.sin(milkyWay.angle) + posY * Math.cos(milkyWay.angle);

      return {
        x: milkyWay.centerX + rotatedX,
        y: milkyWay.centerY + rotatedY,
        radius: Math.random() * 0.6 + 0.1,
        baseOpacity: Math.random() * 0.6 + 0.4,
        opacity: 0,
        flickerSpeed: Math.random() * 0.1 + 0.05,
        flickerPhase: Math.random() * Math.PI * 2,
        vx: 0,
        vy: 0,
        color: generateStarColor(),
        glow: Math.random() < 0.3,
      };
    };

    const createShootingStar = (): ShootingStar => {
      const speed = 30 + Math.random() * 30;
      const maxLife = 40 + Math.random() * 20;
      const length = speed * (12 + Math.random() * 10);
      const startX = Math.random() * canvas.width;
      const startY = Math.random() * canvas.height * 0.7;
      const shootLeft = startX > canvas.width / 2;
      const baseAngle = shootLeft ? Math.PI : 0;
      const angleVariation = (Math.random() - 0.5) * (Math.PI / 10);
      const angle = baseAngle + angleVariation;

      const colorOptions: [number, number, number][] = [
        [180, 230, 255],
        [100, 210, 220],
        [80, 200, 180],
        [120, 255, 210],
        [140, 255, 240],
      ];
      const [r, g, b] = colorOptions[Math.floor(Math.random() * colorOptions.length)];
      const desaturated = desaturateColor(r, g, b, 0.5);
      const color = `${Math.round(desaturated.r)}, ${Math.round(desaturated.g)}, ${Math.round(desaturated.b)}`;

      return {
        x: startX,
        y: startY,
        speed,
        length,
        angle,
        opacity: 0.2,
        life: 0,
        maxLife,
        trail: [],
        color,
      };
    };

    // Posição suavizada do spotlight (em pixels)
    let spotX = canvas.width / 2;
    let spotY = canvas.height / 2;
    // Posição alvo (onde o mouse/dedo está)
    let targetSpotX = spotX;
    let targetSpotY = spotY;

    const getFadeOpacity = (x: number, y: number) => {
      const dx = x - spotX;
      const dy = y - spotY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > SPOTLIGHT_RADIUS) return DIM_OPACITY;
      // Curva suave: perto do centro = 1, na borda = DIM_OPACITY
      const t = dist / SPOTLIGHT_RADIUS;
      const smooth = 1 - t * t; // quadrática para transição mais natural
      return DIM_OPACITY + smooth * (1 - DIM_OPACITY);
    };

    const drawStar = (star: Star, offsetX = 0, offsetY = 0) => {
      const x = star.x + offsetX;
      const y = star.y + offsetY;

      if (star.glow) {
        const glowRadius = star.radius * 5 + Math.random() * 3;
        const gradient = ctx.createRadialGradient(x, y, star.radius, x, y, glowRadius);
        gradient.addColorStop(0, `rgba(${star.color}, ${star.opacity * 0.6})`);
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.fillStyle = `rgba(${star.color}, ${star.opacity})`;
      ctx.shadowColor = `rgba(${star.color}, ${star.opacity})`;
      ctx.shadowBlur = star.radius * 1.5 + (star.glow ? 1.5 : 0);
      ctx.arc(x, y, star.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    const drawMilkyWayGlow = () => {
      const gradient = ctx.createRadialGradient(
        milkyWay.centerX,
        milkyWay.centerY,
        milkyWay.width / 4,
        milkyWay.centerX,
        milkyWay.centerY,
        milkyWay.width,
      );
      gradient.addColorStop(0, "rgba(210, 220, 232, 0.14)");
      gradient.addColorStop(1, "rgba(210, 220, 232, 0)");

      ctx.fillStyle = gradient;
      ctx.save();
      ctx.translate(milkyWay.centerX, milkyWay.centerY);
      ctx.rotate(milkyWay.angle);
      ctx.beginPath();
      ctx.ellipse(0, 0, milkyWay.length / 2, milkyWay.width, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawShootingStar = (shoot: ShootingStar) => {
      ctx.save();
      ctx.translate(shoot.x, shoot.y);
      ctx.rotate(shoot.angle);

      const tailLength = shoot.length;
      const frontWidth = 2.5;
      const backWidth = 0.3;

      const gradient = ctx.createLinearGradient(0, 0, -tailLength, 0);
      gradient.addColorStop(0, `rgba(${shoot.color}, ${shoot.opacity * 0.7})`);
      gradient.addColorStop(0.7, `rgba(${shoot.color}, ${shoot.opacity * 0.4})`);
      gradient.addColorStop(1, `rgba(${shoot.color}, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, -frontWidth / 2);
      ctx.lineTo(-tailLength, -backWidth / 2);
      ctx.lineTo(-tailLength, backWidth / 2);
      ctx.lineTo(0, frontWidth / 2);
      ctx.closePath();
      ctx.fill();

      ctx.shadowColor = `rgba(255, 255, 255, ${shoot.opacity})`;
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 255, 255, ${shoot.opacity})`;
      ctx.arc(0, 0, frontWidth * 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      ctx.restore();

      for (let i = 0; i < shoot.trail.length; i += 1) {
        const p = shoot.trail[i];
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = 2;
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    };

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width));
      canvas.height = Math.max(1, Math.floor(rect.height));

      milkyWay.centerX = canvas.width / 2;
      milkyWay.centerY = canvas.height / 2 + 50;
      milkyWay.width = canvas.height / 4;
      milkyWay.length = canvas.width * 1.2;

      stars = [];
      milkyWayStars = [];
      shootingStars = [];

      for (let i = 0; i < NUM_STARS; i += 1) stars.push(createStar());
      for (let i = 0; i < MILKY_WAY_STAR_COUNT; i += 1) milkyWayStars.push(createMilkyWayStar());
    };

    const updatePointer = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const relX = clientX - rect.left;
      const relY = clientY - rect.top;
      mouseX = clamp((relX / Math.max(rect.width, 1)) * 2 - 1, -1, 1);
      mouseY = clamp((relY / Math.max(rect.height, 1)) * 2 - 1, -1, 1);
      // Só atualiza spotlight se o pointer está dentro do canvas
      if (relX >= 0 && relX <= rect.width && relY >= 0 && relY <= rect.height) {
        targetSpotX = relX;
        targetSpotY = relY;
      }
    };

    const onMouseMove = (e: MouseEvent) => updatePointer(e.clientX, e.clientY);

    const onTouch = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        updatePointer(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const easing = 0.05;
      parallaxX += (mouseX * 50 - parallaxX) * easing;
      parallaxY += (mouseY * 30 - parallaxY) * easing;

      // Suaviza posição do spotlight
      spotX += (targetSpotX - spotX) * SPOTLIGHT_EASING;
      spotY += (targetSpotY - spotY) * SPOTLIGHT_EASING;

      drawMilkyWayGlow();

      const driftSpeed = 0.00005;

      for (let i = 0; i < stars.length; i += 1) {
        const star = stars[i];
        star.flickerPhase += star.flickerSpeed;
        const baseOpacity = clamp(star.baseOpacity + Math.sin(star.flickerPhase) * 0.15, 0.3, 1);
        const offsetX = parallaxX * star.radius * 0.3;
        const offsetY = parallaxY * star.radius * 0.3;
        const fadeOpacity = getFadeOpacity(star.x + offsetX, star.y + offsetY);
        star.opacity = baseOpacity * fadeOpacity;

        star.x += star.vx + driftSpeed;
        star.y += star.vy;

        if (star.x > canvas.width) star.x = 0;
        else if (star.x < 0) star.x = canvas.width;
        if (star.y > canvas.height) star.y = 0;
        else if (star.y < 0) star.y = canvas.height;

        drawStar(star, offsetX, offsetY);
      }

      for (let i = 0; i < milkyWayStars.length; i += 1) {
        const star = milkyWayStars[i];
        star.flickerPhase += star.flickerSpeed;
        const baseOpacity = clamp(star.baseOpacity + Math.sin(star.flickerPhase) * 0.15, 0.3, 1);
        const offsetX = parallaxX * star.radius * 0.2;
        const offsetY = parallaxY * star.radius * 0.2;
        const fadeOpacity = getFadeOpacity(star.x + offsetX, star.y + offsetY);
        star.opacity = baseOpacity * fadeOpacity;
        drawStar(star, offsetX, offsetY);
      }

      if (shootingStars.length === 0 && Math.random() < SHOOTING_STAR_FREQ) {
        shootingStars.push(createShootingStar());
      }

      for (let i = shootingStars.length - 1; i >= 0; i -= 1) {
        const shoot = shootingStars[i];
        shoot.life += 1;

        shoot.trail.push({
          x: shoot.x - Math.cos(shoot.angle) * 10 + (Math.random() - 0.5) * 2,
          y: shoot.y - Math.sin(shoot.angle) * 10 + (Math.random() - 0.5) * 2,
          radius: 0.6 + Math.random() * 0.3,
          opacity: shoot.opacity,
          vx: (Math.random() - 0.5) * 0.1,
          vy: (Math.random() - 0.5) * 0.1,
        });
        shoot.trail.push({
          x: shoot.x - Math.cos(shoot.angle) * 22 + (Math.random() - 0.5) * 2,
          y: shoot.y - Math.sin(shoot.angle) * 22 + (Math.random() - 0.5) * 2,
          radius: 0.5 + Math.random() * 0.3,
          opacity: shoot.opacity * 0.85,
          vx: (Math.random() - 0.5) * 0.1,
          vy: (Math.random() - 0.5) * 0.1,
        });

        shoot.x += Math.cos(shoot.angle) * shoot.speed;
        shoot.y += Math.sin(shoot.angle) * shoot.speed;

        const fadeInDuration = 30;
        const fadeOutDuration = 10;
        if (shoot.life < fadeInDuration) {
          const t = shoot.life / fadeInDuration;
          shoot.opacity = t * t;
        } else if (shoot.life > shoot.maxLife - fadeOutDuration) {
          shoot.opacity = (shoot.maxLife - shoot.life) / fadeOutDuration;
        } else {
          shoot.opacity = 1;
        }

        if (shoot.x < 0 || shoot.x > canvas.width || shoot.y < 0 || shoot.y > canvas.height) {
          shoot.opacity = Math.max(0, shoot.opacity - 0.02);
        }

        for (let j = shoot.trail.length - 1; j >= 0; j -= 1) {
          const p = shoot.trail[j];
          p.x += p.vx;
          p.y += p.vy;
          p.opacity -= 0.02;
          p.radius *= 0.95;
          if (p.opacity <= 0 || p.radius <= 0.1) {
            shoot.trail.splice(j, 1);
          }
        }

        drawShootingStar(shoot);

        if (shoot.opacity <= 0 || shoot.life > shoot.maxLife) {
          shootingStars.splice(i, 1);
        }
      }

      rafId = window.requestAnimationFrame(animate);
    };

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(container);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    resizeCanvas();
    mouseX = 0;
    mouseY = 0;
    animate();

    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("touchmove", onTouch);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("pointer-events-none", className)}
      style={{
        backgroundColor: "#0D0D0D",
        backgroundImage:
          "radial-gradient(ellipse 58% 24% at 50% 40%, rgba(186, 198, 212, 0.012), transparent 82%)",
      }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
