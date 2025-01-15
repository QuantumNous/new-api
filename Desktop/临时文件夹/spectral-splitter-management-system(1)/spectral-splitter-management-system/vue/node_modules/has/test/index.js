'use strict';

var test = require('tape');
var has = require('../');

test('has', function (t) {
  t.equal(has({}, 'hasOwnProperty'), false, 'object literal does not have own property "hasOwnProperty"');
  t.equal(has(Object.prototype, 'hasOwnProperty'), true, 'Object.prototype has own property "hasOwnProperty"');
  t['throws'](function () {
    has(null, 'throws');
  }, TypeError, 'calling has on null throws TypeError');
  t['throws'](function () {
    has(void 0, 'throws');
  }, TypeError, 'calling has on undefined throws TypeError');
  t.end();
});
