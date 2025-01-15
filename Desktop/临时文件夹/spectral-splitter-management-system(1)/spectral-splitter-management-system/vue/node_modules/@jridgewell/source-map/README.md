# @jridgewell/source-map

> Packages `@jridgewell/trace-mapping` and `@jridgewell/gen-mapping` into the familiar source-map API

This isn't the full API, but it's the core functionality. This wraps
[@jridgewell/trace-mapping][trace-mapping] and [@jridgewell/gen-mapping][gen-mapping]
implementations.

## Installation

```sh
npm install @jridgewell/source-map
```

## Usage

TODO

### SourceMapConsumer

```typescript
import { SourceMapConsumer } from '@jridgewell/source-map';
const smc = new SourceMapConsumer({
  version: 3,
  names: ['foo'],
  sources: ['input.js'],
  mappings: 'AAAAA',
});
```

#### SourceMapConsumer.prototype.originalPositionFor(generatedPosition)

```typescript
const smc = new SourceMapConsumer(map);
smc.originalPositionFor({ line: 1, column: 0 });
```

### SourceMapGenerator

```typescript
import { SourceMapGenerator } from '@jridgewell/source-map';
const smg = new SourceMapGenerator({
  file: 'output.js',
  sourceRoot: 'https://example.com/',
});
```

#### SourceMapGenerator.prototype.addMapping(mapping)

```typescript
const smg = new SourceMapGenerator();
smg.addMapping({
  generated: { line: 1, column: 0 },
  source: 'input.js',
  original: { line: 1, column: 0 },
  name: 'foo',
});
```

#### SourceMapGenerator.prototype.setSourceContent(sourceFile, sourceContent)

```typescript
const smg = new SourceMapGenerator();
smg.setSourceContent('input.js', 'foobar');
```

#### SourceMapGenerator.prototype.toJSON()

```typescript
const smg = new SourceMapGenerator();
smg.toJSON(); // { version: 3, names: [], sources: [], mappings: '' }
```

#### SourceMapGenerator.prototype.toDecodedMap()

```typescript
const smg = new SourceMapGenerator();
smg.toDecodedMap(); // { version: 3, names: [], sources: [], mappings: [] }
```

[trace-mapping]: https://github.com/jridgewell/trace-mapping/
[gen-mapping]: https://github.com/jridgewell/gen-mapping/
