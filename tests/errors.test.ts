import { describe, expect, it, vi } from 'vitest';
import { classify, fail, MESSAGES } from '../lib/license/errors';

describe('license error messages', () => {
  it('classifies common provider texts', () => {
    expect(classify('license_key not found.')).toBe('not_found');
    expect(classify('License key does not exist.')).toBe('not_found');
    expect(classify('This license key is disabled.')).toBe('disabled');
    expect(classify('License key has been revoked')).toBe('disabled');
    expect(classify('activation limit reached')).toBe('limit');
    expect(classify('This license key has expired.')).toBe('expired');
    expect(classify('???', 404)).toBe('not_found');
    expect(classify('???', 400)).toBe('unknown');
    expect(classify(undefined)).toBe('unknown');
    expect(classify([{ msg: 'x' }])).toBe('unknown');
  });

  it('fail() returns the friendly text and logs the raw text', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const r = fail('not_found', 'license_key not found.');
    expect(r).toEqual({ ok: false, error: MESSAGES.not_found, reason: 'not_found' });
    expect(debug).toHaveBeenCalledOnce();
    expect(debug.mock.calls[0]!.join(' ')).toContain('license_key not found.');
    debug.mockRestore();
  });

  it('every message is plain: no colon labels, no em dashes, ends with a full stop', () => {
    for (const m of Object.values(MESSAGES)) {
      expect(m).not.toMatch(/[:\u2014]/);
      expect(m).toMatch(/\.$/);
    }
  });
});
