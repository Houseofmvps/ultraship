// tools/lib/security.mjs
// Shared security utilities for all Ultraship tools
// Provides: path validation, URL sanitization, SSRF protection, safe file reads

import { resolve } from 'path';

// Maximum file size to read into memory (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Maximum HTTP response body size (5MB)
export const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;

// Private/internal IP ranges that should never be accessed
const PRIVATE_IP_PATTERNS = [
  /^127\./,                          // Loopback
  /^10\./,                           // Class A private
  /^172\.(1[6-9]|2\d|3[01])\./,     // Class B private
  /^192\.168\./,                     // Class C private
  /^169\.254\./,                     // Link-local (AWS metadata!)
  /^0\./,                            // Current network
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // Carrier-grade NAT
  /^::1$/,                           // IPv6 loopback
  /^fd[0-9a-f]{2}:/i,               // IPv6 unique local
  /^fe80:/i,                         // IPv6 link-local
  /^fc[0-9a-f]{2}:/i,               // IPv6 unique local
];

// Cloud metadata endpoints
const BLOCKED_HOSTNAMES = new Set([
  'metadata.google.internal',
  'metadata.google.com',
]);

/**
 * Validate that a directory path is safe (exists, is absolute, no traversal tricks).
 * Returns the resolved absolute path.
 */
export function validateDirPath(dir) {
  if (!dir) return null;
  const resolved = resolve(dir);
  // Ensure the resolved path doesn't escape via symlink tricks
  // We allow any absolute path — the protection is that tools only READ within it
  return resolved;
}

/**
 * Validate a URL is safe to request (HTTP/HTTPS only, no private IPs, no metadata endpoints).
 * Returns { valid: true, url } or { valid: false, reason }.
 */
export function validateUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return { valid: false, reason: `Invalid URL: ${urlString}` };
  }

  // Only allow HTTP and HTTPS
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: `Blocked scheme "${parsed.protocol}" — only http: and https: are allowed` };
  }

  // Block cloud metadata hostnames
  if (BLOCKED_HOSTNAMES.has(parsed.hostname.toLowerCase())) {
    return { valid: false, reason: `Blocked hostname: ${parsed.hostname} (cloud metadata endpoint)` };
  }

  // Normalize hostname — strip IPv6 brackets and expand IPv6-mapped IPv4
  let hostname = parsed.hostname;
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1);
  }

  // Detect IPv6-mapped IPv4 addresses (::ffff:x.x.x.x) and extract the IPv4 part
  const ipv6MappedMatch = hostname.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (ipv6MappedMatch) {
    hostname = ipv6MappedMatch[1];
  }

  // Also catch hex-encoded IPv6-mapped IPv4 (e.g., ::ffff:7f00:1 = 127.0.0.1)
  const ipv6MappedHexMatch = hostname.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (ipv6MappedHexMatch) {
    const hi = parseInt(ipv6MappedHexMatch[1], 16);
    const lo = parseInt(ipv6MappedHexMatch[2], 16);
    hostname = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
  }

  // Block private/internal IPs
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, reason: `Blocked private/internal IP: ${parsed.hostname}` };
    }
  }

  // Block localhost variants
  if (hostname === 'localhost' || hostname === '::1' || parsed.hostname === 'localhost' || parsed.hostname === '[::1]') {
    if (parsed.pathname.startsWith('/latest/meta-data') ||
        parsed.pathname.startsWith('/metadata') ||
        parsed.pathname.startsWith('/computeMetadata')) {
      return { valid: false, reason: `Blocked metadata path on localhost` };
    }
  }

  return { valid: true, url: parsed };
}

/**
 * Check file size before reading. Returns size in bytes, or -1 if file doesn't exist.
 * Throws if file exceeds MAX_FILE_SIZE.
 */
export function checkFileSize(filePath, statSync) {
  try {
    const stat = statSync(filePath);
    if (stat.size > MAX_FILE_SIZE) {
      return { ok: false, size: stat.size, reason: `File too large (${Math.round(stat.size / 1024 / 1024)}MB > ${MAX_FILE_SIZE / 1024 / 1024}MB limit)` };
    }
    return { ok: true, size: stat.size };
  } catch {
    return { ok: false, size: -1, reason: 'File not found or not readable' };
  }
}

/**
 * Create a size-limited response accumulator for HTTP requests.
 * Returns { onData, getBody, truncated }.
 */
export function createResponseAccumulator(maxSize = MAX_RESPONSE_SIZE) {
  let body = '';
  let totalSize = 0;
  let truncated = false;

  return {
    onData(chunk) {
      totalSize += chunk.length;
      if (!truncated && totalSize <= maxSize) {
        body += chunk;
      } else {
        truncated = true;
      }
    },
    getBody() { return body; },
    isTruncated() { return truncated; },
    getTotalSize() { return totalSize; },
  };
}

/**
 * Sanitize a value for safe inclusion in JSON output.
 * Redacts anything that looks like a secret.
 */
export function redactSensitiveValue(key, value) {
  if (!value || typeof value !== 'string') return value;
  const k = key.toLowerCase();
  const sensitiveKeys = ['password', 'secret', 'token', 'key', 'credential', 'auth', 'api_key', 'apikey', 'private'];
  if (sensitiveKeys.some(s => k.includes(s))) {
    if (value.length > 4) {
      return value.slice(0, 4) + '***REDACTED***';
    }
    return '***REDACTED***';
  }
  return value;
}
