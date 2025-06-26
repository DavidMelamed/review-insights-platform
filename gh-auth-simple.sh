#!/bin/bash

# Simple GitHub Authentication

echo "🔐 GitHub Authentication"
echo "======================="
echo ""
echo "This will open GitHub in your browser to authenticate."
echo "You'll need to:"
echo "1. Copy the code shown below"
echo "2. Paste it on GitHub.com"
echo "3. Authorize the application"
echo ""
echo "Starting authentication..."
echo ""

# Add to PATH
export PATH="$HOME/.local/bin:$PATH"

# Run authentication
~/.local/bin/gh auth login --web