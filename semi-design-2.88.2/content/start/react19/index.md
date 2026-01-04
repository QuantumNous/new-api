---
localeCode: zh-CN
order: 3
category: 开始
title:  React v19 适配
icon: doc-configprovider
dir: column
brief: React v19 适配
---

自 React v19 发布以来，React 引入了诸多底层机制与 API 的变更，包括对 render 机制、ref、context、TypeScript 类型和相关弃用 API 的升级与调整。为保障 Semi Design 组件库能够平滑兼容 React v19 及更低 react 版本，我们提供适用于 React 版本低于 v19 场景的原有组件包 `@douyinfe/semi-ui`，以及专门适配 React v19 的新包 `@douyinfe/semi-ui-19`，方便用户按需选择。本指南将带你了解如何安装、使用以及注意事项。

## 安装及使用

如果是 React v19 的项目，请使用 `@douyinfe/semi-ui-19`，如果是 React 版本低于 v19 的项目，使用方式不变，仍然为 `@douyinfe/semi-ui`

```bash
# 对于 React v19 的用户
# 使用 npm
npm i @douyinfe/semi-ui-19 

# 使用 yarn
yarn add @douyinfe/semi-ui-19

# 使用 pnpm
pnpm add @douyinfe/semi-ui-19 

```

在使用时候，从 `@douyinfe/semi-ui-19` 导出组件

```jsx
import React, { Component } from 'react';
import { Button, Toast } from '@douyinfe/semi-ui-19';

const SemiApp = () => {
    return (
        <Button onClick={() => Toast.warning({ content: 'I can now adapt to React v19.' })}>Hello Semi</Button>
    );
};
```

*** 为何需要同时维护两个包？***

React v19 引入了一些重大更改、新的弃用、breaking change、以及 TypeScript 的修改，详情见 [React v19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)。对于大部分的变更，我们通过修改组件中代码的实现方式，保证组件库中的组件功能不变，在不同的 React 版本中正常运行。

但是 React v19 中 [ReactDOM.render](https://zh-hans.react.dev/blog/2024/04/25/react-19-upgrade-guide#removed-reactdom-render)、[ReactDOM.findDOMNode](https://zh-hans.react.dev/blog/2024/04/25/react-19-upgrade-guide#removed-reactdom-finddomnode) 的移除对于组件库以及业务代码来说，无法通过简单的修改代码实现来适配不同的 React 版本。

对于 Semi 组件库
- `Modal`，`Notification`，`Toast` 组件会使用 `ReactDOM.render` 将内容挂载到节点上
- `Tooltip` 有使用 `ReactDOM.findDOMNode` 去获取真实的 DOM 节点，其他的弹出层组件如 `Popover`，`PopConfirm`等，底层实现基于 `Tooltip` 

对于前端业务项目
- 老旧项目的部分更新，无强烈升级至 React v19 版本的需求
- 项目中有其他的 React v19 移除语法的使用，短期无升级计划，暂需继续使用支持 React 版本低于 v19 的 Semi 组件库

因此我们在 React v19 以及 React 版本低于 19 的版本中，使用不同的代码实现来保证组件功能一致，并采取了同时更新适配 React v19 的 `@douyinfe/semi-ui-19`，以及低于 React v19 版本的 `@douyinfe/semi-ui` 的方式。预期一年内将继续保持此方式更新组件库。

## 注意事项

React v19 中 `ReactDOM.findDOMNode` 的移除，会导致无法实现查找并返回给定 React 类组件实例所对应的浏览器 DOM 节点。

对于 `Tooltip`，以及其他基于 `Tooltip` 的弹出层组件（`Popover`， `PopConfirm`， `Dropdown`），如果 `children` 使用的是类组件，并将 props 透传给了至真实的 DOM 节点上，在 `@douyinfe/semi-ui` 可以正常运行，但是在 `@douyinfe/semi-ui-19` 无法正常运行，可以通过在类组件外包一层真实的 DOM 节点（如 span，div，p...) 解决。

此外，组件的某些节点允许用户自定义，如果该节点使用了 Tooltip 进行提示，比如 Typography 的自定义复制节点，如果用户自定义的节点如果是类组件，同样有上述的限制。

例如：

```js noInline=true
// @douyinfe/semi-ui
// Tooltip 的 children 为 MyComponent，类组件，props 被透传至真实的 DOM 节点上
// 正常运行
import React from 'react';
import { Tooltip } from '@douyinfe/semi-ui';

class MyComponent extends React.Component {
    render() {
        return (<span {...this.props} style={{ border: '2px solid var(--semi-color-border)' }}>ClassComponent</span>);
    }
};

() => (<Tooltip content="Hello">
    <MyComponent>Hover me</MyComponent>
</Tooltip>);
```

```js
// 使用 @douyinfe/semi-ui-19，
// 不能将 MyComponent 作为 Tooltip 的直接子节点，可以通过一个真实的 DOM 节点包裹 MyComponent 保证正常运行
import React from 'react';
import { Tooltip, Button } from '@douyinfe/semi-ui-19';

class MyComponent extends React.Component {
    render() {
        return (<span {...this.props} style={{ border: '2px solid var(--semi-color-border)' }}>ClassComponent</span>);
    }
};

() => (<Tooltip content="Hello">
    <span style={{ display: 'inline-flex' }}>
        <MyComponent>Hover me</MyComponent>
    </span>
</Tooltip>);
```





