#!/usr/bin/env node
// Check a client's content.json against the schema and the factory's content rules.
//   npm run validate -- <slug>
import { args, fail } from './lib/util.mjs';
import { validateClient } from './lib/validate.mjs';

const slug = args()._[0];
if (!slug) fail('usage: npm run validate -- <slug>');
const { errors, warnings } = validateClient(slug);
warnings.forEach((w) => console.log(`  ! ${w}`));
errors.forEach((e) => console.log(`  ✗ ${e}`));
console.log(errors.length ? `\n✗ ${errors.length} error(s)` : '\n✓ content.json is valid');
process.exit(errors.length ? 1 : 0);
