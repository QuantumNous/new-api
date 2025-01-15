'use strict';
require('../../modules/es.object.to-string');
require('../../modules/es.array.iterator');
require('../../modules/es.weak-map');
require('../../modules/esnext.weak-map.of');
require('../../modules/esnext.weak-map.delete-all');
require('../../modules/esnext.weak-map.emplace');
var path = require('../../internals/path');

module.exports = path.WeakMap.of;
