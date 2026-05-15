import type { RescueRouteDoc } from "@/lib/api";

/**
 * Static “trained” corridors for demos / empty API — GeoJSON [lng, lat] around Mumbai-ish demo map.
 * Not from the live DB; UI should label when this set is shown.
 */
export const TRAINED_RESCUE_CORRIDOR_DATASET: RescueRouteDoc[] = [
  {
    _id: "trained-corr-001",
    name: "Trained · Primary west egress",
    status: "active",
    distanceKm: 4.6,
    durationMin: 21,
    safetyScore: 81,
    blockedRoads: [{ lat: 19.078, lng: 72.868, reason: "trained model · shallow flood segment" }],
    origin: { type: "Point", coordinates: [72.835, 19.082] },
    destination: { type: "Point", coordinates: [72.892, 19.105] },
  },
  {
    _id: "trained-corr-002",
    name: "Trained · Shelter vector (north)",
    status: "active",
    distanceKm: 3.1,
    durationMin: 14,
    safetyScore: 76,
    blockedRoads: [],
    origin: { type: "Point", coordinates: [72.848, 19.095] },
    destination: { type: "Point", coordinates: [72.871, 19.118] },
  },
  {
    _id: "trained-corr-003",
    name: "Trained · Secondary (blocked segment)",
    status: "blocked",
    distanceKm: 5.2,
    durationMin: 34,
    safetyScore: 58,
    blockedRoads: [
      { lat: 19.09, lng: 72.855, reason: "trained model · debris" },
      { lat: 19.088, lng: 72.858, reason: "trained model · underpass" },
    ],
    origin: { type: "Point", coordinates: [72.82, 19.07] },
    destination: { type: "Point", coordinates: [72.86, 19.09] },
  },
];

export function getRescueRoutesForDisplay(
  apiRoutes: RescueRouteDoc[] | undefined,
  isLoading: boolean,
  isError: boolean,
): { routes: RescueRouteDoc[]; isTrainedFallback: boolean } {
  if (isLoading || isError) {
    return { routes: apiRoutes ?? [], isTrainedFallback: false };
  }
  const live = apiRoutes ?? [];
  if (live.length > 0) {
    return { routes: live, isTrainedFallback: false };
  }
  return { routes: TRAINED_RESCUE_CORRIDOR_DATASET, isTrainedFallback: true };
}
