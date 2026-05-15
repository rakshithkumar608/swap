import { create } from "zustand";

export type ViewId =
  | "command"
  | "intel"
  | "sos"
  | "rescue"
  | "social"
  | "shelter"
  | "ghost"
  | "telemetry"
  | "beacon"
  | "settings";

interface Permissions {
  location: boolean;
  microphone: boolean;
  camera: boolean;
  notifications: boolean;
}

interface ResqState {
  // Onboarding / permissions
  onboarded: boolean;
  permissions: Permissions;
  setOnboarded: (v: boolean) => void;
  grantPermission: (k: keyof Permissions) => void;
  grantAllPermissions: () => void;

  // Emergency
  emergencyActive: boolean;
  emergencyStep: number;
  setEmergencyActive: (v: boolean) => void;
  setEmergencyStep: (n: number) => void;
  silentSos: boolean;
  toggleSilentSos: () => void;

  // Modes
  powerSaver: boolean;
  togglePowerSaver: () => void;

  // Navigation
  activeView: ViewId;
  setActiveView: (v: ViewId) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;

  selectedIncident: string | null;
  setSelectedIncident: (id: string | null) => void;
}

const PERM_KEY = "kavach.permissions";
const ONB_KEY = "kavach.onboarded";

const loadPerms = (): Permissions => {
  if (typeof window === "undefined") return { location: false, microphone: false, camera: false, notifications: false };
  try { return JSON.parse(localStorage.getItem(PERM_KEY) || "") || { location: false, microphone: false, camera: false, notifications: false }; }
  catch { return { location: false, microphone: false, camera: false, notifications: false }; }
};
const loadOnb = () => typeof window !== "undefined" && localStorage.getItem(ONB_KEY) === "1";

export const useResqStore = create<ResqState>((set) => ({
  onboarded: loadOnb(),
  permissions: loadPerms(),
  setOnboarded: (v) => { if (typeof window !== "undefined") localStorage.setItem(ONB_KEY, v ? "1" : "0"); set({ onboarded: v }); },
  grantPermission: (k) => set((s) => {
    const next = { ...s.permissions, [k]: true };
    if (typeof window !== "undefined") localStorage.setItem(PERM_KEY, JSON.stringify(next));
    return { permissions: next };
  }),
  grantAllPermissions: () => set(() => {
    const next = { location: true, microphone: true, camera: true, notifications: true };
    if (typeof window !== "undefined") localStorage.setItem(PERM_KEY, JSON.stringify(next));
    return { permissions: next };
  }),

  emergencyActive: false,
  emergencyStep: 0,
  setEmergencyActive: (v) => set({ emergencyActive: v, emergencyStep: v ? 1 : 0 }),
  setEmergencyStep: (n) => set({ emergencyStep: n }),
  silentSos: false,
  toggleSilentSos: () => set((s) => ({ silentSos: !s.silentSos })),

  powerSaver: false,
  togglePowerSaver: () => set((s) => ({ powerSaver: !s.powerSaver })),

  activeView: "command",
  setActiveView: (v) => set({ activeView: v, mobileNavOpen: false }),
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  mobileNavOpen: false,
  setMobileNavOpen: (v) => set({ mobileNavOpen: v }),

  selectedIncident: null,
  setSelectedIncident: (id) => set({ selectedIncident: id }),
}));
