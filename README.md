# Truth Engine v3

Multi-agent adversarial analysis engine. One question — up to 1,000 independent AI agents tear it apart from 8 different perspectives. No consensus assumed.

![Truth Engine Screenshot](public/screenshot.png)

## How It Works

1. **Input** — Ask anything. Attach PDFs, images, or URLs.
2. **Enhance** — Your query gets optimized for swarm analysis.
3. **Swarm** — N agents (8–1000) across 8 adversarial categories analyze independently.
4. **Compile** — Category groups synthesize first, then a final compiler merges everything.
5. **Report** — Structured truth report with confidence scores, hidden factors, and predictions.

## Agent Categories

| Category | Role |
|----------|------|
| Skeptic | Challenges mainstream narrative |
| Historian | Finds historical precedents & patterns |
| Data Analyst | Anchors in verifiable data & statistics |
| Geopolitical | Maps power dynamics & interests |
| Devil's Advocate | Steelmans the opposing argument |
| Pattern Recognizer | Identifies structural patterns across domains |
| Futurist | Constructs probabilistic future scenarios |
| Source Critic | Evaluates credibility & information warfare |

## Features

- **Up to 1,000 agents** — 125 per category, each with unique system prompts
- **Tiered compilation** — Groups compile first, then final synthesis
- **Input enhancement** — Automatically optimizes your query for analysis
- **File support** — PDFs, images (OCR + vision), URLs (auto-fetched)
- **Analysis history** — Every analysis saved, browseable, reloadable
- **Python sandbox** — Run custom code alongside analysis (local dev only)
- **Zero cost** — Uses `openrouter/free` model, completely free to run

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite, Tailwind CSS 4 |
| Backend | Express (local) / Vercel Serverless Functions (production) |
| Database | Turso (libSQL) |
| AI | OpenRouter API |
| Hosting | Vercel (free tier) |

## Quick Start

```bash
# Clone
git clone https://github.com/auputralt/AI-TRUTH-ENGINE.git
cd AI-TRUTH-ENGINE

# Install
npm install

# Set up env
cp .env.example .env
# Edit .env with your keys

# Run locally (frontend + backend)
npm run dev:all
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | Get free at [openrouter.ai](https://openrouter.ai) |
| `TURSO_URL` | Yes (history) | Turso database URL |
| `TURSO_AUTH_TOKEN` | Yes (history) | Turso auth token |
| `PORT` | No | Backend port (default: 3001) |

## Deploy to Vercel (Free)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/auputralt/AI-TRUTH-ENGINE)

1. Click deploy button above (or fork & connect)
2. Add environment variables in Vercel dashboard
3. Done — live forever on free tier

### Set up Turso (free database)

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create database
turso auth signup
turso db create truth-engine

# Get credentials → add to Vercel env vars
turso db show truth-engine --url
turso db tokens create truth-engine
```

## Project Structure

```
├── api/                    # Vercel serverless functions
│   ├── chat.js             # OpenRouter proxy
│   ├── health.js           # Health check
│   ├── history/
│   │   ├── index.js        # List + save history
│   │   └── [id].js         # Get + delete single
│   └── lib/
│       └── db.js           # Turso DB helper + schema
├── src/
│   ├── App.jsx             # Main app with history integration
│   ├── components/
│   │   ├── AgentLoader.jsx # Swarm progress UI
│   │   ├── EnhancePreview.jsx
│   │   ├── HistoryPanel.jsx # Analysis history sidebar
│   │   ├── InputForm.jsx   # Question input + file attachments
│   │   ├── PythonCodeBox.jsx
│   │   └── ReportCard.jsx  # Final report display
│   ├── lib/
│   │   ├── agents.js       # Agent factory, swarm runner, compiler
│   │   ├── enhancer.js     # Input enhancement pipeline
│   │   └── parser.jsx      # Markdown/report parser
│   └── styles/
│       └── index.css        # Tailwind + custom styles
├── server.js               # Express server (local dev)
├── vercel.json             # Vercel deployment config
└── vite.config.js          # Vite build config
```

## License

MIT

---

Built with React, Express, Turso, and OpenRouter. Deployed free on Vercel.
