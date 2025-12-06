#!/bin/bash

# Start script for local development with analytics

echo "🚀 Starting Dance Classes Site with Analytics..."
echo ""
echo "This will start:"
echo "  1. Analytics server on http://localhost:3001"
echo "  2. Web server on http://localhost:8080"
echo "  3. Admin dashboard at http://localhost:8080/admin.html"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build dev config
echo "🔧 Building development config..."
npm run build:dev

# Start both servers
echo "▶️  Starting servers..."
npm run dev:full
