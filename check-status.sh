#!/bin/bash

# Check current setup status

echo "📊 Review Insights - Setup Status"
echo "================================="
echo ""

# Check Git
echo "✓ Git Status:"
echo "  - Current branch: $(git branch --show-current)"
echo "  - Total commits: $(git rev-list --all --count)"
echo "  - Total files: $(git ls-files | wc -l)"
echo ""

# Check GitHub CLI
echo "✓ GitHub CLI:"
export PATH="$HOME/.local/bin:$PATH"
if [ -f ~/.local/bin/gh ]; then
    echo "  - Installed: Yes ($(~/.local/bin/gh --version | head -1))"
    if ~/.local/bin/gh auth status &> /dev/null; then
        echo "  - Authenticated: Yes"
        echo "  - User: $(~/.local/bin/gh api user --jq .login)"
    else
        echo "  - Authenticated: No (run: gh auth login)"
    fi
else
    echo "  - Installed: No"
fi
echo ""

# Check remote
echo "✓ Git Remote:"
if git remote -v | grep -q origin; then
    git remote -v | grep origin | head -1
else
    echo "  - No remote configured"
fi
echo ""

# Next steps
echo "📋 Next Steps:"
if ! ~/.local/bin/gh auth status &> /dev/null; then
    echo "1. Authenticate with GitHub:"
    echo "   ~/.local/bin/gh auth login --web"
    echo ""
    echo "2. Then run:"
    echo "   ./create-repo-with-gh-portable.sh"
else
    echo "1. Create and push repository:"
    echo "   ./create-repo-with-gh-portable.sh"
fi
echo ""
echo "Total setup time: ~2 minutes"