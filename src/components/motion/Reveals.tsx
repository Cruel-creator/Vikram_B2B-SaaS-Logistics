"use client";

import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Scroll reveals for every `[data-reveal]` element on the current page:
 * opacity + 16px rise, staggered in batches. Reduced motion → shown immediately.
 */
export function Reveals() {
  const path = usePathname();

  useGSAP(
    () => {
      document.documentElement.classList.add("js");
      const mm = gsap.matchMedia();
      mm.add(
        { reduce: "(prefers-reduced-motion: reduce)", ok: "(prefers-reduced-motion: no-preference)" },
        (ctx) => {
          const els = gsap.utils.toArray<HTMLElement>("[data-reveal]");
          if (ctx.conditions?.reduce) {
            gsap.set(els, { autoAlpha: 1 });
            return;
          }
          gsap.set(els, { autoAlpha: 0, y: 16 });
          ScrollTrigger.batch(els, {
            start: "top 94%",
            once: true,
            onEnter: (batch) =>
              gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.06, overwrite: true }),
          });
          ScrollTrigger.refresh();
        },
      );
      return () => mm.revert();
    },
    { dependencies: [path], revertOnUpdate: true },
  );

  return null;
}
