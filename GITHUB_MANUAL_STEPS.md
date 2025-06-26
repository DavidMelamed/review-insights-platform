# 🚀 GitHub Setup - Manual Steps

Since the automated script needs your input, here are the exact steps to complete the setup:

## Step 1: Authenticate with GitHub CLI

Open a terminal and run:
```bash
cd /home/david/review-analysis-saas
export PATH="$HOME/.local/bin:$PATH"
~/.local/bin/gh auth login
```

When prompted:
- Choose: **GitHub.com**
- Choose: **HTTPS**
- Choose: **Login with a web browser**
- Copy the one-time code shown (like `XXXX-XXXX`)
- Press Enter to open browser
- Paste the code on GitHub
- Authorize GitHub CLI
- Return to terminal

## Step 2: Create and Push Repository

After authentication succeeds, run:
```bash
cd /home/david/review-analysis-saas
./create-repo-with-gh-portable.sh
```

This will automatically:
- Create your repository
- Push all code
- Enable GitHub Pages
- Set up everything

## Alternative: Manual Commands

If you prefer to do it step by step:

```bash
# 1. Set PATH
export PATH="$HOME/.local/bin:$PATH"

# 2. Check you're authenticated
gh auth status

# 3. Create repository
gh repo create review-insights-platform \
  --public \
  --description "AI-powered review management platform with zero-config setup" \
  --push \
  --source .

# 4. Push gh-pages branch
git push origin gh-pages

# 5. Enable GitHub Pages
gh api repos/$(gh api user --jq .login)/review-insights-platform/pages \
  --method POST \
  --field source='{"branch":"gh-pages","path":"/docs"}'

# 6. Open in browser
gh repo view --web
```

## 🎯 End Result

After completing these steps, you'll have:
- Repository: `https://github.com/YOUR_USERNAME/review-insights-platform`
- Deploy Page: `https://YOUR_USERNAME.github.io/review-insights-platform/`
- One-click deploy buttons ready to use!

## Need Help?

The GitHub CLI is already installed at `~/.local/bin/gh`. You just need to:
1. Authenticate (one-time)
2. Run the create script

Total time: About 2 minutes!