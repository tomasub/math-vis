/* Toolkit: scene description + SVG stage.

   A visualisation describes WHAT to draw as plain data (a "scene"); a stage decides HOW.
   Stage2D draws scenes in ℝ² with SVG (and ℝ³ as an orthographic fallback when WebGL is
   missing); Stage3D (stage3d.js) draws ℝ³ scenes with three.js. Coordinates are world
   coordinates. Colours are token names resolved from CSS variables, so themes just work.

   scene = {
     dim: 2 | 3,
     extent: 3.5,                // half-width of the visible box (axes run ±extent)
     step: 0.5,                  // keyboard nudge for draggable points
     grid: true, axes: true, axisLabels: ['x₁', 'x₂', 'x₃'],
     fillAll: 'accent',          // tint the whole plane (2D)
     box: 'accent',              // wireframe cube ±3 (3D)
     planes:   [{ basis: [a, b], half: 3.6, color }],          // planes through 0 (3D)
     lines:    [{ dir, color, band: true }],                   // lines through 0
     segments: [{ from, to, color, dash: true, width }],
     arrows:   [{ from, to, color, width, label, labelColor }],
     dots:     [{ at, color, r, opacity }],
     points:   [{ id, at, color, label, aria, onMove(v) }],    // draggable + keyboard
     drops: true                                               // 3D: dashed drop lines to x₃ = 0
   }
*/
(function (root) {
  'use strict';
  var P = root.htmPreact, html = P.html, useState = P.useState, useRef = P.useRef;
  var SV = root.SV;
  var VIEW = 600, C = 300;
  var r2 = function (x) { return Math.round(x * 100) / 100; };
  var col = function (name) { return 'var(--' + (name || 'text') + ')'; };

  /** Keyboard nudge shared by both stages. Returns the new position or null. */
  function nudge(e, at, step, dim) {
    var v = [at[0], at[1], at[2] || 0];
    switch (e.key) {
      case 'ArrowLeft': v[0] -= step; break;
      case 'ArrowRight': v[0] += step; break;
      case 'ArrowUp': v[1] += step; break;
      case 'ArrowDown': v[1] -= step; break;
      case 'PageUp': if (dim !== 3) return null; v[2] += step; break;
      case 'PageDown': if (dim !== 3) return null; v[2] -= step; break;
      default: return null;
    }
    e.preventDefault();
    return v;
  }
  function pad3(v) { return [v[0], v[1], v.length > 2 ? v[2] : 0]; }
  var DEFAULT_CAM = { yaw: 0.6, pitch: 0.45 };

  function Stage2D(props) {
    var sc = props.scene, dim = sc.dim || 2, ext = sc.extent || 3.5;
    var camState = useState(DEFAULT_CAM), cam = camState[0], setCam = camState[1];
    var focusState = useState(null), focus = focusState[0], setFocus = focusState[1];
    var drag = useRef(null), svgRef = useRef(null);
    var S2 = C / ext, S3 = C / (ext * Math.sqrt(3)) * 0.97;
    var axesR = [-Math.sin(cam.yaw), Math.cos(cam.yaw), 0];
    var axesU = [-Math.sin(cam.pitch) * Math.cos(cam.yaw), -Math.sin(cam.pitch) * Math.sin(cam.yaw), Math.cos(cam.pitch)];

    function proj(v) {
      v = pad3(v);
      if (dim === 2) return [C + S2 * v[0], C - S2 * v[1]];
      return [C + S3 * (axesR[0] * v[0] + axesR[1] * v[1] + axesR[2] * v[2]),
              C - S3 * (axesU[0] * v[0] + axesU[1] * v[1] + axesU[2] * v[2])];
    }
    function P(v) { var p = proj(v); return r2(p[0]) + ' ' + r2(p[1]); }
    function seg(a, b) { return 'M ' + P(a) + ' L ' + P(b) + ' '; }
    function head(a, b) {
      var A = proj(a), B = proj(b), dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy);
      if (L < 6) return '';
      var ux = dx / L, uy = dy / L, h = Math.min(13, L * 0.45), w = h * 0.42, bx = B[0] - ux * h, by = B[1] - uy * h;
      return [[B[0], B[1]], [bx - uy * w, by + ux * w], [bx + uy * w, by - ux * w]].map(function (p) { return r2(p[0]) + ',' + r2(p[1]); }).join(' ');
    }

    /* ---- static layers ---- */
    var gMin = '', gMaj = '', ax = '';
    if (sc.grid !== false) {
      if (dim === 2) {
        for (var t = -ext; t <= ext + 1e-9; t += 0.5) {
          var ln = seg([t, -ext], [t, ext]) + seg([-ext, t], [ext, t]);
          if (Math.abs(t - Math.round(t)) < 1e-9) gMaj += ln; else gMin += ln;
        }
      } else {
        var g = Math.floor(ext);
        for (var u = -g; u <= g; u++) gMin += seg([u, -g, 0], [u, g, 0]) + seg([-g, u, 0], [g, u, 0]);
      }
    }
    if (sc.axes !== false) {
      ax = seg([-ext, 0, 0], [ext, 0, 0]) + seg([0, -ext, 0], [0, ext, 0]);
      if (dim === 3) ax += seg([0, 0, -ext], [0, 0, ext]);
    }
    var labels = (sc.axisLabels || ['x₁', 'x₂', 'x₃']).slice(0, dim).map(function (txt, i) {
      var v = [0, 0, 0]; v[i] = ext + 0.25; var p = proj(v);
      return html`<text class="axis-label" x=${r2(p[0])} y=${r2(p[1] + 4)}>${txt}</text>`;
    });
    var cube = '';
    if (dim === 3 && sc.box) {
      [-3, 3].forEach(function (x) { [-3, 3].forEach(function (y) {
        cube += seg([x, y, -3], [x, y, 3]) + seg([x, -3, y], [x, 3, y]) + seg([-3, x, y], [3, x, y]);
      }); });
    }
    var drops = '';
    if (dim === 3 && sc.drops) (sc.points || []).forEach(function (p) {
      var a = pad3(p.at); if (Math.abs(a[2]) > 1e-12) drops += seg(a, [a[0], a[1], 0]);
    });

    /* ---- interaction ---- */
    function toView(e) {
      var rc = svgRef.current.getBoundingClientRect();
      return { x: (e.clientX - rc.left) * VIEW / rc.width, y: (e.clientY - rc.top) * VIEW / rc.height };
    }
    function onDown(e) {
      var p = toView(e), best = -1, bd = 18;
      (sc.points || []).forEach(function (pt, i) {
        var q = proj(pt.at), d = Math.hypot(q[0] - p.x, q[1] - p.y);
        if (d < bd) { bd = d; best = i; }
      });
      if (best < 0 && dim === 2) return;
      e.preventDefault();
      try { svgRef.current.setPointerCapture(e.pointerId); } catch (err) { /* not critical */ }
      if (best >= 0) {
        var pt = sc.points[best];
        drag.current = { kind: 'pt', id: pt.id, sx: p.x, sy: p.y, v0: pad3(pt.at) };
        var node = svgRef.current.querySelector('[data-pt="' + pt.id + '"]');
        if (node) node.focus({ preventScroll: true });
      } else {
        drag.current = { kind: 'orbit', sx: p.x, sy: p.y, cam0: cam };
      }
      svgRef.current.classList.add('dragging');
    }
    function onMove(e) {
      var d = drag.current; if (!d) return;
      var p = toView(e), dx = p.x - d.sx, dy = p.y - d.sy;
      if (d.kind === 'orbit') {
        setCam({ yaw: d.cam0.yaw - dx * 0.01, pitch: Math.max(-1.45, Math.min(1.45, d.cam0.pitch + dy * 0.01)) });
        return;
      }
      var pt = (sc.points || []).filter(function (q) { return q.id === d.id; })[0];
      if (!pt) return;
      if (dim === 2) pt.onMove([(p.x - C) / S2, (C - p.y) / S2, d.v0[2]]);
      else pt.onMove([0, 1, 2].map(function (l) { return d.v0[l] + (dx / S3) * axesR[l] - (dy / S3) * axesU[l]; }));
    }
    function onUp() { drag.current = null; if (svgRef.current) svgRef.current.classList.remove('dragging'); }

    return html`<svg ref=${svgRef} class=${'stage stage2d' + (dim === 3 ? ' orbit' : '')} viewBox="0 0 600 600" role="img"
        aria-label=${sc.aria || null} onPointerDown=${onDown} onPointerMove=${onMove} onPointerUp=${onUp} onPointerCancel=${onUp}>
      ${sc.fillAll && dim === 2 && html`<rect x="0" y="0" width="600" height="600" class="fill-all" style=${'fill:' + col(sc.fillAll === true ? 'accent-weak' : sc.fillAll + '-weak')}></rect>`}
      <path class="grid-minor" d=${gMin}></path>
      <path class="grid-major" d=${gMaj}></path>
      ${cube && html`<path class="box" d=${cube} style=${'stroke:' + col(sc.box === true ? 'accent' : sc.box)}></path>`}
      ${(sc.planes || []).map(function (pl) {
        var a = pad3(pl.basis[0]), b = pad3(pl.basis[1]), h = pl.half || 3.6;
        var pts = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(function (s) {
          var q = proj([0, 1, 2].map(function (l) { return h * (s[0] * a[l] + s[1] * b[l]); }));
          return r2(q[0]) + ',' + r2(q[1]);
        }).join(' ');
        return html`<polygon class="plane" points=${pts} style=${'fill:' + col(pl.color || 'accent') + ';stroke:' + col(pl.color || 'accent')}></polygon>`;
      })}
      ${(sc.lines || []).map(function (l) {
        var d3 = pad3(l.dir), L = ext * 4, dd = seg(d3.map(function (x) { return -L * x; }), d3.map(function (x) { return L * x; }));
        return html`<g>${l.band !== false && html`<path class="line-band" d=${dd} style=${'stroke:' + col(l.color || 'accent')}></path>`}
          <path class="line" d=${dd} style=${'stroke:' + col(l.color || 'accent')}></path></g>`;
      })}
      <path class="axes" d=${ax}></path>
      ${labels}
      <path class="drop" d=${drops}></path>
      ${(sc.dots || []).map(function (d) {
        var q = proj(d.at);
        return html`<circle cx=${r2(q[0])} cy=${r2(q[1])} r=${d.r || 4} style=${'fill:' + col(d.color) + ';fill-opacity:' + (d.opacity != null ? d.opacity : 1)}></circle>`;
      })}
      ${(sc.segments || []).map(function (s) {
        return html`<path class=${'segment' + (s.dash ? ' dash' : '')} d=${seg(s.from, s.to)} style=${'stroke:' + col(s.color) + ';stroke-width:' + (s.width || 2)}></path>`;
      })}
      ${(sc.arrows || []).map(function (a) {
        var q = proj(a.to);
        return html`<g>
          <path class="arrow" d=${seg(a.from, a.to)} style=${'stroke:' + col(a.color) + ';stroke-width:' + (a.width || 2.5)}></path>
          <polygon points=${head(a.from, a.to)} style=${'fill:' + col(a.color)}></polygon>
          ${a.label && html`<text class="arrow-label" x=${r2(q[0] + 10)} y=${r2(q[1] + 20)} style=${'fill:' + col(a.labelColor || a.color)}>${a.label}</text>`}
        </g>`;
      })}
      <circle cx="300" cy="300" r="3.5" class="origin"></circle>
      ${(sc.points || []).map(function (pt) {
        var q = proj(pt.at), c = col(pt.color);
        return html`<g>
          ${focus === pt.id && html`<circle cx=${r2(q[0])} cy=${r2(q[1])} r="15" class="ring" style=${'stroke:' + c}></circle>`}
          <circle data-pt=${pt.id} cx=${r2(q[0])} cy=${r2(q[1])} r="9" class="handle" tabIndex="0"
            aria-roledescription="draggable point" aria-label=${pt.aria || pt.label} style=${'stroke:' + c}
            onKeyDown=${function (e) { var v = nudge(e, pt.at, pt.step || sc.step || 0.5, dim); if (v) pt.onMove(v); }}
            onFocus=${function () { setFocus(pt.id); }} onBlur=${function () { setFocus(null); }}></circle>
          ${pt.label && html`<text class="point-label" x=${r2(q[0] + 12)} y=${r2(q[1] - 12)} style=${'fill:' + c}>${pt.label}</text>`}
        </g>`;
      })}
    </svg>`;
  }

  SV.stage = SV.stage || {};
  SV.stage.nudge = nudge;
  SV.stage.pad3 = pad3;
  SV.stage.DEFAULT_CAM = DEFAULT_CAM;
  SV.stage.Stage2D = Stage2D;
})(window);
