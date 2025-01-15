# throttle-debounce

[![Build Status][ci-img]][ci]

Throttle/debounce your functions.

This module is the same as [jquery-throttle-debounce][jquery-throttle-debounce] ([with some differences](#differences-with-original-module)), but it’s transferred to CommonJS so it can be easily used with tools like Browserify or Webpack.

## Install

```sh
npm install throttle-debounce --save
```

## Usage

```js
var throttle = require('throttle-debounce/throttle');
var debounce = require('throttle-debounce/debounce');

throttle(300, function () {
	// Throttled function
});

debounce(300, function () {
	// Debounced function
});
```

## API

### throttle(delay, noTrailing, callback, debounceMode)

Returns: `Function`

Throttle execution of a function. Especially useful for rate limiting execution of handlers on events like resize and scroll.

#### delay

Type: `Number`

A zero-or-greater delay in milliseconds. For event callbacks, values around 100 or 250 (or even higher) are most useful.

#### noTrailing

Type: `Boolean`

Optional, defaults to false. If noTrailing is true, callback will only execute every `delay` milliseconds while the throttled-function is being called. If noTrailing is false or unspecified, callback will be executed one final time after the last throttled-function call. (After the throttled-function has not been called for `delay` milliseconds, the internal counter is reset)

#### callback

Type: `Function`

A function to be executed after delay milliseconds. The `this` context and all arguments are passed through, as-is, to `callback` when the throttled-function is executed.

#### debounceMode

Type: `Boolean`

If `debounceMode` is true (at begin), schedule `clear` to execute after `delay` ms. If `debounceMode` is false (at end), schedule `callback` to execute after `delay` ms.

### debounce(delay, atBegin, callback)

Returns: `Function`

Debounce execution of a function. Debouncing, unlike throttling, guarantees that a function is only executed a single time, either at the very beginning of a series of calls, or at the very end.

#### delay

Type: `Number`

A zero-or-greater delay in milliseconds. For event callbacks, values around 100 or 250 (or even higher) are most useful.

#### atBegin

Type: `Boolean`

Optional, defaults to false. If `atBegin` is false or unspecified, callback will only be executed `delay` milliseconds after the last debounced-function call. If `atBegin` is true, callback will be executed only at the first debounced-function call. (After the throttled-function has not been called for `delay` milliseconds, the internal counter is reset).

#### callback

Type: `Function`

A function to be executed after delay milliseconds. The `this` context and all arguments are passed through, as-is, to `callback` when the debounced-function is executed.

## Differences with original module

* Dependancy on jQuery is removed, so if you rely on GUIDs set by jQuery, plan accordingly
* There is no standalone version available, so don’t rely on `$.throttle` and `$.debounce` to be available

## Browser support

Tested in IE8+ and all modern browsers.

## License

**Original module license:** Copyright (c) 2010 "Cowboy" Ben Alman (Dual licensed under the MIT and GPL licenses. http://benalman.com/about/license/)  
**This module license:** MIT © [Ivan Nikolić](http://ivannikolic.com)

[ci]: https://travis-ci.org/niksy/throttle-debounce
[ci-img]: https://img.shields.io/travis/niksy/throttle-debounce/master.svg
[jquery-throttle-debounce]: https://github.com/cowboy/jquery-throttle-debounce
