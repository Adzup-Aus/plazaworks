# Quickstart: Integrating with the API

**Feature**: Integrations Center  
**Date**: 2026-03-09

## Overview

This guide helps third-party developers integrate with our API using integration tokens.

## 1. Create an Integration (Admin Required)

An admin must create an integration in the Integrations Center:

1. Navigate to **Integrations Center** (admin only)
2. Click **Create Integration**
3. Enter:
   - **Name**: A descriptive name (e.g., "My CRM Sync")
   - **Description**: Optional details about the integration
   - **Scopes**: Select required permissions (e.g., `jobs:read`, `clients:write`)
   - **Token Expiry**: Optional expiry date (leave blank for no expiry)
4. Click **Generate Token**
5. **Copy the token immediately** - it will only be shown once!

## 2. Authenticate API Requests

Include your API token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
  https://api.example.com/api/jobs
```

## 3. Available Endpoints

### List Jobs (requires `jobs:read` scope)

```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
  https://api.example.com/api/jobs
```

### Create a Job (requires `jobs:write` scope)

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Job",
    "clientId": "uuid-here",
    "description": "Job description"
  }' \
  https://api.example.com/api/jobs
```

### List Available Scopes

```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
  https://api.example.com/api/scopes
```

## 4. Available Scopes

| Scope | Description | Access |
|-------|-------------|--------|
| `jobs:read` | View jobs and job details | GET /api/jobs |
| `jobs:write` | Create and update jobs | POST, PATCH /api/jobs |
| `clients:read` | View client information | GET /api/clients |
| `clients:write` | Manage clients | POST, PATCH /api/clients |
| `quotes:read` | View quotes | GET /api/quotes |
| `quotes:write` | Create and manage quotes | POST, PATCH /api/quotes |
| `invoices:read` | View invoices | GET /api/invoices |
| `invoices:write` | Create and manage invoices | POST, PATCH /api/invoices |
| `schedule:read` | View schedule | GET /api/schedule |
| `schedule:write` | Modify schedule | POST, PATCH /api/schedule |

## 5. API Documentation

Interactive API documentation is available at:

```
https://api.example.com/api/docs
```

You can:
- Browse all available endpoints
- See request/response schemas
- Test endpoints directly with your token
- View required scopes for each endpoint

## 6. Token Rotation

If your token is compromised or you need to rotate it:

1. Go to **Integrations Center**
2. Find your integration
3. Click **Rotate Token**
4. Confirm the rotation
5. **Copy the new token** - the old one stops working immediately!

## 7. Error Handling

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

**Action**: Check your token is correct and not expired. Contact admin to rotate if needed.

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "Insufficient scope"
}
```

**Action**: Your integration lacks the required scope. Contact admin to update scopes.

### 400 Bad Request
```json
{
  "error": "Bad Request",
  "message": "Invalid input",
  "details": {
    "title": "Title is required"
  }
}
```

**Action**: Check your request body matches the expected schema.

## 8. SDK Examples

### JavaScript/TypeScript

```typescript
const API_BASE = 'https://api.example.com/api';
const TOKEN = 'your-api-token';

async function getJobs() {
  const response = await fetch(`${API_BASE}/jobs`, {
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  return response.json();
}
```

### Python

```python
import requests

API_BASE = 'https://api.example.com/api'
TOKEN = 'your-api-token'

headers = {'Authorization': f'Bearer {TOKEN}'}

# Get jobs
response = requests.get(f'{API_BASE}/jobs', headers=headers)
jobs = response.json()

# Create a job
new_job = {
    'title': 'New Job',
    'clientId': 'uuid-here',
    'description': 'Description'
}
response = requests.post(
    f'{API_BASE}/jobs',
    headers=headers,
    json=new_job
)
```

### cURL

```bash
# Set your token
TOKEN="your-api-token"

# List jobs
curl -H "Authorization: Bearer $TOKEN" \
  https://api.example.com/api/jobs

# Create a job
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"New Job","clientId":"uuid"}' \
  https://api.example.com/api/jobs
```

## 9. Best Practices

1. **Store tokens securely**: Use environment variables, never commit to git
2. **Handle token expiry**: Check for 401 errors and notify admin
3. **Request minimal scopes**: Only ask for what you need
4. **Use HTTPS always**: Tokens are sent in headers
5. **Implement retries**: With exponential backoff for 5xx errors
6. **Cache appropriately**: Respect Cache-Control headers

## 10. Getting Help

- **API Documentation**: https://api.example.com/api/docs
- **Support Email**: api-support@example.com
- **Status Page**: https://status.example.com
