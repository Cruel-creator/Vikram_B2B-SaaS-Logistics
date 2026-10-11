import Link from "next/link";
import { NavLinks } from "./NavLinks";

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-[1240px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-2.5">
          <Logo />
          <span className="hidden text-[15px] font-medium tracking-tight sm:inline">
            Pipeline <span className="font-display text-[19px] italic text-reach">Intel</span>
          </span>
        </Link>
        <NavLinks />
      </div>
    </header>
  );
}

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden className="transition-transform duration-500 group-hover:rotate-90">
      <circle cx="12" cy="12" r="10.5" fill="none" stroke="rgb(255 255 255 / 0.25)" />
      <path d="M12 1.5 A10.5 10.5 0 0 1 22.5 12 L12 12 Z" fill="var(--color-reach)" />
      <circle cx="12" cy="12" r="2.2" fill="var(--color-ink)" stroke="var(--color-reach)" strokeWidth="1.2" />
    </svg>
  );
}
