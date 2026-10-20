const API = 'http://127.0.0.1:38473';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => chrome.contextMenus.create({ id: 'cps-video', title: 'Download with CPS Universal Downloader', contexts: ['page', 'link', 'video'] }));
});

async function getToken() { return (await chrome.storage.local.get('apiToken')).apiToken || ''; }

async function sendUrl(url, mode = 'video', quality = 'Best', pageUrl = '') {
  if (!/^https?:\/\//i.test(url) || url.length > 32768) throw new Error('Invalid URL');
  const token = await getToken();
  const response = await fetch(`${API}/download`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CPS-Token': token }, body: JSON.stringify({ url, pageUrl, mode, quality }) });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(response.status === 401 ? 'Connect the extension token in CPS Settings.' : (payload.error || 'CPS Universal Downloader is not running.'));
  }
  return response.json();
}

async function sendDiscoveredCollection(message) {
  const token = await getToken();
  const response = await fetch(`${API}/discover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CPS-Token': token },
    body: JSON.stringify({ url: message.pageUrl, title: message.title, entries: message.entries }),
  });
  if (!response.ok) throw new Error('CPS Universal Downloader is not ready to receive this profile.');
  return response.json();
}

chrome.contextMenus.onClicked.addListener((info, tab) => sendUrl(info.linkUrl || info.srcUrl || info.pageUrl || tab.url).catch(() => {}));
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type === 'CPS_SEND_URL') { sendUrl(message.url, message.mode).then(data => respond({ ok: true, data })).catch(error => respond({ ok: false, error: error.message })); return true; }
  if (message.type === 'CPS_DOWNLOAD') { sendUrl(message.url, message.mode, message.quality, message.pageUrl).then(data => respond({ ok: true, data })).catch(error => respond({ ok: false, error: error.message })); return true; }
  if (message.type === 'CPS_DISCOVERED_COLLECTION') { sendDiscoveredCollection(message).then(data => respond({ ok: true, data })).catch(error => respond({ ok: false, error: error.message })); return true; }
  if (message.type === 'CPS_STATUS') { getToken().then(token => fetch(`${API}/status`, { headers: { 'X-CPS-Token': token } })).then(r => r.ok ? r.json() : Promise.reject()).then(data => respond({ ok: true, data })).catch(() => respond({ ok: false })); return true; }
});
