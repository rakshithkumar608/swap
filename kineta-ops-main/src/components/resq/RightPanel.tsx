import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { AlertTriangle, Brain, TrendingUp, Heart, MessageSquare, Wifi, WifiOff } from "lucide-react";
import { useActiveAlerts, useSocialPosts, usePanicMeter } from "@/hooks/useBackendData";

const sevStyles: Record<string, string> = {
  critical: "bg-emergency/15 border-emergency/50 text-emergency",
  high: "bg-warning/10 border-warning/40 text-warning",
  medium: "bg-intel/10 border-intel/40 text-intel",
  low: "bg-safe/10 border-safe/40 text-safe",
};

export function RightPanel() {
  return (
    <aside className="w-[340px] shrink-0 border-l border-border/60 glass-strong flex flex-col z-20 overflow-hidden">
      <Tabs />
    </aside>
  );
}

function Tabs() {
  const [tab, setTab] = useState<"alerts" | "social" | "family">("alerts");
  return (
    <>
      <div className="flex border-b border-border/60 shrink-0">
        {[
          { k: "alerts", l: "ALERTS", i: AlertTriangle },
          { k: "social", l: "AI INTEL", i: Brain },
          { k: "family", l: "FAMILY", i: Heart },
        ].map((t) => {
          const Icon = t.i;
          const active = tab === t.k;
          return (
            <button key={t.k} onClick={() => setTab(t.k as never)}
              className={`flex-1 px-3 py-2.5 text-[10px] font-bold tracking-widest flex items-center justify-center gap-1.5 transition border-b-2
                ${active ? "border-emergency text-emergency bg-emergency/5" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Icon className="w-3 h-3" />{t.l}
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === "alerts" && <AlertsFeed />}
        {tab === "social" && <SocialIntel />}
        {tab === "family" && <FamilyPanel />}
      </div>
    </>
  );
}

function AlertsFeed() {
  const { data: apiAlerts, isLoading } = useActiveAlerts();

  return (
    <div className="p-2 space-y-2">
      <div className="px-2 py-1 flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-widest text-muted-foreground">REAL-TIME EMERGENCY FEED</span>
        <span className="flex items-center gap-1 text-[10px] text-safe">
          <Wifi className="w-3 h-3" /> LIVE
        </span>
      </div>
      {isLoading && <div className="text-[10px] text-muted-foreground px-2">Loading alerts…</div>}
      <AnimatePresence initial={false}>
        {apiAlerts && apiAlerts.length > 0 ? apiAlerts.map((a: any) => (
          <motion.div
            key={a._id}
            layout
            initial={{ opacity: 0, x: 20, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20 }}
            className={`relative p-2.5 rounded-md border ${sevStyles[a.severity] ?? sevStyles.medium} ${a.severity === "critical" ? "glow-emergency" : ""}`}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className={`text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded ${a.severity === "critical" ? "bg-emergency text-white blink" : "bg-white/10"}`}>
                {a.severity?.toUpperCase()}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {new Date(a.sentAt ?? a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="text-[12.5px] font-semibold text-foreground leading-tight">{a.title}</div>
            <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{a.body}</div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{a.type}</span>
              {a.sentCount && <span className="text-[9px] font-mono text-muted-foreground">Sent to {a.sentCount.toLocaleString()}</span>}
            </div>
          </motion.div>
        )) : !isLoading && (
          <div className="text-[11px] text-muted-foreground py-4 text-center">No active alerts</div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SocialIntel() {
  const { data: apiPosts, isLoading } = useSocialPosts({ limit: 5 });

  // Extract keywords from posts for live keyword cloud
  const keywords = (() => {
    const all = apiPosts?.flatMap((p: any) => p.keywords ?? []) ?? [];
    const counts: Record<string, number> = {};
    all.forEach((w: string) => { counts[w] = (counts[w] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  })();

  return (
    <div className="p-3 space-y-3">
      <div>
        <div className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2">NLP INTEL · SOCIAL SIGNALS</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { l: "Posts", v: apiPosts?.length ?? 0, t: "total", c: "emergency" },
            { l: "SOS", v: apiPosts?.filter((p: any) => p.isSOS).length ?? 0, t: "flagged", c: "warning" },
            { l: "Misinfo", v: apiPosts?.filter((p: any) => p.isMisinformation).length ?? 0, t: "detected", c: "intel" },
          ].map((s) => (
            <div key={s.l} className="rounded border border-border/60 bg-surface/40 p-2">
              <div className={`text-[14px] font-bold text-${s.c}`}>{s.v}</div>
              <div className="text-[9px] text-muted-foreground tracking-wider">{s.l}</div>
              <div className="text-[9px] text-muted-foreground">{s.t}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-intel" /> KEYWORD EXTRACTION
        </div>
        <div className="flex flex-wrap gap-1">
          {keywords.length > 0 ? keywords.map(([w, n]) => (
            <span key={w} className="text-[10px] px-1.5 py-0.5 rounded border border-emergency/40 bg-emergency/10 text-emergency font-mono">
              #{w} <span className="opacity-60">{n}</span>
            </span>
          )) : (
            <span className="text-[10px] text-muted-foreground">No keywords yet</span>
          )}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5">
          <MessageSquare className="w-3 h-3 text-intel" />
          CITIZEN STREAM <Wifi className="w-2.5 h-2.5 text-safe ml-1" />
        </div>
        {isLoading && <div className="text-[10px] text-muted-foreground">Loading…</div>}
        <div className="space-y-1.5">
          {apiPosts && apiPosts.length > 0 ? apiPosts.map((p: any) => (
            <div key={p._id} className="rounded border border-border/60 bg-surface/40 p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-intel">@{p.author}</span>
                <div className="flex items-center gap-1">
                  {p.isMisinformation && <span className="text-[9px] px-1 rounded bg-warning/20 text-warning">MISINFO</span>}
                  {p.isSOS && <span className="text-[9px] px-1 rounded bg-emergency/20 text-emergency">SOS</span>}
                  <span className="text-[9px] font-mono px-1 rounded bg-emergency/15 text-emergency">U{Math.round((p.urgencyScore ?? 0) * 100)}%</span>
                </div>
              </div>
              <div className="text-[11.5px] text-foreground/90 leading-snug">{p.text}</div>
              {p.extractedLocation && <div className="text-[9px] text-muted-foreground mt-0.5 font-mono">📍 {p.extractedLocation}</div>}
            </div>
          )) : !isLoading && (
            <div className="text-[11px] text-muted-foreground py-2 text-center">No social posts</div>
          )}
        </div>
      </div>
    </div>
  );
}

const statusColor: Record<string, string> = {
  SAFE: "bg-safe/15 border-safe/50 text-safe",
  "NEED HELP": "bg-warning/15 border-warning/50 text-warning",
  INJURED: "bg-warning/15 border-warning/50 text-warning",
  TRAPPED: "bg-emergency/20 border-emergency/60 text-emergency",
  MISSING: "bg-emergency/20 border-emergency/60 text-emergency",
};

// Family panel uses static data since there's no backend endpoint for family tracking yet
const familyMembers = [
  { name: "Aarav Sharma", role: "Brother", loc: "Dharavi", status: "SAFE", t: "5m ago" },
  { name: "Priya Sharma", role: "Mother", loc: "Bandra", status: "SAFE", t: "12m ago" },
  { name: "Deepak Sharma", role: "Father", loc: "Kurla", status: "NEED HELP", t: "3m ago" },
  { name: "Meera Sharma", role: "Sister", loc: "Worli", status: "MISSING", t: "47m ago" },
];

function FamilyPanel() {
  return (
    <div className="p-3 space-y-2">
      <div className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1">FAMILY SAFE-STATUS</div>
      {familyMembers.map((m) => {
        const urgent = m.status === "MISSING" || m.status === "TRAPPED";
        return (
          <motion.div key={m.name} whileHover={{ scale: 1.01 }}
            className={`p-2.5 rounded border ${statusColor[m.status]} ${urgent ? "glow-emergency" : ""}`}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-[13px] font-bold">
                {m.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold truncate">{m.name}</div>
                <div className="text-[10px] text-muted-foreground">{m.role} · {m.loc}</div>
              </div>
              <div className="text-right">
                <div className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded ${urgent ? "blink" : ""}`}>
                  {m.status}
                </div>
                <div className="text-[9px] text-muted-foreground font-mono">{m.t}</div>
              </div>
            </div>
          </motion.div>
        );
      })}
      <button className="w-full mt-2 py-2 text-[11px] font-bold tracking-widest border border-intel/40 bg-intel/10 text-intel rounded hover:bg-intel/20 transition">
        + BROADCAST STATUS UPDATE
      </button>
    </div>
  );
}
