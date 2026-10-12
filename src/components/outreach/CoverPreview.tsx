/* eslint-disable @next/next/no-img-element */
/**
 * HTML replica of the deck's first slide (src/lib/outreach/deck.ts) — same layout and
 * proportions (960×540), scaled with container-query units so it fits any width.
 */
export function CoverPreview({
  name,
  title,
  firm,
  logo,
  accent,
  company,
  oneLiner,
  logoBg,
}: {
  name: string;
  title: string | null;
  firm: string;
  logo: string | null;
  accent: string | null;
  company: string;
  oneLiner: string;
  logoBg?: "light" | "dark" | null;
}) {
  const date = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const band = accent ?? "var(--color-ink)";
  return (
    <div className="@container w-full">
      <div
        className="relative aspect-[16/9] w-full overflow-hidden rounded-[14px] bg-canvas shadow-[0_1px_2px_rgb(0_0_0/0.06),0_12px_32px_-12px_rgb(0_0_0/0.18)] outline outline-1 -outline-offset-1 outline-black/10"
        aria-label={`Deck cover prepared for ${name}, ${firm}`}
      >
        <div className="absolute inset-y-0 left-0 w-[1.46cqw]" style={{ background: band }} />
        <div
          className={`absolute left-[6.67cqw] top-[6.3cqw] flex h-[7.5cqw] items-center px-[2.1cqw] outline outline-1 ${
            logoBg === "dark" ? "bg-ink outline-ink" : "bg-white outline-black/10"
          }`}
        >
          {logo ? (
            <img src={logo} alt={`${firm} logo`} className="max-h-[4.6cqw] max-w-[18.75cqw] object-contain" />
          ) : (
            <span className="text-[1.9cqw] font-bold text-ink">{firm}</span>
          )}
        </div>
        <div className="absolute left-[6.67cqw] top-[20.6cqw]">
          <div className="flex items-center gap-[0.6cqw] text-[1.05cqw] font-bold tracking-[0.04em] text-slate">
            <span className="inline-block h-[0.55cqw] w-[0.55cqw] rounded-full" style={{ background: band }} />
            PREPARED FOR
          </div>
          <div className="mt-[1.2cqw] text-[3.35cqw] font-bold leading-none tracking-[-0.01em] text-ink">{name}</div>
          <div className="mt-[1.1cqw] text-[1.36cqw] text-slate">{[title, firm].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="absolute bottom-[8.5cqw] left-[6.67cqw] right-[28cqw]">
          <div className="text-[6.04cqw] font-bold leading-none tracking-[-0.02em] text-ink">{company}</div>
          <div className="mt-[1.6cqw] text-[1.77cqw] leading-[1.3] text-ink">{oneLiner[0].toUpperCase() + oneLiner.slice(1)}.</div>
        </div>
        <div className="absolute bottom-[5.2cqw] left-[6.67cqw] text-[1.25cqw] font-bold text-slate">Seed round · {date}</div>
        <div className="absolute bottom-[2.1cqw] right-[6.67cqw] text-[0.94cqw] text-slate">Confidential · Illustrative draft deck</div>
      </div>
    </div>
  );
}
