#!/usr/bin/env bash
# Collect end-of-day metrics from GitHub, git log, and agent loop logs.
# Output: docs/METRICS.md (overwritten).
# Run once at H+9:00 on hackathon day.

set -euo pipefail

OUT="docs/METRICS.md"
LOG_DIR="agent-loop/logs"

# Helpers
section() { printf "\n## %s\n\n" "$1" >> "$OUT"; }
field() { printf "- **%s:** %s\n" "$1" "$2" >> "$OUT"; }

# --- Header ---
cat > "$OUT" <<EOF
# Metrics report — $(date '+%Y-%m-%d %H:%M')

EOF

# --- Headline (must-have) ---
section "Headline metrics"

# Iterations: count [agent] step=picking lines across all main logs
total_iter=$(grep -h 'step=picking' "$LOG_DIR"/main-*.log 2>/dev/null | wc -l | tr -d ' ' || echo 0)
shipped=$(grep -h 'step=pr ' "$LOG_DIR"/main-*.log 2>/dev/null | wc -l | tr -d ' ' || echo 0)
stuck_count=$(grep -h 'step=stuck' "$LOG_DIR"/main-*.log 2>/dev/null | wc -l | tr -d ' ' || echo 0)

success_pct="?"
if [ "$total_iter" -gt 0 ]; then
  success_pct=$(awk "BEGIN{printf \"%.0f\", ($shipped/$total_iter)*100}")
fi

field "Iterations total" "$total_iter"
field "Iterations shipped (PR opened)" "$shipped"
field "Iterations stuck" "$stuck_count"
field "Success rate" "${success_pct}%"

# TDD compliance — count of test(red) vs feat/fix(green) commits across all branches
red_count=$(git log --all --grep='^test(red)' --oneline 2>/dev/null | wc -l | tr -d ' ' || echo 0)
green_count=$(git log --all --grep='^\(feat\|fix\)(green)' --oneline 2>/dev/null | wc -l | tr -d ' ' || echo 0)

field "TDD red commits" "$red_count"
field "TDD green commits" "$green_count"
field "TDD ratio (red:green)" "${red_count}:${green_count}"

# Bugs
if command -v gh >/dev/null 2>&1; then
  bug_total=$(gh issue list --label bug --state all --json number --jq 'length' 2>/dev/null || echo 0)
  bug_closed=$(gh issue list --label bug --state closed --json number --jq 'length' 2>/dev/null || echo 0)
  bug_escalated=$(gh issue list --label needs-human-fix --state all --json number --jq 'length' 2>/dev/null || echo 0)
  bug_cannot_repro=$(gh issue list --label cannot-reproduce --state all --json number --jq 'length' 2>/dev/null || echo 0)

  field "Bugs caught by QA (total)" "$bug_total"
  field "Bugs auto-fixed by loop" "$bug_closed"
  field "Bugs escalated (needs-human-fix)" "$bug_escalated"
  field "Bugs cannot-reproduce" "$bug_cannot_repro"

  # First-try QA: closed issues without bug children
  closed_total=$(gh issue list --state closed --json number --jq 'length' 2>/dev/null || echo 0)
  field "Issues closed total" "$closed_total"
  field "First-try QA estimate" "$(awk "BEGIN{if($closed_total==0){print \"n/a\"}else{printf \"%.0f%%\", (($closed_total-$bug_total)/$closed_total)*100}}")"
fi

# --- Loop state distribution ---
section "Loop operations"

if [ -d "$LOG_DIR" ]; then
  log_count=$(ls "$LOG_DIR"/main-*.log 2>/dev/null | wc -l | tr -d ' ' || echo 0)
  field "Main loop runs (start.sh count)" "$log_count"

  # Approximate RUNNING time: earliest log timestamp to latest log line in any main log
  earliest=$(ls "$LOG_DIR"/main-*.log 2>/dev/null | sort | head -n 1 || echo "")
  latest=$(ls "$LOG_DIR"/main-*.log 2>/dev/null | sort | tail -n 1 || echo "")

  if [ -n "$earliest" ] && [ -n "$latest" ]; then
    start_t=$(stat -c %Y "$earliest" 2>/dev/null || stat -f %m "$earliest" 2>/dev/null || echo 0)
    end_t=$(stat -c %Y "$latest" 2>/dev/null || stat -f %m "$latest" 2>/dev/null || echo 0)
    if [ "$start_t" -gt 0 ] && [ "$end_t" -gt 0 ]; then
      span_min=$(( (end_t - start_t) / 60 ))
      field "Approximate elapsed loop time" "${span_min} min"
    fi
  fi
fi

# --- Nice-to-have ---
section "Detailed metrics"

# Manual interventions
manual_commits=$(git log --all --grep='^chore(manual)' --oneline 2>/dev/null | wc -l | tr -d ' ' || echo 0)
field "Manual commits (chore(manual))" "$manual_commits"

# PR stats
if command -v gh >/dev/null 2>&1; then
  pr_open=$(gh pr list --state open --json number --jq 'length' 2>/dev/null || echo 0)
  pr_merged=$(gh pr list --state merged --json number --jq 'length' 2>/dev/null || echo 0)
  field "PRs open" "$pr_open"
  field "PRs merged" "$pr_merged"

  # Average PR size
  if [ "$pr_merged" -gt 0 ]; then
    avg_size=$(gh pr list --state merged --json additions,deletions --jq '[.[] | (.additions + .deletions)] | add / length' 2>/dev/null || echo "?")
    field "Average PR size (lines changed)" "$(printf '%.0f' "$avg_size" 2>/dev/null || echo "$avg_size")"
  fi
fi

# Light reviewer stats from logs
review_total=$(grep -h 'step=review' "$LOG_DIR"/main-*.log 2>/dev/null | wc -l | tr -d ' ' || echo 0)
review_approved=$(grep -h 'step=review approved=true' "$LOG_DIR"/main-*.log 2>/dev/null | wc -l | tr -d ' ' || echo 0)
field "Light reviewer invocations" "$review_total"
if [ "$review_total" -gt 0 ]; then
  approved_pct=$(awk "BEGIN{printf \"%.0f%%\", ($review_approved/$review_total)*100}")
  field "Light reviewer first-try approval" "$approved_pct"
fi

# Bug iterations
bug_iterations=$(grep -h '^bugfix/' "$LOG_DIR"/main-*.log 2>/dev/null | wc -l | tr -d ' ' || echo 0)
field "Bugfix iterations" "$bug_iterations"

# --- Footer ---
section "Notes"

cat >> "$OUT" <<EOF
- Generated by \`scripts/collect-metrics.sh\` at $(date '+%H:%M:%S')
- Source: GitHub API (gh CLI), git log, agent-loop/logs/main-*.log
- Some figures are approximations — see RETRO.md for qualitative context
EOF

echo "Wrote $OUT"
echo
echo "Preview:"
echo "---"
head -n 40 "$OUT"
echo "---"
echo "Full report: $OUT"
