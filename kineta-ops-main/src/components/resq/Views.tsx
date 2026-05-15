import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useMemo, lazy, Suspense } from "react";
import { useWebRtcGpsBeacon } from "@/hooks/useWebRtcGpsBeacon";
import { useResqStore, ViewId } from "@/store/useResqStore";
import {
  Activity, AlertOctagon, Brain, Radio, Truck, Home, MessageSquare,
  Mic, Camera, Battery, ShieldAlert, MapPin, ChevronRight,
  EyeOff, Cpu, Siren, Wifi, WifiOff, Link2, ExternalLink,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid } from "recharts";
import {
  useDisasters, useDisasterStats,
  useSosReports, useSosStats, useAcknowledgeSos, useResolveSos, useDispatchSosToRescue,
  useSocialPosts, usePanicMeter,
  useShelters,
  useRescueRoutes,
  useBackendHealth, useNlpHealth,
} from "@/hooks/useBackendData";
import { ClientOnly } from "@/components/ClientOnly";
import type { RescueRouteDoc } from "@/lib/api";
import { getRescueRoutesForDisplay } from "@/lib/rescueTrainedDemo";
import { toast } from "sonner";

const DisasterMapLazy = lazy(() => import("./DisasterMap").then(m => ({ default: m.DisasterMap })));
const DisasterMap = () => (
  <ClientOnly fallback={<div className="absolute inset-0 bg-background flex items-center justify-center text-muted-foreground text-sm">Loading map…</div>}>
    <DisasterMapLazy />
  </ClientOnly>
);

const VIEW_META: Record<ViewId, { title: string; sub: string; icon: React.ComponentType<{ className?: string }> }> = {
  command: { title: "Command Center", sub: "Live disaster operations · digital twin", icon: ShieldAlert },
  intel: { title: "Disaster Intelligence", sub: "AI-fused multi-hazard threat picture", icon: Brain },
  sos: { title: "Live SOS Requests", sub: "Active distress beacons across the grid", icon: Siren },
  rescue: { title: "Rescue Coordination", sub: "Mission control & unit dispatch", icon: Truck },
  social: { title: "AI Social Analytics", sub: "Citizen panic intelligence & sentiment", icon: Brain },
  shelter: { title: "Shelter Intelligence", sub: "Capacity, supply & evacuation flow", icon: Home },
  ghost: { title: "Live Beacon Uplink", sub: "WebRTC data channel · real-time GPS emergency stream", icon: Radio },
  telemetry: { title: "Victim Telemetry & Rescue Visibility", sub: "Who's trapped · who's rescued · who's still missing", icon: Activity },
  beacon: { title: "Emergency Beacon System", sub: "One-tap survival broadcast", icon: AlertOctagon },
  settings: { title: "System Settings", sub: "Modes, permissions & survival presets", icon: Cpu },
};

export function ViewBreadcrumb() {
  const { activeView } = useResqStore();
  const meta = VIEW_META[activeView];
  const Icon = meta.icon;
  return (
    <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground tracking-wider px-3 sm:px-4 py-2 border-b border-border/40 glass shrink-0">
      <span className="text-emergency">KAVACH</span>
      <ChevronRight className="w-3 h-3" />
      <span>OPERATIONS</span>
      <ChevronRight className="w-3 h-3" />
      <span className="text-foreground flex items-center gap-1.5"><Icon className="w-3 h-3 text-emergency" />{meta.title.toUpperCase()}</span>
      <span className="ml-auto hidden sm:flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-safe blink" /> SYSTEMS NOMINAL
      </span>
    </div>
  );
}

export function ActiveView() {
  const { activeView } = useResqStore();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeView}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25 }}
        className="absolute inset-0 flex flex-col"
      >
        {activeView === "command" && (
          <div className="flex-1 relative">
            <Suspense fallback={<LoadingPane label="Loading digital twin…" />}><DisasterMap /></Suspense>
          </div>
        )}
        {activeView === "intel" && <IntelView />}
        {activeView === "sos" && <SOSView />}
        {activeView === "rescue" && <RescueView />}
        {activeView === "social" && <SocialView />}
        {activeView === "shelter" && <ShelterView />}
        {activeView === "ghost" && <GhostView />}
        {activeView === "telemetry" && <TelemetryView />}
        {activeView === "beacon" && <BeaconView />}
        {activeView === "settings" && <SettingsView />}
      </motion.div>
    </AnimatePresence>
  );
}

function LoadingPane({ label }: { label: string }) {
  return <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">{label}</div>;
}

function ViewShell({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 scanlines relative">{children}</div>;
}

/** Parse backend coordinates — handles both [lng,lat] arrays and "lng lat" strings */
function parseCoords(raw: any): [number, number] {
  if (!raw) return [0, 0];
  if (Array.isArray(raw)) return [Number(raw[1]) || 0, Number(raw[0]) || 0]; // GeoJSON [lng,lat] → [lat,lng]
  if (typeof raw === 'string') {
    const parts = raw.split(/[\s,]+/).map(Number);
    return [parts[1] || 0, parts[0] || 0]; // "lng lat" → [lat, lng]
  }
  return [0, 0];
}

function SectionHeader({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-2 mb-2">
      <div>
        <div className="text-[10px] tracking-[0.25em] text-emergency font-bold">{title}</div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

// ================= INTEL =================
function IntelView() {
  const { data: apiDisasters, isLoading, isError } = useDisasters();
  const { data: stats } = useDisasterStats();

  const sevCount = useMemo(() => {
    if (!apiDisasters) return { critical: 0, high: 0, medium: 0 };
    return {
      critical: apiDisasters.filter((i: any) => i.severity === "critical").length,
      high: apiDisasters.filter((i: any) => i.severity === "high").length,
      medium: apiDisasters.filter((i: any) => i.severity === "medium").length,
    };
  }, [apiDisasters]);

  const data = Array.from({ length: 24 }, (_, i) => ({ h: `${i}h`, threat: 30 + Math.sin(i / 2) * 20 + Math.random() * 25 }));
  // Stats from backend
  const bySeverity = (stats as any)?.bySeverity;
  const maxRisk = (stats as any)?.byType?.reduce((m: number, t: any) => Math.max(m, t.avgRisk ?? 0), 0) ?? 0;

  return (
    <ViewShell>
      {isLoading && <div className="text-[10px] text-muted-foreground px-1 pb-1">Loading live data…</div>}
      {isError && (
        <div className="flex items-center gap-2 text-[10px] text-emergency px-1 pb-1">
          <WifiOff className="w-3 h-3" /> Backend offline — connect backend to see data
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="CRITICAL THREATS" value={sevCount.critical} tone="emergency" sub="active right now" />
        <KPI label="HIGH SEVERITY" value={sevCount.high} tone="warning" sub="escalating" />
        <KPI label="AI THREAT INDEX" value={maxRisk || sevCount.critical * 30 + sevCount.high * 15} tone="emergency" sub="risk score" />
        <KPI label="TOTAL ACTIVE" value={(stats as any)?.total ?? (apiDisasters?.length ?? 0)} tone="warning" sub="disasters" />
      </div>
      <div className="glass-strong rounded-xl border border-border/60 p-4">
        <SectionHeader title="MULTI-HAZARD AI THREAT INDEX · 24H" sub="Fused from sensors, satellites & social signals" />
        <div className="h-48">
          <ResponsiveContainer><AreaChart data={data}>
            <defs><linearGradient id="threat" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.72 0.25 22)" stopOpacity={0.6} />
              <stop offset="100%" stopColor="oklch(0.72 0.25 22)" stopOpacity={0} />
            </linearGradient></defs>
            <CartesianGrid stroke="oklch(1 0 0 / 0.05)" />
            <XAxis dataKey="h" tick={{ fill: "oklch(0.6 0.02 250)", fontSize: 10 }} stroke="oklch(0.3 0.03 252)" />
            <YAxis tick={{ fill: "oklch(0.6 0.02 250)", fontSize: 10 }} stroke="oklch(0.3 0.03 252)" />
            <RTooltip contentStyle={{ background: "oklch(0.18 0.02 250)", border: "1px solid oklch(0.3 0.03 252)", fontSize: 11 }} />
            <Area type="monotone" dataKey="threat" stroke="oklch(0.72 0.25 22)" fill="url(#threat)" strokeWidth={2} />
          </AreaChart></ResponsiveContainer>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="glass-strong rounded-xl border border-border/60 p-4">
          <SectionHeader title="ACTIVE INCIDENTS" right={
            <span className="flex items-center gap-1 text-[9px] text-safe"><Wifi className="w-3 h-3" /> LIVE</span>
          } />
          <div className="space-y-2">
            {apiDisasters && apiDisasters.length > 0 ? apiDisasters.slice(0, 6).map((i: any) => {
              const coords = parseCoords(i.location?.coordinates);
              return (
                <IncidentRow key={i._id} i={{
                  id: i._id,
                  type: i.type,
                  position: coords,
                  severity: i.severity,
                  title: i.title,
                  victims: i.affectedPeople,
                  time: new Date(i.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),
                }} />
              );
            }) : (
              <div className="text-[11px] text-muted-foreground py-4 text-center">No active incidents</div>
            )}
          </div>
        </div>
        <div className="glass-strong rounded-xl border border-border/60 p-4">
          <SectionHeader title="AI PREDICTIONS · NEXT 90 MIN" />
          {[
            { t: "Cyclone landfall imminent", d: "Trishna eye projected over Worli ± 8km", c: 94, sev: "critical" },
            { t: "Sealink structural stress", d: "Bandra-Worli: micro-vibration spike 38%", c: 88, sev: "critical" },
            { t: "Shelter overflow risk", d: "Bandra Civic at 100% capacity", c: 76, sev: "high" },
            { t: "Power grid cascade", d: "Western feeder line failure probability", c: 71, sev: "high" },
          ].map((p, i) => (
            <div key={i} className={`p-2.5 rounded border mb-2 ${p.sev === "critical" ? "bg-emergency/10 border-emergency/40" : "bg-warning/10 border-warning/40"}`}>
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-bold">{p.t}</div>
                <span className="text-[10px] font-mono">P {p.c}%</span>
              </div>
              <div className="text-[11px] text-muted-foreground">{p.d}</div>
            </div>
          ))}
        </div>
      </div>
    </ViewShell>
  );
}

function IncidentRow({ i }: {
  i: {
    id: string;
    type: string;
    position: [number, number];
    severity: string;
    title: string;
    victims?: number;
    time: string;
  };
}) {
  const sev = i.severity === "critical" ? "emergency" : i.severity === "high" ? "warning" : "intel";
  return (
    <div className={`p-2.5 rounded border bg-surface/40 border-border/60 flex items-center gap-3`}>
      <span className={`w-2 h-2 rounded-full bg-${sev} blink shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold truncate">{i.title}</div>
        <div className="text-[10px] text-muted-foreground font-mono">{i.id} · {i.type.toUpperCase()} · {i.time}</div>
      </div>
      {i.victims && <span className="text-[11px] font-bold text-emergency">{i.victims} aff.</span>}
    </div>
  );
}

// ================= SOS =================
function SOSView() {
  const { data: apiSos, isLoading, isError } = useSosReports();
  const { data: sosStats } = useSosStats();
  const ack = useAcknowledgeSos();
  const resolve = useResolveSos();
  const dispatchRescue = useDispatchSosToRescue();

  const byStatus = (sosStats as any)?.byStatus as { _id: string; count: number }[] | undefined;
  const findStat = (s: string) => byStatus?.find(b => b._id === s)?.count ?? 0;

  return (
    <ViewShell>
      {isLoading && <div className="text-[10px] text-muted-foreground px-1 pb-1">Loading SOS data…</div>}
      {isError && (
        <div className="flex items-center gap-2 text-[10px] text-emergency px-1 pb-1">
          <WifiOff className="w-3 h-3" /> Backend offline
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KPI label="PENDING" value={findStat('pending')} tone="emergency" sub="active beacons" pulse />
        <KPI label="ACKNOWLEDGED" value={findStat('acknowledged')} tone="intel" />
        <KPI label="RESCUE QUEUE" value={findStat('dispatched')} tone="warning" sub="with field teams" />
        <KPI label="RESOLVED" value={findStat('resolved')} tone="safe" />
        <KPI label="TOTAL · 24H" value={(sosStats as any)?.last24h ?? (apiSos?.length ?? 0)} tone="intel" />
      </div>
      <div className="glass-strong rounded-xl border border-emergency/40 p-4">
        <SectionHeader title="INCOMING DISTRESS BEACONS" sub="DISPATCH hands the case to Rescue Coordination — RESOLVE closes it after the team finishes." right={
          <span className="text-[10px] text-emergency blink flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emergency" />LIVE STREAM
          </span>
        } />
        <div className="space-y-2">
          {apiSos && apiSos.length > 0 ? apiSos.map((i: any) => {
            const coords = parseCoords(i.location?.coordinates);
            const st = i.status as string;
            return (
              <motion.div key={i._id} layout
                className="p-3 rounded-lg border border-emergency/40 bg-emergency/5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="relative w-9 h-9 rounded-full bg-emergency/20 flex items-center justify-center shrink-0">
                  <Siren className="w-4 h-4 text-emergency" />
                  <span className="absolute inset-0 rounded-full pulse-ring text-emergency" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold truncate flex-1">{i.senderName}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      st === 'pending' ? 'bg-emergency/20 text-emergency blink' :
                      st === 'acknowledged' ? 'bg-intel/20 text-intel' :
                      st === 'dispatched' ? 'bg-warning/25 text-warning' : 'bg-safe/20 text-safe'
                    }`}>{st?.toUpperCase()}</span>
                  </div>
                  <div className="text-[11px] text-foreground/85 mt-0.5 line-clamp-2">{i.message}</div>
                  {i.photoThumbnail && (
                    <div className="mt-2">
                      <img
                        src={i.photoThumbnail}
                        alt=""
                        className="max-h-36 max-w-full rounded border border-border/60 object-contain bg-black/20"
                      />
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground font-mono mt-1">
                    {i.channel?.toUpperCase()} · {coords[0].toFixed(4)}, {coords[1].toFixed(4)} · Urgency {Math.round((i.urgencyScore ?? 0) * 100)}%
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 sm:flex-col sm:gap-1 sm:items-end">
                  <button
                    type="button"
                    onClick={() => {
                      dispatchRescue.mutate(i._id, {
                        onSuccess: () => toast.success("Sent to rescue team — check Rescue Coordination queue."),
                        onError: (e: Error) => toast.error(e.message || "Dispatch failed"),
                      });
                    }}
                    disabled={dispatchRescue.isPending || st === 'resolved' || st === 'dispatched'}
                    className="px-3 py-1.5 text-[10px] font-bold tracking-widest rounded bg-warning text-black hover:bg-amber-400 transition disabled:opacity-50"
                  >DISPATCH</button>
                  <button
                    type="button"
                    onClick={() => ack.mutate(i._id)}
                    disabled={ack.isPending || st !== 'pending'}
                    className="px-3 py-1.5 text-[10px] font-bold tracking-widest rounded border border-intel/40 text-intel hover:bg-intel/10 disabled:opacity-50"
                  >ACK</button>
                  <button
                    type="button"
                    onClick={() => {
                      resolve.mutate(i._id, {
                        onSuccess: () => toast.success("Case closed as resolved."),
                        onError: (e: Error) => toast.error(e.message || "Resolve failed"),
                      });
                    }}
                    disabled={resolve.isPending || st === 'resolved'}
                    className="px-3 py-1.5 text-[10px] font-bold tracking-widest rounded bg-safe/20 border border-safe/50 text-safe hover:bg-safe/30 disabled:opacity-50"
                  >RESOLVE</button>
                </div>
              </motion.div>
            );
          }) : (
            <div className="text-[11px] text-muted-foreground py-4 text-center">No SOS reports</div>
          )}
        </div>
      </div>
    </ViewShell>
  );
}

// ================= RESCUE =================
function routeDirectionsUrl(r: RescueRouteDoc): string | null {
  const oc = r.origin?.coordinates;
  const dc = r.destination?.coordinates;
  if (!oc || !dc || oc.length < 2 || dc.length < 2) return null;
  return `https://www.google.com/maps/dir/${oc[1]},${oc[0]}/${dc[1]},${dc[0]}`;
}

function RescueView() {
  const { data: apiRoutes, isLoading, isError } = useRescueRoutes();
  const { data: rescueSosQueue, isLoading: rescueSosLoading } = useSosReports({ status: "dispatched", limit: 30 });
  const resolveSos = useResolveSos();
  const { routes, isTrainedFallback } = useMemo(
    () => getRescueRoutesForDisplay((apiRoutes ?? []) as RescueRouteDoc[], isLoading, isError),
    [apiRoutes, isLoading, isError],
  );

  const activeCount = routes.filter((r) => r.status === "active").length;
  const total = routes.length;
  const hazardPins = routes.reduce((a, r) => a + (r.blockedRoads?.length ?? 0), 0);
  const avgSafety = total ? Math.round(routes.reduce((acc, r) => acc + (r.safetyScore ?? 0), 0) / total) : 0;

  return (
    <ViewShell>
      {isLoading && <div className="text-[10px] text-muted-foreground px-1 pb-1">Loading rescue routes…</div>}
      {isError && (
        <div className="flex items-center gap-2 text-[10px] text-emergency px-1 pb-1">
          <WifiOff className="w-3 h-3" /> Could not load routes — check API / session
        </div>
      )}

      <div className="glass-strong mb-4 rounded-xl border border-warning/45 bg-warning/5 p-4 ring-1 ring-warning/20">
        <SectionHeader
          title="FIELD SOS · RESCUE QUEUE"
          sub="When command hits DISPATCH on Live SOS, the beacon lands here for your rescue desk until RESOLVE closes it."
          right={<span className="text-[9px] font-bold uppercase text-warning">From SOS</span>}
        />
        {rescueSosLoading && <p className="text-[10px] text-muted-foreground">Loading rescue queue…</p>}
        <div className="mt-2 max-h-[min(40vh,360px)] space-y-2 overflow-y-auto">
          {rescueSosQueue && rescueSosQueue.length > 0 ? (
            (rescueSosQueue as { _id: string; senderName?: string; message?: string; location?: { coordinates?: number[] } }[]).map((s) => {
              const coords = parseCoords(s.location?.coordinates);
              const mapsUrl = `https://www.google.com/maps?q=${coords[0]},${coords[1]}`;
              return (
                <div
                  key={s._id}
                  className="flex flex-col gap-2 rounded-lg border border-warning/35 bg-black/35 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-warning">{s.senderName ?? "Citizen"}</p>
                    <p className="mt-0.5 line-clamp-3 text-[11px] leading-snug text-foreground/90">{s.message ?? "—"}</p>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {coords[0].toFixed(4)}, {coords[1].toFixed(4)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5 sm:flex-col">
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-1 rounded border border-intel/40 px-3 py-1.5 text-[10px] font-bold text-intel hover:bg-intel/10"
                    >
                      Maps <ExternalLink className="h-3 w-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        resolveSos.mutate(s._id, {
                          onSuccess: () => toast.success("SOS marked resolved by rescue."),
                          onError: (e: Error) => toast.error(e.message || "Resolve failed"),
                        })
                      }
                      disabled={resolveSos.isPending}
                      className="rounded border border-safe/50 bg-safe/20 px-3 py-1.5 text-[10px] font-bold text-safe hover:bg-safe/30 disabled:opacity-50"
                    >
                      RESOLVE
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            !rescueSosLoading && (
              <p className="py-2 text-center text-[11px] text-muted-foreground">
                No beacons in the rescue queue yet — use <strong className="text-foreground">DISPATCH</strong> on the Live SOS screen.
              </p>
            )
          )}
        </div>
      </div>

      {isTrainedFallback && !isLoading && !isError && (
        <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[10px] font-medium leading-relaxed text-amber-100">
          <span className="font-bold uppercase tracking-wide text-amber-200">Trained preview dataset</span> — /routes returned no documents; showing
          three fixed corridors (two active, one blocked) so Rescue Coordination is not empty for demos. Replaced automatically when routes exist.
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPI label="TOTAL ROUTES" value={total} tone="intel" sub="configured" />
        <KPI label="ACTIVE" value={activeCount} tone="warning" sub="in service" />
        <KPI label="SAFETY AVG" value={avgSafety} tone="safe" sub="score" />
        <KPI label="HAZARD MARKS" value={hazardPins} tone="emergency" sub="on paths" />
      </div>
      <div className="glass-strong rounded-xl border border-border/60 p-4">
        <SectionHeader
          title="RESCUE ROUTES · DISPATCH BOARD"
          sub={
            isTrainedFallback && !isLoading && !isError
              ? "Trained fallback active — live API empty; cards below are static demo geometry."
              : "Geo corridors from /routes — origin/destination, safety score, and road blocks from dispatch"
          }
          right={
            <span className="flex items-center gap-1 text-[9px] text-safe">
              <Wifi className="w-3 h-3" /> LIVE
            </span>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {routes.length > 0 ? (
            routes.map((r) => {
              const st = r.status ?? "active";
              const progress = st === "completed" ? 100 : st === "blocked" ? 38 : st === "active" ? 72 : 0;
              const barClass = st === "blocked" ? "bg-emergency" : st === "active" ? "bg-warning" : "bg-safe";
              const href = routeDirectionsUrl(r);
              return (
                <div key={r._id} className="rounded-lg border border-border/60 bg-surface/40 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="min-w-0 text-[12px] font-bold text-intel">{r.name?.trim() || "Corridor"}</div>
                    <span
                      className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        st === "active"
                          ? "bg-warning/15 text-warning"
                          : st === "blocked"
                            ? "bg-emergency/20 text-emergency"
                            : "bg-safe/15 text-safe"
                      }`}
                    >
                      {st.toUpperCase()}
                    </span>
                  </div>
                  <div className="mb-2 text-[10px] text-muted-foreground">
                    {r.distanceKm != null ? `${r.distanceKm.toFixed(1)} km` : "—"} · {r.durationMin != null ? `${Math.round(r.durationMin)} min` : "—"}
                  </div>
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                    <ShieldAlert className="h-3 w-3 shrink-0" /> Safety {r.safetyScore != null ? Math.round(r.safetyScore) : "—"}
                    {(r.blockedRoads?.length ?? 0) > 0 && (
                      <span className="text-emergency">· {r.blockedRoads?.length} hazard pin(s)</span>
                    )}
                  </div>
                  <div className="mb-2 h-1 overflow-hidden rounded bg-white/5">
                    <div className={`h-full ${barClass} transition-all`} style={{ width: `${progress}%` }} />
                  </div>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-intel hover:underline"
                    >
                      Maps <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">No pins saved</span>
                  )}
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-4 text-center text-[11px] text-muted-foreground">
              {isLoading ? "…" : "No rescue routes — use Calculate route in command tools or POST /routes/calculate"}
            </div>
          )}
        </div>
      </div>
    </ViewShell>
  );
}

// ================= SOCIAL =================
function SocialView() {
  const { data: apiPosts, isLoading, isError } = useSocialPosts({ limit: 30 });
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 3000); return () => clearInterval(id); }, []);

  const analytics = useMemo(() => {
    if (!apiPosts || apiPosts.length === 0) return null;
    const posts = apiPosts as any[];
    const avgSentiment = posts.reduce((a: number, p: any) => a + (p.sentimentScore ?? 0), 0) / posts.length;
    const avgUrgency = posts.reduce((a: number, p: any) => a + (p.urgencyScore ?? 0), 0) / posts.length;
    const platforms: Record<string, number> = {};
    posts.forEach((p: any) => { platforms[p.platform] = (platforms[p.platform] ?? 0) + 1; });
    const urg = { critical: 0, high: 0, medium: 0, low: 0 };
    posts.forEach((p: any) => {
      const u = p.urgencyScore ?? 0;
      if (u >= 0.9) urg.critical++; else if (u >= 0.7) urg.high++; else if (u >= 0.4) urg.medium++; else urg.low++;
    });
    const kwCounts: Record<string, number> = {};
    posts.flatMap((p: any) => p.keywords ?? []).forEach((w: string) => { kwCounts[w] = (kwCounts[w] ?? 0) + 1; });
    const topKw = Object.entries(kwCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
    return { avgSentiment, avgUrgency, platforms, urg, topKw, total: posts.length, sos: posts.filter((p: any) => p.isSOS).length, misinfo: posts.filter((p: any) => p.isMisinformation).length };
  }, [apiPosts]);

  return (
    <ViewShell>
      {isLoading && <div className="text-[10px] text-muted-foreground px-1 pb-1">Loading social intel…</div>}
      {isError && <div className="flex items-center gap-2 text-[10px] text-emergency px-1 pb-1"><WifiOff className="w-3 h-3" /> Backend offline</div>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="TOTAL POSTS" value={analytics?.total ?? 0} tone="intel" sub="NLP analysed" />
        <KPI label="SOS FLAGGED" value={analytics?.sos ?? 0} tone="emergency" pulse />
        <KPI label="MISINFO" value={analytics?.misinfo ?? 0} tone="warning" sub="AI flagged" />
        <KPI label="PANIC INDEX" value={`${Math.round((analytics?.avgUrgency ?? 0) * 100)}%`} tone="emergency" sub={`sentiment ${(analytics?.avgSentiment ?? 0).toFixed(2)}`} />
      </div>
      <div className="grid lg:grid-cols-3 gap-3">
        {/* Urgency Distribution */}
        <div className="glass-strong rounded-xl border border-border/60 p-4">
          <SectionHeader title="URGENCY DISTRIBUTION · NLP" sub="Trained model scores" />
          {analytics && <div className="space-y-2 mt-2">
            {([
              { k: 'critical', l: 'CRITICAL ≥90%', c: 'emergency', v: analytics.urg.critical },
              { k: 'high', l: 'HIGH 70-90%', c: 'warning', v: analytics.urg.high },
              { k: 'medium', l: 'MEDIUM 40-70%', c: 'intel', v: analytics.urg.medium },
              { k: 'low', l: 'LOW <40%', c: 'safe', v: analytics.urg.low },
            ] as const).map(b => (
              <div key={b.k}>
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className={`text-${b.c} font-bold`}>{b.l}</span><span className="font-mono">{b.v}</span>
                </div>
                <div className="h-2 rounded bg-white/5 overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${analytics.total > 0 ? (b.v / analytics.total) * 100 : 0}%` }} transition={{ duration: 0.8 }} className={`h-full rounded bg-${b.c}`} />
                </div>
              </div>
            ))}
          </div>}
          <div className="glass-strong rounded-xl border border-border/60 p-4 mt-3">
            <SectionHeader title="PLATFORM SOURCES" />
            <div className="grid grid-cols-2 gap-2 mt-1">
              {analytics && Object.entries(analytics.platforms).map(([p, n]) => (
                <div key={p} className="flex items-center gap-2 p-2 rounded border border-border/60 bg-surface/40">
                  <span className="text-[14px]">{p === 'twitter' ? '𝕏' : p === 'telegram' ? '✈️' : '📋'}</span>
                  <div><div className="text-[12px] font-bold">{n}</div><div className="text-[9px] text-muted-foreground uppercase">{p}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Keywords */}
        <div className="space-y-3">
          <div className="glass-strong rounded-xl border border-border/60 p-4">
            <SectionHeader title="KEYWORD EXTRACTION · NLP" />
            <div className="flex flex-wrap gap-1.5 mt-1">
              {analytics?.topKw.map(([w, n]) => (
                <span key={w} className="text-[11px] px-2 py-1 rounded border border-emergency/40 bg-emergency/10 text-emergency font-mono">#{w} <span className="opacity-60">{n}</span></span>
              ))}
              {(!analytics || analytics.topKw.length === 0) && <span className="text-[10px] text-muted-foreground">No keywords</span>}
            </div>
          </div>
          <div className="glass-strong rounded-xl border border-border/60 p-4">
            <SectionHeader title="SENTIMENT · REAL-TIME" />
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1 h-4 rounded bg-white/5 overflow-hidden flex">
                <div className="h-full bg-emergency" style={{ width: `${apiPosts ? apiPosts.filter((p: any) => (p.sentimentScore ?? 0) < -0.5).length / apiPosts.length * 100 : 0}%` }} />
                <div className="h-full bg-warning" style={{ width: `${apiPosts ? apiPosts.filter((p: any) => (p.sentimentScore ?? 0) >= -0.5 && (p.sentimentScore ?? 0) < 0).length / apiPosts.length * 100 : 0}%` }} />
                <div className="h-full bg-safe" style={{ width: `${apiPosts ? apiPosts.filter((p: any) => (p.sentimentScore ?? 0) >= 0).length / apiPosts.length * 100 : 0}%` }} />
              </div>
            </div>
            <div className="flex justify-between text-[9px] mt-1 text-muted-foreground">
              <span className="text-emergency">Negative</span><span className="text-warning">Neutral</span><span className="text-safe">Positive</span>
            </div>
          </div>
        </div>
        {/* Citizen stream */}
        <div className="glass-strong rounded-xl border border-border/60 p-4">
          <SectionHeader title="CITIZEN STREAM" right={
            <span className="flex items-center gap-1 text-[9px] text-safe"><Wifi className="w-3 h-3" /> LIVE t+{tick * 3}s</span>
          } />
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {apiPosts && apiPosts.length > 0 ? apiPosts.map((p: any) => (
              <motion.div key={p._id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                className="rounded border border-border/60 bg-surface/40 p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-intel">@{p.author}</span>
                  <div className="flex items-center gap-1">
                    {p.isMisinformation && <span className="text-[9px] px-1 rounded bg-warning/20 text-warning">MISINFO</span>}
                    {p.isSOS && <span className="text-[9px] px-1 rounded bg-emergency/20 text-emergency blink">SOS</span>}
                    <span className={`text-[9px] font-mono px-1 rounded ${(p.urgencyScore ?? 0) > 0.8 ? 'bg-emergency/15 text-emergency' : 'bg-intel/15 text-intel'}`}>U{Math.round((p.urgencyScore ?? 0) * 100)}%</span>
                  </div>
                </div>
                <div className="text-[12px] leading-snug">{p.text}</div>
                {p.extractedLocation && <div className="text-[10px] text-muted-foreground mt-1 font-mono">📍 {p.extractedLocation}</div>}
              </motion.div>
            )) : !isLoading && <div className="text-[11px] text-muted-foreground py-4 text-center">No social posts</div>}
          </div>
        </div>
      </div>
    </ViewShell>
  );
}



// ================= SHELTER =================
function ShelterView() {
  const { data: apiShelters, isLoading, isError } = useShelters();

  const totalOccupied = apiShelters?.reduce((a: number, s: any) => a + (s.occupancy ?? 0), 0) ?? 0;
  const totalCapacity = apiShelters?.reduce((a: number, s: any) => a + (s.capacity ?? 0), 0) ?? 0;
  const atCapacity = apiShelters?.filter((s: any) => (s.occupancy ?? 0) >= s.capacity).length ?? 0;

  return (
    <ViewShell>
      {isLoading && <div className="text-[10px] text-muted-foreground px-1 pb-1">Loading shelters…</div>}
      {isError && (
        <div className="flex items-center gap-2 text-[10px] text-emergency px-1 pb-1">
          <WifiOff className="w-3 h-3" /> Backend offline
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="SHELTERS" value={apiShelters?.length ?? 0} tone="safe" />
        <KPI label="OCCUPIED" value={totalOccupied.toLocaleString()} tone="warning" sub={`of ${totalCapacity.toLocaleString()} cap`} />
        <KPI label="AT CAPACITY" value={atCapacity} tone="emergency" />
        <KPI label="EVAC FLOW" value="+42/min" tone="intel" />
      </div>
      <div className="space-y-3">
        {apiShelters && apiShelters.length > 0 ? apiShelters.map((s: any) => {
          const occupied = s.occupancy ?? 0;
          const capacity = s.capacity ?? 1;
          const pct = Math.round((occupied / capacity) * 100);
          const tone = pct >= 100 ? "emergency" : pct >= 80 ? "warning" : "safe";
          const coords = parseCoords(s.location?.coordinates);
          const facilities = s.facilities ?? [];
          return (
            <div key={s._id} className="glass-strong rounded-xl border border-border/60 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <div>
                  <div className="text-[14px] font-bold">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{s.address} · {coords[0].toFixed(3)}, {coords[1].toFixed(3)}</div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold text-${tone}`}>{pct}%</div>
                  <div className="text-[10px] text-muted-foreground">{occupied} / {capacity}</div>
                </div>
              </div>
              <div className="h-2 rounded bg-white/5 overflow-hidden">
                <div className={`h-full bg-${tone} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {facilities.map((f: string) => (
                  <span key={f} className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-border/60 bg-surface/40 text-muted-foreground">
                    {f}
                  </span>
                ))}
                <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                  s.status === 'open' ? 'border-safe/40 text-safe bg-safe/10' : 'border-warning/40 text-warning bg-warning/10'
                }`}>{s.status}</span>
              </div>
            </div>
          );
        }) : (
          <div className="text-[11px] text-muted-foreground py-4 text-center">No shelters found</div>
        )}
      </div>
    </ViewShell>
  );
}

// ================= GHOST / WEBRTC BEACON UPLINK =================
function GhostView() {
  return (
    <ClientOnly fallback={<ViewShell><div className="text-[11px] text-muted-foreground px-1">Loading beacon uplink…</div></ViewShell>}>
      <GhostBeaconView />
    </ClientOnly>
  );
}

function GhostBeaconView() {
  const [streamOn, setStreamOn] = useState(false);
  const { peerState, iceState, uplinkState, lastSent, lastReceived, gpsError } = useWebRtcGpsBeacon({
    enabled: streamOn,
    highAccuracy: true,
  });

  const fix = lastReceived ?? lastSent;
  const ageMs = fix ? Date.now() - fix.t : null;
  const iceOk = iceState === "connected" || iceState === "completed";
  const dcOk = uplinkState === "open";

  return (
    <ViewShell>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="PEER / PC" value={peerState.toUpperCase()} tone={peerState === "connected" ? "safe" : peerState === "failed" ? "emergency" : "intel"} />
        <KPI label="ICE PATH" value={iceState.toUpperCase()} tone={iceOk ? "safe" : iceState === "failed" ? "emergency" : "warning"} />
        <KPI label="DATA CHANNEL" value={uplinkState.toUpperCase()} tone={dcOk ? "safe" : "emergency"} pulse={streamOn && !dcOk} />
        <KPI label="FIX AGE" value={ageMs != null ? `${Math.round(ageMs / 100) / 10}s` : "—"} tone={ageMs != null && ageMs < 5000 ? "safe" : "warning"} sub="receiver path" />
      </div>

      <div className="glass-strong rounded-xl border border-intel/40 p-4">
        <SectionHeader
          title="WEBRTC · GPS EMERGENCY BEACON"
          sub="In-browser loopback proves the media path: GPS fixes are serialized on a secure SCTP data channel (same pattern as field → command uplink)."
          right={
            <button
              type="button"
              onClick={() => setStreamOn((v) => !v)}
              className={`text-[10px] font-bold tracking-widest px-3 py-1.5 rounded border transition
                ${streamOn ? "bg-emergency/20 border-emergency text-emergency blink" : "bg-safe/15 border-safe/50 text-safe hover:bg-safe/25"}`}
            >
              {streamOn ? "STOP STREAM" : "ARM LIVE STREAM"}
            </button>
          }
        />
        {gpsError && (
          <div className="flex items-center gap-2 text-[11px] text-emergency mt-2">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            {gpsError}
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div className="rounded-lg border border-border/60 bg-surface/40 p-4">
            <div className="flex items-center gap-2 mb-3 text-[10px] font-bold tracking-widest text-muted-foreground">
              <Link2 className="w-3.5 h-3.5 text-intel" />
              UPLINK STACK
            </div>
            <ul className="space-y-2 text-[11px] text-muted-foreground">
              <li className="flex gap-2"><span className="text-intel font-mono shrink-0">01</span> RTCPeerConnection (STUN discovery)</li>
              <li className="flex gap-2"><span className="text-intel font-mono shrink-0">02</span> Ordered SCTP data channel <code className="text-foreground/80">emergency-beacon</code></li>
              <li className="flex gap-2"><span className="text-intel font-mono shrink-0">03</span> <code className="text-foreground/80">watchPosition</code> → JSON GPS frames on channel</li>
            </ul>
          </div>
          <div className="rounded-lg border border-emergency/35 bg-emergency/5 p-4">
            <div className="flex items-center gap-2 mb-3 text-[10px] font-bold tracking-widest text-emergency">
              <MapPin className="w-3.5 h-3.5" />
              LIVE FIX (OPS RECEIVER)
            </div>
            {fix ? (
              <div className="font-mono text-[12px] space-y-1">
                <div><span className="text-muted-foreground">LAT </span><span className="text-foreground font-bold">{fix.lat.toFixed(6)}°</span></div>
                <div><span className="text-muted-foreground">LNG </span><span className="text-foreground font-bold">{fix.lng.toFixed(6)}°</span></div>
                {fix.accuracy != null && (
                  <div><span className="text-muted-foreground">ACC </span><span className="text-warning font-bold">±{Math.round(fix.accuracy)} m</span></div>
                )}
                <div className="text-[10px] text-muted-foreground pt-2 border-t border-border/40">
                  Source: {lastReceived ? "received on WebRTC data channel" : "local GPS (pre-channel)"} · {new Date(fix.t).toLocaleTimeString()}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground">
                {streamOn ? "Waiting for GPS permission and first fix…" : "Arm the stream to start WebRTC negotiation and GPS watch."}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="glass-strong rounded-xl border border-border/60 p-4">
        <SectionHeader title="COMMAND RELAY PREVIEW" sub="Packet timing mirrors a distress handset refreshing command tiles" />
        <div className="aspect-[2/1] w-full max-h-[220px] flex items-center justify-center bg-black/25 rounded border border-border/50">
          <div className="text-center px-4">
            <Wifi className={`w-10 h-10 mx-auto mb-2 ${dcOk ? "text-safe" : "text-muted-foreground"}`} />
            <div className="text-[11px] font-mono text-foreground/90">
              {dcOk ? "DATA CHANNEL OPEN — GPS frames flowing" : streamOn ? "NEGOTIATING…" : "STANDBY"}
            </div>
          </div>
        </div>
      </div>
    </ViewShell>
  );
}

// ================= TELEMETRY =================
function TelemetryView() {
  const { data: sosReports, isLoading } = useSosReports();
  const { data: sosStats } = useSosStats();

  const counts = useMemo(() => {
    if (!sosReports) return { total: 0, pending: 0, acknowledged: 0, dispatched: 0, resolved: 0 };
    return {
      total: sosReports.length,
      pending: sosReports.filter((s: any) => s.status === 'pending').length,
      acknowledged: sosReports.filter((s: any) => s.status === 'acknowledged').length,
      dispatched: sosReports.filter((s: any) => s.status === 'dispatched').length,
      resolved: sosReports.filter((s: any) => s.status === 'resolved').length,
    };
  }, [sosReports]);
  const rescueProgress = counts.total > 0 ? Math.round((counts.resolved / counts.total) * 100) : 0;

  return (
    <ViewShell>
      {isLoading && <div className="text-[10px] text-muted-foreground px-1 pb-1">Loading telemetry…</div>}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI label="TOTAL SOS" value={counts.total} tone="intel" />
        <KPI label="PENDING" value={counts.pending} tone="emergency" pulse />
        <KPI label="ACKNOWLEDGED" value={counts.acknowledged} tone="warning" />
        <KPI label="RESCUE QUEUE" value={counts.dispatched} tone="warning" sub="dispatched" />
        <KPI label="RESOLVED" value={counts.resolved} tone="safe" />
        <KPI label="BLE/MESH" value={sosReports?.filter((s: any) => s.channel !== 'online').length ?? 0} tone="intel" sub="offline relay" />
      </div>

      <div className="glass-strong rounded-xl border border-emergency/40 p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-[10px] tracking-[0.25em] text-emergency font-bold">RESCUE PROGRESS · OPERATION TRISHNA-3</div>
            <div className="text-[11px] text-muted-foreground">{counts.resolved} of {counts.total} distress calls resolved</div>
          </div>
          <div className="text-3xl font-bold text-safe text-glow-emergency">{rescueProgress}%</div>
        </div>
        <div className="h-3 rounded bg-white/5 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-safe via-intel to-emergency transition-all" style={{ width: `${rescueProgress}%` }} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 glass-strong rounded-xl border border-border/60 p-4">
          <SectionHeader title="AI PRIORITY RESCUE QUEUE" sub="Ordered by urgency score from trained NLP model" right={
            <span className="flex items-center gap-1 text-[9px] text-safe"><Wifi className="w-3 h-3" /> LIVE</span>
          } />
          <div className="space-y-2">
            {sosReports && [...sosReports]
              .sort((a: any, b: any) => (b.urgencyScore ?? 0) - (a.urgencyScore ?? 0))
              .filter((s: any) => s.status !== 'resolved')
              .map((s: any) => <SosVictimRow key={s._id} s={s} />)}
            {(!sosReports || sosReports.length === 0) && !isLoading && (
              <div className="text-[11px] text-muted-foreground py-4 text-center">No SOS reports</div>
            )}
          </div>
        </div>
        <div className="space-y-3">
          <CollapsedBuilding />
          <LiveSosMessages reports={sosReports} />
        </div>
      </div>
    </ViewShell>
  );
}

function SosVictimRow({ s }: { s: any }) {
  const statusTone: Record<string, string> = { pending: "emergency", acknowledged: "warning", dispatched: "warning", resolved: "safe" };
  const t = statusTone[s.status] ?? "intel";
  const channelIcon: Record<string, string> = { online: "🌐", ble: "📡", 'wifi-direct': "📶", mesh: "🕸️" };
  const urgPct = Math.round((s.urgencyScore ?? 0) * 100);
  const { mutate: acknowledge } = useAcknowledgeSos();
  const { mutate: resolve } = useResolveSos();
  const { mutate: dispatchRescue } = useDispatchSosToRescue();

  return (
    <motion.div layout className={`p-3 rounded-lg border bg-${t}/5 border-${t}/40`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full bg-${t}/20 border border-${t}/50 flex items-center justify-center text-base shrink-0`}>
          {channelIcon[s.channel] ?? "🆘"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-bold">{s.senderName ?? s.senderId}</span>
            <span className="text-[10px] text-muted-foreground">· {s.channel} · {s.disasterType}</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded bg-${t}/20 text-${t} ${s.status === "pending" ? "blink" : ""}`}>
              {s.status?.toUpperCase()}
            </span>
          </div>
          <div className="text-[11px] text-foreground/90 mt-1 leading-snug line-clamp-2">{s.message}</div>
          {s.photoThumbnail && (
            <div className="mt-2">
              <img src={s.photoThumbnail} alt="" className="max-h-32 rounded border border-border/50 object-contain bg-black/20" />
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 mt-2 text-[10px] font-mono">
            <div className="text-muted-foreground">URGENCY <span className={`font-bold text-${urgPct > 90 ? 'emergency' : urgPct > 70 ? 'warning' : 'intel'}`}>{urgPct}%</span></div>
            {s.hops > 0 && <div className="text-muted-foreground">HOPS <span className="text-intel">{s.hops}</span></div>}
            <div className="text-muted-foreground">{new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {s.status === 'pending' && (
          <button onClick={() => acknowledge(s._id)} className={`flex-1 min-w-[6rem] py-1.5 text-[10px] font-bold tracking-widest rounded bg-warning/15 border border-warning/40 text-warning hover:bg-warning/25 transition`}>
            ACKNOWLEDGE
          </button>
        )}
        {(s.status === 'pending' || s.status === 'acknowledged') && (
          <button
            type="button"
            onClick={() =>
              dispatchRescue(s._id, {
                onSuccess: () => toast.success("Queued for rescue team."),
                onError: (e: Error) => toast.error(e.message || "Dispatch failed"),
              })
            }
            className="flex-1 min-w-[6rem] py-1.5 text-[10px] font-bold tracking-widest rounded bg-warning text-black hover:bg-amber-400 transition"
          >
            DISPATCH
          </button>
        )}
        {s.status !== 'resolved' && (
          <button
            type="button"
            onClick={() =>
              resolve(s._id, {
                onSuccess: () => toast.success("Marked resolved."),
                onError: (e: Error) => toast.error(e.message || "Resolve failed"),
              })
            }
            className="flex-1 min-w-[6rem] py-1.5 text-[10px] font-bold tracking-widest rounded bg-safe/15 border border-safe/40 text-safe hover:bg-safe/25 transition"
          >
            RESOLVE
          </button>
        )}
        <button type="button" className="px-3 py-1.5 text-[10px] font-bold tracking-widest rounded border border-border/60 hover:bg-white/5">PING</button>
      </div>
    </motion.div>
  );
}

function CollapsedBuilding() {
  const [pulse, setPulse] = useState(0);
  useEffect(() => { const id = setInterval(() => setPulse(x => x + 1), 1200); return () => clearInterval(id); }, []);
  return (
    <div className="glass-strong rounded-xl border border-emergency/40 p-3">
      <SectionHeader title="WORLI BLDG-A · COLLAPSE SCAN" sub="Thermal + signal pulse" />
      <div className="relative aspect-square bg-black/40 rounded border border-emergency/20 overflow-hidden">
        <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
          {[1, 2, 3, 4, 5].map(f => (
            <rect key={f} x="30" y={170 - f * 28} width="140" height="24" fill="oklch(0.25 0.03 252)" stroke="oklch(0.4 0.05 252)" strokeWidth="1" opacity={0.6} />
          ))}
          <polygon points="30,30 100,10 170,30 170,42 30,42" fill="oklch(0.3 0.05 25)" opacity="0.5" />
          {[{ x: 70, y: 120, c: "#ff3b30" }, { x: 130, y: 92, c: "#ff3b30" }, { x: 100, y: 64, c: "#ffd60a" }].map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={6 + (pulse + i) % 3 * 4} fill={p.c} fillOpacity={0.15} />
              <circle cx={p.x} cy={p.y} r="4" fill={p.c}>
                <animate attributeName="r" values="3;6;3" dur="0.9s" repeatCount="indefinite" />
              </circle>
            </g>
          ))}
          <circle cx="100" cy="100" r="90" fill="none" stroke="oklch(0.7 0.2 235 / 0.2)" strokeDasharray="2 4" />
          <line x1="100" y1="100" x2="100" y2="20" stroke="oklch(0.7 0.2 235 / 0.6)" strokeWidth="1.5" className="origin-center radar-sweep" style={{ transformOrigin: "100px 100px" }} />
          <circle cx="30" cy="170" r="4" fill="#34c759" />
          <text x="38" y="173" fill="#34c759" fontSize="8" fontFamily="monospace">RESCUE ENTRY</text>
        </svg>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2 text-[10px] font-mono">
        <div className="text-muted-foreground">TRAPPED <span className="text-emergency font-bold">3</span></div>
        <div className="text-muted-foreground">RISK <span className="text-emergency font-bold">CRIT</span></div>
        <div className="text-muted-foreground">SIGNAL <span className="text-warning font-bold">WEAK</span></div>
      </div>
    </div>
  );
}

function LiveSosMessages({ reports }: { reports: any[] | undefined }) {
  const recent = useMemo(() => {
    if (!reports) return [];
    return [...reports].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4);
  }, [reports]);

  return (
    <div className="glass-strong rounded-xl border border-border/60 p-3">
      <SectionHeader title="LAST DISTRESS MESSAGES" right={<span className="flex items-center gap-1 text-[9px] text-safe"><Wifi className="w-3 h-3" /> LIVE</span>} />
      <div className="space-y-2">
        {recent.map((m: any) => (
          <div key={m._id} className="p-2.5 rounded border border-emergency/30 bg-emergency/5">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-3 h-3 text-emergency" />
              <span className="text-[11px] font-bold">{m.senderName ?? m.senderId}</span>
              <span className="text-[9px] px-1 rounded bg-intel/15 text-intel">{m.channel}</span>
              <span className="ml-auto text-[9px] font-mono text-muted-foreground">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="text-[11px] italic text-foreground/85 leading-snug line-clamp-2">"{m.message}"</div>
            {m.photoThumbnail && (
              <img src={m.photoThumbnail} alt="" className="mt-2 max-h-24 rounded border border-border/50 object-contain" />
            )}
          </div>
        ))}
        {recent.length === 0 && <div className="text-[11px] text-muted-foreground py-2 text-center">No messages</div>}
      </div>
    </div>
  );
}

// ================= BEACON =================
function BeaconView() {
  const { setEmergencyActive, silentSos, toggleSilentSos } = useResqStore();
  return (
    <ViewShell>
      <div className="glass-strong rounded-2xl border-2 border-emergency/50 p-6 sm:p-8 text-center glow-emergency relative overflow-hidden">
        <div className="absolute inset-0 scanlines pointer-events-none" />
        <div className="text-[10px] tracking-[0.3em] text-emergency font-bold blink mb-2">EMERGENCY BEACON SYSTEM</div>
        <div className="text-2xl sm:text-3xl font-bold mb-2">One-Tap Survival Broadcast</div>
        <p className="text-[12px] text-muted-foreground mb-6 max-w-md mx-auto">
          Pre-armed. Press once to transmit GPS, audio, video, and biometric distress to all rescue units within 50km.
        </p>
        <button onClick={() => setEmergencyActive(true)}
          className="relative w-44 h-44 sm:w-56 sm:h-56 mx-auto rounded-full bg-gradient-to-br from-emergency to-red-800 text-white font-bold tracking-widest flex flex-col items-center justify-center hover:scale-105 transition glow-emergency">
          <span className="absolute inset-0 rounded-full pulse-ring text-emergency" />
          <AlertOctagon className="w-16 h-16 sm:w-20 sm:h-20 mb-2" />
          <span className="text-sm sm:text-base">ACTIVATE</span>
          <span className="text-sm sm:text-base">EMERGENCY</span>
        </button>
        <button onClick={toggleSilentSos}
          className={`mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border text-[11px] font-bold tracking-widest transition
            ${silentSos ? "bg-intel/20 border-intel text-intel" : "bg-surface/60 border-border/60 text-muted-foreground hover:text-foreground"}`}>
          <EyeOff className="w-3.5 h-3.5" />SILENT SOS {silentSos ? "ARMED" : "OFF"}
        </button>
        <div className="text-[10px] text-muted-foreground mt-2">For when you can't speak — sends location & low-power ping only.</div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <FeatureCard icon={MapPin} title="Live GPS Track" desc="Sub-meter accuracy, refreshed every 2s" tone="intel" />
        <FeatureCard icon={Mic} title="Audio Stream" desc="Encrypted live mic to rescue command" tone="emergency" />
        <FeatureCard icon={Camera} title="Camera Feed" desc="Snapshot triage every 10s" tone="warning" />
      </div>
    </ViewShell>
  );
}

function FeatureCard({ icon: Icon, title, desc, tone }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string; tone: string }) {
  return (
    <div className={`p-3 rounded-lg border bg-${tone}/5 border-${tone}/40`}>
      <Icon className={`w-5 h-5 text-${tone} mb-1.5`} />
      <div className="text-[12px] font-bold">{title}</div>
      <div className="text-[10.5px] text-muted-foreground">{desc}</div>
    </div>
  );
}

// ================= SETTINGS =================
function SettingsView() {
  const { permissions, powerSaver, togglePowerSaver, silentSos, toggleSilentSos, setOnboarded } = useResqStore();
  return (
    <ViewShell>
      <div className="glass-strong rounded-xl border border-border/60 p-4">
        <SectionHeader title="ARMED PERMISSIONS" sub="One-time setup, secure on-device" />
        <div className="grid sm:grid-cols-2 gap-2">
          {Object.entries(permissions).map(([k, v]) => (
            <div key={k} className={`p-2.5 rounded border flex items-center justify-between
              ${v ? "bg-safe/10 border-safe/40" : "bg-emergency/10 border-emergency/40"}`}>
              <span className="text-[12px] font-semibold capitalize">{k}</span>
              <span className={`text-[10px] font-bold tracking-widest ${v ? "text-safe" : "text-emergency"}`}>{v ? "ARMED" : "OFF"}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="glass-strong rounded-xl border border-border/60 p-4">
        <SectionHeader title="SURVIVAL MODES" />
        <ToggleRow label="Low-Battery Survival Mode"
          desc="Reduces animations & refresh rate. Maintains only critical comms." active={powerSaver} onChange={togglePowerSaver} icon={Battery} />
        <ToggleRow label="Silent SOS"
          desc="Hidden distress when you can't speak — location ping only." active={silentSos} onChange={toggleSilentSos} icon={EyeOff} />
      </div>
      <div className="glass-strong rounded-xl border border-border/60 p-4">
        <SectionHeader title="DEVICE STATUS" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <Stat l="BATTERY" v="68%" t="warning" />
          <Stat l="SIGNAL" v="MESH" t="intel" />
          <Stat l="GPS" v="LOCK" t="safe" />
          <Stat l="STORAGE" v="4.2 GB" t="muted-foreground" />
        </div>
      </div>
      <button onClick={() => setOnboarded(false)}
        className="w-full py-2 text-[11px] tracking-widest border border-border/60 rounded text-muted-foreground hover:text-foreground hover:bg-white/5">
        REPLAY EMERGENCY SETUP
      </button>
    </ViewShell>
  );
}

function Stat({ l, v, t }: { l: string; v: string; t: string }) {
  return (
    <div className="p-2 rounded border border-border/60 bg-surface/40">
      <div className="text-[9px] tracking-widest text-muted-foreground">{l}</div>
      <div className={`text-[14px] font-bold text-${t}`}>{v}</div>
    </div>
  );
}

function ToggleRow({ label, desc, active, onChange, icon: Icon }: { label: string; desc: string; active: boolean; onChange: () => void; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
      <Icon className={`w-4 h-4 ${active ? "text-safe" : "text-muted-foreground"}`} />
      <div className="flex-1">
        <div className="text-[12px] font-bold">{label}</div>
        <div className="text-[10.5px] text-muted-foreground">{desc}</div>
      </div>
      <button onClick={onChange}
        className={`w-10 h-5 rounded-full relative transition ${active ? "bg-safe" : "bg-white/10"}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${active ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}

// ================= COMMON =================
function KPI({ label, value, sub, tone, pulse }: { label: string; value: React.ReactNode; sub?: string; tone: string; pulse?: boolean }) {
  return (
    <div className={`relative p-3 rounded-lg border bg-${tone}/5 border-${tone}/30 overflow-hidden`}>
      {pulse && <div className={`absolute inset-0 bg-${tone}/10 animate-pulse pointer-events-none`} />}
      <div className="text-[9px] tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className={`text-2xl sm:text-3xl font-bold text-${tone} font-mono tabular-nums`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
