/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

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

  test('clears proxy in type 111 submit payloads', () => {
    expect(editChannelModalSource).toContain(
      "proxy: localInputs.type === 111 ? '' : localInputs.proxy || '',",
    );
  });

  test('hides proxy input for type 111 channels', () => {
    const guardIndex = editChannelModalSource.indexOf(
      '{inputs.type !== 111 && (',
    );
    const proxyFieldIndex = editChannelModalSource.indexOf(
      "field='proxy'",
      guardIndex,
    );
    expect(guardIndex).toBeGreaterThan(-1);
    expect(proxyFieldIndex).toBeGreaterThan(guardIndex);
  });
});
