import { describe, expect, it, vi } from 'vitest';
import { createLicenseManager, type StoredLicense } from '../lib/license/manager';
import { lemonSqueezy } from '../lib/license/providers/lemonsqueezy';
import { MESSAGES } from '../lib/license/errors';
import { NetworkError, type LicenseProvider } from '../lib/license/types';

const DAY = 86_400_000;

function memoryStore() {
  let v: StoredLicense | null = null;
  return { get: async () => v, set: async (x: StoredLicense | null) => void (v = x), peek: () => v };
}

function jsonFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(status === 204 ? null : JSON.stringify(body), { status }));
}

const lsOk = (extra: object = {}) => ({
  activated: true,
  valid: true,
  error: null,
  license_key: { key: 'K-1', status: 'active', expires_at: null },
  instance: { id: 'inst-1' },
  meta: { store_id: 42, product_id: 7, variant_name: 'Lifetime', customer_email: 'a@b.c' },
  ...extra,
});

describe('lemonSqueezy provider', () => {
  it('activates and maps the response', async () => {
    const f = jsonFetch(200, lsOk());
    const r = await lemonSqueezy({ storeId: 42, fetch: f }).activate('K-1', 'chrome');
    expect(r).toEqual({
      ok: true,
      license: { key: 'K-1', status: 'active', instanceId: 'inst-1', expiresAt: null, customerEmail: 'a@b.c', plan: 'Lifetime' },
    });
    // First a store check (validate without instance), then the activation.
    const calls = f.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map((c) => c[0])).toEqual([
      'https://api.lemonsqueezy.com/v1/licenses/validate',
      'https://api.lemonsqueezy.com/v1/licenses/activate',
    ]);
    expect(String(calls[1]![1].body)).toBe('license_key=K-1&instance_name=chrome');
  });

  it('rejects keys from another store without activating them', async () => {
    const f = jsonFetch(200, lsOk({ meta: { store_id: 99, product_id: 7 } }));
    const r = await lemonSqueezy({ storeId: 42, fetch: f }).activate('K-1', 'x');
    expect(r).toMatchObject({ ok: false, error: MESSAGES.other_store });
    // Only the store check ran, so no activation slot was used on the other store's key.
    expect(f).toHaveBeenCalledOnce();
  });

  it('treats rate limits and non-JSON responses as temporary, not as a rejected key', async () => {
    await expect(lemonSqueezy({ storeId: 42, fetch: jsonFetch(429, {}) }).validate('K', 'i')).rejects.toBeInstanceOf(NetworkError);
    const html = vi.fn(async () => new Response('<html>bad gateway</html>', { status: 404 }));
    await expect(lemonSqueezy({ storeId: 42, fetch: html }).validate('K', 'i')).rejects.toBeInstanceOf(NetworkError);
  });

  it('rejects keys for another product when productIds is set', async () => {
    const r = await lemonSqueezy({ storeId: 42, productIds: [8], fetch: jsonFetch(200, lsOk()) }).activate('K-1', 'x');
    expect(r.ok).toBe(false);
  });

  it('maps the API error on 4xx to a friendly message and logs the original', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const f = jsonFetch(400, { activated: false, error: 'license_key not found.' });
    const r = await lemonSqueezy({ storeId: 42, fetch: f }).activate('nope', 'x');
    expect(r).toMatchObject({ ok: false, error: MESSAGES.not_found, reason: 'not_found' });
    expect(debug.mock.calls.flat().join(' ')).toContain('license_key not found.');
    debug.mockRestore();
  });

  const lsFail = async (error: string | null, extra: object = {}) => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const r = await lemonSqueezy({ storeId: 42, fetch: jsonFetch(400, { activated: false, valid: false, error, ...extra }) }).activate('K', 'x');
    debug.mockRestore();
    return r;
  };

  it('maps Lemon Squeezy failures: disabled, limit, expired, unknown text', async () => {
    expect(await lsFail('This license key is disabled.')).toMatchObject({ error: MESSAGES.disabled });
    expect(await lsFail('This license key has reached the activation limit.')).toMatchObject({ error: MESSAGES.limit });
    expect(await lsFail('This license key has expired.')).toMatchObject({ error: MESSAGES.expired });
    const odd = await lsFail('Something exploded in module X');
    expect(odd).toMatchObject({ ok: false, error: MESSAGES.unknown });
    expect((odd as { error: string }).error).not.toContain('exploded');
    expect(await lsFail(null)).toMatchObject({ error: MESSAGES.unknown });
  });

  it('uses the friendly message when the other product is detected', async () => {
    const r = await lemonSqueezy({ storeId: 42, productIds: [8], fetch: jsonFetch(200, lsOk()) }).activate('K-1', 'x');
    expect(r).toMatchObject({ error: MESSAGES.other_product });
  });

  it('throws NetworkError on 5xx and fetch failures', async () => {
    await expect(lemonSqueezy({ storeId: 42, fetch: jsonFetch(503, {}) }).validate('K', 'i')).rejects.toBeInstanceOf(NetworkError);
    const broken = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(lemonSqueezy({ storeId: 42, fetch: broken }).validate('K', 'i')).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('license manager', () => {
  function setup(provider: Partial<LicenseProvider>) {
    let t = 1_000 * DAY;
    const store = memoryStore();
    const p: LicenseProvider = {
      name: 'fake',
      activate: async () => ({ ok: true, license: { key: 'K', status: 'active', instanceId: 'i', expiresAt: null } }),
      validate: async () => ({ ok: true, license: { key: 'K', status: 'active', instanceId: 'i', expiresAt: null } }),
      deactivate: async () => ({ ok: true }),
      ...provider,
    };
    const m = createLicenseManager({ provider: p, store, now: () => t, recheckHours: 24, offlineGraceDays: 7 });
    return { m, store, advance: (ms: number) => void (t += ms) };
  }

  it('is free until a key is activated', async () => {
    const { m } = setup({});
    expect(await m.isPro()).toBe(false);
    expect(await m.activate('  K  ', 'x')).toEqual({ ok: true });
    expect(await m.isPro()).toBe(true);
  });

  it('does not call the provider again before recheck is due', async () => {
    const validate = vi.fn(async () => ({ ok: true as const, license: { key: 'K', status: 'active' as const, instanceId: 'i', expiresAt: null } }));
    const { m, advance } = setup({ validate });
    await m.activate('K', 'x');
    advance(3_600_000);
    await m.refresh();
    expect(validate).not.toHaveBeenCalled();
    advance(DAY);
    await m.refresh();
    expect(validate).toHaveBeenCalledOnce();
  });

  it('locks immediately when the provider rejects the key (refund, revoked)', async () => {
    const { m, advance } = setup({ validate: async () => ({ ok: false, error: 'license_key not found.' }) });
    await m.activate('K', 'x');
    advance(2 * DAY);
    expect(await m.refresh()).toBe(false);
    expect(await m.isPro()).toBe(false);
  });

  it('stays Pro while offline inside the grace period, then locks', async () => {
    const { m, advance } = setup({
      validate: async () => {
        throw new NetworkError('offline');
      },
    });
    await m.activate('K', 'x');
    advance(5 * DAY);
    expect(await m.refresh()).toBe(true);
    advance(3 * DAY);
    expect(await m.refresh()).toBe(false);
  });

  it('retries an hour after a failed check instead of waiting a day', async () => {
    let calls = 0;
    const { m, advance } = setup({
      validate: async () => {
        calls++;
        throw new NetworkError('offline');
      },
    });
    await m.activate('K', 'x');
    advance(25 * 3_600_000);
    await m.refresh();
    expect(calls).toBe(1);
    advance(30 * 60_000);
    await m.refresh();
    expect(calls).toBe(1);
    advance(31 * 60_000);
    await m.refresh();
    expect(calls).toBe(2);
  });

  it('a re-check that finishes after deactivate does not bring the key back', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { m, store, advance } = setup({
      validate: async () => {
        await gate;
        return { ok: true, license: { key: 'K', status: 'active', instanceId: 'i', expiresAt: null } };
      },
    });
    await m.activate('K', 'x');
    advance(2 * DAY);
    const pending = m.refresh();
    await m.deactivate();
    release();
    expect(await pending).toBe(false);
    expect(store.peek()).toBeNull();
  });

  it('locks an expired subscription', async () => {
    const { m, advance } = setup({
      activate: async () => ({ ok: true, license: { key: 'K', status: 'active', instanceId: 'i', expiresAt: new Date(1_001 * DAY).toISOString() } }),
    });
    await m.activate('K', 'x');
    expect(await m.isPro()).toBe(true);
    advance(2 * DAY);
    expect(await m.isPro()).toBe(false);
  });

  it('turns a provider status that is not active into a plain message', async () => {
    const disabled = setup({ activate: async () => ({ ok: true, license: { key: 'K', status: 'disabled', instanceId: 'i', expiresAt: null } }) });
    expect(await disabled.m.activate('K', 'x')).toEqual({ ok: false, error: MESSAGES.disabled });
    const expired = setup({ activate: async () => ({ ok: true, license: { key: 'K', status: 'expired', instanceId: 'i', expiresAt: null } }) });
    expect(await expired.m.activate('K', 'x')).toEqual({ ok: false, error: MESSAGES.expired });
  });

  it('reports a friendly message when activation cannot reach the server', async () => {
    const { m } = setup({
      activate: async () => {
        throw new NetworkError('x');
      },
    });
    expect(await m.activate('K', 'x')).toEqual({ ok: false, error: 'Could not reach the license server. Check your connection.' });
  });

  it('deactivate clears local state even when offline', async () => {
    const { m, store } = setup({
      deactivate: async () => {
        throw new NetworkError('x');
      },
    });
    await m.activate('K', 'x');
    await m.deactivate();
    expect(store.peek()).toBeNull();
  });
});
