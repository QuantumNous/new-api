var _typeof = require("./typeof.js")["default"];
var _Array$isArray = require("core-js-pure/features/array/is-array.js");
var _Object$getOwnPropertyDescriptor = require("core-js-pure/features/object/get-own-property-descriptor.js");
var _bindInstanceProperty = require("core-js-pure/features/instance/bind.js");
var _pushInstanceProperty = require("core-js-pure/features/instance/push.js");
var _Object$defineProperty = require("core-js-pure/features/object/define-property.js");
var _Symbol$metadata = require("core-js-pure/features/symbol/metadata.js");
var _Symbol$for = require("core-js-pure/features/symbol/for.js");
var _Object$create = require("core-js-pure/features/object/create.js");
var _Map = require("core-js-pure/features/map/index.js");
var checkInRHS = require("./checkInRHS.js");
var setFunctionName = require("./setFunctionName.js");
var toPropertyKey = require("./toPropertyKey.js");
function applyDecs2305(e, t, r, n, o, a) {
  function i(e, t, r) {
    return function (n, o) {
      return r && r(n), e[t].call(n, o);
    };
  }
  function c(e, t) {
    for (var r = 0; r < e.length; r++) e[r].call(t);
    return t;
  }
  function s(e, t, r, n) {
    if ("function" != typeof e && (n || void 0 !== e)) throw new TypeError(t + " must " + (r || "be") + " a function" + (n ? "" : " or undefined"));
    return e;
  }
  function applyDec(e, t, r, n, o, a, c, u, l, f, p, d, h) {
    var _context2;
    function m(e) {
      if (!h(e)) throw new TypeError("Attempted to access private element on non-instance");
    }
    var y,
      v = t[0],
      g = t[3],
      b = !u;
    if (!b) {
      r || _Array$isArray(v) || (v = [v]);
      var w = {},
        S = [],
        A = 3 === o ? "get" : 4 === o || d ? "set" : "value";
      f ? (p || d ? w = {
        get: setFunctionName(function () {
          return g(this);
        }, n, "get"),
        set: function set(e) {
          t[4](this, e);
        }
      } : w[A] = g, p || setFunctionName(w[A], n, 2 === o ? "" : A)) : p || (w = _Object$getOwnPropertyDescriptor(e, n));
    }
    for (var P = e, j = v.length - 1; j >= 0; j -= r ? 2 : 1) {
      var _context;
      var D = v[j],
        E = r ? v[j - 1] : void 0,
        I = {},
        O = {
          kind: ["field", "accessor", "method", "getter", "setter", "class"][o],
          name: n,
          metadata: a,
          addInitializer: _bindInstanceProperty(_context = function _context(e, t) {
            if (e.v) throw Error("attempted to call addInitializer after decoration was finished");
            s(t, "An initializer", "be", !0), _pushInstanceProperty(c).call(c, t);
          }).call(_context, null, I)
        };
      try {
        if (b) (y = s(D.call(E, P, O), "class decorators", "return")) && (P = y);else {
          var k, F;
          O["static"] = l, O["private"] = f, f ? 2 === o ? k = function k(e) {
            return m(e), w.value;
          } : (o < 4 && (k = i(w, "get", m)), 3 !== o && (F = i(w, "set", m))) : (k = function k(e) {
            return e[n];
          }, (o < 2 || 4 === o) && (F = function F(e, t) {
            e[n] = t;
          }));
          var N = O.access = {
            has: f ? _bindInstanceProperty(h).call(h) : function (e) {
              return n in e;
            }
          };
          if (k && (N.get = k), F && (N.set = F), P = D.call(E, d ? {
            get: w.get,
            set: w.set
          } : w[A], O), d) {
            if ("object" == _typeof(P) && P) (y = s(P.get, "accessor.get")) && (w.get = y), (y = s(P.set, "accessor.set")) && (w.set = y), (y = s(P.init, "accessor.init")) && _pushInstanceProperty(S).call(S, y);else if (void 0 !== P) throw new TypeError("accessor decorators must return an object with get, set, or init properties or void 0");
          } else s(P, (p ? "field" : "method") + " decorators", "return") && (p ? _pushInstanceProperty(S).call(S, P) : w[A] = P);
        }
      } finally {
        I.v = !0;
      }
    }
    return (p || d) && _pushInstanceProperty(u).call(u, function (e, t) {
      for (var r = S.length - 1; r >= 0; r--) t = S[r].call(e, t);
      return t;
    }), p || b || (f ? d ? _pushInstanceProperty(u).call(u, i(w, "get"), i(w, "set")) : _pushInstanceProperty(u).call(u, 2 === o ? w[A] : _bindInstanceProperty(_context2 = i.call).call(_context2, w[A])) : _Object$defineProperty(e, n, w)), P;
  }
  function u(e, t) {
    return _Object$defineProperty(e, _Symbol$metadata || _Symbol$for("Symbol.metadata"), {
      configurable: !0,
      enumerable: !0,
      value: t
    });
  }
  if (arguments.length >= 6) var l = a[_Symbol$metadata || _Symbol$for("Symbol.metadata")];
  var f = _Object$create(null == l ? null : l),
    p = function (e, t, r, n) {
      var o,
        a,
        i = [],
        s = function s(t) {
          return checkInRHS(t) === e;
        },
        u = new _Map();
      function l(e) {
        e && _pushInstanceProperty(i).call(i, _bindInstanceProperty(c).call(c, null, e));
      }
      for (var f = 0; f < t.length; f++) {
        var p = t[f];
        if (_Array$isArray(p)) {
          var d = p[1],
            h = p[2],
            m = p.length > 3,
            y = 16 & d,
            v = !!(8 & d),
            g = 0 == (d &= 7),
            b = h + "/" + v;
          if (!g && !m) {
            var w = u.get(b);
            if (!0 === w || 3 === w && 4 !== d || 4 === w && 3 !== d) throw Error("Attempted to decorate a public method/accessor that has the same name as a previously decorated public method/accessor. This is not currently supported by the decorators plugin. Property name was: " + h);
            u.set(b, !(d > 2) || d);
          }
          applyDec(v ? e : e.prototype, p, y, m ? "#" + h : toPropertyKey(h), d, n, v ? a = a || [] : o = o || [], i, v, m, g, 1 === d, v && m ? s : r);
        }
      }
      return l(o), l(a), i;
    }(e, t, o, f);
  return r.length || u(e, f), {
    e: p,
    get c() {
      var t = [];
      return r.length && [u(applyDec(e, [r], n, e.name, 5, f, t), f), _bindInstanceProperty(c).call(c, null, t, e)];
    }
  };
}
module.exports = applyDecs2305, module.exports.__esModule = true, module.exports["default"] = module.exports;