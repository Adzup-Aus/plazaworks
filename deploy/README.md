# Deploy Plaza Works to Hetzner (Ubuntu)

Server: **46.62.225.112** (replace with your IP if different).

---

## One-time: Server setup

SSH into the server and run the install script. From your **local machine** (project root):

```bash
ssh root@46.62.225.112 'bash -s' < deploy/install-server.sh
```

Or on the server after cloning the repo:

```bash
cd /var/www/plazaworks   # or wherever you put the repo
sudo bash deploy/install-server.sh
```

This installs:

- Node.js 20.x  
- PostgreSQL (and creates DB + user)  
- nginx  
- PM2  

**Firewall:** The script does **not** configure UFW (so it won’t conflict with Hetzner Cloud Firewall). In the Hetzner Cloud Console, ensure your firewall allows **SSH (22)**, **HTTP (80)**, and **HTTPS (443)** as needed.

**Save the `DATABASE_URL`** printed at the end (it uses **port 5432**; local dev often uses 5433).

---

## One-time: App directory and .env

**Important:** On the server, PostgreSQL runs on **port 5432**. Your local `.env` may use 5433—don’t use that for the server. Use either a server-only `.env` or a **`.env.production`** file (see below).

1. **Put the app on the server** (e.g. clone or rsync):

   ```bash
   ssh root@46.62.225.112
   git clone https://github.com/abdabdii/plazaworks.git /var/www/plazaworks
   # or use deploy-remote.sh once to sync
   ```

2. **Provide `.env`** for the server (either create on server or use `.env.production` locally):

   - **Option A – Create on server** (one-time):

     ```bash
     ssh root@46.62.225.112
     nano /var/www/plazaworks/.env
     ```

     Contents (use the DATABASE_URL from the install script; **port 5432**):

     ```env
     DATABASE_URL=postgresql://plazaworks:YOUR_PASSWORD@localhost:5432/plazaworks
     SESSION_SECRET=your-long-random-secret
     NODE_ENV=production
     PORT=5000
     # Optional: for sending emails (OTP, quotes, invoices). Resend free tier: 3,000/month.
     # RESEND_API_KEY=re_xxxx
     # FROM_EMAIL=Plaza Works <onboarding@resend.dev>
     ```

   - **Option B – Use `.env.production`** (recommended for `deploy-remote.sh`):  
     In the project root, create `.env.production` with the same contents as above (server DATABASE_URL, port 5432, and **SESSION_SECRET**). It is gitignored. `deploy-remote.sh` will copy it to the server as `.env` on each deploy. If you see *"SESSION_SECRET environment variable is required in production"* in `pm2 logs plazaworks`, add `SESSION_SECRET=...` to `.env.production` and redeploy.

3. **Enable nginx site** (so the app is served instead of the default “Welcome to nginx” page):

   ```bash
   ssh root@46.62.225.112
   cd /var/www/plazaworks && sudo bash deploy/enable-nginx-site.sh
   ```

   This disables the default nginx site and enables the Plaza Works proxy to your Node app on port 5000.

---

## Deploy / update the app

### Option A: From your machine (recommended)

From the **project root** on your laptop:

```bash
./deploy/deploy-remote.sh 46.62.225.112
```

This rsyncs the code, pushes `.env.production` (or `.env`) to the server as `.env`, then runs `deploy/deploy.sh`. Use `.env.production` with **port 5432** and the DATABASE_URL from the install script so `db:push` and the app can connect.

### Option B: On the server

```bash
ssh root@46.62.225.112
cd /var/www/plazaworks
git pull   # if you use git
bash deploy/deploy.sh
```

---

## Scripts overview

| Script | Where to run | Purpose |
|--------|----------------|--------|
| `install-server.sh` | Once on server (or via `ssh ... 'bash -s' < deploy/install-server.sh`) | Install Node, PostgreSQL, nginx, PM2, DB (no UFW; use Hetzner firewall) |
| `deploy.sh` | On server, from app dir | `npm ci`, build, db:push, PM2 reload |
| `deploy-remote.sh` | Local, from project root | Rsync code to server + run `deploy.sh` |
| `nginx-plazaworks.conf` | Copy to `/etc/nginx/sites-available/` | Nginx reverse proxy to Node on port 5000 |
| `ecosystem.config.cjs` | Used by PM2 | PM2 process config for the app |

---

## Useful commands on the server

```bash
# App logs
pm2 logs plazaworks

# Restart app
pm2 reload plazaworks

# Nginx
systemctl status nginx
nginx -t && systemctl reload nginx
```

---

## HTTPS (optional)

For TLS with Let’s Encrypt:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com
```

Then in nginx config, use `listen 443 ssl` and the paths Certbot adds. Restart nginx after changes.
