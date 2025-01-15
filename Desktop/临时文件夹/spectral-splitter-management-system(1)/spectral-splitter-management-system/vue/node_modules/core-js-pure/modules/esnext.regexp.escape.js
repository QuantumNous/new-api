'use strict';
var $ = require('../internals/export');
var uncurryThis = require('../internals/function-uncurry-this');
var toString = require('../internals/to-string');
var WHITESPACES = require('../internals/whitespaces');

var charCodeAt = uncurryThis(''.charCodeAt);
var replace = uncurryThis(''.replace);
var NEED_ESCAPING = RegExp('[!"#$%&\'()*+,\\-./:;<=>?@[\\\\\\]^`{|}~' + WHITESPACES + ']', 'g');

// `RegExp.escape` method
// https://github.com/tc39/proposal-regex-escaping
$({ target: 'RegExp', stat: true, forced: true }, {
  escape: function escape(S) {
    var str = toString(S);
    var firstCode = charCodeAt(str, 0);
    // escape first DecimalDigit
    return (firstCode > 47 && firstCode < 58 ? '\\x3' : '') + replace(str, NEED_ESCAPING, '\\$&');
  }
});
