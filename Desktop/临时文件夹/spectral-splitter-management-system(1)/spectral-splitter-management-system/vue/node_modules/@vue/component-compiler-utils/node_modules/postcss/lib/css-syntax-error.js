"use strict";

exports.__esModule = true;
exports.default = void 0;

var _picocolors = _interopRequireDefault(require("picocolors"));

var _terminalHighlight = _interopRequireDefault(require("./terminal-highlight"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }

function _wrapNativeSuper(Class) { var _cache = typeof Map === "function" ? new Map() : undefined; _wrapNativeSuper = function _wrapNativeSuper(Class) { if (Class === null || !_isNativeFunction(Class)) return Class; if (typeof Class !== "function") { throw new TypeError("Super expression must either be null or a function"); } if (typeof _cache !== "undefined") { if (_cache.has(Class)) return _cache.get(Class); _cache.set(Class, Wrapper); } function Wrapper() { return _construct(Class, arguments, _getPrototypeOf(this).constructor); } Wrapper.prototype = Object.create(Class.prototype, { constructor: { value: Wrapper, enumerable: false, writable: true, configurable: true } }); return _setPrototypeOf(Wrapper, Class); }; return _wrapNativeSuper(Class); }

function _construct(Parent, args, Class) { if (_isNativeReflectConstruct()) { _construct = Reflect.construct; } else { _construct = function _construct(Parent, args, Class) { var a = [null]; a.push.apply(a, args); var Constructor = Function.bind.apply(Parent, a); var instance = new Constructor(); if (Class) _setPrototypeOf(instance, Class.prototype); return instance; }; } return _construct.apply(null, arguments); }

function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Date.prototype.toString.call(Reflect.construct(Date, [], function () {})); return true; } catch (e) { return false; } }

function _isNativeFunction(fn) { return Function.toString.call(fn).indexOf("[native code]") !== -1; }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

/**
 * The CSS parser throws this error for broken CSS.
 *
 * Custom parsers can throw this error for broken custom syntax using
 * the {@link Node#error} method.
 *
 * PostCSS will use the input source map to detect the original error location.
 * If you wrote a Sass file, compiled it to CSS and then parsed it with PostCSS,
 * PostCSS will show the original position in the Sass file.
 *
 * If you need the position in the PostCSS input
 * (e.g., to debug the previous compiler), use `error.input.file`.
 *
 * @example
 * // Catching and checking syntax error
 * try {
 *   postcss.parse('a{')
 * } catch (error) {
 *   if (error.name === 'CssSyntaxError') {
 *     error //=> CssSyntaxError
 *   }
 * }
 *
 * @example
 * // Raising error from plugin
 * throw node.error('Unknown variable', { plugin: 'postcss-vars' })
 */
var CssSyntaxError = /*#__PURE__*/function (_Error) {
  _inheritsLoose(CssSyntaxError, _Error);

  /**
   * @param {string} message  Error message.
   * @param {number} [line]   Source line of the error.
   * @param {number} [column] Source column of the error.
   * @param {string} [source] Source code of the broken file.
   * @param {string} [file]   Absolute path to the broken file.
   * @param {string} [plugin] PostCSS plugin name, if error came from plugin.
   */
  function CssSyntaxError(message, line, column, source, file, plugin) {
    var _this;

    _this = _Error.call(this, message) || this;
    /**
     * Always equal to `'CssSyntaxError'`. You should always check error type
     * by `error.name === 'CssSyntaxError'`
     * instead of `error instanceof CssSyntaxError`,
     * because npm could have several PostCSS versions.
     *
     * @type {string}
     *
     * @example
     * if (error.name === 'CssSyntaxError') {
     *   error //=> CssSyntaxError
     * }
     */

    _this.name = 'CssSyntaxError';
    /**
     * Error message.
     *
     * @type {string}
     *
     * @example
     * error.message //=> 'Unclosed block'
     */

    _this.reason = message;

    if (file) {
      /**
       * Absolute path to the broken file.
       *
       * @type {string}
       *
       * @example
       * error.file       //=> 'a.sass'
       * error.input.file //=> 'a.css'
       */
      _this.file = file;
    }

    if (source) {
      /**
       * Source code of the broken file.
       *
       * @type {string}
       *
       * @example
       * error.source       //=> 'a { b {} }'
       * error.input.column //=> 'a b { }'
       */
      _this.source = source;
    }

    if (plugin) {
      /**
       * Plugin name, if error came from plugin.
       *
       * @type {string}
       *
       * @example
       * error.plugin //=> 'postcss-vars'
       */
      _this.plugin = plugin;
    }

    if (typeof line !== 'undefined' && typeof column !== 'undefined') {
      /**
       * Source line of the error.
       *
       * @type {number}
       *
       * @example
       * error.line       //=> 2
       * error.input.line //=> 4
       */
      _this.line = line;
      /**
       * Source column of the error.
       *
       * @type {number}
       *
       * @example
       * error.column       //=> 1
       * error.input.column //=> 4
       */

      _this.column = column;
    }

    _this.setMessage();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(_assertThisInitialized(_this), CssSyntaxError);
    }

    return _this;
  }

  var _proto = CssSyntaxError.prototype;

  _proto.setMessage = function setMessage() {
    /**
     * Full error text in the GNU error format
     * with plugin, file, line and column.
     *
     * @type {string}
     *
     * @example
     * error.message //=> 'a.css:1:1: Unclosed block'
     */
    this.message = this.plugin ? this.plugin + ': ' : '';
    this.message += this.file ? this.file : '<css input>';

    if (typeof this.line !== 'undefined') {
      this.message += ':' + this.line + ':' + this.column;
    }

    this.message += ': ' + this.reason;
  }
  /**
   * Returns a few lines of CSS source that caused the error.
   *
   * If the CSS has an input source map without `sourceContent`,
   * this method will return an empty string.
   *
   * @param {boolean} [color] Whether arrow will be colored red by terminal
   *                          color codes. By default, PostCSS will detect
   *                          color support by `process.stdout.isTTY`
   *                          and `process.env.NODE_DISABLE_COLORS`.
   *
   * @example
   * error.showSourceCode() //=> "  4 | }
   *                        //      5 | a {
   *                        //    > 6 |   bad
   *                        //        |   ^
   *                        //      7 | }
   *                        //      8 | b {"
   *
   * @return {string} Few lines of CSS source that caused the error.
   */
  ;

  _proto.showSourceCode = function showSourceCode(color) {
    var _this2 = this;

    if (!this.source) return '';
    var css = this.source;

    if (_terminalHighlight.default) {
      if (typeof color === 'undefined') color = _picocolors.default.isColorSupported;
      if (color) css = (0, _terminalHighlight.default)(css);
    }

    var lines = css.split(/\r?\n/);
    var start = Math.max(this.line - 3, 0);
    var end = Math.min(this.line + 2, lines.length);
    var maxWidth = String(end).length;

    function mark(text) {
      if (color && _picocolors.default.red) {
        return _picocolors.default.red(_picocolors.default.bold(text));
      }

      return text;
    }

    function aside(text) {
      if (color && _picocolors.default.gray) {
        return _picocolors.default.gray(text);
      }

      return text;
    }

    return lines.slice(start, end).map(function (line, index) {
      var number = start + 1 + index;
      var gutter = ' ' + (' ' + number).slice(-maxWidth) + ' | ';

      if (number === _this2.line) {
        var spacing = aside(gutter.replace(/\d/g, ' ')) + line.slice(0, _this2.column - 1).replace(/[^\t]/g, ' ');
        return mark('>') + aside(gutter) + line + '\n ' + spacing + mark('^');
      }

      return ' ' + aside(gutter) + line;
    }).join('\n');
  }
  /**
   * Returns error position, message and source code of the broken part.
   *
   * @example
   * error.toString() //=> "CssSyntaxError: app.css:1:1: Unclosed block
   *                  //    > 1 | a {
   *                  //        | ^"
   *
   * @return {string} Error position, message and source code.
   */
  ;

  _proto.toString = function toString() {
    var code = this.showSourceCode();

    if (code) {
      code = '\n\n' + code + '\n';
    }

    return this.name + ': ' + this.message + code;
  }
  /**
   * @memberof CssSyntaxError#
   * @member {Input} input Input object with PostCSS internal information
   *                       about input file. If input has source map
   *                       from previous tool, PostCSS will use origin
   *                       (for example, Sass) source. You can use this
   *                       object to get PostCSS input source.
   *
   * @example
   * error.input.file //=> 'a.css'
   * error.file       //=> 'a.sass'
   */
  ;

  return CssSyntaxError;
}( /*#__PURE__*/_wrapNativeSuper(Error));

var _default = CssSyntaxError;
exports.default = _default;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNzcy1zeW50YXgtZXJyb3IuZXM2Il0sIm5hbWVzIjpbIkNzc1N5bnRheEVycm9yIiwibWVzc2FnZSIsImxpbmUiLCJjb2x1bW4iLCJzb3VyY2UiLCJmaWxlIiwicGx1Z2luIiwibmFtZSIsInJlYXNvbiIsInNldE1lc3NhZ2UiLCJFcnJvciIsImNhcHR1cmVTdGFja1RyYWNlIiwic2hvd1NvdXJjZUNvZGUiLCJjb2xvciIsImNzcyIsInRlcm1pbmFsSGlnaGxpZ2h0IiwicGljbyIsImlzQ29sb3JTdXBwb3J0ZWQiLCJsaW5lcyIsInNwbGl0Iiwic3RhcnQiLCJNYXRoIiwibWF4IiwiZW5kIiwibWluIiwibGVuZ3RoIiwibWF4V2lkdGgiLCJTdHJpbmciLCJtYXJrIiwidGV4dCIsInJlZCIsImJvbGQiLCJhc2lkZSIsImdyYXkiLCJzbGljZSIsIm1hcCIsImluZGV4IiwibnVtYmVyIiwiZ3V0dGVyIiwic3BhY2luZyIsInJlcGxhY2UiLCJqb2luIiwidG9TdHJpbmciLCJjb2RlIl0sIm1hcHBpbmdzIjoiOzs7OztBQUFBOztBQUVBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUEyQk1BLGM7OztBQUNKOzs7Ozs7OztBQVFBLDBCQUFhQyxPQUFiLEVBQXNCQyxJQUF0QixFQUE0QkMsTUFBNUIsRUFBb0NDLE1BQXBDLEVBQTRDQyxJQUE1QyxFQUFrREMsTUFBbEQsRUFBMEQ7QUFBQTs7QUFDeEQsOEJBQU1MLE9BQU47QUFFQTs7Ozs7Ozs7Ozs7Ozs7QUFhQSxVQUFLTSxJQUFMLEdBQVksZ0JBQVo7QUFDQTs7Ozs7Ozs7O0FBUUEsVUFBS0MsTUFBTCxHQUFjUCxPQUFkOztBQUVBLFFBQUlJLElBQUosRUFBVTtBQUNSOzs7Ozs7Ozs7QUFTQSxZQUFLQSxJQUFMLEdBQVlBLElBQVo7QUFDRDs7QUFDRCxRQUFJRCxNQUFKLEVBQVk7QUFDVjs7Ozs7Ozs7O0FBU0EsWUFBS0EsTUFBTCxHQUFjQSxNQUFkO0FBQ0Q7O0FB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QUNBLFVBQUlXLE1BQU0sS0FBSyxNQUFJLENBQUNuQyxJQUFwQixFQUEwQjtBQUN4QixZQUFJcUMsT0FBTyxHQUNUUCxLQUFLLENBQUNNLE1BQU0sQ0FBQ0UsT0FBUCxDQUFlLEtBQWYsRUFBc0IsR0FBdEIsQ0FBRCxDQUFMLEdBQ0F0QyxJQUFJLENBQUNnQyxLQUFMLENBQVcsQ0FBWCxFQUFjLE1BQUksQ0FBQy9CLE1BQUwsR0FBYyxDQUE1QixFQUErQnFDLE9BQS9CLENBQXVDLFFBQXZDLEVBQWlELEdBQWpELENBRkY7QUFHQSxlQUFPWixJQUFJLENBQUMsR0FBRCxDQUFKLEdBQVlJLEtBQUssQ0FBQ00sTUFBRCxDQUFqQixHQUE0QnBDLElBQTVCLEdBQW1DLEtBQW5DLEdBQTJDcUMsT0FBM0MsR0FBcURYLElBQUksQ0FBQyxHQUFELENBQWhFO0FBQ0Q7O0FBQ0QsYUFBTyxNQUFNSSxLQUFLLENBQUNNLE1BQUQsQ0FBWCxHQUFzQnBDLElBQTdCO0FBQ0QsS0FaSSxFQWFKdUMsSUFiSSxDQWFDLElBYkQsQ0FBUDtBQWNEO0FBRUQ7Ozs7Ozs7Ozs7OztTQVVBQyxRLEdBQUEsb0JBQVk7QUFDVixRQUFJQyxJQUFJLEdBQUcsS0FBSy9CLGNBQUwsRUFBWDs7QUFDQSxRQUFJK0IsSUFBSixFQUFVO0FBQ1JBLE1BQUFBLElBQUksR0FBRyxTQUFTQSxJQUFULEdBQWdCLElBQXZCO0FBQ0Q7O0FBQ0QsV0FBTyxLQUFLcEMsSUFBTCxHQUFZLElBQVosR0FBbUIsS0FBS04sT0FBeEIsR0FBa0MwQyxJQUF6QztBQUNEO0FBRUQ7Ozs7Ozs7Ozs7Ozs7OztpQ0ExTTJCakMsSzs7ZUF3TmRWLGMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcGljbyBmcm9tICdwaWNvY29sb3JzJ1xuXG5pbXBvcnQgdGVybWluYWxIaWdobGlnaHQgZnJvbSAnLi90ZXJtaW5hbC1oaWdobGlnaHQnXG5cbi8qKlxuICogVGhlIENTUyBwYXJzZXIgdGhyb3dzIHRoaXMgZXJyb3IgZm9yIGJyb2tlbiBDU1MuXG4gKlxuICogQ3VzdG9tIHBhcnNlcnMgY2FuIHRocm93IHRoaXMgZXJyb3IgZm9yIGJyb2tlbiBjdXN0b20gc3ludGF4IHVzaW5nXG4gKiB0aGUge0BsaW5rIE5vZGUjZXJyb3J9IG1ldGhvZC5cbiAqXG4gKiBQb3N0Q1NTIHdpbGwgdXNlIHRoZSBpbnB1dCBzb3VyY2UgbWFwIHRvIGRldGVjdCB0aGUgb3JpZ2luYWwgZXJyb3IgbG9jYXRpb24uXG4gKiBJZiB5b3Ugd3JvdGUgYSBTYXNzIGZpbGUsIGNvbXBpbGVkIGl0IHRvIENTUyBhbmQgdGhlbiBwYXJzZWQgaXQgd2l0aCBQb3N0Q1NTLFxuICogUG9zdENTUyB3aWxsIHNob3cgdGhlIG9yaWdpbmFsIHBvc2l0aW9uIGluIHRoZSBTYXNzIGZpbGUuXG4gKlxuICogSWYgeW91IG5lZWQgdGhlIHBvc2l0aW9uIGluIHRoZSBQb3N0Q1NTIGlucHV0XG4gKiAoZS5nLiwgdG8gZGVidWcgdGhlIHByZXZpb3VzIGNvbXBpbGVyKSwgdXNlIGBlcnJvci5pbnB1dC5maWxlYC5cbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gQ2F0Y2hpbmcgYW5kIGNoZWNraW5nIHN5bnRheCBlcnJvclxuICogdHJ5IHtcbiAqICAgcG9zdGNzcy5wYXJzZSgnYXsnKVxuICogfSBjYXRjaCAoZXJyb3IpIHtcbiAqICAgaWYgKGVycm9yLm5hbWUgPT09ICdDc3NTeW50YXhFcnJvcicpIHtcbiAqICAgICBlcnJvciAvLz0+IENzc1N5bnRheEVycm9yXG4gKiAgIH1cbiAqIH1cbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gUmFpc2luZyBlcnJvciBmcm9tIHBsdWdpblxuICogdGhyb3cgbm9kZS5lcnJvcignVW5rbm93biB2YXJpYWJsZScsIHsgcGx1Z2luOiAncG9zdGNzcy12YXJzJyB9KVxuICovXG5jbGFzcyBDc3NTeW50YXhFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgLyoqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlICBFcnJvciBtZXNzYWdlLlxuICAgKiBAcGFyYW0ge251bWJlcn0gW2xpbmVdICAgU291cmNlIGxpbmUgb2YgdGhlIGVycm9yLlxuICAgKiBAcGFyYW0ge251bWJlcn0gW2NvbHVtbl0gU291cmNlIGNvbHVtbiBvZiB0aGUgZXJyb3IuXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBbc291cmNlXSBTb3VyY2UgY29kZSBvZiB0aGUgYnJva2VuIGZpbGUuXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBbZmlsZV0gICBBYnNvbHV0ZSBwYXRoIHRvIHRoZSBicm9rZW4gZmlsZS5cbiAgICogQHBhcmFtIHtzdHJpbmd9IFtwbHVnaW5dIFBvc3RDU1MgcGx1Z2luIG5hbWUsIGlmIGVycm9yIGNhbWUgZnJvbSBwbHVnaW4uXG4gICAqL1xuICBjb25zdHJ1Y3RvciAobWVzc2FnZSwgbGluZSwgY29sdW1uLCBzb3VyY2UsIGZpbGUsIHBsdWdpbikge1xuICAgIHN1cGVyKG1lc3NhZ2UpXG5cbiAgICAvKipcbiAgICAgKiBBbHdheXMgZXF1YWwgdG8gYCdDc3NTeW50YXhFcnJvcidgLiBZb3Ugc2hvdWxkIGFsd2F5cyBjaGVjayBlcnJvciB0eXBlXG4gICAgICogYnkgYGVycm9yLm5hbWUgPT09ICdDc3NTeW50YXhFcnJvcidgXG4gICAgICogaW5zdGVhZCBvZiBgZXJyb3IgaW5zdGFuY2VvZiBDc3NTeW50YXhFcnJvcmAsXG4gICAgICogYmVjYXVzZSBucG0gY291bGQgaGF2ZSBzZXZlcmFsIFBvc3RDU1MgdmVyc2lvbnMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBpZiAoZXJyb3IubmFtZSA9PT0gJ0Nzc1N5bnRheEVycm9yJykge1xuICAgICAqICAgZXJyb3IgLy89PiBDc3NTeW50YXhFcnJvclxuICAgICAqIH1cbiAgICAgKi9cbiAgICB0aGlzLm5hbWUgPSAnQ3NzU3ludGF4RXJyb3InXG4gICAgLyoqXG4gICAgICogRXJyb3IgbWVzc2FnZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVycm9yLm1lc3NhZ2UgLy89PiAnVW5jbG9zZWQgYmxvY2snXG4gICAgICovXG4gICAgdGhpcy5yZWFzb24gPSBtZXNzYWdlXG5cbiAgICBpZiAoZmlsZSkge1xuICAgICAgLyoqXG4gICAgICAgKiBBYnNvbHV0ZSBwYXRoIHRvIHRoZSBicm9rZW4gZmlsZS5cbiAgICAgICAqXG4gICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICpcbiAgICAgICAqIEBleGFtcGxlXG4gICAgICAgKiBlcnJvci5maWxlICAgICAgIC8vPT4gJ2Euc2FzcydcbiAgICAgICAqIGVycm9yLmlucHV0LmZpbGUgLy89PiAnYS5jc3MnXG4gICAgICAgKi9cbiAgICAgIHRoaXMuZmlsZSA9IGZpbGVcbiAgICB9XG4gICAgaWYgKHNvdXJjZSkge1xuICAgICAgLyoqXG4gICAgICAgKiBTb3VyY2UgY29kZSBvZiB0aGUgYnJva2VuIGZpbGUuXG4gICAgICAgKlxuICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAqXG4gICAgICAgKiBAZXhhbXBsZVxuICAgICAgICogZXJyb3Iuc291cmNlICAgICAgIC8vPT4gJ2EgeyBiIHt9IH0nXG4gICAgICAgKiBlcnJvci5pbnB1dC5jb2x1bW4gLy89PiAnYSBiIHsgfSdcbiAgICAgICAqL1xuICAgICAgdGhpcy5zb3VyY2UgPSBzb3VyY2VcbiAgICB9XG4gICAgaWYgKHBsdWdpbikge1xuICAgICAgLyoqXG4gICAgICAgKiBQbHVnaW4gbmFtZSwgaWYgZXJyb3IgY2FtZSBmcm9tIHBsdWdpbi5cbiAgICAgICAqXG4gICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICpcbiAgICAgICAqIEBleGFtcGxlXG4gICAgICAgKiBlcnJvci5wbHVnaW4gLy89PiAncG9zdGNzcy12YXJzJ1xuICAgICAgICovXG4gICAgICB0aGlzLnBsdWdpbiA9IHBsdWdpblxuICAgIH1cbiAgICBpZiAodHlwZW9mIGxpbmUgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBjb2x1bW4gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAvKipcbiAgICAgICAqIFNvdXJjZSBsaW5lIG9mIHRoZSBlcnJvci5cbiAgICAgICAqXG4gICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICpcbiAgICAgICAqIEBleGFtcGxlXG4gICAgICAgKiBlcnJvci5saW5lICAgICAgIC8vPT4gMlxuICAgICAgICogZXJyb3IuaW5wdXQubGluZSAvLz0+IDRcbiAgICAgICAqL1xuICAgICAgdGhpcy5saW5lID0gbGluZVxuICAgICAgLyoqXG4gICAgICAgKiBTb3VyY2UgY29sdW1uIG9mIHRoZSBlcnJvci5cbiAgICAgICAqXG4gICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICpcbiAgICAgICAqIEBleGFtcGxlXG4gICAgICAgKiBlcnJvci5jb2x1bW4gICAgICAgLy89PiAxXG4gICAgICAgKiBlcnJvci5pbnB1dC5jb2x1bW4gLy89PiA0XG4gICAgICAgKi9cbiAgICAgIHRoaXMuY29sdW1uID0gY29sdW1uXG4gICAgfVxuXG4gICAgdGhpcy5zZXRNZXNzYWdlKClcblxuICAgIGlmIChFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSkge1xuICAgICAgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgQ3NzU3ludGF4RXJyb3IpXG4gICAgfVxuICB9XG5cbiAgc2V0TWVzc2FnZSAoKSB7XG4gICAgLyoqXG4gICAgICogRnVsbCBlcnJvciB0ZXh0IGluIHRoZSBHTlUgZXJyb3IgZm9ybWF0XG4gICAgICogd2l0aCBwbHVnaW4sIGZpbGUsIGxpbmUgYW5kIGNvbHVtbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVycm9yLm1lc3NhZ2UgLy89PiAnYS5jc3M6MToxOiBVbmNsb3NlZCBibG9jaydcbiAgICAgKi9cbiAgICB0aGlzLm1lc3NhZ2UgPSB0aGlzLnBsdWdpbiA/IHRoaXMucGx1Z2luICsgJzogJyA6ICcnXG4gICAgdGhpcy5tZXNzYWdlICs9IHRoaXMuZmlsZSA/IHRoaXMuZmlsZSA6ICc8Y3NzIGlucHV0PidcbiAgICBpZiAodHlwZW9mIHRoaXMubGluZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRoaXMubWVzc2FnZSArPSAnOicgKyB0aGlzLmxpbmUgKyAnOicgKyB0aGlzLmNvbHVtblxuICAgIH1cbiAgICB0aGlzLm1lc3NhZ2UgKz0gJzogJyArIHRoaXMucmVhc29uXG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhIGZldyBsaW5lcyBvZiBDU1Mgc291cmNlIHRoYXQgY2F1c2VkIHRoZSBlcnJvci5cbiAgICpcbiAgICogSWYgdGhlIENTUyBoYXMgYW4gaW5wdXQgc291cmNlIG1hcCB3aXRob3V0IGBzb3VyY2VDb250ZW50YCxcbiAgICogdGhpcyBtZXRob2Qgd2lsbCByZXR1cm4gYW4gZW1wdHkgc3RyaW5nLlxuICAgKlxuICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtjb2xvcl0gV2hldGhlciBhcnJvdyB3aWxsIGJlIGNvbG9yZWQgcmVkIGJ5IHRlcm1pbmFsXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xvciBjb2Rlcy4gQnkgZGVmYXVsdCwgUG9zdENTUyB3aWxsIGRldGVjdFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgY29sb3Igc3VwcG9ydCBieSBgcHJvY2Vzcy5zdGRvdXQuaXNUVFlgXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICBhbmQgYHByb2Nlc3MuZW52Lk5PREVfRElTQUJMRV9DT0xPUlNgLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBlcnJvci5zaG93U291cmNlQ29kZSgpIC8vPT4gXCIgIDQgfCB9XG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICA1IHwgYSB7XG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgPiA2IHwgICBiYWRcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgfCAgIF5cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgIDcgfCB9XG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICA4IHwgYiB7XCJcbiAgICpcbiAgICogQHJldHVybiB7c3RyaW5nfSBGZXcgbGluZXMgb2YgQ1NTIHNvdXJjZSB0aGF0IGNhdXNlZCB0aGUgZXJyb3IuXG4gICAqL1xuICBzaG93U291cmNlQ29kZSAoY29sb3IpIHtcbiAgICBpZiAoIXRoaXMuc291cmNlKSByZXR1cm4gJydcblxuICAgIGxldCBjc3MgPSB0aGlzLnNvdXJjZVxuICAgIGlmICh0ZXJtaW5hbEhpZ2hsaWdodCkge1xuICAgICAgaWYgKHR5cGVvZiBjb2xvciA9PT0gJ3VuZGVmaW5lZCcpIGNvbG9yID0gcGljby5pc0NvbG9yU3VwcG9ydGVkXG4gICAgICBpZiAoY29sb3IpIGNzcyA9IHRlcm1pbmFsSGlnaGxpZ2h0KGNzcylcbiAgICB9XG5cbiAgICBsZXQgbGluZXMgPSBjc3Muc3BsaXQoL1xccj9cXG4vKVxuICAgIGxldCBzdGFydCA9IE1hdGgubWF4KHRoaXMubGluZSAtIDMsIDApXG4gICAgbGV0IGVuZCA9IE1hdGgubWluKHRoaXMubGluZSArIDIsIGxpbmVzLmxlbmd0aClcblxuICAgIGxldCBtYXhXaWR0aCA9IFN0cmluZyhlbmQpLmxlbmd0aFxuXG4gICAgZnVuY3Rpb24gbWFyayAodGV4dCkge1xuICAgICAgaWYgKGNvbG9yICYmIHBpY28ucmVkKSB7XG4gICAgICAgIHJldHVybiBwaWNvLnJlZChwaWNvLmJvbGQodGV4dCkpXG4gICAgICB9XG4gICAgICByZXR1cm4gdGV4dFxuICAgIH1cbiAgICBmdW5jdGlvbiBhc2lkZSAodGV4dCkge1xuICAgICAgaWYgKGNvbG9yICYmIHBpY28uZ3JheSkge1xuICAgICAgICByZXR1cm4gcGljby5ncmF5KHRleHQpXG4gICAgICB9XG4gICAgICByZXR1cm4gdGV4dFxuICAgIH1cblxuICAgIHJldHVybiBsaW5lc1xuICAgICAgLnNsaWNlKHN0YXJ0LCBlbmQpXG4gICAgICAubWFwKChsaW5lLCBpbmRleCkgPT4ge1xuICAgICAgICBsZXQgbnVtYmVyID0gc3RhcnQgKyAxICsgaW5kZXhcbiAgICAgICAgbGV0IGd1dHRlciA9ICcgJyArICgnICcgKyBudW1iZXIpLnNsaWNlKC1tYXhXaWR0aCkgKyAnIHwgJ1xuICAgICAgICBpZiAobnVtYmVyID09PSB0aGlzLmxpbmUpIHtcbiAgICAgICAgICBsZXQgc3BhY2luZyA9XG4gICAgICAgICAgICBhc2lkZShndXR0ZXIucmVwbGFjZSgvXFxkL2csICcgJykpICtcbiAgICAgICAgICAgIGxpbmUuc2xpY2UoMCwgdGhpcy5jb2x1bW4gLSAxKS5yZXBsYWNlKC9bXlxcdF0vZywgJyAnKVxuICAgICAgICAgIHJldHVybiBtYXJrKCc+JykgKyBhc2lkZShndXR0ZXIpICsgbGluZSArICdcXG4gJyArIHNwYWNpbmcgKyBtYXJrKCdeJylcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gJyAnICsgYXNpZGUoZ3V0dGVyKSArIGxpbmVcbiAgICAgIH0pXG4gICAgICAuam9pbignXFxuJylcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGVycm9yIHBvc2l0aW9uLCBtZXNzYWdlIGFuZCBzb3VyY2UgY29kZSBvZiB0aGUgYnJva2VuIHBhcnQuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGVycm9yLnRvU3RyaW5nKCkgLy89PiBcIkNzc1N5bnRheEVycm9yOiBhcHAuY3NzOjE6MTogVW5jbG9zZWQgYmxvY2tcbiAgICogICAgICAgICAgICAgICAgICAvLyAgICA+IDEgfCBhIHtcbiAgICogICAgICAgICAgICAgICAgICAvLyAgICAgICAgfCBeXCJcbiAgICpcbiAgICogQHJldHVybiB7c3RyaW5nfSBFcnJvciBwb3NpdGlvbiwgbWVzc2FnZSBhbmQgc291cmNlIGNvZGUuXG4gICAqL1xuICB0b1N0cmluZyAoKSB7XG4gICAgbGV0IGNvZGUgPSB0aGlzLnNob3dTb3VyY2VDb2RlKClcbiAgICBpZiAoY29kZSkge1xuICAgICAgY29kZSA9ICdcXG5cXG4nICsgY29kZSArICdcXG4nXG4gICAgfVxuICAgIHJldHVybiB0aGlzLm5hbWUgKyAnOiAnICsgdGhpcy5tZXNzYWdlICsgY29kZVxuICB9XG5cbiAgLyoqXG4gICAqIEBtZW1iZXJvZiBDc3NTeW50YXhFcnJvciNcbiAgICogQG1lbWJlciB7SW5wdXR9IGlucHV0IElucHV0IG9iamVjdCB3aXRoIFBvc3RDU1MgaW50ZXJuYWwgaW5mb3JtYXRpb25cbiAgICogICAgICAgICAgICAgICAgICAgICAgIGFib3V0IGlucHV0IGZpbGUuIElmIGlucHV0IGhhcyBzb3VyY2UgbWFwXG4gICAqICAgICAgICAgICAgICAgICAgICAgICBmcm9tIHByZXZpb3VzIHRvb2wsIFBvc3RDU1Mgd2lsbCB1c2Ugb3JpZ2luXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAoZm9yIGV4YW1wbGUsIFNhc3MpIHNvdXJjZS4gWW91IGNhbiB1c2UgdGhpc1xuICAgKiAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0IHRvIGdldCBQb3N0Q1NTIGlucHV0IHNvdXJjZS5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogZXJyb3IuaW5wdXQuZmlsZSAvLz0+ICdhLmNzcydcbiAgICogZXJyb3IuZmlsZSAgICAgICAvLz0+ICdhLnNhc3MnXG4gICAqL1xufVxuXG5leHBvcnQgZGVmYXVsdCBDc3NTeW50YXhFcnJvclxuIl0sImZpbGUiOiJjc3Mtc3ludGF4LWVycm9yLmpzIn0=
