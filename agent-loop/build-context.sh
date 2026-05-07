#!/usr/bin/env bash
# Build the operational context for one agent loop iteration.
# Outputs to stdout — afk.sh captures and prepends it to the prompt.
#
# Layered context (cheap → rich):
#   1. CLAUDE.md
#   2. docs/ARCHITECTURE_RULES.md
#   3. docs/GLOSSARY.md
#   4. docs/ADRs/*.md
#   5. docs/PRD.md
#   6. Last 5 commits
#   7. Open AFK issues (not blocked, not in-progress, not stuck, not cannot-reproduce, not needs-human-fix)
#   8. For bug issues: parent issue body + parent PR diff + parent PR comments

set -euo pipefail

section() { printf "\n## %s\n\n" "$1"; }

section "CLAUDE.md"
cat CLAUDE.md 2>/dev/null || echo "(missing)"

section "ARCHITECTURE_RULES.md"
cat docs/ARCHITECTURE_RULES.md 2>/dev/null || echo "(missing)"

section "GLOSSARY.md"
cat docs/GLOSSARY.md 2>/dev/null || echo "(missing)"

section "ADRs"
if [ -d docs/ADRs ] && [ -n "$(ls -A docs/ADRs 2>/dev/null)" ]; then
  for adr in docs/ADRs/*.md; do
    [ -f "$adr" ] || continue
    echo "### $(basename "$adr")"
    cat "$adr"
    echo
  done
else
  echo "(none yet)"
fi

section "PRD.md"
cat docs/PRD.md 2>/dev/null || echo "(missing)"

section "Recent commits"
git log -n 5 --format="%h %ad %s%n%b---" --date=short 2>/dev/null || echo "(no commits)"

section "Open AFK issues (eligible for this iteration)"
if command -v gh >/dev/null 2>&1; then
  gh issue list \
    --state open \
    --label afk \
    --json number,title,body,labels \
    --jq '
      [.[] | select(
        (.labels | map(.name)) as $l |
        ($l | contains(["blocked"]) | not) and
        ($l | contains(["in-progress"]) | not) and
        ($l | contains(["stuck"]) | not) and
        ($l | contains(["cannot-reproduce"]) | not) and
        ($l | contains(["needs-human-fix"]) | not)
      )]
    ' 2>/dev/null || echo "(gh CLI unavailable or auth missing)"
else
  echo "(gh CLI not installed)"
fi

# Bug context — only if the SELECTED_ISSUE_NUM env var is set (afk.sh sets it after picking)
if [ -n "${SELECTED_ISSUE_NUM:-}" ] && [ -n "${SELECTED_ISSUE_IS_BUG:-}" ]; then
  section "Bug context for #${SELECTED_ISSUE_NUM}"

  # Find parent number from the parent:<N> label
  parent_num=$(gh issue view "$SELECTED_ISSUE_NUM" --json labels \
    --jq '.labels[] | select(.name | startswith("parent:")) | .name | sub("parent:"; "")' 2>/dev/null || echo "")

  if [ -n "$parent_num" ]; then
    echo "### Parent issue #$parent_num"
    gh issue view "$parent_num" --json body,comments --jq '.body, (.comments[]? | .body)' 2>/dev/null || echo "(could not fetch parent)"

    # Find merged PR that closed parent
    parent_pr=$(gh pr list --state merged --search "closes #$parent_num in:body" --json number --jq '.[0].number' 2>/dev/null || echo "")

    if [ -n "$parent_pr" ]; then
      echo
      echo "### Parent PR #$parent_pr — diff"
      gh pr diff "$parent_pr" 2>/dev/null | head -500 || echo "(could not fetch diff)"

      echo
      echo "### Parent PR #$parent_pr — review comments"
      gh pr view "$parent_pr" --json comments,reviews \
        --jq '.reviews[]?.body, .comments[]?.body' 2>/dev/null || echo "(no reviews)"
    fi
  else
    echo "(no parent: label found — bug issue malformed)"
  fi
fi

section "End of context"
