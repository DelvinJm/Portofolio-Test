(() => {
  'use strict';

  const content = window.PORTFOLIO_CONTENT || {};
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const AUTOPLAY_INTERVAL = 5000;

  // Media menerima HTTP(S) dan path relatif; tautan kontak hanya HTTPS.
  function safeUrl(value, { relative = false, httpsOnly = false } = {}) {
    if (typeof value !== 'string') return '';
    const raw = value.trim();
    if (!raw || /[\u0000-\u001f\u007f\\]/.test(raw) || raw.startsWith('//')) return '';
    const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(raw);
    if (!hasScheme && (!relative || raw.startsWith('#') || raw.startsWith('?'))) return '';
    try {
      const url = new URL(raw, document.baseURI);
      if (url.username || url.password) return '';
      const accepted = httpsOnly
        ? url.protocol === 'https:'
        : ['https:', 'http:'].includes(url.protocol) || (relative && !hasScheme && url.protocol === 'file:');
      return accepted ? raw : '';
    } catch {
      return '';
    }
  }

  function setupImages() {
    document.querySelectorAll('[data-image]').forEach(container => {
      const image = container.querySelector('img');
      const placeholder = container.querySelector('[data-placeholder]');
      const src = safeUrl(content.images?.[container.dataset.image], { relative: true });
      if (!image || !src) return;
      const showFallback = () => {
        image.hidden = true;
        if (placeholder) placeholder.hidden = false;
      };
      image.addEventListener('load', () => {
        if (!image.naturalWidth) return showFallback();
        image.hidden = false;
        if (placeholder) placeholder.hidden = true;
      });
      image.addEventListener('error', showFallback);
      // Gambar hidden + lazy dapat menunggu tanpa memicu load. Muat sebelum mengganti placeholder.
      image.loading = 'eager';
      image.src = src;
    });
  }

  function setupVideo() {
    const video = document.querySelector('[data-highlight-video]');
    const placeholder = document.querySelector('[data-video-placeholder]');
    const src = safeUrl(content.highlightVideo, { relative: true });
    if (!video || !src) return;
    const source = video.querySelector('source') || document.createElement('source');
    source.type = 'video/mp4';
    if (!source.parentElement) video.append(source);
    const showFallback = () => {
      video.hidden = true;
      if (placeholder) placeholder.hidden = false;
    };
    video.addEventListener('loadedmetadata', () => {
      video.hidden = false;
      if (placeholder) placeholder.hidden = true;
    });
    video.addEventListener('error', showFallback);
    source.addEventListener('error', showFallback);
    const poster = safeUrl(content.videoPoster, { relative: true });
    if (poster) video.poster = poster;
    video.controls = true;
    video.autoplay = false;
    video.preload = 'metadata';
    source.src = src;
    video.load();
  }

  function loadSlide(slide, firstDisplay) {
    if (slide.promise) return slide.promise;
    slide.promise = new Promise(resolve => {
      const { image, src } = slide;
      let finished = false;
      const finish = loaded => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        image.onload = null;
        image.onerror = null;
        slide.state = loaded ? 'ready' : 'failed';
        image.loading = firstDisplay ? 'eager' : 'lazy';
        if (!loaded) image.removeAttribute('src');
        resolve(loaded);
      };
      const timeout = setTimeout(() => finish(false), 15000);
      slide.state = 'loading';
      image.onload = () => finish(image.naturalWidth > 0);
      image.onerror = () => finish(false);
      // src baru diberikan saat foto dipilih. Muat permintaan ini secara eksplisit
      // agar gambar hidden + lazy tidak macet sambil foto sebelumnya tetap tampil.
      image.loading = 'eager';
      image.src = src;
    });
    return slide.promise;
  }

  function setupSlider(container) {
    const entries = content.internships?.[container.dataset.slider];
    if (!Array.isArray(entries) || !entries.length) return;
    const slidesHost = container.querySelector('[data-slides]');
    const placeholder = container.querySelector('[data-slider-empty]');
    const controls = container.querySelector('[data-slider-controls]');
    if (!slidesHost) return;
    const slides = entries.flatMap((entry, index) => {
      const src = safeUrl(entry?.src, { relative: true });
      if (!src) return [];
      const image = new Image();
      image.alt = typeof entry.alt === 'string' && entry.alt.trim()
        ? entry.alt.trim()
        : `Dokumentasi magang, foto ${index + 1}`;
      image.decoding = 'async';
      image.loading = index === 0 ? 'eager' : 'lazy';
      image.hidden = true;
      image.className = 'absolute inset-0 h-full w-full object-cover';
      slidesHost.append(image);
      return [{ image, src, state: 'idle', promise: null }];
    });
    if (!slides.length) return;

    let current = -1;
    let requested = 0;
    let requestVersion = 0;
    let selecting = false;
    let automaticRequest = false;
    let timer = null;
    let userPaused = false;
    let pointerInside = false;
    let focusInside = false;
    let pageActive = true;
    const previous = controls?.querySelector('[data-prev]');
    const next = controls?.querySelector('[data-next]');
    const toggle = controls?.querySelector('[data-toggle]');
    const dotsHost = controls?.querySelector('[data-dots]');
    const status = controls?.querySelector('[data-slide-status]');
    const dots = [];

    if (status) status.setAttribute('aria-live', 'off');
    container.setAttribute('aria-roledescription', 'carousel');
    if (!container.hasAttribute('role')) container.setAttribute('role', 'region');

    const autoplayBlocked = () => userPaused || reducedMotion.matches || pointerInside || focusInside || document.hidden || !pageActive;

    function updateControls() {
      const available = slides.filter(slide => slide.state !== 'failed');
      if (controls) controls.hidden = current < 0 || available.length < 2;
      dots.forEach((dot, dotIndex) => {
        const active = dotIndex === current;
        const number = available.indexOf(slides[dotIndex]) + 1;
        dot.hidden = number === 0;
        dot.disabled = number === 0;
        dot.setAttribute('aria-label', `Tampilkan foto ${number}`);
        dot.setAttribute('aria-pressed', String(active));
        dot.setAttribute('aria-current', String(active));
        dot.dataset.active = String(active);
        dot.firstElementChild.classList.toggle('bg-primary', active);
        dot.firstElementChild.classList.toggle('bg-slate-300', !active);
      });
      if (status) status.textContent = current < 0 ? '' : `${available.indexOf(slides[current]) + 1} / ${available.length}`;
    }

    function syncAutoplay() {
      if (timer !== null) clearInterval(timer);
      timer = null;
      const motionPaused = reducedMotion.matches;
      const paused = userPaused || motionPaused;
      const blocked = autoplayBlocked();
      if (selecting && automaticRequest && blocked) {
        // Batalkan pergantian otomatis yang masih menunggu jaringan. Hasil
        // unduhan tetap disimpan untuk dipakai setelah autoplay dilanjutkan.
        requestVersion += 1;
        selecting = false;
        automaticRequest = false;
        requested = current;
        container.setAttribute('aria-busy', 'false');
      }
      if (toggle) {
        toggle.disabled = motionPaused;
        toggle.setAttribute('aria-pressed', String(paused));
        toggle.setAttribute('aria-label', motionPaused
          ? 'Otomatis dijeda sesuai preferensi gerakan'
          : userPaused ? 'Lanjutkan pergantian foto otomatis' : 'Jeda pergantian foto otomatis');
        toggle.textContent = motionPaused ? 'Gerakan dikurangi' : userPaused ? 'Lanjutkan' : 'Jeda';
      }
      const multiple = slides.filter(slide => slide.state !== 'failed').length > 1;
      if (current >= 0 && multiple && controls && !selecting && !blocked) {
        timer = setInterval(() => { void select(current + 1, 1, true); }, AUTOPLAY_INTERVAL);
      }
    }

    async function select(index, direction = 1, automatic = false) {
      if (automatic && autoplayBlocked()) return;
      const version = ++requestVersion;
      requested = (index + slides.length) % slides.length;
      selecting = true;
      automaticRequest = automatic;
      container.setAttribute('aria-busy', 'true');
      syncAutoplay();
      for (let attempt = 0; attempt < slides.length; attempt += 1) {
        const candidate = requested;
        const slide = slides[candidate];
        const loaded = slide.state !== 'failed' && await loadSlide(slide, current < 0);
        updateControls();
        if (version !== requestVersion) {
          if (!loaded) syncAutoplay();
          return;
        }
        if (loaded) {
          current = candidate;
          slides.forEach(({ image }, slideIndex) => { image.hidden = slideIndex !== current; });
          if (placeholder) placeholder.hidden = true;
          break;
        }
        requested = (candidate + direction + slides.length) % slides.length;
      }
      selecting = false;
      automaticRequest = false;
      container.setAttribute('aria-busy', 'false');
      updateControls();
      syncAutoplay();
    }

    slides.forEach((_, index) => {
      if (!dotsHost) return;
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'flex h-8 w-8 items-center justify-center rounded-full';
      const indicator = document.createElement('span');
      indicator.className = 'h-2.5 w-2.5 rounded-full bg-slate-300 transition-colors';
      indicator.setAttribute('aria-hidden', 'true');
      dot.append(indicator);
      dot.setAttribute('aria-label', `Tampilkan foto ${index + 1}`);
      dot.addEventListener('click', () => { void select(index); });
      dots.push(dot);
      dotsHost.append(dot);
    });

    previous?.addEventListener('click', () => { void select(requested - 1, -1); });
    next?.addEventListener('click', () => { void select(requested + 1); });
    toggle?.addEventListener('click', () => { userPaused = !userPaused; syncAutoplay(); });
    container.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      pointerInside = true;
      syncAutoplay();
    });
    container.addEventListener('pointerleave', () => { pointerInside = false; syncAutoplay(); });
    container.addEventListener('focusin', () => { focusInside = true; syncAutoplay(); });
    container.addEventListener('focusout', event => {
      focusInside = !!event.relatedTarget && container.contains(event.relatedTarget);
      syncAutoplay();
    });
    document.addEventListener('visibilitychange', syncAutoplay);
    reducedMotion.addEventListener('change', syncAutoplay);
    window.addEventListener('pagehide', () => { pageActive = false; syncAutoplay(); });
    window.addEventListener('pageshow', () => { pageActive = true; syncAutoplay(); });
    void select(0);
  }

  function setupNavigation() {
    const toggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const header = document.getElementById('site-header');
    const desktop = window.matchMedia('(min-width: 768px)');

    function closeMenu({ restoreFocus = false } = {}) {
      if (!toggle || !mobileMenu) return;
      mobileMenu.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Buka menu navigasi');
      if (restoreFocus) toggle.focus();
    }

    toggle?.addEventListener('click', () => {
      if (!mobileMenu) return;
      const open = mobileMenu.hidden;
      mobileMenu.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Tutup menu navigasi' : 'Buka menu navigasi');
    });
    mobileMenu?.addEventListener('click', event => {
      if (event.target.closest('a[href^="#"]')) closeMenu();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && mobileMenu && !mobileMenu.hidden) closeMenu({ restoreFocus: true });
    });
    desktop.addEventListener('change', event => { if (event.matches) closeMenu(); });

    const setHeader = () => { if (header) header.dataset.scrolled = String(window.scrollY > 16); };
    window.addEventListener('scroll', setHeader, { passive: true });
    setHeader();

    const links = [...document.querySelectorAll('[data-nav]')];
    const sections = ['about', 'journey', 'tech-arsenal', 'certificates', 'contact']
      .map(id => document.getElementById(id)).filter(Boolean);
    if (!('IntersectionObserver' in window) || !sections.length) return;
    let observer;
    let resizeFrame;
    const markActive = id => links.forEach(link => {
      const active = link.getAttribute('href') === `#${id}`;
      link.dataset.active = String(active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    const observeSections = () => {
      observer?.disconnect();
      const height = window.innerHeight;
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => { if (entry.isIntersecting) markActive(entry.target.id); });
      }, { rootMargin: `-${Math.round(height * 0.16)}px 0px -${Math.round(height * 0.60)}px 0px` });
      sections.forEach(section => observer.observe(section));
    };
    markActive('about');
    observeSections();
    window.addEventListener('resize', () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(observeSections);
    });
  }

  function setupOptionalLinks() {
    const setLink = (link, src) => {
      const isCertificate = link.hasAttribute('data-certificate');
      const url = safeUrl(src, isCertificate ? { relative: true } : { httpsOnly: true });
      const status = link.querySelector('[data-link-status]');
      if (!url) {
        link.removeAttribute('href');
        link.setAttribute('aria-disabled', 'true');
        if (status) status.textContent = 'Segera tersedia';
        if (isCertificate) link.textContent = 'Sertifikat segera ditambahkan';
        return;
      }
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.removeAttribute('aria-disabled');
      if (status) status.hidden = true;
      if (isCertificate) link.textContent = 'Lihat sertifikat';
    };
    document.querySelectorAll('[data-contact]').forEach(link => setLink(link, content.contacts?.[link.dataset.contact]));
    document.querySelectorAll('[data-certificate]').forEach(link => setLink(link, content.certificates?.[link.dataset.certificate]));
  }

  setupImages();
  setupVideo();
  setupNavigation();
  setupOptionalLinks();
  document.querySelectorAll('[data-slider]').forEach(container => { void setupSlider(container); });
  document.querySelectorAll('[data-year]').forEach(element => { element.textContent = String(new Date().getFullYear()); });
})();
