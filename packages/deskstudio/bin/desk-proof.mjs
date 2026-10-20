#!/usr/bin/env node
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveRoot } from './root.mjs';
const r = spawnSync(process.execPath, [join(resolveRoot(join('proof', 'cli.mjs')), 'proof', 'cli.mjs'), ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
