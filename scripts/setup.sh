#!/usr/bin/env bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║    KIMI Swarm Chat — Initial Setup           ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

cd "$(dirname "$0")/.."

export DATABASE_URL="${DATABASE_URL:-file:./dev.db}"

# 1. Node modules
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}[1/6]${NC} Installing dependencies..."
  npm install
else
  echo -e "${GREEN}[1/6]${NC} Dependencies already installed."
fi

# 2. .env.local
if [ ! -f ".env.local" ]; then
  echo -e "${YELLOW}[2/6]${NC} Creating .env.local from template..."
  cp .env.example .env.local
  echo -e "${YELLOW}      ⚠  Set your OPENROUTER_API_KEY in .env.local${NC}"
else
  echo -e "${GREEN}[2/6]${NC} .env.local exists."
fi

# 3. Prisma generate
echo -e "${YELLOW}[3/6]${NC} Generating Prisma client..."
npx prisma generate 2>/dev/null

# 4. Database
echo -e "${YELLOW}[4/6]${NC} Syncing database schema..."
npx prisma db push 2>/dev/null

# 5. Uploads directory
mkdir -p uploads
echo -e "${GREEN}[5/6]${NC} Uploads directory ready."

# 6. Seed demo agents
echo -e "${YELLOW}[6/6]${NC} Seeding demo agents..."
node scripts/seed.js 2>/dev/null || true

echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
echo "  Run the service:"
echo ""
echo -e "    ${CYAN}npm run dev${NC}        — development (http://localhost:3000)"
echo -e "    ${CYAN}npm run prod${NC}       — production build + start"
echo ""
