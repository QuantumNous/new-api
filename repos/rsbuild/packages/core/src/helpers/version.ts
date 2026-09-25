export const rspackMinVersion = '2.0.0';

const compareSemver = (version1: string, version2: string) => {
  const parts1 = version1.split('.').map(Number);
  const parts2 = version2.split('.').map(Number);
  const len = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < len; i++) {
    const item1 = parts1[i] ?? 0;
    const item2 = parts2[i] ?? 0;
    if (item1 > item2) {
      return 1;
    }
    if (item1 < item2) {
      return -1;
    }
  }

  return 0;
};

/**
 * If the application overrides the Rspack version to a lower one,
 * we should check that the Rspack version is greater than the minimum
 * supported version.
 */
export const isSatisfyRspackVersion = (originalVersion: string): boolean => {
  let version = originalVersion;

  // The nightly version of Rspack is to append `-canary-abc` to the current version
  if (version.includes('-canary')) {
    version = version.split('-canary')[0];
  }

  if (version && /^[\d.]+$/.test(version)) {
    return compareSemver(version, rspackMinVersion) >= 0;
  }

  // ignore other unstable versions
  return true;
};
