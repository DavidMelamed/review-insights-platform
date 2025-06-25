# AI Review Analysis SaaS - Quick Start Guide

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- pnpm 8+
- PostgreSQL
- Redis
- DataForSEO API credentials

### Installation

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Start services**
   ```bash
   # Start PostgreSQL and Redis (using Docker)
   docker-compose up -d postgres redis

   # Run database migrations
   pnpm -C packages/api prisma migrate dev
   ```

4. **Start the application**
   ```bash
   # Development mode
   pnpm dev

   # Or start individual services
   pnpm -C packages/api dev
   pnpm -C packages/frontend dev
   ```

## 📝 Usage Examples

### 1. Collect Reviews
```bash
curl -X POST http://localhost:3000/api/reviews/collect \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Acme Corp",
    "location": "San Francisco, CA",
    "sources": ["google", "yelp"],
    "includeCompetitors": true,
    "depth": 100
  }'
```

### 2. Generate Report
```bash
curl -X POST http://localhost:3000/api/reports/generate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "collectionId": "collection_123",
    "brandConfig": {
      "name": "Acme Corp",
      "primaryColor": "#007bff",
      "secondaryColor": "#6c757d"
    }
  }'
```

### 3. Export Reviews as CSV
```bash
curl -X GET http://localhost:3000/api/reviews/collections/collection_123/export \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -o reviews.csv
```

## 🧪 Testing with Claude-Flow

### Run Complete Analysis
```bash
./claude-flow swarm "Analyze reviews for Nike shoes from multiple sources and generate marketing insights" \
  --strategy analysis \
  --mode distributed \
  --parallel
```

### Generate Marketing Copy
```bash
./claude-flow sparc run coder "Generate landing page copy based on positive review insights stored in memory"
```

## 📊 Monitoring

- **Queue Dashboard**: http://localhost:3000/admin/queues
- **API Health**: http://localhost:3000/health
- **Claude-Flow Status**: `./claude-flow status`

## 🔧 Configuration

### DataForSEO Setup
Add to `.env`:
```
DATAFORSEO_LOGIN=your_login
DATAFORSEO_PASSWORD=your_password
```

### Database Configuration
```
DATABASE_URL=postgresql://user:password@localhost:5432/review_analysis
REDIS_URL=redis://localhost:6379
```

### API Keys
```
OPENAI_API_KEY=sk-...
JWT_SECRET=your-secret-key
```

## 🚨 Troubleshooting

### Reviews not collecting?
1. Check DataForSEO credentials
2. Verify queue is running: `./claude-flow status`
3. Check logs: `pnpm -C packages/api logs`

### Report generation failing?
1. Ensure enough reviews collected
2. Check NLP engine status
3. Verify memory availability

### Performance issues?
1. Scale workers: `WORKER_CONCURRENCY=5 pnpm -C packages/api start:workers`
2. Add Redis replicas
3. Enable caching in `.env`

## 📚 Next Steps

1. **Customize Analysis**
   - Edit sentiment patterns in `packages/nlp-engine/src/sentiment-analyzer.ts`
   - Add industry-specific keywords
   - Tune complaint detection

2. **Extend Data Sources**
   - Add new scrapers in `packages/scraper/src/scrapers/`
   - Integrate additional APIs
   - Support international sources

3. **Enhance Reports**
   - Create custom visualizations
   - Add industry benchmarks
   - Implement white-labeling

## 🆘 Support

- Documentation: `/docs`
- API Reference: `http://localhost:3000/api-docs`
- Claude-Flow Help: `./claude-flow help`