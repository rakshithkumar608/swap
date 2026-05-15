// src/lib/nlpApi.ts — Axios instance wired to the FastAPI NLP service (port 8000)
import axios from "axios";

const NLP_BASE = import.meta.env.VITE_NLP_URL ?? "http://localhost:8000";

export const nlpApi = axios.create({
  baseURL: NLP_BASE,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

nlpApi.interceptors.response.use(
  (r) => r,
  (err) => {
    const msg = err.response?.data?.detail ?? err.message ?? "NLP service error";
    return Promise.reject(new Error(msg));
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// NLP — Classify   POST /classify/classify
// ══════════════════════════════════════════════════════════════════════════════
export interface ClassifyResult {
  success: boolean;
  label: string;
  confidence: number;
  is_disaster: boolean;
}

export const nlpClassifyApi = {
  /** Classify a single text */
  one: (text: string) =>
    nlpApi.post<ClassifyResult>("/classify/classify", { text }),

  /** Batch classify multiple texts */
  batch: (texts: string[]) =>
    nlpApi.post<{ success: boolean; results: ClassifyResult[] }>(
      "/classify/classify/batch",
      { texts }
    ),
};

// ══════════════════════════════════════════════════════════════════════════════
// NLP — Cluster    POST /cluster/cluster
// ══════════════════════════════════════════════════════════════════════════════
export interface ClusterPost {
  id: string;
  text: string;
  location?: { coordinates: [number, number] };
}

export interface ClusterResult {
  success: boolean;
  clusters: Record<string, ClusterPost[]>;
  total_posts: number;
  total_clusters: number;
  message: string;
}

export const nlpClusterApi = {
  cluster: (posts: ClusterPost[]) =>
    nlpApi.post<ClusterResult>("/cluster/cluster", { posts }),
};

// ══════════════════════════════════════════════════════════════════════════════
// NLP — Misinformation   POST /misinfo/misinfo
// ══════════════════════════════════════════════════════════════════════════════
export interface MisinfoResult {
  is_misinformation: boolean;
  confidence: number;
  reason: string;
  has_sos_keywords: boolean;
}

export const nlpMisinfoApi = {
  check: (text: string) =>
    nlpApi.post<MisinfoResult>("/misinfo/misinfo", { text }),
};

// ══════════════════════════════════════════════════════════════════════════════
// NLP — Health
// ══════════════════════════════════════════════════════════════════════════════
export const nlpHealthApi = {
  check: () =>
    nlpApi.get<{ status: string; service: string; models_loaded: boolean }>("/health"),
};
