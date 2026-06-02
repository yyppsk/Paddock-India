import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CAR_RIDE_HEIGHT, CHICANE_START, COMPANION_CAR_CONFIGS, TRACK_HEIGHT } from './constants.js';
import { emitExhaustSmoke, updateSparks } from './effects.jsx';
import { getSpaElevation } from './track.jsx';
import { smoothPulse } from './trackFrame.js';

function getProceduralSurfaceY(t) {
  return TRACK_HEIGHT + getSpaElevation(t);
}

export function loadRaceCarModel({ car, scene, companionCars }) {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('/draco/');

  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  loader.load(
    '/models/ferrari.glb',
    (gltf) => {
      const model = gltf.scene;
      prepareLoadedCarModel(model);
      fitRaceCarModel(model);
      model.rotation.y = Math.PI;
      model.name = 'ferrari-glb';
      car.add(model);
      createCompanionCars({ scene, companionCars, sourceModel: model });
    },
    undefined,
    (error) => {
      console.warn('Race car GLB could not be loaded.', error);
    },
  );
}

export function updateRaceCar({
  trackCurve,
  car,
  t,
  delta,
  progress,
  easedProgress,
  sparks,
  camera,
  smokeState,
  getSurfaceY = getProceduralSurfaceY,
}) {
  if (!trackCurve || !car) {
    return;
  }

  const trackT = t % 1;
  const carPoint = trackCurve.getPointAt(trackT);
  const tangent = trackCurve.getTangentAt(trackT).normalize();
  const chicaneEnergy = smoothPulse(t, CHICANE_START, 0.08);
  const surfaceY = getSurfaceY(trackT, carPoint);

  car.position.copy(carPoint);
  car.position.y = surfaceY + CAR_RIDE_HEIGHT + Math.sin(t * Math.PI * 16) * 0.025 + chicaneEnergy * 0.1;
  car.rotation.y = Math.atan2(tangent.x, tangent.z);
  car.rotation.z = THREE.MathUtils.damp(car.rotation.z, Math.sin(t * Math.PI * 22) * 0.04 * chicaneEnergy, 6, delta);
  car.rotation.x = THREE.MathUtils.damp(car.rotation.x, -0.04 - chicaneEnergy * 0.06, 5, delta);

  const speedGlow = THREE.MathUtils.clamp((progress - easedProgress) * 26, 0, 1);
  car.scale.setScalar(1 + speedGlow * 0.05);

  updateSparks({ sparks, carPoint: car.position, chicaneEnergy, surfaceY });
  emitExhaustSmoke({ smokeState, camera, carPoint: car.position, tangent, delta, chicaneEnergy });
}

export function updateCompanionCars({
  trackCurve,
  companionCars,
  t,
  delta,
  getSurfaceY = getProceduralSurfaceY,
  spacingScale = 1,
}) {
  if (!trackCurve || !companionCars.length) {
    return;
  }

  companionCars.forEach(({ group, config }, index) => {
    const carT = (t + config.offset * spacingScale + 1) % 1;
    const point = trackCurve.getPointAt(carT);
    const tangent = trackCurve.getTangentAt(carT).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const chicaneEnergy = smoothPulse(carT, CHICANE_START, 0.09);
    const surfaceY = getSurfaceY(carT, point);
    const laneDrift = Math.sin((t + index * 0.21) * Math.PI * 2) * 0.12;
    const targetPosition = point.clone().add(normal.multiplyScalar(config.laneOffset + laneDrift));

    targetPosition.y =
      surfaceY + CAR_RIDE_HEIGHT + Math.sin((t + index * 0.13) * Math.PI * 14) * 0.018 + chicaneEnergy * 0.045;
    group.position.lerp(targetPosition, 1 - Math.exp(-delta * 8));
    group.rotation.y = Math.atan2(tangent.x, tangent.z);
    group.rotation.z = THREE.MathUtils.damp(
      group.rotation.z,
      Math.sin((carT + index * 0.17) * Math.PI * 18) * 0.022 * chicaneEnergy,
      7,
      delta,
    );
    group.rotation.x = THREE.MathUtils.damp(group.rotation.x, -0.025 - chicaneEnergy * 0.035, 6, delta);
  });
}

function prepareLoadedCarModel(model) {
  model.traverse((child) => {
    if (!child.isMesh) {
      return;
    }

    child.castShadow = true;
    child.receiveShadow = true;
    if (child.material) {
      child.material.envMapIntensity = 0.6;
      child.material.needsUpdate = true;
    }
  });
}

function createCompanionCars({ scene, companionCars, sourceModel }) {
  if (companionCars.length) {
    return;
  }

  COMPANION_CAR_CONFIGS.forEach((config) => {
    const group = new THREE.Group();
    group.name = config.name;
    group.scale.setScalar(config.scale);

    const model = sourceModel.clone(true);
    tintCompanionCar(model, config);
    group.add(model);
    addCompanionCarKit(group, config);

    companionCars.push({ group, config });
    scene.add(group);
  });
}

function tintCompanionCar(model, config) {
  model.traverse((child) => {
    if (!child.isMesh) {
      return;
    }

    child.castShadow = true;
    child.receiveShadow = true;

    if (Array.isArray(child.material)) {
      child.material = child.material.map((material) => cloneTintedCarMaterial(material, config));
    } else if (child.material) {
      child.material = cloneTintedCarMaterial(child.material, config);
    }
  });
}

function cloneTintedCarMaterial(material, config) {
  const clone = material.clone();
  const name = `${material.name ?? ''}`.toLowerCase();
  const color = clone.color;
  const redPaint =
    color && color.r > 0.38 && color.g < 0.24 && color.b < 0.22 && !name.includes('tail') && !name.includes('light');
  const paintMaterial = name.includes('body') || name.includes('paint') || name.includes('rosso') || redPaint;
  const accentMaterial = name.includes('stripe') || name.includes('caliper') || name.includes('rim');

  if (paintMaterial && color) {
    clone.color.setHex(config.color);
    clone.roughness = Math.min(clone.roughness ?? 0.55, 0.5);
    clone.metalness = Math.max(clone.metalness ?? 0.1, 0.12);
  } else if (accentMaterial && color) {
    clone.color.setHex(config.accent);
  }

  clone.envMapIntensity = 0.52;
  clone.needsUpdate = true;
  return clone;
}

function addCompanionCarKit(group, config) {
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: config.accent,
    roughness: 0.42,
    metalness: 0.1,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x121619,
    roughness: 0.7,
    metalness: 0.08,
  });

  if (config.spoiler) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.24), accentMaterial);
    wing.position.set(0, 1.08, -1.82);
    wing.castShadow = true;
    group.add(wing);

    for (const x of [-0.64, 0.64]) {
      const support = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), darkMaterial);
      support.position.set(x, 0.82, -1.72);
      support.castShadow = true;
      group.add(support);
    }
  }

  if (config.fin) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.62, 1.35), accentMaterial);
    fin.position.set(0, 1.2, -0.08);
    fin.castShadow = true;
    group.add(fin);

    const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.08, 0.34), darkMaterial);
    splitter.position.set(0, 0.12, 2.18);
    splitter.castShadow = true;
    group.add(splitter);
  }

  if (config.roofStripe) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 2.28), accentMaterial);
    stripe.position.set(0, 1.08, 0);
    stripe.castShadow = true;
    group.add(stripe);
  }
}

function fitRaceCarModel(model) {
  const initialBox = new THREE.Box3().setFromObject(model);
  const initialSize = new THREE.Vector3();
  initialBox.getSize(initialSize);
  model.scale.setScalar(4.6 / Math.max(initialSize.x, initialSize.z));

  const fittedBox = new THREE.Box3().setFromObject(model);
  const fittedCenter = new THREE.Vector3();
  fittedBox.getCenter(fittedCenter);
  model.position.x -= fittedCenter.x;
  model.position.z -= fittedCenter.z;
  model.position.y -= fittedBox.min.y;
}
