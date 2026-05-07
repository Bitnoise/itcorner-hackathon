#!/usr/bin/env bash
# SessionStart hook.
# Outputs the current project state so Claude Code starts with full context.
# Output is shown to the user (and read by Claude) at session start.

set -euo pipefail

echo "=== Project state ==="
echo

# Branch
echo "Branch: $(git branch --show-current 2>/dev/null || echo '?')"
echo "Last commit: $(git log -1 --format='%h %s' 2>/dev/null || echo '?')"
echo

# Agent loop state, if active
if [ -f agent-loop/state ]; then
  echo "Agent loop state: $(cat agent-loop/state)"
  if [ -f agent-loop/main.pid ]; then
    pid=$(cat agent-loop/main.pid)
    if kill -0 "$pid" 2>/dev/null; then
      echo "Agent loop process: alive (pid=$pid)"
    else
      echo "Agent loop process: stale pid $pid (process not running)"
    fi
  fi
  echo
fi

# Open issues summary, if gh is available
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  open_count=$(gh issue list --state open --json number --jq 'length' 2>/dev/null || echo "?")
  in_progress=$(gh issue list --state open --label in-progress --json number --jq 'length' 2>/dev/null || echo "?")
  qa_ready=$(gh issue list --state open --label qa-ready --json number --jq 'length' 2>/dev/null || echo "?")
  bugs=$(gh issue list --state open --label bug --json number --jq 'length' 2>/dev/null || echo "?")
  echo "Issues: $open_count open · $in_progress in-progress · $qa_ready qa-ready · $bugs bugs"
  echo
fi

exit 0
