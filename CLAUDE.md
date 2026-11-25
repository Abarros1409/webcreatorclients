# CLAUDE.md — Web Creator Clients

This repo builds websites for real small businesses (restaurants, cafés, bars, hospitality and other local clients) and the prospecting tools around them. **Every page shipped from here must look like it came from a top design studio**: a committed visual direction, real content, flawless responsive behaviour, and fast, accessible code.

Talk to the user in Spanish (rioplatense). Code, comments, commit messages and file names in English. Anything written for Adam (docs, plans, scripts, templates) is in English.

## The website factory (start here for client work)

Demos and client sites are built with the factory, not from scratch: `factory/README.md` is the specification and the `factory` skill is the runbook (`/factory demo <lead>`, `/factory launch <slug>`, `/factory change <slug> "…"`). The starter kit lives in `factory/starter/`; per-client content in `clients/<slug>/`.

- **This repo is public.** `clients/` is git-ignored (except the fictional `clients/example-cafe/`). Never commit client content, photos, audits or demo builds, and never publish a real business's demo as an Artifact.
- Improve the factory for everyone (starter sections, looks, scripts) rather than hand-editing one client's build; per-client differences go in `clients/<slug>/theme.css` or `clients/<slug>/overrides/`.
- The design workflow below applies inside the factory too: Generate and visual review are where the design skills matter most.

## The workflow for any web page

Run these steps for every new page, redesign or major section. Skip a step only when it clearly doesn't apply, and say which one you skipped.

1. **Context & brief**: who the business is, what the visitor must do (book, call, visit, buy), tone, location, real assets. Read `PRODUCT.md` / `DESIGN.md` if they exist. For a client that already has a site, reconstruct its brand with `create-design-md`. For an app or dashboard, use `interface-design` (it persists decisions in `.interface-design/system.md`).
2. **Direction (before any code)**: load `frontend-design` and pick ONE bold, specific aesthetic direction. For marketing and company sites, also load `design-taste-frontend` (taste-skill v2 kit: dealt heroes, motion, moments, photos). Use `impeccable` (`shape` / `craft`) to plan the surface. `ui-ux-pro-max` gives palette, font-pairing and style data by industry (`python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system`). Write the tokens (type scale, palette, spacing, radius, motion) down as `DESIGN.md` for the project.
3. **Build**: see the stack defaults below. Motion with intent (`animate`, `choreograph`, GSAP skills). Add at most 1–2 signature moments from `web-effects-library`. Copy that sounds like the business, never filler (`skills-megapack:mkt-copywriting`).
4. **Look at it**: render with Playwright at 1440×900, 1024×768, 768×1024 and 390×844 (plus dark mode if it supports one), **open the screenshots and actually inspect them**, fix what you see, and repeat (`iterate-until-verified`). Never call a page done without having seen it.
5. **Quality gates**: `web-design-guidelines` (Vercel interface rules), `audit-ai-design-slop`, `fixing-accessibility`, `web-quality-audit` / `core-web-vitals`, `fixing-metadata` (title, description, OG image, favicon, canonical, JSON-LD such as `LocalBusiness`/`Restaurant`; also `skills-megapack:seo-schema`), `break-ui` (long names, missing data, non-Latin text).
6. **Polish**: `make-interfaces-feel-better`, `impeccable polish`, `review-animations`, `baseline-ui`.
7. **Ship**: `deploy-to-vercel` (this repo already deploys static sites to Vercel; see `DEPLOY.md`).

### Targets
- Lighthouse: Performance ≥ 90 on mobile, Accessibility 100, Best Practices 100, SEO 100.
- Core Web Vitals: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1.
- WCAG 2.2 AA: contrast, focus-visible, keyboard, `prefers-reduced-motion` honoured for every animation.
- No horizontal scroll at 320 px. Tap targets ≥ 44 px.

## Skill router

| Need | Skills (project `.claude/skills/`) |
|---|---|
| Aesthetic direction, distinctive UI | `frontend-design`, `design-taste-frontend`, `impeccable`, `design-first-ui-prompting` |
| Landing / marketing / pricing pages | `landing-page`, `pricing-page`, `build-awwwards-quality-sites`, `design-taste-frontend` |
| App UI, dashboards, admin | `interface-design`, `impeccable`, `frontend-ui-engineering` |
| Design data (palettes, fonts, styles per industry) | `ui-ux-pro-max` |
| Design system / DESIGN.md | `create-design-md`, `impeccable document/extract`, `interface-design` |
| Anti-slop review | `no-ai-design-slop` (while building), `audit-ai-design-slop` (after), `improve-ui` (read-only audit) |
| Micro-polish & feel | `make-interfaces-feel-better`, `emil-design-eng`, `apple-design`, `baseline-ui` |
| Animation decisions | `animate`, `choreograph`, `find-animation-opportunities`, `animation-vocabulary`, `remove-animations`, `improve-animations`, `review-animations` |
| Scroll storytelling, Lenis | `cinematic-scroll-storytelling`, `cinematic-gsap-lenis-motion-system`, `awwwards-animations` |
| GSAP | `gsap-core`, `gsap-timeline`, `gsap-scrolltrigger`, `gsap-plugins`, `gsap-react`, `gsap-utils`, `gsap-performance`, `gsap-frameworks` |
| Motion (Framer Motion) / View Transitions | `motion-framer`, `react-view-transitions` |
| Gestures, sheets, drag | `gestures`, `apple-design` |
| Animation performance | `animation-performance`, `fixing-motion-performance`, `optimize-web-animations`, `gsap-performance` |
| 3D / WebGL | `threejs-*` (fundamentals, geometry, materials, lighting, textures, loaders, animation, interaction, shaders, postprocessing, performance, asset-pipeline, react-three-fiber) |
| Specific effects or styles (liquid glass, dither, shaders, marquees, globes, Lottie, Rive, Spline, Barba…) | `web-effects-library` → `.claude/skill-library/` |
| React / Next.js | `vercel-react-best-practices`, `vercel-composition-patterns` |
| Tailwind v4 / shadcn | `tailwind-css`, `shadcn` |
| Picking a library (toasts, drawers, charts…) | `pick-ui-library` |
| Mobile web feel | `mobile-native` |
| Accessibility | `fixing-accessibility`, `accessibility` |
| Performance / CWV | `performance`, `core-web-vitals`, `web-quality-audit` |
| SEO & metadata | `seo`, `fixing-metadata`, `best-practices`, plugin `skills-megapack:seo-*`, `searchfit-seo:*` |
| Browser verification | `webapp-testing`, `playwright-skill`, `iterate-until-verified` |
| Variations to choose from | `prototype` |
| Device mockups / product shots | `device-frames` |
| Capture the session's design corrections as rules | `learn-taste` |
| Deploy | `deploy-to-vercel` |

Plugin skills that are also useful here: `skills-megapack:mkt-copywriting`, `skills-megapack:mkt-cro`, `skills-megapack:mkt-site-architecture`, `skills-megapack:seo-local` (local businesses), `figma:*` (Figma to code), `design:accessibility-review`, `design:ux-copy`, `modern-web-guidance:modern-web-guidance`, `anthropic-skills:theme-factory`, `artifact-design` (when publishing as an Artifact).

**Prefer the project copies** over these older plugin copies, which are outdated or broken in this environment:
- `impeccable` (v4.11) over `veiren-skills-portable:impeccable` (v3.8; its setup script is missing).
- `ui-ux-pro-max` over `*:uiux-ui-ux-pro-max` (their `data/` and `scripts/` are dead symlink stubs).
- `design-taste-frontend` (taste-skill 2.5.1) over the plugin `design-taste-frontend` / `*-v1` variants.
- `emil-design-eng` from the project (latest upstream) over the plugin copies.

## Stack defaults

- **Simple client site** (1–5 pages, restaurant/café/bar): static HTML + modern CSS (container queries, `clamp()`, cascade layers, `:has()`, view transitions) + a little vanilla JS or GSAP. A single deployable folder with no build step unless one is needed. Self-host or preconnect fonts; images in AVIF/WebP with `width`/`height` and `srcset`.
- **Larger site or app**: Vite or Next.js + Tailwind v4 + shadcn/ui, with Motion or GSAP.
- Fonts: pick distinctive pairings with a reason (see `frontend-design` and `ui-ux-pro-max`). Never default to Inter, Roboto, Arial or system-ui as the display face.

## Hard rules

- **Real content only.** For a real business, never invent reviews, testimonials, ratings, awards, prices, opening hours or claims. Use data the client gave or that is publicly verifiable (e.g. `data/leads.json`). Mark anything provisional as a visible, obvious placeholder.
- Images: client photos, or licensed stand-ins (Unsplash etc., credited where the licence asks). Never pass off a stock or AI image as the client's real premises, food or staff.
- No AI-slop tells: purple-to-blue gradients by default, the centred hero followed by three identical feature cards, emoji as icons, glassmorphism everywhere, lorem ipsum, "Elevate your…" copy.
- Every animation has a purpose, can be interrupted, and respects `prefers-reduced-motion`.
- Mobile first. Check 390 px before calling anything finished.

## Environment notes (cloud sessions)

- Chromium + Node Playwright are preinstalled: `require('playwright')` with `chromium.launch()`. **Do not run `playwright install`** or the `playwright-skill` setup step. Python Playwright is not installed, so `webapp-testing`'s Python helpers need `pip install playwright` first; prefer Node scripts.
- `impeccable`'s launcher downloads its engine binary from GitHub releases on first run. If that's refused or fails, follow the skill's own "Launcher unavailable" fallback (read PRODUCT.md / DESIGN.md directly) and continue.
- `shadcn` runs `npx shadcn@latest info --json` when it loads; that only works inside a shadcn project.
- Where the skills came from (repo, commit, licence): `.claude/skills/SOURCES.tsv`. To update them, re-clone the upstream repo and copy the skill folder again; don't hand-edit vendored skills.
