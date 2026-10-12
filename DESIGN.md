# DESIGN.md — Pipeline Intel

Design language adapted from the **Mastercard-inspired DESIGN.md** in
[VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) (MIT). We use the *system*
(warm cream canvas, ink pills, oversized radii, eyebrow dots, atmospheric shadows, one-font typography),
not the brand: no Mastercard marks, names or colours are used. Accent colours below are our own.

## Mood
A warm, editorial "annual report" for one founder: calm, light, precise. Whitespace is structure.
Data reads first; decoration is limited to one ambient hero backdrop and one orbital arc.

## Colour tokens (`src/app/globals.css`)
| Token | Hex | Role |
|---|---|---|
| canvas | `#F3F0EE` | Page background (never pure white) |
| lifted | `#FCFBFA` | Raised sections, hero stadium |
| surface | `#FFFFFF` | Cards, floating nav pill, inputs |
| ink | `#141413` | Headlines, body, primary CTA |
| charcoal | `#262627` | Secondary text on light |
| slate | `#696969` | Muted text |
| taupe / ghost | `#D1CDC7` / `#E8E2DA` | Whisper text, monogram fills |
| signal | `#F37338` | Decorative orbit arc + eyebrow dots only |
| go | `#1F7A52` | "Reach out this week" |
| watch | `#9A5B00` (text) / `#D9930D` (ring) | "Warm — watch" |
| rest | `#8E8880` | "Quiet — deprioritize" |
| link | `#3860BE` | Inline links / blog badge |

## Typography
One family: **Sofia Sans** (variable; open substitute for the reference's geometric sans).
| Role | Size / weight / line-height / tracking |
|---|---|
| H1 | 64 / 500 / 1.0 / -2% (40px mobile) |
| H2 | 36 / 500 / 1.2 / -2% |
| H3 | 24 / 500 / 1.2 / -2% |
| Eyebrow | 13 / 700 / 1 / +4% uppercase, preceded by a 6px dot |
| Body | 16 / 450 / 1.4 |
| Data | `tabular-nums` everywhere numbers update |

No uppercase above eyebrow size. Headings `text-wrap: balance`, short copy `text-wrap: pretty`.

## Shape
Radius scale: **6** (micro chips) · **20** (buttons, inner blocks) · **24** (inputs, popovers) · **40** (cards, hero stadium) · **999** (pills, nav, tabs). No 8–16px radii.

## Elevation
0 = flat on canvas with 1px `ink/8%` border (default) · 1 = `0 4px 24px rgba(0,0,0,.04)` (floating nav) ·
2 = `0 24px 48px rgba(0,0,0,.08)` (card hover, popovers). No hard shadows.

## Components
- **Floating nav pill** — white, 999px, level 1, 16px from top; sliding active highlight (motion-primitives `AnimatedBackground`).
- **Primary button** — ink pill, cream text, 20px radius, ≥40px tall, `scale(.96)` on press.
- **Secondary button** — white, 1.5px ink border.
- **VC card** — white, 40px radius, monogram portrait (circle) with a white "satellite" arrow to LinkedIn/firm site, score ring, next-move block (20px radius), evidence timeline, read-only notes. Reach-out cards add a soft cursor spotlight (React Bits `SpotlightCard`, light theme).
- **Eyebrow** — dot + uppercase label; section dots use the bucket colour.

## Motion
- **Lenis** smooth scroll driven by the GSAP ticker (one loop); `respectReducedMotion`.
- **GSAP**: hero timeline (orbit arc draw, card rise) and `ScrollTrigger.batch` reveals (opacity + 16px rise, 0.6s, stagger 0.06).
- **React Bits `BlurText`** for the H1; **motion-primitives `AnimatedNumber`** for KPIs.
- **Vanta NET** (three r134) as the only WebGL layer, in the hero stadium, warm taupe on lifted cream, masked behind text; skipped for reduced motion and paused off-screen.
- Transitions name explicit properties (never `all`); exits quieter than enters.

## Don'ts
No black surfaces, no neon, no second typeface, no gradients on UI chrome, no more than one WebGL effect per page.
