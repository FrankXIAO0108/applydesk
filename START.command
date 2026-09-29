#!/bin/sh
set -eu
cd "$(dirname "$0")"
APPLYDESK_NODE="$(command -v node || true)"
if [ -n "$APPLYDESK_NODE" ] && ! "$APPLYDESK_NODE" -e 'let v=process.versions.node.split(".").map(Number);process.exit(v[0]>22||v[0]===22&&v[1]>=13?0:1)'; then
  APPLYDESK_NODE=""
fi
if [ -z "$APPLYDESK_NODE" ]; then
  APPLYDESK_NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [ ! -x "$APPLYDESK_NODE" ]; then
  echo 'Node runtime not found. Open this folder in Codex and ask it to follow START_HERE.md.'
  exit 1
fi
exec "$APPLYDESK_NODE" scripts/start.mjs --open
