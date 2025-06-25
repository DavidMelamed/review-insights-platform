#!/bin/bash

# Verify GitHub setup

echo "🔍 Verifying GitHub Setup..."
echo "=========================="
echo ""

# Check git status
echo "📋 Git Status:"
git status --short
echo ""

# Check branches
echo "🌿 Branches:"
git branch -a
echo ""

# Check remotes
echo "🔗 Remote repositories:"
git remote -v
echo ""

# Check if remote is set
if git remote | grep -q "origin"; then
    echo "✅ Remote 'origin' is configured"
    echo ""
    echo "📤 To push your code:"
    echo "   git push -u origin main"
    echo "   git push origin gh-pages"
else
    echo "❌ No remote configured yet"
    echo ""
    echo "📝 Add your GitHub repository:"
    echo "   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git"
fi
echo ""

# Check important files
echo "📁 Key files:"
[ -f "README.md" ] && echo "✅ README.md" || echo "❌ README.md"
[ -f "deploy-button.html" ] && echo "✅ deploy-button.html" || echo "❌ deploy-button.html"
[ -f "docs/index.html" ] && echo "✅ docs/index.html (GitHub Pages)" || echo "❌ docs/index.html"
[ -f ".gitignore" ] && echo "✅ .gitignore" || echo "❌ .gitignore"
[ -f "package.json" ] && echo "✅ package.json" || echo "❌ package.json"
echo ""

# Count total files
echo "📊 Repository stats:"
echo "   Total files: $(git ls-files | wc -l)"
echo "   Total commits: $(git rev-list --all --count)"
echo ""

echo "🎯 Next steps:"
echo "1. Create repository on GitHub"
echo "2. Add remote and push"
echo "3. Enable GitHub Pages"
echo "4. Share your project!"