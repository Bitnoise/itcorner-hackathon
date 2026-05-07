#!/usr/bin/env bash
# Single iteration of the agent loop in interactive mode.
# Use for debugging, dry-runs, and as a fallback when afk.sh has issues.

set -euo pipefail

context=$(./agent-loop/build-context.sh)
prompt=$(cat agent-loop/prompt.md)

claude \
  --permission-mode acceptEdits \
  "$context

$prompt"
