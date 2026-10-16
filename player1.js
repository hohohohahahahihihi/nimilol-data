(function () {
  'use strict';

  // =========================================================================
  // 🔧 1. 데이터 저장소 및 클라우드플레어 워커 설정 (적용 완료)
  // =========================================================================
  var GITHUB_JSON_URL     = "https://cdn.jsdelivr.net/gh/hohohohahahahihihi/nimilol-data@main/videos.json";
  var WORKER_URL          = "https://nimiol-proxy.jangdaeil300.workers.dev";
  var DEFAULT_XBBG_DOMAIN = "https://39.xbbg.tv";
  // =========================================================================

  var ICONS = {
    play: '<polygon points="5,3 19,12 5,21"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    skipBack: '<polygon points="11,4 3,12 11,20"/><polygon points="20,4 12,12 20,20"/>',
    skipFwd: '<polygon points="13,4 21,12 13,20"/><polygon points="4,4 12,12 4,20"/>',
    volHigh: '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8.5v7a4.49 4.49 0 002.5-3.5z"/><path d="M14 3.23v2.06a7 7 0 010 13.42v2.06A9 9 0 0014 3.23z"/>',
    volMed: '<path d="M3 9v6h4l5 5V4L7 9H3zm11.5 3A4.5 4.5 0 0014 8.5v7a4.49 4.49 0 00.5-3.5z"/>',
    volLow: '<path d="M3 9v6h4l5 5V4L7 9H3z"/>',
    volMute: '<path d="M3 9v6h4l5 5V4L7 9H3z"/><line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    fullscreen: '<path d="M4 4h5v2H6v3H4V4zm11 0h5v5h-2V6h-3V4zM4 15h2v3h3v2H4v-5zm15 3h-3v2h5v-5h-2v3z"/>',
    exitFullscreen: '<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>'
  };

  function iconHTML(name) {
    return '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none">' + (ICONS[name] || '') + '</svg>';
  }

  // DOM 요소 참조
  var video             = document.getElementById('videoPlayer');
  var loader            = document.getElementById('loader');
  var errorState        = document.getElementById('errorState');
  var playBtn           = document.getElementById('playBtn');
  var timeDisplay       = document.getElementById('timeDisplay');
  var progressPlayed    = document.getElementById('progressPlayed');
  var progressBuffered  = document.getElementById('progressBuffered');
  var progressHandle    = document.getElementById('progressHandle');
  var progressTooltip   = document.getElementById('progressTooltip');
  var progressContainer = document.getElementById('progressContainer');
  var progressTrack     = document.getElementById('progressTrack');
  var volumeSliderTrack = document.getElementById('volumeSliderTrack');
  var volumeFilled      = document.getElementById('volumeFilled');
  var volumeHandle      = document.getElementById('volumeHandle');
  var muteBtn           = document.getElementById('muteBtn');
  var videoTitle        = document.getElementById('videoTitle');
  var topBadge          = document.getElementById('topBadge');
  var centerIndicator   = document.getElementById('centerIndicator');
  var centerIcon        = document.getElementById('centerIcon');
  var spinner           = document.getElementById('bufferingSpinner');
  var volumeOverlay     = document.getElementById('volumeOverlay');
  var volumeBars        = document.getElementById('volumeBars');
  var volumeOverlayText = document.getElementById('volumeOverlayText');
  var toastContainer    = document.getElementById('toastContainer');
  var speedGroup        = document.getElementById('speedGroup');
  var speedBtn          = document.getElementById('speedBtn');
  var speedMenu         = document.getElementById('speedMenu');
  var pipBtn            = document.getElementById('pipBtn');
  var fullscreenBtn     = document.getElementById('fullscreenBtn');
  var skipBackBtn       = document.getElementById('skipBackBtn');
  var skipFwdBtn        = document.getElementById('skipFwdBtn');
  var playerContainer   = document.getElementById('playerContainer');
  var posterOverlay     = document.getElementById('poster-overlay');
  var posterTitle       = document.getElementById('posterTitle');
  var posterBadge       = document.getElementById('posterBadge');

  if (!video || !playerContainer) return;

  var activeHls          = null;
  var isPlaying          = false;
  var isMuted            = false;
  var currentVolume      = 1;
  var isFullscreen       = false;
  var isPip              = false;
  var currentSpeed       = 1;
  var hideTimer          = null;
  var isProgressDragging = false;
  var isVolumeDragging   = false;
  var speedMenuOpen      = false;
  var centerAnimTimer    = null;
  var clickTimer         = null;

  // =========================================================================
  // 🔧 2. 주소 복호화 및 썸네일 자동 복구 함수
  // =========================================================================
  function extractCleanVideoUrl(vObj) {
    var raw = "";
    if (vObj.video_code) {
      try {
        var binStr = atob(vObj.video_code);
        var bytes = Uint8Array.from(binStr, function (m) { return m.codePointAt(0); });
        raw = new TextDecoder().decode(bytes);
      } catch (e) {
        try { raw = atob(vObj.video_code); } catch (e2) { raw = vObj.video_url || ""; }
      }
    } else {
      raw = vObj.video_url || "";
    }

    raw = String(raw).trim().replace(/\\\//g, "/");
    var maxUnwrap = 4;
    while (maxUnwrap-- > 0 && /[?&]url=([^&"'\s]+)/i.test(raw)) {
      var m = raw.match(/[?&]url=([^&"'\s]+)/i);
      if (!m) break;
      try {
        var candidate = decodeURIComponent(m[1]);
        if (/%[0-9A-Fa-f]{2}/.test(candidate)) {
          try { candidate = decodeURIComponent(candidate); } catch (e) {}
        }
        if (/^https?:\/\//i.test(candidate)) raw = candidate;
        else break;
      } catch (e) { break; }
    }
    try { raw = decodeURIComponent(raw); } catch (e) {}
    return encodeURI(raw).replace(/#/g, "%23");
  }

  function extractCleanThumbUrl(rawThumb) {
    if (!rawThumb) return "";
    var u = String(rawThumb).trim();
    try {
      if (u.indexOf("code=") !== -1) {
        var m = u.match(/[?&]code=([^&]+)/i);
        if (m) {
          var dec = decodeURIComponent(m[1]);
          try {
            var binStr = atob(dec);
            var bytes = Uint8Array.from(binStr, function (c) { return c.codePointAt(0); });
            u = new TextDecoder().decode(bytes);
          } catch (e) { u = atob(dec); }
        }
      } else if (u.indexOf("url=") !== -1) {
        var m2 = u.match(/[?&]url=([^&]+)/i);
        if (m2) u = decodeURIComponent(m2[1]);
      }
    } catch (e) {}

    u = u.trim().replace(/\\\//g, "/");
    var baseDom = DEFAULT_XBBG_DOMAIN.replace(/\/$/, "");

    if (u.indexOf("/") === 0 && u.indexOf("//") !== 0) {
      u = baseDom + u;
    } else if (!/^https?:\/\//i.test(u)) {
      u = baseDom + "/" + u.replace(/^\.?\//, "");
    }
    if (u.indexOf("/data/file/") !== -1 || u.indexOf("xbbg") !== -1) {
      u = u.replace(/^https?:\/\/[^\/]+/i, baseDom);
    }
    try { u = decodeURIComponent(u); } catch (e) {}
    return encodeURI(u).replace(/#/g, "%23");
  }

  function setPosterImage(rawUrl, title, badgeText) {
    var cleanUrl = extractCleanThumbUrl(rawUrl);
    if (!cleanUrl) return;

    var workerThumb = WORKER_URL.replace(/\/$/, "") + "/?url=" + encodeURIComponent(cleanUrl);
    var wsrvThumb   = "https://wsrv.nl/?url=" + encodeURIComponent(cleanUrl);
    var candidates  = [workerThumb, wsrvThumb, cleanUrl];

    function tryLoad(idx) {
      if (idx >= candidates.length) return;
      var img = new Image();
      img.onload = function () {
        if (posterOverlay) {
          posterOverlay.style.backgroundImage = "url('" + candidates[idx] + "')";
          posterOverlay.classList.remove('hidden');
          posterOverlay.classList.add('active');
        }
        if (posterTitle && title) {
          posterTitle.textContent = title;
          posterTitle.classList.add('show');
        }
        if (posterBadge) {
          posterBadge.textContent = badgeText || 'HD';
          posterBadge.classList.add('show');
        }
        video.poster = candidates[idx];
      };
      img.onerror = function () {
        tryLoad(idx + 1);
      };
      img.src = candidates[idx];
    }
    tryLoad(0);
  }

  function hidePoster() {
    if (posterOverlay) {
      posterOverlay.classList.remove('active');
      posterOverlay.classList.add('hidden');
    }
  }

  // =========================================================================
  // 🔧 3. 플레이어 UI 및 컨트롤 제어
  // =========================================================================
  function formatTime(s) {
    if (!isFinite(s) || s < 0 || !s) return '0:00:00';
    var hours = Math.floor(s / 3600);
    var minutes = Math.floor((s % 3600) / 60);
    var secs = Math.floor(s % 60);
    return hours + ':' + (minutes < 10 ? '0' : '') + minutes + ':' + (secs < 10 ? '0' : '') + secs;
  }

  function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

  function getVolumeIcon(v) {
    if (v === 0 || isMuted) return 'volMute';
    if (v < 0.4) return 'volLow';
    if (v < 0.7) return 'volMed';
    return 'volHigh';
  }

  function showToast(msg) {
    if (!toastContainer) return;
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    toastContainer.appendChild(t);
    t.addEventListener('animationend', function () { t.remove(); });
  }

  function showCenterIcon(name) {
    if (!centerIcon || !centerIndicator) return;
    centerIcon.innerHTML = ICONS[name] || '';
    centerIndicator.classList.remove('pop');
    void centerIndicator.offsetWidth;
    centerIndicator.classList.add('pop');
    clearTimeout(centerAnimTimer);
    centerAnimTimer = setTimeout(function () { centerIndicator.classList.remove('pop'); }, 600);
  }

  function initVolumeBars() {
    if (!volumeBars) return;
    volumeBars.innerHTML = '';
    for (var i = 0; i < 8; i++) {
      var bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.height = (12 + i * 6) + 'px';
      volumeBars.appendChild(bar);
    }
  }

  function showVolumeOverlay() {
    if (!volumeOverlay || !volumeBars) return;
    var v = isMuted ? 0 : currentVolume;
    var activeBars = Math.round(v * 8);
    var bars = volumeBars.children;
    for (var i = 0; i < bars.length; i++) {
      bars[i].classList.toggle('active', i < activeBars);
    }
    if (volumeOverlayText) volumeOverlayText.textContent = Math.round(v * 100) + '%';
    volumeOverlay.classList.add('visible');
    clearTimeout(showVolumeOverlay._t);
    showVolumeOverlay._t = setTimeout(function () { volumeOverlay.classList.remove('visible'); }, 800);
  }

  function updatePlayPause() {
    if (!playBtn) return;
    playBtn.innerHTML = isPlaying ? iconHTML('pause') : iconHTML('play');
  }

  function updateVolumeUI() {
    var v = isMuted ? 0 : currentVolume;
    if (muteBtn) muteBtn.innerHTML = iconHTML(getVolumeIcon(v));
    if (volumeFilled) volumeFilled.style.width = (v * 100) + '%';
    if (volumeHandle) volumeHandle.style.left = (v * 100) + '%';
  }

  function updateTimeDisplay() {
    if (!timeDisplay) return;
    var cur = formatTime(video.currentTime);
    var tot = formatTime(video.duration);
    timeDisplay.innerHTML = '<span class="time-current">' + cur + '</span> / <span class="time-total">' + tot + '</span>';
  }

  function updateProgress() {
    if (isProgressDragging || !video.duration) return;
    var pct = (video.currentTime / video.duration) * 100;
    if (progressPlayed) progressPlayed.style.width = pct + '%';
    if (progressHandle) progressHandle.style.left = pct + '%';
  }

  function updateBuffered() {
    if (!video.duration || !progressBuffered) return;
    var buf = video.buffered;
    if (buf.length > 0) {
      var end = buf.end(buf.length - 1);
      progressBuffered.style.width = ((end / video.duration) * 100) + '%';
    }
  }

  function updateFullscreenUI() {
    if (!fullscreenBtn) return;
    fullscreenBtn.innerHTML = isFullscreen ? iconHTML('exitFullscreen') : iconHTML('fullscreen');
  }

  function updateSpeedUI() {
    if (!speedBtn || !speedMenu) return;
    speedBtn.textContent = currentSpeed === 1 ? '1x' : currentSpeed + 'x';
    var options = speedMenu.querySelectorAll('.speed-option');
    for (var i = 0; i < options.length; i++) {
      options[i].classList.toggle('active', parseFloat(options[i].dataset.speed) === currentSpeed);
    }
  }

  function resetHideTimer() {
    playerContainer.classList.remove('hide-controls');
    clearTimeout(hideTimer);
    if (isPlaying) {
      hideTimer = setTimeout(function () {
        if (!speedMenuOpen && !isProgressDragging && !isVolumeDragging) {
          playerContainer.classList.add('hide-controls');
        }
      }, 3000);
    }
  }

  function togglePlay() {
    if (video.paused) {
      hidePoster();
      video.play().catch(function () {});
    } else {
      video.pause();
    }
    resetHideTimer();
  }

  function skip(seconds) {
    video.currentTime = clamp((video.currentTime || 0) + seconds, 0, video.duration || 0);
    showCenterIcon(seconds > 0 ? 'skipFwd' : 'skipBack');
    showToast((seconds > 0 ? '+' : '') + seconds + '초');
    resetHideTimer();
  }

  function toggleMute() {
    isMuted = !isMuted;
    video.muted = isMuted;
    if (!isMuted && currentVolume === 0) {
      currentVolume = 0.5;
      video.volume = currentVolume;
    }
    updateVolumeUI();
    showVolumeOverlay();
    showToast(isMuted ? '음소거' : '음소거 해제');
    resetHideTimer();
  }

  function setVolume(v) {
    v = clamp(v, 0, 1);
    currentVolume = v;
    video.volume = v;
    if (v > 0 && isMuted) {
      isMuted = false;
      video.muted = false;
    }
    updateVolumeUI();
    showVolumeOverlay();
    resetHideTimer();
  }

  function toggleFullscreen() {
    if (isFullscreen) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      (playerContainer.requestFullscreen || playerContainer.webkitRequestFullscreen).call(playerContainer);
    }
    resetHideTimer();
  }

  function togglePiP() {
    if (!document.pictureInPictureEnabled) return;
    if (isPip) document.exitPictureInPicture().catch(function () {});
    else video.requestPictureInPicture().catch(function () {});
  }

  function setSpeed(s) {
    currentSpeed = s;
    video.playbackRate = s;
    updateSpeedUI();
    showToast('배속: ' + (s === 1 ? '보통(1x)' : s + 'x'));
  }

  // =========================================================================
  // 🔧 4. HLS 스트리밍 재생 엔진 (클라우드플레어 워커 완벽 연동)
  // =========================================================================
  function startStreamPlayback(realUrl) {
    if (activeHls) {
      activeHls.destroy();
      activeHls = null;
    }

    var isM3u8 = realUrl.toLowerCase().indexOf('.m3u8') !== -1 || realUrl.indexOf('/api/') !== -1 || realUrl.indexOf('8ktphpek46') !== -1;
    var isDirect = isM3u8 || /\.(mp4)(\?.*)?$/i.test(realUrl);

    if (!isDirect) {
      // 외부 iframe 주소인 경우
      video.style.display = 'none';
      if (loader) loader.classList.remove('on');
      hidePoster();
      var iframe = document.createElement('iframe');
      iframe.src = realUrl;
      iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;z-index:20;';
      iframe.allow = 'autoplay; encrypted-media; fullscreen';
      iframe.allowFullscreen = true;
      playerContainer.appendChild(iframe);
      return;
    }

    if (isM3u8 && typeof Hls !== 'undefined' && Hls.isSupported()) {
      var baseDir = realUrl.substring(0, realUrl.lastIndexOf('/') + 1);
      var workerBase = WORKER_URL.replace(/\/$/, '');
      var workerOrigin = new URL(workerBase).origin;
      var isXbbgStream = realUrl.indexOf('8ktphpek46') !== -1 || realUrl.indexOf('/api/') !== -1;

      var useXbbgProxy = isXbbgStream;
      var fallbackTried = false;

      function buildProxiedUrl(reqUrl) {
        try {
          var u = new URL(reqUrl, window.location.href);
          if (u.origin === workerOrigin && u.pathname === '/' && (u.searchParams.has('url') || u.searchParams.has('code'))) {
            return reqUrl;
          }
          var target = reqUrl;
          if (u.origin === workerOrigin && u.pathname !== '/') {
            if (u.pathname.indexOf('proxy.php') !== -1 && u.searchParams.has('url')) {
              target = decodeURIComponent(u.searchParams.get('url'));
            } else {
              var relFile = u.pathname.replace(/^\/+/, '');
              target = baseDir + relFile + u.search;
            }
          } else if (u.pathname.indexOf('proxy.php') !== -1 && u.searchParams.has('url')) {
            target = decodeURIComponent(u.searchParams.get('url'));
          }

          if (useXbbgProxy && (target.indexOf('8ktphpek46') !== -1 || target.indexOf('/api/') !== -1) && target.indexOf('proxy.php') === -1) {
            target = DEFAULT_XBBG_DOMAIN.replace(/\/$/, '') + '/bbs/proxy.php?url=' + encodeURIComponent(target);
          }
          return workerBase + '/?url=' + encodeURIComponent(target);
        } catch (err) {
          return workerBase + '/?url=' + encodeURIComponent(reqUrl);
        }
      }

      activeHls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 30,
        backBufferLength: 60,
        xhrSetup: function (xhr, url) {
          xhr.open('GET', buildProxiedUrl(url), true);
        }
      });

      activeHls.loadSource(realUrl);
      activeHls.attachMedia(video);

      activeHls.on(Hls.Events.MANIFEST_PARSED, function () {
        if (loader) loader.classList.remove('on');
        if (spinner) spinner.classList.remove('visible');
      });

      activeHls.on(Hls.Events.ERROR, function (event, data) {
        if (!data || !data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          if (!fallbackTried) {
            fallbackTried = true;
            useXbbgProxy = !useXbbgProxy;
            activeHls.loadSource(realUrl);
            activeHls.startLoad();
          } else {
            activeHls.startLoad();
          }
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          activeHls.recoverMediaError();
        } else {
          if (loader) loader.classList.remove('on');
          if (errorState) errorState.classList.add('visible');
        }
      });
    } else {
      video.src = isM3u8 ? (WORKER_URL.replace(/\/$/, '') + '/?url=' + encodeURIComponent(realUrl)) : realUrl;
      if (loader) loader.classList.remove('on');
    }
  }

  // =========================================================================
  // 🔧 5. URL 파라미터(?id=번호) 감지 및 데이터 로드
  // =========================================================================
  function initFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');
    var directSrc = params.get('src');

    // 직접 스트림 주소(?src=...)가 넘어온 경우
    if (directSrc) {
      if (loader) loader.classList.add('on');
      startStreamPlayback(directSrc);
      return;
    }

    // ?id= 파라미터가 없으면 aeontv09 처럼 빈 대기 화면(0:00:00) 유지!
    if (!id) {
      if (loader) loader.classList.remove('on');
      return;
    }

    if (loader) loader.classList.add('on');

    fetch(GITHUB_JSON_URL + '?t=' + Math.floor(Date.now() / 60000))
      .then(function (res) {
        if (!res.ok) throw new Error('Data load error');
        return res.json();
      })
      .then(function (data) {
        var list = data.videos || [];
        var found = null;

        if (id === 'latest' && list.length > 0) {
          found = list[0];
        } else {
          for (var i = 0; i < list.length; i++) {
            if (String(list[i].id) === String(id)) {
              found = list[i];
              break;
            }
          }
        }

        if (!found) {
          if (loader) loader.classList.remove('on');
          if (errorState) errorState.classList.add('visible');
          return;
        }

        if (videoTitle) videoTitle.textContent = found.title || 'JAVPlayer';
        if (topBadge) topBadge.textContent = found.duration || 'HD';
        document.title = (found.title || 'JAVPlayer') + ' - Player';

        setPosterImage(found.thumb_url, found.title, found.duration || 'HD');
        var realUrl = extractCleanVideoUrl(found);
        startStreamPlayback(realUrl);
      })
      .catch(function () {
        if (loader) loader.classList.remove('on');
        if (errorState) errorState.classList.add('visible');
      });
  }

  // =========================================================================
  // 🔧 6. 이벤트 리스너 등록
  // =========================================================================
  video.addEventListener('play', function () {
    isPlaying = true;
    updatePlayPause();
    resetHideTimer();
    if (loader) loader.classList.remove('on');
    if (errorState) errorState.classList.remove('visible');
    hidePoster();
  });

  video.addEventListener('pause', function () {
    isPlaying = false;
    updatePlayPause();
    playerContainer.classList.remove('hide-controls');
    clearTimeout(hideTimer);
  });

  video.addEventListener('ended', function () {
    isPlaying = false;
    updatePlayPause();
    playerContainer.classList.remove('hide-controls');
  });

  video.addEventListener('timeupdate', function () {
    updateProgress();
    updateTimeDisplay();
  });

  video.addEventListener('progress', updateBuffered);
  video.addEventListener('loadedmetadata', updateTimeDisplay);
  video.addEventListener('waiting', function () { if (spinner) spinner.classList.add('visible'); });
  video.addEventListener('canplay', function () { if (spinner) spinner.classList.remove('visible'); });
  video.addEventListener('playing', function () { if (spinner) spinner.classList.remove('visible'); });
  video.addEventListener('volumechange', updateVolumeUI);

  if (playBtn) playBtn.addEventListener('click', function (e) { e.stopPropagation(); togglePlay(); });
  if (skipBackBtn) skipBackBtn.addEventListener('click', function (e) { e.stopPropagation(); skip(-10); });
  if (skipFwdBtn) skipFwdBtn.addEventListener('click', function (e) { e.stopPropagation(); skip(10); });
  if (muteBtn) muteBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleMute(); });
  if (pipBtn) pipBtn.addEventListener('click', function (e) { e.stopPropagation(); togglePiP(); });
  if (fullscreenBtn) fullscreenBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleFullscreen(); });
  if (speedBtn) speedBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    speedMenuOpen = !speedMenuOpen;
    if (speedMenu) speedMenu.classList.toggle('open', speedMenuOpen);
    resetHideTimer();
  });

  if (posterOverlay) {
    posterOverlay.addEventListener('click', function (e) {
      e.stopPropagation();
      togglePlay();
    });
  }

  function seekFromEvent(e) {
    if (!progressTrack || !video.duration) return;
    var rect = progressTrack.getBoundingClientRect();
    var pct = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    video.currentTime = pct * video.duration;
    if (progressPlayed) progressPlayed.style.width = (pct * 100) + '%';
    if (progressHandle) progressHandle.style.left = (pct * 100) + '%';
  }

  function updateProgressTooltip(e) {
    if (!progressTrack || !progressTooltip) return;
    var rect = progressTrack.getBoundingClientRect();
    var pct = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    var time = pct * (video.duration || 0);
    progressTooltip.textContent = formatTime(time);
    progressTooltip.style.left = (pct * 100) + '%';
  }

  if (progressContainer) {
    progressContainer.addEventListener('mousedown', function (e) {
      isProgressDragging = true;
      progressContainer.classList.add('dragging');
      seekFromEvent(e);
      resetHideTimer();
    });
  }

  if (volumeSliderTrack) {
    volumeSliderTrack.addEventListener('mousedown', function (e) {
      isVolumeDragging = true;
      var wrap = document.getElementById('volumeSliderWrap');
      if (wrap) wrap.classList.add('force-show');
      var rect = volumeSliderTrack.getBoundingClientRect();
      setVolume(clamp((e.clientX - rect.left) / rect.width, 0, 1));
    });
  }

  document.addEventListener('mousemove', function (e) {
    if (isProgressDragging) seekFromEvent(e);
    if (progressContainer && (progressContainer.matches(':hover') || isProgressDragging)) {
      updateProgressTooltip(e);
    }
    if (isVolumeDragging && volumeSliderTrack) {
      var rect = volumeSliderTrack.getBoundingClientRect();
      setVolume(clamp((e.clientX - rect.left) / rect.width, 0, 1));
    }
  });

  document.addEventListener('mouseup', function () {
    if (isProgressDragging) {
      isProgressDragging = false;
      if (progressContainer) progressContainer.classList.remove('dragging');
      resetHideTimer();
    }
    if (isVolumeDragging) {
      isVolumeDragging = false;
      var wrap = document.getElementById('volumeSliderWrap');
      if (wrap) wrap.classList.remove('force-show');
    }
  });

  document.addEventListener('click', function (e) {
    if (speedMenuOpen && speedGroup && !speedGroup.contains(e.target)) {
      speedMenuOpen = false;
      if (speedMenu) speedMenu.classList.remove('open');
    }
  });

  playerContainer.addEventListener('click', function (e) {
    if (e.target.closest('#controlsWrapper') || e.target.closest('#speedMenu')) return;
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
      var rect = playerContainer.getBoundingClientRect();
      var x = e.clientX - rect.left;
      if (x < rect.width / 2) skip(-10);
      else skip(10);
    } else {
      clickTimer = setTimeout(function () {
        clickTimer = null;
        togglePlay();
        showCenterIcon(isPlaying ? 'play' : 'pause');
      }, 220);
    }
  });

  playerContainer.addEventListener('mousemove', resetHideTimer);
  playerContainer.addEventListener('mouseleave', function () {
    if (isPlaying && !speedMenuOpen) {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () {
        playerContainer.classList.add('hide-controls');
      }, 800);
    }
  });

  document.addEventListener('fullscreenchange', function () {
    isFullscreen = !!document.fullscreenElement;
    updateFullscreenUI();
  });
  document.addEventListener('webkitfullscreenchange', function () {
    isFullscreen = !!document.webkitFullscreenElement;
    updateFullscreenUI();
  });

  video.addEventListener('enterpictureinpicture', function () { isPip = true; if (pipBtn) pipBtn.classList.add('active'); });
  video.addEventListener('leavepictureinpicture', function () { isPip = false; if (pipBtn) pipBtn.classList.remove('active'); });

  var speedSteps = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  if (speedMenu) {
    speedSteps.forEach(function (s) {
      var btn = document.createElement('button');
      btn.className = 'speed-option' + (s === 1 ? ' active' : '');
      btn.dataset.speed = s;
      btn.innerHTML = (s === 1 ? 'Normal' : s + 'x') + '<span class="check">&#10003;</span>';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        setSpeed(s);
        speedMenuOpen = false;
        speedMenu.classList.remove('open');
        resetHideTimer();
      });
      speedMenu.appendChild(btn);
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.key) {
      case ' ': e.preventDefault(); togglePlay(); break;
      case 'ArrowLeft': e.preventDefault(); skip(-10); break;
      case 'ArrowRight': e.preventDefault(); skip(10); break;
      case 'ArrowUp': e.preventDefault(); setVolume(currentVolume + 0.05); break;
      case 'ArrowDown': e.preventDefault(); setVolume(currentVolume - 0.05); break;
      case 'm': case 'M': toggleMute(); break;
      case 'f': case 'F': toggleFullscreen(); break;
    }
  });

  initVolumeBars();
  updatePlayPause();
  updateVolumeUI();
  updateFullscreenUI();
  updateSpeedUI();
  initFromUrl();
})();
