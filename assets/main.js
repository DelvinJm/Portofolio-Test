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

  function loadSlide(entry, index) {
    const src = safeUrl(entry?.src, { relative: true });
    if (!src) return Promise.resolve(null);
    return new Promise(resolve => {
      const image = new Image();
      let finished = false;
      const finish = result => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        image.onload = null;
        image.onerror = null;
        resolve(result);
      };
      const timeout = setTimeout(() => finish(null), 15000);
      image.alt = typeof entry.alt === 'string' && entry.alt.trim()
        ? entry.alt.trim()
        : `Dokumentasi magang, foto ${index + 1}`;
      image.decoding = 'async';
      image.className = 'absolute inset-0 h-full w-full object-cover';
      image.onload = () => finish(image.naturalWidth ? image : null);
      image.onerror = () => finish(null);
      image.src = src;
    });
  }

  async function setupSlider(container) {
    const entries = content.internships?.[container.dataset.slider];
    if (!Array.isArray(entries) || !entries.length) return;
    const slidesHost = container.querySelector('[data-slides]');
    const placeholder = container.querySelector('[data-slider-empty]');
    const controls = container.querySelector('[data-slider-controls]');
    if (!slidesHost) return;
    const slides = (await Promise.all(entries.map(loadSlide))).filter(Boolean);
    if (!slides.length) return;

    slides.forEach((image, index) => {
      image.hidden = index !== 0;
      slidesHost.append(image);
    });
    if (placeholder) placeholder.hidden = true;
    if (slides.length < 2 || !controls) return;

    let current = 0;
    let timer = null;
    let userPaused = false;
    let pointerInside = false;
    let focusInside = false;
    const previous = controls.querySelector('[data-prev]');
    const next = controls.querySelector('[data-next]');
    const toggle = controls.querySelector('[data-toggle]');
    const dotsHost = controls.querySelector('[data-dots]');
    const status = controls.querySelector('[data-slide-status]');
    const dots = [];

    if (status) status.setAttribute('aria-live', 'off');
    controls.hidden = false;
    container.setAttribute('aria-roledescription', 'carousel');
    if (!container.hasAttribute('role')) container.setAttribute('role', 'region');

    function show(index) {
      current = (index + slides.length) % slides.length;
      slides.forEach((image, slideIndex) => { image.hidden = slideIndex !== current; });
      dots.forEach((dot, dotIndex) => {
        const active = dotIndex === current;
        dot.setAttribute('aria-pressed', String(active));
        dot.setAttribute('aria-current', String(active));
        dot.dataset.active = String(active);
        dot.firstElementChild.classList.toggle('bg-primary', active);
        dot.firstElementChild.classList.toggle('bg-slate-300', !active);
      });
      if (status) status.textContent = `${current + 1} / ${slides.length}`;
    }

    function syncAutoplay() {
      if (timer !== null) clearInterval(timer);
      timer = null;
      const motionPaused = reducedMotion.matches;
      const paused = userPaused || motionPaused;
      if (toggle) {
        toggle.disabled = motionPaused;
        toggle.setAttribute('aria-pressed', String(paused));
        toggle.setAttribute('aria-label', motionPaused
          ? 'Otomatis dijeda sesuai preferensi gerakan'
          : userPaused ? 'Lanjutkan pergantian foto otomatis' : 'Jeda pergantian foto otomatis');
        toggle.textContent = motionPaused ? 'Gerakan dikurangi' : userPaused ? 'Lanjutkan' : 'Jeda';
      }
      if (!paused && !pointerInside && !focusInside && !document.hidden) {
        timer = setInterval(() => show(current + 1), AUTOPLAY_INTERVAL);
      }
    }

    function select(index) {
      show(index);
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
      dot.addEventListener('click', () => select(index));
      dots.push(dot);
      dotsHost.append(dot);
    });

    previous?.addEventListener('click', () => select(current - 1));
    next?.addEventListener('click', () => select(current + 1));
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
    window.addEventListener('pagehide', () => { if (timer !== null) clearInterval(timer); });
    window.addEventListener('pageshow', syncAutoplay);
    show(0);
    syncAutoplay();
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
    const sections = ['about', 'journey', 'interests', 'certificates', 'contact']
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
