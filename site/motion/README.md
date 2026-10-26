# Capability explainer

From this directory:

```sh
npm ci
npm run typecheck
npm run render:all
```

Set `CHROME_PATH` to an existing Chrome executable, or let Remotion download its renderer. The six-beat composition is 1500 frames, 1920 × 1080, 30 fps. `ExplainerShort` compresses beats 2–4 into 300 frames. The CLI produces H.264, VP9, a PNG poster and a 760 px GIF fallback. Captions are in `captions.json` and are also burned into the video. No audio track.

`src/records.ts` copies scores and cost from `evals/golden/social-card/desk-studio-launch/state.json`. The rejected proof example is a different job, `evals/golden/social-card/desk-studio-floor/state.json`: its notes record `deskstudio.ai` at 32 px inside the 38 px LinkedIn safe zone. The eight rubric labels come from the launch record, including Copy. Round two is held even at 8.5 because Originality is 7. Costs are recorded list-price estimates.

The three output examples use the launch render, the Northlight dashboard golden and `brand/logo/cover-linkedin.png`. They are separate examples, not three files from the launch job. Palette and motion follow `brand/`; bundled Inter and Geist Mono are copied from `fonts/`. Host symbols come from [Lobe Icons](https://github.com/lobehub/lobe-icons), with its MIT license in `public/assets/`. Host names refer to the October 20 terminal-host runs with npm Desk Studio 1.0.0.

`real-run.mp4` is a contiguous eight-second screen capture from a separate fresh CLI job. Its capture details are in `real-run.json`. It is independent of the historical launch-card figures. The website generator copies committed media, so the Pages build never runs Remotion.
