import path from 'node:path';
import fs from 'node:fs';

const DEVTOOLS_DB_DIR = '.devtools';
const DEVTOOLS_DB_FILE = 'generations.json';
// Cap how many bytes we read from a remote database file. Guards against a
// synchronous hang / OOM if the file is enormous.
const MAX_DB_BYTES = 100 * 1024 * 1024; // 100 MB
const DB_DIR = path.join(process.cwd(), DEVTOOLS_DB_DIR);
const DB_PATH = path.join(DB_DIR, DEVTOOLS_DB_FILE);
const DEVTOOLS_PORT = process.env.AI_SDK_DEVTOOLS_PORT
  ? parseInt(process.env.AI_SDK_DEVTOOLS_PORT)
  : 4983;

/**
 * Notify the devtools server that data has changed.
 * Fire-and-forget: doesn't block, ignores errors if server isn't running.
 */
const notifyServer = (event: 'run' | 'step' | 'step-update' | 'clear') => {
  notifyServerAsync(event);
};

/**
 * Notify the devtools server and wait for the request to complete.
 * Used during process cleanup to ensure notifications are sent before exit.
 */
export const notifyServerAsync = async (
  event: 'run' | 'step' | 'step-update' | 'clear',
): Promise<void> => {
  try {
    await fetch(`http://localhost:${DEVTOOLS_PORT}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, timestamp: Date.now(), dbPath: DB_PATH }),
    });
  } catch {
    // Ignore errors - server might not be running
  }
};

export interface Run {
  id: string;
  started_at: string;
  parent_run_id: string | null;
  parent_step_id: string | null;
  function_id: string | null;
}

export interface Step {
  id: string;
  run_id: string;
  step_number: number;
  type: 'generate' | 'stream';
  model_id: string;
  provider: string | null;
  started_at: string;
  duration_ms: number | null;
  input: string;
  output: string | null;
  usage: string | null;
  error: string | null;
  raw_request: string | null;
  raw_response: string | null;
  raw_chunks: string | null;
  provider_options: string | null;
}

export interface StepResult {
  duration_ms: number;
  output: string | null;
  usage: string | null;
  error: string | null;
  raw_request?: string | null;
  raw_response?: string | null;
  raw_chunks?: string | null;
}

interface Database {
  runs: Run[];
  steps: Step[];
}

/**
 * Ensure .devtools is in .gitignore.
 * Only writes if .gitignore exists and doesn't already contain .devtools.
 */
const ensureGitignore = (): void => {
  const gitignorePath = path.join(process.cwd(), '.gitignore');

  if (!fs.existsSync(gitignorePath)) {
    return;
  }

  const content = fs.readFileSync(gitignorePath, 'utf-8');
  const lines = content.split('\n');

  // Check if .devtools is already ignored (exact match or with trailing slash)
  const alreadyIgnored = lines.some(
    line => line.trim() === '.devtools' || line.trim() === '.devtools/',
  );

  if (!alreadyIgnored) {
    const newContent = content.endsWith('\n')
      ? `${content}.devtools\n`
      : `${content}\n.devtools\n`;
    fs.writeFileSync(gitignorePath, newContent);
  }
};

const readDb = (): Database => {
  try {
    if (fs.existsSync(DB_PATH)) {
      const content = fs.readFileSync(DB_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // If file is corrupted, start fresh
  }
  return { runs: [], steps: [] };
};

const writeDb = (db: Database): void => {
  const isFirstRun = !fs.existsSync(DB_DIR);

  if (isFirstRun) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    ensureGitignore();
  }

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
};

// In-memory cache for performance
let dbCache: Database | null = null;

const getDb = (): Database => {
  if (!dbCache) {
    dbCache = readDb();
  }
  return dbCache;
};

const saveDb = (db: Database): void => {
  dbCache = db;
  writeDb(db);
};

const normalizeDevtoolsDbPath = (dbPath: string): string | undefined => {
  const resolvedPath = path.resolve(dbPath);
  const dbDir = path.dirname(resolvedPath);

  if (
    path.basename(resolvedPath) !== DEVTOOLS_DB_FILE ||
    path.basename(dbDir) !== DEVTOOLS_DB_DIR
  ) {
    return undefined;
  }

  return resolvedPath;
};

export const validateRemoteDbPath = (dbPath: unknown): string | undefined => {
  if (typeof dbPath !== 'string') {
    return undefined;
  }

  const normalizedPath = normalizeDevtoolsDbPath(dbPath);
  if (!normalizedPath) {
    return undefined;
  }

  try {
    const stats = fs.statSync(normalizedPath);
    if (!stats.isFile() || stats.size > MAX_DB_BYTES) {
      return undefined;
    }

    const realPath = fs.realpathSync(normalizedPath);
    return normalizeDevtoolsDbPath(realPath);
  } catch {
    return undefined;
  }
};

/**
 * Reload the database from disk.
 * Used by the viewer server to pick up changes made by the middleware/integration.
 * When a valid remote dbPath is provided (from a notify POST), reads from that
 * path instead of the local CWD-based path, so the viewer works regardless of
 * where it was started.
 */
export const reloadDb = async (remoteDbPath?: string): Promise<void> => {
  const validatedRemoteDbPath = validateRemoteDbPath(remoteDbPath);
  if (validatedRemoteDbPath) {
    try {
      const content = fs.readFileSync(validatedRemoteDbPath, 'utf-8');
      dbCache = JSON.parse(content);
      return;
    } catch {
      // Fall through to default
    }
  }
  dbCache = readDb();
};

export const createRun = async (
  id: string,
  parent?: { runId: string; stepId: string },
  functionId?: string,
): Promise<Run> => {
  const db = getDb();
  const started_at = new Date().toISOString();

  // Check if run already exists
  const existing = db.runs.find(r => r.id === id);
  if (existing) {
    return existing;
  }

  const run: Run = {
    id,
    started_at,
    parent_run_id: parent?.runId ?? null,
    parent_step_id: parent?.stepId ?? null,
    function_id: functionId ?? null,
  };
  db.runs.push(run);
  saveDb(db);
  notifyServer('run');
  return run;
};

export const createStep = async (
  step: Omit<
    Step,
    | 'duration_ms'
    | 'output'
    | 'usage'
    | 'error'
    | 'raw_request'
    | 'raw_response'
    | 'raw_chunks'
  >,
): Promise<void> => {
  const db = getDb();
  const newStep: Step = {
    ...step,
    duration_ms: null,
    output: null,
    usage: null,
    error: null,
    raw_request: null,
    raw_response: null,
    raw_chunks: null,
  };
  db.steps.push(newStep);
  saveDb(db);
  notifyServer('step');
};

export const updateStepResult = async (
  stepId: string,
  result: StepResult,
): Promise<void> => {
  const db = getDb();
  const step = db.steps.find(s => s.id === stepId);
  if (step) {
    step.duration_ms = result.duration_ms;
    step.output = result.output;
    step.usage = result.usage;
    step.error = result.error;
    step.raw_request = result.raw_request ?? null;
    step.raw_response = result.raw_response ?? null;
    step.raw_chunks = result.raw_chunks ?? null;
    saveDb(db);
    notifyServer('step-update');
  }
};

export const getRuns = async (): Promise<Run[]> => {
  const db = getDb();
  // Return runs sorted by started_at DESC
  return [...db.runs].sort(
    (a, b) =>
      new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
  );
};

export const getStepsForRun = async (runId: string): Promise<Step[]> => {
  const db = getDb();
  return db.steps
    .filter(s => s.run_id === runId)
    .sort((a, b) => a.step_number - b.step_number);
};

export const getRunWithSteps = async (
  runId: string,
): Promise<{ run: Run; steps: Step[] } | null> => {
  const db = getDb();
  const run = db.runs.find(r => r.id === runId);
  if (!run) return null;
  const steps = await getStepsForRun(runId);
  return { run, steps };
};

export const clearDatabase = async (): Promise<void> => {
  const db: Database = { runs: [], steps: [] };
  saveDb(db);
  notifyServer('clear');
};
