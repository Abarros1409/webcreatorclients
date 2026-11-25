// Progressive enhancement only: every section is complete without this file.
const root = document.documentElement;
root.classList.add('js');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Open now (Europe/Amsterdam) ---------- */
function amsterdamNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const map = { Mon: 'mo', Tue: 'tu', Wed: 'we', Thu: 'th', Fri: 'fr', Sat: 'sa', Sun: 'su' };
  return { day: map[get('weekday')], minutes: Number(get('hour')) * 60 + Number(get('minute')), date: `${get('year')}-${get('month')}-${get('day')}` };
}
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const ORDER = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'];

function openState(data) {
  const now = amsterdamNow();
  const special = data.special.find((s) => s.date === now.date);
  const blocksFor = (day) => data.days[day] ?? [];
  const today = special ? (special.closed ? [] : [{ opens: special.opens, closes: special.closes }]) : blocksFor(now.day);
  // A block that closes after midnight belongs to the previous day.
  const prev = ORDER[(ORDER.indexOf(now.day) + 6) % 7];
  for (const b of blocksFor(prev)) {
    const o = toMin(b.opens), c = toMin(b.closes);
    if (c <= o && now.minutes < c) return { open: true, until: b.closes };
  }
  for (const b of today) {
    const o = toMin(b.opens), c = toMin(b.closes);
    const end = c <= o ? c + 1440 : c;
    if (now.minutes >= o && now.minutes < end) return { open: true, until: b.closes };
    if (now.minutes < o) return { open: false, next: { day: null, time: b.opens } };
  }
  for (let i = 1; i <= 7; i++) {
    const d = ORDER[(ORDER.indexOf(now.day) + i) % 7];
    const first = blocksFor(d)[0];
    if (first) return { open: false, next: { day: d, time: first.opens } };
  }
  return { open: false };
}

const hoursEl = document.getElementById('hours-data');
if (hoursEl) {
  try {
    const data = JSON.parse(hoursEl.textContent);
    const s = openState(data);
    const fill = (tpl, v) => tpl.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
    let text = s.open ? `${data.ui.openNow} · ${fill(data.ui.closesAt, { time: s.until })}` : data.ui.closedNow;
    if (!s.open && s.next) text += ` · ${s.next.day ? fill(data.ui.opensDay, { day: data.ui.days[s.next.day], time: s.next.time }) : fill(data.ui.opensAt, { time: s.next.time })}`;
    document.querySelectorAll('[data-open-badge]').forEach((el) => {
      el.hidden = false;
      el.classList.toggle('is-open', s.open);
      el.querySelector('[data-open-text]').textContent = text;
    });
    const today = amsterdamNow().day;
    document.querySelectorAll('.hours-row').forEach((row) => row.classList.toggle('is-today', row.dataset.days.split(' ').includes(today)));
  } catch { /* badge stays hidden */ }
}

/* ---------- Menu search + filter ---------- */
const menu = document.querySelector('[data-menu][data-searchable]');
if (menu) {
  const input = menu.querySelector('[data-menu-search]');
  const chips = [...menu.querySelectorAll('[data-filter]')];
  const sections = [...menu.querySelectorAll('[data-menu-section]')];
  const count = menu.querySelector('[data-menu-count]');
  const empty = menu.querySelector('[data-menu-empty]');
  let filter = menu.dataset.paged ? chips[0]?.dataset.filter ?? 'all' : 'all';
  const apply = () => {
    const q = (input?.value ?? '').trim().toLowerCase();
    let shown = 0;
    for (const s of sections) {
      let inSection = 0;
      // While searching, look through every section.
      const sectionOn = q ? true : filter === 'all' || s.dataset.menuSection === filter;
      for (const item of s.querySelectorAll('[data-menu-item]')) {
        const on = sectionOn && (!q || item.dataset.search.includes(q));
        item.hidden = !on;
        if (on) inSection++;
      }
      s.hidden = inSection === 0;
      shown += inSection;
    }
    if (count) count.textContent = q ? count.dataset.template.replace('{n}', shown) : '';
    menu.classList.toggle('is-searching', !!q);
    if (empty) empty.hidden = shown !== 0;
  };
  input?.addEventListener('input', apply);
  apply();
  chips.forEach((chip) => chip.addEventListener('click', () => {
    filter = chip.dataset.filter;
    chips.forEach((c) => { c.classList.toggle('is-active', c === chip); c.setAttribute('aria-pressed', String(c === chip)); });
    apply();
  }));
}

/* ---------- Click-to-load map (no third-party request before consent) ---------- */
document.querySelectorAll('[data-map-load]').forEach((btn) => btn.addEventListener('click', () => {
  const box = btn.closest('[data-map]');
  const iframe = document.createElement('iframe');
  iframe.src = box.dataset.map;
  iframe.title = btn.textContent.trim();
  iframe.loading = 'lazy';
  iframe.referrerPolicy = 'no-referrer';
  box.replaceChildren(iframe);
  box.classList.add('is-loaded');
}));

/* ---------- Group enquiry ---------- */
document.querySelectorAll('[data-group-form]').forEach((form) => form.addEventListener('submit', async (e) => {
  const status = form.querySelector('[data-form-status]');
  const method = form.dataset.method;
  if (form.dataset.demo) {
    e.preventDefault();
    status.textContent = status.dataset.demoText;
    status.hidden = false;
    return;
  }
  const data = new FormData(form);
  const lines = [...data.entries()].filter(([, v]) => String(v).trim()).map(([k, v]) => `${form.querySelector(`[name="${k}"]`)?.labels?.[0]?.textContent ?? k}: ${v}`);
  if (method === 'whatsapp') {
    e.preventDefault();
    window.open(`https://wa.me/${form.dataset.to.replace(/\D/g, '')}?text=${encodeURIComponent(`${form.dataset.subject}\n\n${lines.join('\n')}`)}`, '_blank', 'noopener');
  } else if (method === 'mailto') {
    e.preventDefault();
    window.location.href = `mailto:${form.dataset.to}?subject=${encodeURIComponent(form.dataset.subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
  } else if (method === 'endpoint') {
    e.preventDefault();
    try {
      const res = await fetch(form.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      status.textContent = status.dataset.sent;
    } catch {
      form.submit();
      return;
    }
    status.hidden = false;
  }
}));

/* ---------- Header state + reveal on scroll ---------- */
const header = document.querySelector('[data-header]');
if (header) {
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

if (!reduceMotion && 'IntersectionObserver' in window) {
  root.classList.add('motion');
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.setProperty('--i', String(i % 6));
    io.observe(el);
  });
}
