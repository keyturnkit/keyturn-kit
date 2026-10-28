import { useState } from 'react';
import { config } from '@/lib/config';
import { license } from '@/lib/license';
import { usePro } from './usePro';

/** Drop-in license box: enter key, see status, move the key to another browser. */
/** Shown in the provider dashboard, so each install gets a distinct, readable name. */
function instanceName() {
  const browserName = /Firefox\//.test(navigator.userAgent) ? 'Firefox' : /Edg\//.test(navigator.userAgent) ? 'Edge' : 'Chrome';
  return `${browserName} ${crypto.randomUUID().slice(0, 8)}`;
}

export function LicenseForm() {
  const { pro, state } = usePro();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const r = await fn();
    setBusy(false);
    if (!r.ok && r.error) setError(r.error);
  }

  if (pro === null) return <p className="muted">Checking license</p>;

  if (pro && state) {
    const { license: l } = state;
    return (
      <div className="license">
        <p>
          <strong>Pro is active</strong>
          {l.plan ? ` (${l.plan})` : ''}
        </p>
        {l.customerEmail && <p className="muted">Licensed to {l.customerEmail}</p>}
        {l.expiresAt && <p className="muted">Renews or expires {new Date(l.expiresAt).toLocaleDateString()}</p>}
        <button disabled={busy} onClick={() => run(() => license.deactivate())}>
          Remove key from this browser
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <form
      className="license"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => license.activate(key, instanceName()));
      }}
    >
      {state?.lastError && state.lastError !== 'offline' && (
        <p className="error">Your key stopped working. {state.lastError}</p>
      )}
      <label>
        License key
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" autoComplete="off" />
      </label>
      <button type="submit" disabled={busy || !key.trim()}>
        {busy ? 'Checking' : 'Activate'}
      </button>
      <a href={config.checkoutUrl} target="_blank" rel="noreferrer">
        Get a key
      </a>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
