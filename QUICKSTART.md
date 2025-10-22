# Quick Start Guide

Get up and running with the PondPilot CORS Proxy in 5 minutes!

## 🚀 Fastest Start: Self-Hosted with Docker

```bash
cd cors-proxy/self-hosted

# 1. Copy and configure environment
cp .env.example .env

# 2. Start the proxy
docker compose up -d

# 3. Test it
curl http://localhost:3000/health
```

That's it! Your proxy is running at `http://localhost:3000`

## 🧪 Test the Proxy

### Test with the CORS-blocked database

```bash
# This will work now!
curl "http://localhost:3000/proxy?url=https%3A%2F%2Fduckdb-blobs.s3.amazonaws.com%2Fdatabases%2Fstations.duckdb" \
  -H "Origin: http://localhost:5173" \
  --head
```

You should see CORS headers in the response:
```
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: GET, HEAD, OPTIONS
```

### Test with PondPilot

1. Open PondPilot: `http://localhost:5173`
2. Run this SQL (with proxy):

```sql
-- Configure PondPilot to use your local proxy
-- (You'll add this in settings once we integrate)

-- Then attach the database through the proxy
ATTACH 'http://localhost:3000/proxy?url=https%3A%2F%2Fduckdb-blobs.s3.amazonaws.com%2Fdatabases%2Fstations.duckdb' AS stations_db;

-- Query it!
SELECT * FROM stations_db.stations LIMIT 10;
```

## 📋 Next Steps

### For Development

```bash
# Stop the container
docker compose down

# View logs
docker compose logs -f

# Restart after changes
docker compose restart
```

### For Production

See deployment guides:
- [Self-Hosted Production Setup](./self-hosted/README.md#deployment)
- [Cloudflare Worker Setup](./cloudflare-worker/README.md)

### For PondPilot Integration

See [INTEGRATION.md](./INTEGRATION.md) for:
- Settings UI implementation
- Error handling
- User communication

## 🎯 Configuration Tips

### Allow localhost for development

In `.env`:
```bash
ALLOWED_ORIGINS=https://app.pondpilot.io,http://localhost:5173,http://localhost:3000
```

### Increase rate limits for testing

```bash
RATE_LIMIT_REQUESTS=1000
```

### Allow larger files

```bash
MAX_FILE_SIZE_MB=1000
```

## ❓ Troubleshooting

### Port 3000 in use?

Change the port in `.env`:
```bash
PORT=3001
```

Then update docker-compose.yml:
```yaml
ports:
  - "3001:3000"  # host:container
```

### CORS still not working?

1. Check your origin is in `ALLOWED_ORIGINS`
2. Verify the proxy is running: `curl http://localhost:3000/health`
3. Check logs: `docker compose logs`

### Can't reach the proxy from PondPilot?

If running PondPilot in Docker too, use `host.docker.internal`:
```
http://host.docker.internal:3000/proxy?url=...
```

## 🚀 Deploy to Production

Quickest production deployment:

### Railway (1-click deploy)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy from self-hosted directory
cd self-hosted
railway up
```

### Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Deploy
cd self-hosted
flyctl launch
flyctl deploy
```

Your proxy will be available at `https://your-app.fly.dev`

## 📚 Full Documentation

- [Main README](./README.md) - Overview and features
- [Self-Hosted Guide](./self-hosted/README.md) - Detailed setup
- [Cloudflare Worker](./cloudflare-worker/README.md) - Serverless option
- [Security Policy](./SECURITY.md) - Privacy and security
- [Integration Guide](./INTEGRATION.md) - PondPilot integration

## 💬 Need Help?

- [Open an issue](https://github.com/yourusername/cors-proxy/issues)
- [GitHub Discussions](https://github.com/yourusername/cors-proxy/discussions)
- Email: [hello@pondpilot.io](mailto:hello@pondpilot.io)

---

**Pro Tip**: For maximum privacy and lowest latency, self-host the proxy on the same network as your PondPilot instance!
