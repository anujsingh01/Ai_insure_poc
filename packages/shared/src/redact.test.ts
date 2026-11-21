import { describe, expect, it } from 'vitest';
import { redactText } from './redact.js';
import { hasAnyRole, parseRoles } from './roles.js';

describe('redactText', () => {
  it('masks Aadhaar numbers, keeping the last four digits', () => {
    expect(redactText('my aadhaar is 2345 6789 0123 ok')).toBe('my aadhaar is XXXX-XXXX-0123 ok');
  });

  it('masks PAN numbers', () => {
    expect(redactText('PAN ABCPE1234F')).toBe('PAN ABXXXXXX4F');
  });

  it('masks email and Indian mobile numbers', () => {
    expect(redactText('mail a.b@x.com or call +91 9876543210')).toBe('mail [email] or call [phone]');
  });
});

describe('roles', () => {
  it('parses comma-separated roles and ignores unknown ones', () => {
    expect(parseRoles('admin, reviewer,hacker')).toEqual(['admin', 'reviewer']);
  });

  it('allows when no role is required', () => {
    expect(hasAnyRole([], [])).toBe(true);
    expect(hasAnyRole(['agent'], ['owner', 'admin'])).toBe(false);
  });
});
