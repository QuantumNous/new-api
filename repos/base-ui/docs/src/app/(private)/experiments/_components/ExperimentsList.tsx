import * as React from 'react';
import { globbySync } from 'globby';
import Link from 'next/link';
import clsx from 'clsx';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { camelToSentenceCase } from 'docs/src/utils/camelToSentenceCase';
import classes from './ExperimentsList.module.css';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const experimentsRootDirectory = resolve(currentDirectory, '../');

const allExperimentFiles = globbySync(
  ['**/*.tsx', '!infra/**/*', '!**/page.tsx', '!**/layout.tsx', '!**/_components'],
  { cwd: experimentsRootDirectory },
);

const groups: Record<string, { name: string; path: string }[]> = {};

for (const key of allExperimentFiles) {
  const segments = key.split('/');

  // Ignore nested entries like `perf/utils/*` to keep navigation at 1 level deep.
  if (segments.length > 2) {
    continue;
  }
  let group: string;
  let name: string;

  if (segments.length === 1) {
    group = '*';
    name = segments[0];
  } else {
    group = camelToSentenceCase(segments[0]);
    name =
      segments[1].toLowerCase().startsWith(`${group.toLowerCase()}-`) &&
      segments[1].length > group.length
        ? segments[1].slice(group.length + 1).trim()
        : segments[1].trim();
  }

  if (!groups[group]) {
    groups[group] = [];
  }

  if (!name.startsWith('_')) {
    groups[group].push({
      name: camelToSentenceCase(name.replace('.tsx', '').replace(/-/g, ' ')),
      path: key.replace('.tsx', ''),
    });
  }
}

export function ExperimentsList(props: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={clsx(classes.list, props.className)}>
      <h2>All experiments</h2>
      {Object.keys(groups)
        .sort()
        .filter((key) => key !== '*')
        .map((group: string) => {
          return (
            <div key={group}>
              <h3>{group}</h3>
              <ul className={classes.groupItems}>
                {groups[group]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((experiment) => (
                    <li key={experiment.path}>
                      <Link href={`/experiments/${experiment.path}`}>{experiment.name}</Link>
                    </li>
                  ))}
              </ul>
            </div>
          );
        })}
      {groups['*'] && (
        <div>
          <h3>Other</h3>
          <ul className={classes.groupItems}>
            {groups['*']
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((experiment) => (
                <li key={experiment.path}>
                  <Link href={`/experiments/${experiment.path}`}>{experiment.name}</Link>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
