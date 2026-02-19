# Auth API

Base: /v1/auth

---

## 1. Register

POST /v1/auth/register

Body:
{
"email": "user@example.com",
"password": "password123"
}

Response:
201 Created

---

## 2. Login

POST /v1/auth/login

Body:
{
"email": "user@example.com",
"password": "password123"
}

Response:

- Sets access_token cookie
- Sets refresh_token cookie

---

## 3. Refresh Token

POST /v1/auth/refresh

Uses:

- refresh_token cookie

Response:

- Rotates refresh token
- Returns new access token

---

## 4. Logout

POST /v1/auth/logout

Action:

- Invalidates refresh token
- Clears cookies

---

## 5. Get Current User

GET /v1/auth/me

Requires:

- Valid access token

Response:
{
"id": "uuid",
"email": "user@example.com",
"role": "user"
}
