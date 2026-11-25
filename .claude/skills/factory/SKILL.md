---
name: factory
description: The studio's website factory. Turns a hospitality lead (café, bar, restaurant) into a polished private demo site plus a pitch kit, then launches it when the owner says yes, then handles care-plan change requests. Use for "audit these leads", "pick who gets a demo", "build a demo for <business>", "make the pitch kit", "publish the demos", "launch <client>", "the client wants to change <x>", or "/factory <command> <lead>".
argument-hint: "[audit|pick|demo|pitch|publish|launch|change|status] <lead-id|slug> [details]"
user-invocable: true
---

# Website factory

Read `factory/README.md` once per session for the full specification. This file is the runbook.

All commands run from `factory/` (`cd factory && npm install` the first time). Clients live in `clients/<slug>/`, **which git ignores: this repo is public and demos are private.** Never commit anything under `clients/` except `clients/example-cafe/` (a fictional fixture).

## The algorithm

| # | Step | Who | Command | Output | Gate to continue |
|---|------|-----|---------|--------|------------------|
| 1 | Audit | script + Claude looks | `npm run audit -- <lead…>` | `clients/_audits/<id>.json`, `<id>-mobile.png` | — |
| 2 | Pick | script ranks, humans decide | `npm run pick -- --city Rotterdam` | `clients/_audits/picks.md` | independent, well reviewed, weakness visible in 10 s |
| 3 | Collect | script | `npm run collect -- <lead>` | `clients/<slug>/` with `collected/`, `photos/source/`, draft `content.json`, `brief.md` | homepage loaded, facts captured |
| 4 | Style | Claude, by eye | `npm run looks -- <slug>` | `qa/looks/*.png` | one look chosen, reason written in `brief.md` |
| 5 | Generate | **Claude** | `npm run menu -- <slug> <file>` then edit files | final `content.json`, `photos/*`, `theme.css`, `talking-points.json` | no TODO left, nothing invented |
| 6 | QA | script + Claude looks | `npm run qa -- <slug>` | `qa/report.md`, `qa/shots/*.png` | **PASS**, and the screenshots look right |
| 7 | Publish demo | script | `npm run publish` (`--dry` without token) | `factory/out/demos/<slug>-<token>/` | QA passed |
| 8 | Pitch kit | script + Claude looks | `npm run pitch -- <slug>` | `pitch/before-after.png`, `card-a5.pdf`, `demo-mobile.mp4`, `talking-points.md` | images checked by eye |
| 9 | Launch on yes | script + humans | `npm run launch -- <slug> --check`, then `--url https://…` | `launch/checklist.md`, `handover-sheet.pdf` | every blocker cleared |
| — | Care (monthly plan) | Claude | edit, `npm run qa`, deploy | `changes.md` log | QA passes |

`npm run status` shows every client's stage; `npm run status -- <slug> --stage visited --note "…"` logs a sales step.

## /factory demo <lead>: do steps 1 → 8 in order

1. **Audit** the lead (skip if `clients/_audits/<id>.json` is under 30 days old). Open `<id>-mobile.png` and judge what the script can't: dated look, logo-only homepage, clutter. Write that into the audit JSON as `"review": { "visual": "…", "extra_points": n }`.
2. **Pick gate.** Stop and tell the user why if the lead is a chain or group, has no visible weakness, or is closed. A missing website is the strongest weakness.
3. **Collect.** Then read, in this order: `brief.md`, `collected/facts.json` (incl. `legal`: may we phone them?), every `collected/pages/*.txt`, `collected/pdf/*.txt`. Make a contact sheet of `photos/source/` (`montage -label '%f' photos/source/* -tile 6x -geometry 300x225+4+4 sheet.png`) and look at it.
4. **Generate**, following `references/generate.md` exactly. Parse menus with `npm run menu`. Write `content.json` (schema: `factory/schema/content.schema.json`), copy the chosen photos into `photos/` with descriptive names, keep `theme.css` small, write `talking-points.json`, fill the "Demo angle" and notes in `brief.md`.
5. **Style.** Run `npm run looks -- <slug>`, open the four phone + desktop captures, choose, and record why in `brief.md`. The suggested look is only a starting point.
6. **Build and look.** `npm run build -- <slug> --local && npm run shots -- <slug>`. Open the phone and desktop shots in both languages. Fix what you see (copy length, crops via `focus`, section order, hero variant) before QA. For anything the starter can't do, put a component override in `clients/<slug>/overrides/sections/<Name>.astro`, built with the `frontend-design` / `impeccable` craft rules, never by editing the starter for one client.
7. **QA** until it passes. Fix root causes; never loosen a check to get green. Then look at `qa/shots/*.png` once more.
8. **Pitch kit**, then look at `pitch/before-after.png` and `pitch/card-a5-preview.png`. Send the user the before/after, the card preview and the phone shots (SendUserFile).
9. **Publish** when the user asks (`VERCEL_TOKEN` needed), or `--dry` to stage.

Report back in the user's language: weakness score, demo angle, what was confirmed vs. still unverified, the questions for the owner, and whether Adam may phone (BV/NV) or must visit.

## /factory launch <slug>

Run `npm run launch -- <slug> --check`. Clear each blocker with real information from the owner (hours, menu, photo permission, statistics choice, DPA if the form stores data). Then `--url https://their-domain`, run QA again (live mode: indexable, canonical, sitemap, no ribbon), and walk the user through `launch/checklist.md`.

## /factory change <slug> "<request>" (care plan)

1. Apply the change in `content.json` / `photos/` / `theme.css`. Keep `hours.special` for holiday hours.
2. `npm run qa -- <slug>` must pass. Look at the affected section in the shots.
3. Deploy (live sites) and append to `clients/<slug>/changes.md`: date, request, what changed, minutes spent. About 60 minutes a month is included; flag anything bigger as a quote.

## Hard rules

- **Privacy:** the repo is public. Client folders, audits and demos never get committed. Demos stay noindex behind a random token. Declined demos: `npm run publish -- --remove <slug>`, then publish.
- **Honesty:** only facts from their site, the lead list or the owner. No invented reviews, quotes, awards, "oldest in town", halal/vegan/organic claims, prices or hours. Review quotes only verbatim with author and source. Mark third-party facts `unverified`. A supplier's certificate is not a claim about the restaurant.
- **Outreach law (NL):** cold calls only to BV/NV (check KVK; `facts.legal` is a hint, not proof). Email/WhatsApp only after a "yes, send it". Visits and posted cards are fine.
- **AI:** don't hide it if an owner asks; sell the result and the service.
- **Quality bar:** the project `CLAUDE.md` targets apply (Lighthouse mobile ≥ 90, a11y 100 goal, WCAG AA, 320 px without sideways scroll).

## Environment notes

- Cloud sessions only reach hosts on the environment's allowlist. To audit or collect a new lead, its domain must be allowed (or run the factory on a laptop). `api.pdok.nl` enables geocoding (map embed). PageSpeed needs `PAGESPEED_API_KEY` (sent as the `X-Goog-Api-Key` header).
- Playwright and Chromium are preinstalled; don't run `playwright install`.
