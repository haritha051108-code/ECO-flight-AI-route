/**
 * EcoFlight AI - Interactive Aviation Map (Leaflet.js)
 * Visualizes flight paths, segmented contrail risk lines, origin/destination pins,
 * waypoint weather popups, and route selection interactions.
 */

export class EcoMapManager {
  constructor(containerId, onRouteSelectCallback, onWaypointSelectCallback) {
    this.containerId = containerId;
    this.onRouteSelect = onRouteSelectCallback;
    this.onWaypointSelect = onWaypointSelectCallback;
    this.map = null;
    this.routeLayers = [];
    this.markerLayers = [];
    this.activeRouteId = null;
    this.tileLayer = null;
    this.currentTheme = 'dark-blue';
    this.currentBasemap = 'dark-blue';
    this.initMap();
  }

  initMap() {
    // Center initially on North Atlantic / global view
    this.map = L.map(this.containerId, {
      zoomControl: false,
      worldCopyJump: true,
      minZoom: 2,
      maxZoom: 14
    }).setView([35, -20], 3);

    // Zoom control in bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // Default CartoDB Dark Matter - deep dark blue/night sky aviation aesthetic
    this.setBasemap('dark-blue');
  }

  setBasemap(type) {
    this.currentBasemap = type;
    if (this.tileLayer) {
      this.map.removeLayer(this.tileLayer);
    }

    let url;
    let attribution;
    let subdomains = '0123';
    let maxZoom = 20;

    switch (type) {
      case 'google-hybrid':
        url = 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
        attribution = '&copy; Google Maps';
        break;
      case 'google-satellite':
        url = 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
        attribution = '&copy; Google Maps';
        break;
      case 'google-streets':
        url = 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
        attribution = '&copy; Google Maps';
        break;
      case 'google-terrain':
        url = 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}';
        attribution = '&copy; Google Maps';
        break;
      case 'light':
        url = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
        attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
        subdomains = 'abcd';
        maxZoom = 19;
        break;
      case 'dark-blue':
      default:
        url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
        attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
        subdomains = 'abcd';
        maxZoom = 19;
        break;
    }

    this.tileLayer = L.tileLayer(url, {
      attribution,
      subdomains,
      maxZoom
    }).addTo(this.map);
  }

  setTheme(theme) {
    this.currentTheme = theme;
    // Only override basemap if not currently using a Google Maps basemap
    if (!this.currentBasemap.startsWith('google-')) {
      this.setBasemap(theme === 'light' ? 'light' : 'dark-blue');
    }
  }

  clearMap() {
    this.routeLayers.forEach(layer => this.map.removeLayer(layer));
    this.routeLayers = [];
    this.markerLayers.forEach(layer => this.map.removeLayer(layer));
    this.markerLayers = [];
  }

  /**
   * Render all routes and markers on map
   */
  renderRoutes(routes, activeRouteId, origin, destination) {
    this.clearMap();
    this.activeRouteId = activeRouteId;

    if (!routes || routes.length === 0) return;

    // 1. Add Origin & Destination markers
    this.renderEndpoints(origin, destination);

    // 2. Render each route
    routes.forEach(route => {
      const isActive = route.id === activeRouteId;
      this.renderRoutePath(route, isActive);
    });

    // 3. Render interactive waypoints for the active route
    const activeRoute = routes.find(r => r.id === activeRouteId) || routes[0];
    if (activeRoute && activeRoute.waypointsWithWeather) {
      this.renderWaypoints(activeRoute.waypointsWithWeather);
    }

    // 4. Fit map bounds to encompass the flight
    const allPoints = activeRoute.visualPath || [];
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      this.map.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 6,
        animate: true,
        duration: 0.8
      });
    }
  }

  renderEndpoints(origin, destination) {
    const createAirportIcon = (code, type) => {
      const isOrigin = type === 'origin';
      const bgColor = isOrigin ? '#0284c7' : '#0f766e';
      const label = isOrigin ? 'DEP' : 'ARR';
      const svgPin = `
        <div class="custom-airport-pin ${isOrigin ? 'pin-origin' : 'pin-dest'}">
          <div class="pin-badge" style="background:${bgColor};">
            <span class="pin-code">${code || 'APT'}</span>
            <span class="pin-type">${label}</span>
          </div>
          <div class="pin-stem" style="border-top-color:${bgColor};"></div>
        </div>
      `;

      return L.divIcon({
        html: svgPin,
        className: 'airport-pin-wrapper',
        iconSize: [60, 48],
        iconAnchor: [30, 48]
      });
    };

    const origMarker = L.marker([origin.lat, origin.lon], {
      icon: createAirportIcon(origin.iata || origin.city?.substring(0, 3).toUpperCase(), 'origin'),
      title: `Origin: ${origin.title || origin.name || origin.city}`,
      zIndexOffset: 1000
    }).addTo(this.map);

    origMarker.bindPopup(`
      <div class="map-endpoint-popup">
        <div class="endpoint-header origin">Departure Point</div>
        <div class="endpoint-title">${origin.title || origin.city}</div>
        <div class="endpoint-sub">${origin.subtitle || origin.country}</div>
        <div class="endpoint-coords">${origin.lat.toFixed(2)}°, ${origin.lon.toFixed(2)}°</div>
      </div>
    `);

    const destMarker = L.marker([destination.lat, destination.lon], {
      icon: createAirportIcon(destination.iata || destination.city?.substring(0, 3).toUpperCase(), 'dest'),
      title: `Destination: ${destination.title || destination.name || destination.city}`,
      zIndexOffset: 1000
    }).addTo(this.map);

    destMarker.bindPopup(`
      <div class="map-endpoint-popup">
        <div class="endpoint-header dest">Arrival Destination</div>
        <div class="endpoint-title">${destination.title || destination.city}</div>
        <div class="endpoint-sub">${destination.subtitle || destination.country}</div>
        <div class="endpoint-coords">${destination.lat.toFixed(2)}°, ${destination.lon.toFixed(2)}°</div>
      </div>
    `);

    this.markerLayers.push(origMarker, destMarker);
  }

  renderRoutePath(route, isActive) {
    const points = route.visualPath;
    if (!points || points.length < 2) return;

    if (!isActive) {
      // Inactive route: Sleek, clickable background line
      const inactiveGlow = L.polyline(points, {
        color: '#64748b',
        weight: 8,
        opacity: 0.1,
        lineCap: 'round',
        interactive: true
      }).addTo(this.map);

      const inactiveLine = L.polyline(points, {
        color: '#94a3b8',
        weight: 3.5,
        opacity: 0.7,
        dashArray: '6, 8',
        interactive: true
      }).addTo(this.map);

      // Tooltip & click to select route
      const hoverTooltip = `<b>${route.name}</b><br><span style="font-size:11px;color:#64748b;">Click to view route details</span>`;
      inactiveLine.bindTooltip(hoverTooltip, { sticky: true, className: 'route-hover-tooltip' });
      inactiveGlow.bindTooltip(hoverTooltip, { sticky: true, className: 'route-hover-tooltip' });

      const onSelect = () => {
        if (this.onRouteSelect) this.onRouteSelect(route.id);
      };

      inactiveLine.on('click', onSelect);
      inactiveGlow.on('click', onSelect);

      this.routeLayers.push(inactiveGlow, inactiveLine);
      return;
    }

    // ACTIVE ROUTE: High visual prominence
    // If we have weather waypoints with contrail risk, color segments accordingly!
    const waypoints = route.waypointsWithWeather || [];
    const hasWeather = waypoints.length > 0 && waypoints.some(w => w.weather && w.weather.risk);

    // Glowing halo for active route
    const haloLine = L.polyline(points, {
      color: '#0284c7',
      weight: 9,
      opacity: 0.22,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.map);
    this.routeLayers.push(haloLine);

    if (hasWeather) {
      // Divide visual path into segments and color each by closest waypoint risk
      const totalPoints = points.length;
      const numSegments = waypoints.length;

      for (let s = 0; s < numSegments; s++) {
        const startIdx = Math.floor((s / numSegments) * (totalPoints - 1));
        const endIdx = Math.min(totalPoints - 1, Math.floor(((s + 1) / numSegments) * (totalPoints - 1)) + 1);
        const segmentPts = points.slice(startIdx, endIdx + 1);

        if (segmentPts.length >= 2) {
          const wp = waypoints[s];
          const riskColor = wp.weather?.risk?.color || '#0284c7';
          const riskLabel = wp.weather?.risk?.label || 'Altitude Waypoint';

          const segPoly = L.polyline(segmentPts, {
            color: riskColor,
            weight: 5,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(this.map);

          segPoly.bindTooltip(`
            <div style="font-size:12px; font-weight:600; color:${riskColor};">
              ● ${riskLabel}
            </div>
            <div style="font-size:11px; color:#475569;">
              Temp: ${wp.weather?.temperatureC !== undefined ? wp.weather.temperatureC + '°C' : 'N/A'} | RH: ${wp.weather?.relativeHumidity || 0}%
            </div>
          `, { sticky: true, className: 'segment-tooltip' });

          this.routeLayers.push(segPoly);
        }
      }
    } else {
      // Solid bright active line if weather is loading
      const activeLine = L.polyline(points, {
        color: '#0284c7',
        weight: 4.5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(this.map);
      this.routeLayers.push(activeLine);
    }
  }

  renderWaypoints(waypointsWithWeather) {
    waypointsWithWeather.forEach((wp, idx) => {
      const risk = wp.weather?.risk || { color: '#0284c7', label: 'Checking...' };
      const tempStr = wp.weather?.temperatureC !== undefined ? `${wp.weather.temperatureC}°C` : '--';
      const riskColor = risk.color || '#0284c7';

      const iconHtml = `
        <div class="waypoint-pin" style="border-color:${riskColor};" title="${wp.name}: ${risk.label}">
          <div class="wp-dot" style="background:${riskColor};"></div>
          <div class="wp-temp-tag">${tempStr}</div>
        </div>
      `;

      const wpIcon = L.divIcon({
        html: iconHtml,
        className: 'waypoint-marker-wrapper',
        iconSize: [42, 28],
        iconAnchor: [21, 14]
      });

      const marker = L.marker([wp.lat, wp.lon], {
        icon: wpIcon,
        zIndexOffset: 800
      }).addTo(this.map);

      // Detailed weather inspection popup
      const isAvailable = wp.weather?.isAvailable !== false;
      const popupHtml = `
        <div class="wp-weather-popup">
          <div class="wp-popup-header" style="border-left: 4px solid ${riskColor};">
            <div class="wp-title">${wp.name}</div>
            <div class="wp-altitude">${wp.altitude} (${wp.pressureLevel})</div>
          </div>
          
          ${isAvailable ? `
            <div class="wp-risk-pill" style="background:${riskColor}18; color:${riskColor}; border:1px solid ${riskColor}40;">
              <span class="dot" style="background:${riskColor};"></span>
              ${risk.label} (${risk.score || 0}% risk)
            </div>
            
            <div class="wp-grid-stats">
              <div class="wp-stat">
                <span class="lbl">Temperature</span>
                <span class="val">${wp.weather.temperatureC}°C</span>
              </div>
              <div class="wp-stat">
                <span class="lbl">Humidity (RH)</span>
                <span class="val">${wp.weather.relativeHumidity}%</span>
              </div>
              <div class="wp-stat">
                <span class="lbl">Ice Saturation</span>
                <span class="val ${wp.weather.isISS ? 'iss-alert' : ''}">${wp.weather.rhi || '--'}% RHi</span>
              </div>
              <div class="wp-stat">
                <span class="lbl">Wind at Altitude</span>
                <span class="val">${wp.weather.windSpeedKmH} km/h (${wp.weather.windDirectionDeg}°)</span>
              </div>
            </div>
            
            <div class="wp-desc">${risk.description || ''}</div>
          ` : `
            <div class="wp-unavailable">
              <span class="unavail-icon">⚠️</span>
              <div>
                <strong>Live Data Unavailable</strong>
                <p>Upper-air telemetry not returned for this coordinate. No fake data displayed.</p>
              </div>
            </div>
          `}
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 300 });

      marker.on('click', () => {
        if (this.onWaypointSelect) {
          this.onWaypointSelect(wp);
        }
      });

      this.markerLayers.push(marker);
    });
  }

  resize() {
    if (this.map) {
      setTimeout(() => this.map.invalidateSize(), 150);
    }
  }
}
