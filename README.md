# LogIQ — AI-Powered Log Intelligence Platform

> Paste 10,000 lines of server logs, ask "Why did my API crash at 3am?" — get a precise, context-aware answer backed by the actual log data.

```
┌─────────────────────────────────────────────────────────┐
│                   [ Screenshot ]                         │
│          Dashboard · Explorer · Anomalies               │
│          Clusters · AI Chat with RAG                    │
└─────────────────────────────────────────────────────────┘
```

---

## Features

- **Multi-format log parsing** — auto-detects Nginx/Apache, Python logging, Node.js/Winston JSON, syslog, and plain text
- **Anomaly detection** — Isolation Forest ML model flags statistically rare log entries with severity scoring
- **Semantic search** — OpenAI embeddings + pgvector cosine similarity search over all log entries
- **Error clustering** — K-means clusters similar ERROR/CRITICAL entries into pattern groups
- **AI chat (RAG)** — GPT-4o mini with retrieval-augmented generation over your actual log data, streamed via SSE
- **Live processing** — WebSocket real-time progress during Celery background processing
- **Virtualized log explorer** — handle 100k+ rows with filters, level badges, anomaly highlighting
- **Dark theme UI** — JetBrains Mono, full dark design system, skeleton loaders, toast notifications

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Browser                               │
│   React 18 · TypeScript · Tailwind · TanStack Query         │
│   Zustand · Recharts · React Virtual · Axios                │
└────────────────────┬─────────────────────────────────────────┘
                     │ HTTP / SSE / WebSocket
┌────────────────────▼─────────────────────────────────────────┐
│                    FastAPI (Python 3.11)                      │
│  Auth · Logs · Anomalies · Search · Chat · WebSocket         │
│  JWT · Rate limiting · CORS · Request logging                │
└──────┬───────────────────────┬───────────────────────────────┘
       │                       │
┌──────▼──────┐    ┌───────────▼──────────────────────────────┐
│  PostgreSQL │    │         Celery Worker                     │
│  + pgvector │    │  Parse → Store → Anomaly Detect           │
│  (embeddings│    │  → Embed (OpenAI) → K-means Cluster       │
│   via vector│    │  → Publish WS events via Redis pub/sub    │
│   columns)  │    └──────────────────────────────────────────┘
└─────────────┘
       │
┌──────▼──────┐    ┌──────────────────────────────────────────┐
│    Redis    │    │            OpenAI API                    │
│  Sessions   │    │  text-embedding-3-small (embeddings)     │
│  Rate limit │    │  gpt-4o-mini (chat with RAG)             │
│  WS pub/sub │    └──────────────────────────────────────────┘
│  Chat TTL   │
└─────────────┘
```

---

## Local Setup

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for frontend dev)
- An OpenAI API key

### 1. Clone and configure

```bash
git clone https://github.com/yourname/logiq.git
cd logiq

# Backend environment
cp backend/.env.example backend/.env
# Edit backend/.env and set your OPENAI_API_KEY and a strong SECRET_KEY

# Frontend environment
cp frontend/.env.example frontend/.env
```

### 2. Start backend services with Docker Compose

```bash
docker compose up -d
```

This starts:
- PostgreSQL 16 with pgvector extension (port 5432)
- Redis 7 (port 6379)
- FastAPI backend (port 8000)
- Celery worker (background log processing)
- Flower task monitor (port 5555)

Wait about 20 seconds for postgres to initialize, then check:

```bash
curl http://localhost:8000/health
# {"status":"healthy","database":"ok","redis":"ok"}
```

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

### 4. Create an account and upload logs

1. Open `http://localhost:5173`
2. Click **Create account**
3. Click **New Session**
4. Upload a `.log` / `.txt` / `.json` file, or paste log content
5. Watch real-time processing progress
6. Explore the **Explorer**, **Anomalies**, **Clusters**, and **Chat** tabs

---

## API Documentation

Base URL: `http://localhost:8000/api/v1`

All endpoints except `/auth/register` and `/auth/login` require:
```
Authorization: Bearer <access_token>
```

### Auth

#### Register
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret123","full_name":"Ada Lovelace"}'
```

#### Login
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret123"}'
```

#### Refresh token
```bash
curl -X POST http://localhost:8000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<your_refresh_token>"}'
```

### Logs

#### Create session + paste logs
```bash
TOKEN="your_access_token"

# Create session
SESSION=$(curl -s -X POST http://localhost:8000/api/v1/logs/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-api-logs","source":"PASTE"}')

SESSION_ID=$(echo $SESSION | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# Paste logs
curl -X POST http://localhost:8000/api/v1/logs/sessions/$SESSION_ID/paste \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"raw_text":"2024-01-15 10:23:45 ERROR db.pool Connection pool exhausted\n2024-01-15 10:23:46 INFO api.server Retrying..."}'
```

#### Upload log file
```bash
curl -X POST http://localhost:8000/api/v1/logs/sessions/$SESSION_ID/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/your/app.log"
```

#### List sessions
```bash
curl http://localhost:8000/api/v1/logs/sessions \
  -H "Authorization: Bearer $TOKEN"
```

#### Get entries (filtered)
```bash
curl "http://localhost:8000/api/v1/logs/sessions/$SESSION_ID/entries?level=ERROR,CRITICAL&anomaly_only=true&page=1" \
  -H "Authorization: Bearer $TOKEN"
```

#### Get session stats
```bash
curl http://localhost:8000/api/v1/logs/sessions/$SESSION_ID/stats \
  -H "Authorization: Bearer $TOKEN"
```

### Anomalies & Clusters

```bash
# List anomalies
curl http://localhost:8000/api/v1/anomalies/sessions/$SESSION_ID/anomalies \
  -H "Authorization: Bearer $TOKEN"

# List clusters
curl http://localhost:8000/api/v1/anomalies/sessions/$SESSION_ID/clusters \
  -H "Authorization: Bearer $TOKEN"
```

### Semantic Search

```bash
curl -X POST http://localhost:8000/api/v1/search/sessions/$SESSION_ID/semantic \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"database connection errors","top_k":10}'
```

### Chat (streaming)

```bash
curl -X POST http://localhost:8000/api/v1/chat/sessions/$SESSION_ID/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Why did the API crash at 3am?","history":[]}' \
  --no-buffer
```

### Health check

```bash
curl http://localhost:8000/health
```

### Flower (Celery monitor)

```
http://localhost:5555
```

---

## Deployment

### Backend → Render

1. Push code to GitHub
2. Create a new **Web Service** on [render.com](https://render.com), point to `backend/`
3. Render will detect the `render.yaml` and provision PostgreSQL + Redis automatically
4. Set environment variables in Render dashboard:
   - `OPENAI_API_KEY` — your key
   - `ALLOWED_ORIGINS` — your Vercel frontend URL
5. The Celery worker is configured as a separate Worker service in `render.yaml`

### Frontend → Vercel

```bash
cd frontend
npm install -g vercel
vercel
# Set VITE_API_BASE_URL to your Render backend URL
# Set VITE_WS_BASE_URL to wss://your-render-app.onrender.com/ws
```

Or connect your GitHub repo in the Vercel dashboard — it auto-detects Vite.

---

## Running Tests

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```

Expected: 10 tests covering registration, login, token refresh, session creation, file upload, all 5 log parsers, anomaly detection, semantic search, chat service, and rate limiting.

---

## Supported Log Formats

| Format | Example |
|---|---|
| Python logging | `2024-01-15 10:23:45,123 ERROR myapp.db Connection failed` |
| JSON / Winston | `{"level":"error","service":"api","message":"Timeout","timestamp":"..."}` |
| Nginx access log | `192.168.1.1 - alice [15/Jan/2024:10:23:45 +0000] "GET /api" 500 1234` |
| Syslog | `Jan 15 10:23:45 webserver nginx[1234]: connect() failed` |
| Plain text | `Server crashed due to out of memory error` |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11, FastAPI, SQLAlchemy 2.0 (async), Alembic |
| Database | PostgreSQL 16 + pgvector |
| Cache / Queue | Redis 7, Celery, Flower |
| ML | scikit-learn (Isolation Forest, K-means) |
| AI | OpenAI API (gpt-4o-mini, text-embedding-3-small) |
| Auth | JWT (python-jose), bcrypt |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| State | TanStack Query, Zustand |
| Charts | Recharts |
| Virtualization | @tanstack/react-virtual |
| Deployment | Render (backend + worker), Vercel (frontend) |
