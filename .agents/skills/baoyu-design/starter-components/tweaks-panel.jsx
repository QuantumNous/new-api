
/* BEGIN USAGE */
// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
// Exports (to window): useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider,
//   TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "palette": ["#D97757", "#29261b", "#f6f4ef"],
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        options={['#D97757', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakColor  label="Palette" value={t.palette}
//                        options={[['#D97757', '#29261b', '#f6f4ef'],
//                                  ['#475569', '#0f172a', '#f1f5f9']]}
//                        onChange={(v) => setTweak('palette', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// TweakRadio is the segmented control for 2–3 short options (auto-falls-back to
// TweakSelect past ~16/~10 chars per label); reach for TweakSelect directly when
// options are many or long. For color tweaks always curate 3-4 options rather than
// a free picker; an option can also be a whole 2–5 color palette (the stored value
// is the array). The Tweak* controls are a floor, not a ceiling — build custom
// controls inside the panel if a tweak calls for UI they don't cover.
/* END USAGE */
// ─────────────────────────────────────────────────────────────────────────────

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`;

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null
      ? keyOrEdits : { [keyOrEdits]: val };
    setValues((prev) => ({ ...prev, ...edits }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*');
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react — the parent message only reaches the host, not peers.
    window.dispatchEvent(new CustomEvent('tweakchange', { detail: edits }));
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({ title = 'Tweaks', children }) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  const offsetRef = React.useRef({ x: 16, y: 16 });
  const PAD = 16;

  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth, h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y)),
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);

  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);

  React.useEffect(() => {
    const onMsg = (e) => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);
      else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
  };

  const onDragStart = (e) => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = (ev) => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy),
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  if (!open) return null;
  return (
    <>
      <style>{__TWEAKS_STYLE}</style>
      <div ref={dragRef} className="twk-panel" data-omelette-chrome=""
           style={{ right: offsetRef.current.x, bottom: offsetRef.current.y }}>
        <div className="twk-hd" onMouseDown={onDragStart}>
          <b>{title}</b>
          <button className="twk-x" aria-label="Close tweaks"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={dismiss}>✕</button>
        </div>
        <div className="twk-body">
          {children}
        </div>
      </div>
    </>
  );
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function TweakSection({ label, children }) {
  return (
    <>
      <div className="twk-sect">{label}</div>
      {children}
    </>
  );
}

function TweakRow({ label, value, children, inline = false }) {
  return (
    <div className={inline ? 'twk-row twk-row-h' : 'twk-row'}>
      <div className="twk-lbl">
        <span>{label}</span>
        {value != null && <span className="twk-val">{value}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Controls ────────────────────────────────────────────────────────────────

function TweakSlider({ label, value, min = 0, max = 100, step = 1, unit = '', onChange }) {
  return (
    <TweakRow label={label} value={`${value}${unit}`}>
      <input type="range" className="twk-slider" min={min} max={max} step={step}
             value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </TweakRow>
  );
}

function TweakToggle({ label, value, onChange }) {
  return (
    <div className="twk-row twk-row-h">
      <div className="twk-lbl"><span>{label}</span></div>
      <button type="button" className="twk-toggle" data-on={value ? '1' : '0'}
              role="switch" aria-checked={!!value}
              onClick={() => onChange(!value)}><i /></button>
    </div>
  );
}

function TweakRadio({ label, value, options, onChange }) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Segments wrap mid-word once per-segment width runs out. The track is
  // ~248px (280 panel − 28 body pad − 4 seg pad), each button loses 12px
  // to its own padding, and 11.5px system-ui averages ~6.3px/char — so 2
  // options fit ~16 chars each, 3 fit ~10. Past that (or >3 options), fall
  // back to a dropdown rather than wrap.
  const labelLen = (o) => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({ 2: 16, 3: 10 }[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings — map back to the original option value so the
    // fallback stays type-preserving (numbers, booleans) like the segment path.
    const resolve = (s) => {
      const m = options.find((o) => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return <TweakSelect label={label} value={value} options={options}
                        onChange={(s) => onChange(resolve(s))} />;
  }
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  const idx = Math.max(0, opts.findIndex((o) => o.value === value));
  const n = opts.length;

  const segAt = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor(((clientX - r.left - 2) / inner) * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };

  const onPointerDown = (e) => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = (ev) => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <TweakRow label={label}>
      <div ref={trackRef} role="radiogroup" onPointerDown={onPointerDown}
           className={dragging ? 'twk-seg dragging' : 'twk-seg'}>
        <div className="twk-seg-thumb"
             style={{ left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
                      width: `calc((100% - 4px) / ${n})` }} />
        {opts.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value}>
            {o.label}
          </button>
        ))}
      </div>
    </TweakRow>
  );
}

function TweakSelect({ label, value, options, onChange }) {
  return (
    <TweakRow label={label}>
      <select className="twk-field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </TweakRow>
  );
}

function TweakText({ label, value, placeholder, onChange }) {
  return (
    <TweakRow label={label}>
      <input className="twk-field" type="text" value={value} placeholder={placeholder}
             onChange={(e) => onChange(e.target.value)} />
    </TweakRow>
  );
}

function TweakNumber({ label, value, min, max, step = 1, unit = '', onChange }) {
  const clamp = (n) => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({ x: 0, val: 0 });
  const onScrubStart = (e) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, val: value };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = (ev) => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div className="twk-num">
      <span className="twk-num-lbl" onPointerDown={onScrubStart}>{label}</span>
      <input type="number" value={value} min={min} max={max} step={step}
             onChange={(e) => onChange(clamp(Number(e.target.value)))} />
      {unit && <span className="twk-num-unit">{unit}</span>}
    </div>
  );
}

// Relative-luminance contrast pick — checkmarks drawn over a swatch need to
// read on both #111 and #fafafa without per-option configuration. Hex input
// only (#rgb / #rrggbb); named or rgb()/hsl() colors fall through to "light".
function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}

const __TwkCheck = ({ light }) => (
  <svg viewBox="0 0 14 14" aria-hidden="true">
    <path d="M3 7.2 5.8 10 11 4.2" fill="none" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"
          stroke={light ? 'rgba(0,0,0,.78)' : '#fff'} />
  </svg>
);

// TweakColor — curated color/palette picker. Each option is either a single
// hex string or an array of 1-5 hex strings; the card adapts — a lone color
// renders solid, a palette renders colors[0] as the hero (left ~2/3) with the
// rest stacked in a sharp column on the right. onChange emits the
// option in the shape it was passed (string stays string, array stays array).
// Without options it falls back to the native color input for back-compat.
function TweakColor({ label, value, options, onChange }) {
  if (!options || !options.length) {
    return (
      <div className="twk-row twk-row-h">
        <div className="twk-lbl"><span>{label}</span></div>
        <input type="color" className="twk-swatch" value={value}
               onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively. String() guards JSON.stringify(undefined),
  // which returns the primitive undefined (no .toLowerCase).
  const key = (o) => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return (
    <TweakRow label={label}>
      <div className="twk-chips" role="radiogroup">
        {options.map((o, i) => {
          const colors = Array.isArray(o) ? o : [o];
          const [hero, ...rest] = colors;
          const sup = rest.slice(0, 4);
          const on = key(o) === cur;
          return (
            <button key={i} type="button" className="twk-chip" role="radio"
                    aria-checked={on} data-on={on ? '1' : '0'}
                    aria-label={colors.join(', ')} title={colors.join(' · ')}
                    style={{ background: hero }}
                    onClick={() => onChange(o)}>
              {sup.length > 0 && (
                <span>
                  {sup.map((c, j) => <i key={j} style={{ background: c }} />)}
                </span>
              )}
              {on && <__TwkCheck light={__twkIsLight(hero)} />}
            </button>
          );
        })}
      </div>
    </TweakRow>
  );
}

function TweakButton({ label, onClick, secondary = false }) {
  return (
    <button type="button" className={secondary ? 'twk-btn secondary' : 'twk-btn'}
            onClick={onClick}>{label}</button>
  );
}

Object.assign(window, {
  useTweaks, TweaksPanel, TweakSection, TweakRow,
  TweakSlider, TweakToggle, TweakRadio, TweakSelect,
  TweakText, TweakNumber, TweakColor, TweakButton,
});

// ── TweakSuggestionBar (flag-gated addon) ───────────────────────────────────
(function () {
  const s = document.createElement('style');
  s.textContent = `
    @keyframes twk-blink{50%{opacity:0}}
    @keyframes twk-fadein{from{opacity:0;transform:translateX(4px)}to{opacity:1;transform:none}}
    .twk-sugg{display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:8px;
      background:rgba(0,0,0,.04);border:.5px solid rgba(0,0,0,.06);transition:all .15s}
    .twk-sugg:focus-within{background:rgba(0,0,0,.06);border-color:rgba(0,0,0,.12)}
    .twk-sugg-field{position:relative;flex:1;min-width:0}
    .twk-sugg-field input{width:100%;height:20px;border:0;background:transparent;
      font:inherit;outline:none;color:inherit}
    .twk-sugg-ghost{position:absolute;inset:0;display:flex;align-items:center;
      color:rgba(41,38,27,.42);pointer-events:none;white-space:nowrap;overflow:hidden}
    .twk-sugg-ghost.hint{color:rgba(41,38,27,.28)}
    .twk-sugg-caret{display:inline-block;width:1px;height:13px;margin-left:1px;
      border-right:1.5px solid currentColor;opacity:.5;animation:twk-blink 1s step-end infinite}
    .twk-sugg-ideas{appearance:none;border:0;background:transparent;font:inherit;
      font-size:10.5px;font-weight:600;color:rgba(41,38,27,.6);cursor:default;padding:0 2px;
      white-space:nowrap;animation:twk-fadein .25s ease}
    .twk-sugg-ideas:hover{color:rgba(41,38,27,.85)}
    .twk-sugg-ideas svg{color:#D97757}
    .twk-sugg-send{appearance:none;border:0;height:20px;padding:0 8px;border-radius:5px;
      background:#29261b;color:#fff;font:inherit;font-size:10px;font-weight:600;cursor:default}
  `;
  document.head.appendChild(s);
})();

const __twkSendChat = (text) =>
  window.parent.postMessage({ type: '__edit_mode_chat', text }, '*');

const __TWK_SPARK_PATH = 'M18.3658 62.2435L36.7823 51.9165L37.0858 51.012L36.7823 50.5083H35.8716L32.7853 50.3206L22.2616 50.0389L13.1546 49.6634L4.30054 49.194L2.07438 48.7246L0 45.9551L0.202378 44.5938L2.07438 43.3264L4.75589 43.5611L10.6755 43.9836L19.5801 44.5938L26.0056 44.9693L35.568 45.9551H37.0858L37.2882 45.3448L36.7823 44.9693L36.3775 44.5938L27.1693 38.3507L17.2022 31.7789L11.9909 27.9767L9.20822 26.0522L7.79157 24.2684L7.18443 20.3254L9.71416 17.5089L13.1546 17.7436L14.0147 17.9783L17.5057 20.654L24.9431 26.4277L34.6573 33.5627L36.0739 34.7362L36.6444 34.3512L36.7317 34.079L36.0739 32.9994L30.8121 23.4704L25.1961 13.7537L22.6664 9.71675L22.0086 7.32277C21.7539 6.31812 21.6039 5.48695 21.6039 4.45938L24.4878 0.516349L26.1068 0L30.0026 0.516349L31.6216 1.92457L34.0502 7.46359L37.9459 16.1476L44.0173 27.9767L45.7881 31.4973L46.7494 34.7362L47.1036 35.722H47.7107V35.1587L48.2166 28.4931L49.1274 20.3254L50.0381 9.81063L50.3416 6.85336L51.8089 3.28586L54.7434 1.36128L57.0201 2.44092L58.8921 5.11655L58.6391 6.85336L57.5261 14.0822L55.3505 25.395L53.9338 32.9994H54.7434L55.7047 32.0136L59.5498 26.944L65.9753 18.8702L68.8086 15.6782L72.1479 12.1577L74.2729 10.4678H78.3204L81.2549 14.8802L79.9395 19.4335L75.7907 24.6909L72.3503 29.1503L67.4173 35.7593L64.3563 41.0732L64.6308 41.5116L65.3682 41.4487L76.499 39.0548L82.5198 37.9751L89.7042 36.7547L92.9423 38.2568L93.2964 39.8058L92.0316 42.9509L84.3412 44.8285L75.3354 46.6592L61.9245 49.8162L61.776 49.9356L61.9513 50.1956L67.9991 50.743L70.5795 50.8839H76.9038L88.6923 51.7757L91.7786 53.7942L93.6 56.282L93.2964 58.2066L88.5405 60.6006L82.1656 59.0985L67.2402 55.531L62.1302 54.2636H61.4218V54.6861L65.6718 58.8638L73.514 65.9049L83.2787 75.0114L83.7846 77.2646L82.5198 79.0483L81.2043 78.8606L72.6032 72.3827L69.264 69.4724L61.776 63.1354H61.2701V63.7926L62.9903 66.3274L72.1479 80.081L72.6032 84.3057L71.9455 85.667L69.5676 86.5119L66.9872 86.0425L61.5736 78.4851L56.0588 70.0357L51.6065 62.4313L51.0687 62.7708L48.419 91.0652L47.2048 92.5204L44.3715 93.6L41.9935 91.8162L40.7286 88.9059L41.9935 83.1322L43.5114 75.6217L44.7256 69.6602L45.8387 62.2435L46.5185 59.7659L46.4584 59.6001L45.9153 59.6914L40.3239 67.3601L31.824 78.8606L25.0949 86.0425L23.4759 86.6997L20.6932 85.2445L20.9462 82.6628L22.5146 80.3627L31.824 68.5336L37.44 61.1639L41.0595 56.9335L41.0243 56.3216L40.8245 56.3046L16.0891 72.4297L11.6874 72.993L9.76476 71.2092L10.0177 68.2989L10.9284 67.3601L18.3658 62.2435Z';

function ClaudeSpark({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 94 94" fill="currentColor"
         style={{ display: 'inline-block', verticalAlign: '-1px' }}>
      <path d={__TWK_SPARK_PATH} />
    </svg>
  );
}

// Typewriter-cycles through `suggestions`. Clicking the field while a
// suggestion is animating freezes it as ghost text; Tab accepts it into the
// input. Enter posts __edit_mode_chat (host drops the text into the chat
// composer for the user to send). After the cycle the static placeholder
// types in and "Ideas" appears — clicking asks for three more suggestions.
function TweakSuggestionBar({
  suggestions = [],
  placeholder = 'Describe a tweak…',
  ideasPrompt = 'Suggest three more tweak ideas for this design and update the suggestions on TweakSuggestionBar.',
}) {
  const [val, setVal] = React.useState('');
  const [ghost, setGhost] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const inputRef = React.useRef(null);
  const tw = useTwkTypewriter(suggestions, { placeholder, enabled: !val && !ghost && !focused });

  const freeze = () => {
    tw.markPlayed();
    if (val || ghost) return;
    const target = !tw.done ? suggestions[tw.idx] : '';
    if (target) setGhost(target);
    inputRef.current?.focus();
  };

  const submit = () => {
    const v = (val || ghost).trim();
    if (!v) return;
    __twkSendChat(v);
    setVal('');
    setGhost('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Tab' && ghost && !val) {
      e.preventDefault();
      setVal(ghost);
      setGhost('');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      setGhost('');
    }
  };

  const requestIdeas = () => __twkSendChat(ideasPrompt);

  const showAnim = !val && !ghost && !focused && !tw.done;
  const showStatic = !val && !ghost && !focused && tw.done;

  return (
    <div className="twk-sugg" onMouseDown={freeze}>
      <div className="twk-sugg-field">
        <input
          ref={inputRef}
          value={val}
          placeholder={focused && !ghost ? placeholder : ''}
          onChange={(e) => { setVal(e.target.value); setGhost(''); }}
          onFocus={() => { setFocused(true); tw.markPlayed(); }}
          onBlur={() => { setFocused(false); if (!val) setGhost(''); }}
          onKeyDown={onKeyDown}
        />
        {showAnim && (
          <div className="twk-sugg-ghost">
            {tw.text}<span className="twk-sugg-caret" />
          </div>
        )}
        {showStatic && (
          <div className="twk-sugg-ghost">
            {tw.tail}{tw.tail.length < placeholder.length && <span className="twk-sugg-caret" />}
          </div>
        )}
        {ghost && !val && (
          <div className="twk-sugg-ghost hint">{ghost}</div>
        )}
      </div>
      {val || ghost ? (
        <button className="twk-sugg-send"
                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                onClick={submit}>
          Add
        </button>
      ) : tw.done && !focused ? (
        <button className="twk-sugg-ideas"
                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                onClick={requestIdeas}>
          Ideas <ClaudeSpark />
        </button>
      ) : null}
    </div>
  );
}

// Minimal type→pause→erase cycler. Plays once per unique `items` content per
// session — a reload from a tweak-value write skips straight to done; a new
// suggestion set (after "Ideas") gets a fresh animation.
function useTwkTypewriter(items, { placeholder, typeMs = 35, eraseMs = 22, pauseMs = 1800, enabled = true } = {}) {
  const key = React.useMemo(() => '__twk_played:' + JSON.stringify(items), [items.join('\n')]);
  const played = () => { try { return sessionStorage.getItem(key) === '1'; } catch { return false; } };

  const [text, setText] = React.useState('');
  const [tail, setTail] = React.useState(() => (items.length === 0 || played() ? placeholder : ''));
  const [idx, setIdx] = React.useState(0);
  const [done, setDone] = React.useState(() => items.length === 0 || played());
  const phase = React.useRef('type');
  const n = React.useRef(0);

  const markPlayed = React.useCallback(() => {
    try { sessionStorage.setItem(key, '1'); } catch {}
    setDone(true);
  }, [key]);

  React.useEffect(() => {
    const skip = items.length === 0 || played();
    setText(''); setIdx(0);
    setDone(skip);
    setTail(skip ? placeholder : '');
    phase.current = 'type'; n.current = 0;
  }, [key]);

  React.useEffect(() => {
    if (done || !enabled) return;
    const item = items[idx] ?? '';
    let t;
    const tick = () => {
      if (phase.current === 'type') {
        n.current++;
        setText(item.slice(0, n.current));
        if (n.current >= item.length) { phase.current = 'pause'; t = setTimeout(tick, pauseMs); }
        else t = setTimeout(tick, typeMs + Math.random() * 20);
      } else if (phase.current === 'pause') {
        phase.current = 'erase'; t = setTimeout(tick, eraseMs);
      } else {
        n.current--;
        setText(item.slice(0, n.current));
        if (n.current <= 0) {
          if (idx === items.length - 1) { markPlayed(); return; }
          phase.current = 'type'; setIdx((i) => i + 1);
        } else t = setTimeout(tick, eraseMs);
      }
    };
    phase.current = 'type'; n.current = 0; setText('');
    t = setTimeout(tick, 400);
    return () => clearTimeout(t);
  }, [idx, done, key, enabled, typeMs, eraseMs, pauseMs]);

  React.useEffect(() => {
    if (!done || tail === placeholder) return;
    let i = 0;
    const t = setInterval(() => {
      i++; setTail(placeholder.slice(0, i));
      if (i >= placeholder.length) clearInterval(t);
    }, 28);
    return () => clearInterval(t);
  }, [done, placeholder]);

  return { text, tail, idx, done, markPlayed };
}

Object.assign(window, { TweakSuggestionBar });
