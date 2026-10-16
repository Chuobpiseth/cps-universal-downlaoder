const state = document.getElementById('state');
let currentUrl = '';
chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  const tab = tabs[0]; currentUrl = tab?.url || '';
  document.getElementById('title').textContent = tab?.title || 'Current page';
});
chrome.runtime.sendMessage({ type: 'CPS_STATUS' }, result => {
  state.textContent = result?.ok ? 'CPS Universal Downloader is ready' : 'CPS Universal Downloader is not currently running.';
  state.style.background = result?.ok ? '#e7f6ed' : '#fff0e1'; state.style.color = result?.ok ? '#107339' : '#a55300';
});
function send(mode, quality) {
  state.textContent = 'Sending…';
  chrome.runtime.sendMessage({ type: 'CPS_DOWNLOAD', url: currentUrl, mode, quality }, result => {
    state.textContent = result?.ok ? 'Download started in CPS ✓' : (result?.error || 'Unable to connect');
  });
}
document.getElementById('download').onclick = () => { document.getElementById('choices').hidden = false; document.getElementById('download').hidden = true; };
document.getElementById('video').onclick = () => { document.getElementById('qualities').hidden = false; };
document.getElementById('audio').onclick = () => send('audio', 'MP3');
document.querySelectorAll('[data-quality]').forEach(button => button.onclick = () => send('video', button.dataset.quality));
chrome.storage.local.get('apiToken', data => document.getElementById('token').value = data.apiToken || '');
document.getElementById('save').onclick = () => chrome.storage.local.set({ apiToken: document.getElementById('token').value.trim() }, () => state.textContent = 'Connection token saved');
