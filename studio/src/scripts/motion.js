// Motion: GSAP + ScrollTrigger + SplitText, Lenis smooth scroll. Only with no-preference for
// reduced motion; otherwise the page stays exactly as the HTML/CSS render it.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);
const q = (s, r = document) => r.querySelector(s);
const qa = (s, r = document) => [...r.querySelectorAll(s)];
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

const mm = gsap.matchMedia();
mm.add('(prefers-reduced-motion: no-preference)', () => {
  /* Smooth scroll, synced with ScrollTrigger */
  const lenis = new Lenis({ autoRaf: false, lerp: 0.11 });
  lenis.on('scroll', ScrollTrigger.update);
  const raf = (t) => lenis.raf(t * 1000);
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);

  /* In-page links glide. Sections render as they approach (content-visibility), so heights can
     change during the glide: land, check, and correct once. Focus moves to the target like a jump. */
  const onAnchor = (e) => {
    const a = e.target.closest('a[href^="#"]');
    const id = a?.getAttribute('href').slice(1);
    const el = id && document.getElementById(id);
    if (!el || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    history.pushState(null, '', `#${id}`);
    const land = () => {
      if (!el.matches('a, button, input, [tabindex]')) el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    };
    lenis.scrollTo(el, { offset: -72, onComplete: () => {
      if (Math.abs(el.getBoundingClientRect().top - 72) > 2) lenis.scrollTo(el, { offset: -72, duration: 0.45, onComplete: land });
      else land();
    } });
  };
  document.addEventListener('click', onAnchor);

  /* Scroll progress line in the header */
  gsap.to('[data-progress]', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

  // Pointer: the phone tilts toward the cursor, chips drift the other way.
  if (fine) {
    const stage = q('[data-stage]');
    const phone = q('[data-phone]');
    const rx = gsap.quickTo(phone, 'rotationX', { duration: 0.8, ease: 'power3.out' });
    const ry = gsap.quickTo(phone, 'rotationY', { duration: 0.8, ease: 'power3.out' });
    const cx = gsap.quickTo('.chips', 'x', { duration: 1.2, ease: 'power3.out' });
    const cy = gsap.quickTo('.chips', 'y', { duration: 1.2, ease: 'power3.out' });
    gsap.set(phone, { transformPerspective: 1100 });
    q('.hero').addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      const nx = (e.clientX - (r.left + r.width / 2)) / innerWidth;
      const ny = (e.clientY - (r.top + r.height / 2)) / innerHeight;
      ry(nx * 14); rx(-ny * 10);
      cx(-nx * 40); cy(-ny * 30);
    });
    q('.hero').addEventListener('pointerleave', () => { rx(0); ry(0); cx(0); cy(0); });
  }

  // Scrolling away: copy drifts up faster than the phone.
  gsap.to('.hero-copy', { yPercent: -14, autoAlpha: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('[data-stage]', { yPercent: -6, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  /* ---------- Marquee: endless, speeds up and flips with your scrolling ---------- */
  const track = q('[data-marquee]');
  const loop = gsap.to(track, { xPercent: -50, ease: 'none', duration: 38, repeat: -1 });
  loop.totalTime(loop.duration() * 100);
  let dir = 1;
  ScrollTrigger.create({
    trigger: track, start: 'top bottom', end: 'bottom top',
    onUpdate: (self) => {
      dir = self.direction;
      const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 300, 6);
      gsap.to(loop, { timeScale: dir * boost, duration: 0.25, overwrite: true });
      gsap.to(loop, { timeScale: dir, duration: 1.2, delay: 0.3, overwrite: false });
    },
  });
  qa('.mq-spoon svg').forEach((s) => gsap.to(s, { rotation: 360, duration: 6, ease: 'none', repeat: -1 }));

  /* ---------- Headlines rise line by line ---------- */
  qa('[data-split]').forEach((h) => {
    ScrollTrigger.create({
      trigger: h, start: 'top bottom+=200', once: true,
      onEnter: () => SplitText.create(h, {
        type: 'lines,words', mask: 'lines', autoSplit: true,
        onSplit: (self) => gsap.from(self.lines, { yPercent: 105, duration: 1.1, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: h, start: 'top 86%', once: true } }),
      }),
    });
  });

  /* ---------- Generic rise for supporting copy ---------- */
  gsap.set('[data-rise]', { y: 32, autoAlpha: 0 });
  ScrollTrigger.batch('[data-rise]', { start: 'top 90%', once: true, onEnter: (els) => gsap.to(els, { y: 0, autoAlpha: 1, duration: 0.9, ease: 'power3.out', stagger: 0.09, overwrite: true }) });

  /* ---------- Amuse-bouche definition ---------- */
  const def = q('[data-define]');
  gsap.set(def, { autoAlpha: 0 });
  ScrollTrigger.create({ trigger: def, start: 'top 82%', once: true, onEnter: () => {
    const defWord = SplitText.create('[data-define-word]', { type: 'chars' });
    gsap.timeline()
    .fromTo(def, { y: 40, rotation: 2, autoAlpha: 0 }, { y: 0, rotation: 0, autoAlpha: 1, duration: 1, ease: 'expo.out' })
    .from(defWord.chars, { yPercent: 60, autoAlpha: 0, rotation: () => gsap.utils.random(-14, 14), duration: 0.6, stagger: 0.035, ease: 'back.out(2)' }, 0.25)
    .from(qa('.define-meta, .define-text, .define-ours', def), { y: 14, autoAlpha: 0, stagger: 0.12, duration: 0.6, ease: 'power3.out' }, 0.6);
  } });

  /* ---------- Courses: the line draws as you scroll, each course lights up ---------- */
  const courses = qa('[data-course]');
  const line = q('[data-course-line]');
  courses.forEach((c) => {
    qa('.course-icon *', c).forEach((p) => { const len = (p.getTotalLength?.() ?? 120) + 2; gsap.set(p, { strokeDasharray: len, strokeDashoffset: len }); });
    gsap.set(qa(':scope > :not(.course-icon)', c), { autoAlpha: 0, y: 18 });
  });
  const lit = new Set();
  gsap.timeline({
    scrollTrigger: {
      trigger: '[data-courses]', start: 'top 78%', end: 'bottom 60%', scrub: 0.8,
      onUpdate: (self) => courses.forEach((c, i) => {
        const on = self.progress >= (i + 0.15) / courses.length;
        if (on && !lit.has(c)) {
          lit.add(c); c.classList.add('on');
          gsap.to(qa('.course-icon *', c), { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut', stagger: 0.12 });
          gsap.to(qa(':scope > :not(.course-icon)', c), { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08 });
        }
      }),
    },
  }).fromTo(line, { '--p': 0 }, { '--p': 1, ease: 'none' });

  /* ---------- Counters ---------- */
  const fmt = (v, dec, nl) => { const s = v.toFixed(dec); return nl ? s.replace('.', ',') : s; };
  qa('[data-count]').forEach((el) => {
    const to = Number(el.dataset.count); const from = Number(el.dataset.from); const dec = Number(el.dataset.decimals); const nl = el.dataset.lang === 'nl';
    const suffix = el.querySelector('span')?.outerHTML ?? '';
    const o = { v: from };
    el.innerHTML = fmt(from, dec, nl) + suffix;
    gsap.to(o, { v: to, duration: 2, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 92%', once: true }, onUpdate: () => { el.innerHTML = fmt(o.v, dec, nl) + suffix; } });
  });
  gsap.from('[data-stats] li', { y: 30, autoAlpha: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: '[data-stats]', start: 'top 88%', once: true } });

  /* ---------- Menu demo + "PDF becomes text" loop ---------- */
  gsap.from('[data-menu-demo]', { y: 60, rotation: -1.5, autoAlpha: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: '[data-menu-demo]', start: 'top 85%', once: true } });
  gsap.from(qa('[data-menu-demo] li'), { x: 24, autoAlpha: 0, duration: 0.6, stagger: 0.06, ease: 'power3.out', scrollTrigger: { trigger: '[data-menu-demo]', start: 'top 80%', once: true } });
  const pdf = q('[data-pdf]');
  const pdfTl = gsap.timeline({ repeat: -1, repeatDelay: 1.2, paused: true })
    .set(qa('.pdf-text li', pdf), { autoAlpha: 0, x: 16 })
    .set('.pdf-doc', { autoAlpha: 1, scale: 1, rotation: 0 })
    .to('.pdf-doc', { rotation: -8, scale: 0.92, duration: 0.6, ease: 'power2.inOut', delay: 0.8 })
    .to('.pdf-arrow', { x: 6, duration: 0.3, yoyo: true, repeat: 1 }, '<')
    .to('.pdf-doc', { autoAlpha: 0.35, scale: 0.85, duration: 0.4 })
    .to(qa('.pdf-text li', pdf), { autoAlpha: 1, x: 0, duration: 0.5, stagger: 0.15, ease: 'power3.out' }, '<')
    .to('.pdf-doc', { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.6, ease: 'power3.out', delay: 1.6 })
    .to(qa('.pdf-text li', pdf), { autoAlpha: 0, x: -10, duration: 0.3, stagger: 0.05 }, '<');
  ScrollTrigger.create({ trigger: pdf, start: 'top 95%', end: 'bottom 5%', onToggle: (s) => (s.isActive ? pdfTl.play() : pdfTl.pause()) });

  /* ---------- Cards: rise in, tilt toward the pointer ---------- */
  ScrollTrigger.batch('.duo > div', { start: 'top 88%', once: true, onEnter: (els) => gsap.from(els, { y: 70, autoAlpha: 0, rotation: (i) => (i % 2 ? 1.5 : -1.5), duration: 1.1, ease: 'expo.out', stagger: 0.15 }) });
  gsap.from('[data-week] li', { x: -20, autoAlpha: 0, duration: 0.5, stagger: 0.06, ease: 'power2.out', scrollTrigger: { trigger: '[data-week]', start: 'top 88%', once: true } });
  if (fine) qa('[data-tilt]').forEach((card) => {
    gsap.set(card, { transformPerspective: 900 });
    const rx = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3.out' });
    const ry = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3.out' });
    card.addEventListener('pointermove', (e) => { const r = card.getBoundingClientRect(); ry(((e.clientX - r.left) / r.width - 0.5) * 6); rx(-((e.clientY - r.top) / r.height - 0.5) * 6); });
    card.addEventListener('pointerleave', () => { rx(0); ry(0); });
  });

  /* ---------- Speed ---------- */
  const speed = q('[data-speed]');
  gsap.timeline({ scrollTrigger: { trigger: speed, start: 'top 80%', once: true } })
    .from(speed, { y: 60, autoAlpha: 0, duration: 1, ease: 'expo.out' })
    .from(qa('.bar i', speed), { scaleX: 0, duration: 1.6, ease: 'power4.out', stagger: 0.25 }, 0.3)
    .from('[data-lighter]', { scale: 0, rotation: -25, duration: 0.8, ease: 'back.out(2.5)' }, 1.4);

  /* ---------- Booking systems scatter in ---------- */
  gsap.from('[data-systems] li', {
    x: () => gsap.utils.random(-120, 120), y: () => gsap.utils.random(-60, 60), rotation: () => gsap.utils.random(-30, 30), autoAlpha: 0,
    duration: 1, ease: 'expo.out', stagger: { each: 0.06, from: 'random' },
    scrollTrigger: { trigger: '[data-systems]', start: 'top 90%', once: true },
  });
  gsap.from('[data-tapbar]', { y: 30, autoAlpha: 0, duration: 0.8, ease: 'back.out(1.6)', scrollTrigger: { trigger: '[data-tapbar]', start: 'top 95%', once: true } });

  /* ---------- WhatsApp: the conversation plays out ---------- */
  const chat = q('[data-chat]');
  const [them, us] = qa('[data-msg]', chat);
  const typing = q('[data-typing]', chat);
  const preview = q('[data-preview]', chat);
  gsap.set([them, us, preview], { autoAlpha: 0, y: 14, scale: 0.92 });
  gsap.set(typing, { autoAlpha: 0, display: 'none' });
  gsap.set(q('[data-new]', chat), { autoAlpha: 0, yPercent: 60 });
  gsap.timeline({ scrollTrigger: { trigger: chat, start: 'top 80%', once: true } })
    .to(them, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.8)', transformOrigin: '0% 100%' })
    .set(typing, { display: 'inline-flex' }, '+=0.5')
    .to(typing, { autoAlpha: 1, duration: 0.2 })
    .to(typing, { autoAlpha: 0, duration: 0.2, delay: 1.4 })
    .set(typing, { display: 'none' })
    .to(us, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.8)', transformOrigin: '100% 100%' })
    .to(preview, { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, ease: 'power3.out' }, '+=0.4')
    .to(q('[data-old]', chat), { autoAlpha: 0.45, duration: 0.3 }, '+=0.3')
    .to(q('[data-new]', chat), { autoAlpha: 1, yPercent: 0, duration: 0.5, ease: 'back.out(2)' }, '<')
    .fromTo(preview, { backgroundColor: '#fff6c8' }, { backgroundColor: '#ffffff', duration: 1.4 }, '<');

  /* ---------- Always included ---------- */
  gsap.from('[data-also] li', { y: 20, autoAlpha: 0, duration: 0.6, stagger: 0.07, ease: 'power3.out', scrollTrigger: { trigger: '[data-also]', start: 'top 90%', once: true } });
  gsap.from('.also .seal', { scale: 0.3, rotation: -120, autoAlpha: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.also', start: 'top 85%', once: true } });

  /* ---------- Price: the menu card is "printed" line by line ---------- */
  const card = q('[data-card]');
  gsap.from(card, { y: 90, rotation: -2, autoAlpha: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: card, start: 'top 85%', once: true } });
  qa('[data-line]', card).forEach((ln, i) => {
    const tl = gsap.timeline({ scrollTrigger: { trigger: ln, start: 'top 90%', once: true }, delay: i * 0.05 });
    tl.from(qa('.line-name, .line-price, strong', ln), { y: 20, autoAlpha: 0, duration: 0.6, ease: 'power3.out', stagger: 0.1 })
      .from(qa('.line-dots', ln), { scaleX: 0, duration: 0.9, ease: 'power2.inOut' }, 0.15)
      .from(qa('p', ln), { autoAlpha: 0, duration: 0.6 }, 0.4);
  });
  gsap.from('[data-price-free]', { x: -60, autoAlpha: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.price-stage', start: 'top 75%', once: true } });
  gsap.from('.seal-price', { scale: 0.4, rotation: 160, autoAlpha: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.price-stage', start: 'top 70%', once: true } });
  gsap.to('[data-price-free]', { yPercent: -30, ease: 'none', scrollTrigger: { trigger: '.price', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.to('.seal-price', { yPercent: 40, ease: 'none', scrollTrigger: { trigger: '.price', start: 'top bottom', end: 'bottom top', scrub: true } });

  /* ---------- FAQ ---------- */
  gsap.from('[data-qa] details', { y: 24, autoAlpha: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out', scrollTrigger: { trigger: '[data-qa]', start: 'top 85%', once: true } });

  /* ---------- Contact: the card lands, then floats; follows the pointer ---------- */
  const a5 = q('[data-a5]');
  gsap.timeline({ scrollTrigger: { trigger: a5, start: 'top 85%', once: true } })
    .from(a5, { y: 120, rotation: 18, autoAlpha: 0, duration: 1.4, ease: 'expo.out' })
    .add(() => gsap.to(a5, { y: -10, duration: 3, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
  if (fine) {
    const rx = gsap.quickTo(a5, 'rotationX', { duration: 0.8, ease: 'power3.out' });
    const ry = gsap.quickTo(a5, 'rotationY', { duration: 0.8, ease: 'power3.out' });
    q('.contact').addEventListener('pointermove', (e) => { ry((e.clientX / innerWidth - 0.5) * 20); rx(-(e.clientY / innerHeight - 0.5) * 14); });
  }

  /* ---------- Footer word slides as you reach the end ---------- */
  gsap.fromTo('[data-foot-word]', { xPercent: -14 }, { xPercent: 0, ease: 'none', scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: true } });

  /* ---------- Magnetic buttons ---------- */
  if (fine) qa('.magnetic').forEach((b) => {
    const x = gsap.quickTo(b, 'x', { duration: 0.5, ease: 'power3.out' });
    const y = gsap.quickTo(b, 'y', { duration: 0.5, ease: 'power3.out' });
    b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); x((e.clientX - (r.left + r.width / 2)) * 0.3); y((e.clientY - (r.top + r.height / 2)) * 0.4); });
    b.addEventListener('pointerleave', () => { x(0); y(0); });
  });

  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  // Sections use content-visibility: recalculate positions when one renders for real.
  let refreshTimer = null;
  const onCv = () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 150); };
  qa('.marquee, .band, .foot').forEach((el) => el.addEventListener('contentvisibilityautostatechange', onCv));
  return () => { gsap.ticker.remove(raf); document.removeEventListener('click', onAnchor); lenis.destroy(); };
});
