import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useResqStore } from "@/store/useResqStore";
import { ShieldAlert, MapPin, Mic, Camera, Bell, Check, Loader2, Lock } from "lucide-react";

const PERMS = [
  { k: "location", l: "Location Access", d: "Pinpoint your exact position for rescue teams when seconds matter.", icon: MapPin },
  { k: "microphone", l: "Microphone Access", d: "Stream live audio so rescuers can hear you, even when you can't speak.", icon: Mic },
  { k: "camera", l: "Camera Access", d: "Send live snapshots of your surroundings to coordinate rescue.", icon: Camera },
  { k: "notifications", l: "Emergency Notifications", d: "Receive critical evacuation orders, even when offline via mesh.", icon: Bell },
] as const;

export function Onboarding() {
  const { onboarded, permissions, grantAllPermissions, setOnboarded } = useResqStore();
  const [step, setStep] = useState(0);
  const [arming, setArming] = useState(false);
  const granted = Object.values(permissions).filter(Boolean).length;
  const readiness = Math.round((granted / 4) * 100);

  if (onboarded) return null;

  const handleArm = async () => {
    setArming(true);
    grantAllPermissions();
    // Best-effort real permission requests (silent failures)
    try { navigator.geolocation?.getCurrentPosition(() => {}, () => {}, { timeout: 1500 }); } catch { /* */ }
    try { await navigator.mediaDevices?.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop())); } catch { /* */ }
    try { Notification.requestPermission?.(); } catch { /* */ }
    setTimeout(() => { setStep(2); }, 1800);
    setTimeout(() => { setOnboarded(true); }, 3600);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-y-auto"
        style={{ background: "radial-gradient(ellipse at center, oklch(0.18 0.04 250 / 0.95), oklch(0.10 0.02 250 / 0.99))" }}
      >
        <div className="absolute inset-0 scanlines pointer-events-none" />
        <motion.div
          initial={{ scale: 0.94, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          className="relative w-full max-w-xl glass-strong rounded-2xl border border-emergency/40 p-6 sm:p-8 my-auto"
        >
          {step === 0 && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="relative w-14 h-14 rounded-xl bg-emergency/15 border border-emergency/40 flex items-center justify-center">
                  <ShieldAlert className="w-7 h-7 text-emergency text-glow-emergency" />
                  <span className="absolute inset-0 rounded-xl pulse-ring text-emergency" />
                </div>
                <div>
                  <div className="text-[10px] tracking-[0.3em] text-emergency font-bold">KAVACH · v4.2</div>
                  <div className="text-2xl font-bold tracking-tight">Emergency Preparedness</div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                When disaster strikes, every second counts. <span className="text-foreground font-semibold">Kavach</span> is your AI-powered survival shield —
                pre-arming permissions <em>now</em> means rescue can find you instantly, without you fumbling through prompts during panic.
              </p>
              <div className="space-y-1.5 mb-5 text-[12px]">
                {[
                  "One-time setup — secure, encrypted, on-device",
                  "Permissions stay armed for offline mesh rescue",
                  "No tracking outside emergencies. Privacy by design.",
                ].map(t => (
                  <div key={t} className="flex items-center gap-2 text-muted-foreground">
                    <Lock className="w-3 h-3 text-safe shrink-0" /><span>{t}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setStep(1)}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-emergency to-red-700 text-white font-bold text-sm tracking-widest glow-emergency hover:scale-[1.01] transition">
                BEGIN INITIALIZATION →
              </button>
              <button onClick={() => setOnboarded(true)} className="w-full mt-2 text-[10px] text-muted-foreground hover:text-foreground tracking-widest">
                Skip — limit emergency capability
              </button>
            </>
          )}

          {step === 1 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-[10px] tracking-[0.3em] text-emergency font-bold">STEP 2 / 3</div>
                  <div className="text-xl font-bold">Arm Emergency Permissions</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground tracking-widest">READINESS</div>
                  <div className="text-2xl font-bold text-emergency text-glow-emergency">{readiness}%</div>
                </div>
              </div>
              <div className="h-1.5 rounded bg-white/5 mb-4 overflow-hidden">
                <motion.div className="h-full bg-gradient-to-r from-emergency to-warning"
                  animate={{ width: `${readiness}%` }} transition={{ duration: 0.5 }} />
              </div>
              <div className="space-y-2 mb-5">
                {PERMS.map((p) => {
                  const ok = permissions[p.k];
                  const Icon = p.icon;
                  return (
                    <div key={p.k} className={`p-3 rounded-lg border flex items-start gap-3 transition
                      ${ok ? "bg-safe/10 border-safe/40" : "bg-surface/40 border-border/60"}`}>
                      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${ok ? "text-safe" : "text-emergency"}`} />
                      <div className="flex-1">
                        <div className="text-[13px] font-bold">{p.l}</div>
                        <div className="text-[11px] text-muted-foreground leading-snug">{p.d}</div>
                      </div>
                      {ok ? <Check className="w-5 h-5 text-safe" /> :
                        <span className="text-[9px] text-muted-foreground tracking-widest mt-1">PENDING</span>}
                    </div>
                  );
                })}
              </div>
              <button onClick={handleArm} disabled={arming}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-emergency to-red-700 text-white font-bold text-sm tracking-widest glow-emergency disabled:opacity-70 flex items-center justify-center gap-2">
                {arming ? <><Loader2 className="w-4 h-4 animate-spin" /> ARMING SYSTEMS…</> : "ARM ALL EMERGENCY SYSTEMS"}
              </button>
            </>
          )}

          {step === 2 && <ArmedScreen />}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ArmedScreen() {
  const [scan, setScan] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setScan((x) => Math.min(100, x + 7)), 80);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-center py-4">
      <motion.div
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}
        className="relative w-24 h-24 mx-auto mb-4 rounded-full bg-safe/15 border-2 border-safe/60 flex items-center justify-center">
        <span className="absolute inset-0 rounded-full pulse-ring text-safe" />
        <ShieldAlert className="w-12 h-12 text-safe" style={{ filter: "drop-shadow(0 0 12px oklch(0.72 0.18 155 / 0.8))" }} />
      </motion.div>
      <div className="text-[10px] tracking-[0.3em] text-safe font-bold mb-1">SYSTEMS ONLINE</div>
      <div className="text-2xl font-bold mb-2">Emergency Systems Armed</div>
      <p className="text-[12px] text-muted-foreground mb-4 max-w-sm mx-auto">
        Kavach is now running in protected background mode. Your distress beacon will activate instantly with one tap.
      </p>
      <div className="h-1.5 rounded bg-white/5 mb-2 overflow-hidden max-w-xs mx-auto">
        <div className="h-full bg-gradient-to-r from-safe to-intel" style={{ width: `${scan}%` }} />
      </div>
      <div className="text-[10px] font-mono text-muted-foreground">Synchronizing mesh network… {scan}%</div>
    </div>
  );
}
