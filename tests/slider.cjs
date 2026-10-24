const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../assets/main.js'), 'utf8');

class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.children = []; this.events = {};
    this.attributes = {}; this.dataset = {}; this.selectors = {}; this.hidden = false;
    this.textContent = ''; this.className = ''; this.parentElement = null;
    this.classes = new Set();
    this.classList = { toggle: (name, add) => add ? this.classes.add(name) : this.classes.delete(name) };
  }
  addEventListener(name, fn) { (this.events[name] ||= []).push(fn); }
  fire(name, options = {}) { for (const fn of this.events[name] || []) fn({ target: this, ...options }); }
  querySelector(selector) { return this.selectors[selector] || null; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  hasAttribute(name) { return name in this.attributes; }
  removeAttribute(name) { delete this.attributes[name]; }
  append(child) { this.children.push(child); child.parentElement = this; }
  get firstElementChild() { return this.children[0] || null; }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
}

function fixture(entries, extras = {}) {
  const container = new Element(); container.dataset.slider = 'wahana';
  const slides = new Element(), placeholder = new Element(), controls = new Element();
  const previous = new Element('button'), next = new Element('button'), toggle = new Element('button');
  const dots = new Element(), status = new Element(); controls.hidden = true;
  Object.assign(container.selectors, { '[data-slides]': slides, '[data-slider-empty]': placeholder, '[data-slider-controls]': controls });
  Object.assign(controls.selectors, { '[data-prev]': previous, '[data-next]': next, '[data-toggle]': toggle, '[data-dots]': dots, '[data-slide-status]': status });
  [slides, placeholder, controls].forEach(child => container.append(child));
  [previous, next, toggle, dots, status].forEach(child => controls.append(child));
  const intervals = new Map(), timeouts = new Map(); let clockId = 0;
  const requests = [], pending = new Map();
  const doc = new Element('document'); doc.baseURI = 'https://example.test/portfolio/'; doc.hidden = false;
  doc.getElementById = () => null;
  const selectors = { '[data-slider]': [container], ...extras.selectors };
  doc.querySelectorAll = selector => selectors[selector] || [];
  doc.querySelector = selector => extras.singles?.[selector] || null;
  doc.createElement = tag => new Element(tag);
  const reduced = new Element(); reduced.matches = !!extras.reduced;
  const desktop = new Element(); desktop.matches = false;
  const win = new Element('window');
  win.PORTFOLIO_CONTENT = { internships: { wahana: entries }, ...extras.content };
  win.matchMedia = query => query.includes('prefers-reduced-motion') ? reduced : desktop;
  win.scrollY = 0;
  class MockImage extends Element {
    constructor() { super('img'); this.naturalWidth = 0; }
    set src(value) {
      this._src = value;
      requests.push(value);
      const complete = () => {
        if (value.includes('bad')) this.onerror?.();
        else { this.naturalWidth = 800; this.onload?.(); }
      };
      if (value.includes('slow')) pending.set(value, complete);
      else queueMicrotask(complete);
    }
    get src() { return this._src; }
  }
  const context = {
    window: win, document: doc, Image: MockImage, URL, console,
    setTimeout: (fn, ms) => { const id = ++clockId; timeouts.set(id, { fn, ms }); return id; },
    clearTimeout: id => timeouts.delete(id),
    setInterval: (fn, ms) => { const id = ++clockId; intervals.set(id, { fn, ms }); return id; },
    clearInterval: id => intervals.delete(id),
    requestAnimationFrame: fn => fn(), cancelAnimationFrame() {},
  };
  vm.runInNewContext(source, context, { filename: 'main.js' });
  return { container, slides, placeholder, controls, previous, next, toggle, dots, status, intervals, timeouts, doc, reduced, win, requests, pending };
}

async function settle() { await new Promise(resolve => setImmediate(resolve)); }
function activeIndex(f) { return f.slides.children.findIndex(image => !image.hidden); }
const results = [];
function passed(name) { results.push(name); }

(async () => {
  const empty = fixture([]); await settle();
  assert.equal(empty.slides.children.length, 0); assert.equal(empty.placeholder.hidden, false);
  assert.equal(empty.controls.hidden, true); assert.equal(empty.intervals.size, 0);
  passed('Empty slider retains placeholder and starts no autoplay');

  const one = fixture([{ src: 'assets/images/one.jpg', alt: 'Satu' }]); await settle();
  assert.equal(one.slides.children.length, 1); assert.equal(activeIndex(one), 0);
  assert.equal(one.placeholder.hidden, true); assert.equal(one.controls.hidden, true);
  assert.equal(one.intervals.size, 0); assert.equal(one.timeouts.size, 0);
  passed('One successful image displays without redundant controls or interval');

  const errors = fixture([{ src: 'https://example.test/bad.jpg' }, { src: 'javascript:alert(1)' }]); await settle();
  assert.equal(activeIndex(errors), -1); assert.equal(errors.placeholder.hidden, false);
  assert.equal(errors.controls.hidden, true); assert.equal(errors.intervals.size, 0);
  passed('All failed or unsafe image sources retain fallback');

  const multi = fixture([{ src: 'https://example.test/one.jpg' }, { src: 'https://example.test/bad.jpg' }, { src: 'assets/images/two.jpg' }, { src: 'javascript:alert(1)' }]); await settle();
  assert.equal(multi.slides.children.length, 3); assert.equal(multi.controls.hidden, false);
  assert.equal(multi.dots.children.length, 3); assert.equal(multi.status.textContent, '1 / 3');
  assert.deepEqual(multi.requests, ['https://example.test/one.jpg']);
  assert.equal(multi.slides.children[0].loading, 'eager');
  assert.equal(multi.slides.children[1].loading, 'lazy');
  assert.equal(multi.slides.children[2].loading, 'lazy');
  assert.equal(multi.slides.children[1].src, undefined);
  assert.equal(multi.intervals.size, 1); assert.equal([...multi.intervals.values()][0].ms, 5000);
  assert.equal(multi.status.getAttribute('aria-live'), 'off');
  passed('Only first image is fetched initially; later images have lazy hints and no src; autoplay waits 5000ms');

  [...multi.intervals.values()][0].fn(); await settle(); assert.equal(activeIndex(multi), 2);
  assert.equal(multi.status.textContent, '2 / 2'); assert.equal(multi.dots.children[1].hidden, true);
  assert.equal(multi.slides.children[2].loading, 'lazy');
  multi.next.fire('click'); await settle(); assert.equal(activeIndex(multi), 0);
  multi.previous.fire('click'); await settle(); assert.equal(activeIndex(multi), 2);
  const originalDot = multi.dots.children[0]; originalDot.fire('click');
  await settle();
  assert.equal(activeIndex(multi), 0); assert.equal(multi.dots.children[0], originalDot);
  assert.equal(originalDot.getAttribute('aria-pressed'), 'true');
  assert.equal(originalDot.firstElementChild.classes.has('bg-primary'), true);
  assert.equal(multi.requests.length, 3);
  passed('Autoplay, next/previous wrap, and stable dot navigation work');

  multi.toggle.fire('click'); assert.equal(multi.intervals.size, 0);
  assert.equal(multi.toggle.textContent, 'Lanjutkan');
  multi.toggle.fire('click'); assert.equal(multi.intervals.size, 1);
  multi.container.fire('pointerenter', { pointerType: 'mouse' }); assert.equal(multi.intervals.size, 0);
  multi.container.fire('pointerleave'); assert.equal(multi.intervals.size, 1);
  multi.container.fire('focusin'); assert.equal(multi.intervals.size, 0);
  multi.container.fire('focusout', { relatedTarget: multi.next }); assert.equal(multi.intervals.size, 0);
  multi.container.fire('focusout', { relatedTarget: null }); assert.equal(multi.intervals.size, 1);
  passed('Explicit pause, pointer hover and keyboard focus pause autoplay');

  multi.doc.hidden = true; multi.doc.fire('visibilitychange'); assert.equal(multi.intervals.size, 0);
  multi.doc.hidden = false; multi.doc.fire('visibilitychange'); assert.equal(multi.intervals.size, 1);
  multi.reduced.matches = true; multi.reduced.fire('change'); assert.equal(multi.intervals.size, 0);
  assert.equal(multi.toggle.disabled, true);
  multi.next.fire('click'); await settle(); assert.equal(activeIndex(multi), 2); assert.equal(multi.intervals.size, 0);
  multi.reduced.matches = false; multi.reduced.fire('change'); assert.equal(multi.intervals.size, 1);
  multi.win.fire('pagehide'); assert.equal(multi.intervals.size, 0);
  multi.win.fire('pageshow'); assert.equal(multi.intervals.size, 1);
  passed('Hidden tab, reduced motion and page lifecycle pause; manual navigation stays usable');

  const reduced = fixture([{ src: 'one.jpg' }, { src: 'two.jpg' }], { reduced: true }); await settle();
  assert.equal(reduced.intervals.size, 0); assert.equal(reduced.toggle.disabled, true);
  passed('Initial reduced-motion preference disables autoplay');

  const slow = fixture([{ src: 'one.jpg' }, { src: 'slow-two.jpg' }, { src: 'three.jpg' }]); await settle();
  slow.next.fire('click'); await settle();
  assert.equal(activeIndex(slow), 0); assert.equal(slow.intervals.size, 0);
  assert.equal(slow.container.getAttribute('aria-busy'), 'true');
  assert.deepEqual(slow.requests, ['one.jpg', 'slow-two.jpg']);
  slow.next.fire('click'); await settle();
  assert.equal(activeIndex(slow), 2);
  slow.pending.get('slow-two.jpg')(); await settle();
  assert.equal(activeIndex(slow), 2); assert.equal(slow.container.getAttribute('aria-busy'), 'false');
  slow.previous.fire('click'); await settle(); assert.equal(activeIndex(slow), 1);
  assert.equal(slow.requests.length, 3);
  passed('Slow loads preserve visible photo; rapid navigation wins over stale responses and caches requests');

  const timeout = fixture([{ src: 'slow-first.jpg' }, { src: 'fallback.jpg' }]); await settle();
  assert.equal(timeout.placeholder.hidden, false); assert.deepEqual(timeout.requests, ['slow-first.jpg']);
  [...timeout.timeouts.values()][0].fn(); await settle();
  assert.equal(activeIndex(timeout), 1); assert.equal(timeout.slides.children[1].loading, 'eager');
  assert.equal(timeout.controls.hidden, true); assert.equal(timeout.intervals.size, 0);
  timeout.pending.get('slow-first.jpg')(); await settle(); assert.equal(activeIndex(timeout), 1);
  passed('Timed-out first photo is skipped; fallback becomes first eager image and late load cannot replace it');

  const lastFails = fixture([{ src: 'one.jpg' }, { src: 'bad-two.jpg' }]); await settle();
  lastFails.next.fire('click'); await settle();
  assert.equal(activeIndex(lastFails), 0); assert.equal(lastFails.controls.hidden, true);
  assert.equal(lastFails.intervals.size, 0); assert.equal(lastFails.status.textContent, '1 / 1');
  passed('When remaining photos fail, current photo remains and redundant autoplay/controls stop');

  const staleFailure = fixture([{ src: 'one.jpg' }, { src: 'slow-bad-two.jpg' }]); await settle();
  staleFailure.next.fire('click'); staleFailure.dots.children[0].fire('click'); await settle();
  assert.equal(staleFailure.intervals.size, 1);
  staleFailure.pending.get('slow-bad-two.jpg')(); await settle();
  assert.equal(activeIndex(staleFailure), 0); assert.equal(staleFailure.controls.hidden, true);
  assert.equal(staleFailure.intervals.size, 0);
  passed('Stale failed request also stops autoplay when only one working photo remains');

  const away = fixture([{ src: 'one.jpg' }, { src: 'slow-two.jpg' }]); await settle();
  away.next.fire('click'); away.win.fire('pagehide');
  away.pending.get('slow-two.jpg')(); await settle();
  assert.equal(away.intervals.size, 0);
  away.win.fire('pageshow'); assert.equal(away.intervals.size, 1);
  passed('Completing a pending load after pagehide cannot restart autoplay');

  const pauseCases = [
    ['explicit pause', f => f.toggle.fire('click'), f => f.toggle.fire('click')],
    ['pointer hover', f => f.container.fire('pointerenter', { pointerType: 'mouse' }), f => f.container.fire('pointerleave')],
    ['keyboard focus', f => f.container.fire('focusin'), f => f.container.fire('focusout', { relatedTarget: null })],
    ['reduced motion', f => { f.reduced.matches = true; f.reduced.fire('change'); }, f => { f.reduced.matches = false; f.reduced.fire('change'); }],
    ['hidden tab', f => { f.doc.hidden = true; f.doc.fire('visibilitychange'); }, f => { f.doc.hidden = false; f.doc.fire('visibilitychange'); }],
    ['pagehide', f => f.win.fire('pagehide'), f => f.win.fire('pageshow')],
  ];
  for (const [name, pause, resume] of pauseCases) {
    const pendingAuto = fixture([{ src: 'one.jpg' }, { src: 'slow-two.jpg' }]); await settle();
    [...pendingAuto.intervals.values()][0].fn(); await settle();
    assert.equal(pendingAuto.container.getAttribute('aria-busy'), 'true');
    pause(pendingAuto);
    assert.equal(pendingAuto.container.getAttribute('aria-busy'), 'false');
    pendingAuto.pending.get('slow-two.jpg')(); await settle();
    assert.equal(activeIndex(pendingAuto), 0); assert.equal(pendingAuto.intervals.size, 0);
    assert.equal(pendingAuto.status.textContent, '1 / 2');
    resume(pendingAuto);
    assert.equal(activeIndex(pendingAuto), 0);
    assert.equal([...pendingAuto.intervals.values()][0].ms, 5000);
    [...pendingAuto.intervals.values()][0].fn(); await settle();
    assert.equal(activeIndex(pendingAuto), 1);
    assert.deepEqual(pendingAuto.requests, ['one.jpg', 'slow-two.jpg']);
    pause(pendingAuto);
    pendingAuto.previous.fire('click'); await settle(); assert.equal(activeIndex(pendingAuto), 0);
    passed(`Pending autoplay respects ${name}, resumes from cache after 5s, and manual navigation stays usable`);
  }

  const imageContainer = new Element(); imageContainer.dataset.image = 'profile';
  const image = new Element('img'), imagePlaceholder = new Element(); image.hidden = true; image.loading = 'lazy';
  imageContainer.selectors = { img: image, '[data-placeholder]': imagePlaceholder };
  fixture([], { content: { images: { profile: 'assets/profile.jpg' } }, selectors: { '[data-image]': [imageContainer] } });
  assert.equal(image.loading, 'eager'); assert.equal(image.src, 'assets/profile.jpg');
  image.naturalWidth = 600; image.fire('load'); assert.equal(image.hidden, false); assert.equal(imagePlaceholder.hidden, true);
  image.fire('error'); assert.equal(image.hidden, true); assert.equal(imagePlaceholder.hidden, false);
  passed('Hidden media loads eagerly and swaps/falls back after load/error');

  const certificate = new Element('a'); certificate.dataset.certificate = 'aws'; certificate.setAttribute('data-certificate', 'aws');
  certificate.textContent = 'Sertifikat segera ditambahkan';
  const unsafeContact = new Element('a'); unsafeContact.dataset.contact = 'whatsapp';
  fixture([], { content: { certificates: { aws: 'assets/certificates/aws.pdf' }, contacts: { whatsapp: 'javascript:alert(1)' } }, selectors: { '[data-certificate]': [certificate], '[data-contact]': [unsafeContact] } });
  assert.equal(certificate.href, 'assets/certificates/aws.pdf'); assert.equal(certificate.textContent, 'Lihat sertifikat');
  assert.equal(certificate.hasAttribute('aria-disabled'), false); assert.equal(unsafeContact.getAttribute('aria-disabled'), 'true');
  assert.equal(certificate.target, '_blank'); assert.equal(certificate.rel, 'noopener noreferrer');
  passed('Relative certificate URLs update the visible label; unsafe contacts remain disabled');

  const video = new Element('video'); video.hidden = true; video.load = () => { video.loaded = true; };
  const videoPlaceholder = new Element();
  fixture([], { content: { highlightVideo: 'assets/highlight.mp4' }, singles: { '[data-highlight-video]': video, '[data-video-placeholder]': videoPlaceholder } });
  assert.equal(video.children[0].src, 'assets/highlight.mp4'); assert.equal(video.children[0].type, 'video/mp4');
  assert.equal(video.hidden, true); assert.equal(video.autoplay, false);
  video.fire('loadedmetadata'); assert.equal(video.hidden, false); assert.equal(videoPlaceholder.hidden, true);
  video.children[0].fire('error'); assert.equal(video.hidden, true); assert.equal(videoPlaceholder.hidden, false);
  passed('Video source is created and visibility follows metadata/error without autoplay');

  console.log(JSON.stringify({ passed: results.length, checks: results }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
