/**
 * PondPilot CORS Proxy - Cloudflare Worker
 *
 * A transparent CORS proxy that enables browser-based access to remote files
 * without CORS headers. Designed for PondPilot to access public data sources.
 *
 * Privacy: No logging, no data retention, no tracking
 * Security: SSRF protection, domain allowlisting, HTTPS enforcement
 */

interface Env {
  RATE_LIMITER?: {
    limit: (options: { key: string }) => Promise<{ success: boolean }>;
  };
  ALLOWED_ORIGINS?: string;
  RATE_LIMIT_REQUESTS?: string;
  MAX_FILE_SIZE_MB?: string;
  ALLOWED_DOMAINS?: string;
  HTTPS_ONLY?: string;
  REQUEST_TIMEOUT_MS?: string;
}

// Security: Private/internal IP patterns to block (SSRF protection)
const PRIVATE_IP_PATTERNS = [
  /^127\./,                    // 127.0.0.0/8 - Loopback
  /^10\./,                     // 10.0.0.0/8 - Private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12 - Private
  /^192\.168\./,               // 192.168.0.0/16 - Private
  /^169\.254\./,               // 169.254.0.0/16 - Link-local (AWS metadata!)
  /^0\./,                      // 0.0.0.0/8
  /^224\./,                    // Multicast
  /^240\./,                    // Reserved
  /^::1$/,                     // IPv6 loopback
  /^fe80:/,                    // IPv6 link-local
  /^fc00:/,                    // IPv6 private
];

const BLOCKED_HOSTNAMES = [
  'localhost',
  '0.0.0.0',
  'metadata.google.internal',  // GCP metadata
];

// Default allowed domains (public data sources)
const DEFAULT_ALLOWED_DOMAINS = [
  /^.*\.s3\.amazonaws\.com$/,
  /^.*\.s3\..*\.amazonaws\.com$/,
  /^s3\.amazonaws\.com$/,
  /^.*\.cloudfront\.net$/,
  /^.*\.github\.io$/,
  /^.*\.githubusercontent\.com$/,
  /^storage\.googleapis\.com$/,
  /^.*\.storage\.googleapis\.com$/,
  /^.*\.blob\.core\.windows\.net$/,
  /^.*\.cdn\..*$/,
  /^data\..*$/,
  /^datasets\..*$/,
  /^download\..*$/,
];

const DEFAULT_CONFIG = {
  allowedOrigins: ['https://app.pondpilot.io', 'http://localhost:5173', 'http://localhost:3000'],
  rateLimitRequests: 60,
  maxFileSizeMB: 500,
  requestTimeoutMs: 30000,
  allowedProtocols: ['https:'],
  httpsOnly: true,
  allowedDomains: DEFAULT_ALLOWED_DOMAINS,
};

// Security validation functions
function isPrivateIP(hostname: string): boolean {
  if (BLOCKED_HOSTNAMES.includes(hostname.toLowerCase())) {
    return true;
  }
  return PRIVATE_IP_PATTERNS.some(pattern => pattern.test(hostname));
}

function isAllowedDomain(hostname: string, allowedDomains: RegExp[]): boolean {
  const lowerHostname = hostname.toLowerCase();
  return allowedDomains.some(pattern => pattern.test(lowerHostname));
}

function parseAllowedDomains(domainsString: string | undefined): RegExp[] {
  if (!domainsString || domainsString.trim() === '') {
    return DEFAULT_ALLOWED_DOMAINS;
  }

  return domainsString
    .split(',')
    .map(d => d.trim())
    .filter(d => d.length > 0)
    .map(pattern => {
      const escaped = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
      return new RegExp(`^${escaped}$`, 'i');
    });
}

function validateTargetUrl(targetUrl: string, config: any): { valid: boolean; error?: string } {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch (e) {
    return { valid: false, error: 'Invalid URL format' };
  }

  if (!config.allowedProtocols.includes(parsed.protocol)) {
    return { valid: false, error: `Protocol ${parsed.protocol} not allowed` };
  }

  if (config.httpsOnly && parsed.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTPS URLs are allowed' };
  }

  if (isPrivateIP(parsed.hostname)) {
    return { valid: false, error: 'Access to private/internal IP addresses is not allowed' };
  }

  if (!isAllowedDomain(parsed.hostname, config.allowedDomains)) {
    return { valid: false, error: `Domain ${parsed.hostname} is not in the allowlist` };
  }

  return { valid: true };
}

function validateResponse(response: Response, maxFileSizeMB: number): { valid: boolean; error?: string } {
  if (response.status >= 300 && response.status < 400) {
    return { valid: false, error: 'Redirects are not supported for security reasons' };
  }

  const contentLength = response.headers.get('Content-Length');
  if (contentLength) {
    const sizeMB = parseInt(contentLength) / (1024 * 1024);
    if (sizeMB > maxFileSizeMB) {
      return { valid: false, error: `File too large (${sizeMB.toFixed(1)}MB > ${maxFileSizeMB}MB)` };
    }
  }

  return { valid: true };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return handlePreflight(request, env);
    }

    // Only allow GET and HEAD
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return jsonError('Method not allowed', 405);
    }

    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return jsonResponse({ status: 'ok', service: 'pondpilot-cors-proxy' });
    }

    // Info endpoint
    if (url.pathname === '/' || url.pathname === '/info') {
      const config = getConfig(env);
      return jsonResponse({
        service: 'PondPilot CORS Proxy (Cloudflare Workers)',
        version: '2.0.0',
        usage: 'GET /proxy?url=<encoded-url>',
        privacy: 'No logging, no data retention',
        security: 'SSRF protection, domain allowlisting, HTTPS enforcement',
        source: 'https://github.com/pondpilot/cors-proxy',
        config: {
          httpsOnly: config.httpsOnly,
          allowedDomainsCount: config.allowedDomains.length,
          usingDefaultAllowlist: !env.ALLOWED_DOMAINS,
        },
      });
    }

    // Proxy endpoint
    if (url.pathname === '/proxy') {
      return handleProxy(request, env, ctx);
    }

    return jsonError('Not found. Use /proxy?url=<encoded-url>', 404);
  },
};

async function handleProxy(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const config = getConfig(env);
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const origin = request.headers.get('Origin');

  // Validate origin
  if (!origin || !config.allowedOrigins.includes(origin)) {
    return corsError('Origin not allowed', origin, 403);
  }

  // Rate limiting
  if (env.RATE_LIMITER) {
    const rateLimitKey = `ip:${clientIP}`;
    const { success } = await env.RATE_LIMITER.limit({ key: rateLimitKey });
    if (!success) {
      return corsError('Rate limit exceeded', origin, 429);
    }
  }

  // Get target URL
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return corsError('Missing url parameter', origin, 400);
  }

  // Validate URL with SSRF protection
  const validation = validateTargetUrl(targetUrl, config);
  if (!validation.valid) {
    return corsError(validation.error || 'Invalid URL', origin, 403);
  }

  // Fetch the resource with security settings
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.requestTimeoutMs);

    let targetResponse: Response;
    try {
      targetResponse = await fetch(targetUrl, {
        method: request.method,
        headers: {
          'User-Agent': 'PondPilot-CORS-Proxy/2.0',
        },
        redirect: 'manual', // Critical: Prevent redirects to internal IPs
        signal: controller.signal,
        // Use Cloudflare's cache
        cf: {
          cacheEverything: true,
          cacheTtl: 3600,
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // Validate response (check for redirects, file size)
    const responseValidation = validateResponse(targetResponse, config.maxFileSizeMB);
    if (!responseValidation.valid) {
      return corsError(responseValidation.error || 'Invalid response', origin, 400);
    }

    // Create response with CORS headers
    const responseHeaders = new Headers(targetResponse.headers);

    // Add CORS headers
    responseHeaders.set('Access-Control-Allow-Origin', origin);
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Range');
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type');

    // Add cache headers
    responseHeaders.set('Cache-Control', 'public, max-age=3600');

    // Add proxy headers for transparency
    responseHeaders.set('X-Proxy-By', 'PondPilot-CORS-Proxy');

    return new Response(targetResponse.body, {
      status: targetResponse.status,
      statusText: targetResponse.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    // Handle timeout errors
    if (error instanceof Error && error.name === 'AbortError') {
      return corsError('Request timeout - the remote server took too long to respond', origin, 504);
    }

    console.error('Fetch error:', error);
    return corsError(`Failed to fetch resource: ${error instanceof Error ? error.message : 'Unknown error'}`, origin, 502);
  }
}

function handlePreflight(request: Request, env: Env): Response {
  const config = getConfig(env);
  const origin = request.headers.get('Origin');

  if (!origin || !config.allowedOrigins.includes(origin)) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
      'Access-Control-Max-Age': '86400',
    },
  });
}

function getConfig(env: Env) {
  return {
    allowedOrigins: env.ALLOWED_ORIGINS
      ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : DEFAULT_CONFIG.allowedOrigins,
    rateLimitRequests: env.RATE_LIMIT_REQUESTS
      ? parseInt(env.RATE_LIMIT_REQUESTS)
      : DEFAULT_CONFIG.rateLimitRequests,
    maxFileSizeMB: env.MAX_FILE_SIZE_MB
      ? parseInt(env.MAX_FILE_SIZE_MB)
      : DEFAULT_CONFIG.maxFileSizeMB,
    requestTimeoutMs: env.REQUEST_TIMEOUT_MS
      ? parseInt(env.REQUEST_TIMEOUT_MS)
      : DEFAULT_CONFIG.requestTimeoutMs,
    allowedProtocols: DEFAULT_CONFIG.allowedProtocols,
    httpsOnly: env.HTTPS_ONLY === 'false' ? false : DEFAULT_CONFIG.httpsOnly,
    allowedDomains: parseAllowedDomains(env.ALLOWED_DOMAINS),
  };
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
}

function jsonError(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

function corsError(message: string, origin: string | null, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    },
  });
}
