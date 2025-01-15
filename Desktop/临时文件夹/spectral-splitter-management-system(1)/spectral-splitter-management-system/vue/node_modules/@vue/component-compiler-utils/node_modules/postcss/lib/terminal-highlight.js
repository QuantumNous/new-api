"use strict";

exports.__esModule = true;
exports.default = void 0;

var _picocolors = _interopRequireDefault(require("picocolors"));

var _tokenize = _interopRequireDefault(require("./tokenize"));

var _input = _interopRequireDefault(require("./input"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var HIGHLIGHT_THEME = {
  brackets: _picocolors.default.cyan,
  'at-word': _picocolors.default.cyan,
  comment: _picocolors.default.gray,
  string: _picocolors.default.green,
  class: _picocolors.default.yellow,
  call: _picocolors.default.cyan,
  hash: _picocolors.default.magenta,
  '(': _picocolors.default.cyan,
  ')': _picocolors.default.cyan,
  '{': _picocolors.default.yellow,
  '}': _picocolors.default.yellow,
  '[': _picocolors.default.yellow,
  ']': _picocolors.default.yellow,
  ':': _picocolors.default.yellow,
  ';': _picocolors.default.yellow
};

function getTokenType(_ref, processor) {
  var type = _ref[0],
      value = _ref[1];

  if (type === 'word') {
    if (value[0] === '.') {
      return 'class';
    }

    if (value[0] === '#') {
      return 'hash';
    }
  }

  if (!processor.endOfFile()) {
    var next = processor.nextToken();
    processor.back(next);
    if (next[0] === 'brackets' || next[0] === '(') return 'call';
  }

  return type;
}

function terminalHighlight(css) {
  var processor = (0, _tokenize.default)(new _input.default(css), {
    ignoreErrors: true
  });
  var result = '';

  var _loop = function _loop() {
    var token = processor.nextToken();
    var color = HIGHLIGHT_THEME[getTokenType(token, processor)];

    if (color) {
      result += token[1].split(/\r?\n/).map(function (i) {
        return color(i);
      }).join('\n');
    } else {
      result += token[1];
    }
  };

  while (!processor.endOfFile()) {
    _loop();
  }

  return result;
}

var _default = terminalHighlight;
exports.default = _default;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInRlcm1pbmFsLWhpZ2hsaWdodC5lczYiXSwibmFtZXMiOlsiSElHSExJR0hUX1RIRU1FIiwiYnJhY2tldHMiLCJwaWNvIiwiY3lhbiIsImNvbW1lbnQiLCJncmF5Iiwic3RyaW5nIiwiZ3JlZW4iLCJjbGFzcyIsInllbGxvdyIsImNhbGwiLCJoYXNoIiwibWFnZW50YSIsImdldFRva2VuVHlwZSIsInByb2Nlc3NvciIsInR5cGUiLCJ2YWx1ZSIsImVuZE9mRmlsZSIsIm5leHQiLCJuZXh0VG9rZW4iLCJiYWNrIiwidGVybWluYWxIaWdobGlnaHQiLCJjc3MiLCJJbnB1dCIsImlnbm9yZUVycm9ycyIsInJlc3VsdCIsInRva2VuIiwiY29sb3IiLCJzcGxpdCIsIm1hcCIsImkiLCJqb2luIl0sIm1hcHBpbmdzIjoiOzs7OztBQUFBOztBQUVBOztBQUNBOzs7O0FBRUEsSUFBTUEsZUFBZSxHQUFHO0FBQ3RCQyxFQUFBQSxRQUFRLEVBQUVDLG9CQUFLQyxJQURPO0FBRXRCLGFBQVdELG9CQUFLQyxJQUZNO0FBR3RCQyxFQUFBQSxPQUFPLEVBQUVGLG9CQUFLRyxJQUhRO0FBSXRCQyxFQUFBQSxNQUFNLEVBQUVKLG9CQUFLSyxLQUpTO0FBS3RCQyxFQUFBQSxLQUFLLEVBQUVOLG9CQUFLTyxNQUxVO0FBTXRCQyxFQUFBQSxJQUFJLEVBQUVSLG9CQUFLQyxJQU5XO0FBT3RCUSxFQUFBQSxJQUFJLEVBQUVULG9CQUFLVSxPQVBXO0FBUXRCLE9BQUtWLG9CQUFLQyxJQVJZO0FBU3RCLE9BQUtELG9CQUFLQyxJQVRZO0FBVXRCLE9BQUtELG9CQUFLTyxNQVZZO0FBV3RCLE9BQUtQLG9CQUFLTyxNQVhZO0FBWXRCLE9BQUtQLG9CQUFLTyxNQVpZO0FBYXRCLE9BQUtQLG9CQUFLTyxNQWJZO0FBY3RCLE9BQUtQLG9CQUFLTyxNQWRZO0FBZXRCLE9BQUtQLG9CQUFLTztBQWZZLENBQXhCOztBQWtCQSxTQUFTSSxZQUFULE9BQXNDQyxTQUF0QyxFQUFpRDtBQUFBLE1BQXpCQyxJQUF5QjtBQUFBLE1BQW5CQyxLQUFtQjs7QUFDL0MsTUFBSUQsSUFBSSxLQUFLLE1BQWIsRUFBcUI7QUFDbkIsUUFBSUMsS0FBSyxDQUFDLENBQUQsQ0FBTCxLQUFhLEdBQWpCLEVBQXNCO0FBQ3BCLGFBQU8sT0FBUDtBQUNEOztBQUNELFFBQUlBLEtBQUssQ0FBQyxDQUFELENBQUwsS0FBYSxHQUFqQixFQUFzQjtBQUNwQixhQUFPLE1BQVA7QUFDRDtBQUNGOztBQUVELE1BQUksQ0FBQ0YsU0FBUyxDQUFDRyxTQUFWLEVBQUwsRUFBNEI7QUFDMUIsUUFBSUMsSUFBSSxHQUFHSixTQUFTLENBQUNLLFNBQVYsRUFBWDtBQUNBTCxJQUFBQSxTQUFTLENBQUNNLElBQVYsQ0FBZUYsSUFBZjtBQUNBLFFBQUlBLElBQUksQ0FBQyxDQUFELENBQUosS0FBWSxVQUFaLElBQTBCQSxJQUFJLENBQUMsQ0FBRCxDQUFKLEtBQVksR0FBMUMsRUFBK0MsT0FBTyxNQUFQO0FBQ2hEOztBQUVELFNBQU9ILElBQVA7QUFDRDs7QUFFRCxTQUFTTSxpQkFBVCxDQUE0QkMsR0FBNUIsRUFBaUM7QUFDL0IsTUFBSVIsU0FBUyxHQUFHLHVCQUFVLElBQUlTLGNBQUosQ0FBVUQsR0FBVixDQUFWLEVBQTBCO0FBQUVFLElBQUFBLFlBQVksRUFBRTtBQUFoQixHQUExQixDQUFoQjtBQUNBLE1BQUlDLE1BQU0sR0FBRyxFQUFiOztBQUYrQjtBQUk3QixRQUFJQyxLQUFLLEdBQUdaLFNBQVMsQ0FBQ0ssU0FBVixFQUFaO0FBQ0EsUUFBSVEsS0FBSyxHQUFHM0IsZUFBZSxDQUFDYSxZQUFZLENBQUNhLEtBQUQsRUFBUVosU0FBUixDQUFiLENBQTNCOztBQUNBLFFBQUlhLEtBQUosRUFBVztBQUNURixNQUFBQSxNQUFNLElBQUlDLEtBQUssQ0FBQyxDQUFELENBQUwsQ0FDUEUsS0FETyxDQUNELE9BREMsRUFFUEMsR0FGTyxDQUVILFVBQUFDLENBQUM7QUFBQSxlQUFJSCxLQUFLLENBQUNHLENBQUQsQ0FBVDtBQUFBLE9BRkUsRUFHUEMsSUFITyxDQUdGLElBSEUsQ0FBVjtBQUlELEtBTEQsTUFLTztBQUNMTixNQUFBQSxNQUFNLElBQUlDLEtBQUssQ0FBQyxDQUFELENBQWY7QUFDRDtBQWI0Qjs7QUFHL0IsU0FBTyxDQUFDWixTQUFTLENBQUNHLFNBQVYsRUFBUixFQUErQjtBQUFBO0FBVzlCOztBQUNELFNBQU9RLE1BQVA7QUFDRDs7ZUFFY0osaUIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcGljbyBmcm9tICdwaWNvY29sb3JzJ1xuXG5pbXBvcnQgdG9rZW5pemVyIGZyb20gJy4vdG9rZW5pemUnXG5pbXBvcnQgSW5wdXQgZnJvbSAnLi9pbnB1dCdcblxuY29uc3QgSElHSExJR0hUX1RIRU1FID0ge1xuICBicmFja2V0czogcGljby5jeWFuLFxuICAnYXQtd29yZCc6IHBpY28uY3lhbixcbiAgY29tbWVudDogcGljby5ncmF5LFxuICBzdHJpbmc6IHBpY28uZ3JlZW4sXG4gIGNsYXNzOiBwaWNvLnllbGxvdyxcbiAgY2FsbDogcGljby5jeWFuLFxuICBoYXNoOiBwaWNvLm1hZ2VudGEsXG4gICcoJzogcGljby5jeWFuLFxuICAnKSc6IHBpY28uY3lhbixcbiAgJ3snOiBwaWNvLnllbGxvdyxcbiAgJ30nOiBwaWNvLnllbGxvdyxcbiAgJ1snOiBwaWNvLnllbGxvdyxcbiAgJ10nOiBwaWNvLnllbGxvdyxcbiAgJzonOiBwaWNvLnllbGxvdyxcbiAgJzsnOiBwaWNvLnllbGxvd1xufVxuXG5mdW5jdGlvbiBnZXRUb2tlblR5cGUgKFt0eXBlLCB2YWx1ZV0sIHByb2Nlc3Nvcikge1xuICBpZiAodHlwZSA9PT0gJ3dvcmQnKSB7XG4gICAgaWYgKHZhbHVlWzBdID09PSAnLicpIHtcbiAgICAgIHJldHVybiAnY2xhc3MnXG4gICAgfVxuICAgIGlmICh2YWx1ZVswXSA9PT0gJyMnKSB7XG4gICAgICByZXR1cm4gJ2hhc2gnXG4gICAgfVxuICB9XG5cbiAgaWYgKCFwcm9jZXNzb3IuZW5kT2ZGaWxlKCkpIHtcbiAgICBsZXQgbmV4dCA9IHByb2Nlc3Nvci5uZXh0VG9rZW4oKVxuICAgIHByb2Nlc3Nvci5iYWNrKG5leHQpXG4gICAgaWYgKG5leHRbMF0gPT09ICdicmFja2V0cycgfHwgbmV4dFswXSA9PT0gJygnKSByZXR1cm4gJ2NhbGwnXG4gIH1cblxuICByZXR1cm4gdHlwZVxufVxuXG5mdW5jdGlvbiB0ZXJtaW5hbEhpZ2hsaWdodCAoY3NzKSB7XG4gIGxldCBwcm9jZXNzb3IgPSB0b2tlbml6ZXIobmV3IElucHV0KGNzcyksIHsgaWdub3JlRXJyb3JzOiB0cnVlIH0pXG4gIGxldCByZXN1bHQgPSAnJ1xuICB3aGlsZSAoIXByb2Nlc3Nvci5lbmRPZkZpbGUoKSkge1xuICAgIGxldCB0b2tlbiA9IHByb2Nlc3Nvci5uZXh0VG9rZW4oKVxuICAgIGxldCBjb2xvciA9IEhJR0hMSUdIVF9USEVNRVtnZXRUb2tlblR5cGUodG9rZW4sIHByb2Nlc3NvcildXG4gICAgaWYgKGNvbG9yKSB7XG4gICAgICByZXN1bHQgKz0gdG9rZW5bMV1cbiAgICAgICAgLnNwbGl0KC9cXHI/XFxuLylcbiAgICAgICAgLm1hcChpID0+IGNvbG9yKGkpKVxuICAgICAgICAuam9pbignXFxuJylcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ICs9IHRva2VuWzFdXG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHRcbn1cblxuZXhwb3J0IGRlZmF1bHQgdGVybWluYWxIaWdobGlnaHRcbiJdLCJmaWxlIjoidGVybWluYWwtaGlnaGxpZ2h0LmpzIn0=
