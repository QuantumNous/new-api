'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var compilerSfc = require('@vue/compiler-sfc');



Object.keys(compilerSfc).forEach(function (k) {
	if (k !== 'default' && !exports.hasOwnProperty(k)) Object.defineProperty(exports, k, {
		enumerable: true,
		get: function () { return compilerSfc[k]; }
	});
});
