# eslint-plugin-semi-design

eslint plugin for semi design

## Rules

### ✅ Should not reference semi-ui in semi-foundation

semi-ui should not be used as a dependency of semi-foundation.

Why: According to Semi's foundation and adapter design, foundation should not depend on adapter. Click to view the [F/A design](https://bytedance.feishu.cn/wiki/wikcnOVYexosCS1Rmvb5qCsWT1f).

### ✅ Should not import lodash-es in semi-ui and semi-foundation

Use lodash instead of lodash-es.

Why: In order to be compatible with next, lodash-es only provides the product of es module.

![image](https://user-images.githubusercontent.com/26477537/172051379-30b42f31-b677-43be-982f-1e8f5345cfc9.png)

See more [here](https://github.com/vercel/next.js/issues/2259)。

### ✅ Should not use relative paths to import a package under packages in semi-ui or semi-foundation

For imports between packages under monorepo, use package names instead of relative paths.

Why: These two packages may not be in the same folder in the installation path of the user project, and the corresponding package cannot be found using the relative path.

```javascript
// ❌ Not recommend
// semi-ui/input/index.tsx
import inputFoundation from '../semi-foundation/input/foundation';

// ✅ Recommend
// semi-ui/input/index.tsx
import inputFoundation from '@douyinfe/semi-foundation/input/foundation';
```

### ✅ Should not use the package name and path to import other modules under the same package
When importing the same package, use relative paths instead of referencing the package name.

```javascript
// ❌ Not recommend
// semi-ui/modal/Modal.tsx
import { Button } from '@douyinfe/semi-ui';

// ✅ Recommend
// semi-ui/modal/Modal.tsx
import Button from '../button';

```

### ✅ Should not import React or ReactDOM in semi-foundation

```javascript
// ❌ 
// packages/semi-foundation/input/foundation.ts
import React from 'react';
import ReactDOM from 'react-dom';
```

## Related docs

- eslint plugin doc：https://eslint.org/docs/developer-guide/working-with-plugins
