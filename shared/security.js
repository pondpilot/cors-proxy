"use strict";
/**
 * Shared Security Utilities for CORS Proxy
 *
 * Implements SSRF protection through:
 * - Private IP blocking
 * - Domain allowlisting
 * - Protocol validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ALLOWED_DOMAINS = void 0;
exports.isPrivateIP = isPrivateIP;
exports.isAllowedDomain = isAllowedDomain;
exports.validateTargetUrl = validateTargetUrl;
exports.parseAllowedDomains = parseAllowedDomains;
exports.validateResponse = validateResponse;
// Common private/internal IP ranges that should never be accessed
const PRIVATE_IP_PATTERNS = [
    /^127\./, // 127.0.0.0/8 - Loopback
    /^10\./, // 10.0.0.0/8 - Private
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12 - Private
    /^192\.168\./, // 192.168.0.0/16 - Private
    /^169\.254\./, // 169.254.0.0/16 - Link-local (AWS metadata!)
    /^0\./, // 0.0.0.0/8 - Current network
    /^224\./, // 224.0.0.0/4 - Multicast
    /^240\./, // 240.0.0.0/4 - Reserved
    /^255\.255\.255\.255$/, // Broadcast
    /^::1$/, // IPv6 loopback
    /^fe80:/, // IPv6 link-local
    /^fc00:/, // IPv6 private
    /^fd00:/, // IPv6 private
];
// Reserved/dangerous hostnames
const BLOCKED_HOSTNAMES = [
    'localhost',
    '0.0.0.0',
    'metadata.google.internal', // GCP metadata
    'kubernetes',
    'kubernetes.default',
];
/**
 * Default allowed domain patterns for public data sources
 * These are common sources for public datasets, CSV files, etc.
 */
exports.DEFAULT_ALLOWED_DOMAINS = [
    // AWS S3 (public buckets)
    /^.*\.s3\.amazonaws\.com$/,
    /^.*\.s3\..*\.amazonaws\.com$/,
    /^s3\.amazonaws\.com$/,
    /^s3\..*\.amazonaws\.com$/,
    // CloudFront CDN
    /^d[0-9a-z]+\.cloudfront\.net$/,
    // GitHub
    /^.*\.github\.io$/,
    /^.*\.githubusercontent\.com$/,
    /^raw\.githubusercontent\.com$/,
    // Google Cloud Storage (public buckets)
    /^storage\.googleapis\.com$/,
    /^.*\.storage\.googleapis\.com$/,
    // Azure Blob Storage (public containers)
    /^.*\.blob\.core\.windows\.net$/,
    // Public open-data portals
    /^data\.gov$/,
    /^.*\.data\.gov$/,
    /^data\.gouv\.fr$/,
    /^.*\.data\.gouv\.fr$/,
];
/**
 * Check if hostname is a private/internal IP address
 */
function isPrivateIP(hostname) {
    // Check blocked hostnames
    if (BLOCKED_HOSTNAMES.includes(hostname.toLowerCase())) {
        return true;
    }
    // Check against private IP patterns
    return PRIVATE_IP_PATTERNS.some(pattern => pattern.test(hostname));
}
/**
 * Check if domain matches allowlist
 */
function isAllowedDomain(hostname, allowedDomains) {
    const lowerHostname = hostname.toLowerCase();
    return allowedDomains.some(pattern => pattern.test(lowerHostname));
}
/**
 * Parse and validate a target URL for SSRF protection
 */
function validateTargetUrl(targetUrl, config) {
    // Parse URL
    let parsed;
    try {
        parsed = new URL(targetUrl);
    }
    catch (e) {
        return { valid: false, error: 'Invalid URL format' };
    }
    // Validate protocol
    const allowedProtocols = config.allowedProtocols || ['https:', 'http:'];
    if (!allowedProtocols.includes(parsed.protocol)) {
        return {
            valid: false,
            error: `Protocol ${parsed.protocol} not allowed. Allowed: ${allowedProtocols.join(', ')}`,
        };
    }
    // HTTPS-only check for production
    if (config.httpsOnly && parsed.protocol !== 'https:') {
        return {
            valid: false,
            error: 'Only HTTPS URLs are allowed',
        };
    }
    // Block private/internal IPs
    if (isPrivateIP(parsed.hostname)) {
        return {
            valid: false,
            error: 'Access to private/internal IP addresses is not allowed',
        };
    }
    // Check domain allowlist
    const allowedDomains = config.allowedDomains || exports.DEFAULT_ALLOWED_DOMAINS;
    if (!isAllowedDomain(parsed.hostname, allowedDomains)) {
        return {
            valid: false,
            error: `Domain ${parsed.hostname} is not in the allowlist. Only trusted public data sources are allowed.`,
        };
    }
    return { valid: true };
}
/**
 * Validate pattern for ReDoS protection
 */
function validatePatternComplexity(pattern) {
    // Check pattern length to prevent excessive memory use
    const MAX_PATTERN_LENGTH = 100;
    if (pattern.length > MAX_PATTERN_LENGTH) {
        return { valid: false, reason: `pattern too long (max ${MAX_PATTERN_LENGTH} chars)` };
    }
    // Check wildcard count to prevent exponential backtracking
    const MAX_WILDCARDS = 3;
    const wildcardCount = (pattern.match(/\*/g) || []).length;
    if (wildcardCount > MAX_WILDCARDS) {
        return { valid: false, reason: `too many wildcards (max ${MAX_WILDCARDS})` };
    }
    // Check for suspicious patterns that could cause ReDoS
    const dangerousPatterns = [
        /(\*\.?){2,}/, // Multiple consecutive wildcards
        /\*\*+/, // Multiple asterisks
    ];
    for (const dangerous of dangerousPatterns) {
        if (dangerous.test(pattern)) {
            return { valid: false, reason: 'suspicious pattern detected' };
        }
    }
    return { valid: true };
}
/**
 * Parse domain patterns from environment variable string
 * Format: "s3.amazonaws.com,*.cloudfront.net,github.io"
 *
 * Implements ReDoS protection through:
 * - Pattern length limits
 * - Wildcard count limits
 * - Proper escaping of special characters
 */
function parseAllowedDomains(domainsString) {
    if (!domainsString || domainsString.trim() === '') {
        return exports.DEFAULT_ALLOWED_DOMAINS;
    }
    const patterns = domainsString
        .split(',')
        .map(d => d.trim())
        .filter(d => d.length > 0)
        .map(pattern => {
        // Validate pattern complexity for ReDoS protection
        const validation = validatePatternComplexity(pattern);
        if (!validation.valid) {
            console.warn(`Ignoring invalid domain pattern "${pattern}":`, validation.reason);
            return null;
        }
        // Convert wildcard pattern to regex with proper escaping
        // *.example.com -> ^[^.]*\.example\.com$
        // example.com -> ^example\.com$
        // Escape all special regex characters except *
        const escaped = pattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
            .replace(/\*/g, '[^.]*'); // Convert * to [^.]* (safe wildcard, no dots)
        try {
            return new RegExp(`^${escaped}$`, 'i');
        }
        catch (error) {
            console.warn('Ignoring invalid domain pattern:', pattern, error);
            return null;
        }
    })
        .filter((pattern) => pattern !== null);
    return patterns.length > 0 ? patterns : exports.DEFAULT_ALLOWED_DOMAINS;
}
/**
 * Validate response before streaming (check for redirects, validate headers)
 */
function validateResponse(response, maxFileSizeMB) {
    // Block redirects (SSRF protection - prevents redirect to internal IPs)
    if (response.status >= 300 && response.status < 400) {
        return {
            valid: false,
            error: 'Redirects are not supported for security reasons',
        };
    }
    // Check file size
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
//# sourceMappingURL=security.js.map