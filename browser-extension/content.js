(() => {
  let activeVideo;
  let scanTimer;

  const closeMenu = () => document.querySelectorAll('.cps-choice-menu.cps-open').forEach(menu => menu.classList.remove('cps-open'));

  function discoveredHlsStream() {
    try {
      return performance.getEntriesByType('resource')
        .map(entry => entry.name)
        .filter(url => /^https?:\/\//i.test(url) && /\.m3u8(?:$|[?#])/i.test(url))
        .at(-1) || '';
    } catch { return ''; }
  }

  function mediaAddress(video) {
    if (/(^|\.)(sharepoint\.com|onedrive\.live\.com)$/i.test(location.hostname) || location.hostname === '1drv.ms') return location.href;
    const direct = video.currentSrc || video.src || video.querySelector('source[src]')?.src || '';
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

  function bestVideo() {
    return openRoots().flatMap(root => [...root.querySelectorAll('video')])
      .filter(video => {
        const rect = video.getBoundingClientRect();
        const style = getComputedStyle(video);
        return rect.width >= 220 && rect.height >= 120 && rect.bottom > 0 && rect.top < innerHeight && style.display !== 'none' && style.visibility !== 'hidden';
      })
      .sort((a, b) => {
        const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
        return (br.width * br.height) - (ar.width * ar.height);
      })[0];
  }

  function createControl(video) {
    const host = video.closest('#movie_player, .html5-video-player, [data-e2e="video-player"], [data-testid*="video"], [class*="player"], article') || video.parentElement;
    if (!host) return;
    host.querySelector(':scope > .cps-video-download')?.remove();
    if (getComputedStyle(host).position === 'static') host.style.setProperty('position', 'relative', 'important');
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
    host.appendChild(wrap);
  }

  function scan() {
    const video = bestVideo();
    if (!video) return;
    if (video === activeVideo && video.getRootNode().querySelector?.('.cps-video-download')) return;
    document.querySelectorAll('.cps-video-download').forEach(control => control.remove());
    activeVideo = video;
    createControl(video);
  }

  document.addEventListener('click', event => { if (!event.target.closest('.cps-video-download')) closeMenu(); }, true);
  new MutationObserver(() => { clearTimeout(scanTimer); scanTimer = setTimeout(scan, 250); }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  addEventListener('scroll', () => { clearTimeout(scanTimer); scanTimer = setTimeout(scan, 160); }, true);
  addEventListener('loadedmetadata', scan, true);
  scan();
})();
