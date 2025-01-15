'use strict';
var $ = require('../internals/export');
var f16round = require('../internals/math-f16round');

// `Math.f16round` method
// https://github.com/tc39/proposal-float16array
$({ target: 'Math', stat: true }, { f16round: f16round });
