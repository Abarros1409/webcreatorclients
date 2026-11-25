#!/usr/bin/env node
// Step 2 — Pick. Ranks audited leads by opportunity = how weak their site is × how good a client they'd be.
// The plan's ideal client: independent, owner-run, 4.4+ with 200+ reviews, in Rotterdam, with an obvious weakness.
//   npm run pick [-- --city Rotterdam] [--top 12]
// Output: clients/_audits/picks.md (for the Monday meeting). Humans decide; this only orders the list.
import fs from 'node:fs';
import path from 'node:path';
import { args, CLIENTS, loadLeads, readJson, rel, today, writeText } from './lib/util.mjs';

export function fit(lead) {
  let s = 0;
  const why = [];
  if (lead.profile === 'independent') { s += 40; why.push('independent'); } else if (lead.profile) why.push(lead.profile);
  if ((lead.rating ?? 0) >= 4.4) { s += 20; why.push(`★${lead.rating}`); } else if ((lead.rating ?? 0) >= 4.0) { s += 10; why.push(`★${lead.rating}`); }
  if ((lead.reviews ?? 0) >= 200) { s += 15; why.push(`${lead.reviews} reviews`); }
  if ((lead.city ?? '').toLowerCase() === 'rotterdam') { s += 15; why.push('walkable'); }
  if (lead.phone) { s += 10; why.push('phone'); }
  return { score: s, why };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = args();
  const dir = path.join(CLIENTS, '_audits');
  const leads = loadLeads().filter((l) => !a.city || l.city?.toLowerCase() === String(a.city).toLowerCase());
  const rows = leads.map((l) => {
    const audit = readJson(path.join(dir, `${l.id}.json`), null);
    const f = fit(l);
    const weakness = audit?.weakness ?? null;
    const priority = weakness == null ? null : Math.round(0.55 * weakness + 0.45 * f.score);
    return { l, audit, f, weakness, priority };
  });
  const audited = rows.filter((r) => r.priority != null).sort((x, y) => y.priority - x.priority);
  const notAudited = rows.filter((r) => r.priority == null && r.l.profile === 'independent').sort((x, y) => fit(y.l).score - fit(x.l).score);
  const top = Number(a.top ?? 12);
  const lines = [
    `# Picks — ${today()}`, '',
    'Priority = 55% site weakness + 45% client fit (independent, rating, reviews, Rotterdam, phone). Skip anything a human knows is wrong.', '',
    '| # | Priority | Business | City | Weakness | Fit | Lead talking point |', '|---:|---:|---|---|---:|---|---|',
    ...audited.slice(0, top).map((r, i) => `| ${i + 1} | ${r.priority} | ${r.l.name} | ${r.l.city} | ${r.weakness} | ${r.f.score} (${r.f.why.join(', ')}) | ${r.audit.talking_points[0]?.say_en ?? ''} |`),
    '', `## Not audited yet (${notAudited.length} independent leads)`, '',
    `Next batch to audit: ${notAudited.slice(0, 10).map((r) => `\`${r.l.id}\``).join(' ')}`, '',
    `Run: \`npm run audit -- ${notAudited.slice(0, 10).map((r) => r.l.id).join(' ')}\``,
  ];
  writeText(path.join(dir, 'picks.md'), lines.join('\n') + '\n');
  audited.slice(0, top).forEach((r, i) => console.log(`${String(i + 1).padStart(2)}. ${String(r.priority).padStart(3)}  ${r.l.name} (${r.l.city}) · weakness ${r.weakness} · fit ${r.f.score}`));
  console.log(`\n✓ ${rel(path.join(dir, 'picks.md'))}`);
}
