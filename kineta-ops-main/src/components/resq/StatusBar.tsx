import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { AlertOctagon, Activity, Radio, Users, Wifi, Zap, Brain, ShieldAlert, Menu, HeartHandshake } from "lucide-react";
import { useResqStore } from "@/store/useResqStore";

function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setInterval(() => setV((x) => Math.max(0, x + Math.floor(Math.random() * 5) - 1)), 2200);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono tabular-nums">{v}{suffix}</span>;
}

export function StatusBar() {
  const { setMobileNavOpen } = useResqStore();
  return (
    <header className="relative h-14 shrink-0 glass-strong border-b border-border/60 flex items-center px-3 sm:px-4 gap-2 z-30">
      <button onClick={() => setMobileNavOpen(true)} className="lg:hidden p-1.5 rounded hover:bg-white/5">
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-2 pr-3 sm:border-r border-border/60">
        <div className="relative">
          <ShieldAlert className="w-7 h-7 text-emergency text-glow-emergency" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emergency blink" />
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-[0.18em]">KA<span className="text-emergency">VACH</span></div>
          <div className="text-[9px] text-muted-foreground tracking-widest uppercase hidden sm:block">Disaster Intel OS · v4.2</div>
        </div>
      </div>

      <Badge color="emergency" pulse label="DEFCON 2" sub="SEVERITY" />
      <Stat icon={<AlertOctagon className="w-3.5 h-3.5" />} label="ACTIVE INCIDENTS" value={<Counter value={47} />} tone="emergency" />
      <Stat icon={<Users className="w-3.5 h-3.5" />} label="RESCUE UNITS" value={<Counter value={128} />} tone="intel" />
      <Stat icon={<Radio className="w-3.5 h-3.5" />} label="LIVE SOS" value={<Counter value={23} />} tone="emergency" />
      <Stat icon={<Zap className="w-3.5 h-3.5" />} label="GRID" value="62%" tone="warning" />
      <Stat icon={<Wifi className="w-3.5 h-3.5" />} label="NETWORK" value="MESH" tone="warning" />
      <Stat icon={<Brain className="w-3.5 h-3.5" />} label="AI THREAT" value="HIGH" tone="emergency" />

      <div className="ml-auto flex items-center gap-2 sm:gap-3 text-[11px] font-mono">
        <Link
          to="/citizen"
          className="inline-flex items-center gap-1 rounded-md border border-safe/40 bg-safe/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-safe hover:bg-safe/20 sm:text-[10px]"
          title="Citizen safety panel"
        >
          <HeartHandshake className="h-3.5 w-3.5 shrink-0" />
          Citizen
        </Link>
        <LiveClock />
        <AnimatePresence>
          <motion.div
            key="live"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-emergency/15 border border-emergency/40"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emergency blink" />
            <span className="text-emergency font-semibold tracking-widest">LIVE</span>
          </motion.div>
        </AnimatePresence>
      </div>
    </header>
  );
}

function Badge({ color, pulse, label, sub }: { color: string; pulse?: boolean; label: string; sub?: string }) {
  return (
    <div className={`relative px-2.5 py-1 rounded border bg-${color}/10 border-${color}/40 flex items-center gap-1.5`}>
      {pulse && <span className={`w-1.5 h-1.5 rounded-full bg-${color} blink`} />}
      <div className="leading-none">
        <div className={`text-[11px] font-bold text-${color} tracking-wider`}>{label}</div>
        {sub && <div className="text-[8px] text-muted-foreground tracking-widest mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone: string }) {
  return (
    <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded border border-border/50 bg-surface/40">
      <span className={`text-${tone}`}>{icon}</span>
      <div className="leading-tight">
        <div className="text-[8px] text-muted-foreground tracking-[0.15em]">{label}</div>
        <div className={`text-[12px] font-bold text-${tone}`}>{value}</div>
      </div>
    </div>
  );
}

function LiveClock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Activity className="w-3 h-3 text-intel" />
      <span>UTC {t.toISOString().slice(11, 19)}</span>
    </div>
  );
}
