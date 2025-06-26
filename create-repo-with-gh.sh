#!/bin/bash

# Create GitHub repository using GitHub CLI

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}Review Insights - GitHub Repository Setup with CLI${NC}"
echo "=================================================="
echo ""

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}GitHub CLI not installed!${NC}"
    echo "Run: ./install-gh-cli.sh"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}Not authenticated with GitHub!${NC}"
    echo "Running authentication..."
    gh auth login --web
fi

# Get current user
GITHUB_USER=$(gh api user --jq .login)
echo -e "${GREEN}✓ Authenticated as: $GITHUB_USER${NC}"
echo ""

REPO_NAME="review-insights-platform"

# Create repository
echo -e "${YELLOW}Creating repository: $GITHUB_USER/$REPO_NAME${NC}"

gh repo create "$REPO_NAME" \
    --public \
    --description "AI-powered review management platform with zero-config setup" \
    --homepage "https://$GITHUB_USER.github.io/$REPO_NAME/" \
    --push \
    --source . \
    || echo -e "${YELLOW}Repository might already exist, continuing...${NC}"

# Set repository topics
echo -e "${YELLOW}Setting repository topics...${NC}"
gh repo edit "$GITHUB_USER/$REPO_NAME" \
    --add-topic "ai" \
    --add-topic "review-management" \
    --add-topic "saas" \
    --add-topic "typescript" \
    --add-topic "nextjs" \
    --add-topic "sentiment-analysis" \
    --add-topic "zero-config"

# Push branches
echo -e "${YELLOW}Pushing branches...${NC}"

# Make sure we have the remote set
git remote set-url origin "https://github.com/$GITHUB_USER/$REPO_NAME.git" 2>/dev/null || \
git remote add origin "https://github.com/$GITHUB_USER/$REPO_NAME.git"

# Push main branch
echo "Pushing main branch..."
git push -u origin main --force

# Push gh-pages branch
echo "Pushing gh-pages branch..."
git push origin gh-pages --force

# Enable GitHub Pages
echo -e "${YELLOW}Enabling GitHub Pages...${NC}"
gh api repos/$GITHUB_USER/$REPO_NAME/pages \
    --method POST \
    --field source='{"branch":"gh-pages","path":"/docs"}' \
    2>/dev/null || echo -e "${YELLOW}GitHub Pages might already be enabled${NC}"

# Make it a template repository
echo -e "${YELLOW}Making repository a template...${NC}"
gh api repos/$GITHUB_USER/$REPO_NAME \
    --method PATCH \
    --field is_template=true

# Create release
echo -e "${YELLOW}Creating release v1.0.0...${NC}"
gh release create v1.0.0 \
    --repo "$GITHUB_USER/$REPO_NAME" \
    --title "Review Insights v1.0.0 - Initial Release" \
    --notes "🚀 **AI-Powered Review Management Platform**

## ✨ Highlights
- 🤖 **Zero-config AI setup** - just enter business name
- 📊 **Multi-platform collection** - Google, Yelp, Facebook, Amazon, G2, Trustpilot
- 💬 **AI response generation** - personalized in your brand voice
- 📈 **Predictive analytics** - churn detection, satisfaction forecasting
- 🎨 **White-label reports** - beautiful PDFs with your branding
- 📱 **Mobile SDK** - React Native for in-app reviews

## 🚀 Quick Deploy
Deploy in seconds with one click:
- **Railway**: 30 seconds
- **Render**: 1 minute  
- **Vercel**: 30 seconds
- **Docker**: 5 minutes local

## 📚 Documentation
See deployment guide in README" \
    --latest

# Open repository in browser
echo -e "${YELLOW}Opening repository in browser...${NC}"
gh repo view --web

echo ""
echo -e "${GREEN}✅ SUCCESS! Your repository is fully set up!${NC}"
echo ""
echo -e "${BLUE}Repository:${NC} https://github.com/$GITHUB_USER/$REPO_NAME"
echo -e "${BLUE}Deploy Page:${NC} https://$GITHUB_USER.github.io/$REPO_NAME/"
echo ""
echo -e "${GREEN}Deploy Buttons:${NC}"
echo "Railway: https://railway.app/new/template?template=https://github.com/$GITHUB_USER/$REPO_NAME"
echo "Render: https://render.com/deploy?repo=https://github.com/$GITHUB_USER/$REPO_NAME"
echo "Vercel: https://vercel.com/new/clone?repository-url=https://github.com/$GITHUB_USER/$REPO_NAME"
echo ""
echo -e "${GREEN}🎉 Your Review Insights platform is live and ready to share!${NC}"