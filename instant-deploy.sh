#!/bin/bash

# Review Insights - Instant Cloud Deploy
# Deploy to free cloud services with one command!

echo "🚀 Review Insights - Instant Deploy"
echo "=================================="
echo ""
echo "Choose your deployment platform:"
echo ""
echo "1) 🚊 Railway (Recommended - $5 free credit)"
echo "2) 🎨 Render (Free tier available)"  
echo "3) 🌊 DigitalOcean ($200 credit for new users)"
echo "4) 🏠 Local Docker (On this machine)"
echo ""
read -p "Select platform (1-4): " choice

case $choice in
    1)
        # Railway One-Click Deploy
        echo "Deploying to Railway..."
        
        # Create a temporary directory
        TEMP_DIR=$(mktemp -d)
        cd $TEMP_DIR
        
        # Create minimal files needed for Railway
        cat > package.json << 'EOF'
{
  "name": "review-insights-deploy",
  "scripts": {
    "start": "npx degit https://github.com/review-insights/platform && cd platform && npm run deploy"
  }
}
EOF

        cat > .env << EOF
ADMIN_PASSWORD=$(openssl rand -base64 12 | tr -d "=+/" | cut -c1-12)
EOF

        # Install Railway CLI if needed
        if ! command -v railway &> /dev/null; then
            curl -fsSL https://railway.app/install.sh | sh
        fi
        
        # Deploy
        railway login
        railway init --name "review-insights"
        railway up
        railway domain
        
        echo "✅ Deployed to Railway!"
        echo "Visit your Railway dashboard to see your app URL"
        ;;
        
    2)
        # Render One-Click Deploy
        echo "Deploying to Render..."
        
        # Create deploy button URL
        DEPLOY_URL="https://render.com/deploy?repo=https://github.com/review-insights/platform"
        
        echo "Opening Render deploy page..."
        if command -v open &> /dev/null; then
            open "$DEPLOY_URL"
        elif command -v xdg-open &> /dev/null; then
            xdg-open "$DEPLOY_URL"
        else
            echo "Visit: $DEPLOY_URL"
        fi
        
        echo "✅ Follow the instructions on Render to complete deployment"
        ;;
        
    3)
        # DigitalOcean App Platform
        echo "Deploying to DigitalOcean..."
        
        # Create app spec
        cat > app.yaml << 'EOF'
name: review-insights
region: sfo
services:
- name: web
  github:
    repo: review-insights/platform
    branch: main
    deploy_on_push: true
  build_command: npm run build
  run_command: npm start
  environment_slug: node-js
  instance_size_slug: basic-xxs
  instance_count: 1
  http_port: 3000
  envs:
  - key: NODE_ENV
    value: production
  - key: ADMIN_PASSWORD
    type: SECRET
    value: ${ADMIN_PASSWORD}
databases:
- name: db
  engine: PG
  version: "15"
  size: db-s-dev-database
  num_nodes: 1
EOF
        
        echo "Install doctl: https://docs.digitalocean.com/reference/doctl/how-to/install/"
        echo "Then run: doctl apps create --spec app.yaml"
        ;;
        
    4)
        # Local Docker - Super Simple
        echo "Setting up local deployment..."
        
        # Generate password
        ADMIN_PASS=$(openssl rand -base64 12 | tr -d "=+/" | cut -c1-12)
        
        # Create a single docker-compose file
        cat > docker-compose.yml << EOF
version: '3.8'

services:
  review-insights:
    image: ghcr.io/review-insights/platform:latest
    ports:
      - "80:3000"
    environment:
      - ADMIN_PASSWORD=$ADMIN_PASS
      - DATABASE_URL=postgres://postgres:postgres@db:5432/reviewinsights
      - REDIS_URL=redis://cache:6379
    depends_on:
      - db
      - cache

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: reviewinsights
    volumes:
      - pgdata:/var/lib/postgresql/data

  cache:
    image: redis:7-alpine

volumes:
  pgdata:
EOF

        # Start it
        docker-compose up -d
        
        echo ""
        echo "✅ Review Insights is starting!"
        echo ""
        echo "🌐 URL: http://localhost"
        echo "📧 Email: admin@localhost"  
        echo "🔑 Password: $ADMIN_PASS"
        echo ""
        echo "Saved to: credentials.txt"
        echo "admin@localhost:$ADMIN_PASS" > credentials.txt
        ;;
esac