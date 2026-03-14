#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."

export DATABASE_URL="${DATABASE_URL:-file:./dev.db}"

MODE="${1:-dev}"

case "$MODE" in
  dev)
    echo "[start] Development mode — hot reload enabled"
    node server.js
    ;;
  prod|production)
    echo "[start] Production mode — building..."
    npm run build
    echo "[start] Starting production server..."
    NODE_ENV=production node server.js
    ;;
  build)
    echo "[start] Building for production..."
    npm run build
    echo "[start] Build complete. Run: npm run prod"
    ;;
  *)
    echo "Usage: $0 {dev|prod|build}"
    exit 1
    ;;
esac
