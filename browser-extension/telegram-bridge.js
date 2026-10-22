(() => {
  const REQUEST_SOURCE = 'cps-telegram-page';
  const RESPONSE_SOURCE = 'cps-telegram-extension';

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (event.source !== window || !message || message.source !== REQUEST_SOURCE ||
        typeof message.requestId !== 'string') return;
    const action = String(message.action || '');
    if (!['start', 'chunk', 'finish', 'cancel'].includes(action)) return;
    chrome.runtime.sendMessage({
      type: 'CPS_TELEGRAM_UPLOAD',
      action,
      payload: message.payload || {},
    }, (response) => {
      const runtimeError = chrome.runtime.lastError?.message;
      window.postMessage({
        source: RESPONSE_SOURCE,
        requestId: message.requestId,
        ok: Boolean(response?.ok) && !runtimeError,
        data: response?.data || null,
        error: runtimeError || response?.error || '',
      }, location.origin);
    });
  });
})();
