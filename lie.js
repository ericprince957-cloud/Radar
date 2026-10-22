const input = document.getElementById("statement");
const pad = document.getElementById("pad");
const ring = document.getElementById("ring");
const statusText = document.getElementById("status");
const wave = document.getElementById("wave");
const wctx = wave.getContext("2d");

const result = document.getElementById("result");
const resultIcon = document.getElementById("resultIcon");
const resultText = document.getElementById("resultText");
const resultStatement = document.getElementById("resultStatement");
const resultPct = document.getElementById("resultPct");
const againBtn = document.getElementById("againBtn");

// ---------- Constants ----------
const HOLD_MS = 2500;       // how long the finger must stay on the pad
const ANALYZE_MS = 5000;    // how long the "analysis" lasts
const CIRCUMFERENCE = 339.29; // 2 * PI * 54 (ring length)
const POINTS = 120;         // how many points the graph line has

const analysisSteps = [
  "Reading pulse...",
  "Analyzing voice stress...",
  "Checking micro-expressions...",
  "Comparing with truth database...",
  "Finalizing result..."
];

// ---------- State ----------
let phase = "idle";   // "idle" | "holding" | "analyzing"
let holdStart = 0;
let holdFrame = null;
let history = new Array(POINTS).fill(0); // graph values (-1 to 1)

// ---------- Graph ----------
function drawWave(stress) {
  const W = wave.width, H = wave.height;
  wctx.clearRect(0, 0, W, H);

  // horizontal guide lines
  wctx.strokeStyle = "rgba(120, 170, 255, 0.15)";
  wctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    wctx.beginPath();
    wctx.moveTo(0, (H / 4) * i);
    wctx.lineTo(W, (H / 4) * i);
    wctx.stroke();
  }

  // the moving line
  wctx.strokeStyle = stress > 0.5 ? "#ff4d5e" : "#2dffa0";
  wctx.lineWidth = 3;
  wctx.shadowColor = wctx.strokeStyle;
  wctx.shadowBlur = 10;
  wctx.beginPath();
  history.forEach((v, i) => {
    const x = (i / (POINTS - 1)) * W;
    const y = H / 2 - v * (H / 2 - 10);
    if (i === 0) wctx.moveTo(x, y);
    else wctx.lineTo(x, y);
  });
  wctx.stroke();
  wctx.shadowBlur = 0;
}

function nextValue(stress) {
  // small random wobble + bigger random spikes as "stress" rises
  let v = (Math.random() - 0.5) * 0.15;
  if (Math.random() < 0.05 + stress * 0.2) {
    v += (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.6 * (0.5 + stress));
  }
  return Math.max(-1, Math.min(1, v));
}

drawWave(0); // empty graph at the start

// ---------- Hold on the pad ----------
function holdLoop(now) {
  if (phase !== "holding") return;
  const p = Math.min(1, (now - holdStart) / HOLD_MS);
  ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - p);
  statusText.textContent = "Scanning fingerprint... " + Math.round(p * 100) + "%";

  if (p >= 1) {
    startAnalysis();
  } else {
    holdFrame = requestAnimationFrame(holdLoop);
  }
}

function startHold(e) {
  e.preventDefault();
  if (phase !== "idle") return;

  if (!input.value.trim()) {
    input.classList.add("error");
    statusText.textContent = "Type a statement first!";
    setTimeout(() => input.classList.remove("error"), 450);
    return;
  }

  phase = "holding";
  pad.classList.add("active");
  holdStart = performance.now();
  holdFrame = requestAnimationFrame(holdLoop);
}

function cancelHold() {
  if (phase !== "holding") return;
  phase = "idle";
  cancelAnimationFrame(holdFrame);
  pad.classList.remove("active");
  ring.style.strokeDashoffset = CIRCUMFERENCE;
  statusText.textContent = "Keep your finger on the scanner!";
}

pad.addEventListener("pointerdown", startHold);
pad.addEventListener("pointerup", cancelHold);
pad.addEventListener("pointerleave", cancelHold);
pad.addEventListener("pointercancel", cancelHold);
pad.addEventListener("contextmenu", e => e.preventDefault()); // blocks long-press menu

// ---------- Analysis ----------
function startAnalysis() {
  phase = "analyzing";
  const start = performance.now();
  let lastPush = 0;

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(1, elapsed / ANALYZE_MS);

    // add a new graph point about every 35 ms
    if (now - lastPush > 35) {
      history.push(nextValue(progress));
      history.shift();
      lastPush = now;
    }
    drawWave(progress);

    const stepIndex = Math.min(analysisSteps.length - 1, Math.floor(progress * analysisSteps.length));
    statusText.textContent = analysisSteps[stepIndex];

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      showResult();
    }
  }
  requestAnimationFrame(tick);
}

function beep(freq) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const audio = new AC();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.35);
  } catch (e) { /* sound not supported */ }
}

// ---------- Result ----------
function showResult() {
  const isLie = Math.random() < 0.5;
  const confidence = 70 + Math.floor(Math.random() * 30); // 70 - 99 %

  result.classList.remove("truth", "lie");
  result.classList.add(isLie ? "lie" : "truth");
  resultIcon.textContent = isLie ? "🚨" : "✅";
  resultText.textContent = isLie ? "Lie detected!" : "Truth";
  resultStatement.textContent = "“" + input.value.trim() + "”"; // textContent = safe
  resultPct.textContent = "Confidence: " + confidence + "%";
  result.classList.remove("hidden");

  beep(isLie ? 220 : 660);
  if (navigator.vibrate) navigator.vibrate(isLie ? [300, 100, 300] : 150);
}

function reset() {
  result.classList.add("hidden");
  phase = "idle";
  pad.classList.remove("active");
  ring.style.strokeDashoffset = CIRCUMFERENCE;
  history = new Array(POINTS).fill(0);
  drawWave(0);
  input.value = "";
  statusText.textContent = "Waiting for input...";
}

againBtn.addEventListener("click", reset);
