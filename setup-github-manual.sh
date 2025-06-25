#!/bin/bash

# Review Insights - GitHub Setup (Manual Steps)
# This version works without GitHub CLI

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}Review Insights - GitHub Setup${NC}"
echo "================================"
echo ""

# Check if git is already initialized
if [ -d .git ]; then
    echo -e "${YELLOW}Git repository already initialized${NC}"
else
    echo -e "${YELLOW}Initializing git repository...${NC}"
    git init
    git branch -m main
fi

# Add all files
echo -e "${YELLOW}Adding files to git...${NC}"
git add .

# Create initial commit
echo -e "${YELLOW}Creating initial commit...${NC}"
git commit -m "Initial commit: AI-powered review management platform 🚀

- Zero-config AI setup
- Multi-platform review collection
- Predictive analytics
- White-label reports
- One-click deployment
" || echo -e "${YELLOW}Files already committed${NC}"

# Create .gitignore if it doesn't exist
if [ ! -f .gitignore ]; then
    echo -e "${YELLOW}Creating .gitignore...${NC}"
    cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnpm-store/

# Environment
.env
.env.local
.env.*.local

# Build outputs
dist/
build/
.next/
out/
*.tsbuildinfo

# Logs
logs/
*.log
npm-debug.log*
pnpm-debug.log*
yarn-debug.log*
yarn-error.log*

# Testing
coverage/
.nyc_output/

# IDE
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# Database
*.sqlite
*.sqlite3
*.db
prisma/migrations/dev/

# Uploads
uploads/
temp/

# Credentials
credentials.txt
*.pem
*.key
*.cert
EOF
    git add .gitignore
    git commit -m "Add .gitignore"
fi

# Create deploy branch for GitHub Pages
echo -e "${YELLOW}Creating deploy branch for GitHub Pages...${NC}"
git checkout -b gh-pages || git checkout gh-pages
mkdir -p docs
cp deploy-button.html docs/index.html || echo "Deploy button already copied"
git add docs/
git commit -m "Add deployment page for GitHub Pages" || echo "Deploy page already committed"
git checkout main

echo ""
echo -e "${GREEN}✅ Local Git Setup Complete!${NC}"
echo ""
echo -e "${BLUE}Now, let's set up your GitHub repository:${NC}"
echo ""
echo -e "${YELLOW}Step 1: Create a new repository on GitHub${NC}"
echo "1. Go to: https://github.com/new"
echo "2. Repository name: review-insights-platform (or your choice)"
echo "3. Description: AI-powered review management platform with zero-config setup"
echo "4. Make it Public"
echo "5. DON'T initialize with README (we already have one)"
echo "6. Click 'Create repository'"
echo ""
echo -e "${YELLOW}Step 2: Connect your local repo to GitHub${NC}"
echo "After creating the repository, run these commands:"
echo ""
echo -e "${GREEN}git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git${NC}"
echo -e "${GREEN}git push -u origin main${NC}"
echo -e "${GREEN}git push origin gh-pages${NC}"
echo ""
echo -e "${YELLOW}Step 3: Enable GitHub Pages${NC}"
echo "1. Go to your repository Settings → Pages"
echo "2. Source: Deploy from a branch"
echo "3. Branch: gh-pages, folder: /docs"
echo "4. Click Save"
echo ""
echo -e "${YELLOW}Step 4: Make it a Template Repository${NC}"
echo "1. Go to Settings → General"
echo "2. Check 'Template repository'"
echo "3. Click Save"
echo ""
echo -e "${YELLOW}Step 5: Add Topics${NC}"
echo "1. On your repo main page, click the gear icon next to 'About'"
echo "2. Add topics: ai, review-management, saas, typescript, nextjs, zero-config"
echo ""
echo -e "${YELLOW}Step 6: Create a Release${NC}"
echo "1. Go to Releases → Create a new release"
echo "2. Tag: v1.0.0"
echo "3. Title: Review Insights v1.0.0 - Initial Release"
echo "4. Description: (copy from below)"
echo ""
cat << 'EOF'
🚀 **AI-Powered Review Management Platform**

## Features
- 🤖 Zero-config AI setup - just enter business name
- 📊 Multi-platform review collection
- 💬 AI response generation
- 📈 Predictive analytics
- 🎨 White-label customization
- 📱 Mobile SDK included

## Quick Deploy
- Railway: 30 seconds
- Render: 1 minute
- Vercel: 30 seconds
- Local: 5 minutes

## Documentation
See deployment guide in README
EOF

echo ""
echo -e "${GREEN}✨ After completing these steps, you'll have:${NC}"
echo "- GitHub repository with all code"
echo "- Deploy page at: https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/"
echo "- Template repository for others to use"
echo "- Professional release"
echo ""
echo -e "${BLUE}Deploy Button URLs (update YOUR_USERNAME and YOUR_REPO_NAME):${NC}"
echo "Railway: https://railway.app/new/template?template=https://github.com/YOUR_USERNAME/YOUR_REPO_NAME"
echo "Render: https://render.com/deploy?repo=https://github.com/YOUR_USERNAME/YOUR_REPO_NAME"
echo "Vercel: https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/YOUR_REPO_NAME"
echo ""
echo -e "${GREEN}Ready to proceed? Let's create your GitHub repository! 🚀${NC}"