#!/usr/bin/env bash
# Spawn a burst worktree + a parallel agent loop on a separate label pool.
# Burst loops draw from `afk-burst` label only — humans manually mark issues as safe for parallel work.
#
# Usage:
#   ./agent-loop/burst.sh <N>      # N is a small integer, e.g. 1 or 2
#
# Maximum 2-3 concurrent burst worktrees.

set -euo pipefail

N="${1:-}"
if [ -z "$N" ]; then
  echo "Usage: $0 <N>" >&2
  exit 1
fi

WORKTREE_PATH="../$(basename "$PWD")-burst-$N"
BRANCH="burst/$N"
PID_FILE="agent-loop/burst-$N.pid"
LOG_DIR="agent-loop/logs"
LOGFILE="$LOG_DIR/burst-$N-$(date +%Y%m%d-%H%M%S).log"

mkdir -p "$LOG_DIR"

# Refuse if this burst is already running
if [ -f "$PID_FILE" ]; then
  pid=$(cat "$PID_FILE")
  if kill -0 "$pid" 2>/dev/null; then
    echo "[burst-$N] already running (pid=$pid)" >&2
    exit 1
  fi
  rm -f "$PID_FILE"
fi

# Create worktree if it doesn't exist
if [ ! -d "$WORKTREE_PATH" ]; then
  echo "[burst-$N] creating worktree at $WORKTREE_PATH on branch $BRANCH"
  git worktree add "$WORKTREE_PATH" -b "$BRANCH" main
else
  echo "[burst-$N] worktree exists at $WORKTREE_PATH"
fi

# Run a modified agent loop in the worktree, drawing from afk-burst
# We use a wrapper that overrides the label filter
cat > "$WORKTREE_PATH/agent-loop/burst-pool.env" <<EOF
LABEL_POOL=afk-burst
BURST_N=$N
EOF

cd "$WORKTREE_PATH"
nohup bash -c '
  export $(cat agent-loop/burst-pool.env | xargs)
  ./agent-loop/afk.sh 30
' > "$LOGFILE" 2>&1 &

cd - >/dev/null
echo $! > "$PID_FILE"

echo "[burst-$N] started"
echo "  worktree: $WORKTREE_PATH"
echo "  branch:   $BRANCH"
echo "  pool:     afk-burst (separate from main loop)"
echo "  pid:      $(cat "$PID_FILE")"
echo "  log:      $LOGFILE"
echo
echo "Issues to make available to this burst:"
echo "  gh issue edit <num> --add-label afk-burst --remove-label afk"
echo
echo "Stop:  kill \$(cat $PID_FILE) && git worktree remove $WORKTREE_PATH"
