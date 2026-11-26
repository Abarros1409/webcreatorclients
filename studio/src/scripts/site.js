// Behaviour (works with or without motion). Demos that play by themselves stop for good
// as soon as the visitor touches them, and never run with reduced motion.
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const data = JSON.parse(document.getElementById('studio-data').textContent);
const ui = data.ui;

/* Motion (GSAP, Lenis) loads on the first sign of a visitor (scroll, touch, mouse, keys):
   everything it animates sits below the hero, which animates in CSS on its own. */
if (!reduce) {
  let started = false;
  const start = () => { if (started) return; started = true; import('./motion.js'); };
  ['scroll', 'wheel', 'touchstart', 'pointerdown', 'pointermove', 'keydown'].forEach((ev) => addEventListener(ev, start, { once: true, passive: true }));
  addEventListener('load', () => setTimeout(start, 8000), { once: true });
}

const inView = (el, cb, threshold = 0.25) => {
  if (!('IntersectionObserver' in window)) return cb(true);
  new IntersectionObserver((entries) => entries.forEach((e) => cb(e.isIntersecting)), { threshold }).observe(el);
};

/* Header shadow */
const top = document.querySelector('[data-top]');
const onScroll = () => top.classList.toggle('is-scrolled', scrollY > 8);
onScroll();
addEventListener('scroll', onScroll, { passive: true });

/* ---------- Hero phone: poster → live, autoplay through the four looks ---------- */
const screen = document.querySelector('[data-screen]');
const posterImg = screen.querySelector('[data-poster]');
const posterNext = screen.querySelector('[data-poster-next]');
const tryBtn = screen.querySelector('[data-try]');
const buttons = [...document.querySelectorAll('[data-look]')];
let frame = null;
const load = (f, src) => {
  if (src.startsWith('demo:')) f.srcdoc = JSON.parse(document.getElementById(`demo-${src.slice(5)}`).textContent);
  else f.src = src;
};
const goLive = (src, title) => {
  if (!frame) {
    frame = document.createElement('iframe');
    frame.addEventListener('load', () => { screen.classList.remove('is-loading'); screen.classList.add('is-live'); });
    screen.classList.add('is-loading');
    frame.title = title;
    load(frame, src);
    screen.appendChild(frame);
    tryBtn.remove();
    return;
  }
  screen.classList.add('is-loading');
  frame.title = title;
  setTimeout(() => load(frame, src), reduce ? 0 : 180);
};
const setActive = (b) => buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
const choose = (b) => {
  const title = screen.dataset.titleTemplate.replace('{name}', b.dataset.name);
  screen.dataset.src = b.dataset.src;
  screen.dataset.title = title;
  posterImg.alt = title;
  return title;
};

const AUTO = 5200;
let autoTimer = null;
let autoIndex = 0;
let autoStopped = reduce;
let heroVisible = true;
root.style.setProperty('--auto', `${AUTO}ms`);
const clearProg = () => buttons.forEach((b) => b.classList.remove('is-auto'));
const armAuto = () => {
  clearTimeout(autoTimer);
  clearProg();
  if (autoStopped || !heroVisible || document.hidden) return;
  const b = buttons[autoIndex];
  requestAnimationFrame(() => requestAnimationFrame(() => { if (!autoStopped) b.classList.add('is-auto'); }));
  autoTimer = setTimeout(() => {
    autoIndex = (autoIndex + 1) % buttons.length;
    const next = buttons[autoIndex];
    posterNext.onload = () => {
      posterNext.classList.add('show');
      setTimeout(() => { posterImg.src = posterNext.src; posterNext.classList.remove('show'); }, 650);
    };
    posterNext.src = next.dataset.posterSrc;
    choose(next);
    setActive(next);
    armAuto();
  }, AUTO);
};
const stopAuto = () => { autoStopped = true; clearTimeout(autoTimer); clearProg(); };
inView(screen, (v) => { heroVisible = v; armAuto(); }, 0.3);
document.addEventListener('visibilitychange', armAuto);
screen.addEventListener('pointerenter', () => { clearTimeout(autoTimer); clearProg(); });
screen.addEventListener('pointerleave', armAuto);

tryBtn.addEventListener('click', () => { stopAuto(); goLive(screen.dataset.src, screen.dataset.title); });
buttons.forEach((b, i) => b.addEventListener('click', () => {
  if (b.getAttribute('aria-pressed') === 'true' && frame) return;
  stopAuto();
  autoIndex = i;
  setActive(b);
  posterImg.src = b.dataset.posterSrc;
  goLive(b.dataset.src, choose(b));
}));

/* ---------- Menu search, with a self-typing demo until someone uses it ---------- */
const md = document.querySelector('[data-menu-demo]');
if (md) {
  const input = md.querySelector('input');
  const items = [...md.querySelectorAll('li')];
  const empty = md.querySelector('[data-empty]');
  const apply = () => {
    const q = input.value.trim().toLowerCase();
    let n = 0;
    // Rows stay in place: matches light up, the rest step back (no jumping box, no empty card).
    items.forEach((li) => { const on = !q || li.dataset.q.includes(q); li.classList.toggle('dim', !on); li.classList.toggle('hit', !!q && on); if (on) n++; });
    empty.hidden = n !== 0;
  };
  input.addEventListener('input', apply);
  let typingOn = !reduce;
  let visible = false;
  let timer = null;
  const words = JSON.parse(md.dataset.typing);
  const stop = () => { typingOn = false; clearTimeout(timer); };
  input.addEventListener('focus', () => { if (typingOn) { stop(); input.value = ''; apply(); } });
  md.addEventListener('pointerdown', stop);
  const sleep = (ms) => new Promise((r) => { timer = setTimeout(r, ms); });
  const run = async () => {
    let w = 0;
    while (typingOn) {
      if (!visible) { await sleep(400); continue; }
      const word = words[w % words.length];
      for (let i = 1; i <= word.length && typingOn; i++) { input.value = word.slice(0, i); apply(); await sleep(140); }
      await sleep(1600);
      for (let i = word.length - 1; i >= 0 && typingOn; i--) { input.value = word.slice(0, i); apply(); await sleep(60); }
      await sleep(700);
      w++;
    }
  };
  if (typingOn) { inView(md, (v) => { visible = v; }, 0.5); run(); }
}

/* ---------- Open now + live clock (Rotterdam time) ---------- */
const order = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'];
const ams = () => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const get = (k) => parts.find((p) => p.type === k)?.value;
  return { day: { Mon: 'mo', Tue: 'tu', Wed: 'we', Thu: 'th', Fri: 'fr', Sat: 'sa', Sun: 'su' }[get('weekday')], h: get('hour'), m: get('minute'), s: get('second') };
};
const m = (s) => { const [h, mi] = s.split(':').map(Number); return h * 60 + mi; };
const openText = () => {
  const now = ams();
  const mins = Number(now.h) * 60 + Number(now.m);
  let open = null;
  let next = null;
  const prev = order[(order.indexOf(now.day) + 6) % 7];
  for (const [o, c] of data.hours[prev]) if (m(c) <= m(o) && mins < m(c)) open = c;
  if (!open) for (const [o, c] of data.hours[now.day]) {
    const end = m(c) <= m(o) ? m(c) + 1440 : m(c);
    if (mins >= m(o) && mins < end) open = c; else if (mins < m(o) && !next) next = { t: o };
  }
  if (!open && !next) { const d = order[(order.indexOf(now.day) + 1) % 7]; next = { d: ui.daysLong[order.indexOf(d)], t: data.hours[d][0][0] }; }
  const text = open
    ? `${ui.open} · ${ui.until.replace('{t}', open)}`
    : `${ui.closed} · ${next.d ? ui.opensDay.replace('{d}', next.d).replace('{t}', next.t) : ui.opens.replace('{t}', next.t)}`;
  return { text, open: !!open, day: now.day };
};
// Time-zone formatting is costly the first time: do it when the browser is idle.
const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 1200));
idle(() => {
  const state = openText();
  const badge = document.querySelector('[data-badge]');
  badge.classList.toggle('is-open', state.open);
  badge.querySelector('[data-badge-text]').textContent = state.text;
  document.querySelector(`[data-day="${state.day}"]`)?.classList.add('today');
  const chipOpen = document.querySelector('.chip-open');
  if (chipOpen) { chipOpen.lastChild.textContent = state.text; chipOpen.querySelector('.dot').style.background = state.open ? '' : '#d9694f'; }
  const clock = document.querySelector('[data-clock]');
  const tick = () => { const n = ams(); clock.textContent = `${n.h}:${n.m}:${n.s}`; };
  tick();
  let timer = null;
  inView(clock, (v) => { clearInterval(timer); if (v) timer = setInterval(tick, 1000); }, 0);
});

/* ---------- NL / EN, flipping by itself until clicked ---------- */
const sample = document.querySelector('[data-lang-sample]');
const langButtons = [...document.querySelectorAll('[data-lang-set]')];
const langPath = document.querySelector('[data-lang-path]');
let langAuto = !reduce;
const setLang = (l) => {
  langButtons.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.langSet === l)));
  sample.classList.add('is-swapping');
  setTimeout(() => {
    sample.querySelectorAll('span').forEach((s) => { s.textContent = s.dataset[l]; });
    if (langPath) langPath.textContent = langPath.dataset[l];
    sample.classList.remove('is-swapping');
  }, reduce ? 0 : 220);
};
langButtons.forEach((b) => b.addEventListener('click', () => { langAuto = false; setLang(b.dataset.langSet); }));
if (langAuto) {
  let visible = false;
  inView(sample, (v) => { visible = v; }, 0.6);
  let current = 'nl';
  setInterval(() => {
    if (!langAuto || !visible || document.hidden) return;
    current = current === 'nl' ? 'en' : 'nl';
    setLang(current);
  }, 3200);
}
