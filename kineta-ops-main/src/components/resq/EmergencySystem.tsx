import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useResqStore } from "@/store/useResqStore";
import { AlertOctagon, X, MapPin, Radio, Battery, Activity, Mic, Camera, Navigation } from "lucide-react";

export function EmergencyButton() {
  const { setEmergencyActive, emergencyActive } = useResqStore();
  if (emergencyActive) return null;
  return (
    <motion.button
      onClick={() => setEmergencyActive(true)}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-40 w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-gradient-to-br from-emergency to-red-700 text-white font-bold text-[10px] tracking-widest flex flex-col items-center justify-center glow-emergency"
    >
      <span className="absolute inset-0 rounded-full pulse-ring text-emergency" />
      <AlertOctagon className="w-7 h-7 mb-0.5" />
      <span className="leading-none">EMERG</span>
      <span className="leading-none mt-0.5">SOS</span>
    </motion.button>
  );
}

export function EmergencyOverlay() {
  const { emergencyActive, emergencyStep, setEmergencyStep, setEmergencyActive } = useResqStore();

  useEffect(() => {
    if (!emergencyActive) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (emergencyStep === 1) timers.push(setTimeout(() => setEmergencyStep(2), 2200));
    if (emergencyStep === 2) timers.push(setTimeout(() => setEmergencyStep(3), 2400));
    if (emergencyStep === 3) timers.push(setTimeout(() => setEmergencyStep(4), 2200));
    return () => timers.forEach(clearTimeout);
  }, [emergencyActive, emergencyStep, setEmergencyStep]);

  return (
    <AnimatePresence>
      {emergencyActive && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: "radial-gradient(ellipse at center, oklch(0.20 0.20 25 / 0.65), oklch(0.10 0.05 25 / 0.95))" }}
        >
          {/* Siren flash */}
          <motion.div
            animate={{ opacity: [0.0, 0.35, 0.0] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="absolute inset-0 bg-emergency pointer-events-none"
          />

          <button onClick={() => setEmergencyActive(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20">
            <X className="w-4 h-4" />
          </button>

          <div className="relative w-full max-w-2xl mx-6">
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="glass-strong rounded-2xl border-2 border-emergency/60 p-8 glow-emergency"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="relative w-14 h-14 rounded-full bg-emergency/20 flex items-center justify-center">
                  <span className="absolute inset-0 rounded-full pulse-ring text-emergency" />
                  <AlertOctagon className="w-7 h-7 text-emergency" />
                </div>
                <div>
                  <div className="text-[10px] tracking-[0.3em] text-emergency font-bold blink">EMERGENCY MODE</div>
                  <div className="text-2xl font-bold tracking-tight">Distress Beacon Active</div>
                </div>
              </div>

              <Steps step={emergencyStep} />

              {emergencyStep === 4 && <LiveBeacon />}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Steps({ step }: { step: number }) {
  const steps = [
    { t: "Permissions Acquired", sub: "Location · Microphone · Camera", icons: [MapPin, Mic, Camera] },
    { t: "Beacon Transmitting", sub: "WebRTC data channel + GPS uplink to command", icons: [Radio] },
    { t: "Rescue Notified", sub: "ALPHA-1 dispatched · ETA 4 minutes", icons: [Navigation] },
    { t: "Live Tracking", sub: "You are visible to emergency responders", icons: [Activity] },
  ];
  return (
    <div className="space-y-2 mb-4">
      {steps.slice(0, step).map((s, i) => (
        <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3 p-3 rounded border border-emergency/30 bg-emergency/5">
          <div className="flex gap-1">
            {s.icons.map((Ic, j) => <Ic key={j} className="w-4 h-4 text-emergency" />)}
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-bold">{s.t}</div>
            <div className="text-[11px] text-muted-foreground">{s.sub}</div>
          </div>
          <span className="text-[10px] text-safe font-bold">✓ OK</span>
        </motion.div>
      ))}
    </div>
  );
}

function LiveBeacon() {
  const [gps, setGps] = useState<{ lat: number; lng: number; acc?: number } | null>(null);
  const [gpsErr, setGpsErr] = useState<string | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsErr("GPS unavailable");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsErr(null);
        setGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: pos.coords.accuracy,
        });
      },
      (e) => setGpsErr(e.message || "GPS denied"),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const coordStr = gps
    ? `${Math.abs(gps.lat).toFixed(5)}°${gps.lat >= 0 ? "N" : "S"}  ${Math.abs(gps.lng).toFixed(5)}°${gps.lng >= 0 ? "E" : "W"}${gps.acc != null ? `  ±${Math.round(gps.acc)}m` : ""}`
    : gpsErr
      ? gpsErr
      : "Acquiring satellite lock…";

  return (
    <div className="grid grid-cols-2 gap-2 mt-4">
      {[
        { l: "COORDINATES (LIVE)", v: coordStr, c: gps ? "intel" : "warning" },
        { l: "SIGNAL", v: "STRONG · 4 BARS", c: "safe" },
        { l: "BATTERY", v: "68% · 4h 12m", c: "warning", icon: Battery },
        { l: "RESCUE ETA", v: "4 MIN · ALPHA-1", c: "emergency" },
        { l: "WEBRTC UPLINK", v: "DATA CHANNEL ARMED", c: "intel" },
        { l: "CHANNEL", v: "EMG-RED-04", c: "emergency" },
      ].map((d) => (
        <div key={d.l} className="p-2.5 rounded border border-border/60 bg-surface/40">
          <div className="text-[9px] tracking-widest text-muted-foreground">{d.l}</div>
          <div className={`text-[13px] font-bold font-mono text-${d.c} break-words`}>{d.v}</div>
        </div>
      ))}
    </div>
  );
}
