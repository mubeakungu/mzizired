# 🌍 Mzizibet Deployment Guide - Platform Specific

Choose your deployment platform and follow the instructions below.

---

## 🇰🇪 Option 1: HostAfrica (Recommended for Kenya)

HostAfrica is ideal for Kenyan businesses with good local support.

### Prerequisites
- HostAfrica cPanel hosting account
- SSH access enabled
- PostgreSQL database provisioned

### Step-by-Step Deployment

```bash
# 1. SSH into your server
ssh -l cpaneluser hostafricaserver.com

# 2. Navigate to public_html or create subdirectory
cd /home/cpaneluser/public_html
mkdir mzizibet
cd mzizibet

# 3. Clone repository or upload files
git clone https://github.com/yourname/mzizibet.git .

# 4. Create Python virtual environment
python3 -m venv venv
source venv/bin/activate

# 5. Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# 6. Create .env file
cp .env.example .env
# Edit .env with your PostgreSQL credentials and M-Pesa keys

# 7. Run migrations
export DATABASE_URL="postgresql://user:pass@localhost/mzizibet"
flask db upgrade

# 8. Create Gunicorn systemd service
sudo nano /etc/systemd/system/mzizibet.service
```

Add this to `/etc/systemd/system/mzizibet.service`:

```ini
[Unit]
Description=Mzizibet Flask App
After=network.target

[Service]
User=cpaneluser
WorkingDirectory=/home/cpaneluser/public_html/mzizibet
Environment="PATH=/home/cpaneluser/public_html/mzizibet/venv/bin"
ExecStart=/home/cpaneluser/public_html/mzizibet/venv/bin/gunicorn \
    --workers 4 \
    --worker-class gevent \
    --bind 127.0.0.1:8000 \
    app:create_app()
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# 9. Start the service
sudo systemctl daemon-reload
sudo systemctl start mzizibet
sudo systemctl enable mzizibet

# 10. Configure cPanel Nginx reverse proxy
# Go to cPanel > Nginx
# Add reverse proxy rule:
# Location: /
# Proxy Pass: http://127.0.0.1:8000/

# 11. Enable SSL/TLS in cPanel
# Go to AutoSSL > Run AutoSSL
```

✅ **Your app is now live at `https://yourdomain.co.ke`**

---

## 🚀 Option 2: Render.com (Recommended - Easiest)

Render offers free tier and is M-Pesa friendly for Kenya deployments.

### Prerequisites
- GitHub account with your repo
- Render account (free at render.com)
- PostgreSQL database URL

### Step-by-Step Deployment

```bash
# 1. Ensure your repo has render.yaml in root
# (already included in your project)

# 2. Push to GitHub
git add .
git commit -m "Ready for deployment"
git push origin main

# 3. Go to Render.com and sign up/login

# 4. Click "New" > "Web Service"
# Select your GitHub repository
# Choose "Python"
# Build command: pip install -r requirements.txt
# Start command: gunicorn --worker-class gevent --workers 4 --bind 0.0.0.0:8000 'app:create_app()'

# 5. Set Environment Variables in Dashboard:
FLASK_ENV=production
FLASK_DEBUG=False
SECRET_KEY=<generate-strong-key>
DATABASE_URL=<your-postgresql-url>
MPESA_CONSUMER_KEY=<your-key>
MPESA_CONSUMER_SECRET=<your-secret>
MPESA_CALLBACK_URL=https://your-render-url.onrender.com/api/mpesa/callback
# ... add all other variables from .env.example

# 6. Add PostgreSQL database in Render
# Dashboard > Databases > Create New > PostgreSQL
# Update DATABASE_URL with connection string

# 7. Deploy
# Click "Deploy" - Render auto-deploys on git push after this

# 8. Run migrations (one-time in shell)
# Go to Render Dashboard > Your App > Shell
# Run: flask db upgrade
```

✅ **Your app is live at `https://your-app-name.onrender.com`**

**Render Advantages:**
- Free tier available
- Auto-deploys on GitHub push
- Automatic SSL/HTTPS
- Easy environment variables
- Good for M-Pesa callbacks (stable domain)

---

## 🚂 Option 3: Railway.app (Fast & Modern)

Railway is modern, fast, and great for startups.

### Prerequisites
- GitHub repository
- Railway account (free tier available)

### Step-by-Step Deployment

```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login to Railway
railway login

# 3. Initialize project
cd your-project-root
railway init
# Select "Python"

# 4. Create Postgres database
railway add
# Select "PostgreSQL"

# 5. Set environment variables
railway variables set FLASK_ENV=production
railway variables set SECRET_KEY=<your-key>
railway variables set MPESA_CONSUMER_KEY=<key>
# ... set all variables from .env.example

# 6. Deploy
railway up
# This reads Procfile and deploys

# 7. Access logs
railway logs

# 8. Run migrations
railway shell
flask db upgrade
exit
```

✅ **Your app is live at auto-generated Railway domain**

**Railway Advantages:**
- Super simple deployment
- Good documentation
- Generous free tier
- 1-click Postgres database
- Real-time logs

---

## ☁️ Option 4: AWS (EC2 + RDS)

For high-traffic, production-grade deployments.

### Prerequisites
- AWS account
- EC2 instance (Ubuntu 22.04, t3.micro minimum)
- RDS PostgreSQL database
- Domain name with Route53 or external DNS

### Step-by-Step Deployment

```bash
# 1. SSH into EC2 instance
ssh -i "your-key.pem" ubuntu@your-ec2-ip

# 2. Update system
sudo apt update && sudo apt upgrade -y

# 3. Install dependencies
sudo apt install -y python3.11 python3.11-venv python3-pip \
    postgresql-client nginx git curl

# 4. Clone repository
cd /opt
sudo git clone https://github.com/yourname/mzizibet.git
cd mzizibet
sudo chown -R ubuntu:ubuntu /opt/mzizibet

# 5. Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# 6. Install Python packages
pip install --upgrade pip
pip install -r requirements.txt

# 7. Create .env file with RDS connection
cp .env.example .env
# Edit .env with RDS DATABASE_URL and M-Pesa keys
sudo nano .env

# 8. Run migrations
flask db upgrade

# 9. Create systemd service
sudo nano /etc/systemd/system/mzizibet.service
```

Add to `/etc/systemd/system/mzizibet.service`:

```ini
[Unit]
Description=Mzizibet Flask Application
After=network.target

[Service]
Type=notify
User=ubuntu
WorkingDirectory=/opt/mzizibet
Environment="PATH=/opt/mzizibet/venv/bin"
EnvironmentFile=/opt/mzizibet/.env
ExecStart=/opt/mzizibet/venv/bin/gunicorn \
    --workers 4 \
    --worker-class gevent \
    --bind unix:/opt/mzizibet/mzizibet.sock \
    --timeout 120 \
    app:create_app()
ExecReload=/bin/kill -s HUP $MAINPID
KillMode=mixed
KillSignal=SIGTERM
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

```bash
# 10. Start service
sudo systemctl daemon-reload
sudo systemctl start mzizibet
sudo systemctl enable mzizibet

# 11. Configure Nginx reverse proxy
sudo nano /etc/nginx/sites-available/mzizibet
```

Add to `/etc/nginx/sites-available/mzizibet`:

```nginx
upstream mzizibet_app {
    server unix:/opt/mzizibet/mzizibet.sock fail_timeout=0;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    client_max_body_size 100M;

    location / {
        proxy_pass http://mzizibet_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
    }

    # WebSocket support
    location /socket.io {
        proxy_pass http://mzizibet_app/socket.io;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

```bash
# 12. Enable site and test Nginx
sudo ln -s /etc/nginx/sites-available/mzizibet /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# 13. Install SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 14. Enable security group
# EC2 Dashboard > Security Groups > Edit Inbound Rules
# Allow: HTTP (80), HTTPS (443), SSH (22 - restricted)
```

✅ **Your app is live with auto-renewing SSL**

---

## 🐳 Option 5: Docker Deployment

For any platform that supports Docker (Heroku, Fly.io, etc.)

### Using Docker Compose (Local)

```bash
# 1. Install Docker & Docker Compose
# Download from docker.com

# 2. Start all services
docker-compose up -d

# 3. Run migrations
docker-compose exec app flask db upgrade

# 4. Seed database
docker-compose exec app python seed_fixed.py

# 5. Access your app
# Frontend: http://localhost:5173
# Backend API: http://localhost:5000
# Postgres: localhost:5432
# Redis: localhost:6379

# 6. View logs
docker-compose logs -f app

# 7. Stop services
docker-compose down
```

### Deploy to Fly.io

```bash
# 1. Install Fly CLI
curl -L https://fly.io/install.sh | sh

# 2. Login to Fly
fly auth login

# 3. Create fly.toml (or let fly create it)
fly launch

# 4. Set secrets (environment variables)
fly secrets set DATABASE_URL=postgresql://...
fly secrets set MPESA_CONSUMER_KEY=...
fly secrets set SECRET_KEY=...
# ... set all from .env.example

# 5. Deploy
fly deploy

# 6. View logs
fly logs

# 7. Access at https://your-app-name.fly.dev
```

---

## 📋 Post-Deployment Checklist

For ANY platform, after deployment:

- [ ] Test user registration at `/register`
- [ ] Test login at `/login`
- [ ] Test M-Pesa payment initiation
- [ ] Test crash game join/bet functionality
- [ ] Test WebSocket updates (live games)
- [ ] Verify SSL/HTTPS working
- [ ] Check admin dashboard at `/admin`
- [ ] Test password reset email
- [ ] Verify CORS allows your domain
- [ ] Set up daily backups
- [ ] Configure monitoring/alerts
- [ ] Test under load with Apache Bench: `ab -n 100 -c 10 https://yourdomain.com/`

---

## 🆘 Common Deployment Issues

### Issue: "Connection refused" on M-Pesa callback
**Solution**: Verify your domain is accessible and MPESA_CALLBACK_URL in `.env` matches exactly

### Issue: "No module named 'gevent'"
**Solution**: Add to requirements.txt if missing:
```
gevent==24.11.1
gevent-websocket==0.10.1
```

### Issue: "psycopg2 error"
**Solution**: Ensure PostgreSQL client headers are installed
- Ubuntu: `sudo apt install libpq-dev`
- CentOS: `sudo yum install postgresql-devel`

### Issue: Static files not loading (404)
**Solution**: Build frontend and ensure Gunicorn serves them
```bash
cd rebrand && npm run build
# Static files go to ../app/static/
```

### Issue: WebSocket connection fails
**Solution**: Ensure your reverse proxy (Nginx) supports WebSocket upgrade
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

---

## 🎯 Next Steps

1. **Choose your platform** from options above
2. **Follow step-by-step instructions** for your chosen platform
3. **Set up M-Pesa credentials** with Safaricom
4. **Run post-deployment tests** from checklist above
5. **Set up monitoring** with UptimeRobot or Sentry
6. **Configure backups** - database daily, code weekly

---

## 📚 Additional Resources

- **M-Pesa Daraja Docs**: developer.safaricom.co.ke
- **Render Docs**: render.com/docs
- **Railway Docs**: railway.app/docs
- **AWS EC2 Docs**: docs.aws.amazon.com
- **Fly.io Docs**: fly.io/docs
- **HostAfrica Support**: support.hostAfrica.co.ke

**You're ready! 🚀 Pick a platform and deploy!**
