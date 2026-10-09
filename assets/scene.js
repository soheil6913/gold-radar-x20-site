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
    btn.innerText = sfxEnabled ? "🔊 صوتی" : "🔇 بی صدا";
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


const introVideo = document.querySelector(".boot-video");
let bootHidden = false;

function hideBootScreen() {
  if (bootHidden) return;
  bootHidden = true;
  if (boot) boot.classList.add("hide");
}

if (introVideo) {
  introVideo.addEventListener("ended", hideBootScreen, { once: true });
  introVideo.addEventListener("error", () => {
    setTimeout(hideBootScreen, 2200);
  }, { once: true });

  setTimeout(hideBootScreen, 10000);
} else {
  setTimeout(hideBootScreen, 2200);
}


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
  createTargetNode(6, 6.2, 6, "هدف طلا ✨", "عمق: ۰٫۵۰ متر | X: 8, Y: 7", "فرکانس: ۷۴۰ Hz | ADC: 935", 0xffd700);
  createTargetNode(-8, -4.5, -6, "حفره زیرزمینی 🌌", "عمق: ۳٫۲۰ متر | X: 3, Y: 2", "سیگنال منفی | ADC: 120", 0x00f0ff);
  createTargetNode(2, 3.0, -8, "فلز باارزش 💎", "عمق: ۱٫۸۰ متر | X: 6, Y: 4", "فرکانس: ۶۲۰ Hz | ADC: 780", 0xff2266);

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

  // Raycast click to select target and scroll to D3 chart
  dom.addEventListener("click", e => {
    if (!renderer || !camera || targetNodes.length === 0) return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const meshesToTest = targetNodes.map(n => n.mesh);
    const intersects = raycaster.intersectObjects(meshesToTest);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object;
      const nodeIndex = targetNodes.findIndex(n => n.mesh === hitMesh);
      const targetIds = ["gold", "cavity", "metal"];
      const targetId = targetIds[nodeIndex] || "gold";
      
      selectTarget(targetId);

      const chartSec = document.getElementById("d3-chart-section");
      if (chartSec) {
        chartSec.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  });

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

// =========================================================
// 5. D3.JS HISTORICAL FREQUENCY-TO-DEPTH CHART TELEMETRY
// =========================================================
const targetDataStore = {
  gold: {
    id: "gold",
    titleFa: "هدف طلا (Gold Anomaly)",
    titleEn: "Gold Anomaly Target ✨",
    tagFa: "رزونانس بالا",
    tagEn: "HIGH RESONANCE",
    tagClass: "gold",
    icon: "✨",
    depth: "0.50 m",
    peakFreq: 740,
    adc: 935,
    coords: "X: 8, Y: 7",
    soilFactor: "1.42 (سنگ معدنی)",
    soilFactorEn: "1.42 (Mineralized Soil)",
    color: "#ffd700",
    gradientColor: "#ffaa00",
    points: [
      { depth: 0.1, freq: 210, confUpper: 260, confLower: 170, adc: 310, date: "2026-09-12 10:14" },
      { depth: 0.25, freq: 460, confUpper: 510, confLower: 410, adc: 580, date: "2026-09-12 10:15" },
      { depth: 0.5, freq: 740, confUpper: 810, confLower: 680, adc: 935, date: "2026-09-12 10:16", isPeak: true },
      { depth: 0.8, freq: 610, confUpper: 670, confLower: 550, adc: 790, date: "2026-09-12 10:17" },
      { depth: 1.2, freq: 410, confUpper: 460, confLower: 360, adc: 520, date: "2026-09-12 10:18" },
      { depth: 1.8, freq: 260, confUpper: 310, confLower: 210, adc: 340, date: "2026-09-12 10:19" },
      { depth: 2.6, freq: 150, confUpper: 190, confLower: 110, adc: 210, date: "2026-09-12 10:20" },
      { depth: 3.5, freq: 90,  confUpper: 130, confLower: 60,  adc: 130, date: "2026-09-12 10:21" }
    ]
  },
  cavity: {
    id: "cavity",
    titleFa: "حفره زیرزمینی (Subterranean Cavity)",
    titleEn: "Subterranean Cavity Void 🌌",
    tagFa: "افت فرکانسی (Void)",
    tagEn: "NEGATIVE SHIFT",
    tagClass: "cyan",
    icon: "🌌",
    depth: "3.20 m",
    peakFreq: 120,
    adc: 120,
    coords: "X: 3, Y: 2",
    soilFactor: "0.85 (فضای خالی / دالان)",
    soilFactorEn: "0.85 (Void Corridor)",
    color: "#00f0ff",
    gradientColor: "#0088ff",
    points: [
      { depth: 0.5, freq: 520, confUpper: 560, confLower: 480, adc: 610, date: "2026-09-14 14:02" },
      { depth: 1.2, freq: 440, confUpper: 480, confLower: 400, adc: 520, date: "2026-09-14 14:03" },
      { depth: 2.0, freq: 310, confUpper: 350, confLower: 270, adc: 380, date: "2026-09-14 14:04" },
      { depth: 2.7, freq: 190, confUpper: 230, confLower: 150, adc: 230, date: "2026-09-14 14:05" },
      { depth: 3.2, freq: 120, confUpper: 150, confLower: 90,  adc: 120, date: "2026-09-14 14:06", isPeak: true },
      { depth: 4.0, freq: 280, confUpper: 320, confLower: 240, adc: 310, date: "2026-09-14 14:07" },
      { depth: 4.8, freq: 410, confUpper: 450, confLower: 370, adc: 480, date: "2026-09-14 14:08" }
    ]
  },
  metal: {
    id: "metal",
    titleFa: "فلز باارزش (Precious Metal Target)",
    titleEn: "Precious Metal Target 💎",
    tagFa: "رسانایی بالا",
    tagEn: "HIGH CONDUCTIVITY",
    tagClass: "red",
    icon: "💎",
    depth: "1.80 m",
    peakFreq: 620,
    adc: 780,
    coords: "X: 6, Y: 4",
    soilFactor: "1.28 (خاک مرطوب)",
    soilFactorEn: "1.28 (Moist Soil)",
    color: "#ff2266",
    gradientColor: "#ff6622",
    points: [
      { depth: 0.2, freq: 180, confUpper: 220, confLower: 140, adc: 240, date: "2026-09-18 16:30" },
      { depth: 0.7, freq: 380, confUpper: 430, confLower: 330, adc: 490, date: "2026-09-18 16:31" },
      { depth: 1.2, freq: 510, confUpper: 560, confLower: 460, adc: 670, date: "2026-09-18 16:32" },
      { depth: 1.8, freq: 620, confUpper: 680, confLower: 560, adc: 780, date: "2026-09-18 16:33", isPeak: true },
      { depth: 2.5, freq: 450, confUpper: 500, confLower: 400, adc: 560, date: "2026-09-18 16:34" },
      { depth: 3.4, freq: 280, confUpper: 330, confLower: 230, adc: 350, date: "2026-09-18 16:35" },
      { depth: 4.5, freq: 160, confUpper: 200, confLower: 120, adc: 200, date: "2026-09-18 16:36" }
    ]
  },
  vein: {
    id: "vein",
    titleFa: "رگه معدنی عمقی (Deep Mineral Vein)",
    titleEn: "Deep Mineral Vein ⚡",
    tagFa: "آنومالی پیوسته",
    tagEn: "CONTINUOUS VEIN",
    tagClass: "gold",
    icon: "⚡",
    depth: "4.50 m",
    peakFreq: 890,
    adc: 980,
    coords: "X: 9, Y: 9",
    soilFactor: "1.65 (سنگ سخت و کانی)",
    soilFactorEn: "1.65 (Hard Rock & Mineral)",
    color: "#ffaa00",
    gradientColor: "#ffd700",
    points: [
      { depth: 0.5, freq: 290, confUpper: 340, confLower: 240, adc: 380, date: "2026-09-22 09:10" },
      { depth: 1.5, freq: 460, confUpper: 510, confLower: 410, adc: 590, date: "2026-09-22 09:11" },
      { depth: 2.8, freq: 680, confUpper: 740, confLower: 620, adc: 790, date: "2026-09-22 09:12" },
      { depth: 3.8, freq: 810, confUpper: 870, confLower: 750, adc: 910, date: "2026-09-22 09:13" },
      { depth: 4.5, freq: 890, confUpper: 950, confLower: 830, adc: 980, date: "2026-09-22 09:14", isPeak: true },
      { depth: 5.2, freq: 720, confUpper: 780, confLower: 660, adc: 810, date: "2026-09-22 09:15" }
    ]
  }
};

let currentSelectedTargetId = "gold";
let showConfidenceBand = true;

function renderD3FrequencyChart(targetId) {
  if (targetId) currentSelectedTargetId = targetId;
  const dataObj = targetDataStore[currentSelectedTargetId] || targetDataStore.gold;
  const isEn = document.documentElement.lang === "en";

  const iconEl = document.getElementById("d3-target-icon");
  const titleEl = document.getElementById("d3-target-title");
  const tagEl = document.getElementById("d3-target-tag");
  const depthEl = document.getElementById("d3-stat-depth");
  const freqEl = document.getElementById("d3-stat-freq");
  const adcEl = document.getElementById("d3-stat-adc");
  const coordsEl = document.getElementById("d3-stat-coords");
  const soilEl = document.getElementById("d3-stat-soil");

  if (iconEl) iconEl.innerText = dataObj.icon;
  if (titleEl) titleEl.innerText = isEn ? dataObj.titleEn : dataObj.titleFa;
  if (tagEl) {
    tagEl.innerText = isEn ? dataObj.tagEn : dataObj.tagFa;
    tagEl.className = `d3-tag ${dataObj.tagClass}`;
  }
  if (depthEl) depthEl.innerText = dataObj.depth;
  if (freqEl) freqEl.innerText = `${dataObj.peakFreq} Hz`;
  if (adcEl) adcEl.innerText = dataObj.adc;
  if (coordsEl) coordsEl.innerText = dataObj.coords;
  if (soilEl) soilEl.innerText = isEn ? dataObj.soilFactorEn : dataObj.soilFactor;

  document.querySelectorAll(".target-select-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-target-id") === currentSelectedTargetId);
  });

  const container = document.getElementById("d3-chart-container");
  if (!container || typeof d3 === "undefined") return;

  container.innerHTML = "";

  const margin = { top: 35, right: 35, bottom: 50, left: 60 };
  const width = container.clientWidth || 700;
  const height = 360;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = d3.select("#d3-chart-container")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleLinear().domain([0, 1000]).range([0, innerWidth]);
  const yScale = d3.scaleLinear().domain([0, 5.5]).range([0, innerHeight]);

  const defs = svg.append("defs");
  
  const areaGradient = defs.append("linearGradient")
    .attr("id", "d3-area-gradient")
    .attr("x1", "0%").attr("y1", "0%")
    .attr("x2", "0%").attr("y2", "100%");
  
  areaGradient.append("stop").attr("offset", "0%").attr("stop-color", dataObj.color).attr("stop-opacity", 0.4);
  areaGradient.append("stop").attr("offset", "100%").attr("stop-color", dataObj.gradientColor).attr("stop-opacity", 0.05);

  const lineGradient = defs.append("linearGradient")
    .attr("id", "d3-line-gradient")
    .attr("x1", "0%").attr("y1", "0%")
    .attr("x2", "100%").attr("y2", "0%");

  lineGradient.append("stop").attr("offset", "0%").attr("stop-color", dataObj.color);
  lineGradient.append("stop").attr("offset", "100%").attr("stop-color", dataObj.gradientColor);

  const xGrid = d3.axisBottom(xScale).tickSize(-innerHeight).tickFormat("");
  const yGrid = d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat("");

  svg.append("g").attr("class", "d3-grid").attr("transform", `translate(0,${innerHeight})`).call(xGrid);
  svg.append("g").attr("class", "d3-grid").call(yGrid);

  const xAxis = d3.axisBottom(xScale).ticks(8).tickFormat(d => `${d} Hz`);
  svg.append("g").attr("class", "d3-axis").attr("transform", `translate(0,${innerHeight})`).call(xAxis);

  const yAxis = d3.axisLeft(yScale).ticks(6).tickFormat(d => `${d}m`);
  svg.append("g").attr("class", "d3-axis").call(yAxis);

  svg.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 42)
    .attr("text-anchor", "middle")
    .attr("fill", "#a0b0c0")
    .attr("font-size", "11px")
    .attr("font-weight", "600")
    .text(isEn ? "Frequency Spectrum (Hz) →" : "طیف فرکانسی اسکن زمین (Hz) ←");

  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -42)
    .attr("text-anchor", "middle")
    .attr("fill", "#a0b0c0")
    .attr("font-size", "11px")
    .attr("font-weight", "600")
    .text(isEn ? "Depth Level (Meters) ↓" : "عمق لایه زیرزمینی (متر) ↓");

  if (showConfidenceBand) {
    const areaGenerator = d3.area()
      .x0(d => xScale(d.confLower))
      .x1(d => xScale(d.confUpper))
      .y(d => yScale(d.depth))
      .curve(d3.curveMonotoneY);

    svg.append("path")
      .datum(dataObj.points)
      .attr("class", "d3-area-path")
      .attr("fill", "url(#d3-area-gradient)")
      .attr("d", areaGenerator);
  }

  const lineGenerator = d3.line()
    .x(d => xScale(d.freq))
    .y(d => yScale(d.depth))
    .curve(d3.curveMonotoneY);

  const path = svg.append("path")
    .datum(dataObj.points)
    .attr("class", "d3-line-path")
    .attr("stroke", "url(#d3-line-gradient)")
    .attr("d", lineGenerator);

  const totalLength = path.node().getTotalLength();
  path
    .attr("stroke-dasharray", totalLength + " " + totalLength)
    .attr("stroke-dashoffset", totalLength)
    .transition()
    .duration(850)
    .ease(d3.easeCubicOut)
    .attr("stroke-dashoffset", 0);

  const peakPoint = dataObj.points.find(p => p.isPeak) || dataObj.points[0];
  if (peakPoint) {
    svg.append("line")
      .attr("x1", xScale(peakPoint.freq))
      .attr("y1", yScale(peakPoint.depth))
      .attr("x2", xScale(peakPoint.freq))
      .attr("y2", innerHeight)
      .attr("stroke", dataObj.color)
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4,4")
      .attr("opacity", 0.7);

    svg.append("line")
      .attr("x1", 0)
      .attr("y1", yScale(peakPoint.depth))
      .attr("x2", xScale(peakPoint.freq))
      .attr("y2", yScale(peakPoint.depth))
      .attr("stroke", dataObj.color)
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4,4")
      .attr("opacity", 0.7);

    svg.append("polygon")
      .attr("points", `${xScale(peakPoint.freq)},${yScale(peakPoint.depth) - 10} ${xScale(peakPoint.freq) + 10},${yScale(peakPoint.depth)} ${xScale(peakPoint.freq)},${yScale(peakPoint.depth) + 10} ${xScale(peakPoint.freq) - 10},${yScale(peakPoint.depth)}`)
      .attr("fill", dataObj.color)
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 2)
      .style("filter", `drop-shadow(0 0 10px ${dataObj.color})`);
  }

  const tooltip = d3.select("#d3-chart-tooltip");

  svg.selectAll(".d3-point")
    .data(dataObj.points)
    .enter()
    .append("circle")
    .attr("class", "d3-point")
    .attr("cx", d => xScale(d.freq))
    .attr("cy", d => yScale(d.depth))
    .attr("r", d => d.isPeak ? 6.5 : 4.5)
    .attr("fill", d => d.isPeak ? "#ffffff" : dataObj.color)
    .attr("stroke", dataObj.color)
    .attr("stroke-width", 2)
    .on("mouseover", (event, d) => {
      tooltip.style("opacity", "1");
      const title = isEn ? "Historical Telemetry Data" : "داده تاریخی فرکانسی";
      const peakTag = d.isPeak ? `<div style="color:${dataObj.color};font-weight:bold;">★ ${isEn ? "TARGET PEAK" : "نقطه اوج هدف"}</div>` : "";
      tooltip.html(`
        <div style="font-weight:bold;margin-bottom:4px;color:var(--gold);">${title}</div>
        ${peakTag}
        <div>${isEn ? "Depth" : "عمق"}: <b>${d.depth}m</b></div>
        <div>${isEn ? "Frequency" : "فرکانس"}: <b>${d.freq} Hz</b></div>
        <div>${isEn ? "ADC Signal" : "سیگنال ADC"}: <b>${d.adc}</b></div>
        <div>${isEn ? "Confidence" : "باند اطمینان"}: <b>${d.confLower} - ${d.confUpper} Hz</b></div>
        <div style="font-size:9px;color:#888;margin-top:4px;">${d.date}</div>
      `);
      playClickSFX();
    })
    .on("mousemove", (event) => {
      const containerRect = container.getBoundingClientRect();
      const left = event.clientX - containerRect.left + 15;
      const top = event.clientY - containerRect.top - 20;
      tooltip
        .style("left", left + "px")
        .style("top", top + "px");
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", "0");
    });
}

function selectTarget(targetId) {
  renderD3FrequencyChart(targetId);
  playClickSFX();

  if (typeof targetNodes !== "undefined" && targetNodes.length > 0) {
    const nodeMap = { gold: 0, cavity: 1, metal: 2, vein: 0 };
    const nodeIdx = nodeMap[targetId] ?? 0;
    const node = targetNodes[nodeIdx];
    if (node && node.mesh) {
      node.mesh.scale.set(1.5, 1.5, 1.5);
      setTimeout(() => node.mesh.scale.set(1.0, 1.0, 1.0), 600);
    }
  }
}

function toggleD3ConfidenceBand() {
  showConfidenceBand = !showConfidenceBand;
  renderD3FrequencyChart();
  playClickSFX();
}

function resetD3Chart() {
  showConfidenceBand = true;
  selectTarget("gold");
}

window.addEventListener("load", () => {
  setTimeout(() => renderD3FrequencyChart("gold"), 500);
});
window.addEventListener("resize", () => {
  if (typeof d3 !== "undefined") {
    renderD3FrequencyChart();
  }
});
