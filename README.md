# GitHub Velocity Tracker - Frontend

A modern, real-time dashboard for tracking the fastest-growing open source projects on GitHub.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4)

## Features

- 🚀 **Real-time Velocity Tracking** - See which repos are growing fastest
- 🔥 **Trend Classification** - Viral, Accelerating, Steady, Cooling
- 🔍 **Semantic Search** - Find repos by meaning, not just keywords
- 📊 **Multi-tier Filtering** - Filter by sector, language, tags, and time
- 🌙 **Dark/Light Mode** - Beautiful UI in any lighting
- ♾️ **Infinite Scroll** - Browse through thousands of trending repos

## Quick Start

### Prerequisites

- Node.js 18+
- Backend API running (see [backend repo](https://github.com/tharunmarella/github-velocity-tracker-backend))

### Installation

```bash
# Clone the repository
git clone https://github.com/tharunmarella/github-velocity-tracker-frontend.git
cd github-velocity-tracker-frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your backend API URL

# Start development server
npm run dev
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:8000` |

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Set environment variable: `NEXT_PUBLIC_API_URL=https://your-backend.railway.app`
4. Deploy!

### Manual Build

```bash
npm run build
npm start
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Markdown**: ReactMarkdown with GFM

## API Endpoints Used

The frontend connects to these backend endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/repos` | GET | Fetch trending repositories |
| `/api/search/semantic` | GET | Semantic search |
| `/api/readme` | GET | Fetch repo README |
| `/api/subscribe` | POST | Email subscription |
| `/api/update` | POST | Trigger data refresh |
| `/api/backfill` | POST | Trigger historical backfill |

## Project Structure

```
frontend/
├── app/
│   ├── page.tsx          # Main dashboard
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
├── lib/
│   └── api.ts            # API client (optional)
├── public/               # Static assets
└── package.json
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Related

- [Backend Repository](https://github.com/tharunmarella/github-velocity-tracker-backend)

