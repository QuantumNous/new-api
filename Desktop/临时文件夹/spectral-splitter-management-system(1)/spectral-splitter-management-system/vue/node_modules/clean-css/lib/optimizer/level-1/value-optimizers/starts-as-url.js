var URL_PREFIX_PATTERN = /^url\(/i;

function startsAsUrl(value) {
  return URL_PREFIX_PATTERN.test(value);
}

module.exports = startsAsUrl;
