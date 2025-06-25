# Data Management Strategy

## Database per Service Pattern

### Service Database Mapping

#### 1. Authentication Service
**Database**: PostgreSQL
**Schema**:
```sql
-- Users table
users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Sessions table
sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  token_hash VARCHAR(255) UNIQUE,
  expires_at TIMESTAMP,
  created_at TIMESTAMP
)

-- Roles and permissions
roles (
  id UUID PRIMARY KEY,
  name VARCHAR(100),
  permissions JSONB
)

user_roles (
  user_id UUID REFERENCES users(id),
  role_id UUID REFERENCES roles(id),
  tenant_id UUID
)
```

#### 2. Tenant Management Service
**Database**: PostgreSQL
**Schema**:
```sql
-- Organizations/Tenants
tenants (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  slug VARCHAR(100) UNIQUE,
  settings JSONB,
  subscription_tier VARCHAR(50),
  created_at TIMESTAMP
)

-- Tenant memberships
tenant_memberships (
  tenant_id UUID,
  user_id UUID,
  role VARCHAR(50),
  joined_at TIMESTAMP,
  PRIMARY KEY (tenant_id, user_id)
)

-- Feature flags
feature_flags (
  tenant_id UUID,
  feature_name VARCHAR(100),
  enabled BOOLEAN,
  config JSONB
)
```

#### 3. Data Collection Service
**Database**: MongoDB
**Collections**:
```javascript
// Data sources configuration
data_sources: {
  _id: ObjectId,
  tenant_id: UUID,
  name: String,
  type: String, // 'dataforseo', 'scraper'
  config: {
    platform: String,
    credentials: Object, // encrypted
    parameters: Object
  },
  schedule: {
    frequency: String,
    next_run: Date
  },
  status: String,
  created_at: Date
}

// Raw reviews storage
raw_reviews: {
  _id: ObjectId,
  source_id: ObjectId,
  tenant_id: UUID,
  platform: String,
  external_id: String, // platform's review ID
  author: {
    name: String,
    id: String
  },
  content: String,
  rating: Number,
  date: Date,
  metadata: Object, // platform-specific data
  collected_at: Date
}

// Collection jobs
collection_jobs: {
  _id: ObjectId,
  source_id: ObjectId,
  tenant_id: UUID,
  status: String,
  started_at: Date,
  completed_at: Date,
  stats: {
    reviews_collected: Number,
    errors: Number
  },
  error_log: Array
}
```

#### 4. NLP Processing Service
**Database**: PostgreSQL
**Schema**:
```sql
-- Processed reviews
processed_reviews (
  id UUID PRIMARY KEY,
  raw_review_id VARCHAR(24), -- MongoDB ObjectId
  tenant_id UUID,
  sentiment_score DECIMAL(3,2),
  sentiment_label VARCHAR(20),
  language VARCHAR(10),
  processed_at TIMESTAMP,
  processing_version VARCHAR(20)
)

-- Extracted entities
review_entities (
  id UUID PRIMARY KEY,
  review_id UUID REFERENCES processed_reviews(id),
  entity_text VARCHAR(255),
  entity_type VARCHAR(50),
  salience DECIMAL(3,2),
  sentiment DECIMAL(3,2)
)

-- Keywords
review_keywords (
  review_id UUID REFERENCES processed_reviews(id),
  keyword VARCHAR(100),
  relevance DECIMAL(3,2),
  PRIMARY KEY (review_id, keyword)
)

-- Topics (clustered)
topics (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  name VARCHAR(100),
  keywords TEXT[],
  created_at TIMESTAMP
)

review_topics (
  review_id UUID,
  topic_id UUID,
  confidence DECIMAL(3,2),
  PRIMARY KEY (review_id, topic_id)
)
```

#### 5. Analytics Service
**Database**: ClickHouse (Time-series optimized)
**Tables**:
```sql
-- Time-series metrics
review_metrics (
  tenant_id UUID,
  timestamp DateTime,
  source_id String,
  sentiment_positive UInt32,
  sentiment_neutral UInt32,
  sentiment_negative UInt32,
  total_reviews UInt32,
  avg_rating Float32
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (tenant_id, timestamp)

-- Aggregated daily stats
daily_stats (
  tenant_id UUID,
  date Date,
  metrics Nested(
    name String,
    value Float64
  )
) ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date)

-- Topic trends
topic_trends (
  tenant_id UUID,
  date Date,
  topic_id UUID,
  topic_name String,
  mention_count UInt32,
  sentiment_avg Float32
) ENGINE = MergeTree()
ORDER BY (tenant_id, date, topic_id)
```

#### 6. Report Service
**Database**: PostgreSQL + S3
**Schema**:
```sql
-- Report definitions
reports (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  name VARCHAR(255),
  template_id UUID,
  parameters JSONB,
  format VARCHAR(20),
  status VARCHAR(50),
  file_path VARCHAR(500),
  file_size BIGINT,
  created_by UUID,
  created_at TIMESTAMP,
  completed_at TIMESTAMP
)

-- Report templates
report_templates (
  id UUID PRIMARY KEY,
  name VARCHAR(100),
  description TEXT,
  sections JSONB,
  default_parameters JSONB,
  created_at TIMESTAMP
)

-- Report schedules
report_schedules (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  template_id UUID,
  parameters JSONB,
  cron_expression VARCHAR(100),
  next_run TIMESTAMP,
  active BOOLEAN
)
```

## Data Consistency Strategies

### 1. Eventual Consistency
- Used for analytics data and processed reviews
- Event-driven updates via Kafka
- Acceptable delay: 5-30 seconds

### 2. Strong Consistency
- Used for authentication and billing
- Synchronous updates with transactions
- ACID compliance required

### 3. Saga Pattern for Distributed Transactions
```yaml
Example: New Review Processing Saga
1. CollectReviewStep: Fetch from external source
2. StoreRawReviewStep: Save to MongoDB
3. ProcessNLPStep: Analyze sentiment/entities
4. UpdateAnalyticsStep: Update metrics
5. NotifyStep: Send notifications

Compensation on failure:
- Rollback analytics updates
- Mark review for retry
- Log failure for investigation
```

## Data Synchronization

### 1. Change Data Capture (CDC)
- Use Debezium for PostgreSQL → Kafka
- MongoDB Change Streams → Kafka
- Enable real-time data synchronization

### 2. Event Sourcing
```json
{
  "aggregate_id": "review_123",
  "events": [
    {"type": "ReviewCollected", "timestamp": "2024-01-15T10:00:00Z"},
    {"type": "ReviewProcessed", "timestamp": "2024-01-15T10:00:05Z"},
    {"type": "SentimentAnalyzed", "score": 0.85}
  ]
}
```

### 3. CQRS Implementation
- Write Model: Optimized for transactions
- Read Model: Optimized for queries
- Materialized views for complex queries

## Caching Strategy

### 1. Redis Caching Layers
```yaml
L1 Cache - Application Level:
  - User sessions (TTL: 1 hour)
  - API tokens (TTL: 15 minutes)
  - Feature flags (TTL: 5 minutes)

L2 Cache - Service Level:
  - Processed review results (TTL: 1 day)
  - Analytics aggregations (TTL: 1 hour)
  - Report metadata (TTL: 30 minutes)

L3 Cache - CDN Level:
  - Static reports (TTL: 7 days)
  - Public API responses (TTL: 5 minutes)
```

### 2. Cache Invalidation
- Tag-based invalidation
- Event-driven cache purging
- TTL-based expiration

## Data Partitioning

### 1. Horizontal Partitioning (Sharding)
```yaml
Reviews Collection:
  Shard Key: tenant_id + year_month
  Strategy: Hash-based distribution
  Shard Count: 10 initial, auto-scale

Analytics Data:
  Partition Key: tenant_id + date
  Strategy: Range partitioning by date
  Retention: 2 years active, archive older
```

### 2. Vertical Partitioning
- Separate hot and cold data
- Archive old reviews to cheaper storage
- Keep recent data in fast storage

## Backup and Recovery

### 1. Backup Strategy
```yaml
PostgreSQL:
  - Full backup: Daily at 2 AM
  - Incremental: Every 4 hours
  - Point-in-time recovery: Enabled
  - Retention: 30 days

MongoDB:
  - Replica set: 3 nodes
  - Snapshot: Daily
  - Oplog backup: Continuous
  - Retention: 14 days

ClickHouse:
  - Replicated tables
  - Daily backup to S3
  - Retention: 90 days
```

### 2. Disaster Recovery
- RPO (Recovery Point Objective): 1 hour
- RTO (Recovery Time Objective): 4 hours
- Multi-region replication
- Automated failover procedures

## Data Security

### 1. Encryption
- At rest: AES-256 encryption
- In transit: TLS 1.3
- Key management: AWS KMS/HashiCorp Vault

### 2. Data Isolation
- Row-level security for multi-tenancy
- Separate encryption keys per tenant
- Database connection pooling per tenant

### 3. Compliance
- GDPR: Right to deletion implemented
- Data retention policies enforced
- Audit logs for all data access
- PII data masking in logs

## Performance Optimization

### 1. Indexing Strategy
```sql
-- Frequently queried columns
CREATE INDEX idx_reviews_tenant_date ON processed_reviews(tenant_id, processed_at);
CREATE INDEX idx_entities_type ON review_entities(entity_type, sentiment);
CREATE INDEX idx_metrics_tenant_time ON review_metrics(tenant_id, timestamp);
```

### 2. Query Optimization
- Materialized views for complex aggregations
- Query result caching
- Connection pooling
- Read replicas for analytics

### 3. Data Archival
- Move data older than 1 year to cold storage
- Compressed archives in S3 Glacier
- On-demand restoration process