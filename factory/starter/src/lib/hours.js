import { DAY_KEYS, UI } from './i18n.js';

const SCHEMA_DAYS = { mo: 'Monday', tu: 'Tuesday', we: 'Wednesday', th: 'Thursday', fr: 'Friday', sa: 'Saturday', su: 'Sunday' };

/** Blocks per day: { mo: [{opens, closes, label}], ... } */
export function byDay(hours) {
  const out = Object.fromEntries(DAY_KEYS.map((d) => [d, []]));
  for (const block of hours?.regular ?? []) {
    for (const d of block.days) out[d].push({ opens: block.opens, closes: block.closes, label: block.label });
  }
  for (const d of DAY_KEYS) out[d].sort((a, b) => a.opens.localeCompare(b.opens));
  return out;
}

function sig(blocks) {
  return blocks.map((b) => `${b.opens}-${b.closes}-${b.label?.nl ?? ''}`).join('|') || 'closed';
}

/** Consecutive days with identical hours merged into rows for display. */
export function rows(hours, lang) {
  const days = byDay(hours);
  const ui = UI[lang];
  const result = [];
  let i = 0;
  while (i < DAY_KEYS.length) {
    const start = DAY_KEYS[i];
    const s = sig(days[start]);
    let j = i;
    while (j + 1 < DAY_KEYS.length && sig(days[DAY_KEYS[j + 1]]) === s) j++;
    const end = DAY_KEYS[j];
    const label = start === end ? ui.days[start] : `${ui.days[start]} – ${ui.days[end]}`;
    result.push({
      days: DAY_KEYS.slice(i, j + 1),
      label: label.charAt(0).toUpperCase() + label.slice(1),
      blocks: days[start],
      closed: days[start].length === 0,
    });
    i = j + 1;
  }
  return result;
}

/** schema.org openingHoursSpecification */
export function schemaHours(hours) {
  return (hours?.regular ?? []).map((b) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: b.days.map((d) => SCHEMA_DAYS[d]),
    opens: b.opens,
    closes: b.closes,
  }));
}

/** Compact data for the client-side "open now" badge. */
export function clientHours(hours) {
  return {
    days: byDay(hours),
    special: (hours?.special ?? []).map((s) => ({ date: s.date, closed: !!s.closed, opens: s.opens, closes: s.closes })),
  };
}
