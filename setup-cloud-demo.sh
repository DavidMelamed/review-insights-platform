#!/bin/bash

# Review Insights - Cloud Demo Setup
# Sets up a fully hosted demo that requires ZERO local installation

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Review Insights - Cloud Demo Setup${NC}"
echo "===================================="
echo ""
echo "This script will create a hosted demo that users can access"
echo "without installing anything on their computer!"
echo ""

# Create a temporary directory
TEMP_DIR=$(mktemp -d)
cd $TEMP_DIR

# Create a simple Node.js app that serves the demo
cat > package.json << 'EOF'
{
  "name": "review-insights-cloud-demo",
  "version": "1.0.0",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3"
  }
}
EOF

# Create the demo server
cat > server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Demo data
const demoBusinesses = [
  {
    id: 'starbucks-demo',
    name: 'Starbucks Coffee Shop',
    industry: 'Restaurant',
    reviewCount: 15234,
    rating: 4.2,
    sentiment: 0.78
  },
  {
    id: 'amazon-demo',
    name: 'Amazon Prime',
    industry: 'E-commerce',
    reviewCount: 892341,
    rating: 4.5,
    sentiment: 0.82
  },
  {
    id: 'local-restaurant',
    name: "Joe's Pizza Place",
    industry: 'Restaurant',
    reviewCount: 342,
    rating: 4.8,
    sentiment: 0.91
  }
];

const demoReviews = [
  {
    id: 1,
    businessId: 'starbucks-demo',
    author: 'Sarah M.',
    rating: 5,
    content: 'Amazing coffee and great atmosphere! The baristas are always friendly.',
    date: new Date().toISOString(),
    source: 'Google',
    sentiment: 0.9,
    topics: ['coffee quality', 'customer service', 'atmosphere']
  },
  {
    id: 2,
    businessId: 'starbucks-demo',
    author: 'Mike R.',
    rating: 3,
    content: 'Coffee was okay but the wait was too long during rush hour.',
    date: new Date(Date.now() - 86400000).toISOString(),
    source: 'Yelp',
    sentiment: 0.3,
    topics: ['wait time', 'coffee quality']
  },
  {
    id: 3,
    businessId: 'starbucks-demo',
    author: 'Emma L.',
    rating: 4,
    content: 'Good coffee, nice place to work. WiFi could be faster.',
    date: new Date(Date.now() - 172800000).toISOString(),
    source: 'Facebook',
    sentiment: 0.6,
    topics: ['coffee quality', 'workspace', 'wifi']
  }
];

// API Routes
app.get('/api/demo/discover', (req, res) => {
  const { business } = req.query;
  
  // Simulate AI discovery
  setTimeout(() => {
    const discovered = demoBusinesses.find(b => 
      b.name.toLowerCase().includes(business.toLowerCase())
    ) || demoBusinesses[0];
    
    res.json({
      business: discovered,
      competitors: demoBusinesses.filter(b => b.id !== discovered.id),
      reviewSources: ['Google', 'Yelp', 'Facebook', 'TripAdvisor'],
      suggestedFeatures: [
        'Real-time sentiment monitoring',
        'AI response generation',
        'Competitor benchmarking',
        'Custom branded reports'
      ]
    });
  }, 1500); // Simulate processing time
});

app.get('/api/demo/reviews', (req, res) => {
  res.json({ reviews: demoReviews });
});

app.get('/api/demo/analytics', (req, res) => {
  res.json({
    totalReviews: 15234,
    averageRating: 4.2,
    sentimentScore: 0.78,
    topComplaints: [
      { issue: 'Long wait times', count: 234, trend: 'increasing' },
      { issue: 'WiFi speed', count: 123, trend: 'stable' },
      { issue: 'Parking availability', count: 89, trend: 'decreasing' }
    ],
    topPraises: [
      { praise: 'Friendly staff', count: 892, trend: 'stable' },
      { praise: 'Great coffee', count: 1234, trend: 'increasing' },
      { praise: 'Nice atmosphere', count: 567, trend: 'increasing' }
    ],
    competitorComparison: {
      yourBusiness: { rating: 4.2, reviews: 15234 },
      avgCompetitor: { rating: 3.9, reviews: 8923 },
      topCompetitor: { rating: 4.5, reviews: 23456 }
    }
  });
});

app.post('/api/demo/ai-response', (req, res) => {
  const { review } = req.body;
  
  // Simulate AI response generation
  setTimeout(() => {
    const responses = {
      positive: "Thank you so much for your wonderful review! We're thrilled to hear you enjoyed your experience with us. Your feedback means the world to our team!",
      neutral: "Thank you for taking the time to share your feedback. We appreciate your honest review and are always looking for ways to improve our service.",
      negative: "We sincerely apologize that your experience didn't meet expectations. Your feedback is invaluable, and we'd love the opportunity to make this right. Please reach out to us directly."
    };
    
    const sentiment = review.sentiment || 0.5;
    const responseType = sentiment > 0.6 ? 'positive' : sentiment > 0.3 ? 'neutral' : 'negative';
    
    res.json({
      suggestedResponse: responses[responseType],
      sentiment: sentiment,
      confidence: 0.92
    });
  }, 1000);
});

// Serve the demo UI
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Demo server running on port ${PORT}`);
});
EOF

# Create the demo UI
mkdir -p public
cat > public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Review Insights - Live Demo</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f7fa;
            color: #333;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            text-align: center;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        .demo-section {
            background: white;
            border-radius: 10px;
            padding: 2rem;
            margin: 2rem 0;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .input-group {
            display: flex;
            gap: 1rem;
            margin: 2rem 0;
        }
        input {
            flex: 1;
            padding: 1rem;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            font-size: 1rem;
        }
        button {
            background: #667eea;
            color: white;
            border: none;
            padding: 1rem 2rem;
            border-radius: 8px;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        button:hover {
            background: #5a67d8;
            transform: translateY(-2px);
        }
        .loading {
            text-align: center;
            padding: 2rem;
            color: #667eea;
        }
        .results {
            display: none;
        }
        .stat-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin: 2rem 0;
        }
        .stat-card {
            background: #f8f9fa;
            padding: 1.5rem;
            border-radius: 8px;
            text-align: center;
        }
        .stat-value {
            font-size: 2rem;
            font-weight: bold;
            color: #667eea;
        }
        .review-card {
            border-left: 3px solid #667eea;
            padding: 1rem;
            margin: 1rem 0;
            background: #f8f9fa;
        }
        .rating {
            color: #ffd700;
        }
        .cta-section {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 3rem;
            border-radius: 10px;
            text-align: center;
            margin: 2rem 0;
        }
        .deploy-buttons {
            display: flex;
            gap: 1rem;
            justify-content: center;
            margin-top: 2rem;
            flex-wrap: wrap;
        }
        .deploy-btn {
            background: white;
            color: #667eea;
            padding: 1rem 2rem;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            transition: all 0.3s ease;
        }
        .deploy-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.2);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Review Insights - Live Demo</h1>
        <p>Experience AI-powered review management with zero setup!</p>
    </div>
    
    <div class="container">
        <div class="demo-section">
            <h2>🤖 Try our Zero-Config AI Setup</h2>
            <p>Enter any business name and watch our AI discover everything automatically!</p>
            
            <div class="input-group">
                <input type="text" id="businessInput" placeholder="Try: Starbucks, Amazon, or any business name...">
                <button onclick="discoverBusiness()">Discover with AI</button>
            </div>
            
            <div id="loading" class="loading" style="display: none;">
                <div>🔍 AI is discovering your business...</div>
                <div>Finding review sources, competitors, and opportunities...</div>
            </div>
            
            <div id="results" class="results">
                <h3>✨ AI Discovery Complete!</h3>
                
                <div class="stat-grid">
                    <div class="stat-card">
                        <div class="stat-value" id="reviewCount">15,234</div>
                        <div>Total Reviews</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="rating">4.2</div>
                        <div>Average Rating</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="sentiment">78%</div>
                        <div>Positive Sentiment</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="sources">4</div>
                        <div>Review Sources</div>
                    </div>
                </div>
                
                <h3>📊 Recent Reviews</h3>
                <div id="reviewsList"></div>
                
                <h3>🎯 AI-Suggested Response</h3>
                <div class="review-card">
                    <p id="aiResponse">Click on any review above to generate an AI response!</p>
                </div>
            </div>
        </div>
        
        <div class="cta-section">
            <h2>Ready to deploy your own Review Insights platform?</h2>
            <p>Choose your preferred deployment method - all with one-click setup!</p>
            
            <div class="deploy-buttons">
                <a href="https://railway.app/new/template/review-insights" class="deploy-btn">
                    Deploy on Railway
                </a>
                <a href="https://render.com/deploy?repo=https://github.com/review-insights/platform" class="deploy-btn">
                    Deploy on Render
                </a>
                <a href="https://vercel.com/new/clone?repository-url=https://github.com/review-insights/platform" class="deploy-btn">
                    Deploy on Vercel
                </a>
                <a href="https://get.reviewinsights.ai" class="deploy-btn">
                    Install Locally
                </a>
            </div>
        </div>
    </div>
    
    <script>
        async function discoverBusiness() {
            const input = document.getElementById('businessInput').value;
            if (!input) return;
            
            document.getElementById('loading').style.display = 'block';
            document.getElementById('results').style.display = 'none';
            
            try {
                // Discover business
                const discoverRes = await fetch(`/api/demo/discover?business=${encodeURIComponent(input)}`);
                const discovered = await discoverRes.json();
                
                // Get reviews
                const reviewsRes = await fetch('/api/demo/reviews');
                const { reviews } = await reviewsRes.json();
                
                // Update UI
                document.getElementById('reviewCount').textContent = discovered.business.reviewCount.toLocaleString();
                document.getElementById('rating').textContent = discovered.business.rating;
                document.getElementById('sentiment').textContent = Math.round(discovered.business.sentiment * 100) + '%';
                document.getElementById('sources').textContent = discovered.reviewSources.length;
                
                // Show reviews
                const reviewsList = document.getElementById('reviewsList');
                reviewsList.innerHTML = reviews.map(review => `
                    <div class="review-card" onclick="generateAIResponse(${JSON.stringify(review).replace(/"/g, '&quot;')})">
                        <div class="rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
                        <strong>${review.author}</strong> - ${review.source}
                        <p>${review.content}</p>
                        <small>Click to generate AI response</small>
                    </div>
                `).join('');
                
                document.getElementById('loading').style.display = 'none';
                document.getElementById('results').style.display = 'block';
                
            } catch (error) {
                console.error('Error:', error);
                alert('Error discovering business. Please try again.');
                document.getElementById('loading').style.display = 'none';
            }
        }
        
        async function generateAIResponse(review) {
            try {
                const res = await fetch('/api/demo/ai-response', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ review })
                });
                const { suggestedResponse } = await res.json();
                document.getElementById('aiResponse').textContent = suggestedResponse;
            } catch (error) {
                console.error('Error:', error);
            }
        }
        
        // Auto-trigger demo with Starbucks
        window.onload = () => {
            document.getElementById('businessInput').value = 'Starbucks';
            setTimeout(discoverBusiness, 500);
        };
    </script>
</body>
</html>
EOF

echo -e "${GREEN}Cloud demo files created!${NC}"
echo ""
echo "Deploy options:"
echo ""
echo "1. Deploy to Railway:"
echo "   cd $TEMP_DIR && railway init && railway up"
echo ""
echo "2. Deploy to Render:"
echo "   Push to GitHub and use render.yaml"
echo ""
echo "3. Deploy to Vercel:"
echo "   cd $TEMP_DIR && vercel"
echo ""
echo "4. Deploy to Heroku:"
echo "   cd $TEMP_DIR && heroku create review-insights-demo && git push heroku main"
echo ""
echo "Files created in: $TEMP_DIR"