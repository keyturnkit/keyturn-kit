import { useEffect, useState } from 'react';
import { license, watchLicense, type StoredLicense } from '@/lib/license';

/** `pro` is null while loading, then true or false. Re-renders when the license changes anywhere. */
export function usePro() {
  const [pro, setPro] = useState<boolean | null>(null);
  const [state, setState] = useState<StoredLicense | null>(null);

  useEffect(() => {
    let alive = true;
    const sync = async () => {
      const [p, s] = await Promise.all([license.refresh(), license.status()]);
      if (alive) {
        setPro(p);
        setState(s);
      }
    };
    void sync();
    const unwatch = watchLicense(async (s) => {
      setState(s);
      setPro(await license.isPro());
    });
    return () => {
      alive = false;
      unwatch();
    };
  }, []);

  return { pro, state };
}
