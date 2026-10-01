import assert from 'node:assert';
import { mock, test } from 'node:test';

import { verifyChangesets } from './index.js';

function mockReadFile(handler) {
  return mock.fn(async (path, encoding) => {
    if (path.endsWith('pre.json')) {
      throw new Error('ENOENT');
    }
    return handler(path, encoding);
  });
}

function mockLstat({ isSymlink = false } = {}) {
  return mock.fn(async () => ({
    isSymbolicLink: () => isSymlink,
  }));
}

test('happy path', async () => {
  const event = {
    pull_request: {
      labels: [],
    },
  };
  const env = {
    CHANGED_FILES: '.changeset/some-happy-path.md',
  };

  const readFile = mockReadFile(
    async () =>
      `---\nai: patch\n@ai-sdk/provider: patch\n---\n## Test changeset`,
  );
  const lstat = mockLstat();

  await verifyChangesets(event, env, readFile, lstat);

  assert.strictEqual(readFile.mock.callCount(), 2);
  assert.deepStrictEqual(readFile.mock.calls[1].arguments, [
    '../../../../.changeset/some-happy-path.md',
    'utf-8',
  ]);
  assert.strictEqual(lstat.mock.callCount(), 1);
});

test('ignores .changeset/README.md', async () => {
  const event = {
    pull_request: {
      labels: [],
    },
  };
  const env = {
    CHANGED_FILES: '.changeset/README.md',
  };

  const readFile = mockReadFile(() => {});
  const lstat = mockLstat();

  await verifyChangesets(event, env, readFile, lstat);

  assert.strictEqual(readFile.mock.callCount(), 1);
  assert.strictEqual(lstat.mock.callCount(), 0);
});

test('invalid file - not a .changeset file', async () => {
  const event = {
    pull_request: {
      labels: [],
    },
  };
  const env = {
    CHANGED_FILES: '.changeset/not-a-changeset-file.txt',
  };

  const readFile = mockReadFile(() => {});
  const lstat = mockLstat();

  await assert.rejects(
    () => verifyChangesets(event, env, readFile, lstat),
    Object.assign(new Error('Invalid file - not a .changeset file'), {
      path: '.changeset/not-a-changeset-file.txt',
    }),
  );

  assert.strictEqual(readFile.mock.callCount(), 1);
});

test('invalid .changeset file - no frontmatter', async () => {
  const event = {
    pull_request: {
      labels: [],
    },
  };
  const env = {
    CHANGED_FILES: '.changeset/invalid-changeset-file.md',
  };

  const readFile = mockReadFile(async () => 'frontmatter missing');
  const lstat = mockLstat();

  await assert.rejects(
    () => verifyChangesets(event, env, readFile, lstat),
    Object.assign(new Error('Invalid .changeset file - no frontmatter found'), {
      path: '.changeset/invalid-changeset-file.md',
    }),
  );
  assert.strictEqual(readFile.mock.callCount(), 2);
  assert.deepStrictEqual(readFile.mock.calls[1].arguments, [
    '../../../../.changeset/invalid-changeset-file.md',
    'utf-8',
  ]);
});

test('minor update', async () => {
  const event = {
    pull_request: {
      labels: [],
    },
  };
  const env = {
    CHANGED_FILES: '.changeset/patch-update.md .changeset/minor-update.md',
  };

  const readFile = mockReadFile(async path => {
    if (path.endsWith('patch-update.md')) {
      return `---\nai: patch\n---\n## Test changeset`;
    }

    return `---\n@ai-sdk/provider: minor\n---\n## Test changeset`;
  });
  const lstat = mockLstat();

  await assert.rejects(
    () => verifyChangesets(event, env, readFile, lstat),
    Object.assign(
      new Error(
        `Invalid .changeset file - invalid version bump (only "patch" is allowed, see https://ai-sdk.dev/docs/migration-guides/versioning). To bypass, add one of the following labels: minor, major`,
      ),
      {
        path: '.changeset/minor-update.md',
        frontmatter: '---\n@ai-sdk/provider: minor\n---',
      },
    ),
  );

  assert.strictEqual(readFile.mock.callCount(), 3);
  assert.deepStrictEqual(readFile.mock.calls[1].arguments, [
    '../../../../.changeset/patch-update.md',
    'utf-8',
  ]);
  assert.deepStrictEqual(readFile.mock.calls[2].arguments, [
    '../../../../.changeset/minor-update.md',
    'utf-8',
  ]);
});

test('minor update - with "minor" label', async () => {
  const event = {
    pull_request: {
      labels: [
        {
          name: 'minor',
        },
      ],
    },
  };
  const env = {
    CHANGED_FILES: '.changeset/patch-update.md .changeset/minor-update.md',
  };

  const readFile = mock.fn(async path => {
    if (path.endsWith('patch-update.md')) {
      return `---\nai: patch\n---\n## Test changeset`;
    }

    return `---\n@ai-sdk/provider: minor\n---\n## Test changeset`;
  });

  const message = await verifyChangesets(event, env, readFile);
  assert.strictEqual(
    message,
    'Skipping changeset verification - "minor" label found',
  );
});

test('major update - with "major" label', async () => {
  const event = {
    pull_request: {
      labels: [
        {
          name: 'major',
        },
      ],
    },
  };
  const env = {
    CHANGED_FILES: '.changeset/patch-update.md .changeset/major-update.md',
  };

  const readFile = mock.fn(async path => {
    if (path.endsWith('patch-update.md')) {
      return `---\nai: patch\n---\n## Test changeset`;
    }

    return `---\n@ai-sdk/provider: major\n---\n## Test changeset`;
  });

  const message = await verifyChangesets(event, env, readFile);
  assert.strictEqual(
    message,
    'Skipping changeset verification - "major" label found',
  );
});

test('major update - allowed when pre-release mode is active', async () => {
  const event = {
    pull_request: {
      labels: [],
    },
  };
  const env = {
    CHANGED_FILES: '.changeset/major-update.md',
  };

  const readFile = mock.fn(async path => {
    if (path.endsWith('pre.json')) {
      return '{"mode":"pre","tag":"beta"}';
    }

    return `---\n@ai-sdk/provider: major\n---\n## Test changeset`;
  });
  const lstat = mockLstat();

  await verifyChangesets(event, env, readFile, lstat);

  assert.strictEqual(readFile.mock.callCount(), 2);
  assert.deepStrictEqual(readFile.mock.calls[1].arguments, [
    '../../../../.changeset/major-update.md',
    'utf-8',
  ]);
});

test('invalid changeset - still rejected in pre-release mode', async () => {
  const event = {
    pull_request: {
      labels: [],
    },
  };
  const env = {
    CHANGED_FILES: '.changeset/bad-changeset.md',
  };

  const readFile = mock.fn(async path => {
    if (path.endsWith('pre.json')) {
      return '{"mode":"pre","tag":"beta"}';
    }

    return 'frontmatter missing';
  });
  const lstat = mockLstat();

  await assert.rejects(
    () => verifyChangesets(event, env, readFile, lstat),
    error => error.message.includes('no frontmatter found'),
  );
});

test('major update - rejected when not in pre-release mode', async () => {
  const event = {
    pull_request: {
      labels: [],
    },
  };
  const env = {
    CHANGED_FILES: '.changeset/minor-update.md',
  };

  const readFile = mockReadFile(async () => {
    return `---\n@ai-sdk/provider: minor\n---\n## Test changeset`;
  });
  const lstat = mockLstat();

  await assert.rejects(
    () => verifyChangesets(event, env, readFile, lstat),
    error => error.message.includes('invalid version bump'),
  );
});

test('rejects symlinked changeset files', async () => {
  const event = {
    pull_request: {
      labels: [],
    },
  };
  const env = {
    CHANGED_FILES: '.changeset/evil-symlink.md',
  };

  const readFile = mockReadFile(async () => 'should not be read');
  const lstat = mockLstat({ isSymlink: true });

  await assert.rejects(
    () => verifyChangesets(event, env, readFile, lstat),
    Object.assign(
      new Error('Invalid .changeset file - symlinks are not allowed'),
      { path: '.changeset/evil-symlink.md' },
    ),
  );

  // readFile should only be called once (for pre.json check), not for the symlinked file
  assert.strictEqual(readFile.mock.callCount(), 1);
  assert.strictEqual(lstat.mock.callCount(), 1);
});

test('error does not include raw file content', async () => {
  const event = {
    pull_request: {
      labels: [],
    },
  };
  const env = {
    CHANGED_FILES: '.changeset/bad-frontmatter.md',
  };

  const readFile = mockReadFile(
    async () => '---\n@ai-sdk/provider: minor\n---\nSensitive content here',
  );
  const lstat = mockLstat();

  try {
    await verifyChangesets(event, env, readFile, lstat);
    assert.fail('Expected error to be thrown');
  } catch (error) {
    // Should have frontmatter (safe to display), not full content
    assert.strictEqual(error.frontmatter, '---\n@ai-sdk/provider: minor\n---');
    assert.strictEqual(error.content, undefined);
  }
});

test('package code change with matching changeset', async () => {
  const event = { pull_request: { labels: [] } };
  const env = {
    CHANGED_FILES: '.changeset/new-feature.md',
    CHANGED_PACKAGE_FILES: 'packages/ai/src/index.ts',
  };

  const readFile = mockReadFile(async path => {
    if (path.endsWith('package.json')) {
      return JSON.stringify({ name: 'ai' });
    }

    return `---\nai: patch\n---\n## New feature`;
  });
  const lstat = mockLstat();

  await verifyChangesets(event, env, readFile, lstat);
});

test('package code change with quoted package name in changeset', async () => {
  const event = { pull_request: { labels: [] } };
  const env = {
    CHANGED_FILES: '.changeset/new-feature.md',
    CHANGED_PACKAGE_FILES: 'packages/openai/src/openai-provider.ts',
  };

  const readFile = mockReadFile(async path => {
    if (path.endsWith('package.json')) {
      return JSON.stringify({ name: '@ai-sdk/openai' });
    }

    return `---\n'@ai-sdk/openai': patch\n---\n## New feature`;
  });
  const lstat = mockLstat();

  await verifyChangesets(event, env, readFile, lstat);
});

test('package code change without any changeset file', async () => {
  const event = { pull_request: { labels: [] } };
  const env = {
    CHANGED_FILES: '',
    CHANGED_PACKAGE_FILES: 'packages/ai/src/index.ts',
  };

  const readFile = mockReadFile(async path => {
    if (path.endsWith('package.json')) {
      return JSON.stringify({ name: 'ai' });
    }
  });
  const lstat = mockLstat();

  await assert.rejects(
    () => verifyChangesets(event, env, readFile, lstat),
    new Error(
      `Missing changeset - packages were modified but no .changeset/*.md file was found. Run 'pnpm changeset' to create one.`,
    ),
  );
});

test('package code change but changeset missing that package', async () => {
  const event = { pull_request: { labels: [] } };
  const env = {
    CHANGED_FILES: '.changeset/partial.md',
    CHANGED_PACKAGE_FILES:
      'packages/ai/src/index.ts packages/openai/src/openai-provider.ts',
  };

  const readFile = mockReadFile(async path => {
    if (path.includes('packages/ai/')) {
      return JSON.stringify({ name: 'ai' });
    }
    if (path.includes('packages/openai/')) {
      return JSON.stringify({ name: '@ai-sdk/openai' });
    }

    return `---\nai: patch\n---\n## Partial changeset`;
  });
  const lstat = mockLstat();

  await assert.rejects(
    () => verifyChangesets(event, env, readFile, lstat),
    new Error(
      `Missing changeset entries for packages: @ai-sdk/openai. Make sure all modified packages are listed in a .changeset/*.md file.`,
    ),
  );
});

test('package test-only change does not require changeset', async () => {
  const event = { pull_request: { labels: [] } };
  const env = {
    CHANGED_FILES: '',
    CHANGED_PACKAGE_FILES: 'packages/ai/src/index.test.ts',
  };

  const readFile = mockReadFile(() => {});
  const lstat = mockLstat();

  await verifyChangesets(event, env, readFile, lstat);
  assert.strictEqual(readFile.mock.callCount(), 1);
  assert.strictEqual(lstat.mock.callCount(), 0);
});

test('package markdown-only change does not require changeset', async () => {
  const event = { pull_request: { labels: [] } };
  const env = {
    CHANGED_FILES: '',
    CHANGED_PACKAGE_FILES: 'packages/ai/README.md',
  };

  const readFile = mockReadFile(() => {});
  const lstat = mockLstat();

  await verifyChangesets(event, env, readFile, lstat);
  assert.strictEqual(readFile.mock.callCount(), 1);
  assert.strictEqual(lstat.mock.callCount(), 0);
});

test('package code change bypassed with "minor" label', async () => {
  const event = { pull_request: { labels: [{ name: 'minor' }] } };
  const env = {
    CHANGED_FILES: '',
    CHANGED_PACKAGE_FILES: 'packages/ai/src/index.ts',
  };

  const readFile = mock.fn(() => {});
  const lstat = mockLstat();

  const message = await verifyChangesets(event, env, readFile, lstat);
  assert.strictEqual(
    message,
    'Skipping changeset verification - "minor" label found',
  );
  assert.strictEqual(readFile.mock.callCount(), 0);
  assert.strictEqual(lstat.mock.callCount(), 0);
});

test('private package code change does not require changeset', async () => {
  const event = { pull_request: { labels: [] } };
  const env = {
    CHANGED_FILES: '',
    CHANGED_PACKAGE_FILES: 'packages/internal-tool/src/index.ts',
  };

  const readFile = mockReadFile(async path => {
    if (path.endsWith('package.json')) {
      return JSON.stringify({ name: 'internal-tool', private: true });
    }
  });
  const lstat = mockLstat();

  await verifyChangesets(event, env, readFile, lstat);
});
