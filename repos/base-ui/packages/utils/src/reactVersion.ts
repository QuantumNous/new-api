import * as React from 'react';

const majorVersion = parseInt(React.version, 10);

type SupportedVersions = 17 | 18 | 19;

export function isReactVersionAtLeast(reactVersionToCheck: SupportedVersions): boolean {
  return majorVersion >= reactVersionToCheck;
}
