'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _string = require('./string');

var _string2 = _interopRequireDefault(_string);

var _method = require('./method');

var _method2 = _interopRequireDefault(_method);

var _number = require('./number');

var _number2 = _interopRequireDefault(_number);

var _boolean = require('./boolean');

var _boolean2 = _interopRequireDefault(_boolean);

var _regexp = require('./regexp');

var _regexp2 = _interopRequireDefault(_regexp);

var _integer = require('./integer');

var _integer2 = _interopRequireDefault(_integer);

var _float = require('./float');

var _float2 = _interopRequireDefault(_float);

var _array = require('./array');

var _array2 = _interopRequireDefault(_array);

var _object = require('./object');

var _object2 = _interopRequireDefault(_object);

var _enum = require('./enum');

var _enum2 = _interopRequireDefault(_enum);

var _pattern = require('./pattern');

var _pattern2 = _interopRequireDefault(_pattern);

var _date = require('./date');

var _date2 = _interopRequireDefault(_date);

var _required = require('./required');

var _required2 = _interopRequireDefault(_required);

var _type = require('./type');

var _type2 = _interopRequireDefault(_type);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

exports['default'] = {
  string: _string2['default'],
  method: _method2['default'],
  number: _number2['default'],
  boolean: _boolean2['default'],
  regexp: _regexp2['default'],
  integer: _integer2['default'],
  float: _float2['default'],
  array: _array2['default'],
  object: _object2['default'],
  'enum': _enum2['default'],
  pattern: _pattern2['default'],
  date: _date2['default'],
  url: _type2['default'],
  hex: _type2['default'],
  email: _type2['default'],
  required: _required2['default']
};
module.exports = exports['default'];