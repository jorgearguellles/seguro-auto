/**
 * Tests for url-safety.ts (ADR-009 §D3-A).
 * AC-03.3
 */
import { describe, it, expect } from 'vitest';
import { isSafeUrl } from './url-safety';

describe('isSafeUrl', () => {
  it('AC-03.3 accepts https:// URLs', () => {
    expect(isSafeUrl('https://example.com')).toBe(true);
  });

  it('AC-03.3 accepts http:// URLs', () => {
    expect(isSafeUrl('http://example.com')).toBe(true);
  });

  it('AC-03.3 accepts mailto: URLs', () => {
    expect(isSafeUrl('mailto:info@example.com')).toBe(true);
  });

  it('AC-03.3 accepts relative paths starting with /', () => {
    expect(isSafeUrl('/terminos')).toBe(true);
    expect(isSafeUrl('/co/paso-1')).toBe(true);
  });

  it('link with javascript: url degrades to plain text — isSafeUrl returns false', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
  });

  it('AC-03.3 rejects data: URLs', () => {
    expect(isSafeUrl('data:text/html,<h1>XSS</h1>')).toBe(false);
  });

  it('AC-03.3 rejects vbscript: URLs', () => {
    expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
  });

  it('AC-03.3 rejects file: URLs', () => {
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
  });

  it('AC-03.3 rejects unparseable strings', () => {
    expect(isSafeUrl('not a url at all')).toBe(false);
  });

  it('AC-03.3 rejects empty string', () => {
    expect(isSafeUrl('')).toBe(false);
  });
});
