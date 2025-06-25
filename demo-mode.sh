#!/bin/bash

# Review Insights - Instant Demo Mode
# See the platform in action with zero setup!

set -e

# Colors
G='\033[0;32m'
B='\033[0;34m'
Y='\033[1;33m'
N='\033[0m'

clear
echo -e "${B}Review Insights - Demo Mode${N}"
echo "============================"
echo ""

# Create demo docker-compose
cat > docker-compose-demo.yml << 'EOF'
version: '3.8'

services:
  demo:
    image: node:18-alpine
    working_dir: /app
    ports:
      - "3000:3000"
      - "3001:3001"
    environment:
      - DEMO_MODE=true
      - NODE_ENV=development
    volumes:
      - .:/app
    command: |
      sh -c '
        # Install dependencies
        npm install -g pnpm
        pnpm install --ignore-scripts
        
        # Create demo database
        mkdir -p data
        
        # Create minimal API server
        cat > demo-server.js << "EOJS"
        const express = require("express");
        const cors = require("cors");
        const app = express();
        
        app.use(cors());
        app.use(express.json());
        
        // Demo data
        const demoReviews = [
          {
            id: 1,
            author: "Sarah Johnson",
            rating: 5,
            content: "Absolutely love this coffee shop! Best latte in town.",
            date: new Date().toISOString(),
            source: "Google",
            sentiment: 0.9
          },
          {
            id: 2,
            author: "Mike Chen",
            rating: 4,
            content: "Great atmosphere, good coffee. WiFi could be faster.",
            date: new Date(Date.now() - 86400000).toISOString(),
            source: "Yelp",
            sentiment: 0.6
          },
          {
            id: 3,
            author: "Emily Brown",
            rating: 2,
            content: "Service was really slow today. Disappointed.",
            date: new Date(Date.now() - 172800000).toISOString(),
            source: "Facebook",
            sentiment: -0.7
          }
        ];
        
        // Routes
        app.get("/api/health", (req, res) => res.json({ status: "ok" }));
        
        app.post("/api/auth/login", (req, res) => {
          res.json({
            token: "demo-token",
            user: { email: "demo@localhost", name: "Demo User" }
          });
        });
        
        app.get("/api/reviews", (req, res) => res.json({ reviews: demoReviews }));
        
        app.get("/api/analytics", (req, res) => {
          res.json({
            totalReviews: demoReviews.length,
            averageRating: 3.7,
            sentiment: { positive: 2, neutral: 0, negative: 1 },
            trend: "improving"
          });
        });
        
        app.post("/api/ai/response", (req, res) => {
          const { review } = req.body;
          const responses = {
            positive: "Thank you so much for your kind words! We are thrilled you enjoyed your experience.",
            negative: "We sincerely apologize for your experience. Please contact us so we can make this right."
          };
          res.json({
            response: review.sentiment > 0 ? responses.positive : responses.negative
          });
        });
        
        app.listen(3001, () => console.log("Demo API running on :3001"));
        EOJS
        
        # Create minimal frontend
        cat > demo-frontend.js << "EOJS"
        const http = require("http");
        const fs = require("fs");
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Review Insights Demo</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, system-ui, sans-serif; background: #f5f5f5; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; }
            .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
            .card { background: white; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .stat { text-align: center; padding: 1rem; }
            .stat-value { font-size: 2rem; font-weight: bold; color: #667eea; }
            .review { border-left: 3px solid #667eea; padding-left: 1rem; margin: 1rem 0; }
            .rating { color: #ffd700; }
            .button { background: #667eea; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 4px; cursor: pointer; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Review Insights Demo</h1>
            <p>AI-Powered Review Management Platform</p>
          </div>
          
          <div class="container">
            <div class="card">
              <h2>Quick Stats</h2>
              <div class="grid">
                <div class="stat">
                  <div class="stat-value">4.2</div>
                  <div>Average Rating</div>
                </div>
                <div class="stat">
                  <div class="stat-value">1,234</div>
                  <div>Total Reviews</div>
                </div>
                <div class="stat">
                  <div class="stat-value">89%</div>
                  <div>Positive Sentiment</div>
                </div>
                <div class="stat">
                  <div class="stat-value">2.4h</div>
                  <div>Avg Response Time</div>
                </div>
              </div>
            </div>
            
            <div class="card">
              <h2>Recent Reviews</h2>
              <div id="reviews"></div>
            </div>
            
            <div class="card">
              <h2>Try Zero-Config Setup</h2>
              <p style="margin-bottom: 1rem">Enter any business name and watch our AI discover everything automatically!</p>
              <input type="text" placeholder="e.g., Starbucks, Amazon, Local Restaurant" style="padding: 0.5rem; width: 300px; margin-right: 0.5rem;">
              <button class="button" onclick="alert("In the full version, AI would now:\\n\\n1. Find your business across all platforms\\n2. Discover all review sources\\n3. Identify competitors\\n4. Set up monitoring\\n5. Configure AI responses\\n\\nAll automatically!")">Discover Business</button>
            </div>
          </div>
          
          <script>
            // Load demo reviews
            fetch("http://localhost:3001/api/reviews")
              .then(r => r.json())
              .then(data => {
                const container = document.getElementById("reviews");
                data.reviews.forEach(review => {
                  const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
                  container.innerHTML += \`
                    <div class="review">
                      <div class="rating">\${stars}</div>
                      <strong>\${review.author}</strong> - \${review.source}
                      <p>\${review.content}</p>
                    </div>
                  \`;
                });
              });
          </script>
        </body>
        </html>
        `;
        
        http.createServer((req, res) => {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(html);
        }).listen(3000, () => console.log("Demo UI running on :3000"));
        EOJS
        
        # Install minimal dependencies
        npm install express cors
        
        # Start servers
        node demo-server.js &
        node demo-frontend.js &
        
        echo ""
        echo "🚀 Demo Mode Started!"
        echo ""
        echo "📱 Open: http://localhost:3000"
        echo ""
        echo "Try these features:"
        echo "- View analytics dashboard"
        echo "- Read sample reviews"
        echo "- Test zero-config setup"
        echo ""
        echo "Press Ctrl+C to stop"
        
        # Keep running
        wait
      '
EOF

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${Y}Starting Docker...${N}"
    
    # Try to start Docker
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open -a Docker
        echo "Waiting for Docker to start..."
        sleep 10
    else
        sudo systemctl start docker 2>/dev/null || true
    fi
    
    # Check again
    if ! docker info &> /dev/null; then
        echo -e "${Y}Docker is not running!${N}"
        echo ""
        echo "Please start Docker and run this script again."
        echo ""
        echo "Don't have Docker? Get it from:"
        echo "https://www.docker.com/products/docker-desktop"
        exit 1
    fi
fi

# Run demo
echo -e "${Y}Starting Review Insights Demo...${N}"
echo "This will take about 30 seconds..."
echo ""

# Start container
docker-compose -f docker-compose-demo.yml up --abort-on-container-exit

# Cleanup
docker-compose -f docker-compose-demo.yml down
rm -f docker-compose-demo.yml