# Security & Privacy Policy

## 🔒 Security Model

The PondPilot CORS proxy is designed with security and privacy as core principles.

## What This Proxy Does

1. **Forwards HTTP Requests**: Acts as a transparent proxy for GET/HEAD requests
2. **Adds CORS Headers**: Enables browser access to resources without CORS headers
3. **Validates Origins**: Only allows requests from authorized PondPilot instances
4. **Rate Limiting**: Prevents abuse through IP-based rate limiting
5. **Validates URLs**: Ensures only allowed protocols and domains are accessed

## What This Proxy Does NOT Do

1. **No Logging**: Request URLs, content, and user data are NOT logged
2. **No Data Storage**: No caching or storage of proxied data
3. **No Modification**: Response data is passed through unmodified
4. **No Tracking**: No analytics, cookies, or user tracking
5. **No Authentication**: Does not store or transmit credentials

## Privacy Guarantees

### Official Hosted Service

When using the official `cors-proxy.pondpilot.io`:

- ✅ No request logging
- ✅ No data retention
- ✅ No user tracking
- ✅ No analytics
- ✅ Cloudflare's standard edge caching only
- ✅ Source code is public and verifiable

### Self-Hosted

When self-hosting:

- ✅ Complete control over all data
- ✅ Requests never leave your infrastructure
- ✅ You control logging and monitoring
- ✅ Open source - verify the code yourself

## Security Features

### 1. Origin Validation

Only requests from whitelisted origins are allowed:

```typescript
// Default allowed origins
const allowedOrigins = [
  'https://app.pondpilot.io',
  'http://localhost:5173', // Development only
];
```

**Prevents**: Unauthorized sites from using the proxy

### 2. Rate Limiting

IP-based rate limiting prevents abuse:

- Default: 60 requests per minute per IP
- Configurable per deployment
- Cloudflare Worker: Uses Cloudflare's rate limiting API
- Self-hosted: Uses express-rate-limit

**Prevents**: DDoS attacks, excessive bandwidth usage

### 3. Protocol Validation

Only HTTPS (and HTTP for development) are allowed:

```typescript
const allowedProtocols = ['https:', 'http:'];
```

**Prevents**: Access to non-web protocols (file://, ftp://, etc.)

### 4. File Size Limits

Maximum file size enforced (default: 500MB):

**Prevents**: Bandwidth exhaustion, memory issues

### 5. Domain Blocking

Optional blocklist for known malicious domains:

```bash
BLOCKED_DOMAINS=spam.com,malicious.site
```

**Prevents**: Proxy abuse for accessing blocked content

### 6. No Authentication Forwarding

The proxy does NOT forward:
- Authorization headers
- Cookies
- API keys
- Session tokens

**Prevents**: Credential leakage

## Threat Model

### What We Protect Against

| Threat | Mitigation |
|--------|------------|
| Unauthorized access | Origin validation |
| DDoS / abuse | Rate limiting |
| Bandwidth exhaustion | File size limits |
| Malicious content | Domain blocklist |
| Credential theft | No auth header forwarding |
| Data logging | No logging policy |

### What We Don't Protect Against

| Threat | Why Not | Mitigation |
|--------|---------|------------|
| MITM attacks on target | Not a proxy responsibility | Target should use HTTPS |
| Malicious targets | Users choose what to access | User responsibility |
| Client-side vulnerabilities | Not in proxy scope | PondPilot handles this |

## Acceptable Use

### ✅ Allowed Uses

- Accessing public data sources without CORS headers
- Loading public databases for analysis
- Accessing open datasets from S3, GitHub, etc.
- Educational and research purposes

### ❌ Prohibited Uses

- Accessing private or authenticated resources
- Circumventing access controls or paywalls
- Violating terms of service of target sites
- Illegal content or activities
- Spamming or abusive requests

## Data Handling

### Request Data

- **URL**: Not logged (passed through only)
- **Headers**: Minimal forwarding, no auth headers
- **IP Address**: Used for rate limiting only, not logged
- **Origin**: Validated against whitelist, not stored

### Response Data

- **Content**: Streamed directly to client, not stored
- **Headers**: Forwarded with CORS additions
- **Caching**: Edge caching only (Cloudflare), no permanent storage

## Compliance

### GDPR

- No personal data collected
- No data retention
- No user tracking
- No cookies

### Data Residency

- **Official Service**: Cloudflare global edge network
- **Self-Hosted**: Your infrastructure, your control

## Security Best Practices

### For PondPilot Users

1. **Use HTTPS**: Always access PondPilot over HTTPS
2. **Verify URLs**: Only proxy public, trustworthy sources
3. **Check Connections**: Use browser DevTools to verify proxy usage
4. **Self-Host**: For maximum privacy, self-host the proxy

### For Self-Hosters

1. **HTTPS Only**: Use reverse proxy with SSL/TLS
2. **Firewall**: Restrict access to known IPs if possible
3. **Updates**: Keep Node.js and dependencies updated
4. **Monitoring**: Monitor for unusual traffic patterns
5. **Backups**: Regular system backups (not of proxy data)

## Incident Response

### If You Suspect Abuse

1. **Self-Hosted**: Check logs and block offending IPs
2. **Official Service**: Report to [security@pondpilot.io](mailto:security@pondpilot.io)

### If You Find a Vulnerability

Please report security issues to:
- Email: [security@pondpilot.io](mailto:security@pondpilot.io)
- Subject: "CORS Proxy Security Issue"

We'll respond within 48 hours.

## Transparency

### Open Source

All code is open source and available for inspection:
- [GitHub Repository](https://github.com/yourusername/cors-proxy)
- [Cloudflare Worker Code](./cloudflare-worker/worker.ts)
- [Self-Hosted Server Code](./self-hosted/server.ts)

### No Hidden Features

- No telemetry
- No hidden logging
- No backdoors
- What you see is what runs

## Regular Reviews

This security policy is reviewed and updated:
- After any security incident
- When new features are added
- At least quarterly

Last updated: January 2024

## Questions?

For security questions or concerns:
- Email: [security@pondpilot.io](mailto:security@pondpilot.io)
- GitHub Issues: [Report an issue](https://github.com/yourusername/cors-proxy/issues)
