import * as React from 'react';

export interface Fixture {
  Component: React.ComponentType<unknown>;
  name: string;
  path: string;
  suite: string;
  isTailwind: boolean;
}

// Get all the fixtures specifically written for preventing visual regressions.
const globbedRegressionFixtures = import.meta.glob<{ default: React.ComponentType<unknown> }>(
  './fixtures/**/*.tsx',
  { eager: true },
);

const regressionFixtures: Fixture[] = [];

for (const path in globbedRegressionFixtures) {
  const [suite, name] = path
    .replace(/\\/g, '/')
    .replace('./', '')
    .replace(/\.\w+$/, '')
    .split('/');

  regressionFixtures.push({
    path,
    suite: `regression-${suite}`,
    name,
    Component: globbedRegressionFixtures[path].default,
    isTailwind: false,
  });
}

const blacklist: (string | RegExp)[] = [];

const unusedBlacklistPatterns = new Set(blacklist);

function excludeDemoFixture(suite: string, name: string, path: string) {
  const blacklisted = blacklist.some((pattern) => {
    if (typeof pattern === 'string') {
      if (pattern === suite) {
        unusedBlacklistPatterns.delete(pattern);

        return true;
      }
      if (pattern === `${suite}/${name}.png`) {
        unusedBlacklistPatterns.delete(pattern);

        return true;
      }

      return false;
    }

    if (pattern.test(suite)) {
      unusedBlacklistPatterns.delete(pattern);
      return true;
    }
    return false;
  });

  if (blacklisted) {
    return true;
  }

  const pathSegments = path.split('/');
  if (pathSegments[1] === 'components' && pathSegments.length === 6) {
    // For demos inside subdirectories under components, include just the entry point - index.js.
    return pathSegments[5] !== 'index.js';
  }

  return false;
}

// Also use all public demos to avoid code duplication.
const globbedDemos = import.meta.glob<{ default: React.ComponentType<unknown> }>(
  // technically it should be 'docs/src/app/\\(public\\)/\\(content\\)/react/**/*.tsx' but tinyglobby doesn't resolve this on Windows
  'docs/src/app/?docs?/react/**/*.tsx',
  { eager: true },
);

const demoFixtures: Fixture[] = [];

for (const path in globbedDemos) {
  const [name, ...suiteArray] = path.split('react')[1].split('/').reverse();
  const suite = `docs-${suiteArray
    .filter((v) => v)
    .reverse()
    .join('-')}`;

  if (!excludeDemoFixture(suite, name, path) && globbedDemos[path].default) {
    demoFixtures.push({
      path,
      suite,
      name,
      Component: globbedDemos[path].default,
      isTailwind: path.includes('/tailwind/'),
    });
  }
}

if (unusedBlacklistPatterns.size > 0) {
  console.warn(
    `The following patterns are unused:\n\n${Array.from(unusedBlacklistPatterns)
      .map((pattern) => `- ${pattern}`)
      .join('\n')}`,
  );
}

export const fixtures: Fixture[] = regressionFixtures.concat(demoFixtures);
