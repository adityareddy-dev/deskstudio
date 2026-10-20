# The desks

Every desk, by tier, with what it owns. Each desk has a brief in `skills/desk/roles/<slug>.md` and, except the Manager, an agent in `agents/<slug>.md`. Models per tier come from `.desk/project.json`. The defaults are below.

## manager (inherit)

| Desk | Owns | Tools |
| --- | --- | --- |
| Design Manager (`design-manager`) | intake, staffing, the loop, the floor, the handback | main session |

## director (anthropic/opus)

| Desk | Owns | Tools |
| --- | --- | --- |
| Creative Director (`creative-director`) | direction and sign-off against the rubric | Read, Glob |
| Art Director (`art-director`) | the pick, the notes, the pen on escalation | Read, Glob, Write, Edit |
| Brand Strategist (`brand-strategist`) | positioning, the claim, voice, architecture, brand audits | Read, Glob, Grep |

## senior (anthropic/sonnet)

| Desk | Owns | Tools |
| --- | --- | --- |
| Typographer (`typographer`) | pairing, scale, measure, leading, weights, optical details | Read, Glob, Edit |
| Design System Lead (`design-system-lead`) | tokens, DESIGN.md, exports, consistency audits | Read, Write, Edit, Glob, Grep |
| Accessibility Specialist (`accessibility-specialist`) | WCAG 2.2 AA beyond the automated checks, with code fixes | Read, Glob, Grep, Edit |
| Copy Editor (`copy-editor`) | correctness, consistency, clarity, the last read | Read, Edit, Glob, Grep |
| UX Researcher (`ux-researcher`) | audience, jobs, pains, evidence, research questions and plans | Read, Glob, Grep, WebFetch, WebSearch |
| Product Designer (`product-designer`) | scope, the core flow, trade-offs, first version versus later | Read, Glob, Grep |
| UX Designer (`ux-designer`) | flows, wireframes, information architecture, interaction rules, edge cases | Read, Write, Edit, Glob |
| Interaction Designer (`interaction-designer`) | states, gestures, transitions, feedback, clickable prototypes | Read, Write, Edit, Glob, Bash |
| Presentation Designer (`presentation-designer`) | slide systems and decks at 1920x1080 | Read, Write, Edit, Glob, Bash |
| Dashboard Architect (`dashboard-architect`) | dashboard information architecture, layout, density, states | Read, Write, Edit, Glob, Bash |
| Landing Page Designer (`landing-page-designer`) | above the fold, section order, pricing, conversion details | Read, Write, Edit, Glob, Bash |
| Social Media Strategist (`social-media-strategist`) | the plan, the calendar, launch sequences, platform rules, measurement | Read, Glob, WebFetch |
| Growth/Analytics Specialist (`growth-analytics-specialist`) | the metric, tracking plans, variant plans, honest reads, reports | Read, Glob, WebFetch, Bash |
| Compliance Designer (`compliance-designer`) | consent, privacy, email footers, accessibility obligations, regulated flows | Read, Write, Edit, Glob, WebFetch |
| Conversational Designer (`conversational-designer`) | dialogue, chat and voice flows, message types, guardrails | Read, Write, Edit, Glob, Bash |
| Spatial Designer (`spatial-designer`) | headset and AR layout in metres and degrees, comfort, input fallbacks | Read, Write, Edit, Glob, Bash |
| AI Prompt Engineer (`ai-prompt-engineer`) | prompt packs, cross-tool variants, critiques, consistency strategies | Read, Glob |

## builder (anthropic/haiku)

| Desk | Owns | Tools |
| --- | --- | --- |
| UI Designer (`ui-designer`) | layout, type, colour and composition in one self-contained file | Read, Write, Edit, Glob, Bash |
| Social Media Designer (`social-media-designer`) | cards, stories, carousels, thumbnails, series consistency | Read, Write, Edit, Glob, Bash |
| Social Media Copywriter (`social-media-copywriter`) | on-card copy, captions per platform, carousel copy, alt text | Read, Glob |
| Email Designer (`email-designer`) | 600px table email that renders everywhere, dark mode, the bulletproof CTA | Read, Write, Edit, Glob, Bash |
| Email Copywriter (`email-copywriter`) | subject, preheader, body with one ask, sequences, transactional copy | Read, Glob |
| Motion Designer (`motion-designer`) | motion systems, micro-interactions, transitions, deterministic clips | Read, Write, Edit, Glob, Bash |
| Illustration Director (`illustration-director`) | illustration style, spots, hero art, diagrams, systems | Read, Write, Edit, Glob, Bash |
| Icon Designer (`icon-designer`) | icon grid, stroke, optical corrections, the set, the SVG contract | Read, Write, Edit, Glob, Bash |
| Image Editor (`image-editor`) | selection, crops and focal points, treatment, scrims, exports | Read, Write, Glob, Bash |
| Data Viz Designer (`data-viz-designer`) | chart choice, honest axes, direct labels, colourblind palettes, inline SVG | Read, Write, Edit, Glob, Bash |
| Design Engineer (`design-engineer`) | production HTML and CSS, components in the project's framework, states, performance | Read, Write, Edit, Glob, Grep, Bash |
| Framework Specialist (`framework-specialist`) | idiomatic components in React, Vue, Svelte, Next.js or Astro | Read, Write, Edit, Glob, Grep, Bash |
| Editorial Designer (`editorial-designer`) | grids, page systems, long-form hierarchy, figures, print PDFs | Read, Write, Edit, Glob, Bash |
| Print Designer (`print-designer`) | trim, bleed, safe area, ink, resolution, the print PDF and preflight | Read, Write, Edit, Glob, Bash |
| Storyboard Artist (`storyboard-artist`) | beat sheets, frames as HTML, eye path, caption timing, the hook frame | Read, Write, Edit, Glob, Bash |
| Video Editor (`video-editor`) | pacing, captions, platform specs, loops, QC, exports | Read, Glob, Bash |
| Video/Content Producer (`video-content-producer`) | scripts with timings, series plans, the hook, the ask | Read, Glob |
| Content Designer (`content-designer`) | headlines, sublines, buttons, labels, empty states, errors | Read, Glob |
| AI Image Director (`ai-image-director`) | shot lists, direction, candidate selection, moodboards, fit | Read, Glob, Bash |
| AI Video Director (`ai-video-director`) | shot-by-shot direction, tool choice per shot, consistency, selection | Read, Glob, Bash |
| AI Audio & Voice Producer (`ai-audio-voice-producer`) | voiceover briefs, stings, UI sounds, music beds, loudness, rights | Read, Glob, Bash |
