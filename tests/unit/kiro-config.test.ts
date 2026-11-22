import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Keeps the Kiro configuration honest: every hook uses the v1 schema shared by Kiro IDE 1.x and
// CLI V3, the custom agent's resources resolve to real files inside Kiro's context limits, and the
// commands the hooks run actually work in this repository.

const HOOK_TRIGGERS = new Set([
  'SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PermissionRequest',
  'Stop', 'PreCompact', 'PostCompact', 'PostFileCreate', 'PostFileSave', 'PostFileDelete',
  'PreTaskExec', 'PostTaskExec',
]);

type Action = { type: string; command?: string; prompt?: string };
type Hook = { name: string; trigger: string; matcher?: string; action: Action; timeout?: number; enabled?: boolean };

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;

function checkHook(hook: Hook) {
  expect(hook.name, 'every hook is named').toBeTruthy();
  expect(HOOK_TRIGGERS.has(hook.trigger), `${hook.name}: known trigger ${hook.trigger}`).toBe(true);
  if (hook.action.type === 'command') expect(hook.action.command).toBeTruthy();
  else if (hook.action.type === 'agent') expect(hook.action.prompt).toBeTruthy();
  else throw new Error(`${hook.name}: unknown action type ${hook.action.type}`);
  if (hook.matcher) expect(() => new RegExp(hook.matcher!)).not.toThrow();
}

/** Expands the two glob shapes the agent uses: `dir/**\/*.md` and `dir/*.md`. */
function expand(glob: string): string[] {
  const path = glob.replace(/^file:\/\//, '');
  const star = path.indexOf('*');
  if (star === -1) return [path];
  const base = path.slice(0, star).replace(/\/$/, '');
  const ext = path.slice(path.lastIndexOf('.'));
  const deep = path.includes('**');
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
      const full = join(dir, d.name);
      if (d.isDirectory()) return deep ? walk(full) : [];
      return d.name.endsWith(ext) ? [full] : [];
    });
  return walk(base);
}

describe('Kiro workspace hooks (.kiro/hooks)', () => {
  const files = readdirSync('.kiro/hooks').filter((f) => f.endsWith('.json'));

  it('ships the four hooks, each in the v1 schema', () => {
    expect(files.sort()).toEqual(['crypto-guard.json', 'spec-drift.json', 'test-on-save.json', 'verify-before-stop.json']);
    for (const file of files) {
      const doc = readJson(join('.kiro/hooks', file));
      expect(doc.version, file).toBe('v1');
      const hooks = doc.hooks as Hook[];
      expect(hooks.length, file).toBeGreaterThan(0);
      hooks.forEach(checkHook);
    }
  });

  it('matches the crypto hook only on the crypto module', () => {
    const [hook] = readJson('.kiro/hooks/crypto-guard.json').hooks as Hook[];
    const re = new RegExp(hook!.matcher!);
    expect(re.test('src/core/crypto.ts')).toBe(true);
    expect(re.test('/work/dead-mans-switch/src/core/crypto.ts')).toBe(true);
    expect(re.test('src/core/encoding.ts')).toBe(false);
    expect(re.test('tests/unit/crypto.test.ts')).toBe(false);
  });

  it('runs the unit tests on saves to source and unit tests, not to docs', () => {
    const [hook] = readJson('.kiro/hooks/test-on-save.json').hooks as Hook[];
    const re = new RegExp(hook!.matcher!);
    expect(re.test('src/web/pages/Open.tsx')).toBe(true);
    expect(re.test('tests/unit/machine.test.ts')).toBe(true);
    expect(re.test('README.md')).toBe(false);
  });
});

describe('Kiro custom agent (.kiro/agents/dead-mans-switch.json)', () => {
  const agent = readJson('.kiro/agents/dead-mans-switch.json') as {
    name: string; prompt: string; tools: string[]; resources: string[]; hooks: Hook[]; includeMcpJson: boolean;
  };

  it('loads the steering and every spec within the CLI context limits', () => {
    const files = agent.resources.flatMap(expand);
    expect(files.some((f) => f.endsWith('steering/product.md'))).toBe(true);
    expect(files.some((f) => f.endsWith('switch-lifecycle/requirements.md'))).toBe(true);
    // Kiro CLI loads at most 32 file:// resources and 100,000 characters in total.
    expect(files.length).toBeLessThanOrEqual(32);
    const chars = files.reduce((n, f) => n + readFileSync(f, 'utf8').length, 0);
    expect(chars).toBeLessThan(100_000);
  });

  it('uses only V3 hook triggers and the MCP servers it names', () => {
    agent.hooks.forEach(checkHook);
    expect(agent.hooks.map((h) => h.trigger)).toEqual(['SessionStart']);
    // Documented CLI V3 form (kiro.dev/docs/cli/v3/hooks-migration): an array of named hooks, not the 2.x object keyed by agentSpawn.
    expect(Array.isArray(agent.hooks)).toBe(true);
    expect(agent.hooks[0]!.action).toEqual({ type: 'command', command: 'node scripts/open-tasks.mjs' });
    const mcp = readJson('.kiro/settings/mcp.json').mcpServers as Record<string, { command?: string; url?: string }>;
    expect(agent.includeMcpJson).toBe(true);
    for (const tool of agent.tools.filter((t) => t.startsWith('@'))) {
      expect(mcp[tool.slice(1)], `${tool} is configured in mcp.json`).toBeDefined();
    }
    for (const [name, server] of Object.entries(mcp)) {
      expect(Boolean(server.command) !== Boolean(server.url), `${name} is either local or remote`).toBe(true);
    }
  });
});

describe('scripts/open-tasks.mjs (the SessionStart hook)', () => {
  it('lists only unchecked numbered tasks, per spec', () => {
    const root = mkdtempSync(join(tmpdir(), 'dms-specs-'));
    mkdirSync(join(root, 'alpha'));
    writeFileSync(
      join(root, 'alpha', 'tasks.md'),
      ['- [ ] 1. Parent', '  - [x] 1.1 Done already', '  - [ ] 1.2 Still to do', '  - [ ] 1.3 Also open'].join('\n'),
    );
    const out = execFileSync(process.execPath, ['scripts/open-tasks.mjs', root], { encoding: 'utf8' });
    expect(out).toContain('Open spec tasks: 2');
    expect(out).toContain('alpha: 2 open');
    expect(out).toContain('1.2  Still to do');
    expect(out).not.toContain('Done already');
  });

  it('reads the real specs of this repository', () => {
    const out = execFileSync(process.execPath, ['scripts/open-tasks.mjs'], { encoding: 'utf8' });
    expect(out).toMatch(/^Open spec tasks: \d+/);
    expect(out).toContain('switch-lifecycle:');
  });
});
