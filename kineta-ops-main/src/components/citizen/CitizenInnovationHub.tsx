/**
 * Citizen “full loop” hub — hackathon-style innovations wired to real APIs where available.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Brain,
  Camera,
  ChevronDown,
  ChevronRight,
  Compass,
  ExternalLink,
  HeartHandshake,
  MapPin,
  MessageCircle,
  Radio,
  Route,
  Search,
  Send,
  Siren,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { GeoFix } from "@/hooks/useCitizenGeolocation";
import {
  QK,
  useActiveAlerts,
  useDisasters,
  usePanicMeter,
  useRescueRoutes,
  useShelters,
  useSocialPosts,
  useSosReports,
} from "@/hooks/useBackendData";
import { socialApi, type RescueRouteDoc } from "@/lib/api";
import { getRescueRoutesForDisplay } from "@/lib/rescueTrainedDemo";
import { compressImageToDataUrl } from "@/lib/imageCompress";
import { nlpClassifyApi, type ClassifyResult } from "@/lib/nlpApi";
import { distanceKm, cn } from "@/lib/utils";
import { useCitizenStore } from "@/store/useCitizenStore";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export type CitizenInnovationTab =
  | "home"
  | "near"
  | "report"
  | "sos"
  | "more"
  | "loop";

function directionsUrl(from: GeoFix, toLat: number, toLng: number) {
  return `https://www.google.com/maps/dir/${from.lat},${from.lng}/${toLat},${toLng}`;
}

function tokenize(s: string) {
  return s
    .toLowerCase()
    .split(/[^a-z0-9\u0900-\u097F]+/g)
    .filter((w) => w.length > 2);
}

function overlapScore(query: string, corpus: string) {
  const q = new Set(tokenize(query));
  if (!q.size) return 0;
  const c = tokenize(corpus);
  if (!c.length) return 0;
  let hit = 0;
  for (const w of c) {
    if (q.has(w)) hit++;
  }
  return hit / Math.sqrt(q.size * Math.min(c.length, 48));
}

function btnGhost() {
  return cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs font-semibold transition hover:bg-white/10 sm:text-sm",
  );
}

function btnAccent(className?: string) {
  return cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow-md transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-intel",
    className,
  );
}

export function CitizenInnovationHub({
  fix,
  locationPoint,
  onNavigate,
  sendSos,
  isSubmitting,
  medicalLine,
}: {
  fix: GeoFix | null;
  locationPoint: { type: "Point"; coordinates: [number, number] } | null;
  onNavigate: (t: CitizenInnovationTab) => void;
  sendSos: (o: { message: string; photo?: string | null; silent?: boolean; includeMedical?: boolean }) => Promise<void>;
  isSubmitting: boolean;
  medicalLine: string;
}) {
  const { data: alerts } = useActiveAlerts();
  const { data: disasters } = useDisasters({ limit: 40 });
  const { data: shelters } = useShelters();
  const { data: sosFeed } = useSosReports({ limit: 50 });
  const { data: socialPosts, isError: socialErr } = useSocialPosts({ limit: 40 });
  const { data: routesRaw, isError: routesErr, isLoading: routesLoading } = useRescueRoutes();
  const { routes: routesDisplay, isTrainedFallback: routesTrainedPreview } = useMemo(
    () => getRescueRoutesForDisplay(routesRaw as RescueRouteDoc[] | undefined, routesLoading, routesErr),
    [routesRaw, routesLoading, routesErr],
  );
  const { data: panic } = usePanicMeter();
  const qc = useQueryClient();

  const panicStats =
    panic && typeof panic === "object"
      ? (panic as unknown as { overallPanic?: number; byType?: unknown[] })
      : null;

  const nearestShelter = useMemo(() => {
    if (!fix || !shelters?.length) return null;
    type S = { _id: string; name: string; location?: { coordinates?: number[] } };
    let best: { s: S; km: number } | null = null;
    for (const s of shelters as S[]) {
      const c = s.location?.coordinates;
      if (!c || c.length < 2) continue;
      const km = distanceKm(fix.lat, fix.lng, c[1], c[0]);
      if (!best || km < best.km) best = { s, km };
    }
    return best;
  }, [shelters, fix]);

  const nearestHazard = useMemo(() => {
    if (!fix || !disasters?.length) return null;
    type D = { _id: string; title?: string; severity?: string; location?: { coordinates?: number[] } };
    let best: { d: D; km: number } | null = null;
    for (const d of disasters as D[]) {
      const c = d.location?.coordinates;
      if (!c || c.length < 2) continue;
      const km = distanceKm(fix.lat, fix.lng, c[1], c[0]);
      if (!best || km < best.km) best = { d, km };
    }
    return best;
  }, [disasters, fix]);

  const [aiBusy, setAiBusy] = useState(false);
  const [lastCard, setLastCard] = useState<ClassifyResult | null>(null);
  const shakePeak = useRef(0);

  const ingestSensor = useMutation({
    mutationFn: async (text: string) => {
      useCitizenStore.getState().ensureDeviceFromClient();
      const author = useCitizenStore.getState().deviceId;
      await socialApi.ingestPost({ text, platform: "manual", author });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK.socialPosts });
      toast.success("Anonymized sensor snapshot ingested — feeds your city model.");
    },
    onError: (e: Error) => toast.error(e.message || "Need citizen sign-in (More tab) for sensor upload."),
  });

  const [sensorOn, setSensorOn] = useState(false);
  const [motionTick, setMotionTick] = useState(0);
  useEffect(() => {
    if (!sensorOn) return;
    const id = window.setInterval(() => setMotionTick((n) => n + 1), 450);
    return () => clearInterval(id);
  }, [sensorOn]);

  useEffect(() => {
    if (!sensorOn) return;
    shakePeak.current = 0;
    const h = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const mag = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0);
      if (mag > shakePeak.current) shakePeak.current = mag;
    };
    window.addEventListener("devicemotion", h);
    return () => window.removeEventListener("devicemotion", h);
  }, [sensorOn]);

  const requestMotion = async () => {
    const DM = window.DeviceMotionEvent as typeof DeviceMotionEvent & {
      requestPermission?: () => Promise<PermissionState>;
    };
    if (typeof DM.requestPermission === "function") {
      try {
        const s = await DM.requestPermission();
        if (s !== "granted") {
          toast.message("Motion permission denied — shake meter limited.");
          return false;
        }
      } catch {
        toast.error("Could not request motion permission.");
        return false;
      }
    }
    return true;
  };

  const oneTapAiSos = async () => {
    if (!locationPoint || !fix) {
      toast.error("Enable GPS on Home first.");
      onNavigate("home");
      return;
    }
    setAiBusy(true);
    setLastCard(null);
    try {
      useCitizenStore.getState().ensureDeviceFromClient();
      const ctxParts = [
        "KAVACH one-tap citizen SOS. Auto context.",
        `GPS ${fix.lat.toFixed(5)},${fix.lng.toFixed(5)}`,
        fix.accuracy != null ? `accuracy_m≈${Math.round(fix.accuracy)}` : "",
        `device_ts=${new Date().toISOString()}`,
        `passive_shake_peak=${shakePeak.current.toFixed(2)}`,
      ];
      const ctx = ctxParts.filter(Boolean).join(" | ");
      let ai: ClassifyResult | null = null;
      try {
        const r = await nlpClassifyApi.one(ctx);
        ai = r.data;
        setLastCard(ai);
      } catch {
        toast.message("NLP service unreachable — sending structured location card only.");
      }
      const card = {
        v: 1,
        kind: "rescue_card",
        ts: new Date().toISOString(),
        gps: { lat: fix.lat, lng: fix.lng, acc_m: fix.accuracy ?? null },
        ai_triage: ai,
        passive_shake_peak: shakePeak.current,
      };
      const msg =
        "ONE-TAP AI SOS — auto context + structured rescue card for coordination desk.\n" +
        `---KAVACH_RESCUE_CARD_JSON---\n${JSON.stringify(card)}\n---END_CARD---`;
      await sendSos({ message: msg, includeMedical: !!medicalLine.trim() });
      toast.success("Rescue card dispatched.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setAiBusy(false);
    }
  };

  const [waTopic, setWaTopic] = useState("flood");
  const [waLang, setWaLang] = useState<"en" | "hi">("hi");
  const [waQ, setWaQ] = useState("");

  const openWhatsAppTutor = async () => {
    const topic =
      waTopic === "flood"
        ? "Flood safety"
        : waTopic === "fire"
          ? "Fire & smoke"
          : waTopic === "quake"
            ? "Earthquake"
            : "General disaster";
    let body = `[KAVACH tutor · ${topic} · ${waLang.toUpperCase()}]\n`;
    if (waQ.trim()) body += `Question: ${waQ.trim()}\n`;
    body += "Please share 3 short steps I should do in the next 10 minutes.";
    try {
      const r = await nlpClassifyApi.one(waQ.trim() || `${topic} safety advice needed`);
      body += `\n\n[AI hint: class=${r.data.label}, disaster=${r.data.is_disaster ? "yes" : "no"}]`;
    } catch {
      /* optional */
    }
    const url = `https://wa.me/?text=${encodeURIComponent(body)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const [mpName, setMpName] = useState("");
  const [mpDesc, setMpDesc] = useState("");

  const matcherHits = useMemo(() => {
    const q = [mpName, mpDesc].filter(Boolean).join(" ");
    if (q.trim().length < 6) return [];
    type Hit = { id: string; score: number; label: string; snippet: string };
    const out: Hit[] = [];
    const push = (id: string, score: number, label: string, snippet: string) => {
      if (score < 0.08) return;
      out.push({ id, score, label, snippet: snippet.slice(0, 160) });
    };
    for (const row of (sosFeed ?? []) as { _id?: string; message?: string; senderName?: string }[]) {
      const text = `${row.message ?? ""} ${row.senderName ?? ""}`;
      push(`sos-${row._id}`, overlapScore(q, text), "SOS / rescue signal", text);
    }
    if (!socialErr && socialPosts) {
      for (const p of socialPosts as { _id: string; text?: string; author?: string }[]) {
        const text = `${p.text ?? ""} ${p.author ?? ""}`;
        push(`soc-${p._id}`, overlapScore(q, text), "Crowd report", text);
      }
    }
    for (const s of (shelters ?? []) as { _id: string; name?: string; address?: string }[]) {
      const blob = `${s.name ?? ""} ${s.address ?? ""}`;
      const w = tokenize(q)[0];
      if (w && blob.toLowerCase().includes(w)) {
        push(`sh-${s._id}`, 0.15, "Shelter / congregation point", blob);
      }
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, 8);
  }, [mpName, mpDesc, sosFeed, socialPosts, socialErr, shelters]);

  const [claimText, setClaimText] = useState("");
  const [claimPhoto, setClaimPhoto] = useState<string | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);
  const claimFileRef = useRef<HTMLInputElement>(null);

  const submitClaim = async () => {
    if (!claimText.trim()) {
      toast.error("Describe damage for your claim packet.");
      return;
    }
    await sendSos({
      message: `[INSURANCE_CLAIM_PACKET]\n${claimText.trim()}\n---\nCitizen attestation: photos attached where applicable. Timestamp ${new Date().toISOString()}.`,
      photo: claimPhoto,
      includeMedical: false,
    });
    toast.success("Claim packet sent as secured report.");
    setClaimText("");
    setClaimPhoto(null);
  };

  const copyClaimJson = () => {
    const pack = {
      v: 1,
      kind: "damage_claim",
      ts: new Date().toISOString(),
      gps: fix ? { lat: fix.lat, lng: fix.lng } : null,
      narrative: claimText.trim(),
      has_photo: !!claimPhoto,
    };
    void navigator.clipboard.writeText(JSON.stringify(pack, null, 2)).then(
      () => toast.success("JSON copied — paste into insurer portal if needed."),
      () => toast.error("Copy failed"),
    );
  };

  const [skyThumb, setSkyThumb] = useState<string | null>(null);
  const skyRef = useRef<HTMLInputElement>(null);

  const flushSensorBatch = useCallback(async () => {
    if (!fix) {
      toast.error("GPS needed to attach coarse grid.");
      return;
    }
    const gridLat = Math.round(fix.lat * 50) / 50;
    const gridLng = Math.round(fix.lng * 50) / 50;
    const text = [
      "KAVACH_PASSIVE_SENSOR_V1",
      `shake_peak=${shakePeak.current.toFixed(3)}`,
      `grid≈${gridLat},${gridLng}`,
      skyThumb ? "sky_photo=attached_thumbnail" : "sky_photo=no",
    ].join(" | ");
    if (skyThumb) {
      try {
        useCitizenStore.getState().ensureDeviceFromClient();
        await socialApi.ingestPost({
          text: `${text}\n[SKY_THUMB]\n${skyThumb.slice(0, 12000)}`,
          platform: "manual",
          author: useCitizenStore.getState().deviceId,
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
        return;
      }
      void qc.invalidateQueries({ queryKey: QK.socialPosts });
      toast.success("Sensor + sky snapshot ingested.");
      setSkyThumb(null);
      return;
    }
    ingestSensor.mutate(text);
  }, [fix, skyThumb, ingestSensor, qc]);

  return (
    <div className="space-y-4 pb-6 sm:space-y-5">
      <header className="rounded-2xl border border-intel/35 bg-gradient-to-br from-intel/15 to-transparent p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-intel/25 text-intel">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold tracking-tight sm:text-xl">Full citizen loop</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Alert → safe route → one-tap AI SOS → WhatsApp tutor → missing-person scan → sensor mesh → damage claim.
              Wired to your backend and NLP where tokens allow; SOS list is public for matching.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={btnGhost()} onClick={() => onNavigate("home")}>
            <MapPin className="h-4 w-4" /> GPS home
          </button>
          <button type="button" className={btnGhost()} onClick={() => onNavigate("sos")}>
            <Siren className="h-4 w-4 text-emergency" /> Classic SOS
          </button>
          <button type="button" className={btnGhost()} onClick={() => onNavigate("more")}>
            <MessageCircle className="h-4 w-4" /> Rumour check
          </button>
        </div>
      </header>

      {/* A — Hyper-local */}
      <CategoryCard title="Hyper-local awareness" icon={Radio} tint="border-safe/40 bg-safe/10">
        <p className="text-xs text-muted-foreground sm:text-sm">
          Official alerts + nearest hazard bubble — same feed the ops desk curates.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {alerts && alerts.length > 0 ? (
            (alerts as { _id: string; type?: string; severity?: string }[]).slice(0, 3).map((a) => (
              <span
                key={a._id}
                className="inline-flex items-center gap-1 rounded-full border border-emergency/40 bg-emergency/15 px-3 py-1 text-[11px] font-bold uppercase text-emergency"
              >
                <Zap className="h-3 w-3" /> {a.type ?? "Alert"} · {a.severity ?? "—"}
              </span>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">No active alerts — stay ready.</span>
          )}
        </div>
        {nearestHazard && fix && (
          <p className="mt-3 text-sm">
            <span className="font-semibold text-warning">Nearest incident:</span>{" "}
            {nearestHazard.d.title ?? nearestHazard.d.severity ?? "Reported"} (~{nearestHazard.km.toFixed(1)} km)
          </p>
        )}
        <button
          type="button"
          className={cn(btnAccent("mt-4 w-full border border-safe/50 bg-safe/20 text-safe hover:bg-safe/30"), "sm:w-auto")}
          onClick={() => onNavigate("near")}
        >
          Open shelters & incidents <ChevronRight className="h-4 w-4" />
        </button>
      </CategoryCard>

      {/* B — Routing */}
      <CategoryCard title="Hazard-aware movement" icon={Route} tint="border-intel/40 bg-intel/10">
        {nearestShelter && fix && nearestShelter.s.location?.coordinates?.length === 2 ? (
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Nearest shelter:</span>{" "}
              <strong>{nearestShelter.s.name}</strong> ({nearestShelter.km.toFixed(1)} km)
            </p>
            <a
              href={directionsUrl(
                fix,
                nearestShelter.s.location.coordinates[1],
                nearestShelter.s.location.coordinates[0],
              )}
              target="_blank"
              rel="noreferrer"
              className={cn(btnAccent("w-full border border-intel/50 bg-intel text-white hover:opacity-95"), "sm:inline-flex")}
            >
              <Compass className="h-4 w-4" /> Turn-by-turn in Maps
              <ExternalLink className="h-3.5 w-3.5 opacity-80" />
            </a>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Enable GPS to compute shelter-aware routing.</p>
        )}
        <div className="mt-4 rounded-xl border border-border/50 bg-background/50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Published rescue corridors</p>
          {routesTrainedPreview && !routesErr && !routesLoading && (
            <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] leading-snug text-amber-100">
              <span className="font-bold text-amber-200">Trained preview</span> — showing three static rows until /routes returns data.
            </p>
          )}
          {routesErr ? (
            <p className="mt-2 text-xs text-warning">Sign in on <strong>More</strong> to load JWT-protected routes.</p>
          ) : routesDisplay && routesDisplay.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs sm:text-sm">
              {routesDisplay.slice(0, 6).map((r) => (
                <li key={r._id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 py-1.5 last:border-0">
                  <span className="min-w-0 font-semibold text-intel">{r.name?.trim() || "Corridor"}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {(r.status ?? "—").toString()}
                    {r.durationMin != null ? ` · ${Math.round(r.durationMin)}m` : ""}
                    {r.distanceKm != null ? ` · ${r.distanceKm.toFixed(1)}km` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">No corridors in the feed yet — command publishes these from Rescue Coordination.</p>
          )}
        </div>
        {panicStats && (
          <p className="mt-3 text-xs text-muted-foreground">
            Crowd / NLP fusion: overall stress{" "}
            <span className="font-mono text-warning">
              {typeof panicStats.overallPanic === "number" ? panicStats.overallPanic.toFixed(2) : "—"}
            </span>{" "}
            · <span className="text-foreground">{Array.isArray(panicStats.byType) ? panicStats.byType.length : 0}</span> signal
            buckets (last hour, JWT may be required).
          </p>
        )}
      </CategoryCard>

      {/* C — AI SOS */}
      <CategoryCard title="One-tap AI SOS + rescue card" icon={Brain} tint="border-emergency/50 bg-emergency/10">
        <p className="text-xs text-muted-foreground sm:text-sm">
          Builds a machine-readable rescue card (GPS, time, passive shake peak, NLP class) and sends it through the same SOS pipe
          your coordination dashboard already consumes.
        </p>
        {lastCard && (
          <div className="mt-3 rounded-xl border border-border/60 bg-background/80 p-3 text-xs">
            <p className="font-bold text-emergency">Last AI triage (preview)</p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              label={lastCard.label} · conf={(lastCard.confidence * 100).toFixed(0)}% · disaster={String(lastCard.is_disaster)}
            </p>
          </div>
        )}
        <button
          type="button"
          disabled={aiBusy || isSubmitting || !locationPoint}
          onClick={() => void oneTapAiSos()}
          className={cn(btnAccent("mt-4 w-full bg-emergency py-4 text-white hover:bg-red-600"), "text-base font-black")}
        >
          {aiBusy || isSubmitting ? "Dispatching…" : "ONE-TAP AI SOS"}
        </button>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Optional: enable “Passive sensors” below first to attach shake intensity to the same card.
        </p>
      </CategoryCard>

      {/* D — WhatsApp tutor */}
      <CategoryCard title="WhatsApp disaster tutor" icon={MessageCircle} tint="border-safe/35 bg-surface/40">
        <p className="text-xs text-muted-foreground sm:text-sm">
          Zero install outreach — opens WhatsApp with a structured question. Optional line from your NLP classify endpoint.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["flood", "fire", "quake", "general"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setWaTopic(t)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-bold capitalize",
                waTopic === t ? "border-safe bg-safe/20 text-safe" : "border-border/60 text-muted-foreground",
              )}
            >
              {t}
            </button>
          ))}
          {(["hi", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setWaLang(l)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-bold uppercase",
                waLang === l ? "border-intel bg-intel/20 text-intel" : "border-border/60 text-muted-foreground",
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <textarea
          value={waQ}
          onChange={(e) => setWaQ(e.target.value)}
          rows={3}
          placeholder="Optional: your situation in one or two lines…"
          className="mt-3 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
        />
        <button type="button" onClick={() => void openWhatsAppTutor()} className={cn(btnAccent("mt-3 w-full bg-[#25D366] text-white hover:opacity-95"))}>
          <Send className="h-4 w-4" /> Open WhatsApp with tutor prompt
        </button>
      </CategoryCard>

      {/* E — Missing person */}
      <CategoryCard title="Missing person AI matcher" icon={Search} tint="border-warning/40 bg-warning/10">
        <p className="text-xs text-muted-foreground sm:text-sm">
          Scores public SOS stream + social posts + shelter names against your description (lexical overlap — upgrade to embeddings
          when you wire a vector DB).
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={mpName}
            onChange={(e) => setMpName(e.target.value)}
            placeholder="Name or nickname"
            className="min-h-11 rounded-xl border border-border/60 bg-background px-3 text-sm"
          />
          <input
            value={mpDesc}
            onChange={(e) => setMpDesc(e.target.value)}
            placeholder="Age, clothes, last seen…"
            className="min-h-11 rounded-xl border border-border/60 bg-background px-3 text-sm sm:col-span-2"
          />
        </div>
        <div className="mt-3 max-h-[min(50vh,22rem)] overflow-y-auto overflow-x-hidden rounded-xl border border-border/50 overscroll-contain">
          <ul className="space-y-2 p-2">
            {matcherHits.length === 0 ? (
              <li className="p-3 text-xs text-muted-foreground">Enter at least a few words to scan feeds.</li>
            ) : (
              matcherHits.map((h) => (
                <li key={h.id} className="rounded-lg border border-border/40 bg-background/60 p-3 text-xs">
                  <div className="flex justify-between gap-2 font-bold">
                    <span className="text-intel">{h.label}</span>
                    <span className="font-mono text-warning">{(h.score * 100).toFixed(0)}%</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{h.snippet}</p>
                </li>
              ))
            )}
          </ul>
        </div>
      </CategoryCard>

      {/* F — Sensors + claim */}
      <CategoryCard title="Citizen sensor mesh + claim packet" icon={Activity} tint="border-intel/30 bg-surface/30">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border/50 bg-background/40 p-3">
            <p className="text-sm font-bold">Passive phone sensors</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Anonymous grid + shake peak + optional sky thumbnail → ingested as <code className="text-[10px]">manual</code> social
              signal for fusion models.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={btnGhost()}
                onClick={() => void requestMotion().then((ok) => ok && setSensorOn(true))}
              >
                Allow motion
              </button>
              <button
                type="button"
                className={cn(btnGhost(), sensorOn && "border-safe text-safe")}
                onClick={() => setSensorOn((v) => !v)}
              >
                {sensorOn ? "Sensing…" : "Start"} shake meter
              </button>
            </div>
            <p className="mt-2 font-mono text-xs" data-motion-rev={motionTick}>
              Peak ‖a‖ ≈ {sensorOn ? shakePeak.current.toFixed(2) : "0.00"} m/s²
            </p>
            <input ref={skyRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void (async () => {
              const f = e.target.files?.[0];
              if (!f?.type.startsWith("image/")) return;
              setClaimBusy(true);
              try {
                setSkyThumb(await compressImageToDataUrl(f, { maxWidth: 640, quality: 0.55 }));
                toast.success("Sky thumbnail ready");
              } catch {
                toast.error("Image failed");
              } finally {
                setClaimBusy(false);
              }
            })()} />
            <button type="button" className={cn(btnGhost(), "mt-2")} onClick={() => skyRef.current?.click()}>
              <Camera className="h-4 w-4" /> Sky / cloud photo
            </button>
            <button
              type="button"
              disabled={ingestSensor.isPending || claimBusy}
              onClick={() => void flushSensorBatch()}
              className={cn(btnAccent("mt-3 w-full border border-intel/50 bg-intel/90 text-white"), "disabled:opacity-40")}
            >
              {ingestSensor.isPending ? "Uploading…" : "Flush anonymized batch"}
            </button>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/40 p-3">
            <p className="text-sm font-bold">Damage → government / insurer packet</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Sends a tagged SOS with narrative + optional photo; copy JSON for portals.
            </p>
            <textarea
              value={claimText}
              onChange={(e) => setClaimText(e.target.value)}
              rows={4}
              placeholder="Structure ID, visible cracks, water line height, meter reading…"
              className="mt-2 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
            />
            <input
              ref={claimFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void (async () => {
                const f = e.target.files?.[0];
                if (!f) return;
                setClaimBusy(true);
                try {
                  setClaimPhoto(await compressImageToDataUrl(f, { maxWidth: 1400, quality: 0.72 }));
                } finally {
                  setClaimBusy(false);
                }
              })()}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={btnGhost()} onClick={() => claimFileRef.current?.click()}>
                Attach damage photo
              </button>
              <button type="button" className={btnGhost()} onClick={copyClaimJson}>
                Copy JSON packet
              </button>
            </div>
            {claimPhoto && <img src={claimPhoto} alt="" className="mt-2 max-h-28 w-full rounded-lg object-cover" />}
            <button
              type="button"
              disabled={isSubmitting || claimBusy}
              onClick={() => void submitClaim()}
              className={cn(btnAccent("mt-3 w-full bg-warning/90 text-warning-foreground hover:opacity-95"), "disabled:opacity-40")}
            >
              {isSubmitting ? "Sending…" : "Submit claim packet"}
            </button>
          </div>
        </div>
      </CategoryCard>

      {/* Extras */}
      <CategoryCard title="Neighbor mesh & micro-tasks" icon={Users} tint="border-border/60 bg-surface/20">
        <ul className="list-inside list-disc space-y-2 text-xs text-muted-foreground sm:text-sm">
          <li>Share your live pin from Home — agree on a family codeword for callbacks.</li>
          <li>Aftershocks: check on elders within 200 m when safe to move.</li>
          <li>Photo hazard tab documents blocked roads for everyone’s routing model.</li>
        </ul>
        <button type="button" className={cn(btnGhost(), "mt-3")} onClick={() => onNavigate("report")}>
          <AlertTriangle className="h-4 w-4 text-warning" /> Open hazard reporter
        </button>
      </CategoryCard>

      <section className="flex items-start gap-2 rounded-xl border border-safe/30 bg-safe/5 p-3 text-xs text-muted-foreground">
        <HeartHandshake className="mt-0.5 h-4 w-4 shrink-0 text-safe" />
        <span>
          This hub is designed for demo clarity. Production hardening: rate limits on sensor ingest, consent banners, and PII
          redaction on the coordination side.
        </span>
      </section>
    </div>
  );
}

function CategoryCard({
  title,
  icon: Icon,
  tint,
  children,
}: {
  title: string;
  icon: typeof Radio;
  tint: string;
  children: ReactNode;
}) {
  return (
    <Collapsible defaultOpen className={cn("rounded-2xl border", tint)}>
      <CollapsibleTrigger className="flex min-h-14 w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-white/[0.04] data-[state=open]:[&_.chev]:rotate-180 sm:px-5">
        <span className="flex items-center gap-2 font-display text-sm font-bold sm:text-base">
          <Icon className="h-5 w-5 shrink-0 text-foreground" />
          {title}
        </span>
        <ChevronDown className="chev h-4 w-4 shrink-0 text-muted-foreground transition" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-white/10 px-4 py-3 sm:px-5 sm:py-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
