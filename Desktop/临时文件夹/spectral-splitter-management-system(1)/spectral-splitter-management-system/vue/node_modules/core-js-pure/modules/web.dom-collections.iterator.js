'use strict';
require('../modules/es.array.iterator');
var DOMIterables = require('../internals/dom-iterables');
var global = require('../internals/global');
var setToStringTag = require('../internals/set-to-string-tag');
var Iterators = require('../internals/iterators');

for (var COLLECTION_NAME in DOMIterables) {
  setToStringTag(global[COLLECTION_NAME], COLLECTION_NAME);
  Iterators[COLLECTION_NAME] = Iterators.Array;
}
