# Changelog

All notable changes to the PondPilot CORS Proxy will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-10-22

### Added - Security Enhancements

#### SSRF Protection
- **Private IP Blocking**: Blocks access to private IP ranges (10.x, 172.16.x, 192.168.x, 127.x, 169.254.x)
- **IPv6 Protection**: Blocks IPv6 loopback and private ranges (::1, fe80:, fc00:, fd00:)
- **Cloud Metadata Protection**: Blocks AWS/GCP metadata endpoints (169.254.169.254, metadata.google.internal)
- **Hostname Blocklist**: Prevents access to localhost, 0.0.0.0, and other dangerous hostnames

#### Domain Allowlisting
- **Default Allowlist**: Secure defaults for common public data sources:
  - AWS S3 (*.s3.amazonaws.com, *.s3.*.amazonaws.com)
  - CloudFront CDN (*.cloudfront.net)
  - GitHub (*.github.io, *.githubusercontent.com)
  - Google Cloud Storage (*.storage.googleapis.com)
  - Azure Blob Storage (*.blob.core.windows.net)
  - Common CDNs and data repositories
- **Custom Allowlist**: Support for custom domain patterns via `ALLOWED_DOMAINS` environment variable
- **Wildcard Support**: Pattern matching with `*` wildcards (e.g., `*.s3.amazonaws.com`)

#### Request Security
- **Redirect Blocking**: Disabled automatic redirect following (`redirect: 'manual'`) to prevent redirect-based SSRF
- **Request Timeouts**: Default 30-second timeout prevents hanging connections
- **HTTPS Enforcement**: Production mode enforces HTTPS-only by default
- **Enhanced Validation**: Multi-layer validation (protocol → IP → domain → response)

### Changed

#### Configuration
- **HTTPS_ONLY**: New environment variable (auto-enabled in production)
- **ALLOWED_DOMAINS**: Replaces `BLOCKED_DOMAINS` with allowlist approach
- **REQUEST_TIMEOUT_MS**: New configurable timeout (default: 30000ms)
- **Removed**: `BLOCKED_DOMAINS` (replaced by allowlist)

#### Code Structure
- Self-hosted: New `security.ts` module with validation functions
- Cloudflare Worker: Inline security validation functions
- Shared security patterns between both implementations
- Improved error messages with security context

#### Documentation
- **SECURITY.md**: Comprehensive security documentation with threat model
- **README.md**: Updated with v2.0 security features
- **.env.example**: Detailed configuration examples
- **wrangler.toml**: Environment-specific security configurations

### Security Fixes

#### Critical (SSRF Prevention)
- Prevented access to AWS metadata endpoint (credential theft)
- Prevented access to GCP metadata endpoint (credential theft)
- Prevented internal network scanning
- Prevented localhost service access
- Prevented DNS rebinding attacks via redirect blocking

#### High Priority
- Added request timeouts to prevent resource exhaustion
- Enforced HTTPS in production environments
- Improved file size validation timing
- Enhanced error handling for security violations

### Migration Guide

#### From v1.x to v2.0

**Environment Variables**:
```bash
# Remove (no longer used)
-BLOCKED_DOMAINS=example.com,bad.site

# Add (or leave empty for secure defaults)
+ALLOWED_DOMAINS=*.s3.amazonaws.com,*.cloudfront.net
+HTTPS_ONLY=true
+REQUEST_TIMEOUT_MS=30000
```

**Default Behavior Changes**:
- Production mode now enforces HTTPS-only (can be disabled with `HTTPS_ONLY=false`)
- All requests are validated against domain allowlist
- Redirects are now blocked for security

**Breaking Changes**:
- Domains not in the allowlist will be rejected (previously allowed unless explicitly blocked)
- HTTP requests in production mode are rejected by default
- 3xx redirect responses are now rejected

**Testing Your Deployment**:
```bash
# Should be blocked (SSRF attempts)
curl "https://your-proxy/proxy?url=http://127.0.0.1:3000"
# Response: 403 - Access to private/internal IP addresses is not allowed

curl "https://your-proxy/proxy?url=http://169.254.169.254/latest/meta-data/"
# Response: 403 - Access to private/internal IP addresses is not allowed

# Should work (public S3 bucket)
curl "https://your-proxy/proxy?url=https://my-bucket.s3.amazonaws.com/data.csv"
# Response: 200 - proxied data

# Should be blocked (not in allowlist)
curl "https://your-proxy/proxy?url=https://random-site.com/data.csv"
# Response: 403 - Domain not in allowlist
```

## [1.0.0] - 2025-10-10

### Added
- Initial release
- Basic CORS proxy functionality
- Origin validation
- Rate limiting
- File size limits
- Domain blocking (blocklist approach)
- Self-hosted (Node.js) deployment
- Cloudflare Worker deployment

---

## Upgrade Instructions

### Self-Hosted (Docker)

```bash
# Pull latest version
cd cors-proxy/self-hosted
docker compose pull

# Update .env with new variables (see .env.example)
# ALLOWED_DOMAINS=  # Leave empty for secure defaults
# HTTPS_ONLY=true
# REQUEST_TIMEOUT_MS=30000

# Restart
docker compose down
docker compose up -d

# Verify
curl http://localhost:3000/info
# Should show version: 2.0.0
```

### Cloudflare Worker

```bash
cd cors-proxy/cloudflare-worker

# Update wrangler.toml with new environment variables
# See wrangler.toml for examples

# Deploy
npm run deploy:production

# Verify
curl https://your-worker.workers.dev/info
# Should show version: 2.0.0
```

---

**Full Changelog**: https://github.com/pondpilot/cors-proxy/compare/v1.0.0...v2.0.0
