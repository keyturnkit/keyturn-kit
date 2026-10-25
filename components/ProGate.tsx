import type { ReactNode } from 'react';
import { config } from '@/lib/config';
import { usePro } from './usePro';

/** Shows children to Pro users, `fallback` (or an upgrade prompt) to everyone else. */
export function ProGate({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { pro } = usePro();
  if (pro === null) return null;
  if (pro) return <>{children}</>;
  return (
    <>
      {fallback ?? (
        <p className="upsell">
          This is a Pro feature.{' '}
          <a href={config.checkoutUrl} target="_blank" rel="noreferrer">
            Upgrade
          </a>
        </p>
      )}
    </>
  );
}
