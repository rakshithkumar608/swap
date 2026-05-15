// src/services/riskService.js
const { getWeatherByCoords } = require('./weatherService');

const SEVERITY_THRESHOLDS = {
  flood:   { rainfall: 50, windSpeed: 20 },
  cyclone: { rainfall: 30, windSpeed: 60 },
  urban:   { rainfall: 40, windSpeed: 35 },
};

/**
 * Compute a 0-100 risk score for a disaster based on weather + reported data.
 */
const computeRiskScore = async (disaster) => {
  const [lng, lat] = disaster.location.coordinates;
  const weather = await getWeatherByCoords(lat, lng);

  let score = 50; // baseline

  if (!weather) {
    // No weather data — score from severity alone
    const severityMap = { low: 20, medium: 45, high: 70, critical: 95 };
    return severityMap[disaster.severity] || 50;
  }

  const thresholds = SEVERITY_THRESHOLDS[disaster.type] || {};

  // Rainfall risk
  if (thresholds.rainfall && weather.rainfall >= thresholds.rainfall) score += 20;
  else if (thresholds.rainfall && weather.rainfall >= thresholds.rainfall * 0.6) score += 10;

  // Wind risk
  if (thresholds.windSpeed && weather.windSpeed >= thresholds.windSpeed) score += 20;
  else if (thresholds.windSpeed && weather.windSpeed >= thresholds.windSpeed * 0.6) score += 10;

  // Temperature risk
  if (thresholds.temperature && weather.temperature >= thresholds.temperature) score += 20;

  // Humidity risk (wildfire)
  if (thresholds.humidity && weather.humidity <= thresholds.humidity) score += 15;

  // Affected people multiplier
  if (disaster.affectedPeople > 10000) score += 10;
  else if (disaster.affectedPeople > 1000) score += 5;

  return Math.min(100, Math.max(0, Math.round(score)));
};

/**
 * Derive severity label from score.
 */
const scoreToSeverity = (score) => {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
};

module.exports = { computeRiskScore, scoreToSeverity };
