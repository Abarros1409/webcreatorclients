# The website factory

One reusable system that turns a lead from our list into a private demo site and a pitch kit in about 90 minutes, and into a live client site within 5 working days of a "yes". It implements "The website factory" section of the strategy plan.

```
 lead list ──► 1 AUDIT ──► 2 PICK ──► 3 COLLECT ──► 4 STYLE ──► 5 GENERATE ──► 6 QA ──► 7 PUBLISH DEMO ──► 8 PITCH KIT ──► visit (Adam)
 (121 leads)   weakness    who gets    public info   1 of 4      Claude writes   checks   private URL       before/after,        │
               score +     a demo      → client      looks       NL + EN copy,   + eyes   noindex           A5 card + QR,        ▼
               3 points                folder                    menu as text                               video, sheet     9 LAUNCH ON YES ──► CARE (monthly)
```

Scripts do everything that can be measured or copied. Claude does the one creative step (Generate) and **looks at every screenshot** before anything moves on. Andrés and Adam decide who gets a demo and handle the owner.

## Quick start

```bash
cd factory
npm install
npm run audit -- kiem-foei-rotterdam          # 1
npm run pick -- --city Rotterdam              # 2
npm run collect -- kiem-foei-rotterdam        # 3  -> clients/kiem-foei/
# 4 + 5: in Claude Code, "/factory demo kiem-foei-rotterdam" does Generate and Style
npm run qa -- kiem-foei                       # 6
npm run publish                               # 7  (needs VERCEL_TOKEN; --dry to stage)
npm run pitch -- kiem-foei                    # 8
npm run status                                # pipeline board
```

Requirements: Node 20+, Chromium via Playwright, `pdftotext` (poppler), ImageMagick, `ffmpeg` (for the video). Optional env vars: `PAGESPEED_API_KEY` (Google PageSpeed for audits) and `VERCEL_TOKEN` (deploys).

## Where things live

```
factory/
  starter/            the restaurant starter kit (Astro): sections, 4 looks, NL/EN, schema.org, noindex for demos
    src/sections/     Hero, Story, Menu, Hours (+location), Booking, Gallery, Reviews, Events, Groups, Footer
    src/looks/        brown-cafe · coffee-brunch · dining · street-food (.css + looks.json defaults)
  schema/             content.schema.json: the contract for every client's content.json
  scripts/            one script per pipeline step (below)
  studio.config.json  studio name, demo domain, contacts, offer (placeholders until decided)
clients/              ignored by git (this repo is public); one folder per client:
  _audits/            audit JSON + mobile screenshot per lead, summary.md, picks.md
  <slug>/
    brief.md          the one-page brief: weakness, demo angle, look and why, questions for the owner
    content.json      everything the site shows (validated against the schema)
    photos/           photos used on the site; photos/source/ = everything collected, untouched
    theme.css         small per-client overrides (their brand colours)
    overrides/        optional per-client components (replace a starter section for this client only)
    collected/        page texts, PDF menus as text, facts.json (with sources), images.json
    talking-points.json  the 3 points for the pitch, curated in Generate
    qa/  pitch/  launch/  status.json  changes.md
```

## The steps

### 1. Audit — `npm run audit -- <lead-id…> | --city Rotterdam | --url …`

Opens the current site in a real mobile browser and scores **weakness 0–100** (higher = bigger opportunity). Each signal adds points; the three heaviest become the talking points (EN + NL) with what our demo fixes.

| Signal | Points | How it's detected |
|---|---:|---|
| No website | 100 | lead has no website |
| Site down | 60 | homepage fails to load |
| Certificate error / not HTTPS | 20 / 12 | TLS error, or only loads over http |
| No mobile viewport | 15 | no `<meta name="viewport">` |
| Slides sideways on a phone | 15 | page wider than 390 px |
| Slow on mobile | 15 (<50) / 7 (50–89) | Google PageSpeed mobile score (needs API key) |
| Heavy page | 8 | > 3 MB transferred (when PageSpeed is unavailable) |
| Menu is a PDF / a photo | 15 | menu links to .pdf/.jpg, or menu page has images but no prices |
| No menu | 12 | no menu link and no prices |
| No booking button | 10 (dining) / 4 (bars, cafés) | no Zenchef/Formitable/Resengo/OpenTable/TheFork/… and no reservation link |
| No English | 10 | no `hreflang="en"`, no EN link |
| Homepage says almost nothing | 10 | < 60 words of visible text |
| Dated | 10 | © ≤ 2020, jQuery 1.x, Flash, layout tables, old CMS version |
| No tap-to-call | 5 | no `tel:` link |
| Tiny text | 5 | > 30% of text under 12 px |
| No SEO basics | 4 | no business JSON-LD and no share image |
| JS errors | 3 | > 2 errors in the console |

Then **Claude looks at the mobile screenshot** and records what no script sees (dated look, logo-only homepage) as `review` in the audit file. The screenshot is reused as the "before" in the pitch kit.

### 2. Pick — `npm run pick -- --city Rotterdam`

Priority = **55% weakness + 45% fit**. Fit (0–100): independent 40, rating ≥ 4.4 → 20 (≥ 4.0 → 10), ≥ 200 reviews 15, Rotterdam 15, phone 10. Output `picks.md` for the Monday call. Humans choose; the plan's rule stands: independent, well reviewed, weakness obvious in 10 seconds.

### 3. Collect — `npm run collect -- <lead-id>`

Creates `clients/<slug>/` and gathers public information: rendered text of the homepage and the menu/about/contact/booking pages, PDF menus converted to text, photos (including full-size images behind thumbnails), logo candidates, brand colours actually used on their site, social links, booking/ordering provider, phone/email, schema.org data, **KvK number and legal form** (BV/NV may be phoned; eenmanszaak/vof/maatschap need consent: always confirm in the KVK register), and coordinates (PDOK geocoder). Every fact keeps its source URL (`collected/facts.json`), which is also our record of where lead data came from. It writes a draft `content.json` with every deterministic field filled and `TODO` markers for Generate, plus `brief.md`.

### 4. Style — `npm run looks -- <slug>`

Renders the client in all four looks (phone + desktop first screen) so the look is chosen by eye. Starting suggestion by kind:

| Look | Mood | Default for | Hero | Typography |
|---|---|---|---|---|
| Brown café | warm, classic, wood and brass | brown cafés, eetcafés, beer bars | split, framed photo | Fraunces + Figtree |
| Coffee & brunch | light, minimal, daylight | coffee, brunch, bakeries | split, soft shapes | Bricolage Grotesque + Hanken Grotesk |
| Dining | dark, elegant, candlelit | restaurants, wine and cocktail bars | full-bleed photo | Cormorant Garamond + Manrope |
| Street food | bold, colourful, loud | takeaway, eethuis, sports bars | split, hard shadows | Archivo condensed |

Their own brand colour replaces the look's accent (`brand.accent`), with contrast checked by QA.

### 5. Generate — Claude (rules: `.claude/skills/factory/references/generate.md`)

Claude reads everything collected and writes the final `content.json`: tagline and story in their voice, Dutch first and natural English second, the full menu as real text (`npm run menu` parses "12. Dish / € 9,50" lists), opening hours, the primary action (booking provider → ordering → WhatsApp → phone, labelled honestly), photo choices with honest alt text and origin, SEO title/description, and three talking points that match what the demo actually shows. **Nothing is invented**: unknown facts become questions in `brief.md`, third-party facts are marked `unverified`.

### 6. QA — `npm run qa -- <slug>`

The plan's checklist, automated. Blocking checks: content matches the schema; no placeholder text (content or page); both languages complete, different and with the same sections; one h1, title and description; no missing photos, every image has alt text; in-page and internal links resolve; tap-to-call is valid E.164; directions link; JSON-LD business data; hreflang; demo is noindex with the "Concept for …" label and a blocking robots.txt (live: indexable, canonical, no label); no sideways scroll at 320/390/768/1024/1440 px; no console errors; no serious axe accessibility violations; the open-now badge and menu search work; **Lighthouse mobile performance ≥ 90, accessibility ≥ 95, best practices ≥ 95** (and SEO ≥ 90 for live sites). It also captures 8 screenshots (4 sizes × 2 languages) for the visual review no script replaces.

### 7. Publish demo — `npm run publish`

All QA-passed demos go to one private site at `demo.<studio-domain>/<slug>-<random token>/`, hidden three ways (robots.txt, `X-Robots-Tag`, meta robots); the root lists nothing. `--remove <slug>` takes a declined demo offline (plan: "we delete demos they decline").

### 8. Pitch kit — `npm run pitch -- <slug>`

- `before-after.png`: their site today vs. the concept, on phones, with the three points.
- `card-a5.pdf`: printable A5 (front: "We hebben een nieuwe website voor jullie gemaakt" + phone + QR code to the demo; back: how it works, "not for you? we delete it", contacts).
- `demo-mobile.mp4`: about 45 s phone recording (menu categories, search, hours, language switch).
- `site-nl.html` / `site-en.html` (`npm run standalone -- <slug>`): the whole demo in one file per language, photos and fonts inside. Opens in any browser or phone without a server or link: for a private preview, or to show offline at the visit.
- `talking-points.md` (for Adam): opening line, the three points in EN + NL, what to show in which order, whether we may phone them, questions for the owner, objection answers, follow-up rhythm.

### 9. Launch on yes — `npm run launch -- <slug> --check`, then `--url https://…`

Blocks until the owner has confirmed hours and menu, given permission for (or replaced) photos taken from public sources, a statistics choice is made, and a data-processing agreement exists if the form stores guest data. Writes the launch checklist (order form, 50% deposit, SEPA mandate, domain in the client's name, commercial-use hosting, DNS/HTTPS, Google Business Profile, Search Console) and a one-page NL/EN handover sheet "how to request changes". Switching to live removes the concept label and noindex and adds canonical + sitemap.

### Care (the monthly plan)

Changes arrive on WhatsApp. In Claude Code: `/factory change <slug> "<request>"` edits the content, re-runs QA, deploys and logs the time in `changes.md` (about 1 hour/month included; more is quoted).

## Showcase mode

`"mode": "showcase"` is for fictional example businesses used on the studio's own site (`clients/showcase-*`, see `studio/`). The page says it's a fictional place, stays noindex, and lists photo credits in the footer.

## Rules built into the system

- **Privacy.** This repository is public: `clients/` is git-ignored except the fictional `example-cafe` fixture. Demos are private by URL token and noindex. Client work needs a private home before it's shared between machines (see open decisions).
- **Honesty.** No invented reviews, quotes, awards, superlatives, dietary claims, prices or hours. Review quotes must be verbatim (`verbatim: true`) with author and source; the site shows rating and count otherwise. Schema.org data deliberately omits ratings (Google treats self-published ratings as self-serving).
- **Outreach law.** The pitch sheet says whether Adam may phone (BV/NV, confirm in KVK) or must visit; email/WhatsApp only after consent.
- **Privacy-friendly sites.** No cookies, no third-party requests before consent (the map loads from OpenStreetMap only on click), statistics only cookieless (Plausible, Umami, GoatCounter or Cloudflare).

## Measured on the first real run (Kiem Foei, 25 Nov 2026)

Their current homepage: 7.3 MB, about 10 s to load on mobile, WordPress 4.9. The concept: 133 dishes as searchable text in 7 categories with their own photos, NL + EN, Lighthouse mobile **97 performance / 100 accessibility / 100 best practices**, QA pass. Collect also found "Kiem Foei B.V., KvK 24165736" on their site, so a phone call is allowed (to confirm in KVK).

## Open decisions and next improvements

- **Where client work lives:** a private repo (e.g. `amuse-clients`) or a private copy of this one. Until then client folders exist only on the machine that made them.
- **Studio identity:** name, demo domain, Adam's WhatsApp and the studio email in `studio.config.json` (the A5 card shows red placeholders until then).
- **Hosting:** Vercel Pro vs. a host whose free plan allows commercial use; demos and client sites are plain static folders, so switching is cheap.
- **Keys:** a Google PageSpeed API key for audits; a Vercel token for publishing.
- **Next:** shared pipeline for Adam (stages are already in `status.json`; the lead dashboard can read them), audit all 44 Rotterdam leads, Instagram photo import, an ordering/booking widget option, and a self-edit panel only if owners insist.
