# Deployment Topology

## 1. Deployment Philosophy

The system follows a hybrid cloud deployment model designed for:

- Cost efficiency
- Production-grade architecture
- Real AWS usage (Free Tier compatible)
- High performance via edge caching
- Secure authentication isolation
- Minimal operational overhead

The architecture separates:

- Public edge layer
- Authentication control plane
- Application services
- Data layer

---

# 2. High-Level Deployment Overview

User Request Flow:

User
↓
Cloudflare (CDN + WAF + DNS)
↓
Routing Based on Subdomain
├── www.domain.com → Vercel (Frontend)
├── api.domain.com → Vercel (Backend Services)
└── auth.domain.com → AWS EC2 (Auth Service)
↓
Supabase (Database)
↓
Managed Redis (Caching / Rate Limit)
