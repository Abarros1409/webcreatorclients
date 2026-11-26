import { t } from './i18n.js';

export function telHref(c) {
  return c.contact.phone ? `tel:${c.contact.phone}` : null;
}

export function waHref(number, text = '') {
  if (!number) return null;
  const n = number.replace(/[^0-9]/g, '');
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** The one action that matters most for this business, in priority order. */
export function primaryAction(c, ui, lang) {
  const bk = c.booking;
  if (bk && bk.url && !['none', 'phone', 'whatsapp'].includes(bk.provider)) {
    return { kind: 'book', label: bk.label ? t(bk.label, lang) : ui.bookTable, short: ui.book, href: bk.url, external: true, icon: 'calendar' };
  }
  if (c.ordering?.url) {
    return { kind: 'order', label: c.ordering.label ? t(c.ordering.label, lang) : ui.order, short: ui.order, href: c.ordering.url, external: true, icon: 'bag' };
  }
  if (bk?.provider === 'whatsapp' && c.contact.whatsapp) {
    return { kind: 'book', label: ui.bookTable, short: ui.book, href: waHref(c.contact.whatsapp), external: true, icon: 'whatsapp' };
  }
  if (c.contact.phone && bk?.provider !== 'none') {
    const label = bk?.label ? t(bk.label, lang) : bk?.provider === 'phone' ? ui.bookTable : ui.callUs;
    return { kind: 'call', label, short: ui.call, href: telHref(c), external: false, icon: 'phone' };
  }
  return null;
}
