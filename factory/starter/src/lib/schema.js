import { t } from './i18n.js';
import { schemaHours } from './hours.js';

/**
 * schema.org JSON-LD for the business. Deliberately no aggregateRating:
 * Google treats ratings a business publishes about itself as self-serving.
 */
export function businessJsonLd(c, lang, { url, image } = {}) {
  const b = c.business;
  const a = c.contact.address;
  const data = {
    '@context': 'https://schema.org',
    '@type': b.schema_type,
    name: b.name,
    description: t(c.seo.description, lang),
    address: {
      '@type': 'PostalAddress',
      streetAddress: a.street,
      postalCode: a.postal_code,
      addressLocality: a.city,
      addressCountry: a.country ?? 'NL',
    },
    openingHoursSpecification: schemaHours(c.hours),
  };
  if (url) data.url = url;
  if (image) data.image = image;
  if (c.contact.phone) data.telephone = c.contact.phone;
  if (c.contact.email) data.email = c.contact.email;
  if (c.contact.geo) data.geo = { '@type': 'GeoCoordinates', latitude: c.contact.geo.lat, longitude: c.contact.geo.lng };
  if (b.cuisine?.length) data.servesCuisine = b.cuisine;
  if (b.price_range) data.priceRange = b.price_range;
  if (c.booking?.url && !['none', 'phone', 'whatsapp'].includes(c.booking.provider)) data.acceptsReservations = c.booking.url;
  else if (c.booking && c.booking.provider !== 'none') data.acceptsReservations = true;
  const sameAs = ['instagram', 'facebook', 'tiktok', 'untappd'].map((k) => c.links?.[k]).filter(Boolean);
  if (sameAs.length) data.sameAs = sameAs;
  if (c.menu?.sections?.length) {
    data.hasMenu = {
      '@type': 'Menu',
      inLanguage: lang,
      hasMenuSection: c.menu.sections.map((s) => ({
        '@type': 'MenuSection',
        name: t(s.title, lang),
        hasMenuItem: s.items.slice(0, 60).map((i) => {
          const item = { '@type': 'MenuItem', name: t(i.name, lang) };
          if (i.description) item.description = t(i.description, lang);
          if (typeof i.price === 'number') item.offers = { '@type': 'Offer', price: i.price.toFixed(2), priceCurrency: 'EUR' };
          return item;
        }),
      })),
    };
  }
  return data;
}
