#!/usr/bin/env node
// Appends one event to .desk/events.jsonl for the dashboard: desk-event job.phase id=<id> phase=roughs round=0
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveRoot } from './root.mjs';
const r = spawnSync(process.execPath, [join(resolveRoot(join('scripts', 'emit-event.mjs')), 'scripts', 'emit-event.mjs'), ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
