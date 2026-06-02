import * as THREE from 'three';
import { CHICANE_START, SMOKE_PARTICLE_COUNT, TRACK_HEIGHT } from './constants.js';
import { getSpaElevation } from './track.jsx';
import { smoothPulse } from './trackFrame.js';

function getProceduralSurfaceY(t) {
  return TRACK_HEIGHT + getSpaElevation(t);
}

export function createTrackDetails({ scene, trackCurve, tireStacks, sparks, getSurfaceY = getProceduralSurfaceY }) {
  const stackGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.42, 16);
  const stackMaterial = new THREE.MeshStandardMaterial({ color: 0x090909, roughness: 0.85 });
  const sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xffc845, transparent: true, opacity: 0.9 });

  for (let i = 0; i < 30; i += 1) {
    const t = (i / 30 + 0.04) % 1;
    const point = trackCurve.getPointAt(t);
    const tangent = trackCurve.getTangentAt(t);
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const stack = new THREE.Mesh(stackGeometry, stackMaterial);
    stack.position.copy(point).add(normal.multiplyScalar(i % 2 === 0 ? 3.8 : -3.8));
    stack.position.y = getSurfaceY(t, point) + 0.36;
    stack.rotation.z = Math.PI / 2;
    stack.castShadow = true;
    tireStacks.push(stack);
    scene.add(stack);
  }

  for (let i = 0; i < 34; i += 1) {
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), sparkMaterial.clone());
    spark.visible = false;
    sparks.push(spark);
    scene.add(spark);
  }
}

export function createExhaustSmoke({ scene }) {
  const smokeTexture = createSmokeTexture();
  const particles = [];

  for (let i = 0; i < SMOKE_PARTICLE_COUNT; i += 1) {
    const particle = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: smokeTexture,
        color: 0xd9d6cc,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
      }),
    );
    particle.visible = false;
    particle.userData = {
      age: 0,
      life: 1,
      baseOpacity: 0.12,
      baseScale: 0.35,
      spin: 0,
      velocity: new THREE.Vector3(),
    };
    particles.push(particle);
    scene.add(particle);
  }

  return { particles, accumulator: 0, cursor: 0 };
}

export function emitExhaustSmoke({ smokeState, camera, carPoint, tangent, delta, chicaneEnergy }) {
  if (!smokeState?.particles.length) {
    return;
  }

  smokeState.accumulator += delta * (14 + chicaneEnergy * 7);

  while (smokeState.accumulator >= 1) {
    smokeState.accumulator -= 1;
    const particle = smokeState.particles[smokeState.cursor];
    smokeState.cursor = (smokeState.cursor + 1) % smokeState.particles.length;

    const back = camera.position.clone().sub(carPoint);
    back.y = 0;
    if (back.lengthSq() < 0.01) {
      back.copy(tangent).multiplyScalar(-1);
    }
    back.normalize();
    const normal = new THREE.Vector3(-back.z, 0, back.x).normalize();
    const side = Math.random() > 0.5 ? 1 : -1;

    particle.visible = true;
    particle.material.opacity = 0.22 + Math.random() * 0.08;
    particle.material.rotation = Math.random() * Math.PI;
    particle.position
      .copy(carPoint)
      .add(back.clone().multiplyScalar(2.05 + Math.random() * 0.3))
      .add(normal.multiplyScalar(side * (0.26 + Math.random() * 0.08)));
    particle.position.y = carPoint.y + 0.44 + Math.random() * 0.1;

    const baseScale = 0.42 + Math.random() * 0.2;
    particle.scale.setScalar(baseScale);
    particle.userData.age = 0;
    particle.userData.life = 0.95 + Math.random() * 0.6;
    particle.userData.baseOpacity = particle.material.opacity;
    particle.userData.baseScale = baseScale;
    particle.userData.spin = (Math.random() - 0.5) * 1.2;
    particle.userData.velocity
      .copy(back)
      .multiplyScalar(0.38 + Math.random() * 0.34)
      .add(new THREE.Vector3(0, 0.34 + Math.random() * 0.22, 0))
      .add(new THREE.Vector3((Math.random() - 0.5) * 0.22, 0, (Math.random() - 0.5) * 0.22));
  }
}

export function updateExhaustSmoke(smokeState, delta) {
  for (const particle of smokeState?.particles ?? []) {
    if (!particle.visible) {
      continue;
    }

    particle.userData.age += delta;
    const lifeRatio = particle.userData.age / particle.userData.life;

    if (lifeRatio >= 1) {
      particle.visible = false;
      particle.material.opacity = 0;
      continue;
    }

    particle.position.addScaledVector(particle.userData.velocity, delta);
    particle.userData.velocity.multiplyScalar(1 - delta * 0.45);
    particle.material.rotation += particle.userData.spin * delta;

    const fade = 1 - THREE.MathUtils.smoothstep(lifeRatio, 0.35, 1);
    const scale = particle.userData.baseScale * (1 + lifeRatio * 2.2);
    particle.scale.setScalar(scale);
    particle.material.opacity = particle.userData.baseOpacity * fade;
  }
}

export function updateSceneDetails({ curbs, tireStacks, raycaster, pointer, camera, delta }) {
  for (let i = 0; i < curbs.length; i += 1) {
    curbs[i].material.color.lerp(new THREE.Color(i % 2 === 0 ? 0xf4f2e8 : 0xd51e38), delta * 2);
  }

  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(tireStacks, false);
  tireStacks.forEach((stack) => stack.scale.lerp(new THREE.Vector3(1, 1, 1), delta * 5));
  if (intersections[0]) {
    intersections[0].object.scale.lerp(new THREE.Vector3(1.25, 1.25, 1.25), delta * 10);
  }
}

export function updateSparks({ sparks, carPoint, chicaneEnergy, surfaceY = TRACK_HEIGHT }) {
  for (let i = 0; i < sparks.length; i += 1) {
    const spark = sparks[i];
    const active = chicaneEnergy > 0.4 && i / sparks.length < chicaneEnergy;
    spark.visible = active;
    if (active) {
      const side = i % 2 === 0 ? -1 : 1;
      spark.position.copy(carPoint);
      spark.position.x += side * (0.8 + Math.random() * 0.25);
      spark.position.z -= 0.7 + Math.random() * 1.5;
      spark.position.y = surfaceY + 0.12 + Math.random() * 0.36;
      spark.material.opacity = 0.25 + Math.random() * 0.75;
    }
  }
}

function createSmokeTexture() {
  const size = 96;
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = size;
  textureCanvas.height = size;
  const context = textureCanvas.getContext('2d');
  const gradient = context.createRadialGradient(size * 0.5, size * 0.5, 3, size * 0.5, size * 0.5, size * 0.48);
  gradient.addColorStop(0, 'rgba(255, 255, 246, 0.42)');
  gradient.addColorStop(0.35, 'rgba(215, 218, 211, 0.2)');
  gradient.addColorStop(1, 'rgba(180, 184, 178, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function getChicaneEnergy(t) {
  return smoothPulse(t, CHICANE_START, 0.08);
}
