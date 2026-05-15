import { create } from "zustand";

const DEVICE_KEY = "kavach.citizen.deviceId";
const NAME_KEY = "kavach.citizen.displayName";
const CONTACT_KEY = "kavach.citizen.iceContact";
const CHECKLIST_KEY = "kavach.citizen.checklist";
const MEDICAL_KEY = "kavach.citizen.medicalLine";

function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `citizen-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function loadStr(key: string, fallback = ""): string {
  if (typeof window === "undefined") return fallback;
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveStr(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota */
  }
}

export type ChecklistId = "water" | "torch" | "whistle" | "docs" | "meds" | "charger";

interface CitizenState {
  deviceId: string;
  displayName: string;
  iceContact: string;
  /** One line for responders: blood type, allergies, conditions */
  medicalLine: string;
  checklist: Record<ChecklistId, boolean>;
  ensureDeviceFromClient: () => void;
  setDisplayName: (v: string) => void;
  setIceContact: (v: string) => void;
  setMedicalLine: (v: string) => void;
  toggleChecklist: (id: ChecklistId) => void;
}

function loadChecklist(): Record<ChecklistId, boolean> {
  const base: Record<ChecklistId, boolean> = {
    water: false,
    torch: false,
    whistle: false,
    docs: false,
    meds: false,
    charger: false,
  };
  if (typeof window === "undefined") return base;
  try {
    const raw = localStorage.getItem(CHECKLIST_KEY);
    if (!raw) return base;
    const o = JSON.parse(raw) as Record<string, boolean>;
    return { ...base, ...o };
  } catch {
    return base;
  }
}

export const useCitizenStore = create<CitizenState>((set, get) => ({
  deviceId: "",
  displayName: loadStr(NAME_KEY),
  iceContact: loadStr(CONTACT_KEY),
  medicalLine: loadStr(MEDICAL_KEY),
  checklist: loadChecklist(),

  ensureDeviceFromClient: () => {
    const id = getOrCreateDeviceId();
    if (id && get().deviceId !== id) set({ deviceId: id });
  },

  setDisplayName: (v) => {
    saveStr(NAME_KEY, v);
    set({ displayName: v });
  },
  setIceContact: (v) => {
    saveStr(CONTACT_KEY, v);
    set({ iceContact: v });
  },
  setMedicalLine: (v) => {
    saveStr(MEDICAL_KEY, v);
    set({ medicalLine: v });
  },
  toggleChecklist: (id) => {
    const next = { ...get().checklist, [id]: !get().checklist[id] };
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(CHECKLIST_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    }
    set({ checklist: next });
  },
}));
