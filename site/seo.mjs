import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ORIGIN = 'https://deskstudio.ai';
const REPO = 'https://github.com/adityareddy-dev/deskstudio';
const IMAGE = `${ORIGIN}/og.png`;
const IMAGE_ALT = 'Desk Studio. Your own design studio. Studio bots at their desks with examples of their work.';
const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const home = {
  path: '/',
  title: 'Desk Studio | Your own design studio',
  description: 'A full design studio inside the coding agent you already use. One command, free.',
  sources: ['site/build.mjs', 'site/seo.mjs', 'site/site.css', 'site/home.css', 'site/theme.js', 'site/fonts', 'site/media', 'fonts', 'brand/logo', 'skills/desk/desks.json', 'runner/models.json', 'site/starters.json', 'dashboard/public/bots.js', 'dashboard/public/bots.css', 'evals/golden', 'evals/cases', 'clips/fixtures/card', 'clips/fixtures/controls'],
};

// Both builders use the same title, description and picture for search and shares.
export function pageHead({ path, title, description }) {
  const url = `${ORIGIN}${path}`;
  // The docs index is a list of links, not an article.
  const index = path === '/docs/';
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${ORIGIN}/#website`, name: 'Desk Studio', url: `${ORIGIN}/` },
      { '@type': 'SoftwareSourceCode', '@id': `${ORIGIN}/#software`, name: 'Desk Studio', url: `${ORIGIN}/`, codeRepository: REPO, description: home.description },
      { '@type': path === '/' ? 'WebPage' : index ? 'CollectionPage' : 'TechArticle', '@id': `${url}#page`, url, name: title, headline: title, description, inLanguage: 'en', isPartOf: { '@id': `${ORIGIN}/#website` }, about: { '@id': `${ORIGIN}/#software` } },
    ],
  };
  return `<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:type" content="${path === '/' || index ? 'website' : 'article'}">
<meta property="og:site_name" content="Desk Studio">
<meta property="og:image" content="${IMAGE}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(IMAGE_ALT)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${IMAGE}">
<meta name="twitter:image:alt" content="${esc(IMAGE_ALT)}">
<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

export function writeDiscovery(dist, pages) {
  const entries = pages.map(({ path, sources }) => {
    const date = execFileSync('git', ['log', '-1', '--format=%cs', '--', ...sources], { cwd: root, encoding: 'utf8' }).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`No git date for ${path}`);
    return `  <url><loc>${esc(ORIGIN + path)}</loc><lastmod>${date}</lastmod></url>`;
  });
  writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`);
  writeFileSync(join(dist, 'robots.txt'), `User-agent: *
Allow: /
Sitemap: ${ORIGIN}/sitemap.xml
`);
}
