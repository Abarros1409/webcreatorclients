# Generate: rules for writing a client's site

Generate is the only step where Claude writes. Everything else is measured or copied. The goal: an owner opens the demo and thinks "that's us, but better", with nothing on it they'd have to correct in front of a guest.

## Sources, in order of trust

1. What the owner told us (only after a visit).
2. Their own website text (`collected/pages`, `collected/pdf`), JSON-LD, their social bios.
3. The lead list (`collected/facts.json → from_lead_list`): name, address, phone, rating, review count. Its `summary` and `sentiment` were written by us; use them as hints, never as quotes or claims.
4. Nothing else. If a fact isn't in 1–3, leave it out or put it in `brief.md` as a question.

When sources disagree (address 29 vs 29b), use the business's own site and note the conflict in `brief.md`.

## Copy

- **Their voice first.** Reuse their own tagline or phrasing when they have one (translate it for EN). Then write plainly: short sentences, concrete nouns (dishes, streets, beers), no marketing filler ("experience", "passion", "culinary journey", "elevate", "nestled").
- **Dutch first, natural English second.** EN is rewritten for a visitor, not translated word by word. Keep Dutch proper names (West-Kruiskade, bitterballen) and explain them in EN only where a tourist would be lost.
- Lengths: `tagline` ≤ 90 characters; `intro` 1–2 sentences; `story.body` two short paragraphs; `seo.title` ≤ 60 characters; `seo.description` 120–155 characters including area and opening days.
- `story`: if their site has no story, write a modest one from verifiable facts only (what they serve, where, how you order) and add "replace with the owner's words" to `brief.md`.
- `facts` (max 4): numbers you can count or quote from their site (dishes on the menu, beers on tap, year founded if stated). `value` is not translated, so keep it language-neutral ("133", "12:00", "1962").
- `kicker`: set it when cuisine words would stay Dutch on the English page.

## Menu

- Parse with `npm run menu -- <slug> pages/<file>.txt --from "<first heading>" --to "<last line>"` (or a `pdf/*.txt`), then check the counts against the source.
- Keep dish names as the business writes them in `name.nl`; translate the descriptive part for `name.en` (Saoto soep groot → "Saoto soup, large"). Proper dish names stay (Nasi goreng, Foe yong hai, Bitterballen).
- Prices exactly as listed. Several sizes go in `price_label` ("0,25 3,90 · 0,5 7,20"). "Vanaf" prices: `price: null`, `price_label: "v.a. 6,00"`.
- Menu numbers go in `meta: "#20"` (shown as a badge, searchable). Origin/ABV/grape also go in `meta`.
- `description` only to help a guest who doesn't know the dish, one short line, facts only.
- Tags only when the source says so (a "Vegetarisch" section, "pikant" in the name). Never infer vegan, gluten-free or halal.
- `searchable: true` for long lists (beer, wine, 40+ dishes). Over 40 items, the site shows one category at a time automatically.
- Supplements and rules go in the section `note`. Always set `allergens_note`.
- `menu.unverified: true` until the owner confirms. `source.url` + `checked_on` always.

## Photos

- Pick from `photos/source/`, copy into `photos/` with descriptive names (`facade-neon.jpg`, `dish-03-saoto.jpg`). Never edit the originals.
- Hero: the most characteristic image at the best resolution (front, room, signature dish). Set `focus` when the crop cuts the subject.
- `alt` describes what is visible. Only name a specific dish when you are sure it's that dish (numbers in old filenames can be from an older menu).
- `origin` is honest: `their-website`, `their-instagram`, `google-maps`, `stand-in`, `client`. Stand-ins are allowed in a demo only; launch blocks them.
- Fewer than 3 good photos → no gallery (the section hides itself); don't pad with weak images.
- Logos: use a transparent PNG/SVG if one exists; otherwise let the wordmark render. Never put a logo with a baked-in background on a coloured header.

## Look, brand and layout

- Start from the suggested look, check all four with `npm run looks`, choose by eye. Record why in `brief.md`.
- `brand.accent` = their own colour when they have one (logo, sign, awning), with `accent_ink` giving ≥ 4.5:1 contrast. Secondary brand colours go in `theme.css` as variables, used sparingly.
- `theme.css` stays small (inside `@layer client`). Bigger changes go in an override component, built with the `frontend-design` and `impeccable` rules and checked with QA.
- `sections`: put what this guest needs first. Takeaway: menu right after the hero. Restaurant: booking high. Bar: drinks + events.
- Primary action (`booking`): real booking provider URL if they have one; else ordering URL; else WhatsApp; else phone with an honest label ("Bel om te bestellen" for takeaways, not "Reserveer").

## Talking points (`talking-points.json`)

Three points, each `{ key, say_en, say_nl, demo_fix }`. Start from the audit, keep only weaknesses the demo visibly fixes, and add numbers you measured (page weight, load time, Lighthouse score of the demo). Never promise something the demo doesn't do.

## Before you hand over

- No `TODO` left (`npm run validate`/QA will fail anyway).
- `brief.md` lists every unverified fact and every question for the owner.
- Look at the phone screenshot of the first screen: name, what they serve, the main button and open/closed status are visible without scrolling.
