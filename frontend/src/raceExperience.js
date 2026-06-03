import * as THREE from 'three';
import { loadRaceCarModel, setVehicleLightsEnabled, updateCompanionCars, updateRaceCar } from './scene/cars.jsx';
import {
  createExhaustSmoke,
  createTrackDetails,
  updateExhaustSmoke,
  updateSceneDetails,
} from './scene/effects.jsx';
import { loadRealTrackModel } from './scene/realTrack.jsx';
import { createWeatherSystem, updateWeatherSystem } from './scene/weather.jsx';
import { addLighting, addTerrain, applyEnvironmentPreset, updateStreetLightDynamicLights } from './scene/world.jsx';

const ACTIVE_TRACK_VERSION = 'real-model';
const REAL_PROGRESS_DAMPING = 1.2;
const REAL_MAX_PROGRESS_PER_SECOND = 0.055;
const REAL_LAP_SCROLL_PORTION = 0.92;
const DEFAULT_ENVIRONMENT_MODE = 'night';
const ENVIRONMENT_MODES = new Set(['day', 'night']);
const DEFAULT_WEATHER_MODE = 'clear';
const WEATHER_MODES = new Set(['clear', 'rain', 'snow']);
const ENABLE_DEVELOPMENT_GRID = import.meta.env.DEV;
const MAX_RENDER_PIXEL_RATIO = 1.5;
const STREET_LIGHT_UPDATE_INTERVAL = 0.1;

let canvas;
let segmentName;
let lapProgress;
let gridCell;
let gridPosition;
let trackVersionLabel;
let trackVersionDetail;
let trackNameElement;
let trackCredit;
let environmentButtons = [];
let weatherButtons = [];
let windButton;
let routeNav;
let routeProgressValue;
let panelElements = [];
let routeButtons = [];
let cachedRouteStops = [];

let renderer;
let scene;
let camera;
let lighting;
let terrain;
let weather;
let trackCurve = null;
let getSurfaceY = getRealSurfaceY;
let car;
let smokeState;
let companionCars = [];
let curbs = [];
let tireStacks = [];
let sparks = [];
let progress = 0;
let easedProgress = 0;
let environmentMode = getInitialEnvironmentMode();
let weatherMode = getInitialWeatherMode();
let windEnabled = getInitialWindEnabled();
let viewport = { width: window.innerWidth, height: window.innerHeight };
let lastFrameTime = performance.now();
let vehicleLightState = { enabled: false, main: false, companions: 0, dynamicLights: 0 };
const cameraLookTarget = new THREE.Vector3();
let hasCameraLookTarget = false;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(-4, -4);
const pointerGroundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const pointerGroundPoint = new THREE.Vector3();
let getGridCellFromPosition = null;
let animationFrameId = 0;
let disposed = false;
let cleanupCallbacks = [];
let activeCleanup = null;
let activeRunId = 0;
let currentPanelStage = '';
let isPageVisible = !document.hidden;
let streetLightUpdateTimer = STREET_LIGHT_UPDATE_INTERVAL;
let vehicleLightsDirty = true;
let vehicleLightSignature = '';

const cameraTrackPoint = new THREE.Vector3();
const cameraTangent = new THREE.Vector3();
const cameraNormal = new THREE.Vector3();
const cameraOffset = new THREE.Vector3();
const cameraTargetPosition = new THREE.Vector3();
const cameraLookAhead = new THREE.Vector3();

export function initRaceExperience() {
  activeCleanup?.();
  const runId = ++activeRunId;
  bindDomElements();
  resetRaceState();
  setLoadingState(true);

  if (!canvas) {
    return () => {};
  }

  init(runId);

  activeCleanup = () => cleanupRaceExperience(runId);
  return activeCleanup;
}

export function syncRaceExperienceContent() {
  cacheContentElements();
  updatePanels(progress);
}

function bindDomElements() {
  canvas = document.querySelector('#race-canvas');
  segmentName = document.querySelector('#segment-name');
  lapProgress = document.querySelector('#lap-progress');
  gridCell = document.querySelector('#grid-cell');
  gridPosition = document.querySelector('#grid-position');
  trackVersionLabel = document.querySelector('#track-version-label');
  trackVersionDetail = document.querySelector('#track-version-detail');
  trackNameElement = document.querySelector('#track-name');
  trackCredit = document.querySelector('#track-credit');
  environmentButtons = document.querySelectorAll('[data-environment-mode]');
  weatherButtons = document.querySelectorAll('[data-weather-mode]');
  windButton = document.querySelector('[data-wind-toggle]');
  cacheContentElements();
}

function cacheContentElements() {
  routeNav = document.querySelector('.track-nav');
  routeProgressValue = document.querySelector('#route-progress-value');
  panelElements = [...document.querySelectorAll('[data-panel]')];
  routeButtons = [...document.querySelectorAll('[data-route-progress]')];
  cachedRouteStops = routeButtons
    .map((button) => ({
      stage: button.dataset.routeStage,
      label: button.querySelector('strong')?.textContent || button.dataset.routeStage,
      progress: Number(button.dataset.routeProgress),
    }))
    .filter((stop) => stop.stage && Number.isFinite(stop.progress))
    .sort((left, right) => left.progress - right.progress);
  currentPanelStage = '';
}

function resetRaceState() {
  renderer = null;
  scene = null;
  camera = null;
  lighting = null;
  terrain = null;
  weather = null;
  trackCurve = null;
  getSurfaceY = getRealSurfaceY;
  car = null;
  smokeState = null;
  companionCars = [];
  curbs = [];
  tireStacks = [];
  sparks = [];
  progress = 0;
  easedProgress = 0;
  environmentMode = getInitialEnvironmentMode();
  weatherMode = getInitialWeatherMode();
  windEnabled = getInitialWindEnabled();
  viewport = { width: window.innerWidth, height: window.innerHeight };
  lastFrameTime = performance.now();
  vehicleLightState = { enabled: false, main: false, companions: 0, dynamicLights: 0 };
  hasCameraLookTarget = false;
  disposed = false;
  cleanupCallbacks = [];
  currentPanelStage = '';
  isPageVisible = !document.hidden;
  streetLightUpdateTimer = STREET_LIGHT_UPDATE_INTERVAL;
  vehicleLightsDirty = true;
  vehicleLightSignature = '';
}

function cleanupRaceExperience(runId = activeRunId) {
  if (runId !== activeRunId) {
    return;
  }

  disposed = true;
  cleanupCallbacks.forEach((cleanup) => cleanup());
  cleanupCallbacks = [];
  cancelAnimationFrame(animationFrameId);
  renderer?.dispose();
  delete window.__paddockindiaDebug;
  document.body.removeAttribute('data-loading');
  activeCleanup = null;
}

async function init(runId) {
  document.body.dataset.trackVersion = ACTIVE_TRACK_VERSION;
  setEnvironmentDataset(environmentMode);
  document.body.dataset.weather = weatherMode;
  document.body.dataset.wind = String(windEnabled);
  updateTrackVersionStatus('loading');
  updateEnvironmentControls();
  updateWeatherControls();

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(getRenderPixelRatio());
  renderer.setSize(viewport.width, viewport.height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x0b0f13, 1);

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0b0f13, 0.018);

  camera = new THREE.PerspectiveCamera(40, viewport.width / viewport.height, 0.1, 500);
  camera.position.set(0, 26, 56);

  lighting = addLighting(scene);
  terrain = addTerrain(scene);
  weather = createWeatherSystem({ scene });
  applyEnvironmentMode(environmentMode);
  const groundGrid = await loadDevelopmentGroundGrid();
  if (!isRaceRunActive(runId)) {
    return;
  }
  if (groundGrid) {
    scene.add(groundGrid);
  }

  const realTrack = await loadRealTrackModel({ scene, version: ACTIVE_TRACK_VERSION });
  if (!isRaceRunActive(runId)) {
    return;
  }

  updateTrackIdentity(realTrack.config);

  if (realTrack.loaded && realTrack.driveCurve) {
    trackCurve = realTrack.driveCurve;
    getSurfaceY = realTrack.getSurfaceY ?? getRealSurfaceY;
    lighting.streetLights = realTrack.streetLights;
    applyEnvironmentMode(environmentMode);
    updateTrackVersionStatus('real-loaded', realTrack);
  } else {
    updateTrackVersionStatus('real-missing', realTrack);
  }

  car = new THREE.Group();
  car.name = 'race-car';
  scene.add(car);
  loadRaceCarModel({ car, scene, companionCars });

  createTrackDetails({
    scene,
    trackCurve,
    tireStacks,
    sparks,
    getSurfaceY,
    includeTrackside: false,
  });
  smokeState = createExhaustSmoke({ scene });
  updateScrollState();
  updatePanels(progress);
  setLoadingState(false);

  addWindowListener('resize', handleResize);
  addWindowListener('scroll', updateScrollState, { passive: true });
  if (ENABLE_DEVELOPMENT_GRID) {
    addWindowListener('pointermove', handlePointerMove, { passive: true });
  }
  addDocumentListener('visibilitychange', handleVisibilityChange);
  environmentButtons.forEach((button) => {
    addElementListener(button, 'click', () => {
      setEnvironmentMode(button.dataset.environmentMode);
    });
  });
  weatherButtons.forEach((button) => {
    addElementListener(button, 'click', () => {
      setWeatherMode(button.dataset.weatherMode);
    });
  });
  addElementListener(windButton, 'click', () => {
    setWindEnabled(!windEnabled);
  });
  addWindowListener('click', (event) => {
    const routeButton = event.target.closest?.('[data-route-progress]');

    if (routeButton) {
      scrollToRaceProgress(Number(routeButton.dataset.routeProgress));
    }
  });

  animationFrameId = requestAnimationFrame(() => animate(runId));
}

function setLoadingState(isLoading) {
  document.body.dataset.loading = String(isLoading);
}

async function loadDevelopmentGroundGrid() {
  if (!ENABLE_DEVELOPMENT_GRID) {
    return null;
  }

  const gridModule = await import('./scene/groundGrid.jsx');
  getGridCellFromPosition = gridModule.getGridCellFromPosition;
  return gridModule.createGroundGrid();
}

function addWindowListener(type, listener, options) {
  window.addEventListener(type, listener, options);
  cleanupCallbacks.push(() => window.removeEventListener(type, listener, options));
}

function addDocumentListener(type, listener, options) {
  document.addEventListener(type, listener, options);
  cleanupCallbacks.push(() => document.removeEventListener(type, listener, options));
}

function addElementListener(element, type, listener, options) {
  if (!element) {
    return;
  }

  element.addEventListener(type, listener, options);
  cleanupCallbacks.push(() => element.removeEventListener(type, listener, options));
}

function getInitialEnvironmentMode() {
  const savedMode = window.localStorage?.getItem('paddockindia-environment-mode');
  return ENVIRONMENT_MODES.has(savedMode) ? savedMode : DEFAULT_ENVIRONMENT_MODE;
}

function getInitialWeatherMode() {
  const savedMode = window.localStorage?.getItem('paddockindia-weather-mode');
  return WEATHER_MODES.has(savedMode) ? savedMode : DEFAULT_WEATHER_MODE;
}

function getInitialWindEnabled() {
  return window.localStorage?.getItem('paddockindia-wind-enabled') === 'true';
}

function setEnvironmentMode(mode) {
  if (!ENVIRONMENT_MODES.has(mode) || mode === environmentMode) {
    return;
  }

  environmentMode = mode;
  window.localStorage?.setItem('paddockindia-environment-mode', environmentMode);
  vehicleLightsDirty = true;
  streetLightUpdateTimer = STREET_LIGHT_UPDATE_INTERVAL;
  applyEnvironmentMode(environmentMode);
  updateEnvironmentControls();
}

function setWeatherMode(mode) {
  if (!WEATHER_MODES.has(mode) || mode === weatherMode) {
    return;
  }

  weatherMode = mode;
  window.localStorage?.setItem('paddockindia-weather-mode', weatherMode);
  document.body.dataset.weather = weatherMode;
  updateWeatherControls();
}

function setWindEnabled(value) {
  windEnabled = Boolean(value);
  window.localStorage?.setItem('paddockindia-wind-enabled', String(windEnabled));
  document.body.dataset.wind = String(windEnabled);
  updateWeatherControls();
}

function applyEnvironmentMode(mode) {
  if (!scene || !renderer || !lighting || !terrain) {
    return;
  }

  setEnvironmentDataset(mode);
  applyEnvironmentPreset({ mode, scene, renderer, lighting, terrain });
}

function setEnvironmentDataset(mode) {
  document.documentElement.dataset.environment = mode;
  document.body.dataset.environment = mode;
}

function updateEnvironmentControls() {
  environmentButtons.forEach((button) => {
    const isActive = button.dataset.environmentMode === environmentMode;
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function updateWeatherControls() {
  weatherButtons.forEach((button) => {
    const isActive = button.dataset.weatherMode === weatherMode;
    button.setAttribute('aria-pressed', String(isActive));
  });
  windButton?.setAttribute('aria-pressed', String(windEnabled));
}

function updateTrackIdentity(config) {
  if (trackNameElement) {
    trackNameElement.textContent = config.displayName;
  }

  if (trackCredit) {
    trackCredit.textContent = config.credit;
  }
}

function updateTrackVersionStatus(state, realTrack = null) {
  if (!trackVersionLabel || !trackVersionDetail) {
    return;
  }

  trackVersionLabel.textContent = 'Version 2';

  if (state === 'real-loaded') {
    trackVersionDetail.textContent = `${realTrack.config.displayName} loaded; cars follow ${realTrack.routeMethod} (${realTrack.routePointCount} points)`;
    return;
  }

  if (state === 'real-missing') {
    trackVersionDetail.textContent = 'Waiting for the real track GLB.';
    return;
  }

  trackVersionDetail.textContent = 'Loading real track variation';
}

function isRaceRunActive(runId) {
  return runId === activeRunId && !disposed;
}

function animate(runId) {
  if (!isRaceRunActive(runId)) {
    return;
  }

  if (!isPageVisible) {
    lastFrameTime = performance.now();
    animationFrameId = requestAnimationFrame(() => animate(runId));
    return;
  }

  const now = performance.now();
  const delta = Math.min((now - lastFrameTime) / 1000, 0.04);
  lastFrameTime = now;
  const dampedProgress = THREE.MathUtils.damp(
    easedProgress,
    progress,
    REAL_PROGRESS_DAMPING,
    delta,
  );
  easedProgress = moveProgressToward(
    easedProgress,
    dampedProgress,
    REAL_MAX_PROGRESS_PER_SECOND * delta,
  );

  if (trackCurve) {
    updateRaceCar({
      trackCurve,
      car,
      t: easedProgress,
      delta,
      progress,
      easedProgress,
      sparks,
      camera,
      smokeState,
      getSurfaceY,
      rideHeight: 0.02,
      lockToSurface: true,
      smoothHeading: true,
      headingDamping: 12,
    });
    updateCompanionCars({
      trackCurve,
      companionCars,
      t: easedProgress,
      delta,
      getSurfaceY,
      spacingScale: 0.55,
      rideHeight: 0.02,
      lockToSurface: true,
      laneScale: 0.2,
      smoothHeading: true,
      headingDamping: 10,
    });
    syncStreetLightDynamicLights(delta);
    syncVehicleLights();
    updateCamera(easedProgress, delta);
    updateHud(easedProgress);
  }

  updateSceneDetails({ curbs, tireStacks, raycaster, pointer, camera, delta });
  updateExhaustSmoke(smokeState, delta);
  updateWeatherSystem({ weather, mode: weatherMode, windEnabled, delta, camera });
  updateDebugState();

  renderer.render(scene, camera);
  animationFrameId = requestAnimationFrame(() => animate(runId));
}

function moveProgressToward(current, target, maxStep) {
  const difference = target - current;
  if (Math.abs(difference) <= maxStep) {
    return target;
  }

  return current + Math.sign(difference) * maxStep;
}

function updateDebugState() {
  if (!import.meta.env.DEV) {
    return;
  }

  window.__paddockindiaDebug = {
    progress,
    easedProgress,
    car: car
      ? {
          x: Number(car.position.x.toFixed(2)),
          y: Number(car.position.y.toFixed(2)),
          z: Number(car.position.z.toFixed(2)),
          yaw: Number(car.rotation.y.toFixed(3)),
        }
      : null,
    companions: companionCars.map(({ group, config }) => ({
      name: config.name,
      x: Number(group.position.x.toFixed(2)),
      y: Number(group.position.y.toFixed(2)),
      z: Number(group.position.z.toFixed(2)),
      yaw: Number(group.rotation.y.toFixed(3)),
    })),
    camera: {
      x: Number(camera.position.x.toFixed(2)),
      y: Number(camera.position.y.toFixed(2)),
      z: Number(camera.position.z.toFixed(2)),
    },
    streetLights: lighting?.streetLights
      ? {
          visible: lighting.streetLights.group.visible,
          glows: lighting.streetLights.glowSprites.length,
          pools: lighting.streetLights.lightPools.length,
          sources: lighting.streetLights.dynamicSources.length,
          pointLights: lighting.streetLights.pointLights.length,
          spotLights: lighting.streetLights.spotLights.length,
          activePointLights: lighting.streetLights.pointLights.filter((light) => light.visible).length,
          activeSpotLights: lighting.streetLights.spotLights.filter((light) => light.visible).length,
        }
      : null,
    weather: weather
      ? {
          mode: weatherMode,
          wind: windEnabled,
          rainVisible: weather.rain.lines.visible,
          snowVisible: weather.snow.points.visible,
          lightning: Number(weather.lightning.flashLight.intensity.toFixed(2)),
          lightningStrikes: weather.lightning.strikeCount,
        }
      : null,
    vehicleLights: vehicleLightState,
  };
}

function syncStreetLightDynamicLights(delta) {
  if (environmentMode !== 'night') {
    return;
  }

  streetLightUpdateTimer += delta;
  if (streetLightUpdateTimer < STREET_LIGHT_UPDATE_INTERVAL) {
    return;
  }

  streetLightUpdateTimer = 0;
  updateStreetLightDynamicLights(lighting.streetLights, car.position);
}

function syncVehicleLights() {
  const enabled = environmentMode === 'night';
  const signature = `${enabled}:${Boolean(car?.userData.vehicleLights)}:${companionCars.length}`;

  if (!vehicleLightsDirty && signature === vehicleLightSignature) {
    return;
  }

  vehicleLightState = setVehicleLightsEnabled({
    car,
    companionCars,
    enabled,
  });
  vehicleLightSignature = signature;
  vehicleLightsDirty = false;
}

function updateCamera(t, delta) {
  const trackT = t % 1;
  const point = getCurvePointAt(trackCurve, trackT, cameraTrackPoint);
  point.y = getSurfaceY(t % 1, point);
  const tangent = getCurveTangentAt(trackCurve, trackT, cameraTangent);
  const normal = cameraNormal.set(-tangent.z, 0, tangent.x).normalize();
  const sideDrift = viewport.width < 720 ? 3.4 : 5.2;
  const cinematicOffset = cameraOffset.copy(normal).multiplyScalar(Math.sin(t * Math.PI * 2.3) * sideDrift);
  const height = viewport.width < 720 ? 17 : 11;
  const distance = viewport.width < 720 ? 24 : 21.5;

  const targetPosition = cameraTargetPosition
    .copy(point)
    .addScaledVector(tangent, -distance)
    .add(cinematicOffset);
  targetPosition.y += height;

  camera.position.lerp(targetPosition, 1 - Math.exp(-delta * 3));

  const lookAhead = cameraLookAhead.copy(point).addScaledVector(tangent, 4.2);
  lookAhead.y = point.y + 0.72;
  if (!hasCameraLookTarget) {
    cameraLookTarget.copy(lookAhead);
    hasCameraLookTarget = true;
  } else {
    cameraLookTarget.lerp(lookAhead, 1 - Math.exp(-delta * 4.8));
  }
  camera.lookAt(cameraLookTarget);
}

function getCurvePointAt(curve, t, target) {
  if (typeof curve.getPointAtInto === 'function') {
    return curve.getPointAtInto(t, target);
  }

  return target.copy(curve.getPointAt(t));
}

function getCurveTangentAt(curve, t, target) {
  if (typeof curve.getTangentAtInto === 'function') {
    return curve.getTangentAtInto(t, target);
  }

  return target.copy(curve.getTangentAt(t)).normalize();
}

function getRealSurfaceY(_t, point) {
  return point?.y ?? 0;
}

function updateHud(t) {
  if (lapProgress) {
    lapProgress.style.transform = `scaleX(${THREE.MathUtils.clamp(t, 0, 1)})`;
  }

  const segment = getSegmentName(t);
  if (segmentName && segmentName.textContent !== segment) {
    segmentName.textContent = segment;
  }
}

function getSegmentName(t) {
  return getActiveRouteStop(t)?.label || 'Gaming Titles';
}

function updateScrollState() {
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const lapScrollDistance = maxScroll * REAL_LAP_SCROLL_PORTION;
  progress = THREE.MathUtils.clamp(window.scrollY / lapScrollDistance, 0, 0.995);
  updatePanels(progress);
}

function updatePanels(t) {
  const activeStop = getActiveRouteStop(t);
  const activeStage = activeStop?.stage || 'home';

  if (currentPanelStage !== activeStage) {
    document.body.dataset.stage = activeStage;
    panelElements.forEach((panel) => {
      panel.dataset.active = String(panel.dataset.panel === activeStage);
    });
    currentPanelStage = activeStage;
  }

  updateRouteNavigation(t, activeStage);
}

function updateRouteNavigation(t, activeStage) {
  const clampedProgress = THREE.MathUtils.clamp(t, 0, 0.995);

  routeNav?.style.setProperty('--nav-progress-percent', `${(clampedProgress * 100).toFixed(1)}%`);
  if (routeProgressValue) {
    routeProgressValue.textContent = `${Math.round(clampedProgress * 100)}%`;
  }

  routeButtons.forEach((button) => {
    const stopProgress = Number(button.dataset.routeProgress);
    const isActive = button.dataset.routeStage === activeStage;
    const isCompleted = Number.isFinite(stopProgress) && stopProgress < clampedProgress && !isActive;

    button.setAttribute('aria-current', String(isActive));
    button.dataset.routeState = isActive ? 'active' : isCompleted ? 'completed' : 'upcoming';
  });
}

function getRouteButtons() {
  return routeButtons;
}

function getRouteStops() {
  return cachedRouteStops;
}

function getActiveRouteStop(t) {
  const stops = getRouteStops();
  if (!stops.length) {
    return null;
  }

  const clampedProgress = THREE.MathUtils.clamp(t, 0, 0.995);
  return stops.reduce((active, stop) => (stop.progress <= clampedProgress + 0.005 ? stop : active), stops[0]);
}

function scrollToRaceProgress(targetProgress) {
  if (!Number.isFinite(targetProgress)) {
    return;
  }

  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const lapScrollDistance = maxScroll * REAL_LAP_SCROLL_PORTION;
  const targetY = THREE.MathUtils.clamp(targetProgress, 0, 0.995) * lapScrollDistance;

  window.scrollTo({
    top: targetY,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
}

function handleResize() {
  viewport = { width: window.innerWidth, height: window.innerHeight };
  renderer.setSize(viewport.width, viewport.height);
  renderer.setPixelRatio(getRenderPixelRatio());
  camera.aspect = viewport.width / viewport.height;
  camera.updateProjectionMatrix();
}

function getRenderPixelRatio() {
  return Math.min(window.devicePixelRatio || 1, MAX_RENDER_PIXEL_RATIO);
}

function handleVisibilityChange() {
  isPageVisible = !document.hidden;
  lastFrameTime = performance.now();
}

function handlePointerMove(event) {
  pointer.x = (event.clientX / viewport.width) * 2 - 1;
  pointer.y = -(event.clientY / viewport.height) * 2 + 1;
  updateGridReadout();
}

function updateGridReadout() {
  if (!ENABLE_DEVELOPMENT_GRID || !camera || !gridCell || !gridPosition || !getGridCellFromPosition) {
    return;
  }

  raycaster.setFromCamera(pointer, camera);
  if (!raycaster.ray.intersectPlane(pointerGroundPlane, pointerGroundPoint)) {
    return;
  }

  const { cell, x, z } = getGridCellFromPosition(pointerGroundPoint);
  gridCell.textContent = cell;
  gridPosition.textContent = `X ${x} / Z ${z}`;
}
