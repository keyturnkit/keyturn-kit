// Lemon Squeezy License API. Public endpoints, no secret key needed in the extension.
// https://docs.lemonsqueezy.com/api/license-api
import { classify, fail } from '../errors';
import { NetworkError, type LicenseInfo, type LicenseProvider, type ProviderResult } from '../types';

const BASE = 'https://api.lemonsqueezy.com/v1/licenses';

export interface LemonSqueezyOptions {
  /** Your store id. Keys from other stores are rejected even if Lemon Squeezy says they are valid. */
  storeId: number;
  /** Optional: only accept keys for these product ids. */
  productIds?: number[];
  fetch?: typeof fetch;
}

interface LsResponse {
  activated?: boolean;
  valid?: boolean;
  deactivated?: boolean;
  error?: string | null;
  license_key?: { key: string; status: string; expires_at: string | null };
  instance?: { id: string } | null;
  meta?: { store_id: number; product_id: number; variant_name?: string; customer_email?: string };
}

export function lemonSqueezy(opts: LemonSqueezyOptions): LicenseProvider {
  const f = opts.fetch ?? fetch.bind(globalThis);

  async function call(path: string, body: Record<string, string>): Promise<LsResponse> {
    let res: Response;
    try {
      res = await f(`${BASE}/${path}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body),
      });
    } catch (e) {
      throw new NetworkError(String(e));
    }
    // 5xx and rate limits are temporary: keep the last known state instead of locking the user out.
    if (res.status >= 500 || res.status === 429) throw new NetworkError(`Lemon Squeezy ${res.status}`);
    // Other 4xx still carry a JSON body with an error message.
    try {
      return (await res.json()) as LsResponse;
    } catch {
      throw new NetworkError(`Lemon Squeezy ${res.status}: response was not JSON`);
    }
  }

  function toResult(r: LsResponse, ok: boolean | undefined, instanceId: string | undefined): ProviderResult {
    if (!ok || !r.license_key) return fail(classify(r.error), r.error ?? 'no error text');
    if (r.meta?.store_id !== opts.storeId) return fail('other_store', `store_id ${r.meta?.store_id}`);
    if (opts.productIds?.length && !opts.productIds.includes(r.meta.product_id)) {
      return fail('other_product', `product_id ${r.meta.product_id}`);
    }
    const status = r.license_key.status;
    const license: LicenseInfo = {
      key: r.license_key.key,
      status: status === 'active' || status === 'inactive' ? 'active' : status === 'expired' ? 'expired' : 'disabled',
      instanceId: r.instance?.id ?? instanceId ?? '',
      expiresAt: r.license_key.expires_at,
      customerEmail: r.meta.customer_email,
      plan: r.meta.variant_name,
    };
    return { ok: true, license };
  }

  return {
    name: 'lemonsqueezy',
    async activate(key, instanceName) {
      // Check the store before activating, so a key from another store doesn't use up one of its activations here.
      const pre = await call('validate', { license_key: key });
      if (pre.license_key && pre.meta && pre.meta.store_id !== opts.storeId) {
        return fail('other_store', `store_id ${pre.meta.store_id}`);
      }
      const r = await call('activate', { license_key: key, instance_name: instanceName });
      return toResult(r, r.activated, undefined);
    },
    async validate(key, instanceId) {
      const r = await call('validate', { license_key: key, instance_id: instanceId });
      return toResult(r, r.valid, instanceId);
    },
    async deactivate(key, instanceId) {
      const r = await call('deactivate', { license_key: key, instance_id: instanceId });
      return r.deactivated ? { ok: true } : fail('release_failed', r.error);
    },
  };
}
