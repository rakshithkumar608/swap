// Mock disaster data - centered on Mumbai/Konkan coast for cyclone+flood scenario
export const CENTER: [number, number] = [19.076, 72.8777];

export type Severity = "critical" | "high" | "medium" | "low";

export interface Incident {
  id: string;
  type: "flood" | "cyclone" | "collapse" | "fire" | "blockage" | "sos";
  position: [number, number];
  severity: Severity;
  title: string;
  victims?: number;
  time: string;
}

export const incidents: Incident[] = [
  { id: "I-2041", type: "flood", position: [19.082, 72.881], severity: "critical", title: "Flash Flood — Sector 14", victims: 47, time: "2m" },
  { id: "I-2042", type: "collapse", position: [19.061, 72.864], severity: "critical", title: "Building Collapse — Worli", victims: 12, time: "6m" },
  { id: "I-2043", type: "cyclone", position: [19.110, 72.835], severity: "high", title: "Cyclone Eye Approach", time: "live" },
  { id: "I-2044", type: "sos", position: [19.092, 72.872], severity: "critical", title: "Trapped Civilians", victims: 4, time: "1m" },
  { id: "I-2045", type: "blockage", position: [19.055, 72.890], severity: "medium", title: "Road Blocked — NH-66", time: "14m" },
  { id: "I-2046", type: "fire", position: [19.068, 72.852], severity: "high", title: "Electrical Fire — Substation", time: "9m" },
  { id: "I-2047", type: "sos", position: [19.099, 72.860], severity: "high", title: "Family of 5 — Roof Stranded", victims: 5, time: "3m" },
  { id: "I-2048", type: "flood", position: [19.045, 72.878], severity: "high", title: "Underpass Submerged", time: "11m" },
];

export interface Shelter { id: string; name: string; position: [number, number]; capacity: number; occupied: number; }
export const shelters: Shelter[] = [
  { id: "S-01", name: "Andheri Sports Complex", position: [19.119, 72.846], capacity: 800, occupied: 612 },
  { id: "S-02", name: "Bandra Civic Hall", position: [19.060, 72.830], capacity: 500, occupied: 500 },
  { id: "S-03", name: "Worli BMC Center", position: [19.018, 72.817], capacity: 350, occupied: 184 },
];

export interface RescueUnit {
  id: string; callsign: string; type: "boat" | "ground" | "air" | "medical";
  position: [number, number]; status: "enroute" | "onsite" | "standby"; eta: string; mission?: string;
}
export const rescueUnits: RescueUnit[] = [
  { id: "R-01", callsign: "ALPHA-1", type: "boat", position: [19.075, 72.870], status: "enroute", eta: "4 min", mission: "I-2044" },
  { id: "R-02", callsign: "RAVEN-2", type: "air", position: [19.095, 72.850], status: "enroute", eta: "2 min", mission: "I-2047" },
  { id: "R-03", callsign: "BRAVO-7", type: "ground", position: [19.063, 72.860], status: "onsite", eta: "—", mission: "I-2042" },
  { id: "R-04", callsign: "MEDIC-3", type: "medical", position: [19.080, 72.860], status: "standby", eta: "—" },
];

export const alertFeed = [
  { id: 1, sev: "critical" as Severity, type: "Flash Flood", loc: "Sector 14, Andheri E", urgency: 98, t: "00:02" },
  { id: 2, sev: "critical" as Severity, type: "Structural Collapse", loc: "Worli Sea Face", urgency: 96, t: "00:06" },
  { id: 3, sev: "high" as Severity, type: "SOS — Trapped Family", loc: "Mahim Junction", urgency: 91, t: "00:03" },
  { id: 4, sev: "high" as Severity, type: "Power Grid Failure", loc: "Western Sector", urgency: 84, t: "00:11" },
  { id: 5, sev: "medium" as Severity, type: "Road Blockage", loc: "NH-66 KM 14", urgency: 62, t: "00:14" },
  { id: 6, sev: "high" as Severity, type: "Shelter Capacity 100%", loc: "Bandra Civic", urgency: 78, t: "00:18" },
  { id: 7, sev: "critical" as Severity, type: "Bridge Stress Detected", loc: "Bandra-Worli Sealink", urgency: 94, t: "00:22" },
  { id: 8, sev: "medium" as Severity, type: "Communication Tower Down", loc: "Khar West", urgency: 70, t: "00:27" },
];

export const socialPosts = [
  { user: "@mumbai_local", text: "Water rising fast near Andheri station, kids stuck on overbridge #help", urgency: 94 },
  { user: "@reporter_av", text: "BMC reporting transformer fire at Worli substation, evacuating area", urgency: 88 },
  { user: "@citizen_42", text: "Heard loud crash — building shaking near Worli sea face. Calling family.", urgency: 96 },
  { user: "@volunteer_ngo", text: "Need boats at Sector 14, at least 40 people on rooftops", urgency: 97 },
  { user: "@verified_news", text: "Cyclone Trishna eye 18km offshore, landfall in 90 minutes", urgency: 92 },
];

export type FamilyStatus = "SAFE" | "NEED HELP" | "INJURED" | "TRAPPED" | "MISSING";
export const family: { name: string; role: string; status: FamilyStatus; loc: string; t: string }[] = [
  { name: "Aarav (You)", role: "Self", status: "SAFE", loc: "Andheri W", t: "live" },
  { name: "Priya", role: "Sister", status: "NEED HELP", loc: "Bandra E", t: "1m" },
  { name: "Father", role: "Father", status: "SAFE", loc: "Pune", t: "8m" },
  { name: "Rohan", role: "Brother", status: "MISSING", loc: "Last: Worli", t: "47m" },
  { name: "Maya", role: "Cousin", status: "TRAPPED", loc: "Worli Bldg-A", t: "12m" },
];

// ============ Victim Telemetry ============
export type VictimState = "TRAPPED" | "RESCUED" | "CRITICAL" | "MISSING" | "EVACUATED";
export interface Victim {
  id: string; name: string; age: number; vulnerability: "child" | "elderly" | "adult" | "medical";
  state: VictimState; zone: string; lastSignal: string; battery: number; aiPriority: number;
  survivability: number; loc: string;
}
export const victims: Victim[] = [
  { id: "V-001", name: "Maya S.", age: 8, vulnerability: "child", state: "TRAPPED", zone: "Worli Bldg-A · Floor 4", lastSignal: "12s", battery: 41, aiPriority: 99, survivability: 87, loc: "19.061,72.864" },
  { id: "V-002", name: "Ramesh K.", age: 72, vulnerability: "elderly", state: "TRAPPED", zone: "Worli Bldg-A · Floor 2", lastSignal: "24s", battery: 18, aiPriority: 97, survivability: 72, loc: "19.061,72.864" },
  { id: "V-003", name: "Priya N.", age: 31, vulnerability: "medical", state: "CRITICAL", zone: "Sector 14 Rooftop", lastSignal: "live", battery: 62, aiPriority: 95, survivability: 80, loc: "19.082,72.881" },
  { id: "V-004", name: "Aman T.", age: 26, vulnerability: "adult", state: "TRAPPED", zone: "Mahim Underpass", lastSignal: "1m", battery: 9, aiPriority: 92, survivability: 65, loc: "19.045,72.878" },
  { id: "V-005", name: "Family/5", age: 0, vulnerability: "child", state: "TRAPPED", zone: "Andheri Rooftop", lastSignal: "live", battery: 78, aiPriority: 89, survivability: 91, loc: "19.099,72.860" },
  { id: "V-006", name: "Vikram R.", age: 45, vulnerability: "adult", state: "RESCUED", zone: "Worli Pier", lastSignal: "—", battery: 100, aiPriority: 0, survivability: 100, loc: "—" },
  { id: "V-007", name: "Meera D.", age: 68, vulnerability: "elderly", state: "MISSING", zone: "Last: Worli Sea Face", lastSignal: "47m", battery: 0, aiPriority: 88, survivability: 40, loc: "—" },
  { id: "V-008", name: "Karan P.", age: 19, vulnerability: "adult", state: "EVACUATED", zone: "Bandra Shelter", lastSignal: "—", battery: 88, aiPriority: 0, survivability: 100, loc: "—" },
];

export const lastMessages = [
  { id: 1, from: "Maya S.", type: "voice", text: "I'm in the bathroom. Water is rising. Please hurry.", time: "12s ago", urgency: 99 },
  { id: 2, from: "Ramesh K.", type: "text", text: "Trapped under beam. Right leg pinned. Conscious.", time: "24s ago", urgency: 97 },
  { id: 3, from: "Aman T.", type: "photo", text: "[snapshot] Underpass — water at chest height", time: "1m ago", urgency: 92 },
];
