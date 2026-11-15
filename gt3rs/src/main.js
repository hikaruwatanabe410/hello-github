import '@fontsource-variable/unbounded';
import '@fontsource-variable/manrope';
import '@fontsource-variable/jetbrains-mono';
import './style.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage, PAINTS, WHEELS } from './scene.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/* ------------------------------------------------------------ smooth scroll */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
document.documentElement.classList.add('is-loading');

$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const target = $(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { duration: 1.6 });
    else target.scrollIntoView();
  });
});

/* -------------------------------------------------------------------- stage */
const loaderCount = $('#loaderCount');
const loaderBar = $('#loaderBar');
const loaderStatus = $('#loaderStatus');
const shown = { v: 0 };
function setLoader(p) {
  gsap.to(shown, {
    v: p * 100, duration: 0.5, ease: 'power2.out', overwrite: true,
    onUpdate() {
      loaderCount.textContent = String(Math.round(shown.v)).padStart(3, '0');
      loaderBar.style.transform = `scaleX(${shown.v / 100})`;
    },
  });
}

const stage = createStage($('#stage'), { onProgress: (p) => setLoader(p * 0.9) });

/* ----------------------------------------------------------- scroll → poses */
const poseSections = $$('[data-pose]');
const indexed = $$('[data-index]');
const configSection = $('#configure');
const backTitle = $('#backTitle');
const hudIndex = $('#hudIndex');
const hudProgress = $('#hudProgress');
const nav = $('#nav');
let centres = [];
let stageEnd = 0;

function measure() {
  const y = window.scrollY;
  centres = poseSections.map((s) => {
    const r = s.getBoundingClientRect();
    return r.top + y + r.height / 2;
  });
  const r = configSection.getBoundingClientRect();
  stageEnd = r.bottom + y;
}

function onScroll() {
  const y = window.scrollY, vh = window.innerHeight;
  const mid = y + vh / 2;

  if (stage) {
    let i = 0;
    while (i < centres.length - 2 && mid > centres[i + 1]) i++;
    const span = centres[i + 1] - centres[i];
    // Hold each pose while its section is centred, travel in between.
    const t = clamp01(((mid - centres[i]) / span - 0.22) / 0.56);
    stage.setBlend(poseSections[i].dataset.pose, poseSections[i + 1].dataset.pose, t);
    stage.setVisible(y < stageEnd);
  }

  backTitle.style.opacity = String(1 - clamp01(y / (vh * 0.55)));
  backTitle.style.transform = `translate3d(0, ${y * -0.18}px, 0)`;
  nav.classList.toggle('is-scrolled', y > 40);

  let current = indexed[0];
  for (const s of indexed) if (s.getBoundingClientRect().top <= vh * 0.5) current = s;
  hudIndex.textContent = current.dataset.index;
  const max = document.documentElement.scrollHeight - vh;
  hudProgress.style.transform = `scaleY(${max > 0 ? y / max : 0})`;
}

/* --------------------------------------------------------------- reveal fx */
function setupReveals() {
  if (reduced) return;
  const groups = new Map();
  $$('[data-reveal]').forEach((el) => {
    const parent = el.closest('section, article, form') || document.body;
    if (!groups.has(parent)) groups.set(parent, []);
    groups.get(parent).push(el);
  });
  groups.forEach((els, parent) => {
    gsap.set(els, { autoAlpha: 0, y: 36 });
    ScrollTrigger.batch(els, {
      start: 'top 88%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.09 }),
    });
  });
}

function setupCounters() {
  $$('[data-count]').forEach((el) => {
    const end = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const fmt = (v) => (el.dataset.sep !== undefined ? Math.round(v).toLocaleString('en-US') : v.toFixed(decimals));
    if (reduced) { el.textContent = fmt(end); return; }
    const o = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: 'top 90%', once: true,
      onEnter: () => gsap.to(o, { v: end, duration: 1.8, ease: 'power3.out', onUpdate: () => { el.textContent = fmt(o.v); } }),
    });
  });
}

/* ------------------------------------------------------------- configurator */
const spec = { paint: PAINTS[0], wheel: WHEELS[0] };
const specField = $('#specField');
function syncSpec() { specField.value = `${spec.paint.name} / ${spec.wheel.name} wheels`; }

function buildSwatches(container, items, label, onPick) {
  items.forEach((item, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.style.setProperty('--c', item.hex);
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', i === 0 ? 'true' : 'false');
    b.setAttribute('aria-label', item.name);
    b.title = item.name;
    b.addEventListener('click', () => {
      $$('.swatch', container).forEach((s) => s.setAttribute('aria-checked', 'false'));
      b.setAttribute('aria-checked', 'true');
      label.textContent = item.name;
      onPick(item);
      syncSpec();
    });
    container.appendChild(b);
  });
}
buildSwatches($('#paintSwatches'), PAINTS, $('#paintName'), (p) => { spec.paint = p; stage && stage.setPaint(p.id); });
buildSwatches($('#wheelSwatches'), WHEELS, $('#wheelName'), (w) => { spec.wheel = w; stage && stage.setWheels(w.id); });
syncSpec();

const dragLayer = $('#dragLayer');
let dragging = false, lastX = 0;
dragLayer.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; dragLayer.classList.add('is-dragging'); dragLayer.setPointerCapture(e.pointerId); });
dragLayer.addEventListener('pointermove', (e) => {
  if (!dragging || !stage) return;
  stage.drag((e.clientX - lastX) * 0.006);
  lastX = e.clientX;
});
const endDrag = () => { dragging = false; dragLayer.classList.remove('is-dragging'); };
dragLayer.addEventListener('pointerup', endDrag);
dragLayer.addEventListener('pointercancel', endDrag);

/* ------------------------------------------------------------------ gallery */
const galleryTrack = $('#galleryTrack');
function fillGallery(shots) {
  shots.forEach((s, i) => {
    const fig = document.createElement('figure');
    fig.className = 'shot';
    fig.innerHTML = `<div class="shot__frame"><img alt="${s.title} of the 911 GT3 RS in ${s.paint}" loading="lazy" /></div>
      <figcaption><span class="mono">${String(i + 1).padStart(2, '0')}</span><strong>${s.title}</strong><em>${s.paint}</em></figcaption>`;
    $('img', fig).src = s.url;
    galleryTrack.appendChild(fig);
  });
}

function setupGalleryScroll() {
  const mm = gsap.matchMedia();
  mm.add('(min-width: 860px) and (prefers-reduced-motion: no-preference)', () => {
    const pin = $('.gallery__pin');
    const distance = () => Math.max(0, galleryTrack.scrollWidth - window.innerWidth + galleryTrack.offsetLeft + 64);
    gsap.to(galleryTrack, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: { trigger: pin, start: 'top top', end: () => `+=${distance()}`, pin: true, scrub: 0.6, invalidateOnRefresh: true },
    });
  });
}

/* --------------------------------------------------------------------- form */
const form = $('#enquireForm');
const note = $('#formNote');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const bad = $$('[required]', form).filter((f) => !f.checkValidity());
  $$('.field', form).forEach((f) => f.classList.remove('is-invalid'));
  if (bad.length) {
    bad.forEach((f) => f.closest('.field').classList.add('is-invalid'));
    note.textContent = 'Please add your name and a valid email address.';
    bad[0].focus();
    return;
  }
  const data = Object.fromEntries(new FormData(form));
  const endpoint = form.dataset.endpoint; // set data-endpoint on the form to deliver enquiries
  try {
    if (endpoint) {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error(String(res.status));
    }
    form.classList.add('is-sent');
    note.textContent = `Thank you, ${data.name.split(' ')[0]}. A specialist will be in touch within one working day.`;
    form.reset();
    syncSpec();
  } catch (err) {
    note.textContent = 'Something went wrong sending your enquiry. Please call or email us instead.';
  }
});

/* -------------------------------------------------------------------- intro */
function intro() {
  measure();
  onScroll();
  setupReveals();
  setupCounters();
  setupGalleryScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { measure(); onScroll(); });
  ScrollTrigger.addEventListener('refresh', () => { measure(); onScroll(); });
  ScrollTrigger.refresh();

  document.documentElement.classList.remove('is-loading');
  if (lenis) lenis.start();
  const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
  tl.to('#loader', { yPercent: -100, duration: reduced ? 0 : 1.1, ease: 'power4.inOut' })
    .set('#loader', { display: 'none' });
  if (!reduced) {
    tl.from('.backdrop__title span', { yPercent: 40, autoAlpha: 0, duration: 1.6, stagger: 0.12 }, '-=0.6')
      .from('[data-hero]', { y: 30, autoAlpha: 0, duration: 1.2, stagger: 0.1 }, '-=1.2')
      .from('.nav, .hud', { autoAlpha: 0, duration: 1 }, '-=1');
  }
}

async function boot() {
  if (!stage) {
    document.documentElement.classList.add('no-webgl');
    setLoader(1);
    intro();
    return;
  }
  try {
    await stage.ready;
    loaderStatus.textContent = 'Developing gallery';
    setLoader(0.94);
    await document.fonts.ready;
    fillGallery(await stage.captureGallery());
    setLoader(1);
    measure();
    onScroll();
    stage.snap(reduced ? null : { az: -0.5, el: 0.34, dist: 15 });
    stage.start();
    await new Promise((r) => setTimeout(r, 450));
  } catch (err) {
    console.error(err);
    document.documentElement.classList.add('no-webgl');
  }
  intro();
}
boot();
