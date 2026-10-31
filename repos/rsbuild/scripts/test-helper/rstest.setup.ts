import path from 'node:path';
import { beforeAll, expect } from '@rstest/core';
import { createSnapshotSerializer } from 'path-serializer';

beforeAll((suite) => {
  process.env.REBUILD_TEST_SUITE_CWD = 'filepath' in suite ? path.dirname(suite.filepath) : '';
});

expect.addSnapshotSerializer(
  createSnapshotSerializer({
    workspace: path.join(__dirname, '..'),
  }),
);
