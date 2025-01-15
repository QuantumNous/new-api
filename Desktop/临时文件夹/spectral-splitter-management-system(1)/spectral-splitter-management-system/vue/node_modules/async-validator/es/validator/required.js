import _typeof from 'babel-runtime/helpers/typeof';
import rules from '../rule/';

function required(rule, value, callback, source, options) {
  var errors = [];
  var type = Array.isArray(value) ? 'array' : typeof value === 'undefined' ? 'undefined' : _typeof(value);
  rules.required(rule, value, source, errors, options, type);
  callback(errors);
}

export default required;