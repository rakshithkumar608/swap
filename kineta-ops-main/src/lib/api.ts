// src/lib/api.ts — Axios instance wired to the Node/Express backend (port 5000)
import axios from "axios";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api/v1";

export const api = axios.create({
  baseURL: BASE,
  timeout: 10_000,
  headers: { "Content-Type": "application/json" },
});

// ── Dual auth: ops (command) vs citizen — separate tokens & auto-login on 401 ─
export type AuthRole = "ops" | "citizen";

const TOKEN_OPS = "kavach.token.ops";
const TOKEN_CITIZEN = "kavach.token.citizen";
const LEGACY_TOKEN = "kavach.token";

/** Shown in citizen UI after login / auto-login as citizen. */
export const CITIZEN_AUTH_EMAIL_KEY = "kavach.citizen.authEmail";

function migrateLegacyToken(): void {
  if (typeof window === "undefined") return;
  try {
    const legacy = localStorage.getItem(LEGACY_TOKEN);
    if (legacy && !localStorage.getItem(TOKEN_OPS)) {
      localStorage.setItem(TOKEN_OPS, legacy);
    }
  } catch {
    /* ignore */
  }
}

export function tokenStorageKey(role: AuthRole): string {
  return role === "citizen" ? TOKEN_CITIZEN : TOKEN_OPS;
}

/** JWT for the given role (ops = command center, citizen = /citizen panel). */
export function readStoredToken(role: AuthRole): string | null {
  if (typeof window === "undefined") return null;
  migrateLegacyToken();
  try {
    return localStorage.getItem(tokenStorageKey(role));
  } catch {
    return null;
  }
}

/** Which role the SPA should authenticate as for the next API call (based on URL). */
export function authRoleForCurrentRoute(): AuthRole {
  if (typeof window === "undefined") return "ops";
  return window.location.pathname.startsWith("/citizen") ? "citizen" : "ops";
}

/**
 * Save or clear JWT for ops or citizen. Does not mutate axios defaults — a request
 * interceptor attaches the correct Bearer token per route.
 */
export function setAuthToken(token: string | null, role: AuthRole = "ops") {
  if (typeof window === "undefined") return;
  const key = tokenStorageKey(role);
  try {
    if (token) localStorage.setItem(key, token);
    else localStorage.removeItem(key);
  } catch {
    /* quota / private mode */
  }
}

export function clearAuthToken(role: AuthRole) {
  setAuthToken(null, role);
}

api.interceptors.request.use((config) => {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const role =
    (config as { _authRole?: AuthRole })._authRole ??
    (pathname.startsWith("/citizen") ? "citizen" : "ops");
  (config as { _authRole?: AuthRole })._authRole = role;
  const t = readStoredToken(role);
  if (t) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${t}`;
  } else if (config.headers && "Authorization" in config.headers) {
    delete config.headers.Authorization;
  }
  return config;
});

let autoLoginPromise: Promise<string> | null = null;

async function autoLoginOps(): Promise<string> {
  const res = await axios.post(`${BASE}/auth/login`, {
    email: "admin@resqai.in",
    password: "admin123",
  });
  const token = res.data.data?.token ?? res.data.token;
  if (typeof window !== "undefined" && token) setAuthToken(token, "ops");
  return token as string;
}

async function autoLoginCitizen(): Promise<string> {
  const res = await axios.post(`${BASE}/auth/login`, {
    email: "citizen@resqai.in",
    password: "citizen123",
  });
  const token = res.data.data?.token ?? res.data.token;
  if (typeof window !== "undefined" && token) {
    setAuthToken(token, "citizen");
    try {
      localStorage.setItem(CITIZEN_AUTH_EMAIL_KEY, "citizen@resqai.in");
    } catch {
      /* ignore */
    }
  }
  return token as string;
}

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && original && !(original as { _retried?: boolean })._retried) {
      (original as { _retried: boolean })._retried = true;
      const role = (original as { _authRole?: AuthRole })._authRole ?? authRoleForCurrentRoute();
      if (!autoLoginPromise) {
        autoLoginPromise = (role === "citizen" ? autoLoginCitizen() : autoLoginOps()).finally(() => {
          autoLoginPromise = null;
        });
      }
      const token = await autoLoginPromise;
      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    }
    const msg = err.response?.data?.message ?? err.message ?? "Unknown error";
    return Promise.reject(new Error(msg));
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// Auth
// ══════════════════════════════════════════════════════════════════════════════
export const authApi = {
  register: (body: { name: string; email: string; password: string; role?: string }) =>
    api.post("/auth/register", body),
  login: (body: { email: string; password: string }) =>
    api.post<{ token: string; user: Record<string, unknown> }>("/auth/login", body),
  logout: () => api.post("/auth/logout"),
  getMe: () => api.get("/auth/me"),
  updateMe: (body: Record<string, unknown>) => api.put("/auth/me", body),
};

// ══════════════════════════════════════════════════════════════════════════════
// Disasters  →  /api/v1/disasters
// ══════════════════════════════════════════════════════════════════════════════
export interface DisasterDoc {
  _id: string;
  type: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  location: { coordinates: [number, number] };
  affectedCount?: number;
  status: string;
  createdAt: string;
}

export const disasterApi = {
  getAll: (params?: Record<string, unknown>) =>
    api.get<{ success: boolean; data: DisasterDoc[]; total: number }>("/disasters", { params }),
  getStats: () => api.get<{ success: boolean; data: Record<string, unknown> }>("/disasters/stats"),
  getNearby: (lat: number, lng: number, radius?: number) =>
    api.get("/disasters/nearby", { params: { lat, lng, radius } }),
  getByType: (type: string) => api.get(`/disasters/type/${type}`),
  getById: (id: string) => api.get<{ success: boolean; data: DisasterDoc }>(`/disasters/${id}`),
  create: (body: Record<string, unknown>) => api.post("/disasters", body),
  update: (id: string, body: Record<string, unknown>) => api.put(`/disasters/${id}`, body),
  updateStatus: (id: string, status: string) =>
    api.patch(`/disasters/${id}/status`, { status }),
};

// ══════════════════════════════════════════════════════════════════════════════
// SOS  →  /api/v1/sos
// ══════════════════════════════════════════════════════════════════════════════
export interface SosDoc {
  _id: string;
  title?: string;
  message: string;
  severity?: "critical" | "high" | "medium" | "low";
  location?: { coordinates: [number, number] };
  status: "pending" | "acknowledged" | "dispatched" | "resolved";
  victimCount?: number;
  photoThumbnail?: string;
  createdAt: string;
}

export const sosApi = {
  getAll: (params?: Record<string, unknown>) =>
    api.get<{ success: boolean; data: SosDoc[]; total: number }>("/sos", { params }),
  getStats: () => api.get<{ success: boolean; data: Record<string, unknown> }>("/sos/stats"),
  getClusters: () => api.get("/sos/clusters"),
  getNearby: (lat: number, lng: number) =>
    api.get("/sos/nearby", { params: { lat, lng } }),
  getById: (id: string) => api.get<{ success: boolean; data: SosDoc }>(`/sos/${id}`),
  submit: (body: Record<string, unknown>) => api.post("/sos", body),
  relayGhost: (body: Record<string, unknown>) => api.post("/sos/relay", body),
  acknowledge: (id: string) => api.patch(`/sos/${id}/acknowledge`, {}),
  dispatchToRescue: (id: string) => api.patch(`/sos/${id}/dispatch-rescue`, {}),
  resolve: (id: string) => api.patch(`/sos/${id}/resolve`, {}),
};

// ══════════════════════════════════════════════════════════════════════════════
// Social  →  /api/v1/social
// ══════════════════════════════════════════════════════════════════════════════
export interface SocialPost {
  _id: string;
  user: string;
  text: string;
  urgency: number;
  isMisinformation?: boolean;
  nlpLabel?: string;
  createdAt: string;
}

export const socialApi = {
  getPosts: (params?: Record<string, unknown>) =>
    api.get<{ success: boolean; data: SocialPost[] }>("/social/posts", { params }),
  getSosFeed: () => api.get<{ success: boolean; data: SocialPost[] }>("/social/sos-feed"),
  getPanicMeter: () =>
    api.get<{ success: boolean; data: { postsPerMin: number; clusters: number; confidence: number } }>("/social/panic-meter"),
  getMisinformation: () => api.get("/social/misinformation"),
  getClusters: () => api.get("/social/clusters"),
  getPostById: (id: string) => api.get(`/social/posts/${id}`),
  ingestPost: (body: Record<string, unknown>) => api.post("/social/posts", body),
  batchIngest: (posts: Record<string, unknown>[]) =>
    api.post("/social/posts/batch", { posts }),
  flagPost: (id: string, reason: string) =>
    api.patch(`/social/posts/${id}/flag`, { reason }),
};

// ══════════════════════════════════════════════════════════════════════════════
// Shelters  →  /api/v1/shelters
// ══════════════════════════════════════════════════════════════════════════════
export interface ShelterDoc {
  _id: string;
  name: string;
  location: { coordinates: [number, number] };
  capacity: number;
  occupied: number;
  status: string;
}

export const shelterApi = {
  getAll: () =>
    api.get<{ success: boolean; data: ShelterDoc[] }>("/shelters"),
  getNearby: (lat: number, lng: number) =>
    api.get("/shelters/nearby", { params: { lat, lng } }),
  getById: (id: string) => api.get(`/shelters/${id}`),
  create: (body: Record<string, unknown>) => api.post("/shelters", body),
  update: (id: string, body: Record<string, unknown>) => api.put(`/shelters/${id}`, body),
  updateOccupancy: (id: string, delta: number) =>
    api.patch(`/shelters/${id}/occupancy`, { delta }),
};

// ══════════════════════════════════════════════════════════════════════════════
// Alerts  →  /api/v1/alerts
// ══════════════════════════════════════════════════════════════════════════════
export interface AlertDoc {
  _id: string;
  type: string;
  location: string;
  severity: "critical" | "high" | "medium" | "low";
  urgency: number;
  status: "active" | "cancelled";
  createdAt: string;
}

export const alertApi = {
  getAll: () => api.get<{ success: boolean; data: AlertDoc[] }>("/alerts"),
  getActive: () => api.get<{ success: boolean; data: AlertDoc[] }>("/alerts/active"),
  getById: (id: string) => api.get(`/alerts/${id}`),
  send: (body: Record<string, unknown>) => api.post("/alerts/send", body),
  broadcast: (body: Record<string, unknown>) => api.post("/alerts/broadcast", body),
  evacuate: (body: Record<string, unknown>) => api.post("/alerts/evacuate", body),
  cancel: (id: string) => api.patch(`/alerts/${id}/cancel`, {}),
};

// ══════════════════════════════════════════════════════════════════════════════
// Rescue Routes  →  /api/v1/routes
// ══════════════════════════════════════════════════════════════════════════════
/** Matches backend `RescueRoute` model (Mongo) — geo paths for coordination, not vehicle units. */
export interface RescueRouteDoc {
  _id: string;
  name?: string;
  origin?: { type?: "Point"; coordinates?: [number, number] };
  destination?: { type?: "Point"; coordinates?: [number, number] };
  waypoints?: { type?: string; coordinates?: number[] }[];
  geoJSON?: unknown;
  distanceKm?: number;
  durationMin?: number;
  blockedRoads?: { lat: number; lng: number; reason?: string }[];
  safetyScore?: number;
  status?: "active" | "blocked" | "completed";
  disasterId?: string;
  assignedTeam?: string;
  lastUpdated?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const rescueApi = {
  getAll: () => api.get<{ success: boolean; data: RescueRouteDoc[] }>("/routes"),
  getActive: () => api.get<{ success: boolean; data: RescueRouteDoc[] }>("/routes/active"),
  getById: (id: string) => api.get(`/routes/${id}`),
  calculate: (body: Record<string, unknown>) => api.post("/routes/calculate", body),
  recalculate: (id: string, body: Record<string, unknown>) =>
    api.post(`/routes/recalculate/${id}`, body),
  blockRoad: (id: string, body: Record<string, unknown>) =>
    api.post(`/routes/${id}/block`, body),
  update: (id: string, body: Record<string, unknown>) => api.put(`/routes/${id}`, body),
};

// ══════════════════════════════════════════════════════════════════════════════
// Resources  →  /api/v1/resources
// ══════════════════════════════════════════════════════════════════════════════
export const resourceApi = {
  getAll: () => api.get("/resources"),
  getSummary: () => api.get("/resources/summary"),
  create: (body: Record<string, unknown>) => api.post("/resources", body),
  deploy: (id: string) => api.patch(`/resources/${id}/deploy`, {}),
  returnResource: (id: string) => api.patch(`/resources/${id}/return`, {}),
};

// ══════════════════════════════════════════════════════════════════════════════
// Health
// ══════════════════════════════════════════════════════════════════════════════
export const healthApi = {
  check: () => api.get<{ status: string; service: string; version: string; uptime: number }>("/health"),
};
