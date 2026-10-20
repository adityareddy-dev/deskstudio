// Reads the front matter of a DESIGN.md. Small on purpose: nested maps, scalars, quoted strings, flat lists.
import { readFileSync } from 'node:fs';

function scalar(raw) {
  const v = raw.trim();
  if (v === '') return null;
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

export function parseFrontMatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return {};
  const lines = m[1].split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#'));
  const root = {};
  const stack = [{ indent: -1, node: root, key: null }];
  for (const line of lines) {
    const indent = line.search(/\S/);
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].node;
    const body = line.trim();
    if (body.startsWith('- ')) {
      const holder = stack[stack.length - 1];
      if (!Array.isArray(holder.node)) {
        // convert the empty map we created for this key into a list
        const grand = stack[stack.length - 2].node;
        const list = [];
        grand[holder.key] = list;
        holder.node = list;
      }
      holder.node.push(scalar(body.slice(2)));
      continue;
    }
    const i = body.indexOf(':');
    if (i < 0) continue;
    const key = body.slice(0, i).trim();
    const rest = body.slice(i + 1);
    if (rest.trim() === '') {
      const child = {};
      parent[key] = child;
      stack.push({ indent, node: child, key });
    } else {
      parent[key] = scalar(rest);
    }
  }
  return root;
}

export function readBrand(path) {
  const text = readFileSync(path, 'utf8');
  const fm = parseFrontMatter(text);
  const colors = fm.colors && typeof fm.colors === 'object' ? Object.values(fm.colors) : [];
  const found = [...new Set((colors.length ? colors : (text.match(/#[0-9a-f]{6}\b/gi) || [])).map(c => String(c).toLowerCase()))].filter(c => /^#[0-9a-f]{6}$/.test(c));
  if (!found.length) throw new Error(`Brand file ${path} has no colours. Add a colors: map to its front matter.`);
  const type = fm.type || {};
  return {
    name: fm.name || null,
    colors: found,
    type: { family: type.family || null, base: Number(type.base) || 16, ratio: Number(type.ratio) || 1.25, minSize: Number(type.minSize) || null },
    spacing: { unit: Number(fm.spacing?.unit) || 8 },
    raw: fm,
  };
}
