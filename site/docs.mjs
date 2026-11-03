import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const REPO = 'https://github.com/adityareddy-dev/deskstudio';
// The guides, from docs/ in the repo, and the agent setup pages, from site/docs/.
const guides = [['install', 'Getting started', join(root, 'docs', 'install.md')], ['dashboard', 'The dashboard', join(root, 'docs', 'dashboard.md')]];
const pages = [
  ['claude-code', 'Claude Code'], ['cursor', 'Cursor'], ['codex', 'Codex'],
  ['gemini-cli', 'Gemini CLI'], ['copilot', 'Copilot CLI'],
  ['windsurf', 'Windsurf'], ['opencode', 'OpenCode'],
];
const esc = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// A link in a guide: another guide becomes its page, another doc goes to the repo, media and images to the site.
const href = url => {
  if (/^(https?:|#|\/)/.test(url)) return url;
  const [path, hash = ''] = url.split('#');
  const guide = guides.find(([slug]) => path === `${slug}.md`);
  if (guide) return `/docs/${guide[0]}/${hash ? `#${hash}` : ''}`;
  if (path.startsWith('../site/media/')) return `/media/${path.slice('../site/media/'.length)}`;
  if (path.startsWith('images/')) return `/docs/${path}`;
  if (path.endsWith('.md')) return `${REPO}/blob/main/docs/${path}${hash ? `#${hash}` : ''}`;
  return `${REPO}/blob/main/docs/${path}`;
};
const inline = text => text.split(/(`[^`]+`)/g).map(part => {
  if (part.startsWith('`')) return `<code>${esc(part.slice(1, -1))}</code>`;
  return esc(part)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, alt, src) => `<img src="${href(src)}" alt="${alt}" loading="lazy" decoding="async">`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, u) => `<a href="${href(u.replace(/&amp;/g, '&'))}">${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}).join('');
const slug = text => text.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/\s+/g, '-');

// Headings, paragraphs, lists, tables, fenced code, images, and a poster linked to a clip, which becomes the clip.
function render(source) {
  return source.trim().split(/\n\s*\n/).map(block => {
    const code = block.match(/^```[^\n]*\n([\s\S]*?)\n```$/);
    if (code) return `<pre class="codeblock${/^[ 	]/m.test(code[1]) ? ' keep' : ''}"><code>${esc(code[1])}</code></pre>`;
    const heading = block.match(/^(#{1,3}) (.+)$/);
    if (heading) return `<h${heading[1].length} id="${slug(heading[2])}">${inline(heading[2])}</h${heading[1].length}>`;
    const clip = block.match(/^\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+\.mp4)\)$/);
    if (clip) return `<figure class="clip"><video controls playsinline preload="none" poster="${href(clip[2])}" aria-label="${esc(clip[1])}"><source src="${href(clip[3])}" type="video/mp4"><track kind="captions" src="${href(clip[3]).replace(/\.mp4$/, '.vtt')}" srclang="en" label="English"></video></figure>`;
    const image = block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) return `<figure class="shot"><img src="${href(image[2])}" alt="${esc(image[1])}" loading="lazy" decoding="async"><figcaption>${esc(image[1])}</figcaption></figure>`;
    const lines = block.split('\n');
    if (lines.every(l => /^- /.test(l) || /^  \S/.test(l))) return `<ul>${block.split(/\n(?=- )/).map(l => `<li>${inline(l.replace(/^- /, '').replace(/\n\s+/g, ' '))}</li>`).join('')}</ul>`;
    if (/^\d+\. /.test(lines[0])) return `<ol>${block.split(/\n(?=\d+\. )/).map(l => `<li>${inline(l.replace(/^\d+\. /, '').replace(/\n\s+/g, ' '))}</li>`).join('')}</ol>`;
    if (/^\|/.test(lines[0]) && /^\|[\s:|-]+\|$/.test(lines[1] || '')) {
      const cells = l => l.replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => inline(c.trim()));
      return `<div class="table-scroll"><table><thead><tr>${cells(lines[0]).map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${lines.slice(2).map(l => `<tr>${cells(l).map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    return `<p>${inline(block.replace(/\n/g, ' '))}</p>`;
  }).join('\n');
}

const mark = readFileSync(join(root, 'brand', 'logo', 'logo.svg'), 'utf8').trim().replace(/^<svg[^>]*>/, '<svg class="mark" viewBox="0 0 512 512" aria-hidden="true">');
const themeIcons = '<svg class="moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg><svg class="sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
function document(title, body, current = '') {
  const cur = slug => current === slug ? ' aria-current="page"' : '';
  const links = `<a href="/docs/install/"${cur('install')}>Getting started</a><a href="/docs/dashboard/"${cur('dashboard')}>The dashboard</a><a href="/docs/"${cur('index')}>Agent setup</a><a href="${REPO}/tree/main/docs">All docs</a>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | Desk Studio</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon.ico" sizes="48x48">
<script src="/theme.js"></script>
<link rel="stylesheet" href="/site.css">
</head><body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-head"><nav class="wrap site-nav" aria-label="Docs"><a class="brand" href="/">${mark}<span>Desk Studio</span></a><div class="links">${links}</div><details class="nav-menu"><summary>Menu</summary><div class="links">${links}</div></details><button type="button" class="theme-toggle" data-theme-toggle aria-label="Switch between light and dark">${themeIcons}</button><a class="btn" href="/#start">Get started</a></nav></header>
<main id="main" class="wrap doc"><article class="prose">${body}</article></main>
<footer class="site-foot"><div class="wrap"><a class="brand" href="/">${mark}<span>Desk Studio</span></a><nav aria-label="Agent setup">${pages.map(([slug, name]) => `<a href="/docs/${slug}/"${current === slug ? ' aria-current="page"' : ''}>${esc(name)}</a>`).join('')}</nav></div></footer>
</body></html>
`;
}

export function buildDocs(dist) {
  const docs = join(dist, 'docs');
  mkdirSync(docs, { recursive: true });
  for (const [slug, name] of pages) {
    const directory = join(docs, slug);
    mkdirSync(directory, { recursive: true });
    const body = readFileSync(join(here, 'docs', `${slug}.md`), 'utf8');
    writeFileSync(join(directory, 'index.html'), document(`Desk Studio in ${name}`, render(body), slug));
  }
  for (const [slug, name, file] of guides) {
    mkdirSync(join(docs, slug), { recursive: true });
    writeFileSync(join(docs, slug, 'index.html'), document(name, render(readFileSync(file, 'utf8')), slug));
  }
  // The guide's screenshots, and the walkthrough the guide plays (the home page copies it to /media too).
  const shots = join(root, 'docs', 'images', 'dashboard');
  if (existsSync(shots)) cpSync(shots, join(docs, 'images', 'dashboard'), { recursive: true });
  mkdirSync(join(dist, 'media'), { recursive: true });
  for (const f of ['walkthrough.mp4', 'walkthrough.webm', 'walkthrough.webp', 'walkthrough.vtt']) if (existsSync(join(here, 'media', f))) cpSync(join(here, 'media', f), join(dist, 'media', f));
  const links = pages.map(([slug, name]) => `<li><a href="/docs/${slug}/">${esc(name)}</a></li>`).join('\n');
  writeFileSync(join(docs, 'index.html'), document('Docs', `<h1>Docs</h1>
<ul class="doc-cards cards"><li><a class="card" href="/docs/install/"><strong>Getting started</strong><span>Install, run a first job, open the dashboard.</span></a></li><li><a class="card" href="/docs/dashboard/"><strong>The dashboard</strong><span>Open it, read every part of it, follow a job, read the result.</span></a></li></ul>
<h2>Agent setup</h2>\n<ul>${links}</ul>
<p>Everything else is in <a href="${REPO}/tree/main/docs">the repo's docs</a>.</p>`, 'index'));
}
