import { describe, it, expect } from 'vitest';
import {
  isPrivateIP,
  isAllowedDomain,
  validateTargetUrl,
  parseAllowedDomains,
  validateResponse,
  DEFAULT_ALLOWED_DOMAINS,
  type SecurityConfig,
} from '../shared/security';

describe('isPrivateIP', () => {
  it('should block localhost', () => {
    expect(isPrivateIP('localhost')).toBe(true);
    expect(isPrivateIP('LOCALHOST')).toBe(true);
  });

  it('should block 0.0.0.0', () => {
    expect(isPrivateIP('0.0.0.0')).toBe(true);
  });

  it('should block loopback addresses', () => {
    expect(isPrivateIP('127.0.0.1')).toBe(true);
    expect(isPrivateIP('127.0.0.255')).toBe(true);
    expect(isPrivateIP('::1')).toBe(true);
  });

  it('should block private IPv4 ranges', () => {
    expect(isPrivateIP('10.0.0.1')).toBe(true);
    expect(isPrivateIP('172.16.0.1')).toBe(true);
    expect(isPrivateIP('172.31.255.255')).toBe(true);
    expect(isPrivateIP('192.168.1.1')).toBe(true);
  });

  it('should block link-local addresses', () => {
    expect(isPrivateIP('169.254.0.1')).toBe(true);
  });

  it('should block IPv6 private ranges', () => {
    expect(isPrivateIP('fe80::1')).toBe(true);
    expect(isPrivateIP('fc00::1')).toBe(true);
    expect(isPrivateIP('fd00::1')).toBe(true);
  });

  it('should block cloud metadata services', () => {
    expect(isPrivateIP('metadata.google.internal')).toBe(true);
  });

  it('should allow public IPs', () => {
    expect(isPrivateIP('8.8.8.8')).toBe(false);
    expect(isPrivateIP('1.1.1.1')).toBe(false);
    expect(isPrivateIP('example.com')).toBe(false);
    expect(isPrivateIP('s3.amazonaws.com')).toBe(false);
  });
});

describe('isAllowedDomain', () => {
  const testPatterns = [
    /^example\.com$/,
    /^[^.]*\.example\.com$/,
    /^s3\.amazonaws\.com$/,
  ];

  it('should match exact domain', () => {
    expect(isAllowedDomain('example.com', testPatterns)).toBe(true);
    expect(isAllowedDomain('EXAMPLE.COM', testPatterns)).toBe(true);
  });

  it('should match wildcard subdomain', () => {
    expect(isAllowedDomain('api.example.com', testPatterns)).toBe(true);
    expect(isAllowedDomain('test.example.com', testPatterns)).toBe(true);
  });

  it('should not match multi-level subdomain with single wildcard', () => {
    expect(isAllowedDomain('api.test.example.com', testPatterns)).toBe(false);
  });

  it('should not match unallowed domains', () => {
    expect(isAllowedDomain('evil.com', testPatterns)).toBe(false);
    expect(isAllowedDomain('example.org', testPatterns)).toBe(false);
  });
});

describe('parseAllowedDomains', () => {
  // Note: validatePatternComplexity is tested indirectly through these tests
  it('should return default domains for empty string', () => {
    expect(parseAllowedDomains('')).toEqual(DEFAULT_ALLOWED_DOMAINS);
    expect(parseAllowedDomains('   ')).toEqual(DEFAULT_ALLOWED_DOMAINS);
    expect(parseAllowedDomains(undefined)).toEqual(DEFAULT_ALLOWED_DOMAINS);
  });

  it('should parse single domain', () => {
    const patterns = parseAllowedDomains('example.com');
    expect(patterns).toHaveLength(1);
    expect(patterns[0].test('example.com')).toBe(true);
    expect(patterns[0].test('EXAMPLE.COM')).toBe(true);
    expect(patterns[0].test('test.example.com')).toBe(false);
  });

  it('should parse multiple domains', () => {
    const patterns = parseAllowedDomains('example.com,test.org,api.dev');
    expect(patterns).toHaveLength(3);
  });

  it('should handle wildcards correctly', () => {
    const patterns = parseAllowedDomains('*.example.com');
    expect(patterns[0].test('api.example.com')).toBe(true);
    expect(patterns[0].test('test.example.com')).toBe(true);
    expect(patterns[0].test('api.test.example.com')).toBe(false);
  });

  it('should escape special regex characters', () => {
    const patterns = parseAllowedDomains('api.example.com');
    // Should match exactly, not as a regex where . matches any character
    expect(patterns[0].test('api.example.com')).toBe(true);
    expect(patterns[0].test('apiXexampleXcom')).toBe(false);
  });

  it('should skip invalid patterns', () => {
    const patterns = parseAllowedDomains('valid.com,****,good.org');
    expect(patterns.length).toBeGreaterThanOrEqual(2);
  });

  it('should trim whitespace', () => {
    const patterns = parseAllowedDomains('  example.com  ,  test.org  ');
    expect(patterns).toHaveLength(2);
    expect(patterns[0].test('example.com')).toBe(true);
  });
});

describe('validateTargetUrl', () => {
  const baseConfig: SecurityConfig = {
    allowedDomains: [/^example\.com$/, /^.*\.s3\.amazonaws\.com$/],
    allowedProtocols: ['https:', 'http:'],
    httpsOnly: false,
  };

  it('should accept valid URLs', () => {
    const result = validateTargetUrl('https://example.com/file.csv', baseConfig);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid URL format', () => {
    const result = validateTargetUrl('not-a-url', baseConfig);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid URL');
  });

  it('should reject disallowed protocols', () => {
    const config = { ...baseConfig, allowedProtocols: ['https:'] };
    const result = validateTargetUrl('ftp://example.com/file', config);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Protocol');
  });

  it('should enforce HTTPS-only when configured', () => {
    const config = { ...baseConfig, httpsOnly: true };
    const result = validateTargetUrl('http://example.com/file', config);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('HTTPS');
  });

  it('should block private IPs', () => {
    const result = validateTargetUrl('https://localhost/file', baseConfig);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('private');
  });

  it('should block domains not in allowlist', () => {
    const result = validateTargetUrl('https://evil.com/file', baseConfig);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('allowlist');
  });

  it('should allow domains in allowlist', () => {
    const result = validateTargetUrl('https://bucket.s3.amazonaws.com/file', baseConfig);
    expect(result.valid).toBe(true);
  });
});

describe('validateResponse', () => {
  it('should accept valid response', () => {
    const response = new Response('test', {
      status: 200,
      headers: { 'Content-Length': '1000' },
    });
    const result = validateResponse(response, 1);
    expect(result.valid).toBe(true);
  });

  it('should reject redirects', () => {
    const response = new Response(null, { status: 301 });
    const result = validateResponse(response, 1);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Redirect');
  });

  it('should reject files that are too large', () => {
    const response = new Response('test', {
      status: 200,
      headers: { 'Content-Length': String(10 * 1024 * 1024) }, // 10MB
    });
    const result = validateResponse(response, 5); // 5MB limit
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too large');
  });

  it('should accept response without Content-Length', () => {
    const response = new Response('test', { status: 200 });
    const result = validateResponse(response, 1);
    expect(result.valid).toBe(true);
  });
});
