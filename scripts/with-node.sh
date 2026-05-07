#!/usr/bin/env bash
# Run a command using the Node version pinned in .nvmrc, falling back to PATH.
# Used inside the agent loop because the system Node here is 16, and pnpm needs ≥ 18.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target_version="$(cat "$repo_root/.nvmrc" 2>/dev/null | tr -d '[:space:]')"

# Try ~/.nvm first
nvm_bin="$HOME/.nvm/versions/node/v${target_version}/bin"
if [[ -x "$nvm_bin/node" ]]; then
  export PATH="$nvm_bin:$PATH"
fi

exec "$@"
