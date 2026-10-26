import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { launch, proof } from "./src/records.ts";
import { SIZES } from "../../proof/sizes.mjs";

const json = (path) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const source = json(
  "../../evals/golden/social-card/desk-studio-launch/state.json",
);
assert.equal(launch.id, source.id);
assert.deepEqual(launch.scores, source.scores);
assert.deepEqual(launch.cost, source.cost);
const rejected = json(
  "../../evals/golden/social-card/desk-studio-floor/state.json",
);
assert.equal(proof.id, rejected.id);
assert.ok(
  rejected.notes.some(
    (n) =>
      n.includes(`"deskstudio.ai" ${proof.actualTop}px`) &&
      n.includes(`${proof.safeTop}px`),
  ),
);
assert.equal(
  proof.safeTop,
  Math.ceil(SIZES.linkedin.height * SIZES.linkedin.safe[0]),
);
const beats = json("./captions.json");
assert.equal(beats.length, 6);
assert.deepEqual(
  beats.map((b) => b.start),
  [0, 6, 16, 26, 36, 44],
);
assert.equal(beats.at(-1).end, 50);
for (let i = 1; i < beats.length; i++)
  assert.equal(beats[i - 1].end, beats[i].start);
console.log(
  "Scores, cost, rejected proof, safe zone and caption timings match their sources.",
);
