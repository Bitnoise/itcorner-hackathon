#!/usr/bin/env bash
# Main agent loop. Runs N iterations max, reads ./agent-loop/state on each iteration to honor pause/stop.
# Usage:
#   ./agent-loop/afk.sh <max_iterations>
#
# Designed to be backgrounded by start.sh.

set -euo pipefail

MAX_ITERATIONS="${1:-20}"
STATE_FILE="agent-loop/state"
PID_FILE="agent-loop/main.pid"
LOG_DIR="agent-loop/logs"

# Defensive: start.sh creates LOG_DIR, but if it gets removed between runs
# (manual cleanup, agent misstep, etc.) we want every entry point to recover
# rather than silently lose the next log redirect.
mkdir -p "$LOG_DIR"

iter=0

# jq filter to extract streaming text from assistant messages
stream_text='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'
# jq filter to extract final result text
final_result='select(.type == "result").result // empty'

while [ "$iter" -lt "$MAX_ITERATIONS" ]; do
  iter=$((iter + 1))

  # Honor state
  state="STOPPED"
  [ -f "$STATE_FILE" ] && state=$(cat "$STATE_FILE")

  case "$state" in
    STOPPED)
      echo "[agent-loop] state=STOPPED, exiting"
      rm -f "$PID_FILE"
      exit 0
      ;;
    PAUSED)
      echo "[agent-loop] state=PAUSED, idling 30s..."
      sleep 30
      iter=$((iter - 1))  # don't burn an iteration while paused
      continue
      ;;
    RUNNING)
      ;;
    *)
      echo "[agent-loop] unknown state: $state, exiting" >&2
      exit 1
      ;;
  esac

  echo "[agent-loop] iteration $iter / $MAX_ITERATIONS starting at $(date '+%H:%M:%S')"

  tmpfile=$(mktemp)
  trap 'rm -f "$tmpfile"' EXIT

  # Build context
  context=$(./agent-loop/build-context.sh)
  prompt=$(cat agent-loop/prompt.md)

  # Run Claude Code
  # --print: non-interactive single completion
  # --output-format stream-json: machine-parseable streaming
  # --permission-mode acceptEdits: agent loop is autonomous, accept edits without asking
  claude \
    --print \
    --permission-mode acceptEdits \
    --output-format stream-json \
    --verbose \
    "$context

$prompt" \
    | tee "$tmpfile" \
    | jq --unbuffered -rj "$stream_text" 2>/dev/null || true

  result=$(jq -r "$final_result" "$tmpfile" 2>/dev/null || echo "")

  if [[ "$result" == *"<promise>NO MORE TASKS</promise>"* ]]; then
    echo "[agent-loop] queue empty, completing after $iter iterations"
    echo "STOPPED" > "$STATE_FILE"
    rm -f "$PID_FILE"
    exit 0
  fi

  rm -f "$tmpfile"

  # Brief pause between iterations (lets you ctrl-c cleanly)
  sleep 2
done

echo "[agent-loop] max iterations ($MAX_ITERATIONS) reached, exiting"
echo "STOPPED" > "$STATE_FILE"
rm -f "$PID_FILE"
