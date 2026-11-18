// The brand logo in runner mode. Builders here have no file access, so they cannot inline the logo the brand
// names. They write src="desk:logo" and the runner puts the file in as a data URI after they return, the same
// way it handles the brand font. The data URI never reaches a prompt.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { parseFrontMatter } from '../proof/brand.mjs';

export const LOGO_TOKEN = 'desk:logo';
const TYPES = { '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
const MAX_BYTES = 1024 * 1024;

// { path, mime, uri, width, height } for a logo the runner can inline, { path, missing } for one it cannot,
// null when the brand names no logo.
export function loadBrandLogo(projectDir, brandText) {
  const rel = parseFrontMatter(brandText)?.logo?.path;
  if (!rel || typeof rel !== 'string') return null;
  const file = isAbsolute(rel) ? rel : resolve(projectDir, rel);
  const inside = relative(resolve(projectDir), file);
  if (inside.startsWith('..') || isAbsolute(inside)) return { path: rel, missing: 'it is outside the project' };
  if (!existsSync(file)) return { path: rel, missing: 'the file is not in the project' };
  const mime = TYPES[extname(file).toLowerCase()];
  if (!mime) return { path: rel, missing: `the runner inlines ${Object.keys(TYPES).join(', ')} files only` };
  const size = statSync(file).size;
  if (size > MAX_BYTES) return { path: rel, missing: `it is ${Math.round(size / 1024)} KB, over the 1 MB one self-contained file can carry` };
  const bytes = readFileSync(file);
  const png = mime === 'image/png' && bytes.length > 24;
  return { path: rel, mime, uri: `data:${mime};base64,${bytes.toString('base64')}`, width: png ? bytes.readUInt32BE(16) : null, height: png ? bytes.readUInt32BE(20) : null };
}

// Every desk:logo in the file becomes the data URI. Idempotent.
export function injectLogo(html, logo) {
  return logo?.uri ? html.split(LOGO_TOKEN).join(logo.uri) : html;
}

// The data URI back to desk:logo, so a builder prompt stays small.
export function stripLogo(html, logo) {
  return logo?.uri ? html.split(logo.uri).join(LOGO_TOKEN) : html;
}
