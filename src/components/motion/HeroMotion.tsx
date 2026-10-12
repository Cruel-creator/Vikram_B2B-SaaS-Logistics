"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/**
 * Hero entrance: `[data-hero]` blocks rise in sequence while the `[data-orbit]` arc draws itself.
 * Reduced motion → everything is shown as-is (CSS makes [data-hero] visible).
 */
export function HeroMotion({ children, className }: { children: React.ReactNode; className?: string }) {
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.fromTo("[data-hero]", { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.09 }, 0.05);
        const path = scope.current?.querySelector<SVGPathElement>("[data-orbit]");
        if (path) {
          const len = path.getTotalLength();
          tl.fromTo(
            path,
            { strokeDasharray: len, strokeDashoffset: len },
            { strokeDashoffset: 0, duration: 1.8, ease: "power2.inOut" },
            0.25,
          );
          tl.fromTo("[data-orbit-dot]", { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 1, scale: 1, duration: 0.4 }, "-=0.2");
        }
      });
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set("[data-hero]", { autoAlpha: 1 });
      });
      return () => mm.revert();
    },
    { scope },
  );

  return (
    <section ref={scope} className={className}>
      {children}
    </section>
  );
}
