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
    if (code) return `<pre><code>${esc(code[1])}</code></pre>`;
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
function document(title, body, current = '') {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | Desk Studio</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon.ico" sizes="48x48">
<style>
@font-face{font-family:Inter;src:url('/fonts/Inter-Variable.woff2') format('woff2');font-weight:100 900;font-display:swap}
@font-face{font-family:GeistMono;src:url('/fonts/GeistMono-Variable.woff2') format('woff2');font-weight:100 900;font-display:swap}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(1000px 520px at 10% -10%,rgba(255,170,28,.13),transparent 70%),#15100b;color:#fcf3e4;font:17px/1.65 Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit;text-underline-offset:4px;text-decoration-color:#a08d77}a:hover{color:#ffbf52}a:focus-visible{outline:2px solid #ffaa1c;outline-offset:4px}
header,main,footer{max-width:920px;margin:auto;padding:22px 24px}header{display:flex;gap:12px 24px;flex-wrap:wrap;align-items:center;border-bottom:1px solid #3b2e23}
header .brand{display:inline-flex;align-items:center;gap:10px;font-weight:800;letter-spacing:-.03em;font-size:19px;text-decoration:none;margin-right:auto}.mark{width:32px;height:32px}
header nav{display:flex;gap:10px 22px;flex-wrap:wrap}header nav a{text-decoration:none;font-weight:600}header nav a[aria-current=page]{color:#ffbf52}
main{padding-top:40px;padding-bottom:56px}h1{font-size:clamp(32px,6vw,52px);line-height:1.08;letter-spacing:-.035em;font-weight:800;margin:0 0 18px}h2{font-size:26px;letter-spacing:-.02em;margin-top:48px;font-weight:800}h3{font-size:19px;margin-top:32px}
p,li{max-width:70ch;color:#e8dccb}ul,ol{padding-left:22px}li{margin:6px 0}strong{color:#fcf3e4}
code{font-family:GeistMono,monospace;font-size:.88em;overflow-wrap:anywhere;color:#ffbf52}pre{padding:16px 18px;background:#1f1711;border:1px solid #3b2e23;border-radius:14px;white-space:pre-wrap;overflow-wrap:anywhere}pre code{color:#fcf3e4}
figure{margin:28px 0}figure img,figure video{display:block;width:100%;height:auto;border-radius:16px;border:1px solid #3b2e23;background:#1f1711}figure video{aspect-ratio:16/9}figcaption{margin-top:10px;font-size:14px;color:#a08d77}
.table-scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:15px;margin:16px 0}th,td{text-align:left;padding:10px 14px 10px 0;border-top:1px solid #3b2e23;vertical-align:top}th{color:#c2b19b}
footer{border-top:1px solid #3b2e23;color:#c2b19b;font-size:15px}footer nav{display:flex;gap:10px 20px;flex-wrap:wrap}footer nav [aria-current=page]{color:#ffbf52}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;padding:0;list-style:none}.cards li{max-width:none;margin:0}.cards a{display:block;padding:20px;border:1px solid #3b2e23;border-radius:18px;background:#1f1711;text-decoration:none}.cards a:hover{border-color:#ffaa1c;color:inherit}.cards strong{display:block;font-size:19px}.cards span{color:#c2b19b;font-size:15px}
</style></head><body>
<header><a class="brand" href="/">${mark}Desk Studio</a><nav aria-label="Docs"><a href="/docs/install/"${current === 'install' ? ' aria-current="page"' : ''}>Getting started</a><a href="/docs/dashboard/"${current === 'dashboard' ? ' aria-current="page"' : ''}>The dashboard</a><a href="/docs/"${current === 'index' ? ' aria-current="page"' : ''}>Agent setup</a><a href="${REPO}/tree/main/docs">All docs</a></nav></header>
<main>${body}</main><footer><nav aria-label="Agent setup">${pages.map(([slug, name]) => `<a href="/docs/${slug}/"${current === slug ? ' aria-current="page"' : ''}>${esc(name)}</a>`).join('')}</nav></footer>
</body></html>\n`;
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
<ul class="cards"><li><a href="/docs/install/"><strong>Getting started</strong><span>Install, run a first job, open the dashboard.</span></a></li><li><a href="/docs/dashboard/"><strong>The dashboard</strong><span>Open it, read every part of it, follow a job, read the result.</span></a></li></ul>
<h2>Agent setup</h2>\n<ul>${links}</ul>
<p>Everything else is in <a href="${REPO}/tree/main/docs">the repo's docs</a>.</p>`, 'index'));
}
