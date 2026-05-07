#!/usr/bin/env bash
# Transition: any → STOPPED (graceful)
# Current iteration finishes, then the loop exits cleanly.

set -euo pipefail

STATE_FILE="agent-loop/state"
echo "STOPPED" > "$STATE_FILE"
echo "[agent-loop] state=STOPPED"
echo "  Current iteration will finish, then the loop will exit."
echo "  For immediate kill: ./agent-loop/kill.sh"
