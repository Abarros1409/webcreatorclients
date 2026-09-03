# Netherlands hospitality leads — web-redesign prospecting

A single-file dashboard of **121 independent restaurants, cafés and bars** across the
Netherlands, scored 0–100 on how worth calling each one is for a website-redesign pitch.

**Open `index.html` in any browser** — no server, no build step, no network needed — or deploy
the repo to Vercel and hand out the URL.

| | |
|---|---|
| Businesses | 121 |
| With a direct phone number | 94 |
| Without a website (easiest sell) | 12 |
| Cities | 11 — Rotterdam 44, Amsterdam 28, Eindhoven 19, Utrecht 9, Groningen 5, Breda 5, Haarlem 4, Den Haag 3, Leiden 2, Maastricht 1, Arnhem 1 |
| Combined public reviews | 78,786 |
| Average rating | 4.42 / 5 |

## What's in the dashboard

Four headline figures, a per-city bar chart (click a bar to filter), and every business as a
card you can search, filter and sort by score. Each card carries name, phone (tap to dial),
city, rating + review count and its source, a website / no-website tag, a two-line summary of
what they do, what guests generally say, who you'll actually be talking to, a button through to
their Google Maps listing — plus a **Called** checkbox and a **call-notes** box.

### The call log

The page keeps a call log — a **Called** tick, free-text notes, and who last touched each entry —
and it stores that log in one of two places depending on how the page is opened:

- **Published as an artifact** (https://claude.ai/code/artifact/81bf9b7c-0717-4c99-a424-8a2e110370bb):
  the log lives in the artifact's own store, one document per business. Everyone with the link reads
  and writes the same record and changes appear live, so two people can work the list at once. Entries
  are stamped with the name typed into the sync bar. An artifact that declares this store is
  organisation-internal — anyone you share it with must be signed in to the same Claude workspace.
- **Opened as a plain file**: the log falls back to that browser's `localStorage`. Still saved between
  visits, but private to that one device.

The bar above the list always says which mode you are in. **Export log** and **Import log** move the log
as JSON, keeping whichever entry was edited most recently per business, so two people on separate devices
reconcile without the shared store. How the transfer happens depends on what the page is allowed to do:
a real file download where that works (the local file, or the shared artifact via its download
capability), and otherwise a copy-paste dialog — the artifact viewer never lets a page start its own
download, so copy-paste is the fallback that works everywhere.

### Two published links

| Link | Call log | Who can open it |
|---|---|---|
| [Shared log](https://claude.ai/code/artifact/81bf9b7c-0717-4c99-a424-8a2e110370bb) | One shared record, live across viewers | Only people signed in to the same Claude workspace — declaring the shared store makes an artifact organisation-internal, so this link cannot be made public |
| [Public copy](https://claude.ai/code/artifact/148ce52b-b0a5-46c5-86d6-715cddf385f8) | Each viewer's own browser | Anyone with the link |

Same page, same data, published twice. The public copy declares no capabilities, which is exactly what
lets its link be shared without restriction — and exactly why it has no shared log.

Writes are last-writer-wins per business, and the page never overwrites a notes box while someone is
typing in it.

Light and dark themes follow your OS and can be toggled; the layout works down to phone width.

## How the score works

| Weight | Signal |
|---:|---|
| **35** | Direct phone number (12 if there is only a website, 0 if neither) |
| **25** | Distance to the decision-maker — independent 25 · small local group 14 · chain / hotel group 5 |
| **20** | Review rating (≥4.7 → 20 · ≥4.5 → 17 · ≥4.3 → 14 · ≥4.0 → 10 · below → 6 · unknown → 9) |
| **20** | Review volume — 150–2,500 is the sweet spot (20); very small or very large scores lower |

Having a website is deliberately **not** scored. It only breaks ties, since a business without
one is the easier sell. Scores run 35 → 100 across the list.

## Data sources and honest caveats

Ratings and review counts are the **best public figure found per business** — Google where it
was available, otherwise RestaurantGuru, Tripadvisor, TheFork or Facebook. Every card shows
which source its number came from. Ten-point scores (TheFork, Eet.nu) are converted to the
five-point scale. 96 of the 121 businesses have a rating; the rest are marked "no public rating
found".

**Verify the phone number on the Maps listing before you dial.** Hospitality turns over fast and
a handful of these numbers will already be stale. Two venues found during research
(Café Proust in Amsterdam, Ethica in Den Haag) were dropped because they had closed;
The Boathouse Kralingen was dropped for the same reason.

### Why the data was not scraped from Google Maps in this session

`scraper/gmaps_leads.py` is a working Scrapling scraper for the Google Maps results feed. It
could **not be run here**: this environment's egress proxy denies CONNECT to every host outside
GitHub and the package registries, `google.com` included, so no browser in this container can
reach Maps. The dataset was instead assembled through the sanctioned web-search tool and
cross-checked business by business.

Run the scraper yourself on a normal network to refresh or widen the list:

```bash
pip install "scrapling[all]>=0.4.8"
scrapling install --force
python scraper/gmaps_leads.py --out data/leads_raw.jsonl --cities Rotterdam Amsterdam Eindhoven
python3 build_dashboard.py         # rewrites public/index.html and the artifact bodies
```

It drives a stealth browser, scrolls each result feed until Google stops adding cards, and pulls
name, phone, address, rating, review count, website and the Maps link straight off the cards.
Its card parser is covered by the fixtures in `tests/test_parse_cards.py`.

## Files

```
index.html                the site — open it locally; this is what Vercel serves at /
public/index.html         identical copy, so the deploy works whichever root Vercel picks
vercel.json               static config: clean URLs, basic security headers
artifact/leads.html       the same page as artifact body content (no <html> wrapper)
template.html             HTML/CSS/JS shell; data is injected at build time
build_dashboard.py        scoring + summary generation, writes all three HTML outputs
scraper/gmaps_leads.py    Scrapling Google Maps scraper (run on an unrestricted network)
tests/test_parse_cards.py card-parser test for the scraper
data/leads_raw.jsonl      one JSON object per business, as researched
data/leads.json           scored + enriched records, as embedded in the dashboard
data/candidates.txt       the discovery shortlist the research started from
```
