#!/usr/bin/env python3
"""
GitHub Repository Creator for Review Insights
This script creates a GitHub repository using the GitHub API
"""

import subprocess
import sys
import json
import os

def main():
    print("🚀 Review Insights - GitHub Repository Creator")
    print("=" * 50)
    print()
    
    # Check if we have curl
    try:
        subprocess.run(['curl', '--version'], capture_output=True, check=True)
    except:
        print("❌ Error: curl is required but not installed")
        sys.exit(1)
    
    print("This script will create a GitHub repository using the GitHub API.")
    print("You'll need a GitHub Personal Access Token with 'repo' scope.")
    print()
    print("📝 How to get a token:")
    print("1. Go to: https://github.com/settings/tokens/new")
    print("2. Give it a name (e.g., 'Review Insights Setup')")
    print("3. Select scopes: ✓ repo (Full control of private repositories)")
    print("4. Click 'Generate token'")
    print("5. Copy the token (you won't see it again!)")
    print()
    
    # Get user input
    username = input("GitHub username: ").strip()
    if not username:
        print("❌ Username is required!")
        sys.exit(1)
    
    token = input("GitHub Personal Access Token: ").strip()
    if not token:
        print("❌ Token is required!")
        sys.exit(1)
    
    repo_name = "review-insights-platform"
    
    print(f"\n✅ Creating repository: {username}/{repo_name}")
    
    # Create repository using GitHub API
    create_repo_cmd = [
        'curl', '-X', 'POST',
        '-H', f'Authorization: token {token}',
        '-H', 'Accept: application/vnd.github.v3+json',
        'https://api.github.com/user/repos',
        '-d', json.dumps({
            "name": repo_name,
            "description": "AI-powered review management platform with zero-config setup",
            "homepage": f"https://{username}.github.io/{repo_name}/",
            "private": False,
            "has_issues": True,
            "has_projects": True,
            "has_wiki": False,
            "auto_init": False
        })
    ]
    
    print("\n📡 Creating repository...")
    result = subprocess.run(create_repo_cmd, capture_output=True, text=True)
    
    if result.returncode != 0 or '"message"' in result.stdout:
        response = json.loads(result.stdout)
        if response.get('message') == 'Bad credentials':
            print("❌ Invalid token! Please check your Personal Access Token.")
        elif 'already exists' in response.get('message', ''):
            print(f"❌ Repository {username}/{repo_name} already exists!")
        else:
            print(f"❌ Error: {response.get('message', 'Unknown error')}")
        sys.exit(1)
    
    print("✅ Repository created successfully!")
    
    # Add remote and push
    repo_url = f"https://github.com/{username}/{repo_name}.git"
    
    print(f"\n📤 Adding remote: {repo_url}")
    subprocess.run(['git', 'remote', 'add', 'origin', repo_url], capture_output=True)
    
    print("📤 Pushing main branch...")
    push_result = subprocess.run(
        ['git', 'push', '-u', 'origin', 'main'],
        capture_output=True,
        text=True
    )
    
    if push_result.returncode != 0:
        print(f"❌ Push failed: {push_result.stderr}")
        print("\nTry running manually:")
        print(f"git remote set-url origin https://{username}:{token}@github.com/{username}/{repo_name}.git")
        print("git push -u origin main")
        sys.exit(1)
    
    print("✅ Main branch pushed!")
    
    print("📤 Pushing gh-pages branch...")
    subprocess.run(['git', 'push', 'origin', 'gh-pages'], capture_output=True)
    print("✅ GitHub Pages branch pushed!")
    
    # Add topics
    print("\n🏷️  Adding repository topics...")
    topics_cmd = [
        'curl', '-X', 'PUT',
        '-H', f'Authorization: token {token}',
        '-H', 'Accept: application/vnd.github.mercy-preview+json',
        f'https://api.github.com/repos/{username}/{repo_name}/topics',
        '-d', json.dumps({
            "names": ["ai", "review-management", "saas", "typescript", "nextjs", "sentiment-analysis", "zero-config"]
        })
    ]
    subprocess.run(topics_cmd, capture_output=True)
    print("✅ Topics added!")
    
    print("\n" + "=" * 50)
    print("🎉 SUCCESS! Your repository is now live!")
    print("=" * 50)
    print()
    print(f"📁 Repository: https://github.com/{username}/{repo_name}")
    print(f"📄 Deploy Page: https://{username}.github.io/{repo_name}/")
    print()
    print("📋 Next steps:")
    print(f"1. Enable GitHub Pages: https://github.com/{username}/{repo_name}/settings/pages")
    print("   - Source: Deploy from branch")
    print("   - Branch: gh-pages → /docs")
    print()
    print("🚀 Deploy buttons:")
    print(f"Railway: https://railway.app/new/template?template=https://github.com/{username}/{repo_name}")
    print(f"Render: https://render.com/deploy?repo=https://github.com/{username}/{repo_name}")
    print(f"Vercel: https://vercel.com/new/clone?repository-url=https://github.com/{username}/{repo_name}")
    print()
    print("✨ Your Review Insights platform is ready to share!")

if __name__ == "__main__":
    os.chdir("/home/david/review-analysis-saas")
    main()