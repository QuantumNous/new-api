var REMOTE_RESOURCE_PATTERN = /^(\w+:\/\/|\/\/)/;
var FILE_RESOURCE_PATTERN = /^file:\/\//;

function isRemoteResource(uri) {
  return REMOTE_RESOURCE_PATTERN.test(uri) && !FILE_RESOURCE_PATTERN.test(uri);
}

module.exports = isRemoteResource;
