'use strict';

var _ = require('lodash');
var test = require('tape');
var sum = require('./');

test('creates unique hashes', function (t) {
  var results = [];
  sub([0,1,2,3]);
  sub({url:12});
  sub({headers:12});
  sub({headers:122});
  sub({headers:'122'});
  sub({headers:{accept:'text/plain'}});
  sub({payload:[0,1,2,3],headers:[{a:'b'}]});
  sub({a:function () {}});
  sub({b:function () {}});
  sub({b:function (a) {}});
  sub(function () {});
  sub(function (a) {});
  sub(function (b) {});
  sub(function (a) { return a;});
  sub(function (a) {return a;});
  sub('');
  sub('null');
  sub('false');
  sub('true');
  sub('0');
  sub('1');
  sub('void 0');
  sub('undefined');
  sub(null);
  sub(false);
  sub(true);
  sub(0);
  sub(1);
  sub(void 0);
  sub({});
  sub({a:{},b:{}});
  sub([]);
  sub(new Date());
  sub(global, 'global');
  t.equal(results.length, _.uniq(results).length);
  t.end();

  function sub (value, name) {
    var hash = sum(value);
    results.push(hash);
    console.log('%s from:', hash, name || value);
  }
});

test('hashes clash if same properties', function (t) {
  equals({a:'1'},{a:'1'});
  equals({a:'1',b:1},{b:1,a:'1'});
  t.end();

  function equals (a, b) {
    t.equal(sum(a), sum(b));
  }
});
