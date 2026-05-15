import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Circle, CircleMarker, Polyline, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { incidents, shelters, rescueUnits, CENTER } from "@/lib/mockData";
import { Layers, Maximize2, Crosshair, Filter } from "lucide-react";

// Fix default marker icon issue (we use CircleMarker so safe to skip)
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;

const sevColor: Record<string, string> = {
  critical: "#ff3b30",
  high: "#ff9500",
  medium: "#ffd60a",
  low: "#34c759",
};

function AnimatedRescue({ unit }: { unit: typeof rescueUnits[number] }) {
  const [pos, setPos] = useState<[number, number]>(unit.position);
  useEffect(() => {
    const id = setInterval(() => {
      setPos(([lat, lng]) => [lat + (Math.random() - 0.5) * 0.0008, lng + (Math.random() - 0.5) * 0.0008]);
    }, 1500);
    return () => clearInterval(id);
  }, []);
  const color = unit.type === "boat" ? "#0a84ff" : unit.type === "air" ? "#bf5af2" : unit.type === "medical" ? "#34c759" : "#5ac8fa";
  return (
    <>
      <CircleMarker center={pos} radius={6} pathOptions={{ color, fillColor: color, fillOpacity: 0.9, weight: 2 }}>
        <Tooltip direction="top" offset={[0, -6]} opacity={1}>
          <div className="text-[11px] font-mono">
            <div className="font-bold" style={{ color }}>{unit.callsign}</div>
            <div className="text-gray-300">{unit.type.toUpperCase()} · {unit.status.toUpperCase()}</div>
            <div className="text-gray-400">ETA {unit.eta}</div>
          </div>
        </Tooltip>
      </CircleMarker>
      <CircleMarker center={pos} radius={14} pathOptions={{ color, fillOpacity: 0, weight: 1, dashArray: "3 3", opacity: 0.6 }} />
    </>
  );
}

function PulseIncident({ inc }: { inc: typeof incidents[number] }) {
  const c = sevColor[inc.severity];
  const [r, setR] = useState(8);
  useEffect(() => {
    const id = setInterval(() => setR((x) => (x >= 26 ? 8 : x + 2)), 90);
    return () => clearInterval(id);
  }, []);
  return (
    <>
      <Circle center={inc.position} radius={300 + (inc.severity === "critical" ? 200 : 0)} pathOptions={{ color: c, fillColor: c, fillOpacity: 0.08, weight: 1 }} />
      <CircleMarker center={inc.position} radius={r} pathOptions={{ color: c, fillOpacity: 0, weight: 2, opacity: Math.max(0, 1 - (r - 8) / 20) }} />
      <CircleMarker center={inc.position} radius={6} pathOptions={{ color: c, fillColor: c, fillOpacity: 1, weight: 2 }}>
        <Tooltip direction="top" offset={[0, -6]} opacity={1}>
          <div className="text-[11px] font-mono">
            <div className="font-bold" style={{ color: c }}>[{inc.id}] {inc.title}</div>
            <div className="text-gray-300 uppercase">{inc.type} · {inc.severity}</div>
            {inc.victims && <div className="text-gray-400">{inc.victims} affected · {inc.time} ago</div>}
          </div>
        </Tooltip>
      </CircleMarker>
    </>
  );
}

function MapEvents() {
  const map = useMap();
  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(id);
  }, [map]);
  return null;
}

export function DisasterMap() {
  // Rescue routes (incident -> rescue)
  const routes = useMemo(() => {
    return rescueUnits.filter(u => u.mission).map(u => {
      const target = incidents.find(i => i.id === u.mission);
      if (!target) return null;
      return { id: u.id, path: [u.position, target.position] as [number, number][] };
    }).filter(Boolean);
  }, []);

  return (
    <div className="absolute inset-0 scanlines">
      <MapContainer center={CENTER} zoom={13} zoomControl={false} className="absolute inset-0">
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEvents />

        {/* Cyclone vortex zone */}
        <Circle center={[19.110, 72.835]} radius={3500} pathOptions={{ color: "#bf5af2", fillColor: "#bf5af2", fillOpacity: 0.06, weight: 1, dashArray: "6 6" }} />
        <Circle center={[19.110, 72.835]} radius={1800} pathOptions={{ color: "#bf5af2", fillColor: "#bf5af2", fillOpacity: 0.10, weight: 1 }} />

        {/* Flood overlay */}
        <Circle center={[19.082, 72.881]} radius={1200} pathOptions={{ color: "#0a84ff", fillColor: "#0a84ff", fillOpacity: 0.12, weight: 1, dashArray: "4 4" }} />

        {incidents.map((i) => <PulseIncident key={i.id} inc={i} />)}

        {shelters.map((s) => (
          <CircleMarker key={s.id} center={s.position} radius={9}
            pathOptions={{ color: "#34c759", fillColor: "#0d2818", fillOpacity: 0.9, weight: 2 }}>
            <Tooltip direction="top" offset={[0, -6]} opacity={1}>
              <div className="text-[11px] font-mono">
                <div className="font-bold text-green-400">SHELTER · {s.name}</div>
                <div className="text-gray-300">{s.occupied}/{s.capacity} occupied</div>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}

        {routes.map((r) => r && (
          <Polyline key={r.id} positions={r.path}
            pathOptions={{ color: "#5ac8fa", weight: 2, dashArray: "6 8", opacity: 0.7 }} />
        ))}

        {rescueUnits.map((u) => <AnimatedRescue key={u.id} unit={u} />)}
      </MapContainer>

      {/* Map UI overlays */}
      <div className="absolute top-3 left-3 z-[400] flex flex-col gap-2">
        <div className="glass-strong rounded px-3 py-2 text-[10px] font-mono tracking-wider">
          <div className="flex items-center gap-1.5 text-emergency mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emergency blink" /> LIVE DIGITAL TWIN
          </div>
          <div className="text-muted-foreground">MMR-WEST · LAT 19.07 LNG 72.87</div>
          <div className="text-muted-foreground">TILESET: SAT-IR · OVERLAY: HAZARD/AI</div>
        </div>
        <FilterChip />
      </div>

      <div className="absolute top-3 right-3 z-[400] flex flex-col gap-2">
        <MapBtn icon={<Layers className="w-3.5 h-3.5" />} label="LAYERS" />
        <MapBtn icon={<Filter className="w-3.5 h-3.5" />} label="FILTER" />
        <MapBtn icon={<Crosshair className="w-3.5 h-3.5" />} label="LOCK" />
        <MapBtn icon={<Maximize2 className="w-3.5 h-3.5" />} label="FULL" />
      </div>

      <Legend />
      <CompassRadar />
    </div>
  );
}

function MapBtn({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="glass-strong rounded px-2 py-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-wider hover:bg-white/10 transition">
      {icon}<span>{label}</span>
    </button>
  );
}

function FilterChip() {
  const filters = ["FLOOD", "CYCLONE", "COLLAPSE", "SOS", "ROADS"];
  return (
    <div className="glass-strong rounded p-2 flex flex-wrap gap-1 max-w-[220px]">
      {filters.map((f, i) => (
        <span key={f} className={`text-[9px] font-bold px-1.5 py-0.5 rounded border tracking-wider
          ${i < 4 ? "bg-emergency/15 border-emergency/40 text-emergency" : "bg-white/5 border-white/10 text-muted-foreground"}`}>
          {f}
        </span>
      ))}
    </div>
  );
}

function Legend() {
  const items = [
    { c: "#ff3b30", l: "Critical Incident" },
    { c: "#ff9500", l: "High Severity" },
    { c: "#0a84ff", l: "Flood Zone" },
    { c: "#bf5af2", l: "Cyclone Eye" },
    { c: "#34c759", l: "Safe Shelter" },
    { c: "#5ac8fa", l: "Rescue Unit" },
  ];
  return (
    <div className="absolute bottom-3 left-3 z-[400] glass-strong rounded p-2.5 text-[10px] font-mono">
      <div className="text-muted-foreground tracking-widest mb-1.5">LEGEND</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {items.map((i) => (
          <div key={i.l} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: i.c, boxShadow: `0 0 8px ${i.c}` }} />
            <span>{i.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompassRadar() {
  return (
    <div className="absolute bottom-3 right-3 z-[400] w-24 h-24 glass-strong rounded-full relative overflow-hidden">
      <div className="absolute inset-2 rounded-full border border-intel/40" />
      <div className="absolute inset-5 rounded-full border border-intel/30" />
      <div className="absolute inset-8 rounded-full border border-intel/20" />
      <div className="absolute top-1/2 left-1/2 w-[2px] h-1/2 origin-top radar-sweep"
        style={{ background: "linear-gradient(to bottom, transparent, oklch(0.70 0.20 235 / 0.7))" }} />
      <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[8px] font-bold text-intel tracking-widest">N</div>
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold text-muted-foreground tracking-widest">RADAR</div>
    </div>
  );
}
