#!/usr/bin/env bash
# Aggregated snapshot of the agent loop and queue.
# Designed to run inside `watch -n 30 ./agent-loop/status.sh`.

set -euo pipefail

STATE_FILE="agent-loop/state"
PID_FILE="agent-loop/main.pid"
LOG_DIR="agent-loop/logs"

echo "================================================="
echo "  Agent loop status — $(date '+%H:%M:%S')"
echo "================================================="

# State
state="STOPPED"
[ -f "$STATE_FILE" ] && state=$(cat "$STATE_FILE")
echo "State: $state"

# Process
if [ -f "$PID_FILE" ]; then
  pid=$(cat "$PID_FILE")
  if kill -0 "$pid" 2>/dev/null; then
    echo "Process: alive (pid=$pid)"
  else
    echo "Process: DEAD (stale pid file: $pid)"
  fi
fi
echo

# Queue (requires gh)
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  echo "Queue:"
  printf "  AFK ready:        %s\n" "$(gh issue list --label afk --state open --json number,labels --jq '[.[] | select((.labels | map(.name)) as $l | ($l | contains(["blocked","in-progress","stuck","cannot-reproduce","needs-human-fix"]) | not))] | length' 2>/dev/null || echo '?')"
  printf "  In-progress:      %s\n" "$(gh issue list --label in-progress --state open --json number --jq 'length' 2>/dev/null || echo '?')"
  printf "  QA-ready:         %s\n" "$(gh issue list --label qa-ready --state open --json number --jq 'length' 2>/dev/null || echo '?')"
  printf "  Bugs open:        %s\n" "$(gh issue list --label bug --state open --json number --jq 'length' 2>/dev/null || echo '?')"
  printf "  Stuck:            %s\n" "$(gh issue list --label stuck --state open --json number --jq 'length' 2>/dev/null || echo '?')"
  printf "  Blocked:          %s\n" "$(gh issue list --label blocked --state open --json number --jq 'length' 2>/dev/null || echo '?')"
  printf "  Needs human fix:  %s\n" "$(gh issue list --label needs-human-fix --state open --json number --jq 'length' 2>/dev/null || echo '?')"
  echo

  echo "PRs:"
  printf "  Open:             %s\n" "$(gh pr list --state open --json number --jq 'length' 2>/dev/null || echo '?')"
  printf "  Merged today:     %s\n" "$(gh pr list --state merged --search "merged:>=$(date -I)" --json number --jq 'length' 2>/dev/null || echo '?')"
  echo

  echo "Current iteration:"
  in_prog=$(gh issue list --label in-progress --json number,title --jq '.[0]' 2>/dev/null || echo "")
  if [ -n "$in_prog" ] && [ "$in_prog" != "null" ]; then
    title=$(echo "$in_prog" | jq -r '.title' 2>/dev/null || echo "?")
    num=$(echo "$in_prog" | jq -r '.number' 2>/dev/null || echo "?")
    echo "  #$num: $title"
  else
    echo "  (none)"
  fi
else
  echo "Queue: gh CLI unavailable or not authenticated"
fi

# Last log line + hung-loop alert
latest_log=$(ls -t "$LOG_DIR"/main-*.log 2>/dev/null | head -n 1 || echo "")
if [ -n "$latest_log" ]; then
  echo
  echo "Latest log: $latest_log"
  last_line=$(grep '\[agent\]' "$latest_log" | tail -n 1 || echo "(no [agent] log lines yet)")
  echo "  $last_line"

  # Hung iteration alert: no log activity for >15 minutes
  if [ "$state" = "RUNNING" ]; then
    last_log_time=$(stat -c %Y "$latest_log" 2>/dev/null || stat -f %m "$latest_log" 2>/dev/null || echo "0")
    now=$(date +%s)
    if [ "$last_log_time" -gt 0 ]; then
      diff=$((now - last_log_time))
      if [ "$diff" -gt 900 ]; then
        echo
        echo "  *** ALERT: no log activity for ${diff}s — possible hung iteration ***"
        echo "  *** Consider: ./agent-loop/kill.sh                                ***"
        # Terminal bell
        printf '\a'
      fi
    fi
  fi
fi

echo "================================================="
