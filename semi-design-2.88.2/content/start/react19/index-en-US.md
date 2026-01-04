---
localeCode: en-US
order: 3
category: Getting Started
title: React v19 Adaptation
icon: doc-configprovider
dir: column
brief: React v19 adaptation
---

Since the release of React v19, React has introduced numerous underlying mechanism and API changes, including upgrades and adjustments to the render mechanism, ref, context, TypeScript types, and related deprecated APIs. To ensure that the Semi Design component library is smoothly compatible with both React v19 and lower versions, we provide the original component package `@douyinfe/semi-ui` for React versions below v19, as well as a new package `@douyinfe/semi-ui-19` specifically adapted for React v19, so users can choose as needed. This guide will help you understand how to install, use, and the precautions to take.

## Installation & Usage

If your project is using React v19, please use `@douyinfe/semi-ui-19`. For React versions below v19, continue using `@douyinfe/semi-ui` as before.

```bash
# For users of React v19
# Using npm
npm i @douyinfe/semi-ui-19 

# Using yarn
yarn add @douyinfe/semi-ui-19

# Using pnpm
pnpm add @douyinfe/semi-ui-19 
```

To use, just import components from `@douyinfe/semi-ui-19`:

```jsx
import React, { Component } from 'react';
import { Button, Toast } from '@douyinfe/semi-ui-19';

const SemiApp = () => {
    return (
        <Button onClick={() => Toast.warning({ content: 'I can now adapt to React v19.' })}>
            Hello Semi
        </Button>
    );
};
```

*** Why maintain two packages? ***

React v19 introduces several major updates, new deprecations, breaking changes, and TypeScript modifications. Check the [React v19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide) for details. For most changes, we have re-implemented components to ensure they work consistently across different React versions.

However, the removal of [ReactDOM.render](https://react.dev/blog/2024/04/25/react-19-upgrade-guide#removed-reactdom-render) and [ReactDOM.findDOMNode](https://react.dev/blog/2024/04/25/react-19-upgrade-guide#removed-reactdom-finddomnode) in React v19 cannot be simply patched to work with both React versions.

For the Semi component library:
- `Modal`, `Notification`, and `Toast` components use `ReactDOM.render` to mount content onto nodes.
- `Tooltip` uses `ReactDOM.findDOMNode` to obtain the real DOM node, and other popover components like `Popover` and `PopConfirm` are implemented based on `Tooltip`.

For frontend projects:
- Some legacy projects do not have an urgent need to upgrade to React v19.
- Some projects use syntax or APIs removed in React v19, so they need to continue using the Semi library supporting React below v19 for now.

Therefore, to ensure functional consistency, we use different code implementations for React v19 and versions below it, and continue to update both `@douyinfe/semi-ui-19` (React v19) and `@douyinfe/semi-ui` (below v19) for at least a year.

## Notes

The removal of `ReactDOM.findDOMNode` in React v19 makes it impossible to find and return the real DOM node for a given class component instance.

For `Tooltip` and other popover components based on `Tooltip` (such as `Popover`, `PopConfirm`， `Dropdown`), if the `children` are class components and the props are forwarded to the real DOM node, it works fine with `@douyinfe/semi-ui`. However, in `@douyinfe/semi-ui-19`, it may not work, and you should wrap the class component in a real DOM node (such as `<span>`, `<div>`, `<p>`, etc.) for a workaround.

In addition, some nodes of a component can be customized by the user. If the node uses a tooltip for suggestions, such as the custom copy node in Typography, the same restrictions apply if the user-defined node is a class component node.

For example:

```js noInline=true
// @douyinfe/semi-ui
// The children of Tooltip is a class component (MyComponent), props are forwarded to the real DOM node
// Works fine
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
// Using @douyinfe/semi-ui-19,
// Can't use MyComponent as a direct child of Tooltip
// wrap it in a real DOM node for proper functioning
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
