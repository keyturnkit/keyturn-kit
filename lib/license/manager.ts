// Keeps the license state in extension storage and decides whether Pro is unlocked.
// Rules:
//   - activate once per install, store the instance id
//   - re-check with the provider at most every `recheckHours`
//   - if the provider can't be reached, stay unlocked for `offlineGraceDays` after the last good check
//   - a key the provider rejects locks Pro immediately
import { NetworkError, type LicenseInfo, type LicenseProvider } from './types';

export interface StoredLicense {
  license: LicenseInfo;
  lastCheckedAt: number;
  lastOkAt: number;
  lastError?: string;
}

export interface KeyValueStore {
  get(): Promise<StoredLicense | null>;
  set(value: StoredLicense | null): Promise<void>;
}

export interface ManagerOptions {
  provider: LicenseProvider;
  store: KeyValueStore;
  recheckHours?: number;
  offlineGraceDays?: number;
  now?: () => number;
}

const HOUR = 3_600_000;

export function createLicenseManager(opts: ManagerOptions) {
  const recheckMs = (opts.recheckHours ?? 24) * HOUR;
  const graceMs = (opts.offlineGraceDays ?? 7) * 24 * HOUR;
  const now = opts.now ?? Date.now;

  function unlocked(s: StoredLicense | null): boolean {
    if (!s || s.license.status !== 'active') return false;
    if (s.license.expiresAt && Date.parse(s.license.expiresAt) < now()) return false;
    return now() - s.lastOkAt <= graceMs;
  }

  return {
    async activate(key: string, instanceName: string): Promise<{ ok: boolean; error?: string }> {
      const trimmed = key.trim();
      if (!trimmed) return { ok: false, error: 'Enter a license key' };
      try {
        const r = await opts.provider.activate(trimmed, instanceName);
        if (!r.ok) return r;
        if (r.license.status !== 'active') return { ok: false, error: `License is ${r.license.status}` };
        const t = now();
        await opts.store.set({ license: r.license, lastCheckedAt: t, lastOkAt: t });
        return { ok: true };
      } catch (e) {
        if (e instanceof NetworkError) return { ok: false, error: 'Could not reach the license server. Check your connection.' };
        throw e;
      }
    },

    /** Re-validate if due. Safe to call often (popup open, alarm). */
    async refresh(force = false): Promise<boolean> {
      const s = await opts.store.get();
      if (!s) return false;
      if (!force && now() - s.lastCheckedAt < recheckMs) return unlocked(s);

      // The network call can take a while. If the key was removed or replaced meanwhile
      // (deactivate, a new activate), don't write the old key back over it.
      async function save(next: StoredLicense) {
        const current = await opts.store.get();
        if (!current || current.license.key !== s!.license.key || current.license.instanceId !== s!.license.instanceId) return false;
        await opts.store.set(next);
        return true;
      }

      try {
        const r = await opts.provider.validate(s.license.key, s.license.instanceId);
        const t = now();
        if (!r.ok) {
          await save({ ...s, license: { ...s.license, status: 'invalid' }, lastCheckedAt: t, lastError: r.error });
          return false;
        }
        const ok = r.license.status === 'active';
        if (!(await save({ license: r.license, lastCheckedAt: t, lastOkAt: ok ? t : s.lastOkAt, lastError: undefined }))) {
          return unlocked(await opts.store.get());
        }
        return ok && unlocked({ license: r.license, lastCheckedAt: t, lastOkAt: t });
      } catch (e) {
        if (!(e instanceof NetworkError)) throw e;
        // Offline: keep the last known state, grace period decides. Try again in an hour, not a full day.
        await save({ ...s, lastCheckedAt: now() - recheckMs + HOUR, lastError: 'offline' });
        return unlocked(await opts.store.get());
      }
    },

    async isPro(): Promise<boolean> {
      return unlocked(await opts.store.get());
    },

    async status(): Promise<StoredLicense | null> {
      return opts.store.get();
    },

    async deactivate(): Promise<{ ok: boolean; error?: string }> {
      const s = await opts.store.get();
      if (!s) return { ok: true };
      let result: { ok: boolean; error?: string } = { ok: true };
      try {
        result = await opts.provider.deactivate(s.license.key, s.license.instanceId);
      } catch (e) {
        if (!(e instanceof NetworkError)) throw e;
        result = { ok: false, error: 'offline' };
      }
      // Remove locally either way so the user can move the key to another browser.
      await opts.store.set(null);
      return result;
    },
  };
}

export type LicenseManager = ReturnType<typeof createLicenseManager>;
