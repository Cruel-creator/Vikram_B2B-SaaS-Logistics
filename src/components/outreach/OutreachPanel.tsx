"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLenis } from "lenis/react";
import { AnimatedBackground } from "@/components/motion-primitives/animated-background";
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
};

type DeckMode = "link" | "attach";

const KIND_LABEL: Record<string, string> = {
  person: "their own address",
  pitch: "the firm's pitch inbox",
  general: "the firm's general inbox",
};

/** Swap "The deck is attached." for a link (or add one above the sign-off). */
function withDeckLink(body: string, url: string): string {
  if (/the deck is attached\.?/i.test(body)) return body.replace(/the deck is attached\.?/i, `Here is the deck: ${url}`);
  const i = body.lastIndexOf("\n\n");
  return i > 0 ? `${body.slice(0, i)}\n\nDeck: ${url}${body.slice(i)}` : `${body}\n\nDeck: ${url}`;
}

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
  const [view, setView] = useState<"preview" | "edit">("preview");
  const [deckMode, setDeckMode] = useState<DeckMode>("link");
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

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

  const deckUrl = data ? `${origin}${data.deck.url}` : "";
  const finalBody = deckMode === "link" && deckUrl ? withDeckLink(body, deckUrl) : body;
  const placeholders = useMemo(() => [...new Set(`${subject}\n${body}`.match(/\[[^\]]+\]/g) ?? [])], [subject, body]);
  const validTo = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(to);
  const say = (m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(null), 4000);
  };

  function downloadDeck() {
    if (!data) return;
    const a = document.createElement("a");
    a.href = data.deck.url;
    a.download = data.deck.fileName;
    a.click();
  }

  function openInGmail() {
    const url =
      "https://mail.google.com/mail/?" +
      new URLSearchParams({ view: "cm", fs: "1", to, su: subject, body: finalBody }).toString();
    window.open(url, "_blank", "noopener");
    if (deckMode === "attach") {
      downloadDeck();
      say("Gmail is open. The deck downloaded; drag it into the email, then send.");
    } else say("Gmail is open with the draft and the deck link. Review and send.");
  }

  async function regenerate() {
    setBusy("regen");
    const r = await fetch(`/api/outreach/${vcId}`, { method: "POST" });
    setBusy(null);
    if (r.status === 429) return say("Rewritten recently. Try again in a few minutes.");
    if (r.ok) apply(await r.json());
  }

  async function downloadEml() {
    setBusy("eml");
    const r = await fetch(`/api/outreach/${vcId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, body }),
    });
    setBusy(null);
    if (!r.ok) return say("Couldn't build the file. Check the To address.");
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${data?.vc.name.replace(/[^A-Za-z0-9]+/g, "-")}-outreach.eml`;
    a.click();
    URL.revokeObjectURL(a.href);
    say("Downloaded. Opens as a draft in Outlook or Apple Mail, deck attached.");
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
  const cover = data && (
    <CoverPreview
      name={person}
      title={data.contact?.title ?? data.vc.role}
      firm={data.vc.firm}
      logo={data.brand.logo}
      accent={data.brand.accent}
      logoBg={data.brand.logoBg}
      company={data.founder.company}
      oneLiner={data.founder.oneLiner}
    />
  );

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
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="eyebrow" style={{ ["--dot" as string]: "var(--color-go)" }}>
                  Email
                </div>
                <div className="flex items-center gap-1">
                  <div className="flex rounded-full bg-canvas p-1">
                    <AnimatedBackground
                      defaultValue="preview"
                      onValueChange={(id) => setView((id as "preview" | "edit") ?? "preview")}
                      className="rounded-full bg-surface shadow-[0_1px_3px_rgb(0_0_0/0.08)]"
                      transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                    >
                      {(["preview", "edit"] as const).map((v) => (
                        <button key={v} data-id={v} type="button" className="flex min-h-8 items-center rounded-full px-3.5 text-[13px] font-medium capitalize text-slate data-[checked=true]:text-ink">
                          {v}
                        </button>
                      ))}
                    </AnimatedBackground>
                  </div>
                  <button type="button" onClick={regenerate} disabled={busy === "regen"} className="rounded-full px-3 py-2 text-[12.5px] font-medium text-slate transition-colors duration-150 hover:bg-canvas hover:text-ink disabled:opacity-50">
                    {busy === "regen" ? "Rewriting…" : "Rewrite"}
                  </button>
                </div>
              </div>

              {view === "preview" ? (
                <EmailMockup
                  from={`${data.founder.firstName} (${data.founder.company})`}
                  to={to}
                  subject={subject}
                  body={finalBody}
                  deckMode={deckMode}
                  deckName={data.deck.fileName}
                  cover={cover}
                />
              ) : (
                <div>
                  <Field label="To">
                    <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@firm.com" className="h-10 w-full rounded-full border border-line bg-canvas px-4 text-[14px] outline-none transition-[border-color] duration-150 focus:border-ink/40" />
                  </Field>
                  <Field label="Subject" className="mt-4">
                    <input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-10 w-full rounded-full border border-line bg-canvas px-4 text-[14px] outline-none transition-[border-color] duration-150 focus:border-ink/40" />
                  </Field>
                  <Field label="Message" className="mt-4">
                    <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14} className="w-full resize-y rounded-[20px] border border-line bg-canvas px-4 py-3 text-[14.5px] leading-[1.55] outline-none transition-[border-color] duration-150 focus:border-ink/40" />
                  </Field>
                  <div className="mt-1.5 px-1 text-[12px] text-slate tnum">{body.trim().split(/\s+/).length} words</div>
                </div>
              )}

              <p className="mt-3 px-1 text-[12px] leading-[1.45] text-slate">
                {data.contact?.email ? (
                  <>
                    To address published on{" "}
                    <a href={data.contact.sourceUrl ?? "#"} target="_blank" rel="noreferrer" className="underline decoration-taupe underline-offset-2 hover:text-ink">
                      {data.brand.domain ?? "the firm's site"}
                    </a>{" "}
                    · {KIND_LABEL[data.contact.emailKind ?? ""] ?? "published address"}
                    {data.contact.emailKind !== "person" ? `, addressed to ${person.split(" ")[0]}` : ""}
                  </>
                ) : (
                  <>No address is published on the firm&apos;s site. Add one under Edit, or use LinkedIn below.</>
                )}
              </p>
              {placeholders.length > 0 && (
                <p className="mt-1 px-1 text-[12px] text-watch">Fill before sending: {placeholders.join(" ")}</p>
              )}

              {/* Deck delivery */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-canvas p-3 pl-4">
                <span className="text-[13px] text-charcoal">Send the deck as</span>
                <div className="flex rounded-full bg-surface p-1">
                  <AnimatedBackground
                    defaultValue="link"
                    onValueChange={(id) => setDeckMode((id as DeckMode) ?? "link")}
                    className="rounded-full bg-ink"
                    transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                  >
                    {([
                      ["link", "Link in email"],
                      ["attach", "PDF attachment"],
                    ] as const).map(([k, label]) => (
                      <button key={k} data-id={k} type="button" className="flex min-h-8 items-center rounded-full px-3.5 text-[13px] font-medium text-charcoal data-[checked=true]:text-canvas">
                        {label}
                      </button>
                    ))}
                  </AnimatedBackground>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={openInGmail} disabled={!validTo} className="btn btn-ink disabled:opacity-40">
                  <GmailGlyph /> Open in Gmail
                </button>
                <button type="button" onClick={downloadDeck} className="btn btn-ghost">
                  Download deck
                </button>
                <button type="button" onClick={downloadEml} disabled={!validTo || busy !== null} className="btn px-4 text-charcoal hover:bg-ghost disabled:opacity-40">
                  {busy === "eml" ? "Building…" : ".eml for Outlook"}
                </button>
                <button type="button" onClick={() => copy(`Subject: ${subject}\n\n${finalBody}`, "Email")} className="btn px-4 text-charcoal hover:bg-ghost">
                  Copy
                </button>
              </div>
              <p className="mt-3 text-[12px] leading-[1.45] text-slate">
                {deckMode === "link"
                  ? "Opens Gmail's compose window with To, Subject and the message filled in, including a link to the personalised deck. Review and press Send in Gmail."
                  : "Opens Gmail's compose window and downloads the personalised deck. Gmail doesn't accept attachments through links, so drag the PDF into the email before sending."}
              </p>
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
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={6} className="w-full resize-y rounded-[20px] border border-line bg-canvas px-4 py-3 text-[14.5px] leading-[1.55] outline-none transition-[border-color] duration-150 [field-sizing:content] focus:border-ink/40" />
              </Field>
              <div className="mt-1.5 flex items-center justify-between px-1">
                <span className={`tnum text-[12px] ${note.length > 300 ? "text-bad" : "text-slate"}`}>{note.length}/300</span>
                <button type="button" onClick={() => copy(note, "Note")} className="btn btn-ink">
                  Copy note
                </button>
              </div>
              <p className="mt-3 text-[12px] leading-[1.45] text-slate">
                LinkedIn doesn&apos;t allow apps to send messages, so paste this in yourself. Connection notes can&apos;t carry files; share the deck link after they accept.
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
              {cover}
              <p className="mt-3 text-[12px] text-slate">
                Illustrative dummy deck. The cover is in {data.founder.company}&apos;s style with {data.vc.firm}&apos;s logo and colour.
              </p>
            </section>
          </div>
        )}
      </div>

      <AnimatePresence>
        {flash && (
          <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }} className="pointer-events-none absolute bottom-6 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-center text-[13.5px] text-canvas shadow-lift" role="status">
            {flash}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Mail-client style mockup of the outgoing email (what the investor will see). */
function EmailMockup({
  from,
  to,
  subject,
  body,
  deckMode,
  deckName,
  cover,
}: {
  from: string;
  to: string;
  subject: string;
  body: string;
  deckMode: DeckMode;
  deckName: string;
  cover: React.ReactNode;
}) {
  const parts = body.split(/(\[[^\]]+\]|https?:\/\/\S+)/g);
  return (
    <div className="overflow-hidden rounded-[20px] border border-line bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-16px_rgb(0_0_0/0.18)]">
      <div className="flex items-center justify-between bg-ink px-4 py-2.5 text-[13px] text-canvas">
        <span className="font-medium">New message</span>
        <span className="flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-full bg-white/25" />
          ))}
        </span>
      </div>
      <dl className="divide-y divide-line border-b border-line text-[13.5px]">
        <div className="flex gap-3 px-4 py-2.5">
          <dt className="w-14 shrink-0 text-slate">From</dt>
          <dd className="truncate">{from}</dd>
        </div>
        <div className="flex gap-3 px-4 py-2.5">
          <dt className="w-14 shrink-0 text-slate">To</dt>
          <dd className={`truncate ${to ? "" : "italic text-slate"}`}>{to || "add an address under Edit"}</dd>
        </div>
        <div className="flex gap-3 px-4 py-2.5">
          <dt className="w-14 shrink-0 text-slate">Subject</dt>
          <dd className="truncate font-medium">{subject}</dd>
        </div>
      </dl>
      <div className="whitespace-pre-line break-words px-4 py-4 text-[14px] leading-[1.6] text-ink">
        {parts.map((p, i) =>
          /^\[[^\]]+\]$/.test(p) ? (
            <mark key={i} className="rounded-[4px] bg-watch-tint px-1 text-watch">
              {p}
            </mark>
          ) : /^https?:\/\//.test(p) ? (
            <span key={i} className="break-all text-link underline underline-offset-2">
              {p}
            </span>
          ) : (
            <span key={i}>{p}</span>
          ),
        )}
      </div>
      {deckMode === "attach" && (
        <div className="px-4 pb-4">
          <div className="flex w-full max-w-[340px] items-center gap-3 rounded-[12px] border border-line p-2.5">
            <div className="w-24 shrink-0">{cover}</div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium">{deckName}</div>
              <div className="text-[12px] text-slate">PDF · 8 pages</div>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 border-t border-line px-4 py-2.5" aria-hidden>
        <span className="rounded-full bg-link px-4 py-1.5 text-[13px] font-medium text-white">Send</span>
        <span className="text-[12px] text-slate">Preview · you send it from Gmail</span>
      </div>
    </div>
  );
}

function GmailGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <rect x="1.5" y="3" width="13" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 4l6 4.5L14 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
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
