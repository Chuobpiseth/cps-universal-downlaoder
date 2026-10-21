(() => {
  let activeVideo = null;
  let control = null;
  let scanTimer = 0;
  let discoveredCount = 0;
  const discoveredDouyin = new Map();
  const PAGE_URL_HOSTS = /(^|\.)(tiktok\.com|douyin\.com|facebook\.com|youtube\.com|youtu\.be|instagram\.com|x\.com|twitter\.com|sharepoint\.com|onedrive\.live\.com)$/i;

  const closeMenu = () => control?.querySelector('.cps-choice-menu')?.classList.remove('cps-open');

  function discoveredHlsStream() {
    try {
      return performance.getEntriesByType('resource').map(entry => entry.name)
        .filter(url => /^https?:\/\//i.test(url) && /\.m3u8(?:$|[?#])/i.test(url)).at(-1) || '';
    } catch { return ''; }
  }

  function stableSocialPage(video) {
    const patterns = {
      'tiktok.com': /\/video\/\d+/i,
      'douyin.com': /\/video\/\d+/i,
      'facebook.com': /\/(?:reel|watch|videos)\//i,
      'instagram.com': /\/(?:reel|p)\//i,
      'x.com': /\/status\/\d+/i,
      'twitter.com': /\/status\/\d+/i,
    };
    const hostKey = Object.keys(patterns).find(host => location.hostname === host || location.hostname.endsWith(`.${host}`));
    if (!hostKey) return location.href;
    if (patterns[hostKey].test(location.pathname)) return location.href;
    let scope = video;
    for (let depth = 0; scope && depth < 7; depth += 1, scope = scope.parentElement) {
      for (const anchor of scope.querySelectorAll?.('a[href]') || []) {
        try {
          const candidate = new URL(anchor.href, location.href);
          if ((candidate.hostname === hostKey || candidate.hostname.endsWith(`.${hostKey}`)) && patterns[hostKey].test(candidate.pathname)) return candidate.href;
        } catch { /* Ignore malformed site links. */ }
      }
    }
    const visiblePostLinks = [...document.querySelectorAll('a[href]')].map(anchor => {
      try {
        const candidate = new URL(anchor.href, location.href);
        if (!(candidate.hostname === hostKey || candidate.hostname.endsWith(`.${hostKey}`)) || !patterns[hostKey].test(candidate.pathname)) return null;
        const rect = anchor.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= innerHeight) return null;
        return { href: candidate.href, distance: Math.abs((rect.top + rect.bottom) / 2 - innerHeight / 2) };
      } catch { return null; }
    }).filter(Boolean).sort((a, b) => a.distance - b.distance);
    if (visiblePostLinks[0]) return visiblePostLinks[0].href;
    // A social feed/profile URL is not itself a downloadable video. Returning
    // an empty value lets the caller fall back to the active media stream.
    return '';
  }

  function mediaAddress(video) {
    // Social CDN URLs expire and often require request headers. A stable page
    // URL lets the desktop engine resolve a fresh, authenticated stream.
    const stablePage = stableSocialPage(video);
    if ((PAGE_URL_HOSTS.test(location.hostname) || location.hostname === '1drv.ms') && stablePage) return stablePage;
    const direct = video?.currentSrc || video?.src || video?.querySelector?.('source[src]')?.src || '';
    if (/^https?:\/\//i.test(direct)) return direct;
    return discoveredHlsStream() || location.href;
  }

  function send(mode, quality, video, button, menu) {
    const label = button.querySelector('span');
    label.textContent = 'Sending…';
    chrome.runtime.sendMessage({ type: 'CPS_DOWNLOAD', url: mediaAddress(video), pageUrl: location.href, mode, quality }, result => {
      label.textContent = result?.ok ? 'Added' : 'Retry';
      if (!result?.ok && result?.error) button.title = result.error;
      menu.classList.remove('cps-open');
      setTimeout(() => { label.textContent = 'Download'; }, 1800);
    });
  }

  function openRoots(root = document) {
    const roots = [root];
    for (let index = 0; index < roots.length; index += 1) {
      roots[index].querySelectorAll?.('*').forEach(node => { if (node.shadowRoot) roots.push(node.shadowRoot); });
    }
    return roots;
  }

  function visibleArea(video) {
    const rect = video.getBoundingClientRect();
    const width = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
    const height = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
    const centerPenalty = Math.abs((rect.top + rect.bottom) / 2 - innerHeight / 2);
    return (width * height) - centerPenalty * 100;
  }

  function bestVideo() {
    const regularVideos = [...document.querySelectorAll('video')];
    const candidates = regularVideos.length ? regularVideos : openRoots().flatMap(root => [...root.querySelectorAll('video')]);
    return candidates.filter(video => {
      const rect = video.getBoundingClientRect();
      const style = getComputedStyle(video);
      return rect.width >= 80 && rect.height >= 80 && rect.bottom > 0 && rect.top < innerHeight
        && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0;
    }).sort((a, b) => visibleArea(b) - visibleArea(a))[0];
  }

  const overlayRoot = () => document.fullscreenElement || document.documentElement;

  function positionControl() {
    if (!control) return;
    // TikTok can paint the player without exposing a usable <video> node to
    // extension scripts. Keep a page-level control available in that case.
    if (!activeVideo) {
      control.style.setProperty('display', 'block', 'important');
      control.style.setProperty('right', '18px', 'important');
      control.style.setProperty('top', '88px', 'important');
      return;
    }
    if (!activeVideo.isConnected) return;
    const rect = activeVideo.getBoundingClientRect();
    const visible = rect.width >= 80 && rect.height >= 80 && rect.bottom > 0 && rect.top < innerHeight;
    control.style.setProperty('display', visible ? 'block' : 'none', 'important');
    if (!visible) return;
    control.style.setProperty('right', `${Math.max(8, innerWidth - Math.min(rect.right, innerWidth) + 12)}px`, 'important');
    control.style.setProperty('top', `${Math.max(8, Math.min(innerHeight - 52, rect.top + 12))}px`, 'important');
  }

  function createControl(video) {
    control?.remove();
    const wrap = document.createElement('div');
    wrap.className = 'cps-video-download';
    const button = document.createElement('button');
    button.className = 'cps-download-button';
    button.type = 'button';
    button.title = 'Download with CPS';
    button.setAttribute('aria-label', 'Download this video with CPS');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/></svg><span>Download</span>';
    const menu = document.createElement('div');
    menu.className = 'cps-choice-menu';
    menu.setAttribute('role', 'dialog');
    menu.innerHTML = '<strong>Download as</strong><button type="button" data-choice="video">Video (MP4)</button><button type="button" data-choice="audio">Audio (MP3)</button><div class="cps-quality"><span>Choose MP4 quality</span><button type="button" data-quality="Best">Best</button><button type="button" data-quality="1080p">1080p</button><button type="button" data-quality="720p">720p</button><button type="button" data-quality="480p">480p</button></div>';
    button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); menu.classList.toggle('cps-open'); });
    menu.addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation();
      const choice = event.target.closest('button');
      if (!choice) return;
      if (choice.dataset.choice === 'audio') send('audio', 'MP3', video, button, menu);
      if (choice.dataset.choice === 'video') menu.querySelector('.cps-quality').classList.add('cps-visible');
      if (choice.dataset.quality) send('video', choice.dataset.quality, video, button, menu);
    });
    wrap.append(button, menu);
    overlayRoot().appendChild(wrap);
    control = wrap;
    positionControl();
  }

  function discoverDouyinProfileVideos() {
    if (!/(^|\.)douyin\.com$/i.test(location.hostname) || /\/video\//i.test(location.pathname)) return;
    document.querySelectorAll('a[href*="/video/"]').forEach(anchor => {
      let url;
      try { url = new URL(anchor.href, location.href); } catch { return; }
      const match = url.pathname.match(/\/video\/(\d+)/);
      if (!match) return;
      const stableUrl = `https://www.douyin.com/video/${match[1]}`;
      const image = anchor.querySelector('img');
      const title = (anchor.getAttribute('aria-label') || image?.alt || anchor.title || anchor.textContent || `Douyin video ${match[1]}`).trim();
      discoveredDouyin.set(stableUrl, { url: stableUrl, title: title.slice(0, 300), thumbnail: image?.currentSrc || image?.src || '', platform: 'Douyin' });
    });
    if (discoveredDouyin.size && discoveredDouyin.size !== discoveredCount) {
      discoveredCount = discoveredDouyin.size;
      chrome.runtime.sendMessage({ type: 'CPS_DISCOVERED_COLLECTION', pageUrl: location.href, title: document.title || 'Douyin profile', entries: [...discoveredDouyin.values()].slice(0, 500) }, () => void chrome.runtime.lastError);
    }
  }

  function scan() {
    discoverDouyinProfileVideos();
    const video = bestVideo();
    const isTikTokPage = /(^|\.)tiktok\.com$/i.test(location.hostname);
    const hasTikTokTarget = isTikTokPage && window === window.top && Boolean(stableSocialPage(null) || discoveredHlsStream());
    if (!video && hasTikTokTarget) {
      if (activeVideo !== null || !control?.isConnected || control.parentNode !== overlayRoot()) {
        activeVideo = null;
        createControl(null);
      } else positionControl();
      return;
    }
    if (!video) { control?.remove(); control = null; activeVideo = null; return; }
    if (video !== activeVideo || !control?.isConnected || control.parentNode !== overlayRoot()) {
      activeVideo = video;
      createControl(video);
    } else positionControl();
  }

  function scheduleScan(delay = 80) { clearTimeout(scanTimer); scanTimer = setTimeout(scan, delay); }

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message.type !== 'CPS_GET_ACTIVE_MEDIA') return false;
    const video = bestVideo();
    const isTikTokPage = /(^|\.)tiktok\.com$/i.test(location.hostname);
    const hasTikTokTarget = isTikTokPage && Boolean(stableSocialPage(video) || discoveredHlsStream());
    respond(video || hasTikTokTarget
      ? { ok: true, url: mediaAddress(video), pageUrl: location.href }
      : { ok: false, error: 'No visible video was detected on this page.' });
    return false;
  });

  document.addEventListener('click', event => { if (!event.target.closest?.('.cps-video-download')) closeMenu(); }, true);
  new MutationObserver(records => {
    if (records.every(record => record.target?.closest?.('.cps-video-download'))) return;
    scheduleScan(350);
  }).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('scroll', () => { positionControl(); scheduleScan(240); }, { capture: true, passive: true });
  addEventListener('resize', () => { positionControl(); scheduleScan(120); }, { passive: true });
  addEventListener('loadedmetadata', () => scheduleScan(0), true);
  addEventListener('fullscreenchange', () => scheduleScan(0));
  scan();
})();
