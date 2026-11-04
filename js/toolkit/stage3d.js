/* Toolkit: 3D stage on three.js (loaded on demand). Same scene format as Stage2D.
   - real depth and transparency, drag empty space to orbit
   - draggable points move in the plane through the point facing the camera
   - each draggable point gets a focusable HTML handle (keyboard + screen readers)
   - falls back to Stage2D's orthographic drawing when WebGL is unavailable */
(function (root) {
  'use strict';
  var Pr = root.htmPreact, html = Pr.html, useState = Pr.useState, useEffect = Pr.useEffect, useRef = Pr.useRef;
  var SV = root.SV;
  var FOV = 30, DIST = 23;

  function token(el, name) {
    var v = getComputedStyle(el).getPropertyValue('--' + (name || 'text')).trim();
    return v || '#888888';
  }
  function placeCamera(camera, cam) {
    var cp = Math.cos(cam.pitch);
    camera.position.set(DIST * cp * Math.cos(cam.yaw), DIST * cp * Math.sin(cam.yaw), DIST * Math.sin(cam.pitch));
    camera.up.set(0, 0, 1);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
  }
  function disposeGroup(g) {
    g.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(function (m) { m.dispose(); });
    });
    while (g.children.length) g.remove(g.children[0]);
  }

  /* ---- builders (THREE is global once loaded) ---- */
  function lineMat(color, opacity, dashed) {
    var T = root.THREE;
    var opts = { color: color, transparent: opacity < 1, opacity: opacity };
    return dashed ? new T.LineDashedMaterial(Object.assign(opts, { dashSize: 0.18, gapSize: 0.12 })) : new T.LineBasicMaterial(opts);
  }
  function lines(pairs, mat) {
    var T = root.THREE, pos = [];
    pairs.forEach(function (p) { pos.push(p[0][0], p[0][1], p[0][2] || 0, p[1][0], p[1][1], p[1][2] || 0); });
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    var obj = new T.LineSegments(g, mat);
    if (mat.isLineDashedMaterial) obj.computeLineDistances();
    return obj;
  }
  function rod(from, to, radius, mat) {
    var T = root.THREE;
    var a = new T.Vector3().fromArray(SV.stage.pad3(from)), b = new T.Vector3().fromArray(SV.stage.pad3(to));
    var dir = new T.Vector3().subVectors(b, a), L = dir.length();
    if (L < 1e-9) return null;
    var m = new T.Mesh(new T.CylinderGeometry(radius, radius, L, 14, 1, false), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
    return m;
  }
  function arrow(from, to, color, width) {
    var T = root.THREE, grp = new T.Group();
    var a = new T.Vector3().fromArray(SV.stage.pad3(from)), b = new T.Vector3().fromArray(SV.stage.pad3(to));
    var dir = new T.Vector3().subVectors(b, a), L = dir.length();
    if (L < 1e-9) return grp;
    var mat = new T.MeshBasicMaterial({ color: color });
    var hl = Math.min(0.32, L * 0.45), r = 0.018 * (width || 2.5);
    var shaftEnd = new T.Vector3().copy(a).addScaledVector(dir, (L - hl) / L);
    var s = rod(a.toArray(), shaftEnd.toArray(), r, mat); if (s) grp.add(s);
    var cone = new T.Mesh(new T.ConeGeometry(Math.max(0.09, r * 3), hl, 18), mat);
    cone.position.copy(shaftEnd).addScaledVector(dir.clone().normalize(), hl / 2);
    cone.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.clone().normalize());
    grp.add(cone);
    return grp;
  }

  function build(group, sc, el) {
    var T = root.THREE, ext = sc.extent || 3.5, g = Math.floor(ext);
    var c = function (n) { return new T.Color(token(el, n)); };
    if (sc.grid !== false) {
      var gp = [];
      for (var u = -g; u <= g; u++) { gp.push([[u, -g, 0], [u, g, 0]]); gp.push([[-g, u, 0], [g, u, 0]]); }
      group.add(lines(gp, lineMat(c('grid-major'), 1)));
    }
    if (sc.axes !== false) {
      group.add(lines([[[-ext, 0, 0], [ext, 0, 0]], [[0, -ext, 0], [0, ext, 0]], [[0, 0, -ext], [0, 0, ext]]], lineMat(c('axis'), 1)));
    }
    if (sc.box) {
      var bp = [];
      [-3, 3].forEach(function (x) { [-3, 3].forEach(function (y) {
        bp.push([[x, y, -3], [x, y, 3]], [[x, -3, y], [x, 3, y]], [[-3, x, y], [3, x, y]]);
      }); });
      group.add(lines(bp, lineMat(c(sc.box === true ? 'accent' : sc.box), 0.45)));
    }
    (sc.planes || []).forEach(function (pl) {
      var a = SV.stage.pad3(pl.basis[0]), b = SV.stage.pad3(pl.basis[1]), h = pl.half || 3.6;
      var corner = function (s1, s2) { return [0, 1, 2].map(function (l) { return h * (s1 * a[l] + s2 * b[l]); }); };
      var q = [corner(1, 1), corner(1, -1), corner(-1, -1), corner(-1, 1)];
      var geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute([].concat(q[0], q[1], q[2], q[0], q[2], q[3]), 3));
      var mesh = new T.Mesh(geo, new T.MeshBasicMaterial({ color: c(pl.color || 'accent'), transparent: true, opacity: 0.16, side: T.DoubleSide, depthWrite: false }));
      mesh.renderOrder = 2;
      group.add(mesh);
      group.add(lines([[q[0], q[1]], [q[1], q[2]], [q[2], q[3]], [q[3], q[0]]], lineMat(c(pl.color || 'accent'), 0.5)));
    });
    (sc.lines || []).forEach(function (l) {
      var d = SV.stage.pad3(l.dir), L = ext * 3, A = d.map(function (x) { return -L * x; }), B = d.map(function (x) { return L * x; });
      group.add(rod(A, B, 0.015, new T.MeshBasicMaterial({ color: c(l.color || 'accent'), transparent: true, opacity: 0.8 })));
      if (l.band !== false) {
        var band = rod(A, B, 0.1, new T.MeshBasicMaterial({ color: c(l.color || 'accent'), transparent: true, opacity: 0.16, depthWrite: false }));
        band.renderOrder = 2; group.add(band);
      }
    });
    if (sc.drops) {
      var dp = [];
      (sc.points || []).forEach(function (p) { var a = SV.stage.pad3(p.at); if (Math.abs(a[2]) > 1e-12) dp.push([a, [a[0], a[1], 0]]); });
      if (dp.length) group.add(lines(dp, lineMat(c('axis'), 1, true)));
    }
    (sc.segments || []).forEach(function (s) {
      group.add(lines([[SV.stage.pad3(s.from), SV.stage.pad3(s.to)]], lineMat(c(s.color), 1, !!s.dash)));
    });
    (sc.arrows || []).forEach(function (a) { group.add(arrow(a.from, a.to, c(a.color), a.width)); });
    (sc.dots || []).forEach(function (d) {
      var m = new T.Mesh(new T.SphereGeometry(0.03 * (d.r || 4), 16, 12),
        new T.MeshBasicMaterial({ color: c(d.color), transparent: d.opacity != null && d.opacity < 1, opacity: d.opacity != null ? d.opacity : 1 }));
      m.position.fromArray(SV.stage.pad3(d.at)); group.add(m);
    });
    var origin = new T.Mesh(new T.SphereGeometry(0.06, 12, 8), new T.MeshBasicMaterial({ color: c('text') }));
    group.add(origin);
    (sc.points || []).forEach(function (p) {
      var m = new T.Mesh(new T.SphereGeometry(0.14, 20, 14), new T.MeshBasicMaterial({ color: c(p.color) }));
      m.position.fromArray(SV.stage.pad3(p.at)); group.add(m);
    });
  }

  function Stage3D(props) {
    var sc = props.scene;
    var hostRef = useRef(null), canvasRef = useRef(null), three = useRef(null), drag = useRef(null);
    var s1 = useState(SV.has('three') ? 'ready' : 'loading'), status = s1[0], setStatus = s1[1];
    var s2 = useState(SV.stage.DEFAULT_CAM), cam = s2[0], setCam = s2[1];
    var s3 = useState(0), size = s3[0], setSize = s3[1];
    var s4 = useState(0), theme = s4[0], setTheme = s4[1];
    var s5 = useState(null), focus = s5[0], setFocus = s5[1];

    useEffect(function () {
      if (status !== 'loading') return;
      SV.load('three').then(function () { setStatus('ready'); }, function () { setStatus('fallback'); });
    }, []);

    // create renderer once three.js is available
    useEffect(function () {
      if (status !== 'ready' || three.current) return;
      var T = root.THREE, renderer;
      try {
        renderer = new T.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
      } catch (e) { setStatus('fallback'); return; }
      renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
      var scene3 = new T.Scene(), group = new T.Group();
      scene3.add(group);
      var camera = new T.PerspectiveCamera(FOV, 1, 0.1, 100);
      three.current = { T: T, renderer: renderer, scene: scene3, group: group, camera: camera, raycaster: new T.Raycaster() };
      var ro = new ResizeObserver(function (ents) { setSize(Math.round(ents[0].contentRect.width)); });
      ro.observe(hostRef.current);
      var mo = new MutationObserver(function () { setTheme(function (t) { return t + 1; }); });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      var mq = root.matchMedia('(prefers-color-scheme: dark)');
      var onMq = function () { setTheme(function (t) { return t + 1; }); };
      if (mq.addEventListener) mq.addEventListener('change', onMq);
      three.current.cleanup = function () {
        ro.disconnect(); mo.disconnect(); if (mq.removeEventListener) mq.removeEventListener('change', onMq);
        disposeGroup(group); renderer.dispose();
      };
      setSize(Math.round(hostRef.current.clientWidth));
    }, [status]);
    useEffect(function () { return function () { if (three.current) three.current.cleanup(); three.current = null; }; }, []);

    // redraw whenever the scene, camera, size or theme changes
    useEffect(function () {
      var t = three.current; if (!t || !size) return;
      t.renderer.setSize(size, size, false);
      t.camera.aspect = 1;
      placeCamera(t.camera, cam);
      disposeGroup(t.group);
      build(t.group, sc, hostRef.current);
      t.renderer.render(t.scene, t.camera);
    }, [sc, cam, size, theme, status]);

    if (status === 'fallback') {
      return html`<div class="stage-fallback"><${SV.stage.Stage2D} scene=${sc} />
        <p class="muted small fallback-note">Simplified 3D view: WebGL is not available in this browser.</p></div>`;
    }

    /* ---- projection for the HTML overlay (handles, labels) ---- */
    function screen(v) {
      var t = three.current; if (!t || !size) return null;
      placeCamera(t.camera, cam);
      var p = new t.T.Vector3().fromArray(SV.stage.pad3(v)).project(t.camera);
      return { x: (p.x + 1) / 2 * size, y: (1 - p.y) / 2 * size };
    }
    function ndc(e) {
      var rc = hostRef.current.getBoundingClientRect();
      return { x: ((e.clientX - rc.left) / rc.width) * 2 - 1, y: -((e.clientY - rc.top) / rc.height) * 2 + 1 };
    }
    function startOrbit(e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { kind: 'orbit', x: e.clientX, y: e.clientY, cam0: cam };
    }
    function startPoint(pt, e) {
      e.preventDefault(); e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.focus({ preventScroll: true });
      var t = three.current, T = t.T;
      var normal = new T.Vector3(); t.camera.getWorldDirection(normal);
      var plane = new T.Plane().setFromNormalAndCoplanarPoint(normal, new T.Vector3().fromArray(SV.stage.pad3(pt.at)));
      drag.current = { kind: 'pt', id: pt.id, plane: plane };
    }
    function move(e) {
      var d = drag.current; if (!d) return;
      if (d.kind === 'orbit') {
        var dx = e.clientX - d.x, dy = e.clientY - d.y;
        setCam({ yaw: d.cam0.yaw - dx * 0.01, pitch: Math.max(-1.45, Math.min(1.45, d.cam0.pitch + dy * 0.01)) });
        return;
      }
      var t = three.current, n = ndc(e), hit = new t.T.Vector3();
      t.raycaster.setFromCamera(new t.T.Vector2(n.x, n.y), t.camera);
      if (t.raycaster.ray.intersectPlane(d.plane, hit)) {
        var pt = (sc.points || []).filter(function (q) { return q.id === d.id; })[0];
        if (pt) pt.onMove(hit.toArray());
      }
    }
    function end() { drag.current = null; }

    var ext = sc.extent || 3.5;
    var axisLabels = (sc.axisLabels || ['x₁', 'x₂', 'x₃']).map(function (txt, i) {
      var v = [0, 0, 0]; v[i] = ext + 0.35; var p = screen(v);
      return p && html`<span class="ov-label axis-label-3d" style=${'left:' + p.x + 'px;top:' + p.y + 'px'}>${txt}</span>`;
    });
    var arrowLabels = (sc.arrows || []).filter(function (a) { return a.label; }).map(function (a) {
      var p = screen(a.to);
      return p && html`<span class="ov-label arrow-label-3d" style=${'left:' + (p.x + 14) + 'px;top:' + (p.y + 14) + 'px;color:var(--' + (a.labelColor || a.color) + ')'}>${a.label}</span>`;
    });
    var handles = (sc.points || []).map(function (pt) {
      var p = screen(pt.at);
      return p && html`<span class="ov-point" style=${'left:' + p.x + 'px;top:' + p.y + 'px'}>
        <button type="button" class=${'ov-handle' + (focus === pt.id ? ' focused' : '')} style=${'--c: var(--' + pt.color + ')'}
          aria-roledescription="draggable point" aria-label=${pt.aria || pt.label}
          onPointerDown=${function (e) { startPoint(pt, e); }} onPointerMove=${move} onPointerUp=${end} onPointerCancel=${end}
          onKeyDown=${function (e) { var v = SV.stage.nudge(e, pt.at, pt.step || sc.step || 0.5, 3); if (v) pt.onMove(v); }}
          onFocus=${function () { setFocus(pt.id); }} onBlur=${function () { setFocus(null); }}></button>
        ${pt.label && html`<span class="ov-label point-label-3d" style=${'color: var(--' + pt.color + ')'}>${pt.label}</span>`}
      </span>`;
    });

    return html`<div ref=${hostRef} class="stage stage3d orbit" role="img" aria-label=${sc.aria || null}>
      <canvas ref=${canvasRef} onPointerDown=${startOrbit} onPointerMove=${move} onPointerUp=${end} onPointerCancel=${end}></canvas>
      ${status === 'loading' && html`<p class="muted small stage-loading">Loading 3D view…</p>`}
      <div class="overlay" aria-hidden="false">${axisLabels}${arrowLabels}${handles}</div>
    </div>`;
  }

  SV.stage = SV.stage || {};
  SV.stage.Stage3D = Stage3D;
  /** Pick the right stage for the scene's dimension. */
  SV.stage.Stage = function (props) {
    return props.scene.dim === 3 ? html`<${Stage3D} scene=${props.scene} />` : html`<${SV.stage.Stage2D} scene=${props.scene} />`;
  };
})(window);
