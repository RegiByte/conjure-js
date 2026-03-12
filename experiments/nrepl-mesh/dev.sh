#!/usr/bin/env bash
# Start two local mesh nodes connected to local Redis.
#
# Prerequisites:
#   docker compose up -d   (starts Redis on localhost:6379)
#
# Usage:
#   ./dev.sh               starts node1 (port 7888) and node2 (port 7889)
#   ./dev.sh node1         starts only node1
#
# Env overrides:
#   REDIS_URL=redis://localhost:6379  (default)
#   NODE1_PORT=7888                   (default)
#   NODE2_PORT=7889                   (default)

set -e
cd "$(dirname "$0")"

# Load .env if present (before defaults so .env values take effect)
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
NODE1_PORT="${NODE1_PORT:-7891}"
NODE2_PORT="${NODE2_PORT:-7892}"

# Color prefixes for readability
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

prefix_output() {
  local label="$1"
  local color="$2"
  while IFS= read -r line; do
    printf "${color}[%s]${NC} %s\n" "$label" "$line"
  done
}

cleanup() {
  echo ""
  echo "Stopping nodes..."
  kill "$PID1" "$PID2" 2>/dev/null || true
  wait "$PID1" "$PID2" 2>/dev/null || true
  echo "Done."
}

trap cleanup INT TERM

NODE_ID=node1 REDIS_URL="$REDIS_URL" \
  bun src/worker.ts 2>&1 | prefix_output "node1" "$BLUE" &
PID1=$!

NODE_ID=node2 REDIS_URL="$REDIS_URL" \
  bun src/worker.ts 2>&1 | prefix_output "node2" "$RED" &
PID2=$!

echo "Started worker node1 (PID $PID1) and node2 (PID $PID2)"
echo "Redis: $REDIS_URL"
echo "Run 'bun run repl' in another terminal to connect your editor."
echo "Press Ctrl+C to stop both workers."
echo ""

wait
