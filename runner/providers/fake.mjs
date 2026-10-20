// A provider for tests: answers from the desk it sees in the system prompt, never calls a model.
// makeFake({ brief, brand, roughs: [html, html, html], pick: text, polish: html | [html...], scores: text | [text...], pen: text })
export function makeFake(answers = {}) {
  const calls = [];
  const queue = v => (Array.isArray(v) ? v.slice() : v == null ? [] : [v]);
  const polish = queue(answers.polish);
  const scores = queue(answers.scores);
  let roughIndex = 0;
  const fake = {
    calls,
    async runModel({ spec, system, prompt, images = [] }) {
      const desk = /^# UI Designer/m.test(system) ? 'ui-designer'
        : /^# Art Director/m.test(system) ? 'art-director'
        : /^# Creative Director/m.test(system) ? 'creative-director'
        : /^# Brand from the project/m.test(system) ? 'brand'
        : /^# Design Manager/m.test(system) ? 'manager' : 'unknown';
      calls.push({ desk, spec, images: images.length, prompt, system });
      let text;
      if (desk === 'manager') text = answers.brief;
      else if (desk === 'brand') text = answers.brand;
      else if (desk === 'ui-designer' && /composition pattern/i.test(prompt) && !/notes to apply/i.test(prompt)) text = answers.roughs[roughIndex++ % answers.roughs.length];
      else if (desk === 'ui-designer') text = polish.length > 1 ? polish.shift() : polish[0];
      else if (desk === 'art-director' && /take the pen/i.test(prompt)) text = answers.pen;
      else if (desk === 'art-director') text = typeof answers.pick === 'function' ? answers.pick(prompt) : answers.pick;
      else if (desk === 'creative-director') text = scores.length > 1 ? scores.shift() : scores[0];
      if (text == null) throw new Error(`fake provider has no answer for ${desk}`);
      if (typeof text === 'function') text = text(prompt);
      return { text, usage: { input: 1000, output: 500, cacheRead: 200, cacheWrite: 100, total: 1800 }, costUsd: 0.01, provider: spec.split('/')[0], model: spec.split('/')[1], modelId: spec.split('/')[1], via: 'fake', spec, sawImages: true };
    },
  };
  return fake;
}
