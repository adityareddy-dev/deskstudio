// Parses what the desks return, in the shapes their briefs define, and pulls HTML out of a builder reply.

export const AXES = ['hierarchy', 'typography', 'spacing', 'colour', 'composition', 'originality', 'brand', 'copy'];

const AXIS_ALIASES = {
  hierarchy: 'hierarchy',
  typography: 'typography', type: 'typography',
  spacing: 'spacing', 'spacing and rhythm': 'spacing', rhythm: 'spacing',
  colour: 'colour', color: 'colour',
  composition: 'composition',
  originality: 'originality',
  brand: 'brand', 'brand fit': 'brand',
  copy: 'copy',
};

function stripFences(text) {
  // A desk may wrap its return block in ``` fences. Take the inside.
  const m = /```[a-z]*\r?\n([\s\S]*?)```/i.exec(text);
  return m && /^\s*(pick|scores|took the pen|direction)\s*:/im.test(m[1]) ? m[1] : text;
}

function lines(text) {
  return String(text).replace(/\r\n/g, '\n').split('\n');
}

// Numbered notes "1. ..." or "- ..." after a "notes:" line, until the next "key:" line.
function collectList(all, startIndex) {
  const out = [];
  for (let i = startIndex; i < all.length; i++) {
    const l = all[i].trim();
    if (!l) continue;
    if (l.startsWith('```') || l.startsWith('<')) break;
    const item = /^(?:\d+[.)]|[-*•])\s+(.*)$/.exec(l);
    if (item) { out.push(item[1].trim()); continue; }
    if (/^[a-z][a-z ]*:/i.test(l)) break;
    if (out.length) out[out.length - 1] += ' ' + l; // a wrapped note
  }
  return out;
}

// pick: 2 / reason: ... / lost: 1 ..., 3 ... / notes: 1. ... 2. ...
export function parsePick(text) {
  const body = stripFences(text);
  const all = lines(body);
  const pickLine = all.find(l => /^\s*pick\s*:/i.test(l));
  if (!pickLine) throw new Error('The Art Director reply has no "pick:" line.');
  const num = /pick\s*:\s*(?:rough\s*)?(\d)/i.exec(pickLine);
  if (!num) throw new Error(`Could not read a rough number from "${pickLine.trim()}".`);
  const pick = Number(num[1]);
  if (pick < 1 || pick > 3) throw new Error(`Pick ${pick} is out of range, roughs are 1 to 3.`);
  const rest = pickLine.replace(/pick\s*:\s*(?:rough\s*)?\d/i, '');
  const combine = /(?<![\d.])([123])(?![\d%])/.exec(rest);
  const field = key => {
    const l = all.find(x => new RegExp(`^\\s*${key}\\s*:`, 'i').test(x));
    return l ? l.replace(new RegExp(`^\\s*${key}\\s*:\\s*`, 'i'), '').trim() : '';
  };
  const notesIndex = all.findIndex(l => /^\s*notes\s*:/i.test(l));
  const notes = notesIndex >= 0 ? collectList(all, notesIndex + 1) : [];
  return { pick, combineWith: combine ? Number(combine[1]) : null, reason: field('reason'), lost: field('lost'), notes, raw: body.trim() };
}

// scores: hierarchy 9, typography 8, ... / average: 8.6 / pass: yes / notes: - axis: ... / polish: - ...
export function parseScores(text) {
  const body = stripFences(text);
  const all = lines(body);
  const scoresLine = all.find(l => /^\s*scores\s*:/i.test(l));
  if (!scoresLine) throw new Error('The Creative Director reply has no "scores:" line.');
  const axes = {};
  for (const m of scoresLine.replace(/^\s*scores\s*:/i, '').matchAll(/([a-z][a-z ]*?)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:\/\s*10)?/gi)) {
    const key = AXIS_ALIASES[m[1].trim().toLowerCase()];
    if (key) axes[key] = Number(m[2]);
  }
  const missing = AXES.filter(a => axes[a] == null);
  if (missing.length) throw new Error(`The scores line is missing: ${missing.join(', ')}.`);
  const values = AXES.map(a => axes[a]);
  const average = Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100;
  const avgLine = all.find(l => /^\s*average\s*:/i.test(l));
  const statedAverage = avgLine ? Number(/(\d+(?:\.\d+)?)/.exec(avgLine)?.[1]) : null;
  const passLine = all.find(l => /^\s*pass\s*:/i.test(l));
  const statedPass = passLine ? /yes|true/i.test(passLine) : null;
  // The bar from rubric.md: every axis 8 or above and the average 8.5 or above.
  const pass = values.every(v => v >= 8) && average >= 8.5;
  const notesIndex = all.findIndex(l => /^\s*notes\s*:/i.test(l));
  const polishIndex = all.findIndex(l => /^\s*polish\s*:/i.test(l));
  const notes = (notesIndex >= 0 ? collectList(all, notesIndex + 1) : []).map(n => {
    const m = /^([a-z][a-z ]*?)\s*:\s*(.*)$/i.exec(n);
    const axis = m ? AXIS_ALIASES[m[1].trim().toLowerCase()] : null;
    return { axis: axis || null, text: m && axis ? m[2].trim() : n };
  });
  const polish = polishIndex >= 0 ? collectList(all, polishIndex + 1) : [];
  const failing = AXES.filter(a => axes[a] < 8);
  return { axes, average, statedAverage, pass, statedPass, notes, polish, failing, raw: body.trim() };
}

// took the pen: yes / changed: ... / notes for the builder: 1. ...
export function parseEscalation(text) {
  const body = stripFences(text);
  const all = lines(body);
  const pen = all.find(l => /^\s*took the pen\s*:/i.test(l));
  const changed = all.find(l => /^\s*changed\s*:/i.test(l));
  const idx = all.findIndex(l => /^\s*notes(?: for the builder)?\s*:/i.test(l));
  return {
    tookPen: pen ? /yes/i.test(pen) : false,
    changed: changed ? changed.replace(/^\s*changed\s*:\s*/i, '').trim() : '',
    notes: idx >= 0 ? collectList(all, idx + 1) : [],
  };
}

// The builder's return block: file:, pattern:, applied:, fonts:, proof:
export function parseBuilderReturn(text) {
  const out = {};
  for (const key of ['file', 'pattern', 'applied', 'fonts', 'proof']) {
    const l = lines(text).find(x => new RegExp(`^\\s*${key}\\s*:`, 'i').test(x) && !/<|>/.test(x));
    if (l) out[key] = l.replace(new RegExp(`^\\s*${key}\\s*:\\s*`, 'i'), '').trim();
  }
  return out;
}

// One HTML document out of a reply: a fenced html block first, else the first <!doctype or <html to the last </html>.
export function extractHtml(text) {
  const s = String(text).replace(/\r\n/g, '\n');
  const fences = [...s.matchAll(/```(?:html|HTML|htm)?[^\n]*\n([\s\S]*?)\n```/g)].map(m => m[1]);
  const docs = fences.filter(f => /<html|<!doctype/i.test(f));
  if (docs.length) return docs.sort((a, b) => b.length - a.length)[0].trim() + '\n';
  const start = s.search(/<!doctype\s+html|<html[\s>]/i);
  const end = s.lastIndexOf('</html>');
  if (start >= 0 && end > start) return s.slice(start, end + '</html>'.length).trim() + '\n';
  if (start >= 0) return s.slice(start).trim() + '\n';
  throw new Error('No HTML document in the reply. Expected one fenced block tagged html holding the whole file.');
}

// What the loop needs from brief.md: the named sizes and the copy that must appear.
export function parseBrief(md, knownSizes) {
  const text = String(md).replace(/\r\n/g, '\n');
  const section = name => {
    const heading = new RegExp(`(?:\\*\\*${name}\\.?\\*\\*|^#{1,6}[ \\t]+${name}[.:]?[ \\t]*$)[ \\t]*`, 'im').exec(text);
    const tail = heading ? text.slice(heading.index + heading[0].length) : '';
    const end = tail.search(/\n[ \t]*(?:(?:-[ \t]*)?\*\*|#{1,6}[ \t])/);
    return { tail, end, body: (end < 0 ? tail : tail.slice(0, end)).trim() };
  };
  const sizeBody = section('Sizes').body;
  const sizes = [];
  if (sizeBody) {
    for (const m of sizeBody.matchAll(/`([a-z0-9-]+)`|\b([a-z]+-[a-z-]+|linkedin|og|x|slide|phone|tablet|desktop)\b/gi)) {
      const name = (m[1] || m[2] || '').toLowerCase();
      if (name && knownSizes.includes(name) && !sizes.includes(name)) sizes.push(name);
    }
  }
  const { tail: copyTail, end, body: copyBody } = section('Copy');
  const fencedCopy = /```[^\n]*\n([\s\S]*?)```/.exec(copyTail);
  const ownFence = fencedCopy && (end < 0 || fencedCopy.index < end);
  const copyText = ownFence ? fencedCopy[1] : copyBody.replace(/^(?:verbatim|draft copy)\s*:\s*/i, '').split(/\n\s*\n/)[0];
  const copy = copyText.split('\n').map(l => l.trim()).filter(l => l && !/^[-*]\s*$/.test(l));
  const draft = /draft copy/i.test(text);
  return { sizes, copy, draftCopy: draft };
}

// The composition pattern names from a standard: "1. **Editorial split.** ..."
export function parsePatterns(standardMd) {
  const names = [];
  for (const m of String(standardMd).matchAll(/^\s*\d+\.\s+\*\*([^*]+?)\.?\*\*/gm)) names.push(m[1].trim());
  return names;
}
