#!/bin/bash

# Review Insights - Intelligent Auto-Deployment Script
# This script automatically sets up everything with minimal user input

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Configuration
DEPLOYMENT_DIR="$HOME/.review-insights"
CONFIG_FILE="$DEPLOYMENT_DIR/config.json"
SECRETS_FILE="$DEPLOYMENT_DIR/.secrets"

# ASCII Art Banner
show_banner() {
    echo -e "${PURPLE}"
    cat << "EOF"
    ____            _               ____           _       __    __      
   / __ \___ _   __(_)__ _      __ /  _/___  _____(_)____ / /_  / /______
  / /_/ / _ \ | / / / _ \ | /| / / / // __ \/ ___/ / __ `/ __ \/ __/ ___/
 / _, _/  __/ |/ / /  __/ |/ |/ /_/ // / / (__  ) / /_/ / / / / /_(__  ) 
/_/ |_|\___/|___/_/\___/|__/|__//___/_/ /_/____/_/\__, /_/ /_/\__/____/  
                                                  /____/                  
EOF
    echo -e "${NC}"
    echo -e "${GREEN}🚀 Auto-Deployment Script v2.0${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Spinner animation
spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

# Progress bar
progress_bar() {
    local duration=$1
    local steps=$2
    local step_duration=$(echo "scale=2; $duration / $steps" | bc)
    
    for ((i=0; i<=steps; i++)); do
        local percent=$((i * 100 / steps))
        local filled=$((i * 40 / steps))
        local empty=$((40 - filled))
        
        printf "\r["
        printf "%${filled}s" | tr ' ' '█'
        printf "%${empty}s" | tr ' ' '░'
        printf "] %d%%" $percent
        
        sleep $step_duration
    done
    echo ""
}

# Auto-detect system
detect_system() {
    echo -e "${YELLOW}🔍 Detecting your system...${NC}"
    
    OS=$(uname -s)
    ARCH=$(uname -m)
    
    if [[ "$OS" == "Darwin" ]]; then
        PLATFORM="macos"
        echo -e "${GREEN}✓ Detected: macOS on $ARCH${NC}"
    elif [[ "$OS" == "Linux" ]]; then
        PLATFORM="linux"
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            echo -e "${GREEN}✓ Detected: $NAME on $ARCH${NC}"
        else
            echo -e "${GREEN}✓ Detected: Linux on $ARCH${NC}"
        fi
    else
        echo -e "${RED}✗ Unsupported OS: $OS${NC}"
        exit 1
    fi
    
    # Check available resources
    if command -v free &> /dev/null; then
        TOTAL_MEM=$(free -m | awk 'NR==2{print $2}')
        echo -e "${GREEN}✓ Available memory: ${TOTAL_MEM}MB${NC}"
    fi
    
    DISK_SPACE=$(df -h . | awk 'NR==2{print $4}')
    echo -e "${GREEN}✓ Available disk space: $DISK_SPACE${NC}"
}

# Check and install dependencies
install_dependencies() {
    echo -e "\n${YELLOW}📦 Checking dependencies...${NC}"
    
    local missing_deps=()
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    else
        echo -e "${GREEN}✓ Docker installed${NC}"
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        missing_deps+=("docker-compose")
    else
        echo -e "${GREEN}✓ Docker Compose installed${NC}"
    fi
    
    # Check Git
    if ! command -v git &> /dev/null; then
        missing_deps+=("git")
    else
        echo -e "${GREEN}✓ Git installed${NC}"
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        missing_deps+=("nodejs")
    else
        NODE_VERSION=$(node --version)
        echo -e "${GREEN}✓ Node.js installed ($NODE_VERSION)${NC}"
    fi
    
    # Install missing dependencies
    if [ ${#missing_deps[@]} -ne 0 ]; then
        echo -e "\n${YELLOW}Installing missing dependencies...${NC}"
        
        if [[ "$PLATFORM" == "macos" ]]; then
            # Install Homebrew if not present
            if ! command -v brew &> /dev/null; then
                echo -e "${YELLOW}Installing Homebrew...${NC}"
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            fi
            
            for dep in "${missing_deps[@]}"; do
                echo -e "${YELLOW}Installing $dep...${NC}"
                brew install $dep
            done
        elif [[ "$PLATFORM" == "linux" ]]; then
            echo -e "${YELLOW}Please install: ${missing_deps[*]}${NC}"
            echo -e "${BLUE}Run: sudo apt update && sudo apt install -y ${missing_deps[*]}${NC}"
            read -p "Press Enter after installing dependencies..."
        fi
    fi
}

# Generate secure passwords and tokens
generate_secrets() {
    echo -e "\n${YELLOW}🔐 Generating secure secrets...${NC}"
    
    # Create deployment directory
    mkdir -p "$DEPLOYMENT_DIR"
    
    # Generate secrets
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    JWT_SECRET=$(openssl rand -base64 32)
    ENCRYPTION_KEY=$(openssl rand -hex 16)
    REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-20)
    ADMIN_PASSWORD=$(openssl rand -base64 12 | tr -d "=+/" | cut -c1-12)
    
    # Save secrets
    cat > "$SECRETS_FILE" << EOF
DB_PASSWORD=$DB_PASSWORD
JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
REDIS_PASSWORD=$REDIS_PASSWORD
ADMIN_PASSWORD=$ADMIN_PASSWORD
EOF
    
    chmod 600 "$SECRETS_FILE"
    echo -e "${GREEN}✓ Secrets generated and saved securely${NC}"
}

# Setup free API keys
setup_free_services() {
    echo -e "\n${YELLOW}🎯 Setting up free services...${NC}"
    
    # Check for existing API keys
    if [ -f "$CONFIG_FILE" ]; then
        echo -e "${GREEN}✓ Found existing configuration${NC}"
        source "$CONFIG_FILE"
    else
        echo -e "\n${BLUE}We'll use free/trial services to get you started:${NC}"
        echo -e "1. OpenAI API - Free credits on signup"
        echo -e "2. Resend (Email) - 100 free emails/day"
        echo -e "3. Stripe Test Mode - Unlimited testing"
        echo -e "4. Local alternatives for other services"
        
        echo -e "\n${YELLOW}For full functionality, you'll need an OpenAI API key${NC}"
        echo -e "${BLUE}Get one free at: https://platform.openai.com/signup${NC}"
        
        read -p "Do you have an OpenAI API key? (y/n): " has_openai
        if [[ $has_openai == "y" ]]; then
            read -p "Enter your OpenAI API key (sk-...): " OPENAI_API_KEY
            
            # Validate API key
            if curl -s -o /dev/null -w "%{http_code}" \
                -H "Authorization: Bearer $OPENAI_API_KEY" \
                https://api.openai.com/v1/models | grep -q "200"; then
                echo -e "${GREEN}✓ OpenAI API key validated${NC}"
            else
                echo -e "${RED}✗ Invalid API key, will use mock mode${NC}"
                OPENAI_API_KEY="mock"
            fi
        else
            echo -e "${YELLOW}Using mock AI mode for testing${NC}"
            OPENAI_API_KEY="mock"
        fi
        
        # Save configuration
        cat > "$CONFIG_FILE" << EOF
OPENAI_API_KEY=$OPENAI_API_KEY
EMAIL_PROVIDER=console
PAYMENT_MODE=test
STORAGE_TYPE=local
EOF
    fi
}

# Clone or update repository
setup_repository() {
    echo -e "\n${YELLOW}📥 Setting up repository...${NC}"
    
    if [ -d "review-analysis-saas" ]; then
        echo -e "${GREEN}✓ Repository found, updating...${NC}"
        cd review-analysis-saas
        git pull origin main 2>/dev/null || true
    else
        echo -e "${YELLOW}Downloading Review Insights...${NC}"
        # In real scenario, this would clone from GitHub
        # For now, we'll use the existing directory
        if [ -d "/home/david/review-analysis-saas" ]; then
            cp -r /home/david/review-analysis-saas .
            cd review-analysis-saas
        else
            echo -e "${RED}Repository not found. Please ensure the code is available.${NC}"
            exit 1
        fi
    fi
}

# Auto-configure environment
configure_environment() {
    echo -e "\n${YELLOW}⚙️  Auto-configuring environment...${NC}"
    
    # Load secrets
    source "$SECRETS_FILE"
    source "$CONFIG_FILE"
    
    # Create .env file
    cat > .env << EOF
# Auto-generated configuration
NODE_ENV=development

# Database
DB_USER=reviewinsights
DB_PASSWORD=$DB_PASSWORD
DB_NAME=reviewinsights
DATABASE_URL=postgresql://reviewinsights:$DB_PASSWORD@localhost:5432/reviewinsights

# Redis
REDIS_URL=redis://default:$REDIS_PASSWORD@localhost:6379
REDIS_PASSWORD=$REDIS_PASSWORD

# Security
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=$ENCRYPTION_KEY

# API Keys
OPENAI_API_KEY=$OPENAI_API_KEY
DATAFORSEO_API_KEY=demo
SENDGRID_API_KEY=demo

# Email (using console for testing)
EMAIL_PROVIDER=console
EMAIL_FROM=noreply@localhost

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_demo
STRIPE_WEBHOOK_SECRET=whsec_demo
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_demo

# Application
PORT=3001
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001

# Storage
STORAGE_TYPE=local
UPLOAD_DIR=./uploads

# Features
ENABLE_AI_RESPONSES=true
ENABLE_PREDICTIVE_ANALYTICS=true
ENABLE_WHITE_LABEL=true
ENABLE_ZERO_CONFIG=true

# Admin
ADMIN_EMAIL=admin@localhost
ADMIN_PASSWORD=$ADMIN_PASSWORD
EOF
    
    echo -e "${GREEN}✓ Environment configured${NC}"
}

# Install and build application
build_application() {
    echo -e "\n${YELLOW}🏗️  Building application...${NC}"
    
    # Install pnpm if not present
    if ! command -v pnpm &> /dev/null; then
        echo -e "${YELLOW}Installing pnpm...${NC}"
        npm install -g pnpm
    fi
    
    # Install dependencies
    echo -e "${YELLOW}Installing dependencies...${NC}"
    pnpm install --no-frozen-lockfile &
    spinner $!
    
    echo -e "${GREEN}✓ Dependencies installed${NC}"
}

# Start services
start_services() {
    echo -e "\n${YELLOW}🚀 Starting services...${NC}"
    
    # Stop any existing containers
    docker-compose down 2>/dev/null || true
    
    # Start core services
    echo -e "${YELLOW}Starting database and cache...${NC}"
    docker-compose up -d postgres redis &
    spinner $!
    
    # Wait for services to be ready
    echo -e "${YELLOW}Waiting for services to be ready...${NC}"
    sleep 5
    
    # Run migrations
    echo -e "${YELLOW}Setting up database...${NC}"
    pnpm --filter @review-analysis/api prisma generate
    pnpm --filter @review-analysis/api prisma migrate deploy 2>/dev/null || \
    pnpm --filter @review-analysis/api prisma migrate dev --name init
    
    # Seed demo data
    echo -e "${YELLOW}Loading demo data...${NC}"
    pnpm --filter @review-analysis/api prisma db seed 2>/dev/null || true
    
    echo -e "${GREEN}✓ Services started${NC}"
}

# Create demo business
create_demo_business() {
    echo -e "\n${YELLOW}🏢 Creating demo business...${NC}"
    
    # Create a demo configuration
    cat > demo-business.json << 'EOF'
{
  "businessName": "Demo Coffee Shop",
  "industry": "Restaurant",
  "website": "https://demo-coffee.example.com",
  "description": "A cozy coffee shop serving artisanal coffee and fresh pastries",
  "location": {
    "address": "123 Main Street",
    "city": "San Francisco",
    "state": "CA",
    "country": "USA"
  },
  "reviewSources": [
    {
      "platform": "Demo Reviews",
      "url": "demo://reviews",
      "reviewCount": 150,
      "averageRating": 4.5
    }
  ],
  "demoReviews": [
    {
      "author": "Sarah Johnson",
      "rating": 5,
      "content": "Best coffee in town! The baristas are incredibly knowledgeable and friendly.",
      "date": "2024-01-10"
    },
    {
      "author": "Mike Chen",
      "rating": 4,
      "content": "Great atmosphere and good coffee. WiFi could be faster though.",
      "date": "2024-01-09"
    },
    {
      "author": "Emily Rodriguez",
      "rating": 5,
      "content": "Their pastries are to die for! Fresh baked every morning.",
      "date": "2024-01-08"
    },
    {
      "author": "David Kim",
      "rating": 3,
      "content": "Coffee is good but prices are a bit high. Service was slow during rush hour.",
      "date": "2024-01-07"
    },
    {
      "author": "Lisa Thompson",
      "rating": 5,
      "content": "Love this place! Perfect for working or catching up with friends.",
      "date": "2024-01-06"
    }
  ]
}
EOF
    
    echo -e "${GREEN}✓ Demo business created${NC}"
}

# Start development servers
start_development() {
    echo -e "\n${YELLOW}🖥️  Starting development servers...${NC}"
    
    # Create startup script
    cat > start-dev.sh << 'EOF'
#!/bin/bash
echo "Starting Review Insights..."

# Start API server
cd packages/api
pnpm dev &
API_PID=$!

# Start frontend
cd ../frontend
pnpm dev &
FRONTEND_PID=$!

# Start worker
cd ../worker
pnpm dev &
WORKER_PID=$!

echo "Services starting..."
echo "API: http://localhost:3001"
echo "Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap "kill $API_PID $FRONTEND_PID $WORKER_PID; exit" INT
wait
EOF
    
    chmod +x start-dev.sh
    
    echo -e "${GREEN}✓ Development environment ready${NC}"
}

# Deploy to cloud (optional)
deploy_to_cloud() {
    echo -e "\n${YELLOW}☁️  Cloud deployment options:${NC}"
    echo -e "1. Railway (Recommended - Free tier available)"
    echo -e "2. Render (Free tier available)"
    echo -e "3. DigitalOcean App Platform"
    echo -e "4. Skip cloud deployment"
    
    read -p "Choose deployment option (1-4): " deploy_choice
    
    case $deploy_choice in
        1)
            deploy_to_railway
            ;;
        2)
            deploy_to_render
            ;;
        3)
            echo -e "${BLUE}DigitalOcean deployment requires manual setup${NC}"
            echo -e "Visit: https://cloud.digitalocean.com/apps"
            ;;
        4)
            echo -e "${YELLOW}Skipping cloud deployment${NC}"
            ;;
        *)
            echo -e "${YELLOW}Invalid choice, skipping deployment${NC}"
            ;;
    esac
}

# Deploy to Railway
deploy_to_railway() {
    echo -e "\n${YELLOW}🚂 Deploying to Railway...${NC}"
    
    # Check if railway CLI is installed
    if ! command -v railway &> /dev/null; then
        echo -e "${YELLOW}Installing Railway CLI...${NC}"
        curl -fsSL https://railway.app/install.sh | sh
    fi
    
    # Create railway.json
    cat > railway.json << 'EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "numReplicas": 1,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
EOF
    
    echo -e "${BLUE}Railway deployment steps:${NC}"
    echo "1. Run: railway login"
    echo "2. Run: railway init"
    echo "3. Run: railway up"
    echo "4. Run: railway open"
    
    read -p "Would you like to start Railway deployment now? (y/n): " start_railway
    if [[ $start_railway == "y" ]]; then
        railway login
        railway init
        railway up
    fi
}

# Deploy to Render
deploy_to_render() {
    echo -e "\n${YELLOW}🎨 Preparing for Render deployment...${NC}"
    
    # Create render.yaml
    cat > render.yaml << 'EOF'
services:
  # Database
  - type: pserv
    name: reviewinsights-db
    env: docker
    plan: free
    dockerfilePath: ./docker/postgres.Dockerfile
    envVars:
      - key: POSTGRES_USER
        value: reviewinsights
      - key: POSTGRES_PASSWORD
        generateValue: true
      - key: POSTGRES_DB
        value: reviewinsights

  # Redis
  - type: pserv
    name: reviewinsights-redis
    env: docker
    plan: free
    dockerfilePath: ./docker/redis.Dockerfile

  # API
  - type: web
    name: reviewinsights-api
    env: node
    plan: free
    buildCommand: pnpm install && pnpm --filter @review-analysis/api build
    startCommand: pnpm --filter @review-analysis/api start
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: reviewinsights-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          type: pserv
          name: reviewinsights-redis
          property: connectionString

  # Frontend
  - type: web
    name: reviewinsights-frontend
    env: node
    plan: free
    buildCommand: pnpm install && pnpm --filter @review-analysis/frontend build
    startCommand: pnpm --filter @review-analysis/frontend start
    envVars:
      - key: NEXT_PUBLIC_API_URL
        fromService:
          type: web
          name: reviewinsights-api
          property: url
EOF
    
    echo -e "${GREEN}✓ Render configuration created${NC}"
    echo -e "${BLUE}To deploy to Render:${NC}"
    echo "1. Push code to GitHub"
    echo "2. Visit https://render.com"
    echo "3. Connect your GitHub repo"
    echo "4. Render will auto-deploy using render.yaml"
}

# Show summary and next steps
show_summary() {
    echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ Review Insights Setup Complete!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    echo -e "\n${BLUE}📊 Your Setup:${NC}"
    echo -e "• Database: PostgreSQL (Docker)"
    echo -e "• Cache: Redis (Docker)"
    echo -e "• Email: Console mode (dev)"
    echo -e "• AI: ${OPENAI_API_KEY:0:10}..."
    echo -e "• Admin Password: $ADMIN_PASSWORD"
    
    echo -e "\n${BLUE}🌐 Access Points:${NC}"
    echo -e "• Frontend: ${GREEN}http://localhost:3000${NC}"
    echo -e "• API: ${GREEN}http://localhost:3001${NC}"
    echo -e "• Database: ${GREEN}localhost:5432${NC}"
    
    echo -e "\n${BLUE}🚀 Quick Start:${NC}"
    echo -e "1. Run: ${GREEN}./start-dev.sh${NC}"
    echo -e "2. Open: ${GREEN}http://localhost:3000${NC}"
    echo -e "3. Login: ${GREEN}admin@localhost / $ADMIN_PASSWORD${NC}"
    
    echo -e "\n${BLUE}📝 Demo Business:${NC}"
    echo -e "A demo coffee shop has been created with sample reviews."
    echo -e "Try the zero-config setup with: 'Starbucks' or 'amazon.com'"
    
    echo -e "\n${YELLOW}⚡ Pro Tips:${NC}"
    echo -e "• Get free OpenAI credits: https://platform.openai.com"
    echo -e "• View logs: docker-compose logs -f"
    echo -e "• Stop services: docker-compose down"
    echo -e "• Configuration saved in: $DEPLOYMENT_DIR"
    
    # Save quick start script
    cat > quickstart.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting Review Insights..."
docker-compose up -d postgres redis
./start-dev.sh
EOF
    chmod +x quickstart.sh
    
    echo -e "\n${GREEN}Run ${NC}${PURPLE}./quickstart.sh${NC}${GREEN} to start anytime!${NC}"
}

# Error handling
handle_error() {
    echo -e "\n${RED}❌ An error occurred!${NC}"
    echo -e "${YELLOW}Check the logs above for details.${NC}"
    echo -e "${BLUE}Need help? Check TROUBLESHOOTING.md${NC}"
    exit 1
}

# Main execution flow
main() {
    clear
    show_banner
    
    # Set error handling
    trap handle_error ERR
    
    # Ask for confirmation
    echo -e "${YELLOW}This script will:${NC}"
    echo "• Install required dependencies"
    echo "• Set up a local development environment"
    echo "• Configure everything automatically"
    echo "• Create demo data for testing"
    echo ""
    read -p "Ready to start? (y/n): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Setup cancelled.${NC}"
        exit 0
    fi
    
    # Run setup steps
    detect_system
    install_dependencies
    generate_secrets
    setup_free_services
    setup_repository
    configure_environment
    build_application
    start_services
    create_demo_business
    start_development
    
    # Optional cloud deployment
    echo -e "\n${YELLOW}Would you like to deploy to the cloud?${NC}"
    read -p "Deploy to cloud? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        deploy_to_cloud
    fi
    
    # Show summary
    show_summary
}

# Run main function
main "$@"