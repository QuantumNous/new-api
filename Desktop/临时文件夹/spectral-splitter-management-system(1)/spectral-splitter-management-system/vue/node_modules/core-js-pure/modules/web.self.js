'use strict';
var $ = require('../internals/export');
var global = require('../internals/global');

// `self` getter
// https://html.spec.whatwg.org/multipage/window-object.html#dom-self
$({ global: true, forced: global.self !== global }, {
  self: global
});
