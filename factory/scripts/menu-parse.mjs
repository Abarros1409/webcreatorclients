#!/usr/bin/env node
// Generate helper: turns menu text (from collected/pages/*.txt or collected/pdf/*.txt) into
// structured sections + items with prices. Names stay in the source language; Generate
// (Claude) translates, groups and writes descriptions afterwards.
//   npm run menu -- <slug> <file-in-collected> [--from "Ons menu"] [--to "Eet smakelijk"]
// Output: clients/<slug>/collected/menu.parsed.json
import fs from 'node:fs';
import path from 'node:path';
import { args, clientDir, fail, rel, slugify, writeJson } from './lib/util.mjs';

const PRICE = /(?:€\s*)?(\d{1,3})[,.](\d{2})(?:\s*(?:€|eur))?/i;
const PRICE_ONLY = /^(?:vanaf\s+)?€?\s*\d{1,3}[,.]\d{2}\s*$/i;

export function parseMenu(text, { from, to } = {}) {
  let lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  if (from) { const i = lines.findIndex((l) => l.toLowerCase().includes(from.toLowerCase())); if (i >= 0) lines = lines.slice(i + 1); }
  if (to) { const i = lines.findIndex((l) => l.toLowerCase().includes(to.toLowerCase())); if (i >= 0) lines = lines.slice(0, i); }
  const sections = [];
  let current = null;
  const notes = [];
  const push = (title) => { current = { id: slugify(title) || `section-${sections.length + 1}`, title, items: [], notes: [] }; sections.push(current); };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const next = lines[i + 1] ?? '';
    // "12. Name" followed by a price line, or "Name ..... 9,50" on one line.
    const numbered = line.match(/^(\d{1,3})[.)]\s+(.+)$/);
    const inline = line.match(/^(.*?\S)\s*(?:\.{2,}|\s{2,}|\s-\s|\s)\s*(?:vanaf\s+)?€?\s*(\d{1,3}[,.]\d{2})\s*$/i);
    if ((numbered || /[a-z]/i.test(line)) && PRICE_ONLY.test(next) && !PRICE_ONLY.test(line)) {
      if (!current) push('Menu');
      const m = next.match(PRICE);
      current.items.push({ number: numbered ? Number(numbered[1]) : undefined, name: (numbered ? numbered[2] : line).replace(/\s+vanaf$/i, ''), price: Number(`${m[1]}.${m[2]}`), from_price: /vanaf/i.test(line + next) || undefined });
      i++;
      continue;
    }
    if (inline && !numbered?.[2]?.match(PRICE_ONLY)) {
      if (!current) push('Menu');
      const name = inline[1].replace(/^(\d{1,3})[.)]\s+/, '');
      const num = inline[1].match(/^(\d{1,3})[.)]\s+/)?.[1];
      current.items.push({ number: num ? Number(num) : undefined, name, price: Number(inline[2].replace(',', '.')) });
      continue;
    }
    if (PRICE.test(line) && current) { current.notes.push(line); notes.push(line); continue; }
    // A short line without a price, followed by an item, is a section title.
    if (line.length <= 48 && !/[.!?]$/.test(line)) push(line);
    else if (current) current.notes.push(line);
  }
  return { sections: sections.filter((s) => s.items.length), notes };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = args();
  const [slug, file] = a._;
  if (!slug || !file) fail('usage: npm run menu -- <slug> <file under collected/> [--from "…"] [--to "…"]');
  const src = path.join(clientDir(slug), 'collected', file);
  if (!fs.existsSync(src)) fail(`not found: ${rel(src)}`);
  const parsed = parseMenu(fs.readFileSync(src, 'utf8'), { from: a.from, to: a.to });
  const out = path.join(clientDir(slug), 'collected', 'menu.parsed.json');
  writeJson(out, parsed);
  const n = parsed.sections.reduce((s, x) => s + x.items.length, 0);
  console.log(`✓ ${rel(out)}: ${parsed.sections.length} sections, ${n} items`);
  parsed.sections.forEach((s) => console.log(`  ${s.title} (${s.items.length})${s.notes.length ? ` · notes: ${s.notes.join(' | ')}` : ''}`));
}
