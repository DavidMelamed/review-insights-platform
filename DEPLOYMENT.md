# Review Insights Deployment Guide

## Table of Contents
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Configuration](#configuration)
- [Monitoring](#monitoring)
- [Backup and Recovery](#backup-and-recovery)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements
- Docker 20.10+ and Docker Compose 2.0+
- Node.js 18+ (for local development)
- PostgreSQL 15+ (if not using Docker)
- Redis 7+ (if not using Docker)
- 4GB RAM minimum (8GB recommended for production)
- 20GB disk space

### Required API Keys
Before deployment, obtain the following API keys:
- OpenAI API Key (GPT-4 access required)
- DataForSEO API Key
- SendGrid API Key (for emails)
- Stripe API Keys (for payments)
- Social Media API Tokens (optional)

## Environment Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/review-analysis-saas.git
   cd review-analysis-saas
   ```

2. **Create environment files**
   ```bash
   cp .env.example .env.development
   cp .env.example .env.staging
   cp .env.example .env.production
   ```

3. **Configure environment variables**
   Edit each `.env.*` file with your specific configuration

## Local Development

### Quick Start
```bash
# Install dependencies
pnpm install

# Start development environment
docker-compose -f docker-compose.yml up -d postgres redis
pnpm dev
```

### Running with Docker
```bash
# Build and start all services
docker-compose up --build

# Access the application
# Frontend: http://localhost:3000
# API: http://localhost:3001
```

## Production Deployment

### 1. Server Setup

#### AWS EC2 / DigitalOcean Droplet
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
```

### 2. SSL Certificates

#### Using Let's Encrypt
```bash
# Install Certbot
sudo apt install certbot

# Generate certificates
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./ssl/key.pem
```

### 3. Deploy Application

```bash
# Clone repository on server
git clone https://github.com/your-org/review-analysis-saas.git
cd review-analysis-saas

# Copy production environment file
scp .env.production user@server:/path/to/review-analysis-saas/

# Deploy using the deployment script
./deploy.sh -e production

# Or manually with docker-compose
docker-compose -f docker-compose.yml -f docker-compose.production.yml up -d
```

### 4. Database Migrations

```bash
# Run migrations
docker-compose exec api pnpm prisma migrate deploy

# Seed initial data (optional)
docker-compose exec api pnpm prisma db seed
```

## Configuration

### Environment Variables

#### Critical Settings
```env
# Database
DATABASE_URL=postgresql://user:password@postgres:5432/reviewinsights

# Security
JWT_SECRET=generate-strong-secret-key
ENCRYPTION_KEY=32-character-encryption-key

# API Keys
OPENAI_API_KEY=your-openai-key
DATAFORSEO_API_KEY=your-dataforseo-key
```

#### Feature Flags
```env
ENABLE_AI_RESPONSES=true
ENABLE_PREDICTIVE_ANALYTICS=true
ENABLE_WHITE_LABEL=true
ENABLE_ZERO_CONFIG=true
```

### Scaling Configuration

#### Horizontal Scaling
Edit `docker-compose.production.yml`:
```yaml
services:
  api:
    deploy:
      replicas: 4  # Increase API instances

  worker:
    deploy:
      replicas: 3  # Increase worker instances
```

#### Resource Limits
```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

## Monitoring

### Prometheus & Grafana

1. **Access Grafana**
   - URL: http://your-server:3000
   - Default login: admin / [GRAFANA_ADMIN_PASSWORD]

2. **Import Dashboards**
   - Go to Dashboards → Import
   - Upload JSON files from `monitoring/grafana/dashboards/`

3. **Configure Alerts**
   ```yaml
   # monitoring/alerts.yml
   groups:
     - name: app_alerts
       rules:
         - alert: HighErrorRate
           expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
           for: 5m
   ```

### Application Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api
docker-compose logs -f worker

# Export logs
docker-compose logs > logs_$(date +%Y%m%d).txt
```

### Health Checks

```bash
# Check service health
curl http://localhost/health

# Check individual services
docker-compose ps

# Monitor resource usage
docker stats
```

## Backup and Recovery

### Automated Backups

1. **Database Backups**
   ```bash
   # Create backup script
   cat > backup.sh << 'EOF'
   #!/bin/bash
   DATE=$(date +%Y%m%d_%H%M%S)
   docker-compose exec -T postgres pg_dump -U reviewinsights reviewinsights > backups/db_$DATE.sql
   # Upload to S3
   aws s3 cp backups/db_$DATE.sql s3://your-backup-bucket/
   EOF
   
   chmod +x backup.sh
   
   # Add to crontab
   0 2 * * * /path/to/backup.sh
   ```

2. **File Storage Backups**
   ```bash
   # Sync uploads to S3
   aws s3 sync ./uploads s3://your-backup-bucket/uploads/
   ```

### Recovery Procedures

1. **Database Recovery**
   ```bash
   # Stop services
   docker-compose stop api worker
   
   # Restore database
   docker-compose exec -T postgres psql -U reviewinsights reviewinsights < backups/db_20240115.sql
   
   # Start services
   docker-compose start api worker
   ```

2. **Full System Recovery**
   ```bash
   # Restore from backup
   ./deploy.sh -e production -s
   
   # Restore database
   docker-compose exec -T postgres psql -U reviewinsights < latest_backup.sql
   
   # Restore files
   aws s3 sync s3://your-backup-bucket/uploads/ ./uploads/
   ```

## Troubleshooting

### Common Issues

1. **Container won't start**
   ```bash
   # Check logs
   docker-compose logs [service-name]
   
   # Check disk space
   df -h
   
   # Clean up Docker
   docker system prune -a
   ```

2. **Database connection errors**
   ```bash
   # Check database is running
   docker-compose ps postgres
   
   # Test connection
   docker-compose exec postgres psql -U reviewinsights -d reviewinsights
   ```

3. **Memory issues**
   ```bash
   # Check memory usage
   free -h
   docker stats
   
   # Adjust Docker memory limits
   # Edit docker-compose.production.yml
   ```

4. **SSL certificate errors**
   ```bash
   # Verify certificates
   openssl x509 -in ssl/cert.pem -text -noout
   
   # Check nginx config
   docker-compose exec nginx nginx -t
   ```

### Performance Optimization

1. **Database Optimization**
   ```sql
   -- Add indexes
   CREATE INDEX idx_reviews_business_date ON reviews(business_id, created_at);
   CREATE INDEX idx_reviews_sentiment ON reviews(sentiment_score);
   
   -- Vacuum and analyze
   VACUUM ANALYZE;
   ```

2. **Redis Optimization**
   ```bash
   # Configure Redis memory policy
   docker-compose exec redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
   ```

3. **Application Optimization**
   - Enable CDN for static assets
   - Configure nginx caching
   - Use Redis for session storage
   - Enable gzip compression

### Maintenance Mode

```bash
# Enable maintenance mode
docker-compose exec nginx sh -c 'echo "maintenance" > /usr/share/nginx/html/maintenance'

# Disable maintenance mode
docker-compose exec nginx rm /usr/share/nginx/html/maintenance
```

## Security Checklist

- [ ] Change all default passwords
- [ ] Configure firewall rules
- [ ] Enable SSL/TLS
- [ ] Set up fail2ban
- [ ] Configure backup encryption
- [ ] Enable audit logging
- [ ] Set up monitoring alerts
- [ ] Configure rate limiting
- [ ] Enable CORS properly
- [ ] Set secure headers

## Support

For issues and questions:
- GitHub Issues: https://github.com/your-org/review-analysis-saas/issues
- Documentation: https://docs.reviewinsights.ai
- Email: support@reviewinsights.ai