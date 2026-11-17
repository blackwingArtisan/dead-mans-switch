# Kiro log

How Kiro was used on Dead Man's Switch, call by call. Tool: `kiro-cli 3.4.0` (V3 agent), free plan.

## Project rules for Kiro (written first)

- `.kiro/steering/product.md`: who it is for, the seven-stage lifecycle, principles (false alarms are the worst failure; the server should not be able to read letters; accessible gothic), voice, out of scope.
- `.kiro/steering/tech.md`: stack, the adapter table (Clock, VaultStore, Mailer), crypto rules, token rules, commands, free deploy target.
- `.kiro/steering/structure.md`: folder layout and conventions.
- `.kiro/hooks/test-on-save.json`: `PostFileSave` on `src/**` and `tests/unit/**` runs `npm test`.
- `.kiro/hooks/verify-before-stop.json`: `Stop` runs typecheck and unit tests; a `PostFileSave` agent hook on `src/core/crypto.ts` re-states the key-custody rules.

## Call 1: generate the spec

- **Command** (from the repo root, stdin closed):
  `kiro-cli chat --no-interactive --trust-tools=fs_read,fs_write "<prompt>" </dev/null`
- **Prompt:** saved verbatim in `.kiro/prompts/switch-lifecycle-spec.txt`. It asks Kiro to read the steering files and write `.kiro/specs/switch-lifecycle/requirements.md` (EARS), `design.md` (architecture, state machine, key scheme, honest limits, Mermaid diagram) and `tasks.md`.
- **What happened:** Kiro read the steering files, planned the three files and issued three `write` calls. All three were denied: in CLI 3.x the write tool is named `write` (`fs_write` is only an alias) and the alias did not grant trust in non-interactive mode. Kiro then stopped with:
  `Error: Internal error (code -32603): Encountered an error in the response stream: The request was throttled by the service (request_id: c530b852-022e-4d1e-9da5-60734a483885)`
- **Duration:** 5 min 28 s. **Files produced:** none. **Credits:** no usage figure was printed.

## Call 2: retry with the canonical tool names

- **Command:** `kiro-cli chat --no-interactive --trust-tools=read,write,fs_read,fs_write "<same prompt>" </dev/null`
- **What happened:** throttled before any tool call:
  `Error: Internal error (code -32603): Encountered an error in the response stream: The request was throttled by the service (request_id: 32baf141-469e-4f9f-9c24-ce25dab456fe)`
- **Duration:** 20 s. **Files produced:** none. **Credits:** no usage figure was printed.

## Result

The two-call budget for this build was spent, so the spec in `.kiro/specs/switch-lifecycle/` was written by hand from the same prompt and the steering files, following Kiro's spec format (EARS requirements, design, task checklist). `scripts/kiro-spec.sh` re-runs the exact generation with the corrected tool names when credits allow; diff its output against the hand-written spec before replacing anything.

## Lesson

In Kiro CLI 3.x, trust the canonical tool names (`read`, `write`) in `--trust-tools`; the 2.x names alone are not enough in `--no-interactive` mode.

## Hardening pass (no further calls)

The security hardening (CSP and related headers, token-route rate limit, opt-in time machine) was added to the spec as Requirement 11, Requirement 9.4-9.5 and tasks 8.2-8.6. No further `kiro-cli` calls were made: the two-call budget for this build was already spent.
