// 3D portrait for the front page: the avatar is rendered to a texture, then printed as
// halftone dots in the current edition's ink. Loaded only when motion and WebGL are available.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const root = document.documentElement;
const frame = document.getElementById("portrait");
const canvas = document.createElement("canvas");
canvas.setAttribute("aria-hidden", "true"); // the <img> underneath carries the alt text
frame.append(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(22, 4 / 5, 0.1, 20);
scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 2.2));
const key = new THREE.DirectionalLight(0xffffff, 3.2);
key.position.set(-1.2, 2.4, 2);
scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 1.4);
fill.position.set(1, 1.6, 2.5);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 1.2);
rim.position.set(1.5, 2, -1);
scene.add(rim);

// Screen pass: one dot per cell on a 45° screen, sized by how dark the scene is there
const target = new THREE.WebGLRenderTarget(1, 1, { samples: 4 });
const halftone = new THREE.ShaderMaterial({
  uniforms: {
    tScene: { value: target.texture },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uCell: { value: 8 },
    uPaper: { value: new THREE.Vector3() },
    uInk: { value: new THREE.Vector3() },
    uLightInk: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tScene;
    uniform vec2 uResolution;
    uniform float uCell;
    uniform vec3 uPaper;
    uniform vec3 uInk;
    uniform float uLightInk;
    varying vec2 vUv;

    const float ANGLE = 0.785398;

    vec2 rotate(vec2 p, float a) {
      float s = sin(a), c = cos(a);
      return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    }

    // How much ink a scene sample needs. Dark ink prints the shadows;
    // light ink on dark paper prints the highlights.
    float cover(vec4 texel) {
      // Gamma, then a levels stretch so skin reads as mid-tone rather than shadow
      float lum = smoothstep(0.04, 0.72, pow(dot(texel.rgb, vec3(0.299, 0.587, 0.114)), 1.0 / 2.2));
      return mix(1.0 - lum, lum, uLightInk) * texel.a;
    }

    void main() {
      // Continuous tone at full resolution carries the detail...
      float tone = cover(texture2D(tScene, vUv));

      // ...and a fine 45° dot screen on top gives it the newsprint texture
      vec2 p = rotate(vUv * uResolution, ANGLE);
      vec2 center = (floor(p / uCell) + 0.5) * uCell;
      float dotCover = cover(texture2D(tScene, rotate(center, -ANGLE) / uResolution));
      float radius = uCell * 0.72 * sqrt(dotCover);
      float dots = (1.0 - smoothstep(radius - 0.6, radius + 0.6, length(p - center))) * smoothstep(0.0, 0.04, dotCover);

      gl_FragColor = vec4(mix(uPaper, uInk, mix(tone, dots, 0.3)), 1.0);
    }
  `,
  depthTest: false,
  depthWrite: false,
});
const screen = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), halftone);
screen.frustumCulled = false;
const screenScene = new THREE.Scene();
screenScene.add(screen);
const screenCamera = new THREE.Camera();

// Ink colours come straight from the edition's CSS tokens (sRGB hex, used as-is)
function tokenColour(name) {
  const n = parseInt(getComputedStyle(root).getPropertyValue(name).trim().slice(1), 16);
  return new THREE.Vector3((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255);
}
function setInk() {
  const { uPaper, uInk, uLightInk } = halftone.uniforms;
  uPaper.value.copy(tokenColour("--paper"));
  uInk.value.copy(tokenColour("--ink"));
  const brightness = (c) => c.x * 0.299 + c.y * 0.587 + c.z * 0.114;
  uLightInk.value = brightness(uInk.value) > brightness(uPaper.value) ? 1 : 0;
}
setInk();
document.addEventListener("editionchange", setInk);

function resize() {
  const { clientWidth: w, clientHeight: h } = frame;
  const ratio = renderer.getPixelRatio();
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  target.setSize(w * ratio, h * ratio);
  halftone.uniforms.uResolution.value.set(w * ratio, h * ratio);
  halftone.uniforms.uCell.value = 3 * ratio;
}
new ResizeObserver(resize).observe(frame);
resize();

const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync("assets/avatar.glb");
const avatar = gltf.scene;
avatar.rotation.y = 0.6; // the idle pose stands ~35° off-camera; turn it to face the reader
scene.add(avatar);

const mixer = new THREE.AnimationMixer(avatar);
const idle = gltf.animations[0];
if (idle) mixer.clipAction(idle).play();
mixer.update(0);

// Frame head and shoulders around wherever the rig puts the head
const head = avatar.getObjectByName("Head");
const headAt = head.getWorldPosition(new THREE.Vector3());
camera.position.set(0, headAt.y, 2.05);
camera.lookAt(0, headAt.y - 0.12, 0);

// The head turns a little towards the reader's cursor. The idle clip doesn't reliably
// drive the head bone, so keep its un-turned pose and restore it every frame.
const headPose = head.quaternion.clone();
const look = new THREE.Vector2();
const lookTarget = new THREE.Vector2();
const lookEuler = new THREE.Euler(0, 0, 0, "YXZ");
const lookTurn = new THREE.Quaternion();
const parentTurn = new THREE.Quaternion();
const parentInverse = new THREE.Quaternion();
addEventListener("pointermove", (e) => {
  const r = frame.getBoundingClientRect();
  lookTarget.set(
    THREE.MathUtils.clamp((e.clientX - (r.left + r.width / 2)) / (innerWidth / 2), -1, 1),
    THREE.MathUtils.clamp((e.clientY - (r.top + r.height / 3)) / (innerHeight / 2), -1, 1),
  );
}, { passive: true });

const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.1);
  head.quaternion.copy(headPose);
  mixer.update(dt);
  headPose.copy(head.quaternion);

  // Turn in world space (yaw about up, pitch about sideways), then bring it back into the bone's frame
  look.lerp(lookTarget, 1 - Math.exp(-dt * 5));
  lookTurn.setFromEuler(lookEuler.set(look.y * 0.25, look.x * 0.6, 0));
  head.parent.getWorldQuaternion(parentTurn);
  parentInverse.copy(parentTurn).invert();
  head.quaternion.copy(parentInverse).multiply(lookTurn).multiply(parentTurn).multiply(headPose);

  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(screenScene, screenCamera);
}

// Only animate while the portrait is on screen
new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) clock.getDelta();
  renderer.setAnimationLoop(entry.isIntersecting ? tick : null);
}).observe(frame);

tick();
frame.classList.add("is-live");
