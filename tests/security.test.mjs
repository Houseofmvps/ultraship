import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateUrl, checkFileSize, createResponseAccumulator, redactSensitiveValue, MAX_RESPONSE_SIZE } from '../tools/lib/security.mjs';

describe('validateUrl', () => {
  it('allows public HTTPS URLs', () => {
    const r = validateUrl('https://example.com');
    assert.equal(r.valid, true);
  });

  it('allows public HTTP URLs', () => {
    const r = validateUrl('http://example.com');
    assert.equal(r.valid, true);
  });

  it('blocks FTP scheme', () => {
    const r = validateUrl('ftp://example.com');
    assert.equal(r.valid, false);
    assert.match(r.reason, /Blocked scheme/);
  });

  it('blocks file:// scheme', () => {
    const r = validateUrl('file:///etc/passwd');
    assert.equal(r.valid, false);
  });

  it('blocks AWS metadata IP (169.254.169.254)', () => {
    const r = validateUrl('http://169.254.169.254/latest/meta-data');
    assert.equal(r.valid, false);
    assert.match(r.reason, /private|internal/i);
  });

  it('blocks localhost (127.0.0.1)', () => {
    const r = validateUrl('http://127.0.0.1/admin');
    assert.equal(r.valid, false);
  });

  it('blocks 10.x private range', () => {
    const r = validateUrl('http://10.0.0.1');
    assert.equal(r.valid, false);
  });

  it('blocks 192.168.x private range', () => {
    const r = validateUrl('http://192.168.1.1');
    assert.equal(r.valid, false);
  });

  it('blocks 172.16.x private range', () => {
    const r = validateUrl('http://172.16.0.1');
    assert.equal(r.valid, false);
  });

  it('blocks Google cloud metadata hostname', () => {
    const r = validateUrl('http://metadata.google.internal');
    assert.equal(r.valid, false);
    assert.match(r.reason, /cloud metadata/);
  });

  it('returns invalid for garbage input', () => {
    const r = validateUrl('not-a-url');
    assert.equal(r.valid, false);
    assert.match(r.reason, /Invalid URL/);
  });

  it('blocks metadata paths on localhost', () => {
    const r = validateUrl('http://localhost/latest/meta-data');
    assert.equal(r.valid, false);
  });

  it('allows localhost for non-metadata paths', () => {
    const r = validateUrl('http://localhost:3000/api/health');
    assert.equal(r.valid, true);
  });
});

describe('checkFileSize', () => {
  it('returns ok for small files', () => {
    const mockStat = () => ({ size: 1024 });
    const r = checkFileSize('/some/file', mockStat);
    assert.equal(r.ok, true);
    assert.equal(r.size, 1024);
  });

  it('rejects files over 10MB', () => {
    const mockStat = () => ({ size: 11 * 1024 * 1024 });
    const r = checkFileSize('/huge/file', mockStat);
    assert.equal(r.ok, false);
    assert.match(r.reason, /too large/i);
  });

  it('handles missing files gracefully', () => {
    const mockStat = () => { throw new Error('ENOENT'); };
    const r = checkFileSize('/missing', mockStat);
    assert.equal(r.ok, false);
    assert.equal(r.size, -1);
  });
});

describe('createResponseAccumulator', () => {
  it('accumulates data within limit', () => {
    const acc = createResponseAccumulator(100);
    acc.onData('hello');
    acc.onData(' world');
    assert.equal(acc.getBody(), 'hello world');
    assert.equal(acc.isTruncated(), false);
  });

  it('truncates data over limit', () => {
    const acc = createResponseAccumulator(5);
    acc.onData('hello');
    acc.onData(' world');
    assert.equal(acc.isTruncated(), true);
    assert.equal(acc.getBody(), 'hello');
  });

  it('tracks total size even when truncated', () => {
    const acc = createResponseAccumulator(5);
    acc.onData('hello');
    acc.onData(' world');
    assert.equal(acc.getTotalSize(), 11);
  });
});

describe('redactSensitiveValue', () => {
  it('redacts values for sensitive keys', () => {
    const r = redactSensitiveValue('api_key', 'sk-1234567890abcdef');
    assert.match(r, /REDACTED/);
    assert.ok(!r.includes('1234567890abcdef'));
  });

  it('preserves first 4 chars for long values', () => {
    const r = redactSensitiveValue('password', 'mysecretpassword');
    assert.ok(r.startsWith('myse'));
  });

  it('leaves non-sensitive keys untouched', () => {
    const r = redactSensitiveValue('username', 'johndoe');
    assert.equal(r, 'johndoe');
  });

  it('handles null/undefined values', () => {
    assert.equal(redactSensitiveValue('key', null), null);
    assert.equal(redactSensitiveValue('key', undefined), undefined);
  });

  it('fully redacts short sensitive values', () => {
    const r = redactSensitiveValue('token', 'abc');
    assert.equal(r, '***REDACTED***');
  });
});
