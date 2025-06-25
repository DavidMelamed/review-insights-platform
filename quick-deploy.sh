#!/bin/bash

# Review Insights - One-Click Deploy
# The simplest possible deployment - just run and follow 2-3 prompts!

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

clear
echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║          Review Insights - Quick Deploy 🚀             ║"
echo "║                                                       ║"
echo "║  The AI-powered review platform that sets itself up!  ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${GREEN}Hi! I'll set up everything for you in under 5 minutes.${NC}"
echo -e "${GREEN}I just need to check 2 things:${NC}\n"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}📦 Docker not found. Installing it for you...${NC}"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        echo "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop"
        echo "Then run this script again!"
        exit 1
    else
        # Linux
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER
        rm get-docker.sh
        echo -e "${GREEN}✓ Docker installed!${NC}"
    fi
fi

# Generate all passwords automatically
echo -e "\n${YELLOW}🔐 Generating secure passwords...${NC}"
ADMIN_PASSWORD=$(openssl rand -base64 12 | tr -d "=+/" | cut -c1-12)
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
JWT_SECRET=$(openssl rand -base64 32)
echo -e "${GREEN}✓ Done!${NC}"

# Create minimal .env file
echo -e "\n${YELLOW}📝 Creating configuration...${NC}"
cat > .env << EOF
# Auto-generated configuration
DATABASE_URL=postgresql://postgres:$DB_PASSWORD@localhost:5432/reviewinsights
REDIS_URL=redis://localhost:6379
JWT_SECRET=$JWT_SECRET
OPENAI_API_KEY=demo
ADMIN_EMAIL=admin@localhost
ADMIN_PASSWORD=$ADMIN_PASSWORD
NEXT_PUBLIC_API_URL=http://localhost:3001
EOF
echo -e "${GREEN}✓ Done!${NC}"

# Single question about OpenAI
echo -e "\n${BLUE}Optional: Do you have an OpenAI API key for AI features?${NC}"
echo -e "${YELLOW}(Press Enter to skip and use demo mode)${NC}"
read -p "OpenAI API key (or press Enter): " OPENAI_KEY

if [ ! -z "$OPENAI_KEY" ]; then
    sed -i.bak "s/OPENAI_API_KEY=demo/OPENAI_API_KEY=$OPENAI_KEY/g" .env
    rm .env.bak
    echo -e "${GREEN}✓ AI features enabled!${NC}"
else
    echo -e "${YELLOW}✓ Using demo mode (AI responses will be simulated)${NC}"
fi

# Create docker-compose.simple.yml
echo -e "\n${YELLOW}🐳 Preparing containers...${NC}"
cat > docker-compose.simple.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: reviewinsights
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  app:
    image: reviewinsights/all-in-one:latest
    build:
      context: .
      dockerfile: Dockerfile.simple
    environment:
      - DATABASE_URL
      - REDIS_URL
      - JWT_SECRET
      - OPENAI_API_KEY
      - ADMIN_EMAIL
      - ADMIN_PASSWORD
      - NODE_ENV=production
    ports:
      - "3000:3000"
      - "3001:3001"
    depends_on:
      - postgres
      - redis
    command: sh -c "npm run migrate && npm run seed && npm run start:all"

volumes:
  postgres_data:
EOF

# Create simple Dockerfile
cat > Dockerfile.simple << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy everything
COPY . .

# Install dependencies
RUN pnpm install

# Build all packages
RUN pnpm build

# Expose ports
EXPOSE 3000 3001

# Start script
RUN echo '#!/bin/sh\n\
cd packages/api && pnpm prisma migrate deploy && pnpm prisma db seed &\n\
cd packages/api && pnpm start &\n\
cd packages/frontend && pnpm start &\n\
wait' > /app/start.sh && chmod +x /app/start.sh

CMD ["/app/start.sh"]
EOF

# Create seed data script
cat > packages/api/prisma/seed.ts << 'EOF'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || 'admin@localhost' },
    update: {},
    create: {
      email: process.env.ADMIN_EMAIL || 'admin@localhost',
      password: process.env.ADMIN_PASSWORD || 'admin123',
      name: 'Admin User',
    },
  })

  // Create demo business
  await prisma.business.upsert({
    where: { id: 'demo-coffee-shop' },
    update: {},
    create: {
      id: 'demo-coffee-shop',
      name: 'Demo Coffee Shop',
      industry: 'Restaurant',
      description: 'Experience our AI-powered review management',
      userId: admin.id,
    },
  })

  console.log('✅ Demo data created!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
EOF

# Start everything
echo -e "\n${YELLOW}🚀 Starting Review Insights...${NC}"
echo -e "${YELLOW}This will take 2-3 minutes on first run...${NC}\n"

# Pull or build images
docker-compose -f docker-compose.simple.yml build

# Start services
docker-compose -f docker-compose.simple.yml up -d

# Wait for services
echo -e "\n${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 10

# Show success message
clear
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║           🎉 Setup Complete! 🎉                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "\n${BLUE}Your Review Insights platform is ready!${NC}\n"

echo -e "${GREEN}📱 Access your platform:${NC}"
echo -e "   ${BLUE}http://localhost:3000${NC}\n"

echo -e "${GREEN}🔑 Login credentials:${NC}"
echo -e "   Email: ${BLUE}admin@localhost${NC}"
echo -e "   Password: ${BLUE}$ADMIN_PASSWORD${NC}\n"

echo -e "${GREEN}🎯 Try these features:${NC}"
echo -e "   1. Click 'Get Started' and enter any business name"
echo -e "   2. Watch AI discover everything automatically"
echo -e "   3. View analytics, set up alerts, generate reports\n"

echo -e "${YELLOW}💡 Tips:${NC}"
echo -e "   • Stop: ${BLUE}docker-compose -f docker-compose.simple.yml down${NC}"
echo -e "   • Logs: ${BLUE}docker-compose -f docker-compose.simple.yml logs${NC}"
echo -e "   • Restart: ${BLUE}docker-compose -f docker-compose.simple.yml restart${NC}\n"

# Save credentials
echo -e "Admin Password: $ADMIN_PASSWORD" > credentials.txt
echo -e "${GREEN}✓ Credentials saved to credentials.txt${NC}\n"

# Open browser
if command -v open &> /dev/null; then
    open http://localhost:3000
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3000
fi

echo -e "${BLUE}Press Ctrl+C to stop the application${NC}"