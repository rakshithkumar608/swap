import { useMemo, useRef, useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Battery,
  BookOpen,
  Camera,
  ChevronDown,
  ClipboardCopy,
  Compass,
  Crosshair,
  Flame,
  Heart,
  Home,
  LifeBuoy,
  LogIn,
  LogOut,
  MapPin,
  MapPinned,
  MessageCircleWarning,
  Mic,
  MoreHorizontal,
  Phone,
  RefreshCw,
  Share2,
  Shield,
  Siren,
  Sparkles,
  Stethoscope,
  Users,
  Volume2,
  Waves,
  Truck,
  ExternalLink,
  Waypoints,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCitizenGeolocation, type GeoFix } from "@/hooks/useCitizenGeolocation";
import {
  useActiveAlerts,
  useDisasters,
  useRescueRoutes,
  useShelters,
  useSubmitSos,
  useCheckMisinformation,
  useLogin,
  QK,
} from "@/hooks/useBackendData";
import { CitizenDigitalTwin } from "@/components/citizen/CitizenDigitalTwin";
import { CitizenSituationHub } from "@/components/citizen/CitizenSituationHub";
import { clearAuthToken, readStoredToken, CITIZEN_AUTH_EMAIL_KEY, type RescueRouteDoc } from "@/lib/api";
import { getRescueRoutesForDisplay } from "@/lib/rescueTrainedDemo";
import { compressImageToDataUrl } from "@/lib/imageCompress";
import { distanceKm } from "@/lib/utils";
import { useCitizenStore, type ChecklistId } from "@/store/useCitizenStore";
import { cn } from "@/lib/utils";
import { CitizenInnovationHub } from "@/components/citizen/CitizenInnovationHub";
import { CitizenSafetyDashboard } from "@/components/citizen/CitizenSafetyDashboard";

type TabId = "home" | "near" | "report" | "sos" | "more" | "loop" | "safety";

function navigateTab(setTab: (t: TabId) => void, t: TabId) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
  if (typeof doc.startViewTransition === "function") {
    doc.startViewTransition(() => setTab(t));
  } else {
    setTab(t);
  }
}

const HAZARD_TAGS = [
  { id: "flood", label: "Flooding" },
  { id: "fire", label: "Fire / smoke" },
  { id: "road", label: "Road / bridge" },
  { id: "power", label: "Power lines" },
  { id: "medical", label: "Medical" },
  { id: "other", label: "Other" },
] as const;

const HAZARD_EVIDENCE_CHIPS = [
  { id: "road", label: "Street sign visible" },
  { id: "landmark", label: "Landmark in frame" },
  { id: "people", label: "People / access" },
  { id: "waterline", label: "Water line / depth cue" },
] as const;

const HAZARD_FOOTPRINT_M = [20, 100, 300, 800] as const;

const CHECKLIST_META: { id: ChecklistId; label: string }[] = [
  { id: "water", label: "Water (3L/person/day)" },
  { id: "torch", label: "Torch + spare cells" },
  { id: "whistle", label: "Whistle / loud signal" },
  { id: "docs", label: "ID & insurance copies" },
  { id: "meds", label: "Prescription meds" },
  { id: "charger", label: "Power bank charged" },
];

const SOS_TEMPLATES = [
  { label: "Trapped", text: "I am trapped and need rescue. I can hear responders." },
  { label: "Medical", text: "Medical emergency — need ambulance and first aid." },
  { label: "Flood", text: "Rising water — cannot evacuate safely. Need boat or evacuation." },
  { label: "Fire", text: "Fire or heavy smoke nearby — need safe route and help." },
  { label: "Violence", text: "Unsafe situation with violence or threat — need police and safe extraction." },
  { label: "Stuck", text: "Vehicle stuck in water or mud — people inside, need winch or rescue." },
  { label: "Vulnerable", text: "Children or elderly with me — need priority evacuation assistance." },
] as const;

const SOS_GROUP_CHIPS = [
  { label: "Alone", suffix: " · I am alone at this location." },
  { label: "2–5", suffix: " · About 2–5 people with me." },
  { label: "6+", suffix: " · Group of 6+ people — need larger transport if evacuating." },
] as const;

type SpeechRecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
};

function trySpeechRecognition(append: (chunk: string) => void, onListening: (v: boolean) => void): void {
  if (typeof window === "undefined") return;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) {
    toast.error("Voice typing is not supported in this browser");
    return;
  }
  const rec = new Ctor();
  rec.lang = typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.onresult = (e) => {
    const t = e.results[0]?.[0]?.transcript?.trim();
    if (t) append(t);
  };
  rec.onerror = () => {
    toast.error("Voice input failed — try again");
    onListening(false);
  };
  rec.onend = () => onListening(false);
  try {
    rec.start();
    onListening(true);
    toast.message("Listening… speak clearly");
  } catch {
    toast.error("Could not start microphone");
    onListening(false);
  }
}

function sosUrgencyHint(text: string): { label: string; bar: number; tone: string } {
  const t = text.toLowerCase();
  if (/\b(trapped|can't breathe|unconscious|bleeding|drowning|fire now|help now)\b/.test(t)) {
    return { label: "High — keywords detected", bar: 92, tone: "bg-emergency" };
  }
  if (t.length > 80 || /\b(boat|evacuat|ambulance|urgent|critical)\b/.test(t)) {
    return { label: "Elevated — good detail", bar: 68, tone: "bg-warning" };
  }
  if (t.length > 12) return { label: "Standard", bar: 42, tone: "bg-intel" };
  return { label: "Add detail if you can speak safely", bar: 18, tone: "bg-muted-foreground/60" };
}

const SURVIVAL_GUIDES: { id: string; title: string; icon: typeof Waves; color: string; tips: string[] }[] = [
  {
    id: "flood",
    title: "Flood & heavy rain",
    icon: Waves,
    color: "text-intel border-intel/40 bg-intel/10",
    tips: [
      "Move to highest floor; avoid basements and lifts.",
      "Turn off mains power if water enters outlets.",
      "Drink only sealed water; avoid wading in unknown depth.",
      "Signal with torch/whistle toward boats or roofs.",
    ],
  },
  {
    id: "fire",
    title: "Fire & smoke",
    icon: Flame,
    color: "text-emergency border-emergency/40 bg-emergency/10",
    tips: [
      "Stay low under smoke; wet cloth over nose and mouth if available.",
      "Feel doors before opening; use stairs never lifts.",
      "If trapped, seal door gaps with cloth and signal window.",
    ],
  },
  {
    id: "quake",
    title: "Shake / collapse risk",
    icon: AlertTriangle,
    color: "text-warning border-warning/40 bg-warning/10",
    tips: [
      "Drop, cover under solid table, hold on until shaking stops.",
      "After shocks: check gas; do not use open flame if smell gas.",
      "If outside, move away from buildings and wires.",
    ],
  },
];

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

async function shareMapsLink(fix: GeoFix, title: string) {
  const url = mapsUrl(fix.lat, fix.lng);
  const text = `${title}\n${url}`;
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      toast.success("Shared");
      return;
    }
  } catch {
    /* user cancelled or failed */
  }
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Link copied — paste into WhatsApp or SMS");
  } catch {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }
}

/** Google Maps directions from route origin → destination (GeoJSON [lng,lat]). */
function routeDirectionsUrl(r: RescueRouteDoc): string | null {
  const oc = r.origin?.coordinates;
  const dc = r.destination?.coordinates;
  if (!oc || !dc || oc.length < 2 || dc.length < 2) return null;
  return `https://www.google.com/maps/dir/${oc[1]},${oc[0]}/${dc[1]},${dc[0]}`;
}

const TEAM_TAGS = ["RAPID-7", "BRAVO-3", "AIR-LIFT", "MARINE-2", "MED-CREW"] as const;

function teamCallsignForRoute(r: RescueRouteDoc, index: number): string {
  const raw = r._id || "route";
  const tail = raw.slice(-4).toUpperCase().replace(/[^0-9A-F]/g, "0") || "0000";
  return `KAVACH-${TEAM_TAGS[index % TEAM_TAGS.length]}-${tail}`;
}

/** Visual “deployment heat” from corridor hazards + ETA + safety (demo-style, not a real ops metric). */
function deploymentIntensity(r: RescueRouteDoc): number {
  const blocks = r.blockedRoads?.length ?? 0;
  const safety = r.safetyScore ?? 72;
  const quick = (r.durationMin ?? 99) <= 30 ? 22 : 0;
  const raw = 36 + blocks * 14 + quick + Math.max(0, 85 - safety) * 0.5;
  return Math.min(100, Math.round(raw));
}

function playWhistleBurst() {
  if (typeof window === "undefined") return;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) {
    toast.message("Audio not supported");
    return;
  }
  const ctx = new Ctx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 880;
  gain.gain.value = 0.12;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  setTimeout(() => {
    osc.stop();
    void ctx.close();
  }, 700);
  toast.success("Distress tone played");
}

function btnPrimary(className?: string) {
  return cn(
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-md transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emergency sm:min-h-11",
    className,
  );
}

export function CitizenApp() {
  const [tab, setTab] = useState<TabId>("home");
  const qc = useQueryClient();
  const { fix, error: geoError, pending: geoPending, copyCoords } = useCitizenGeolocation(true);
  const { displayName, setDisplayName, deviceId, iceContact, setIceContact, medicalLine, setMedicalLine, checklist, toggleChecklist } =
    useCitizenStore();
  const submitSos = useSubmitSos();

  useEffect(() => {
    useCitizenStore.getState().ensureDeviceFromClient();
  }, []);

  const locationPoint = fix
    ? ({ type: "Point" as const, coordinates: [fix.lng, fix.lat] as [number, number] })
    : null;

  const refreshFeeds = () => {
    void qc.invalidateQueries({ queryKey: QK.disasters });
    void qc.invalidateQueries({ queryKey: QK.shelters });
    void qc.invalidateQueries({ queryKey: QK.alerts });
    toast.message("Refreshing…");
  };

  const sendSos = async (opts: { message: string; photo?: string | null; silent?: boolean; includeMedical?: boolean }) => {
    useCitizenStore.getState().ensureDeviceFromClient();
    const id = useCitizenStore.getState().deviceId;
    const med = medicalLine.trim();
    if (!locationPoint) {
      toast.error("Turn on location so responders can find you.");
      navigateTab(setTab, "home");
      return;
    }
    let msg =
      opts.silent && !opts.message.trim()
        ? "[SILENT SOS] Location ping only — citizen may be unable to speak."
        : opts.message.trim() || "EMERGENCY — need immediate help. Citizen SOS from KAVACH app.";
    if (opts.includeMedical && med) msg += `\n[MEDICAL NOTE FOR RESPONDERS: ${med}]`;
    try {
      await submitSos.mutateAsync({
        senderId: id,
        senderName: displayName.trim() || "Citizen",
        message: msg,
        location: locationPoint,
        channel: "online",
        ...(opts.photo ? { photoThumbnail: opts.photo } : {}),
      });
      toast.success("Your signal was sent to the response grid.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send — try again");
    }
  };

  return (
    <div
      className={cn(
        "dark relative min-h-dvh overflow-x-hidden bg-background bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,oklch(0.28_0.08_235/0.35),transparent)] text-foreground",
        "pb-[calc(4.75rem+env(safe-area-inset-bottom))] sm:pb-[calc(5.25rem+env(safe-area-inset-bottom))]",
      )}
    >
      <Toaster richColors position="top-center" />

      <header className="sticky top-0 z-40 border-b border-white/10 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[min(100%-1.25rem,28rem)] flex-col gap-3 px-3 py-3 sm:max-w-xl sm:flex-row sm:items-center sm:justify-between sm:px-4 md:max-w-2xl md:py-4 lg:max-w-3xl xl:max-w-4xl">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-safe sm:text-[11px]">
              <Shield className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" aria-hidden />
              Citizen safety hub
            </div>
            <h1 className="mt-0.5 font-display text-xl font-bold leading-tight tracking-tight sm:text-2xl md:text-3xl">
              KAVACH · <span className="text-safe">You-first</span>
            </h1>
            <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Large buttons, offline-friendly tips, and a login separate from the ops desk (
              <Link to="/" className="font-medium text-intel underline-offset-2 hover:underline">
                command
              </Link>
              ).
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-stretch md:flex-row">
            <button
              type="button"
              onClick={refreshFeeds}
              className={btnPrimary("border border-border/60 bg-surface/80 text-foreground hover:bg-white/10")}
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Refresh</span>
              <span className="sm:hidden">Sync</span>
            </button>
            <Link
              to="/"
              className={btnPrimary("border border-border/60 bg-surface/80 text-center text-foreground hover:bg-white/10")}
            >
              Ops desk
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[min(100%-1.25rem,28rem)] flex-1 px-3 pt-3 sm:max-w-xl sm:px-4 sm:pt-4 md:max-w-2xl md:pt-5 lg:max-w-3xl xl:max-w-4xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="pb-4"
          >
            {tab === "home" && (
              <CitizenHome
                fix={fix}
                geoError={geoError}
                geoPending={geoPending}
                copyCoords={copyCoords}
                checklist={checklist}
                toggleChecklist={toggleChecklist}
                displayName={displayName}
                setDisplayName={setDisplayName}
                iceContact={iceContact}
                setIceContact={setIceContact}
                medicalLine={medicalLine}
                setMedicalLine={setMedicalLine}
                onOpenSos={() => navigateTab(setTab, "sos")}
                onOpenNear={() => navigateTab(setTab, "near")}
              />
            )}
            {tab === "near" && <CitizenNear fix={fix} />}
            {tab === "report" && (
              <CitizenHazardReport
                locationPoint={locationPoint}
                onSubmit={async (o) => {
                  await sendSos({ message: o.message, photo: o.photo, includeMedical: false });
                }}
                isSubmitting={submitSos.isPending}
              />
            )}
            {tab === "sos" && (
              <CitizenSosTab
                fix={fix}
                geoPending={geoPending}
                locationPoint={locationPoint}
                onSharePin={() => fix && void shareMapsLink(fix, "SOS — live location")}
                onCopyCoords={copyCoords}
                onSend={(o) => sendSos({ ...o, includeMedical: o.includeMedical })}
                isSubmitting={submitSos.isPending}
                displayName={displayName}
                setDisplayName={setDisplayName}
                medicalLine={medicalLine}
              />
            )}
            {tab === "more" && <CitizenMore />}
            {tab === "safety" && <CitizenSafetyDashboard fix={fix} />}
            {tab === "loop" && (
              <CitizenInnovationHub
                fix={fix}
                locationPoint={locationPoint}
                onNavigate={(t) => navigateTab(setTab, t)}
                sendSos={sendSos}
                isSubmitting={submitSos.isPending}
                medicalLine={medicalLine}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {tab !== "sos" && (
        <button
          type="button"
          aria-label="Open emergency SOS"
          onClick={() => navigateTab(setTab, "sos")}
          className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] right-3 z-[48] flex h-14 w-14 items-center justify-center rounded-full bg-emergency text-white shadow-[0_8px_32px_oklch(0.55_0.25_22/0.55)] ring-2 ring-emergency/40 transition hover:scale-105 active:scale-95 sm:bottom-[calc(4.75rem+env(safe-area-inset-bottom))] sm:right-5 sm:h-16 sm:w-16"
        >
          <Siren className="h-7 w-7 sm:h-8 sm:w-8" />
        </button>
      )}

      <CitizenBottomNav tab={tab} onChange={(t) => navigateTab(setTab, t)} />
    </div>
  );
}

function CitizenBottomNav({ tab, onChange }: { tab: TabId; onChange: (t: TabId) => void }) {
  const items: { id: TabId; label: string; short: string; icon: typeof Home }[] = [
    { id: "home", label: "Home", short: "Home", icon: Home },
    { id: "safety", label: "Safety AI", short: "Safety", icon: Shield },
    { id: "near", label: "Near me", short: "Near", icon: MapPinned },
    { id: "sos", label: "SOS", short: "SOS", icon: Siren },
    { id: "loop", label: "Full loop", short: "Loop", icon: Waypoints },
    { id: "more", label: "More", short: "More", icon: MoreHorizontal },
  ];
  return (
    <nav
      aria-label="Main sections"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-background/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl"
    >
      <div className="mx-auto grid w-full max-w-[min(100%,40rem)] grid-cols-6 gap-0.5 px-0.5 sm:max-w-2xl sm:gap-0.5 sm:px-1 md:max-w-3xl lg:max-w-4xl">
        {items.map(({ id, label, short, icon: Icon }) => {
          const active = tab === id;
          const sos = id === "sos";
          return (
            <button
              key={id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onChange(id)}
              className={cn(
                "relative flex min-h-[3.1rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 transition sm:min-h-14 sm:rounded-xl sm:px-1 sm:py-2",
                active ? "bg-emergency/15 text-emergency" : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                sos && active && "bg-emergency/25",
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0 sm:h-6 sm:w-6", sos && "sm:h-7 sm:w-7")} aria-hidden />
              <span className="max-w-[4.5rem] truncate text-[8px] font-bold uppercase tracking-tight sm:max-w-full sm:text-[10px] sm:tracking-wide">{short}</span>
              <span className="sr-only">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function CitizenRescueCoordinationStrip({
  routes,
  isLoading,
  isError,
  trainedPreview,
}: {
  routes: RescueRouteDoc[] | undefined;
  isLoading: boolean;
  isError: boolean;
  trainedPreview?: boolean;
}) {
  const list = routes ?? [];
  const active = list.filter((r) => r.status === "active");

  return (
    <section
      id="citizen-rescue-coord"
      className="scroll-mt-24 rounded-2xl border border-orange-500/25 bg-gradient-to-br from-orange-950/25 via-background to-background p-4 shadow-md ring-1 ring-orange-500/10 sm:rounded-3xl sm:p-5 lg:col-span-12"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/20 ring-1 ring-orange-400/40">
            <Truck className="h-5 w-5 text-orange-200" aria-hidden />
          </div>
          <div>
            <h2 className="font-display text-base font-bold tracking-tight text-foreground sm:text-lg">Rescue coordination</h2>
            <p className="mt-1 max-w-prose text-xs text-muted-foreground sm:text-sm">
              Official corridors your command desk publishes — same feed as the ops “Rescue Coordination” board. Open in Maps when you
              need turn-by-turn along a published path.
            </p>
            {trainedPreview && !isLoading && !isError && (
              <p className="mt-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] font-medium leading-snug text-amber-100">
                <span className="font-bold uppercase tracking-wide text-amber-200">Trained preview dataset</span> — API returned no routes yet,
                so you are seeing three fixed corridors (two active, one blocked) for judge demos. They disappear automatically when dispatch saves
                real rows.
              </p>
            )}
          </div>
        </div>
        <span className="rounded-full border border-orange-400/35 bg-orange-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-200">
          {isLoading ? "Syncing…" : isError ? "Auth / network" : `${active.length} active`}
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/35 to-background/80 p-4 ring-1 ring-emerald-500/15">
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-emerald-200">
            <Sparkles className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
            Rescue yourself first
          </p>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-emerald-100/90 sm:text-sm">
            <li className="flex gap-2">
              <span className="font-black text-emerald-400">1.</span>
              Reach the safest level or roof you can defend for 30+ minutes — water rises faster than it looks.
            </li>
            <li className="flex gap-2">
              <span className="font-black text-emerald-400">2.</span>
              Flash a light or bright cloth toward sound / rotor wash so crews can pick you out from clutter.
            </li>
            <li className="flex gap-2">
              <span className="font-black text-emerald-400">3.</span>
              Tap <strong className="text-foreground">SOS</strong> only for life threat; the live teams below match corridors dispatch is actually running.
            </li>
          </ul>
        </div>

        <div className="relative overflow-hidden rounded-xl border-2 border-red-500/45 bg-gradient-to-br from-red-950/70 via-orange-950/50 to-black p-4 shadow-[0_0_32px_rgba(220,38,38,0.22)] ring-1 ring-orange-400/30">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-red-500/20 blur-2xl" aria-hidden />
          <p className="relative flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-red-100">
            <Flame className="h-4 w-4 shrink-0 animate-pulse text-orange-300" aria-hidden />
            Active rescue footprint
            <span className="ml-auto inline-flex items-center gap-1 rounded border border-red-400/50 bg-red-600/30 px-2 py-0.5 text-[9px] font-bold tracking-wide text-white">
              <Zap className="h-3 w-3" aria-hidden />
              LIVE
            </span>
          </p>
          <p className="relative mt-1 text-[10px] font-medium text-orange-100/80">
            Synthetic call signs mapped to each <strong className="text-white">active corridor</strong> so you can picture who is staged on the same path the desk published.
          </p>

          <div className="relative mt-3 max-h-[220px] space-y-2 overflow-y-auto pr-1 sm:max-h-[260px]">
            {isLoading && (
              <p className="text-xs font-semibold text-orange-200/90">Uplinking deployment roster…</p>
            )}
            {isError && (
              <p className="text-xs text-amber-100/95">
                Sign in on <strong className="text-white">More</strong> to decrypt the same JWT roster the coordination floor sees.
              </p>
            )}
            {!isLoading && !isError && active.length === 0 && (
              <div className="rounded-lg border border-white/15 bg-black/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-black tracking-tight text-white">KAVACH-CITY-CELL-01</span>
                  <span className="shrink-0 rounded bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase text-orange-200">Standby</span>
                </div>
                <p className="mt-1 text-[11px] text-orange-100/75">No live corridor right now — district cell is monitoring. If you are trapped, use SOS immediately.</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/50">
                  <div className="h-full w-[38%] rounded-full bg-gradient-to-r from-orange-400 to-amber-500" />
                </div>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-orange-200/80">Deployment heat · 38%</p>
              </div>
            )}
            {!isLoading &&
              !isError &&
              active.map((r, i) => {
                const heat = deploymentIntensity(r);
                const callsign = teamCallsignForRoute(r, i);
                const eta = r.durationMin != null ? `${Math.round(r.durationMin)} min leg` : "ETA syncing";
                const href = routeDirectionsUrl(r);
                return (
                  <div
                    key={r._id}
                    className="rounded-lg border border-red-500/35 bg-black/45 p-3 shadow-inner ring-1 ring-orange-500/20"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-black leading-tight tracking-tight text-white drop-shadow-[0_0_8px_rgba(251,146,60,0.35)]">
                          {callsign}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] font-semibold text-orange-100/90">{r.name?.trim() || "Active corridor"}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="inline-flex items-center gap-1 rounded border border-orange-400/40 bg-orange-600/25 px-2 py-0.5 text-[9px] font-black uppercase text-orange-50">
                          <Users className="h-3 w-3" aria-hidden />
                          Hot
                        </span>
                        {href && (
                          <a href={href} target="_blank" rel="noreferrer" className="text-[9px] font-bold text-sky-300 underline-offset-2 hover:underline">
                            Trace path
                          </a>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] font-mono text-orange-200/85">
                      {eta} · safety {r.safetyScore != null ? Math.round(r.safetyScore) : "—"} · hazards {(r.blockedRoads?.length ?? 0) || "0"}
                    </p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/60 ring-1 ring-red-500/30">
                      <div
                        className={cn(
                          "h-full rounded-full bg-gradient-to-r transition-all",
                          heat >= 72 ? "from-red-500 to-orange-400" : heat >= 48 ? "from-orange-500 to-amber-400" : "from-amber-500 to-yellow-300",
                        )}
                        style={{ width: `${heat}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[9px] font-black uppercase tracking-[0.2em] text-red-200/90">Deployment heat · {heat}%</p>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading rescue routes…</p>}
      {isError && (
        <p className="mt-4 text-sm text-warning">
          Sign in on <strong className="text-foreground">More</strong> with your citizen account so this device can read the same JWT-protected
          route list as the coordination desk.
        </p>
      )}
      {!isLoading && !isError && list.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          No published corridors yet. When dispatch saves a calculated route in command, it will appear here automatically.
        </p>
      )}
      {!isLoading && !isError && list.length > 0 && (
        <ul className="mt-4 space-y-3">
          {list.slice(0, 6).map((r) => {
            const href = routeDirectionsUrl(r);
            const st = r.status ?? "active";
            return (
              <li
                key={r._id}
                className="flex flex-col gap-2 rounded-xl border border-border/50 bg-surface/40 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{r.name?.trim() || "Corridor"}</span>
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                        st === "active" && "bg-warning/20 text-warning",
                        st === "blocked" && "bg-emergency/20 text-emergency",
                        st === "completed" && "bg-safe/20 text-safe",
                      )}
                    >
                      {st}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.distanceKm != null ? `${r.distanceKm.toFixed(1)} km` : "—"} · {r.durationMin != null ? `${Math.round(r.durationMin)} min` : "—"} ·
                    safety {r.safetyScore != null ? Math.round(r.safetyScore) : "—"}
                    {(r.blockedRoads?.length ?? 0) > 0 && (
                      <span className="text-emergency"> · {r.blockedRoads?.length} hazard mark(s)</span>
                    )}
                  </p>
                </div>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      btnPrimary("shrink-0 border border-intel/50 bg-intel/15 text-intel hover:bg-intel/25"),
                      "text-xs sm:text-sm",
                    )}
                  >
                    <MapPinned className="h-4 w-4" />
                    Open in Maps
                    <ExternalLink className="h-3.5 w-3.5 opacity-80" />
                  </a>
                ) : (
                  <span className="text-[11px] text-muted-foreground">No origin/destination pins</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function CitizenHome({
  fix,
  geoError,
  geoPending,
  copyCoords,
  checklist,
  toggleChecklist,
  displayName,
  setDisplayName,
  iceContact,
  setIceContact,
  medicalLine,
  setMedicalLine,
  onOpenSos,
  onOpenNear,
}: {
  fix: GeoFix | null;
  geoError: string | null;
  geoPending: boolean;
  copyCoords: () => Promise<boolean>;
  checklist: Record<ChecklistId, boolean>;
  toggleChecklist: (id: ChecklistId) => void;
  displayName: string;
  setDisplayName: (v: string) => void;
  iceContact: string;
  setIceContact: (v: string) => void;
  medicalLine: string;
  setMedicalLine: (v: string) => void;
  onOpenSos: () => void;
  onOpenNear: () => void;
}) {
  const { data: alerts } = useActiveAlerts();
  const { data: disasters } = useDisasters({ limit: 40 });
  const { data: shelters } = useShelters();
  const { data: rescueRoutesRaw, isLoading: rescueRoutesLoading, isError: rescueRoutesErr } = useRescueRoutes();
  const { routes: rescueRoutesDisplay, isTrainedFallback: rescueTrainedPreview } = useMemo(
    () => getRescueRoutesForDisplay(rescueRoutesRaw as RescueRouteDoc[] | undefined, rescueRoutesLoading, rescueRoutesErr),
    [rescueRoutesRaw, rescueRoutesLoading, rescueRoutesErr],
  );

  const nearbyCritical = useMemo(() => {
    if (!fix || !disasters?.length) return [];
    const scored = (disasters as { _id: string; title?: string; severity?: string; location?: { coordinates?: number[] } }[])
      .map((d) => {
        const c = d.location?.coordinates;
        if (!c || c.length < 2) return { d, km: Infinity };
        const km = distanceKm(fix.lat, fix.lng, c[1], c[0]);
        return { d, km };
      })
      .filter((x) => x.km < 100 && (x.d.severity === "critical" || x.d.severity === "high" || x.d.severity === "medium"))
      .sort((a, b) => a.km - b.km)
      .slice(0, 5);
    return scored;
  }, [disasters, fix]);

  const done = CHECKLIST_META.filter((m) => checklist[m.id]).length;
  const pct = Math.round((done / CHECKLIST_META.length) * 100);

  const imSafe = async () => {
    const name = displayName.trim() || "Citizen";
    const loc = fix ? mapsUrl(fix.lat, fix.lng) : "Location unavailable";
    const text = `I'm safe — ${name}. Last known: ${loc}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("“I'm safe” message copied — send to family or groups");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
      <CitizenSituationHub
        fix={fix}
        geoPending={geoPending}
        disasters={(disasters ?? []) as { _id: string; title?: string; severity?: string; location?: { coordinates?: number[] } }[]}
        shelters={(shelters ?? []) as { _id: string; name?: string; location?: { coordinates?: number[] } }[]}
        alerts={(alerts ?? []) as { _id: string; type?: string; severity?: string }[]}
        readinessPct={pct}
        iceContact={iceContact}
        displayName={displayName}
        onOpenNear={onOpenNear}
        onOpenSos={onOpenSos}
        rescueRoutes={rescueRoutesDisplay}
        rescueRoutesLoading={rescueRoutesLoading}
        rescueRoutesError={rescueRoutesErr}
        rescueTrainedPreview={rescueTrainedPreview}
        className="lg:col-span-12"
      />

      <CitizenRescueCoordinationStrip
        routes={rescueRoutesDisplay}
        isLoading={rescueRoutesLoading}
        isError={rescueRoutesErr}
        trainedPreview={rescueTrainedPreview}
      />

      <section
        id="citizen-3d-twin"
        className="scroll-mt-24 rounded-2xl border-2 border-violet-500/25 bg-gradient-to-b from-violet-950/20 to-background p-1 shadow-[0_0_40px_rgba(109,40,217,0.12)] ring-1 ring-white/5 sm:rounded-3xl sm:p-2 lg:col-span-12"
      >
        <CitizenDigitalTwin
          fix={fix}
          disasters={(disasters ?? []) as { _id: string; title?: string; severity?: string; location?: { coordinates?: number[] } }[]}
          shelters={(shelters ?? []) as { _id: string; name?: string; location?: { coordinates?: number[] } }[]}
          showcase
        />
      </section>

      {/* Hero status */}
      <section className="overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/20 via-background to-background p-4 shadow-lg ring-1 ring-white/5 sm:rounded-3xl sm:p-5 lg:col-span-7">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-violet-200/90">Live position</p>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Used for SOS, reports, and “near me”.</p>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider sm:text-[11px]",
              fix ? "border-safe/50 bg-safe/15 text-safe" : geoPending ? "border-intel/50 bg-intel/10 text-intel" : "border-warning/50 bg-warning/10 text-warning",
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", fix ? "animate-pulse bg-safe" : "bg-warning")} />
            {fix ? "GPS lock" : geoPending ? "Locating…" : "No fix"}
          </span>
        </div>
        {geoError && <p className="mt-3 text-sm text-warning">{geoError}</p>}
        {fix && (
          <p className="mt-3 break-all font-mono text-sm leading-relaxed text-foreground sm:text-base">
            {fix.lat.toFixed(5)}°, {fix.lng.toFixed(5)}°
            {fix.accuracy != null && <span className="text-muted-foreground"> · ±{Math.round(fix.accuracy)} m</span>}
          </p>
        )}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 md:grid-cols-4">
          <button
            type="button"
            disabled={!fix}
            onClick={async () => {
              const ok = await copyCoords();
              toast[ok ? "success" : "error"](ok ? "Coordinates copied" : "Copy failed");
            }}
            className={btnPrimary("border border-border/60 bg-surface/90 disabled:opacity-40")}
          >
            <ClipboardCopy className="h-4 w-4 shrink-0" />
            Copy GPS
          </button>
          <button
            type="button"
            disabled={!fix}
            onClick={() => fix && void shareMapsLink(fix, "My location")}
            className={btnPrimary("border border-intel/50 bg-intel/15 text-intel hover:bg-intel/25 disabled:opacity-40")}
          >
            <Share2 className="h-4 w-4 shrink-0" />
            Share map
          </button>
          <button type="button" onClick={playWhistleBurst} className={btnPrimary("border border-warning/50 bg-warning/15 text-warning hover:bg-warning/25")}>
            <Volume2 className="h-4 w-4 shrink-0" />
            Distress tone
          </button>
          <button type="button" onClick={imSafe} className={btnPrimary("border border-safe/50 bg-safe/20 text-safe hover:bg-safe/30")}>
            <Heart className="h-4 w-4 shrink-0" />
            I&apos;m safe (copy)
          </button>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" onClick={onOpenSos} className={btnPrimary("bg-emergency text-white hover:bg-red-600")}>
            <Siren className="h-5 w-5 shrink-0" />
            Emergency SOS
          </button>
          <button type="button" onClick={onOpenNear} className={btnPrimary("border border-border/60 bg-surface/90")}>
            <MapPinned className="h-4 w-4 shrink-0" />
            Shelters & incidents
          </button>
        </div>
      </section>

      {/* Side column on large screens */}
      <div className="space-y-4 sm:space-y-5 lg:col-span-5">
        <section className="rounded-2xl border border-violet-500/15 bg-surface/50 p-4 shadow-sm ring-1 ring-white/5 sm:p-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-violet-200/80">Your details</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Name (for responders)
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="min-h-11 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              ICE phone
              <input
                id="citizen-ice"
                value={iceContact}
                onChange={(e) => setIceContact(e.target.value)}
                inputMode="tel"
                className="min-h-11 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="mt-3 grid gap-1 text-xs font-medium text-muted-foreground">
            Medical one-liner (blood type, allergies — appended to SOS)
            <input
              value={medicalLine}
              onChange={(e) => setMedicalLine(e.target.value)}
              placeholder="e.g. O+ · penicillin allergy"
              className="min-h-11 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
            />
          </label>
          {iceContact.replace(/\D/g, "").length >= 8 && (
            <a
              href={`tel:${iceContact.replace(/\s/g, "")}`}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-intel/40 px-4 py-2 text-sm font-semibold text-intel hover:bg-intel/10"
            >
              <Phone className="h-4 w-4" />
              Call ICE
            </a>
          )}
        </section>

        <section id="citizen-gobag" className="scroll-mt-28 rounded-2xl border border-safe/40 bg-safe/10 p-4 ring-1 ring-safe/20 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-bold sm:text-base">
              <LifeBuoy className="h-5 w-5 text-safe" />
              Go-bag
            </h2>
            <div className="flex items-center gap-2">
              <div className="relative h-10 w-10 shrink-0">
                <svg className="-rotate-90 h-10 w-10" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" className="stroke-white/10" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    className="stroke-safe"
                    strokeWidth="3"
                    strokeDasharray={`${pct * 0.94} 94`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-safe">{pct}%</span>
              </div>
            </div>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {CHECKLIST_META.map(({ id, label }) => (
              <li key={id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-transparent px-1 py-1 hover:border-border/40 hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={checklist[id]}
                    onChange={() => toggleChecklist(id)}
                    className="h-5 w-5 rounded border-border accent-safe"
                  />
                  <span className="text-sm leading-snug">{label}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div id="citizen-alerts" className="scroll-mt-28 lg:col-span-12">
        {alerts && alerts.length > 0 ? (
          <section className="rounded-2xl border border-emergency/40 bg-emergency/10 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-emergency sm:text-base">
            <Sparkles className="h-4 w-4" />
            Official alerts
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(alerts as { _id: string; type?: string; location?: string; severity?: string }[]).map((a) => (
              <li key={a._id} className="rounded-xl border border-emergency/25 bg-background/50 p-3 text-sm">
                <span className="font-semibold">{a.type ?? "Alert"}</span>
                {a.location && <p className="mt-1 text-xs text-muted-foreground">{a.location}</p>}
                {a.severity && <span className="mt-2 inline-block text-[10px] font-bold uppercase text-emergency">{a.severity}</span>}
              </li>
            ))}
          </ul>
        </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-border/60 bg-surface/25 p-5 text-center text-sm text-muted-foreground">
            No active official alerts right now.
          </section>
        )}
      </div>

      {nearbyCritical.length > 0 && (
        <section className="rounded-2xl border border-warning/40 bg-warning/10 p-4 sm:p-5 lg:col-span-12">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-bold text-warning sm:text-base">
              <AlertTriangle className="h-5 w-5" />
              Hazards near you
            </h2>
            <button type="button" onClick={onOpenNear} className="text-xs font-bold uppercase tracking-wide text-intel underline-offset-2 hover:underline sm:text-sm">
              Open map list
            </button>
          </div>
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {nearbyCritical.map(({ d, km }) => (
              <li key={d._id} className="rounded-xl border border-border/50 bg-background/40 p-3">
                <span className="font-medium">{d.title ?? d.severity}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  ~{km === Infinity ? "?" : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-border/60 bg-surface/30 p-4 text-xs leading-relaxed text-muted-foreground sm:p-5 sm:text-sm lg:col-span-12">
        <strong className="text-foreground">Offline tip:</strong> screenshot this page after filling your details. If networks fail, move to higher ground in floods and use the distress tone sparingly.
      </section>
    </div>
  );
}

function CitizenNear({ fix }: { fix: GeoFix | null }) {
  const { data: shelters, isLoading, isError, refetch } = useShelters();
  const { data: disasters, isLoading: dLoad, isError: dErr } = useDisasters({ limit: 50 });
  const [mode, setMode] = useState<"shelters" | "incidents">("shelters");

  const rankedShelters = useMemo(() => {
    if (!shelters?.length) return [];
    const list = shelters as {
      _id: string;
      name: string;
      address?: string;
      capacity?: number;
      occupancy?: number;
      occupied?: number;
      status?: string;
      location?: { coordinates?: number[] };
    }[];
    if (!fix) return list.slice(0, 24).map((s) => ({ s, km: null as number | null }));
    return list
      .map((s) => {
        const c = s.location?.coordinates;
        if (!c || c.length < 2) return { s, km: null as number | null };
        return { s, km: distanceKm(fix.lat, fix.lng, c[1], c[0]) };
      })
      .sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9))
      .slice(0, 24);
  }, [shelters, fix]);

  const rankedIncidents = useMemo(() => {
    if (!disasters?.length) return [];
    const list = disasters as { _id: string; title?: string; severity?: string; type?: string; location?: { coordinates?: number[] } }[];
    if (!fix) return list.slice(0, 20).map((d) => ({ d, km: null as number | null }));
    return list
      .map((d) => {
        const c = d.location?.coordinates;
        if (!c || c.length < 2) return { d, km: null as number | null };
        return { d, km: distanceKm(fix.lat, fix.lng, c[1], c[0]) };
      })
      .sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9))
      .slice(0, 20);
  }, [disasters, fix]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold sm:text-xl">Near me</h2>
          <p className="text-xs text-muted-foreground sm:text-sm">{fix ? "Sorted by distance from your GPS." : "Enable GPS for distance sorting."}</p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className={btnPrimary("self-start border border-border/60 bg-surface/80 sm:self-auto")}
        >
          <RefreshCw className="h-4 w-4" />
          Reload
        </button>
      </div>

      <div className="flex gap-2 rounded-xl border border-border/60 bg-surface/40 p-1 sm:inline-flex sm:p-1.5">
        {(["shelters", "incidents"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "min-h-11 flex-1 rounded-lg px-4 py-2 text-sm font-bold capitalize transition sm:flex-none sm:px-6",
              mode === m ? "bg-emergency/20 text-emergency" : "text-muted-foreground hover:bg-white/5",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === "shelters" && (
        <>
          {isLoading && <p className="text-sm text-muted-foreground">Loading shelters…</p>}
          {isError && <p className="text-sm text-emergency">Could not load shelters.</p>}
          <div className="rounded-2xl border border-border/50 bg-surface/20 p-2 sm:p-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
              {rankedShelters.map(({ s, km }) => {
                const occ = s.occupancy ?? s.occupied ?? 0;
                const cap = s.capacity ?? 1;
                const pct = Math.min(100, Math.round((occ / cap) * 100));
                return (
                  <article key={s._id} className="rounded-xl border border-border/60 bg-background/60 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-snug">{s.name}</h3>
                      {km != null && <span className="shrink-0 rounded-md bg-intel/15 px-2 py-0.5 font-mono text-xs text-intel">{km.toFixed(1)} km</span>}
                    </div>
                    {s.address && <p className="mt-2 text-xs text-muted-foreground">{s.address}</p>}
                    <p className="mt-2 text-xs">
                      Occupancy <span className="font-mono font-bold">{occ}</span> / {cap}{" "}
                      <span className={pct >= 95 ? "text-emergency" : pct >= 80 ? "text-warning" : "text-safe"}>({pct}%)</span>
                    </p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full bg-intel transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    {s.status && <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">{s.status}</p>}
                  </article>
                );
              })}
            </div>
          </div>
        </>
      )}

      {mode === "incidents" && (
        <>
          {dLoad && <p className="text-sm text-muted-foreground">Loading incidents…</p>}
          {dErr && <p className="text-sm text-emergency">Could not load incidents.</p>}
          <div className="rounded-2xl border border-border/50 bg-surface/20 p-2 sm:p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {rankedIncidents.map(({ d, km }) => (
                <article key={d._id} className="rounded-xl border border-border/60 bg-background/60 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-snug">{d.title ?? d.type ?? "Incident"}</h3>
                    {km != null && <span className="shrink-0 font-mono text-xs text-warning">{km.toFixed(1)} km</span>}
                  </div>
                  {d.severity && <span className="mt-2 inline-block text-[10px] font-bold uppercase text-emergency">{d.severity}</span>}
                </article>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CitizenHazardReport({
  locationPoint,
  onSubmit,
  isSubmitting,
}: {
  locationPoint: { type: "Point"; coordinates: [number, number] } | null;
  onSubmit: (o: { message: string; photo?: string | null }) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [tag, setTag] = useState<(typeof HAZARD_TAGS)[number]["id"]>("flood");
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [footprintIdx, setFootprintIdx] = useState(1);
  const [evidence, setEvidence] = useState<Record<string, boolean>>({});
  const [compassOn, setCompassOn] = useState(false);
  const [heading, setHeading] = useState<number | null>(null);
  const [speechListening, setSpeechListening] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!compassOn) return;
    const onOrient = (e: DeviceOrientationEvent) => {
      const ev = e as DeviceOrientationEvent & { webkitCompassHeading?: number };
      const w = ev.webkitCompassHeading;
      if (typeof w === "number" && !Number.isNaN(w)) {
        setHeading(((w % 360) + 360) % 360);
        return;
      }
      if (e.alpha != null && !Number.isNaN(e.alpha)) {
        setHeading(((360 - e.alpha) % 360 + 360) % 360);
      }
    };
    window.addEventListener("deviceorientation", onOrient, true);
    return () => window.removeEventListener("deviceorientation", onOrient, true);
  }, [compassOn]);

  const onFile = async (f: FileList | null) => {
    const file = f?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setBusy(true);
    try {
      setPhoto(await compressImageToDataUrl(file, { maxWidth: 1200, quality: 0.7 }));
      toast.success("Photo attached");
    } catch {
      toast.error("Could not process image");
    } finally {
      setBusy(false);
    }
  };

  const label = HAZARD_TAGS.find((t) => t.id === tag)?.label ?? tag;
  const footprintM = HAZARD_FOOTPRINT_M[footprintIdx] ?? 100;

  const toggleEvidence = (id: string) => {
    setEvidence((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const enableCompass = async () => {
    try {
      const DO = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<PermissionState> };
      if (typeof DO.requestPermission === "function") {
        const p = await DO.requestPermission();
        if (p !== "granted") {
          toast.error("Compass permission denied");
          return;
        }
      }
      setCompassOn(true);
      toast.success("Heading on — align top of phone toward the hazard");
    } catch {
      toast.error("Could not enable compass on this device");
    }
  };

  const appendVoiceToText = (chunk: string) => {
    setText((prev) => (prev.trim() ? `${prev.trim()} ${chunk}` : chunk));
  };

  const buildMessage = () => {
    let body = text.trim();
    const evLabels = HAZARD_EVIDENCE_CHIPS.filter((c) => evidence[c.id]).map((c) => c.label);
    if (evLabels.length) body += `${body ? " " : ""}[Frame checklist: ${evLabels.join(", ")}]`;
    body += `${body ? " " : ""}[Scene footprint ~${footprintM} m]`;
    if (compassOn && heading != null) body += ` [Device heading ~${Math.round(heading)}° from N]`;
    return `[HAZARD · ${label}] ${body}`;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 sm:space-y-5">
      <div>
        <h2 className="text-xl font-bold sm:text-2xl">Photo hazard report</h2>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Framed evidence, optional heading, and a footprint hint help dispatch triage without guessing.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {HAZARD_TAGS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTag(t.id)}
            className={cn(
              "min-h-10 rounded-full border px-3 py-2 text-xs font-semibold sm:min-h-11 sm:px-4 sm:text-sm",
              tag === t.id ? "border-intel bg-intel/20 text-intel" : "border-border/60 text-muted-foreground hover:bg-white/5",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-intel/30 bg-intel/5 p-4 ring-1 ring-intel/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-intel">Evidence checklist</p>
          {compassOn && heading != null && (
            <span className="inline-flex items-center gap-1 rounded-full border border-intel/40 bg-background/80 px-2 py-1 font-mono text-[10px] text-intel">
              <Compass className="h-3 w-3" aria-hidden />
              {Math.round(heading)}°
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {HAZARD_EVIDENCE_CHIPS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleEvidence(c.id)}
              className={cn(
                "min-h-9 rounded-lg border px-3 py-1.5 text-xs font-semibold transition sm:text-sm",
                evidence[c.id] ? "border-intel bg-intel/25 text-intel" : "border-border/50 text-muted-foreground hover:bg-white/5",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
            Visible scene size (rough)
            <input
              type="range"
              min={0}
              max={HAZARD_FOOTPRINT_M.length - 1}
              step={1}
              value={footprintIdx}
              onChange={(e) => setFootprintIdx(Number(e.target.value))}
              className="accent-intel"
            />
            <span className="text-[11px] text-foreground">~{footprintM} m across frame</span>
          </label>
          {!compassOn ? (
            <button type="button" onClick={() => void enableCompass()} className={btnPrimary("shrink-0 border border-intel/50 bg-intel/15 text-intel")}>
              <Compass className="h-4 w-4" />
              Use heading
            </button>
          ) : (
            <button type="button" onClick={() => { setCompassOn(false); setHeading(null); }} className="text-xs font-semibold text-muted-foreground underline">
              Stop heading
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Street, landmark, people at risk, access…"
          className="min-h-[8rem] w-full flex-1 rounded-2xl border border-border/60 bg-background px-4 py-3 text-sm sm:text-base"
        />
        <button
          type="button"
          disabled={speechListening}
          onClick={() => trySpeechRecognition(appendVoiceToText, setSpeechListening)}
          className={btnPrimary(
            cn(
              "shrink-0 border border-border/60 bg-surface/90 sm:flex-col",
              speechListening && "animate-pulse border-intel/60 bg-intel/20",
            ),
          )}
          aria-label="Speak to fill description"
        >
          <Mic className="h-5 w-5" />
          Voice
        </button>
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onFile(e.target.files)} />
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className={btnPrimary("border border-intel/50 bg-intel/15 text-intel")}
        >
          <Camera className="h-5 w-5" />
          {photo ? "Change photo" : "Add photo"}
        </button>
        {photo && (
          <button type="button" onClick={() => setPhoto(null)} className="min-h-11 text-sm text-muted-foreground underline">
            Remove photo
          </button>
        )}
      </div>
      {photo && (
        <div className="relative w-full overflow-hidden rounded-2xl border border-border/60 bg-black/80">
          <img src={photo} alt="Preview with alignment frame" className="max-h-72 w-full object-contain" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative aspect-[4/3] w-[78%] max-w-lg">
              <span className="absolute left-0 top-0 h-7 w-7 border-l-2 border-t-2 border-cyan-400/95 shadow-[0_0_14px_rgba(34,211,238,0.45)] sm:h-9 sm:w-9" />
              <span className="absolute right-0 top-0 h-7 w-7 border-r-2 border-t-2 border-cyan-400/95 shadow-[0_0_14px_rgba(34,211,238,0.45)] sm:h-9 sm:w-9" />
              <span className="absolute bottom-0 left-0 h-7 w-7 border-b-2 border-l-2 border-cyan-400/95 shadow-[0_0_14px_rgba(34,211,238,0.45)] sm:h-9 sm:w-9" />
              <span className="absolute bottom-0 right-0 h-7 w-7 border-b-2 border-r-2 border-cyan-400/95 shadow-[0_0_14px_rgba(34,211,238,0.45)] sm:h-9 sm:w-9" />
              <div className="absolute inset-0 rounded-sm border border-cyan-400/25" />
              <p className="absolute -top-7 left-1/2 flex -translate-x-1/2 items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-cyan-200/95">
                <Crosshair className="h-3 w-3" aria-hidden />
                Align key detail
              </p>
            </div>
          </div>
        </div>
      )}
      <button
        type="button"
        disabled={isSubmitting || busy || !text.trim()}
        onClick={() => onSubmit({ message: buildMessage(), photo })}
        className={btnPrimary("w-full bg-intel text-white hover:opacity-95 disabled:opacity-40")}
      >
        {isSubmitting ? "Sending…" : "Send hazard report"}
      </button>
      {!locationPoint && <p className="text-center text-sm text-warning">Turn on location to attach GPS.</p>}
    </div>
  );
}

function CitizenSosTab({
  fix,
  geoPending,
  locationPoint,
  onSharePin,
  onCopyCoords,
  onSend,
  isSubmitting,
  displayName,
  setDisplayName,
  medicalLine,
}: {
  fix: GeoFix | null;
  geoPending: boolean;
  locationPoint: { type: "Point"; coordinates: [number, number] } | null;
  onSharePin: () => void;
  onCopyCoords: () => Promise<boolean>;
  onSend: (o: { message: string; photo?: string | null; silent?: boolean; includeMedical: boolean }) => Promise<void>;
  isSubmitting: boolean;
  displayName: string;
  setDisplayName: (v: string) => void;
  medicalLine: string;
}) {
  const [msg, setMsg] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [appendMed, setAppendMed] = useState(true);
  const [speechListening, setSpeechListening] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const urgency = useMemo(() => sosUrgencyHint(msg), [msg]);

  const onFile = async (f: FileList | null) => {
    const file = f?.[0];
    if (!file?.type.startsWith("image/")) return;
    setBusy(true);
    try {
      setPhoto(await compressImageToDataUrl(file, { maxWidth: 960, quality: 0.68 }));
      toast.success("Photo attached");
    } catch {
      toast.error("Photo failed");
    } finally {
      setBusy(false);
    }
  };

  const appendVoice = (chunk: string) => {
    setMsg((prev) => (prev.trim() ? `${prev.trim()} ${chunk}` : chunk));
  };

  const appendTimePing = () => {
    const stamp = new Date().toISOString();
    const line = `[${stamp}] Live ping — still need help at this GPS.`;
    setMsg((prev) => (prev.trim() ? `${prev.trim()}\n${line}` : line));
    toast.message("Timestamp line added for responders");
  };

  return (
    <div className="mx-auto max-w-xl space-y-5 pb-6 sm:space-y-6">
      <div className="rounded-3xl border-2 border-emergency/60 bg-gradient-to-b from-emergency/20 to-background p-5 text-center shadow-[0_0_40px_oklch(0.55_0.2_22/0.25)] sm:p-8">
        <Siren className="mx-auto h-14 w-14 text-emergency sm:h-16 sm:w-16" />
        <p className="mt-4 text-base font-semibold sm:text-lg">Emergency SOS</p>
        <p className="mt-2 text-sm text-muted-foreground">Real emergencies only. False alerts delay rescue for others.</p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider sm:text-[11px]",
              fix ? "border-safe/50 bg-safe/15 text-safe" : geoPending ? "border-intel/50 bg-intel/10 text-intel" : "border-warning/50 bg-warning/10 text-warning",
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", fix ? "animate-pulse bg-safe" : "bg-warning")} />
            {fix ? "GPS lock" : geoPending ? "Locating…" : "No fix"}
          </span>
          {fix && (
            <span className="font-mono text-[10px] text-muted-foreground sm:text-xs">
              {fix.lat.toFixed(4)}°, {fix.lng.toFixed(4)}°
              {fix.accuracy != null && <span className="text-muted-foreground"> · ±{Math.round(fix.accuracy)} m</span>}
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            disabled={!fix}
            onClick={() => onSharePin()}
            className={btnPrimary("border border-intel/50 bg-intel/15 text-intel disabled:opacity-40")}
          >
            <Share2 className="h-4 w-4" />
            Share live pin
          </button>
          <button
            type="button"
            disabled={!fix}
            onClick={async () => {
              const ok = await onCopyCoords();
              toast[ok ? "success" : "error"](ok ? "Coordinates copied for SMS" : "Copy failed");
            }}
            className={btnPrimary("border border-border/60 bg-background/80 disabled:opacity-40")}
          >
            <ClipboardCopy className="h-4 w-4" />
            Copy GPS
          </button>
          <button type="button" onClick={appendTimePing} className={btnPrimary("border border-warning/40 bg-warning/10 text-warning")}>
            <RefreshCw className="h-4 w-4" />
            Time ping
          </button>
        </div>

        <p className="mt-3 text-left text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
          Stay visible: flash a light or wave toward sound if it is safe. Help often arrives in waves — a second ping with the time button
          tells dispatch you are still there.
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {SOS_TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => setMsg(t.text)}
              className="min-h-10 rounded-full border border-border/60 bg-background/80 px-3 py-2 text-xs font-semibold hover:border-emergency/50 hover:bg-emergency/10 sm:text-sm"
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="mt-3 text-left text-xs font-medium text-muted-foreground">Group context (appends to message)</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {SOS_GROUP_CHIPS.map((g) => (
            <button
              key={g.label}
              type="button"
              onClick={() =>
                setMsg((prev) => {
                  const needle = g.suffix.replace(/^[·\s]+/, "");
                  if (prev.includes(needle)) return prev;
                  return prev.trim() ? `${prev.trim()}${g.suffix}` : needle;
                })
              }
              className="min-h-9 rounded-full border border-border/50 bg-background/60 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:border-safe/40 hover:text-foreground sm:text-xs"
            >
              {g.label}
            </button>
          ))}
        </div>

        <label className="mt-5 block text-left text-xs font-medium text-muted-foreground">
          Your name (optional)
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 min-h-12 w-full rounded-xl border border-border/60 bg-background px-4 py-3 text-sm"
          />
        </label>

        <div className="mt-3 rounded-xl border border-border/50 bg-background/40 p-3 text-left">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Message strength</p>
          <p className="mt-1 text-xs text-foreground">{urgency.label}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div className={cn("h-full rounded-full transition-all", urgency.tone)} style={{ width: `${urgency.bar}%` }} />
          </div>
        </div>

        <label className="mt-3 block text-left text-xs font-medium text-muted-foreground">
          What happened?
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              rows={4}
              className="min-h-[6rem] w-full flex-1 rounded-xl border border-border/60 bg-background px-4 py-3 text-sm"
            />
            <button
              type="button"
              disabled={speechListening}
              onClick={() => trySpeechRecognition(appendVoice, setSpeechListening)}
              className={cn(
                btnPrimary("shrink-0 border border-border/60 bg-background/90 sm:w-28 sm:flex-col"),
                speechListening && "animate-pulse border-intel/50 bg-intel/15",
              )}
              aria-label="Speak to fill SOS text"
            >
              <Mic className="h-4 w-4" />
              Voice
            </button>
          </div>
        </label>
        {medicalLine.trim() && (
          <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={appendMed} onChange={(e) => setAppendMed(e.target.checked)} className="h-4 w-4 accent-safe" />
            Include medical line from Home
          </label>
        )}

        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onFile(e.target.files)} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className={cn(btnPrimary("mt-4 w-full border border-border/60 bg-background/90"), "sm:w-full")}>
          <Camera className="h-4 w-4" />
          {photo ? "Change scene photo" : "Attach scene photo"}
        </button>
        {photo && <img src={photo} alt="" className="mt-4 max-h-48 w-full rounded-xl object-contain" />}

        <button
          type="button"
          disabled={isSubmitting || !locationPoint}
          onClick={() => onSend({ message: msg, photo, includeMedical: appendMed })}
          className={cn(
            btnPrimary("mt-5 w-full bg-emergency py-4 text-base text-white hover:bg-red-600"),
            fix && !msg.trim() && "ring-2 ring-emergency/35 ring-offset-2 ring-offset-background/90",
            "sm:text-lg",
          )}
        >
          {isSubmitting ? "Sending…" : "SEND EMERGENCY SOS"}
        </button>
        <button
          type="button"
          disabled={isSubmitting || !locationPoint}
          onClick={() => onSend({ message: msg, photo, silent: true, includeMedical: appendMed })}
          className="mt-3 w-full min-h-12 rounded-xl border border-intel/50 py-3 text-sm font-bold text-intel hover:bg-intel/10"
        >
          Silent SOS
        </button>
        {!locationPoint && <p className="mt-3 text-sm text-warning">GPS required — check Home tab.</p>}
      </div>
    </div>
  );
}

function CitizenAccountCard() {
  const [loginEmail, setLoginEmail] = useState("citizen@resqai.in");
  const [loginPassword, setLoginPassword] = useState("citizen123");
  const [signedInEmail, setSignedInEmail] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return readStoredToken("citizen") ? localStorage.getItem(CITIZEN_AUTH_EMAIL_KEY) : null;
  });
  const login = useLogin({ role: "citizen" });

  const syncSession = () => {
    if (typeof window === "undefined") return;
    const t = readStoredToken("citizen");
    if (!t) {
      setSignedInEmail(null);
      return;
    }
    const em = localStorage.getItem(CITIZEN_AUTH_EMAIL_KEY);
    setSignedInEmail(em ?? "Citizen session");
  };

  useEffect(() => {
    syncSession();
  }, []);

  return (
    <section className="rounded-2xl border border-intel/40 bg-intel/5 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <LogIn className="h-5 w-5 text-intel" />
        Citizen account
      </h2>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
        JWT is stored separately from ops (<code className="text-foreground/90">kavach.token.citizen</code> vs{" "}
        <code className="text-foreground/90">kavach.token.ops</code>).
      </p>
      {signedInEmail ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm sm:text-base">
            Signed in as <span className="font-mono font-semibold text-safe">{signedInEmail}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              clearAuthToken("citizen");
              try {
                localStorage.removeItem(CITIZEN_AUTH_EMAIL_KEY);
              } catch {
                /* ignore */
              }
              syncSession();
              toast.success("Signed out");
            }}
            className={btnPrimary("border border-border/60 bg-background/80")}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            type="email"
            autoComplete="username"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            className="min-h-12 rounded-xl border border-border/60 bg-background px-4 py-3 text-sm"
            placeholder="Email"
          />
          <input
            type="password"
            autoComplete="current-password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            className="min-h-12 rounded-xl border border-border/60 bg-background px-4 py-3 text-sm"
            placeholder="Password"
          />
          <button
            type="button"
            disabled={login.isPending || !loginEmail.trim() || !loginPassword}
            onClick={() =>
              login.mutate(
                { email: loginEmail.trim(), password: loginPassword },
                {
                  onSuccess: () => {
                    try {
                      localStorage.setItem(CITIZEN_AUTH_EMAIL_KEY, loginEmail.trim());
                    } catch {
                      /* ignore */
                    }
                    syncSession();
                    toast.success("Signed in");
                  },
                  onError: (e) => toast.error(e instanceof Error ? e.message : "Login failed"),
                },
              )
            }
            className={cn(btnPrimary("bg-intel text-white sm:col-span-2"), "w-full")}
          >
            {login.isPending ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-[11px] text-muted-foreground sm:col-span-2">
            Seed user: <span className="font-mono">citizen@resqai.in</span> / <span className="font-mono">citizen123</span>
          </p>
        </div>
      )}
    </section>
  );
}

function BatteryHint() {
  const [lvl, setLvl] = useState<number | null>(null);
  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number }> };
    if (!nav.getBattery) return;
    let cancelled = false;
    void nav.getBattery().then((b) => {
      if (!cancelled) setLvl(Math.round(b.level * 100));
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (lvl == null) return null;
  return (
    <section className="rounded-2xl border border-border/60 bg-surface/40 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Battery className="h-4 w-4 text-warning" />
        Phone battery ~{lvl}%
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Lower screen brightness and close other apps during a crisis.</p>
    </section>
  );
}

function CitizenMore() {
  const [paste, setPaste] = useState("");
  const [result, setResult] = useState<{ is_misinformation: boolean; confidence: number; reason: string } | null>(null);
  const check = useCheckMisinformation();

  return (
    <div className="space-y-5 sm:space-y-6 lg:mx-auto lg:max-w-3xl">
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold sm:text-xl">
          <BookOpen className="h-5 w-5 text-safe" />
          Survival guides
        </h2>
        <div className="grid gap-2 sm:gap-3">
          {SURVIVAL_GUIDES.map((g) => {
            const Icon = g.icon;
            return (
              <Collapsible key={g.id} className="group rounded-2xl border border-border/60 bg-surface/40">
                <CollapsibleTrigger className="flex min-h-14 w-full items-center justify-between gap-2 px-4 py-3 text-left font-semibold hover:bg-white/5 data-[state=open]:[&_.chev]:rotate-180 sm:px-5">
                  <span className="flex items-center gap-2">
                    <Icon className={cn("h-5 w-5", g.color.split(" ")[0])} />
                    {g.title}
                  </span>
                  <ChevronDown className="chev h-4 w-4 shrink-0 text-muted-foreground transition" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="space-y-2 border-t border-border/40 px-4 py-3 text-sm text-muted-foreground sm:px-5">
                    {g.tips.map((t, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="font-mono text-intel">·</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </section>

      <BatteryHint />

      <CitizenAccountCard />

      <section className="rounded-2xl border border-border/60 bg-surface/40 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <MessageCircleWarning className="h-5 w-5 text-warning" />
          Rumour check
        </h2>
        <p className="mt-2 text-xs text-muted-foreground sm:text-sm">Paste viral text. AI estimates misinformation risk (not legal advice).</p>
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={5}
          className="mt-3 min-h-[7rem] w-full rounded-xl border border-border/60 bg-background px-4 py-3 text-sm"
        />
        <button
          type="button"
          disabled={paste.trim().length < 8 || check.isPending}
          onClick={() =>
            check.mutate(paste, {
              onSuccess: (data) => {
                const d = data as { is_misinformation?: boolean; confidence?: number; reason?: string };
                setResult({
                  is_misinformation: !!d.is_misinformation,
                  confidence: d.confidence ?? 0,
                  reason: d.reason ?? "",
                });
              },
              onError: (e) => toast.error(e instanceof Error ? e.message : "NLP offline"),
            })
          }
          className={btnPrimary("mt-3 w-full bg-warning/25 font-bold text-warning hover:bg-warning/35")}
        >
          {check.isPending ? "Checking…" : "Analyse text"}
        </button>
        {result && (
          <div className="mt-4 rounded-xl border border-border/60 bg-background/80 p-4 text-sm">
            <p className="font-bold">{result.is_misinformation ? "Flagged as risky" : "Not flagged"}</p>
            <p className="text-xs text-muted-foreground">Confidence {Math.round(result.confidence * 100)}%</p>
            <p className="mt-2 text-xs leading-relaxed">{result.reason}</p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border/60 bg-surface/40 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Stethoscope className="h-5 w-5 text-safe" />
          Emergency numbers
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { n: "112", d: "National emergency", href: "tel:112" },
            { n: "108", d: "Ambulance", href: "tel:108" },
            { n: "101", d: "Fire", href: "tel:101" },
          ].map((x) => (
            <a
              key={x.n}
              href={x.href}
              className="flex min-h-[4.5rem] flex-col items-center justify-center rounded-2xl border border-intel/40 bg-intel/10 py-4 text-center font-mono text-2xl font-bold text-intel transition hover:bg-intel/20"
            >
              {x.n}
              <span className="mt-1 px-2 text-[11px] font-sans font-normal leading-tight text-muted-foreground">{x.d}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-surface/30 p-4 text-xs text-muted-foreground sm:text-sm">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Users className="h-4 w-4 text-intel" />
          Group safety
        </div>
        <p className="mt-2">Use <strong className="text-foreground">Share map</strong> on Home to send your pin. Agree on a family word to confirm identity over phone.</p>
      </section>
    </div>
  );
}
