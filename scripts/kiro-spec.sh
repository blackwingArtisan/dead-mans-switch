#!/usr/bin/env bash
# Regenerates the switch-lifecycle spec with Kiro from the steering files.
# Run from the repository root. Uses Kiro credits.
set -euo pipefail
mkdir -p .kiro/specs/switch-lifecycle
kiro-cli chat --no-interactive --trust-tools=read,write,fs_read,fs_write \
  "$(cat .kiro/prompts/switch-lifecycle-spec.txt)" </dev/null
