import { createTransformer } from '../lib/create-transformer';

/*
The `ai/rsc` export has been extracted to a separate package `@ai-sdk/rsc`

Before:

```jsx
import { createStreamableValue } from 'ai/rsc';
```

After:

```bash
pnpm add @ai-sdk/rsc
```

```jsx
import { createStreamableValue } from '@ai-sdk/rsc';
```

Commit: https://github.com/vercel/ai/pull/5542
*/

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  root
    .find(j.ImportDeclaration)
    .filter(path => path.node.source.value === 'ai/rsc')
    .forEach(path => {
      path.node.source.value = '@ai-sdk/rsc';
      context.hasChanges = true;
    });
});
