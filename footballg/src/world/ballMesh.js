import * as THREE from 'three';
import { F } from '../config.js';
import { makeBallTextures } from './textures.js';

export function createBallMesh(quality) {
  const { map, bump } = makeBallTextures(quality.envSize >= 256 ? 2048 : 1024);
  map.anisotropy = quality.anisotropy;
  const mat = new THREE.MeshPhysicalMaterial({
    map,
    bumpMap: bump,
    bumpScale: 1.4,
    roughness: 0.34,
    metalness: 0,
    clearcoat: 0.55,
    clearcoatRoughness: 0.28,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(F.ballR, 48, 32), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'ball';
  return mesh;
}
