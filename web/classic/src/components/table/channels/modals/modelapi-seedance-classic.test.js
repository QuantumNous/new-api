import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const editChannelModalSource = readFileSync(
  join(currentDir, 'EditChannelModal.jsx'),
  'utf8',
);
const renderHelperSource = readFileSync(
  join(currentDir, '../../../../helpers/render.jsx'),
  'utf8',
);

describe('ModelAPISeedance classic channel metadata', () => {
  test('uses the generic provider API key prompt for channel 111', () => {
    expect(editChannelModalSource).toMatch(
      /case 111:\s*return 'API key from the provider';/,
    );
  });

  test('renders the Doubao icon for channel 111', () => {
    expect(renderHelperSource).toMatch(
      /case 111:[\s\S]*?return <Doubao\.Color size=\{iconSize\} \/>;/,
    );
  });
});
