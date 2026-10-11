import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pipeline Intel — who to pitch this week",
  description:
    "Twice-weekly VC outreach intelligence for a Seed-stage B2B logistics SaaS founder: live signals from the last 30 days, deterministic scoring, Gemini Flash summaries.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${instrument.variable}`}>
      <body className="min-h-dvh font-sans">
        <div className="backdrop" aria-hidden />
        <div className="grain" aria-hidden />
        <Nav />
        <main className="mx-auto w-full max-w-[1240px] px-4 pb-24 sm:px-6 lg:px-8">{children}</main>
        <footer className="mx-auto w-full max-w-[1240px] px-4 pb-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 border-t border-line pt-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
            <span className="font-mono">
              Live sources: Google News · GDELT · blog RSS · Firecrawl — AI: Gemini Flash only — Data: Supabase
            </span>
            <span className="font-mono">MESA C4 · PS10 · built for Vikram</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
