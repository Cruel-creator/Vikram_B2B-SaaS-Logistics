import Link from "next/link";
import { NavLinks } from "./NavLinks";

/** Floating pill nav: white, 999px radius, level-1 shadow, docked 16px below the viewport top. */
export function Nav() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-4 z-50 px-4 sm:px-8">
      <div className="pointer-events-auto mx-auto flex h-14 w-full max-w-[1180px] items-center justify-between gap-3 rounded-full border border-line bg-surface/90 pl-5 pr-2 shadow-float backdrop-blur-md">
        <Link href="/" className="group flex min-h-10 items-center gap-2.5" aria-label="Pipeline Intel home">
          <Mark />
          <span className="hidden text-[16px] font-medium tracking-[-0.02em] sm:inline">Pipeline Intel</span>
        </Link>
        <NavLinks />
      </div>
    </header>
  );
}

/** Our mark: an ink ring with an orbiting signal dot. */
function Mark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden className="shrink-0">
      <circle cx="13" cy="13" r="9" fill="none" stroke="var(--color-ink)" strokeWidth="1.6" />
      <circle cx="13" cy="13" r="3.2" fill="var(--color-ink)" />
      <g className="origin-center transition-transform duration-700 ease-out group-hover:rotate-[160deg]">
        <circle cx="21.5" cy="6.5" r="2.6" fill="var(--color-signal)" />
      </g>
    </svg>
  );
}
