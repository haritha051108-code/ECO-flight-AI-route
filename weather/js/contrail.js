/**
 * EcoFlight AI - Atmospheric Physics & Persistent Contrail Risk Evaluation
 * Based on the Schmidt-Appleman Criterion (SAC) & Ice-Supersaturated Region (ISSR) physics.
 */

/**
 * Calculates saturation vapor pressure over liquid water (hPa) using Sonntag formula
 */
function satVaporPressureWater(tempC) {
  return 6.112 * Math.exp((17.62 * tempC) / (243.12 + tempC));
}

/**
 * Calculates saturation vapor pressure over ice (hPa) using Sonntag formula
 */
function satVaporPressureIce(tempC) {
  return 6.112 * Math.exp((22.46 * tempC) / (272.62 + tempC));
}

/**
 * Computes Relative Humidity with respect to Ice (RHi in %)
 * @param {number} tempC Temperature in Celsius
 * @param {number} rhWater Relative humidity with respect to liquid water (0 - 100%)
 */
export function calculateRHi(tempC, rhWater) {
  if (tempC >= 0) return rhWater;
  const es = satVaporPressureWater(tempC);
  const ei = satVaporPressureIce(tempC);
  if (ei <= 0) return rhWater;
  const rhi = rhWater * (es / ei);
  return Math.round(Math.min(250, Math.max(0, rhi)));
}

/**
 * Evaluates Persistent Contrail Risk at a given flight level waypoint
 * @param {number} tempC Temperature in Celsius at altitude
 * @param {number} rhWater Relative humidity in % at altitude
 * @param {number} windSpeed Wind speed in km/h
 * @returns {object} Detailed risk assessment
 */
export function evaluateContrailRisk(tempC, rhWater, windSpeed = 0) {
  if (tempC === null || tempC === undefined || isNaN(tempC)) {
    return {
      level: 'unknown',
      label: 'Data Unavailable',
      color: '#94a3b8',
      score: 0,
      rhi: null,
      isISS: false,
      description: 'Atmospheric telemetry unavailable for this coordinate.'
    };
  }

  const rhi = calculateRHi(tempC, rhWater || 0);
  const isIceSupersaturated = rhi >= 100;

  // Schmidt-Appleman Criterion check:
  // Contrail formation threshold is typically around -39°C to -41°C at 250hPa
  const isColdEnoughForContrail = tempC <= -38.5;

  let level = 'low';
  let score = 15;
  let label = 'Low Contrail Risk';
  let color = '#10b981'; // Green
  let description = 'Air is too dry or above threshold; contrails dissipate in seconds.';

  if (isColdEnoughForContrail) {
    if (isIceSupersaturated || rhWater >= 65) {
      // HIGH RISK: Cold & Ice-supersaturated. Contrails persist for hours.
      level = 'high';
      score = Math.min(98, Math.round(70 + (rhi - 100) * 0.4 + Math.abs(tempC + 40) * 0.5));
      label = 'High Contrail Risk';
      color = '#ef4444'; // Red
      description = 'Ice-supersaturated region (ISSR). Contrails will persist and form warming cirrus.';
    } else if (rhi >= 80 || rhWater >= 45) {
      // MEDIUM RISK: Marginal saturation. Contrails may persist for 10-30 minutes.
      level = 'medium';
      score = Math.min(65, Math.round(40 + (rhi - 80) * 1.0));
      label = 'Medium Contrail Risk';
      color = '#f59e0b'; // Amber / Yellow
      description = 'Marginal saturation; transient contrail formation likely.';
    } else {
      // LOW RISK: Cold enough to form, but dry ambient air sublimes contrail quickly
      level = 'low';
      score = Math.max(10, Math.round(20 + (rhWater || 0) * 0.2));
      label = 'Low Contrail Risk';
      color = '#10b981'; // Green
      description = 'Sub-saturated dry air; contrails evaporate rapidly without persisting.';
    }
  } else {
    // Too warm for contrail formation (T > -38.5°C)
    level = 'low';
    score = 8;
    label = 'Low Contrail Risk';
    color = '#10b981';
    description = 'Ambient flight level temperature is above contrail nucleation threshold.';
  }

  return {
    level,
    label,
    color,
    score,
    rhi,
    isISS: isIceSupersaturated,
    tempC: Math.round(tempC),
    rhWater: Math.round(rhWater || 0),
    windSpeed: Math.round(windSpeed || 0),
    description
  };
}

/**
 * Calculates aggregate route metrics including persistent contrail risk score,
 * flight duration, and fuel consumption based on realistic aerodynamics.
 */
export function calculateRouteAviationMetrics(route, waypointWeatherList) {
  const distKm = route.distanceKm;

  // Standard aircraft assumption: A350-900 / B787-9 cruise parameters
  // Cruising True Airspeed ~880 km/h (Mach 0.82)
  const baseCruisingTas = 880;

  // Calculate average wind component along waypoints
  let avgHeadwindKm = 0;
  let validWeatherCount = 0;
  let totalContrailScore = 0;
  let highRiskCount = 0;
  let mediumRiskCount = 0;
  let lowRiskCount = 0;

  waypointWeatherList.forEach(wp => {
    if (wp.weather && wp.weather.risk) {
      validWeatherCount++;
      totalContrailScore += wp.weather.risk.score;
      if (wp.weather.risk.level === 'high') highRiskCount++;
      else if (wp.weather.risk.level === 'medium') mediumRiskCount++;
      else lowRiskCount++;

      // Account for wind resistance/assistance
      if (wp.weather.windSpeed) {
        // Assume random heading vs wind bearing for flight component
        avgHeadwindKm += (wp.weather.windSpeed * 0.15); // average slight resistance factor
      }
    }
  });

  const avgContrailRisk = validWeatherCount > 0 ? Math.round(totalContrailScore / validWeatherCount) : 40;

  // Calculate Ground Speed & Flight Time
  const effectiveSpeed = Math.max(700, baseCruisingTas - (avgHeadwindKm / Math.max(1, validWeatherCount)));
  // Add 25 minutes for taxi, climb, descent, and approach maneuvers
  const cruiseHours = distKm / effectiveSpeed;
  const totalHours = cruiseHours + 25 / 60;

  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);

  // Fuel Consumption Calculation:
  // Base burn rate ~2,750 kg/hour cruise
  // FL300 has ~2.2% higher fuel burn due to denser air drag
  // Lateral detour has proportional extra fuel for distance
  let altitudeBurnMultiplier = 1.0;
  if (route.pressureLevel === '300hPa') {
    altitudeBurnMultiplier = 1.025; // 2.5% penalty for lower altitude
  }

  const fuelKg = Math.round(totalHours * 2750 * altitudeBurnMultiplier);
  const fuelTonnes = (fuelKg / 1000).toFixed(1);

  // Overal persistent contrail risk label & color
  let overallRiskLevel = 'low';
  let overallRiskColor = '#10b981';
  let overallRiskLabel = 'Low Risk';

  if (avgContrailRisk >= 60) {
    overallRiskLevel = 'high';
    overallRiskColor = '#ef4444';
    overallRiskLabel = 'High Persistent Risk';
  } else if (avgContrailRisk >= 35) {
    overallRiskLevel = 'medium';
    overallRiskColor = '#f59e0b';
    overallRiskLabel = 'Moderate Contrail Risk';
  } else {
    overallRiskLevel = 'low';
    overallRiskColor = '#10b981';
    overallRiskLabel = 'Low Contrail Risk';
  }

  return {
    flightTimeStr: `${hours}h ${minutes}m`,
    flightTimeMinutes: Math.round(totalHours * 60),
    fuelTonnes: fuelTonnes,
    fuelKg: fuelKg,
    distanceKm: distKm,
    distanceNm: Math.round(distKm * 0.539957),
    contrailRiskScore: avgContrailRisk,
    overallRiskLevel,
    overallRiskColor,
    overallRiskLabel,
    breakdown: {
      highPercent: validWeatherCount > 0 ? Math.round((highRiskCount / validWeatherCount) * 100) : 0,
      mediumPercent: validWeatherCount > 0 ? Math.round((mediumRiskCount / validWeatherCount) * 100) : 0,
      lowPercent: validWeatherCount > 0 ? Math.round((lowRiskCount / validWeatherCount) * 100) : 100
    }
  };
}
