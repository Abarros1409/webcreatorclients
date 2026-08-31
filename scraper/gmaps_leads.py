"""
Google Maps lead scraper for Dutch hospitality businesses, built on Scrapling.

Collects, per business: name, phone, city, rating, review count, whether it has a
website, and the link to its Google Maps listing.

Usage
-----
    pip install "scrapling[all]>=0.4.8"
    scrapling install --force
    python scraper/gmaps_leads.py --out data/leads_raw.jsonl

Notes
-----
* Google Maps renders its result feed client-side, so this uses Scrapling's
  StealthyFetcher (browser automation) rather than a plain HTTP fetch.
* The feed is virtualised: results only exist in the DOM once scrolled into view,
  so we scroll the feed container until Google stops adding cards.
* Selectors are Google's obfuscated class names and DO drift. Scrapling's adaptive
  matching (`auto_match=True`) relocates elements after a layout change, which is
  the main reason this is written against Scrapling rather than bare Playwright.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from urllib.parse import quote_plus

from scrapling.fetchers import StealthySession

# Feed card selectors. FEED is the scrollable results column.
FEED = 'div[role="feed"]'
CARD = "div.Nv2PK"
CARD_LINK = "a.hfpxzc"          # carries aria-label (name) + href (Maps listing)
CARD_RATING = "span.MW4etd"     # "4.6"
CARD_REVIEWS = "span.UY7F9"     # "(1.234)"
CARD_LINES = "div.W4Efsd"       # category / address / phone text lines
CARD_WEBSITE = 'a[data-value="Website"]'

def first(node, selector):
    """Scrapling's Selector has no css_first(); return the first match or None."""
    found = node.css(selector)
    return found[0] if found else None


PHONE_RE = re.compile(r"(?:\+31|0)\s?(?:\d[\s\-]?){8,11}")
REVIEWS_RE = re.compile(r"[\d.,]+")

# Search grid: (query, city). Widen this list to widen the funnel.
QUERIES: list[tuple[str, str]] = [
    ("restaurants in {city}", ""),
    ("bistro in {city}", ""),
    ("eetcafe in {city}", ""),
    ("brasserie in {city}", ""),
    ("koffiebar in {city}", ""),
    ("lunchroom in {city}", ""),
    ("bar in {city}", ""),
    ("pizzeria in {city}", ""),
]

CITIES = [
    "Rotterdam", "Amsterdam", "Eindhoven", "Utrecht", "Den Haag", "Haarlem",
    "Groningen", "Breda", "Tilburg", "Nijmegen", "Leiden", "Delft", "Arnhem",
    "Maastricht", "Zwolle", "Amersfoort", "Almere", "Dordrecht",
]


@dataclass
class Lead:
    name: str
    city: str
    address: str | None = None
    phone: str | None = None
    website: str | None = None
    rating: float | None = None
    reviews: int | None = None
    category: str | None = None
    maps_url: str | None = None
    queries: list[str] = field(default_factory=list)


def maps_search_url(query: str) -> str:
    # hl=en keeps the DOM labels stable; gl=nl keeps results Dutch.
    return f"https://www.google.com/maps/search/{quote_plus(query)}/?hl=en&gl=nl"


def parse_reviews(text: str | None) -> int | None:
    if not text:
        return None
    m = REVIEWS_RE.search(text)
    if not m:
        return None
    return int(m.group(0).replace(".", "").replace(",", ""))


def parse_card(card, city: str) -> Lead | None:
    link = first(card, CARD_LINK)
    if link is None:
        return None
    name = (link.attrib.get("aria-label") or "").strip()
    if not name:
        return None

    lines = [t for t in (el.get_all_text().strip() for el in card.css(CARD_LINES)) if t]
    blob = " · ".join(lines)

    phone_match = PHONE_RE.search(blob)
    category = lines[0].split("·")[0].strip() if lines else None
    address = None
    if lines:
        parts = [p.strip() for p in lines[0].split("·")]
        if len(parts) > 1:
            address = parts[-1]

    rating_el = first(card, CARD_RATING)
    reviews_el = first(card, CARD_REVIEWS)
    website_el = first(card, CARD_WEBSITE)

    return Lead(
        name=name,
        city=city,
        address=address,
        phone=phone_match.group(0).strip() if phone_match else None,
        website=website_el.attrib.get("href") if website_el is not None else None,
        rating=float(rating_el.text.replace(",", ".")) if rating_el is not None and rating_el.text else None,
        reviews=parse_reviews(reviews_el.text if reviews_el is not None else None),
        category=category,
        maps_url=link.attrib.get("href"),
    )


def scrape_query(session: StealthySession, query: str, city: str,
                 max_scrolls: int = 40, pause: float = 1.4) -> list[Lead]:
    """Load one Maps search and scroll its feed until no new cards appear."""
    page = session.fetch(maps_search_url(query), wait_selector=FEED, network_idle=True)

    seen_html_len, stagnant = 0, 0
    for _ in range(max_scrolls):
        # Scroll the feed container itself; scrolling <body> does nothing here.
        session.page.eval_on_selector(
            FEED, "el => el.scrollTo(0, el.scrollHeight)"
        )
        time.sleep(pause)
        html = session.page.content()
        if len(html) <= seen_html_len:
            stagnant += 1
            if stagnant >= 2:          # two idle rounds == end of the feed
                break
        else:
            stagnant = 0
        seen_html_len = len(html)

    page = session.fetch(session.page.url) if page is None else page
    leads: list[Lead] = []
    for card in page.css(CARD):
        lead = parse_card(card, city)
        if lead:
            lead.queries.append(query)
            leads.append(lead)
    return leads


def dedupe(leads: list[Lead]) -> list[Lead]:
    by_key: dict[str, Lead] = {}
    for lead in leads:
        key = (lead.maps_url or f"{lead.name}|{lead.city}").split("?")[0].lower()
        if key in by_key:
            existing = by_key[key]
            existing.queries.extend(lead.queries)
            # Keep the richest version of each field.
            for f in ("phone", "website", "address", "rating", "reviews", "category"):
                if getattr(existing, f) is None:
                    setattr(existing, f, getattr(lead, f))
        else:
            by_key[key] = lead
    return list(by_key.values())


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", default="data/leads_raw.jsonl")
    ap.add_argument("--cities", nargs="*", default=CITIES)
    ap.add_argument("--headless", action="store_true", default=True)
    ap.add_argument("--max-scrolls", type=int, default=40)
    args = ap.parse_args()

    all_leads: list[Lead] = []
    with StealthySession(headless=args.headless, block_webrtc=True,
                         disable_resources=False, humanize=True) as session:
        for city in args.cities:
            for template, _ in QUERIES:
                query = template.format(city=city)
                try:
                    found = scrape_query(session, query, city, args.max_scrolls)
                except Exception as exc:               # one bad query must not kill the run
                    print(f"  ! {query}: {exc}", file=sys.stderr)
                    continue
                all_leads.extend(found)
                print(f"  {query}: {len(found)} cards", file=sys.stderr)

    leads = dedupe(all_leads)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as fh:
        for lead in leads:
            fh.write(json.dumps(asdict(lead), ensure_ascii=False) + "\n")
    print(f"{len(leads)} unique leads -> {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
