import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSegment, transformMdx } from './sync-content-utils.mjs';

test('parseSegment removes numeric ordering prefixes', () => {
  assert.deepEqual(parseSegment('03-ai-sdk-core'), {
    prefix: 3,
    clean: 'ai-sdk-core',
  });
  assert.deepEqual(parseSegment('introduction'), {
    prefix: null,
    clean: 'introduction',
  });
});

test('transformMdx removes imports before the leading body heading', () => {
  const input = `---
title: Streaming Values
---

import { Example } from './example';

# Streaming Values

Body
`;

  assert.equal(
    transformMdx(input),
    `---
title: Streaming Values
---


Body
`,
  );
});

test('transformMdx rewrites legacy fence metadata and languages', () => {
  const input = `---
title: Example
---

\`\`\`prompt file={"app/page.tsx"} highlight={"1,3-5"}
hello
\`\`\`
`;

  assert.match(
    transformMdx(input),
    /```txt title="app\/page\.tsx" \{1,3-5\}/,
  );
});

test('transformMdx preserves legacy anchors and rewrites stale links', () => {
  const input = `---
title: streamText
---

# streamText

[Tools](/docs/tools#multi-step-calls)

### Returns
`;

  const transformed = transformMdx(input);
  assert.match(transformed, /#multi-step-calls-using-stopwhen/);
  assert.match(transformed, /<span id="result" \/>/);
  assert.match(transformed, /<span id="result-object" \/>/);
});

test('transformMdx does not rewrite corrected fragments twice', () => {
  const input = `---
title: Tools
---

# Tools

[Calls](/docs/tools#multi-step-calls-using-stopwhen)
[Attachments](/docs/chatbot#attachments-experimental)
`;

  const transformed = transformMdx(input);
  assert.match(transformed, /#multi-step-calls-using-stopwhen\)/);
  assert.match(transformed, /#attachments\)/);
  assert.doesNotMatch(transformed, /using-stopwhen-using-stopwhen/);
});
