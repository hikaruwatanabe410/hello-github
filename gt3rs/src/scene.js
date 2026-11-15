import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const MODEL_URL = `${import.meta.env.BASE_URL}models/gt3rs.glb`;
const MODEL_BYTES = 9098480; // fallback when the server sends no content-length
const ACCENT = 0xc6f135;

// Material names inside the GLB (the source file ships unnamed "lens_*" slots).
const PAINT_MATERIALS = new Set(['lens_3', 'lens_6']);
const WHEEL_MATERIALS = new Set(['lens_16']);
const PLATE_MATERIALS = new Set(['lens_64']); // source texture carries a third-party logo

export const PAINTS = [
  { id: 'ice', name: 'Ice Grey Metallic', hex: '#c3c9ce', metalness: 0.75, roughness: 0.32 },
  { id: 'acid', name: 'Acid Green', hex: '#a9dc16', metalness: 0.15, roughness: 0.3 },
  { id: 'red', name: 'Guards Red', hex: '#c20f14', metalness: 0.1, roughness: 0.28 },
  { id: 'blue', name: 'Shark Blue', hex: '#125fb5', metalness: 0.2, roughness: 0.28 },
  { id: 'white', name: 'Pure White', hex: '#eeeeea', metalness: 0.0, roughness: 0.3 },
  { id: 'black', name: 'Jet Black Metallic', hex: '#0d0e10', metalness: 0.6, roughness: 0.28 },
];

export const WHEELS = [
  { id: 'black', name: 'Satin Black', hex: '#141516', metalness: 0.7, roughness: 0.5 },
  { id: 'silver', name: 'GT Silver', hex: '#b4b8bc', metalness: 0.95, roughness: 0.3 },
  { id: 'aurum', name: 'Satin Aurum', hex: '#a98a5c', metalness: 0.9, roughness: 0.38 },
  { id: 'red', name: 'Pyro Red', hex: '#b5161a', metalness: 0.4, roughness: 0.4 },
];

// Camera poses. az: orbit angle (0 = dead ahead of the nose), el: elevation,
// dist: metres from target, t: look-at target, sx/sy: screen-space shift of
// the car as a fraction of the viewport, wide: how much of the car's length
// must stay in frame on narrow screens (0 = close-up).
const POSES = {
  hero:    { az: 0.62, el: 0.1, dist: 7.4, t: [0, 0.62, 0], sx: 0, sy: -0.09, wide: 0.95 },
  stats:   { az: Math.PI / 2, el: 0.05, dist: 9.6, t: [0, 0.6, 0], sx: 0, sy: -0.06, wide: 1 },
  chassis: { az: 1.18, el: 0.07, dist: 3.9, t: [0.95, 0.42, 1.3], sx: 0.15, sy: 0, wide: 0 },
  wing:    { az: 2.5, el: 0.28, dist: 5.8, t: [0, 0.95, -1.5], sx: -0.15, sy: 0, wide: 0 },
  engine:  { az: 3.55, el: 0.2, dist: 6.2, t: [0, 0.7, -1.5], sx: 0.21, sy: 0, wide: 0 },
  front:   { az: 5.85, el: 0.42, dist: 6.6, t: [0, 0.55, 1.1], sx: -0.2, sy: 0, wide: 0 },
  config:  { az: 7.15, el: 0.16, dist: 8.0, t: [0, 0.62, 0], sx: 0, sy: 0.03, wide: 0.85 },
};
const MOBILE_SHIFT = {
  hero: [0, 0.0], stats: [0, 0.07], chassis: [0, 0.2], wing: [0, 0.2],
  engine: [0, 0.2], front: [0, 0.2], config: [0, 0.14],
};

const GALLERY_SHOTS = [
  { title: 'Front three-quarter', paint: 'acid', wheel: 'black', pose: { az: 0.5, el: 0.06, dist: 6.4, t: [0, 0.6, 0.2] } },
  { title: 'Swan-neck wing', paint: 'ice', wheel: 'black', pose: { az: 2.75, el: 0.2, dist: 3.4, t: [0.1, 1.05, -1.9] } },
  { title: 'Plan view', paint: 'red', wheel: 'silver', pose: { az: Math.PI / 2, el: 1.42, dist: 9.2, t: [0, 0.5, 0] } },
  { title: 'Centre-lock detail', paint: 'blue', wheel: 'aurum', pose: { az: 1.35, el: 0.04, dist: 2.3, t: [1.0, 0.36, 1.32] } },
  { title: 'Profile', paint: 'white', wheel: 'black', pose: { az: -Math.PI / 2, el: 0.03, dist: 7.6, t: [0, 0.62, 0] } },
  { title: 'Rear diffuser', paint: 'black', wheel: 'red', pose: { az: 3.5, el: 0.1, dist: 4.4, t: [0, 0.6, -1.6] } },
];

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

function radialTexture(stops, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A small procedural studio: soft boxes that give the paint long, clean
// reflections, plus one accent-coloured strip low behind the car.
function buildEnvironment(renderer) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x020303);
  const box = (w, h, color, intensity, pos, rot) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }),
    );
    m.position.set(...pos);
    m.rotation.set(...rot);
    env.add(m);
  };
  box(14, 5, 0xffffff, 9, [0, 9, 0], [Math.PI / 2, 0, 0]);
  box(2.2, 16, 0xeaf2ff, 7, [-9, 5, 0], [0, Math.PI / 2, 0.5]);
  box(2.2, 16, 0xfff4e6, 7, [9, 5, 0], [0, -Math.PI / 2, -0.5]);
  box(10, 1.2, 0xffffff, 12, [0, 3.5, 11], [0, Math.PI, 0]);
  box(12, 0.8, ACCENT, 4, [0, 1.2, -11], [0, 0, 0]);
  box(30, 30, 0x101214, 1, [0, -4, 0], [-Math.PI / 2, 0, 0]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.03).texture;
  pmrem.dispose();
  return tex;
}

function buildFloor() {
  const group = new THREE.Group();

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(16, 64),
    new THREE.MeshStandardMaterial({
      color: 0x050606, roughness: 0.62, metalness: 0.55, envMapIntensity: 0.16, transparent: true,
      alphaMap: radialTexture([[0, '#fff'], [0.45, '#fff'], [1, '#000']]),
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  // Technical grid that dissolves with distance.
  const grid = new THREE.Mesh(
    new THREE.PlaneGeometry(32, 32),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(ACCENT) }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        varying vec2 vP; uniform vec3 uColor; uniform float uTime;
        float line(vec2 p, float s){ vec2 g = abs(fract(p / s - 0.5) - 0.5) / fwidth(p / s); return 1.0 - min(min(g.x, g.y), 1.0); }
        void main(){
          float d = length(vP);
          float a = line(vP, 1.0) * 0.22 + line(vP, 0.25) * 0.05;
          float pulse = smoothstep(0.5, 0.0, abs(d - mod(uTime * 1.6, 16.0))) * 0.35;
          a = (a + a * pulse * 4.0) * smoothstep(13.0, 2.5, d);
          gl_FragColor = vec4(mix(vec3(0.75), uColor, 0.55 + pulse), a);
        }`,
    }),
  );
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = 0.002;
  group.add(grid);

  // Soft contact shadow under the car.
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.3, 6.4),
    new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, depthWrite: false, opacity: 0.92,
      alphaMap: radialTexture([[0, '#fff'], [0.55, '#bbb'], [1, '#000']]),
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.004;
  group.add(shadow);

  // Thin accent ring around the turntable.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.72, 3.735, 160),
    new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.006;
  group.add(ring);

  const ticks = new THREE.Group();
  const tickGeo = new THREE.PlaneGeometry(0.012, 0.16);
  const tickMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const tick = new THREE.Mesh(tickGeo, tickMat);
    const r = i % 6 === 0 ? 3.9 : 3.84;
    tick.position.set(Math.sin(a) * r, 0.006, Math.cos(a) * r);
    tick.rotation.set(-Math.PI / 2, 0, -a);
    tick.scale.y = i % 6 === 0 ? 1.6 : 0.6;
    ticks.add(tick);
  }
  group.add(ticks);

  return { group, grid, ticks };
}

function buildDust() {
  const n = 260;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 16;
    pos[i * 3 + 1] = Math.random() * 4.5;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 16;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: 0xdfe6d0, size: 0.018, transparent: true, opacity: 0.45, depthWrite: false }),
  );
}

const TEXTURE_SLOTS = ['map', 'normalMap', 'aoMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'specularIntensityMap', 'specularColorMap', 'clearcoatMap', 'clearcoatRoughnessMap', 'clearcoatNormalMap'];

export function createStage(canvas, { onProgress, onLost } = {}) {
  const lowMemory = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 860;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); visible = false; if (onLost) onLost(); });
  renderer.setClearColor(0x000000, 0);
  let visible = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.environment = buildEnvironment(renderer);
  scene.environmentIntensity = 1;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
  const floor = buildFloor();
  scene.add(floor.group);
  const dust = buildDust();
  scene.add(dust);

  const key = new THREE.DirectionalLight(0xffffff, 0.5);
  key.position.set(4, 7, 5);
  scene.add(key);

  // Paint and wheel materials are rebuilt from the model's own slots so the
  // baked normal / occlusion maps survive; only colour and finish are ours.
  const paintMats = [];
  const wheelMats = [];
  const paintNow = { color: new THREE.Color(), m: 0.75, r: 0.32 };
  const wheelNow = { color: new THREE.Color(), m: 0.7, r: 0.5 };
  const derive = (src, extra) => {
    const m = new THREE.MeshPhysicalMaterial({
      normalMap: src.normalMap, aoMap: src.aoMap, aoMapIntensity: 0.8, side: src.side, ...extra,
    });
    if (src.normalMap) m.normalScale.copy(src.normalScale);
    return m;
  };
  const push = (mats, now) => mats.forEach((m) => { m.color.copy(now.color); m.metalness = now.m; m.roughness = now.r; });
  const paintTarget = new THREE.Color();
  const wheelTarget = new THREE.Color();
  const finish = { pm: 0.75, pr: 0.32, wm: 0.7, wr: 0.5 };

  function setPaint(id, instant) {
    const p = PAINTS.find((x) => x.id === id) || PAINTS[0];
    paintTarget.set(p.hex);
    finish.pm = p.metalness; finish.pr = p.roughness;
    if (instant) { paintNow.color.copy(paintTarget); paintNow.m = p.metalness; paintNow.r = p.roughness; push(paintMats, paintNow); }
    return p;
  }
  function setWheels(id, instant) {
    const w = WHEELS.find((x) => x.id === id) || WHEELS[0];
    wheelTarget.set(w.hex);
    finish.wm = w.metalness; finish.wr = w.roughness;
    if (instant) { wheelNow.color.copy(wheelTarget); wheelNow.m = w.metalness; wheelNow.r = w.roughness; push(wheelMats, wheelNow); }
    return w;
  }
  setPaint('ice', true);
  setWheels('black', true);

  const car = new THREE.Group();
  scene.add(car);

  // ---- camera state -------------------------------------------------------
  let width = 1, height = 1, aspect = 1, mobile = false;
  const cur = { az: 0.1, el: 0.5, dist: 13, tx: 0, ty: 0.6, tz: 0, sx: 0, sy: 0 };
  const goal = { ...cur };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let dragAz = 0, dragGoal = 0, dragActive = 0;
  let idle = 1;

  function resolve(name) {
    const p = POSES[name];
    const fit = p.wide ? Math.max(1, (1.22 * p.wide) / aspect) : Math.max(1, 0.8 / aspect);
    const shift = mobile ? MOBILE_SHIFT[name] : [p.sx, p.sy];
    return { az: p.az, el: p.el, dist: p.dist * fit, tx: p.t[0], ty: p.t[1], tz: p.t[2], sx: shift[0], sy: shift[1] };
  }

  /** Blend between two named poses; t in 0..1. */
  function setBlend(a, b, t) {
    const A = resolve(a), B = resolve(b), k = smooth(Math.min(1, Math.max(0, t)));
    for (const key in goal) goal[key] = lerp(A[key], B[key], k);
    idle = a === 'hero' ? 1 - k : 0;
    dragActive = b === 'config' ? k : a === 'config' ? 1 - k : 0;
  }

  function applyCamera(s, extraAz = 0, extraEl = 0) {
    const az = s.az + extraAz, el = Math.min(1.5, Math.max(0.015, s.el + extraEl));
    camera.position.set(
      s.tx + s.dist * Math.cos(el) * Math.sin(az),
      s.ty + s.dist * Math.sin(el),
      s.tz + s.dist * Math.cos(el) * Math.cos(az),
    );
    camera.lookAt(s.tx, s.ty, s.tz);
    if (s.sx || s.sy) camera.setViewOffset(width, height, -s.sx * width, s.sy * height, width, height);
    else camera.clearViewOffset();
  }

  function resize() {
    width = window.innerWidth; height = window.innerHeight;
    aspect = width / height; mobile = width < 860;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowMemory ? 1.5 : 1.75));
    renderer.setSize(width, height, false);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    pointer.x = (e.clientX / width) * 2 - 1;
    pointer.y = (e.clientY / height) * 2 - 1;
  }, { passive: true });

  // ---- render loop --------------------------------------------------------
  let last = performance.now();
  let running = false, raf = 0, elapsed = 0;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function frame() {
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;
    if (!visible) return;
    elapsed += dt;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 3.2);
    for (const key in cur) cur[key] = lerp(cur[key], goal[key], k);
    pointer.sx = lerp(pointer.sx, pointer.x, 1 - Math.exp(-dt * 2.5));
    pointer.sy = lerp(pointer.sy, pointer.y, 1 - Math.exp(-dt * 2.5));
    if (!dragActive) dragGoal = lerp(dragGoal, 0, 1 - Math.exp(-dt * 2));
    dragAz = lerp(dragAz, dragGoal, 1 - Math.exp(-dt * 6));

    const sway = reduced ? 0 : Math.sin(elapsed * 0.25) * 0.14 * idle;
    applyCamera(cur, sway + pointer.sx * 0.07 - dragAz, pointer.sy * 0.025);

    const ck = 1 - Math.exp(-dt * 5);
    paintNow.color.lerp(paintTarget, ck);
    paintNow.m = lerp(paintNow.m, finish.pm, ck);
    paintNow.r = lerp(paintNow.r, finish.pr, ck);
    wheelNow.color.lerp(wheelTarget, ck);
    wheelNow.m = lerp(wheelNow.m, finish.wm, ck);
    wheelNow.r = lerp(wheelNow.r, finish.wr, ck);
    push(paintMats, paintNow);
    push(wheelMats, wheelNow);

    floor.grid.material.uniforms.uTime.value = elapsed;
    floor.ticks.rotation.y = elapsed * 0.03;
    dust.rotation.y = elapsed * 0.01;
    renderer.render(scene, camera);
  }

  // ---- gallery stills -----------------------------------------------------
  function capture(shot, w = lowMemory ? 960 : 1280, h = lowMemory ? 645 : 860) {
    const prevW = width, prevH = height;
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    width = w; height = h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    setPaint(shot.paint, true);
    setWheels(shot.wheel, true);
    const p = shot.pose;
    applyCamera({ az: p.az, el: p.el, dist: p.dist, tx: p.t[0], ty: p.t[1], tz: p.t[2], sx: 0, sy: 0 });
    floor.ticks.visible = false;
    renderer.render(scene, camera);
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const g = out.getContext('2d');
    g.fillStyle = '#060707';
    g.fillRect(0, 0, w, h);
    g.drawImage(renderer.domElement, 0, 0);
    floor.ticks.visible = true;
    width = prevW; height = prevH;
    return new Promise((res) => out.toBlob((b) => res({ title: shot.title, paint: PAINTS.find((x) => x.id === shot.paint).name, url: URL.createObjectURL(b) }), 'image/jpeg', 0.9));
  }

  async function captureGallery() {
    const shots = [];
    for (const shot of GALLERY_SHOTS) {
      shots.push(await capture(shot));
      await new Promise((r) => setTimeout(r, 16));
    }
    setPaint('ice', true);
    setWheels('black', true);
    resize();
    return shots;
  }

  // ---- model --------------------------------------------------------------
  const ready = new Promise((resolveReady, reject) => {
    const draco = new DRACOLoader();
    draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    loader.load(
      MODEL_URL,
      (gltf) => {
        const model = gltf.scene;
        const swapped = new Map();
        model.traverse((o) => {
          if (!o.isMesh) return;
          const src = o.material, name = src.name;
          if (PAINT_MATERIALS.has(name) || WHEEL_MATERIALS.has(name)) {
            if (!swapped.has(src)) {
              const isPaint = PAINT_MATERIALS.has(name);
              const m = derive(src, isPaint
                ? { clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.1 }
                : { clearcoat: 0.3, clearcoatRoughness: 0.3 });
              (isPaint ? paintMats : wheelMats).push(m);
              swapped.set(src, m);
            }
            o.material = swapped.get(src);
          } else if (PLATE_MATERIALS.has(name)) {
            src.map = null; src.color.set(0x0a0b0b); src.roughness = 0.6; src.metalness = 0.2;
          } else if (src.transparent) src.depthWrite = false;
        });
        push(paintMats, paintNow);
        push(wheelMats, wheelNow);
        // Phones and tablets have far less graphics memory: shrink large
        // textures before they are uploaded so the WebGL context survives.
        if (lowMemory) {
          const seen = new Set();
          model.traverse((o) => {
            if (!o.isMesh) return;
            for (const key of TEXTURE_SLOTS) {
              const tex = o.material[key];
              if (!tex || seen.has(tex) || !tex.image) continue;
              seen.add(tex);
              const cap = key === 'normalMap' ? 1024 : 512;
              const { width: w, height: h } = tex.image;
              if (Math.max(w, h) <= cap) continue;
              const k = cap / Math.max(w, h);
              const c = document.createElement('canvas');
              c.width = Math.max(1, Math.round(w * k));
              c.height = Math.max(1, Math.round(h * k));
              c.getContext('2d').drawImage(tex.image, 0, 0, c.width, c.height);
              if (tex.image.close) tex.image.close();
              tex.image = c;
              tex.needsUpdate = true;
            }
          });
        }
        // The source file is in 1/100 scale; normalise to metres, centred, on the floor.
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const scale = 4.57 / size.z;
        const centre = box.getCenter(new THREE.Vector3());
        model.scale.setScalar(scale);
        model.position.set(-centre.x * scale, -box.min.y * scale, -centre.z * scale);
        car.add(model);
        draco.dispose();
        renderer.compile(scene, camera);
        resolveReady();
      },
      (e) => onProgress && onProgress(Math.min(1, e.loaded / (e.total || MODEL_BYTES))),
      reject,
    );
  });

  return {
    ready,
    setBlend,
    setPaint: (id) => setPaint(id),
    setWheels: (id) => setWheels(id),
    captureGallery,
    drag(dx) { dragGoal += dx; },
    /** Jump the camera straight to its goal (used before the intro). */
    snap(from) { Object.assign(cur, goal, from || {}); },
    setVisible(v) { visible = v; },
    start() { if (!running) { running = true; last = performance.now(); frame(); } },
    stop() { running = false; cancelAnimationFrame(raf); },
  };
}
