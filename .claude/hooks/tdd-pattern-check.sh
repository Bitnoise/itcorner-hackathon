#!/usr/bin/env bash
# PostToolUse hook on Bash matcher.
# Runs after every Bash tool call. Watches for `git commit` and validates the TDD pattern.
#
# Pattern enforced:
#   - feat(green): or fix(green): commits MUST be preceded by a test(red): commit on the same branch
#   - The reverse (test(red) without subsequent feat/fix(green) on the same branch) is fine — work in progress.
#
# Exit codes per Claude Code hook spec:
#   0  — silent pass
#   2  — block: write feedback to stderr, Claude reads it
#   *  — non-blocking error
#
# This hook only validates AFTER a commit has happened. It cannot prevent a commit, but it
# tells Claude to revert and redo if the pattern was violated.

set -euo pipefail

# Only act on git commit invocations
if ! echo "${CLAUDE_TOOL_INPUT_COMMAND:-}" | grep -qE '^git commit'; then
  exit 0
fi

# Get last commit message
last_msg=$(git log -1 --format="%s" 2>/dev/null || echo "")

# We only enforce on green commits
if ! echo "$last_msg" | grep -qE '^(feat|fix)\(green\)'; then
  exit 0
fi

# Look at the previous commit on this branch
prev_msg=$(git log -2 --format="%s" 2>/dev/null | tail -n 1 || echo "")

if echo "$prev_msg" | grep -qE '^test\(red\)'; then
  # Pattern OK
  exit 0
fi

# Pattern violated
cat <<EOF >&2
TDD VIOLATION: a $(echo "$last_msg" | grep -oE '^(feat|fix)\(green\)') commit must be preceded by a test(red) commit on the same branch.

Last commit:     $last_msg
Previous commit: $prev_msg

Required workflow:
  1. Write a failing test
  2. Run it, confirm it fails for the right reason
  3. git commit -m "test(red): <what>"
  4. Implement minimal code to make it pass
  5. Run, confirm it passes
  6. git commit -m "feat(green): <what>" or "fix(green): <what>"

Recovery:
  git reset --soft HEAD~1
  Then split your changes: stage and commit the test alone first as test(red),
  then stage and commit the implementation as feat(green) or fix(green).
EOF
exit 2
