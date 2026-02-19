# API Guidelines

## 1. API Design Principles

All APIs follow:

- RESTful design
- Versioned endpoints
- JSON request/response
- Consistent error format
- JWT-based authentication
- Role-based authorization
- Input validation

Base URL:

https://api.domain.com/v1/

---

## 2. HTTP Method Usage

GET     → Fetch resource
POST    → Create resource
PUT     → Full update
PATCH   → Partial update
DELETE  → Remove resource

---

## 3. Response Format

Success Response:

{
  "success": true,
  "data": {},
  "message": "Optional message"
}

Error Response:

{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}

---

## 4. Status Codes

200 → Success
201 → Created
400 → Bad Request
401 → Unauthorized
403 → Forbidden
404 → Not Found
409 → Conflict
500 → Server Error

---

## 5. Authentication

Protected routes require:

- Valid access token (JWT)
- Role validation
- Permission validation

Public routes:
- Product listing
- Product details
- Login
- Signup

---

## 6. Versioning

All APIs use:

/v1/

Future breaking changes require:

/v2/
