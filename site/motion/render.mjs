import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const media = join(here, "../media");
const run = (bin, args) => {
  const result = spawnSync(bin, args, { cwd: here, stdio: "inherit" });
  if (result.signal || result.status !== 0) process.exit(result.status || 1);
};
const browser = process.env.CHROME_PATH
  ? [`--browser-executable=${process.env.CHROME_PATH}`]
  : [];
const cli = join(here, "node_modules/@remotion/cli/remotion-cli.js");
for (const [id, file, codec, crf] of [
  ["Explainer", "explainer.mp4", "h264", "20"],
  ["Explainer", "explainer.webm", "vp9", "32"],
  ["ExplainerShort", "explainer-short.mp4", "h264", "20"],
])
  run(process.execPath, [
    cli,
    "render",
    "src/index.tsx",
    id,
    join(media, file),
    `--codec=${codec}`,
    `--crf=${crf}`,
    "--concurrency=4",
    ...browser,
  ]);
run(process.execPath, [
  cli,
  "still",
  "src/index.tsx",
  "Explainer",
  join(media, "explainer-poster.png"),
  "--frame=430",
  ...browser,
]);
run("ffmpeg", [
  "-y",
  "-i",
  join(media, "explainer.mp4"),
  "-vf",
  "fps=8,scale=760:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer",
  "-loop",
  "0",
  join(media, "explainer.gif"),
]);
const captions = JSON.parse(readFileSync(join(here, "captions.json"), "utf8"));
const format = (s) =>
  `00:${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.000`;
writeFileSync(
  join(media, "explainer.vtt"),
  "WEBVTT\n\n" +
    captions
      .map(
        ({ start, end, text }) =>
          `${format(start)} --> ${format(end)}\n${text}\n`,
      )
      .join("\n"),
);
