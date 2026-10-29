// The studio bots, drawn once for the dashboard, the brand sheet, the banner and the site.
// A bot at its desk, 88 by 80: a head with one lens eye, the trim colour of its tier, a laptop whose lid mark shows
// the trim while it works. The Manager wears the headset, a director the bow tie, a senior the lanyard and a builder
// the cap, so the tiers read apart even when the bots are small. Styles are in bots.css.
(root => {
  'use strict';
  const EYE = (cy, r) => `<g class="eye"><circle class="lens" cx="44" cy="${cy}" r="${r}"/><circle class="iris" cx="44" cy="${cy}" r="${(r * 0.64).toFixed(1)}" fill="none" stroke-width="${(r * 0.3).toFixed(1)}"/><g class="pupil"><circle class="pp" cx="44" cy="${cy}" r="${(r * 0.31).toFixed(1)}"/><circle class="gl" cx="${(44 + r * 0.29).toFixed(1)}" cy="${(cy - r * 0.29).toFixed(1)}" r="${(r * 0.17).toFixed(1)}"/></g></g>`;
  const WEAR = {
    manager: { head: '<path class="trim-s" d="M19 17C19-4 69-4 69 17" fill="none" stroke-width="3.2"/><rect class="trim" x="14" y="11" width="8" height="13" rx="4"/><rect class="trim" x="66" y="11" width="8" height="13" rx="4"/>', over: '<path class="wh-s" d="M18 23q1 10 13 11" fill="none" stroke-width="2.2" stroke-linecap="round"/><circle class="trim" cx="31" cy="34" r="2.6"/>', chest: '' },
    director: { head: '', over: '', chest: '<path class="trim" d="M35 37.5l9 4 9-4v8l-9-4-9 4z"/><circle class="trim" cx="44" cy="41.5" r="2.6"/>' },
    senior: { head: '', over: '', chest: '<path class="trim-s" d="M34 36.5L44 48.5 54 36.5" fill="none" stroke-width="2.4" stroke-linejoin="round"/><rect class="trim" x="39" y="47" width="10" height="8" rx="2"/><rect class="paper" x="41" y="49.5" width="6" height="1.8" rx=".9"/>' },
    builder: { head: '', over: '<path class="trim" d="M21 17C21 1 67 1 67 17z"/><rect class="trim" x="12" y="13.5" width="34" height="5.5" rx="2.75"/>', chest: '<rect class="trim" x="30" y="38" width="28" height="3.4" rx="1.7"/>' }
  };
  const svg = tier => {
    const w = WEAR[tier] || WEAR.senior;
    const eye = tier === 'builder' ? EYE(22, 10.5) : EYE(19.5, 11.5);
    return `<svg class="bot" viewBox="0 0 88 80" aria-hidden="true"><ellipse class="sh" cx="44" cy="77" rx="36" ry="3"/>`
      + `<g class="rig"><rect class="sk arm-l" x="17" y="42" width="10" height="17" rx="5"/><rect class="sk arm-r" x="61" y="42" width="10" height="17" rx="5"/>`
      + `<rect class="bd" x="24" y="34" width="40" height="30" rx="10"/>${w.chest}<rect class="wh" x="38" y="30" width="12" height="6" rx="2"/>`
      + `<g class="head">${w.head}<rect class="hd" x="20" y="3" width="48" height="31" rx="12"/>${eye}${w.over}</g>`
      + `<text class="zz" x="70" y="9">z</text></g>`
      + `<rect class="desk-top" x="3" y="55" width="82" height="6" rx="3"/><rect class="desk-front" x="7" y="60" width="74" height="15" rx="2.5"/><rect class="desk-edge" x="7" y="60" width="74" height="2.2"/>`
      + `<g class="laptop"><rect class="lap" x="54" y="41" width="26" height="15" rx="2.5"/><rect class="lap" x="51" y="54.5" width="32" height="2.6" rx="1.2"/><circle class="lid" cx="67" cy="48.5" r="2.4"/></g></svg>`;
  };
  // state: asleep, awake, half or waking. seed offsets the bot's breathing and blinking so a room never moves in step.
  const html = (tier, state = 'asleep', seed = 0) => `<span class="bot-wrap ${state}" style="--seed:${seed}"><span class="glow"></span>${svg(tier)}</span>`;
  // The two gradients the bodies use. Put this once on any page that draws bots.
  const defs = '<svg class="bot-defs" aria-hidden="true" focusable="false"><defs><linearGradient id="bot-head" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="s-hi"/><stop offset=".6" class="s-mid"/><stop offset="1" class="s-lo"/></linearGradient><linearGradient id="bot-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="s-mid"/><stop offset="1" class="s-lo"/></linearGradient></defs></svg>';
  root.DeskBots = { svg, html, defs, tiers: ['manager', 'director', 'senior', 'builder'] };
})(typeof window !== 'undefined' ? window : globalThis);
