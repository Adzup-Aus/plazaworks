#!/usr/bin/env bash
# Deploy or update Plaza Works on the server.
# Run from the app directory, or from repo root: bash deploy/deploy.sh
# On server, default app dir is /var/www/plazaworks (create with install-server.sh).
# If that path does not exist, uses the repo root (parent of deploy/).

set -e

APP_DIR="${APP_DIR:-/var/www/plazaworks}"
if [[ ! -d "$APP_DIR" ]]; then
  APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
  echo "Using app dir: $APP_DIR"
fi
cd "$APP_DIR"

echo "[1/6] Installing dependencies..."
npm i

echo "[2/6] Building..."
npm run build

echo "[3/6] Pushing database schema (if needed)..."
npm run db:push || true

echo "[4/6] Pruning dev dependencies..."
npm prune --production

echo "[5/6] Restarting app with PM2..."
if ! command -v pm2 >/dev/null 2>&1; then
  echo "PM2 not found (install with: npm i -g pm2). Skipping PM2 step."
  echo "[6/6] Deploy finished (run with PM2 on the server)."
else
  mkdir -p "$APP_DIR/logs/pm2"
  if pm2 describe plazaworks >/dev/null 2>&1; then
    pm2 reload plazaworks
  else
    pm2 start deploy/ecosystem.config.cjs
    pm2 save
    pm2 startup systemd || true
  fi
  echo "[6/6] Done."
  pm2 status plazaworks
fi
