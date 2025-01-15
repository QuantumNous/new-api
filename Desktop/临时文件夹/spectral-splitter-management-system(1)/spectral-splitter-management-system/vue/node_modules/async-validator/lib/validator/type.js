'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _rule = require('../rule/');

var _rule2 = _interopRequireDefault(_rule);

var _util = require('../util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function type(rule, value, callback, source, options) {
  var ruleType = rule.type;
  var errors = [];
  var validate = rule.required || !rule.required && source.hasOwnProperty(rule.field);
  if (validate) {
    if ((0, _util.isEmptyValue)(value, ruleType) && !rule.required) {
      return callback();
    }
    _rule2['default'].required(rule, value, source, errors, options, ruleType);
    if (!(0, _util.isEmptyValue)(value, ruleType)) {
      _rule2['default'].type(rule, value, source, errors, options);
    }
  }
  callback(errors);
}

exports['default'] = type;
module.exports = exports['default'];