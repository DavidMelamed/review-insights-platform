#!/bin/bash

# Review Insights - GitHub Repository Setup
# Automatically configures GitHub repository with all features

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Review Insights - GitHub Setup${NC}"
echo "================================"
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
    echo -e "${YELLOW}Initializing git repository...${NC}"
    git init
    git add .
    git commit -m "Initial commit: AI-powered review management platform 🚀"
fi

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${YELLOW}GitHub CLI not found. Installing...${NC}"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install gh
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
        sudo apt update
        sudo apt install gh
    fi
fi

# Authenticate with GitHub
echo -e "${YELLOW}Authenticating with GitHub...${NC}"
gh auth status || gh auth login

# Get repository name
echo -e "${BLUE}What should we call your repository?${NC}"
read -p "Repository name (default: review-insights-platform): " REPO_NAME
REPO_NAME=${REPO_NAME:-review-insights-platform}

# Create repository
echo -e "${YELLOW}Creating GitHub repository...${NC}"
gh repo create "$REPO_NAME" \
    --public \
    --description "AI-powered review management platform with zero-config setup" \
    --homepage "https://reviewinsights.ai" \
    --enable-wiki=false \
    --enable-issues=true \
    --enable-projects=true

# Add topics
echo -e "${YELLOW}Adding repository topics...${NC}"
gh api repos/$GITHUB_USER/$REPO_NAME/topics \
    --method PUT \
    --field names='["ai","review-management","saas","typescript","nextjs","sentiment-analysis","zero-config","react","nodejs","postgresql"]'

# Create labels for issues
echo -e "${YELLOW}Creating issue labels...${NC}"
gh label create "deployment" --description "Deployment related" --color "0052CC"
gh label create "ai-feature" --description "AI functionality" --color "7F3BF5"
gh label create "integration" --description "Third-party integrations" --color "FBCA04"
gh label create "customer-request" --description "Requested by customers" --color "F97316"

# Enable GitHub Pages for deploy button
echo -e "${YELLOW}Enabling GitHub Pages...${NC}"
gh api repos/$GITHUB_USER/$REPO_NAME/pages \
    --method POST \
    --field source='{"branch":"main","path":"/docs"}' || true

# Create deploy branch
git checkout -b deploy-buttons
mkdir -p docs
cp deploy-button.html docs/index.html
git add docs/
git commit -m "Add deployment page for GitHub Pages"
git push -u origin deploy-buttons

# Switch back to main
git checkout main

# Set up secrets for GitHub Actions
echo -e "${YELLOW}Setting up GitHub Actions secrets...${NC}"
echo -e "${BLUE}We'll set up some demo values. You can update these later.${NC}"

# Generate random secrets
ADMIN_PASSWORD=$(openssl rand -base64 12 | tr -d "=+/" | cut -c1-12)
JWT_SECRET=$(openssl rand -base64 32)

gh secret set ADMIN_PASSWORD --body "$ADMIN_PASSWORD"
gh secret set JWT_SECRET --body "$JWT_SECRET"
gh secret set RAILWAY_TOKEN --body "demo-token-update-later"
gh secret set RENDER_API_KEY --body "demo-token-update-later"
gh secret set VERCEL_TOKEN --body "demo-token-update-later"

# Enable repository as template
echo -e "${YELLOW}Configuring as template repository...${NC}"
gh api repos/$GITHUB_USER/$REPO_NAME \
    --method PATCH \
    --field is_template=true

# Create GitHub Actions workflow for auto-deployment
mkdir -p .github/workflows
cp .github/workflows/deploy-demo.yml .github/workflows/deploy.yml

# Push everything
echo -e "${YELLOW}Pushing to GitHub...${NC}"
git add .
git commit -m "Configure GitHub repository with deployment automation"
git push -u origin main

# Create releases
echo -e "${YELLOW}Creating initial release...${NC}"
gh release create v1.0.0 \
    --title "Review Insights v1.0.0 - Initial Release" \
    --notes "🚀 **AI-Powered Review Management Platform**

## Features
- 🤖 Zero-config AI setup
- 📊 Multi-platform review collection
- 💬 AI response generation
- 📈 Real-time analytics
- 🎨 White-label customization
- 📱 Mobile SDK included

## Quick Deploy
- Railway: 30 seconds
- Render: 1 minute
- Vercel: 30 seconds
- Local: 5 minutes

## Documentation
See [deployment guide](https://github.com/$GITHUB_USER/$REPO_NAME/blob/main/DEPLOY_EASY.md)" \
    --latest

# Final summary
echo -e "${GREEN}"
echo "✅ GitHub Repository Setup Complete!"
echo "===================================="
echo -e "${NC}"
echo ""
echo -e "${BLUE}Repository URL:${NC} https://github.com/$GITHUB_USER/$REPO_NAME"
echo -e "${BLUE}Deploy Page:${NC} https://$GITHUB_USER.github.io/$REPO_NAME"
echo -e "${BLUE}Template URL:${NC} https://github.com/$GITHUB_USER/$REPO_NAME/generate"
echo ""
echo -e "${YELLOW}Quick Deploy Buttons:${NC}"
echo "Railway: https://railway.app/new/template?template=https://github.com/$GITHUB_USER/$REPO_NAME"
echo "Render: https://render.com/deploy?repo=https://github.com/$GITHUB_USER/$REPO_NAME"
echo "Vercel: https://vercel.com/new/clone?repository-url=https://github.com/$GITHUB_USER/$REPO_NAME"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "1. Update secrets with real API tokens"
echo "2. Customize the deploy page design"
echo "3. Add demo videos to README"
echo "4. Share your template!"