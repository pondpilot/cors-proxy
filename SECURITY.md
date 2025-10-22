# Security & Privacy Policy

## 🔒 Security Model

The PondPilot CORS proxy is designed with security and privacy as core principles.

**Version 2.0** introduces comprehensive SSRF protection, domain allowlisting, and enhanced security controls.

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

## 🛡️ Version 2.0 Security Enhancements

### Server-Side Request Forgery (SSRF) Protection

SSRF attacks attempt to use the proxy to access internal network resources. Version 2.0 implements comprehensive SSRF protection:

**Private IP Blocking**:
- ✅ Loopback: 127.0.0.0/8 (localhost)
- ✅ Private networks: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
- ✅ Link-local: 169.254.0.0/16 (AWS/GCP metadata!)
- ✅ IPv6 private ranges

**Blocked Hostnames**:
- ✅ localhost, 0.0.0.0
- ✅ metadata.google.internal (GCP metadata)
- ✅ Other cloud metadata endpoints

**Example Blocked Requests**:
```bash
# ❌ Accessing AWS metadata (credential theft)
/proxy?url=http://169.254.169.254/latest/meta-data/

# ❌ Accessing internal services
/proxy?url=http://127.0.0.1:3000/admin

# ❌ Scanning internal network
/proxy?url=http://192.168.1.1/router-config
```

### Domain Allowlisting

**Default Allowlist** (automatically applied):
- AWS S3: `*.s3.amazonaws.com`, `*.s3.*.amazonaws.com`
- CloudFront CDN: `*.cloudfront.net`
- GitHub: `*.github.io`, `*.githubusercontent.com`
- Google Cloud Storage: `*.storage.googleapis.com`
- Azure Blob Storage: `*.blob.core.windows.net`
- Common CDNs and data repositories

**Custom Allowlist** (optional):
```bash
# Self-hosted (.env)
ALLOWED_DOMAINS=*.s3.amazonaws.com,*.cloudfront.net,data.example.com

# Cloudflare Worker (wrangler.toml)
ALLOWED_DOMAINS = "*.s3.amazonaws.com,my-cdn.net"

# Leave empty to use secure defaults
ALLOWED_DOMAINS=
```

**Wildcard Pattern Semantics** (⚠️ Breaking Change in v2.0):

Version 2.0 introduces **single-level wildcard matching** for improved security:

- `*` matches ONE subdomain level only (not multiple levels)
- Pattern matching uses `[^.]*` instead of `.*` to prevent subdomain traversal

**Examples**:
```bash
# Pattern: example.com
✅ Matches: example.com
❌ Does NOT match: sub.example.com, api.example.com

# Pattern: *.example.com
✅ Matches: sub.example.com, api.example.com
❌ Does NOT match: a.b.example.com, deep.sub.example.com

# Pattern: *.*.example.com
✅ Matches: a.b.example.com, api.v1.example.com
❌ Does NOT match: x.y.z.example.com

# Pattern: data.*.gov
✅ Matches: data.usa.gov, data.uk.gov
❌ Does NOT match: data.example.com
```

**Migration from v1.x**:
If you previously used wildcards expecting multi-level matching, you may need to add more specific patterns:
```bash
# Before (v1.x): *.example.com matched all depths
# After (v2.0): Need explicit patterns for each level
ALLOWED_DOMAINS=*.example.com,*.*.example.com,*.*.*.example.com
```

**Security Rationale**:
Single-level wildcards prevent accidental over-permissive patterns and ReDoS (Regular Expression Denial of Service) attacks.

### Credential Forwarding

**New in 2.0**: Optional credential forwarding for trusted sources.

By default, the proxy does **NOT** forward credentials (cookies, auth headers). Enable this only for fully trusted origins and data sources:

```bash
# Self-hosted (.env)
ALLOW_CREDENTIALS=true

# Cloudflare Worker (wrangler.toml)
ALLOW_CREDENTIALS = "true"
```

**⚠️ Security Warning**:
- Only enable if **both** the client application (`ALLOWED_ORIGINS`) and data source (`ALLOWED_DOMAINS`) are fully trusted
- If an allowed data source has a vulnerability (e.g., reflects user input), it could be exploited
- Upstream `Set-Cookie` headers are blocked to prevent cookie hijacking
- Enabling this increases risk and should only be used when absolutely necessary

**Use Cases**:
- Accessing authenticated APIs from browser-based applications
- Corporate environments with trusted internal data sources
- Development/testing scenarios with controlled domains

**Best Practices**:
1. Use credential forwarding sparingly
2. Restrict `ALLOWED_ORIGINS` to specific, trusted origins (no wildcards)
3. Restrict `ALLOWED_DOMAINS` to specific, trusted data sources
4. Regularly audit which domains are allowed
5. Consider using a separate proxy instance for authenticated requests

### Redirect Protection

**Attack**: Redirect to internal IP after validation

**Protection**:
- ✅ Redirect following is disabled (`redirect: 'manual'`)
- ✅ 3xx responses are rejected
- ✅ Prevents DNS rebinding attacks

### Request Timeouts

**New in 2.0**:
- Default: 30 seconds
- Prevents hanging connections
- Configurable via `REQUEST_TIMEOUT_MS`

### HTTPS Enforcement

**Production Mode**:
- HTTPS-only by default
- Configurable via `HTTPS_ONLY` environment variable
- Prevents man-in-the-middle attacks

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

### 5. Domain Allowlist

Strict allowlist of trusted data hosts with optional extensions:

```bash
ALLOWED_DOMAINS=*.example.com,datasets.gov
```

**Prevents**: Proxy abuse by restricting outbound requests to approved domains

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
| **SSRF attacks** | Private IP blocking, domain allowlist, redirect blocking |
| **DNS rebinding** | Domain allowlist validation before DNS resolution |
| **Unauthorized access** | Origin validation |
| **DDoS / abuse** | Rate limiting |
| **Bandwidth exhaustion** | File size limits, request timeouts |
| **Open proxy abuse** | Domain allowlist, origin validation |
| **Credential theft** | No auth header forwarding |
| **Data exfiltration** | Read-only operations, domain allowlist |
| **Data logging** | No logging policy |

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

1. **Production Mode**: Set `NODE_ENV=production`
2. **HTTPS Only**: Set `HTTPS_ONLY=true` and use reverse proxy with SSL/TLS
3. **Domain Allowlist**: Configure `ALLOWED_DOMAINS` or use secure defaults
4. **Firewall**: Block outbound access to private IP ranges at network level
5. **Updates**: Keep Node.js and dependencies updated
6. **Monitoring**: Monitor for unusual traffic patterns and blocked requests
7. **Rate Limiting**: Adjust `RATE_LIMIT_REQUESTS` based on your needs

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

## Security Deployment Checklist

Before deploying to production, verify:

- [ ] `NODE_ENV=production` is set
- [ ] `HTTPS_ONLY=true` is configured
- [ ] `ALLOWED_ORIGINS` is restricted to your domain(s)
- [ ] `ALLOWED_DOMAINS` is configured (or using secure defaults)
- [ ] Rate limiting is enabled and configured
- [ ] HTTPS is enforced at reverse proxy/CDN level
- [ ] Firewall rules block outbound access to private IP ranges
- [ ] Monitoring and alerting is configured
- [ ] Dependencies are up to date
- [ ] Test SSRF protection with blocked IPs

## Regular Reviews

This security policy is reviewed and updated:
- After any security incident
- When new features are added
- At least quarterly

**Last updated**: October 22, 2024
**Version**: 2.0.0

## Questions?

For security questions or concerns:
- Email: [security@pondpilot.io](mailto:security@pondpilot.io)
- GitHub Issues: [Report an issue](https://github.com/yourusername/cors-proxy/issues)
