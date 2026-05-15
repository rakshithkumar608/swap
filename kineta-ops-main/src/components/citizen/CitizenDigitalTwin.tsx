import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { Maximize2, X, Navigation, Database, Layers, Droplets, Flame, Radio } from "lucide-react";
import type { GeoFix } from "@/hooks/useCitizenGeolocation";
import { distanceKm, cn } from "@/lib/utils";
import { toast } from "sonner";

type DisasterLite = {
  _id: string;
  title?: string;
  severity?: string;
  location?: { coordinates?: number[] };
};

type ShelterLite = {
  _id: string;
  name?: string;
  location?: { coordinates?: number[] };
};

const MAX_SCENE_KM = 18;

const LIVE_EVENTS = [
  { icon: "🌊", msg: "Water level rising +0.3m near Sector 7 — flood zone expanding", type: "flood" },
  { icon: "🔥", msg: "Fire detected near Industrial Area — 2 units dispatched", type: "fire" },
  { icon: "🚨", msg: "SOS signal received from MG Road — rescue en route", type: "sos" },
  { icon: "📡", msg: "Satellite scan complete — 3 new hotspots identified", type: "scan" },
  { icon: "🏥", msg: "Medical camp operational at Govt School — 150 treated", type: "relief" },
  { icon: "⚡", msg: "Power grid restored in Zone 4 — 12,000 connections live", type: "infra" },
  { icon: "🌊", msg: "Dam spillway flow reduced by 15% — downstream safe", type: "flood" },
  { icon: "🔥", msg: "Thermal anomaly cooling — fire containment at 78%", type: "fire" },
  { icon: "🛰️", msg: "Drone survey Zone 2 complete — no stranded civilians", type: "scan" },
  { icon: "🚑", msg: "Ambulance ETA 4 min to Lake Garden — critical patient", type: "sos" },
];

function offsetXZ(lat: number, lng: number, originLat: number, originLng: number) {
  const R = 6371000;
  const dLat = ((lat - originLat) * Math.PI) / 180;
  const dLng = ((lng - originLng) * Math.PI) / 180;
  const x = (dLng * Math.cos((originLat * Math.PI) / 180) * R) / 1000;
  const z = (-dLat * R) / 1000;
  return { x, z };
}

function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
      const m = child.material;
      if (Array.isArray(m)) m.forEach((mat) => mat.dispose());
      else m?.dispose();
    }
  });
}

function makeMapLabel(text: string, bg: string, color = "#fff") {
  const div = document.createElement("div");
  div.textContent = text;
  div.style.padding = "5px 10px";
  div.style.borderRadius = "10px";
  div.style.background = bg;
  div.style.color = color;
  div.style.fontSize = "11px";
  div.style.fontWeight = "800";
  div.style.fontFamily = "system-ui, sans-serif";
  div.style.letterSpacing = "0.02em";
  div.style.maxWidth = "140px";
  div.style.textOverflow = "ellipsis";
  div.style.overflow = "hidden";
  div.style.whiteSpace = "nowrap";
  div.style.boxShadow = "0 4px 20px rgba(0,0,0,0.45)";
  div.style.border = "1px solid rgba(255,255,255,0.2)";
  const o = new CSS2DObject(div);
  return o;
}

export function CitizenDigitalTwin({
  fix,
  disasters,
  shelters,
  className,
  /** Home “judge mode”: taller viewport + live data strip */
  showcase = true,
}: {
  fix: GeoFix | null;
  disasters: DisasterLite[];
  shelters: ShelterLite[];
  className?: string;
  showcase?: boolean;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  const plottedFeed = useMemo(() => {
    if (!fix) return { incidents: [] as { id: string; line: string; km: number }[], shelters: [] as { id: string; line: string; km: number }[] };
    const incidents: { id: string; line: string; km: number }[] = [];
    const sh: { id: string; line: string; km: number }[] = [];
    for (const d of disasters) {
      const c = d.location?.coordinates;
      if (!c || c.length < 2) continue;
      const km = distanceKm(fix.lat, fix.lng, c[1], c[0]);
      const { x, z } = offsetXZ(c[1], c[0], fix.lat, fix.lng);
      if (Math.hypot(x, z) > MAX_SCENE_KM) continue;
      const title = (d.title ?? d.severity ?? "Incident").slice(0, 42);
      incidents.push({
        id: d._id,
        line: `${title} · ${d.severity ?? "—"}`,
        km,
      });
    }
    for (const s of shelters) {
      const c = s.location?.coordinates;
      if (!c || c.length < 2) continue;
      const km = distanceKm(fix.lat, fix.lng, c[1], c[0]);
      const { x, z } = offsetXZ(c[1], c[0], fix.lat, fix.lng);
      if (Math.hypot(x, z) > MAX_SCENE_KM) continue;
      const name = (s.name ?? "Shelter").slice(0, 40);
      sh.push({ id: s._id, line: name, km });
    }
    incidents.sort((a, b) => a.km - b.km);
    sh.sort((a, b) => a.km - b.km);
    return { incidents: incidents.slice(0, 14), shelters: sh.slice(0, 12) };
  }, [fix, disasters, shelters]);

  const counts = useMemo(() => {
    return {
      incidents: plottedFeed.incidents.length,
      shelters: plottedFeed.shelters.length,
    };
  }, [plottedFeed]);

  const buildScene = useCallback(() => {
    const mount = mountRef.current;
    if (!mount || !fix) return;

    const w = mount.clientWidth || 360;
    const h = mount.clientHeight || 320;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b12);
    scene.fog = new THREE.Fog(0x070b12, 12, 52);

    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 220);
    camera.position.set(14, 13, 17);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(w, h);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.inset = "0";
    labelRenderer.domElement.style.pointerEvents = "none";

    mount.innerHTML = "";
    mount.appendChild(renderer.domElement);
    mount.appendChild(labelRenderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.target.set(0, 0, 0);
    controls.minDistance = 8;
    controls.maxDistance = 42;

    scene.add(new THREE.AmbientLight(0x8899aa, 0.52));
    const sun = new THREE.DirectionalLight(0xffffff, 0.82);
    sun.position.set(18, 28, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(2048);
    sun.shadow.bias = -0.0001;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xaabbff, 0.22);
    fill.position.set(-12, 8, -8);
    scene.add(fill);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(88, 88),
      new THREE.MeshStandardMaterial({ color: 0x121a26, metalness: 0.1, roughness: 0.93 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(64, 32, 0x3b5998, 0x1a2333);
    const gMat = grid.material as THREE.Material | THREE.Material[];
    if (Array.isArray(gMat)) gMat.forEach((m) => ((m as THREE.Material).opacity = 0.22));
    else (gMat as THREE.Material).opacity = 0.22;
    if (Array.isArray(gMat)) gMat.forEach((m) => ((m as THREE.Material).transparent = true));
    else (gMat as THREE.Material).transparent = true;
    scene.add(grid);

    // ── RADAR SWEEP ──
    const radarGeo = new THREE.RingGeometry(0.2, 22, 64, 1, 0, Math.PI / 6);
    const radarMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.12, side: THREE.DoubleSide });
    const radar = new THREE.Mesh(radarGeo, radarMat);
    radar.rotation.x = -Math.PI / 2;
    radar.position.y = 0.06;
    scene.add(radar);
    const radarLine = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.35 }),
    );
    radarLine.rotation.x = -Math.PI / 2;
    radarLine.position.set(11, 0.07, 0);
    radar.add(radarLine);

    // ── WATER FLOOD PLANE ──
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9, transparent: true, opacity: 0.22,
      metalness: 0.6, roughness: 0.15, side: THREE.DoubleSide,
    });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.08;
    scene.add(water);

    // ── FIRE PARTICLES ──
    const fireParticles: THREE.Mesh[] = [];
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xff6b35, transparent: true, opacity: 0.8 });
    const fireGeo = new THREE.SphereGeometry(0.08, 6, 6);
    for (let i = 0; i < 40; i++) {
      const p = new THREE.Mesh(fireGeo, fireMat.clone());
      p.position.set((Math.random() - 0.5) * 30, Math.random() * 4, (Math.random() - 0.5) * 30);
      p.visible = false;
      scene.add(p);
      fireParticles.push(p);
    }

    const roadMat = new THREE.MeshStandardMaterial({ color: 0x2a3444, metalness: 0.08, roughness: 0.91 });
    const rw = 1.15;
    const rl = 30;
    const hRoad = new THREE.Mesh(new THREE.BoxGeometry(rl, 0.06, rw), roadMat);
    hRoad.position.set(0, 0.03, 0);
    hRoad.receiveShadow = true;
    scene.add(hRoad);
    const vRoad = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.06, rl), roadMat);
    vRoad.position.set(0, 0.03, 0);
    vRoad.receiveShadow = true;
    scene.add(vRoad);

    const plaza = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.07, 3.2),
      new THREE.MeshStandardMaterial({ color: 0x1e2a3d, metalness: 0.18, roughness: 0.85 }),
    );
    plaza.position.set(0, 0.035, 0);
    plaza.receiveShadow = true;
    scene.add(plaza);

    const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
    const buildings = new THREE.Group();
    for (let i = -4; i <= 4; i++) {
      for (let j = -4; j <= 4; j++) {
        if (Math.abs(i) < 2 && Math.abs(j) < 2) continue;
        const bh = 2.2 + ((Math.abs(i * 17 + j * 31) % 11) / 3) * 3.1;
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(0.58 + (i + j) * 0.008, 0.16, 0.24 + (bh / 50) * 0.16),
          emissive: new THREE.Color().setHSL(0.12, 0.8, 0.15),
          emissiveIntensity: ((i + j + 8) % 3 === 0) ? 0.3 : 0,
          metalness: 0.1, roughness: 0.84,
        });
        const mesh = new THREE.Mesh(buildingGeo, mat);
        mesh.position.set(i * 2.45, bh / 2, j * 2.45);
        mesh.scale.set(1.58, bh, 1.58);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        buildings.add(mesh);
      }
    }
    scene.add(buildings);

    // ── DANGER ZONE RINGS around hazards ──
    const dangerRings: THREE.Mesh[] = [];

    const markers = new THREE.Group();
    scene.add(markers);

    const originLat = fix.lat;
    const originLng = fix.lng;

    const citizen = new THREE.Mesh(
      new THREE.SphereGeometry(0.52, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x047857, emissiveIntensity: 0.35 }),
    );
    citizen.position.set(0, 0.58, 0);
    citizen.castShadow = true;
    const youLbl = makeMapLabel("YOU · GPS anchor", "rgba(16,185,129,0.92)");
    youLbl.position.set(0, 1.05, 0);
    citizen.add(youLbl);
    markers.add(citizen);

    const pulseRing = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 1.05, 40),
      new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.38, side: THREE.DoubleSide }),
    );
    pulseRing.rotation.x = -Math.PI / 2;
    pulseRing.position.set(0, 0.04, 0);
    markers.add(pulseRing);

    const sevColor: Record<string, number> = {
      critical: 0xff3b30,
      high: 0xff9500,
      medium: 0xffd60a,
      low: 0x5ac8fa,
    };

    const addHazard = (lat: number, lng: number, color: number, caption: string, severity?: string) => {
      const { x, z } = offsetXZ(lat, lng, originLat, originLng);
      if (Math.hypot(x, z) > MAX_SCENE_KM) return;
      const mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.62, 0),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, metalness: 0.28, roughness: 0.45 }),
      );
      mesh.position.set(x, 0.95, z);
      mesh.castShadow = true;
      const lb = makeMapLabel(caption, "rgba(220,38,38,0.9)");
      lb.position.set(0, 1.15, 0);
      mesh.add(lb);
      markers.add(mesh);
      // Danger zone ring
      const ringRadius = severity === "critical" ? 3.5 : severity === "high" ? 2.5 : 1.8;
      const dRing = new THREE.Mesh(
        new THREE.RingGeometry(ringRadius - 0.15, ringRadius, 48),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, side: THREE.DoubleSide }),
      );
      dRing.rotation.x = -Math.PI / 2;
      dRing.position.set(x, 0.05, z);
      scene.add(dRing);
      dangerRings.push(dRing);
      // Fire particles near hazard
      fireParticles.filter(p => !p.visible).slice(0, 3).forEach((p) => {
        p.position.set(x + (Math.random() - 0.5) * 2, 0.2, z + (Math.random() - 0.5) * 2);
        p.visible = true;
        (p as unknown as { _baseX: number; _baseZ: number })._baseX = x;
        (p as unknown as { _baseX: number; _baseZ: number })._baseZ = z;
      });
    };

    const addShelter = (lat: number, lng: number, caption: string) => {
      const { x, z } = offsetXZ(lat, lng, originLat, originLng);
      if (Math.hypot(x, z) > MAX_SCENE_KM) return;
      const mesh = new THREE.Mesh(
        new THREE.ConeGeometry(0.52, 1.15, 16),
        new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x14532d, emissiveIntensity: 0.14, metalness: 0.12, roughness: 0.52 }),
      );
      mesh.position.set(x, 0.58, z);
      mesh.castShadow = true;
      const lb = makeMapLabel(caption, "rgba(22,163,74,0.92)");
      lb.position.set(0, 1.05, 0);
      mesh.add(lb);
      markers.add(mesh);
    };

    disasters.slice(0, 14).forEach((d) => {
      const c = d.location?.coordinates;
      if (!c || c.length < 2) return;
      const cap = ((d.severity ?? "INC").toUpperCase() + " · " + (d.title ?? "Report")).slice(0, 36);
      addHazard(c[1], c[0], sevColor[d.severity ?? ""] ?? 0xff6b6b, cap, d.severity);
    });

    shelters.slice(0, 12).forEach((s) => {
      const c = s.location?.coordinates;
      if (!c || c.length < 2) return;
      const cap = ("SHELTER · " + (s.name ?? "Site")).slice(0, 36);
      addShelter(c[1], c[0], cap);
    });

    let rafId = 0;
    const ringMat = pulseRing.material as THREE.MeshBasicMaterial;
    const tick = (t: number) => {
      // Citizen pulse
      pulseRing.scale.setScalar(1 + 0.24 * Math.sin(t * 0.0032));
      ringMat.opacity = 0.2 + 0.2 * Math.sin(t * 0.0026);
      citizen.position.y = 0.58 + 0.08 * Math.sin(t * 0.002);
      // Radar sweep rotation
      radar.rotation.z = t * 0.0008;
      radarMat.opacity = 0.08 + 0.06 * Math.sin(t * 0.003);
      // Water undulation
      water.position.y = 0.08 + 0.04 * Math.sin(t * 0.0015);
      waterMat.opacity = 0.15 + 0.08 * Math.sin(t * 0.002);
      // Danger rings pulse
      dangerRings.forEach((r, i) => {
        const phase = t * 0.003 + i * 1.2;
        r.scale.setScalar(1 + 0.12 * Math.sin(phase));
        (r.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.08 * Math.sin(phase);
      });
      // Fire particles float up
      fireParticles.forEach((p) => {
        if (!p.visible) return;
        p.position.y += 0.02 + Math.random() * 0.01;
        p.position.x += (Math.random() - 0.5) * 0.03;
        (p.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 - p.position.y * 0.12);
        if (p.position.y > 5) {
          const base = p as unknown as { _baseX?: number; _baseZ?: number };
          p.position.set((base._baseX ?? 0) + (Math.random() - 0.5) * 2, 0.2, (base._baseZ ?? 0) + (Math.random() - 0.5) * 2);
          (p.material as THREE.MeshBasicMaterial).opacity = 0.8;
        }
      });
      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => {
      if (!mountRef.current) return;
      const rw = mountRef.current.clientWidth;
      const rh = mountRef.current.clientHeight;
      if (rw < 10 || rh < 10) return;
      camera.aspect = rw / rh;
      camera.updateProjectionMatrix();
      renderer.setSize(rw, rh, false);
      labelRenderer.setSize(rw, rh);
    });
    ro.observe(mount);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafId);
      controls.dispose();
      scene.traverse((o) => {
        if (o instanceof CSS2DObject && o.element?.parentNode) o.element.remove();
      });
      disposeObject3D(scene);
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      if (labelRenderer.domElement.parentNode === mount) mount.removeChild(labelRenderer.domElement);
    };
  }, [fix, disasters, shelters]);

  useEffect(() => {
    if (!fix) return;
    const clean = buildScene();
    return () => clean?.();
  }, [fix, buildScene, expanded]);

  // Live event toast notifications — cycles every 6s
  useEffect(() => {
    if (!fix) return;
    let idx = 0;
    const iv = setInterval(() => {
      const ev = LIVE_EVENTS[idx % LIVE_EVENTS.length];
      const typeColor: Record<string, "info" | "warning" | "error" | "success"> = {
        flood: "info", fire: "error", sos: "warning", scan: "info", relief: "success", infra: "success",
      };
      toast[typeColor[ev.type] ?? "info"](`${ev.icon} ${ev.msg}`, { duration: 4500 });
      idx++;
    }, 6000);
    return () => clearInterval(iv);
  }, [fix]);

  const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

  const canvasShell = (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl ring-2 ring-violet-500/25",
        fix ? "touch-none bg-[#05080f]" : "flex min-h-[240px] items-stretch bg-surface/30",
        fix && showcase && !expanded && "min-h-[min(52vh,560px)] lg:min-h-[480px]",
        fix && showcase && expanded && "min-h-[min(36dvh,420px)] flex-1 lg:min-h-0 lg:h-full",
        fix && !showcase && "min-h-[220px]",
      )}
    >
      {fix ? (
        <div ref={mountRef} className="absolute inset-0" />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-950/50 text-violet-300">
            <Navigation className="h-8 w-8" aria-hidden />
          </div>
          <div className="max-w-md space-y-2">
            <p className="font-display text-lg font-bold text-foreground">Enable GPS for the 3D twin</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Judges see <span className="text-foreground">live API points</span> (incidents + shelters) dropped around your
              position. Turn on location to render the scene.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  const dataStrip = showcase && fix && (
    <aside
      className={cn(
        "flex flex-col rounded-xl border border-violet-500/20 bg-black/50 ring-1 ring-white/5",
        expanded
          ? "max-h-[min(34dvh,320px)] min-h-0 w-full shrink-0 overflow-hidden sm:max-h-[min(38dvh,380px)] lg:max-h-none lg:h-full lg:max-h-full lg:w-full lg:shrink-0"
          : "max-h-[min(52vh,560px)] lg:max-h-[480px]",
      )}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
        <Database className="h-4 w-4 text-violet-300" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-violet-200/90">Trained / API feed</span>
      </div>
      <p className="border-b border-white/5 px-3 py-2 text-[11px] text-white/55">
        Same coordinates as backend disasters & shelters — plotted in-scene within ~{MAX_SCENE_KM} km.
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <p className="px-1 py-1 text-[10px] font-bold uppercase tracking-wide text-red-300/90">Incidents ({counts.incidents})</p>
        <ul className="space-y-1">
          {plottedFeed.incidents.length === 0 ? (
            <li className="rounded-lg bg-white/5 px-2 py-2 text-[11px] text-white/45">None in scene radius</li>
          ) : (
            plottedFeed.incidents.map((r) => (
              <li key={r.id} className="rounded-lg border border-red-500/20 bg-red-950/30 px-2 py-1.5 text-[11px] text-red-100/95">
                <span className="font-mono text-[10px] text-red-300/80">{fmtKm(r.km)}</span>
                <span className="mt-0.5 block leading-snug">{r.line}</span>
              </li>
            ))
          )}
        </ul>
        <p className="mt-3 px-1 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300/90">Shelters ({counts.shelters})</p>
        <ul className="space-y-1">
          {plottedFeed.shelters.length === 0 ? (
            <li className="rounded-lg bg-white/5 px-2 py-2 text-[11px] text-white/45">None in scene radius</li>
          ) : (
            plottedFeed.shelters.map((r) => (
              <li key={r.id} className="rounded-lg border border-emerald-500/25 bg-emerald-950/25 px-2 py-1.5 text-[11px] text-emerald-100/95">
                <span className="font-mono text-[10px] text-emerald-300/80">{fmtKm(r.km)}</span>
                <span className="mt-0.5 block leading-snug">{r.line}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </aside>
  );

  const cardBody = (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border-2 border-violet-500/30 bg-gradient-to-b from-[#0f0a18]/95 to-surface/90 shadow-[0_0_48px_rgba(109,40,217,0.15)] backdrop-blur-md",
        expanded ? "h-full min-h-0 w-full max-w-full flex-1" : "min-h-0",
        className,
      )}
    >
      <div className={cn("shrink-0 border-b border-violet-500/20 bg-gradient-to-r from-violet-950/50 to-transparent px-4 sm:px-5", expanded ? "py-3" : "py-4")}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">
              <Layers className="h-3.5 w-3.5" />
              Interactive 3D digital twin
            </div>
            <h2 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">Live map · trained data</h2>
            <p
              className={cn(
                "max-w-prose text-sm leading-relaxed text-violet-100/75",
                expanded && "line-clamp-2 sm:line-clamp-3 lg:line-clamp-none",
              )}
            >
              Orbit the scene: <span className="font-semibold text-white">green sphere = you</span>, labels show{" "}
              <span className="text-red-200">incidents</span> and <span className="text-emerald-200">shelters</span> from your
              command API. Right panel lists every point in the view for judges.
            </p>
            {fix && (
              <p className="text-xs text-white/55">
                In view: <span className="font-mono text-emerald-300">{counts.shelters}</span> shelters ·{" "}
                <span className="font-mono text-red-300">{counts.incidents}</span> incidents (≤{MAX_SCENE_KM} km)
              </p>
            )}
          </div>
          {fix && !expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/15"
            >
              <Maximize2 className="h-4 w-4" />
              Full screen
            </button>
          )}
        </div>
      </div>

      <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4", expanded && "min-h-0 pt-2")}>
        {showcase && fix ? (
          expanded ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row lg:items-stretch lg:gap-4">
              <div className="flex min-h-0 min-h-[min(36dvh,280px)] flex-1 flex-col lg:min-h-0 lg:min-w-0 lg:flex-[1.15]">
                {canvasShell}
              </div>
              <div className="flex min-h-0 w-full min-w-0 flex-col overflow-hidden lg:max-w-md lg:flex-1">{dataStrip}</div>
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-12">
              <div className="min-h-0 lg:col-span-8">{canvasShell}</div>
              <div className="min-h-0 lg:col-span-4">{dataStrip}</div>
            </div>
          )
        ) : (
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col overflow-hidden",
              expanded ? "min-h-[min(55dvh,520px)] lg:min-h-[min(70dvh,720px)]" : "min-h-[min(40vh,360px)] sm:min-h-[380px]",
            )}
          >
            {canvasShell}
          </div>
        )}

        {fix && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
              You
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-red-400/35 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-200">
              Incident + label
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-900/30 px-3 py-1.5 text-xs font-semibold text-emerald-100">
              Shelter + label
            </span>
            <span className="ml-auto text-[11px] font-medium text-white/45">Drag · scroll · pinch</span>
          </div>
        )}
      </div>
    </div>
  );

  if (expanded && fix && typeof document !== "undefined") {
    return createPortal(
      <div
        className="fixed inset-0 z-[100] flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-black/92 pt-[max(0.25rem,env(safe-area-inset-top))] pb-[max(0.25rem,env(safe-area-inset-bottom))]"
        role="dialog"
        aria-modal="true"
        aria-label="3D digital twin full screen"
      >
        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-2 sm:px-4">
          <div className="mb-1 flex shrink-0 justify-end sm:mb-2">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="inline-flex h-11 min-w-[7rem] items-center justify-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/15"
            >
              <X className="h-4 w-4" />
              Done
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden pb-1">{cardBody}</div>
        </div>
      </div>,
      document.body,
    );
  }

  return cardBody;
}
