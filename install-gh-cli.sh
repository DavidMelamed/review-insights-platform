#!/bin/bash

# Install GitHub CLI on Linux/WSL

set -e

echo "🚀 Installing GitHub CLI..."
echo "=========================="
echo ""

# Install GitHub CLI for Debian/Ubuntu based systems
echo "📦 Adding GitHub CLI repository..."

# Add GitHub CLI GPG key
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg

# Add GitHub CLI repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null

# Update and install
echo "📥 Installing gh..."
sudo apt update
sudo apt install gh -y

echo ""
echo "✅ GitHub CLI installed successfully!"
echo ""

# Check version
gh --version

echo ""
echo "🔐 Now let's authenticate with GitHub..."
echo ""
echo "You'll be prompted to:"
echo "1. Press Enter to open github.com in your browser"
echo "2. Enter a one-time code"
echo "3. Authorize GitHub CLI"
echo ""
echo "Ready? Let's authenticate!"
echo ""

# Authenticate
gh auth login --web

echo ""
echo "✅ Authentication complete!"
echo ""
echo "🎯 Now run: ./create-repo-with-gh.sh"