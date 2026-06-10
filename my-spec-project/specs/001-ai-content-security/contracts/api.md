# API Contract: AI Content Security Management Module

**Date**: 2026-06-10
**Feature**: AI Content Security Management Module
**Base Path**: `/api/security`

---

## Management Endpoints

### Sensitive Word Groups

#### List Groups
```
GET /api/security/groups
```
**Query Parameters**:
- `page` (int, optional): Page number, default 1
- `page_size` (int, optional): Items per page, default 20
- `status` (int, optional): Filter by status (0=disabled, 1=enabled)
- `parent_id` (int, optional): Filter by parent group ID

**Response 200**:
```json
{
  "success": true,
  "message": "",
  "data": {
    "items": [
      {
        "id": 1,
        "name": "个人隐私信息",
        "description": "保护个人隐私数据",
        "status": 1,
        "parent_id": 0,
        "depth": 0,
        "path": "/1",
        "sort_order": 1,
        "created_at": 1718000000,
        "updated_at": 1718000000
      }
    ],
    "total": 5,
    "page": 1,
    "page_size": 20
  }
}
```

#### Create Group
```
POST /api/security/groups
```
**Request Body**:
```json
{
  "name": "企业机密",
  "description": "保护企业核心机密",
  "parent_id": 0,
  "sort_order": 2
}
```

**Response 200**:
```json
{
  "success": true,
  "message": "Group created",
  "data": {
    "id": 3,
    "name": "企业机密",
    "status": 1,
    "depth": 0,
    "path": "/3",
    "created_at": 1718000000,
    "updated_at": 1718000000
  }
}
```

#### Update Group
```
PUT /api/security/groups/:id
```
**Request Body**: Same as Create (fields are optional for partial update)

**Response 200**: Updated group object

#### Delete Group
```
DELETE /api/security/groups/:id
```
**Response 200**:
```json
{
  "success": true,
  "message": "Group deleted"
}
```

#### Copy Group
```
POST /api/security/groups/:id/copy
```
**Response 200**:
```json
{
  "success": true,
  "message": "Group copied",
  "data": {
    "id": 6,
    "name": "企业机密_copy",
    "parent_id": 0,
    "created_at": 1718000000
  }
}
```

---

### Detection Rules

#### List Rules
```
GET /api/security/rules
```
**Query Parameters**:
- `page`, `page_size`
- `group_id` (int, optional): Filter by group
- `type` (int, optional): Filter by rule type
- `status` (int, optional)

**Response 200**: Paginated list of rules

#### Create Rule
```
POST /api/security/rules
```
**Request Body**:
```json
{
  "group_id": 2,
  "name": "手机号检测",
  "type": 2,
  "content": "1[3-9]\\d{9}",
  "action": 3,
  "priority": 100,
  "risk_score": 50,
  "extra_config": "{\"mask_strategy\":\"mid\",\"preserve_start\":3,\"preserve_end\":4}"
}
```

**Response 200**: Created rule object

#### Update Rule
```
PUT /api/security/rules/:id
```

#### Delete Rule
```
DELETE /api/security/rules/:id
```

---

### User Policies

#### List Policies
```
GET /api/security/policies
```
**Query Parameters**:
- `page`, `page_size`
- `user_id` (int, optional)
- `status` (int, optional)

**Response 200**: Paginated list of policies with bound group details

#### Create Policy
```
POST /api/security/policies
```
**Request Body**:
```json
{
  "user_id": 42,
  "group_id": 2,
  "scope": 3,
  "default_action": 4,
  "custom_response": "您的请求包含敏感信息，已被拦截。",
  "whitelist_ips": "[\"192.168.1.0/24\"]"
}
```

**Response 200**: Created policy object

#### Update Policy
```
PUT /api/security/policies/:id
```

#### Delete Policy
```
DELETE /api/security/policies/:id
```

---

### Audit Logs

#### Query Logs
```
GET /api/security/logs
```
**Query Parameters**:
- `page`, `page_size`
- `user_id` (int, optional)
- `model_name` (string, optional)
- `start_time` (int64, optional): Unix timestamp
- `end_time` (int64, optional): Unix timestamp
- `group_id` (int, optional)
- `action` (int, optional)
- `risk_level` (int, optional)

**Response 200**: Paginated list of hit logs

#### Export Logs
```
GET /api/security/logs/export
```
**Query Parameters**: Same as Query Logs

**Response 200**: CSV or Excel file download

---

### Dashboard

#### Get Statistics
```
GET /api/security/dashboard
```
**Query Parameters**:
- `start_time` (int64, optional)
- `end_time` (int64, optional)

**Response 200**:
```json
{
  "success": true,
  "message": "",
  "data": {
    "summary": {
      "total_detections": 1523,
      "total_interceptions": 87,
      "total_alerts": 203,
      "today_detections": 45
    },
    "top_categories": [
      {"category": "个人隐私信息", "count": 523},
      {"category": "企业机密", "count": 301}
    ],
    "top_users": [
      {"user_id": 42, "username": "zhangsan", "count": 89}
    ],
    "top_models": [
      {"model_name": "gpt-4o", "count": 678}
    ],
    "risk_distribution": {
      "low": 1200,
      "medium": 250,
      "high": 60,
      "critical": 13
    }
  }
}
```

---

## Core Detection Endpoints

### Check Request Content
```
POST /api/security/check/request
```
**Request Body**:
```json
{
  "user_id": 42,
  "content": "请联系我，手机号是13800138000",
  "model_name": "gpt-4o"
}
```

**Response 200**:
```json
{
  "success": true,
  "message": "",
  "data": {
    "detected": true,
    "action": 3,
    "action_name": "mask",
    "risk_score": 50,
    "risk_level": 2,
    "processed_content": "请联系我，手机号是138****8000",
    "matches": [
      {
        "rule_id": 1,
        "group_id": 2,
        "type": 2,
        "matched_text": "13800138000",
        "position": [12, 23]
      }
    ]
  }
}
```

### Check Response Content
```
POST /api/security/check/response
```
**Request Body**:
```json
{
  "user_id": 42,
  "content": "客户的银行卡号是6222028888888888",
  "model_name": "gpt-4o"
}
```

**Response 200**: Same format as Check Request

---

## Error Responses

All endpoints return the following error format on failure:

```json
{
  "success": false,
  "message": "Error description",
  "data": null
}
```

**Common HTTP Status Codes**:
- `400` Bad Request: Invalid parameters or malformed request body
- `401` Unauthorized: Missing or invalid authentication
- `403` Forbidden: Insufficient permissions
- `404` Not Found: Resource does not exist
- `409` Conflict: Duplicate unique fields or conflicting state
- `422` Unprocessable Entity: Validation errors
- `500` Internal Server Error: Unexpected server error
