var shortenHex = require('./color/shorten-hex');
var shortenHsl = require('./color/shorten-hsl');
var shortenRgb = require('./color/shorten-rgb');

var split = require('../../../utils/split');

var ANY_COLOR_FUNCTION_PATTERN = /(rgb|rgba|hsl|hsla)\(([^()]+)\)/gi;
var COLOR_PREFIX_PATTERN = /#|rgb|hsl/gi;
var HEX_LONG_PATTERN = /(^|[^='"])#([0-9a-f]{6})/gi;
var HEX_SHORT_PATTERN = /(^|[^='"])#([0-9a-f]{3})/gi;
var HEX_VALUE_PATTERN = /[0-9a-f]/i;
var HSL_PATTERN = /hsl\((-?\d+),(-?\d+)%?,(-?\d+)%?\)/gi;
var RGBA_HSLA_PATTERN = /(rgb|hsl)a?\((-?\d+),(-?\d+%?),(-?\d+%?),(0*[1-9]+[0-9]*(\.?\d*)?)\)/gi;
var RGB_PATTERN = /rgb\((-?\d+),(-?\d+),(-?\d+)\)/gi;
var TRANSPARENT_FUNCTION_PATTERN = /(?:rgba|hsla)\(0,0%?,0%?,0\)/g;

var plugin = {
  level1: {
    value: function color(name, value, options) {
      if (!options.compatibility.properties.colors) {
        return value;
      }

      if (!value.match(COLOR_PREFIX_PATTERN)) {
        return shortenHex(value);
      }

      value = value
        .replace(RGBA_HSLA_PATTERN, function(match, colorFn, p1, p2, p3, alpha) {
          return (parseInt(alpha) >= 1 ? colorFn + '(' + [p1, p2, p3].join(',') + ')' : match);
        })
        .replace(RGB_PATTERN, function(match, red, green, blue) {
          return shortenRgb(red, green, blue);
        })
        .replace(HSL_PATTERN, function(match, hue, saturation, lightness) {
          return shortenHsl(hue, saturation, lightness);
        })
        .replace(HEX_LONG_PATTERN, function(match, prefix, color, at, inputValue) {
          var suffix = inputValue[at + match.length];

          if (suffix && HEX_VALUE_PATTERN.test(suffix)) {
            return match;
          } if (color[0] == color[1] && color[2] == color[3] && color[4] == color[5]) {
            return (prefix + '#' + color[0] + color[2] + color[4]).toLowerCase();
          }
          return (prefix + '#' + color).toLowerCase();
        })
        .replace(HEX_SHORT_PATTERN, function(match, prefix, color) {
          return prefix + '#' + color.toLowerCase();
        })
        .replace(ANY_COLOR_FUNCTION_PATTERN, function(match, colorFunction, colorDef) {
          var tokens = colorDef.split(',');
          var colorFnLowercase = colorFunction && colorFunction.toLowerCase();
          var applies = (colorFnLowercase == 'hsl' && tokens.length == 3)
            || (colorFnLowercase == 'hsla' && tokens.length == 4)
            || (colorFnLowercase == 'rgb' && tokens.length === 3 && colorDef.indexOf('%') > 0)
            || (colorFnLowercase == 'rgba' && tokens.length == 4 && tokens[0].indexOf('%') > 0);

          if (!applies) {
            return match;
          }

          if (tokens[1].indexOf('%') == -1) {
            tokens[1] += '%';
          }

          if (tokens[2].indexOf('%') == -1) {
            tokens[2] += '%';
          }

          return colorFunction + '(' + tokens.join(',') + ')';
        });

      if (options.compatibility.colors.opacity && name.indexOf('background') == -1) {
        value = value.replace(TRANSPARENT_FUNCTION_PATTERN, function(match) {
          if (split(value, ',').pop().indexOf('gradient(') > -1) {
            return match;
          }

          return 'transparent';
        });
      }

      return shortenHex(value);
    }
  }
};

module.exports = plugin;
