// src/hooks/useBackendData.ts
// All React-Query hooks that talk to the Node backend + NLP service.
// Each hook: returns { data, isLoading, isError, error } plus mutation helpers.
// Falls back gracefully — callers should use mockData when data is undefined.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  disasterApi,
  sosApi,
  socialApi,
  shelterApi,
  alertApi,
  rescueApi,
  resourceApi,
  healthApi,
  authApi,
  setAuthToken,
  type AuthRole,
} from "@/lib/api";
import { nlpClassifyApi, nlpClusterApi, nlpMisinfoApi, nlpHealthApi } from "@/lib/nlpApi";

// Prevent queries from executing during SSR (no window = server)
const isClient = typeof window !== "undefined";

// ── Query Keys ────────────────────────────────────────────────────────────────
export const QK = {
  health: ["health"] as const,
  nlpHealth: ["nlp-health"] as const,
  disasters: ["disasters"] as const,
  disasterStats: ["disaster-stats"] as const,
  sos: ["sos"] as const,
  sosStats: ["sos-stats"] as const,
  socialPosts: ["social-posts"] as const,
  panicMeter: ["panic-meter"] as const,
  misinformation: ["misinformation"] as const,
  shelters: ["shelters"] as const,
  alerts: ["alerts-active"] as const,
  rescue: ["rescue-routes"] as const,
  resources: ["resources"] as const,
  resourceSummary: ["resource-summary"] as const,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Health Checks
// ═══════════════════════════════════════════════════════════════════════════════
export function useBackendHealth() {
  return useQuery({
    queryKey: QK.health,
    queryFn: () => healthApi.check().then((r) => r.data),
    staleTime: 30_000,
    retry: 2,
    enabled: isClient,
  });
}

export function useNlpHealth() {
  return useQuery({
    queryKey: QK.nlpHealth,
    queryFn: () => nlpHealthApi.check().then((r) => r.data),
    staleTime: 30_000,
    retry: 2,
    enabled: isClient,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Auth
// ═══════════════════════════════════════════════════════════════════════════════
export function useLogin(options?: { role?: AuthRole }) {
  const role = options?.role ?? "ops";
  return useMutation({
    mutationFn: (creds: { email: string; password: string }) =>
      authApi.login(creds).then((r) => r.data as { token?: string; user?: unknown; data?: { token?: string } }),
    onSuccess: (data) => {
      const token = data.data?.token ?? data.token;
      if (token) setAuthToken(token, role);
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (body: { name: string; email: string; password: string; role?: string }) =>
      authApi.register(body).then((r) => r.data),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Disasters
// ═══════════════════════════════════════════════════════════════════════════════
export function useDisasters(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: [...QK.disasters, params],
    queryFn: () => disasterApi.getAll(params).then((r) => r.data.data),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 1,
    enabled: isClient,
  });
}

export function useDisasterStats() {
  return useQuery({
    queryKey: QK.disasterStats,
    queryFn: () => disasterApi.getStats().then((r) => r.data.data),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
    enabled: isClient,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOS
// ═══════════════════════════════════════════════════════════════════════════════
export function useSosReports(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: [...QK.sos, params],
    queryFn: () => sosApi.getAll(params).then((r) => r.data.data),
    staleTime: 10_000,
    refetchInterval: 20_000,
    retry: 1,
    enabled: isClient,
  });
}

export function useSosStats() {
  return useQuery({
    queryKey: QK.sosStats,
    queryFn: () => sosApi.getStats().then((r) => r.data.data),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 1,
    enabled: isClient,
  });
}

export function useAcknowledgeSos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sosApi.acknowledge(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK.sos });
      void qc.invalidateQueries({ queryKey: QK.sosStats });
    },
  });
}

export function useResolveSos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sosApi.resolve(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK.sos });
      void qc.invalidateQueries({ queryKey: QK.sosStats });
    },
  });
}

export function useDispatchSosToRescue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sosApi.dispatchToRescue(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK.sos });
      void qc.invalidateQueries({ queryKey: QK.sosStats });
    },
  });
}

export function useSubmitSos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => sosApi.submit(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.sos }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Social / AI Analytics
// ═══════════════════════════════════════════════════════════════════════════════
export function useSocialPosts(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: [...QK.socialPosts, params],
    queryFn: () => socialApi.getPosts(params).then((r) => r.data.data),
    staleTime: 10_000,
    refetchInterval: 20_000,
    retry: 1,
    enabled: isClient,
  });
}

export function usePanicMeter() {
  return useQuery({
    queryKey: QK.panicMeter,
    queryFn: () => socialApi.getPanicMeter().then((r) => r.data.data),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 1,
    enabled: isClient,
  });
}

export function useMisinformation() {
  return useQuery({
    queryKey: QK.misinformation,
    queryFn: () => socialApi.getMisinformation().then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
    enabled: isClient,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shelters
// ═══════════════════════════════════════════════════════════════════════════════
export function useShelters() {
  return useQuery({
    queryKey: QK.shelters,
    queryFn: () => shelterApi.getAll().then((r) => r.data.data),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
    enabled: isClient,
  });
}

export function useUpdateShelterOccupancy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) =>
      shelterApi.updateOccupancy(id, delta),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.shelters }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Alerts
// ═══════════════════════════════════════════════════════════════════════════════
export function useActiveAlerts() {
  return useQuery({
    queryKey: QK.alerts,
    queryFn: () => alertApi.getActive().then((r) => r.data.data),
    staleTime: 10_000,
    refetchInterval: 20_000,
    retry: 1,
    enabled: isClient,
  });
}

export function useCancelAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => alertApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.alerts }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Rescue Routes
// ═══════════════════════════════════════════════════════════════════════════════
export function useRescueRoutes() {
  return useQuery({
    queryKey: QK.rescue,
    queryFn: () => rescueApi.getAll().then((r) => r.data.data),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 1,
    enabled: isClient,
  });
}

export function useActiveRescueRoutes() {
  return useQuery({
    queryKey: [...QK.rescue, "active"],
    queryFn: () => rescueApi.getActive().then((r) => r.data.data),
    staleTime: 15_000,
    refetchInterval: 20_000,
    retry: 1,
    enabled: isClient,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Resources
// ═══════════════════════════════════════════════════════════════════════════════
export function useResources() {
  return useQuery({
    queryKey: QK.resources,
    queryFn: () => resourceApi.getAll().then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
    enabled: isClient,
  });
}

export function useResourceSummary() {
  return useQuery({
    queryKey: QK.resourceSummary,
    queryFn: () => resourceApi.getSummary().then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
    enabled: isClient,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NLP — Classify
// ═══════════════════════════════════════════════════════════════════════════════
export function useClassifyText(text: string, enabled = true) {
  return useQuery({
    queryKey: ["nlp-classify", text],
    queryFn: () => nlpClassifyApi.one(text).then((r) => r.data),
    enabled: enabled && text.length > 3,
    staleTime: Infinity,
    retry: 1,
  });
}

export function useClassifyBatch() {
  return useMutation({
    mutationFn: (texts: string[]) =>
      nlpClassifyApi.batch(texts).then((r) => r.data),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NLP — Cluster
// ═══════════════════════════════════════════════════════════════════════════════
export function useClusterPosts() {
  return useMutation({
    mutationFn: (posts: { id: string; text: string }[]) =>
      nlpClusterApi.cluster(posts).then((r) => r.data),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NLP — Misinformation
// ═══════════════════════════════════════════════════════════════════════════════
export function useCheckMisinformation() {
  return useMutation({
    mutationFn: (text: string) => nlpMisinfoApi.check(text).then((r) => r.data),
  });
}
