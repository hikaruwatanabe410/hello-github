// Nova Focus Shield — background service worker
// Owns the declarativeNetRequest rules that actually block navigation
// to distracting web apps while a focus mission is active.

const BLOCK_TARGETS = [
  { id: 1, key: 'whatsapp', name: 'WhatsApp Web', urlFilter: '||web.whatsapp.com', defaultOn: true },
  { id: 2, key: 'line', name: 'LINE', urlFilter: '||line.me', defaultOn: true },
  { id: 3, key: 'instagram', name: 'Instagram', urlFilter: '||instagram.com', defaultOn: true },
  { id: 4, key: 'tiktok', name: 'TikTok', urlFilter: '||tiktok.com', defaultOn: true },
  { id: 5, key: 'x', name: 'X / Twitter', urlFilter: '||x.com', defaultOn: true },
  { id: 6, key: 'twitter', name: 'Twitter (legacy)', urlFilter: '||twitter.com', defaultOn: true },
  { id: 7, key: 'facebook', name: 'Facebook', urlFilter: '||facebook.com', defaultOn: false },
  { id: 8, key: 'youtube', name: 'YouTube', urlFilter: '||youtube.com', defaultOn: false },
  { id: 9, key: 'discord', name: 'Discord', urlFilter: '||discord.com', defaultOn: false },
  { id: 10, key: 'reddit', name: 'Reddit', urlFilter: '||reddit.com', defaultOn: false },
];

const ALARM_NAME = 'novafocus-end';

async function getStore() {
  const s = await chrome.storage.local.get(['focusActive', 'endTime', 'enabledKeys']);
  return {
    focusActive: !!s.focusActive,
    endTime: s.endTime || 0,
    enabledKeys: s.enabledKeys || BLOCK_TARGETS.filter((t) => t.defaultOn).map((t) => t.key),
  };
}

function blockedPageUrl() {
  return chrome.runtime.getURL('blocked.html');
}

async function applyRules(active, enabledKeys) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);

  const addRules = active
    ? BLOCK_TARGETS.filter((t) => enabledKeys.includes(t.key)).map((t) => ({
        id: t.id,
        priority: 1,
        action: { type: 'redirect', redirect: { url: blockedPageUrl() } },
        condition: { urlFilter: t.urlFilter, resourceTypes: ['main_frame'] },
      }))
    : [];

  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
}

async function startFocus(minutes, enabledKeys) {
  const endTime = Date.now() + minutes * 60 * 1000;
  await chrome.storage.local.set({ focusActive: true, endTime, enabledKeys });
  await applyRules(true, enabledKeys);
  await chrome.alarms.create(ALARM_NAME, { when: endTime });
  chrome.action.setBadgeText({ text: 'ON' });
  chrome.action.setBadgeBackgroundColor({ color: '#ff3b5c' });
}

async function stopFocus() {
  await chrome.storage.local.set({ focusActive: false, endTime: 0 });
  await applyRules(false, []);
  await chrome.alarms.clear(ALARM_NAME);
  chrome.action.setBadgeText({ text: '' });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === 'START_FOCUS') {
      await startFocus(msg.minutes, msg.enabledKeys);
      sendResponse({ ok: true });
    } else if (msg.type === 'STOP_FOCUS') {
      await stopFocus();
      sendResponse({ ok: true });
    } else if (msg.type === 'GET_STATE') {
      sendResponse(await getStore());
    } else if (msg.type === 'GET_TARGETS') {
      sendResponse(BLOCK_TARGETS);
    }
  })();
  return true; // keep the message channel open for the async response
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await stopFocus();
  }
});

// Re-arm rules on browser/service-worker restart if a mission is still active.
chrome.runtime.onStartup.addListener(async () => {
  const s = await getStore();
  if (s.focusActive && s.endTime > Date.now()) {
    await applyRules(true, s.enabledKeys);
  } else if (s.focusActive) {
    await stopFocus();
  }
});
