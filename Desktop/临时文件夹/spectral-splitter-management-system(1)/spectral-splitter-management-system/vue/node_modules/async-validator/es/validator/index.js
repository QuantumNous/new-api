import string from './string';
import method from './method';
import number from './number';
import boolean from './boolean';
import regexp from './regexp';
import integer from './integer';
import float from './float';
import array from './array';
import object from './object';
import enumValidator from './enum';
import pattern from './pattern';
import date from './date';
import required from './required';
import type from './type';

export default {
  string: string,
  method: method,
  number: number,
  boolean: boolean,
  regexp: regexp,
  integer: integer,
  float: float,
  array: array,
  object: object,
  'enum': enumValidator,
  pattern: pattern,
  date: date,
  url: type,
  hex: type,
  email: type,
  required: required
};