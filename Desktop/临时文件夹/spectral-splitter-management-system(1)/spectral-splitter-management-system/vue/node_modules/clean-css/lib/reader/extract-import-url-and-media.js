var split = require('../utils/split');

var BRACE_PREFIX = /^\(/;
var BRACE_SUFFIX = /\)$/;
var IMPORT_PREFIX_PATTERN = /^@import/i;
var QUOTE_PREFIX_PATTERN = /['"]\s{0,31}/;
var QUOTE_SUFFIX_PATTERN = /\s{0,31}['"]/;
var URL_PREFIX_PATTERN = /^url\(\s{0,31}/i;
var URL_SUFFIX_PATTERN = /\s{0,31}\)/i;

function extractImportUrlAndMedia(atRuleValue) {
  var uri;
  var mediaQuery;
  var normalized;
  var parts;

  normalized = atRuleValue
    .replace(IMPORT_PREFIX_PATTERN, '')
    .trim()
    .replace(URL_PREFIX_PATTERN, '(')
    .replace(URL_SUFFIX_PATTERN, ') ')
    .replace(QUOTE_PREFIX_PATTERN, '')
    .replace(QUOTE_SUFFIX_PATTERN, '');

  parts = split(normalized, ' ');

  uri = parts[0]
    .replace(BRACE_PREFIX, '')
    .replace(BRACE_SUFFIX, '');
  mediaQuery = parts.slice(1).join(' ');

  return [uri, mediaQuery];
}

module.exports = extractImportUrlAndMedia;
