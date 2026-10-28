// Shared shapes for every payment provider. A provider only has to turn its own
// API responses into these; the rest of the kit never sees provider details.

export type LicenseStatus = 'active' | 'expired' | 'disabled' | 'invalid';

export interface LicenseInfo {
  key: string;
  status: LicenseStatus;
  /** Provider-side id for this browser install. Needed to validate and deactivate. */
  instanceId: string;
  /** ISO date or null for lifetime licenses. */
  expiresAt: string | null;
  customerEmail?: string;
  /** Plan or variant name, if the provider returns one. */
  plan?: string;
}

export type ProviderResult =
  | { ok: true; license: LicenseInfo }
  | { ok: false; error: string; reason?: import('./errors').FailReason };

export interface LicenseProvider {
  readonly name: string;
  activate(key: string, instanceName: string): Promise<ProviderResult>;
  validate(key: string, instanceId: string): Promise<ProviderResult>;
  deactivate(key: string, instanceId: string): Promise<{ ok: boolean; error?: string }>;
}

/** Thrown for network failures, so callers can tell "offline" from "key rejected". */
export class NetworkError extends Error {}
