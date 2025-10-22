/**
 * Shared Security Utilities for CORS Proxy
 *
 * Implements SSRF protection through:
 * - Private IP blocking
 * - Domain allowlisting
 * - Protocol validation
 */
/**
 * Default allowed domain patterns for public data sources
 * These are common sources for public datasets, CSV files, etc.
 */
export declare const DEFAULT_ALLOWED_DOMAINS: RegExp[];
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
export declare function isPrivateIP(hostname: string): boolean;
/**
 * Check if domain matches allowlist
 */
export declare function isAllowedDomain(hostname: string, allowedDomains: RegExp[]): boolean;
/**
 * Parse and validate a target URL for SSRF protection
 */
export declare function validateTargetUrl(targetUrl: string, config: SecurityConfig): ValidationResult;
/**
 * Parse domain patterns from environment variable string
 * Format: "s3.amazonaws.com,*.cloudfront.net,github.io"
 *
 * Implements ReDoS protection through:
 * - Pattern length limits
 * - Wildcard count limits
 * - Proper escaping of special characters
 */
export declare function parseAllowedDomains(domainsString: string): RegExp[];
/**
 * Validate response before streaming (check for redirects, validate headers)
 */
export declare function validateResponse(response: Response, maxFileSizeMB: number): ValidationResult;
//# sourceMappingURL=security.d.ts.map