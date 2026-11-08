/* Toolkit: controls and panels shared by all visualisations.
   Components are Preact function components written with htm (no build step). */
(function (root) {
  'use strict';
  var P = root.htmPreact, html = P.html, useState = P.useState, useEffect = P.useEffect, useRef = P.useRef;
  var SV = root.SV;
  var uid = 0;
  function useId(prefix) { var r = useRef(null); if (r.current == null) r.current = (prefix || 'sv') + '-' + (++uid); return r.current; }

  /** State hook with object merge: const [s, set] = useMerge(init); set({ k: 3 }) or set(s => patch). */
  function useMerge(init) {
    var st = useState(init), s = st[0], setS = st[1];
    function set(patch) {
      setS(function (old) {
        var p = typeof patch === 'function' ? patch(old) : patch;
        return p ? Object.assign({}, old, p) : old;
      });
    }
    return [s, set];
  }

  /** Segmented single choice: options [{ value, label, aria? }] */
  function Seg(props) {
    var labelId = useId('seg');
    return html`<div class="row">
      ${props.label && html`<span class="muted" id=${labelId}>${props.label}</span>`}
      <div class="seg" role="group" aria-labelledby=${props.label ? labelId : null} aria-label=${props.label ? null : props.aria}>
        ${props.options.map(function (o) {
          return html`<button type="button" class=${'seg-btn' + (props.mono ? ' mono' : '')} aria-pressed=${String(o.value === props.value)}
            aria-label=${o.aria || null} onClick=${function () { props.onChange(o.value); }}>${o.label}</button>`;
        })}
      </div></div>`;
  }

  function Check(props) {
    return html`<label class="check"><input type="checkbox" checked=${props.checked}
      onChange=${function (e) { props.onChange(e.currentTarget.checked); }} /> ${props.label}</label>`;
  }

  function Btn(props) {
    return html`<button type="button" class=${'btn' + (props.primary ? ' primary' : '')} onClick=${props.onClick}
      disabled=${props.disabled}>${props.children}</button>`;
  }

  /** Range slider with a label and a formatted value. */
  function Slider(props) {
    var id = useId('sl');
    return html`<div class="slider-row">
      <label for=${id} class=${'slider-label ' + (props.cls || '')}>${props.label}</label>
      <input id=${id} type="range" class=${props.cls || ''} min=${props.min} max=${props.max} step=${props.step} value=${props.value}
        onInput=${function (e) { props.onInput(parseFloat(e.currentTarget.value)); }} />
      <output for=${id} class="mono">${props.display != null ? props.display : props.value}</output>
    </div>`;
  }

  /** Editable matrix (array of rows). Keeps the typed text until it parses, then commits. */
  function MatrixEditor(props) {
    var A = props.value, name = props.name || 'a';
    var drafts = useState({}), d = drafts[0], setD = drafts[1];
    return html`<fieldset class="matrix-editor">
      <legend>${props.legend || 'Matrix A'}</legend>
      <div class="matrix-grid" style=${'grid-template-columns: repeat(' + A[0].length + ', minmax(0, 4.5em))'}>
        ${A.map(function (row, i) { return row.map(function (v, j) {
          var key = i + ',' + j, text = d[key] != null ? d[key] : SV.linalg.fmt(v).replace('−', '-');
          var bad = d[key] != null && !isFinite(parseFloat(d[key]));
          return html`<input class=${'mono' + (bad ? ' invalid' : '')} inputmode="decimal" aria-label=${name + (i + 1) + (j + 1)}
            aria-invalid=${bad ? 'true' : null} value=${text}
            onInput=${function (e) {
              var t = e.currentTarget.value.replace('−', '-'), x = Number(t);
              setD(Object.assign({}, d, (function () { var o = {}; o[key] = t; return o; })()));
              if (t.trim() !== '' && isFinite(x)) props.onChange(i, j, x);
            }}
            onBlur=${function () { var o = Object.assign({}, d); delete o[key]; setD(o); }} />`;
        }); })}
      </div>
    </fieldset>`;
  }

  function Panel(props) {
    return html`<section class=${'panel' + (props.muted ? ' panel-muted' : '') + (props.cls ? ' ' + props.cls : '')}
      aria-live=${props.live ? 'polite' : null}>
      <h2 class="panel-title">${props.title}</h2>${props.children}</section>`;
  }

  /** Definition list from [[term, value], ...]; values may be strings or vnodes. */
  function KV(props) {
    return html`<dl class=${'kv ' + (props.cls || 'small')}>${props.items.map(function (it) {
      return [html`<dt>${it[0]}</dt>`, html`<dd class=${it[2] || ''}>${it[1]}</dd>`];
    })}</dl>`;
  }

  /* KaTeX. \htmlClass{q1}{...} is allowed so formula parts can take series colours from CSS. */
  var texOpts = function (display) {
    return { throwOnError: false, displayMode: !!display, output: 'htmlAndMathml',
      trust: function (ctx) { return ctx.command === '\\htmlClass'; }, strict: false };
  };
  function Tex(props) {
    var ref = useRef(null);
    useEffect(function () {
      if (!ref.current) return;
      if (root.katex) root.katex.render(props.tex, ref.current, texOpts(props.display));
      else ref.current.textContent = props.fallback || props.tex;
    }, [props.tex, props.display]);
    return html`<span ref=${ref} class=${'tex' + (props.display ? ' tex-display' : '') + (props.cls ? ' ' + props.cls : '')}></span>`;
  }

  /**
   * Predict → reveal. Renders `options` ([{ value, label }]) as a choice of guesses; the
   * Reveal button is disabled until one is picked. The correct answer (`props.correct`)
   * is never read until after reveal, so it cannot show up in the DOM beforehand — not
   * just hidden with CSS. After reveal, shows whether the guess matched and the content
   * from `props.render(correct)` (a vnode, or a plain string/number).
   * Resets to "no guess, not revealed" whenever `props.resetKey` changes (e.g. pass a new
   * key when the student moves on to a new question, a new random case, …).
   */
  function PredictReveal(props) {
    var st = useState({ guess: null, revealed: false }), s = st[0], setS = st[1];
    useEffect(function () { setS({ guess: null, revealed: false }); }, [props.resetKey]);
    var correct = s.revealed ? props.correct : null;
    var right = s.revealed && s.guess === props.correct;
    return html`<div class="predict-reveal">
      ${props.prompt && html`<p class="predict-prompt">${props.prompt}</p>`}
      <div class="seg" role="group" aria-label=${props.prompt || props.label || 'Predict'}>
        ${props.options.map(function (o) {
          return html`<button type="button" class="seg-btn" aria-pressed=${String(s.guess === o.value)}
            disabled=${s.revealed} onClick=${function () { setS({ guess: o.value, revealed: false }); }}>${o.label}</button>`;
        })}
      </div>
      <div class="row">
        <${Btn} primary disabled=${s.guess == null || s.revealed}
          onClick=${function () { setS(function (o) { return Object.assign({}, o, { revealed: true }); }); if (props.onReveal) props.onReveal(); }}>Reveal<//>
        ${s.revealed && html`<${Btn} onClick=${function () { setS({ guess: null, revealed: false }); }}>Try another<//>`}
      </div>
      ${s.revealed && html`<p class=${'predict-result ' + (right ? 'ok' : 'warn')}>
        ${right ? 'Correct. ' : 'Not quite. '}${props.render ? props.render(correct) : String(correct)}
      </p>`}
    </div>`;
  }

  /** Observable Plot chart. props.make(Plot, width) returns Plot options; re-rendered when deps change. */
  function Chart(props) {
    var ref = useRef(null);
    useEffect(function () {
      var el = ref.current;
      if (!el) return;
      if (!root.Plot) { el.textContent = 'Chart library not loaded.'; return; }
      var w = Math.max(280, Math.round(el.clientWidth || 600));
      var node = root.Plot.plot(Object.assign({ width: w, style: { background: 'transparent', color: 'var(--text)', fontFamily: 'var(--font)' } }, props.make(root.Plot, w)));
      el.replaceChildren(node);
      return function () { el.replaceChildren(); };
    }, props.deps || []);
    return html`<figure class="chart" ref=${ref} aria-label=${props.aria || null} role=${props.aria ? 'img' : null}></figure>`;
  }

  /** Stacked bar of fixed total length: props.parts = [{ label, value, color }], props.total. Widths ∝ value/total. */
  function SplitBar(props) {
    var total = props.total || props.parts.reduce(function (s, p) { return s + p.value; }, 0) || 1;
    var txt = props.parts.map(function (p) { return p.label + ' = ' + p.value; }).join(' + ') + ' = ' + total;
    return html`<div class="split-bar" role="img" aria-label=${txt}>
      <div style="display:flex;height:26px;border:1px solid var(--muted);border-radius:6px;overflow:hidden">
        ${props.parts.map(function (p) {
          return html`<div style=${'flex:' + p.value + ' 0 0;background:' + (p.color ? 'var(--' + p.color + ')' : 'var(--accent)') + ';display:' + (p.value > 0 ? 'block' : 'none')}></div>`;
        })}
      </div>
      <div class="mono" style="font-size:13px;margin-top:4px">${txt}</div>
    </div>`;
  }

  /** Play/pause + scrubber for t ∈ [0,1]. props: value, onChange(t), duration (s, default 3), label, loop. */
  function Player(props) {
    var st = useState(false), playing = st[0], setPlaying = st[1];
    var tRef = useRef(props.value); tRef.current = props.value;
    useEffect(function () {
      if (!playing) return;
      var dur = (props.duration || 3) * 1000, last = null, id;
      function frame(now) {
        if (last == null) last = now;
        var t = tRef.current + (now - last) / dur; last = now;
        if (t >= 1) { if (props.loop) t -= 1; else { props.onChange(1); setPlaying(false); return; } }
        props.onChange(t); id = requestAnimationFrame(frame);
      }
      id = requestAnimationFrame(frame);
      return function () { cancelAnimationFrame(id); };
    }, [playing]);
    return html`<div class="row" style="align-items:center;gap:10px">
      <${Btn} onClick=${function () { if (!playing && props.value >= 1) props.onChange(0); setPlaying(!playing); }}>${playing ? 'Pause' : 'Play'}<//>
      <div style="flex:1"><${Slider} label=${props.label || 't'} min="0" max="1" step="0.01" value=${props.value}
        display=${props.value.toFixed(2)} onInput=${function (x) { setPlaying(false); props.onChange(x); }} /></div>
    </div>`;
  }

  /** Indicator lights: props.items = [{ label, on, detail }]; on → accent lamp, off → warn lamp. Also readable as text (✓/✗). */
  function Lights(props) {
    return html`<ul class="lights" style="list-style:none;margin:0;padding:0">
      ${props.items.map(function (it) {
        return html`<li style="display:flex;align-items:baseline;gap:8px;margin:4px 0" aria-label=${it.label + ': ' + (it.on ? 'true' : 'false')}>
          <span aria-hidden="true" style=${'flex:none;width:14px;height:14px;border-radius:50%;border:1px solid var(--muted);background:' + (it.on ? 'var(--accent)' : 'var(--warn)') + ';align-self:center'}></span>
          <span>${it.label}</span><span class="mono" style="margin-left:auto;font-size:13px;color:var(--muted)">${it.detail || ''} ${it.on ? '✓' : '✗'}</span>
        </li>`;
      })}
    </ul>`;
  }

  SV.ui = { html: html, useMerge: useMerge, useId: useId, Seg: Seg, Check: Check, Btn: Btn, Slider: Slider,
    MatrixEditor: MatrixEditor, Panel: Panel, KV: KV, Tex: Tex, Chart: Chart, PredictReveal: PredictReveal, SplitBar: SplitBar, Player: Player, Lights: Lights };
})(window);
