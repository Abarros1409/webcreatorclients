import { defineConfig } from 'astro/config';

// scripts/build.mjs sets these per client.
export default defineConfig({
  base: process.env.SITE_BASE || '/',
  site: process.env.SITE_URL || undefined,
  outDir: process.env.SITE_OUT || './dist',
  trailingSlash: 'ignore',
  compressHTML: true,
  devToolbar: { enabled: false },
  build: { format: 'directory', inlineStylesheets: 'always', assets: '_assets' },
  image: { responsiveStyles: false },
});
