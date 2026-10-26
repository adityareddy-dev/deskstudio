import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pages = [
  ['claude-code', 'Claude Code'], ['cursor', 'Cursor'], ['codex', 'Codex'],
  ['gemini-cli', 'Gemini CLI'], ['copilot', 'Copilot CLI'],
  ['windsurf', 'Windsurf'], ['opencode', 'OpenCode'],
];
const esc = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = text => text.split(/(`[^`]+`)/g).map(part => part.startsWith('`') ? `<code>${esc(part.slice(1, -1))}</code>` : esc(part)).join('');

// These pages use headings, paragraphs, inline code and fenced code blocks.
function render(source) {
  return source.trim().split(/\n\s*\n/).map(block => {
    const code = block.match(/^```[^\n]*\n([\s\S]*?)\n```$/);
    if (code) return `<pre><code>${esc(code[1])}</code></pre>`;
    const heading = block.match(/^(#{1,2}) (.+)$/);
    if (heading) return `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`;
    return `<p>${inline(block.replace(/\n/g, ' '))}</p>`;
  }).join('\n');
}

function document(title, body, current = '') {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | Desk Studio</title><link rel="icon" href="/favicon.svg">
<style>
@font-face{font-family:Inter;src:url('/fonts/Inter-Variable.woff2') format('woff2');font-display:swap}
@font-face{font-family:GeistMono;src:url('/fonts/GeistMono-Variable.woff2') format('woff2');font-display:swap}
*{box-sizing:border-box}body{margin:0;background:#101014;color:#f3f1ec;font:16px/1.65 Inter,system-ui,sans-serif}
a{color:inherit;text-underline-offset:4px}a:hover{color:#ffaa1c}a:focus-visible{outline:2px solid #ffaa1c;outline-offset:4px}
header,main,footer{max-width:860px;margin:auto;padding:24px}header{border-bottom:1px solid #34343c;display:flex;gap:24px;flex-wrap:wrap}
header a{font-weight:600}main{padding-top:36px;padding-bottom:48px}h1{font-size:clamp(28px,6vw,46px);line-height:1.15;letter-spacing:-.035em}h2{font-size:22px;margin-top:36px}
p{max-width:70ch}code{font-family:GeistMono,monospace;font-size:.9em;overflow-wrap:anywhere}pre{padding:18px;background:#1a1a20;border:1px solid #34343c;border-radius:6px;white-space:pre-wrap;overflow-wrap:anywhere}
footer{border-top:1px solid #34343c}nav{display:flex;gap:12px 20px;flex-wrap:wrap}nav [aria-current=page]{color:#ffaa1c}
</style></head><body>
<header><a href="/">Desk Studio</a><a href="/docs/">Agent setup</a><a href="https://github.com/adityareddy-dev/deskstudio/tree/main/docs">Repository docs</a></header>
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
  const links = pages.map(([slug, name]) => `<li><a href="/docs/${slug}/">${esc(name)}</a></li>`).join('\n');
  writeFileSync(join(docs, 'index.html'), document('Agent setup', `<h1>Agent setup</h1>\n<ul>${links}</ul>`));
}
