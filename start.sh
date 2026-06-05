#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo ""
echo "  ⬡ J.A.R.V.I.S. STARTUP SEQUENCE"
echo "  =================================="

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "  ERROR: Node.js not found. Install from https://nodejs.org"; exit 1
fi

# Install dependencies
if [ ! -d "node_modules" ]; then
  echo "  Installing dependencies..."
  npm install
fi

# Create .env if missing
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo ""
  echo "  ACTION REQUIRED: Add your ANTHROPIC_API_KEY to .env"
  echo "  Run: nano .env  (or open it in any text editor)"
  echo ""
  exit 0
fi

# Open browser (Mac or Linux)
PORT=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d ' ')
PORT=${PORT:-3000}
(sleep 2 && (open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null || true)) &

echo ""
echo "  JARVIS online → http://localhost:$PORT"
echo "  Press Ctrl+C to shut down."
echo ""
node server.js
