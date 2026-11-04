/* Core: the SV namespace, a lazy script loader and the visualisation registry.
   Plain (non-module) script so the site also works when index.html is opened
   from disk (file://), where browsers block ES modules. */
(function (root) {
  'use strict';
  var SV = (root.SV = root.SV || {});

  /* ---------- lazy loading of vendored libraries ---------- */
  var LIBS = {
    katex: { css: ['vendor/katex/katex.min.css'], js: ['vendor/katex/katex.min.js'], ready: function () { return !!root.katex; } },
    three: { js: ['vendor/three/three.min.js'], ready: function () { return !!root.THREE; } },
    plot: { js: ['vendor/plot/d3.min.js', 'vendor/plot/plot.umd.min.js'], ready: function () { return !!root.Plot; } },
  };
  var pending = {};

  function addScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = SV.base + src;
      s.async = false; // keep order (d3 before Plot)
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
  }
  function addCss(href) {
    if (document.querySelector('link[data-sv="' + href + '"]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = SV.base + href; l.setAttribute('data-sv', href);
    document.head.appendChild(l);
  }

  /** Load one or more libraries by name ('katex', 'three', 'plot'). Resolves when all are ready. */
  SV.load = function (names) {
    names = [].concat(names || []);
    return Promise.all(names.map(function (name) {
      var lib = LIBS[name];
      if (!lib) return Promise.reject(new Error('Unknown library ' + name));
      if (lib.ready()) return Promise.resolve();
      if (!pending[name]) {
        (lib.css || []).forEach(addCss);
        pending[name] = lib.js.reduce(function (p, src) { return p.then(function () { return addScript(src); }); }, Promise.resolve());
      }
      return pending[name];
    }));
  };
  SV.has = function (name) { return !!(LIBS[name] && LIBS[name].ready()); };

  // Paths are relative to the page that loaded core.js (index.html or dev/*.html).
  SV.base = (function () {
    var cur = document.currentScript && document.currentScript.getAttribute('src');
    return cur ? cur.replace(/js\/core\.js.*$/, '') : '';
  })();

  /* ---------- visualisation registry ---------- */
  var registry = {};
  var waiting = {};

  /** Called by each js/viz/*.js file: SV.viz.register('1.1', { component, needs }) */
  SV.viz = {
    register: function (id, def) {
      registry[id] = def;
      (waiting[id] || []).forEach(function (fn) { fn(def); });
      delete waiting[id];
    },
    get: function (id) { return registry[id]; },
    /** Load the module file for a manifest entry and mount it. Returns { unmount }. */
    mount: function (entry, container) {
      var cancelled = false, unmountFn = null;
      var whenRegistered = registry[entry.id] ? Promise.resolve(registry[entry.id]) : new Promise(function (resolve, reject) {
        (waiting[entry.id] = waiting[entry.id] || []).push(resolve);
        addScript(entry.module).catch(reject);
      });
      var done = whenRegistered.then(function (def) {
        return SV.load(def.needs || []).then(function () { return def; });
      }).then(function (def) {
        if (cancelled) return;
        var h = root.htmPreact;
        h.render(h.h(def.component, { entry: entry }), container);
        unmountFn = function () { h.render(null, container); };
      });
      return {
        ready: done,
        unmount: function () { cancelled = true; if (unmountFn) unmountFn(); container.innerHTML = ''; },
      };
    },
  };

  /* ---------- small shared helpers ---------- */
  SV.store = {
    get: function (k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { root.localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
  };
  SV.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };
})(typeof window !== 'undefined' ? window : globalThis);
