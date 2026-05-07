#!/usr/bin/env bash
# Transition: STOPPED → RUNNING
# Spawns afk.sh in the background, captures pid.

set -euo pipefail

STATE_FILE="agent-loop/state"
PID_FILE="agent-loop/main.pid"
LOG_DIR="agent-loop/logs"
MAX_ITER="${1:-50}"

mkdir -p "$LOG_DIR"

# Refuse to start if already running
if [ -f "$PID_FILE" ]; then
  pid=$(cat "$PID_FILE")
  if kill -0 "$pid" 2>/dev/null; then
    echo "[agent-loop] already running (pid=$pid). Use stop.sh or kill.sh first." >&2
    exit 1
  fi
  echo "[agent-loop] stale pid file detected, cleaning up"
  rm -f "$PID_FILE"
fi

echo "RUNNING" > "$STATE_FILE"

logfile="$LOG_DIR/main-$(date +%Y%m%d-%H%M%S).log"
nohup ./agent-loop/afk.sh "$MAX_ITER" > "$logfile" 2>&1 &
echo $! > "$PID_FILE"

echo "[agent-loop] started"
echo "  pid:    $(cat "$PID_FILE")"
echo "  log:    $logfile"
echo "  state:  RUNNING"
echo
echo "Tail logs:    tail -f $logfile | grep '\[agent\]'"
echo "Status:       ./agent-loop/status.sh"
echo "Pause:        ./agent-loop/pause.sh"
echo "Stop:         ./agent-loop/stop.sh"
echo "Hard kill:    ./agent-loop/kill.sh"
