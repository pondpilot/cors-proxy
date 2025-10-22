# Cloudflare Worker CORS Proxy

The official PondPilot CORS proxy implementation using Cloudflare Workers.

## 🚀 Features

- **Global Edge Network**: Deployed on Cloudflare's edge for low latency worldwide
- **Serverless**: No servers to manage, scales automatically
- **Rate Limiting**: Built-in rate limiting per IP
- **Caching**: Intelligent caching to reduce bandwidth and improve performance
- **Free Tier**: Generous free tier (100k requests/day)

## 📋 Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- [Node.js](https://nodejs.org/) 18 or later
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

## 🛠️ Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Login to Cloudflare

```bash
npx wrangler login
```

### 3. Configure

Edit `wrangler.toml` and update:
- `account_id`: Your Cloudflare account ID
- `routes`: Your domain routing (if using a custom domain)

### 4. Deploy

```bash
# Deploy to development
npm run dev

# Deploy to production
npm run deploy:production
```

## 🧪 Testing Locally

```bash
npm run dev
```

This starts a local development server at `http://localhost:8787`

Test with:
```bash
curl "http://localhost:8787/proxy?url=https%3A%2F%2Fexample.com%2Fdata.csv"
```

## 🌐 Production Deployment

### Option 1: workers.dev subdomain (Quick)

```bash
npm run deploy
```

Your worker will be available at: `https://pondpilot-cors-proxy.<your-subdomain>.workers.dev`

### Option 2: Custom Domain (Recommended)

1. Add your domain to Cloudflare
2. Update `wrangler.toml`:
   ```toml
   routes = [
     { pattern = "cors-proxy.pondpilot.io/*", zone_name = "pondpilot.io" }
   ]
   ```
3. Deploy:
   ```bash
   npm run deploy:production
   ```

## ⚙️ Configuration

Environment variables can be set in `wrangler.toml` or via the Cloudflare dashboard:

| Variable | Description | Default |
|----------|-------------|---------|
| `ALLOWED_ORIGINS` | Comma-separated allowed origins | `https://app.pondpilot.io` |
| `RATE_LIMIT_REQUESTS` | Requests per minute per IP | `60` |
| `MAX_FILE_SIZE_MB` | Maximum file size to proxy | `500` |
| `BLOCKED_DOMAINS` | Domains to block (comma-separated) | - |

## 📊 Monitoring

### View Logs

```bash
npm run tail
```

### Cloudflare Dashboard

View analytics and logs at:
https://dash.cloudflare.com/ → Workers & Pages → pondpilot-cors-proxy

## 🔒 Security

- **Origin Validation**: Only allowed origins can use the proxy
- **Rate Limiting**: Prevents abuse with per-IP limits
- **No Logging**: Request URLs and data are not logged
- **HTTPS Only**: Enforced via Cloudflare
- **File Size Limits**: Prevents large file abuse

## 💰 Cost

Cloudflare Workers free tier includes:
- 100,000 requests/day
- 10ms CPU time per request

For PondPilot's use case, this should handle:
- ~3,000 users/day with 30 requests each
- Much more with caching

Paid plans start at $5/month for 10M requests.

## 🐛 Troubleshooting

### Rate Limiting Issues

If you see rate limiting in development, update the development environment:

```toml
[env.development]
vars = {
  RATE_LIMIT_REQUESTS = "1000"
}
```

### CORS Errors

Ensure your origin is in `ALLOWED_ORIGINS`:
```toml
vars = {
  ALLOWED_ORIGINS = "https://app.pondpilot.io,https://staging.pondpilot.io"
}
```

### Worker Not Updating

Clear deployment cache:
```bash
wrangler delete
npm run deploy
```

## 📚 Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
