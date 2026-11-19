#!/usr/bin/env node
// Prints the open (unchecked) tasks of every Kiro spec in .kiro/specs/*/tasks.md.
// The custom agent's SessionStart hook runs this, so each Kiro session starts from the real
// backlog rather than from memory. Exit code is always 0; the output is context, not a gate.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? '.kiro/specs';
const specs = existsSync(root) ? readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()) : [];
let total = 0;
const lines = [];
for (const spec of specs.map((d) => d.name).sort()) {
  const file = join(root, spec, 'tasks.md');
  if (!existsSync(file)) continue;
  const open = readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => /^\s*- \[ \] (\d+\.\d+)\s+(.*)$/.exec(line))
    .filter((m) => m !== null)
    .map((m) => `  ${m[1]}  ${m[2].replace(/\s+/g, ' ').slice(0, 110)}`);
  total += open.length;
  lines.push(`${spec}: ${open.length} open`, ...open);
}
console.log(`Open spec tasks: ${total}`);
for (const line of lines) console.log(line);
