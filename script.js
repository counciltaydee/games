const STEPS = 16;
const tracks = [
  { id: "kick", name: "KICK", meta: "LOW / 01", icon: "●", color: "#ff765f", pattern: [0, 4, 8, 12] },
  { id: "snare", name: "SNARE", meta: "MID / 02", icon: "╳", color: "#6a83f5", pattern: [4, 12] },
  { id: "hat", name: "HI-HAT", meta: "HIGH / 03", icon: "✦", color: "#d3b629", pattern: [0, 2, 4, 6, 8, 10, 12, 14] },
  { id: "clap", name: "CLAP", meta: "MID / 04", icon: "≋", color: "#a477d8", pattern: [4, 12] },
];

const state = {
  playing: false,
  currentStep: -1,
  tempo: 110,
  swing: 0,
  timer: null,
  audio: null,
  patterns: Object.fromEntries(tracks.map((track) => [track.id, new Set(track.pattern)])),
};

const trackRows = document.querySelector("#trackRows");
const stepNumbers = document.querySelector("#stepNumbers");
const playButton = document.querySelector("#playButton");
const playLabel = document.querySelector("#playLabel");
const statusText = document.querySelector("#statusText");
const stepReadout = document.querySelector("#stepReadout");
const tempoSlider = document.querySelector("#tempoSlider");
const tempoValue = document.querySelector("#tempoValue");
const bpmBadge = document.querySelector("#bpmBadge");
const swingSlider = document.querySelector("#swingSlider");
const swingValue = document.querySelector("#swingValue");

for (let step = 0; step < STEPS; step += 1) {
  const number = document.createElement("span");
  number.textContent = String(step + 1).padStart(2, "0");
  stepNumbers.append(number);
}

tracks.forEach((track) => {
  const row = document.createElement("div");
  row.className = "track-row";
  row.dataset.track = track.id;
  row.style.setProperty("--track-color", track.color);
  row.innerHTML = `
    <div class="track-name">
      <span class="track-icon">${track.icon}</span>
      <span>${track.name}<small class="track-meta">${track.meta}</small></span>
    </div>
    <div class="step-grid">
      ${Array.from({ length: STEPS }, (_, step) => `
        <button class="step ${state.patterns[track.id].has(step) ? "active" : ""}"
          type="button" data-track="${track.id}" data-step="${step}"
          aria-label="${track.name} step ${step + 1}" aria-pressed="${state.patterns[track.id].has(step)}"></button>
      `).join("")}
    </div>
  `;
  trackRows.append(row);
});

function initAudio() {
  if (!state.audio) state.audio = new (window.AudioContext || window.webkitAudioContext)();
  if (state.audio.state === "suspended") state.audio.resume();
}

function playKick(time) {
  const oscillator = state.audio.createOscillator();
  const gain = state.audio.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(145, time);
  oscillator.frequency.exponentialRampToValueAtTime(48, time + 0.16);
  gain.gain.setValueAtTime(0.9, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.32);
  oscillator.connect(gain).connect(state.audio.destination);
  oscillator.start(time);
  oscillator.stop(time + 0.33);
}

function playNoise(time, duration, volume, filterFrequency) {
  const buffer = state.audio.createBuffer(1, state.audio.sampleRate * duration, state.audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  const source = state.audio.createBufferSource();
  const filter = state.audio.createBiquadFilter();
  const gain = state.audio.createGain();
  source.buffer = buffer;
  filter.type = "highpass";
  filter.frequency.value = filterFrequency;
  gain.gain.setValueAtTime(volume, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
  source.connect(filter).connect(gain).connect(state.audio.destination);
  source.start(time);
}

function playSnare(time) { playNoise(time, 0.18, 0.42, 900); }
function playHat(time) { playNoise(time, 0.055, 0.18, 5000); }
function playClap(time) {
  playNoise(time, 0.13, 0.3, 1200);
  playNoise(time + 0.025, 0.1, 0.18, 1500);
}

function triggerTrack(trackId, time) {
  if (trackId === "kick") playKick(time);
  if (trackId === "snare") playSnare(time);
  if (trackId === "hat") playHat(time);
  if (trackId === "clap") playClap(time);
}

function updateStepHighlight() {
  document.querySelectorAll(".step.current").forEach((step) => step.classList.remove("current"));
  if (state.currentStep >= 0) {
    document.querySelectorAll(`[data-step="${state.currentStep}"]`).forEach((step) => step.classList.add("current"));
    stepReadout.textContent = `STEP ${String(state.currentStep + 1).padStart(2, "0")} / 16`;
  }
}

function tick() {
  state.currentStep = (state.currentStep + 1) % STEPS;
  const now = state.audio.currentTime;
  tracks.forEach((track) => {
    if (state.patterns[track.id].has(state.currentStep)) triggerTrack(track.id, now);
  });
  updateStepHighlight();
  const baseDuration = 60000 / state.tempo / 4;
  const swingOffset = state.currentStep % 2 ? baseDuration * (state.swing / 100) : 0;
  state.timer = window.setTimeout(tick, baseDuration + swingOffset);
}

function setPlaying(playing) {
  state.playing = playing;
  playButton.classList.toggle("active", playing);
  playLabel.textContent = playing ? "PAUSE" : "PLAY";
  playButton.querySelector(".play-icon").textContent = playing ? "Ⅱ" : "▶";
  statusText.textContent = playing ? "PLAYING LOOP" : "READY TO PLAY";
  if (playing) {
    initAudio();
    state.currentStep = -1;
    tick();
  } else {
    window.clearTimeout(state.timer);
  }
}

playButton.addEventListener("click", () => setPlaying(!state.playing));
document.querySelector("#stopButton").addEventListener("click", () => {
  setPlaying(false);
  state.currentStep = -1;
  updateStepHighlight();
  stepReadout.textContent = "STEP 01 / 16";
});

trackRows.addEventListener("click", (event) => {
  const step = event.target.closest(".step");
  if (!step) return;
  initAudio();
  const { track, step: stepIndex } = step.dataset;
  const index = Number(stepIndex);
  const pattern = state.patterns[track];
  if (pattern.has(index)) pattern.delete(index);
  else {
    pattern.add(index);
    triggerTrack(track, state.audio.currentTime);
  }
  step.classList.toggle("active", pattern.has(index));
  step.setAttribute("aria-pressed", pattern.has(index));
});

tempoSlider.addEventListener("input", () => {
  state.tempo = Number(tempoSlider.value);
  tempoValue.value = `${state.tempo} BPM`;
  bpmBadge.textContent = state.tempo;
});
swingSlider.addEventListener("input", () => {
  state.swing = Number(swingSlider.value);
  swingValue.value = `${state.swing}%`;
});

document.querySelector("#clearButton").addEventListener("click", () => {
  tracks.forEach((track) => state.patterns[track.id].clear());
  document.querySelectorAll(".step.active").forEach((step) => {
    step.classList.remove("active");
    step.setAttribute("aria-pressed", "false");
  });
});

document.querySelector("#randomButton").addEventListener("click", () => {
  tracks.forEach((track, trackIndex) => {
    const pattern = state.patterns[track.id];
    pattern.clear();
    for (let step = 0; step < STEPS; step += 1) {
      const chance = trackIndex === 0 ? 0.25 : trackIndex === 2 ? 0.62 : 0.16;
      if (Math.random() < chance) pattern.add(step);
    }
  });
  document.querySelectorAll(".step").forEach((step) => {
    const isActive = state.patterns[step.dataset.track].has(Number(step.dataset.step));
    step.classList.toggle("active", isActive);
    step.setAttribute("aria-pressed", isActive);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.target.matches("input")) return;
  if (event.code === "Space") {
    event.preventDefault();
    setPlaying(!state.playing);
  }
  if (event.key.toLowerCase() === "r") document.querySelector("#randomButton").click();
});
