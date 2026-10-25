// Wires the license manager to extension storage and the provider picked in config.ts.
import { storage } from '#imports';
import { config } from '../config';
import { createLicenseManager, type StoredLicense } from './manager';
import { lemonSqueezy } from './providers/lemonsqueezy';
import type { LicenseProvider } from './types';

const item = storage.defineItem<StoredLicense | null>('local:license', { fallback: null });

// Keyturn Kit Pro adds Polar and Dodo Payments here, switchable from config.ts.
function pickProvider(): LicenseProvider {
  return lemonSqueezy(config.lemonsqueezy);
}

export const license = createLicenseManager({
  provider: pickProvider(),
  store: { get: () => item.getValue(), set: (v) => item.setValue(v) },
  recheckHours: config.recheckHours,
  offlineGraceDays: config.offlineGraceDays,
});

/** Subscribe to license changes from any context (popup, options, content script). */
export const watchLicense = (cb: (v: StoredLicense | null) => void) => item.watch(cb);

export type { StoredLicense } from './manager';
export type { LicenseInfo, LicenseProvider } from './types';
