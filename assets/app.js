/* dcor.dev: tabs, career rail, contact reveal. Content lives in the HTML; this only adds behaviour. */
(() => {
'use strict';

/* ---------- tabs (#work; default Home) ---------- */
const views = document.querySelectorAll('[data-view]');
const tabs = document.querySelectorAll('[data-tab]');
function route() {
  const h = location.hash.slice(1);
  /* a hash can name a view, or an element inside one (e.g. #h-exp opens Career) */
  /* the page is called Work; older links (#career, #cv, #timeline, #journey) land there too */
  const v = ['work', 'career', 'cv', 'timeline', 'journey'].includes(h) ? 'career'
    : (h && document.getElementById(h)?.closest('[data-view]')?.dataset.view) || 'home';
  views.forEach((el) => { el.hidden = el.dataset.view !== v; });
  tabs.forEach((a) => {
    if (a.dataset.tab === v) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.title = v === 'career' ? 'Work · David Corbacho Román' : 'David Corbacho Román · Principal Engineer';
  current = v;
  document.body.dataset.page = v;
  window.ridgeline?.setActive(v === 'home');  /* the landscape is Home only */
  railFrame();
}
let current = 'home';
/* after a tab change, keyboard and screen-reader users land on the new page's heading */
function focusView() {
  const h1 = document.querySelector(`[data-view="${current}"] h1`);
  h1.tabIndex = -1; h1.focus({ preventScroll: true });
}
/* the skip link must not go through the hash router */
document.querySelector('.skip').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('main').focus({ preventScroll: true });
  document.querySelector(`[data-view="${current}"] h1`).scrollIntoView({ block: 'center' });
});
tabs.forEach((a) => a.addEventListener('click', (e) => {
  if (a.dataset.tab !== 'home') return;
  e.preventDefault();
  if (location.hash) history.pushState(null, '', location.pathname);
  route(); scrollTo({ top: 0 }); focusView();
}));
addEventListener('hashchange', () => { route(); scrollTo({ top: 0 }); focusView(); });
addEventListener('popstate', route);

const now = new Date();
const NOW = [now.getFullYear(), now.getMonth() + 1];
const parse = (s) => (s ? s.split('-').map(Number) : null);

/* ---------- time rail beside Chapters: scrolling drives only the rail ---------- */
const ymF = (d) => d[0] + (d[1] - 1) / 12;
const J1 = ymF(NOW) + 1 / 12;
/* Not to scale on purpose: each chapter gets a share of the rail by weight, so the recent,
   shorter roles read as big as they matter. Top = now, matching the newest-first lists. */
/* small outline maps for the rail (simplified from Natural Earth), each [width, path] at 44 units tall */
const MAPS = {
  BE: [52.4, 'M11.5 2.9L22.1 4.7L35.3 0.0L44.5 9.9L52.4 15.3L50.7 30.5L46.9 31.4L45.3 44.0L32.9 33.6L25.5 35.4L15.5 24.8L8.8 15.8L2.2 15.3L0.0 7.4Z'],  /* Belgium */
  FI: [19.6, 'M14.3 4.7L14.1 7.7L16.8 10.5L15.1 13.7L17.3 18.6L16.0 22.2L17.7 25.4L19.6 31.1L18.9 33.3L17.2 35.8L13.4 41.2L10.1 41.6L6.9 43.1L4.0 44.0L3.0 41.7L1.2 40.3L1.6 36.1L0.7 32.2L1.6 29.7L3.2 27.1L7.4 22.4L8.6 21.6L8.4 19.8L5.9 17.7L5.3 16.0L5.2 9.5L2.4 6.6L0.0 4.5L1.1 3.4L3.1 5.6L5.4 5.4L7.4 6.4L9.1 4.6L10.0 1.4L12.8 0.0L15.1 1.7Z'],  /* Finland */
  NO: [37.8, 'M33.3 0.0L37.8 2.5L36.0 3.4L37.5 5.5L35.1 6.8L33.9 7.1L34.5 4.8L32.7 3.5L30.5 4.6L29.8 7.0L28.4 8.5L26.8 7.7L25.0 7.9L23.4 6.1L22.5 7.0L21.6 7.1L21.4 9.3L18.7 8.8L18.3 10.7L16.9 10.7L16.0 13.1L14.5 16.8L12.3 21.5L12.8 22.6L12.3 24.0L10.9 23.9L10.0 27.1L10.1 31.5L11.0 33.2L10.5 37.2L9.3 39.5L8.7 41.4L7.7 39.3L4.9 43.2L3.0 44.0L1.0 42.3L0.5 38.7L0.0 30.9L1.3 28.8L5.1 26.0L8.0 22.5L10.6 17.8L14.0 11.3L16.5 8.8L20.4 4.6L23.6 3.1L25.9 3.3L28.1 0.5L30.7 0.7Z'],  /* Norway */
  UK: [23.2, 'M9.3 0.0L6.2 5.5L9.1 4.8L12.4 4.9L11.6 9.0L9.0 13.5L12.0 13.8L14.9 20.4L16.9 21.2L18.7 26.9L19.6 28.9L23.2 29.9L22.8 33.2L21.3 34.6L22.5 37.3L19.8 39.9L15.9 39.9L10.8 41.3L9.4 40.2L7.5 42.6L4.8 42.1L2.7 44.0L1.1 43.0L5.4 37.7L8.1 36.5L3.5 35.7L2.6 33.7L5.7 32.1L4.1 29.4L4.6 26.1L9.1 26.6L9.5 23.6L7.5 20.4L3.9 19.5L3.2 18.1L4.2 15.9L3.3 14.5L1.7 16.9L1.5 12.0L0.0 9.4L1.1 4.2L3.4 0.1L5.7 0.5Z'],  /* Great Britain */
  NV: [29.3, 'M0.0 0.0L29.3 0.0L29.3 36.5L25.9 37.1L26.4 44.0L0.0 18.9Z'],  /* Nevada */
};
const PLACE = { BE: 'Belgium', FI: 'Finland', NO: 'Norway', UK: 'United Kingdom', NV: 'Nevada' };
const WHERE = { curewiki: 'BE', hoxhunt: 'FI', okcapsule: 'NV', nordlys: 'NO', wunder: 'FI', earlier: 'UK' };
const WEIGHT = { curewiki: 2.2, hoxhunt: 1.6, okcapsule: 1.35, nordlys: 1.65, wunder: 1.8, earlier: 1.4 };  /* close to each role's height in the list, recent ones a touch larger */
const weights = (items) => {
  const w = items.map((c) => WEIGHT[c.dataset.role] ?? 1), W = w.reduce((a, b) => a + b, 0);
  let acc = 0;
  return w.map((x) => { const s = acc / W; acc += x; return [s, x / W]; });
};
function makeRail(rail, items, view) {
  if (!rail || !items.length) return null;
  const ranges = items.map((c) => [ymF(parse(c.dataset.from)), parse(c.dataset.to) ? ymF(parse(c.dataset.to)) : J1]);
  const lay = weights(items);
  const track = rail.querySelector('.jr-track');
  const fill = document.createElement('div'); fill.className = 'jr-fill'; track.append(fill);
  const segs = items.map((c, i) => {
    const seg = document.createElement('div'); seg.className = 'jr-seg';
    const [s, h] = lay[i];
    seg.style.setProperty('--s', s * 100 + '%');
    seg.style.setProperty('--h', Math.max(0.6, h * 100 - 1.4) + '%');
    const m = MAPS[WHERE[c.dataset.role]];
    seg.innerHTML = `<div class="jr-lab"><span>${c.dataset.label}</span>${m ? `<small class="jr-place">${PLACE[WHERE[c.dataset.role]]}</small><svg class="jr-map" viewBox="0 0 ${m[0]} 44" height="40" width="${(m[0] * 40 / 44).toFixed(1)}" aria-hidden="true"><path d="${m[1]}"/></svg>` : ''}</div>`;
    track.append(seg);
    return seg;
  });
  const read = rail.querySelector('.jr-read');
  let active = -2, lit = -2;
  return { view, update() {
    const y = innerHeight * 0.5;
    let i = -1, f = 0;
    items.forEach((c, k) => { const r = c.getBoundingClientRect(); if (r.top <= y) { i = k; f = Math.min(1, (y - r.top) / r.height); } });
    const t = i < 0 ? J1 : ranges[i][1] - f * (ranges[i][1] - ranges[i][0]);
    const p = i < 0 ? 0 : lay[i][0] + f * lay[i][1];
    rail.style.setProperty('--p', p * 100 + '%');
    rail.style.setProperty('--pf', p);
    read.textContent = i <= 0 && f < 0.35 ? 'Now' : String(Math.floor(Math.min(t, ymF(NOW)) + 1e-6));
    if (i !== active) { active = i; segs.forEach((s, k) => s.classList.toggle('on', k === i)); }
    /* the role crossing the middle of the screen is gently lit; none once the list has scrolled past */
    const now = f < 1 ? i : -1;
    if (now !== lit) { lit = now; items.forEach((c, k) => c.classList.toggle('is-current', k === now)); }
  } };
}
const rails = [
  makeRail(document.querySelector('[data-view="career"] .jr'), [...document.querySelectorAll('[data-view="career"] .job')], 'career'),
].filter(Boolean);
let ticking = false;
function railFrame() { ticking = false; rails.forEach((r) => { if (r.view === current) r.update(); }); }
function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(railFrame); } }
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);

/* links that open a new tab say so to screen readers */
document.querySelectorAll('a[target="_blank"]').forEach((a) => {
  const s = document.createElement('span'); s.className = 'sr'; s.textContent = ' (opens in new tab)'; a.append(s);
});

/* ---------- contact details: stored encoded (reversed + base64), revealed on click, never plain in the HTML ---------- */
document.addEventListener('click', (e) => {
  const b = e.target.closest('.reveal'); if (!b) return;
  const v = atob(b.dataset.v).split('').reverse().join('');
  const link = document.createElement('a');
  link.href = (b.dataset.kind === 'email' ? 'mailto:' : 'tel:') + v.replace(/\s/g, '');
  link.textContent = v;
  if (b.dataset.kind === 'phone') link.className = 'num';
  const copy = document.createElement('button');
  copy.type = 'button'; copy.className = 'copy'; copy.textContent = 'Copy';
  copy.dataset.copy = v; copy.setAttribute('aria-label', 'Copy ' + (b.dataset.kind === 'email' ? 'email address' : 'phone number'));
  b.replaceWith(link, copy);
  link.focus();
});

/* ---------- copy buttons ---------- */
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-copy]'); if (!c) return;
  const done = () => { c.textContent = 'Copied'; document.getElementById('status').textContent = 'Copied to clipboard'; setTimeout(() => { c.textContent = 'Copy'; document.getElementById('status').textContent = ''; }, 1600); };
  const fallback = () => {
    const span = c.previousElementSibling; if (!span) return;
    const r = document.createRange(); r.selectNodeContents(span);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  };
  try { navigator.clipboard.writeText(c.dataset.copy).then(done, fallback); } catch { fallback(); }
});

/* ---------- Vercel Web Analytics (only served on Vercel) ---------- */
if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  const s = document.createElement('script');
  s.defer = true; s.src = '/_vercel/insights/script.js';
  document.head.append(s);
}

route();
})();
