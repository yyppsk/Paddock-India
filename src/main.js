import './styles.css';
import * as THREE from 'three';
import { CONTACT_START, SOCIAL_START } from './scene/constants.js';
import { loadRaceCarModel, updateCompanionCars, updateRaceCar } from './scene/cars.jsx';
import {
  createExhaustSmoke,
  createTrackDetails,
  updateExhaustSmoke,
  updateSceneDetails,
} from './scene/effects.jsx';
import { createGroundGrid, getGridCellFromPosition } from './scene/groundGrid.jsx';
import { loadRealTrackModel } from './scene/realTrack.jsx';
import { addLighting, addTerrain, applyEnvironmentPreset } from './scene/world.jsx';

const ACTIVE_TRACK_VERSION = 'real-model';
const REAL_PROGRESS_DAMPING = 1.2;
const REAL_MAX_PROGRESS_PER_SECOND = 0.055;
const REAL_LAP_SCROLL_PORTION = 0.92;
const DEFAULT_ENVIRONMENT_MODE = 'night';
const ENVIRONMENT_MODES = new Set(['day', 'night']);

const canvas = document.querySelector('#race-canvas');
const segmentName = document.querySelector('#segment-name');
const lapProgress = document.querySelector('#lap-progress');
const gridCell = document.querySelector('#grid-cell');
const gridPosition = document.querySelector('#grid-position');
const trackVersionLabel = document.querySelector('#track-version-label');
const trackVersionDetail = document.querySelector('#track-version-detail');
const trackNameElement = document.querySelector('#track-name');
const trackCredit = document.querySelector('#track-credit');
const environmentButtons = document.querySelectorAll('[data-environment-mode]');

let renderer;
let scene;
let camera;
let lighting;
let terrain;
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
let viewport = { width: window.innerWidth, height: window.innerHeight };
let lastFrameTime = performance.now();
const cameraLookTarget = new THREE.Vector3();
let hasCameraLookTarget = false;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(-4, -4);
const pointerGroundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const pointerGroundPoint = new THREE.Vector3();

init();

async function init() {
  document.body.dataset.trackVersion = ACTIVE_TRACK_VERSION;
  document.body.dataset.environment = environmentMode;
  updateTrackVersionStatus('loading');
  updateEnvironmentControls();

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
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
  applyEnvironmentMode(environmentMode);
  scene.add(createGroundGrid());

  const realTrack = await loadRealTrackModel({ scene, version: ACTIVE_TRACK_VERSION });
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

  window.addEventListener('resize', handleResize);
  window.addEventListener('scroll', updateScrollState, { passive: true });
  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  environmentButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setEnvironmentMode(button.dataset.environmentMode);
    });
  });

  requestAnimationFrame(animate);
}

function getInitialEnvironmentMode() {
  const savedMode = window.localStorage?.getItem('asseto-environment-mode');
  return ENVIRONMENT_MODES.has(savedMode) ? savedMode : DEFAULT_ENVIRONMENT_MODE;
}

function setEnvironmentMode(mode) {
  if (!ENVIRONMENT_MODES.has(mode) || mode === environmentMode) {
    return;
  }

  environmentMode = mode;
  window.localStorage?.setItem('asseto-environment-mode', environmentMode);
  applyEnvironmentMode(environmentMode);
  updateEnvironmentControls();
}

function applyEnvironmentMode(mode) {
  if (!scene || !renderer || !lighting || !terrain) {
    return;
  }

  document.body.dataset.environment = mode;
  applyEnvironmentPreset({ mode, scene, renderer, lighting, terrain });
}

function updateEnvironmentControls() {
  environmentButtons.forEach((button) => {
    const isActive = button.dataset.environmentMode === environmentMode;
    button.setAttribute('aria-pressed', String(isActive));
  });
}

// TODO: Add weather preset controls here once the visual targets are defined.

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

function animate() {
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
    updateCamera(easedProgress, delta);
    updateHud(easedProgress);
  }

  updateSceneDetails({ curbs, tireStacks, raycaster, pointer, camera, delta });
  updateExhaustSmoke(smokeState, delta);
  updateDebugState();

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
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

  window.__assetoDebug = {
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
          pointLights: lighting.streetLights.pointLights.length,
        }
      : null,
  };
}

function updateCamera(t, delta) {
  const point = trackCurve.getPointAt(t % 1);
  point.y = getSurfaceY(t % 1, point);
  const tangent = trackCurve.getTangentAt(t % 1).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  const sideDrift = viewport.width < 720 ? 3.4 : 5.2;
  const cinematicOffset = normal.multiplyScalar(Math.sin(t * Math.PI * 2.3) * sideDrift);
  const height = viewport.width < 720 ? 17 : 11;
  const distance = viewport.width < 720 ? 24 : 21.5;

  const targetPosition = point
    .clone()
    .sub(tangent.clone().multiplyScalar(distance))
    .add(cinematicOffset)
    .add(new THREE.Vector3(0, height, 0));

  camera.position.lerp(targetPosition, 1 - Math.exp(-delta * 3));

  const lookAhead = point.clone().add(tangent.multiplyScalar(4.2));
  lookAhead.y = point.y + 0.72;
  if (!hasCameraLookTarget) {
    cameraLookTarget.copy(lookAhead);
    hasCameraLookTarget = true;
  } else {
    cameraLookTarget.lerp(lookAhead, 1 - Math.exp(-delta * 4.8));
  }
  camera.lookAt(cameraLookTarget);
}

function getRealSurfaceY(_t, point) {
  return point?.y ?? 0;
}

function updateHud(t) {
  lapProgress.style.transform = `scaleX(${THREE.MathUtils.clamp(t, 0, 1)})`;

  const segment = getSegmentName(t);
  if (segmentName.textContent !== segment) {
    segmentName.textContent = segment;
  }
}

function getSegmentName(t) {
  if (t >= CONTACT_START) return 'Route Exit';
  if (t >= SOCIAL_START) return 'Social Sector';
  if (t >= 0.35) return 'Model Sector';
  return 'Start Grid';
}

function updateScrollState() {
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const lapScrollDistance = maxScroll * REAL_LAP_SCROLL_PORTION;
  progress = THREE.MathUtils.clamp(window.scrollY / lapScrollDistance, 0, 0.995);
  updatePanels(progress);
}

function updatePanels(t) {
  document.body.dataset.stage = t >= CONTACT_START ? 'contact' : t >= SOCIAL_START ? 'social' : t >= 0.32 ? 'pace' : 'intro';
}

function handleResize() {
  viewport = { width: window.innerWidth, height: window.innerHeight };
  renderer.setSize(viewport.width, viewport.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  camera.aspect = viewport.width / viewport.height;
  camera.updateProjectionMatrix();
}

function handlePointerMove(event) {
  pointer.x = (event.clientX / viewport.width) * 2 - 1;
  pointer.y = -(event.clientY / viewport.height) * 2 + 1;
  updateGridReadout();
}

function updateGridReadout() {
  if (!camera || !gridCell || !gridPosition) {
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
