import { value as jsValue } from './text.js';
import jsText from './text.js' with { type: 'text' };
import { value as jsxValue } from './text.jsx';
import jsxText from './text.jsx' with { type: 'text' };
import { value as tsValue } from './text.ts';
import tsText from './text.ts' with { type: 'text' };
import { value as tsxValue } from './text.tsx';
import tsxText from './text.tsx' with { type: 'text' };

window.scriptText = {
  js: jsText,
  jsx: jsxText,
  ts: tsText,
  tsx: tsxText,
};

window.scriptValue = {
  js: jsValue,
  jsx: jsxValue,
  ts: tsValue,
  tsx: tsxValue,
};
