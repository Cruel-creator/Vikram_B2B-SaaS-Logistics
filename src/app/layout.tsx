import type { Metadata } from "next";
import { Sofia_Sans } from "next/font/google";
import { Nav } from "@/components/Nav";
import { Reveals } from "@/components/motion/Reveals";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import "./globals.css";

const sofia = Sofia_Sans({ subsets: ["latin"], variable: "--font-sofia", display: "swap" });

export const metadata: Metadata = {
  title: "Pipeline Intel — who to pitch this week",
  description:
    "Twice-weekly VC outreach intelligence for a Seed-stage B2B logistics SaaS founder: live signals from the last 30 days, deterministic scoring, Gemini Flash summaries.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sofia.variable} suppressHydrationWarning>
      <head>
        {/* Marks JS as available before first paint so GSAP-revealed blocks don't flash. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="min-h-dvh font-sans">
        <SmoothScroll />
        <Reveals />
        <Nav />
        <main className="mx-auto w-full max-w-[1280px] px-4 pb-28 pt-28 sm:px-8 lg:px-12">{children}</main>
        <footer className="border-t border-line bg-lifted">
          <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-12 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:px-12">
            <div>
              <p className="text-[28px] font-medium leading-tight tracking-[-0.02em]">Signals in. A short list out.</p>
              <p className="mt-2 max-w-md text-[14px] text-slate">
                Live sources: Google News, GDELT, blog RSS, Firecrawl. AI: Gemini Flash only. Data: Vikram&apos;s Supabase
                table.
              </p>
            </div>
            <p className="text-[13px] text-slate">MESA C4 · Problem Statement 10</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
