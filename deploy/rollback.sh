#!/usr/bin/env bash
# 手动回滚到上一个成功发布的 release。
set -euo pipefail

ROOT="${RETAILOS_ROOT:-/opt/retailos}"
SERVICE="${RETAILOS_SERVICE:-retailos}"
HEALTH_URL="${RETAILOS_HEALTH_URL:-http://127.0.0.1:3000/api/health/ready}"
PREVIOUS_FILE="$ROOT/previous-release"

if [ ! -f "$PREVIOUS_FILE" ]; then
  echo "no previous release recorded" >&2
  exit 1
fi

TARGET="$(cat "$PREVIOUS_FILE")"
if [ -z "$TARGET" ] || [ ! -d "$TARGET" ]; then
  echo "previous release missing: $TARGET" >&2
  exit 1
fi

CURRENT="$(readlink -f "$ROOT/current" 2>/dev/null || true)"
ln -sfn "$TARGET" "$ROOT/current"
sudo systemctl restart "$SERVICE"

for _ in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    if [ -n "$CURRENT" ] && [ "$CURRENT" != "$TARGET" ]; then
      printf '%s\n' "$CURRENT" > "$PREVIOUS_FILE"
    fi
    echo "ROLLBACK OK $TARGET"
    exit 0
  fi
  sleep 2
done

echo "rollback health check failed: $TARGET" >&2
exit 1
