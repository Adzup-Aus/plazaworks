#!/usr/bin/env bash
# Deploy from your local machine to the Hetzner server.
# Usage: ./deploy/deploy-remote.sh [server_ip]
# Example: ./deploy/deploy-remote.sh 46.62.225.112
# Requires: rsync, ssh. Run from project root.
#
# Env file: uses .env.production if present (server DB is port 5432), else .env.
# Create .env.production with DATABASE_URL from install-server.sh output.

set -e

SERVER="${1:-46.62.225.112}"
REMOTE_USER="${REMOTE_USER:-root}"
APP_DIR="/var/www/plazaworks"

echo "Deploying to ${REMOTE_USER}@${SERVER}:${APP_DIR}"

# Sync project (exclude node_modules, .git, dev artifacts, .env so we push the right one)
rsync -avz --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude dist \
  --exclude .env \
  --exclude "*.log" \
  ./ "${REMOTE_USER}@${SERVER}:${APP_DIR}/"

# Push .env: prefer .env.production (server uses Postgres on port 5432)
if [[ -f .env.production ]]; then
  echo "Using .env.production for server .env"
  scp .env.production "${REMOTE_USER}@${SERVER}:${APP_DIR}/.env"
elif [[ -f .env ]]; then
  echo "Using .env for server .env (ensure DATABASE_URL uses port 5432 on server)"
  scp .env "${REMOTE_USER}@${SERVER}:${APP_DIR}/.env"
else
  echo "No .env or .env.production found locally."
  if ! ssh "${REMOTE_USER}@${SERVER}" "test -f ${APP_DIR}/.env"; then
    echo "Aborting: no .env on server. Create .env.production (or .env) with server DATABASE_URL, or create .env on the server (see deploy/README.md)."
    exit 1
  fi
  echo "Using existing .env on server."
fi

# On server: run deploy
ssh "${REMOTE_USER}@${SERVER}" "cd ${APP_DIR} && bash deploy/deploy.sh"

echo "Deploy complete. Open http://${SERVER}"
