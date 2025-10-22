/**
 * PondPilot CORS Proxy - Self-Hosted Node.js Server
 *
 * A transparent CORS proxy that enables browser-based access to remote files
 * without CORS headers. Designed for PondPilot to access public data sources.
 *
 * Privacy: No logging, no data retention, no tracking
 * Security: Origin validation, rate limiting, URL filtering
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

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
  allowedProtocols: ['https:', 'http:'],
  blockedDomains: (process.env.BLOCKED_DOMAINS || '')
    .split(',')
    .map(d => d.trim())
    .filter(d => d.length > 0),
};

console.log('Configuration:', {
  ...config,
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
  exposedHeaders: ['Content-Length', 'Content-Range', 'Content-Type'],
  credentials: false,
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
    version: '1.0.0',
    usage: 'GET /proxy?url=<encoded-url>',
    privacy: 'No logging, no data retention',
    source: 'https://github.com/yourusername/cors-proxy',
    config: {
      allowedOrigins: config.allowedOrigins,
      rateLimitRequests: config.rateLimitRequests,
      maxFileSizeMB: config.maxFileSizeMB,
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

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // Check protocol
    if (!config.allowedProtocols.includes(parsedUrl.protocol)) {
      return res.status(400).json({
        error: `Protocol ${parsedUrl.protocol} not allowed`,
      });
    }

    // Check blocked domains
    if (config.blockedDomains.some(domain => parsedUrl.hostname.endsWith(domain))) {
      return res.status(403).json({ error: 'Domain is blocked' });
    }

    // Fetch the resource
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'User-Agent': 'PondPilot-CORS-Proxy/1.0',
      },
    });

    // Check file size
    const contentLength = response.headers.get('Content-Length');
    if (contentLength) {
      const sizeMB = parseInt(contentLength) / (1024 * 1024);
      if (sizeMB > config.maxFileSizeMB) {
        return res.status(413).json({
          error: `File too large (${sizeMB.toFixed(1)}MB > ${config.maxFileSizeMB}MB)`,
        });
      }
    }

    // Copy headers
    const headersToForward = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'etag',
      'last-modified',
    ];

    headersToForward.forEach(header => {
      const value = response.headers.get(header);
      if (value) {
        res.setHeader(header, value);
      }
    });

    // Add proxy headers
    res.setHeader('X-Proxy-By', 'PondPilot-CORS-Proxy');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // Set status
    res.status(response.status);

    // Stream the response
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } else {
      res.end();
    }

  } catch (error) {
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
