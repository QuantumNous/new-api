import type { HarnessV1StreamPart } from '../../v1';

/**
 * Remove the session working-directory prefix from path-bearing fields of a
 * stream event, returning a new event for display to consumers.
 *
 * Harness adapters run the agent in a per-session working directory that is a
 * subdirectory of the sandbox root, and the agent's tools use absolute paths so
 * they resolve against the root regardless of where the runtime process
 * operates. The absolute paths are correct but noisy in a UI, so this strips
 * the prefix for the consumer-facing projection only.
 *
 * Blanket prefix replacement (rather than rewriting known path fields) is used
 * deliberately: `tool-result` results are free-form text — command stdout, grep
 * output — where paths can appear anywhere and field-aware rewriting is
 * impossible. The prefix is long and contains the session id, so it is unique
 * enough that replacing every occurrence is safe.
 */
export function stripWorkDir(
  part: HarnessV1StreamPart,
  sessionWorkDir: string,
): HarnessV1StreamPart {
  if (sessionWorkDir.length === 0) return part;

  switch (part.type) {
    case 'tool-call':
      return { ...part, input: stripString(part.input, sessionWorkDir) };
    case 'tool-result':
      return {
        ...part,
        result: stripDeep(part.result, sessionWorkDir) as Extract<
          HarnessV1StreamPart,
          { type: 'tool-result' }
        >['result'],
      };
    case 'file-change':
      return { ...part, path: stripString(part.path, sessionWorkDir) };
    default:
      return part;
  }
}

/**
 * Replace occurrences of the working directory in a string. A reference to the
 * directory followed by a separator becomes workspace-relative
 * (`/work/dir/src/a.ts` → `src/a.ts`); a bare reference to the directory itself
 * becomes `.`.
 */
function stripString(value: string, workDir: string): string {
  return value.split(`${workDir}/`).join('').split(workDir).join('.');
}

/**
 * Recursively strip the working directory from every string nested in an
 * arbitrary JSON-like value. Non-string leaves are returned unchanged.
 */
function stripDeep(value: unknown, workDir: string): unknown {
  if (typeof value === 'string') return stripString(value, workDir);
  if (Array.isArray(value)) return value.map(item => stripDeep(item, workDir));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = stripDeep(val, workDir);
    }
    return out;
  }
  return value;
}
