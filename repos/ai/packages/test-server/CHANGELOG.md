# @ai-sdk/test-server

## 2.0.0

### Major Changes

- ef992f8: Remove CommonJS exports from all packages. All packages are now ESM-only (`"type": "module"`). Consumers using `require()` must switch to ESM `import` syntax.
- 8359612: Start v7 pre-release

### Patch Changes

- b567a6c: dependency updates
- 9f0e36c: trigger release for all packages after provenance setup
- 7fc6bd6: Raise minimum supported Node.js version to 22. Supported versions: 22, 24, and 26.
- 0c4c275: trigger initial canary release
- 258c093: chore: ensure consistent import handling and avoid import duplicates or cycles
- b8396f0: trigger initial beta release

## 2.0.0-beta.7

### Patch Changes

- b8396f0: trigger initial beta release

## 2.0.0-canary.6

### Patch Changes

- 7fc6bd6: Raise minimum supported Node.js version to 22. Supported versions: 22, 24, and 26.

## 2.0.0-canary.5

### Patch Changes

- b567a6c: dependency updates

## 2.0.0-canary.4

### Patch Changes

- 0c4c275: trigger initial canary release

## 2.0.0-beta.3

### Patch Changes

- 258c093: chore: ensure consistent import handling and avoid import duplicates or cycles

## 2.0.0-beta.2

### Patch Changes

- 9f0e36c: trigger release for all packages after provenance setup

## 2.0.0-beta.1

### Major Changes

- ef992f8: Remove CommonJS exports from all packages. All packages are now ESM-only (`"type": "module"`). Consumers using `require()` must switch to ESM `import` syntax.

## 2.0.0-beta.0

### Major Changes

- 8359612: Start v7 pre-release

## 1.0.3

### Patch Changes

- 4de5a1d: chore: excluded tests from src folder in npm package

## 1.0.2

### Patch Changes

- 8dc54db: chore: add src folders to package bundle

## 1.0.1

### Patch Changes

- 863d34f: fix: trigger release to update `@latest`

## 1.0.0

### Major Changes

- dee8b05: ai SDK 6 beta
- 953d0f2: feat(packages/test-server): Add `test-server` as a package

## 1.0.0-beta.1

### Major Changes

- dee8b05: ai SDK 6 beta

## 1.0.0-beta.0

### Major Changes

- 953d0f2: feat(packages/test-server): Add `test-server` as a package
