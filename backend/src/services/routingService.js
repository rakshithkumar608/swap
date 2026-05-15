// src/services/routingService.js
const axios = require('axios');

const ORS_KEY  = process.env.OPENROUTESERVICE_API_KEY;
const BASE_URL = 'https://api.openrouteservice.org/v2';

/**
 * Calculate route between origin and destination.
 * @param {[number,number]} origin       [lng, lat]
 * @param {[number,number]} destination  [lng, lat]
 * @param {string}          profile      'driving-car' | 'foot-walking' | 'cycling-regular'
 * @param {Array}           avoidAreas   GeoJSON polygon array to avoid (flooded zones etc.)
 */
const calculateRoute = async (origin, destination, profile = 'driving-car', avoidAreas = []) => {
  try {
    const body = {
      coordinates: [origin, destination],
      instructions: true,
      preference: 'recommended',
    };

    if (avoidAreas.length > 0) {
      body.options = {
        avoid_polygons: {
          type: 'MultiPolygon',
          coordinates: avoidAreas.map(a => [a.coordinates]),
        },
      };
    }

    const { data } = await axios.post(
      `${BASE_URL}/directions/${profile}/geojson`,
      body,
      {
        headers: { Authorization: ORS_KEY, 'Content-Type': 'application/json' },
        timeout: 10000,
      }
    );

    const feature  = data.features[0];
    const summary  = feature.properties.summary;
    const segments = feature.properties.segments || [];

    return {
      geoJSON:     feature.geometry,
      distanceKm:  parseFloat((summary.distance / 1000).toFixed(2)),
      durationMin: parseFloat((summary.duration  / 60 ).toFixed(1)),
      waypoints:   feature.properties.way_points,
      warnings:    segments.flatMap(s => (s.warnings || []).map(w => w.message)),
    };
  } catch (err) {
    console.warn('OpenRouteService error:', err.message);
    return null;
  }
};

/**
 * Calculate route avoiding specific coordinate points (blocked roads).
 */
const calculateSafeRoute = async (origin, destination, blockedRoads = [], avoidAreas = []) => {
  // Build avoid-polygons from blocked road coords (small circles around each block)
  const avoidPolygons = blockedRoads.map(road => ({
    type: 'Polygon',
    coordinates: [buildCirclePolygon(road.lng, road.lat, 0.2)], // 200m radius
  }));

  const allAvoid = [...avoidAreas, ...avoidPolygons];
  return calculateRoute(origin, destination, 'driving-car', allAvoid);
};

// Build a simple square polygon around a point (degrees offset ~200m)
const buildCirclePolygon = (lng, lat, delta) => [
  [lng - delta, lat - delta],
  [lng + delta, lat - delta],
  [lng + delta, lat + delta],
  [lng - delta, lat + delta],
  [lng - delta, lat - delta],
];

module.exports = { calculateRoute, calculateSafeRoute };
