#!/bin/bash

# Review Insights Deployment Script
# This script handles deployment to various environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Default values
ENVIRONMENT="production"
SKIP_BUILD=false
SKIP_MIGRATE=false

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --env ENVIRONMENT    Deploy to specific environment (production|staging|development)"
    echo "  -s, --skip-build         Skip Docker build step"
    echo "  -m, --skip-migrate       Skip database migrations"
    echo "  -h, --help               Display this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -e production         Deploy to production"
    echo "  $0 -e staging -s         Deploy to staging without building"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -s|--skip-build)
            SKIP_BUILD=true
            shift
            ;;
        -m|--skip-migrate)
            SKIP_MIGRATE=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            exit 1
            ;;
    esac
done

echo -e "${GREEN}Review Insights Deployment Script${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(production|staging|development)$ ]]; then
    echo -e "${RED}Error: Invalid environment '$ENVIRONMENT'${NC}"
    echo "Valid environments: production, staging, development"
    exit 1
fi

echo -e "${YELLOW}Deploying to: ${ENVIRONMENT}${NC}"

# Check for required files
if [ ! -f ".env.$ENVIRONMENT" ]; then
    echo -e "${RED}Error: .env.$ENVIRONMENT file not found${NC}"
    echo "Please create the environment file before deploying"
    exit 1
fi

# Load environment variables
export $(cat .env.$ENVIRONMENT | grep -v '^#' | xargs)

# Ensure required environment variables are set
required_vars=(
    "DATABASE_URL"
    "REDIS_URL"
    "JWT_SECRET"
    "OPENAI_API_KEY"
    "DATAFORSEO_API_KEY"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}Error: Required environment variable $var is not set${NC}"
        exit 1
    fi
done

# Build Docker images if not skipping
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${YELLOW}Building Docker images...${NC}"
    docker-compose -f docker-compose.yml -f docker-compose.$ENVIRONMENT.yml build
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Docker build failed${NC}"
        exit 1
    fi
fi

# Run database migrations if not skipping
if [ "$SKIP_MIGRATE" = false ]; then
    echo -e "${YELLOW}Running database migrations...${NC}"
    docker-compose -f docker-compose.yml -f docker-compose.$ENVIRONMENT.yml run --rm api pnpm prisma migrate deploy
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Database migrations failed${NC}"
        exit 1
    fi
fi

# Stop existing containers
echo -e "${YELLOW}Stopping existing containers...${NC}"
docker-compose -f docker-compose.yml -f docker-compose.$ENVIRONMENT.yml down

# Start new containers
echo -e "${YELLOW}Starting new containers...${NC}"
docker-compose -f docker-compose.yml -f docker-compose.$ENVIRONMENT.yml up -d

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to start containers${NC}"
    exit 1
fi

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
sleep 10

# Check service health
services=(postgres redis api frontend worker)
all_healthy=true

for service in "${services[@]}"; do
    if docker-compose -f docker-compose.yml -f docker-compose.$ENVIRONMENT.yml ps | grep -q "${service}.*Up.*healthy"; then
        echo -e "${GREEN}✓ $service is healthy${NC}"
    else
        echo -e "${RED}✗ $service is not healthy${NC}"
        all_healthy=false
    fi
done

if [ "$all_healthy" = false ]; then
    echo -e "${RED}Error: Some services are not healthy${NC}"
    echo "Check logs with: docker-compose logs"
    exit 1
fi

# Run post-deployment tasks
echo -e "${YELLOW}Running post-deployment tasks...${NC}"

# Clear Redis cache
docker-compose -f docker-compose.yml -f docker-compose.$ENVIRONMENT.yml exec -T redis redis-cli FLUSHDB

# Warm up the application
curl -s -o /dev/null -w "%{http_code}" http://localhost/health || true

echo ""
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo ""
echo "Services running at:"
echo "  - Frontend: http://localhost"
echo "  - API: http://localhost/api"
echo "  - Database: localhost:5432"
echo "  - Redis: localhost:6379"
echo ""
echo "View logs: docker-compose logs -f"
echo "Stop services: docker-compose down"