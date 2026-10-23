/**
 * EcoFlight AI - Main Application Controller
 * Coordinates search, routing, real weather telemetry, contrail analytics, and UI updates.
 */

import { MAJOR_AIRPORTS, searchLocations } from './airports.js';
import { generateFlightRoutes } from './routing.js';
import { fetchRouteWeather, validateApiKey } from './weather.js';
import { calculateRouteAviationMetrics } from './contrail.js';
import { EcoMapManager } from './map.js';

// Application State
const state = {
  origin: MAJOR_AIRPORTS.find(a => a.iata === 'JFK') || {
    title: 'New York (JFK)',
    iata: 'JFK',
    city: 'New York',
    country: 'United States',
    lat: 40.6413,
    lon: -73.7781
  },
  destination: MAJOR_AIRPORTS.find(a => a.iata === 'LHR') || {
    title: 'London (LHR)',
    iata: 'LHR',
    city: 'London',
    country: 'United Kingdom',
    lat: 51.4700,
    lon: -0.4543
  },
  routes: [],
  activeRouteId: 'route-lateral',
  recommendedRouteId: null,
  baselineRouteId: 'route-direct',
  isLoading: false,
  selectedWaypoint: null,
  units: 'metric', // 'metric' (km, °C) or 'nautical' (NM, °F)
  theme: 'dark-blue',
  apiKey: localStorage.getItem('ecoflight_api_key') || ''
};

let ecoMap = null;

// DOM Elements
const elements = {
  originInput: document.getElementById('origin-input'),
  destInput: document.getElementById('dest-input'),
  originDropdown: document.getElementById('origin-dropdown'),
  destDropdown: document.getElementById('dest-dropdown'),
  swapBtn: document.getElementById('swap-locations-btn'),
  searchBtn: document.getElementById('search-routes-btn'),
  presetChips: document.querySelectorAll('.preset-chip'),
  loadingOverlay: document.getElementById('loading-indicator'),
  loadingText: document.getElementById('loading-status-text'),
  routeCardsContainer: document.getElementById('route-cards-container'),
  recommendationBanner: document.getElementById('recommendation-banner'),
  recommendationText: document.getElementById('recommendation-text'),
  recommendationTradeoff: document.getElementById('recommendation-tradeoff'),
  // Bottom Bar Stats
  statFlightTime: document.getElementById('stat-flight-time'),
  statFuel: document.getElementById('stat-fuel'),
  statDistance: document.getElementById('stat-distance'),
  statContrailRisk: document.getElementById('stat-contrail-risk'),
  statContrailBar: document.getElementById('stat-contrail-bar'),
  statContrailBadge: document.getElementById('stat-contrail-badge'),
  // Waypoint Weather Section
  waypointSection: document.getElementById('waypoint-weather-container'),
  waypointList: document.getElementById('waypoint-cards-list'),
  unitsToggleBtn: document.getElementById('toggle-units-btn'),
  themeToggleBtn: document.getElementById('toggle-theme-btn'),
  infoModal: document.getElementById('info-modal'),
  openInfoBtn: document.getElementById('open-info-btn'),
  closeInfoBtn: document.getElementById('close-info-btn'),
  // API Key Elements
  openApiBtn: document.getElementById('open-api-btn'),
  apiStatusIcon: document.getElementById('api-key-status-icon'),
  apiBtnText: document.getElementById('api-key-btn-text'),
  apiModal: document.getElementById('api-key-modal'),
  closeApiBtn: document.getElementById('close-api-btn'),
  apiKeyInput: document.getElementById('api-key-input'),
  saveApiKeyBtn: document.getElementById('save-api-key-btn'),
  demoApiKeyBtn: document.getElementById('demo-api-key-btn'),
  clearApiKeyBtn: document.getElementById('clear-api-key-btn'),
  toggleKeyVisibilityBtn: document.getElementById('toggle-key-visibility-btn'),
  apiKeyValidationMsg: document.getElementById('api-key-validation-msg'),
  // Google Maps & Basemap Elements
  bottomGmapLink: document.getElementById('bottom-gmap-link'),
  basemapBtns: document.querySelectorAll('.basemap-btn'),
  gmapModal: document.getElementById('gmap-modal'),
  closeGmapBtn: document.getElementById('close-gmap-btn'),
  gmapIframe: document.getElementById('gmap-iframe'),
  gmapModalTitle: document.getElementById('gmap-modal-title'),
  gmapModalSubtitle: document.getElementById('gmap-modal-subtitle'),
  gmapModalOpenLink: document.getElementById('gmap-modal-open-link'),
  gmapApplyMainBtn: document.getElementById('gmap-apply-main-btn'),
  gmapLayerTabs: document.querySelectorAll('.gmap-tab'),
  gmapWaypointsStrip: document.getElementById('gmap-waypoints-strip'),
  gmapRouteAltBadge: document.getElementById('gmap-route-altitude-badge')
};

// Initialize Application
export async function initApp() {
  // Initialize Map
  ecoMap = new EcoMapManager('map-container', handleRouteSelection, handleWaypointSelection);

  // Set initial input values
  if (state.origin) {
    elements.originInput.value = state.origin.title || `${state.origin.city} (${state.origin.iata})`;
  }
  if (state.destination) {
    elements.destInput.value = state.destination.title || `${state.destination.city} (${state.destination.iata})`;
  }

  // Bind Listeners
  setupSearchInputs();
  setupPresets();
  setupModal();
  setupUnitsToggle();
  setupThemeToggle();
  setupApiKeyModal();
  setupBasemapSwitcher();
  setupGMapModal();

  // Update API key badge UI
  updateApiKeyUI();

  // If no API key is set, require it by popping the modal
  if (!state.apiKey) {
    showApiKeyModal('🔑 An API key is required to authenticate with global aviation weather servers. Enter your key or click "Use Free Demo Key".');
  } else {
    // Initial Route Search with saved key
    await runRouteAnalysis();
  }
}

/**
 * Perform complete flight route generation and real atmospheric weather analysis
 */
async function runRouteAnalysis() {
  if (!state.origin || !state.destination) {
    alert('Please enter both origin and destination.');
    return;
  }

  // Check API key requirement
  if (!state.apiKey || state.apiKey.trim().length === 0) {
    showApiKeyModal('⚠️ Weather Telemetry API Key Required. Please enter your key or use a demo key.');
    return;
  }

  showLoading(true, 'Calculating Great Circle & contrail-avoidance flight corridors...');

  try {
    // 1. Generate 2-3 realistic operational route candidates
    const rawRoutes = generateFlightRoutes(state.origin, state.destination);

    // 2. Query real atmospheric weather telemetry for each route
    showLoading(true, 'Fetching live flight-level weather telemetry with authenticated API Key...');
    
    const enrichedRoutes = await Promise.all(
      rawRoutes.map(async (route, idx) => {
        showLoading(true, `Querying altitude weather for ${route.name} (${idx + 1}/3)...`);
        const waypointsWithWeather = await fetchRouteWeather(route.waypoints, state.apiKey);
        const metrics = calculateRouteAviationMetrics(route, waypointsWithWeather);

        return {
          ...route,
          waypointsWithWeather,
          metrics
        };
      })
    );

    // 3. Determine recommended route (lowest persistent contrail score)
    let lowestRiskScore = 999;
    let bestRouteId = enrichedRoutes[0].id;

    enrichedRoutes.forEach(r => {
      if (r.metrics.contrailRiskScore < lowestRiskScore) {
        lowestRiskScore = r.metrics.contrailRiskScore;
        bestRouteId = r.id;
      }
    });

    state.routes = enrichedRoutes;
    state.recommendedRouteId = bestRouteId;

    // Set active route to recommended route by default for best user experience
    state.activeRouteId = bestRouteId;

    // 4. Update UI & Map
    updateMap();
    renderRouteCards();
    updateRecommendationBanner();
    updateBottomInfoBar();
    renderWaypointWeather();
  } catch (error) {
    console.error('Error during flight route analysis:', error);
    alert('Error analyzing flight corridors. Please check network connection and try again.');
  } finally {
    showLoading(false);
  }
}

/**
 * Handle user clicking a route (from map or card)
 */
function handleRouteSelection(routeId) {
  if (state.activeRouteId === routeId) return;
  state.activeRouteId = routeId;
  updateMap();
  renderRouteCards();
  updateBottomInfoBar();
  renderWaypointWeather();
}

/**
 * Handle user clicking a waypoint
 */
function handleWaypointSelection(waypoint) {
  state.selectedWaypoint = waypoint;
  // Scroll waypoint card into view if available
  const wpCard = document.getElementById(`wp-card-${waypoint.index}`);
  if (wpCard) {
    wpCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    wpCard.classList.add('highlight-wp-card');
    setTimeout(() => wpCard.classList.remove('highlight-wp-card'), 1800);
  }
}

/**
 * Update Leaflet map display
 */
function updateMap() {
  if (ecoMap) {
    ecoMap.renderRoutes(state.routes, state.activeRouteId, state.origin, state.destination);
  }
}

/**
 * Render 2-3 Route Comparison Cards
 */
function renderRouteCards() {
  if (!elements.routeCardsContainer) return;
  elements.routeCardsContainer.innerHTML = '';

  const baselineRoute = state.routes.find(r => r.id === state.baselineRouteId) || state.routes[0];

  state.routes.forEach(route => {
    const isActive = route.id === state.activeRouteId;
    const isRecommended = route.id === state.recommendedRouteId;
    const m = route.metrics;

    // Delta calculations compared to baseline
    const timeDiffMin = m.flightTimeMinutes - baselineRoute.metrics.flightTimeMinutes;
    const fuelDiffTonnes = (parseFloat(m.fuelTonnes) - parseFloat(baselineRoute.metrics.fuelTonnes)).toFixed(1);
    const riskDiff = m.contrailRiskScore - baselineRoute.metrics.contrailRiskScore;

    let tradeoffBadge = '';
    if (route.id !== baselineRoute.id) {
      const timeSign = timeDiffMin >= 0 ? `+${timeDiffMin}` : `${timeDiffMin}`;
      const fuelSign = fuelDiffTonnes >= 0 ? `+${fuelDiffTonnes}` : `${fuelDiffTonnes}`;
      tradeoffBadge = `
        <div class="route-card-tradeoff">
          <span>⏱️ ${timeSign}m</span>
          <span>⛽ ${fuelSign}t</span>
          <span style="color:${m.overallRiskColor}; font-weight:600;">☁️ ${riskDiff <= 0 ? riskDiff + '%' : '+' + riskDiff + '%'} Contrail</span>
        </div>
      `;
    } else {
      tradeoffBadge = `
        <div class="route-card-tradeoff baseline-pill">
          <span>Standard Flight Baseline</span>
        </div>
      `;
    }

    const card = document.createElement('div');
    card.className = `route-card ${isActive ? 'active' : ''} ${isRecommended ? 'recommended-card' : ''}`;
    card.innerHTML = `
      <div class="route-card-header">
        <div class="route-card-title-group">
          <div class="route-name">${route.name}</div>
          <div class="route-alt-tag">${route.altitude}</div>
        </div>
        ${isRecommended ? '<span class="eco-badge">⭐ Recommended</span>' : ''}
      </div>

      <div class="route-card-desc">${route.description}</div>

      <div class="route-card-metrics">
        <div class="card-metric">
          <span class="lbl">Contrail Risk</span>
          <span class="val risk-val" style="color:${m.overallRiskColor};">
            <span class="risk-indicator-dot" style="background:${m.overallRiskColor};"></span>
            ${m.contrailRiskScore}% (${m.overallRiskLabel})
          </span>
        </div>
        <div class="card-metric">
          <span class="lbl">Est. Flight Time</span>
          <span class="val">${m.flightTimeStr}</span>
        </div>
        <div class="card-metric">
          <span class="lbl">Distance</span>
          <span class="val">${state.units === 'metric' ? m.distanceKm.toLocaleString() + ' km' : m.distanceNm.toLocaleString() + ' NM'}</span>
        </div>
      </div>

      ${tradeoffBadge}

      <!-- Google Maps Integration Feature inside Route Showing Box -->
      <div class="route-gmap-box">
        <div class="route-gmap-header">
          <span class="route-gmap-badge">
            <span class="gmap-pin-icon">📍</span>
            Google Maps Corridor
          </span>
          <span class="route-gmap-tag">${route.waypoints?.length || 0} GPS Waypoints</span>
        </div>
        <div class="route-gmap-actions">
          <a href="${buildGoogleMapsRouteUrl(state.origin, state.destination, route.waypoints)}" target="_blank" rel="noopener noreferrer" class="gmap-btn gmap-btn-primary" title="Open complete flight corridor in Google Maps (New Tab)">
            <span>🗺️</span> <span>Open in Google Maps ↗</span>
          </a>
          <button type="button" class="gmap-btn gmap-btn-preview" data-route-id="${route.id}" title="Inspect corridor with Google Satellite & Terrains">
            <span>🛰️</span> <span>G-Map Satellite</span>
          </button>
        </div>
      </div>

      <button class="select-route-btn ${isActive ? 'btn-active' : ''}">
        ${isActive ? '✓ Selected Route' : 'Select This Route'}
      </button>
    `;

    // Click handler for route card selection
    card.addEventListener('click', () => handleRouteSelection(route.id));

    // Handle G-Map preview modal button click (prevent propagation)
    const previewBtn = card.querySelector('.gmap-btn-preview');
    if (previewBtn) {
      previewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleRouteSelection(route.id);
        openGMapModal(route);
      });
    }

    // Stop propagation on external link so card selection doesn't interfere
    const openLink = card.querySelector('.gmap-btn-primary');
    if (openLink) {
      openLink.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    elements.routeCardsContainer.appendChild(card);
  });
}

/**
 * Update Recommendation Banner at top of details
 */
function updateRecommendationBanner() {
  if (!elements.recommendationBanner) return;

  const recRoute = state.routes.find(r => r.id === state.recommendedRouteId);
  const baselineRoute = state.routes.find(r => r.id === state.baselineRouteId) || state.routes[0];

  if (!recRoute) {
    elements.recommendationBanner.style.display = 'none';
    return;
  }

  elements.recommendationBanner.style.display = 'flex';

  if (recRoute.id === baselineRoute.id) {
    elements.recommendationText.innerHTML = `
      <strong>Standard Direct Route has the lowest contrail risk!</strong> Atmospheric layers along the direct Great Circle are currently warm and dry.
    `;
    elements.recommendationTradeoff.innerHTML = `No detour needed • Maximum fuel efficiency`;
  } else {
    const timeDiffMin = recRoute.metrics.flightTimeMinutes - baselineRoute.metrics.flightTimeMinutes;
    const fuelDiffPercent = (((recRoute.metrics.fuelKg - baselineRoute.metrics.fuelKg) / baselineRoute.metrics.fuelKg) * 100).toFixed(1);
    const contrailCutPercent = Math.max(0, Math.round(((baselineRoute.metrics.contrailRiskScore - recRoute.metrics.contrailRiskScore) / Math.max(1, baselineRoute.metrics.contrailRiskScore)) * 100));

    elements.recommendationText.innerHTML = `
      <strong>Recommended: ${recRoute.name}</strong> reduces persistent contrail warming risk by <strong>${contrailCutPercent}%</strong>.
    `;
    elements.recommendationTradeoff.innerHTML = `
      Trade-off: <strong>+${timeDiffMin} mins</strong> flight time & <strong>+${fuelDiffPercent}%</strong> fuel to avoid climate-warming ice clouds.
    `;
  }
}

/**
 * Update Bottom Information Bar (Fixed / Sticky Footer)
 */
function updateBottomInfoBar() {
  const activeRoute = state.routes.find(r => r.id === state.activeRouteId) || state.routes[0];
  if (!activeRoute) return;

  const m = activeRoute.metrics;

  // 1. Estimated flight time
  elements.statFlightTime.textContent = m.flightTimeStr;

  // 2. Estimated fuel consumption
  elements.statFuel.textContent = `${m.fuelTonnes} tonnes`;

  // 3. Total distance
  if (state.units === 'metric') {
    elements.statDistance.textContent = `${m.distanceKm.toLocaleString()} km`;
  } else {
    elements.statDistance.textContent = `${m.distanceNm.toLocaleString()} NM`;
  }

  // 4. Persistent Contrail Risk
  elements.statContrailRisk.textContent = `${m.contrailRiskScore}%`;
  elements.statContrailBar.style.width = `${Math.min(100, Math.max(5, m.contrailRiskScore))}%`;
  elements.statContrailBar.style.backgroundColor = m.overallRiskColor;

  elements.statContrailBadge.textContent = m.overallRiskLabel;
  elements.statContrailBadge.style.color = m.overallRiskColor;
  elements.statContrailBadge.style.backgroundColor = `${m.overallRiskColor}15`;
  elements.statContrailBadge.style.borderColor = `${m.overallRiskColor}40`;

  // 5. Update Quick G-Map Button in Bottom Bar
  if (elements.bottomGmapLink && state.origin && state.destination) {
    const url = buildGoogleMapsRouteUrl(state.origin, state.destination, activeRoute.waypoints);
    elements.bottomGmapLink.href = url;
    elements.bottomGmapLink.setAttribute('aria-label', `Open ${activeRoute.name} in Google Maps Directions`);
  }
}

/**
 * Render Waypoint Weather Cards along the active route
 */
function renderWaypointWeather() {
  if (!elements.waypointList) return;
  elements.waypointList.innerHTML = '';

  const activeRoute = state.routes.find(r => r.id === state.activeRouteId) || state.routes[0];
  if (!activeRoute || !activeRoute.waypointsWithWeather) return;

  activeRoute.waypointsWithWeather.forEach((wp) => {
    const isAvail = wp.weather && wp.weather.isAvailable;
    const risk = wp.weather?.risk || { color: '#94a3b8', label: 'Unavailable', score: 0 };
    const tempDisplay = isAvail
      ? (state.units === 'metric' ? `${wp.weather.temperatureC}°C` : `${Math.round(wp.weather.temperatureC * 9/5 + 32)}°F`)
      : 'N/A';
    const windDisplay = isAvail
      ? (state.units === 'metric' ? `${wp.weather.windSpeedKmH} km/h` : `${wp.weather.windSpeedKnots} kt`)
      : 'N/A';

    const card = document.createElement('div');
    card.id = `wp-card-${wp.index}`;
    card.className = 'waypoint-card';
    card.style.borderTop = `3px solid ${risk.color || '#0284c7'}`;

    card.innerHTML = `
      <div class="wp-card-head">
        <span class="wp-card-name">${wp.name}</span>
        <span class="wp-card-alt">${wp.pressureLevel}</span>
      </div>

      <div class="wp-card-risk-badge" style="background:${risk.color}15; color:${risk.color}; border: 1px solid ${risk.color}35;">
        <span class="dot" style="background:${risk.color};"></span>
        ${risk.label}
      </div>

      <div class="wp-card-stats-grid">
        <div class="stat-item">
          <span class="k">Temperature</span>
          <span class="v">${tempDisplay}</span>
        </div>
        <div class="stat-item">
          <span class="k">Humidity (RH)</span>
          <span class="v">${isAvail ? wp.weather.relativeHumidity + '%' : 'N/A'}</span>
        </div>
        <div class="stat-item">
          <span class="k">Ice Saturation</span>
          <span class="v ${isAvail && wp.weather.isISS ? 'iss-highlight' : ''}">
            ${isAvail ? wp.weather.rhi + '% RHi' : 'N/A'}
          </span>
        </div>
        <div class="stat-item">
          <span class="k">Wind</span>
          <span class="v">${windDisplay}</span>
        </div>
      </div>

      <div class="wp-card-note">${isAvail ? risk.description : 'Upper air telemetry unavailable for this coordinate.'}</div>
    `;

    elements.waypointList.appendChild(card);
  });
}

/**
 * Setup autocomplete and search inputs
 */
function setupSearchInputs() {
  let originTimeout = null;
  let destTimeout = null;

  // Origin input listener
  elements.originInput.addEventListener('input', (e) => {
    clearTimeout(originTimeout);
    const val = e.target.value;
    if (val.length < 2) {
      elements.originDropdown.classList.remove('active');
      return;
    }
    originTimeout = setTimeout(async () => {
      const results = await searchLocations(val);
      renderDropdown(elements.originDropdown, results, (item) => {
        state.origin = item;
        elements.originInput.value = item.title || `${item.city} (${item.iata || 'LOC'})`;
        elements.originDropdown.classList.remove('active');
        runRouteAnalysis();
      });
    }, 280);
  });

  // Destination input listener
  elements.destInput.addEventListener('input', (e) => {
    clearTimeout(destTimeout);
    const val = e.target.value;
    if (val.length < 2) {
      elements.destDropdown.classList.remove('active');
      return;
    }
    destTimeout = setTimeout(async () => {
      const results = await searchLocations(val);
      renderDropdown(elements.destDropdown, results, (item) => {
        state.destination = item;
        elements.destInput.value = item.title || `${item.city} (${item.iata || 'LOC'})`;
        elements.destDropdown.classList.remove('active');
        runRouteAnalysis();
      });
    }, 280);
  });

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!elements.originInput.contains(e.target) && !elements.originDropdown.contains(e.target)) {
      elements.originDropdown.classList.remove('active');
    }
    if (!elements.destInput.contains(e.target) && !elements.destDropdown.contains(e.target)) {
      elements.destDropdown.classList.remove('active');
    }
  });

  // Swap locations button
  elements.swapBtn.addEventListener('click', () => {
    const temp = state.origin;
    state.origin = state.destination;
    state.destination = temp;

    elements.originInput.value = state.origin.title || `${state.origin.city} (${state.origin.iata || ''})`;
    elements.destInput.value = state.destination.title || `${state.destination.city} (${state.destination.iata || ''})`;

    runRouteAnalysis();
  });

  // Search button
  elements.searchBtn.addEventListener('click', () => {
    runRouteAnalysis();
  });
}

function renderDropdown(dropdownEl, items, onSelect) {
  if (!items || items.length === 0) {
    dropdownEl.innerHTML = `<div class="dropdown-empty">No destinations found. Try another city or airport.</div>`;
    dropdownEl.classList.add('active');
    return;
  }

  dropdownEl.innerHTML = '';
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'dropdown-item';
    row.innerHTML = `
      <div class="dropdown-item-main">
        <span class="dropdown-icon">${item.isAirport ? '✈️' : '📍'}</span>
        <div>
          <div class="dropdown-title">${item.title}</div>
          <div class="dropdown-subtitle">${item.subtitle}</div>
        </div>
      </div>
      ${item.iata ? `<span class="dropdown-iata">${item.iata}</span>` : ''}
    `;
    row.addEventListener('click', () => onSelect(item));
    dropdownEl.appendChild(row);
  });

  dropdownEl.classList.add('active');
}

/**
 * Setup preset route chips (JFK-LHR, SFO-HND, DXB-CDG, etc.)
 */
function setupPresets() {
  elements.presetChips.forEach(chip => {
    chip.addEventListener('click', () => {
      elements.presetChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const origIata = chip.getAttribute('data-origin');
      const destIata = chip.getAttribute('data-dest');

      const orig = MAJOR_AIRPORTS.find(a => a.iata === origIata);
      const dest = MAJOR_AIRPORTS.find(a => a.iata === destIata);

      if (orig && dest) {
        state.origin = orig;
        state.destination = dest;
        elements.originInput.value = `${orig.city} (${orig.iata})`;
        elements.destInput.value = `${dest.city} (${dest.iata})`;
        runRouteAnalysis();
      }
    });
  });
}

/**
 * Setup Unit Toggle (Metric vs Nautical)
 */
function setupUnitsToggle() {
  if (!elements.unitsToggleBtn) return;
  elements.unitsToggleBtn.addEventListener('click', () => {
    state.units = state.units === 'metric' ? 'nautical' : 'metric';
    elements.unitsToggleBtn.textContent = state.units === 'metric' ? 'Metric (km, °C)' : 'Nautical (NM, °F)';
    updateBottomInfoBar();
    renderRouteCards();
    renderWaypointWeather();
  });
}

/**
 * Setup Theme Toggle (Dark Blue vs Light)
 */
function setupThemeToggle() {
  if (!elements.themeToggleBtn) return;
  elements.themeToggleBtn.addEventListener('click', () => {
    state.theme = state.theme === 'dark-blue' ? 'light' : 'dark-blue';
    if (state.theme === 'light') {
      document.body.classList.add('theme-light');
      elements.themeToggleBtn.textContent = '☀️ Sky Light';
      if (ecoMap) ecoMap.setTheme('light');
    } else {
      document.body.classList.remove('theme-light');
      elements.themeToggleBtn.textContent = '🌙 Dark Blue';
      if (ecoMap) ecoMap.setTheme('dark-blue');
    }
  });
}

/**
 * Setup Educational Contrail Info Modal
 */
function setupModal() {
  if (elements.openInfoBtn && elements.infoModal) {
    elements.openInfoBtn.addEventListener('click', () => {
      elements.infoModal.classList.add('active');
    });
  }
  if (elements.closeInfoBtn && elements.infoModal) {
    elements.closeInfoBtn.addEventListener('click', () => {
      elements.infoModal.classList.remove('active');
    });
  }
  if (elements.infoModal) {
    elements.infoModal.addEventListener('click', (e) => {
      if (e.target === elements.infoModal) {
        elements.infoModal.classList.remove('active');
      }
    });
  }
}

/**
 * Update Header API Key Badge UI
 */
function updateApiKeyUI() {
  if (state.apiKey && state.apiKey.trim().length > 0) {
    if (elements.openApiBtn) elements.openApiBtn.classList.add('active-key');
    if (elements.apiStatusIcon) elements.apiStatusIcon.textContent = '✓';
    if (elements.apiBtnText) elements.apiBtnText.textContent = 'API Key: Active';
    if (elements.apiKeyInput) elements.apiKeyInput.value = state.apiKey;
  } else {
    if (elements.openApiBtn) elements.openApiBtn.classList.remove('active-key');
    if (elements.apiStatusIcon) elements.apiStatusIcon.textContent = '⚠️';
    if (elements.apiBtnText) elements.apiBtnText.textContent = 'API Key Required';
    if (elements.apiKeyInput) elements.apiKeyInput.value = '';
  }
}

/**
 * Show API Key Required Modal
 */
function showApiKeyModal(message = '') {
  if (!elements.apiModal) return;
  elements.apiModal.classList.add('active');
  if (elements.apiKeyInput) elements.apiKeyInput.value = state.apiKey || '';
  if (message && elements.apiKeyValidationMsg) {
    elements.apiKeyValidationMsg.textContent = message;
    elements.apiKeyValidationMsg.className = 'api-status-msg error';
    elements.apiKeyValidationMsg.style.display = 'block';
  }
}

/**
 * Setup API Key Configuration Modal & Listeners
 */
function setupApiKeyModal() {
  // Open API modal button in header
  if (elements.openApiBtn) {
    elements.openApiBtn.addEventListener('click', () => {
      showApiKeyModal();
    });
  }

  // Close button
  if (elements.closeApiBtn) {
    elements.closeApiBtn.addEventListener('click', () => {
      elements.apiModal.classList.remove('active');
    });
  }

  // Click outside to close
  if (elements.apiModal) {
    elements.apiModal.addEventListener('click', (e) => {
      if (e.target === elements.apiModal) {
        elements.apiModal.classList.remove('active');
      }
    });
  }

  // Toggle password visibility
  if (elements.toggleKeyVisibilityBtn && elements.apiKeyInput) {
    elements.toggleKeyVisibilityBtn.addEventListener('click', () => {
      const isPassword = elements.apiKeyInput.type === 'password';
      elements.apiKeyInput.type = isPassword ? 'text' : 'password';
      elements.toggleKeyVisibilityBtn.textContent = isPassword ? '🔒' : '👁️';
    });
  }

  // Save API Key Button
  if (elements.saveApiKeyBtn) {
    elements.saveApiKeyBtn.addEventListener('click', async () => {
      const val = elements.apiKeyInput.value.trim();
      if (!val) {
        elements.apiKeyValidationMsg.textContent = 'Please enter a valid API key.';
        elements.apiKeyValidationMsg.className = 'api-status-msg error';
        elements.apiKeyValidationMsg.style.display = 'block';
        return;
      }

      elements.apiKeyValidationMsg.textContent = 'Authenticating API key with global upper-air telemetry servers...';
      elements.apiKeyValidationMsg.className = 'api-status-msg';
      elements.apiKeyValidationMsg.style.display = 'block';

      const check = await validateApiKey(val);
      if (check.valid) {
        state.apiKey = val;
        localStorage.setItem('ecoflight_api_key', val);
        updateApiKeyUI();
        elements.apiKeyValidationMsg.textContent = `✓ ${check.message || 'API Key saved & verified.'} (${check.tier || 'Active'})`;
        elements.apiKeyValidationMsg.className = 'api-status-msg success';

        setTimeout(() => {
          elements.apiModal.classList.remove('active');
          runRouteAnalysis();
        }, 800);
      } else {
        elements.apiKeyValidationMsg.textContent = `✗ ${check.message || 'Invalid API key.'}`;
        elements.apiKeyValidationMsg.className = 'api-status-msg error';
      }
    });
  }

  // Use Free Demo Key Button
  if (elements.demoApiKeyBtn) {
    elements.demoApiKeyBtn.addEventListener('click', async () => {
      const demoKey = 'ECOFLIGHT-AIR-2026-DEMO';
      elements.apiKeyInput.value = demoKey;
      state.apiKey = demoKey;
      localStorage.setItem('ecoflight_api_key', demoKey);
      updateApiKeyUI();

      elements.apiKeyValidationMsg.textContent = '✓ Free evaluation key authenticated and saved.';
      elements.apiKeyValidationMsg.className = 'api-status-msg success';
      elements.apiKeyValidationMsg.style.display = 'block';

      setTimeout(() => {
        elements.apiModal.classList.remove('active');
        runRouteAnalysis();
      }, 700);
    });
  }

  // Clear Key Button
  if (elements.clearApiKeyBtn) {
    elements.clearApiKeyBtn.addEventListener('click', () => {
      state.apiKey = '';
      localStorage.removeItem('ecoflight_api_key');
      updateApiKeyUI();
      elements.apiKeyInput.value = '';
      elements.apiKeyValidationMsg.textContent = 'API key removed. Searches will require an API key to proceed.';
      elements.apiKeyValidationMsg.className = 'api-status-msg error';
      elements.apiKeyValidationMsg.style.display = 'block';
    });
  }
}

function showLoading(show, statusText = '') {
  state.isLoading = show;
  if (!elements.loadingOverlay) return;
  if (show) {
    elements.loadingOverlay.classList.add('active');
    if (elements.loadingText && statusText) {
      elements.loadingText.textContent = statusText;
    }
  } else {
    elements.loadingOverlay.classList.remove('active');
  }
}

// ==========================================================================
// Google Maps Feature Helpers & Modal Controller
// ==========================================================================

/**
 * Generate a Google Maps Directions URL with origin, destination, and key waypoints
 */
export function buildGoogleMapsRouteUrl(origin, destination, waypoints = []) {
  if (!origin || !destination) return '#';
  const origCoord = `${Number(origin.lat).toFixed(4)},${Number(origin.lon).toFixed(4)}`;
  const destCoord = `${Number(destination.lat).toFixed(4)},${Number(destination.lon).toFixed(4)}`;

  let wpParam = '';
  if (waypoints && waypoints.length > 0) {
    let sampled = [];
    if (waypoints.length <= 3) {
      sampled = waypoints;
    } else {
      sampled = [
        waypoints[0],
        waypoints[Math.floor(waypoints.length / 2)],
        waypoints[waypoints.length - 1]
      ];
    }
    const wpCoords = sampled.map(w => `${Number(w.lat).toFixed(4)},${Number(w.lon).toFixed(4)}`).join('|');
    wpParam = `&waypoints=${encodeURIComponent(wpCoords)}`;
  }

  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origCoord)}&destination=${encodeURIComponent(destCoord)}${wpParam}`;
}

/**
 * Generate Google Maps Embed iframe URL
 */
export function buildGoogleMapsEmbedUrl(origin, destination, layerType = 'k') {
  if (!origin || !destination) return 'about:blank';
  return `https://maps.google.com/maps?saddr=${Number(origin.lat).toFixed(4)},${Number(origin.lon).toFixed(4)}&daddr=${Number(destination.lat).toFixed(4)},${Number(destination.lon).toFixed(4)}&t=${layerType}&z=4&output=embed`;
}

let activeModalRoute = null;
let activeModalLayer = 'k'; // 'k' (Satellite), 'h' (Hybrid), 'p' (Terrain), 'm' (Roadmap)

/**
 * Open the Google Maps Explorer Modal for a given route
 */
export function openGMapModal(route) {
  if (!route || !elements.gmapModal) return;
  activeModalRoute = route;

  if (elements.gmapModalTitle) {
    elements.gmapModalTitle.textContent = `${route.name} — Google Maps Explorer`;
  }
  if (elements.gmapModalSubtitle && state.origin && state.destination) {
    elements.gmapModalSubtitle.textContent = `${state.origin.city} (${state.origin.iata || 'DEP'}) ➔ ${state.destination.city} (${state.destination.iata || 'ARR'}) • ${route.altitude}`;
  }
  if (elements.gmapRouteAltBadge) {
    const dist = state.units === 'metric'
      ? `${route.metrics?.distanceKm?.toLocaleString() || ''} km`
      : `${route.metrics?.distanceNm?.toLocaleString() || ''} NM`;
    elements.gmapRouteAltBadge.textContent = `${route.altitude} • ${dist}`;
  }

  // External link
  if (elements.gmapModalOpenLink && state.origin && state.destination) {
    elements.gmapModalOpenLink.href = buildGoogleMapsRouteUrl(state.origin, state.destination, route.waypoints);
  }

  // Update iframe embed with current layer
  updateGMapModalIframe();

  // Render Waypoint GPS Pills
  if (elements.gmapWaypointsStrip) {
    elements.gmapWaypointsStrip.innerHTML = '';
    const wps = route.waypointsWithWeather || route.waypoints || [];
    wps.forEach(wp => {
      const pill = document.createElement('div');
      pill.className = 'gmap-wp-pill';
      const riskColor = wp.weather?.risk?.color || '#38bdf8';
      pill.innerHTML = `
        <div class="gmap-wp-top">
          <span class="gmap-wp-dot" style="background:${riskColor};"></span>
          <strong>${wp.name}</strong>
        </div>
        <div class="gmap-wp-coords">${wp.lat.toFixed(2)}°, ${wp.lon.toFixed(2)}°</div>
      `;
      pill.title = `Click to center Google Maps view at ${wp.lat}, ${wp.lon}`;
      pill.addEventListener('click', () => {
        if (elements.gmapIframe) {
          elements.gmapIframe.src = `https://maps.google.com/maps?q=${wp.lat},${wp.lon}&t=${activeModalLayer}&z=6&output=embed`;
        }
      });
      elements.gmapWaypointsStrip.appendChild(pill);
    });
  }

  elements.gmapModal.classList.add('active');
}

function updateGMapModalIframe() {
  if (!elements.gmapIframe || !state.origin || !state.destination) return;
  elements.gmapIframe.src = buildGoogleMapsEmbedUrl(state.origin, state.destination, activeModalLayer);
}

function setupGMapModal() {
  if (elements.closeGmapBtn && elements.gmapModal) {
    elements.closeGmapBtn.addEventListener('click', () => {
      elements.gmapModal.classList.remove('active');
    });
  }

  if (elements.gmapModal) {
    elements.gmapModal.addEventListener('click', (e) => {
      if (e.target === elements.gmapModal) {
        elements.gmapModal.classList.remove('active');
      }
    });
  }

  // Layer tabs
  if (elements.gmapLayerTabs) {
    elements.gmapLayerTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const layer = tab.getAttribute('data-layer');
        if (!layer) return;
        activeModalLayer = layer;
        elements.gmapLayerTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        updateGMapModalIframe();
      });
    });
  }

  // Apply to Main Map button
  if (elements.gmapApplyMainBtn) {
    elements.gmapApplyMainBtn.addEventListener('click', () => {
      const basemapMap = {
        'k': 'google-satellite',
        'h': 'google-hybrid',
        'p': 'google-terrain',
        'm': 'google-streets'
      };
      const targetBasemap = basemapMap[activeModalLayer] || 'google-hybrid';
      if (ecoMap) {
        ecoMap.setBasemap(targetBasemap);
      }
      if (elements.basemapBtns) {
        elements.basemapBtns.forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-basemap') === targetBasemap);
        });
      }
      elements.gmapModal.classList.remove('active');

      // Smooth scroll to map
      const mapSection = document.querySelector('.map-section');
      if (mapSection) {
        mapSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }
}

/**
 * Setup Basemap Switcher Toolbar
 */
function setupBasemapSwitcher() {
  if (!elements.basemapBtns || elements.basemapBtns.length === 0) return;
  elements.basemapBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-basemap');
      if (!target) return;
      elements.basemapBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (ecoMap) {
        ecoMap.setBasemap(target);
      }
    });
  });
}

// Start app when DOM is ready
window.addEventListener('DOMContentLoaded', initApp);
