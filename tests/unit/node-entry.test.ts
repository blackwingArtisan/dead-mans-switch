import { spawn, type ChildProcess } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

// Drives the real Node entry as a CLI: the time machine must be opt-in and local-only.
const PORT = 3146;
let child: ChildProcess | null = null;

afterEach(async () => {
  const c = child;
  child = null;
  if (!c || c.exitCode !== null || c.signalCode !== null) return;
  const gone = new Promise((resolve) => c.once('exit', resolve));
  c.kill('SIGTERM');
  await gone;
});

function start(args: string[], env: Record<string, string>) {
  child = spawn(process.execPath, ['--import', 'tsx', 'src/server/node.ts', ...args], {
    env: { ...process.env, DMS_STORE: 'memory', DMS_WEB_ROOT: 'does-not-exist', PORT: String(PORT), DMS_CLOCK: '', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout!.on('data', (d) => (output += d));
  child.stderr!.on('data', (d) => (output += d));
  const exited = new Promise<number | null>((resolve) => child!.on('exit', (code) => resolve(code)));
  return { exited, output: () => output };
}

async function waitForHealth(): Promise<{ dev: boolean }> {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
      if (res.ok) return (await res.json()) as { dev: boolean };
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('server did not start');
}

describe('Node entry', () => {
  it('starts with the system clock and no demo routes by default', async () => {
    start([], {});
    expect((await waitForHealth()).dev).toBe(false);
    const res = await fetch(`http://127.0.0.1:${PORT}/api/dev/reset`, { method: 'POST' });
    expect(res.status).toBe(404);
    expect(res.headers.get('x-frame-options')).toBe('DENY');
  }, 30_000);

  it('turns on the time machine only when asked', async () => {
    start(['--time-machine'], {});
    expect((await waitForHealth()).dev).toBe(true);
  }, 30_000);

  it('refuses to run the time machine for a public origin', async () => {
    const run = start(['--time-machine'], { DMS_BASE_URL: 'https://switch.example.com' });
    expect(await run.exited).toBe(1);
    expect(run.output()).toContain('Refusing to start the time machine');
  }, 30_000);
});
