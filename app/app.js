/* ============================================================
   NOVA FOCUS — gamified focus/distraction-blocker front end
   Pure vanilla JS, persists to localStorage. No build step.
   ============================================================ */

const STORAGE_KEY = 'novafocus.state.v1';

const DEFAULT_BLOCKLIST = [
  { id: 'whatsapp', name: 'WhatsApp', domain: 'web.whatsapp.com', emoji: '💬', on: true },
  { id: 'line', name: 'LINE', domain: 'line.me', emoji: '🟢', on: true },
  { id: 'instagram', name: 'Instagram', domain: 'instagram.com', emoji: '📸', on: true },
  { id: 'tiktok', name: 'TikTok', domain: 'tiktok.com', emoji: '🎵', on: true },
  { id: 'x', name: 'X / Twitter', domain: 'x.com', emoji: '🐦', on: true },
  { id: 'facebook', name: 'Facebook', domain: 'facebook.com', emoji: '📘', on: false },
  { id: 'youtube', name: 'YouTube', domain: 'youtube.com', emoji: '▶️', on: false },
  { id: 'discord', name: 'Discord', domain: 'discord.com', emoji: '🎮', on: false },
  { id: 'reddit', name: 'Reddit', domain: 'reddit.com', emoji: '👽', on: false },
];

const ACHIEVEMENTS = [
  { id: 'first_contact', name: 'First Contact', desc: 'Complete your first mission', icon: '🛰️', test: s => s.stats.sessions >= 1 },
  { id: 'streak_3', name: 'Momentum', desc: 'Reach a 3-day streak', icon: '🔥', test: s => s.stats.streak >= 3 },
  { id: 'streak_7', name: 'Committed', desc: 'Reach a 7-day streak', icon: '⚡', test: s => s.stats.streak >= 7 },
  { id: 'streak_30', name: 'Unstoppable', desc: 'Reach a 30-day streak', icon: '🌌', test: s => s.stats.streak >= 30 },
  { id: 'centurion', name: 'Centurion', desc: 'Bank 100 focus minutes', icon: '💠', test: s => s.stats.minutes >= 100 },
  { id: 'marathoner', name: 'Marathoner', desc: 'Bank 500 focus minutes', icon: '🚀', test: s => s.stats.minutes >= 500 },
  { id: 'iron_will', name: 'Iron Will', desc: 'Finish a mission with 100% integrity', icon: '🛡️', test: s => s.stats.perfectMissions >= 1 },
  { id: 'ghost', name: 'Ghost Protocol', desc: 'Complete 5 missions in Lockdown Mode', icon: '👻', test: s => s.stats.lockdownCompletes >= 5 },
  { id: 'lvl5', name: 'Rising Signal', desc: 'Reach Level 5', icon: '📡', test: s => s.stats.level >= 5 },
  { id: 'lvl10', name: 'Vanguard', desc: 'Reach Level 10', icon: '⭐', test: s => s.stats.level >= 10 },
  { id: 'night_owl', name: 'Night Owl', desc: 'Complete a mission after 10 PM', icon: '🌙', test: s => s.stats._nightOwl },
  { id: 'early_bird', name: 'Early Bird', desc: 'Complete a mission before 7 AM', icon: '🌅', test: s => s.stats._earlyBird },
];

const RANKS = [
  [1, 'INITIATE'], [3, 'OPERATIVE'], [6, 'SPECIALIST'], [10, 'VANGUARD'],
  [15, 'SENTINEL'], [20, 'OVERMIND'],
];

function xpNeeded(level) { return 100 + (level - 1) * 45; }

function rankForLevel(level) {
  let r = RANKS[0][1];
  for (const [lvl, name] of RANKS) if (level >= lvl) r = name;
  return r;
}

function defaultState() {
  return {
    stats: {
      level: 1, xp: 0, streak: 0, bestStreak: 0, sessions: 0, minutes: 0,
      perfectMissions: 0, lockdownCompletes: 0, lastSessionDate: null,
      _nightOwl: false, _earlyBird: false,
    },
    blocklist: DEFAULT_BLOCKLIST,
    unlocked: [],
    log: [],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed, stats: { ...defaultState().stats, ...parsed.stats } };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

/* ---------------- Mission runtime (not persisted) ---------------- */
const mission = {
  active: false,
  totalSeconds: 0,
  remaining: 0,
  integrity: 100,
  lockdown: false,
  breaches: 0,
  timerId: null,
  startedAt: null,
};

/* ================= DOM refs ================= */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const el = {
  navTabs: $('#nav-tabs'),
  views: $$('.view'),
  xpFill: $('#xp-fill'), xpCur: $('#xp-cur'), xpNeed: $('#xp-need'),
  rankTitle: $('#rank-title'), lvlNum: $('#lvl-num'),
  statStreak: $('#stat-streak'), statSessions: $('#stat-sessions'),
  statMinutes: $('#stat-minutes'), statBest: $('#stat-best'),
  durationPicker: $('#duration-picker'),
  lockdownToggle: $('#lockdown-toggle'),
  btnLaunch: $('#btn-launch'),
  blocklistPreview: $('#blocklist-preview'),
  setupPanel: $('#setup-panel'),
  activePanel: $('#active-panel'),
  completePanel: $('#complete-panel'),
  ringFill: $('#ring-fill'),
  timerTime: $('#timer-time'),
  integrityFill: $('#integrity-fill'),
  integrityPct: $('#integrity-pct'),
  breachFeed: $('#breach-feed'),
  btnAbort: $('#btn-abort'),
  missionStatusLabel: $('#mission-status-label'),
  completeTitle: $('#complete-title'),
  completeSub: $('#complete-sub'),
  completeBadges: $('#complete-badges'),
  btnReturn: $('#btn-return'),
  blockGrid: $('#block-grid'),
  addName: $('#add-name'),
  addDomain: $('#add-domain'),
  addBtn: $('#add-btn'),
  badgeGrid: $('#badge-grid'),
  logList: $('#log-list'),
  toastStack: $('#toast-stack'),
};

let selectedMinutes = 25;

/* ================= Navigation ================= */
el.navTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  $$('.tab-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  const view = btn.dataset.view;
  el.views.forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  if (view === 'blocklist') renderBlocklist();
  if (view === 'achievements') renderBadges();
  if (view === 'log') renderLog();
});

/* ================= Rendering: dashboard stats ================= */
function renderStats() {
  const need = xpNeeded(state.stats.level);
  el.xpFill.style.width = `${Math.min(100, (state.stats.xp / need) * 100)}%`;
  el.xpCur.textContent = state.stats.xp;
  el.xpNeed.textContent = need;
  el.rankTitle.textContent = rankForLevel(state.stats.level);
  el.lvlNum.textContent = state.stats.level;
  el.statStreak.textContent = state.stats.streak;
  el.statSessions.textContent = state.stats.sessions;
  el.statMinutes.textContent = state.stats.minutes;
  el.statBest.textContent = state.stats.bestStreak;
  renderBlocklistPreview();
}

function renderBlocklistPreview() {
  const active = state.blocklist.filter((b) => b.on);
  el.blocklistPreview.innerHTML = active.length
    ? active.map((b) => `<span class="chip on">${b.emoji} ${escapeHtml(b.name)}</span>`).join('')
    : `<span class="chip">No apps armed — add some in the Blocklist tab</span>`;
}

/* ================= Duration picker ================= */
el.durationPicker.addEventListener('click', (e) => {
  const btn = e.target.closest('.dur-btn');
  if (!btn) return;
  $$('.dur-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  if (btn.dataset.min === 'custom') {
    const v = prompt('Custom mission length (minutes):', '30');
    const n = parseInt(v, 10);
    selectedMinutes = Number.isFinite(n) && n > 0 ? Math.min(n, 240) : 25;
    btn.textContent = `${selectedMinutes}`;
  } else {
    selectedMinutes = parseInt(btn.dataset.min, 10);
  }
});

/* ================= Mission lifecycle ================= */
el.btnLaunch.addEventListener('click', startMission);
el.btnAbort.addEventListener('click', () => abortMission());
el.btnReturn.addEventListener('click', () => {
  el.completePanel.classList.add('hidden');
  el.setupPanel.classList.remove('hidden');
});

function startMission() {
  mission.active = true;
  mission.totalSeconds = selectedMinutes * 60;
  mission.remaining = mission.totalSeconds;
  mission.integrity = 100;
  mission.breaches = 0;
  mission.lockdown = el.lockdownToggle.checked;
  mission.startedAt = Date.now();

  el.setupPanel.classList.add('hidden');
  el.completePanel.classList.add('hidden');
  el.activePanel.classList.remove('hidden');
  el.breachFeed.innerHTML = '';
  el.missionStatusLabel.textContent = mission.lockdown ? 'LOCKDOWN ENGAGED' : 'SHIELD ACTIVE';
  updateIntegrityUI();
  updateTimerUI();

  if (mission.lockdown && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  }

  window.addEventListener('beforeunload', beforeUnloadHandler);
  document.addEventListener('visibilitychange', onVisibilityChange);

  mission.timerId = setInterval(tick, 1000);
  toast(`Mission launched — ${selectedMinutes} min. Stay in the grid.`);
}

function tick() {
  mission.remaining -= 1;
  updateTimerUI();
  if (mission.remaining <= 0) {
    finishMission(true);
  }
  if (mission.integrity <= 0) {
    finishMission(false, 'integrity');
  }
}

function updateTimerUI() {
  const m = Math.floor(mission.remaining / 60).toString().padStart(2, '0');
  const s = Math.floor(mission.remaining % 60).toString().padStart(2, '0');
  el.timerTime.textContent = `${m}:${s}`;
  const frac = mission.remaining / mission.totalSeconds;
  const circumference = 2 * Math.PI * 100;
  el.ringFill.style.strokeDashoffset = `${circumference * (1 - frac)}`;
  el.ringFill.style.strokeDasharray = `${circumference}`;
}

function updateIntegrityUI() {
  el.integrityFill.style.width = `${mission.integrity}%`;
  el.integrityPct.textContent = `${mission.integrity}%`;
  el.integrityFill.style.background = mission.integrity > 60
    ? 'linear-gradient(90deg, var(--green), var(--cyan))'
    : mission.integrity > 30
      ? 'linear-gradient(90deg, var(--amber), var(--red))'
      : 'var(--red)';
}

function onVisibilityChange() {
  if (!mission.active) return;
  if (document.hidden) {
    registerBreach();
  }
}

function registerBreach() {
  mission.breaches += 1;
  mission.integrity = Math.max(0, mission.integrity - 20);
  updateIntegrityUI();
  const item = document.createElement('div');
  item.className = 'breach-item';
  const t = new Date().toLocaleTimeString();
  item.textContent = `⚠ BREACH DETECTED [${t}] — focus lost, integrity -20%`;
  el.breachFeed.prepend(item);
  while (el.breachFeed.children.length > 5) el.breachFeed.removeChild(el.breachFeed.lastChild);
}

function beforeUnloadHandler(e) {
  if (mission.active) {
    e.preventDefault();
    e.returnValue = '';
  }
}

function abortMission() {
  if (!confirm('Abort the mission? Progress toward XP will be lost.')) return;
  finishMission(false, 'aborted');
}

function finishMission(success, failReason) {
  clearInterval(mission.timerId);
  mission.active = false;
  window.removeEventListener('beforeunload', beforeUnloadHandler);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});

  const elapsedSeconds = mission.totalSeconds - Math.max(0, mission.remaining);
  const minutes = Math.round(elapsedSeconds / 60);
  const hour = new Date().getHours();

  el.activePanel.classList.add('hidden');

  if (success) {
    const perfect = mission.breaches === 0;
    let xpGain = minutes * 2;
    if (perfect) xpGain = Math.round(xpGain * 1.25);
    if (mission.lockdown) xpGain += 10;

    state.stats.sessions += 1;
    state.stats.minutes += minutes;
    if (perfect) state.stats.perfectMissions += 1;
    if (mission.lockdown) state.stats.lockdownCompletes += 1;
    if (hour >= 22 || hour < 4) state.stats._nightOwl = true;
    if (hour < 7) state.stats._earlyBird = true;

    updateStreak();
    grantXp(xpGain);

    state.log.unshift({
      date: new Date().toISOString(), minutes, ok: true, breaches: mission.breaches,
      lockdown: mission.lockdown,
    });

    const newBadges = checkAchievements();
    saveState();
    renderStats();

    el.completeTitle.textContent = perfect ? 'MISSION COMPLETE — FLAWLESS' : 'MISSION COMPLETE';
    el.completeSub.textContent = `+${xpGain} XP earned · ${minutes} min focused${mission.breaches ? ` · ${mission.breaches} breach(es)` : ''}`;
    el.completeBadges.innerHTML = newBadges.map((b) => `<span class="chip">${b.icon} ${b.name}</span>`).join('');
    el.completePanel.classList.remove('hidden');
  } else {
    state.log.unshift({
      date: new Date().toISOString(), minutes, ok: false,
      reason: failReason || 'aborted', breaches: mission.breaches, lockdown: mission.lockdown,
    });
    saveState();
    renderStats();
    toast(failReason === 'integrity' ? 'Integrity depleted — mission failed.' : 'Mission aborted.', true);
    el.setupPanel.classList.remove('hidden');
  }
}

function updateStreak() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const last = state.stats.lastSessionDate ? new Date(state.stats.lastSessionDate) : null;
  if (last) last.setHours(0, 0, 0, 0);

  if (!last) {
    state.stats.streak = 1;
  } else {
    const diffDays = Math.round((today - last) / 86400000);
    if (diffDays === 0) {
      // already logged today, streak unchanged
    } else if (diffDays === 1) {
      state.stats.streak += 1;
    } else {
      state.stats.streak = 1;
    }
  }
  state.stats.lastSessionDate = today.toISOString();
  state.stats.bestStreak = Math.max(state.stats.bestStreak, state.stats.streak);
}

function grantXp(amount) {
  state.stats.xp += amount;
  while (state.stats.xp >= xpNeeded(state.stats.level)) {
    state.stats.xp -= xpNeeded(state.stats.level);
    state.stats.level += 1;
    toast(`⬆ LEVEL UP — now Level ${state.stats.level} (${rankForLevel(state.stats.level)})`);
  }
}

function checkAchievements() {
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (!state.unlocked.includes(a.id) && a.test(state)) {
      state.unlocked.push(a.id);
      fresh.push(a);
      toast(`🏅 Badge unlocked: ${a.name}`);
    }
  }
  return fresh;
}

/* ================= Blocklist view ================= */
function renderBlocklist() {
  el.blockGrid.innerHTML = state.blocklist.map((b) => `
    <div class="block-item ${b.on ? 'on' : ''}" data-id="${b.id}">
      <div class="block-left">
        <span class="block-emoji">${b.emoji}</span>
        <div>
          <div class="block-name">${escapeHtml(b.name)}</div>
          <div class="block-domain">${escapeHtml(b.domain || '')}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <label class="switch">
          <input type="checkbox" class="block-toggle" ${b.on ? 'checked' : ''} />
          <span class="slider"></span>
        </label>
        <button class="block-remove" title="Remove">✕</button>
      </div>
    </div>
  `).join('');
}

el.blockGrid.addEventListener('change', (e) => {
  if (!e.target.classList.contains('block-toggle')) return;
  const item = e.target.closest('.block-item');
  const id = item.dataset.id;
  const entry = state.blocklist.find((b) => b.id === id);
  entry.on = e.target.checked;
  item.classList.toggle('on', entry.on);
  saveState();
  renderBlocklistPreview();
});

el.blockGrid.addEventListener('click', (e) => {
  if (!e.target.classList.contains('block-remove')) return;
  const item = e.target.closest('.block-item');
  const id = item.dataset.id;
  state.blocklist = state.blocklist.filter((b) => b.id !== id);
  saveState();
  renderBlocklist();
  renderBlocklistPreview();
});

el.addBtn.addEventListener('click', () => {
  const name = el.addName.value.trim();
  if (!name) return;
  const domain = el.addDomain.value.trim();
  state.blocklist.push({
    id: `custom_${Date.now()}`, name, domain, emoji: '🚫', on: true,
  });
  el.addName.value = '';
  el.addDomain.value = '';
  saveState();
  renderBlocklist();
  renderBlocklistPreview();
});

/* ================= Badges view ================= */
function renderBadges() {
  el.badgeGrid.innerHTML = ACHIEVEMENTS.map((a) => {
    const unlocked = state.unlocked.includes(a.id);
    return `
      <div class="badge ${unlocked ? 'unlocked' : ''}">
        <div class="badge-icon">${a.icon}</div>
        <div class="badge-name">${a.name}</div>
        <div class="badge-desc">${unlocked ? a.desc : '???'}</div>
      </div>`;
  }).join('');
}

/* ================= Log view ================= */
function renderLog() {
  if (!state.log.length) {
    el.logList.innerHTML = `<div class="log-empty">No missions logged yet. Launch one from the Dashboard.</div>`;
    return;
  }
  el.logList.innerHTML = state.log.slice(0, 50).map((l) => {
    const d = new Date(l.date);
    return `
      <div class="log-item ${l.ok ? '' : 'fail'}">
        <div class="log-left">
          <span class="log-status ${l.ok ? 'ok' : 'fail'}">${l.ok ? 'COMPLETE' : (l.reason || 'FAILED').toUpperCase()}</span>
          <span>${l.minutes} min${l.lockdown ? ' · lockdown' : ''}${l.breaches ? ` · ${l.breaches} breach(es)` : ''}</span>
        </div>
        <div class="log-meta">${d.toLocaleDateString()} ${d.toLocaleTimeString()}</div>
      </div>`;
  }).join('');
}

/* ================= Toasts ================= */
function toast(msg, warn = false) {
  const t = document.createElement('div');
  t.className = `toast ${warn ? 'warn' : ''}`;
  t.textContent = msg;
  el.toastStack.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/* ================= Animated background (canvas particles + grid) ================= */
function initCanvas() {
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');
  let w, h, particles;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const COUNT = 70;
  particles = Array.from({ length: COUNT }, () => ({
    x: Math.random() * 1000,
    y: Math.random() * 1000,
    vx: (Math.random() - 0.5) * 0.25,
    vy: (Math.random() - 0.5) * 0.25,
    r: Math.random() * 1.6 + 0.4,
  }));

  function frame() {
    ctx.clearRect(0, 0, w, h);

    // subtle grid
    ctx.strokeStyle = 'rgba(23,233,255,0.05)';
    ctx.lineWidth = 1;
    const gap = 60;
    for (let x = 0; x < w; x += gap) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += gap) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
      ctx.beginPath();
      ctx.fillStyle = mission.active ? 'rgba(255,59,92,0.55)' : 'rgba(23,233,255,0.55)';
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(frame);
  }

  // give particles real coords once we know w/h
  particles.forEach((p) => { p.x = Math.random() * w; p.y = Math.random() * h; });
  frame();
}

/* ================= Init ================= */
function init() {
  initCanvas();
  renderStats();
  renderBlocklist();
  renderBadges();
  renderLog();
}

init();
