import { HeadTracker } from './headtracker.js';
import { Game } from './game.js';
import { Storage } from './storage.js';

const video = document.getElementById('video');
const canvas = document.getElementById('gameCanvas');
const scoreEl = document.getElementById('score');
const highEl = document.getElementById('highScore');
const historyList = document.getElementById('historyList');
const calibrateBtn = document.getElementById('calibrateBtn');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const exportBtn = document.getElementById('exportBtn');
const importInput = document.getElementById('importInput');

let lastDirection = null;
let tracker = null;
let game = null;

function refreshUI() {
  highEl.textContent = Storage.getHighScore();
  const history = Storage.getHistory();
  historyList.innerHTML = history.slice().reverse().map(h => `
    <li class="history-entry">${new Date(h.time).toLocaleString()} — ${h.score} 分</li>
  `).join('');
}

async function init() {
  refreshUI();

  // Reduce canvas backing resolution to save GPU work but keep CSS size
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const baseSize = 360; // logical backing size (smaller than CSS size)
  canvas.width = Math.floor(baseSize * dpr);
  canvas.height = Math.floor(baseSize * dpr);

  game = new Game(canvas, ({score}) => {
    // game over
    Storage.pushHistory(score);
    Storage.maybeSetHighScore(score);
    refreshUI();
    startBtn.disabled = false;
    stopBtn.disabled = true;
    // stop tracking to save resources
    if (tracker) tracker.stop();
    alert(`游戏结束，得分：${score}`);
  }, ({score}) => {
    scoreEl.textContent = score;
  });

  // create tracker (will start camera now to show preview and allow calibration)
  tracker = new HeadTracker(video, (dir) => {
    // receive 'up'|'down'|'left'|'right' or null
    lastDirection = dir;
  }, { maxFPS: 10, width: 320, height: 240, refineLandmarks: false });

  try {
    await tracker.start();
  } catch (err) {
    console.warn('摄像头启动（预览）失败：', err);
    // don't block page; keep UI functional for users without camera
  }

  // UI: sensitivity / dead-zone / mirror controls
  const sensitivityInput = document.getElementById('sensitivity');
  const sensitivityVal = document.getElementById('sensitivityVal');
  const deadzoneInput = document.getElementById('deadzone');
  const deadzoneVal = document.getElementById('deadzoneVal');
  const mirrorCheckbox = document.getElementById('mirrorVideo');

  // initialize based on tracker defaults
  if (sensitivityInput) {
    sensitivityInput.value = tracker.sensitivity || 1;
    sensitivityVal.textContent = Number(sensitivityInput.value).toFixed(1);
    sensitivityInput.addEventListener('input', (e) => {
      const v = Number(e.target.value);
      sensitivityVal.textContent = v.toFixed(1);
      tracker.setSensitivity(v);
    });
  }

  if (deadzoneInput) {
    deadzoneInput.value = tracker.deadZone;
    deadzoneVal.textContent = (tracker.deadZone * 100).toFixed(1) + '%';
    deadzoneInput.addEventListener('input', (e) => {
      const v = Number(e.target.value);
      deadzoneVal.textContent = (v * 100).toFixed(1) + '%';
      tracker.setDeadZone(v);
    });
  }

  if (mirrorCheckbox) {
    mirrorCheckbox.checked = true;
    const applyMirror = (checked) => {
      if (checked) video.classList.add('mirrored'); else video.classList.remove('mirrored');
      if (tracker && typeof tracker.setMirror === 'function') tracker.setMirror(checked);
    };
    applyMirror(mirrorCheckbox.checked);
    mirrorCheckbox.addEventListener('change', (e) => applyMirror(e.target.checked));
  }

  calibrateBtn.addEventListener('click', async () => {
    calibrateBtn.disabled = true;
    calibrateBtn.textContent = '校准中...';
    try {
      if (tracker && typeof tracker.start === 'function') await tracker.start();
      await tracker.calibrate();
      alert('校准完成');
    } catch (err) {
      console.error('校准失败', err);
      alert('校准失败：' + (err && err.message ? err.message : err));
    } finally {
      calibrateBtn.textContent = '校准（自然姿态）';
      calibrateBtn.disabled = false;
    }
  });

  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    try {
      if (tracker && typeof tracker.start === 'function') await tracker.start();
      game.start();
      stopBtn.disabled = false;
    } catch (err) {
      console.error('启动摄像头或游戏失败', err);
      alert('启动失败：' + (err && err.message ? err.message : err));
      startBtn.disabled = false;
    }
  });

  stopBtn.addEventListener('click', () => {
    game.stop();
    // optionally stop tracker to save resources when user stops
    try { if (tracker && typeof tracker.stop === 'function') tracker.stop(); } catch (e) { /* ignore */ }
    startBtn.disabled = false;
    stopBtn.disabled = true;
  });

  exportBtn.addEventListener('click', () => {
    const data = Storage.export();
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sneck-data.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  importInput.addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const txt = await f.text();
      const json = JSON.parse(txt);
      Storage.import(json);
      refreshUI();
      alert('导入成功');
    } catch (err) {
      alert('导入失败：' + err.message);
    }
  });

  // Every game tick, apply latest head direction if available
  game.onTick(() => {
    if (lastDirection) {
      game.setDirection(lastDirection);
    }
  });
}

init();
