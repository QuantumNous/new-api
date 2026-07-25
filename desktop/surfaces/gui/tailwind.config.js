/** Tailwind config — mirrors platform/ui-mocks/redesign.html so the app can use the mock's
 *  exact utility classes. Colors map to the CSS custom properties already defined in styles.css
 *  (so light/dark theming flows through one source of truth). */
// Tokens are hex CSS vars (shared with styles.css), which Tailwind can't alpha-multiply for
// `/NN` opacity utilities. Wrap each in color-mix so `bg-panel/70` etc. work, while bare
// `var(--x)` usage in styles.css stays intact. (color-mix is supported in the Chromium webview.)
const tok = (name) => ({ opacityValue }) =>
  opacityValue === undefined
    ? `var(${name})`
    : `color-mix(in srgb, var(${name}) calc(${opacityValue} * 100%), transparent)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: tok("--paper"),
        panel: tok("--panel"),
        ink: tok("--ink"),
        muted: tok("--muted"),
        faint: tok("--faint"),
        line: tok("--line"),
        lineStrong: tok("--line-strong"),
        accent: tok("--accent"),
        accentSoft: tok("--accent-soft"),
        ok: tok("--ok"),
        okSoft: tok("--ok-soft"),
        okLine: tok("--ok-line"),
        warnInk: tok("--warn-ink"),
        warnSoft: tok("--warn-soft"),
        danger: tok("--danger"),
        dangerSoft: tok("--danger-soft"),
        tealInk: tok("--teal-ink"),
        tealSoft: tok("--teal-soft"),
        tealLine: tok("--teal-line"),
        solid: tok("--solid"),
        onSolid: tok("--on-solid"),
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Inter", "system-ui", "sans-serif"],
        mono: ["SF Mono", "JetBrains Mono", "Menlo", "monospace"],
      },
      borderRadius: { xl2: "14px" },
    },
  },
  plugins: [],
};
