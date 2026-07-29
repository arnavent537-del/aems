#!/bin/bash
set -e

echo "🚀 AEMS Deployment Script"
echo "=========================="

# 1. Update system
echo "[1/9] Updating system packages..."
apt update -y && apt upgrade -y

# 2. Install Node.js 22
echo "[2/9] Installing Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs git nginx
node -v
npm -v

# 3. Install PM2
echo "[3/9] Installing PM2..."
npm install -g pm2

# 4. Clone the project
echo "[4/9] Cloning AEMS repository..."
cd /opt
git clone https://github.com/arnavent537-del/aems.git
cd aems

# 5. Setup environment
echo "[5/9] Setting up environment..."
cat > /opt/aems/.env << 'ENVEOF'
JWT_SECRET=aems-super-secret-key-1234567890-aems
DATABASE_URL="file:./prisma/dev.db"
HTTPS=false
PORT=3000
TWILIO_ENABLED=true
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM=+919921998300
ENVEOF

# Generate a proper JWT secret
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" /opt/aems/.env

# 6. Install dependencies & build
echo "[6/9] Installing dependencies..."
npm install

echo "[7/9] Running database migrations..."
npx prisma migrate deploy

echo "[8/9] Seeding database..."
node prisma/seed.js

echo "[9/9] Building and starting..."
npx next build

# 7. Start with PM2
pm2 start /opt/aems/ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

echo ""
echo "✅ Deployment complete!"
echo "📱 App is running on http://localhost:3000"
echo ""
echo "To set up domain with SSL, run:"
echo "  sudo nano /etc/nginx/sites-available/aems"
echo "  # Paste the Nginx config from the guide below"
echo ""
echo "To check status: pm2 status"
echo "To view logs: pm2 logs aems"
