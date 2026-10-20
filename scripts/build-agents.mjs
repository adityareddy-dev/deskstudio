#!/usr/bin/env node
// Writes agents/<slug>.md for every desk in skills/desk/desks.json that has an agent.
// The role brief in skills/desk/roles/<slug>.md stays the source of the desk's knowledge;
// the agent file is the three-line description Claude keeps in context, plus the model, tools and turn cap.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(readFileSync(join(root, 'skills', 'desk', 'desks.json'), 'utf8'));
mkdirSync(join(root, 'agents'), { recursive: true });

let written = 0;
for (const desk of registry.desks) {
  if (desk.agent === false) continue;
  const tier = registry.tiers[desk.tier];
  const model = tier.default === 'inherit' ? 'inherit' : tier.default.split('/')[1];
  const role = join(root, 'skills', 'desk', 'roles', `${desk.slug}.md`);
  if (!existsSync(role)) { console.error(`no role brief for ${desk.slug}`); process.exitCode = 1; continue; }
  const extras = desk.tier === 'director'
    ? `Open every screenshot you are given with Read and judge from the screen, never from HTML or CSS. `
    : desk.tools.includes('Bash')
      ? `You own only the files the Manager names. Run proof on your file before you return when your brief says to. `
      : `You write nothing but your return, in the shape your brief defines. `;
  const body = `---
name: ${desk.slug}
description: Desk Studio's ${desk.name}. ${desk.description}
model: ${model}
color: ${tier.color}
tools: ${desk.tools.join(', ')}
maxTurns: ${desk.maxTurns}
---

You are the ${desk.name} at Desk Studio, a ${desk.tier} desk. Read \`\${CLAUDE_PLUGIN_ROOT}/skills/desk/roles/${desk.slug}.md\` first and work exactly to it. Then read \`\${CLAUDE_PLUGIN_ROOT}/skills/desk/house-style.md\`${desk.tier === 'director' ? ' and `${CLAUDE_PLUGIN_ROOT}/skills/desk/rubric.md`' : ''}, and the standard the Manager names.

You own: ${desk.owns}. ${extras}Return only the shape your brief defines, nothing before or after it. Never put prompt text in file names or events.
`;
  writeFileSync(join(root, 'agents', `${desk.slug}.md`), body);
  written++;
}
// docs/roles.md: the org chart, generated from the same registry.
const byTier = {};
for (const d of registry.desks) (byTier[d.tier] ??= []).push(d);
const order = ['manager', 'director', 'senior', 'builder'];
const lines = ['# The desks', '', 'Every desk, by tier, with what it owns. Each desk has a brief in `skills/desk/roles/<slug>.md` and, except the Manager, an agent in `agents/<slug>.md`. Models per tier come from `.desk/project.json`. The defaults are below.', ''];
for (const tier of order) {
  const t = registry.tiers[tier];
  lines.push(`## ${tier} (${t.default})`, '', '| Desk | Owns | Tools |', '| --- | --- | --- |');
  for (const d of byTier[tier] || []) lines.push(`| ${d.name} (\`${d.slug}\`) | ${d.owns} | ${(d.tools || ['main session']).join(', ')} |`);
  lines.push('');
}
mkdirSync(join(root, 'docs'), { recursive: true });
writeFileSync(join(root, 'docs', 'roles.md'), lines.join('\n'));
console.log(`wrote ${written} agents and docs/roles.md (${registry.desks.length} desks)`);
