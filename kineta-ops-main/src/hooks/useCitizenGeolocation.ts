import { useCallback, useEffect, useState } from "react";

export type GeoFix = {
  lat: number;
  lng: number;
  accuracy?: number;
  updatedAt: number;
};

export function useCitizenGeolocation(enabled: boolean) {
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setFix(null);
      setError(null);
      setPending(false);
      return;
    }
    if (typeof window === "undefined" || !navigator.geolocation) {
      return;
    }
    setPending(true);
    setError(null);
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setPending(false);
        setError(null);
        setFix({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          updatedAt: Date.now(),
        });
      },
      (e) => {
        setPending(false);
        setError(e.message || "Location denied");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  const copyCoords = useCallback(async () => {
    if (!fix) return false;
    const text = `${fix.lat.toFixed(6)}, ${fix.lng.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, [fix]);

  return { fix, error, pending, copyCoords };
}
