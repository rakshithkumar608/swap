import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useResqStore, ViewId } from "@/store/useResqStore";
import {
  LayoutGrid, Map, Siren, Truck, Brain, Home, Radio, Settings, ChevronLeft, ChevronRight,
  Activity, AlertOctagon, X, ShieldAlert,
} from "lucide-react";

const items: { id: ViewId; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string; urgent?: boolean }[] = [
  { id: "command", label: "Command Center", icon: LayoutGrid },
  { id: "intel", label: "Disaster Intelligence", icon: Map, badge: "8" },
  { id: "sos", label: "Live SOS Requests", icon: Siren, badge: "23", urgent: true },
  { id: "telemetry", label: "Victim Telemetry", icon: Activity, badge: "8", urgent: true },
  { id: "rescue", label: "Rescue Coordination", icon: Truck, badge: "12" },
  { id: "social", label: "AI Social Analytics", icon: Brain },
  { id: "shelter", label: "Shelter Intelligence", icon: Home, badge: "3" },
  { id: "ghost", label: "Live Beacon Uplink", icon: Radio, badge: "RTC" },
  { id: "beacon", label: "Emergency Beacon", icon: AlertOctagon, urgent: true },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const { sidebarOpen, toggleSidebar, activeView, setActiveView } = useResqStore();
  return (
    <motion.aside
      animate={{ width: sidebarOpen ? 240 : 64 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="hidden lg:flex relative shrink-0 glass-strong border-r border-border/60 flex-col z-20"
    >
      <div className="flex items-center justify-between p-3 border-b border-border/40">
        {sidebarOpen && (
          <span className="text-[10px] font-bold text-muted-foreground tracking-[0.2em]">OPERATIONS</span>
        )}
        <button onClick={toggleSidebar} className="ml-auto p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground transition">
          {sidebarOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {items.map((it) => {
          const Icon = it.icon;
          const active = activeView === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setActiveView(it.id)}
              className={`group relative w-full flex items-center gap-3 px-2.5 py-2.5 rounded-md transition-all
                ${active ? "bg-emergency/15 text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"}`}
            >
              {active && (
                <motion.span
                  layoutId="active-pill"
                  className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-emergency rounded-r glow-emergency"
                />
              )}
              <Icon className={`w-4 h-4 shrink-0 ${active ? "text-emergency" : ""} ${it.urgent ? "blink" : ""}`} />
              {sidebarOpen && (
                <>
                  <span className="text-[12.5px] font-medium truncate">{it.label}</span>
                  {it.badge && (
                    <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider
                      ${it.urgent ? "bg-emergency text-white blink" : "bg-white/8 text-muted-foreground"}`}>
                      {it.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {sidebarOpen && (
        <div className="p-3 border-t border-border/40 text-[10px] text-muted-foreground font-mono leading-relaxed">
          <div className="flex justify-between"><span>OP-CODE</span><span className="text-foreground">TRISHNA-3</span></div>
          <div className="flex justify-between"><span>SECTOR</span><span className="text-foreground">MMR-WEST</span></div>
          <div className="flex justify-between"><span>TEAMS</span><span className="text-safe">128 ONLINE</span></div>
        </div>
      )}
    </motion.aside>
  );
}

export function MobileNavDrawer() {
  const { mobileNavOpen, setMobileNavOpen, activeView, setActiveView } = useResqStore();
  return (
    <AnimatePresence>
      {mobileNavOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setMobileNavOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" />
          <motion.aside
            initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="lg:hidden fixed left-0 top-0 bottom-0 w-72 glass-strong border-r border-border/60 z-[70] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border/40">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-emergency" />
                <span className="text-[15px] font-bold tracking-[0.2em]">KAVACH</span>
              </div>
              <button onClick={() => setMobileNavOpen(false)} className="p-1 rounded hover:bg-white/5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-3 pt-3">
              <Link
                to="/citizen"
                onClick={() => setMobileNavOpen(false)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-safe/50 bg-safe/15 py-3 text-[12px] font-bold uppercase tracking-wide text-safe"
              >
                Citizen safety panel
              </Link>
            </div>
            <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
              {items.map((it) => {
                const Icon = it.icon;
                const active = activeView === it.id;
                return (
                  <button key={it.id} onClick={() => setActiveView(it.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-md transition-all
                      ${active ? "bg-emergency/15 text-foreground" : "text-muted-foreground hover:bg-white/5"}`}>
                    <Icon className={`w-4 h-4 ${active ? "text-emergency" : ""} ${it.urgent ? "blink" : ""}`} />
                    <span className="text-[13px] font-medium flex-1 text-left">{it.label}</span>
                    {it.badge && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded
                        ${it.urgent ? "bg-emergency text-white" : "bg-white/8 text-muted-foreground"}`}>{it.badge}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

const bottomItems: { id: ViewId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "command", label: "Map", icon: Map },
  { id: "sos", label: "SOS", icon: Siren },
  { id: "telemetry", label: "Victims", icon: Activity },
  { id: "rescue", label: "Rescue", icon: Truck },
];

export function MobileBottomNav() {
  const { activeView, setActiveView, setMobileNavOpen } = useResqStore();
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass-strong border-t border-border/60 grid grid-cols-5">
      {bottomItems.map(it => {
        const Icon = it.icon;
        const active = activeView === it.id;
        return (
          <button key={it.id} onClick={() => setActiveView(it.id)}
            className={`flex flex-col items-center gap-0.5 py-2 transition relative
              ${active ? "text-emergency" : "text-muted-foreground"}`}>
            {active && <span className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-emergency glow-emergency" />}
            <Icon className="w-5 h-5" />
            <span className="text-[9px] font-bold tracking-widest">{it.label}</span>
          </button>
        );
      })}
      <button onClick={() => setMobileNavOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-muted-foreground">
        <LayoutGrid className="w-5 h-5" />
        <span className="text-[9px] font-bold tracking-widest">MORE</span>
      </button>
    </nav>
  );
}
