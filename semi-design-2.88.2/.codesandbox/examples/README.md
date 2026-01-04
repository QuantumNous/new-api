# Description

This folder is the sample template of CodeSandbox.

When you submit the PR, you can overwrite the sample code according to the scenario (fix/feature).

> This will automatically build a CodeSandbox environment based on this PR. The Reviewer can directly access your sample after clicking the link , No need to preview under the PR branch :)

# Usage

## pr-story

- clone code and run

```bash
# if you have clone semi-design code, no need to clone it again
git https://github.com/DouyinFE/semi-design.git

cd .codesandbox/examples/pr-story
yarn install
yarn start
```

- override code based on this pull request

Only need to change  `App.jsx` file. 

For example, I modified some logic of the `Input` `prefix` API, and the code related to `Input` `prefix` can be included in the sample code.

```javascript
// .codesandbox/examples/pr-story/src/App.jsx
import React from "react";

import { Input } from "@douyinfe/semi-ui";
import "./App.css";

/**
 * Write a demo based on this PR
 */
export default function App() {
  return (
    <div className="app">
      {/* ------- your code start ------- DON'T DELETE THIS LINE -------  */}
      <Input prefix="semi" style={{ width: 200 }} />
      {/* ------- your code end ------- DON'T DELETE THIS LINE ------- */}
    </div>
  );
}
```