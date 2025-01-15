"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.replacer = replacer;
exports.reviver = reviver;

function replacer(_key, value) {
  if (value instanceof RegExp) {
    return {
      __serialized_type: 'RegExp',
      source: value.source,
      flags: value.flags
    };
  }

  return value;
}

function reviver(_key, value) {
  if (typeof value === 'object' && value !== null) {
    // eslint-disable-next-line no-underscore-dangle
    if (value.__serialized_type === 'RegExp') {
      return new RegExp(value.source, value.flags);
    }
  }

  return value;
}