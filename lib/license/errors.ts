// The one place that turns provider failures into text a customer can act on.
// Providers classify what went wrong into a `FailReason` and pass the raw provider text along;
// the raw text goes to the console for the developer and never to the UI.
import type { ProviderResult } from './types';

export type FailReason =
  | 'not_found'
  | 'disabled'
  | 'expired'
  | 'limit'
  | 'other_store'
  | 'other_product'
  | 'try_again'
  | 'release_failed'
  | 'unknown';

export const MESSAGES: Record<FailReason, string> = {
  not_found: "That key wasn't found. Check that you copied the whole key from your receipt.",
  disabled: "This key has been turned off. If you think that's a mistake, contact the seller.",
  expired: 'This key has expired. Renew your license with the seller to keep using Pro.',
  limit: 'This key is already active on the most browsers it allows. Deactivate it on one you no longer use.',
  other_store: "This key is from a different store, so it doesn't work here. Check that you bought it from the seller of this extension.",
  other_product: "This key is for a different product, so it doesn't work here. Check which product you bought.",
  try_again: "The license server didn't accept that. Please try again in a moment.",
  release_failed: "The key was removed from this browser, but the license server didn't confirm it. If you can't use it elsewhere, contact the seller.",
  unknown: "That key couldn't be activated. Check the key and try again, or contact the seller.",
};

/** Guess the reason from a provider's error text (and HTTP status when it has one). Order matters. */
export function classify(raw: unknown, status?: number): FailReason {
  const t = typeof raw === 'string' ? raw.toLowerCase() : '';
  if (/activation limit|limit (has been |was |already )?reached|reached .*limit|already (in use|active)|too many (activations|devices|uses)/.test(t)) return 'limit';
  if (/expired/.test(t)) return 'expired';
  if (/disabled|revoked|refunded|inactive|not active|no longer valid|chargeback/.test(t)) return 'disabled';
  if (/not found|does not exist|doesn't exist|invalid|unknown/.test(t)) return 'not_found';
  if (status === 404) return 'not_found';
  return 'unknown';
}

/** Build a failed ProviderResult with a friendly message, and log the raw provider error for the developer. */
export function fail(reason: FailReason, raw?: unknown): Extract<ProviderResult, { ok: false }> {
  if (raw !== undefined && raw !== null && raw !== '') console.debug(`[license] provider said (${reason}):`, raw);
  return { ok: false, error: MESSAGES[reason], reason };
}

/** Messages for a key the provider accepted but whose status is not active. */
export function messageForStatus(status: string): string {
  return status === 'expired' ? MESSAGES.expired : MESSAGES.disabled;
}
