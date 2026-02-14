#!/usr/bin/env bash
# Enable Plaza Works nginx site and disable the default welcome page.
# Run on the server (as root): sudo bash deploy/enable-nginx-site.sh
# Or from app dir: sudo bash /var/www/plazaworks/deploy/enable-nginx-site.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "Enabling nginx site for Plaza Works (app dir: ${APP_DIR})"

# Remove default site so our app handles port 80
rm -f /etc/nginx/sites-enabled/default

# Enable plazaworks site
cp "${APP_DIR}/deploy/nginx-plazaworks.conf" /etc/nginx/sites-available/plazaworks
ln -sf /etc/nginx/sites-available/plazaworks /etc/nginx/sites-enabled/

nginx -t && systemctl reload nginx
echo "Done. Visit http://$(curl -s -4 ifconfig.co 2>/dev/null || echo 'your-server-ip')/"
echo "If the app does not load, check: pm2 status plazaworks && pm2 logs plazaworks"
