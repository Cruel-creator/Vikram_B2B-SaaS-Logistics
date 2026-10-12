"use client";

import { useEffect, useRef } from "react";
import { ReactLenis, useLenis, type LenisRef } from "lenis/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Lenis smooth scroll driven by GSAP's ticker so Lenis and ScrollTrigger share one loop.
 * Lenis honours prefers-reduced-motion by default (respectReducedMotion).
 */
export function SmoothScroll() {
  const lenisRef = useRef<LenisRef>(null);

  useLenis(ScrollTrigger.update);

  useEffect(() => {
    const update = (time: number) => lenisRef.current?.lenis?.raf(time * 1000);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);
    return () => gsap.ticker.remove(update);
  }, []);

  return <ReactLenis root ref={lenisRef} options={{ autoRaf: false, lerp: 0.12, anchors: { offset: -96 } }} />;
}
