#!/bin/bash

# Automatic GitHub Setup - All in One

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     Review Insights - Automatic GitHub Setup 🚀           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if gh is installed
if ! command -v gh &> /dev/null && [ ! -f ~/.local/bin/gh ]; then
    echo -e "${YELLOW}GitHub CLI not found. Installing...${NC}"
    
    # Try portable installation (no sudo required)
    ./install-gh-portable.sh
    
    # Add to PATH
    export PATH="$HOME/.local/bin:$PATH"
    GH_CMD="$HOME/.local/bin/gh"
else
    if [ -f ~/.local/bin/gh ]; then
        GH_CMD="$HOME/.local/bin/gh"
        export PATH="$HOME/.local/bin:$PATH"
    else
        GH_CMD="gh"
    fi
    echo -e "${GREEN}✓ GitHub CLI found${NC}"
fi

# Authenticate
echo ""
if ! $GH_CMD auth status &> /dev/null; then
    echo -e "${YELLOW}Let's authenticate with GitHub!${NC}"
    echo ""
    echo "You'll be given a code to enter on GitHub.com"
    echo "Press Enter when ready..."
    read
    
    $GH_CMD auth login --web
else
    echo -e "${GREEN}✓ Already authenticated with GitHub${NC}"
fi

# Now run the create script
echo ""
echo -e "${YELLOW}Creating and configuring your repository...${NC}"
echo ""

# Use the portable version of the create script
./create-repo-with-gh-portable.sh

echo ""
echo -e "${GREEN}🎉 All done! Your Review Insights platform is live on GitHub!${NC}"