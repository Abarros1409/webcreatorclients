// Localisation helpers. Content fields are { nl, en }; proper names may be plain strings.
export const LANGS = ['nl', 'en'];

export function t(value, lang) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value[lang] ?? value.nl ?? '';
}

export function has(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return Boolean((value.nl && value.nl.trim()) || (value.en && value.en.trim()));
}

export function paragraphs(value, lang) {
  return t(value, lang).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

export function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

export const DAY_KEYS = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'];

export const UI = {
  nl: {
    langName: 'Nederlands',
    switchTo: 'English',
    skip: 'Naar de inhoud',
    nav: { menu: 'Menu', hours: 'Openingstijden', story: 'Verhaal', events: 'Agenda', groups: 'Groepen', gallery: 'Foto’s' },
    book: 'Reserveer',
    bookTable: 'Reserveer een tafel',
    order: 'Bestel online',
    call: 'Bel',
    callUs: 'Bel ons',
    route: 'Route',
    whatsapp: 'WhatsApp',
    viewMenu: 'Bekijk het menu',
    openNow: 'Nu open',
    closedNow: 'Nu gesloten',
    opensAt: 'Open vanaf {time}',
    opensDay: 'Open {day} om {time}',
    closesAt: 'tot {time}',
    today: 'Vandaag',
    closed: 'Gesloten',
    hoursTitle: 'Openingstijden',
    findUs: 'Waar je ons vindt',
    special: 'Afwijkende tijden',
    showMap: 'Toon kaart',
    mapNote: 'De kaart laadt van OpenStreetMap zodra je erop klikt.',
    menuTitle: 'Menu',
    searchMenu: 'Zoek in het menu',
    all: 'Alles',
    noResults: 'Niets gevonden. Probeer een ander woord.',
    results: '{n} resultaten',
    pricesNote: 'Prijzen in euro, inclusief btw.',
    tags: { vegan: 'Vegan', vegetarian: 'Vegetarisch', 'gluten-free': 'Glutenvrij', spicy: 'Pittig', new: 'Nieuw', signature: 'Huisspecialiteit', local: 'Lokaal', seasonal: 'Seizoen', 'alcohol-free': 'Alcoholvrij' },
    storyKicker: 'Ons verhaal',
    galleryTitle: 'Binnenkijken',
    reviewsTitle: 'Wat gasten zeggen',
    ratingLine: '{rating} van 5 · {count} reviews op {source}',
    readReviews: 'Lees de reviews',
    eventsTitle: 'Agenda',
    groupsTitle: 'Met een groep komen',
    form: { name: 'Naam', email: 'E-mail', phone: 'Telefoon', date: 'Datum', guests: 'Aantal personen', message: 'Wat heb je in gedachten?', send: 'Verstuur aanvraag', sent: 'Dank je! We nemen snel contact op.', demo: 'Dit is een concept: het formulier verstuurt nog niets.', viaWhatsapp: 'Verstuur via WhatsApp', viaEmail: 'Verstuur per e-mail' },
    follow: 'Volg ons',
    madeBy: 'Website door {studio}',
    privacy: 'Deze site gebruikt geen tracking-cookies.',
    concept: 'Concept voor {name}', conceptSub: 'Privé-voorbeeld door {studio}. Niet openbaar.',
    days: { mo: 'maandag', tu: 'dinsdag', we: 'woensdag', th: 'donderdag', fr: 'vrijdag', sa: 'zaterdag', su: 'zondag' },
    daysShort: { mo: 'ma', tu: 'di', we: 'wo', th: 'do', fr: 'vr', sa: 'za', su: 'zo' },
    since: 'Sinds {year}',
    giftCards: 'Cadeaukaarten',
    backToTop: 'Terug naar boven',
  },
  en: {
    langName: 'English',
    switchTo: 'Nederlands',
    skip: 'Skip to content',
    nav: { menu: 'Menu', hours: 'Hours', story: 'Story', events: 'Events', groups: 'Groups', gallery: 'Photos' },
    book: 'Book',
    bookTable: 'Book a table',
    order: 'Order online',
    call: 'Call',
    callUs: 'Call us',
    route: 'Directions',
    whatsapp: 'WhatsApp',
    viewMenu: 'See the menu',
    openNow: 'Open now',
    closedNow: 'Closed now',
    opensAt: 'Opens at {time}',
    opensDay: 'Opens {day} at {time}',
    closesAt: 'until {time}',
    today: 'Today',
    closed: 'Closed',
    hoursTitle: 'Opening hours',
    findUs: 'Where to find us',
    special: 'Special hours',
    showMap: 'Show map',
    mapNote: 'The map loads from OpenStreetMap when you click.',
    menuTitle: 'Menu',
    searchMenu: 'Search the menu',
    all: 'All',
    noResults: 'Nothing found. Try another word.',
    results: '{n} results',
    pricesNote: 'Prices in euros, VAT included.',
    tags: { vegan: 'Vegan', vegetarian: 'Vegetarian', 'gluten-free': 'Gluten-free', spicy: 'Spicy', new: 'New', signature: 'House special', local: 'Local', seasonal: 'Seasonal', 'alcohol-free': 'Alcohol-free' },
    storyKicker: 'Our story',
    galleryTitle: 'Take a look inside',
    reviewsTitle: 'What guests say',
    ratingLine: '{rating} out of 5 · {count} reviews on {source}',
    readReviews: 'Read the reviews',
    eventsTitle: 'What’s on',
    groupsTitle: 'Coming with a group',
    form: { name: 'Name', email: 'Email', phone: 'Phone', date: 'Date', guests: 'Number of guests', message: 'What do you have in mind?', send: 'Send request', sent: 'Thank you! We’ll get back to you soon.', demo: 'This is a concept: the form doesn’t send anything yet.', viaWhatsapp: 'Send via WhatsApp', viaEmail: 'Send by email' },
    follow: 'Follow us',
    madeBy: 'Website by {studio}',
    privacy: 'This site uses no tracking cookies.',
    concept: 'Concept for {name}', conceptSub: 'Private preview by {studio}. Not public.',
    days: { mo: 'Monday', tu: 'Tuesday', we: 'Wednesday', th: 'Thursday', fr: 'Friday', sa: 'Saturday', su: 'Sunday' },
    daysShort: { mo: 'Mon', tu: 'Tue', we: 'Wed', th: 'Thu', fr: 'Fri', sa: 'Sat', su: 'Sun' },
    since: 'Since {year}',
    giftCards: 'Gift cards',
    backToTop: 'Back to top',
  },
};

export function formatPrice(price, lang) {
  if (price == null) return '';
  return new Intl.NumberFormat(lang === 'nl' ? 'nl-NL' : 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price);
}
