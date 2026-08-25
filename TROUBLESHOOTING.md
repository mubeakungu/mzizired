# 🔧 Mzizibet Troubleshooting & FAQ

Complete guide to solving common issues.

---

## 🐛 Startup Issues

### "ModuleNotFoundError: No module named 'flask'"
```bash
# Activate virtual environment
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Reinstall dependencies
pip install -r requirements.txt
```

### "Could not connect to database"
```bash
# Check DATABASE_URL in .env
echo $DATABASE_URL

# Test PostgreSQL connection
psql $DATABASE_URL -c "SELECT 1"

# If connection fails:
# 1. Verify PostgreSQL is running
# 2. Check username/password
# 3. Ensure database exists: createdb mzizibet
# 4. Check host and port are correct
```

### "Port 5000 already in use"
```bash
# Find what's using the port
lsof -i :5000

# Kill the process
kill -9 <PID>

# Or use different port
flask run --port 8000
```

### "Secret key too short or invalid"
```bash
# Generate a proper secret key
python3 -c "import secrets; print(secrets.token_hex(32))"

# Update in .env:
SECRET_KEY=<generated-key>
```

---

## 💾 Database Issues

### "Relation does not exist" errors
```bash
# Run migrations
flask db upgrade

# If migrations are missing
flask db init
flask db migrate -m "Initial migration"
flask db upgrade

# Verify tables exist
psql $DATABASE_URL -c "\dt"
```

### "Integrity constraint violation"
**Problem**: Foreign key or unique constraint violations
```bash
# Option 1: Reset database (WARNING: deletes all data)
dropdb mzizibet
createdb mzizibet
flask db upgrade

# Option 2: Fix constraint issue
# Identify which table: check error message
# Manual fix or fix migration, then:
flask db stamp head
flask db migrate
flask db upgrade
```

### "Connection pool exhausted"
**Problem**: Too many database connections
```python
# In config.py, increase pool size:
SQLALCHEMY_ENGINE_OPTIONS = {
    'pool_size': 20,           # Increase from 10
    'pool_recycle': 3600,      # Recycle every hour
    'pool_pre_ping': True,     # Ping to verify connection
}
```

### "Alembic version conflict"
```bash
# Reset Alembic to current schema
flask db stamp head

# Then create new migration
flask db migrate -m "Your changes"
flask db upgrade
```

---

## 💳 M-Pesa Integration Issues

### "Invalid consumer key or secret"
```bash
# Verify credentials in .env
echo MPESA_CONSUMER_KEY=$MPESA_CONSUMER_KEY
echo MPESA_CONSUMER_SECRET=$MPESA_CONSUMER_SECRET

# For sandbox testing, use:
# Consumer Key: Your Daraja app key
# Consumer Secret: Your Daraja app secret

# Get these from:
# https://developer.safaricom.co.ke/MyApps
```

### "Callback URL returns 404"
**Problem**: M-Pesa can't reach your callback endpoint

```bash
# 1. Verify your domain is publicly accessible
curl -X GET https://yourdomain.com/

# 2. Check callback URL in .env matches exactly
MPESA_CALLBACK_URL=https://yourdomain.com/api/mpesa/callback

# 3. Test endpoint manually
curl -X POST https://yourdomain.com/api/mpesa/callback \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Should return 200 OK (not 404)

# 4. Check firewall/security groups allow inbound
# AWS: Edit security group inbound rules
# HostAfrica: Check mod_security rules

# 5. Verify Nginx proxy settings include:
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Real-IP $remote_addr;
```

### "M-Pesa payment initiated but user not credited"
**Problem**: Transaction initiated but callback didn't process

```bash
# Check transaction log
sqlite3 app.db
SELECT * FROM mpesa_transactions WHERE status='pending' LIMIT 5;

# Manually trigger webhook processing
python3 -c "
from app import create_app, db
from app.models import MPesaTransaction

app = create_app()
with app.app_context():
    pending = MPesaTransaction.query.filter_by(status='pending').all()
    for tx in pending:
        print(f'Pending: {tx.id} - {tx.phone_number}')
"

# Check app logs for webhook errors
tail -f app.log | grep -i mpesa

# Common causes:
# - Callback URL blocked by firewall
# - Incorrect passkey in config
# - Database not committing transactions
# - M-Pesa IP not whitelisted
```

### "Amount in request fails validation"
```bash
# Verify amount is integer (KES cents)
# Min: 1 (0.01 KES) in sandbox, 100 (1 KES) in production
# Max: Based on DAILY_WITHDRAWAL_LIMIT

# Check config.py:
print(f"Min deposit: {MIN_DEPOSIT}")
print(f"Max deposit: {MAX_DEPOSIT}")

# Test with valid amount
curl -X POST https://yourdomain.com/api/wallet/deposit \
  -H "Content-Type: application/json" \
  -d '{"amount": 10000}'  # 100 KES
```

---

## 🎮 Game Issues

### Crash Game "Not in valid round"
```bash
# Check game engine status
python3 -c "
from app import create_app
from app.game_engine import CrashGameEngine

app = create_app()
engine = CrashGameEngine()
print(f'Current round: {engine.current_round}')
print(f'Round status: {engine.get_status()}')
"

# Restart game engine if stuck
# Stop app, clear cache, restart
```

### Blackjack "Insufficient funds"
```bash
# Verify user wallet has balance
sqlite3 app.db
SELECT user_id, balance FROM user_wallets WHERE user_id=1;

# Check bet amount
SELECT bet_amount FROM blackjack_games WHERE user_id=1 ORDER BY created_at DESC LIMIT 1;

# Manually add test balance
sqlite3 app.db
UPDATE user_wallets SET balance=100000 WHERE user_id=1;
```

### WebSocket updates not working
**Problem**: Live game updates not reaching frontend

```bash
# Check Flask-SocketIO is running
netstat -tlnp | grep :5000

# Verify WebSocket connection in browser console
# Open DevTools (F12) > Network > WS
# Should see ws://localhost:5000/socket.io/?EIO=4...

# If missing, check:
# 1. Nginx WebSocket headers (see DEPLOY_PLATFORMS.md)
# 2. CORS configuration in app/__init__.py
# 3. SocketIO initialization in app.py

# Test socket manually
python3 -c "
import socketio
sio = socketio.Client()

@sio.event
def connect():
    print('Connected')
    
@sio.on('game_update')
def on_update(data):
    print(f'Update: {data}')

sio.connect('http://localhost:5000')
sio.wait()
"
```

---

## 🔐 Authentication Issues

### "Invalid login credentials"
```bash
# Check if user exists
python3 -c "
from app import create_app, db
from app.models import User

app = create_app()
with app.app_context():
    user = User.query.filter_by(phone_number='0712345678').first()
    print(f'User found: {user is not None}')
    if user:
        print(f'Username: {user.username}')
        print(f'Email: {user.email}')
"

# Reset user password
python3 -c "
from app import create_app, db
from app.models import User
from flask_bcrypt import Bcrypt

app = create_app()
bcrypt = Bcrypt()

with app.app_context():
    user = User.query.filter_by(username='testuser').first()
    if user:
        user.password = bcrypt.generate_password_hash('newpassword123')
        db.session.commit()
        print('Password reset successfully')
"

# Check session/token configuration
grep -i SESSION config.py
grep -i TOKEN config.py
```

### "Session expired" messages
```bash
# Check session timeout in .env
echo $SESSION_TIMEOUT  # Should be seconds (e.g., 3600 = 1 hour)

# Increase timeout if needed
SESSION_TIMEOUT=86400  # 24 hours

# Clear old sessions
python3 -c "
from flask import session
from datetime import datetime, timedelta
# Session cleanup is automatic
print('Sessions stored server-side')
"
```

### "Two-factor authentication fails"
```bash
# Check email configuration
grep -i MAIL config.py
echo $MAIL_USERNAME
echo $MAIL_PASSWORD  # Don't share!

# Test email sending
python3 -c "
from flask_mail import Mail, Message
from app import create_app

app = create_app()
mail = Mail(app)

msg = Message('Test', recipients=['youremail@gmail.com'])
msg.body = 'This is a test'
try:
    mail.send(msg)
    print('Email sent successfully')
except Exception as e:
    print(f'Email failed: {e}')
"

# Gmail requires app-specific password
# Generate at myaccount.google.com/apppasswords
```

---

## 🌐 Deployment Issues

### App crashes after deployment
```bash
# Check application logs
# Render: Dashboard > Logs
# Railway: railway logs
# AWS: tail /var/log/syslog
# HostAfrica: cPanel > Logs

# Check if migrations ran
# Render/Railway: Add to deploy script:
# flask db upgrade

# Check environment variables are set
printenv | grep FLASK
printenv | grep DATABASE
printenv | grep MPESA
```

### "502 Bad Gateway" from Nginx
```bash
# Check Gunicorn is running
ps aux | grep gunicorn

# Check socket file exists
ls -la /opt/mzizibet/mzizibet.sock

# Check Nginx config
nginx -t

# View Nginx error log
tail -f /var/log/nginx/error.log

# Check Gunicorn logs
journalctl -u mzizibet -f

# Common fix: restart Gunicorn
systemctl restart mzizibet
```

### "CORS error - Origin not allowed"
**Error in browser console**: "Access to XMLHttpRequest blocked by CORS"

```python
# Update CORS in app/__init__.py
from flask_cors import CORS

CORS(app, resources={
    r"/api/*": {
        "origins": ["https://yourdomain.com", "https://www.yourdomain.com"],
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

# Restart app
systemctl restart mzizibet
```

### SSL certificate issues
```bash
# Check certificate validity
openssl s_client -connect yourdomain.com:443 -showcerts

# Renew Let's Encrypt certificate
sudo certbot renew --force-renewal

# Check auto-renewal is configured
sudo systemctl status certbot.timer

# Manually renew if needed
sudo certbot renew --manual
```

---

## 📊 Performance Issues

### App is slow or unresponsive
```bash
# Check CPU/memory usage
top

# Check database connections
ps aux | grep postgres

# Check active database connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Optimize database
psql $DATABASE_URL -c "VACUUM ANALYZE;"

# Increase Gunicorn workers
# For 4 CPU cores: workers = 2 * 4 + 1 = 9
gunicorn --workers 9 --worker-class gevent 'app:create_app()'
```

### High memory usage
```bash
# Check for memory leaks
# Reduce number of Gunicorn workers
gunicorn --workers 2 --worker-class gevent 'app:create_app()'

# Check for unclosed database connections
# Add to config.py:
SQLALCHEMY_ENGINE_OPTIONS = {
    'pool_pre_ping': True,
    'pool_recycle': 3600,
}

# Clear old transactions/logs
python3 -c "
from app import create_app, db
from datetime import datetime, timedelta

app = create_app()
with app.app_context():
    week_ago = datetime.utcnow() - timedelta(days=7)
    # Delete old game results, transactions, etc.
    print('Cleanup complete')
"
```

### Database too large
```bash
# Check database size
du -sh /var/lib/postgresql/

# Identify large tables
psql $DATABASE_URL -c "
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
FROM pg_tables 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC 
LIMIT 10;"

# Archive old data
# Create archive table and move old records
# Delete old game results (keep 6 months)
```

---

## 🚨 Emergency Procedures

### Database backup needed immediately
```bash
# Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Upload to cloud storage
aws s3 cp backup_*.sql s3://my-backup-bucket/

# Or use rsync to another server
rsync -azv backup_*.sql user@backup-server:/backups/
```

### Rollback to previous version
```bash
# 1. Stop application
systemctl stop mzizibet

# 2. Switch to previous branch
git log --oneline | head -5
git checkout <previous-commit-hash>

# 3. Downgrade database if needed
flask db downgrade

# 4. Restart
systemctl start mzizibet
```

### Complete database reset (WARNING: DESTRUCTIVE)
```bash
# ONLY if absolutely necessary and you have a backup!

# 1. Stop application
systemctl stop mzizibet

# 2. Drop and recreate database
dropdb mzizibet
createdb mzizibet

# 3. Run migrations fresh
flask db upgrade

# 4. Seed with initial data
python seed_fixed.py

# 5. Restart application
systemctl start mzizibet
```

---

## 🔍 Monitoring & Logging

### Set up application monitoring
```bash
# Install Sentry for error tracking
pip install sentry-sdk

# Add to app/__init__.py
import sentry_sdk
sentry_sdk.init("your-sentry-dsn")

# Monitor uptime
# Sign up at uptimerobot.com
# Add webhook: https://yourdomain.com/health
```

### View real-time logs
```bash
# Docker
docker-compose logs -f app

# Systemd
journalctl -u mzizibet -f

# File-based
tail -f app.log

# Filter by level
tail -f app.log | grep ERROR
tail -f app.log | grep WARNING
```

### Enable debug logging
```python
# In app/__init__.py
import logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

---

## ❓ Frequently Asked Questions

**Q: How often should I backup the database?**
A: Daily for production. Use automated backups with Render/Railway, or set up cron job with pg_dump.

**Q: Can I run Mzizibet on shared hosting?**
A: No, requires dedicated/VPS hosting to install Python packages and run Gunicorn.

**Q: What's the minimum server specs needed?**
A: 2GB RAM, 2vCPU, 20GB storage (SSD recommended). 4GB RAM for 1000+ concurrent users.

**Q: How do I handle multiple concurrent players?**
A: Gunicorn with gevent workers handles 1000+ concurrent connections per worker. Scale workers based on load.

**Q: Is the code BCLB compliant?**
A: The system is built to be compliant. Ensure you have BCLB license and configure it in BCLB_LICENSE_NUMBER.

**Q: How do I update the platform?**
A: git pull, run migrations (flask db upgrade), restart application. No downtime needed if using load balancing.

**Q: What if M-Pesa keeps timing out?**
A: Check Safaricom Daraja status page. May be rate-limited if >100 requests/sec. Implement request queuing.

**Q: Can I use SQLite instead of PostgreSQL?**
A: Yes, for development. Change DATABASE_URL to sqlite:///app.db. Not recommended for production.

---

## 📞 Still Stuck?

1. Check the logs first (always!)
2. Search DEPLOYMENT_READY.md for your issue
3. Check Safaricom Daraja documentation for M-Pesa issues
4. Check Flask/SQLAlchemy docs for code issues
5. Ask in relevant community forums

**Common resource links:**
- Flask: flask.palletsprojects.com
- SQLAlchemy: sqlalchemy.org
- M-Pesa Daraja: developer.safaricom.co.ke
- Render Support: render.com/support
- Railway Support: railway.app/support

Good luck! 🚀
