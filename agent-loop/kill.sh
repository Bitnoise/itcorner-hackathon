#!/usr/bin/env bash
# Hard kill of the loop process + cleanup of in-progress labels.
# Use only when the loop is hung and graceful stop won't work.
#
# CRITICAL: this script MUST clean up `in-progress` labels, otherwise no future
# iteration will pick those issues (semaphore deadlock).

set -euo pipefail

STATE_FILE="agent-loop/state"
PID_FILE="agent-loop/main.pid"

# Kill the process
if [ -f "$PID_FILE" ]; then
  pid=$(cat "$PID_FILE")
  if kill -0 "$pid" 2>/dev/null; then
    echo "[agent-loop] killing pid=$pid"
    kill -9 "$pid" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

echo "STOPPED" > "$STATE_FILE"

# Critical: clean up in-progress labels so issues are pickable again
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  in_progress_issues=$(gh issue list --label in-progress --state open --json number --jq '.[].number' 2>/dev/null || echo "")

  if [ -n "$in_progress_issues" ]; then
    echo "[agent-loop] cleaning up in-progress labels..."
    while IFS= read -r num; do
      [ -z "$num" ] && continue
      gh issue edit "$num" --remove-label in-progress 2>/dev/null || true
      gh issue comment "$num" --body "Iteration killed by Operator. Free for retry on next loop start." 2>/dev/null || true
      echo "  cleared: #$num"
    done <<< "$in_progress_issues"
  else
    echo "[agent-loop] no in-progress issues to clean up"
  fi
else
  echo "[agent-loop] WARNING: gh CLI unavailable, could not clean up in-progress labels manually" >&2
  echo "  You must manually run: gh issue list --label in-progress" >&2
  echo "  And remove the label from each affected issue." >&2
fi

echo "[agent-loop] killed. state=STOPPED"
