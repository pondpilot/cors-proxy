/**
 * PondPilot CORS Proxy - Self-Hosted Node.js Server
 *
 * A transparent CORS proxy that enables browser-based access to remote files
 * without CORS headers. Designed for PondPilot to access public data sources.
 *
 * Privacy: No logging, no data retention, no tracking
 * Security: Origin validation, rate limiting, SSRF protection, domain allowlisting
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import {
  validateTargetUrl,
  validateResponse,
  parseAllowedDomains,
  DEFAULT_ALLOWED_DOMAINS,
} from '../shared/security.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const config = {
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'https://app.pondpilot.io,http://localhost:5173')
    .split(',')
    .map(o => o.trim()),
  rateLimitRequests: parseInt(process.env.RATE_LIMIT_REQUESTS || '60'),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
  maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '500'),
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '30000'), // 30 seconds
  httpsOnly: process.env.HTTPS_ONLY === 'false' ? false : true,
  allowedProtocols: process.env.HTTPS_ONLY === 'false' ? ['https:', 'http:'] : ['https:'],
  allowedDomains: parseAllowedDomains(process.env.ALLOWED_DOMAINS || ''),
  allowCredentials: process.env.ALLOW_CREDENTIALS === 'true',
};

console.log('Configuration:', {
  allowedOrigins: config.allowedOrigins,
  rateLimitRequests: config.rateLimitRequests,
  maxFileSizeMB: config.maxFileSizeMB,
  requestTimeoutMs: config.requestTimeoutMs,
  httpsOnly: config.httpsOnly,
  allowedDomainsCount: config.allowedDomains.length,
  port: PORT,
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests) in development
    if (!origin && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    if (origin && config.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Range'],
  exposedHeaders: ['Content-Length', 'Content-Range', 'Content-Type', 'Accept-Ranges', 'ETag', 'Last-Modified'],
  credentials: config.allowCredentials,
  maxAge: 86400,
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitRequests,
  message: { error: 'Rate limit exceeded. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/proxy', limiter);

// Request logging (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`, {
      origin: req.headers.origin,
      ip: req.ip,
    });
    next();
  });
}

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'pondpilot-cors-proxy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Info endpoint
app.get(['/', '/info'], (req: Request, res: Response) => {
  res.json({
    service: 'PondPilot CORS Proxy (Self-Hosted)',
    version: '2.1.0',
    usage: 'GET /proxy?url=<encoded-url>',
    privacy: 'No logging, no data retention',
    security: 'SSRF protection, domain allowlisting, HTTPS enforcement',
    source: 'https://github.com/pondpilot/cors-proxy',
    config: {
      allowedOrigins: config.allowedOrigins,
      rateLimitRequests: config.rateLimitRequests,
      maxFileSizeMB: config.maxFileSizeMB,
      httpsOnly: config.httpsOnly,
      allowedDomainsCount: config.allowedDomains.length,
      usingDefaultAllowlist: !process.env.ALLOWED_DOMAINS,
    },
  });
});

// Proxy endpoint
app.get('/proxy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetUrl = req.query.url as string;

    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    // Validate URL with SSRF protection
    const validation = validateTargetUrl(targetUrl, {
      allowedDomains: config.allowedDomains,
      allowedProtocols: config.allowedProtocols,
      httpsOnly: config.httpsOnly,
      maxFileSizeMB: config.maxFileSizeMB,
    });

    if (!validation.valid) {
      return res.status(403).json({ error: validation.error });
    }

    // Fetch the resource with timeout and no redirect following
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

    let fetchResponse: globalThis.Response;
    try {
      // Prepare headers for upstream request
      const upstreamHeaders: Record<string, string> = {
        'User-Agent': 'PondPilot-CORS-Proxy/2.1',
      };

      // Forward Range header if present (required for DuckDB random-access reads)
      const rangeHeader = req.headers.range;
      if (rangeHeader) {
        upstreamHeaders['Range'] = rangeHeader;
      }

      fetchResponse = await fetch(targetUrl, {
        method: req.method,
        headers: upstreamHeaders,
        redirect: 'manual', // Critical: Prevent redirects to internal IPs
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    // Validate response (check for redirects, file size)
    const responseValidation = validateResponse(fetchResponse, config.maxFileSizeMB);
    if (!responseValidation.valid) {
      return res.status(400).json({ error: responseValidation.error });
    }

    const maxBytes = config.maxFileSizeMB * 1024 * 1024;
    let transferred = 0;
    let startedStreaming = false;

    // Copy headers (excluding content-length to avoid mismatch on abort)
    const headersToForward = [
      'content-type',
      'content-range',
      'accept-ranges',
      'etag',
      'last-modified',
    ];

    headersToForward.forEach(header => {
      const value = fetchResponse.headers.get(header);
      if (value) {
        res.setHeader(header, value);
      }
    });

    // Add proxy headers
    res.setHeader('X-Proxy-By', 'PondPilot-CORS-Proxy');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // Set status
    res.status(fetchResponse.status);

    // Stream the response
    if (fetchResponse.body) {
      const reader = fetchResponse.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (!value) {
          continue;
        }

        if (transferred + value.byteLength > maxBytes) {
          await reader.cancel('File too large');
          console.warn(`Aborting response over size limit from ${targetUrl}`, {
            limitMB: config.maxFileSizeMB,
            transferredMB: (transferred / (1024 * 1024)).toFixed(1),
          });

          if (!startedStreaming) {
            headersToForward.forEach(header => res.removeHeader(header));
            res.setHeader('Cache-Control', 'no-store');
            return res.status(413).json({
              error: `File too large (${((transferred + value.byteLength) / (1024 * 1024)).toFixed(1)}MB exceeds limit of ${config.maxFileSizeMB}MB)`,
            });
          }

          res.setHeader('Connection', 'close');
          res.destroy(new Error('File too large'));
          return;
        }

        transferred += value.byteLength;
        res.write(value);
        startedStreaming = true;
      }
      res.end();
    } else {
      res.end();
    }

  } catch (error) {
    // Handle timeout errors
    if (error instanceof Error && error.name === 'AbortError') {
      return res.status(504).json({
        error: 'Request timeout - the remote server took too long to respond',
      });
    }

    console.error('Proxy error:', error);
    res.status(502).json({
      error: `Failed to fetch resource: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found. Use /proxy?url=<encoded-url>',
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err.message);

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 PondPilot CORS Proxy running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔒 Allowed origins:`, config.allowedOrigins);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
