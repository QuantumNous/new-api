import { asSchema, type ToolSet } from '@ai-sdk/provider-utils';
import { hashCanonical } from '../util/canonical-hash';

/**
 * Tag a tool description for hashing. A function description is developer-owned
 * (evaluated per call from local context), not a server-controlled "rug pull"
 * vector, so only its presence is pinned, not its identity. The tagged shape
 * keeps a literal string equal to some placeholder from ever hashing like a
 * function.
 */
function tagDescription(description: unknown) {
  if (typeof description === 'string') {
    return { type: 'string', value: description } as const;
  }
  if (description == null) {
    return { type: 'none' } as const;
  }
  return { type: 'function' } as const;
}

/**
 * Fingerprint the server-controlled, security-relevant fields of each tool in a
 * `ToolSet`: `description` (string form only), the resolved input JSON schema,
 * and `title`. Returns a map of tool name to a stable digest.
 *
 * Capture a baseline at trust time (first connect, human-reviewed) and compare
 * later fetches with {@link detectToolDrift} to catch MCP tool-definition drift
 * ("rug pull"). Baseline storage and the drift response are the app's concern.
 */
export async function fingerprintTools(
  tools: ToolSet,
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    Object.keys(tools).map(async name => {
      const tool = tools[name];
      const digest = await hashCanonical({
        description: tagDescription(tool.description),
        inputSchema: await asSchema(tool.inputSchema).jsonSchema,
        title: tool.title,
      });
      return [name, digest] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * Pure diff of two fingerprint maps produced by {@link fingerprintTools}.
 * `added`/`removed` are tools present in only one map; `changed` are tools whose
 * pinned definition differs. Uses own-property lookups so a tool literally named
 * `constructor` or `toString` diffs correctly.
 */
export function detectToolDrift(
  current: Record<string, string>,
  baseline: Record<string, string>,
): { added: string[]; removed: string[]; changed: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  for (const name of Object.keys(current)) {
    if (!Object.hasOwn(baseline, name)) {
      added.push(name);
    } else if (current[name] !== baseline[name]) {
      changed.push(name);
    }
  }

  for (const name of Object.keys(baseline)) {
    if (!Object.hasOwn(current, name)) {
      removed.push(name);
    }
  }

  return { added, removed, changed };
}
