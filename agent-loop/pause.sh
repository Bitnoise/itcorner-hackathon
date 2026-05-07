#!/usr/bin/env bash
# Transition: RUNNING → PAUSED
# Current iteration finishes; next iteration will idle until resume.sh.

set -euo pipefail

STATE_FILE="agent-loop/state"
echo "PAUSED" > "$STATE_FILE"
echo "[agent-loop] state=PAUSED"
echo "  Current iteration will finish, next iteration will idle until resume."
echo "  Resume:  ./agent-loop/resume.sh"
