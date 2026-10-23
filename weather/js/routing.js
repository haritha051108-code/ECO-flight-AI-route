/**
 * EcoFlight AI - Flight Routing & Trajectory Computation
 * Implements Great Circle interpolation, perpendicular lateral route offsets,
 * and tactical altitude step profiles.
 */

const EARTH_RADIUS_KM = 6371;

/** Convert degrees to radians */
export function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/** Convert radians to degrees */
export function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

/**
 * Great-circle distance between two points in km (Haversine formula)
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Initial bearing from point 1 to point 2 in degrees (0 - 360)
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lon2 - lon1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return (toDeg(theta) + 360) % 360;
}

/**
 * Great Circle Intermediate point at fraction f (0.0 to 1.0)
 */
export function intermediatePoint(lat1, lon1, lat2, lon2, f) {
  const phi1 = toRad(lat1);
  const lambda1 = toRad(lon1);
  const phi2 = toRad(lat2);
  const lambda2 = toRad(lon2);

  const d = 2 * Math.asin(
    Math.sqrt(
      Math.pow(Math.sin((phi1 - phi2) / 2), 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.pow(Math.sin((lambda1 - lambda2) / 2), 2)
    )
  );

  if (d < 1e-6) {
    return { lat: lat1, lon: lon1 };
  }

  const a = Math.sin((1 - f) * d) / Math.sin(d);
  const b = Math.sin(f * d) / Math.sin(d);

  const x = a * Math.cos(phi1) * Math.cos(lambda1) + b * Math.cos(phi2) * Math.cos(lambda2);
  const y = a * Math.cos(phi1) * Math.sin(lambda1) + b * Math.cos(phi2) * Math.sin(lambda2);
  const z = a * Math.sin(phi1) + b * Math.sin(phi2);

  const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
  const lon = Math.atan2(y, x);

  return {
    lat: toDeg(lat),
    lon: toDeg(lon)
  };
}

/**
 * Generate a smooth Great Circle polyline
 */
export function generateGreatCirclePoints(origin, destination, numPoints = 40) {
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const pt = intermediatePoint(origin.lat, origin.lon, destination.lat, destination.lon, f);
    points.push([pt.lat, pt.lon]);
  }
  return points;
}

/**
 * Generate a laterally diverted route (diverts around middle waypoints smoothly)
 * offsetFactor: positive for north/right deflection, negative for south/left
 */
export function generateOffsetPoints(origin, destination, offsetDegrees = 3.5, numPoints = 40) {
  const points = [];
  const midIndex = Math.floor(numPoints / 2);

  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const pt = intermediatePoint(origin.lat, origin.lon, destination.lat, destination.lon, f);

    // Parabolic / sinusoidal offset bell curve peaking at midpoint
    const weight = Math.sin(f * Math.PI); // 0 at ends, 1 at midpoint
    const deltaLat = offsetDegrees * weight;

    // Apply offset primarily to latitude (with clamp between -85 and 85)
    let lat = pt.lat + deltaLat;
    lat = Math.max(-85, Math.min(85, lat));

    points.push([lat, pt.lon]);
  }
  return points;
}

/**
 * Generate 2-3 flight route candidates with distinct operational profiles
 */
export function generateFlightRoutes(origin, destination) {
  const directDistance = calculateDistanceKm(origin.lat, origin.lon, destination.lat, destination.lon);

  // Sample waypoints for weather sampling (6 points: 15%, 30%, 50%, 70%, 85% of journey)
  const fractions = [0.15, 0.32, 0.50, 0.68, 0.85];

  // Route 1: Direct Great Circle (FL340 / 250hPa)
  const route1Visual = generateGreatCirclePoints(origin, destination, 36);
  const route1Waypoints = fractions.map((f, idx) => {
    const pt = intermediatePoint(origin.lat, origin.lon, destination.lat, destination.lon, f);
    return {
      index: idx + 1,
      fraction: f,
      name: `Waypoint ${idx + 1}`,
      lat: Number(pt.lat.toFixed(4)),
      lon: Number(pt.lon.toFixed(4)),
      altitude: 'FL340 (~34,000 ft)',
      pressureLevel: '250hPa'
    };
  });

  // Decide lateral offset sign based on latitude to naturally align with jet streams or ISSR avoidance
  const isNorthern = (origin.lat + destination.lat) / 2 >= 0;
  // Route 2: Eco-Optimized Lateral Offset (+3.2° or -3.2°)
  const offsetDeg = isNorthern ? 3.4 : -3.4;
  const route2Visual = generateOffsetPoints(origin, destination, offsetDeg, 36);
  const route2Waypoints = fractions.map((f, idx) => {
    const pt = intermediatePoint(origin.lat, origin.lon, destination.lat, destination.lon, f);
    const weight = Math.sin(f * Math.PI);
    return {
      index: idx + 1,
      fraction: f,
      name: `Eco-Waypoint ${idx + 1}`,
      lat: Number((pt.lat + offsetDeg * weight).toFixed(4)),
      lon: Number(pt.lon.toFixed(4)),
      altitude: 'FL340 (~34,000 ft)',
      pressureLevel: '250hPa'
    };
  });

  // Route 3: Altitude Adjustment Flight Level (FL300 / 300hPa - flying warmer/drier air mass)
  const route3Visual = generateGreatCirclePoints(origin, destination, 36);
  const route3Waypoints = fractions.map((f, idx) => {
    const pt = intermediatePoint(origin.lat, origin.lon, destination.lat, destination.lon, f);
    return {
      index: idx + 1,
      fraction: f,
      name: `Step-Climb ${idx + 1}`,
      lat: Number(pt.lat.toFixed(4)),
      lon: Number(pt.lon.toFixed(4)),
      altitude: 'FL300 (~30,000 ft)',
      pressureLevel: '300hPa'
    };
  });

  // Calculate actual distances along polyline
  const calcPolyDistance = (pts) => {
    let d = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      d += calculateDistanceKm(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    }
    return d;
  };

  const dist1 = directDistance;
  const dist2 = calcPolyDistance(route2Visual);
  const dist3 = directDistance; // same lateral path, different vertical flight level

  return [
    {
      id: 'route-direct',
      name: 'Standard Direct Track',
      badge: 'Direct (Baseline)',
      badgeType: 'neutral',
      altitude: 'FL340 (34,000 ft)',
      pressureLevel: '250hPa',
      distanceKm: Math.round(dist1),
      visualPath: route1Visual,
      waypoints: route1Waypoints,
      description: 'Conventional shortest great-circle flight corridor.'
    },
    {
      id: 'route-lateral',
      name: 'Eco-Optimized Lateral Track',
      badge: 'Contrail Avoidance',
      badgeType: 'eco',
      altitude: 'FL340 (34,000 ft)',
      pressureLevel: '250hPa',
      distanceKm: Math.round(dist2),
      visualPath: route2Visual,
      waypoints: route2Waypoints,
      description: 'Slight lateral detour bypassing ice-supersaturated high-risk zones.'
    },
    {
      id: 'route-altitude',
      name: 'FL300 Lower-Altitude Step',
      badge: 'Vertical Shift (FL300)',
      badgeType: 'alt',
      altitude: 'FL300 (30,000 ft)',
      pressureLevel: '300hPa',
      distanceKm: Math.round(dist3),
      visualPath: route3Visual,
      waypoints: route3Waypoints,
      description: 'Cruising at FL300 in warmer, drier air where contrails cannot persist.'
    }
  ];
}
