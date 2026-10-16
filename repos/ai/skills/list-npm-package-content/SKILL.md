---
name: list-npm-package-content
description: List the contents of an npm package tarball before publishing. Use when the user wants to see what files are included in an npm bundle, verify package contents, or debug npm publish issues.
metadata:
  internal: true
---

# List npm Package Content

This skill lists the exact contents of an npm package tarball - the same files that would be uploaded to npm and downloaded by users.

## Usage

Run the script from the package directory (e.g., `packages/ai`):

```bash
bash scripts/list-package-files.sh
```

The script will build the package, create a tarball, list its contents, and clean up automatically.

## Understanding Package Contents

The files included are determined by:

1. **`files` field in `package.json`** - explicit allowlist of files/directories
2. **`.npmignore`** - files to exclude (if present)
3. **`.gitignore`** - used if no `.npmignore` exists
4. **Always included**: `package.json`, `README`, `LICENSE`, `CHANGELOG`
5. **Always excluded**: `.git`, `node_modules`, `.npmrc`, etc.
