/**
 * PondPilot CORS Proxy - Cloudflare Worker
 *
 * A transparent CORS proxy that enables browser-based access to remote files
 * without CORS headers. Designed for PondPilot to access public data sources.
 *
 * Privacy: No logging, no data retention, no tracking
 * Security: Origin validation, rate limiting, URL filtering
 */

interface Env {
  RATE_LIMITER: RateLimiterNamespace;
  ALLOWED_ORIGINS?: string;
  RATE_LIMIT_REQUESTS?: string;
  MAX_FILE_SIZE_MB?: string;
  BLOCKED_DOMAINS?: string;
}

const DEFAULT_CONFIG = {
  allowedOrigins: ['https://app.pondpilot.io', 'http://localhost:5173', 'http://localhost:3000'],
  rateLimitRequests: 60, // per minute
  maxFileSizeMB: 500,
  allowedProtocols: ['https:', 'http:'],
  blockedDomains: [] as string[],
};

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
      return jsonResponse({
        service: 'PondPilot CORS Proxy',
        version: '1.0.0',
        usage: 'GET /proxy?url=<encoded-url>',
        privacy: 'No logging, no data retention',
        source: 'https://github.com/yourusername/cors-proxy',
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

  // Validate target URL
  let parsedTarget: URL;
  try {
    parsedTarget = new URL(targetUrl);
  } catch (e) {
    return corsError('Invalid URL', origin, 400);
  }

  // Check protocol
  if (!config.allowedProtocols.includes(parsedTarget.protocol)) {
    return corsError(`Protocol ${parsedTarget.protocol} not allowed`, origin, 400);
  }

  // Check blocked domains
  if (config.blockedDomains.some(domain => parsedTarget.hostname.endsWith(domain))) {
    return corsError('Domain is blocked', origin, 403);
  }

  // Fetch the resource
  try {
    const targetResponse = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'User-Agent': 'PondPilot-CORS-Proxy/1.0',
      },
      // Use Cloudflare's cache
      cf: {
        cacheEverything: true,
        cacheTtl: 3600,
      },
    });

    // Check file size
    const contentLength = targetResponse.headers.get('Content-Length');
    if (contentLength) {
      const sizeMB = parseInt(contentLength) / (1024 * 1024);
      if (sizeMB > config.maxFileSizeMB) {
        return corsError(`File too large (${sizeMB.toFixed(1)}MB > ${config.maxFileSizeMB}MB)`, origin, 413);
      }
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
    allowedProtocols: DEFAULT_CONFIG.allowedProtocols,
    blockedDomains: env.BLOCKED_DOMAINS
      ? env.BLOCKED_DOMAINS.split(',').map(d => d.trim())
      : DEFAULT_CONFIG.blockedDomains,
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
