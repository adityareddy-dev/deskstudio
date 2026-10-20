// Model specs: "provider/alias" or "provider/full-id" to a provider, an id and a price.
// Tiers and desks come from skills/desk/desks.json, the one registry the floor and the agents share.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(here);
let cache = null;
let desks = null;

export function loadModels() {
  if (!cache) cache = JSON.parse(readFileSync(join(here, 'models.json'), 'utf8'));
  return cache;
}

// { tiers: { director: { default, color }, ... }, desks: [ { slug, name, tier, ... } ] }
export function loadDesks() {
  if (desks) return desks;
  const file = join(ROOT, 'skills', 'desk', 'desks.json');
  desks = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { tiers: {}, desks: [] };
  return desks;
}

export function deskInfo(slug) {
  return loadDesks().desks.find(d => d.slug === slug) || null;
}

export function deskName(slug) {
  return deskInfo(slug)?.name || String(slug).split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

export function providerNames() {
  return Object.keys(loadModels().providers);
}

export const TIERS = ['director', 'senior', 'builder'];

// The default seat per tier from desks.json, with the Manager skill's defaults behind it.
export function tierDefaults() {
  const t = loadDesks().tiers || {};
  return {
    director: t.director?.default || 'anthropic/opus',
    senior: t.senior?.default || 'anthropic/sonnet',
    builder: t.builder?.default || 'anthropic/haiku',
  };
}

// The presets from skills/desk/SKILL.md. studio is the registry's defaults, the runner mixes providers through --models or project.json.
export const PRESETS = {
  studio:  tierDefaults(),
  best:    { director: 'anthropic/fable',  senior: 'anthropic/opus',   builder: 'anthropic/sonnet' },
  thrifty: { director: 'anthropic/sonnet', senior: 'anthropic/haiku',  builder: 'anthropic/haiku' },
};

// "anthropic/opus" -> { spec, provider, alias, id, cli, input, output, cacheRead, cacheWrite, vision }
export function resolveModel(spec) {
  if (!spec || typeof spec !== 'string' || !spec.includes('/')) {
    throw new Error(`Model "${spec}" needs the form provider/model, for example anthropic/opus or google/flash.`);
  }
  const slash = spec.indexOf('/');
  const provider = spec.slice(0, slash).trim().toLowerCase();
  const name = spec.slice(slash + 1).trim();
  const p = loadModels().providers[provider];
  if (!p) throw new Error(`Unknown provider "${provider}". Known: ${providerNames().join(', ')}.`);
  const known = p.models[name];
  if (known) return { spec: `${provider}/${name}`, provider, alias: name, ...known };
  // A full model id the table does not list. Allowed, priced as unknown.
  const byId = Object.entries(p.models).find(([, m]) => m.id === name || m.cli === name);
  if (byId) return { spec: `${provider}/${byId[0]}`, provider, alias: byId[0], ...byId[1] };
  return { spec, provider, alias: null, id: name, cli: name, input: null, output: null, vision: true };
}

// Provider defaults per tier, as specs.
export function providerDefaults(provider) {
  const p = loadModels().providers[provider];
  if (!p) throw new Error(`Unknown provider "${provider}".`);
  const out = {};
  for (const tier of TIERS) out[tier] = `${provider}/${p.tiers[tier]}`;
  return out;
}

// Token counts in one shape: { input, output, cacheRead, cacheWrite, total }. input excludes the cached parts.
export function normalizeUsage(u) {
  if (!u) return null;
  const n = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const input = n(u.input ?? u.inputTokens), output = n(u.output ?? u.outputTokens);
  const cacheRead = n(u.cacheRead), cacheWrite = n(u.cacheWrite);
  return { input, output, cacheRead, cacheWrite, total: input + output + cacheRead + cacheWrite };
}

// Dollars from token counts and the list price, or null when the price is unknown.
export function estimateCost(model, usage) {
  if (!model || model.input == null || model.output == null || !usage) return null;
  const u = normalizeUsage(usage);
  const cacheRead = model.cacheRead ?? model.input;
  const cacheWrite = model.cacheWrite ?? model.input;
  return (u.input * model.input + u.output * model.output + u.cacheRead * cacheRead + u.cacheWrite * cacheWrite) / 1e6;
}

// --models director=anthropic/opus,builder=google/flash -> { director: ..., builder: ... }
export function parseModelsFlag(text) {
  const out = {};
  if (!text) return out;
  for (const part of String(text).split(',')) {
    const [k, v] = part.split('=').map(s => s && s.trim());
    if (!k || !v) throw new Error(`Bad --models part "${part}". Use tier=provider/model, tiers are director, senior, builder.`);
    if (!TIERS.includes(k)) throw new Error(`Unknown tier "${k}" in --models. Tiers are director, senior, builder.`);
    resolveModel(v);
    out[k] = v;
  }
  return out;
}

// The defaults doctor and init choose from what is on the machine.
// The registry's defaults when their provider is usable, otherwise the strongest provider found for director
// and the cheapest for builder, with senior from the director's provider.
export function chooseDefaults(detected) {
  const usable = providerNames().filter(name => detected[name]?.via);
  if (!usable.length) return { models: null, reason: 'no provider CLI signed in and no API key found' };
  const registry = tierDefaults();
  const registryProvider = registry.director.split('/')[0];
  if (usable.includes(registryProvider)) return { models: registry, reason: `${registryProvider} is signed in` };
  const price = (provider, tier) => resolveModel(providerDefaults(provider)[tier]).output ?? 0;
  const director = usable.slice().sort((a, b) => price(b, 'director') - price(a, 'director'))[0];
  const builder = usable.slice().sort((a, b) => price(a, 'builder') - price(b, 'builder'))[0];
  return {
    models: { director: providerDefaults(director).director, senior: providerDefaults(director).senior, builder: providerDefaults(builder).builder },
    reason: `${director} is the strongest provider found, ${builder} the cheapest`,
  };
}
