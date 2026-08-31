# Netherlands hospitality leads — web-redesign prospecting

A single-file dashboard of **121 independent restaurants, cafés and bars** across the
Netherlands, scored 0–100 on how worth calling each one is for a website-redesign pitch.

**Open `dashboard.html` in any browser.** No server, no build step, no network needed.

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

Ticks and notes are saved to `localStorage`, so they are still there the next time you open the
file on the same device. They never leave the browser. "Reset my notes" clears them.

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
python build_dashboard.py          # rewrites dashboard.html
```

It drives a stealth browser, scrolls each result feed until Google stops adding cards, and pulls
name, phone, address, rating, review count, website and the Maps link straight off the cards.
Its card parser is covered by the fixtures in `tests/test_parse_cards.py`.

## Files

```
dashboard.html            the deliverable — open this
template.html             HTML/CSS/JS shell; data is injected at build time
build_dashboard.py        scoring + summary generation, writes dashboard.html
scraper/gmaps_leads.py    Scrapling Google Maps scraper (run on an unrestricted network)
tests/test_parse_cards.py card-parser test for the scraper
data/leads_raw.jsonl      one JSON object per business, as researched
data/leads.json           scored + enriched records, as embedded in the dashboard
data/candidates.txt       the discovery shortlist the research started from
```
