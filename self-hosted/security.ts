/**
 * Security Utilities for CORS Proxy (Self-Hosted)
 *
 * Implements SSRF protection through:
 * - Private IP blocking
 * - Domain allowlisting
 * - Protocol validation
 */

// Common private/internal IP ranges that should never be accessed
const PRIVATE_IP_PATTERNS = [
  /^127\./,                    // 127.0.0.0/8 - Loopback
  /^10\./,                     // 10.0.0.0/8 - Private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12 - Private
  /^192\.168\./,               // 192.168.0.0/16 - Private
  /^169\.254\./,               // 169.254.0.0/16 - Link-local (AWS metadata!)
  /^0\./,                      // 0.0.0.0/8 - Current network
  /^224\./,                    // 224.0.0.0/4 - Multicast
  /^240\./,                    // 240.0.0.0/4 - Reserved
  /^255\.255\.255\.255$/,      // Broadcast
  /^::1$/,                     // IPv6 loopback
  /^fe80:/,                    // IPv6 link-local
  /^fc00:/,                    // IPv6 private
  /^fd00:/,                    // IPv6 private
];

// Reserved/dangerous hostnames
const BLOCKED_HOSTNAMES = [
  'localhost',
  '0.0.0.0',
  'metadata.google.internal',  // GCP metadata
  'kubernetes',
  'kubernetes.default',
];

/**
 * Default allowed domain patterns for public data sources
 */
export const DEFAULT_ALLOWED_DOMAINS = [
  // AWS S3 (public buckets)
  /^.*\.s3\.amazonaws\.com$/,
  /^.*\.s3\..*\.amazonaws\.com$/,
  /^s3\.amazonaws\.com$/,
  /^s3\..*\.amazonaws\.com$/,

  // CloudFront CDN
  /^.*\.cloudfront\.net$/,

  // GitHub
  /^.*\.github\.io$/,
  /^.*\.githubusercontent\.com$/,
  /^raw\.githubusercontent\.com$/,

  // Google Cloud Storage (public buckets)
  /^storage\.googleapis\.com$/,
  /^.*\.storage\.googleapis\.com$/,

  // Azure Blob Storage (public containers)
  /^.*\.blob\.core\.windows\.net$/,

  // Common CDNs
  /^.*\.cdn\..*$/,
  /^cdn\..*$/,

  // Data repositories
  /^data\..*$/,
  /^datasets\..*$/,
  /^download\..*$/,
];

export interface SecurityConfig {
  allowedDomains?: RegExp[];
  allowedProtocols?: string[];
  httpsOnly?: boolean;
  maxFileSizeMB?: number;
  requestTimeoutMs?: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Check if hostname is a private/internal IP address
 */
export function isPrivateIP(hostname: string): boolean {
  if (BLOCKED_HOSTNAMES.includes(hostname.toLowerCase())) {
    return true;
  }
  return PRIVATE_IP_PATTERNS.some(pattern => pattern.test(hostname));
}

/**
 * Check if domain matches allowlist
 */
export function isAllowedDomain(hostname: string, allowedDomains: RegExp[]): boolean {
  const lowerHostname = hostname.toLowerCase();
  return allowedDomains.some(pattern => pattern.test(lowerHostname));
}

/**
 * Parse and validate a target URL for SSRF protection
 */
export function validateTargetUrl(
  targetUrl: string,
  config: SecurityConfig
): ValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch (e) {
    return { valid: false, error: 'Invalid URL format' };
  }

  const allowedProtocols = config.allowedProtocols || ['https:', 'http:'];
  if (!allowedProtocols.includes(parsed.protocol)) {
    return {
      valid: false,
      error: `Protocol ${parsed.protocol} not allowed. Allowed: ${allowedProtocols.join(', ')}`,
    };
  }

  if (config.httpsOnly && parsed.protocol !== 'https:') {
    return {
      valid: false,
      error: 'Only HTTPS URLs are allowed',
    };
  }

  if (isPrivateIP(parsed.hostname)) {
    return {
      valid: false,
      error: 'Access to private/internal IP addresses is not allowed',
    };
  }

  const allowedDomains = config.allowedDomains || DEFAULT_ALLOWED_DOMAINS;
  if (!isAllowedDomain(parsed.hostname, allowedDomains)) {
    return {
      valid: false,
      error: `Domain ${parsed.hostname} is not in the allowlist. Only trusted public data sources are allowed.`,
    };
  }

  return { valid: true };
}

/**
 * Parse domain patterns from environment variable string
 */
export function parseAllowedDomains(domainsString: string): RegExp[] {
  if (!domainsString || domainsString.trim() === '') {
    return DEFAULT_ALLOWED_DOMAINS;
  }

  return domainsString
    .split(',')
    .map(d => d.trim())
    .filter(d => d.length > 0)
    .map(pattern => {
      const escaped = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
      return new RegExp(`^${escaped}$`, 'i');
    });
}

/**
 * Validate response before streaming
 */
export function validateResponse(
  response: Response,
  maxFileSizeMB: number
): ValidationResult {
  if (response.status >= 300 && response.status < 400) {
    return {
      valid: false,
      error: 'Redirects are not supported for security reasons',
    };
  }

  const contentLength = response.headers.get('Content-Length');
  if (contentLength) {
    const sizeMB = parseInt(contentLength) / (1024 * 1024);
    if (sizeMB > maxFileSizeMB) {
      return {
        valid: false,
        error: `File too large (${sizeMB.toFixed(1)}MB exceeds limit of ${maxFileSizeMB}MB)`,
      };
    }
  }

  return { valid: true };
}
