import * as THREE from 'three';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  SMAAEffect,
  SMAAPreset,
  DepthOfFieldEffect,
  VignetteEffect,
  ToneMappingEffect,
  ToneMappingMode,
  BrightnessContrastEffect,
  HueSaturationEffect,
  Effect,
  EffectAttribute,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

const ballBlurFragment = /* glsl */ `
uniform vec2 uA;
uniform vec2 uB;
uniform float uRadius;
uniform float uAspect;
uniform float uStrength;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  const int N = 12;
  for (int i = 0; i < N; i++) {
    float s = (float(i) + 0.5) / float(N);
    vec2 p = mix(uB, uA, s);
    vec2 d = uv - p;
    d.x *= uAspect;
    float inside = 1.0 - smoothstep(uRadius * 0.82, uRadius * 1.05, length(d));
    vec3 c = mix(inputColor.rgb, texture2D(inputBuffer, uv - p + uA).rgb, inside);
    float w = 0.35 + s;
    acc += c * w;
    wsum += w;
  }
  outputColor = vec4(mix(inputColor.rgb, acc / wsum, uStrength), inputColor.a);
}
`;

class BallBlurEffect extends Effect {
  constructor() {
    super('BallBlurEffect', ballBlurFragment, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([
        ['uA', new THREE.Uniform(new THREE.Vector2(-1, -1))],
        ['uB', new THREE.Uniform(new THREE.Vector2(-1, -1))],
        ['uRadius', new THREE.Uniform(0.01)],
        ['uAspect', new THREE.Uniform(1.7)],
        ['uStrength', new THREE.Uniform(0)],
      ]),
    });
  }
}

export function detectSoftwareGL(gl) {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return { name: String(name), software: /swiftshader|llvmpipe|software|basic render/i.test(String(name)) };
  } catch (e) {
    return { name: 'unknown', software: false };
  }
}

export class Gfx {
  constructor(canvas, quality) {
    this.q = quality;
    this.canvas = canvas;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !quality.post,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });
    this.renderer = renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = quality.shadowLights > 0;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMappingExposure = 1.0;
    renderer.toneMapping = quality.post ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    renderer.info.autoReset = false;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.15, 900);
    this.resScale = 1;
    this.dofState = { enabled: false, distance: 12, range: 8, scale: 0 };
    this._prevBall = new THREE.Vector2(-1, -1);
    this._tmpV = new THREE.Vector3();

    if (quality.post) this._buildComposer();
    this.resize();
  }

  _buildComposer() {
    const q = this.q;
    const { renderer, scene, camera } = this;
    const composer = new EffectComposer(renderer, {
      frameBufferType: THREE.HalfFloatType,
      multisampling: q.msaa || 0,
    });
    this.composer = composer;
    composer.addPass(new RenderPass(scene, camera));

    if (q.ao) {
      const ao = new N8AOPostPass(scene, camera, 1280, 720);
      ao.configuration.aoRadius = 0.9;
      ao.configuration.distanceFalloff = 1.0;
      ao.configuration.intensity = 4.5;
      ao.configuration.halfRes = true;
      ao.configuration.gammaCorrection = false;
      ao.configuration.color = new THREE.Color(0, 0, 0);
      ao.setQualityMode('Medium');
      this.ao = ao;
      composer.addPass(ao);
    }

    if (q.dof) {
      this.dof = new DepthOfFieldEffect(camera, {
        focusDistance: 12,
        focusRange: 8,
        bokehScale: 3,
        resolutionScale: 0.5,
      });
      this.dofPass = new EffectPass(camera, this.dof);
      this.dofPass.enabled = false;
      composer.addPass(this.dofPass);
    }

    if (q.motionBlur) {
      this.ballBlur = new BallBlurEffect();
      this.ballBlurPass = new EffectPass(camera, this.ballBlur);
      this.ballBlurPass.enabled = false;
      composer.addPass(this.ballBlurPass);
    }

    const effects = [];
    if (q.bloom) {
      this.bloom = new BloomEffect({
        mipmapBlur: true,
        luminanceThreshold: 1.0,
        luminanceSmoothing: 0.25,
        intensity: 0.75,
        radius: 0.78,
        levels: 7,
      });
      effects.push(this.bloom);
    }
    this.vignette = new VignetteEffect({ offset: 0.32, darkness: 0.52 });
    effects.push(this.vignette);
    effects.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }));
    this.contrast = new BrightnessContrastEffect({ brightness: 0.0, contrast: 0.06 });
    effects.push(this.contrast);
    this.hueSat = new HueSaturationEffect({ saturation: 0.08 });
    effects.push(this.hueSat);
    composer.addPass(new EffectPass(camera, ...effects));

    if (q.smaa && !q.msaa) {
      composer.addPass(new EffectPass(camera, new SMAAEffect({ preset: SMAAPreset.HIGH })));
    }
  }

  setResolutionScale(s) {
    if (Math.abs(s - this.resScale) < 0.01) return;
    this.resScale = s;
    this.resize();
  }

  resize() {
    const w = Math.max(2, this.canvas.clientWidth || window.innerWidth);
    const h = Math.max(2, this.canvas.clientHeight || window.innerHeight);
    const pr = Math.min(window.devicePixelRatio || 1, this.q.maxPixelRatio) * this.resScale;
    this.width = w;
    this.height = h;
    this.pixelRatio = pr;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    if (this.composer) this.composer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // focusPoint: world Vector3 or null to disable.
  setDof(focusPoint, range = 6, scale = 3) {
    if (!this.dof) return;
    if (!focusPoint || scale <= 0.01) {
      this.dofPass.enabled = false;
      return;
    }
    this.dofPass.enabled = true;
    const d = this._tmpV.copy(focusPoint).sub(this.camera.position).dot(this.camera.getWorldDirection(new THREE.Vector3()));
    this.dof.cocMaterial.focusDistance = Math.max(0.5, d);
    this.dof.cocMaterial.focusRange = range;
    this.dof.bokehScale = scale;
  }

  updateBallBlur(ballPos, ballRadius, speed, active) {
    if (!this.ballBlur) return;
    const cam = this.camera;
    const v = this._tmpV.copy(ballPos).project(cam);
    const cur = new THREE.Vector2(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
    const visible = v.z > -1 && v.z < 1;
    const dist = cam.position.distanceTo(ballPos);
    const rUv = ballRadius / (dist * Math.tan(THREE.MathUtils.degToRad(cam.fov * 0.5)) * 2);
    const u = this.ballBlur.uniforms;
    const prev = this._prevBall;
    const delta = cur.distanceTo(prev);
    const on = active && visible && prev.x >= 0 && delta > rUv * 0.5 && delta < 0.35 && speed > 6;
    this.ballBlurPass.enabled = on;
    if (on) {
      u.get('uA').value.copy(cur);
      u.get('uB').value.copy(prev).lerp(cur, 0.25);
      u.get('uRadius').value = rUv;
      u.get('uAspect').value = cam.aspect;
      u.get('uStrength').value = 0.85;
    }
    if (visible) prev.copy(cur);
    else prev.set(-1, -1);
  }

  resetBallBlur() {
    this._prevBall.set(-1, -1);
    if (this.ballBlurPass) this.ballBlurPass.enabled = false;
  }

  render(dt) {
    this.renderer.info.reset();
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }
}
