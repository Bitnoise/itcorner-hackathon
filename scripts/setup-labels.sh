#!/usr/bin/env bash
# Set up all required labels in the GitHub repo.
# Run once after creating the repo on GitHub:
#   ./scripts/setup-labels.sh

set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required. Install: https://cli.github.com" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Not authenticated. Run: gh auth login" >&2
  exit 1
fi

# Format: name|color|description
labels=(
  "afk|0e8a16|Eligible for the main agent loop"
  "afk-burst|c2e0c6|Eligible for burst worktrees (parallel pool)"
  "hitl|d93f0b|Requires human implementation, not the loop"
  "bug|d73a4a|Bug detected by QA, includes proposed failing test"
  "priority:1|e11d21|Priority 1 — bugs default here"
  "priority:2|fbca04|Priority 2"
  "priority:3|cccccc|Priority 3"
  "slice|1d76db|Vertical tracer-bullet slice"
  "in-progress|fbca04|Currently being worked on by an iteration (semaphore)"
  "blocked|b60205|Dependency not yet met"
  "qa-ready|0e8a16|PR opened, awaiting human QA"
  "qa-failed|d73a4a|QA failed — see bug issue (informational on parent)"
  "stuck|f29513|Loop attempted 3+ times unsuccessfully"
  "cannot-reproduce|f9d0c4|Proposed test does not fail — bug not reproducible"
  "needs-human-fix|b60205|Escalated after 3 nested levels of bug-of-bug"
  "needs-triage|c5def5|Awaiting human triage"
)

for entry in "${labels[@]}"; do
  IFS='|' read -r name color desc <<< "$entry"
  if gh label list --json name --jq '.[].name' | grep -q "^${name}$"; then
    echo "  [skip]   $name (already exists)"
  else
    gh label create "$name" --color "$color" --description "$desc" >/dev/null
    echo "  [create] $name"
  fi
done

echo
echo "Labels ready. Note: 'parent:<num>' labels are created on demand by /qa-fail."
