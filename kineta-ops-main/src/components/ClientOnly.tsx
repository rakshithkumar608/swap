import { useEffect, useState } from "react";

/**
 * ClientOnly wrapper — renders children only on the client (after mount).
 * Prevents Leaflet and other window-dependent libs from being evaluated during SSR.
 */
export function ClientOnly({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <>{fallback ?? null}</>;
  return <>{children}</>;
}
