# API Contracts and Communication Patterns

## API Design Principles
- RESTful design with consistent naming
- Versioning through URL path (/api/v1/)
- Standard HTTP status codes
- Consistent error response format
- Pagination for list endpoints
- HATEOAS where applicable

## Standard Response Formats

### Success Response
```json
{
  "success": true,
  "data": {
    // Response payload
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "req_123456"
  }
}
```

## Service API Contracts

### 1. Authentication Service APIs

#### POST /api/v1/auth/register
```json
Request:
{
  "email": "user@example.com",
  "password": "securePassword123",
  "organization_name": "Acme Corp"
}

Response:
{
  "user_id": "usr_123456",
  "organization_id": "org_789012",
  "email": "user@example.com",
  "access_token": "jwt_token_here",
  "refresh_token": "refresh_token_here"
}
```

#### POST /api/v1/auth/login
```json
Request:
{
  "email": "user@example.com",
  "password": "securePassword123"
}

Response:
{
  "access_token": "jwt_token_here",
  "refresh_token": "refresh_token_here",
  "expires_in": 3600
}
```

### 2. Data Collection Service APIs

#### POST /api/v1/data-sources
```json
Request:
{
  "name": "Google Reviews - Product X",
  "type": "dataforseo",
  "config": {
    "platform": "google",
    "location": "United States",
    "language": "en",
    "business_id": "ChIJN1t_tDeuEmsRUsoyG83frY4"
  },
  "schedule": {
    "frequency": "daily",
    "time": "02:00"
  }
}

Response:
{
  "source_id": "src_123456",
  "name": "Google Reviews - Product X",
  "status": "active",
  "next_run": "2024-01-16T02:00:00Z"
}
```

#### GET /api/v1/collection-jobs?source_id=src_123456&status=completed
```json
Response:
{
  "jobs": [
    {
      "job_id": "job_789012",
      "source_id": "src_123456",
      "status": "completed",
      "reviews_collected": 156,
      "started_at": "2024-01-15T02:00:00Z",
      "completed_at": "2024-01-15T02:05:30Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 45
  }
}
```

### 3. NLP Processing Service APIs

#### POST /api/v1/nlp/analyze
```json
Request:
{
  "text": "This product is amazing! Best purchase ever.",
  "analyses": ["sentiment", "entities", "keywords"]
}

Response:
{
  "sentiment": {
    "score": 0.95,
    "label": "positive"
  },
  "entities": [
    {
      "text": "product",
      "type": "PRODUCT",
      "salience": 0.8
    }
  ],
  "keywords": ["amazing", "best purchase"]
}
```

#### POST /api/v1/nlp/batch-process
```json
Request:
{
  "job_type": "full_analysis",
  "source_id": "src_123456",
  "filters": {
    "date_from": "2024-01-01",
    "date_to": "2024-01-15"
  }
}

Response:
{
  "batch_id": "batch_345678",
  "status": "queued",
  "estimated_completion": "2024-01-15T11:00:00Z"
}
```

### 4. Analytics Service APIs

#### GET /api/v1/analytics/overview?tenant_id=org_789012&period=30d
```json
Response:
{
  "metrics": {
    "total_reviews": 5432,
    "average_sentiment": 0.72,
    "sentiment_distribution": {
      "positive": 3200,
      "neutral": 1500,
      "negative": 732
    },
    "trending_topics": [
      {"topic": "customer service", "count": 892},
      {"topic": "product quality", "count": 654}
    ]
  },
  "period": {
    "start": "2023-12-16",
    "end": "2024-01-15"
  }
}
```

### 5. Report Service APIs

#### POST /api/v1/reports/generate
```json
Request:
{
  "name": "Monthly Review Analysis",
  "template_id": "tmpl_monthly",
  "parameters": {
    "date_range": {
      "start": "2024-01-01",
      "end": "2024-01-31"
    },
    "sources": ["src_123456", "src_789012"],
    "include_sections": ["summary", "sentiment", "topics", "recommendations"]
  },
  "format": "pdf"
}

Response:
{
  "report_id": "rpt_567890",
  "status": "generating",
  "estimated_completion": "2024-01-15T10:45:00Z"
}
```

## Event Schemas (Kafka)

### ReviewsCollected Event
```json
{
  "event_type": "reviews.collected",
  "event_id": "evt_123456",
  "timestamp": "2024-01-15T10:30:00Z",
  "tenant_id": "org_789012",
  "payload": {
    "source_id": "src_123456",
    "job_id": "job_789012",
    "review_count": 156,
    "date_range": {
      "start": "2024-01-01",
      "end": "2024-01-15"
    }
  }
}
```

### AnalysisCompleted Event
```json
{
  "event_type": "analysis.completed",
  "event_id": "evt_234567",
  "timestamp": "2024-01-15T10:35:00Z",
  "tenant_id": "org_789012",
  "payload": {
    "batch_id": "batch_345678",
    "reviews_processed": 156,
    "processing_time_ms": 4523
  }
}
```

### ReportGenerated Event
```json
{
  "event_type": "report.generated",
  "event_id": "evt_345678",
  "timestamp": "2024-01-15T10:45:00Z",
  "tenant_id": "org_789012",
  "payload": {
    "report_id": "rpt_567890",
    "format": "pdf",
    "size_bytes": 2451234,
    "storage_path": "reports/org_789012/2024/01/rpt_567890.pdf"
  }
}
```

## GraphQL Schema (Frontend API)

```graphql
type Query {
  # User queries
  me: User
  organization: Organization
  
  # Review queries
  reviews(filter: ReviewFilter, pagination: PaginationInput): ReviewConnection
  review(id: ID!): Review
  
  # Analytics queries
  analytics(period: AnalyticsPeriod!): AnalyticsData
  sentimentTrend(period: String!, granularity: Granularity!): [SentimentPoint]
  
  # Report queries
  reports(status: ReportStatus, pagination: PaginationInput): ReportConnection
  report(id: ID!): Report
}

type Mutation {
  # Authentication
  login(email: String!, password: String!): AuthPayload
  register(input: RegisterInput!): AuthPayload
  
  # Data sources
  createDataSource(input: DataSourceInput!): DataSource
  updateDataSource(id: ID!, input: DataSourceInput!): DataSource
  deleteDataSource(id: ID!): Boolean
  
  # Reports
  generateReport(input: GenerateReportInput!): Report
  scheduleReport(input: ScheduleReportInput!): ReportSchedule
}

type Subscription {
  # Real-time updates
  reviewCollected(sourceId: ID!): Review
  analysisProgress(batchId: ID!): AnalysisProgress
  reportStatus(reportId: ID!): ReportStatus
}
```

## Service-to-Service Communication

### Internal REST APIs
- Use service discovery for endpoint resolution
- mTLS for service-to-service authentication
- Circuit breakers with Hystrix/Resilience4j
- Retry with exponential backoff

### gRPC Contracts
```protobuf
syntax = "proto3";

service NLPService {
  rpc AnalyzeText(AnalyzeRequest) returns (AnalyzeResponse);
  rpc BatchAnalyze(BatchAnalyzeRequest) returns (stream BatchAnalyzeResponse);
}

message AnalyzeRequest {
  string text = 1;
  repeated string analyses = 2;
  string language = 3;
}

message AnalyzeResponse {
  SentimentResult sentiment = 1;
  repeated Entity entities = 2;
  repeated string keywords = 3;
}
```

## API Versioning Strategy

1. **URL Versioning**: Primary versioning method (/api/v1/, /api/v2/)
2. **Header Versioning**: Optional via `X-API-Version` header
3. **Deprecation Policy**:
   - 6-month deprecation notice
   - Sunset headers in responses
   - Migration guides provided
4. **Backward Compatibility**:
   - New fields are optional
   - Removed fields return null with warning
   - Changed fields maintain old behavior in v1