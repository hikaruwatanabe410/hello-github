const timerEl = document.getElementById('timer');

function format(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

async function paint() {
  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  if (!state.focusActive) {
    timerEl.textContent = 'SHIELD DOWN';
    return;
  }
  timerEl.textContent = format(state.endTime - Date.now());
}

paint();
setInterval(paint, 1000);
