#!/usr/bin/env node
// Keeps the test counts in README.md true. Runs the unit suite (and only reports it if every test
// passed), lists the Playwright suite, and rewrites the line between the `test-counts` markers.
// It also checks that the Total row of the KIRO-LOG.md sessions table is the sum of its rows, and
// that the README and the write-up quote the same session count and line total.
//
//   node scripts/sync-counts.mjs           rewrite README.md
//   node scripts/sync-counts.mjs --check   exit 1 if README.md is out of date
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const README = 'README.md';
const START = '<!-- test-counts -->';
const END = '<!-- /test-counts -->';

function kiroLogProblems() {
  const rows = readFileSync('KIRO-LOG.md', 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('| ') && l.split('|').length === 9)
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
  const total = rows.find((r) => r[0] === '**Total**');
  const sessions = rows.filter((r) => /^`[0-9a-f]{7}`$/.test(r[2]));
  if (!total || sessions.length === 0) return ['KIRO-LOG.md: could not read the sessions table.'];
  const num = (s) => Number(s.replace(/[*,]/g, '')) || 0;
  const sum = (i, places) => rows.filter((r) => r !== total).reduce((n, r) => n + num(r[i]), 0).toFixed(places);
  const problems = [];
  for (const [i, name, places] of [[3, 'minutes', 1], [4, 'credits', 2], [5, 'lines', 0]]) {
    if (num(total[i]).toFixed(places) !== sum(i, places)) {
      problems.push(`KIRO-LOG.md: the ${name} total is ${total[i]}, but the rows add up to ${sum(i, places)}.`);
    }
  }
  const lines = num(total[5]).toLocaleString('en-US');
  for (const doc of [README, 'docs/WRITEUP.md']) {
    const text = readFileSync(doc, 'utf8');
    if (!text.includes(`${sessions.length} logged sessions`)) {
      problems.push(`${doc}: expected "${sessions.length} logged sessions", the sessions in KIRO-LOG.md.`);
    }
    if (!text.includes(`${lines} lines`)) problems.push(`${doc}: expected "${lines} lines", the KIRO-LOG.md total.`);
  }
  return problems;
}

const problems = kiroLogProblems();
if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), 'dms-counts-'));
const report = join(dir, 'vitest.json');
try {
  execFileSync('npx', ['vitest', 'run', '--reporter=json', `--outputFile=${report}`], { stdio: 'ignore' });
} catch {
  // A failing suite still writes its report; the check below refuses to publish it.
}
const unit = JSON.parse(readFileSync(report, 'utf8'));
rmSync(dir, { recursive: true, force: true });
if (!unit.success || unit.numFailedTests > 0) {
  console.error(`Unit suite is not green (${unit.numFailedTests} failed); not updating the counts.`);
  process.exit(1);
}

const listed = execFileSync('npx', ['playwright', 'test', '--list'], { encoding: 'utf8' });
const total = listed.match(/Total: (\d+) tests? in (\d+) files?/);
if (!total) {
  console.error('Could not read the Playwright test list.');
  process.exit(1);
}

const line =
  `${unit.numPassedTests} unit tests in ${unit.testResults.length} files, all passing, and ` +
  `${total[1]} end-to-end runs (desktop and phone) in ${total[2]} Playwright files.`;

const text = readFileSync(README, 'utf8');
const from = text.indexOf(START);
const to = text.indexOf(END);
if (from === -1 || to === -1) {
  console.error(`README.md needs the ${START} and ${END} markers.`);
  process.exit(1);
}
const next = text.slice(0, from + START.length) + line + text.slice(to);

if (process.argv.includes('--check')) {
  if (next !== text) {
    console.error(`README.md test counts are stale. Expected: ${line}`);
    process.exit(1);
  }
  console.log(`README.md test counts are current: ${line}`);
} else {
  writeFileSync(README, next);
  console.log(`README.md: ${line}`);
}
