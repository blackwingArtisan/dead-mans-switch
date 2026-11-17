// Runs the API (with the time machine) on :3140 and the Vite dev server on :3141.
import { spawn } from 'node:child_process';

const procs = [
  spawn('npx', ['tsx', 'watch', 'src/server/node.ts'], { stdio: 'inherit', env: { ...process.env, DMS_CLOCK: 'machine', DMS_BASE_URL: 'http://localhost:3141' } }),
  spawn('npx', ['vite'], { stdio: 'inherit' }),
];
const stop = () => {
  for (const p of procs) p.kill('SIGTERM');
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) p.on('exit', (code) => code && stop());
