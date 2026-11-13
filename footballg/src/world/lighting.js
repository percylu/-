import * as THREE from 'three';

const TARGET = new THREE.Vector3(0, 0, 9);
const RIG = [
  { pos: [-40, 38, 46], color: 0xfff4e6, k: 1.55 },
  { pos: [40, 36, -18], color: 0xeef4ff, k: 0.95 },
  { pos: [42, 36, 50], color: 0xfff8f0, k: 0.75 },
  { pos: [-40, 36, -20], color: 0xeef4ff, k: 0.55 },
];

export function createLighting(gfx, quality) {
  const { scene, renderer } = gfx;
  const lights = [];
  RIG.forEach((r, i) => {
    const l = new THREE.DirectionalLight(r.color, 2.5 * r.k);
    l.position.set(...r.pos);
    l.target.position.copy(TARGET);
    scene.add(l);
    scene.add(l.target);
    if (i < quality.shadowLights) {
      l.castShadow = true;
      const size = i < 2 ? quality.shadowSize : Math.min(2048, quality.shadowSize);
      l.shadow.mapSize.set(size, size);
      const c = l.shadow.camera;
      c.left = -19;
      c.right = 19;
      c.top = 19;
      c.bottom = -19;
      c.near = 20;
      c.far = 120;
      l.shadow.bias = -0.0004;
      l.shadow.normalBias = 0.03;
      l.shadow.radius = 2.2;
    }
    lights.push(l);
  });
  const hemi = new THREE.HemisphereLight(0x8aa0c8, 0x16300f, 0.22);
  scene.add(hemi);

  scene.fog = new THREE.FogExp2(0x0a0f18, 0.0018);

  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;

  return {
    lights,
    // Shadows follow the area between the ball and the goal.
    focus(centerX, centerZ) {
      for (const [i, l] of lights.entries()) {
        const r = RIG[i];
        l.position.set(r.pos[0] + centerX, r.pos[1], r.pos[2] + centerZ - TARGET.z);
        l.target.position.set(centerX, 0, centerZ);
        l.target.updateMatrixWorld();
      }
    },
    // Bake the lit stadium into a prefiltered environment map (IBL + reflections).
    bakeEnvironment(hide = []) {
      const prevVis = hide.map((o) => o.visible);
      hide.forEach((o) => (o.visible = false));
      const prevEnv = scene.environment;
      scene.environment = null;
      const prevShadow = renderer.shadowMap.enabled;
      if (envRT) envRT.dispose();
      envRT = pmrem.fromScene(scene, 0, 0.1, 800, { size: quality.envSize, position: new THREE.Vector3(0, 1.7, 8) });
      renderer.shadowMap.enabled = prevShadow;
      scene.environment = envRT.texture;
      scene.environmentIntensity = 0.85;
      hide.forEach((o, i) => (o.visible = prevVis[i]));
      return prevEnv;
    },
  };
}
