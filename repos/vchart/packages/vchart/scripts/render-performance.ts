import { spawn, execFileSync, type ChildProcessWithoutNullStreams } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import net from 'net';
import os from 'os';
import path from 'path';

type PerfSample = {
  totalMs: number;
  createMs: number;
  renderMs: number;
  releaseMs: number;
  longTaskCount: number;
  longTaskMs: number;
  phaseMs?: Record<string, number>;
};

type PerfResult = {
  userAgent: string;
  options: {
    samples: number;
    warmup: number;
    scenarios: string[];
  };
  scenarios: Array<{
    name: string;
    samples: PerfSample[];
  }>;
};

type TargetResult = {
  name: string;
  root: string;
  branch: string;
  commit: string;
  vrenderLinks: Record<string, string>;
  metrics: PerfResult;
};

type CliOptions = {
  samples: number;
  warmup: number;
  compare?: string;
  baseline?: string;
  output?: string;
  scenarios?: string[];
  chrome?: string;
  keepWorktree: boolean;
};

type Stats = {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdev: number;
};

const DEFAULT_SAMPLES = 7;
const DEFAULT_WARMUP = 2;
const DEFAULT_SCENARIOS = [
  'basic-bar',
  'basic-line',
  'large-line',
  'scatter-10k',
  'text-heavy-bar',
  'multi-chart-grid'
];
const GENERATED_MARKER = '// VChart generated render performance runner. Do not edit.';

const htmlSource = `${GENERATED_MARKER}
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1.0" />
    <title>VChart Render Performance</title>
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }
      #chart {
        width: 1280px;
        height: 900px;
      }
    </style>
  </head>
  <body>
    <div id="chart"></div>
    <script type="module" src="./perf-runner.generated.page.js"></script>
  </body>
</html>
`;

const createPageSource = (vchartEntry: string) => `${GENERATED_MARKER}
import VChart from '${vchartEntry}';

const waitFrame = () =>
  new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

const makeRandom = seed => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const longTasks = [];
try {
  new PerformanceObserver(list => {
    longTasks.push(...list.getEntries());
  }).observe({ entryTypes: ['longtask'] });
} catch (_err) {
  // Long task entries are best-effort. Browser/headless support varies.
}

const baseAxes = [
  { orient: 'left', visible: false },
  { orient: 'bottom', visible: false }
];

const createContainer = (root, width = 800, height = 420) => {
  const dom = document.createElement('div');
  dom.style.width = \`\${width}px\`;
  dom.style.height = \`\${height}px\`;
  dom.style.display = 'inline-block';
  dom.style.verticalAlign = 'top';
  root.appendChild(dom);
  return dom;
};

const createPhaseRecorder = () => {
  const starts = {};
  const durations = {};
  const begin = name => {
    starts[name] = performance.now();
  };
  const end = name => {
    if (starts[name] == null) {
      return;
    }
    durations[name] = (durations[name] || 0) + performance.now() - starts[name];
    starts[name] = null;
  };

  return {
    durations,
    hook: {
      beforeInitializeChart: () => begin('initializeChart'),
      afterInitializeChart: () => end('initializeChart'),
      beforeCompileToVGrammar: () => begin('compileToVGrammar'),
      afterCompileToVGrammar: () => end('compileToVGrammar'),
      beforeRegionCompile: () => begin('regionCompile'),
      afterRegionCompile: () => end('regionCompile'),
      beforeSeriesCompile: () => begin('seriesCompile'),
      afterSeriesCompile: () => end('seriesCompile'),
      beforeComponentCompile: () => begin('componentCompile'),
      afterComponentCompile: () => end('componentCompile'),
      beforeLayoutWithSceneGraph: () => begin('layoutWithSceneGraph'),
      afterLayoutWithSceneGraph: () => end('layoutWithSceneGraph'),
      beforeDoRender: () => begin('doRender'),
      beforeVRenderDraw: () => begin('vRenderDraw'),
      afterVRenderDraw: () => {
        end('vRenderDraw');
        end('doRender');
      }
    }
  };
};

const renderOneChart = (spec, root, width = 800, height = 420) => {
  const dom = createContainer(root, width, height);
  const phaseRecorder = createPhaseRecorder();
  const createStart = performance.now();
  const chart = new VChart(spec, {
    dom,
    mode: 'desktop-browser',
    animation: false,
    performanceHook: phaseRecorder.hook,
    onError: err => {
      throw err;
    }
  });
  const createEnd = performance.now();
  chart.renderSync();
  const renderEnd = performance.now();
  chart.release();
  const releaseEnd = performance.now();
  return {
    createMs: createEnd - createStart,
    renderMs: renderEnd - createEnd,
    releaseMs: releaseEnd - renderEnd,
    phaseMs: phaseRecorder.durations
  };
};

const basicBarSpec = () => ({
  type: 'bar',
  width: 800,
  height: 420,
  padding: 12,
  animation: false,
  data: {
    values: Array.from({ length: 80 }, (_, index) => ({
      category: \`category-\${index}\`,
      value: (index * 37) % 113
    }))
  },
  xField: 'category',
  yField: 'value',
  axes: baseAxes
});

const basicLineSpec = () => {
  const values = [];
  for (let series = 0; series < 4; series++) {
    for (let index = 0; index < 240; index++) {
      values.push({
        series: \`s-\${series}\`,
        x: index,
        y: 50 + Math.sin(index / 12 + series) * 20 + series * 12
      });
    }
  }
  return {
    type: 'line',
    width: 800,
    height: 420,
    animation: false,
    data: { values },
    xField: 'x',
    yField: 'y',
    seriesField: 'series',
    point: { visible: false },
    axes: baseAxes
  };
};

const largeLineSpec = () => {
  const values = [];
  const random = makeRandom(17);
  for (let series = 0; series < 7; series++) {
    for (let index = 0; index < 1440; index++) {
      values.push({
        series: \`s-\${series}\`,
        x: index,
        y: 500 + Math.sin(index / 32 + series) * 120 + random() * 24
      });
    }
  }
  return {
    type: 'line',
    width: 1000,
    height: 520,
    animation: false,
    data: { values },
    xField: 'x',
    yField: 'y',
    seriesField: 'series',
    point: { visible: false },
    legends: { visible: false },
    axes: baseAxes
  };
};

const scatter10kSpec = () => {
  const random = makeRandom(29);
  return {
    type: 'scatter',
    width: 900,
    height: 480,
    animation: false,
    data: {
      values: Array.from({ length: 10000 }, (_, index) => ({
        x: index % 1000,
        y: Math.floor(index / 10) + random() * 20,
        size: 4 + random() * 6
      }))
    },
    xField: 'x',
    yField: 'y',
    sizeField: 'size',
    size: { range: [2, 8] },
    axes: baseAxes
  };
};

const textHeavyBarSpec = () => ({
  type: 'bar',
  width: 1000,
  height: 520,
  animation: false,
  data: {
    values: Array.from({ length: 360 }, (_, index) => ({
      category: \`long-category-label-\${index}\`,
      value: 20 + ((index * 53) % 180)
    }))
  },
  xField: 'category',
  yField: 'value',
  label: {
    visible: true,
    formatMethod: (_text, datum) => \`value-\${datum.value}-category-\${datum.category}\`
  },
  axes: [
    { orient: 'left', visible: true, label: { visible: true } },
    { orient: 'bottom', visible: true, label: { visible: true, autoHide: false, autoRotate: false } }
  ]
});

const smallSpec = (type, index) => {
  const values = Array.from({ length: 8 }, (_, datumIndex) => ({
    category: \`c-\${datumIndex}\`,
    value: 10 + ((index * 17 + datumIndex * 23) % 90)
  }));
  if (type === 'pie') {
    return {
      type,
      width: 120,
      height: 90,
      animation: false,
      data: { values },
      valueField: 'value',
      categoryField: 'category',
      legends: { visible: false }
    };
  }
  return {
    type,
    width: 120,
    height: 90,
    animation: false,
    data: { values },
    xField: 'category',
    yField: 'value',
    point: { visible: type !== 'line' },
    axes: baseAxes
  };
};

const scenarios = {
  'basic-bar': {
    name: 'basic-bar',
    run: root => renderOneChart(basicBarSpec(), root)
  },
  'basic-line': {
    name: 'basic-line',
    run: root => renderOneChart(basicLineSpec(), root)
  },
  'large-line': {
    name: 'large-line',
    run: root => renderOneChart(largeLineSpec(), root, 1000, 520)
  },
  'scatter-10k': {
    name: 'scatter-10k',
    run: root => renderOneChart(scatter10kSpec(), root, 900, 480)
  },
  'text-heavy-bar': {
    name: 'text-heavy-bar',
    run: root => renderOneChart(textHeavyBarSpec(), root, 1000, 520)
  },
  'multi-chart-grid': {
    name: 'multi-chart-grid',
    run: root => {
      root.style.width = '1280px';
      const types = ['bar', 'line', 'scatter', 'pie'];
      const charts = [];
      const phaseRecorder = createPhaseRecorder();
      const createStart = performance.now();
      for (let index = 0; index < 120; index++) {
        const dom = createContainer(root, 120, 90);
        dom.style.margin = '1px';
        charts.push(
          new VChart(smallSpec(types[index % types.length], index), {
            dom,
            mode: 'desktop-browser',
            animation: false,
            performanceHook: phaseRecorder.hook
          })
        );
      }
      const createEnd = performance.now();
      charts.forEach(chart => chart.renderSync());
      const renderEnd = performance.now();
      charts.forEach(chart => chart.release());
      const releaseEnd = performance.now();
      return {
        createMs: createEnd - createStart,
        renderMs: renderEnd - createEnd,
        releaseMs: releaseEnd - renderEnd,
        phaseMs: phaseRecorder.durations
      };
    }
  }
};

const selectedLongTasks = (start, end) =>
  longTasks.filter(entry => entry.startTime >= start && entry.startTime <= end);

window.__runVChartRenderPerf = async (options = {}) => {
  const samples = options.samples ?? 7;
  const warmup = options.warmup ?? 2;
  const scenarioNames = options.scenarios?.length ? options.scenarios : Object.keys(scenarios);
  const root = document.getElementById('chart');
  root.style.width = '1280px';
  root.style.height = '900px';
  root.style.overflow = 'hidden';

  const results = [];
  for (const scenarioName of scenarioNames) {
    const scenario = scenarios[scenarioName];
    if (!scenario) {
      throw new Error(\`Unknown render perf scenario: \${scenarioName}\`);
    }
    const scenarioSamples = [];
    for (let index = 0; index < warmup + samples; index++) {
      root.innerHTML = '';
      if (typeof window.gc === 'function') {
        window.gc();
      }
      await waitFrame();

      const start = performance.now();
      const runResult = await scenario.run(root);
      await waitFrame();
      const end = performance.now();
      const sampleLongTasks = selectedLongTasks(start, end);

      if (index >= warmup) {
        scenarioSamples.push({
          totalMs: end - start,
          createMs: runResult.createMs,
          renderMs: runResult.renderMs,
          releaseMs: runResult.releaseMs,
          longTaskCount: sampleLongTasks.length,
          longTaskMs: sampleLongTasks.reduce((sum, entry) => sum + entry.duration, 0),
          phaseMs: runResult.phaseMs
        });
      }
    }
    results.push({ name: scenario.name, samples: scenarioSamples });
  }

  root.innerHTML = '';
  return {
    userAgent: navigator.userAgent,
    options: {
      samples,
      warmup,
      scenarios: scenarioNames
    },
    scenarios: results
  };
};

window.__vchartRenderPerfReady = true;
`;

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    samples: DEFAULT_SAMPLES,
    warmup: DEFAULT_WARMUP,
    keepWorktree: false
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--samples' && next) {
      options.samples = Number(next);
      index++;
    } else if (arg === '--warmup' && next) {
      options.warmup = Number(next);
      index++;
    } else if (arg === '--compare' && next) {
      options.compare = next;
      index++;
    } else if (arg === '--baseline' && next) {
      options.baseline = path.resolve(next);
      index++;
    } else if (arg === '--output' && next) {
      options.output = path.resolve(next);
      index++;
    } else if (arg === '--scenarios' && next) {
      options.scenarios = next
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
      index++;
    } else if (arg === '--chrome' && next) {
      options.chrome = path.resolve(next);
      index++;
    } else if (arg === '--keep-worktree') {
      options.keepWorktree = true;
    } else if (arg === '--help') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(options.samples) || options.samples < 1) {
    throw new Error('--samples must be a positive number');
  }
  if (!Number.isFinite(options.warmup) || options.warmup < 0) {
    throw new Error('--warmup must be a non-negative number');
  }
  return options;
}

function printHelp() {
  console.log(`Usage:
  npm run perf:render -- [options]

Options:
  --samples <n>             Measured samples per scenario. Default: ${DEFAULT_SAMPLES}
  --warmup <n>              Warmup runs per scenario. Default: ${DEFAULT_WARMUP}
  --compare <branch-ish>    Create a temporary checkout and compare against it.
  --baseline <path>         Compare against an existing repository checkout.
  --scenarios <a,b,c>       Comma-separated scenario names.
  --output <path>           JSON result path. Default: common/temp/vchart-render-performance/*.json
  --chrome <path>           Chrome executable path.
  --keep-worktree           Keep temporary compare checkout for inspection.

Scenarios:
  ${DEFAULT_SCENARIOS.join(', ')}
`);
}

function repoRoot(start = process.cwd()) {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: start,
    encoding: 'utf8'
  }).trim();
}

function gitText(cwd: string, args: string[]) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  }).trim();
}

function branchName(cwd: string) {
  return gitText(cwd, ['branch', '--show-current']) || 'detached';
}

function findChrome(explicit?: string) {
  const candidates = [
    explicit,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    process.env.CHROME_BIN
  ].filter(Boolean) as string[];
  const found = candidates.find(candidate => fs.existsSync(candidate));
  if (!found) {
    throw new Error('Cannot find Chrome. Pass --chrome <path> or set CHROME_BIN.');
  }
  return found;
}

function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to allocate a TCP port')));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http
      .get(url, response => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', chunk => {
          body += chunk;
        });
        response.on('end', () => {
          if ((response.statusCode ?? 500) >= 400) {
            reject(new Error(`HTTP ${response.statusCode}: ${url}`));
          } else {
            resolve(body);
          }
        });
      })
      .on('error', reject);
  });
}

async function waitForHttp(url: string, timeoutMs: number) {
  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      await httpGet(url);
      return;
    } catch (err) {
      lastError = err;
      await delay(250);
    }
  }
  throw new Error(`Timed out waiting for ${url}: ${(lastError as Error | undefined)?.message ?? 'no response'}`);
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function writeGeneratedFile(file: string, content: string, cleanupFiles: string[]) {
  if (fs.existsSync(file)) {
    const existing = fs.readFileSync(file, 'utf8');
    if (!existing.startsWith(GENERATED_MARKER)) {
      throw new Error(`Refusing to overwrite non-generated file: ${file}`);
    }
  }
  fs.writeFileSync(file, content);
  cleanupFiles.push(file);
}

function toBrowserFilePath(file: string) {
  return `/@fs/${file.split(path.sep).join('/')}`;
}

function ensureTargetInstall(name: string, targetRoot: string, currentRoot: string) {
  const packageNodeModules = path.join(targetRoot, 'packages/vchart/node_modules');
  if (fs.existsSync(packageNodeModules)) {
    return;
  }

  if (targetRoot === currentRoot) {
    throw new Error(`Missing packages/vchart/node_modules in current checkout. Run rush install first.`);
  }

  console.log(`Installing dependencies for render perf target "${name}" with its own Rush lockfile...`);
  const nodePath = preferredNodePath();
  const env = forceCurrentNodeEnv(
    {
      ...process.env,
      CI: '1'
    },
    nodePath
  );
  execFileSync(nodePath, ['common/scripts/install-run-rush.js', 'install', '--ignore-hooks'], {
    cwd: targetRoot,
    stdio: 'inherit',
    env
  });
}

function prepareTarget(targetRoot: string) {
  const packageRoot = path.join(targetRoot, 'packages/vchart');
  const runtimeRoot = path.join(packageRoot, '__tests__/runtime/browser');
  const cleanupFiles: string[] = [];

  if (!fs.existsSync(packageRoot)) {
    throw new Error(`Invalid VChart checkout: ${targetRoot}`);
  }

  writeGeneratedFile(path.join(runtimeRoot, 'perf-runner.generated.html'), htmlSource, cleanupFiles);
  writeGeneratedFile(
    path.join(runtimeRoot, 'perf-runner.generated.page.js'),
    createPageSource(toBrowserFilePath(path.join(packageRoot, 'src/index.ts'))),
    cleanupFiles
  );
  writeGeneratedFile(
    path.join(runtimeRoot, 'vite.config.perf.generated.js'),
    `${GENERATED_MARKER}
import base from './vite.config.js';

export default {
  ...base,
  server: {
    ...base.server,
    host: '127.0.0.1',
    open: false
  }
};
`,
    cleanupFiles
  );

  const localConfig = path.join(runtimeRoot, 'vite.config.local.ts');
  if (!fs.existsSync(localConfig)) {
    writeGeneratedFile(
      localConfig,
      `${GENERATED_MARKER}
export default {
  port: 3000
};
`,
      cleanupFiles
    );
  }

  return {
    packageRoot,
    runtimeRoot,
    cleanup() {
      cleanupFiles.forEach(file => {
        if (fs.existsSync(file) && fs.readFileSync(file, 'utf8').startsWith(GENERATED_MARKER)) {
          fs.unlinkSync(file);
        }
      });
    }
  };
}

async function runTarget(
  name: string,
  targetRoot: string,
  currentRoot: string,
  chromePath: string,
  options: CliOptions
): Promise<TargetResult> {
  ensureTargetInstall(name, targetRoot, currentRoot);
  const prepared = prepareTarget(targetRoot);
  const vitePort = await freePort();
  const debugPort = await freePort();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), `vchart-render-perf-chrome-${sanitize(name)}-`));
  const viteBin = path.join(prepared.packageRoot, 'node_modules/.bin/vite');
  let vite: ChildProcessWithoutNullStreams | undefined;
  let chrome: ChildProcessWithoutNullStreams | undefined;

  try {
    vite = spawn(
      viteBin,
      [
        'serve',
        prepared.runtimeRoot,
        '--config',
        path.join(prepared.runtimeRoot, 'vite.config.perf.generated.js'),
        '--host',
        '127.0.0.1',
        '--port',
        String(vitePort),
        '--strictPort',
        '--clearScreen',
        'false'
      ],
      {
        cwd: prepared.packageRoot,
        env: { ...process.env, BROWSER: 'none' },
        stdio: ['ignore', 'pipe', 'pipe']
      }
    );
    pipeProcess(vite, `[vite:${name}]`);

    const pageUrl = `http://127.0.0.1:${vitePort}/perf-runner.generated.html`;
    await waitForHttp(pageUrl, 60000);

    chrome = spawn(
      chromePath,
      [
        '--headless=new',
        `--remote-debugging-port=${debugPort}`,
        `--user-data-dir=${profileDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--js-flags=--expose-gc',
        pageUrl
      ],
      {
        cwd: prepared.packageRoot,
        stdio: ['ignore', 'pipe', 'pipe']
      }
    );
    pipeProcess(chrome, `[chrome:${name}]`);

    const wsUrl = await waitForDevtoolsPage(debugPort, pageUrl, 60000);
    const cdp = await DevtoolsClient.connect(wsUrl);
    try {
      await cdp.send('Runtime.enable');
      await cdp.send('Log.enable');
      await waitForReady(cdp);
      const metrics = await evaluatePerf(cdp, options);
      return {
        name,
        root: targetRoot,
        branch: branchName(targetRoot),
        commit: gitText(targetRoot, ['rev-parse', 'HEAD']),
        vrenderLinks: getVRenderLinks(path.join(targetRoot, 'packages/vchart')),
        metrics
      };
    } finally {
      cdp.close();
    }
  } finally {
    await killProcess(chrome);
    await killProcess(vite);
    prepared.cleanup();
    fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

function pipeProcess(child: ChildProcessWithoutNullStreams, prefix: string) {
  const isChrome = prefix.startsWith('[chrome:');
  child.stdout.on('data', chunk => {
    const text = chunk.toString();
    if (!isChrome && /error|failed|exception/i.test(text)) {
      process.stderr.write(`${prefix} ${text}`);
    }
  });
  child.stderr.on('data', chunk => {
    const text = chunk.toString();
    if (isChrome && !process.env.VCHART_PERF_VERBOSE_CHROME) {
      return;
    }
    if (!/DevTools listening|Local:|Network:/.test(text)) {
      process.stderr.write(`${prefix} ${text}`);
    }
  });
}

function killProcess(child?: ChildProcessWithoutNullStreams) {
  return new Promise<void>(resolve => {
    if (!child || child.killed || child.exitCode !== null) {
      resolve();
      return;
    }
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
    setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
      resolve();
    }, 2000);
  });
}

async function waitForDevtoolsPage(debugPort: number, pageUrl: string, timeoutMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const pages = JSON.parse(await httpGet(`http://127.0.0.1:${debugPort}/json/list`)) as Array<{
        url: string;
        webSocketDebuggerUrl?: string;
      }>;
      const page = pages.find(item => item.url === pageUrl || item.url.startsWith(pageUrl));
      if (page?.webSocketDebuggerUrl) {
        return page.webSocketDebuggerUrl;
      }
    } catch (_err) {
      // Chrome may not have opened the debugging endpoint yet.
    }
    await delay(250);
  }
  throw new Error('Timed out waiting for Chrome DevTools page');
}

async function waitForReady(cdp: DevtoolsClient) {
  const start = Date.now();
  while (Date.now() - start < 120000) {
    const result = await cdp.send('Runtime.evaluate', {
      expression: 'Boolean(window.__vchartRenderPerfReady)',
      returnByValue: true
    });
    if (result?.result?.value === true) {
      return;
    }
    await delay(250);
  }
  const diagnostics = await cdp.send('Runtime.evaluate', {
    expression: `JSON.stringify({
      href: location.href,
      title: document.title,
      body: document.body ? document.body.innerText.slice(0, 4000) : '',
      readyState: document.readyState,
      scripts: Array.from(document.scripts).map(script => script.src)
    })`,
    returnByValue: true
  });
  throw new Error(
    `Timed out waiting for perf page readiness: ${diagnostics?.result?.value ?? ''}\n` +
      `DevTools events: ${JSON.stringify(cdp.getRecentEvents())}`
  );
}

async function evaluatePerf(cdp: DevtoolsClient, options: CliOptions): Promise<PerfResult> {
  const result = await cdp.send(
    'Runtime.evaluate',
    {
      expression: `window.__runVChartRenderPerf(${JSON.stringify({
        samples: options.samples,
        warmup: options.warmup,
        scenarios: options.scenarios ?? DEFAULT_SCENARIOS
      })})`,
      awaitPromise: true,
      returnByValue: true
    },
    10 * 60 * 1000
  );
  if (result.exceptionDetails) {
    throw new Error(`Perf page evaluation failed: ${JSON.stringify(result.exceptionDetails)}`);
  }
  return result.result.value as PerfResult;
}

class DevtoolsClient {
  private id = 0;
  private buffer = Buffer.alloc(0);
  private readonly recentEvents: any[] = [];
  private readonly pending = new Map<
    number,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();

  private constructor(private readonly socket: net.Socket) {
    socket.on('data', chunk => this.onData(chunk));
    socket.on('error', err => {
      this.pending.forEach(item => item.reject(err));
      this.pending.clear();
    });
  }

  static connect(wsUrl: string) {
    const url = new URL(wsUrl);
    return new Promise<DevtoolsClient>((resolve, reject) => {
      const socket = net.connect(Number(url.port), url.hostname);
      const key = crypto.randomBytes(16).toString('base64');
      let handshake = Buffer.alloc(0);

      socket.once('error', reject);
      socket.on('connect', () => {
        socket.write(
          [
            `GET ${url.pathname}${url.search} HTTP/1.1`,
            `Host: ${url.host}`,
            'Upgrade: websocket',
            'Connection: Upgrade',
            `Sec-WebSocket-Key: ${key}`,
            'Sec-WebSocket-Version: 13',
            '',
            ''
          ].join('\r\n')
        );
      });

      const onHandshakeData = (chunk: Buffer) => {
        handshake = Buffer.concat([handshake, chunk]);
        const end = handshake.indexOf('\r\n\r\n');
        if (end === -1) {
          return;
        }
        const header = handshake.slice(0, end).toString('utf8');
        if (!header.includes('101')) {
          reject(new Error(`DevTools WebSocket handshake failed: ${header}`));
          socket.destroy();
          return;
        }
        socket.off('data', onHandshakeData);
        const client = new DevtoolsClient(socket);
        const rest = handshake.slice(end + 4);
        if (rest.length) {
          client.onData(rest);
        }
        resolve(client);
      };
      socket.on('data', onHandshakeData);
    });
  }

  send(method: string, params: Record<string, unknown> = {}, timeoutMs = 120000) {
    const id = ++this.id;
    this.socket.write(encodeFrame(JSON.stringify({ id, method, params })));
    return new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`DevTools command timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
    });
  }

  close() {
    this.pending.forEach(item => {
      clearTimeout(item.timer);
      item.reject(new Error('DevTools client closed'));
    });
    this.pending.clear();
    this.socket.end();
  }

  getRecentEvents() {
    return this.recentEvents.slice(-20);
  }

  private onData(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const frame = decodeFrame(this.buffer);
      if (!frame) {
        return;
      }
      this.buffer = this.buffer.slice(frame.bytes);
      if (frame.opcode === 8) {
        this.close();
        return;
      }
      if (frame.opcode !== 1) {
        continue;
      }
      const message = JSON.parse(frame.payload.toString('utf8'));
      if (!message.id) {
        if (message.method === 'Runtime.exceptionThrown' || message.method === 'Log.entryAdded') {
          this.recentEvents.push(message);
        }
        continue;
      }
      const pending = this.pending.get(message.id);
      if (!pending) {
        continue;
      }
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      message.error ? pending.reject(new Error(JSON.stringify(message.error))) : pending.resolve(message.result);
    }
  }
}

function encodeFrame(text: string) {
  const payload = Buffer.from(text);
  const mask = crypto.randomBytes(4);
  const length = payload.length;
  const headerLength = length < 126 ? 2 : length < 65536 ? 4 : 10;
  const frame = Buffer.alloc(headerLength + 4 + length);

  frame[0] = 0x81;
  if (length < 126) {
    frame[1] = 0x80 | length;
  } else if (length < 65536) {
    frame[1] = 0x80 | 126;
    frame.writeUInt16BE(length, 2);
  } else {
    frame[1] = 0x80 | 127;
    frame.writeBigUInt64BE(BigInt(length), 2);
  }
  mask.copy(frame, headerLength);
  for (let index = 0; index < length; index++) {
    frame[headerLength + 4 + index] = payload[index] ^ mask[index % 4];
  }
  return frame;
}

function decodeFrame(buffer: Buffer) {
  if (buffer.length < 2) {
    return undefined;
  }
  const opcode = buffer[0] & 0x0f;
  const masked = Boolean(buffer[1] & 0x80);
  let length = buffer[1] & 0x7f;
  let offset = 2;

  if (length === 126) {
    if (buffer.length < offset + 2) {
      return undefined;
    }
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    if (buffer.length < offset + 8) {
      return undefined;
    }
    length = Number(buffer.readBigUInt64BE(offset));
    offset += 8;
  }

  const maskOffset = offset;
  if (masked) {
    offset += 4;
  }
  if (buffer.length < offset + length) {
    return undefined;
  }

  let payload = buffer.slice(offset, offset + length);
  if (masked) {
    const mask = buffer.slice(maskOffset, maskOffset + 4);
    payload = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]));
  }

  return {
    opcode,
    payload,
    bytes: offset + length
  };
}

function getVRenderLinks(packageRoot: string) {
  const packages = ['vrender', 'vrender-core', 'vrender-kits', 'vrender-components', 'vrender-animate'];
  const links: Record<string, string> = {};
  packages.forEach(name => {
    const packagePath = path.join(packageRoot, 'node_modules/@visactor', name);
    try {
      links[`@visactor/${name}`] = fs.realpathSync(packagePath);
    } catch (_err) {
      links[`@visactor/${name}`] = 'unresolved';
    }
  });
  return links;
}

function ensureLocalExclude(root: string, pattern: string) {
  const excludePath = path.join(root, '.git/info/exclude');
  const existing = fs.existsSync(excludePath) ? fs.readFileSync(excludePath, 'utf8') : '';
  if (!existing.split(/\r?\n/).includes(pattern)) {
    fs.appendFileSync(excludePath, `${existing.endsWith('\n') ? '' : '\n'}${pattern}\n`);
  }
}

function createCompareCheckout(root: string, branchish: string) {
  ensureLocalExclude(root, '.vchart-perf-worktrees/');
  const checkoutBase = path.join(root, '.vchart-perf-worktrees');
  fs.mkdirSync(checkoutBase, { recursive: true });
  const checkoutRoot = fs.mkdtempSync(path.join(checkoutBase, `${sanitize(branchish)}-`));
  fs.rmSync(checkoutRoot, { recursive: true, force: true });
  execFileSync('git', ['clone', '--shared', '--branch', branchish, root, checkoutRoot], {
    cwd: root,
    stdio: 'inherit'
  });
  return checkoutRoot;
}

function preferredNodePath() {
  const nvmNode = process.env.NVM_BIN ? path.join(process.env.NVM_BIN, 'node') : undefined;
  return nvmNode && fs.existsSync(nvmNode) ? nvmNode : process.execPath;
}

function forceCurrentNodeEnv(env: NodeJS.ProcessEnv, nodePath = preferredNodePath()) {
  const nodeDir = path.dirname(nodePath);
  return {
    ...env,
    npm_node_execpath: nodePath,
    NODE: nodePath,
    PATH: `${nodeDir}${path.delimiter}${env.PATH ?? ''}`
  };
}

function sanitize(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function stat(values: number[]): Stats {
  const sorted = values.slice().sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean,
    median: sorted[Math.floor(sorted.length / 2)],
    stdev: Math.sqrt(variance)
  };
}

function summarize(result: TargetResult) {
  const summary: Record<string, Record<string, Stats>> = {};
  result.metrics.scenarios.forEach(scenario => {
    summary[scenario.name] = {
      totalMs: stat(scenario.samples.map(sample => sample.totalMs)),
      renderMs: stat(scenario.samples.map(sample => sample.renderMs)),
      longTaskMs: stat(scenario.samples.map(sample => sample.longTaskMs))
    };
  });
  return summary;
}

function printComparison(results: TargetResult[]) {
  const baseline = summarize(results[0]);
  const current = summarize(results[results.length - 1]);
  console.log('\nRender Performance Summary (median ms)');
  console.log('scenario            baseline total  current total  delta      baseline render  current render');
  console.log('----------------------------------------------------------------------------------------------');
  Object.keys(current).forEach(name => {
    const baseTotal = baseline[name]?.totalMs.median;
    const currentTotal = current[name]?.totalMs.median;
    const baseRender = baseline[name]?.renderMs.median;
    const currentRender = current[name]?.renderMs.median;
    const delta = baseTotal ? ((currentTotal - baseTotal) / baseTotal) * 100 : 0;
    console.log(
      [
        name.padEnd(19),
        formatNumber(baseTotal).padStart(14),
        formatNumber(currentTotal).padStart(14),
        `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`.padStart(9),
        formatNumber(baseRender).padStart(16),
        formatNumber(currentRender).padStart(15)
      ].join(' ')
    );
  });
}

function printSingle(result: TargetResult) {
  const summary = summarize(result);
  console.log('\nRender Performance Summary (median ms)');
  console.log('scenario            total    render   longTask');
  console.log('------------------------------------------------');
  Object.keys(summary).forEach(name => {
    console.log(
      [
        name.padEnd(19),
        formatNumber(summary[name].totalMs.median).padStart(8),
        formatNumber(summary[name].renderMs.median).padStart(8),
        formatNumber(summary[name].longTaskMs.median).padStart(9)
      ].join(' ')
    );
  });
}

function formatNumber(value: number | undefined) {
  return value === undefined ? 'n/a' : value.toFixed(2);
}

function writeOutput(root: string, output: string | undefined, payload: unknown) {
  const out =
    output ??
    path.join(
      root,
      'common/temp/vchart-render-performance',
      `render-performance-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(payload, null, 2));
  return out;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const packageRoot = process.cwd();
  const root = repoRoot(packageRoot);
  const chromePath = findChrome(options.chrome);
  const targets: Array<{ name: string; root: string; temporary?: boolean }> = [];

  if (options.baseline) {
    targets.push({ name: path.basename(options.baseline), root: options.baseline });
  } else if (options.compare) {
    targets.push({
      name: options.compare,
      root: createCompareCheckout(root, options.compare),
      temporary: true
    });
  }
  targets.push({ name: branchName(root) || 'current', root });

  const results: TargetResult[] = [];
  try {
    for (const target of targets) {
      console.log(`\nRunning render perf target "${target.name}" at ${target.root}`);
      results.push(await runTarget(target.name, target.root, root, chromePath, options));
    }
  } finally {
    for (const target of targets) {
      if (target.temporary && !options.keepWorktree) {
        try {
          fs.rmSync(target.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        } catch (err) {
          console.warn(`Failed to remove temporary worktree ${target.root}: ${(err as Error).message}`);
        }
      }
    }
  }

  results.length > 1 ? printComparison(results) : printSingle(results[0]);

  const out = writeOutput(root, options.output, {
    createdAt: new Date().toISOString(),
    options,
    results,
    summaries: results.map(result => ({
      name: result.name,
      summary: summarize(result)
    }))
  });
  console.log(`\nWrote JSON results to ${out}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
