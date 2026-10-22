const canvas = document.getElementById("radar");
const ctx = canvas.getContext("2d");
const startBtn = document.getElementById("startBtn");
const againBtn = document.getElementById("againBtn");
const statusText = document.getElementById("status");
const flash = document.getElementById("flash");
const warning = document.getElementById("warning");
const warningText = document.getElementById("warningText");
const radarWrap = document.getElementById("radarWrap");

// ---------- Constants ----------
const SIZE = canvas.width;          // 800 (drawn big, shown smaller = sharp)
const C = SIZE / 2;                 // centre point
const R = C - 20;                   // radar radius
const TAU = Math.PI * 2;            // one full circle in radians
const SPEED = 2.2;                  // radians per SECOND

const messages = [
  "Fool detected!",
  "Stupid person close by!",
  "Warning: idiot nearby!",
  "Foolishness level: CRITICAL",
  "Danger! Silly human detected",
  "Alert: fool within 2 metres!"
];

// ---------- State ----------
let state = "idle";   // "idle" | "scanning" | "found"
let sweep = 0;        // current angle of the scanning line
let total = 0;        // total angle turned since scan started
let revealAt = 0;     // when "total" reaches this, the dot is found
let blip = null;      // the blue dot {x, y}
let foundTime = 0;
let lastTime = 0;

// ---------- Helpers ----------
function makeBlip() {
  const angle = Math.random() * TAU;
  // sqrt makes dots spread evenly over the whole circle (not bunched in the middle)
  const dist = Math.sqrt(Math.random()) * (R - 50);
  return {
    angle: angle,
    x: C + Math.cos(angle) * dist,
    y: C + Math.sin(angle) * dist
  };
}

// ---------- Drawing ----------
function drawBackground() {
  const g = ctx.createRadialGradient(C, C, 0, C, C, R);
  g.addColorStop(0, "#07301c");
  g.addColorStop(1, "#021208");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(C, C, R, 0, TAU);
  ctx.fill();
}

function drawGrid() {
  ctx.strokeStyle = "rgba(45, 255, 160, 0.35)";
  ctx.lineWidth = 1.5;

  for (let i = 1; i <= 4; i++) {
    ctx.beginPath();
    ctx.arc(C, C, (R / 4) * i, 0, TAU);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(C, C - R); ctx.lineTo(C, C + R);
  ctx.moveTo(C - R, C); ctx.lineTo(C + R, C);
  ctx.stroke();

  // small tick marks around the edge
  for (let i = 0; i < 72; i++) {
    const a = (TAU / 72) * i;
    const len = i % 6 === 0 ? 18 : 8;
    ctx.beginPath();
    ctx.moveTo(C + Math.cos(a) * R, C + Math.sin(a) * R);
    ctx.lineTo(C + Math.cos(a) * (R - len), C + Math.sin(a) * (R - len));
    ctx.stroke();
  }
}

function drawSweep() {
  // Conic gradient = colour that rotates around a centre point
  const trail = 1.3; // length of the glowing trail in radians
  const g = ctx.createConicGradient(sweep - trail, C, C);
  g.addColorStop(0, "rgba(45, 255, 160, 0)");
  g.addColorStop(trail / TAU, "rgba(45, 255, 160, 0.5)");
  g.addColorStop(trail / TAU + 0.001, "rgba(45, 255, 160, 0)");
  g.addColorStop(1, "rgba(45, 255, 160, 0)");

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(C, C, R, 0, TAU);
  ctx.fill();

  // bright leading line
  ctx.strokeStyle = "#2dffa0";
  ctx.lineWidth = 3;
  ctx.shadowColor = "#2dffa0";
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.moveTo(C, C);
  ctx.lineTo(C + Math.cos(sweep) * R, C + Math.sin(sweep) * R);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawBlip(now) {
  if (!blip || state !== "found") return;

  // expanding ping rings
  const t = (now - foundTime) / 1000;
  for (let k = 0; k < 3; k++) {
    const phase = (t * 0.9 + k / 3) % 1;
    ctx.strokeStyle = `rgba(96, 165, 250, ${1 - phase})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(blip.x, blip.y, 10 + phase * 70, 0, TAU);
    ctx.stroke();
  }

  // glowing blue dot with a white core
  const pulse = 14 + Math.sin(now / 90) * 3;
  ctx.shadowColor = "#3b82f6";
  ctx.shadowBlur = 30;
  ctx.fillStyle = "#3b82f6";
  ctx.beginPath();
  ctx.arc(blip.x, blip.y, pulse, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#dbeafe";
  ctx.beginPath();
  ctx.arc(blip.x, blip.y, pulse / 3, 0, TAU);
  ctx.fill();
}

function draw(now) {
  ctx.clearRect(0, 0, SIZE, SIZE);
  drawBackground();
  drawGrid();
  if (state === "scanning") drawSweep();
  drawBlip(now);
}

// ---------- Animation loop ----------
function loop(now) {
  const dt = (now - lastTime) / 1000; // seconds since last frame
  lastTime = now;

  if (state === "scanning") {
    const step = SPEED * dt;
    sweep = (sweep + step) % TAU;
    total += step;

    // the sweep line has now passed over the hidden dot
    if (total >= revealAt) {
      state = "found";
      foundTime = now;
      statusText.textContent = "⚠ Object detected...";
      setTimeout(triggerWarning, 1200);
    }
  }

  draw(now);
  if (state !== "idle") requestAnimationFrame(loop);
}

// ---------- Actions ----------
function startScan() {
  blip = makeBlip();
  sweep = 0;
  total = 0;
  revealAt = TAU * 2 + blip.angle; // 2 full turns, then reach the dot's angle
  state = "scanning";
  startBtn.disabled = true;
  statusText.textContent = "Scanning area...";
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function beep() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const audio = new AC();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.3);
  } catch (e) { /* sound not supported */ }
}

function triggerWarning() {
  flash.classList.remove("active");
  void flash.offsetWidth; // forces the animation to restart
  flash.classList.add("active");

  radarWrap.classList.add("shake");
  beep();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

  warningText.textContent = messages[Math.floor(Math.random() * messages.length)];
  setTimeout(() => {
    warning.classList.remove("hidden");
    radarWrap.classList.remove("shake");
  }, 600);
}

function reset() {
  warning.classList.add("hidden");
  state = "idle";
  blip = null;
  startBtn.disabled = false;
  statusText.textContent = "System ready";
  requestAnimationFrame(draw);
}

startBtn.addEventListener("click", startScan);
againBtn.addEventListener("click", reset);

draw(performance.now()); // draw the empty radar when the page loads
