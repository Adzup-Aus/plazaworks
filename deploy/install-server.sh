#!/usr/bin/env bash
# One-time server setup for Plaza Works on Ubuntu (Hetzner).
# Run as root: sudo bash install-server.sh
# Or from local: ssh root@YOUR_SERVER_IP 'bash -s' < deploy/install-server.sh

set -e

echo "[1/7] Updating system..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

echo "[2/7] Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v
npm -v

echo "[3/7] Installing PostgreSQL..."
apt-get install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

echo "[4/7] Creating PostgreSQL database and user..."
# Replace with your desired DB name and password; or set via env when running.
DB_NAME="${PLAZA_DB_NAME:-plazaworks}"
DB_USER="${PLAZA_DB_USER:-plazaworks}"
DB_PASS="${PLAZA_DB_PASS:-$(openssl rand -base64 24)}"

sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"

echo "Database URL (save this for .env):"
echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
echo ""

echo "[5/7] Installing nginx..."
apt-get install -y nginx
systemctl enable nginx

echo "[6/7] Installing PM2..."
npm install -g pm2

# Firewall: using Hetzner Cloud Firewall (no UFW on the server).

echo "[7/7] Creating app directory..."
mkdir -p /var/www/plazaworks
chown -R www-data:www-data /var/www/plazaworks || true

echo ""
echo "=== Server setup complete ==="
echo "1. Add your app (git clone or rsync) to /var/www/plazaworks"
echo "2. Create /var/www/plazaworks/.env with DATABASE_URL and SESSION_SECRET"
echo "3. Run deploy/deploy.sh from the app directory (or use deploy-remote.sh from your machine)"
echo "4. Copy nginx config: cp deploy/nginx-plazaworks.conf /etc/nginx/sites-available/plazaworks && ln -sf /etc/nginx/sites-available/plazaworks /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx"
echo ""
echo "Database credentials (save securely):"
echo "  DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
