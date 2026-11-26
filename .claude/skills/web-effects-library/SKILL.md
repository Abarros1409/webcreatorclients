---
name: web-effects-library
description: Catalog of ~160 specialist web techniques kept outside the active skill list — scroll-scrubbed reveals, Lenis/GSAP storytelling, WebGL/shader backgrounds, Three.js scenes and materials, liquid glass, dither/ASCII, gooey blobs, cursor trails, marquees, progressive blur, globes, Lottie/Rive/Spline/Barba/Locomotive, curated visual styles (editorial, brutalist, skeuomorphic, paper, dark glass…), pricing/landing patterns. Use when a page needs a specific signature effect, a named visual style, or a 3D/scroll moment that the core skills don't cover.
---

# Web effects library

The core skills (frontend-design, impeccable, design-taste-frontend, GSAP, Three.js…) decide **direction and quality**. This library supplies **specific techniques**: one folder per effect or style, each a complete skill with instructions and code.

## How to use

1. Read `INDEX.md` in this folder and pick the 1–3 entries that match the brief. Choose by the effect the page needs, not by novelty: one signature moment beats five tricks.
2. Open `.claude/skill-library/<name>/SKILL.md` and follow it like any other skill, including any `references/` it links.
3. Adapt the technique to the project's design direction (tokens, type, palette). Never paste a technique's demo look wholesale; the brief wins.
4. Check `prefers-reduced-motion`, mobile performance and fallbacks for every effect you add (see `gsap-performance`, `animation-performance`, `fixing-motion-performance`).

Demo images, videos and fonts were stripped from the library to keep the repo light. If a technique references a demo asset, substitute the project's own asset or a licensed stand-in.

Sources and licences: `.claude/skills/SOURCES.tsv` (rows prefixed `library/`).
