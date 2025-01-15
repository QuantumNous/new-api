var Marker = require('../tokenizer/marker');

function is(value, separator, isSeparatorRegex) {
  return isSeparatorRegex
    ? separator.test(value)
    : value === separator;
}

function split(value, separator) {
  var openLevel = Marker.OPEN_ROUND_BRACKET;
  var closeLevel = Marker.CLOSE_ROUND_BRACKET;
  var level = 0;
  var cursor = 0;
  var lastStart = 0;
  var lastValue;
  var lastCharacter;
  var len = value.length;
  var parts = [];
  var isSeparatorRegex = typeof (separator) == 'object' && 'exec' in separator;

  if (!isSeparatorRegex && value.indexOf(separator) == -1) {
    return [value];
  }

  if (value.indexOf(openLevel) == -1) {
    return value.split(separator);
  }

  while (cursor < len) {
    if (value[cursor] == openLevel) {
      level++;
    } else if (value[cursor] == closeLevel) {
      level--;
    }

    if (level === 0 && cursor > 0 && cursor + 1 < len && is(value[cursor], separator, isSeparatorRegex)) {
      parts.push(value.substring(lastStart, cursor));

      if (isSeparatorRegex && separator.exec(value[cursor]).length > 1) {
        parts.push(value[cursor]);
      }

      lastStart = cursor + 1;
    }

    cursor++;
  }

  if (lastStart < cursor + 1) {
    lastValue = value.substring(lastStart);
    lastCharacter = lastValue[lastValue.length - 1];
    if (is(lastCharacter, separator, isSeparatorRegex)) {
      lastValue = lastValue.substring(0, lastValue.length - 1);
    }

    parts.push(lastValue);
  }

  return parts;
}

module.exports = split;
