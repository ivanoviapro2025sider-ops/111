#!/usr/bin/env bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║    KIMI Swarm Chat — Initial Setup           ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

cd "$(dirname "$0")/.."
ROOT_DIR="$(pwd)"

# 1. Node modules
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}[1/5]${NC} Installing dependencies..."
  npm install
else
  echo -e "${GREEN}[1/5]${NC} Dependencies already installed."
fi

# 2. .env.local
if [ ! -f ".env.local" ]; then
  echo -e "${YELLOW}[2/5]${NC} Creating .env.local from template..."
  cp .env.example .env.local
  echo -e "${YELLOW}      ⚠  Set your OPENROUTER_API_KEY in .env.local${NC}"
else
  echo -e "${GREEN}[2/5]${NC} .env.local exists."
fi

# 3. Prisma generate
echo -e "${YELLOW}[3/5]${NC} Generating Prisma client..."
npx prisma generate 2>/dev/null

# 4. Database
echo -e "${YELLOW}[4/5]${NC} Syncing database schema..."
npx prisma db push 2>/dev/null

# 5. Uploads directory
mkdir -p uploads
echo -e "${GREEN}[5/5]${NC} Uploads directory ready."

echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
echo "  Run the service:"
echo ""
echo -e "    ${CYAN}npm run dev${NC}        — development mode (hot-reload)"
echo -e "    ${CYAN}npm run server${NC}     — development via custom server"
echo -e "    ${CYAN}npm run prod${NC}       — production build + start"
echo ""
echo -e "  Open ${CYAN}http://localhost:3000${NC}"
echo ""
