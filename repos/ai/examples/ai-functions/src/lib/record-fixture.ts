import fs from 'fs';
import path from 'path';

interface StreamResult {
  fullStream: AsyncIterable<{ type: string; rawValue?: unknown }>;
}

interface GenerateResult {
  steps: ReadonlyArray<{ response: { body?: unknown } }>;
}

type RecordableResult = StreamResult | GenerateResult;

const OUTPUT_DIR = 'output';

export function isRecordableResult(value: unknown): value is RecordableResult {
  return (
    value != null &&
    typeof value === 'object' &&
    ('fullStream' in value || 'steps' in value)
  );
}

function isStreamResult(result: RecordableResult): result is StreamResult {
  return 'fullStream' in result;
}

// e.g. ".../stream-text/anthropic/basic.ts" -> "basic"
function fixtureBaseName() {
  return path.basename(process.argv[1]).replace(/\.[jt]s$/, '');
}

// Records a test fixture for the example currently being run. The file is named
// after the example file, with a per-request index (`.1`, `.2`, ...): raw stream
// chunks as `<name>.<n>.chunks.txt` for `streamText`, or the raw response body as
// `<name>.<n>.json` for `generateText`.
export async function recordFixture(result: RecordableResult) {
  const name = fixtureBaseName();

  // The output directory is gitignored, so it may not exist on a fresh checkout.
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  if (isStreamResult(result)) {
    const steps: string[][] = [];
    for await (const chunk of result.fullStream) {
      if (chunk.type === 'start-step') {
        steps.push([]);
      }
      if (chunk.type === 'raw') {
        steps.at(-1)?.push(JSON.stringify(chunk.rawValue));
      }
    }
    steps.forEach((chunks, i) =>
      fs.writeFileSync(
        path.join(OUTPUT_DIR, `${name}.${i + 1}.chunks.txt`),
        chunks.join('\n'),
      ),
    );
  } else {
    result.steps.forEach((step, i) =>
      fs.writeFileSync(
        path.join(OUTPUT_DIR, `${name}.${i + 1}.json`),
        JSON.stringify(step.response.body, null, 2),
      ),
    );
  }
}
