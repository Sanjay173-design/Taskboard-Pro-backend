# TaskBoard Pro — Serverless Backend

Production-ready Serverless backend for TaskBoard Pro built using **AWS Lambda, API Gateway, DynamoDB, Cognito, S3, and Redis (ElastiCache Serverless)**.

---

## Architecture Overview

React Frontend (Vercel)
↓
API Gateway (HTTP API)
↓
AWS Lambda (Node.js 20)
↓
DynamoDB + S3 + Redis
↓
Cognito JWT Authentication


---

## Security

- AWS Cognito JWT Authorizer
- IAM Least Privilege Roles
- Redis TLS enabled
- OWASP baseline protections
- Input validation
- Cache isolation per user

---

## Features

### Authentication
- Cognito User Pool JWT validation
- Secure per-user data isolation

---

### Workspaces
- Create workspace
- List user workspaces
- Redis caching (read optimization)

---

### Projects
- Create project
- List projects per workspace
- Redis cache + invalidation on create

---

### Tasks
- Create task
- List tasks per project
- Update task status
- Update task title / metadata
- Redis cache + invalidation on updates

---

### Comments
- Add comment
- List task comments

---

### Attachments (S3)
- Presigned upload URL
- Presigned download URL
- Delete attachment
- Metadata stored in DynamoDB

---

### Activity Tracking
- Task status changes
- Attachment events
- Comment activity

---

## Tech Stack

| Layer | Tech |
|---|---|
Runtime | Node.js 20 |
Framework | Serverless Framework v4 |
Compute | AWS Lambda |
API | API Gateway HTTP API |
Database | DynamoDB |
Cache | ElastiCache Serverless (Redis TLS) |
Auth | AWS Cognito |
Storage | AWS S3 |
SDK | AWS SDK v3 |

---

### Database Tables
## Workspaces
- workspaceId (PK)
- ownerId
- name
- createdAt

## Projects
- projectId (PK)
- workspaceId
- ownerId
- name
- createdAt
  
## Tasks
- taskId (PK)
- projectId
- ownerId
- title
- status
- priority
- dueDate
- createdAt
- updatedAt
  
## TaskAttachments
attachmentId (PK)
taskId
ownerId
fileName
key
createdAt

## TaskActivity
- activityId (PK)
- taskId
- type
- message
- ownerId
- createdAt

## Redis Cache Strategy
- Endpoint	      Cache
- List Workspaces	Cached
- List Projects	  Cached
- List Tasks      Cached

## Cache Invalidation
- Create Workspace → invalidate workspace cache
- Create Project → invalidate project cache
- Create Task → invalidate task cache
- Update Task → invalidate task cache

 ## Production Engineering Decisions
- VPC attached Lambda
- No NAT → Using VPC Endpoints
- Redis TLS enabled
- Lazy Redis connect (prevents cold start lock)
- Optimistic UI sync supported
- Cache fallback to DB

## Performance Optimizations
- Redis read-through caching
- Cache TTL = 60s
- DynamoDB filtered scan per user
- Lambda connection reuse
- callbackWaitsForEmptyEventLoop disabled

## Future Improvements
- WebSocket realtime updates
- DynamoDB GSIs for query optimization
- Background job queue
- File virus scanning pipeline
- Rate limiting middleware

👨‍💻 Author

HN Sanjay
