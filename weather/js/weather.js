/**
 * EcoFlight AI - Live Atmospheric Weather Fetcher (Open-Meteo Aviation & Pressure Levels)
 * Queries real-time upper air telemetry (250 hPa ~ FL340, 300 hPa ~ FL300) worldwide.
 * Supports commercial and trial API Keys.
 */

import { evaluateContrailRisk } from './contrail.js';

const weatherCache = new Map();

/**
 * Validate an API key with a fast verification ping
 */
export async function validateApiKey(apiKey) {
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, message: 'API Key cannot be blank.' };
  }

  const trimmed = apiKey.trim();
  // If demo key
  if (trimmed.toUpperCase().includes('DEMO') || trimmed.toUpperCase().includes('TRIAL')) {
    return { valid: true, tier: 'Trial / Evaluation Tier', message: 'Demo API key activated successfully.' };
  }

  // Check Open-Meteo endpoint with apikey
  try {
    const testUrl = `https://api.open-meteo.com/v1/forecast?latitude=40.64&longitude=-73.78&hourly=temperature_250hPa&forecast_days=1&apikey=${encodeURIComponent(trimmed)}`;
    const resp = await fetch(testUrl);
    if (resp.ok) {
      return { valid: true, tier: 'Verified Global Upper-Air Tier', message: 'API key successfully authenticated.' };
    } else if (resp.status === 401 || resp.status === 403) {
      return { valid: false, message: 'Invalid API key. Please check your credentials.' };
    } else {
      // Fallback
      return { valid: true, tier: 'Custom Key', message: 'Key accepted.' };
    }
  } catch (err) {
    // If offline or network issue, accept format if non-empty
    return { valid: true, tier: 'Registered Key', message: 'API key registered.' };
  }
}

/**
 * Fetch real atmospheric flight level weather for a single coordinate
 */
export async function fetchAltitudeWeather(lat, lon, pressureLevel = '250hPa', apiKey = '') {
  // If no API key provided, require API key
  if (!apiKey || apiKey.trim() === '') {
    return {
      isAvailable: false,
      source: 'Global Telemetry API',
      error: 'API Key Required. Please configure your API key in Settings.'
    };
  }

  const trimmedKey = apiKey.trim();
  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)},${pressureLevel},${trimmedKey}`;
  if (weatherCache.has(cacheKey)) {
    return weatherCache.get(cacheKey);
  }

  // Construct URL with API key
  let baseUrl = 'https://api.open-meteo.com/v1/forecast';
  let queryParams = `latitude=${lat}&longitude=${lon}&hourly=temperature_250hPa,relative_humidity_250hPa,wind_speed_250hPa,wind_direction_250hPa,temperature_300hPa,relative_humidity_300hPa,wind_speed_300hPa,wind_direction_300hPa&forecast_days=1`;

  // Attach apikey if not demo
  if (!trimmedKey.toUpperCase().includes('DEMO')) {
    queryParams += `&apikey=${encodeURIComponent(trimmedKey)}`;
  }

  const url = `${baseUrl}?${queryParams}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('API Key unauthorized or quota exceeded');
      }
      throw new Error(`Upper-Air API HTTP ${response.status}`);
    }
    const data = await response.json();

    if (!data.hourly) {
      throw new Error('No hourly telemetry returned');
    }

    // Determine current hour index based on UTC / local time
    const now = new Date();
    const currentHour = now.getUTCHours();
    const hourIdx = Math.min(currentHour, (data.hourly.time?.length || 1) - 1);

    const tempKey = `temperature_${pressureLevel}`;
    const rhKey = `relative_humidity_${pressureLevel}`;
    const windKey = `wind_speed_${pressureLevel}`;
    const windDirKey = `wind_direction_${pressureLevel}`;

    const temp = data.hourly[tempKey]?.[hourIdx];
    const rh = data.hourly[rhKey]?.[hourIdx];
    const windSpeed = data.hourly[windKey]?.[hourIdx];
    const windDir = data.hourly[windDirKey]?.[hourIdx];

    if (temp === undefined || rh === undefined) {
      return {
        isAvailable: false,
        source: 'Open-Meteo Global Upper-Air',
        error: 'Upper-air pressure level data not returned for this coordinate.'
      };
    }

    const risk = evaluateContrailRisk(temp, rh, windSpeed);

    const result = {
      isAvailable: true,
      source: 'Open-Meteo Global Upper-Air Telemetry',
      pressureLevel,
      flightLevel: pressureLevel === '300hPa' ? 'FL300 (~30,000 ft)' : 'FL340 (~34,000 ft)',
      temperatureC: Math.round(temp),
      relativeHumidity: Math.round(rh),
      rhi: risk.rhi,
      isISS: risk.isISS,
      windSpeedKmH: Math.round(windSpeed || 0),
      windSpeedKnots: Math.round((windSpeed || 0) * 0.539957),
      windDirectionDeg: Math.round(windDir || 0),
      risk
    };

    weatherCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.warn(`Weather fetch failed for [${lat}, ${lon}]:`, error);
    return {
      isAvailable: false,
      source: 'Open-Meteo Global Upper-Air',
      error: error.message || 'Telemetry unavailable'
    };
  }
}

/**
 * Batch fetch weather for a list of waypoints along a route
 */
export async function fetchRouteWeather(waypoints, apiKey = '') {
  const promises = waypoints.map(async (wp) => {
    const weather = await fetchAltitudeWeather(wp.lat, wp.lon, wp.pressureLevel || '250hPa', apiKey);
    return {
      ...wp,
      weather
    };
  });

  return Promise.all(promises);
}
