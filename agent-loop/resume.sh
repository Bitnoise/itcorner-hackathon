#!/usr/bin/env bash
# Transition: PAUSED → RUNNING

set -euo pipefail

STATE_FILE="agent-loop/state"
echo "RUNNING" > "$STATE_FILE"
echo "[agent-loop] state=RUNNING"
