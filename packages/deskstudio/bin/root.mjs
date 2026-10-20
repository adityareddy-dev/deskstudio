// Where the runner, proof and skills live: inside the built package, or at the repo root while developing.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO = dirname(dirname(PKG));

export function resolveRoot(probe = join('runner', 'run.mjs')) {
  if (existsSync(join(PKG, probe))) return PKG;
  if (existsSync(join(REPO, probe))) return REPO;
  throw new Error(`Cannot find ${probe} in the package or the repo. Run scripts/build-adapters.mjs first.`);
}

export { PKG, REPO };
