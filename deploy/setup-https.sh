#!/usr/bin/env bash
# Obtain a Let's Encrypt certificate for app.plazaworks.com.au so Cloudflare can use Full (strict).
# Run on the server (as root): CERTBOT_EMAIL=you@example.com sudo -E bash deploy/setup-https.sh
# Or: sudo bash deploy/setup-https.sh   (will prompt for email)

set -e

DOMAIN="${CERTBOT_DOMAIN:-app.plazaworks.com.au}"
EMAIL="${CERTBOT_EMAIL:-}"

if [[ -z "$EMAIL" ]]; then
  echo "Let's Encrypt requires an email for expiry notices."
  read -p "Enter your email: " EMAIL
  if [[ -z "$EMAIL" ]]; then
    echo "Aborting. Set CERTBOT_EMAIL=you@example.com and re-run, or enter email when prompted."
    exit 1
  fi
fi

echo "Installing certbot and nginx plugin (if needed)..."
apt-get update -qq
apt-get install -y certbot python3-certbot-nginx

echo "Obtaining certificate for ${DOMAIN}..."
certbot --nginx -d "$DOMAIN" \
  --non-interactive \
  --agree-tos \
  -m "$EMAIL" \
  --redirect

echo ""
echo "HTTPS is set up. Certbot will auto-renew. In Cloudflare set SSL/TLS to Full (strict)."
echo "Test: https://${DOMAIN}"
