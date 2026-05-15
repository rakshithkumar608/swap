/**
 * Citizen “situation twin” — hub + spokes + timeline (inspired by flood-simulation dashboards,
 * adapted to KAVACH data: GPS, shelters, incidents, alerts, readiness, ICE).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Home,
  MapPin,
  Pause,
  Phone,
  Play,
  Shield,
  Truck,
  Warehouse,
} from "lucide-react";
import type { GeoFix } from "@/hooks/useCitizenGeolocation";
import type { RescueRouteDoc } from "@/lib/api";
import { distanceKm, cn } from "@/lib/utils";

type DisasterLite = {
  _id: string;
  title?: string;
  severity?: string;
  location?: { coordinates?: number[] };
};

type ShelterLite = { _id: string; name?: string; location?: { coordinates?: number[] } };
type AlertLite = { _id: string; type?: string; severity?: string };

const SCENARIOS = [
  { label: "Now", sub: "Baseline", intensity: "No scenario stress applied" },
  { label: "Watch", sub: "Low impact", intensity: "Up to ~2 cm local pooling (demo)" },
  { label: "Advisory", sub: "Rising", intensity: "Up to ~10 cm — check drains (demo)" },
  { label: "High", sub: "Serious", intensity: "Up to ~25 cm — avoid underpasses (demo)" },
  { label: "Severe", sub: "Extreme", intensity: "50+ cm possible — evacuate if ordered (demo)" },
] as const;

const VB_W = 640;
const VB_H = 420;
const CX = 320;
const CY = 210;
const R = 150;

function polar(i: number, n: number) {
  const a = -Math.PI / 2 + (i / n) * 2 * Math.PI;
  const x = CX + R * Math.cos(a);
  const y = CY + R * Math.sin(a);
  return { x, y, leftPct: (x / VB_W) * 100, topPct: (y / VB_H) * 100 };
}

export function CitizenSituationHub({
  fix,
  geoPending,
  disasters,
  shelters,
  alerts,
  readinessPct,
  iceContact,
  displayName,
  onOpenNear,
  onOpenSos,
  rescueRoutes,
  rescueRoutesLoading,
  rescueRoutesError,
  rescueTrainedPreview = false,
  className,
}: {
  fix: GeoFix | null;
  geoPending: boolean;
  disasters: DisasterLite[];
  shelters: ShelterLite[];
  alerts: AlertLite[];
  readinessPct: number;
  iceContact: string;
  displayName: string;
  onOpenNear: () => void;
  onOpenSos: () => void;
  rescueRoutes?: RescueRouteDoc[] | null;
  rescueRoutesLoading?: boolean;
  rescueRoutesError?: boolean;
  /** True when UI is showing `TRAINED_RESCUE_CORRIDOR_DATASET` because API returned zero routes. */
  rescueTrainedPreview?: boolean;
  className?: string;
}) {
  const [scenario, setScenario] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setScenario((s) => (s + 1) % SCENARIOS.length), 2200);
    return () => clearInterval(id);
  }, [playing]);

  const metrics = useMemo(() => {
    const shelterList = shelters ?? [];
    const disasterList = disasters ?? [];
    let shelters10 = 0;
    let nearestShelterKm: number | null = null;
    let incidents25 = 0;
    let nearestIncidentKm: number | null = null;
    let worstSev = "";

    if (fix) {
      for (const s of shelterList) {
        const c = s.location?.coordinates;
        if (!c || c.length < 2) continue;
        const km = distanceKm(fix.lat, fix.lng, c[1], c[0]);
        if (km <= 10) shelters10++;
        if (nearestShelterKm == null || km < nearestShelterKm) nearestShelterKm = km;
      }
      for (const d of disasterList) {
        const c = d.location?.coordinates;
        if (!c || c.length < 2) continue;
        const km = distanceKm(fix.lat, fix.lng, c[1], c[0]);
        if (km <= 25) {
          incidents25++;
          if (nearestIncidentKm == null || km < nearestIncidentKm) {
            nearestIncidentKm = km;
            worstSev = d.severity ?? d.title ?? "incident";
          }
        }
      }
    }

    const iceOk = iceContact.replace(/\D/g, "").length >= 8;
    const alertCount = alerts?.length ?? 0;

    return {
      shelters10,
      nearestShelterKm,
      incidents25,
      nearestIncidentKm,
      worstSev,
      iceOk,
      alertCount,
    };
  }, [fix, shelters, disasters, alerts, iceContact]);

  const rescueStats = useMemo(() => {
    const list = rescueRoutes ?? [];
    const active = list.filter((r) => r.status === "active");
    const durations = active.map((r) => r.durationMin).filter((n): n is number => typeof n === "number" && !Number.isNaN(n));
    const bestEta = durations.length ? Math.min(...durations) : null;
    const safetyScores = active.map((r) => r.safetyScore).filter((n): n is number => typeof n === "number" && !Number.isNaN(n));
    const bestSafety = safetyScores.length ? Math.max(...safetyScores) : null;
    return { total: list.length, activeN: active.length, bestEta, bestSafety };
  }, [rescueRoutes]);

  const scrollTo = useCallback((id: string) => () => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const nodes = useMemo(
    () => [
      {
        id: "shelters",
        label: "Shelters",
        icon: Warehouse,
        accent: "from-violet-500/30 to-fuchsia-500/10 border-violet-500/40",
        line: "stroke-violet-400/55",
        primary: fix ? `${metrics.shelters10} within 10 km` : "—",
        secondary:
          metrics.nearestShelterKm != null ? `Nearest ~${metrics.nearestShelterKm < 1 ? `${Math.round(metrics.nearestShelterKm * 1000)} m` : `${metrics.nearestShelterKm.toFixed(1)} km`}` : "No coordinates",
        action: onOpenNear,
      },
      {
        id: "incidents",
        label: "Incidents",
        icon: AlertTriangle,
        accent: "from-amber-500/25 to-orange-600/10 border-amber-500/45",
        line: "stroke-amber-400/50",
        primary: fix ? `${metrics.incidents25} within 25 km` : "—",
        secondary:
          metrics.nearestIncidentKm != null
            ? `Closest ~${metrics.nearestIncidentKm.toFixed(1)} km · ${metrics.worstSev}`
            : "None in range",
        action: onOpenNear,
      },
      {
        id: "alerts",
        label: "Official alerts",
        icon: Bell,
        accent: "from-sky-500/25 to-blue-600/10 border-sky-500/40",
        line: "stroke-sky-400/50",
        primary: `${metrics.alertCount} active`,
        secondary: metrics.alertCount ? "From your command feed" : "None right now",
        action: scrollTo("citizen-alerts"),
      },
      {
        id: "readiness",
        label: "Go-bag",
        icon: Home,
        accent: "from-emerald-500/25 to-teal-600/10 border-emerald-500/40",
        line: "stroke-emerald-400/50",
        primary: `${readinessPct}% packed`,
        secondary: readinessPct >= 80 ? "Strong" : readinessPct >= 40 ? "Keep going" : "Start today",
        action: scrollTo("citizen-gobag"),
      },
      {
        id: "ice",
        label: "ICE contact",
        icon: Phone,
        accent: "from-cyan-500/20 to-indigo-600/10 border-cyan-500/35",
        line: "stroke-cyan-400/45",
        primary: metrics.iceOk ? "On file" : "Missing",
        secondary: metrics.iceOk ? "Scroll to call" : "Add a phone you trust",
        action: scrollTo("citizen-ice"),
      },
      {
        id: "rescue",
        label: "Rescue coordination",
        icon: Truck,
        accent: "from-orange-500/25 to-rose-600/10 border-orange-500/40",
        line: "stroke-orange-400/45",
        primary: rescueRoutesLoading ? "Syncing…" : rescueRoutesError ? "Needs sign-in" : `${rescueStats.activeN} active · ${rescueStats.total} total`,
        secondary: rescueRoutesError
          ? "More tab → citizen JWT for live corridors"
          : rescueTrainedPreview
            ? `Trained preview · ${rescueStats.activeN} active / ${rescueStats.total} demo rows`
            : rescueStats.total === 0
              ? "No published paths yet"
              : rescueStats.activeN > 0 && rescueStats.bestEta != null
                ? `Fastest ~${Math.round(rescueStats.bestEta)} min · peak safety ${Math.round(rescueStats.bestSafety ?? 0)}`
                : "Tap to open corridor list",
        action: scrollTo("citizen-rescue-coord"),
      },
    ],
    [fix, metrics, readinessPct, onOpenNear, scrollTo, rescueRoutesLoading, rescueRoutesError, rescueStats, rescueTrainedPreview],
  );

  const stress = scenario / (SCENARIOS.length - 1);

  type NodeDef = (typeof nodes)[number] & { x?: number; y?: number; leftPct?: number; topPct?: number };

  const NodeCard = ({
    n,
    compact,
  }: {
    n: NodeDef;
    compact?: boolean;
  }) => {
    const Icon = n.icon;
    const hot = n.id === "incidents" && metrics.incidents25 > 0 && scenario >= 2;
    return (
      <button
        type="button"
        onClick={n.action}
        className={cn(
          "group text-left transition",
          compact ? "w-full" : "absolute w-[148px] sm:w-[158px]",
          hot && "ring-2 ring-amber-400/60",
        )}
        style={
          !compact && n.leftPct != null && n.topPct != null
            ? { left: `${n.leftPct}%`, top: `${n.topPct}%`, transform: "translate(-50%, -50%)" }
            : undefined
        }
      >
        <div
          className={cn(
            "rounded-2xl border bg-gradient-to-b p-2.5 shadow-lg backdrop-blur-sm transition group-hover:brightness-110",
            n.accent,
            compact ? "min-h-[108px]" : "min-h-[118px]",
          )}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/35 shadow-inner ring-1 ring-white/10">
            <Icon className={cn("h-5 w-5 text-white/90", hot && "text-amber-200")} aria-hidden />
          </div>
          <p className="mt-2 font-display text-[11px] font-bold uppercase tracking-wide text-white/90">{n.label}</p>
          <p className="mt-0.5 text-[11px] font-semibold leading-tight text-violet-100/95">{n.primary}</p>
          <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-white/55">{n.secondary}</p>
        </div>
      </button>
    );
  };

  const nodesWithPos: NodeDef[] = nodes.map((n, i) => {
    const p = polar(i, nodes.length);
    return { ...n, x: p.x, y: p.y, leftPct: p.leftPct, topPct: p.topPct };
  });

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-b from-[#12101c] via-[#0c0a12] to-[#08060c] shadow-[0_0_60px_rgba(88,28,135,0.12)] sm:rounded-3xl",
        className,
      )}
    >
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/30 ring-1 ring-violet-400/40">
            <Shield className="h-5 w-5 text-violet-200" aria-hidden />
          </div>
          <div>
            <p className="font-display text-sm font-bold tracking-tight text-white sm:text-base">Situation twin</p>
            <p className="text-[11px] text-violet-200/70">One screen: your position and what matters around it</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-stretch gap-2 sm:max-w-xs sm:flex-none sm:items-end">
          <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 ring-1 ring-violet-500/20">
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", fix ? "bg-violet-400 shadow-[0_0_10px_#a78bfa]" : "bg-amber-400")} />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">{displayName.trim() || "Citizen"}</p>
                <p className="truncate text-[10px] text-white/50">
                  {fix
                    ? `${fix.lat.toFixed(4)}°, ${fix.lng.toFixed(4)}°`
                    : geoPending
                      ? "Locating…"
                      : "Location off — enable for twin"}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenSos}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-red-600 px-4 text-xs font-bold uppercase tracking-wide text-white shadow-lg shadow-red-900/40 hover:bg-red-500 sm:text-[11px]"
          >
            Emergency SOS
          </button>
        </div>
      </div>

      {/* Hub desktop */}
      <div className="hidden px-2 pb-2 md:block">
        <div className="relative mx-auto aspect-[640/420] w-full max-w-[640px]">
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet">
            {nodesWithPos.map((n) => (
              <line
                key={n.id}
                x1={CX}
                y1={CY}
                x2={n.x}
                y2={n.y}
                strokeWidth={1.2 + stress * 1.5}
                className={cn(n.line, "transition-[stroke]")}
              />
            ))}
          </svg>

          {/* Center hub */}
          <div
            className="absolute left-1/2 top-[47%] w-[min(92%,200px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-violet-400/50 bg-gradient-to-br from-violet-950/90 via-[#1a1025] to-black/80 p-4 text-center shadow-[0_0_40px_rgba(139,92,246,0.35)]"
            style={{ boxShadow: `0 0 ${32 + scenario * 8}px rgba(139,92,246,${0.25 + stress * 0.15})` }}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/40 ring-2 ring-violet-300/50">
              <MapPin className="h-7 w-7 text-violet-100" aria-hidden />
            </div>
            <p className="mt-2 font-display text-xs font-bold uppercase tracking-[0.2em] text-violet-200/90">You are here</p>
            {fix ? (
              <p className="mt-1 font-mono text-[11px] leading-snug text-white/85">
                {fix.lat.toFixed(4)}°
                <br />
                {fix.lng.toFixed(4)}°
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-amber-200/90">Enable GPS to link spokes to live range checks</p>
            )}
          </div>

          {nodesWithPos.map((n) => (
            <NodeCard key={n.id} n={n} />
          ))}
        </div>
      </div>

      {/* Mobile stack */}
      <div className="md:hidden">
        <div className="mx-auto max-w-md px-4 py-4">
          <div className="rounded-3xl border-2 border-violet-500/45 bg-gradient-to-br from-violet-950/90 to-black/70 p-5 text-center shadow-[0_0_32px_rgba(139,92,246,0.25)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/40 ring-2 ring-violet-300/50">
              <MapPin className="h-7 w-7 text-violet-100" />
            </div>
            <p className="mt-2 text-xs font-bold uppercase tracking-widest text-violet-200">You are here</p>
            {fix ? (
              <p className="mt-2 break-all font-mono text-sm text-white/90">
                {fix.lat.toFixed(5)}°, {fix.lng.toFixed(5)}°
              </p>
            ) : (
              <p className="mt-2 text-sm text-amber-200/90">Turn on location to light up the twin.</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 px-3 pb-4 sm:grid-cols-3 sm:gap-3">
          {nodesWithPos.map((n) => (
            <NodeCard key={n.id} n={n} compact />
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="border-t border-white/10 bg-black/35 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-600 text-black shadow-lg shadow-orange-900/50 ring-2 ring-white/20 hover:brightness-110"
            aria-label={playing ? "Pause scenario" : "Play scenario"}
          >
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="relative h-3 overflow-hidden rounded-full bg-gradient-to-r from-amber-200/30 via-orange-500/50 to-red-600/70">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/25 transition-all duration-500"
                style={{ width: `${(scenario / (SCENARIOS.length - 1)) * 100}%` }}
              />
              <div className="absolute inset-0 flex justify-between px-1">
                {SCENARIOS.map((s, i) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setScenario(i)}
                    className={cn(
                      "group relative flex-1 focus:outline-none",
                      i === scenario && "z-10",
                    )}
                    title={s.sub}
                  >
                    <span
                      className={cn(
                        "mx-auto mt-3 block h-2.5 w-2.5 rounded-full border-2 transition",
                        i === scenario ? "scale-125 border-white bg-white shadow-[0_0_12px_white]" : "border-white/30 bg-black/50 hover:bg-white/30",
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 flex justify-between text-[9px] font-bold uppercase tracking-wider text-white/45 sm:text-[10px]">
              {SCENARIOS.map((s) => (
                <span key={s.label} className="max-w-[3.5rem] truncate text-center sm:max-w-none">
                  {s.label}
                </span>
              ))}
            </div>
          </div>
          <div className="w-full text-right sm:w-auto sm:min-w-[10rem]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-orange-200/80">Intensity (demo)</p>
            <p className="font-display text-lg font-bold leading-tight text-orange-100 sm:text-xl">{SCENARIOS[scenario].intensity}</p>
            <p className="text-[10px] text-white/45">{SCENARIOS[scenario].sub}</p>
          </div>
        </div>
        <p className="mt-3 text-center text-[10px] text-white/40">
          Timeline animates stress for demos only — your live counts above always use real feeds.
        </p>
      </div>
    </section>
  );
}
