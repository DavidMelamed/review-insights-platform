#!/bin/bash

# Review Insights - One-Click GitHub Setup
# This script automates everything after you provide your GitHub username

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}Review Insights - One-Click GitHub Setup${NC}"
echo "========================================"
echo ""

# Get GitHub username
echo -e "${YELLOW}What's your GitHub username?${NC}"
read -p "GitHub username: " GITHUB_USER

if [ -z "$GITHUB_USER" ]; then
    echo -e "${RED}Username is required!${NC}"
    exit 1
fi

# Repository name
REPO_NAME="review-insights-platform"
echo -e "${GREEN}Repository will be created as: https://github.com/$GITHUB_USER/$REPO_NAME${NC}"
echo ""

# Create the repository URL
REPO_URL="https://github.com/$GITHUB_USER/$REPO_NAME.git"

echo -e "${YELLOW}Setting up remote repository...${NC}"
git remote add origin "$REPO_URL" 2>/dev/null || git remote set-url origin "$REPO_URL"

echo -e "${GREEN}✓ Remote configured${NC}"
echo ""

echo -e "${BLUE}Now we need to create the repository on GitHub and push the code.${NC}"
echo ""
echo -e "${YELLOW}Please follow these steps:${NC}"
echo ""
echo "1. ${GREEN}Click this link to create your repository:${NC}"
echo "   https://github.com/new?name=$REPO_NAME&description=AI-powered+review+management+platform+with+zero-config+setup"
echo ""
echo "2. ${GREEN}On the create page:${NC}"
echo "   - The name and description are pre-filled"
echo "   - Make sure it's set to ${YELLOW}Public${NC}"
echo "   - ${RED}DON'T${NC} check any initialization boxes"
echo "   - Click ${GREEN}Create repository${NC}"
echo ""
echo "3. ${GREEN}After creating, come back here and press Enter${NC}"
read -p "Press Enter when you've created the repository..."

echo ""
echo -e "${YELLOW}Pushing your code to GitHub...${NC}"

# Push main branch
echo "Pushing main branch..."
git push -u origin main

# Push gh-pages branch
echo "Pushing GitHub Pages branch..."
git push origin gh-pages

echo -e "${GREEN}✓ Code pushed successfully!${NC}"
echo ""

# Generate the setup completion script
cat > complete-github-setup.sh << EOF
#!/bin/bash

echo "Completing GitHub setup..."
echo ""
echo "Your repository is live at:"
echo "https://github.com/$GITHUB_USER/$REPO_NAME"
echo ""
echo "Next steps:"
echo ""
echo "1. Enable GitHub Pages:"
echo "   https://github.com/$GITHUB_USER/$REPO_NAME/settings/pages"
echo "   - Source: Deploy from a branch"
echo "   - Branch: gh-pages"
echo "   - Folder: /docs"
echo "   - Click Save"
echo ""
echo "2. Make it a template repository:"
echo "   https://github.com/$GITHUB_USER/$REPO_NAME/settings"
echo "   - Check 'Template repository'"
echo "   - Click Save"
echo ""
echo "3. Your deploy page will be at:"
echo "   https://$GITHUB_USER.github.io/$REPO_NAME/"
echo ""
echo "4. Deploy buttons:"
echo "   Railway: https://railway.app/new/template?template=https://github.com/$GITHUB_USER/$REPO_NAME"
echo "   Render: https://render.com/deploy?repo=https://github.com/$GITHUB_USER/$REPO_NAME"
echo "   Vercel: https://vercel.com/new/clone?repository-url=https://github.com/$GITHUB_USER/$REPO_NAME"
EOF

chmod +x complete-github-setup.sh

echo -e "${GREEN}✅ Success! Your code is now on GitHub!${NC}"
echo ""
echo -e "${BLUE}Final steps to complete setup:${NC}"
echo ""
echo "1. ${YELLOW}Enable GitHub Pages:${NC}"
echo "   Visit: https://github.com/$GITHUB_USER/$REPO_NAME/settings/pages"
echo "   - Source: Deploy from a branch"
echo "   - Branch: ${GREEN}gh-pages${NC}"
echo "   - Folder: ${GREEN}/docs${NC}"
echo "   - Click Save"
echo ""
echo "2. ${YELLOW}Make it a template (optional):${NC}"
echo "   Visit: https://github.com/$GITHUB_USER/$REPO_NAME/settings"
echo "   - Check 'Template repository'"
echo ""
echo "3. ${YELLOW}Add topics (optional):${NC}"
echo "   On your repo page, click the gear next to About"
echo "   Add: ai, review-management, saas, typescript, nextjs"
echo ""
echo -e "${GREEN}🎉 Your Review Insights platform is now live on GitHub!${NC}"
echo ""
echo "📋 Important URLs saved to: complete-github-setup.sh"
echo ""
echo "Your repository: ${BLUE}https://github.com/$GITHUB_USER/$REPO_NAME${NC}"
echo "Deploy page: ${BLUE}https://$GITHUB_USER.github.io/$REPO_NAME/${NC}"