"""Writes the four fictional showcase businesses (one per look) used on the studio's own site.
Everything here is invented and labelled as fictional on the page (mode: showcase).
Run: python3 factory/scripts/showcase-content.py  (from the repo root)"""
import json, os, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CLIENTS = os.path.join(ROOT, 'clients')
KIT = os.path.join(ROOT, '.claude', 'skills', 'design-taste-frontend', 'assets', 'photos', 'img')

def L(nl, en=None):
    return {'nl': nl, 'en': en or nl}

def item(nl, en, price, desc=None, meta=None, tags=None, featured=False):
    i = {'name': L(nl, en), 'price': price}
    if desc: i['description'] = L(*desc)
    if meta: i['meta'] = meta
    if tags: i['tags'] = tags
    if featured: i['featured'] = True
    return i

def base(slug, look, name, kind, schema_type, street, geo):
    return {
        'schema_version': 1, 'slug': slug, 'mode': 'showcase', 'look': look,
        'business': {'name': name, 'kind': kind, 'schema_type': schema_type},
        'contact': {
            'phone': '+31100000000', 'phone_display': '010 000 00 00', 'email': 'hallo@example.com',
            'address': {'street': street, 'postal_code': '3000 AA', 'city': 'Rotterdam', 'country': 'NL'},
            'geo': geo,
            'maps_url': f"https://www.openstreetmap.org/?mlat={geo['lat']}&mlon={geo['lng']}#map=17/{geo['lat']}/{geo['lng']}",
        },
    }

shows = []

# 1. Brown café
c = base('showcase-bruin-cafe', 'brown-cafe', 'Café De Ruggespraak', 'brown-cafe', 'BarOrPub', 'Voorbeeldkade 12', {'lat': 51.9171, 'lng': 4.4835})
c['business'].update({
    'cuisine': ['Bruin café'], 'price_range': '€€',
    'kicker': L('Bruin café aan de kade', 'Brown café on the quay'),
    'tagline': L('Bier van de tap, bitterballen uit de keuken en een tafel bij het raam.', 'Beer on tap, bitterballen from the kitchen and a table by the window.'),
    'intro': L('Een fictief bruin café, gemaakt om te laten zien hoe een site van ons eruitziet.', 'A fictional brown café, made to show what one of our sites looks like.'),
    'story': {'title': L('Hout, koper en vaste gasten', 'Wood, brass and regulars'), 'body': L(
        'In het echt staat hier het verhaal van de eigenaar, in zijn eigen woorden. Wie het café begon, waarom de tap altijd koud is en welke tafel van de vaste gasten is.\n\nWij schrijven het op na één gesprek, in het Nederlands en in het Engels.',
        'On a real site this is the owner’s story, in their own words: who started the café, why the beer is always cold and which table belongs to the regulars.\n\nWe write it after one conversation, in Dutch and in English.')},
    'facts': [{'value': '14', 'label': L('bieren van de tap', 'beers on tap')}, {'value': '40', 'label': L('plekken op het terras', 'terrace seats')}],
})
c['hours'] = {'timezone': 'Europe/Amsterdam', 'regular': [{'days': ['mo', 'tu', 'we', 'th'], 'opens': '14:00', 'closes': '01:00'}, {'days': ['fr', 'sa'], 'opens': '12:00', 'closes': '02:00'}, {'days': ['su'], 'opens': '12:00', 'closes': '00:00'}], 'note': L('Keuken open tot 22:00.', 'Kitchen open until 22:00.')}
c['menu'] = {'title': L('Eten & drinken', 'Food & drinks'), 'currency': 'EUR', 'searchable': True, 'sections': [
    {'id': 'borrel', 'title': L('Borrel', 'Bar bites'), 'items': [
        item('Bitterballen (8)', 'Bitterballen (8)', 8.5, ('Met grove mosterd.', 'With coarse mustard.'), featured=True),
        item('Ossenworst', 'Ossenworst (raw beef sausage)', 7.5, ('Met piccalilly.', 'With piccalilli.')),
        item('Oude kaas', 'Aged cheese', 7.0, ('Met mosterd en selderijzout.', 'With mustard and celery salt.'), tags=['vegetarian']),
        item('Tosti ham-kaas', 'Ham and cheese toastie', 5.5)]},
    {'id': 'tap', 'title': L('Van de tap', 'On tap'), 'note': L('Elke maand een andere gasttap.', 'A different guest tap every month.'), 'items': [
        {'name': 'Huispils', 'meta': 'NL · 5,0%', 'price_label': '0,25 3,80 · 0,5 7,00'},
        {'name': 'Witbier', 'meta': 'NL · 5,2%', 'price': 4.9},
        {'name': 'Tripel', 'meta': 'BE · 8,5%', 'price': 6.5, 'tags': ['signature']},
        {'name': L('Alcoholvrij', 'Alcohol-free'), 'meta': 'NL · 0,0%', 'price': 4.5, 'tags': ['alcohol-free']}]},
    {'id': 'jenever', 'title': L('Jenever', 'Jenever (Dutch gin)'), 'items': [
        {'name': L('Jonge jenever', 'Young jenever'), 'price': 3.5},
        {'name': L('Oude jenever', 'Aged jenever'), 'price': 4.0},
        {'name': L('Korenwijn', 'Korenwijn (malt jenever)'), 'price': 5.0}]},
], 'allergens_note': L('Vraag ons naar allergenen.', 'Ask us about allergens.')}
c['booking'] = {'provider': 'phone', 'label': L('Bel voor een tafel', 'Call for a table')}
c['events'] = {'items': [
    {'title': L('Pubquiz', 'Pub quiz'), 'when': L('Elke dinsdag, 20:30', 'Every Tuesday, 20:30'), 'description': L('Teams tot zes personen.', 'Teams of up to six.')},
    {'title': L('Jazz op zondag', 'Sunday jazz'), 'when': L('Eerste zondag van de maand, 16:00', 'First Sunday of the month, 16:00')}]}
c['groups'] = {'enabled': True, 'title': L('Borrel met een groep', 'Drinks with a group'), 'body': L('Vanaf acht personen houden we een hoek voor jullie vrij.', 'From eight people we keep a corner free for you.'), 'min_size': 8, 'max_size': 60, 'form': {'method': 'mailto', 'to': 'hallo@example.com'}}
c['seo'] = {'title': L('Café De Ruggespraak · voorbeeld van Amuse Studio', 'Café De Ruggespraak · Amuse Studio example'), 'description': L('Een fictief bruin café in Rotterdam, gemaakt door Amuse Studio om te laten zien hoe een site van ons eruitziet.', 'A fictional brown café in Rotterdam, made by Amuse Studio to show what one of our sites looks like.')}
shows.append((c, []))

# 2. Coffee & brunch (with licensed photos)
c = base('showcase-koffie-brunch', 'coffee-brunch', 'Morgenrood', 'coffee-brunch', 'CafeOrCoffeeShop', 'Voorbeeldstraat 3', {'lat': 51.9205, 'lng': 4.4669})
c['business'].update({
    'cuisine': ['Koffie', 'Brunch'], 'price_range': '€€',
    'kicker': L('Koffie & brunch', 'Coffee & brunch'),
    'tagline': L('Koffie van een kleine branderij, brunch tot drie uur.', 'Coffee from a small roastery, brunch until three.'),
    'intro': L('Een fictieve koffiebar, gemaakt om te laten zien hoe een site van ons eruitziet.', 'A fictional coffee bar, made to show what one of our sites looks like.'),
    'story': {'title': L('Eerst de koffie', 'Coffee first'), 'body': L(
        'Op een echte site vertelt de eigenaar hier waar de bonen vandaan komen en waarom het brood elke ochtend vers is.\n\nKort, persoonlijk, en in twee talen voor de buren en de toeristen.',
        'On a real site the owner explains here where the beans come from and why the bread is fresh every morning.\n\nShort, personal, and in two languages for the neighbours and the tourists.')},
})
c['hours'] = {'timezone': 'Europe/Amsterdam', 'regular': [{'days': ['mo', 'tu', 'we', 'th', 'fr'], 'opens': '08:00', 'closes': '16:00'}, {'days': ['sa', 'su'], 'opens': '09:00', 'closes': '17:00'}], 'note': L('Brunch tot 15:00.', 'Brunch until 15:00.')}
c['menu'] = {'title': L('Menu', 'Menu'), 'currency': 'EUR', 'sections': [
    {'id': 'koffie', 'title': L('Koffie', 'Coffee'), 'items': [
        item('Espresso', 'Espresso', 2.8), item('Flat white', 'Flat white', 4.2, featured=True), item('Cappuccino', 'Cappuccino', 3.9),
        item('Filterkoffie', 'Filter coffee', 3.8, ('Wisselende bonen.', 'Rotating beans.'))]},
    {'id': 'brunch', 'title': L('Brunch', 'Brunch'), 'items': [
        item('Shakshuka', 'Shakshuka', 13.5, ('Twee eieren, tomaat, paprika, zuurdesem.', 'Two eggs, tomato, pepper, sourdough.'), tags=['vegetarian'], featured=True),
        item('Zuurdesem met avocado', 'Sourdough with avocado', 11.0, ('Limoen, chili, dukkah.', 'Lime, chilli, dukkah.'), tags=['vegan']),
        item('Granola', 'Granola', 8.5, ('Yoghurt, seizoensfruit, honing.', 'Yoghurt, seasonal fruit, honey.'), tags=['vegetarian']),
        item('Pannenkoekjes', 'Pancakes', 10.5, ('Ricotta, bessen, ahornsiroop.', 'Ricotta, berries, maple syrup.'), tags=['vegetarian'])]},
    {'id': 'zoet', 'title': L('Zoet', 'Sweet'), 'items': [item('Bananenbrood', 'Banana bread', 4.0), item('Kaneelbroodje', 'Cinnamon bun', 3.8)]},
], 'allergens_note': L('Vraag ons naar allergenen.', 'Ask us about allergens.')}
c['booking'] = {'provider': 'none'}
c['ordering'] = {'url': 'https://www.example.com/', 'label': L('Bestel om mee te nemen', 'Order to take away')}
c['groups'] = {'enabled': True, 'title': L('Ontbijt voor je team', 'Breakfast for your team'), 'body': L('Voor groepen vanaf tien personen openen we op afspraak eerder.', 'For groups of ten or more we open earlier by appointment.'), 'form': {'method': 'mailto', 'to': 'hallo@example.com'}}
c['media'] = {
    'hero': {'file': 'barista.webp', 'alt': L('Een barista drukt gemalen koffie aan in een portafilter', 'A barista tamping ground coffee into a portafilter'), 'origin': 'stand-in', 'credit': 'Shixart1985, CC BY 2.0 (Wikimedia Commons)', 'source_url': 'https://commons.wikimedia.org/wiki/File:Barista_prepares_espresso_at_coffee_shop.jpg', 'focus': '45% 50%'},
    'story': {'file': 'espresso.webp', 'alt': L('Espresso loopt uit een portafilter in een kopje', 'Espresso running from a portafilter into a cup'), 'origin': 'stand-in', 'credit': 'Takeaway, CC BY-SA 3.0 (Wikimedia Commons)', 'source_url': 'https://commons.wikimedia.org/wiki/File:Double_ristretto_naked_portafilter.jpg'},
}
c['seo'] = {'title': L('Morgenrood · voorbeeld van Amuse Studio', 'Morgenrood · Amuse Studio example'), 'description': L('Een fictieve koffiebar in Rotterdam, gemaakt door Amuse Studio om te laten zien hoe een site van ons eruitziet.', 'A fictional coffee bar in Rotterdam, made by Amuse Studio to show what one of our sites looks like.')}
shows.append((c, [('m187311853-1200.webp', 'barista.webp'), ('m28989985-1200.webp', 'espresso.webp')]))

# 3. Dining
c = base('showcase-diner', 'dining', 'Getij', 'restaurant', 'Restaurant', 'Voorbeeldhaven 21', {'lat': 51.9089, 'lng': 4.4867})
c['business'].update({
    'cuisine': ['Seizoensgebonden', 'Vis'], 'price_range': '€€€',
    'kicker': L('Restaurant aan het water', 'Restaurant by the water'),
    'tagline': L('Vis van de afslag, groente van het seizoen, een kaart die meebeweegt.', 'Fish from the auction, vegetables in season, a menu that moves with them.'),
    'intro': L('Een fictief restaurant, gemaakt om te laten zien hoe een site van ons eruitziet.', 'A fictional restaurant, made to show what one of our sites looks like.'),
    'story': {'title': L('De kaart volgt het getij', 'The menu follows the tide'), 'body': L(
        'Op een echte site staat hier waar de chef zijn vis haalt en hoe de kaart elke week verandert.\n\nWe houden het kort: gasten willen vooral weten wat er vanavond op tafel komt en hoe ze reserveren.',
        'On a real site this is where the chef buys the fish and how the menu changes every week.\n\nWe keep it short: guests mostly want to know what is on tonight and how to book.')},
})
c['hours'] = {'timezone': 'Europe/Amsterdam', 'regular': [{'days': ['we', 'th', 'fr', 'sa', 'su'], 'opens': '17:30', 'closes': '23:00'}], 'note': L('Maandag en dinsdag gesloten. Keuken tot 21:30.', 'Closed Monday and Tuesday. Kitchen until 21:30.')}
c['menu'] = {'title': L('Deze week', 'This week'), 'intro': L('Vier of zes gangen, of à la carte.', 'Four or six courses, or à la carte.'), 'currency': 'EUR', 'sections': [
    {'id': 'menu', 'title': L('Menu', 'Set menu'), 'items': [item('Vier gangen', 'Four courses', 62.0, featured=True), item('Zes gangen', 'Six courses', 82.0), item('Wijnarrangement, vier glazen', 'Wine pairing, four glasses', 38.0)]},
    {'id': 'voor', 'title': L('Voorgerechten', 'Starters'), 'items': [
        item('Gerookte paling', 'Smoked eel', 17.0, ('Biet, mierikswortel, rogge.', 'Beetroot, horseradish, rye.')),
        item('Pompoen', 'Pumpkin', 14.0, ('Hazelnoot, salie, bruine boter.', 'Hazelnut, sage, brown butter.'), tags=['vegetarian'])]},
    {'id': 'hoofd', 'title': L('Hoofdgerechten', 'Mains'), 'items': [
        item('Tarbot', 'Turbot', 34.0, ('Mosselen, venkel, beurre blanc.', 'Mussels, fennel, beurre blanc.')),
        item('Hertenbiefstuk', 'Venison steak', 32.0, ('Knolselderij, cranberry, jus.', 'Celeriac, cranberry, jus.')),
        item('Paddenstoelen', 'Mushrooms', 26.0, ('Polenta, truffel, Parmezaan.', 'Polenta, truffle, Parmesan.'), tags=['vegetarian'])]},
    {'id': 'dessert', 'title': L('Desserts', 'Desserts'), 'items': [item('Peer', 'Pear', 12.0, ('Karamel, vanille, amandel.', 'Caramel, vanilla, almond.')), item('Kaas', 'Cheese', 15.0, ('Drie Nederlandse kazen.', 'Three Dutch cheeses.'))]},
], 'allergens_note': L('Laat bij het reserveren weten wat je niet eet.', 'Tell us what you don’t eat when you book.')}
c['booking'] = {'provider': 'other', 'url': 'https://www.example.com/reserveren', 'label': L('Reserveer een tafel', 'Book a table'), 'note': L('Via je eigen reserveringssysteem, of per telefoon.', 'Through your own booking system, or by phone.')}
c['links'] = {'gift_cards': 'https://www.example.com/cadeaukaart'}
c['groups'] = {'enabled': True, 'title': L('Privé dineren', 'Private dining'), 'body': L('De bovenzaal biedt plaats aan veertien gasten.', 'The upstairs room seats fourteen.'), 'min_size': 8, 'max_size': 14, 'form': {'method': 'mailto', 'to': 'hallo@example.com'}}
c['seo'] = {'title': L('Getij · voorbeeld van Amuse Studio', 'Getij · Amuse Studio example'), 'description': L('Een fictief restaurant in Rotterdam, gemaakt door Amuse Studio om te laten zien hoe een site van ons eruitziet.', 'A fictional restaurant in Rotterdam, made by Amuse Studio to show what one of our sites looks like.')}
shows.append((c, []))

# 4. Street food
c = base('showcase-streetfood', 'street-food', 'Vlam', 'eethuis', 'FastFoodRestaurant', 'Voorbeeldplein 7', {'lat': 51.9244, 'lng': 4.4777})
c['business'].update({
    'cuisine': ['Streetfood'], 'price_range': '€',
    'kicker': L('Streetfood uit de wok', 'Street food from the wok'),
    'tagline': L('Uit de wok in vier minuten. Hier eten of meenemen.', 'Out of the wok in four minutes. Eat in or take away.'),
    'intro': L('Een fictief eethuis, gemaakt om te laten zien hoe een site van ons eruitziet.', 'A fictional eatery, made to show what one of our sites looks like.'),
    'facts': [{'value': '4 min', 'label': L('van wok tot bakje', 'from wok to box')}, {'value': '9', 'label': L('vegetarische gerechten', 'vegetarian dishes')}],
})
c['hours'] = {'timezone': 'Europe/Amsterdam', 'regular': [{'days': ['tu', 'we', 'th', 'su'], 'opens': '12:00', 'closes': '22:00'}, {'days': ['fr', 'sa'], 'opens': '12:00', 'closes': '23:30'}], 'note': L('Maandag gesloten.', 'Closed on Mondays.')}
def num(n, nl, en, price, desc=None, tags=None, featured=False):
    i = item(nl, en, price, desc, f'#{n}', tags, featured)
    return i
c['menu'] = {'title': L('Het menu', 'The menu'), 'intro': L('Zoek op naam of nummer.', 'Search by name or number.'), 'currency': 'EUR', 'searchable': True, 'sections': [
    {'id': 'wok', 'title': L('Uit de wok', 'From the wok'), 'items': [
        num(1, 'Bami kip', 'Bami with chicken', 12.5, featured=True), num(2, 'Nasi rund', 'Nasi with beef', 13.5),
        num(3, 'Pad thai garnaal', 'Pad thai with prawns', 14.5, tags=['spicy']), num(4, 'Tofu teriyaki', 'Tofu teriyaki', 12.0, tags=['vegetarian']),
        num(5, 'Kip zwarte peper', 'Black pepper chicken', 13.0, tags=['spicy'])]},
    {'id': 'bowls', 'title': L('Bowls', 'Bowls'), 'items': [
        num(6, 'Bowl krokante kip', 'Crispy chicken bowl', 12.5), num(7, 'Bowl zalm', 'Salmon bowl', 14.0), num(8, 'Bowl groente', 'Vegetable bowl', 11.0, tags=['vegan'])]},
    {'id': 'sides', 'title': L('Erbij', 'Sides'), 'items': [
        num(9, 'Loempia (2)', 'Spring rolls (2)', 4.5, tags=['vegetarian']), num(10, 'Gyoza (6)', 'Gyoza (6)', 6.0), num(11, 'Edamame', 'Edamame', 4.0, tags=['vegan'])]},
    {'id': 'drinks', 'title': L('Drinken', 'Drinks'), 'items': [num(12, 'IJsthee', 'Iced tea', 3.5), num(13, 'Fris', 'Soft drink', 3.0), num(14, 'Bier', 'Beer', 4.0)]},
], 'allergens_note': L('Vraag ons naar allergenen.', 'Ask us about allergens.')}
c['booking'] = {'provider': 'phone', 'label': L('Bel om te bestellen', 'Call to order')}
c['ordering'] = {'url': 'https://www.example.com/bestellen', 'label': L('Bestel online', 'Order online')}
c['seo'] = {'title': L('Vlam · voorbeeld van Amuse Studio', 'Vlam · Amuse Studio example'), 'description': L('Een fictief streetfood-eethuis in Rotterdam, gemaakt door Amuse Studio om te laten zien hoe een site van ons eruitziet.', 'A fictional street food eatery in Rotterdam, made by Amuse Studio to show what one of our sites looks like.')}
shows.append((c, []))

for content, photos in shows:
    d = os.path.join(CLIENTS, content['slug'])
    os.makedirs(os.path.join(d, 'photos'), exist_ok=True)
    for src, dst in photos:
        shutil.copyfile(os.path.join(KIT, src), os.path.join(d, 'photos', dst))
    json.dump(content, open(os.path.join(d, 'content.json'), 'w'), ensure_ascii=False, indent=2)
    print('wrote', content['slug'])
