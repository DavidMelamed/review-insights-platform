#!/bin/bash

# Install GitHub CLI - Portable Version (no sudo required)

set -e

echo "🚀 Installing GitHub CLI (Portable Version)..."
echo "==========================================="
echo ""

# Create local bin directory
mkdir -p ~/.local/bin

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then
    ARCH="amd64"
elif [ "$ARCH" = "aarch64" ]; then
    ARCH="arm64"
fi

# Download latest release
echo "📥 Downloading GitHub CLI..."
VERSION=$(curl -s https://api.github.com/repos/cli/cli/releases/latest | grep -oP '"tag_name": "\K[^"]+' | sed 's/v//')
FILENAME="gh_${VERSION}_linux_${ARCH}.tar.gz"
URL="https://github.com/cli/cli/releases/download/v${VERSION}/${FILENAME}"

echo "Version: $VERSION"
echo "URL: $URL"

curl -L -o /tmp/gh.tar.gz "$URL"

# Extract
echo "📦 Extracting..."
cd /tmp
tar -xzf gh.tar.gz
cd -

# Move to local bin
echo "📂 Installing to ~/.local/bin..."
mv "/tmp/gh_${VERSION}_linux_${ARCH}/bin/gh" ~/.local/bin/
chmod +x ~/.local/bin/gh

# Add to PATH if not already there
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> ~/.bashrc
    export PATH="$HOME/.local/bin:$PATH"
fi

# Clean up
rm -rf /tmp/gh.tar.gz "/tmp/gh_${VERSION}_linux_${ARCH}"

echo ""
echo "✅ GitHub CLI installed successfully!"
echo ""

# Check version
~/.local/bin/gh --version

echo ""
echo "🔐 Now let's authenticate with GitHub..."
echo ""
echo "Run: ~/.local/bin/gh auth login --web"
echo ""
echo "Then run: ./create-repo-with-gh-portable.sh"