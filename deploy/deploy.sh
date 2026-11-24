#!/usr/bin/env bash
# 发布脚本：解压制品、安装后端依赖、执行迁移、切换 current、重启并健康检查。
# 用法：deploy.sh <release-id> <artifact.tar.gz>
# 失败时自动切回上一个 release。
set -euo pipefail

RELEASE_ID="${1:?usage: deploy.sh <release-id> <artifact.tar.gz>}"
ARTIFACT="${2:?usage: deploy.sh <release-id> <artifact.tar.gz>}"
ROOT="${RETAILOS_ROOT:-/opt/retailos}"
SERVICE="${RETAILOS_SERVICE:-retailos}"
HEALTH_URL="${RETAILOS_HEALTH_URL:-http://127.0.0.1:3000/api/health/ready}"
TARGET="$ROOT/releases/$RELEASE_ID"
PREVIOUS="$(readlink -f "$ROOT/current" 2>/dev/null || true)"

if [ ! -f "$ARTIFACT" ]; then
  echo "artifact not found: $ARTIFACT" >&2
  exit 1
fi
if [ -e "$TARGET" ]; then
  echo "release already exists: $TARGET" >&2
  exit 1
fi

mkdir -p "$ROOT/releases" "$ROOT/shared"
mkdir -p "$TARGET"
tar -xzf "$ARTIFACT" -C "$TARGET"
test -f "$TARGET/server/dist/main.js"

cd "$TARGET/server"
npm ci --omit=dev --no-audit --no-fund

set -a
# shellcheck disable=SC1091
. "$ROOT/shared/.env"
set +a

# 用编译后的 DataSource 执行迁移，避免生产环境安装 ts-node
./node_modules/.bin/typeorm migration:run -d dist/database/data-source.js

ln -sfn "$TARGET" "$ROOT/current"
sudo systemctl restart "$SERVICE"

healthy() {
  for _ in $(seq 1 30); do
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

if healthy; then
  if [ -n "$PREVIOUS" ] && [ "$PREVIOUS" != "$TARGET" ]; then
    printf '%s\n' "$PREVIOUS" > "$ROOT/previous-release"
  fi
  echo "DEPLOY OK $RELEASE_ID"
else
  echo "health check failed, rolling back" >&2
  if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
    ln -sfn "$PREVIOUS" "$ROOT/current"
    sudo systemctl restart "$SERVICE"
  else
    rm -f "$ROOT/current"
  fi
  exit 1
fi
