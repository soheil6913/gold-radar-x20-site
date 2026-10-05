// Gold Radar X20 — 3D Cinematic Engine & WebGL Visualizer

// =========================================================
// 1. WEB AUDIO API SYNTHESIZER (Cinematic Audio FX)
// =========================================================
let audioCtx = null;
let sfxEnabled = true;

function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
}

function playClickSFX() {
  if (!sfxEnabled) return;
  initAudio();
  if (!audioCtx) return;
  
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.08);
    
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.08);
  } catch (e) {
    console.log(e);
  }
}

function toggleAudioFX() {
  sfxEnabled = !sfxEnabled;
  const btn = document.getElementById('sfx-toggle');
  if (btn) {
    btn.innerText = sfxEnabled ? "🔊 Audio" : "🔇 Muted";
    btn.classList.toggle('muted', !sfxEnabled);
  }
  playClickSFX();
}

// =========================================================
// 2. BACKGROUND 3D SPACE & STARFIELD CANVAS
// =========================================================
const c = document.getElementById("space");
const x = c ? c.getContext("2d") : null;
const boot = document.getElementById("boot");

let w = window.innerWidth, h = window.innerHeight, dpr = 1;
let pts = [], mx = 0, my = 0;

function resizeSpace() {
  if (!c || !x) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  w = window.innerWidth;
  h = window.innerHeight;
  c.width = w * dpr;
  c.height = h * dpr;
  c.style.width = w + "px";
  c.style.height = h + "px";
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  
  pts = Array.from({ length: Math.min(220, Math.floor(w * h / 6000)) }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    z: Math.random(),
    s: Math.random() * 1.8 + 0.3,
    color: Math.random() > 0.85 ? '#00f0ff' : '#d6a63a'
  }));
}

function drawSpace() {
  if (!x) return;
  x.clearRect(0, 0, w, h);
  
  // Subtle Nebula Glow
  const grad = x.createRadialGradient(w / 2 + mx * 0.1, h / 2 + my * 0.1, 50, w / 2, h / 2, Math.max(w, h) * 0.7);
  grad.addColorStop(0, "rgba(214, 166, 58, 0.04)");
  grad.addColorStop(0.5, "rgba(0, 240, 255, 0.02)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = grad;
  x.fillRect(0, 0, w, h);

  // Drawing Star Particles
  for (const p of pts) {
    p.y -= 0.15 + p.z * 0.3;
    if (p.y < 0) p.y = h;
    
    let px = p.x + (mx * 0.03) * (1 - p.z);
    let py = p.y + (my * 0.03) * (1 - p.z);
    
    x.globalAlpha = 0.2 + p.z * 0.65;
    x.fillStyle = p.color;
    x.beginPath();
    x.arc(px, py, p.s, 0, Math.PI * 2);
    x.fill();
  }
  requestAnimationFrame(drawSpace);
}

window.addEventListener("resize", resizeSpace);
window.addEventListener("pointermove", e => {
  mx = e.clientX - w / 2;
  my = e.clientY - h / 2;
});

resizeSpace();
if (x) drawSpace();

setTimeout(() => {
  if (boot) boot.classList.add("hide");
}, 2200);

// 3D Tilt Card Interaction
document.querySelectorAll(".card, .screenshot-card").forEach(card => {
  card.addEventListener("pointermove", e => {
    const r = card.getBoundingClientRect();
    const rx = (e.clientY - r.top - r.height / 2) / 16;
    const ry = (e.clientX - r.left - r.width / 2) / -16;
    card.style.transform = `translateY(-10px) scale(1.04) rotateX(${rx}deg) rotateY(${ry}deg)`;
  });
  card.addEventListener("pointerleave", () => {
    card.style.transform = "";
  });
});

// =========================================================
// 3. THREE.JS INTERACTIVE 3D HOLOGRAPHIC SCANNER
// =========================================================
let scene, camera, renderer;
let terrainMesh, wireframeMesh, laserPlane;
let targetNodes = [];
let isDragging = false, previousMousePosition = { x: 0, y: 0 };
let currentMode = 'wireframe';
let raycaster, mouse;

function init3DScanner() {
  const container = document.getElementById("canvas-3d-container");
  if (!container || typeof THREE === "undefined") return;

  const rect = container.getBoundingClientRect();
  const width = container.clientWidth || 500;
  const height = container.clientHeight || 450;

  // Scene
  scene = new THREE.Scene();

  // Camera
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(0, 35, 55);
  camera.lookAt(0, -2, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffd700, 1.2);
  dirLight.position.set(20, 40, 20);
  scene.add(dirLight);

  const cyanLight = new THREE.PointLight(0x00f0ff, 2, 80);
  cyanLight.position.set(-20, 15, -10);
  scene.add(cyanLight);

  // 1. Generate Undulating 3D Subterranean Terrain Mesh
  const gridWidth = 32, gridHeight = 32;
  const geometry = new THREE.PlaneGeometry(36, 36, gridWidth, gridHeight);
  geometry.rotateX(-Math.PI / 2);

  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const xVal = pos.getX(i);
    const zVal = pos.getZ(i);
    
    // Simulate Subterranean Peaks & Cavities
    let yVal = Math.sin(xVal * 0.2) * Math.cos(zVal * 0.2) * 2.5;
    
    // Gold Anomaly Peak at (6, 8)
    const distGold = Math.hypot(xVal - 6, zVal - 6);
    if (distGold < 8) {
      yVal += (8 - distGold) * 1.2;
    }

    // Cavity Void Depression at (-8, -6)
    const distCavity = Math.hypot(xVal + 8, zVal + 6);
    if (distCavity < 7) {
      yVal -= (7 - distCavity) * 1.0;
    }

    pos.setY(i, yVal);
  }
  geometry.computeVertexNormals();

  // Solid Terrain Material
  const terrainMaterial = new THREE.MeshStandardMaterial({
    color: 0x0a1420,
    roughness: 0.3,
    metalness: 0.8,
    transparent: true,
    opacity: 0.85
  });
  terrainMesh = new THREE.Mesh(geometry, terrainMaterial);
  scene.add(terrainMesh);

  // Wireframe Overlay
  const wireframeGeo = new THREE.WireframeGeometry(geometry);
  const wireframeMat = new THREE.LineBasicMaterial({
    color: 0xd6a63a,
    transparent: true,
    opacity: 0.6
  });
  wireframeMesh = new THREE.LineSegments(wireframeGeo, wireframeMat);
  scene.add(wireframeMesh);

  // 2. Laser Scan Plane
  const laserGeo = new THREE.PlaneGeometry(38, 38);
  laserGeo.rotateX(-Math.PI / 2);
  const laserMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.15,
    wireframe: true
  });
  laserPlane = new THREE.Mesh(laserGeo, laserMat);
  laserPlane.position.y = 0.5;
  scene.add(laserPlane);

  // 3. Create 3D Target Anomaly Markers
  createTargetNode(6, 6.2, 6, "Gold Target ✨", "Depth: 0.50m | X: 8, Y: 7", "Frequency: 740 Hz | ADC: 935", 0xffd700);
  createTargetNode(-8, -4.5, -6, "Underground Void 🌌", "Depth: 3.20m | X: 3, Y: 2", "Negative Signal | ADC: 120", 0x00f0ff);
  createTargetNode(2, 3.0, -8, "Precious Metal 💎", "Depth: 1.80m | X: 6, Y: 4", "Frequency: 620 Hz | ADC: 780", 0xff2266);

  // 4. Orbit Controls (Mouse & Touch Drag)
  const dom = renderer.domElement;

  dom.addEventListener("mousedown", e => {
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  dom.addEventListener("mousemove", e => {
    if (!isDragging) {
      checkHoverTarget(e);
      return;
    }
    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;

    scene.rotation.y += deltaX * 0.008;
    scene.rotation.x += deltaY * 0.005;
    scene.rotation.x = Math.max(-Math.PI / 4, Math.min(Math.PI / 3, scene.rotation.x));

    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener("mouseup", () => isDragging = false);

  // Touch Support
  dom.addEventListener("touchstart", e => {
    if (e.touches.length === 1) {
      isDragging = true;
      previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  });

  dom.addEventListener("touchmove", e => {
    if (!isDragging || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - previousMousePosition.x;
    const deltaY = e.touches[0].clientY - previousMousePosition.y;

    scene.rotation.y += deltaX * 0.008;
    scene.rotation.x += deltaY * 0.005;

    previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  });

  window.addEventListener("touchend", () => isDragging = false);

  // Scroll Zoom
  dom.addEventListener("wheel", e => {
    e.preventDefault();
    camera.position.z += e.deltaY * 0.03;
    camera.position.z = Math.max(25, Math.min(90, camera.position.z));
  }, { passive: false });

  // Raycaster for Hovering
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // Animation Loop
  let clock = new THREE.Clock();
  function animate3D() {
    requestAnimationFrame(animate3D);
    const elapsedTime = clock.getElapsedTime();

    // Subtle Auto Rotation if not dragging
    if (!isDragging) {
      scene.rotation.y += 0.0025;
    }

    // Laser plane sweeping motion
    laserPlane.position.y = Math.sin(elapsedTime * 2) * 2.5;

    // Sync HUD progress bar with 3D terrain acquisition cycle
    const scanCycleDuration = 10.0;
    const cycleTime = elapsedTime % scanCycleDuration;
    const progressPercent = Math.min(100, Math.max(0, Math.floor((cycleTime / scanCycleDuration) * 100)));

    const fillElem = document.getElementById("scan-progress-fill");
    const percentElem = document.getElementById("scan-progress-percent");

    if (fillElem) {
      fillElem.style.width = progressPercent + "%";
    }

    if (percentElem) {
      const isEn = document.documentElement.lang === "en";
      percentElem.innerText = isEn ? `${progressPercent}%` : `${progressPercent.toLocaleString('fa-IR')}٪`;
    }

    // Target pulse animation
    targetNodes.forEach(node => {
      node.mesh.rotation.y += 0.03;
      node.beacon.scale.setScalar(1 + Math.sin(elapsedTime * 4) * 0.2);
    });

    renderer.render(scene, camera);
  }

  animate3D();

  // Mark status indicator as READY once scene is initialized
  setTimeout(() => {
    const statusLight = document.getElementById("scan-status-light");
    const statusText = document.getElementById("status-text");
    if (statusLight) {
      statusLight.classList.remove("standby");
      statusLight.classList.add("ready");
    }
    if (statusText) {
      const isEn = document.documentElement.lang === "en";
      statusText.innerText = isEn ? "READY" : "آماده (READY)";
    }
  }, 500);

  // Handle Window Resize
  window.addEventListener("resize", () => {
    const w = container.clientWidth || 500;
    const h = container.clientHeight || 450;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
}

// Target Node Generator
function createTargetNode(x, y, z, title, depth, signal, colorHex) {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  // Target Sphere Node
  const sphereGeo = new THREE.OctahedronGeometry(1.2, 2);
  const sphereMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 0.6,
    metalness: 0.9,
    roughness: 0.1
  });
  const mesh = new THREE.Mesh(sphereGeo, sphereMat);
  group.add(mesh);

  // Vertical Depth Beacon Pin
  const pinGeo = new THREE.CylinderGeometry(0.08, 0.08, y + 10, 8);
  const pinMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.7 });
  const pin = new THREE.Mesh(pinGeo, pinMat);
  pin.position.y = -(y + 10) / 2;
  group.add(pin);

  // Outer Glowing Pulse Ring
  const ringGeo = new THREE.RingGeometry(1.6, 2.0, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
  const beacon = new THREE.Mesh(ringGeo, ringMat);
  group.add(beacon);

  scene.add(group);

  targetNodes.push({
    group,
    mesh,
    beacon,
    title,
    depth,
    signal,
    colorHex
  });
}

// Raycast Hover Check
function checkHoverTarget(event) {
  if (!renderer || !camera || targetNodes.length === 0) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const meshesToTest = targetNodes.map(n => n.mesh);
  const intersects = raycaster.intersectObjects(meshesToTest);

  const tooltip = document.getElementById("target-tooltip");
  if (intersects.length > 0) {
    const hitMesh = intersects[0].object;
    const node = targetNodes.find(n => n.mesh === hitMesh);
    if (node && tooltip) {
      document.getElementById("tooltip-title").innerText = node.title;
      document.getElementById("tooltip-depth").innerText = node.depth;
      document.getElementById("tooltip-sig").innerText = node.signal;

      tooltip.style.display = "block";
      tooltip.style.left = (event.clientX - rect.left + 15) + "px";
      tooltip.style.top = (event.clientY - rect.top - 20) + "px";
      playClickSFX();
    }
  } else if (tooltip) {
    tooltip.style.display = "none";
  }
}

// Mode Switcher function
function set3DMode(mode, btnElement) {
  currentMode = mode;
  document.querySelectorAll(".hud-btn").forEach(b => b.classList.remove("active"));
  if (btnElement) btnElement.classList.add("active");

  playClickSFX();

  if (!terrainMesh || !wireframeMesh) return;

  if (mode === 'wireframe') {
    terrainMesh.material.color.setHex(0x0a1420);
    wireframeMesh.material.color.setHex(0xd6a63a);
    wireframeMesh.material.opacity = 0.6;
  } else if (mode === 'thermal') {
    terrainMesh.material.color.setHex(0xff2200);
    wireframeMesh.material.color.setHex(0x00f0ff);
    wireframeMesh.material.opacity = 0.9;
  } else if (mode === 'targets') {
    terrainMesh.material.color.setHex(0x050a10);
    wireframeMesh.material.color.setHex(0xffd700);
    wireframeMesh.material.opacity = 0.3;
  }
}

// Initialize 3D Scene when DOM is ready
if (document.readyState === "complete" || document.readyState === "interactive") {
  setTimeout(init3DScanner, 300);
} else {
  document.addEventListener("DOMContentLoaded", () => setTimeout(init3DScanner, 300));
}
