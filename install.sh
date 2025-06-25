#!/bin/bash
# Review Insights - One Line Installer
# Run: curl -fsSL https://get.reviewinsights.ai | bash

set -e

# Detect OS
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

# Colors
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    NC=''
fi

# Banner
echo -e "${BLUE}"
cat << "EOF"
   ___           _              ___           _       _    _       
  | _ \___ __ __(_)_____ __ __ |_ _|_ _  ___ (_)__ _ | |_ | |_ ___ 
  |   / -_)\ V /| / -_) V  V /  | || ' \(_-< | / _` ||   \|  _(_-< 
  |_|_\___| \_/ |_\___|\_/\_/  |___|_||_/__/ |_\__, ||_||_|\__/__/ 
                                                |___/               
EOF
echo -e "${NC}"
echo -e "${GREEN}The AI-powered review management platform${NC}"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Installing Docker...${NC}"
    
    if [[ "$OS" == "darwin" ]]; then
        echo -e "${RED}Please install Docker Desktop manually:${NC}"
        echo "https://www.docker.com/products/docker-desktop"
        exit 1
    else
        curl -fsSL https://get.docker.com | sh
        sudo usermod -aG docker $USER
        echo -e "${GREEN}✓ Docker installed${NC}"
        echo -e "${YELLOW}Please log out and back in for Docker permissions${NC}"
    fi
fi

# Quick check if docker works
if ! docker info &> /dev/null; then
    echo -e "${RED}Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Generate credentials
ADMIN_PASS=$(openssl rand -base64 12 | tr -d "=+/" | cut -c1-12 2>/dev/null || echo "Admin123!")
INSTALL_DIR="$HOME/.reviewinsights"

# Create install directory
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Download compose file
echo -e "${YELLOW}Downloading Review Insights...${NC}"
cat > docker-compose.yml << EOF
version: '3.8'

services:
  app:
    image: reviewinsights/platform:latest
    container_name: reviewinsights
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=sqlite:///data/reviewinsights.db
      - ADMIN_EMAIL=admin@localhost
      - ADMIN_PASSWORD=$ADMIN_PASS
      - AI_MODE=demo
    volumes:
      - ./data:/data
      - ./uploads:/app/uploads

  nginx:
    image: nginx:alpine
    container_name: reviewinsights-proxy
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - app
EOF

# Create nginx config
cat > nginx.conf << 'EOF'
events { worker_connections 1024; }
http {
    server {
        listen 80;
        location / {
            proxy_pass http://app:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
EOF

# Create start script
cat > start.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
docker-compose pull
docker-compose up -d
echo "Review Insights is starting..."
echo "Waiting for services..."
sleep 5
docker-compose ps
EOF
chmod +x start.sh

# Create stop script
cat > stop.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
docker-compose down
EOF
chmod +x stop.sh

# Create uninstall script
cat > uninstall.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
docker-compose down -v
cd ..
rm -rf reviewinsights
echo "Review Insights has been uninstalled"
EOF
chmod +x uninstall.sh

# Pull images
echo -e "${YELLOW}Downloading application...${NC}"
docker pull reviewinsights/platform:latest 2>/dev/null || docker pull nginx:alpine

# Start services
echo -e "${YELLOW}Starting Review Insights...${NC}"
docker-compose up -d

# Wait for startup
sleep 5

# Save credentials
cat > credentials.txt << EOF
Review Insights Credentials
==========================
URL: http://localhost
Email: admin@localhost
Password: $ADMIN_PASS

Installation Directory: $INSTALL_DIR
EOF

# Success message
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              ✅ Installation Complete! ✅                  ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo -e "${BLUE}Access your Review Insights platform:${NC}"
echo -e "   URL: ${GREEN}http://localhost${NC}"
echo -e "   Email: ${GREEN}admin@localhost${NC}"
echo -e "   Password: ${GREEN}$ADMIN_PASS${NC}"
echo ""
echo -e "${BLUE}Manage your installation:${NC}"
echo -e "   Start: ${GREEN}$INSTALL_DIR/start.sh${NC}"
echo -e "   Stop: ${GREEN}$INSTALL_DIR/stop.sh${NC}"
echo -e "   Logs: ${GREEN}docker logs reviewinsights${NC}"
echo ""
echo -e "${YELLOW}Credentials saved to: $INSTALL_DIR/credentials.txt${NC}"

# Try to open browser
if command -v open &> /dev/null; then
    open http://localhost
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost
fi

# Create desktop shortcut (optional)
if [[ "$OS" == "darwin" ]]; then
    # macOS
    cat > ~/Desktop/ReviewInsights.command << EOF
#!/bin/bash
open http://localhost
EOF
    chmod +x ~/Desktop/ReviewInsights.command
elif [[ "$OS" == "linux" ]] && [ -d ~/Desktop ]; then
    # Linux with desktop
    cat > ~/Desktop/review-insights.desktop << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Review Insights
Comment=AI-powered review management
Exec=xdg-open http://localhost
Icon=web-browser
Terminal=false
Categories=Office;Network;
EOF
    chmod +x ~/Desktop/review-insights.desktop
fi

echo ""
echo -e "${GREEN}🎉 Enjoy Review Insights!${NC}"