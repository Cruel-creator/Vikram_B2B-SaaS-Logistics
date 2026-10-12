"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatedBackground } from "@/components/motion-primitives/animated-background";

const LINKS = [
  { href: "/", label: "This week" },
  { href: "/runs", label: "Runs" },
  { href: "/about", label: "How it works" },
];

export function NavLinks() {
  const path = usePathname();
  const active = LINKS.find((l) => (l.href === "/" ? path === "/" : path.startsWith(l.href)))?.href ?? "/";

  return (
    <nav className="flex items-center gap-0.5">
      <AnimatedBackground
        defaultValue={active}
        className="rounded-full bg-ink"
        transition={{ type: "spring", bounce: 0, duration: 0.35 }}
      >
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            data-id={l.href}
            aria-current={active === l.href ? "page" : undefined}
            className="flex min-h-10 items-center rounded-full px-3.5 text-[14px] font-medium tracking-[-0.01em] text-charcoal transition-colors duration-200 data-[checked=true]:text-canvas sm:px-4"
          >
            {l.label}
          </Link>
        ))}
      </AnimatedBackground>
    </nav>
  );
}
