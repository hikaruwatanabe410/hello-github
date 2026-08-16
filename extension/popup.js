const durRow = document.getElementById('dur-row');
const targetList = document.getElementById('target-list');
const idleView = document.getElementById('idle-view');
const activeView = document.getElementById('active-view');
const timeLeftEl = document.getElementById('time-left');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');

let selectedMinutes = 15;
let targets = [];
let tickHandle = null;

durRow.addEventListener('click', (e) => {
  const btn = e.target.closest('.dur-btn');
  if (!btn) return;
  [...durRow.children].forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  selectedMinutes = parseInt(btn.dataset.min, 10);
});

function renderTargets(enabledKeys) {
  targetList.innerHTML = targets.map((t) => `
    <label class="target-item">
      <span>${t.name}</span>
      <input type="checkbox" data-key="${t.key}" ${enabledKeys.includes(t.key) ? 'checked' : ''} />
    </label>
  `).join('');
}

function getSelectedKeys() {
  return [...targetList.querySelectorAll('input[type="checkbox"]:checked')].map((i) => i.dataset.key);
}

btnStart.addEventListener('click', async () => {
  const enabledKeys = getSelectedKeys();
  await chrome.runtime.sendMessage({ type: 'START_FOCUS', minutes: selectedMinutes, enabledKeys });
  refresh();
});

btnStop.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'STOP_FOCUS' });
  refresh();
});

function formatRemaining(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

async function refresh() {
  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  if (state.focusActive) {
    idleView.classList.add('hidden');
    activeView.classList.remove('hidden');
    if (tickHandle) clearInterval(tickHandle);
    const paint = () => {
      const remaining = state.endTime - Date.now();
      timeLeftEl.textContent = formatRemaining(remaining);
      if (remaining <= 0) clearInterval(tickHandle);
    };
    paint();
    tickHandle = setInterval(paint, 1000);
  } else {
    idleView.classList.remove('hidden');
    activeView.classList.add('hidden');
    renderTargets(state.enabledKeys);
  }
}

async function init() {
  targets = await chrome.runtime.sendMessage({ type: 'GET_TARGETS' });
  await refresh();
}

init();
