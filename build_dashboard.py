#!/usr/bin/env python3
"""Turn data/leads_raw.jsonl into the scored lead dashboard (dashboard.html)."""

from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import quote_plus

ROOT = Path(__file__).parent
RAW = ROOT / "data" / "leads_raw.jsonl"
OUT_JSON = ROOT / "data" / "leads.json"
# Vercel is written to twice on purpose: it serves the repo root on some project
# configurations and public/ on others, and a 404 from picking wrong is worse than
# a duplicated generated file. Both copies are identical and both are committed.
OUT_HTML = ROOT / "index.html"
OUT_HTML_PUBLIC = ROOT / "public" / "index.html"
OUT_ARTIFACT = ROOT / "artifact" / "leads.html"          # shared log (db + downloads)
OUT_PUBLIC = ROOT / "artifact" / "leads-public.html"     # no capabilities, so the link can go anywhere

# --- Ownership classification -------------------------------------------------
# Who picks up the phone, and can they say yes to a website project?
CHAIN = {
    "Chicken Spot Nieuwe Binnenweg": "National fried-chicken chain with central marketing.",
    "Sapporo Ramen Kitchen (Takumi)": "Runs under the Takumi Ramen group.",
    "Restaurant 't Slaakhuys": "Inside a Fletcher hotel - web decisions sit with the chain.",
    "Nieuw Rotterdams Cafe (NRC)": "Operated by Be Event Group.",
    "Cafe Brasserie Dudok Arnhem": "Part of the multi-city Dudok group.",
    "De Oude Telefooncentrale": "Runs under the Bij Puur hospitality group.",
    "Mio Papa": "Restaurant of the Art Hotel - hotel decides.",
    "Restaurant De Rechtbank": "Tied to Court Hotel Utrecht.",
    "Bar Restaurant Sijf": "Part of Hell's Kitchen Horeca Groep.",
    "Umami by Han Eindhoven": "Multi-city Umami group with shared branding.",
}
SMALL_GROUP = {
    "SUGO Pizza Westblaak", "SUGO Pizza Aert van Nesstraat", "Ter Marsch & Co",
    "Warung Mini", "Man Met Bril Koffie", "Gys Voorstraat", "Pastryclub",
    "The Roast Club", "Ketelhuis Strijp-S", "Curry's Kralingen",
    "Restaurant Wilde Zwijnen", "Grilla Kitchen",
}

# Businesses whose reviews carry a specific, quotable signal we captured while researching.
SENTIMENT_NOTE = {
    "Meneer Frits": "Reviews split on service and pricing - a clear reputation-repair angle.",
    "Restaurant De Rechtbank": "The weakest scores in this list; guests like the building more than the visit.",
    "Nieuw Rotterdams Cafe (NRC)": "Loved as a night-out venue, criticised as a restaurant.",
    "Chicken Spot Nieuwe Binnenweg": "Huge review volume but a low average - mostly delivery complaints.",
    "Tapasbar Triana": "Staff and atmosphere are praised in review after review.",
    "Cafe De Ooievaar": "Regulars describe it as the friendliest bar in Delfshaven.",
    "Alma Bistro": "Food and interior praised, service occasionally criticised.",
    "Bar Lokaal": "Food well liked, service experiences mixed.",
    "Stadscafe De Vooruitgang": "A local institution, but guest scores lag its reputation.",
    "Eetcafe de Jordaan": "Below-average scores - the weakest reputation in the set.",
    "Friedhats FUKU Cafe": "Coffee quality raved about; the queue is the recurring gripe.",
    "Cafe Binnenvisser": "Praised for natural wine and a warm room.",
    "Restaurant Bazar": "One of the most-reviewed venues in Rotterdam and still rated near the top.",
    "Zeezout": "Consistently ranked among Rotterdam's best fish kitchens.",
    "Mano Restaurant": "Near-perfect scores; ranked #2 in Haarlem.",
    "Scheepskameel": "Exceptional scores across every platform.",
    "Restaurant In den Doofpot": "Rated #2 in Leiden; the wine list is the headline in reviews.",
}


def slug(text):
    """Lead ids double as db document ids, so keep to [a-z0-9-]."""
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def norm_rating(value):
    """Ratings arrive on both 5- and 10-point scales; normalise to /5."""
    if value is None:
        return None
    return round(value / 2, 2) if value > 5 else float(value)


def profile_of(lead):
    name = lead["name"]
    if name in CHAIN:
        return "chain", CHAIN[name]
    if name in SMALL_GROUP:
        return "group", "Small local group with a handful of sites - the owner is still reachable."
    return "independent", "Independent, owner-operated - the person answering the phone can decide."


def sentiment_of(lead, rating):
    if lead["name"] in SENTIMENT_NOTE:
        return SENTIMENT_NOTE[lead["name"]]
    reviews, source = lead.get("reviews"), lead.get("rating_source")
    if rating is None:
        return "No public rating found yet - worth checking their listing before you call."
    volume = (f"across {reviews:,} reviews".replace(",", ".") if reviews
              else f"on {source or 'public'} listings")
    if rating >= 4.7:
        return f"Outstanding {rating}/5 {volume} - guests are actively enthusiastic."
    if rating >= 4.4:
        return f"Strong {rating}/5 {volume} - a well-liked, well-run place."
    if rating >= 4.0:
        return f"Solid {rating}/5 {volume} - liked, with room to sharpen the experience."
    return f"Only {rating}/5 {volume} - reputation is a live problem here."


def score_of(lead, rating, profile):
    """0-100. Phone dominates; chains are penalised; good reviews lift; web is ignored."""
    # Contact (35) - a phone number is the whole point of the list.
    contact = 35 if lead.get("phone") else (12 if lead.get("website") else 0)

    # Decision-maker proximity (25).
    proximity = {"independent": 25, "group": 14, "chain": 5}[profile]

    # Reputation (20).
    if rating is None:
        reputation = 9
    elif rating >= 4.7:
        reputation = 20
    elif rating >= 4.5:
        reputation = 17
    elif rating >= 4.3:
        reputation = 14
    elif rating >= 4.0:
        reputation = 10
    else:
        reputation = 6

    # Size / reachability (20) - big enough to pay, small enough to care.
    reviews = lead.get("reviews")
    if reviews is None:
        size = 12
    elif 150 <= reviews <= 2500:
        size = 20
    elif 50 <= reviews < 150 or 2500 < reviews <= 5000:
        size = 15
    elif reviews < 50:
        size = 10
    else:
        size = 8

    return contact + proximity + reputation + size


def maps_url(lead):
    q = f"{lead['name']} {lead.get('address') or lead['city']}"
    return f"https://www.google.com/maps/search/?api=1&query={quote_plus(q)}"


def build():
    leads = []
    for line in RAW.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        raw = json.loads(line)
        rating = norm_rating(raw.get("rating"))
        profile, profile_note = profile_of(raw)
        score = score_of(raw, rating, profile)
        # Website is not part of the score - it only breaks ties (no site = easier sell).
        tiebreak = 0.4 if not raw.get("website") else 0.0

        where = (raw.get("address") or raw["city"]).split(",")[0]
        leads.append({
            "name": raw["name"],
            "city": raw["city"],
            "address": raw.get("address"),
            "phone": raw.get("phone"),
            "website": raw.get("website"),
            "rating": rating,
            "rating_source": raw.get("rating_source"),
            "reviews": raw.get("reviews"),
            "category": raw.get("category") or "Hospitality",
            "summary": f"{raw.get('category') or 'Hospitality business'} on {where}. "
                       f"{raw.get('notes') or ''}".strip(),
            "sentiment": sentiment_of(raw, rating),
            "profile": profile,
            "profile_note": profile_note,
            "score": score,
            "sort_key": score + tiebreak,
            "maps_url": maps_url(raw),
            "id": slug(f'{raw["name"]} {raw["city"]}'),
        })

    leads.sort(key=lambda x: (-x["sort_key"], x["name"]))
    for lead in leads:
        del lead["sort_key"]

    rated = [x["rating"] for x in leads if x["rating"]]
    stats = {
        "total": len(leads),
        "cities": len({x["city"] for x in leads}),
        "reviews": sum(x["reviews"] or 0 for x in leads),
        "avg_rating": round(sum(rated) / len(rated), 2) if rated else 0,
        "with_phone": sum(1 for x in leads if x["phone"]),
        "no_website": sum(1 for x in leads if not x["website"]),
    }
    by_city = {}
    for lead in leads:
        by_city[lead["city"]] = by_city.get(lead["city"], 0) + 1
    stats["by_city"] = dict(sorted(by_city.items(), key=lambda kv: -kv[1]))

    OUT_JSON.write_text(json.dumps({"stats": stats, "leads": leads}, ensure_ascii=False, indent=1),
                        encoding="utf-8")

    template = (ROOT / "template.html").read_text(encoding="utf-8")
    body = template.replace(
        "/*__DATA__*/null",
        json.dumps({"stats": stats, "leads": leads}, ensure_ascii=False),
    )
    # The artifact host supplies its own <!doctype>/<head>/<body> skeleton.
    OUT_ARTIFACT.parent.mkdir(parents=True, exist_ok=True)
    OUT_ARTIFACT.write_text(body, encoding="utf-8")
    # Same page, published a second time with no capabilities declared: an artifact
    # that declares the shared store cannot be shared publicly, so this is the copy
    # whose link can be handed to anyone.
    OUT_PUBLIC.write_text(body, encoding="utf-8")
    # The standalone file needs that skeleton written in.
    page = (
        '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '<meta name="color-scheme" content="light dark">\n'
        '<meta name="description" content="121 independent Dutch restaurants, cafes and bars, '
        'scored on how worth calling they are for a website-redesign pitch.">\n'
        # Inline so the tab has an icon and the page never 404s on /favicon.ico.
        '<link rel="icon" href="data:image/svg+xml,'
        '%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E'
        '%3Ctext y=\'.9em\' font-size=\'90\'%3E%F0%9F%93%9E%3C/text%3E%3C/svg%3E">\n'
        + body.replace("</script>\n", "</script>\n</body>\n</html>\n", 1)
        .replace("</style>\n", "</style>\n</head>\n<body>\n", 1)
    )
    OUT_HTML.write_text(page, encoding="utf-8")
    OUT_HTML_PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    OUT_HTML_PUBLIC.write_text(page, encoding="utf-8")
    print(f"{stats['total']} leads | {stats['cities']} cities | "
          f"{stats['reviews']:,} reviews | avg {stats['avg_rating']} | "
          f"{stats['with_phone']} with phone | {stats['no_website']} without a website")


if __name__ == "__main__":
    build()
