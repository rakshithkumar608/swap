// src/utils/geoUtils.js
const EARTH_RADIUS_KM = 6371;

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Haversine distance between two lat/lng points in km.
 */
const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Returns true if point (lat2, lng2) is within radius km of (lat1, lng1).
 */
const isWithinRadius = (lat1, lng1, lat2, lng2, radiusKm) =>
  haversineDistance(lat1, lng1, lat2, lng2) <= radiusKm;

/**
 * Build a GeoJSON Point from [lng, lat] array.
 */
const toGeoPoint = (coordinates) => ({ type: 'Point', coordinates });

/**
 * Convert km radius to meters (for MongoDB $geoWithin queries).
 */
const kmToRadians = (km) => km / EARTH_RADIUS_KM;

/**
 * Parse lat/lng from query params safely.
 */
const parseCoords = (lat, lng) => {
  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);
  if (isNaN(parsedLat) || isNaN(parsedLng)) return null;
  if (parsedLat < -90 || parsedLat > 90) return null;
  if (parsedLng < -180 || parsedLng > 180) return null;
  return { lat: parsedLat, lng: parsedLng };
};

module.exports = { haversineDistance, isWithinRadius, toGeoPoint, kmToRadians, parseCoords };
