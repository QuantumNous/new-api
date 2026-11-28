import {
  MARKER_PREFIX,
  MOCK_BUILD_PREFIX,
  MOCK_EDGE_PREFIX,
  MOCK_MODULE_ID,
  MOCK_RUNTIME_PREFIX,
} from './constants'
import { isValidExportName } from './analysis'
import { CLIENT_ENV_SUGGESTIONS } from './trace'
import { relativizePath } from './utils'
import type { ViolationInfo } from './trace'

function toBase64Url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url')
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8')
}

type MockAccessMode = 'error' | 'warn' | 'off'

export const RUNTIME_SUGGESTION_TEXT =
  'Fix: ' +
  CLIENT_ENV_SUGGESTIONS.join('. ') +
  '. To disable these runtime diagnostics, set importProtection.mockAccess: "off".'

export function mockRuntimeModuleIdFromViolation(
  info: ViolationInfo,
  mode: MockAccessMode,
  root: string,
): string {
  if (mode === 'off') return MOCK_MODULE_ID
  if (info.env !== 'client') return MOCK_MODULE_ID

  const rel = (p: string) => relativizePath(p, root)
  const trace = info.trace.map((s) => {
    const file = rel(s.file)
    if (s.line == null) return file
    return `${file}:${s.line}:${s.column ?? 1}`
  })

  const payload = {
    env: info.env,
    importer: info.importer,
    specifier: info.specifier,
    trace,
    mode,
  }

  return `${MOCK_RUNTIME_PREFIX}${toBase64Url(JSON.stringify(payload))}`
}

export function makeMockEdgeModuleId(
  exports: Array<string>,
  runtimeId: string,
): string {
  const payload = { exports, runtimeId }
  return `${MOCK_EDGE_PREFIX}${toBase64Url(JSON.stringify(payload))}`
}

function generateMockCode(diagnostics?: {
  meta: {
    env: string
    importer: string
    specifier: string
    trace: Array<unknown>
  }
  mode: 'error' | 'warn' | 'off'
}): string {
  const fnName = diagnostics ? '__createMock' : 'createMock'
  const hasDiag = !!diagnostics

  const preamble = hasDiag
    ? `const __meta = ${JSON.stringify(diagnostics.meta)};
const __mode = ${JSON.stringify(diagnostics.mode)};

const __seen = new Set();
function __report(action, accessPath) {
  if (__mode === 'off') return;
  const key = action + ':' + accessPath;
  if (__seen.has(key)) return;
  __seen.add(key);

  const traceLines = Array.isArray(__meta.trace) && __meta.trace.length
    ? "\\n\\nTrace:\\n" + __meta.trace.map((t, i) => '  ' + (i + 1) + '. ' + String(t)).join('\\n')
    : '';

  const msg =
    '[import-protection] Mocked import used in dev client\\n\\n' +
    'Denied import: "' + __meta.specifier + '"\\n' +
    'Importer: ' + __meta.importer + '\\n' +
    'Access: ' + accessPath + ' (' + action + ')' +
    traceLines +
    '\\n\\n' + ${JSON.stringify(RUNTIME_SUGGESTION_TEXT)};

  const err = new Error(msg);
  if (__mode === 'warn') {
    console.warn(err);
  } else {
    console.error(err);
  }
}
`
    : ''

  const primitiveGetTraps = `
      if (prop === Symbol.toPrimitive) {
        return () => {
          ${hasDiag ? `__report('toPrimitive', name);` : ''}
          return '[import-protection mock]';
        };
      }
      if (prop === 'toString' || prop === 'valueOf' || prop === 'toJSON') {
        return () => {
          ${hasDiag ? `__report(String(prop), name);` : ''}
          return '[import-protection mock]';
        };
      }`

  const applyBody = hasDiag
    ? `__report('call', name + '()');
      return ${fnName}(name + '()');`
    : `return ${fnName}(name + '()');`

  const constructBody = hasDiag
    ? `__report('construct', 'new ' + name);
      return ${fnName}('new ' + name);`
    : `return ${fnName}('new ' + name);`

  const setTrap = hasDiag
    ? `
    set(_target, prop) {
      __report('set', name + '.' + String(prop));
      return true;
    },`
    : ''

  return `
${preamble}/* @__NO_SIDE_EFFECTS__ */
function ${fnName}(name) {
  const fn = function () {};
  fn.prototype.name = name;
  const children = Object.create(null);
  const proxy = new Proxy(fn, {
    get(_target, prop) {
      if (prop === '__esModule') return true;
      if (prop === 'default') return proxy;
      if (prop === 'caller') return null;
      if (prop === 'then') return (f) => Promise.resolve(f(proxy));
      if (prop === 'catch') return () => Promise.resolve(proxy);
      if (prop === 'finally') return (f) => { f(); return Promise.resolve(proxy); };${primitiveGetTraps}
      if (typeof prop === 'symbol') return undefined;
      if (!(prop in children)) {
        children[prop] = ${fnName}(name + '.' + prop);
      }
      return children[prop];
    },
    apply() {
      ${applyBody}
    },
    construct() {
      ${constructBody}
    },${setTrap}
  });
  return proxy;
}
const mock = /* @__PURE__ */ ${fnName}('mock');
export default mock;
`
}

export function loadSilentMockModule(): { code: string } {
  return { code: generateMockCode() }
}

function filterExportNames(exports: ReadonlyArray<string>): Array<string> {
  return exports.filter((n) => n.length > 0 && n !== 'default')
}

function generateExportLines(names: ReadonlyArray<string>): Array<string> {
  const lines: Array<string> = []
  const stringExports: Array<{ alias: string; name: string }> = []

  for (let i = 0; i < names.length; i++) {
    const n = names[i]!
    if (isValidExportName(n)) {
      lines.push(`export const ${n} = mock.${n};`)
    } else {
      const alias = `__tss_str_${i}`
      lines.push(`const ${alias} = mock[${JSON.stringify(n)}];`)
      stringExports.push({ alias, name: n })
    }
  }

  if (stringExports.length > 0) {
    const reexports = stringExports
      .map((s) => `${s.alias} as ${JSON.stringify(s.name)}`)
      .join(', ')
    lines.push(`export { ${reexports} };`)
  }

  return lines
}

export function generateSelfContainedMockModule(exportNames: Array<string>): {
  code: string
} {
  const mockCode = generateMockCode()
  const exportLines = generateExportLines(filterExportNames(exportNames))

  return {
    code: `${mockCode}
${exportLines.join('\n')}
`,
  }
}

export function generateDevSelfDenialModule(
  exportNames: Array<string>,
  runtimeId: string,
): { code: string } {
  const names = filterExportNames(exportNames)
  const exportLines = generateExportLines(names)

  return {
    code: `import mock from ${JSON.stringify(runtimeId)};
${exportLines.join('\n')}
export default mock;
`,
  }
}

export function loadMockEdgeModule(encodedPayload: string): { code: string } {
  let payload: { exports?: Array<string>; runtimeId?: string }

  try {
    payload = JSON.parse(fromBase64Url(encodedPayload)) as typeof payload
  } catch {
    payload = { exports: [] }
  }

  const names = filterExportNames(payload.exports ?? [])
  const runtimeId =
    typeof payload.runtimeId === 'string' && payload.runtimeId.length > 0
      ? payload.runtimeId
      : MOCK_MODULE_ID
  const exportLines = generateExportLines(names)

  return {
    code: `import mock from ${JSON.stringify(runtimeId)};
${exportLines.join('\n')}
export default mock;
`,
  }
}

export function loadMockRuntimeModule(encodedPayload: string): {
  code: string
} {
  let payload: {
    mode?: string
    env?: string
    importer?: string
    specifier?: string
    trace?: Array<unknown>
  }

  try {
    payload = JSON.parse(fromBase64Url(encodedPayload)) as typeof payload
  } catch {
    payload = {}
  }

  const mode: 'error' | 'warn' | 'off' =
    payload.mode === 'warn' || payload.mode === 'off' ? payload.mode : 'error'

  return {
    code: generateMockCode({
      meta: {
        env: String(payload.env ?? ''),
        importer: String(payload.importer ?? ''),
        specifier: String(payload.specifier ?? ''),
        trace: Array.isArray(payload.trace) ? payload.trace : [],
      },
      mode,
    }),
  }
}

const MARKER_MODULE_RESULT = { code: 'export {}' } as const

export function loadMarkerModule(): { code: string } {
  return MARKER_MODULE_RESULT
}

export {
  MARKER_PREFIX,
  MOCK_BUILD_PREFIX,
  MOCK_EDGE_PREFIX,
  MOCK_MODULE_ID,
  MOCK_RUNTIME_PREFIX,
}
