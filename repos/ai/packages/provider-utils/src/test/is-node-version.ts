function getNodeVersionParts() {
  return process.versions.node
    .split('.')
    .map(version => Number.parseInt(version, 10));
}

export function isNodeVersion(version: number) {
  const [nodeMajorVersion] = getNodeVersionParts();
  return nodeMajorVersion === version;
}

export function isNodeVersionAtLeast(major: number, minor = 0, patch = 0) {
  const [nodeMajorVersion, nodeMinorVersion, nodePatchVersion] =
    getNodeVersionParts();

  if (nodeMajorVersion !== major) {
    return nodeMajorVersion > major;
  }

  if (nodeMinorVersion !== minor) {
    return nodeMinorVersion > minor;
  }

  return nodePatchVersion >= patch;
}
