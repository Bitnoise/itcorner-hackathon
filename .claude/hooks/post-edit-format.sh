#!/usr/bin/env bash
# PostToolUse hook on Write|Edit|MultiEdit.
# Auto-formats and lints the file that was just edited so the agent doesn't waste tokens on formatting.

set -euo pipefail

file="${1:-}"
[ -z "$file" ] && exit 0
[ ! -f "$file" ] && exit 0

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.md)
    # Format with prettier if available (silent)
    if command -v pnpm >/dev/null 2>&1; then
      pnpm exec prettier --write --log-level silent "$file" 2>/dev/null || true
    fi
    # ESLint --fix on TS/JS only
    case "$file" in
      *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs)
        if command -v pnpm >/dev/null 2>&1; then
          pnpm exec eslint --fix --quiet "$file" 2>/dev/null || true
        fi
        ;;
    esac
    ;;
esac

exit 0
