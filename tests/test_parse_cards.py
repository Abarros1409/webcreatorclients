"""Parser tests for the Google Maps card extractor.

Run with:  python tests/test_parse_cards.py
(Needs scrapling installed; no network and no browser.)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scrapling.parser import Selector

from scraper.gmaps_leads import CARD, parse_card, parse_reviews

FEED = """
<div role="feed">
 <div class="Nv2PK">
  <a class="hfpxzc" aria-label="Cafe De Ooievaar"
     href="https://www.google.com/maps/place/Cafe+De+Ooievaar/data=!4m7"></a>
  <span class="MW4etd">4,8</span><span class="UY7F9">(1.438)</span>
  <div class="W4Efsd">Brown cafe &middot; Havenstraat 11B</div>
  <div class="W4Efsd">Open &sdot; Closes 1 am &middot; 010 476 9190</div>
  <a data-value="Website" href="https://www.cafedeooievaar.nl/"></a>
 </div>
 <div class="Nv2PK">
  <a class="hfpxzc" aria-label="Tiki Taka Sportsbar"
     href="https://www.google.com/maps/place/Tiki+Taka/data=!4m8"></a>
  <span class="MW4etd">5,0</span><span class="UY7F9">(73)</span>
  <div class="W4Efsd">Sports bar &middot; Pannekoekstraat 87A</div>
  <div class="W4Efsd">Closed &middot; +31 6 43442815</div>
 </div>
 <div class="Nv2PK"><span>advert slot with no anchor</span></div>
</div>
"""


def main():
    cards = Selector(FEED).css(CARD)
    assert len(cards) == 3, cards
    leads = [lead for lead in (parse_card(c, "Rotterdam") for c in cards) if lead]
    assert len(leads) == 2, "the anchor-less card must be skipped"

    a, b = leads
    assert a.name == "Cafe De Ooievaar"
    assert a.phone == "010 476 9190"
    assert a.rating == 4.8 and a.reviews == 1438
    assert a.website == "https://www.cafedeooievaar.nl/"
    assert a.address == "Havenstraat 11B" and a.category == "Brown cafe"
    assert a.maps_url.startswith("https://www.google.com/maps/place/")

    assert b.name == "Tiki Taka Sportsbar"
    assert b.phone == "+31 6 43442815"
    assert b.website is None, "no Website button means no site on the listing"
    assert b.rating == 5.0 and b.reviews == 73

    assert parse_reviews("(1.438)") == 1438
    assert parse_reviews("(2,317)") == 2317
    assert parse_reviews(None) is None
    print("all card-parser tests passed")


if __name__ == "__main__":
    main()
