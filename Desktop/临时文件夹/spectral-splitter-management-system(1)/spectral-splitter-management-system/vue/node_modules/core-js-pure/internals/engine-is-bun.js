'use strict';
/* global Bun -- Bun case */
module.exports = typeof Bun == 'function' && Bun && typeof Bun.version == 'string';
