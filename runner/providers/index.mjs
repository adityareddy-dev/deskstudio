// Which providers this machine can reach, and one call shape for all of them.
import * as anthropic from './anthropic.mjs';
import * as openai from './openai.mjs';
import * as google from './google.mjs';
import { resolveModel, estimateCost, loadModels, normalizeUsage } from '../models.mjs';
import { probeCli } from './exec.mjs';

export const PROVIDERS = { anthropic, openai, google };

let detected = null;

// { anthropic: { cli: { found, works, path, version, signedIn, account, error }, key, via: 'cli'|'api'|null }, ... , extra: { copilot } }
export function detect({ fresh = false } = {}) {
  if (detected && !fresh) return detected;
  const out = {};
  for (const [name, mod] of Object.entries(PROVIDERS)) {
    try { out[name] = mod.detect(); }
    catch (e) { out[name] = { cli: { found: false, works: false, error: e.message }, key: null, via: null }; }
  }
  // Seen but not wired yet. Their adapters come with 1.1.
  out.extra = { copilot: probeCli('copilot') };
  detected = out;
  return out;
}

export function explainUnreachable(name, d) {
  const p = loadModels().providers[name];
  const parts = [];
  if (!d?.cli?.found) parts.push(`the ${p.cli} CLI is not on PATH`);
  else if (!d.cli.works) parts.push(d.cli.error);
  else if (!d.cli.signedIn) parts.push(`${p.cli} is not signed in (run \`${p.login || `${p.cli} ${name === 'anthropic' ? 'auth login' : 'login'}`}\`)`);
  parts.push(`${p.keyEnv.join(' or ')} is not set`);
  return `Cannot reach ${p.label}: ${parts.join(', and ')}.`;
}

// One call. spec is "provider/model". Returns { text, usage, costUsd, provider, model, via }.
export async function runModel({ spec, system, prompt, images = [], cwd, timeoutMs = 15 * 60 * 1000 }) {
  const model = resolveModel(spec);
  const mod = PROVIDERS[model.provider];
  const d = detect()[model.provider];
  if (!d?.via) throw new Error(explainUnreachable(model.provider, d));
  const sendImages = model.vision === false ? [] : images;
  const result = d.via === 'cli'
    ? await mod.runCli({ model, system, prompt, images: sendImages, cwd, timeoutMs })
    : await mod.runApi({ model, system, prompt, images: sendImages, cwd, timeoutMs });
  result.usage = normalizeUsage(result.usage);
  if (result.costUsd == null && result.usage) result.costUsd = estimateCost(model, result.usage);
  result.spec = model.spec;
  result.modelId = model.id;
  result.sawImages = sendImages.length > 0 || images.length === 0;
  return result;
}
