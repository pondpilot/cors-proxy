# Self-Hosted CORS Proxy

A self-hosted Node.js implementation of the PondPilot CORS proxy for maximum privacy and control.

## 🚀 Features

- **Full Control**: Host on your own infrastructure
- **Privacy**: All requests stay within your network
- **Easy Deployment**: Docker, Node.js, or any hosting platform
- **Configurable**: Environment-based configuration
- **Production Ready**: Health checks, logging, graceful shutdown

## 📋 Prerequisites

Choose one:
- **Docker**: [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/)
- **Node.js**: [Node.js](https://nodejs.org/) 18 or later

## 🛠️ Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Edit .env with your settings
nano .env

# 3. Start the proxy
docker compose up -d

# 4. Check logs
docker compose logs -f

# 5. Test it
curl http://localhost:3000/health
```

### Option 2: Docker (Manual)

```bash
# Build
docker build -t pondpilot-cors-proxy .

# Run
docker run -p 3000:3000 \
  -e ALLOWED_ORIGINS="https://app.pondpilot.io" \
  -e RATE_LIMIT_REQUESTS=60 \
  pondpilot-cors-proxy
```

### Option 3: Node.js (Development)

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure .env
cp .env.example .env

# 3. Run in development mode
npm run dev

# Or build and run production
npm run build
npm start
```

## ⚙️ Configuration

Edit `.env` file or set environment variables:

```bash
# Server
PORT=3000
NODE_ENV=production

# CORS - Add your PondPilot instance URL
ALLOWED_ORIGINS=https://app.pondpilot.io,http://localhost:5173

# Rate Limiting
RATE_LIMIT_REQUESTS=60           # Requests per window
RATE_LIMIT_WINDOW_MS=60000       # Window in ms (60000 = 1 minute)

# File Size
MAX_FILE_SIZE_MB=500             # Maximum file size to proxy

# Optional: Block specific domains
BLOCKED_DOMAINS=spam.com,malicious.site
```

## 🌐 Deployment

### Deploy to VPS (DigitalOcean, Linode, etc.)

```bash
# SSH into your server
ssh user@your-server.com

# Clone repository
git clone https://github.com/yourusername/cors-proxy.git
cd cors-proxy/self-hosted

# Configure
cp .env.example .env
nano .env

# Start with Docker Compose
docker compose up -d

# Set up reverse proxy (nginx/caddy) for HTTPS
# See DEPLOYMENT.md for full guide
```

### Deploy to Cloud Run (Google Cloud)

```bash
# Build and push
gcloud builds submit --tag gcr.io/YOUR_PROJECT/cors-proxy

# Deploy
gcloud run deploy cors-proxy \
  --image gcr.io/YOUR_PROJECT/cors-proxy \
  --platform managed \
  --set-env-vars ALLOWED_ORIGINS=https://app.pondpilot.io
```

### Deploy to Railway

1. Push to GitHub
2. Connect to Railway
3. Set environment variables in dashboard
4. Deploy!

### Deploy to Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Launch app
flyctl launch

# Set environment variables
flyctl secrets set ALLOWED_ORIGINS=https://app.pondpilot.io

# Deploy
flyctl deploy
```

## 🔒 HTTPS Setup

For production, use a reverse proxy with HTTPS:

### Option 1: Caddy (Automatic HTTPS)

```Caddyfile
cors-proxy.yourdomain.com {
    reverse_proxy localhost:3000
}
```

### Option 2: Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name cors-proxy.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 📊 Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "service": "pondpilot-cors-proxy",
  "uptime": 12345.67,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Docker Logs

```bash
# View logs
docker compose logs -f

# View last 100 lines
docker compose logs --tail=100
```

### Resource Usage

```bash
# Docker stats
docker stats pondpilot-cors-proxy
```

## 🧪 Testing

```bash
# Health check
curl http://localhost:3000/health

# Info endpoint
curl http://localhost:3000/info

# Test proxy
curl "http://localhost:3000/proxy?url=https%3A%2F%2Fexample.com%2Fdata.csv" \
  -H "Origin: https://app.pondpilot.io"
```

## 🐛 Troubleshooting

### CORS Errors

Ensure your PondPilot URL is in `ALLOWED_ORIGINS`:
```bash
ALLOWED_ORIGINS=https://app.pondpilot.io,https://your-instance.com
```

### Rate Limiting

Adjust rate limits in `.env`:
```bash
RATE_LIMIT_REQUESTS=120
RATE_LIMIT_WINDOW_MS=60000
```

### Port Already in Use

Change port in `.env`:
```bash
PORT=3001
```

### Docker Container Won't Start

Check logs:
```bash
docker compose logs
```

Rebuild:
```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

## 🔧 Development

```bash
# Install dependencies
npm install

# Run in watch mode
npm run dev

# Build TypeScript
npm run build

# Run built version
npm start
```

## 📚 Resources

- [Express Documentation](https://expressjs.com/)
- [Docker Documentation](https://docs.docker.com/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
