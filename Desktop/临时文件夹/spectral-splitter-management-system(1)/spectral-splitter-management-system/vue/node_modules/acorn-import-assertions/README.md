# Support for import assertions in acorn

## Usage

This module provides a plugin that can be used to extend the Acorn Parser class:

```js
const {Parser} = require('acorn');
const {importAssertions} = require('acorn-import-assertions');
Parser.extend(importAssertions).parse('...');
```

## License

This plugin is released under an MIT License.
