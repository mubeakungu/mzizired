#!/bin/bash
# ============================================================================
# MZIZIBET QUICK START DEPLOYMENT SCRIPT
# This script automates initial setup for local development or deployment
# ============================================================================

set -e

echo "🚀 MZIZIBET QUICK START"
echo "======================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Python version
echo "📋 Checking Python version..."
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | awk '{print $2}')
echo -e "${GREEN}✓ Python $PYTHON_VERSION${NC}"

# Check if .env exists
echo ""
echo "📝 Checking environment configuration..."
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠ .env file not found. Creating from .env.example...${NC}"
    if [ ! -f .env.example ]; then
        echo -e "${RED}❌ .env.example not found${NC}"
        exit 1
    fi
    cp .env.example .env
    echo -e "${YELLOW}📌 Please edit .env with your actual configuration values${NC}"
    echo "   Key fields to update:"
    echo "   - SECRET_KEY"
    echo "   - DATABASE_URL (PostgreSQL connection string)"
    echo "   - MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET"
    echo "   - MAIL_USERNAME and MAIL_PASSWORD"
    echo "   - API_BASE_URL and FRONTEND_URL"
    echo ""
    read -p "Press Enter after updating .env file..."
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi

# Create virtual environment
echo ""
echo "🔨 Setting up Python virtual environment..."
if [ ! -d venv ]; then
    python3 -m venv venv
    echo -e "${GREEN}✓ Virtual environment created${NC}"
else
    echo -e "${GREEN}✓ Virtual environment already exists${NC}"
fi

# Activate virtual environment
source venv/bin/activate
echo -e "${GREEN}✓ Virtual environment activated${NC}"

# Install dependencies
echo ""
echo "📦 Installing Python dependencies..."
pip install --upgrade pip setuptools wheel > /dev/null 2>&1
pip install -r requirements.txt
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Check if PostgreSQL is available
echo ""
echo "🗄️  Checking database connection..."
if command -v psql &> /dev/null; then
    # Try to connect with DATABASE_URL
    if [ -f .env ]; then
        source .env
        if psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Database connection successful${NC}"
        else
            echo -e "${YELLOW}⚠ Could not connect to database${NC}"
            echo "   Make sure PostgreSQL is running and DATABASE_URL is correct"
        fi
    fi
else
    echo -e "${YELLOW}⚠ psql not found - skipping database connection test${NC}"
fi

# Run database migrations
echo ""
echo "🗄️  Running database migrations..."
if python3 -c "import flask_migrate" 2>/dev/null; then
    flask db upgrade 2>/dev/null || echo -e "${YELLOW}⚠ Could not run migrations (database might not be accessible yet)${NC}"
    echo -e "${GREEN}✓ Migrations updated${NC}"
else
    echo -e "${YELLOW}⚠ Flask-Migrate not fully configured${NC}"
fi

# Check Node.js for frontend
echo ""
echo "🎨 Checking frontend dependencies..."
if [ -d rebrand ] && [ -f rebrand/package.json ]; then
    cd rebrand
    if command -v npm &> /dev/null; then
        echo "Installing frontend dependencies..."
        npm install > /dev/null 2>&1
        echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
    else
        echo -e "${YELLOW}⚠ Node.js/npm not found - frontend not built${NC}"
        echo "   Install Node.js to build the frontend"
    fi
    cd ..
else
    echo -e "${YELLOW}⚠ Frontend directory (rebrand/) not found${NC}"
fi

# Summary
echo ""
echo "========================================="
echo -e "${GREEN}✅ SETUP COMPLETE!${NC}"
echo "========================================="
echo ""
echo "Next steps:"
echo ""
echo "1️⃣  Edit .env with your actual credentials:"
echo "    nano .env"
echo ""
echo "2️⃣  Ensure PostgreSQL is running and DATABASE_URL is correct"
echo ""
echo "3️⃣  Run database migrations (if not done):"
echo "    flask db upgrade"
echo ""
echo "4️⃣  (Optional) Seed database with test data:"
echo "    python seed_fixed.py"
echo ""
echo "5️⃣  Start development server:"
echo "    python run.py"
echo ""
echo "    OR for production:"
echo "    gunicorn --worker-class gevent --workers 4 --bind 0.0.0.0:8000 'app:create_app()'"
echo ""
echo "6️⃣  Build frontend for production:"
echo "    cd rebrand && npm run build"
echo ""
echo "🌐 Local development: http://localhost:5000"
echo "📚 Documentation: DEPLOYMENT_READY.md"
echo ""
echo "Happy deploying! 🎉"
