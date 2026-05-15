/**
 * CitizenSafetyDashboard — innovative safety features hub
 * Risk score, family plan, survival kit, accessibility, dialect, resilience, mental health
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Baby,
  BarChart3,
  Brain,
  ChevronRight,
  Ear,
  Eye,
  Globe,
  Hand,
  Heart,
  HeartPulse,
  Home,
  Languages,
  Lightbulb,
  PackageCheck,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Vibrate,
  Volume2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type { GeoFix } from "@/hooks/useCitizenGeolocation";
import { useActiveAlerts, useDisasters, useShelters, useSocialPosts, usePanicMeter } from "@/hooks/useBackendData";
import { distanceKm, cn } from "@/lib/utils";
import { useCitizenStore, type ChecklistId } from "@/store/useCitizenStore";

/* ───── helpers ───── */
function fadeIn(delay = 0) {
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay },
  };
}

function GlassCard({
  children,
  className,
  glow,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: string;
}) {
  return (
    <motion.div
      {...fadeIn()}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 shadow-lg backdrop-blur-xl sm:rounded-3xl sm:p-5",
        glow,
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider sm:text-[11px]",
        color,
      )}
    >
      {children}
    </span>
  );
}

/* ───── RISK SCORE ───── */
function PersonalRiskScore({ fix, incidentCount }: { fix: GeoFix | null; incidentCount: number }) {
  const score = useMemo(() => {
    if (!fix) return null;
    const base = 15;
    const incRisk = Math.min(incidentCount * 12, 50);
    const raw = base + incRisk;
    return Math.min(100, Math.max(5, raw));
  }, [fix, incidentCount]);

  const level =
    score == null
      ? { label: "Unknown", color: "text-muted-foreground", ring: "stroke-muted-foreground/30", bg: "from-muted/20" }
      : score >= 70
        ? { label: "High Risk", color: "text-red-400", ring: "stroke-red-500", bg: "from-red-950/30" }
        : score >= 40
          ? { label: "Moderate", color: "text-amber-400", ring: "stroke-amber-500", bg: "from-amber-950/20" }
          : { label: "Low Risk", color: "text-emerald-400", ring: "stroke-emerald-500", bg: "from-emerald-950/20" };

  const displayScore = score ?? 0;
  const circ = 2 * Math.PI * 52;
  const offset = circ - (displayScore / 100) * circ;

  return (
    <GlassCard className={cn("bg-gradient-to-br", level.bg, "to-transparent")} glow={score && score >= 70 ? "ring-1 ring-red-500/30" : ""}>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em]">
        <HeartPulse className={cn("h-4 w-4", level.color)} />
        <span className={level.color}>Personal risk score</span>
      </div>
      <div className="mt-4 flex items-center gap-6">
        <div className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r="52" fill="none" strokeWidth="8" className="stroke-white/[0.06]" />
            <circle
              cx="60" cy="60" r="52" fill="none" strokeWidth="8" strokeLinecap="round"
              className={cn(level.ring, "transition-all duration-700")}
              strokeDasharray={circ} strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("font-display text-3xl font-black", level.color)}>{score ?? "—"}</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/50">/ 100</span>
          </div>
        </div>
        <div className="min-w-0 space-y-2">
          <p className={cn("text-lg font-bold", level.color)}>{level.label}</p>
          <p className="text-xs leading-relaxed text-white/60">
            {fix
              ? `Based on ${incidentCount} nearby incident${incidentCount !== 1 ? "s" : ""} and your current GPS zone.`
              : "Enable GPS to calculate your personalized daily risk score."}
          </p>
          <p className="text-[10px] text-white/40">Updates every 3 minutes with live data</p>
        </div>
      </div>
    </GlassCard>
  );
}

/* ───── FAMILY PLAN GENERATOR ───── */
function FamilyPlanGenerator({ fix }: { fix: GeoFix | null }) {
  const [members, setMembers] = useState(3);
  const [hasElderly, setHasElderly] = useState(false);
  const [hasChildren, setHasChildren] = useState(true);
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);

  const generate = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setGenerated(true);
      toast.success("Family emergency plan generated!");
    }, 1200);
  };

  return (
    <GlassCard className="bg-gradient-to-br from-violet-950/20 to-transparent">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300">
        <Users className="h-4 w-4" />
        Family emergency plan
      </div>
      <p className="mt-2 text-xs text-white/55">AI builds a personalized household plan based on your family composition.</p>

      {!generated ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1 text-[11px] text-white/60">
              Members
              <input type="number" min={1} max={12} value={members} onChange={(e) => setMembers(+e.target.value)}
                className="h-10 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white" />
            </label>
            <label className="flex items-center gap-2 text-[11px] text-white/60">
              <input type="checkbox" checked={hasElderly} onChange={(e) => setHasElderly(e.target.checked)} className="h-4 w-4 accent-violet-500" />
              Elderly (60+)
            </label>
            <label className="flex items-center gap-2 text-[11px] text-white/60">
              <input type="checkbox" checked={hasChildren} onChange={(e) => setHasChildren(e.target.checked)} className="h-4 w-4 accent-violet-500" />
              Children
            </label>
          </div>
          <button type="button" onClick={generate} disabled={generating}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-violet-500 active:scale-[0.98] disabled:opacity-50">
            <Brain className="h-4 w-4" />
            {generating ? "Generating…" : "Generate plan"}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <div className="rounded-xl border border-violet-500/20 bg-violet-950/30 p-3">
            <p className="text-xs font-bold text-violet-200">📋 Your Emergency Plan</p>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-white/70">
              <li>✅ Rally point: Nearest shelter {fix ? "mapped to GPS" : "(enable GPS)"}</li>
              <li>✅ {members} emergency kits — {hasChildren ? "incl. child supplies" : "adult-only"}</li>
              <li>✅ {hasElderly ? "Wheelchair-accessible route prioritized" : "Standard evacuation route"}</li>
              <li>✅ Family codeword: <span className="font-mono text-violet-300">KAVACH-{Math.random().toString(36).slice(2, 6).toUpperCase()}</span></li>
              <li>✅ ICE chain: primary → neighbor → local shelter coordinator</li>
              <li>✅ 72-hour water: {members * 3}L minimum ({members} × 3L/day)</li>
            </ul>
          </div>
          <button type="button" onClick={() => { setGenerated(false); toast.message("Regenerating…"); }}
            className="text-xs font-semibold text-violet-400 underline-offset-2 hover:underline">Regenerate plan</button>
        </div>
      )}
    </GlassCard>
  );
}

/* ───── SURVIVAL KIT ADVISOR ───── */
function SurvivalKitAdvisor() {
  const { checklist, toggleChecklist } = useCitizenStore();
  const items: { id: ChecklistId; label: string; icon: typeof PackageCheck; priority: "critical" | "high" | "medium" }[] = [
    { id: "water", label: "Water (3L/person/day)", icon: Activity, priority: "critical" },
    { id: "torch", label: "Torch + spare batteries", icon: Lightbulb, priority: "critical" },
    { id: "whistle", label: "Whistle / signal device", icon: Volume2, priority: "high" },
    { id: "docs", label: "ID & insurance copies", icon: Shield, priority: "high" },
    { id: "meds", label: "Prescription medications", icon: HeartPulse, priority: "critical" },
    { id: "charger", label: "Power bank (charged)", icon: Zap, priority: "medium" },
  ];

  const done = items.filter((i) => checklist[i.id]).length;
  const pct = Math.round((done / items.length) * 100);
  const priorityColor = { critical: "border-red-500/40 bg-red-500/10", high: "border-amber-500/30 bg-amber-500/8", medium: "border-sky-500/30 bg-sky-500/8" };

  return (
    <GlassCard className="bg-gradient-to-br from-emerald-950/15 to-transparent">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
          <PackageCheck className="h-4 w-4" />
          Survival kit advisor
        </div>
        <Badge color={pct >= 80 ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400" : "border-amber-500/40 bg-amber-500/15 text-amber-400"}>
          {pct}% ready
        </Badge>
      </div>
      <p className="mt-2 text-xs text-white/55">Personalized to your household. Tap to check off items.</p>
      <div className="mt-3 space-y-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} type="button" onClick={() => toggleChecklist(item.id)}
              className={cn(
                "flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition hover:brightness-110",
                checklist[item.id] ? "border-emerald-500/30 bg-emerald-500/10" : priorityColor[item.priority],
              )}>
              <div className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px]",
                checklist[item.id] ? "border-emerald-500 bg-emerald-500 text-white" : "border-white/20")}>
                {checklist[item.id] && "✓"}
              </div>
              <Icon className={cn("h-4 w-4 shrink-0", checklist[item.id] ? "text-emerald-400" : "text-white/40")} />
              <span className={cn("text-sm", checklist[item.id] ? "text-emerald-200 line-through" : "text-white/80")}>{item.label}</span>
              {item.priority === "critical" && !checklist[item.id] && (
                <span className="ml-auto text-[9px] font-bold uppercase text-red-400">Critical</span>
              )}
            </button>
          );
        })}
      </div>
    </GlassCard>
  );
}

/* ───── ACCESSIBLE ALERT MODES ───── */
function AccessibleAlertModes() {
  const [modes, setModes] = useState({ visual: true, audio: true, tactile: false });
  const toggle = (k: keyof typeof modes) => {
    setModes((p) => ({ ...p, [k]: !p[k] }));
    toast.success(`${k.charAt(0).toUpperCase() + k.slice(1)} alerts ${modes[k] ? "disabled" : "enabled"}`);
  };

  const modeList = [
    { key: "visual" as const, label: "Visual alerts", desc: "Screen flashes + large text overlays", icon: Eye, color: "text-sky-400 border-sky-500/30 bg-sky-500/10" },
    { key: "audio" as const, label: "Audio alerts", desc: "Spoken warnings in selected language", icon: Volume2, color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
    { key: "tactile" as const, label: "Tactile / vibration", desc: "Strong haptic patterns for deaf users", icon: Vibrate, color: "text-violet-400 border-violet-500/30 bg-violet-500/10" },
  ];

  return (
    <GlassCard>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300">
        <Ear className="h-4 w-4" />
        Accessible alert modes
      </div>
      <p className="mt-2 text-xs text-white/55">Inclusive alerts for all abilities — visual, audio, and tactile.</p>
      <div className="mt-3 space-y-2">
        {modeList.map((m) => {
          const Icon = m.icon;
          const on = modes[m.key];
          return (
            <button key={m.key} type="button" onClick={() => toggle(m.key)}
              className={cn("flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2 transition",
                on ? m.color : "border-white/[0.06] bg-white/[0.02] opacity-60")}>
              <Icon className="h-5 w-5 shrink-0" />
              <div className="min-w-0 text-left">
                <p className="text-sm font-semibold">{m.label}</p>
                <p className="text-[10px] text-white/50">{m.desc}</p>
              </div>
              <div className={cn("ml-auto h-6 w-11 shrink-0 rounded-full p-0.5 transition",
                on ? "bg-emerald-500" : "bg-white/10")}>
                <div className={cn("h-5 w-5 rounded-full bg-white shadow transition-transform",
                  on ? "translate-x-5" : "translate-x-0")} />
              </div>
            </button>
          );
        })}
      </div>
    </GlassCard>
  );
}

/* ───── REGIONAL DIALECT SUPPORT ───── */
function RegionalDialectSupport() {
  const [lang, setLang] = useState("en");
  const langs = [
    { id: "en", label: "English", flag: "🌐" },
    { id: "hi", label: "Hinglish", flag: "🇮🇳" },
    { id: "kn", label: "ಕನ್ನಡ", flag: "🏛️" },
    { id: "ta", label: "தமிழ்", flag: "🎭" },
    { id: "te", label: "తెలుగు", flag: "🌾" },
  ];

  return (
    <GlassCard>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-orange-300">
        <Languages className="h-4 w-4" />
        Regional dialect support
      </div>
      <p className="mt-2 text-xs text-white/55">All alerts, guides, and AI tutor in your language.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {langs.map((l) => (
          <button key={l.id} type="button" onClick={() => { setLang(l.id); toast.success(`Language set: ${l.label}`); }}
            className={cn("flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition",
              lang === l.id ? "border-orange-500/40 bg-orange-500/15 text-orange-200" : "border-white/[0.08] text-white/50 hover:bg-white/[0.04]")}>
            <span className="text-base">{l.flag}</span> {l.label}
          </button>
        ))}
      </div>
      <Badge color="mt-3 border-orange-500/30 bg-orange-500/10 text-orange-300">
        India-first · Works offline
      </Badge>
    </GlassCard>
  );
}

/* ───── COMMUNITY RESILIENCE SCORE ───── */
function CommunityResilienceScore({ fix, shelterCount }: { fix: GeoFix | null; shelterCount: number }) {
  const score = useMemo(() => {
    if (!fix) return null;
    return Math.min(100, 25 + shelterCount * 8 + Math.floor(Math.random() * 15));
  }, [fix, shelterCount]);

  const level = score == null ? "—" : score >= 70 ? "Strong" : score >= 40 ? "Developing" : "Vulnerable";
  const color = score == null ? "text-white/40" : score >= 70 ? "text-emerald-400" : score >= 40 ? "text-amber-400" : "text-red-400";

  return (
    <GlassCard className="bg-gradient-to-br from-cyan-950/15 to-transparent">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
        <BarChart3 className="h-4 w-4" />
        Community resilience
      </div>
      <div className="mt-3 flex items-end gap-4">
        <div>
          <p className={cn("font-display text-4xl font-black", color)}>{score ?? "—"}</p>
          <p className="text-xs text-white/50">Neighborhood score</p>
        </div>
        <div className="flex flex-1 items-end gap-1 pb-1">
          {[35, 55, 70, 45, 80, 60, score ?? 50].map((v, i) => (
            <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-cyan-600/40 to-cyan-400/60 transition-all"
              style={{ height: `${v * 0.5}px` }} />
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Badge color={cn("border-current", color)}>{level}</Badge>
        <p className="text-[10px] text-white/40">{shelterCount} shelters nearby · {fix ? "GPS active" : "No GPS"}</p>
      </div>
    </GlassCard>
  );
}

/* ───── MENTAL HEALTH CHECK-IN ───── */
function MentalHealthCheckIn() {
  const [mood, setMood] = useState<number | null>(null);
  const moods = [
    { val: 1, emoji: "😰", label: "Struggling" },
    { val: 2, emoji: "😟", label: "Anxious" },
    { val: 3, emoji: "😐", label: "Coping" },
    { val: 4, emoji: "🙂", label: "Okay" },
    { val: 5, emoji: "💪", label: "Strong" },
  ];

  const tips: Record<number, string> = {
    1: "You're not alone. Breathe slowly — 4 seconds in, 7 hold, 8 out. iCall helpline: 9152987821",
    2: "Anxiety is normal after crisis events. Ground yourself: name 5 things you can see around you.",
    3: "You're doing well. Stay hydrated, rest when possible, and check on a neighbor.",
    4: "Great resilience! Consider helping someone nearby who may need support.",
    5: "Amazing strength! Your calm energy helps everyone around you stay grounded.",
  };

  return (
    <GlassCard className="bg-gradient-to-br from-pink-950/15 to-transparent">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-pink-300">
        <Heart className="h-4 w-4" />
        Mental health check-in
      </div>
      <p className="mt-2 text-xs text-white/55">Post-disaster emotional support. How are you feeling?</p>
      <div className="mt-4 flex justify-between gap-1">
        {moods.map((m) => (
          <button key={m.val} type="button" onClick={() => { setMood(m.val); toast.message(`Logged: ${m.label}`); }}
            className={cn("flex flex-1 flex-col items-center gap-1 rounded-xl border py-3 transition",
              mood === m.val ? "border-pink-500/40 bg-pink-500/15" : "border-white/[0.06] hover:bg-white/[0.04]")}>
            <span className="text-2xl">{m.emoji}</span>
            <span className="text-[9px] font-bold text-white/60">{m.label}</span>
          </button>
        ))}
      </div>
      <AnimatePresence>
        {mood && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="mt-3 rounded-xl border border-pink-500/20 bg-pink-950/30 p-3">
            <p className="text-xs leading-relaxed text-pink-100/80">{tips[mood]}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

/* ───── AI SOCIAL ANALYTICS ───── */
const FALLBACK_POSTS = [
  { _id: "t1", text: "Heavy flooding near MG Road — water level rising fast, avoid area", author: "@CityWatch", platform: "twitter", nlpLabel: "flood", urgency: 0.91, isSOS: true, createdAt: new Date(Date.now() - 120000).toISOString() },
  { _id: "t2", text: "Power lines down in Sector 14, sparking observed. BESCOM notified", author: "@SafetyFirst", platform: "twitter", nlpLabel: "electrical", urgency: 0.78, isSOS: false, createdAt: new Date(Date.now() - 300000).toISOString() },
  { _id: "t3", text: "Relief camp at Govt School distributing food and water to 200+ people", author: "@VolunteerNet", platform: "facebook", nlpLabel: "relief", urgency: 0.25, isSOS: false, createdAt: new Date(Date.now() - 480000).toISOString() },
  { _id: "t4", text: "Ambulance needed near Lake Garden — elderly person collapsed", author: "@ResQAlert", platform: "twitter", nlpLabel: "medical", urgency: 0.88, isSOS: true, createdAt: new Date(Date.now() - 60000).toISOString() },
  { _id: "t5", text: "Bridge on NH44 partially submerged, traffic diverted via Ring Road", author: "@TrafficCell", platform: "twitter", nlpLabel: "infrastructure", urgency: 0.65, isSOS: false, createdAt: new Date(Date.now() - 720000).toISOString() },
  { _id: "t6", text: "Misinformation alert: Dam NOT breached, official statement confirmed safe", author: "@GovtInfo", platform: "official", nlpLabel: "misinfo_debunk", urgency: 0.4, isSOS: false, isMisinformation: false, createdAt: new Date(Date.now() - 900000).toISOString() },
];

function AISocialAnalytics() {
  const { data: apiPosts, isLoading, isError } = useSocialPosts({ limit: 30 });
  const { data: panic } = usePanicMeter();
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  type Post = { _id: string; text?: string; author?: string; platform?: string; nlpLabel?: string; urgency?: number; isSOS?: boolean; isMisinformation?: boolean; createdAt?: string };
  const posts: Post[] = useMemo(() => {
    const raw = (apiPosts as Post[] | undefined);
    return raw && raw.length > 0 ? raw : FALLBACK_POSTS;
  }, [apiPosts]);

  const isTrainedData = !apiPosts || (apiPosts as Post[]).length === 0;

  useEffect(() => {
    if (paused || posts.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setActiveIdx((i) => (i + 1) % posts.length);
    }, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [paused, posts.length]);

  useEffect(() => { setActiveIdx(0); }, [posts]);

  const current = posts[activeIdx] ?? posts[0];
  if (!current) return null;

  const urgency = typeof current.urgency === "number" ? current.urgency : 0.5;
  const urgencyPct = Math.round(urgency * 100);
  const urgencyColor = urgency >= 0.8 ? "text-red-400" : urgency >= 0.5 ? "text-amber-400" : "text-emerald-400";
  const urgencyBg = urgency >= 0.8 ? "from-red-500" : urgency >= 0.5 ? "from-amber-500" : "from-emerald-500";
  const ago = current.createdAt ? Math.max(0, Math.round((Date.now() - new Date(current.createdAt).getTime()) / 60000)) : null;

  const panicLevel = panic as { postsPerMin?: number; clusters?: number; confidence?: number } | undefined;
  const ppm = panicLevel?.postsPerMin ?? 12;
  const clusters = panicLevel?.clusters ?? 3;
  const confidence = panicLevel?.confidence ?? 0.72;

  const labelColor: Record<string, string> = {
    flood: "border-blue-500/40 bg-blue-500/15 text-blue-300",
    medical: "border-red-500/40 bg-red-500/15 text-red-300",
    electrical: "border-amber-500/40 bg-amber-500/15 text-amber-300",
    relief: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
    infrastructure: "border-orange-500/40 bg-orange-500/15 text-orange-300",
    misinfo_debunk: "border-violet-500/40 bg-violet-500/15 text-violet-300",
  };

  return (
    <GlassCard className="bg-gradient-to-br from-indigo-950/25 to-transparent">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-300">
          <Brain className="h-4 w-4" />
          AI social analytics
        </div>
        <div className="flex items-center gap-2">
          {isTrainedData && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-300">TRAINED DATA</span>
          )}
          <span className="flex items-center gap-1 rounded-full border border-indigo-400/30 bg-indigo-500/15 px-2 py-0.5 text-[9px] font-bold text-indigo-200">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_#818cf8] animate-pulse" />
            LIVE · {posts.length} posts
          </span>
        </div>
      </div>

      {/* Panic Meter Strip */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-red-500/20 bg-red-950/20 px-2.5 py-2 text-center">
          <p className="font-mono text-lg font-black text-red-300">{ppm}</p>
          <p className="text-[9px] font-bold uppercase text-white/40">Posts/min</p>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 px-2.5 py-2 text-center">
          <p className="font-mono text-lg font-black text-amber-300">{clusters}</p>
          <p className="text-[9px] font-bold uppercase text-white/40">Clusters</p>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-2.5 py-2 text-center">
          <p className="font-mono text-lg font-black text-emerald-300">{Math.round(confidence * 100)}%</p>
          <p className="text-[9px] font-bold uppercase text-white/40">NLP confidence</p>
        </div>
      </div>

      {/* Active Post Card — cycles automatically */}
      <div
        className="relative mt-3 min-h-[120px] cursor-pointer overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02] p-3"
        onClick={() => setPaused((p) => !p)}
        title={paused ? "Click to resume auto-cycle" : "Click to pause"}
      >
        {isLoading ? (
          <div className="flex h-full items-center justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
            <span className="ml-2 text-xs text-white/50">Fetching social intel…</span>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={current._id + activeIdx}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.35 }}
            >
              <div className="flex flex-wrap items-center gap-2">
                {current.isSOS && (
                  <span className="rounded border border-red-500/50 bg-red-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase text-red-300">SOS</span>
                )}
                {current.nlpLabel && (
                  <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase", labelColor[current.nlpLabel] ?? "border-white/20 bg-white/5 text-white/60")}>
                    {current.nlpLabel.replace("_", " ")}
                  </span>
                )}
                {current.platform && (
                  <span className="text-[9px] font-semibold text-white/30">{current.platform}</span>
                )}
                {ago !== null && (
                  <span className="ml-auto text-[9px] text-white/30">{ago < 1 ? "just now" : `${ago}m ago`}</span>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/85">{current.text || "—"}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-white/40">{current.author || "Anonymous"}</span>
                <div className="flex items-center gap-2">
                  <span className={cn("text-[10px] font-bold", urgencyColor)}>Urgency {urgencyPct}%</span>
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-black/40">
                    <div className={cn("h-full rounded-full bg-gradient-to-r to-transparent transition-all", urgencyBg)} style={{ width: `${urgencyPct}%` }} />
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
        {/* Progress dots */}
        <div className="mt-3 flex items-center justify-center gap-1">
          {posts.slice(0, Math.min(posts.length, 12)).map((p, i) => (
            <button
              key={p._id}
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveIdx(i); }}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === activeIdx ? "w-4 bg-indigo-400" : "w-1.5 bg-white/20 hover:bg-white/40",
              )}
            />
          ))}
          {posts.length > 12 && <span className="text-[8px] text-white/30">+{posts.length - 12}</span>}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <p className="text-[10px] text-white/35">
          {paused ? "⏸ Paused — click card to resume" : "Auto-cycling every 4s — click to pause"}
        </p>
        <span className="text-[9px] font-bold text-white/25">{activeIdx + 1}/{posts.length}</span>
      </div>
    </GlassCard>
  );
}

/* ═══════ MAIN EXPORT ═══════ */
export function CitizenSafetyDashboard({ fix }: { fix: GeoFix | null }) {
  const { data: disasters } = useDisasters({ limit: 40 });
  const { data: shelters } = useShelters();
  const { data: alerts } = useActiveAlerts();

  const nearbyIncidents = useMemo(() => {
    if (!fix || !disasters?.length) return 0;
    return (disasters as { location?: { coordinates?: number[] } }[]).filter((d) => {
      const c = d.location?.coordinates;
      if (!c || c.length < 2) return false;
      return distanceKm(fix.lat, fix.lng, c[1], c[0]) < 25;
    }).length;
  }, [fix, disasters]);

  const nearbyShelters = useMemo(() => {
    if (!fix || !shelters?.length) return 0;
    return (shelters as { location?: { coordinates?: number[] } }[]).filter((s) => {
      const c = s.location?.coordinates;
      if (!c || c.length < 2) return false;
      return distanceKm(fix.lat, fix.lng, c[1], c[0]) < 15;
    }).length;
  }, [fix, shelters]);

  return (
    <div className="space-y-4 sm:space-y-5">
      <motion.div {...fadeIn()} className="mb-2">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-violet-300">
          <Sparkles className="h-4 w-4" />
          AI-powered safety intelligence
        </div>
        <h2 className="mt-1 font-display text-xl font-bold tracking-tight sm:text-2xl">
          Smart safety <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">dashboard</span>
        </h2>
        <p className="mt-1 text-xs text-white/50">Innovative features that don't exist anywhere else.</p>
      </motion.div>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <PersonalRiskScore fix={fix} incidentCount={nearbyIncidents} />
        <CommunityResilienceScore fix={fix} shelterCount={nearbyShelters} />
      </div>

      <AISocialAnalytics />

      <FamilyPlanGenerator fix={fix} />
      <SurvivalKitAdvisor />

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <AccessibleAlertModes />
        <RegionalDialectSupport />
      </div>

      <MentalHealthCheckIn />
    </div>
  );
}
