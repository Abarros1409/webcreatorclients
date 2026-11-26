import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { FACTORY, clientDir, readJson } from './util.mjs';

let validator;
function getValidator() {
  if (!validator) {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    validator = ajv.compile(readJson(path.join(FACTORY, 'schema', 'content.schema.json')));
  }
  return validator;
}

/** Schema errors (blocking) + content checks (blocking or warnings). */
export function validateClient(slug) {
  const dir = clientDir(slug);
  const file = path.join(dir, 'content.json');
  if (!fs.existsSync(file)) return { errors: [`${file} not found`], warnings: [], content: null };
  const content = readJson(file);
  const errors = [];
  const warnings = [];

  const validate = getValidator();
  if (!validate(content)) {
    for (const e of validate.errors) errors.push(`schema ${e.instancePath || '/'} ${e.message}${e.params?.additionalProperty ? ` (${e.params.additionalProperty})` : ''}`);
  }
  if (content.slug && content.slug !== slug) errors.push(`slug "${content.slug}" does not match folder "${slug}"`);

  // Photos referenced must exist.
  const photos = path.join(dir, 'photos');
  const refs = [];
  const m = content.media ?? {};
  if (m.logo) refs.push(['media.logo', m.logo.file]);
  if (m.hero) refs.push(['media.hero', m.hero.file]);
  if (m.story) refs.push(['media.story', m.story.file]);
  (m.gallery ?? []).forEach((g, i) => refs.push([`media.gallery[${i}]`, g.file]));
  (content.menu?.sections ?? []).forEach((s) => s.items.forEach((it) => it.photo && refs.push([`menu.${s.id}.${typeof it.name === 'string' ? it.name : it.name.en}`, it.photo])));
  for (const [where, f] of refs) if (!fs.existsSync(path.join(photos, f))) errors.push(`${where}: photo "${f}" not found in photos/`);

  // Stand-in photos are fine in a demo, never on a live site.
  const all = [m.hero, m.story, ...(m.gallery ?? [])].filter(Boolean);
  if (content.mode === 'live' && all.some((i) => i.origin === 'stand-in')) errors.push('live site still uses stand-in photos');
  if (content.mode === 'live' && content.hours?.unverified) errors.push('live site has unverified opening hours');
  if (content.mode === 'live' && content.menu?.unverified) errors.push('live site has an unverified menu');
  if (content.mode === 'live' && !content.site?.url) errors.push('live site needs site.url');
  if (content.mode === 'demo' && !content.demo?.token) errors.push('demo needs demo.token (npm run collect creates one)');

  // Useful warnings for a strong demo.
  if (!m.hero) warnings.push('no hero photo: the hero falls back to the typographic layout');
  if ((m.gallery ?? []).length < 3) warnings.push('fewer than 3 gallery photos: gallery section is hidden');
  if (!content.contact?.phone) warnings.push('no phone number: no tap-to-call');
  if (!content.contact?.geo) warnings.push('no geo coordinates: the map embed is hidden');
  if (!content.menu?.sections?.length) warnings.push('no menu: the menu section is hidden');
  if (!content.booking || content.booking.provider === 'none') warnings.push('no booking or ordering action');
  if (content.hours?.unverified) warnings.push('opening hours are unverified (fine for a demo, confirm before launch)');
  if (content.reviews?.highlights?.some((h) => h.verbatim !== true)) errors.push('review highlight without verbatim: true');
  return { errors, warnings, content };
}
