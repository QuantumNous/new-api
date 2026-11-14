#!/usr/bin/env bash
set -e

# Build, pack, list contents, cleanup
pnpm build
tarball=$(pnpm pack | tail -1)
tar -tzf "$tarball"
rm "$tarball"
