# eslint-plugin-semi-design

Semi 仓库使用的 eslint 插件

## eslint 规则

### ✅ 不能在 semi-foundation 里引用 semi-ui

semi-ui 不应该作为 semi-foundation 的依赖。

原因：根据 Semi 的 foundation 和 adapter 设计，foundation 不应依赖 adapter。点击查看 [F/A 设计](https://bytedance.feishu.cn/wiki/wikcnOVYexosCS1Rmvb5qCsWT1f)。

### ✅ 不能在 semi-ui 和 semi-foundation 引用 lodash-es

使用 lodash 而不是 lodash-es。

原因：为了兼容 next，而 lodash-es 只提供了 es module 的产物。

![image](https://user-images.githubusercontent.com/26477537/172051379-30b42f31-b677-43be-982f-1e8f5345cfc9.png)

点击查看[详情](https://github.com/vercel/next.js/issues/2259)。

### ✅ 不能在 semi-ui 或 semi-foundation 使用相对路径引用 packages 下的包

monorepo 下各个包之间的 import 请使用包名而不是相对路径。

原因：这两个包在用户项目的安装路径可能不在同一文件夹下，使用相对路径会找不到对应的包。

```javascript
// ❌ 不推荐
// semi-ui/input/index.tsx
import inputFoundation from '../semi-foundation/input/foundation';

// ✅ 推荐
// semi-ui/input/index.tsx
import inputFoundation from '@douyinfe/semi-foundation/input/foundation';
```

### ✅ 不推荐在同个包下使用包名加路径引用其他模块

同一个包 import 请使用相对路径而不是引用包名。

```javascript
// ❌ 不推荐
// semi-ui/modal/Modal.tsx
import { Button } from '@douyinfe/semi-ui';

// ✅ 推荐
// semi-ui/modal/Modal.tsx
import Button from '../button';
```

### ✅ 不能在 semi-foundation 引用 React 或 ReactDOM

```javascript
// ❌ 
// packages/semi-foundation/input/foundation.ts
import React from 'react';
import ReactDOM from 'react-dom';
```

## 相关资料

- eslint plugin 文档：https://eslint.org/docs/developer-guide/working-with-plugins
