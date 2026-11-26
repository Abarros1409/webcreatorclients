# Amuse Studio site

The studio's own website (planned for amusestudio.nl): Dutch at `/`, English at `/en/`.

- **Hero:** a phone that shows a real site made by the factory. It starts as a poster image and loads the live example when someone taps it or picks one of the four looks.
- **Examples:** four fictional businesses (`clients/showcase-*`, written by `factory/scripts/showcase-content.py`), one per look, built by the factory into `public/voorbeeld/<look>/` (noindex, labelled as fictional).
- **Copy, prices and contact:** all in `src/i18n.js`. Prices follow strategy plan v0.1; the WhatsApp button appears once `CONTACT.whatsapp` is set.

## Run

```bash
cd ../factory && npm install      # the examples are built with the factory
cd ../studio && npm install
npm run dev                       # builds the examples, then starts the dev server
npm run build                     # -> dist/ (static, deploy anywhere)
node scripts/standalone.mjs       # -> preview/amuse-studio-{nl,en}.html, one file each, for sharing
```

Posters need Playwright with Chromium (preinstalled in cloud sessions).

## Deploy

Static output in `dist/`. On Vercel: a separate project with root directory `studio`, build command `cd ../factory && npm ci && cd ../studio && npm run build`, output `dist`. Point `amusestudio.nl` at it once the domain is registered.

Measured on 26 Nov 2026 (Lighthouse, mobile): performance 97, accessibility 100, best practices 100, SEO 100 in both languages; no axe violations.
