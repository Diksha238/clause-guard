# ClauseGuard

AI-powered legal contract analyzer that parses contracts, flags risky clauses, and helps you understand what you're signing — built with a polyglot microservice architecture and deployed end-to-end on AWS and Vercel.

🔗 **Live App:** [clause-guard-ui.vercel.app](https://clause-guard-ui.vercel.app)
🔗 **API Docs:** [clauseguard.duckdns.org/docs](https://clauseguard.duckdns.org/docs)

---

## Features

- 📄 **PDF Upload & Parsing** — extracts contract text using PyMuPDF
- ⚠️ **Risk Scanning** — tags clauses as HIGH / MEDIUM / LOW risk using LLM-based analysis
- 📝 **Contract Summary** — auto-generated plain-English summary of key terms
- 🔍 **Clause Comparison** — compare clauses across multiple documents
- 💬 **Persistent Chat** — ask questions about your contract with full chat history
- 📊 **PDF Risk Report Export** — download a formatted risk report (built with ReportLab)
- 🤖 **Model Picker** — switch between Groq Llama 3.3 70B/8B and Gemini 2.5 Flash-Lite
- 🔐 **Google OAuth2 Login** — secure authentication via Spring Security + JWT
- 🗂️ **ChatGPT-style Sidebar** — manage multiple documents in one workspace

---

## Tech Stack

**Backend (RAG Core)** — FastAPI · LangChain · Groq (Llama 3.3 70B) · Gemini 2.5 Flash-Lite · pgvector · PyMuPDF · sentence-transformers (all-MiniLM-L6-v2) · ReportLab

**Backend (Auth Service)** — Spring Boot 3 · Spring Security · OAuth2 Client (Google) · JWT · Hibernate/JPA

**Frontend** — React (Create React App)

**Database** — PostgreSQL 16 with pgvector extension

**Infrastructure** — Docker Compose · Nginx (reverse proxy) · Let's Encrypt (SSL) · AWS EC2 (Ubuntu) · Vercel · DuckDNS

---

## Architecture

```
┌─────────────────┐      HTTPS       ┌──────────────────────────────────┐
│  React Frontend │ ───────────────► │     Nginx (reverse proxy, SSL)    │
│   (Vercel)       │                 │   clauseguard.duckdns.org         │
└─────────────────┘                  └──────────────┬─────────────────┬─┘
                                                      │                 │
                                          /api/v1/*   │     /api/auth/*,│
                                                      ▼     /oauth2/*   ▼
                                          ┌───────────────┐  ┌──────────────────┐
                                          │  FastAPI       │  │  Spring Boot      │
                                          │  (RAG, LLMs)   │  │  (Auth, JWT, OAuth)│
                                          └───────┬────────┘  └─────────┬─────────┘
                                                  │                     │
                                                  └─────────┬───────────┘
                                                            ▼
                                                  ┌────────────────────┐
                                                  │ PostgreSQL + pgvector │
                                                  └────────────────────┘
```

All backend services run as Docker containers on a single AWS EC2 instance, orchestrated via Docker Compose, with Nginx handling SSL termination and routing.

---

## Local Setup

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- Groq API key, Gemini API key, Google OAuth2 credentials

### Backend
```bash
git clone https://github.com/Diksha238/clause-guard.git
cd clause-guard
cp .env.example .env          # add POSTGRES_PASSWORD
cp backend-python/.env.example backend-python/.env   # add GROQ_API_KEY, GEMINI_API_KEY
cp backend-java/auth-service/.env.example backend-java/auth-service/.env  # add Google OAuth creds
docker compose up -d --build
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env          # point REACT_APP_API_URL / REACT_APP_AUTH_API_URL to localhost
npm start
```

---

## Deployment Notes

- Backend containers run on a memory-constrained EC2 instance with swap configured to support all three services (Postgres, FastAPI, Spring Boot) concurrently
- SSL certificates auto-renew via Certbot
- CORS configured on both FastAPI and Spring Boot to allow the Vercel frontend origin
- Database credentials are environment-variable driven (no hardcoded secrets in source)

---

## Author

**Diksha** — [GitHub](https://github.com/Diksha238)