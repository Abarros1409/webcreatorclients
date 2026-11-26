// Client photos live in src/client/photos (synced from clients/<slug>/photos by scripts/build.mjs).
const raster = import.meta.glob('../client/photos/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}', { eager: true });
const vector = import.meta.glob('../client/photos/*.svg', { eager: true, query: '?url', import: 'default' });

export function photo(file) {
  if (!file) return null;
  const key = Object.keys(raster).find((p) => p.endsWith('/' + file));
  return key ? raster[key].default : null;
}

export function svgUrl(file) {
  if (!file) return null;
  const key = Object.keys(vector).find((p) => p.endsWith('/' + file));
  return key ? vector[key] : null;
}

export function isSvg(file) {
  return typeof file === 'string' && file.toLowerCase().endsWith('.svg');
}
