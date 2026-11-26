import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://amusestudio.nl',
  trailingSlash: 'ignore',
  compressHTML: true,
  devToolbar: { enabled: false },
  build: { format: 'directory', inlineStylesheets: 'always', assets: '_assets' },
});
