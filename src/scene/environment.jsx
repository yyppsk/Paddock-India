import * as THREE from 'three';
import { TRACK_HEIGHT } from './constants.js';
import { placeAtTrack } from './trackFrame.js';
import placements from './placements.json';

function getDefaultSurfaceY() {
  return TRACK_HEIGHT;
}

export function createCircuitEnvironment({ scene, trackCurve, getSurfaceY = getDefaultSurfaceY }) {
  const environment = new THREE.Group();
  environment.name = 'circuit-environment';
  scene.add(environment);
  const surfaceY = (t, offset = 0) => getSurfaceY((t + 1) % 1, trackCurve.getPointAt((t + 1) % 1)) + offset;

  for (const item of placements.trackRelative.raceGantry) {
    addRaceGantry(environment, trackCurve, item.t, surfaceY);
  }
  for (const item of placements.trackRelative.pitComplex) {
    addPitComplex(environment, trackCurve, item.t, item.side, item.lateral, surfaceY);
  }
  for (const item of placements.trackRelative.grandstands) {
    addGrandstand(environment, trackCurve, item.t, item.side, item.lateral, surfaceY);
  }
  for (const item of placements.trackRelative.vendorVillages) {
    addVendorVillage(environment, trackCurve, item.t, item.side, item.lateral, item.forward, surfaceY);
  }
  for (const item of placements.trackRelative.serviceVehicles) {
    addServiceVehicles(environment, trackCurve, item.t, item.side, item.lateral, surfaceY);
  }
  addMarshalPosts(environment, trackCurve, surfaceY);
  addTrackLights(environment, trackCurve, surfaceY);
  addSponsorBoards(environment, trackCurve, surfaceY);
}

function addRaceGantry(parent, trackCurve, t, surfaceY) {
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xd7ded9, roughness: 0.62, metalness: 0.22 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x11171c, roughness: 0.72, metalness: 0.12 });
  const lightMaterials = [0xff314f, 0xffce56, 0x50f28e].map(
    (color) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82 }),
  );

  const gantry = new THREE.Group();
  gantry.name = 'start-gantry';
  placeAtTrack(trackCurve, gantry, t, 0, 0, { y: surfaceY(t), rotationMode: 'track' });

  const postGeometry = new THREE.BoxGeometry(0.24, 3.1, 0.24);
  const crossGeometry = new THREE.BoxGeometry(10.8, 0.34, 0.38);
  const boardGeometry = new THREE.BoxGeometry(8.2, 1.1, 0.22);
  const lampGeometry = new THREE.SphereGeometry(0.12, 10, 8);

  for (const x of [-5.2, 5.2]) {
    const post = new THREE.Mesh(postGeometry, frameMaterial);
    post.position.set(x, 1.55, 0);
    post.castShadow = true;
    gantry.add(post);
  }

  const crossbar = new THREE.Mesh(crossGeometry, frameMaterial);
  crossbar.position.set(0, 3.05, 0);
  crossbar.castShadow = true;
  gantry.add(crossbar);

  const board = new THREE.Mesh(boardGeometry, darkMaterial);
  board.position.set(0, 2.48, -0.08);
  board.castShadow = true;
  gantry.add(board);

  for (let i = 0; i < 9; i += 1) {
    const lamp = new THREE.Mesh(lampGeometry, lightMaterials[i % lightMaterials.length]);
    lamp.position.set(-3.2 + i * 0.8, 2.5, -0.22);
    gantry.add(lamp);
  }

  parent.add(gantry);
}

function addPitComplex(parent, trackCurve, t, side, lateral, surfaceY) {
  const group = new THREE.Group();
  group.name = 'pit-garage-row';
  placeAtTrack(trackCurve, group, t, side, lateral, { y: surfaceY(t, -0.05), rotationMode: 'side' });

  const padMaterial = new THREE.MeshStandardMaterial({ color: 0x25313a, roughness: 0.86, metalness: 0.02 });
  const garageMaterial = new THREE.MeshStandardMaterial({ color: 0xced4d2, roughness: 0.74, metalness: 0.08 });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x9ba6a9, roughness: 0.68, metalness: 0.12 });
  const doorMaterials = [0xd83b4c, 0x2f73db, 0xf1c84c, 0x2fbf8d].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.04 }),
  );

  const pad = new THREE.Mesh(new THREE.BoxGeometry(19, 0.08, 7.2), padMaterial);
  pad.position.set(0, 0, 1.8);
  pad.receiveShadow = true;
  group.add(pad);

  for (let i = 0; i < 6; i += 1) {
    const x = -7.5 + i * 3;
    const bay = new THREE.Mesh(new THREE.BoxGeometry(2.55, 1.42, 2.2), garageMaterial);
    bay.position.set(x, 0.75, 1.7);
    bay.castShadow = true;
    bay.receiveShadow = true;
    group.add(bay);

    const door = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.78, 0.08), doorMaterials[i % doorMaterials.length]);
    door.position.set(x, 0.58, 0.56);
    door.castShadow = true;
    group.add(door);
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(19.4, 0.22, 2.8), roofMaterial);
  roof.position.set(0, 1.58, 1.45);
  roof.castShadow = true;
  group.add(roof);

  parent.add(group);
}

function addGrandstand(parent, trackCurve, t, side, lateral, surfaceY) {
  const group = new THREE.Group();
  group.name = 'trackside-grandstand';
  placeAtTrack(trackCurve, group, t, side, lateral, { y: surfaceY(t, -0.05), rotationMode: 'side' });

  const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x343f46, roughness: 0.82, metalness: 0.04 });
  const benchMaterial = new THREE.MeshStandardMaterial({ color: 0xb9c0bd, roughness: 0.72, metalness: 0.1 });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xe6ebe6, roughness: 0.58, metalness: 0.12 });
  const crowdMaterials = [0xf1c94b, 0xe85a5a, 0x6ea6ef, 0xf6f0de, 0x5cc48a].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.86 }),
  );

  const pad = new THREE.Mesh(new THREE.BoxGeometry(14, 0.08, 5.4), baseMaterial);
  pad.position.set(0, 0, 1.1);
  pad.receiveShadow = true;
  group.add(pad);

  for (let row = 0; row < 5; row += 1) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.22, 0.48), benchMaterial);
    bench.position.set(0, 0.22 + row * 0.23, 0.1 + row * 0.68);
    bench.castShadow = true;
    bench.receiveShadow = true;
    group.add(bench);
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(14.4, 0.18, 3.2), roofMaterial);
  roof.position.set(0, 2.35, 2.0);
  roof.castShadow = true;
  group.add(roof);

  const postGeometry = new THREE.BoxGeometry(0.14, 2.2, 0.14);
  for (const x of [-6.3, 6.3]) {
    for (const z of [0.35, 3.35]) {
      const post = new THREE.Mesh(postGeometry, roofMaterial);
      post.position.set(x, 1.12, z);
      post.castShadow = true;
      group.add(post);
    }
  }

  for (let materialIndex = 0; materialIndex < crowdMaterials.length; materialIndex += 1) {
    const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), crowdMaterials[materialIndex], 10);
    const matrix = new THREE.Matrix4();

    for (let i = 0; i < 10; i += 1) {
      const row = (i + materialIndex) % 5;
      const x = -5.7 + ((i * 1.37 + materialIndex * 0.7) % 11.4);
      const y = 0.48 + row * 0.23;
      const z = 0.02 + row * 0.68;
      matrix.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(i, matrix);
    }

    mesh.castShadow = true;
    group.add(mesh);
  }

  parent.add(group);
}

function addVendorVillage(parent, trackCurve, t, side, lateral, forward = -1.6, surfaceY) {
  const group = new THREE.Group();
  group.name = 'vendor-village';
  placeAtTrack(trackCurve, group, t, side, lateral, {
    y: surfaceY(t, -0.045),
    rotationMode: 'side',
    forward,
  });

  const padMaterial = new THREE.MeshStandardMaterial({ color: 0x2b3532, roughness: 0.88 });
  const counterMaterial = new THREE.MeshStandardMaterial({ color: 0x3d4850, roughness: 0.78 });
  const canopyMaterials = [0xf2cb50, 0xdf4c62, 0x55b88d].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.02 }),
  );
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0xe5e8df, roughness: 0.6, metalness: 0.08 });

  const pad = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.07, 3.25), padMaterial);
  pad.position.set(0, 0, 0.58);
  pad.receiveShadow = true;
  group.add(pad);

  for (let i = 0; i < 3; i += 1) {
    const tent = createEventTent({
      canopyMaterial: canopyMaterials[i % canopyMaterials.length],
      poleMaterial,
      counterMaterial,
    });
    tent.position.set(-3.65 + i * 3.65, 0, 0.6 + (i % 2) * 0.34);
    tent.rotation.y = (i - 1) * 0.08;
    group.add(tent);
  }

  parent.add(group);
}

function createEventTent({ canopyMaterial, poleMaterial, counterMaterial }) {
  const tent = new THREE.Group();
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.72, 4), canopyMaterial);
  roof.position.y = 1.46;
  roof.rotation.y = Math.PI * 0.25;
  roof.castShadow = true;
  tent.add(roof);

  const valanceGeometries = [
    [new THREE.BoxGeometry(2.25, 0.16, 0.12), 0, 1.11, -0.88],
    [new THREE.BoxGeometry(2.25, 0.16, 0.12), 0, 1.11, 0.88],
    [new THREE.BoxGeometry(0.12, 0.16, 2.25), -0.88, 1.11, 0],
    [new THREE.BoxGeometry(0.12, 0.16, 2.25), 0.88, 1.11, 0],
  ];

  for (const [geometry, x, y, z] of valanceGeometries) {
    const valance = new THREE.Mesh(geometry, canopyMaterial);
    valance.position.set(x, y, z);
    valance.castShadow = true;
    tent.add(valance);
  }

  for (const x of [-0.88, 0.88]) {
    for (const z of [-0.88, 0.88]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.14, 6), poleMaterial);
      pole.position.set(x, 0.57, z);
      pole.castShadow = true;
      tent.add(pole);
    }
  }

  const counter = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.42, 0.5), counterMaterial);
  counter.position.set(0, 0.24, 0.34);
  counter.castShadow = true;
  tent.add(counter);

  return tent;
}

function addServiceVehicles(parent, trackCurve, t, side, lateral, surfaceY) {
  const group = new THREE.Group();
  group.name = 'paddock-service-vehicles';
  placeAtTrack(trackCurve, group, t, side, lateral, { y: surfaceY(t), rotationMode: 'side' });

  const bodyMaterials = [0xf5f0d7, 0x2d7fd6].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.74, metalness: 0.04 }),
  );
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x101315, roughness: 0.82 });

  for (let i = 0; i < 2; i += 1) {
    const vehicle = new THREE.Group();
    vehicle.position.set(-2.8 + i * 5.4, 0, 1 + i * 0.8);
    vehicle.rotation.y = i === 0 ? 0.18 : -0.35;

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.72, 1.2), bodyMaterials[i]);
    body.position.y = 0.45;
    body.castShadow = true;
    vehicle.add(body);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.62, 0.95), bodyMaterials[i]);
    cabin.position.set(0.38, 0.98, -0.02);
    cabin.castShadow = true;
    vehicle.add(cabin);

    for (const x of [-0.82, 0.82]) {
      for (const z of [-0.52, 0.52]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.13, 10), darkMaterial);
        wheel.position.set(x, 0.16, z);
        wheel.rotation.z = Math.PI / 2;
        wheel.castShadow = true;
        vehicle.add(wheel);
      }
    }

    group.add(vehicle);
  }

  parent.add(group);
}

function addMarshalPosts(parent, trackCurve, surfaceY) {
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0xe6e2d5, roughness: 0.62, metalness: 0.08 });
  const platformMaterial = new THREE.MeshStandardMaterial({ color: 0x39444a, roughness: 0.8 });
  const flagMaterials = [0xffce56, 0x55dd8a, 0xe14f62].map(
    (color) => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
  );

  placements.trackRelative.marshalPosts.forEach(({ t, side, lateral }, index) => {
    const post = new THREE.Group();
    placeAtTrack(trackCurve, post, t, side, lateral, { y: surfaceY(t), rotationMode: 'side' });

    const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.9), platformMaterial);
    base.position.y = 0.09;
    base.castShadow = true;
    post.add(base);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.8, 8), poleMaterial);
    pole.position.set(-0.24, 0.94, 0);
    pole.castShadow = true;
    post.add(pole);

    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.38), flagMaterials[index % flagMaterials.length]);
    flag.position.set(0.12, 1.48, 0.03);
    flag.rotation.y = Math.PI * 0.5;
    post.add(flag);

    parent.add(post);
  });
}

function addTrackLights(parent, trackCurve, surfaceY) {
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x667178, roughness: 0.56, metalness: 0.24 });
  const lampMaterial = new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0.76 });

  for (let i = 0; i < 8; i += 1) {
    const side = i % 2 === 0 ? 1 : -1;
    const light = new THREE.Group();
    const t = (i / 8 + 0.06) % 1;
    placeAtTrack(trackCurve, light, t, side, 7.3, { y: surfaceY(t), rotationMode: 'side' });

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 3.4, 8), poleMaterial);
    pole.position.y = 1.7;
    pole.castShadow = true;
    light.add(pole);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 1.4), poleMaterial);
    arm.position.set(0, 3.18, -0.52);
    arm.castShadow = true;
    light.add(arm);

    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), lampMaterial);
    lamp.position.set(0, 3.14, -1.12);
    light.add(lamp);

    parent.add(light);
  }
}

function addSponsorBoards(parent, trackCurve, surfaceY) {
  const boardMaterials = [0xf4f1e8, 0xffce56, 0xe5485f, 0x58a2f0].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.04 }),
  );
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x20272b, roughness: 0.8, metalness: 0.06 });

  for (let i = 0; i < 18; i += 1) {
    const side = i % 2 === 0 ? 1 : -1;
    const board = new THREE.Group();
    const t = (i / 18 + 0.025) % 1;
    placeAtTrack(trackCurve, board, t, side, 4.9 + (i % 3) * 0.35, {
      y: surfaceY(t, 0.18),
      rotationMode: 'side',
    });

    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.72, 0.08), frameMaterial);
    frame.castShadow = true;
    board.add(frame);

    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.5, 0.09), boardMaterials[i % boardMaterials.length]);
    panel.position.z = -0.035;
    panel.castShadow = true;
    board.add(panel);

    parent.add(board);
  }
}
