/* App shell: hash router, navigation and pages generated from content/courses.js (SV.manifest).
   Plain script: works from a web server and when index.html is opened from disk. */
(function (root) {
'use strict';
var SV = root.SV;
// Routes:  #/            front page (course selection)
//          #/<course>    course overview (or "not built yet")
//          #/<course>/<viz-id>   visualisation page

const store = SV.store;

let manifest = null;
let mounted = null;           // { unmount } of the current visualisation
const openLectures = new Set();

const $ = (sel) => document.querySelector(sel);
const esc = SV.esc;
const vizCount = (c) => c.lectures.reduce((s, L) => s + L.visualisations.length, 0);
const allViz = (c) => c.lectures.flatMap((L) => L.visualisations.map((v) => ({ ...v, lecture: L })));
const href = (...parts) => '#/' + parts.map(encodeURIComponent).join('/');

/* ---------- theme ---------- */
function initTheme() {
  const saved = store.get('theme');
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
  $('#theme-toggle').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('theme', next);
  });
}

/* ---------- chrome ---------- */
function initChrome() {
  $('#nav-toggle').addEventListener('click', () => {
    const open = document.body.classList.toggle('nav-open');
    $('#nav-toggle').setAttribute('aria-expanded', String(open));
  });
  const dlg = $('#keys-dialog');
  $('#keys-btn').addEventListener('click', () => dlg.showModal());
  $('#keys-close').addEventListener('click', () => dlg.close());
  $('#site-title').textContent = manifest.site.title;
  $('#site-subtitle').textContent = manifest.site.subtitle;
}

/* ---------- navigation ---------- */
function renderNav(courseId, vizId) {
  const nav = $('#sidenav-list');
  const parts = manifest.courses.map((c) => {
    const tag = c.lectures.length ? `${vizCount(c)} viz` : c.status;
    const current = c.id === courseId;
    let inner = '';
    if (current && c.lectures.length) {
      inner = '<ul class="nav-lectures">' + c.lectures.map((L) => {
        const hasActive = L.visualisations.some((v) => v.id === vizId);
        if (hasActive) openLectures.add(c.id + ':' + L.n);
        const open = openLectures.has(c.id + ':' + L.n);
        const items = L.visualisations.map((v) => {
          const act = v.id === vizId;
          return `<li><a class="nav-viz${act ? ' active' : ''}" href="${href(c.id, v.id)}"${act ? ' aria-current="page"' : ''}>
            <span class="mono num">${esc(v.id)}</span><span>${esc(v.title)}</span>
            <span class="marks">${v.status === 'ready' ? '<span class="dot ready" title="ready"></span>' : ''}</span></a></li>`;
        }).join('');
        return `<li><button type="button" class="nav-lecture" aria-expanded="${open}" data-lec="${c.id}:${L.n}">
            <span class="mono num">L${L.n}</span><span>${esc(L.title)}</span><span class="mono muted small">${L.visualisations.length}</span></button>
          <ul class="nav-vizlist"${open ? '' : ' hidden'}>${items}</ul></li>`;
      }).join('') + '</ul>';
    }
    return `<li><a class="nav-course${current ? ' current' : ''}" href="${href(c.id)}"${current && !vizId ? ' aria-current="page"' : ''}>
        <span>${esc(c.title)}</span><span class="mono muted small">${esc(tag)}</span></a>${inner}</li>`;
  });
  nav.innerHTML = parts.join('');
  nav.querySelectorAll('.nav-lecture').forEach((b) => b.addEventListener('click', () => {
    const key = b.dataset.lec, list = b.nextElementSibling;
    const open = b.getAttribute('aria-expanded') !== 'true';
    b.setAttribute('aria-expanded', String(open));
    list.hidden = !open;
    if (open) openLectures.add(key); else openLectures.delete(key);
  }));
}

/* ---------- pages ---------- */
const badge = (status) => status === 'ready'
  ? '<span class="badge ready"><span class="dot ready"></span>ready</span>'
  : `<span class="badge"><span class="dot"></span>${esc(status)}</span>`;

function pageHome() {
  const focus = store.get('focusCourse') || 'la';
  const groups = manifest.groups.map((g) => {
    const rows = manifest.courses.filter((c) => c.group === g).map((c) => `
      <label class="course-option">
        <input type="radio" name="course" value="${esc(c.id)}"${c.id === focus ? ' checked' : ''}>
        <span class="course-text"><span class="course-name">${esc(c.title)}</span><span class="muted small">${esc(c.note || '')}</span></span>
        <span class="mono small muted">${esc(c.status)}</span>
      </label>`).join('');
    return `<fieldset class="course-group"><legend class="eyebrow">${esc(g)}</legend><div class="course-list">${rows}</div></fieldset>`;
  }).join('');
  return `<div class="page narrow">
    <h1 class="page-title">${esc(manifest.site.greeting)}</h1>
    <p class="lead">${esc(manifest.site.intro)}</p>
    <form id="course-form" class="course-form">${groups}</form>
    <div class="home-foot"><span class="muted">Focus: <strong id="focus-name"></strong></span>
      <a id="open-course" class="btn primary" href="#">Open course →</a></div>
  </div>`;
}
function wireHome() {
  const form = $('#course-form');
  const sync = () => {
    const id = form.querySelector('input:checked')?.value || 'la';
    const c = manifest.courses.find((x) => x.id === id);
    $('#focus-name').textContent = c.title;
    $('#open-course').setAttribute('href', href(c.id));
    store.set('focusCourse', id);
  };
  form.addEventListener('change', sync);
  sync();
}

function pageCourse(c) {
  const crumbs = `<nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Courses</a><span aria-hidden="true">/</span><span>${esc(c.title)}</span></nav>`;
  if (!c.lectures.length) {
    return `<div class="page">${crumbs}<h1 class="page-title">${esc(c.title)}</h1>
      <section class="empty-state"><span class="badge mono">status: ${esc(c.status)}</span>
        <h2>Not built yet</h2><p>This course has an entry in the manifest but no topics or visualisations yet.</p></section>
      <section class="block"><h2 class="h3">Planned topics</h2>
        <p class="muted">No topic list in the manifest yet. When one is added it appears here, each topic marked placeholder.</p></section></div>`;
  }
  const tables = c.lectures.map((L) => `
    <section class="block" id="lecture-${L.n}">
      <div class="block-head"><h2 class="h3">Lecture ${L.n} · ${esc(L.title)}</h2><span class="mono muted small">${esc(L.sections)}</span></div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th scope="col">#</th><th scope="col">Visualisation</th><th scope="col">In the notes</th><th scope="col">Interaction</th><th scope="col">Status</th></tr></thead>
        <tbody>${L.visualisations.map((v) => `<tr>
          <td class="mono muted">${esc(v.id)}</td>
          <td><a href="${href(c.id, v.id)}">${esc(v.title)}</a></td>
          <td class="mono muted small">${esc(v.refs)}</td><td class="muted small">${esc(v.interaction)}</td>
          <td>${badge(v.status)}</td></tr>`).join('')}</tbody></table></div>
    </section>`).join('');
  return `<div class="page">${crumbs}
    <h1 class="page-title">${esc(c.title)}</h1>
    <p class="muted">Source: ${esc(c.source)}. ${c.lectures.length} lectures, ${vizCount(c)} planned visualisations, ${allViz(c).filter((v) => v.status === 'ready').length} ready.</p>
    <div class="cards">
      <section class="panel panel-muted"><h2 class="h3">System constants (all visualisations)</h2>
        <dl class="kv small">${(c.constants || []).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></section>
    </div>
    ${tables}
    <div class="cards">
      <section class="panel dashed"><h2 class="h3">Extra (not in course notes)</h2><ul>${(c.extras || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
      <section class="panel warn-border"><h2 class="h3 warn">Flagged in the UI</h2><ul>${(c.flags || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
    </div></div>`;
}

function pageViz(c, v) {
  const list = allViz(c), i = list.findIndex((x) => x.id === v.id);
  const prev = list[i - 1], next = list[i + 1];
  const head = `<nav class="crumbs" aria-label="Breadcrumb"><a href="${href(c.id)}">${esc(c.title)}</a><span aria-hidden="true">/</span>
      <span>Lecture ${v.lecture.n} · ${esc(v.lecture.title)}</span></nav>
    <div class="title-row"><h1 class="page-title"><span class="mono num-prefix">${esc(v.id)}</span>${esc(v.title)}</h1>
      <span class="mono muted small">${esc(v.source || `Lecture ${v.lecture.n} · ${v.refs}`)}</span></div>
    <div class="badges">${badge(v.status)}</div>`;
  const foot = `<footer class="page-foot">
      ${prev ? `<a href="${href(c.id, prev.id)}">← ${esc(prev.id)} ${esc(prev.title)}</a>` : `<a href="${href(c.id)}">← ${esc(c.title)} overview</a>`}
      ${next ? `<a href="${href(c.id, next.id)}">${esc(next.id)} ${esc(next.title)} →</a>` : '<span></span>'}</footer>`;
  if (v.status === 'ready' && v.module) {
    return `<div class="page">${head}
      ${v.purpose_html ? `<p class="lead"><strong>Purpose.</strong> ${v.purpose_html}</p>` : ''}
      <div id="viz-host" class="viz-host" aria-busy="true"><p class="muted">Loading visualisation…</p></div>${foot}</div>`;
  }
  return `<div class="page">${head}
    <section class="empty-state"><h2>Not built yet</h2>
      <dl class="kv"><dt>In the notes</dt><dd class="mono">${esc(v.refs)}</dd><dt>Interaction</dt><dd>${esc(v.interaction)}</dd></dl>
      <p class="muted">This visualisation is planned in the catalogue. Its module has not been written yet.</p></section>${foot}</div>`;
}

function mountViz(v) {
  const host = $('#viz-host');
  host.innerHTML = '';
  const m = SV.viz.mount(v, host);
  mounted = m;
  m.ready.then(() => host.removeAttribute('aria-busy')).catch((err) => {
    console.error(err);
    host.removeAttribute('aria-busy');
    host.innerHTML = '<p class="warn">The visualisation failed to load: ' + esc(err.message) + '</p>';
  });
}

/* ---------- router ---------- */
function route() {
  if (mounted) { mounted.unmount(); mounted = null; }
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const main = $('#main');
  document.body.classList.remove('nav-open');
  $('#nav-toggle').setAttribute('aria-expanded', 'false');
  let title = manifest.site.title;

  if (!parts.length) {
    document.body.classList.add('home');
    main.innerHTML = pageHome();
    wireHome();
  } else {
    document.body.classList.remove('home');
    const c = manifest.courses.find((x) => x.id === parts[0]);
    if (!c) {
      main.innerHTML = '<div class="page"><h1 class="page-title">Not found</h1><p><a href="#/">Back to courses</a></p></div>';
      renderNav(null, null);
    } else if (parts[1]) {
      const v = allViz(c).find((x) => x.id === parts[1]);
      if (!v) {
        main.innerHTML = `<div class="page"><h1 class="page-title">Not found</h1><p><a href="${href(c.id)}">Back to ${esc(c.title)}</a></p></div>`;
      } else {
        main.innerHTML = pageViz(c, v);
        title = `${v.id} ${v.title} · ${c.title}`;
        if (v.status === 'ready' && v.module) mountViz(v);
      }
      renderNav(c.id, parts[1]);
    } else {
      main.innerHTML = pageCourse(c);
      title = `${c.title} · ${manifest.site.title}`;
      renderNav(c.id, null);
    }
  }
  document.title = title;
  const h1 = main.querySelector('h1');
  if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
  window.scrollTo(0, 0);
}

function init() {
  initTheme();
  manifest = SV.manifest;
  if (!manifest) {
    $('#main').innerHTML = '<div class="page"><h1 class="page-title">Could not load the course manifest</h1><p>content/courses.js is missing or has a syntax error. Check the browser console.</p></div>';
    return;
  }
  initChrome();
  window.addEventListener('hashchange', route);
  route();
  SV.booted = true;
}

init();
})(window);
