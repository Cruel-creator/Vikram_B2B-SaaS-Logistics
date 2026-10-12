"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLenis } from "lenis/react";
import { useAdminToken } from "@/lib/adminToken";
import { ArrowUpRight, Monogram } from "@/components/ui";
import { CoverPreview } from "./CoverPreview";

type Payload = {
  vc: { id: string; name: string; firm: string; role: string | null; location: string | null; linkedinUrl: string | null };
  contact: {
    name: string;
    title: string | null;
    email: string | null;
    emailKind: string | null;
    sourceUrl: string | null;
    linkedinUrl: string | null;
    city: string | null;
  } | null;
  brand: { accent: string | null; logo: string | null; logoBg: "light" | "dark" | null; domain: string | null };
  founder: { company: string; oneLiner: string; firstName: string };
  deck: { url: string; fileName: string };
  draft: { subject: string; body: string; linkedin: string; model: string; generatedAt: string };
  gmail: boolean;
};

const KIND_LABEL: Record<string, string> = {
  person: "their own address",
  pitch: "the firm's pitch inbox",
  general: "the firm's general inbox",
};

export function OutreachPanel({ vcId, onClose }: { vcId: string | null; onClose: () => void }) {
  const lenis = useLenis();
  useEffect(() => {
    if (!vcId) return;
    lenis?.stop();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      lenis?.start();
      window.removeEventListener("keydown", onKey);
    };
  }, [vcId, lenis, onClose]);

  return (
    <AnimatePresence>
      {vcId && (
        <motion.div className="fixed inset-0 z-[60]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <button type="button" aria-label="Close outreach" onClick={onClose} className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]" />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Outreach"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 24, opacity: 0, transition: { duration: 0.15 } }}
            transition={{ type: "spring", bounce: 0, duration: 0.45 }}
            className="absolute inset-y-0 right-0 flex w-full max-w-[760px] flex-col bg-canvas shadow-[0_0_80px_rgb(0_0_0/0.18)] sm:inset-y-3 sm:right-3 sm:rounded-[32px]"
          >
            <PanelBody key={vcId} vcId={vcId} onClose={onClose} />
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PanelBody({ vcId, onClose }: { vcId: string; onClose: () => void }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [token, setToken] = useAdminToken();

  const apply = (p: Payload) => {
    setData(p);
    setTo(p.contact?.email ?? "");
    setSubject(p.draft.subject);
    setBody(p.draft.body);
    setNote(p.draft.linkedin);
  };

  useEffect(() => {
    fetch(`/api/outreach/${vcId}`)
      .then(async (r) => (r.ok ? apply(await r.json()) : setError("Couldn't load this investor.")))
      .catch(() => setError("Couldn't load this investor."));
  }, [vcId]);

  const placeholders = useMemo(() => [...new Set(`${subject}\n${body}`.match(/\[[^\]]+\]/g) ?? [])], [subject, body]);
  const validTo = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(to);
  const say = (m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(null), 3500);
  };

  async function regenerate() {
    setBusy("regen");
    const r = await fetch(`/api/outreach/${vcId}`, { method: "POST" });
    setBusy(null);
    if (r.status === 429) return say("Regenerated recently. Try again in a few minutes.");
    if (r.ok) apply(await r.json());
  }

  async function send(mode: "eml" | "gmail_draft" | "gmail_send") {
    if (mode === "gmail_send" && !confirm(`Send this email to ${to} now, from Vikram's Gmail?`)) return;
    setBusy(mode);
    const r = await fetch(`/api/outreach/${vcId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(mode !== "eml" ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ to, subject, body, mode }),
    });
    setBusy(null);
    if (mode === "eml" && r.ok) {
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${data?.vc.name.replace(/[^A-Za-z0-9]+/g, "-")}-outreach.eml`;
      a.click();
      URL.revokeObjectURL(a.href);
      return say("Downloaded. Open it in Outlook or Apple Mail; the deck is attached.");
    }
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) return say("Wrong or missing admin token.");
    if (!r.ok) return say(j.error ?? "Something went wrong.");
    if (mode === "gmail_draft") {
      say("Draft created in Gmail with the deck attached.");
      if (j.url) window.open(j.url, "_blank", "noopener");
    } else say("Sent.");
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      say(`${what} copied.`);
    } catch {
      say("Couldn't access the clipboard.");
    }
  }

  const person = data?.contact?.name ?? data?.vc.name ?? "";
  const linkedin = data?.contact?.linkedinUrl ?? data?.vc.linkedinUrl ?? null;
  const linkedinSearch = data
    ? `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${data.vc.name} ${data.vc.firm.replace(/\([^)]*\)/g, "")}`)}`
    : "#";

  return (
    <>
      <header className="flex items-center gap-4 border-b border-line px-6 py-5 sm:px-8">
        {data ? <Monogram name={person} size={44} /> : <div className="h-11 w-11 rounded-full bg-ghost" />}
        <div className="min-w-0 flex-1">
          <div className="micro">Outreach</div>
          <h2 className="truncate text-[22px] leading-tight">{data ? person : "Loading…"}</h2>
          {data && <p className="truncate text-[13px] text-slate">{[data.contact?.title ?? data.vc.role, data.vc.firm].filter(Boolean).join(" · ")}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full text-slate transition-colors duration-150 hover:bg-ghost hover:text-ink">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8" data-lenis-prevent>
        {error && <p className="text-[14px] text-bad">{error}</p>}
        {!data && !error && <Skeleton />}
        {data && (
          <div className="space-y-6">
            {/* ── Email ── */}
            <section className="rounded-[28px] border border-line bg-surface p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="eyebrow" style={{ ["--dot" as string]: "var(--color-go)" }}>
                  Email
                </div>
                <button type="button" onClick={regenerate} disabled={busy === "regen"} className="rounded-full px-3 py-2 text-[12.5px] font-medium text-slate transition-colors duration-150 hover:bg-canvas hover:text-ink disabled:opacity-50">
                  {busy === "regen" ? "Rewriting…" : "Rewrite"}
                </button>
              </div>

              <Field label="To">
                <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@firm.com" className="h-10 w-full rounded-full border border-line bg-canvas px-4 text-[14px] outline-none transition-[border-color] duration-150 focus:border-ink/40" />
              </Field>
              <p className="mt-1.5 px-1 text-[12px] leading-[1.45] text-slate">
                {data.contact?.email ? (
                  <>
                    Published on{" "}
                    <a href={data.contact.sourceUrl ?? "#"} target="_blank" rel="noreferrer" className="underline decoration-taupe underline-offset-2 hover:text-ink">
                      {data.brand.domain ?? "the firm's site"}
                    </a>{" "}
                    · {KIND_LABEL[data.contact.emailKind ?? ""] ?? "published address"}
                    {data.contact.emailKind !== "person" ? `, addressed to ${person.split(" ")[0]}` : ""}
                  </>
                ) : (
                  <>No address is published on the firm&apos;s site. Add one, or use LinkedIn below.</>
                )}
              </p>

              <Field label="Subject" className="mt-4">
                <input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-10 w-full rounded-full border border-line bg-canvas px-4 text-[14px] outline-none transition-[border-color] duration-150 focus:border-ink/40" />
              </Field>
              <Field label="Message" className="mt-4">
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14} className="w-full resize-y rounded-[20px] border border-line bg-canvas px-4 py-3 text-[14.5px] leading-[1.55] outline-none transition-[border-color] duration-150 focus:border-ink/40" />
              </Field>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 px-1 text-[12px] text-slate">
                <span className="tnum">{body.trim().split(/\s+/).length} words</span>
                {placeholders.length > 0 && (
                  <span className="text-watch">
                    Fill before sending: {placeholders.join(" ")}
                  </span>
                )}
              </div>

              {/* attachment */}
              <a href={data.deck.url} target="_blank" rel="noreferrer" className="mt-5 flex items-center gap-4 rounded-[20px] border border-line bg-canvas p-3 transition-colors duration-150 hover:border-line-strong">
                <div className="w-36 shrink-0">
                  <CoverPreview name={person} title={data.contact?.title ?? data.vc.role} firm={data.vc.firm} logo={data.brand.logo} accent={data.brand.accent} logoBg={data.brand.logoBg} company={data.founder.company} oneLiner={data.founder.oneLiner} />
                </div>
                <div className="min-w-0">
                  <div className="micro">Attached</div>
                  <div className="truncate text-[14px] font-medium">{data.deck.fileName}</div>
                  <div className="text-[12.5px] text-slate">8 slides · cover prepared for {person.split(" ")[0]} · open</div>
                </div>
                <ArrowUpRight className="ml-auto mr-2 shrink-0 text-slate" />
              </a>

              {(!token && data.gmail) && (
                <Field label="Admin token (asked once)" className="mt-4">
                  <input type="password" onChange={(e) => setToken(e.target.value)} placeholder="ADMIN_TOKEN" className="h-10 w-full rounded-full border border-line bg-canvas px-4 text-[14px] outline-none focus:border-ink/40" />
                </Field>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={() => send("gmail_draft")} disabled={!data.gmail || !validTo || !token || busy !== null} className="btn btn-ink disabled:opacity-40" title={data.gmail ? "" : "Connect Gmail to enable"}>
                  {busy === "gmail_draft" ? "Creating…" : "Create Gmail draft"}
                </button>
                <button type="button" onClick={() => send("gmail_send")} disabled={!data.gmail || !validTo || !token || placeholders.length > 0 || busy !== null} className="btn btn-ghost disabled:opacity-40">
                  {busy === "gmail_send" ? "Sending…" : "Send now"}
                </button>
                <button type="button" onClick={() => send("eml")} disabled={!validTo || busy !== null} className="btn px-4 text-charcoal hover:bg-ghost disabled:opacity-40">
                  Download .eml
                </button>
                <button type="button" onClick={() => copy(`Subject: ${subject}\n\n${body}`, "Email")} className="btn px-4 text-charcoal hover:bg-ghost">
                  Copy
                </button>
              </div>
              {!data.gmail && <p className="mt-3 text-[12px] text-slate">Gmail isn&apos;t connected yet, so drafts download as .eml with the deck attached.</p>}
            </section>

            {/* ── LinkedIn ── */}
            <section className="rounded-[28px] border border-line bg-surface p-5 sm:p-6">
              <div className="eyebrow mb-4" style={{ ["--dot" as string]: "var(--color-link)" }}>
                LinkedIn
              </div>
              <div className="flex items-center gap-4 rounded-[20px] bg-canvas p-4">
                <Monogram name={person} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[16px] font-medium">{person}</div>
                  <div className="truncate text-[13px] text-charcoal">{[data.contact?.title ?? data.vc.role, data.vc.firm].filter(Boolean).join(" · ")}</div>
                  {(data.contact?.city ?? data.vc.location) && <div className="truncate text-[12.5px] text-slate">{data.contact?.city ?? data.vc.location}</div>}
                </div>
                <a href={linkedin ?? linkedinSearch} target="_blank" rel="noreferrer" className="btn btn-ghost shrink-0 px-4">
                  {linkedin ? "Open profile" : "Find on LinkedIn"}
                </a>
              </div>
              <Field label="Connection note" className="mt-4">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} className="w-full resize-y rounded-[20px] border border-line bg-canvas px-4 py-3 text-[14.5px] leading-[1.55] outline-none transition-[border-color] duration-150 focus:border-ink/40" />
              </Field>
              <div className="mt-1.5 flex items-center justify-between px-1">
                <span className={`tnum text-[12px] ${note.length > 300 ? "text-bad" : "text-slate"}`}>{note.length}/300</span>
                <button type="button" onClick={() => copy(note, "Note")} className="btn btn-ink">
                  Copy note
                </button>
              </div>
              <p className="mt-3 text-[12px] leading-[1.45] text-slate">
                LinkedIn doesn&apos;t allow apps to send messages, so paste this in yourself. Connection notes can&apos;t carry files; send the deck after they accept.
              </p>
            </section>

            {/* ── Deck ── */}
            <section className="rounded-[28px] border border-line bg-surface p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="eyebrow">Deck · first slide</div>
                <a href={data.deck.url} target="_blank" rel="noreferrer" className="btn btn-ghost px-4">
                  Open PDF
                </a>
              </div>
              <CoverPreview name={person} title={data.contact?.title ?? data.vc.role} firm={data.vc.firm} logo={data.brand.logo} accent={data.brand.accent} logoBg={data.brand.logoBg} company={data.founder.company} oneLiner={data.founder.oneLiner} />
              <p className="mt-3 text-[12px] text-slate">Illustrative dummy deck. The cover is in {data.founder.company}&apos;s style with {data.vc.firm}&apos;s logo and colour.</p>
            </section>
          </div>
        )}
      </div>

      <AnimatePresence>
        {flash && (
          <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }} className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-[13.5px] text-canvas shadow-lift" role="status">
            {flash}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="micro mb-1.5 block px-1">{label}</span>
      {children}
    </label>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      {[180, 320, 140].map((h, i) => (
        <div key={i} className="animate-pulse rounded-[28px] bg-ghost/60" style={{ height: h }} />
      ))}
      <p className="text-center text-[13px] text-slate">Writing the draft…</p>
    </div>
  );
}
