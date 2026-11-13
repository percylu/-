import * as THREE from 'three';
import { makeNoiseTexture, makeGrassDetail } from './textures.js';
import { mulberry32 } from '../config.js';

// Shared GLSL: analytic pitch markings + mowing pattern. Evaluated per fragment
// on the ground plane and per blade root for the 3D grass.
export const PITCH_GLSL = /* glsl */ `
uniform sampler2D uNoise;
uniform sampler2D uDetail;

float fgBoxOutline(vec2 p, vec2 c, vec2 h) {
  vec2 d = abs(p - c) - h;
  return abs(length(max(d, 0.0)) + min(max(d.x, d.y), 0.0));
}

// Distance (m) to the centre of the nearest painted line.
float fgLineDist(vec2 p) {
  float zz = min(p.y, 105.0 - p.y);
  vec2 q = vec2(abs(p.x), zz);
  float d = fgBoxOutline(p, vec2(0.0, 52.5), vec2(34.0, 52.5));
  d = min(d, max(abs(p.y - 52.5), abs(p.x) - 34.0));
  d = min(d, abs(length(p - vec2(0.0, 52.5)) - 9.15));
  d = min(d, fgBoxOutline(q, vec2(0.0, 8.25), vec2(20.16, 8.25)));
  d = min(d, fgBoxOutline(q, vec2(0.0, 2.75), vec2(9.16, 2.75)));
  if (zz > 16.5) d = min(d, abs(length(q - vec2(0.0, 11.0)) - 9.15));
  if (q.x < 34.0 && zz > 0.0) d = min(d, abs(length(q - vec2(34.0, 0.0)) - 1.0));
  // spots (filled discs expressed as a line distance)
  d = min(d, max(0.0, length(q - vec2(0.0, 11.0)) - 0.05));
  d = min(d, max(0.0, length(p - vec2(0.0, 52.5)) - 0.07));
  return d;
}

// Returns albedo in rgb and "is grass" in a.
vec4 fgPitchColor(vec2 p, vec3 camPos, float aa) {
  vec4 n1 = texture2D(uNoise, p / 37.0);
  vec4 n2 = texture2D(uNoise, p / 9.3 + 0.37);
  // mowing bands: lean direction alternates, brightness depends on view direction
  float soft = max(aa, 0.12);
  float fz = fract(p.y / 11.0);
  float bandZ = smoothstep(0.5 - soft / 11.0, 0.5 + soft / 11.0, fz) - smoothstep(1.0 - soft / 11.0, 1.0, fz) + (1.0 - smoothstep(0.0, soft / 11.0, fz));
  float fx = fract((p.x + 34.0) / 11.3333);
  float bandX = smoothstep(0.5 - soft / 11.3, 0.5 + soft / 11.3, fx) - smoothstep(1.0 - soft / 11.3, 1.0, fx) + (1.0 - smoothstep(0.0, soft / 11.3, fx));
  vec2 toP = normalize(p - camPos.xz + vec2(1e-4));
  float lean = (bandZ * 2.0 - 1.0) * (0.5 + 0.5 * abs(toP.y)) * sign(toP.y + 1e-4);
  float cross = (bandX * 2.0 - 1.0) * 0.22;
  float tone = clamp(0.5 + 0.4 * lean + cross * 0.5, 0.0, 1.0);
  vec3 dark = vec3(0.017, 0.088, 0.012);
  vec3 light = vec3(0.040, 0.158, 0.022);
  vec3 col = mix(dark, light, tone);
  col *= 0.8 + 0.42 * n1.r;
  col = mix(col, col * vec3(1.18, 1.08, 0.72), smoothstep(0.52, 0.8, n2.g) * 0.35);
  // wear in the goal mouth and around the spot
  float wear = exp(-(p.x * p.x / 9.0 + (p.y - 1.4) * (p.y - 1.4) / 3.2)) * 0.55;
  wear += exp(-dot(p - vec2(0.0, 11.0), p - vec2(0.0, 11.0)) / 0.5) * 0.3;
  wear *= 0.55 + 0.9 * n2.b;
  col = mix(col, vec3(0.085, 0.115, 0.035), clamp(wear, 0.0, 0.7));

  float grass = 1.0;
  // synthetic apron outside the playing surface
  float outX = smoothstep(37.0, 37.0 + max(aa, 0.02), abs(p.x));
  float outZ = max(smoothstep(-4.2, -4.2 - max(aa, 0.02), p.y), smoothstep(109.2, 109.2 + max(aa, 0.02), p.y));
  float apron = max(outX, outZ);
  vec3 apronCol = vec3(0.016, 0.04, 0.03) * (0.8 + 0.4 * n2.r);
  col = mix(col, apronCol, apron);
  grass *= 1.0 - apron;

  float d = fgLineDist(p);
  float w = 0.06;
  float a = max(aa, 0.002);
  float line = clamp((w - d) / a + 0.5, 0.0, 1.0) * clamp(2.4 * w / a, 0.0, 1.0);
  line *= 0.82 + 0.18 * n2.a;
  line *= 1.0 - apron;
  col = mix(col, vec3(0.80, 0.82, 0.78), line * 0.93);
  return vec4(col, grass);
}
`;

export function createPitch(gfx, quality) {
  const noise = makeNoiseTexture(256);
  const detail = makeGrassDetail(512);
  const aniso = Math.min(quality.anisotropy, gfx.renderer.capabilities.getMaxAnisotropy());
  detail.anisotropy = aniso;
  noise.anisotropy = Math.min(4, aniso);

  const uniforms = {
    uNoise: { value: noise },
    uDetail: { value: detail },
  };

  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWPos;\n${PITCH_GLSL}\nvec3 fgDetailN;`)
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        vec2 fgP = vWPos.xz;
        float fgAA = length(fwidth(fgP));
        vec4 fgC = fgPitchColor(fgP, cameraPosition, fgAA);
        vec4 dA = texture2D(uDetail, fgP / 1.35);
        vec4 dB = texture2D(uDetail, vec2(fgP.y, -fgP.x) / 0.43 + 0.5);
        float fgDist = length(cameraPosition - vWPos);
        float nearK = 1.0 - smoothstep(6.0, 28.0, fgDist);
        vec4 dC = texture2D(uDetail, fgP / 5.3 + 0.21);
        float det = mix(mix(dA.a, dC.a, 0.5), dB.a, 0.5 * nearK);
        fgC.rgb *= mix(1.0, 0.58 + 0.8 * det, mix(0.7, 1.0, nearK) * fgC.a);
        fgDetailN = mix(vec3(0.0, 0.0, 1.0), normalize((dA.xyz * 2.0 - 1.0) + (dB.xyz * 2.0 - 1.0) * nearK), (0.25 + 0.6 * nearK) * fgC.a);
        diffuseColor.rgb *= fgC.rgb;
        `
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
        normal = normalize((viewMatrix * vec4(normalize(vec3(fgDetailN.x, fgDetailN.z * 1.6, fgDetailN.y)), 0.0)).xyz);
        `
      );
  };

  const geo = new THREE.PlaneGeometry(240, 260, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 0, 52.5);
  mesh.receiveShadow = true;
  mesh.name = 'pitch';

  const group = new THREE.Group();
  group.add(mesh);

  let blades = null;
  if (quality.blades > 0) {
    blades = createBlades(quality.blades, uniforms);
    group.add(blades.mesh);
  }

  return {
    group,
    uniforms,
    update(time, focus) {
      if (blades) blades.update(time, focus);
    },
  };
}

function createBlades(count, pitchUniforms) {
  const S = count > 100000 ? 10 : 8;
  const rnd = mulberry32(2024);
  const base = new THREE.BufferGeometry();
  // 5-vertex tapered blade, y in [0,1]
  const pos = new Float32Array([-0.5, 0, 0, 0.5, 0, 0, -0.32, 0.55, 0, 0.32, 0.55, 0, 0, 1, 0]);
  base.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  base.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
  base.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4]);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.attributes.position = base.attributes.position;
  geo.attributes.normal = base.attributes.normal;
  const off = new Float32Array(count * 2);
  const rndA = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    off[i * 2] = rnd() * S;
    off[i * 2 + 1] = rnd() * S;
    rndA[i * 4] = rnd() * Math.PI * 2;
    rndA[i * 4 + 1] = rnd();
    rndA[i * 4 + 2] = rnd();
    rndA[i * 4 + 3] = rnd();
  }
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 2));
  geo.setAttribute('aRnd', new THREE.InstancedBufferAttribute(rndA, 4));
  geo.instanceCount = count;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

  const uniforms = {
    uCenter: { value: new THREE.Vector2(0, 11) },
    uTime: { value: 0 },
    uTile: { value: S },
  };

  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, pitchUniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        attribute vec2 aOff;
        attribute vec4 aRnd;
        uniform vec2 uCenter;
        uniform float uTime;
        uniform float uTile;
        varying vec3 vBladeCol;
        ${PITCH_GLSL}
        `
      )
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
        vec2 root = mod(aOff - uCenter + uTile * 0.5, uTile) - uTile * 0.5 + uCenter;
        vec2 rel = abs(root - uCenter) / (uTile * 0.5);
        float edge = 1.0 - smoothstep(0.6, 0.98, max(rel.x, rel.y));
        vec4 pc = fgPitchColor(root, cameraPosition, 0.03);
        float camD = distance(cameraPosition.xz, root);
        edge *= 1.0 - smoothstep(4.5, 10.5, camD);
        float onLine = smoothstep(0.5, 0.75, pc.r);
        float hgt = (0.02 + 0.02 * aRnd.y) * edge * pc.a * (1.0 - 0.55 * onLine);
        float wid = (0.0045 + 0.004 * aRnd.z) * (1.0 + camD * 0.12);
        float ca = cos(aRnd.x), sa = sin(aRnd.x);
        float y01 = position.y;
        float bend = (0.3 + 0.9 * aRnd.w) * y01 * y01 * hgt;
        float sway = sin(uTime * 1.6 + root.x * 0.9 + root.y * 1.3) * 0.004 * y01;
        vec3 transformed = vec3(
          root.x + ca * position.x * wid + sa * bend + sway,
          y01 * hgt,
          root.y + sa * position.x * wid - ca * bend
        );
        vBladeCol = pc.rgb * (0.7 + 0.5 * y01) * (0.86 + 0.3 * aRnd.w);
        `
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBladeCol;')
      .replace('#include <map_fragment>', 'diffuseColor.rgb *= vBladeCol;')
      .replace('#include <normal_fragment_maps>', 'normal = normalize(vNormal);');
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.name = 'blades';
  mesh.renderOrder = 2;
  return {
    mesh,
    update(time, focus) {
      uniforms.uTime.value = time;
      if (focus) uniforms.uCenter.value.set(focus.x, focus.z);
    },
  };
}
