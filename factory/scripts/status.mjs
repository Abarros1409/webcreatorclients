#!/usr/bin/env node
// Pipeline stages per client (clients/<slug>/status.json) and a board view.
//   npm run status                              board of all clients
//   npm run status -- <slug> --stage visited --note "Owner Ward, back Thursday"
// Factory stages: audited → picked → collected → generated → qa-passed → published → pitch-ready
// Sales stages (from the plan): visited → follow-up → meeting → won | lost | parked
import fs from 'node:fs';
import path from 'node:path';
import { args, CLIENTS, clientDir, fail, readJson, today, writeJson } from './lib/util.mjs';

export const STAGES = ['audited', 'picked', 'collected', 'generated', 'qa-passed', 'published', 'pitch-ready', 'visited', 'follow-up', 'meeting', 'won', 'lost', 'parked', 'live'];

export function setStage(slug, stage, extra = {}) {
  if (!STAGES.includes(stage)) throw new Error(`unknown stage ${stage}`);
  const file = path.join(clientDir(slug), 'status.json');
  const s = readJson(file, { slug, history: [] });
  s.stage = stage;
  Object.assign(s, extra);
  s.history.push({ stage, on: today(), ...(extra.note ? { note: extra.note } : {}) });
  writeJson(file, s);
  return s;
}

function board() {
  if (!fs.existsSync(CLIENTS)) return console.log('no clients yet');
  const rows = fs.readdirSync(CLIENTS)
    .filter((d) => !d.startsWith('_') && fs.existsSync(path.join(CLIENTS, d, 'status.json')))
    .map((d) => readJson(path.join(CLIENTS, d, 'status.json')))
    .sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage));
  console.log('stage        client                         since       note');
  for (const r of rows) {
    const last = r.history.at(-1);
    console.log(`${r.stage.padEnd(12)} ${r.slug.padEnd(30)} ${last.on}  ${last.note ?? ''}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = args();
  if (!a._[0]) board();
  else {
    if (!a.stage) fail('usage: npm run status -- <slug> --stage <stage> [--note "…"]');
    const s = setStage(a._[0], a.stage, a.note ? { note: a.note } : {});
    console.log(`✓ ${s.slug} → ${s.stage}`);
  }
}
