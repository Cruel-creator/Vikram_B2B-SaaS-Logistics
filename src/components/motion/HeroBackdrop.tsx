"use client";

import { useEffect, useRef } from "react";

type VantaEffect = { destroy(): void };

/**
 * The page's only WebGL layer: Vanta NET in warm taupe on lifted cream — a quiet
 * "network of investors". Loaded lazily, created only while on screen, skipped for
 * reduced motion (the stadium's static cream shows instead).
 */
export function HeroBackdrop() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let effect: VantaEffect | null = null;
    let alive = true;

    const start = async () => {
      if (effect) return;
      const [THREE, { default: NET }] = await Promise.all([import("three"), import("vanta/dist/vanta.net.min")]);
      if (!alive || effect || !ref.current) return;
      effect = NET({
        el: ref.current,
        THREE,
        mouseControls: true,
        touchControls: false,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,
        scale: 1,
        scaleMobile: 2,
        color: 0xc9bfb2,
        backgroundColor: 0xfcfbfa,
        points: 9,
        maxDistance: 21,
        spacing: 17,
        showDots: true,
      });
    };
    const stop = () => {
      effect?.destroy();
      effect = null;
    };

    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()), { threshold: 0.05 });
    io.observe(el);
    return () => {
      alive = false;
      io.disconnect();
      stop();
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-auto absolute inset-0 overflow-hidden rounded-[inherit] [mask-image:linear-gradient(to_left,black_25%,transparent_78%)]"
    />
  );
}
