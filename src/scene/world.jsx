import * as THREE from 'three';

export function addLighting(scene) {
  const hemisphere = new THREE.HemisphereLight(0xbcd7ff, 0x142013, 1.65);
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xffe5c2, 3.5);
  sun.position.set(-28, 48, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  scene.add(sun);

  const trackGlow = new THREE.PointLight(0xff365e, 45, 52, 2.2);
  trackGlow.position.set(-11, 8, 22);
  scene.add(trackGlow);

  return { hemisphere, sun, trackGlow };
}

export function addTerrain(scene) {
  const groundGeometry = new THREE.PlaneGeometry(280, 280, 120, 120);
  const positions = groundGeometry.attributes.position;

  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const height =
      -0.035 +
      Math.sin(x * 0.045) * 0.014 +
      Math.cos(y * 0.035) * 0.012 +
      Math.sin((x + y) * 0.018) * 0.01;
    positions.setZ(i, height);
  }

  groundGeometry.rotateX(-Math.PI / 2);
  groundGeometry.computeVertexNormals();

  const ground = new THREE.Mesh(
    groundGeometry,
    new THREE.MeshStandardMaterial({
      color: 0x23332a,
      roughness: 0.92,
      metalness: 0.02,
    }),
  );
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(240, 48, 0x3f5346, 0x2e3a33);
  grid.position.y = -0.055;
  grid.material.opacity = 0.12;
  grid.material.transparent = true;
  scene.add(grid);

  return { ground, grid };
}

export const ENVIRONMENT_PRESETS = {
  day: {
    clear: 0x9fc5dd,
    fog: 0xb4d1e3,
    fogDensity: 0.0075,
    hemisphereSky: 0xd8f0ff,
    hemisphereGround: 0x5f6f58,
    hemisphereIntensity: 2.15,
    sunColor: 0xfff1d2,
    sunIntensity: 4.25,
    trackGlowIntensity: 8,
    streetLightIntensity: 0,
    streetLightSpotIntensity: 0,
    streetLightGlowOpacity: 0,
    streetLightPoolOpacity: 0,
    ground: 0x405643,
    gridMajor: 0x7f9a83,
    gridMinor: 0x526553,
  },
  night: {
    clear: 0x0b0f13,
    fog: 0x0b0f13,
    fogDensity: 0.018,
    hemisphereSky: 0xbcd7ff,
    hemisphereGround: 0x142013,
    hemisphereIntensity: 1.65,
    sunColor: 0xffe5c2,
    sunIntensity: 3.5,
    trackGlowIntensity: 45,
    streetLightIntensity: 14,
    streetLightSpotIntensity: 18,
    streetLightGlowOpacity: 0.62,
    streetLightPoolOpacity: 0.34,
    ground: 0x23332a,
    gridMajor: 0x3f5346,
    gridMinor: 0x2e3a33,
  },
};

export function applyEnvironmentPreset({ mode, scene, renderer, lighting, terrain }) {
  const preset = ENVIRONMENT_PRESETS[mode] ?? ENVIRONMENT_PRESETS.night;

  renderer.setClearColor(preset.clear, 1);
  scene.fog = new THREE.FogExp2(preset.fog, preset.fogDensity);

  lighting.hemisphere.color.setHex(preset.hemisphereSky);
  lighting.hemisphere.groundColor.setHex(preset.hemisphereGround);
  lighting.hemisphere.intensity = preset.hemisphereIntensity;
  lighting.sun.color.setHex(preset.sunColor);
  lighting.sun.intensity = preset.sunIntensity;
  lighting.trackGlow.intensity = preset.trackGlowIntensity;
  updateStreetLights(lighting.streetLights, preset);

  terrain.ground.material.color.setHex(preset.ground);
  setMaterialColor(terrain.grid.material, [preset.gridMajor, preset.gridMinor]);
}

function updateStreetLights(streetLights, preset) {
  if (!streetLights?.group) {
    return;
  }

  const lightsAreVisible = preset.streetLightIntensity > 0 || preset.streetLightGlowOpacity > 0;
  streetLights.group.visible = lightsAreVisible;

  for (const light of streetLights.pointLights ?? []) {
    light.intensity = preset.streetLightIntensity;
  }

  for (const light of streetLights.spotLights ?? []) {
    light.intensity = preset.streetLightSpotIntensity;
  }

  for (const glow of streetLights.glowSprites ?? []) {
    glow.material.opacity = preset.streetLightGlowOpacity;
  }

  for (const pool of streetLights.lightPools ?? []) {
    pool.material.opacity = preset.streetLightPoolOpacity;
  }
}

function setMaterialColor(material, colors) {
  const materials = Array.isArray(material) ? material : [material];

  for (const [index, entry] of materials.entries()) {
    entry.color?.setHex(colors[index] ?? colors[0]);
    entry.needsUpdate = true;
  }
}

export function addBackdrop(scene) {
  const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x17251b, roughness: 0.88 });
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x3d2d22, roughness: 0.8 });
  const coneGeometry = new THREE.ConeGeometry(1.6, 8, 7);
  const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.26, 2.2, 6);

  for (let i = 0; i < 140; i += 1) {
    const angle = (i / 140) * Math.PI * 2;
    const radius = 62 + Math.sin(i * 1.91) * 16 + Math.random() * 20;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.set(x, 1, z);
    trunk.castShadow = true;
    scene.add(trunk);

    const tree = new THREE.Mesh(coneGeometry, treeMaterial);
    tree.position.set(x, 5.2, z);
    tree.scale.setScalar(0.8 + Math.random() * 0.9);
    tree.castShadow = true;
    scene.add(tree);
  }
}
