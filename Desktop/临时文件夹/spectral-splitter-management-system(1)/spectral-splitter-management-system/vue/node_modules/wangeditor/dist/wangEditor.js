(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["wangEditor"] = factory();
	else
		root["wangEditor"] = factory();
})(window, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 141);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports) {

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : {
    "default": obj
  };
}

module.exports = _interopRequireDefault;

/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(142);

/***/ }),
/* 2 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "__extends", function() { return __extends; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "__assign", function() { return __assign; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "__rest", function() { return __rest; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "__decorate", function() { return __decorate; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "__param", function() { return __param; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "__metadata", function() { return __metadata; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "__awaiter", function() { return __awaiter; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "__generator", function() { return __generator; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "__createBinding", function() { return __createBinding; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "__exportStar", function() { return __exportStar; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "__values", function() { return __values; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "__read", function() { return __read; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "__spread", function() { return __spread; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "__spreadArrays", function() { return __spreadArrays; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "__spreadArray", function() { return __spreadArray; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "__await", function() { return __await; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "__asyncGenerator", function() { return __asyncGenerator; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "__asyncDelegator", function() { return __asyncDelegator; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "__asyncValues", function() { return __asyncValues; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "__makeTemplateObject", function() { return __makeTemplateObject; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "__importStar", function() { return __importStar; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "__importDefault", function() { return __importDefault; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "__classPrivateFieldGet", function() { return __classPrivateFieldGet; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "__classPrivateFieldSet", function() { return __classPrivateFieldSet; });
/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics = function(d, b) {
    extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
    return extendStatics(d, b);
};

function __extends(d, b) {
    if (typeof b !== "function" && b !== null)
        throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
    extendStatics(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

var __assign = function() {
    __assign = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    }
    return __assign.apply(this, arguments);
}

function __rest(s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
}

function __decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}

function __param(paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
}

function __metadata(metadataKey, metadataValue) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
}

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function __generator(thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
}

var __createBinding = Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});

function __exportStar(m, o) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(o, p)) __createBinding(o, m, p);
}

function __values(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
}

function __read(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
}

/** @deprecated */
function __spread() {
    for (var ar = [], i = 0; i < arguments.length; i++)
        ar = ar.concat(__read(arguments[i]));
    return ar;
}

/** @deprecated */
function __spreadArrays() {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
}

function __spreadArray(to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
}

function __await(v) {
    return this instanceof __await ? (this.v = v, this) : new __await(v);
}

function __asyncGenerator(thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
}

function __asyncDelegator(o) {
    var i, p;
    return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
    function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: n === "return" } : f ? f(v) : v; } : f; }
}

function __asyncValues(o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
}

function __makeTemplateObject(cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};

var __setModuleDefault = Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
};

function __importStar(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
}

function __importDefault(mod) {
    return (mod && mod.__esModule) ? mod : { default: mod };
}

function __classPrivateFieldGet(receiver, privateMap) {
    if (!privateMap.has(receiver)) {
        throw new TypeError("attempted to get private field on non-instance");
    }
    return privateMap.get(receiver);
}

function __classPrivateFieldSet(receiver, privateMap, value) {
    if (!privateMap.has(receiver)) {
        throw new TypeError("attempted to set private field on non-instance");
    }
    privateMap.set(receiver, value);
    return value;
}


/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 封装 DOM 操作
 * @wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _isArray = _interopRequireDefault(__webpack_require__(89));

var _forEach = _interopRequireDefault(__webpack_require__(4));

var _map = _interopRequireDefault(__webpack_require__(26));

var _trim = _interopRequireDefault(__webpack_require__(17));

var _map2 = _interopRequireDefault(__webpack_require__(121));

var _indexOf = _interopRequireDefault(__webpack_require__(27));

var _splice = _interopRequireDefault(__webpack_require__(91));

var _filter = _interopRequireDefault(__webpack_require__(70));

var _includes = _interopRequireDefault(__webpack_require__(28));

var _bind = _interopRequireDefault(__webpack_require__(57));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.DomElement = void 0;

var tslib_1 = __webpack_require__(2);

var util_1 = __webpack_require__(6);

var AGENT_EVENTS = [];
/**
 * 根据 html 字符串创建 elem
 * @param {String} html html
 */

function _createElemByHTML(html) {
  var div = document.createElement('div');
  div.innerHTML = html;
  var elems = div.children;
  return util_1.toArray(elems);
}
/**
 * 判断是否是 DOM List
 * @param selector DOM 元素或列表
 */


function _isDOMList(selector) {
  if (!selector) {
    return false;
  }

  if (selector instanceof HTMLCollection || selector instanceof NodeList) {
    return true;
  }

  return false;
}
/**
 * 封装 querySelectorAll
 * @param selector css 选择器
 */


function _querySelectorAll(selector) {
  var elems = document.querySelectorAll(selector);
  return util_1.toArray(elems);
}
/**
 * 封装 _styleArrTrim
 * @param styleArr css
 */


function _styleArrTrim(style) {
  var styleArr = [];
  var resultArr = [];

  if (!(0, _isArray["default"])(style)) {
    // 有 style，将 style 按照 `;` 拆分为数组
    styleArr = style.split(';');
  } else {
    styleArr = style;
  }

  (0, _forEach["default"])(styleArr).call(styleArr, function (item) {
    var _context;

    // 对每项样式，按照 : 拆分为 key 和 value
    var arr = (0, _map["default"])(_context = item.split(':')).call(_context, function (i) {
      return (0, _trim["default"])(i).call(i);
    });

    if (arr.length === 2) {
      resultArr.push(arr[0] + ':' + arr[1]);
    }
  });
  return resultArr;
} // 构造函数


var DomElement =
/** @class */
function () {
  /**
   * 构造函数
   * @param selector 任一类型的选择器
   */
  function DomElement(selector) {
    // 初始化属性
    this.elems = [];
    this.length = this.elems.length;
    this.dataSource = new _map2["default"]();

    if (!selector) {
      return;
    } // 原本就是 DomElement 实例，则直接返回


    if (selector instanceof DomElement) {
      return selector;
    }

    var selectorResult = []; // 存储查询结果

    var nodeType = selector instanceof Node ? selector.nodeType : -1;
    this.selector = selector;

    if (nodeType === 1 || nodeType === 9) {
      selectorResult = [selector];
    } else if (_isDOMList(selector)) {
      // DOM List
      selectorResult = util_1.toArray(selector);
    } else if (selector instanceof Array) {
      // Element 数组（其他数据类型，暂时忽略）
      selectorResult = selector;
    } else if (typeof selector === 'string') {
      var _context2;

      // 字符串
      var tmpSelector = (0, _trim["default"])(_context2 = selector.replace('/\n/mg', '')).call(_context2);

      if ((0, _indexOf["default"])(tmpSelector).call(tmpSelector, '<') === 0) {
        // 如 <div>
        selectorResult = _createElemByHTML(tmpSelector);
      } else {
        // 如 #id .class
        selectorResult = _querySelectorAll(tmpSelector);
      }
    }

    var length = selectorResult.length;

    if (!length) {
      // 空数组
      return this;
    } // 加入 DOM 节点


    var i = 0;

    for (; i < length; i++) {
      this.elems.push(selectorResult[i]);
    }

    this.length = length;
  }

  (0, _defineProperty["default"])(DomElement.prototype, "id", {
    /**
     * 获取元素 id
     */
    get: function get() {
      return this.elems[0].id;
    },
    enumerable: false,
    configurable: true
  });
  /**
   * 遍历所有元素，执行回调函数
   * @param fn 回调函数
   */

  DomElement.prototype.forEach = function (fn) {
    for (var i = 0; i < this.length; i++) {
      var elem = this.elems[i];
      var result = fn.call(elem, elem, i);

      if (result === false) {
        break;
      }
    }

    return this;
  };
  /**
   * 克隆元素
   * @param deep 是否深度克隆
   */


  DomElement.prototype.clone = function (deep) {
    var _context3;

    if (deep === void 0) {
      deep = false;
    }

    var cloneList = [];
    (0, _forEach["default"])(_context3 = this.elems).call(_context3, function (elem) {
      cloneList.push(elem.cloneNode(!!deep));
    });
    return $(cloneList);
  };
  /**
   * 获取第几个元素
   * @param index index
   */


  DomElement.prototype.get = function (index) {
    if (index === void 0) {
      index = 0;
    }

    var length = this.length;

    if (index >= length) {
      index = index % length;
    }

    return $(this.elems[index]);
  };
  /**
   * 获取第一个元素
   */


  DomElement.prototype.first = function () {
    return this.get(0);
  };
  /**
   * 获取最后一个元素
   */


  DomElement.prototype.last = function () {
    var length = this.length;
    return this.get(length - 1);
  };

  DomElement.prototype.on = function (type, selector, fn) {
    var _context4;

    if (!type) return this; // 没有 selector ，只有 type 和 fn

    if (typeof selector === 'function') {
      fn = selector;
      selector = '';
    }

    return (0, _forEach["default"])(_context4 = this).call(_context4, function (elem) {
      // 没有事件代理
      if (!selector) {
        // 无代理
        elem.addEventListener(type, fn);
        return;
      } // 有事件代理


      var agentFn = function agentFn(e) {
        var target = e.target;

        if (target.matches(selector)) {
          ;
          fn.call(target, e);
        }
      };

      elem.addEventListener(type, agentFn); // 缓存代理事件

      AGENT_EVENTS.push({
        elem: elem,
        selector: selector,
        fn: fn,
        agentFn: agentFn
      });
    });
  };

  DomElement.prototype.off = function (type, selector, fn) {
    var _context5;

    if (!type) return this; // 没有 selector ，只有 type 和 fn

    if (typeof selector === 'function') {
      fn = selector;
      selector = '';
    }

    return (0, _forEach["default"])(_context5 = this).call(_context5, function (elem) {
      // 解绑事件代理
      if (selector) {
        var idx = -1;

        for (var i = 0; i < AGENT_EVENTS.length; i++) {
          var item = AGENT_EVENTS[i];

          if (item.selector === selector && item.fn === fn && item.elem === elem) {
            idx = i;
            break;
          }
        }

        if (idx !== -1) {
          var agentFn = (0, _splice["default"])(AGENT_EVENTS).call(AGENT_EVENTS, idx, 1)[0].agentFn;
          elem.removeEventListener(type, agentFn);
        }
      } else {
        // @ts-ignore
        elem.removeEventListener(type, fn);
      }
    });
  };

  DomElement.prototype.attr = function (key, val) {
    var _context6;

    if (val == null) {
      // 获取数据
      return this.elems[0].getAttribute(key) || '';
    } // 否则，设置属性


    return (0, _forEach["default"])(_context6 = this).call(_context6, function (elem) {
      elem.setAttribute(key, val);
    });
  };
  /**
   * 删除 属性
   * @param key key
   */


  DomElement.prototype.removeAttr = function (key) {
    var _context7;

    (0, _forEach["default"])(_context7 = this).call(_context7, function (elem) {
      elem.removeAttribute(key);
    });
  };
  /**
   * 添加 css class
   * @param className css class
   */


  DomElement.prototype.addClass = function (className) {
    var _context8;

    if (!className) {
      return this;
    }

    return (0, _forEach["default"])(_context8 = this).call(_context8, function (elem) {
      if (elem.className) {
        // 当前有 class
        var arr = elem.className.split(/\s/);
        arr = (0, _filter["default"])(arr).call(arr, function (item) {
          return !!(0, _trim["default"])(item).call(item);
        }); // 添加 class

        if ((0, _indexOf["default"])(arr).call(arr, className) < 0) {
          arr.push(className);
        } // 修改 elem.class


        elem.className = arr.join(' ');
      } else {
        // 当前没有 class
        elem.className = className;
      }
    });
  };
  /**
   * 添加 css class
   * @param className css class
   */


  DomElement.prototype.removeClass = function (className) {
    var _context9;

    if (!className) {
      return this;
    }

    return (0, _forEach["default"])(_context9 = this).call(_context9, function (elem) {
      if (!elem.className) {
        // 当前无 class
        return;
      }

      var arr = elem.className.split(/\s/);
      arr = (0, _filter["default"])(arr).call(arr, function (item) {
        item = (0, _trim["default"])(item).call(item); // 删除 class

        if (!item || item === className) {
          return false;
        }

        return true;
      }); // 修改 elem.class

      elem.className = arr.join(' ');
    });
  };
  /**
   * 是否有传入的 css class
   * @param className css class
   */


  DomElement.prototype.hasClass = function (className) {
    if (!className) {
      return false;
    }

    var elem = this.elems[0];

    if (!elem.className) {
      // 当前无 class
      return false;
    }

    var arr = elem.className.split(/\s/);
    return (0, _includes["default"])(arr).call(arr, className); // 是否包含
  };
  /**
   * 修改 css
   * @param key css key
   * @param val css value
   */
  // css(key: string): string


  DomElement.prototype.css = function (key, val) {
    var _context10;

    var currentStyle;

    if (val == '') {
      currentStyle = '';
    } else {
      currentStyle = key + ":" + val + ";";
    }

    return (0, _forEach["default"])(_context10 = this).call(_context10, function (elem) {
      var _context11;

      var style = (0, _trim["default"])(_context11 = elem.getAttribute('style') || '').call(_context11);

      if (style) {
        // 有 style，将 style 按照 `;` 拆分为数组
        var resultArr = _styleArrTrim(style); // 替换现有的 style


        resultArr = (0, _map["default"])(resultArr).call(resultArr, function (item) {
          if ((0, _indexOf["default"])(item).call(item, key) === 0) {
            return currentStyle;
          } else {
            return item;
          }
        }); // 新增 style

        if (currentStyle != '' && (0, _indexOf["default"])(resultArr).call(resultArr, currentStyle) < 0) {
          resultArr.push(currentStyle);
        } // 去掉 空白


        if (currentStyle == '') {
          resultArr = _styleArrTrim(resultArr);
        } // 重新设置 style


        elem.setAttribute('style', resultArr.join('; '));
      } else {
        // 当前没有 style
        elem.setAttribute('style', currentStyle);
      }
    });
  };
  /**
   * 封装 getBoundingClientRect
   */


  DomElement.prototype.getBoundingClientRect = function () {
    var elem = this.elems[0];
    return elem.getBoundingClientRect();
  };
  /**
   * 显示
   */


  DomElement.prototype.show = function () {
    return this.css('display', 'block');
  };
  /**
   * 隐藏
   */


  DomElement.prototype.hide = function () {
    return this.css('display', 'none');
  };
  /**
   * 获取子节点（只有 DOM 元素）
   */


  DomElement.prototype.children = function () {
    var elem = this.elems[0];

    if (!elem) {
      return null;
    }

    return $(elem.children);
  };
  /**
   * 获取子节点（包括文本节点）
   */


  DomElement.prototype.childNodes = function () {
    var elem = this.elems[0];

    if (!elem) {
      return null;
    }

    return $(elem.childNodes);
  };
  /**
   * 将子元素全部替换
   * @param $children 新的child节点
   */


  DomElement.prototype.replaceChildAll = function ($children) {
    var parent = this.getNode();
    var elem = this.elems[0];

    while (elem.hasChildNodes()) {
      parent.firstChild && elem.removeChild(parent.firstChild);
    }

    this.append($children);
  };
  /**
   * 增加子节点
   * @param $children 子节点
   */


  DomElement.prototype.append = function ($children) {
    var _context12;

    return (0, _forEach["default"])(_context12 = this).call(_context12, function (elem) {
      (0, _forEach["default"])($children).call($children, function (child) {
        elem.appendChild(child);
      });
    });
  };
  /**
   * 移除当前节点
   */


  DomElement.prototype.remove = function () {
    var _context13;

    return (0, _forEach["default"])(_context13 = this).call(_context13, function (elem) {
      if (elem.remove) {
        elem.remove();
      } else {
        var parent_1 = elem.parentElement;
        parent_1 && parent_1.removeChild(elem);
      }
    });
  };
  /**
   * 当前元素，是否包含某个子元素
   * @param $child 子元素
   */


  DomElement.prototype.isContain = function ($child) {
    var elem = this.elems[0];
    var child = $child.elems[0];
    return elem.contains(child);
  };
  /**
   * 获取当前元素 nodeName
   */


  DomElement.prototype.getNodeName = function () {
    var elem = this.elems[0];
    return elem.nodeName;
  };
  /**
   * 根据元素位置获取元素节点（默认获取0位置的节点）
   * @param n 元素节点位置
   */


  DomElement.prototype.getNode = function (n) {
    if (n === void 0) {
      n = 0;
    }

    var elem;
    elem = this.elems[n];
    return elem;
  };
  /**
   * 查询
   * @param selector css 选择器
   */


  DomElement.prototype.find = function (selector) {
    var elem = this.elems[0];
    return $(elem.querySelectorAll(selector));
  };

  DomElement.prototype.text = function (val) {
    if (!val) {
      // 获取 text
      var elem = this.elems[0];
      return elem.innerHTML.replace(/<[^>]+>/g, function () {
        return '';
      });
    } else {
      var _context14;

      // 设置 text
      return (0, _forEach["default"])(_context14 = this).call(_context14, function (elem) {
        elem.innerHTML = val;
      });
    }
  };

  DomElement.prototype.html = function (val) {
    var elem = this.elems[0];

    if (!val) {
      // 获取 html
      return elem.innerHTML;
    } else {
      // 设置 html
      elem.innerHTML = val;
      return this;
    }
  };
  /**
   * 获取元素 value
   */


  DomElement.prototype.val = function () {
    var _context15;

    var elem = this.elems[0];
    return (0, _trim["default"])(_context15 = elem.value).call(_context15); // 暂用 any
  };
  /**
   * focus 到当前元素
   */


  DomElement.prototype.focus = function () {
    var _context16;

    return (0, _forEach["default"])(_context16 = this).call(_context16, function (elem) {
      elem.focus();
    });
  };
  /**
   * 当前元素前一个兄弟节点
   */


  DomElement.prototype.prev = function () {
    var elem = this.elems[0];
    return $(elem.previousElementSibling);
  };
  /**
   * 当前元素后一个兄弟节点
   * 不包括文本节点、注释节点）
   */


  DomElement.prototype.next = function () {
    var elem = this.elems[0];
    return $(elem.nextElementSibling);
  };
  /**
   * 获取当前节点的下一个兄弟节点
   * 包括文本节点、注释节点即回车、换行、空格、文本等等）
   */


  DomElement.prototype.getNextSibling = function () {
    var elem = this.elems[0];
    return $(elem.nextSibling);
  };
  /**
   * 获取父元素
   */


  DomElement.prototype.parent = function () {
    var elem = this.elems[0];
    return $(elem.parentElement);
  };
  /**
   * 查找父元素，直到满足 selector 条件
   * @param selector css 选择器
   * @param curElem 从哪个元素开始查找，默认为当前元素
   */


  DomElement.prototype.parentUntil = function (selector, curElem) {
    var elem = curElem || this.elems[0];

    if (elem.nodeName === 'BODY') {
      return null;
    }

    var parent = elem.parentElement;

    if (parent === null) {
      return null;
    }

    if (parent.matches(selector)) {
      // 找到，并返回
      return $(parent);
    } // 继续查找，递归


    return this.parentUntil(selector, parent);
  };
  /**
   * 查找父元素，直到满足 selector 条件,或者 到达 编辑区域容器以及菜单栏容器
   * @param selector css 选择器
   * @param curElem 从哪个元素开始查找，默认为当前元素
   */


  DomElement.prototype.parentUntilEditor = function (selector, editor, curElem) {
    var elem = curElem || this.elems[0];

    if ($(elem).equal(editor.$textContainerElem) || $(elem).equal(editor.$toolbarElem)) {
      return null;
    }

    var parent = elem.parentElement;

    if (parent === null) {
      return null;
    }

    if (parent.matches(selector)) {
      // 找到，并返回
      return $(parent);
    } // 继续查找，递归


    return this.parentUntilEditor(selector, editor, parent);
  };
  /**
   * 判读是否相等
   * @param $elem 元素
   */


  DomElement.prototype.equal = function ($elem) {
    if ($elem instanceof DomElement) {
      return this.elems[0] === $elem.elems[0];
    } else if ($elem instanceof HTMLElement) {
      return this.elems[0] === $elem;
    } else {
      return false;
    }
  };
  /**
   * 将该元素插入到某个元素前面
   * @param selector css 选择器
   */


  DomElement.prototype.insertBefore = function (selector) {
    var _context17;

    var $referenceNode = $(selector);
    var referenceNode = $referenceNode.elems[0];

    if (!referenceNode) {
      return this;
    }

    return (0, _forEach["default"])(_context17 = this).call(_context17, function (elem) {
      var parent = referenceNode.parentNode;
      parent === null || parent === void 0 ? void 0 : parent.insertBefore(elem, referenceNode);
    });
  };
  /**
   * 将该元素插入到selector元素后面
   * @param selector css 选择器
   */


  DomElement.prototype.insertAfter = function (selector) {
    var _context18;

    var $referenceNode = $(selector);
    var referenceNode = $referenceNode.elems[0];
    var anchorNode = referenceNode && referenceNode.nextSibling;

    if (!referenceNode) {
      return this;
    }

    return (0, _forEach["default"])(_context18 = this).call(_context18, function (elem) {
      var parent = referenceNode.parentNode;

      if (anchorNode) {
        parent.insertBefore(elem, anchorNode);
      } else {
        parent.appendChild(elem);
      }
    });
  };
  /**
   * 设置/获取 数据
   * @param key key
   * @param value value
   */


  DomElement.prototype.data = function (key, value) {
    if (value != null) {
      // 设置数据
      this.dataSource.set(key, value);
    } else {
      // 获取数据
      return this.dataSource.get(key);
    }
  };
  /**
   * 获取当前节点的顶级(段落)
   * @param editor 富文本实例
   */


  DomElement.prototype.getNodeTop = function (editor) {
    // 异常抛出，空的 DomElement 直接返回
    if (this.length < 1) {
      return this;
    } // 获取父级元素，并判断是否是 编辑区域
    // 如果是则返回当前节点


    var $parent = this.parent(); // fix：添加当前元素与编辑区元素的比较，防止传入的当前元素就是编辑区元素而造成的获取顶级元素为空的情况

    if (editor.$textElem.equal(this) || editor.$textElem.equal($parent)) {
      return this;
    } // 到了此处，即代表当前节点不是顶级段落
    // 将当前节点存放于父节点的 prior 字段下
    // 主要用于 回溯 子节点
    // 例如：ul ol 等标签
    // 实际操作的节点是 li 但是一个 ul ol 的子节点可能有多个
    // 所以需要对其进行 回溯 找到对应的子节点


    $parent.prior = this;
    return $parent.getNodeTop(editor);
  };
  /**
   * 获取当前 节点 基与上一个拥有相对或者解决定位的父容器的位置
   * @param editor 富文本实例
   */


  DomElement.prototype.getOffsetData = function () {
    var $node = this.elems[0];
    return {
      top: $node.offsetTop,
      left: $node.offsetLeft,
      width: $node.offsetWidth,
      height: $node.offsetHeight,
      parent: $node.offsetParent
    };
  };
  /**
   * 从上至下进行滚动
   * @param top 滚动的值
   */


  DomElement.prototype.scrollTop = function (top) {
    var $node = this.elems[0];
    $node.scrollTo({
      top: top
    });
  };

  return DomElement;
}();

exports.DomElement = DomElement; // new 一个对象

function $() {
  var arg = [];

  for (var _i = 0; _i < arguments.length; _i++) {
    arg[_i] = arguments[_i];
  }

  return new ((0, _bind["default"])(DomElement).apply(DomElement, tslib_1.__spreadArrays([void 0], arg)))();
}

exports["default"] = $;

/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(180);

/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var global = __webpack_require__(8);
var getOwnPropertyDescriptor = __webpack_require__(71).f;
var isForced = __webpack_require__(101);
var path = __webpack_require__(9);
var bind = __webpack_require__(40);
var createNonEnumerableProperty = __webpack_require__(19);
var has = __webpack_require__(16);

var wrapConstructor = function (NativeConstructor) {
  var Wrapper = function (a, b, c) {
    if (this instanceof NativeConstructor) {
      switch (arguments.length) {
        case 0: return new NativeConstructor();
        case 1: return new NativeConstructor(a);
        case 2: return new NativeConstructor(a, b);
      } return new NativeConstructor(a, b, c);
    } return NativeConstructor.apply(this, arguments);
  };
  Wrapper.prototype = NativeConstructor.prototype;
  return Wrapper;
};

/*
  options.target      - name of the target object
  options.global      - target is the global object
  options.stat        - export as static methods of target
  options.proto       - export as prototype methods of target
  options.real        - real prototype method for the `pure` version
  options.forced      - export even if the native feature is available
  options.bind        - bind methods to the target, required for the `pure` version
  options.wrap        - wrap constructors to preventing global pollution, required for the `pure` version
  options.unsafe      - use the simple assignment of property instead of delete + defineProperty
  options.sham        - add a flag to not completely full polyfills
  options.enumerable  - export as enumerable property
  options.noTargetGet - prevent calling a getter on target
*/
module.exports = function (options, source) {
  var TARGET = options.target;
  var GLOBAL = options.global;
  var STATIC = options.stat;
  var PROTO = options.proto;

  var nativeSource = GLOBAL ? global : STATIC ? global[TARGET] : (global[TARGET] || {}).prototype;

  var target = GLOBAL ? path : path[TARGET] || (path[TARGET] = {});
  var targetPrototype = target.prototype;

  var FORCED, USE_NATIVE, VIRTUAL_PROTOTYPE;
  var key, sourceProperty, targetProperty, nativeProperty, resultProperty, descriptor;

  for (key in source) {
    FORCED = isForced(GLOBAL ? key : TARGET + (STATIC ? '.' : '#') + key, options.forced);
    // contains in native
    USE_NATIVE = !FORCED && nativeSource && has(nativeSource, key);

    targetProperty = target[key];

    if (USE_NATIVE) if (options.noTargetGet) {
      descriptor = getOwnPropertyDescriptor(nativeSource, key);
      nativeProperty = descriptor && descriptor.value;
    } else nativeProperty = nativeSource[key];

    // export native or implementation
    sourceProperty = (USE_NATIVE && nativeProperty) ? nativeProperty : source[key];

    if (USE_NATIVE && typeof targetProperty === typeof sourceProperty) continue;

    // bind timers to global for call from export context
    if (options.bind && USE_NATIVE) resultProperty = bind(sourceProperty, global);
    // wrap global constructors for prevent changs in this version
    else if (options.wrap && USE_NATIVE) resultProperty = wrapConstructor(sourceProperty);
    // make static versions for prototype methods
    else if (PROTO && typeof sourceProperty == 'function') resultProperty = bind(Function.call, sourceProperty);
    // default case
    else resultProperty = sourceProperty;

    // add a flag to not completely full polyfills
    if (options.sham || (sourceProperty && sourceProperty.sham) || (targetProperty && targetProperty.sham)) {
      createNonEnumerableProperty(resultProperty, 'sham', true);
    }

    target[key] = resultProperty;

    if (PROTO) {
      VIRTUAL_PROTOTYPE = TARGET + 'Prototype';
      if (!has(path, VIRTUAL_PROTOTYPE)) {
        createNonEnumerableProperty(path, VIRTUAL_PROTOTYPE, {});
      }
      // export virtual prototype methods
      path[VIRTUAL_PROTOTYPE][key] = sourceProperty;
      // export real prototype methods
      if (options.real && targetPrototype && !targetPrototype[key]) {
        createNonEnumerableProperty(targetPrototype, key, sourceProperty);
      }
    }
  }
};


/***/ }),
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 工具函数集合
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _typeof2 = _interopRequireDefault(__webpack_require__(92));

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _parseInt2 = _interopRequireDefault(__webpack_require__(256));

var _slice = _interopRequireDefault(__webpack_require__(45));

var _setTimeout2 = _interopRequireDefault(__webpack_require__(46));

var _isArray = _interopRequireDefault(__webpack_require__(89));

var _map = _interopRequireDefault(__webpack_require__(26));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.hexToRgb = exports.getRandomCode = exports.toArray = exports.deepClone = exports.isFunction = exports.debounce = exports.throttle = exports.arrForEach = exports.forEach = exports.replaceSpecialSymbol = exports.replaceHtmlSymbol = exports.getRandom = exports.UA = void 0;

var tslib_1 = __webpack_require__(2);

var NavUA =
/** @class */
function () {
  function NavUA() {
    this._ua = navigator.userAgent;

    var math = this._ua.match(/(Edge?)\/(\d+)/);

    this.isOldEdge = math && math[1] == 'Edge' && (0, _parseInt2["default"])(math[2]) < 19 ? true : false;
    this.isFirefox = /Firefox\/\d+/.test(this._ua) && !/Seamonkey\/\d+/.test(this._ua) ? true : false;
  } // 是否为 IE


  NavUA.prototype.isIE = function () {
    return 'ActiveXObject' in window;
  }; // 是否为 webkit


  NavUA.prototype.isWebkit = function () {
    return /webkit/i.test(this._ua);
  };

  return NavUA;
}(); // 和 UA 相关的属性


exports.UA = new NavUA();
/**
 * 获取随机字符
 * @param prefix 前缀
 */

function getRandom(prefix) {
  var _context;

  if (prefix === void 0) {
    prefix = '';
  }

  return prefix + (0, _slice["default"])(_context = Math.random().toString()).call(_context, 2);
}

exports.getRandom = getRandom;
/**
 * 替换 html 特殊字符
 * @param html html 字符串
 */

function replaceHtmlSymbol(html) {
  return html.replace(/</gm, '&lt;').replace(/>/gm, '&gt;').replace(/"/gm, '&quot;').replace(/(\r\n|\r|\n)/g, '<br/>');
}

exports.replaceHtmlSymbol = replaceHtmlSymbol;

function replaceSpecialSymbol(value) {
  return value.replace(/&lt;/gm, '<').replace(/&gt;/gm, '>').replace(/&quot;/gm, '"');
}

exports.replaceSpecialSymbol = replaceSpecialSymbol;

function forEach(obj, fn) {
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      var result = fn(key, obj[key]);

      if (result === false) {
        // 提前终止循环
        break;
      }
    }
  }
}

exports.forEach = forEach;
/**
 * 遍历类数组
 * @param fakeArr 类数组
 * @param fn 回调函数
 */

function arrForEach(fakeArr, fn) {
  var i, item, result;
  var length = fakeArr.length || 0;

  for (i = 0; i < length; i++) {
    item = fakeArr[i];
    result = fn.call(fakeArr, item, i);

    if (result === false) {
      break;
    }
  }
}

exports.arrForEach = arrForEach;
/**
 * 节流
 * @param fn 函数
 * @param interval 间隔时间，毫秒
 */

function throttle(fn, interval) {
  if (interval === void 0) {
    interval = 200;
  }

  var flag = false;
  return function () {
    var _this = this;

    var args = [];

    for (var _i = 0; _i < arguments.length; _i++) {
      args[_i] = arguments[_i];
    }

    if (!flag) {
      flag = true;
      (0, _setTimeout2["default"])(function () {
        flag = false;
        fn.call.apply(fn, tslib_1.__spreadArrays([_this], args)); // this 报语法错误，先用 null
      }, interval);
    }
  };
}

exports.throttle = throttle;
/**
 * 防抖
 * @param fn 函数
 * @param delay 间隔时间，毫秒
 */

function debounce(fn, delay) {
  if (delay === void 0) {
    delay = 200;
  }

  var lastFn = 0;
  return function () {
    var _this = this;

    var args = [];

    for (var _i = 0; _i < arguments.length; _i++) {
      args[_i] = arguments[_i];
    }

    if (lastFn) {
      window.clearTimeout(lastFn);
    }

    lastFn = (0, _setTimeout2["default"])(function () {
      lastFn = 0;
      fn.call.apply(fn, tslib_1.__spreadArrays([_this], args)); // this 报语法错误，先用 null
    }, delay);
  };
}

exports.debounce = debounce;
/**
 * isFunction 是否是函数
 * @param fn 函数
 */

function isFunction(fn) {
  return typeof fn === 'function';
}

exports.isFunction = isFunction;
/**
 * 引用与非引用值 深拷贝方法
 * @param data
 */

function deepClone(data) {
  if ((0, _typeof2["default"])(data) !== 'object' || typeof data == 'function' || data === null) {
    return data;
  }

  var item;

  if ((0, _isArray["default"])(data)) {
    item = [];
  }

  if (!(0, _isArray["default"])(data)) {
    item = {};
  }

  for (var i in data) {
    if (Object.prototype.hasOwnProperty.call(data, i)) {
      item[i] = deepClone(data[i]);
    }
  }

  return item;
}

exports.deepClone = deepClone;
/**
 * 将可遍历的对象转换为数组
 * @param data 可遍历的对象
 */

function toArray(data) {
  return (0, _slice["default"])(Array.prototype).call(data);
}

exports.toArray = toArray;
/**
 * 唯一id生成
 * @param length 随机数长度
 */

function getRandomCode() {
  var _context2;

  return (0, _slice["default"])(_context2 = Math.random().toString(36)).call(_context2, -5);
}

exports.getRandomCode = getRandomCode;
/**
 * hex color 转换成 rgb
 * @param hex string
 */

function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result == null) return null;
  var colors = (0, _map["default"])(result).call(result, function (i) {
    return (0, _parseInt2["default"])(i, 16);
  });
  var r = colors[1];
  var g = colors[2];
  var b = colors[3];
  return "rgb(" + r + ", " + g + ", " + b + ")";
}

exports.hexToRgb = hexToRgb;

/***/ }),
/* 7 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 常量
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.EMPTY_P_REGEX = exports.EMPTY_P_LAST_REGEX = exports.EMPTY_P = exports.urlRegex = exports.EMPTY_FN = void 0;

function EMPTY_FN() {}

exports.EMPTY_FN = EMPTY_FN; //用于校验是否为url格式字符串

exports.urlRegex = /(http|ftp|https):\/\/[\w\-_]+(\.[\w\-_]+)+([\w\-.,@?^=%&amp;:/~+#]*[\w\-@?^=%&amp;/~+#])?/g; // 编辑器为了方便继续输入/换行等原因 主动生成的空标签

exports.EMPTY_P = '<p data-we-empty-p=""><br></p>'; // 用于校验dom中最后 由编辑器主动生成的空标签结构

exports.EMPTY_P_LAST_REGEX = /<p data-we-empty-p=""><br\/?><\/p>$/gim; // 用于校验dom中所有 由编辑器主动生成的空标签结构

exports.EMPTY_P_REGEX = /<p data-we-empty-p="">/gim;

/***/ }),
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

/* WEBPACK VAR INJECTION */(function(global) {var check = function (it) {
  return it && it.Math == Math && it;
};

// https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
module.exports =
  // eslint-disable-next-line no-undef
  check(typeof globalThis == 'object' && globalThis) ||
  check(typeof window == 'object' && window) ||
  check(typeof self == 'object' && self) ||
  check(typeof global == 'object' && global) ||
  // eslint-disable-next-line no-new-func
  Function('return this')();

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(145)))

/***/ }),
/* 9 */
/***/ (function(module, exports) {

module.exports = {};


/***/ }),
/* 10 */
/***/ (function(module, exports, __webpack_require__) {

var global = __webpack_require__(8);
var shared = __webpack_require__(74);
var has = __webpack_require__(16);
var uid = __webpack_require__(64);
var NATIVE_SYMBOL = __webpack_require__(76);
var USE_SYMBOL_AS_UID = __webpack_require__(106);

var WellKnownSymbolsStore = shared('wks');
var Symbol = global.Symbol;
var createWellKnownSymbol = USE_SYMBOL_AS_UID ? Symbol : Symbol && Symbol.withoutSetter || uid;

module.exports = function (name) {
  if (!has(WellKnownSymbolsStore, name)) {
    if (NATIVE_SYMBOL && has(Symbol, name)) WellKnownSymbolsStore[name] = Symbol[name];
    else WellKnownSymbolsStore[name] = createWellKnownSymbol('Symbol.' + name);
  } return WellKnownSymbolsStore[name];
};


/***/ }),
/* 11 */
/***/ (function(module, exports) {

module.exports = function (exec) {
  try {
    return !!exec();
  } catch (error) {
    return true;
  }
};


/***/ }),
/* 12 */
/***/ (function(module, exports, __webpack_require__) {

var path = __webpack_require__(9);
var has = __webpack_require__(16);
var wrappedWellKnownSymbolModule = __webpack_require__(93);
var defineProperty = __webpack_require__(18).f;

module.exports = function (NAME) {
  var Symbol = path.Symbol || (path.Symbol = {});
  if (!has(Symbol, NAME)) defineProperty(Symbol, NAME, {
    value: wrappedWellKnownSymbolModule.f(NAME)
  });
};


/***/ }),
/* 13 */
/***/ (function(module, exports) {

module.exports = function (it) {
  return typeof it === 'object' ? it !== null : typeof it === 'function';
};


/***/ }),
/* 14 */
/***/ (function(module, exports, __webpack_require__) {

var fails = __webpack_require__(11);

// Thank's IE8 for his funny defineProperty
module.exports = !fails(function () {
  return Object.defineProperty({}, 1, { get: function () { return 7; } })[1] != 7;
});


/***/ }),
/* 15 */
/***/ (function(module, exports, __webpack_require__) {

var path = __webpack_require__(9);

module.exports = function (CONSTRUCTOR) {
  return path[CONSTRUCTOR + 'Prototype'];
};


/***/ }),
/* 16 */
/***/ (function(module, exports) {

var hasOwnProperty = {}.hasOwnProperty;

module.exports = function (it, key) {
  return hasOwnProperty.call(it, key);
};


/***/ }),
/* 17 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(192);

/***/ }),
/* 18 */
/***/ (function(module, exports, __webpack_require__) {

var DESCRIPTORS = __webpack_require__(14);
var IE8_DOM_DEFINE = __webpack_require__(100);
var anObject = __webpack_require__(25);
var toPrimitive = __webpack_require__(60);

var nativeDefineProperty = Object.defineProperty;

// `Object.defineProperty` method
// https://tc39.github.io/ecma262/#sec-object.defineproperty
exports.f = DESCRIPTORS ? nativeDefineProperty : function defineProperty(O, P, Attributes) {
  anObject(O);
  P = toPrimitive(P, true);
  anObject(Attributes);
  if (IE8_DOM_DEFINE) try {
    return nativeDefineProperty(O, P, Attributes);
  } catch (error) { /* empty */ }
  if ('get' in Attributes || 'set' in Attributes) throw TypeError('Accessors not supported');
  if ('value' in Attributes) O[P] = Attributes.value;
  return O;
};


/***/ }),
/* 19 */
/***/ (function(module, exports, __webpack_require__) {

var DESCRIPTORS = __webpack_require__(14);
var definePropertyModule = __webpack_require__(18);
var createPropertyDescriptor = __webpack_require__(48);

module.exports = DESCRIPTORS ? function (object, key, value) {
  return definePropertyModule.f(object, key, createPropertyDescriptor(1, value));
} : function (object, key, value) {
  object[key] = value;
  return object;
};


/***/ }),
/* 20 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var isOldIE = function isOldIE() {
  var memo;
  return function memorize() {
    if (typeof memo === 'undefined') {
      // Test for IE <= 9 as proposed by Browserhacks
      // @see http://browserhacks.com/#hack-e71d8692f65334173fee715c222cb805
      // Tests for existence of standard globals is to allow style-loader
      // to operate correctly into non-standard environments
      // @see https://github.com/webpack-contrib/style-loader/issues/177
      memo = Boolean(window && document && document.all && !window.atob);
    }

    return memo;
  };
}();

var getTarget = function getTarget() {
  var memo = {};
  return function memorize(target) {
    if (typeof memo[target] === 'undefined') {
      var styleTarget = document.querySelector(target); // Special case to return head of iframe instead of iframe itself

      if (window.HTMLIFrameElement && styleTarget instanceof window.HTMLIFrameElement) {
        try {
          // This will throw an exception if access to iframe is blocked
          // due to cross-origin restrictions
          styleTarget = styleTarget.contentDocument.head;
        } catch (e) {
          // istanbul ignore next
          styleTarget = null;
        }
      }

      memo[target] = styleTarget;
    }

    return memo[target];
  };
}();

var stylesInDom = [];

function getIndexByIdentifier(identifier) {
  var result = -1;

  for (var i = 0; i < stylesInDom.length; i++) {
    if (stylesInDom[i].identifier === identifier) {
      result = i;
      break;
    }
  }

  return result;
}

function modulesToDom(list, options) {
  var idCountMap = {};
  var identifiers = [];

  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    var id = options.base ? item[0] + options.base : item[0];
    var count = idCountMap[id] || 0;
    var identifier = "".concat(id, " ").concat(count);
    idCountMap[id] = count + 1;
    var index = getIndexByIdentifier(identifier);
    var obj = {
      css: item[1],
      media: item[2],
      sourceMap: item[3]
    };

    if (index !== -1) {
      stylesInDom[index].references++;
      stylesInDom[index].updater(obj);
    } else {
      stylesInDom.push({
        identifier: identifier,
        updater: addStyle(obj, options),
        references: 1
      });
    }

    identifiers.push(identifier);
  }

  return identifiers;
}

function insertStyleElement(options) {
  var style = document.createElement('style');
  var attributes = options.attributes || {};

  if (typeof attributes.nonce === 'undefined') {
    var nonce =  true ? __webpack_require__.nc : undefined;

    if (nonce) {
      attributes.nonce = nonce;
    }
  }

  Object.keys(attributes).forEach(function (key) {
    style.setAttribute(key, attributes[key]);
  });

  if (typeof options.insert === 'function') {
    options.insert(style);
  } else {
    var target = getTarget(options.insert || 'head');

    if (!target) {
      throw new Error("Couldn't find a style target. This probably means that the value for the 'insert' parameter is invalid.");
    }

    target.appendChild(style);
  }

  return style;
}

function removeStyleElement(style) {
  // istanbul ignore if
  if (style.parentNode === null) {
    return false;
  }

  style.parentNode.removeChild(style);
}
/* istanbul ignore next  */


var replaceText = function replaceText() {
  var textStore = [];
  return function replace(index, replacement) {
    textStore[index] = replacement;
    return textStore.filter(Boolean).join('\n');
  };
}();

function applyToSingletonTag(style, index, remove, obj) {
  var css = remove ? '' : obj.media ? "@media ".concat(obj.media, " {").concat(obj.css, "}") : obj.css; // For old IE

  /* istanbul ignore if  */

  if (style.styleSheet) {
    style.styleSheet.cssText = replaceText(index, css);
  } else {
    var cssNode = document.createTextNode(css);
    var childNodes = style.childNodes;

    if (childNodes[index]) {
      style.removeChild(childNodes[index]);
    }

    if (childNodes.length) {
      style.insertBefore(cssNode, childNodes[index]);
    } else {
      style.appendChild(cssNode);
    }
  }
}

function applyToTag(style, options, obj) {
  var css = obj.css;
  var media = obj.media;
  var sourceMap = obj.sourceMap;

  if (media) {
    style.setAttribute('media', media);
  } else {
    style.removeAttribute('media');
  }

  if (sourceMap && typeof btoa !== 'undefined') {
    css += "\n/*# sourceMappingURL=data:application/json;base64,".concat(btoa(unescape(encodeURIComponent(JSON.stringify(sourceMap)))), " */");
  } // For old IE

  /* istanbul ignore if  */


  if (style.styleSheet) {
    style.styleSheet.cssText = css;
  } else {
    while (style.firstChild) {
      style.removeChild(style.firstChild);
    }

    style.appendChild(document.createTextNode(css));
  }
}

var singleton = null;
var singletonCounter = 0;

function addStyle(obj, options) {
  var style;
  var update;
  var remove;

  if (options.singleton) {
    var styleIndex = singletonCounter++;
    style = singleton || (singleton = insertStyleElement(options));
    update = applyToSingletonTag.bind(null, style, styleIndex, false);
    remove = applyToSingletonTag.bind(null, style, styleIndex, true);
  } else {
    style = insertStyleElement(options);
    update = applyToTag.bind(null, style, options);

    remove = function remove() {
      removeStyleElement(style);
    };
  }

  update(obj);
  return function updateStyle(newObj) {
    if (newObj) {
      if (newObj.css === obj.css && newObj.media === obj.media && newObj.sourceMap === obj.sourceMap) {
        return;
      }

      update(obj = newObj);
    } else {
      remove();
    }
  };
}

module.exports = function (list, options) {
  options = options || {}; // Force single-tag solution on IE6-9, which has a hard limit on the # of <style>
  // tags it will allow on a page

  if (!options.singleton && typeof options.singleton !== 'boolean') {
    options.singleton = isOldIE();
  }

  list = list || [];
  var lastIdentifiers = modulesToDom(list, options);
  return function update(newList) {
    newList = newList || [];

    if (Object.prototype.toString.call(newList) !== '[object Array]') {
      return;
    }

    for (var i = 0; i < lastIdentifiers.length; i++) {
      var identifier = lastIdentifiers[i];
      var index = getIndexByIdentifier(identifier);
      stylesInDom[index].references--;
    }

    var newLastIdentifiers = modulesToDom(newList, options);

    for (var _i = 0; _i < lastIdentifiers.length; _i++) {
      var _identifier = lastIdentifiers[_i];

      var _index = getIndexByIdentifier(_identifier);

      if (stylesInDom[_index].references === 0) {
        stylesInDom[_index].updater();

        stylesInDom.splice(_index, 1);
      }
    }

    lastIdentifiers = newLastIdentifiers;
  };
};

/***/ }),
/* 21 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Tobias Koppers @sokra
*/
// css base code, injected by the css-loader
// eslint-disable-next-line func-names
module.exports = function (useSourceMap) {
  var list = []; // return the list of modules as css string

  list.toString = function toString() {
    return this.map(function (item) {
      var content = cssWithMappingToString(item, useSourceMap);

      if (item[2]) {
        return "@media ".concat(item[2], " {").concat(content, "}");
      }

      return content;
    }).join('');
  }; // import a list of modules into the list
  // eslint-disable-next-line func-names


  list.i = function (modules, mediaQuery, dedupe) {
    if (typeof modules === 'string') {
      // eslint-disable-next-line no-param-reassign
      modules = [[null, modules, '']];
    }

    var alreadyImportedModules = {};

    if (dedupe) {
      for (var i = 0; i < this.length; i++) {
        // eslint-disable-next-line prefer-destructuring
        var id = this[i][0];

        if (id != null) {
          alreadyImportedModules[id] = true;
        }
      }
    }

    for (var _i = 0; _i < modules.length; _i++) {
      var item = [].concat(modules[_i]);

      if (dedupe && alreadyImportedModules[item[0]]) {
        // eslint-disable-next-line no-continue
        continue;
      }

      if (mediaQuery) {
        if (!item[2]) {
          item[2] = mediaQuery;
        } else {
          item[2] = "".concat(mediaQuery, " and ").concat(item[2]);
        }
      }

      list.push(item);
    }
  };

  return list;
};

function cssWithMappingToString(item, useSourceMap) {
  var content = item[1] || ''; // eslint-disable-next-line prefer-destructuring

  var cssMapping = item[3];

  if (!cssMapping) {
    return content;
  }

  if (useSourceMap && typeof btoa === 'function') {
    var sourceMapping = toComment(cssMapping);
    var sourceURLs = cssMapping.sources.map(function (source) {
      return "/*# sourceURL=".concat(cssMapping.sourceRoot || '').concat(source, " */");
    });
    return [content].concat(sourceURLs).concat([sourceMapping]).join('\n');
  }

  return [content].join('\n');
} // Adapted from convert-source-map (MIT)


function toComment(sourceMap) {
  // eslint-disable-next-line no-undef
  var base64 = btoa(unescape(encodeURIComponent(JSON.stringify(sourceMap))));
  var data = "sourceMappingURL=data:application/json;charset=utf-8;base64,".concat(base64);
  return "/*# ".concat(data, " */");
}

/***/ }),
/* 22 */
/***/ (function(module, exports, __webpack_require__) {

var DESCRIPTORS = __webpack_require__(14);
var fails = __webpack_require__(11);
var has = __webpack_require__(16);

var defineProperty = Object.defineProperty;
var cache = {};

var thrower = function (it) { throw it; };

module.exports = function (METHOD_NAME, options) {
  if (has(cache, METHOD_NAME)) return cache[METHOD_NAME];
  if (!options) options = {};
  var method = [][METHOD_NAME];
  var ACCESSORS = has(options, 'ACCESSORS') ? options.ACCESSORS : false;
  var argument0 = has(options, 0) ? options[0] : thrower;
  var argument1 = has(options, 1) ? options[1] : undefined;

  return cache[METHOD_NAME] = !!method && !fails(function () {
    if (ACCESSORS && !DESCRIPTORS) return true;
    var O = { length: -1 };

    if (ACCESSORS) defineProperty(O, 1, { enumerable: true, get: thrower });
    else O[1] = 1;

    method.call(O, argument0, argument1);
  });
};


/***/ }),
/* 23 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 按钮菜单 Class
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var Menu_1 = tslib_1.__importDefault(__webpack_require__(95));

var BtnMenu =
/** @class */
function (_super) {
  tslib_1.__extends(BtnMenu, _super);

  function BtnMenu($elem, editor) {
    return _super.call(this, $elem, editor) || this;
  }

  return BtnMenu;
}(Menu_1["default"]);

exports["default"] = BtnMenu;

/***/ }),
/* 24 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 下拉菜单 Class
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

var _setTimeout2 = _interopRequireDefault(__webpack_require__(46));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var Menu_1 = tslib_1.__importDefault(__webpack_require__(95));

var DropList_1 = tslib_1.__importDefault(__webpack_require__(134));

var DropListMenu =
/** @class */
function (_super) {
  tslib_1.__extends(DropListMenu, _super);

  function DropListMenu($elem, editor, conf) {
    var _this = _super.call(this, $elem, editor) || this; // 国际化


    conf.title = editor.i18next.t("menus.dropListMenu." + conf.title); // 非中文模式下 带 icon 的下拉列表居左

    var className = editor.config.lang === 'zh-CN' ? '' : 'w-e-drop-list-tl';

    if (className !== '' && conf.type === 'list') {
      var _context;

      (0, _forEach["default"])(_context = conf.list).call(_context, function (item) {
        var $elem = item.$elem;
        var $children = dom_core_1["default"]($elem.children());

        if ($children.length > 0) {
          var nodeName = $children === null || $children === void 0 ? void 0 : $children.getNodeName();

          if (nodeName && nodeName === 'I') {
            $elem.addClass(className);
          }
        }
      });
    } // 初始化 dropList


    var dropList = new DropList_1["default"](_this, conf);
    _this.dropList = dropList; // 绑定事件

    $elem.on('click', function () {
      var _context2;

      if (editor.selection.getRange() == null) {
        return;
      }

      $elem.css('z-index', editor.zIndex.get('menu')); // 触发 droplist 悬浮事件

      (0, _forEach["default"])(_context2 = editor.txt.eventHooks.dropListMenuHoverEvents).call(_context2, function (fn) {
        return fn();
      }); // 显示

      dropList.show();
    }).on('mouseleave', function () {
      $elem.css('z-index', 'auto'); // 隐藏

      dropList.hideTimeoutId = (0, _setTimeout2["default"])(function () {
        dropList.hide();
      });
    });
    return _this;
  }

  return DropListMenu;
}(Menu_1["default"]);

exports["default"] = DropListMenu;

/***/ }),
/* 25 */
/***/ (function(module, exports, __webpack_require__) {

var isObject = __webpack_require__(13);

module.exports = function (it) {
  if (!isObject(it)) {
    throw TypeError(String(it) + ' is not an object');
  } return it;
};


/***/ }),
/* 26 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(188);

/***/ }),
/* 27 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(201);

/***/ }),
/* 28 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(213);

/***/ }),
/* 29 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(283);

/***/ }),
/* 30 */
/***/ (function(module, exports, __webpack_require__) {

// toObject with fallback for non-array-like ES3 strings
var IndexedObject = __webpack_require__(72);
var requireObjectCoercible = __webpack_require__(49);

module.exports = function (it) {
  return IndexedObject(requireObjectCoercible(it));
};


/***/ }),
/* 31 */
/***/ (function(module, exports, __webpack_require__) {

var requireObjectCoercible = __webpack_require__(49);

// `ToObject` abstract operation
// https://tc39.github.io/ecma262/#sec-toobject
module.exports = function (argument) {
  return Object(requireObjectCoercible(argument));
};


/***/ }),
/* 32 */
/***/ (function(module, exports, __webpack_require__) {

var bind = __webpack_require__(40);
var IndexedObject = __webpack_require__(72);
var toObject = __webpack_require__(31);
var toLength = __webpack_require__(35);
var arraySpeciesCreate = __webpack_require__(88);

var push = [].push;

// `Array.prototype.{ forEach, map, filter, some, every, find, findIndex }` methods implementation
var createMethod = function (TYPE) {
  var IS_MAP = TYPE == 1;
  var IS_FILTER = TYPE == 2;
  var IS_SOME = TYPE == 3;
  var IS_EVERY = TYPE == 4;
  var IS_FIND_INDEX = TYPE == 6;
  var NO_HOLES = TYPE == 5 || IS_FIND_INDEX;
  return function ($this, callbackfn, that, specificCreate) {
    var O = toObject($this);
    var self = IndexedObject(O);
    var boundFunction = bind(callbackfn, that, 3);
    var length = toLength(self.length);
    var index = 0;
    var create = specificCreate || arraySpeciesCreate;
    var target = IS_MAP ? create($this, length) : IS_FILTER ? create($this, 0) : undefined;
    var value, result;
    for (;length > index; index++) if (NO_HOLES || index in self) {
      value = self[index];
      result = boundFunction(value, index, O);
      if (TYPE) {
        if (IS_MAP) target[index] = result; // map
        else if (result) switch (TYPE) {
          case 3: return true;              // some
          case 5: return value;             // find
          case 6: return index;             // findIndex
          case 2: push.call(target, value); // filter
        } else if (IS_EVERY) return false;  // every
      }
    }
    return IS_FIND_INDEX ? -1 : IS_SOME || IS_EVERY ? IS_EVERY : target;
  };
};

module.exports = {
  // `Array.prototype.forEach` method
  // https://tc39.github.io/ecma262/#sec-array.prototype.foreach
  forEach: createMethod(0),
  // `Array.prototype.map` method
  // https://tc39.github.io/ecma262/#sec-array.prototype.map
  map: createMethod(1),
  // `Array.prototype.filter` method
  // https://tc39.github.io/ecma262/#sec-array.prototype.filter
  filter: createMethod(2),
  // `Array.prototype.some` method
  // https://tc39.github.io/ecma262/#sec-array.prototype.some
  some: createMethod(3),
  // `Array.prototype.every` method
  // https://tc39.github.io/ecma262/#sec-array.prototype.every
  every: createMethod(4),
  // `Array.prototype.find` method
  // https://tc39.github.io/ecma262/#sec-array.prototype.find
  find: createMethod(5),
  // `Array.prototype.findIndex` method
  // https://tc39.github.io/ecma262/#sec-array.prototype.findIndex
  findIndex: createMethod(6)
};


/***/ }),
/* 33 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description panel class
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

var _find = _interopRequireDefault(__webpack_require__(29));

var _set = _interopRequireDefault(__webpack_require__(132));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var const_1 = __webpack_require__(7);

var Panel =
/** @class */
function () {
  function Panel(menu, conf) {
    this.menu = menu;
    this.conf = conf;
    this.$container = dom_core_1["default"]('<div class="w-e-panel-container"></div>'); // 隐藏 panel

    var editor = menu.editor;
    editor.txt.eventHooks.clickEvents.push(Panel.hideCurAllPanels);
    editor.txt.eventHooks.toolbarClickEvents.push(Panel.hideCurAllPanels);
    editor.txt.eventHooks.dropListMenuHoverEvents.push(Panel.hideCurAllPanels);
  }
  /**
   * 创建并展示 panel
   */


  Panel.prototype.create = function () {
    var _this = this;

    var menu = this.menu;

    if (Panel.createdMenus.has(menu)) {
      // 创建过了
      return;
    }

    var conf = this.conf; // panel 的容器

    var $container = this.$container;
    var width = conf.width || 300; // 默认 300px

    var rect = menu.editor.$toolbarElem.getBoundingClientRect();
    var menuRect = menu.$elem.getBoundingClientRect();
    var top = rect.height + rect.top - menuRect.top;
    var left = (rect.width - width) / 2 + rect.left - menuRect.left;
    var offset = 300; // icon与panel菜单距离偏移量暂定 300

    if (Math.abs(left) > offset) {
      // panel菜单离工具栏icon过远时，让panel菜单出现在icon正下方，处理边界逻辑
      if (menuRect.left < document.documentElement.clientWidth / 2) {
        // icon在左侧
        left = -menuRect.width / 2;
      } else {
        // icon在右侧
        left = -width + menuRect.width / 2;
      }
    }

    $container.css('width', width + 'px').css('margin-top', top + "px").css('margin-left', left + "px").css('z-index', menu.editor.zIndex.get('panel')); // 添加关闭按钮

    var $closeBtn = dom_core_1["default"]('<i class="w-e-icon-close w-e-panel-close"></i>');
    $container.append($closeBtn);
    $closeBtn.on('click', function () {
      _this.remove();
    }); // 准备 tabs 容器

    var $tabTitleContainer = dom_core_1["default"]('<ul class="w-e-panel-tab-title"></ul>');
    var $tabContentContainer = dom_core_1["default"]('<div class="w-e-panel-tab-content"></div>');
    $container.append($tabTitleContainer).append($tabContentContainer); // 设置高度

    var height = conf.height; // height: 0 即不用设置

    if (height) {
      $tabContentContainer.css('height', height + 'px').css('overflow-y', 'auto');
    } // tabs


    var tabs = conf.tabs || [];
    var tabTitleArr = [];
    var tabContentArr = [];
    (0, _forEach["default"])(tabs).call(tabs, function (tab, tabIndex) {
      if (!tab) {
        return;
      }

      var title = tab.title || '';
      var tpl = tab.tpl || ''; // 添加到 DOM

      var $title = dom_core_1["default"]("<li class=\"w-e-item\">" + title + "</li>");
      $tabTitleContainer.append($title);
      var $content = dom_core_1["default"](tpl);
      $tabContentContainer.append($content); // 记录到内存

      tabTitleArr.push($title);
      tabContentArr.push($content); // 设置 active 项

      if (tabIndex === 0) {
        $title.data('active', true);
        $title.addClass('w-e-active');
      } else {
        $content.hide();
      } // 绑定 tab 的事件


      $title.on('click', function () {
        if ($title.data('active')) {
          return;
        } // 隐藏所有的 tab


        (0, _forEach["default"])(tabTitleArr).call(tabTitleArr, function ($title) {
          $title.data('active', false);
          $title.removeClass('w-e-active');
        });
        (0, _forEach["default"])(tabContentArr).call(tabContentArr, function ($content) {
          $content.hide();
        }); // 显示当前的 tab

        $title.data('active', true);
        $title.addClass('w-e-active');
        $content.show();
      });
    }); // 绑定关闭事件

    $container.on('click', function (e) {
      // 点击时阻止冒泡
      e.stopPropagation();
    }); // 添加到 DOM

    menu.$elem.append($container); // 设置tab内input的值

    conf.setLinkValue && conf.setLinkValue($container, 'text');
    conf.setLinkValue && conf.setLinkValue($container, 'link'); // 绑定 conf events 的事件，只有添加到 DOM 之后才能绑定成功

    (0, _forEach["default"])(tabs).call(tabs, function (tab, index) {
      if (!tab) {
        return;
      }

      var events = tab.events || [];
      (0, _forEach["default"])(events).call(events, function (event) {
        var _a;

        var selector = event.selector;
        var type = event.type;
        var fn = event.fn || const_1.EMPTY_FN;
        var $content = tabContentArr[index];
        var bindEnter = (_a = event.bindEnter) !== null && _a !== void 0 ? _a : false;

        var doneFn = function doneFn(e) {
          return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var needToHide;
            return tslib_1.__generator(this, function (_a) {
              switch (_a.label) {
                case 0:
                  e.stopPropagation();
                  return [4
                  /*yield*/
                  , fn(e) // 执行完事件之后，是否要关闭 panel
                  ];

                case 1:
                  needToHide = _a.sent(); // 执行完事件之后，是否要关闭 panel

                  if (needToHide) {
                    this.remove();
                  }

                  return [2
                  /*return*/
                  ];
              }
            });
          });
        }; // 给按钮绑定相应的事件


        (0, _find["default"])($content).call($content, selector).on(type, doneFn); // 绑定enter键入事件

        if (bindEnter && type === 'click') {
          $content.on('keyup', function (e) {
            if (e.keyCode == 13) {
              doneFn(e);
            }
          });
        }
      });
    }); // focus 第一个 elem

    var $inputs = (0, _find["default"])($container).call($container, 'input[type=text],textarea');

    if ($inputs.length) {
      $inputs.get(0).focus();
    } // 隐藏其他 panel


    Panel.hideCurAllPanels(); // 记录该 menu 已经创建了 panel

    menu.setPanel(this);
    Panel.createdMenus.add(menu);
  };
  /**
   * 移除 penal
   */


  Panel.prototype.remove = function () {
    var menu = this.menu;
    var $container = this.$container;

    if ($container) {
      $container.remove();
    } // 将该 menu 记录中移除


    Panel.createdMenus["delete"](menu);
  };
  /**
   * 隐藏当前所有的 panel
   */


  Panel.hideCurAllPanels = function () {
    var _context;

    if (Panel.createdMenus.size === 0) {
      return;
    }

    (0, _forEach["default"])(_context = Panel.createdMenus).call(_context, function (menu) {
      var panel = menu.panel;
      panel && panel.remove();
    });
  }; // 记录已经创建过的 panelMenu


  Panel.createdMenus = new _set["default"]();
  return Panel;
}();

exports["default"] = Panel;

/***/ }),
/* 34 */
/***/ (function(module, exports) {

var toString = {}.toString;

module.exports = function (it) {
  return toString.call(it).slice(8, -1);
};


/***/ }),
/* 35 */
/***/ (function(module, exports, __webpack_require__) {

var toInteger = __webpack_require__(62);

var min = Math.min;

// `ToLength` abstract operation
// https://tc39.github.io/ecma262/#sec-tolength
module.exports = function (argument) {
  return argument > 0 ? min(toInteger(argument), 0x1FFFFFFFFFFFFF) : 0; // 2 ** 53 - 1 == 9007199254740991
};


/***/ }),
/* 36 */
/***/ (function(module, exports, __webpack_require__) {

var path = __webpack_require__(9);
var global = __webpack_require__(8);

var aFunction = function (variable) {
  return typeof variable == 'function' ? variable : undefined;
};

module.exports = function (namespace, method) {
  return arguments.length < 2 ? aFunction(path[namespace]) || aFunction(global[namespace])
    : path[namespace] && path[namespace][method] || global[namespace] && global[namespace][method];
};


/***/ }),
/* 37 */
/***/ (function(module, exports, __webpack_require__) {

var TO_STRING_TAG_SUPPORT = __webpack_require__(81);
var defineProperty = __webpack_require__(18).f;
var createNonEnumerableProperty = __webpack_require__(19);
var has = __webpack_require__(16);
var toString = __webpack_require__(170);
var wellKnownSymbol = __webpack_require__(10);

var TO_STRING_TAG = wellKnownSymbol('toStringTag');

module.exports = function (it, TAG, STATIC, SET_METHOD) {
  if (it) {
    var target = STATIC ? it : it.prototype;
    if (!has(target, TO_STRING_TAG)) {
      defineProperty(target, TO_STRING_TAG, { configurable: true, value: TAG });
    }
    if (SET_METHOD && !TO_STRING_TAG_SUPPORT) {
      createNonEnumerableProperty(target, 'toString', toString);
    }
  }
};


/***/ }),
/* 38 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description Modal 菜单 Class
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var Menu_1 = tslib_1.__importDefault(__webpack_require__(95));

var PanelMenu =
/** @class */
function (_super) {
  tslib_1.__extends(PanelMenu, _super);

  function PanelMenu($elem, editor) {
    return _super.call(this, $elem, editor) || this;
  }
  /**
   * 给 menu 设置 panel
   * @param panel panel 实例
   */


  PanelMenu.prototype.setPanel = function (panel) {
    this.panel = panel;
  };

  return PanelMenu;
}(Menu_1["default"]);

exports["default"] = PanelMenu;

/***/ }),
/* 39 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description Tooltip class
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

var _bind = _interopRequireDefault(__webpack_require__(57));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var Tooltip =
/** @class */
function () {
  function Tooltip(editor, $elem, conf) {
    this.editor = editor;
    this.$targetElem = $elem;
    this.conf = conf;
    this._show = false;
    this._isInsertTextContainer = false; // 定义 container

    var $container = dom_core_1["default"]('<div></div>');
    $container.addClass('w-e-tooltip');
    this.$container = $container;
  }
  /**
   * 获取 tooltip 定位
   */


  Tooltip.prototype.getPositionData = function () {
    var $container = this.$container;
    var top = 0;
    var left = 0; // tooltip 的高度

    var tooltipHeight = 20; // 网页的 scrollTop

    var pageScrollTop = document.documentElement.scrollTop; // 目标元素的 rect

    var targetElemRect = this.$targetElem.getBoundingClientRect(); // 编辑区域的 rect

    var textElemRect = this.editor.$textElem.getBoundingClientRect(); // 获取基于 textContainerElem 的 位置信息

    var targetOffset = this.$targetElem.getOffsetData();
    var targetParentElem = dom_core_1["default"](targetOffset.parent); // 获取 编辑区域的滚动条信息

    var scrollTop = this.editor.$textElem.elems[0].scrollTop; // 是否插入 textContainer 中

    this._isInsertTextContainer = targetParentElem.equal(this.editor.$textContainerElem);

    if (this._isInsertTextContainer) {
      // 父容器的高度
      var targetParentElemHeight = targetParentElem.getBoundingClientRect().height; // 相对于父容器的位置信息

      var offsetTop = targetOffset.top,
          offsetLeft = targetOffset.left,
          offsetHeight = targetOffset.height; // 元素基于父容器的 绝对top信息

      var absoluteTop = offsetTop - scrollTop;

      if (absoluteTop > tooltipHeight + 5) {
        // 说明模板元素的顶部空间足够
        top = absoluteTop - tooltipHeight - 15;
        $container.addClass('w-e-tooltip-up');
      } else if (absoluteTop + offsetHeight + tooltipHeight < targetParentElemHeight) {
        // 说明模板元素的底部空间足够
        top = absoluteTop + offsetHeight + 10;
        $container.addClass('w-e-tooltip-down');
      } else {
        // 其他情况，tooltip 放在目标元素左上角
        top = (absoluteTop > 0 ? absoluteTop : 0) + tooltipHeight + 10;
        $container.addClass('w-e-tooltip-down');
      } // 计算 left


      if (offsetLeft < 0) {
        left = 0;
      } else {
        left = offsetLeft;
      }
    } else {
      if (targetElemRect.top < tooltipHeight) {
        // 说明目标元素的顶部，因滑动隐藏在浏览器上方。tooltip 要放在目标元素下面
        top = targetElemRect.bottom + pageScrollTop + 5; // 5px 间距

        $container.addClass('w-e-tooltip-down');
      } else if (targetElemRect.top - textElemRect.top < tooltipHeight) {
        // 说明目标元素的顶部，因滑动隐藏在编辑区域上方。tooltip 要放在目标元素下面
        top = targetElemRect.bottom + pageScrollTop + 5; // 5px 间距

        $container.addClass('w-e-tooltip-down');
      } else {
        // 其他情况，tooltip 放在目标元素上方
        top = targetElemRect.top + pageScrollTop - tooltipHeight - 15; // 减去 toolbar 的高度，还有 15px 间距

        $container.addClass('w-e-tooltip-up');
      } // 计算 left


      if (targetElemRect.left < 0) {
        left = 0;
      } else {
        left = targetElemRect.left;
      }
    } // 返回结果


    return {
      top: top,
      left: left
    };
  };
  /**
   * 添加 tooltip 菜单
   */


  Tooltip.prototype.appendMenus = function () {
    var _this = this;

    var conf = this.conf;
    var editor = this.editor;
    var $targetElem = this.$targetElem;
    var $container = this.$container;
    (0, _forEach["default"])(conf).call(conf, function (item, index) {
      // 添加元素
      var $elem = item.$elem;
      var $wrapper = dom_core_1["default"]('<div></div>');
      $wrapper.addClass('w-e-tooltip-item-wrapper ');
      $wrapper.append($elem);
      $container.append($wrapper); // 绑定点击事件

      $elem.on('click', function (e) {
        e.preventDefault();
        var res = item.onClick(editor, $targetElem);
        if (res) _this.remove();
      });
    });
  };
  /**
   * 创建 tooltip
   */


  Tooltip.prototype.create = function () {
    var _context, _context2;

    var editor = this.editor;
    var $container = this.$container; // 生成 container 的内容

    this.appendMenus(); // 设置定位

    var _a = this.getPositionData(),
        top = _a.top,
        left = _a.left;

    $container.css('top', top + "px");
    $container.css('left', left + "px"); // 设置 z-index

    $container.css('z-index', editor.zIndex.get('tooltip')); // 添加到 DOM

    if (this._isInsertTextContainer) {
      this.editor.$textContainerElem.append($container);
    } else {
      dom_core_1["default"]('body').append($container);
    }

    this._show = true;
    editor.beforeDestroy((0, _bind["default"])(_context = this.remove).call(_context, this));
    editor.txt.eventHooks.onBlurEvents.push((0, _bind["default"])(_context2 = this.remove).call(_context2, this));
  };
  /**
   * 移除该 tooltip
   */


  Tooltip.prototype.remove = function () {
    this.$container.remove();
    this._show = false;
  };

  (0, _defineProperty["default"])(Tooltip.prototype, "isShow", {
    /**
     * 是否显示
     */
    get: function get() {
      return this._show;
    },
    enumerable: false,
    configurable: true
  });
  return Tooltip;
}();

exports["default"] = Tooltip;

/***/ }),
/* 40 */
/***/ (function(module, exports, __webpack_require__) {

var aFunction = __webpack_require__(41);

// optional / simple context binding
module.exports = function (fn, that, length) {
  aFunction(fn);
  if (that === undefined) return fn;
  switch (length) {
    case 0: return function () {
      return fn.call(that);
    };
    case 1: return function (a) {
      return fn.call(that, a);
    };
    case 2: return function (a, b) {
      return fn.call(that, a, b);
    };
    case 3: return function (a, b, c) {
      return fn.call(that, a, b, c);
    };
  }
  return function (/* ...args */) {
    return fn.apply(that, arguments);
  };
};


/***/ }),
/* 41 */
/***/ (function(module, exports) {

module.exports = function (it) {
  if (typeof it != 'function') {
    throw TypeError(String(it) + ' is not a function');
  } return it;
};


/***/ }),
/* 42 */
/***/ (function(module, exports, __webpack_require__) {

var NATIVE_WEAK_MAP = __webpack_require__(165);
var global = __webpack_require__(8);
var isObject = __webpack_require__(13);
var createNonEnumerableProperty = __webpack_require__(19);
var objectHas = __webpack_require__(16);
var sharedKey = __webpack_require__(63);
var hiddenKeys = __webpack_require__(51);

var WeakMap = global.WeakMap;
var set, get, has;

var enforce = function (it) {
  return has(it) ? get(it) : set(it, {});
};

var getterFor = function (TYPE) {
  return function (it) {
    var state;
    if (!isObject(it) || (state = get(it)).type !== TYPE) {
      throw TypeError('Incompatible receiver, ' + TYPE + ' required');
    } return state;
  };
};

if (NATIVE_WEAK_MAP) {
  var store = new WeakMap();
  var wmget = store.get;
  var wmhas = store.has;
  var wmset = store.set;
  set = function (it, metadata) {
    wmset.call(store, it, metadata);
    return metadata;
  };
  get = function (it) {
    return wmget.call(store, it) || {};
  };
  has = function (it) {
    return wmhas.call(store, it);
  };
} else {
  var STATE = sharedKey('state');
  hiddenKeys[STATE] = true;
  set = function (it, metadata) {
    createNonEnumerableProperty(it, STATE, metadata);
    return metadata;
  };
  get = function (it) {
    return objectHas(it, STATE) ? it[STATE] : {};
  };
  has = function (it) {
    return objectHas(it, STATE);
  };
}

module.exports = {
  set: set,
  get: get,
  has: has,
  enforce: enforce,
  getterFor: getterFor
};


/***/ }),
/* 43 */
/***/ (function(module, exports) {

module.exports = true;


/***/ }),
/* 44 */
/***/ (function(module, exports) {

module.exports = {};


/***/ }),
/* 45 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(261);

/***/ }),
/* 46 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(265);

/***/ }),
/* 47 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.createElementFragment = exports.createDocumentFragment = exports.createElement = exports.insertBefore = exports.getEndPoint = exports.getStartPoint = exports.updateRange = exports.filterSelectionNodes = void 0;

var tslib_1 = __webpack_require__(2);

var _1 = __webpack_require__(137);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));
/**
 * 过滤 选择的 node 节点
 * @returns { DomElement[] } DomElement[]
 */


function filterSelectionNodes($nodes) {
  var $listHtml = [];
  (0, _forEach["default"])($nodes).call($nodes, function ($node) {
    var targerName = $node.getNodeName();

    if (targerName !== _1.ListType.OrderedList && targerName !== _1.ListType.UnorderedList) {
      // 非序列
      $listHtml.push($node);
    } else {
      // 序列
      if ($node.prior) {
        $listHtml.push($node.prior);
      } else {
        var $children = $node.children();
        $children === null || $children === void 0 ? void 0 : (0, _forEach["default"])($children).call($children, function ($li) {
          $listHtml.push(dom_core_1["default"]($li));
        });
      }
    }
  });
  return $listHtml;
}

exports.filterSelectionNodes = filterSelectionNodes;
/**
 * 更新选区
 * @param $node
 */

function updateRange(editor, $node, collapsed) {
  var selection = editor.selection;
  var range = document.createRange(); // ===============================
  // length 大于 1
  // 代表着转换是一个文档节点多段落
  // ===============================

  if ($node.length > 1) {
    range.setStart($node.elems[0], 0);
    range.setEnd($node.elems[$node.length - 1], $node.elems[$node.length - 1].childNodes.length);
  } // ===============================
  // 序列节点 或 单段落
  // ===============================
  else {
      range.selectNodeContents($node.elems[0]);
    } // ===============================
  // collapsed 为 true 代表是光标
  // ===============================


  collapsed && range.collapse(false);
  selection.saveRange(range);
  selection.restoreSelection();
}

exports.updateRange = updateRange;
/**
 * 获取起点元素
 * @param $startElem 开始序列节点
 */

function getStartPoint($startElem) {
  var _a;

  return $startElem.prior ? $startElem.prior // 有 prior 代表不是全选序列
  : dom_core_1["default"]((_a = $startElem.children()) === null || _a === void 0 ? void 0 : _a.elems[0]); // 没有则代表全选序列
}

exports.getStartPoint = getStartPoint;
/**
 * 获取结束元素
 * @param $endElem 结束序列节点
 */

function getEndPoint($endElem) {
  var _a;

  return $endElem.prior ? $endElem.prior // 有 prior 代表不是全选序列
  : dom_core_1["default"]((_a = $endElem.children()) === null || _a === void 0 ? void 0 : _a.last().elems[0]); // 没有则代表全选序列
}

exports.getEndPoint = getEndPoint;
/**
 * 在您指定节点的已有子节点之前插入新的子节点。
 * @param { DomElement } $node 指定节点
 * @param { ContainerFragment } newNode 插入的新子节点
 * @param { Node | null } existingNode 指定子节点
 */

function insertBefore($node, newNode, existingNode) {
  if (existingNode === void 0) {
    existingNode = null;
  }

  $node.parent().elems[0].insertBefore(newNode, existingNode);
}

exports.insertBefore = insertBefore;
/**
 * 创建指定的 element 对象
 */

function createElement(target) {
  return document.createElement(target);
}

exports.createElement = createElement;
/**
 * 创建文档片段
 */

function createDocumentFragment() {
  return document.createDocumentFragment();
}

exports.createDocumentFragment = createDocumentFragment;
/**
 * 生成 li 标签的元素，并返回 $fragment 文档片段
 * @param { DomElement[] } $nodes 需要转换成 li 的 dom 元素数组
 * @param { ContainerFragment } $fragment 用于存储生成后 li 元素的文档片段
 */

function createElementFragment($nodes, $fragment, tag) {
  if (tag === void 0) {
    tag = 'li';
  }

  (0, _forEach["default"])($nodes).call($nodes, function ($node) {
    var $list = createElement(tag);
    $list.innerHTML = $node.html();
    $fragment.appendChild($list);
    $node.remove();
  });
  return $fragment;
}

exports.createElementFragment = createElementFragment;

/***/ }),
/* 48 */
/***/ (function(module, exports) {

module.exports = function (bitmap, value) {
  return {
    enumerable: !(bitmap & 1),
    configurable: !(bitmap & 2),
    writable: !(bitmap & 4),
    value: value
  };
};


/***/ }),
/* 49 */
/***/ (function(module, exports) {

// `RequireObjectCoercible` abstract operation
// https://tc39.github.io/ecma262/#sec-requireobjectcoercible
module.exports = function (it) {
  if (it == undefined) throw TypeError("Can't call method on " + it);
  return it;
};


/***/ }),
/* 50 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var charAt = __webpack_require__(164).charAt;
var InternalStateModule = __webpack_require__(42);
var defineIterator = __webpack_require__(75);

var STRING_ITERATOR = 'String Iterator';
var setInternalState = InternalStateModule.set;
var getInternalState = InternalStateModule.getterFor(STRING_ITERATOR);

// `String.prototype[@@iterator]` method
// https://tc39.github.io/ecma262/#sec-string.prototype-@@iterator
defineIterator(String, 'String', function (iterated) {
  setInternalState(this, {
    type: STRING_ITERATOR,
    string: String(iterated),
    index: 0
  });
// `%StringIteratorPrototype%.next` method
// https://tc39.github.io/ecma262/#sec-%stringiteratorprototype%.next
}, function next() {
  var state = getInternalState(this);
  var string = state.string;
  var index = state.index;
  var point;
  if (index >= string.length) return { value: undefined, done: true };
  point = charAt(string, index);
  state.index += point.length;
  return { value: point, done: false };
});


/***/ }),
/* 51 */
/***/ (function(module, exports) {

module.exports = {};


/***/ }),
/* 52 */
/***/ (function(module, exports, __webpack_require__) {

var internalObjectKeys = __webpack_require__(107);
var enumBugKeys = __webpack_require__(80);

// `Object.keys` method
// https://tc39.github.io/ecma262/#sec-object.keys
module.exports = Object.keys || function keys(O) {
  return internalObjectKeys(O, enumBugKeys);
};


/***/ }),
/* 53 */
/***/ (function(module, exports, __webpack_require__) {

var createNonEnumerableProperty = __webpack_require__(19);

module.exports = function (target, key, value, options) {
  if (options && options.enumerable) target[key] = value;
  else createNonEnumerableProperty(target, key, value);
};


/***/ }),
/* 54 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(173);
var DOMIterables = __webpack_require__(174);
var global = __webpack_require__(8);
var classof = __webpack_require__(65);
var createNonEnumerableProperty = __webpack_require__(19);
var Iterators = __webpack_require__(44);
var wellKnownSymbol = __webpack_require__(10);

var TO_STRING_TAG = wellKnownSymbol('toStringTag');

for (var COLLECTION_NAME in DOMIterables) {
  var Collection = global[COLLECTION_NAME];
  var CollectionPrototype = Collection && Collection.prototype;
  if (CollectionPrototype && classof(CollectionPrototype) !== TO_STRING_TAG) {
    createNonEnumerableProperty(CollectionPrototype, TO_STRING_TAG, COLLECTION_NAME);
  }
  Iterators[COLLECTION_NAME] = Iterators.Array;
}


/***/ }),
/* 55 */
/***/ (function(module, exports, __webpack_require__) {

var classof = __webpack_require__(34);

// `IsArray` abstract operation
// https://tc39.github.io/ecma262/#sec-isarray
module.exports = Array.isArray || function isArray(arg) {
  return classof(arg) == 'Array';
};


/***/ }),
/* 56 */
/***/ (function(module, exports, __webpack_require__) {

var fails = __webpack_require__(11);
var wellKnownSymbol = __webpack_require__(10);
var V8_VERSION = __webpack_require__(86);

var SPECIES = wellKnownSymbol('species');

module.exports = function (METHOD_NAME) {
  // We can't use this feature detection in V8 since it causes
  // deoptimization and serious performance degradation
  // https://github.com/zloirock/core-js/issues/677
  return V8_VERSION >= 51 || !fails(function () {
    var array = [];
    var constructor = array.constructor = {};
    constructor[SPECIES] = function () {
      return { foo: 1 };
    };
    return array[METHOD_NAME](Boolean).foo !== 1;
  });
};


/***/ }),
/* 57 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(222);

/***/ }),
/* 58 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.ListHandle = void 0;

var tslib_1 = __webpack_require__(2);

var SelectionRangeElem_1 = tslib_1.__importDefault(__webpack_require__(373));

var ListHandle =
/** @class */
function () {
  function ListHandle(options) {
    this.options = options;
    this.selectionRangeElem = new SelectionRangeElem_1["default"]();
  }

  return ListHandle;
}();

exports.ListHandle = ListHandle;

/***/ }),
/* 59 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var nativePropertyIsEnumerable = {}.propertyIsEnumerable;
var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;

// Nashorn ~ JDK8 bug
var NASHORN_BUG = getOwnPropertyDescriptor && !nativePropertyIsEnumerable.call({ 1: 2 }, 1);

// `Object.prototype.propertyIsEnumerable` method implementation
// https://tc39.github.io/ecma262/#sec-object.prototype.propertyisenumerable
exports.f = NASHORN_BUG ? function propertyIsEnumerable(V) {
  var descriptor = getOwnPropertyDescriptor(this, V);
  return !!descriptor && descriptor.enumerable;
} : nativePropertyIsEnumerable;


/***/ }),
/* 60 */
/***/ (function(module, exports, __webpack_require__) {

var isObject = __webpack_require__(13);

// `ToPrimitive` abstract operation
// https://tc39.github.io/ecma262/#sec-toprimitive
// instead of the ES6 spec version, we didn't implement @@toPrimitive case
// and the second argument - flag - preferred type is a string
module.exports = function (input, PREFERRED_STRING) {
  if (!isObject(input)) return input;
  var fn, val;
  if (PREFERRED_STRING && typeof (fn = input.toString) == 'function' && !isObject(val = fn.call(input))) return val;
  if (typeof (fn = input.valueOf) == 'function' && !isObject(val = fn.call(input))) return val;
  if (!PREFERRED_STRING && typeof (fn = input.toString) == 'function' && !isObject(val = fn.call(input))) return val;
  throw TypeError("Can't convert object to primitive value");
};


/***/ }),
/* 61 */
/***/ (function(module, exports) {

// empty


/***/ }),
/* 62 */
/***/ (function(module, exports) {

var ceil = Math.ceil;
var floor = Math.floor;

// `ToInteger` abstract operation
// https://tc39.github.io/ecma262/#sec-tointeger
module.exports = function (argument) {
  return isNaN(argument = +argument) ? 0 : (argument > 0 ? floor : ceil)(argument);
};


/***/ }),
/* 63 */
/***/ (function(module, exports, __webpack_require__) {

var shared = __webpack_require__(74);
var uid = __webpack_require__(64);

var keys = shared('keys');

module.exports = function (key) {
  return keys[key] || (keys[key] = uid(key));
};


/***/ }),
/* 64 */
/***/ (function(module, exports) {

var id = 0;
var postfix = Math.random();

module.exports = function (key) {
  return 'Symbol(' + String(key === undefined ? '' : key) + ')_' + (++id + postfix).toString(36);
};


/***/ }),
/* 65 */
/***/ (function(module, exports, __webpack_require__) {

var TO_STRING_TAG_SUPPORT = __webpack_require__(81);
var classofRaw = __webpack_require__(34);
var wellKnownSymbol = __webpack_require__(10);

var TO_STRING_TAG = wellKnownSymbol('toStringTag');
// ES3 wrong here
var CORRECT_ARGUMENTS = classofRaw(function () { return arguments; }()) == 'Arguments';

// fallback for IE11 Script Access Denied error
var tryGet = function (it, key) {
  try {
    return it[key];
  } catch (error) { /* empty */ }
};

// getting tag from ES6+ `Object.prototype.toString`
module.exports = TO_STRING_TAG_SUPPORT ? classofRaw : function (it) {
  var O, tag, result;
  return it === undefined ? 'Undefined' : it === null ? 'Null'
    // @@toStringTag case
    : typeof (tag = tryGet(O = Object(it), TO_STRING_TAG)) == 'string' ? tag
    // builtinTag case
    : CORRECT_ARGUMENTS ? classofRaw(O)
    // ES3 arguments fallback
    : (result = classofRaw(O)) == 'Object' && typeof O.callee == 'function' ? 'Arguments' : result;
};


/***/ }),
/* 66 */
/***/ (function(module, exports, __webpack_require__) {

var anObject = __webpack_require__(25);
var isArrayIteratorMethod = __webpack_require__(112);
var toLength = __webpack_require__(35);
var bind = __webpack_require__(40);
var getIteratorMethod = __webpack_require__(113);
var callWithSafeIterationClosing = __webpack_require__(114);

var Result = function (stopped, result) {
  this.stopped = stopped;
  this.result = result;
};

var iterate = module.exports = function (iterable, fn, that, AS_ENTRIES, IS_ITERATOR) {
  var boundFunction = bind(fn, that, AS_ENTRIES ? 2 : 1);
  var iterator, iterFn, index, length, result, next, step;

  if (IS_ITERATOR) {
    iterator = iterable;
  } else {
    iterFn = getIteratorMethod(iterable);
    if (typeof iterFn != 'function') throw TypeError('Target is not iterable');
    // optimisation for array iterators
    if (isArrayIteratorMethod(iterFn)) {
      for (index = 0, length = toLength(iterable.length); length > index; index++) {
        result = AS_ENTRIES
          ? boundFunction(anObject(step = iterable[index])[0], step[1])
          : boundFunction(iterable[index]);
        if (result && result instanceof Result) return result;
      } return new Result(false);
    }
    iterator = iterFn.call(iterable);
  }

  next = iterator.next;
  while (!(step = next.call(iterator)).done) {
    result = callWithSafeIterationClosing(iterator, boundFunction, step.value, AS_ENTRIES);
    if (typeof result == 'object' && result && result instanceof Result) return result;
  } return new Result(false);
};

iterate.stop = function (result) {
  return new Result(true, result);
};


/***/ }),
/* 67 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var fails = __webpack_require__(11);

module.exports = function (METHOD_NAME, argument) {
  var method = [][METHOD_NAME];
  return !!method && fails(function () {
    // eslint-disable-next-line no-useless-call,no-throw-literal
    method.call(null, argument || function () { throw 1; }, 1);
  });
};


/***/ }),
/* 68 */
/***/ (function(module, exports) {

// a string of all valid unicode whitespaces
// eslint-disable-next-line max-len
module.exports = '\u0009\u000A\u000B\u000C\u000D\u0020\u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF';


/***/ }),
/* 69 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var toPrimitive = __webpack_require__(60);
var definePropertyModule = __webpack_require__(18);
var createPropertyDescriptor = __webpack_require__(48);

module.exports = function (object, key, value) {
  var propertyKey = toPrimitive(key);
  if (propertyKey in object) definePropertyModule.f(object, propertyKey, createPropertyDescriptor(0, value));
  else object[propertyKey] = value;
};


/***/ }),
/* 70 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(209);

/***/ }),
/* 71 */
/***/ (function(module, exports, __webpack_require__) {

var DESCRIPTORS = __webpack_require__(14);
var propertyIsEnumerableModule = __webpack_require__(59);
var createPropertyDescriptor = __webpack_require__(48);
var toIndexedObject = __webpack_require__(30);
var toPrimitive = __webpack_require__(60);
var has = __webpack_require__(16);
var IE8_DOM_DEFINE = __webpack_require__(100);

var nativeGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;

// `Object.getOwnPropertyDescriptor` method
// https://tc39.github.io/ecma262/#sec-object.getownpropertydescriptor
exports.f = DESCRIPTORS ? nativeGetOwnPropertyDescriptor : function getOwnPropertyDescriptor(O, P) {
  O = toIndexedObject(O);
  P = toPrimitive(P, true);
  if (IE8_DOM_DEFINE) try {
    return nativeGetOwnPropertyDescriptor(O, P);
  } catch (error) { /* empty */ }
  if (has(O, P)) return createPropertyDescriptor(!propertyIsEnumerableModule.f.call(O, P), O[P]);
};


/***/ }),
/* 72 */
/***/ (function(module, exports, __webpack_require__) {

var fails = __webpack_require__(11);
var classof = __webpack_require__(34);

var split = ''.split;

// fallback for non-array-like ES3 and non-enumerable old V8 strings
module.exports = fails(function () {
  // throws an error in rhino, see https://github.com/mozilla/rhino/issues/346
  // eslint-disable-next-line no-prototype-builtins
  return !Object('z').propertyIsEnumerable(0);
}) ? function (it) {
  return classof(it) == 'String' ? split.call(it, '') : Object(it);
} : Object;


/***/ }),
/* 73 */
/***/ (function(module, exports, __webpack_require__) {

var global = __webpack_require__(8);
var isObject = __webpack_require__(13);

var document = global.document;
// typeof document.createElement is 'object' in old IE
var EXISTS = isObject(document) && isObject(document.createElement);

module.exports = function (it) {
  return EXISTS ? document.createElement(it) : {};
};


/***/ }),
/* 74 */
/***/ (function(module, exports, __webpack_require__) {

var IS_PURE = __webpack_require__(43);
var store = __webpack_require__(103);

(module.exports = function (key, value) {
  return store[key] || (store[key] = value !== undefined ? value : {});
})('versions', []).push({
  version: '3.6.4',
  mode: IS_PURE ? 'pure' : 'global',
  copyright: '© 2020 Denis Pushkarev (zloirock.ru)'
});


/***/ }),
/* 75 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var $ = __webpack_require__(5);
var createIteratorConstructor = __webpack_require__(167);
var getPrototypeOf = __webpack_require__(105);
var setPrototypeOf = __webpack_require__(171);
var setToStringTag = __webpack_require__(37);
var createNonEnumerableProperty = __webpack_require__(19);
var redefine = __webpack_require__(53);
var wellKnownSymbol = __webpack_require__(10);
var IS_PURE = __webpack_require__(43);
var Iterators = __webpack_require__(44);
var IteratorsCore = __webpack_require__(104);

var IteratorPrototype = IteratorsCore.IteratorPrototype;
var BUGGY_SAFARI_ITERATORS = IteratorsCore.BUGGY_SAFARI_ITERATORS;
var ITERATOR = wellKnownSymbol('iterator');
var KEYS = 'keys';
var VALUES = 'values';
var ENTRIES = 'entries';

var returnThis = function () { return this; };

module.exports = function (Iterable, NAME, IteratorConstructor, next, DEFAULT, IS_SET, FORCED) {
  createIteratorConstructor(IteratorConstructor, NAME, next);

  var getIterationMethod = function (KIND) {
    if (KIND === DEFAULT && defaultIterator) return defaultIterator;
    if (!BUGGY_SAFARI_ITERATORS && KIND in IterablePrototype) return IterablePrototype[KIND];
    switch (KIND) {
      case KEYS: return function keys() { return new IteratorConstructor(this, KIND); };
      case VALUES: return function values() { return new IteratorConstructor(this, KIND); };
      case ENTRIES: return function entries() { return new IteratorConstructor(this, KIND); };
    } return function () { return new IteratorConstructor(this); };
  };

  var TO_STRING_TAG = NAME + ' Iterator';
  var INCORRECT_VALUES_NAME = false;
  var IterablePrototype = Iterable.prototype;
  var nativeIterator = IterablePrototype[ITERATOR]
    || IterablePrototype['@@iterator']
    || DEFAULT && IterablePrototype[DEFAULT];
  var defaultIterator = !BUGGY_SAFARI_ITERATORS && nativeIterator || getIterationMethod(DEFAULT);
  var anyNativeIterator = NAME == 'Array' ? IterablePrototype.entries || nativeIterator : nativeIterator;
  var CurrentIteratorPrototype, methods, KEY;

  // fix native
  if (anyNativeIterator) {
    CurrentIteratorPrototype = getPrototypeOf(anyNativeIterator.call(new Iterable()));
    if (IteratorPrototype !== Object.prototype && CurrentIteratorPrototype.next) {
      if (!IS_PURE && getPrototypeOf(CurrentIteratorPrototype) !== IteratorPrototype) {
        if (setPrototypeOf) {
          setPrototypeOf(CurrentIteratorPrototype, IteratorPrototype);
        } else if (typeof CurrentIteratorPrototype[ITERATOR] != 'function') {
          createNonEnumerableProperty(CurrentIteratorPrototype, ITERATOR, returnThis);
        }
      }
      // Set @@toStringTag to native iterators
      setToStringTag(CurrentIteratorPrototype, TO_STRING_TAG, true, true);
      if (IS_PURE) Iterators[TO_STRING_TAG] = returnThis;
    }
  }

  // fix Array#{values, @@iterator}.name in V8 / FF
  if (DEFAULT == VALUES && nativeIterator && nativeIterator.name !== VALUES) {
    INCORRECT_VALUES_NAME = true;
    defaultIterator = function values() { return nativeIterator.call(this); };
  }

  // define iterator
  if ((!IS_PURE || FORCED) && IterablePrototype[ITERATOR] !== defaultIterator) {
    createNonEnumerableProperty(IterablePrototype, ITERATOR, defaultIterator);
  }
  Iterators[NAME] = defaultIterator;

  // export additional methods
  if (DEFAULT) {
    methods = {
      values: getIterationMethod(VALUES),
      keys: IS_SET ? defaultIterator : getIterationMethod(KEYS),
      entries: getIterationMethod(ENTRIES)
    };
    if (FORCED) for (KEY in methods) {
      if (BUGGY_SAFARI_ITERATORS || INCORRECT_VALUES_NAME || !(KEY in IterablePrototype)) {
        redefine(IterablePrototype, KEY, methods[KEY]);
      }
    } else $({ target: NAME, proto: true, forced: BUGGY_SAFARI_ITERATORS || INCORRECT_VALUES_NAME }, methods);
  }

  return methods;
};


/***/ }),
/* 76 */
/***/ (function(module, exports, __webpack_require__) {

var fails = __webpack_require__(11);

module.exports = !!Object.getOwnPropertySymbols && !fails(function () {
  // Chrome 38 Symbol has incorrect toString conversion
  // eslint-disable-next-line no-undef
  return !String(Symbol());
});


/***/ }),
/* 77 */
/***/ (function(module, exports, __webpack_require__) {

var anObject = __webpack_require__(25);
var defineProperties = __webpack_require__(169);
var enumBugKeys = __webpack_require__(80);
var hiddenKeys = __webpack_require__(51);
var html = __webpack_require__(108);
var documentCreateElement = __webpack_require__(73);
var sharedKey = __webpack_require__(63);

var GT = '>';
var LT = '<';
var PROTOTYPE = 'prototype';
var SCRIPT = 'script';
var IE_PROTO = sharedKey('IE_PROTO');

var EmptyConstructor = function () { /* empty */ };

var scriptTag = function (content) {
  return LT + SCRIPT + GT + content + LT + '/' + SCRIPT + GT;
};

// Create object with fake `null` prototype: use ActiveX Object with cleared prototype
var NullProtoObjectViaActiveX = function (activeXDocument) {
  activeXDocument.write(scriptTag(''));
  activeXDocument.close();
  var temp = activeXDocument.parentWindow.Object;
  activeXDocument = null; // avoid memory leak
  return temp;
};

// Create object with fake `null` prototype: use iframe Object with cleared prototype
var NullProtoObjectViaIFrame = function () {
  // Thrash, waste and sodomy: IE GC bug
  var iframe = documentCreateElement('iframe');
  var JS = 'java' + SCRIPT + ':';
  var iframeDocument;
  iframe.style.display = 'none';
  html.appendChild(iframe);
  // https://github.com/zloirock/core-js/issues/475
  iframe.src = String(JS);
  iframeDocument = iframe.contentWindow.document;
  iframeDocument.open();
  iframeDocument.write(scriptTag('document.F=Object'));
  iframeDocument.close();
  return iframeDocument.F;
};

// Check for document.domain and active x support
// No need to use active x approach when document.domain is not set
// see https://github.com/es-shims/es5-shim/issues/150
// variation of https://github.com/kitcambridge/es5-shim/commit/4f738ac066346
// avoid IE GC bug
var activeXDocument;
var NullProtoObject = function () {
  try {
    /* global ActiveXObject */
    activeXDocument = document.domain && new ActiveXObject('htmlfile');
  } catch (error) { /* ignore */ }
  NullProtoObject = activeXDocument ? NullProtoObjectViaActiveX(activeXDocument) : NullProtoObjectViaIFrame();
  var length = enumBugKeys.length;
  while (length--) delete NullProtoObject[PROTOTYPE][enumBugKeys[length]];
  return NullProtoObject();
};

hiddenKeys[IE_PROTO] = true;

// `Object.create` method
// https://tc39.github.io/ecma262/#sec-object.create
module.exports = Object.create || function create(O, Properties) {
  var result;
  if (O !== null) {
    EmptyConstructor[PROTOTYPE] = anObject(O);
    result = new EmptyConstructor();
    EmptyConstructor[PROTOTYPE] = null;
    // add "__proto__" for Object.getPrototypeOf polyfill
    result[IE_PROTO] = O;
  } else result = NullProtoObject();
  return Properties === undefined ? result : defineProperties(result, Properties);
};


/***/ }),
/* 78 */
/***/ (function(module, exports, __webpack_require__) {

var toIndexedObject = __webpack_require__(30);
var toLength = __webpack_require__(35);
var toAbsoluteIndex = __webpack_require__(79);

// `Array.prototype.{ indexOf, includes }` methods implementation
var createMethod = function (IS_INCLUDES) {
  return function ($this, el, fromIndex) {
    var O = toIndexedObject($this);
    var length = toLength(O.length);
    var index = toAbsoluteIndex(fromIndex, length);
    var value;
    // Array#includes uses SameValueZero equality algorithm
    // eslint-disable-next-line no-self-compare
    if (IS_INCLUDES && el != el) while (length > index) {
      value = O[index++];
      // eslint-disable-next-line no-self-compare
      if (value != value) return true;
    // Array#indexOf ignores holes, Array#includes - not
    } else for (;length > index; index++) {
      if ((IS_INCLUDES || index in O) && O[index] === el) return IS_INCLUDES || index || 0;
    } return !IS_INCLUDES && -1;
  };
};

module.exports = {
  // `Array.prototype.includes` method
  // https://tc39.github.io/ecma262/#sec-array.prototype.includes
  includes: createMethod(true),
  // `Array.prototype.indexOf` method
  // https://tc39.github.io/ecma262/#sec-array.prototype.indexof
  indexOf: createMethod(false)
};


/***/ }),
/* 79 */
/***/ (function(module, exports, __webpack_require__) {

var toInteger = __webpack_require__(62);

var max = Math.max;
var min = Math.min;

// Helper for a popular repeating case of the spec:
// Let integer be ? ToInteger(index).
// If integer < 0, let result be max((length + integer), 0); else let result be min(integer, length).
module.exports = function (index, length) {
  var integer = toInteger(index);
  return integer < 0 ? max(integer + length, 0) : min(integer, length);
};


/***/ }),
/* 80 */
/***/ (function(module, exports) {

// IE8- don't enum bug keys
module.exports = [
  'constructor',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  'toString',
  'valueOf'
];


/***/ }),
/* 81 */
/***/ (function(module, exports, __webpack_require__) {

var wellKnownSymbol = __webpack_require__(10);

var TO_STRING_TAG = wellKnownSymbol('toStringTag');
var test = {};

test[TO_STRING_TAG] = 'z';

module.exports = String(test) === '[object z]';


/***/ }),
/* 82 */
/***/ (function(module, exports) {

module.exports = function () { /* empty */ };


/***/ }),
/* 83 */
/***/ (function(module, exports) {

module.exports = function (it, Constructor, name) {
  if (!(it instanceof Constructor)) {
    throw TypeError('Incorrect ' + (name ? name + ' ' : '') + 'invocation');
  } return it;
};


/***/ }),
/* 84 */
/***/ (function(module, exports, __webpack_require__) {

var getBuiltIn = __webpack_require__(36);

module.exports = getBuiltIn('navigator', 'userAgent') || '';


/***/ }),
/* 85 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var aFunction = __webpack_require__(41);

var PromiseCapability = function (C) {
  var resolve, reject;
  this.promise = new C(function ($$resolve, $$reject) {
    if (resolve !== undefined || reject !== undefined) throw TypeError('Bad Promise constructor');
    resolve = $$resolve;
    reject = $$reject;
  });
  this.resolve = aFunction(resolve);
  this.reject = aFunction(reject);
};

// 25.4.1.5 NewPromiseCapability(C)
module.exports.f = function (C) {
  return new PromiseCapability(C);
};


/***/ }),
/* 86 */
/***/ (function(module, exports, __webpack_require__) {

var global = __webpack_require__(8);
var userAgent = __webpack_require__(84);

var process = global.process;
var versions = process && process.versions;
var v8 = versions && versions.v8;
var match, version;

if (v8) {
  match = v8.split('.');
  version = match[0] + match[1];
} else if (userAgent) {
  match = userAgent.match(/Edge\/(\d+)/);
  if (!match || match[1] >= 74) {
    match = userAgent.match(/Chrome\/(\d+)/);
    if (match) version = match[1];
  }
}

module.exports = version && +version;


/***/ }),
/* 87 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 编辑器 class
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var util_1 = __webpack_require__(6);

var config_1 = tslib_1.__importDefault(__webpack_require__(267));

var selection_1 = tslib_1.__importDefault(__webpack_require__(280));

var command_1 = tslib_1.__importDefault(__webpack_require__(281));

var index_1 = tslib_1.__importDefault(__webpack_require__(282));

var index_2 = tslib_1.__importDefault(__webpack_require__(301));

var init_dom_1 = tslib_1.__importStar(__webpack_require__(416));

var init_selection_1 = tslib_1.__importDefault(__webpack_require__(417));

var bind_event_1 = tslib_1.__importDefault(__webpack_require__(418));

var i18next_init_1 = tslib_1.__importDefault(__webpack_require__(419));

var set_full_screen_1 = tslib_1.__importStar(__webpack_require__(420));

var scroll_to_head_1 = tslib_1.__importDefault(__webpack_require__(423));

var z_index_1 = tslib_1.__importDefault(__webpack_require__(424));

var index_3 = tslib_1.__importDefault(__webpack_require__(425));

var index_4 = tslib_1.__importDefault(__webpack_require__(427));

var disable_1 = tslib_1.__importDefault(__webpack_require__(437));

var selection_change_1 = tslib_1.__importDefault(__webpack_require__(440));

var plugins_1 = tslib_1.__importStar(__webpack_require__(441));

var BtnMenu_1 = tslib_1.__importDefault(__webpack_require__(23));

var DropList_1 = tslib_1.__importDefault(__webpack_require__(134));

var DropListMenu_1 = tslib_1.__importDefault(__webpack_require__(24));

var Panel_1 = tslib_1.__importDefault(__webpack_require__(33));

var PanelMenu_1 = tslib_1.__importDefault(__webpack_require__(38));

var Tooltip_1 = tslib_1.__importDefault(__webpack_require__(39));

var EDITOR_ID = 1;

var Editor =
/** @class */
function () {
  /**
   * 构造函数
   * @param toolbarSelector 工具栏 DOM selector
   * @param textSelector 文本区域 DOM selector
   */
  function Editor(toolbarSelector, textSelector) {
    this.pluginsFunctionList = {}; // 实例销毁前需要执行的钩子集合

    this.beforeDestroyHooks = []; // id，用以区分单个页面不同的编辑器对象

    this.id = "wangEditor-" + EDITOR_ID++;
    this.toolbarSelector = toolbarSelector;
    this.textSelector = textSelector;
    init_dom_1.selectorValidator(this); // 属性的默认值，后面可能会再修改
    // 默认配置 - 当一个页面有多个编辑器的时候，因为 JS 的特性(引用类型)会导致多个编辑器的 config 引用是同一个，所以需要 深度克隆 断掉引用

    this.config = util_1.deepClone(config_1["default"]);
    this.$toolbarElem = dom_core_1["default"]('<div></div>');
    this.$textContainerElem = dom_core_1["default"]('<div></div>');
    this.$textElem = dom_core_1["default"]('<div></div>');
    this.toolbarElemId = '';
    this.textElemId = '';
    this.isFocus = false;
    this.isComposing = false;
    this.isCompatibleMode = false;
    this.selection = new selection_1["default"](this);
    this.cmd = new command_1["default"](this);
    this.txt = new index_1["default"](this);
    this.menus = new index_2["default"](this);
    this.zIndex = new z_index_1["default"]();
    this.change = new index_3["default"](this);
    this.history = new index_4["default"](this);
    this.onSelectionChange = new selection_change_1["default"](this);

    var _a = disable_1["default"](this),
        disable = _a.disable,
        enable = _a.enable;

    this.disable = disable;
    this.enable = enable;
    this.isEnable = true;
  }
  /**
   * 初始化选区
   * @param newLine 新建一行
   */


  Editor.prototype.initSelection = function (newLine) {
    init_selection_1["default"](this, newLine);
  };
  /**
   * 创建编辑器实例
   */


  Editor.prototype.create = function () {
    // 初始化 ZIndex
    this.zIndex.init(this); // 确定当前的历史记录模式

    this.isCompatibleMode = this.config.compatibleMode(); // 标准模式下，重置延迟时间

    if (!this.isCompatibleMode) {
      this.config.onchangeTimeout = 30;
    } // 国际化 因为要在创建菜单前使用 所以要最先 初始化


    i18next_init_1["default"](this); // 初始化 DOM

    init_dom_1["default"](this); // 初始化 text

    this.txt.init(); // 初始化菜单

    this.menus.init(); // 初始化全屏功能

    set_full_screen_1["default"](this); // 初始化选区，将光标定位到内容尾部

    this.initSelection(true); // 绑定事件

    bind_event_1["default"](this); // 绑定监听的目标节点

    this.change.observe();
    this.history.observe(); // 初始化插件

    plugins_1["default"](this);
  };
  /**
   * 提供给用户添加销毁前的钩子函数
   * @param fn 钩子函数
   */


  Editor.prototype.beforeDestroy = function (fn) {
    this.beforeDestroyHooks.push(fn);
    return this;
  };
  /**
   * 销毁当前编辑器实例
   */


  Editor.prototype.destroy = function () {
    var _context;

    var _this = this; // 调用钩子函数


    (0, _forEach["default"])(_context = this.beforeDestroyHooks).call(_context, function (fn) {
      return fn.call(_this);
    }); // 销毁 DOM 节点

    this.$toolbarElem.remove();
    this.$textContainerElem.remove();
  };
  /**
   * 将编辑器设置为全屏
   */


  Editor.prototype.fullScreen = function () {
    set_full_screen_1.setFullScreen(this);
  };
  /**
   * 将编辑器退出全屏
   */


  Editor.prototype.unFullScreen = function () {
    set_full_screen_1.setUnFullScreen(this);
  };
  /**
   * 滚动到指定标题锚点
   * @param id 标题锚点id
   */


  Editor.prototype.scrollToHead = function (id) {
    scroll_to_head_1["default"](this, id);
  };
  /**
   * 自定义添加菜单
   * @param key 菜单 key
   * @param Menu 菜单构造函数
   */


  Editor.registerMenu = function (key, Menu) {
    if (!Menu || typeof Menu !== 'function') return;
    Editor.globalCustomMenuConstructorList[key] = Menu;
  };
  /**
   * 自定义添加插件
   * @param { string } name 插件的名称
   * @param { RegisterOptions } options 插件的选项
   */


  Editor.prototype.registerPlugin = function (name, options) {
    plugins_1.registerPlugin(name, options, this.pluginsFunctionList);
  };
  /**
   * 自定义添加插件
   * @param { string } name 插件的名称
   * @param { RegisterOptions } options 插件的选项
   */


  Editor.registerPlugin = function (name, options) {
    plugins_1.registerPlugin(name, options, Editor.globalPluginsFunctionList);
  }; // 暴露 $


  Editor.$ = dom_core_1["default"];
  Editor.BtnMenu = BtnMenu_1["default"];
  Editor.DropList = DropList_1["default"];
  Editor.DropListMenu = DropListMenu_1["default"];
  Editor.Panel = Panel_1["default"];
  Editor.PanelMenu = PanelMenu_1["default"];
  Editor.Tooltip = Tooltip_1["default"];
  Editor.globalCustomMenuConstructorList = {};
  Editor.globalPluginsFunctionList = {};
  return Editor;
}();

exports["default"] = Editor;

/***/ }),
/* 88 */
/***/ (function(module, exports, __webpack_require__) {

var isObject = __webpack_require__(13);
var isArray = __webpack_require__(55);
var wellKnownSymbol = __webpack_require__(10);

var SPECIES = wellKnownSymbol('species');

// `ArraySpeciesCreate` abstract operation
// https://tc39.github.io/ecma262/#sec-arrayspeciescreate
module.exports = function (originalArray, length) {
  var C;
  if (isArray(originalArray)) {
    C = originalArray.constructor;
    // cross-realm fallback
    if (typeof C == 'function' && (C === Array || isArray(C.prototype))) C = undefined;
    else if (isObject(C)) {
      C = C[SPECIES];
      if (C === null) C = undefined;
    }
  } return new (C === undefined ? Array : C)(length === 0 ? 0 : length);
};


/***/ }),
/* 89 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(185);

/***/ }),
/* 90 */
/***/ (function(module, exports, __webpack_require__) {

var requireObjectCoercible = __webpack_require__(49);
var whitespaces = __webpack_require__(68);

var whitespace = '[' + whitespaces + ']';
var ltrim = RegExp('^' + whitespace + whitespace + '*');
var rtrim = RegExp(whitespace + whitespace + '*$');

// `String.prototype.{ trim, trimStart, trimEnd, trimLeft, trimRight }` methods implementation
var createMethod = function (TYPE) {
  return function ($this) {
    var string = String(requireObjectCoercible($this));
    if (TYPE & 1) string = string.replace(ltrim, '');
    if (TYPE & 2) string = string.replace(rtrim, '');
    return string;
  };
};

module.exports = {
  // `String.prototype.{ trimLeft, trimStart }` methods
  // https://tc39.github.io/ecma262/#sec-string.prototype.trimstart
  start: createMethod(1),
  // `String.prototype.{ trimRight, trimEnd }` methods
  // https://tc39.github.io/ecma262/#sec-string.prototype.trimend
  end: createMethod(2),
  // `String.prototype.trim` method
  // https://tc39.github.io/ecma262/#sec-string.prototype.trim
  trim: createMethod(3)
};


/***/ }),
/* 91 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(205);

/***/ }),
/* 92 */
/***/ (function(module, exports, __webpack_require__) {

var _Symbol$iterator = __webpack_require__(227);

var _Symbol = __webpack_require__(230);

function _typeof(obj) {
  "@babel/helpers - typeof";

  if (typeof _Symbol === "function" && typeof _Symbol$iterator === "symbol") {
    module.exports = _typeof = function _typeof(obj) {
      return typeof obj;
    };
  } else {
    module.exports = _typeof = function _typeof(obj) {
      return obj && typeof _Symbol === "function" && obj.constructor === _Symbol && obj !== _Symbol.prototype ? "symbol" : typeof obj;
    };
  }

  return _typeof(obj);
}

module.exports = _typeof;

/***/ }),
/* 93 */
/***/ (function(module, exports, __webpack_require__) {

var wellKnownSymbol = __webpack_require__(10);

exports.f = wellKnownSymbol;


/***/ }),
/* 94 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(306);

/***/ }),
/* 95 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description Menu class 父类
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var Panel_1 = tslib_1.__importDefault(__webpack_require__(33));

var Menu =
/** @class */
function () {
  function Menu($elem, editor) {
    var _this = this;

    this.$elem = $elem;
    this.editor = editor;
    this._active = false; // 绑定菜单点击事件

    $elem.on('click', function (e) {
      var _context;

      Panel_1["default"].hideCurAllPanels(); // 隐藏当前的所有 Panel
      // 触发菜单点击的钩子

      (0, _forEach["default"])(_context = editor.txt.eventHooks.menuClickEvents).call(_context, function (fn) {
        return fn();
      });
      e.stopPropagation();

      if (editor.selection.getRange() == null) {
        return;
      }

      _this.clickHandler(e);
    });
  }
  /**
   * 菜单点击事件，子类可重写
   * @param e event
   */


  Menu.prototype.clickHandler = function (e) {};
  /**
   * 激活菜单，高亮显示
   */


  Menu.prototype.active = function () {
    this._active = true;
    this.$elem.addClass('w-e-active');
  };
  /**
   * 取消激活，不再高亮显示
   */


  Menu.prototype.unActive = function () {
    this._active = false;
    this.$elem.removeClass('w-e-active');
  };

  (0, _defineProperty["default"])(Menu.prototype, "isActive", {
    /**
     * 是否处于激活状态
     */
    get: function get() {
      return this._active;
    },
    enumerable: false,
    configurable: true
  });
  return Menu;
}();

exports["default"] = Menu;

/***/ }),
/* 96 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 检查选区是否在链接中，即菜单是否应该 active
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _includes = _interopRequireDefault(__webpack_require__(28));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.getParentNodeA = exports.EXTRA_TAG = void 0; // 加粗 b
// 字号/字体/颜色 font
// 斜体 i
// 删除线 strike

exports.EXTRA_TAG = ['B', 'FONT', 'I', 'STRIKE'];

function getParentNodeA(selectionELem) {
  var node = selectionELem.elems[0];

  while (node && (0, _includes["default"])(_context = exports.EXTRA_TAG).call(_context, node.nodeName)) {
    var _context;

    node = node.parentElement;

    if (node.nodeName === 'A') {
      return node;
    }
  }
}

exports.getParentNodeA = getParentNodeA;

function isActive(editor) {
  var _a;

  var $selectionELem = editor.selection.getSelectionContainerElem();

  if (!((_a = $selectionELem === null || $selectionELem === void 0 ? void 0 : $selectionELem.elems) === null || _a === void 0 ? void 0 : _a.length)) {
    return false;
  } // 选中直接是a元素


  if ($selectionELem.getNodeName() === 'A') {
    return true;
  } // 有可能a里面嵌套了其他元素，比如b、i元素等


  var parentNode = getParentNodeA($selectionELem);

  if (parentNode && parentNode.nodeName === 'A') {
    return true;
  }

  return false;
}

exports["default"] = isActive;

/***/ }),
/* 97 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 上传图片
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _bind = _interopRequireDefault(__webpack_require__(57));

var _forEach = _interopRequireDefault(__webpack_require__(4));

var _indexOf = _interopRequireDefault(__webpack_require__(27));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var util_1 = __webpack_require__(6);

var upload_core_1 = tslib_1.__importDefault(__webpack_require__(135));

var progress_1 = tslib_1.__importDefault(__webpack_require__(136));

var UploadImg =
/** @class */
function () {
  function UploadImg(editor) {
    this.editor = editor;
  }
  /**
   * 往编辑区域插入图片
   * @param src 图片地址
   */


  UploadImg.prototype.insertImg = function (src, alt, href) {
    var editor = this.editor;
    var config = editor.config;
    var i18nPrefix = 'validate.';

    var t = function t(text, prefix) {
      if (prefix === void 0) {
        prefix = i18nPrefix;
      }

      return editor.i18next.t(prefix + text);
    };
    /**
     * fix: insertImg xss
     */
    // 过滤src, 防止xss


    var resultSrc = src.replace(/</g, '&lt;').replace(/>/g, '&gt;'); // 因为下面要单引号拼接字符串, 所以要将单引号替换成双引号

    resultSrc = resultSrc.replace("'", '"');
    var hrefText = ''; // 设置图片的元数据 data-

    if (href) {
      hrefText = href.replace("'", '"');
      hrefText = "data-href='" + encodeURIComponent(hrefText) + "' ";
    }

    var altText = ''; // 设置图片alt, 过滤xss标签攻击

    if (alt) {
      altText = alt.replace(/</g, '&lt;').replace(/>/g, '&gt;'); // 因为下面要单引号拼接字符串, 所以要将单引号替换成双引号

      altText = altText.replace("'", '"');
      altText = "alt='" + altText + "' ";
    } // 先插入图片，无论是否能成功


    editor.cmd["do"]('insertHTML', "<img src='" + resultSrc + "' " + altText + hrefText + "style=\"max-width:100%;\" contenteditable=\"false\"/>"); // 执行回调函数

    config.linkImgCallback(src, alt, href); // 加载图片

    var img = document.createElement('img');

    img.onload = function () {
      img = null;
    };

    img.onerror = function () {
      config.customAlert(t('插入图片错误'), 'error', "wangEditor: " + t('插入图片错误') + "\uFF0C" + t('图片链接') + " \"" + src + "\"\uFF0C" + t('下载链接失败'));
      img = null;
    };

    img.onabort = function () {
      return img = null;
    };

    img.src = src;
  };
  /**
   * 上传图片
   * @param files 文件列表
   */


  UploadImg.prototype.uploadImg = function (files) {
    var _this_1 = this;

    if (!files.length) {
      return;
    }

    var editor = this.editor;
    var config = editor.config; // ------------------------------ i18next ------------------------------

    var i18nPrefix = 'validate.';

    var t = function t(text) {
      return editor.i18next.t(i18nPrefix + text);
    }; // ------------------------------ 获取配置信息 ------------------------------
    // 服务端地址


    var uploadImgServer = config.uploadImgServer; // base64 格式

    var uploadImgShowBase64 = config.uploadImgShowBase64; // 图片最大体积

    var maxSize = config.uploadImgMaxSize;
    var maxSizeM = maxSize / 1024 / 1024; // 一次最多上传图片数量

    var maxLength = config.uploadImgMaxLength; // 自定义 fileName

    var uploadFileName = config.uploadFileName; // 自定义参数

    var uploadImgParams = config.uploadImgParams; // 参数拼接到 url 中

    var uploadImgParamsWithUrl = config.uploadImgParamsWithUrl; // 自定义 header

    var uploadImgHeaders = config.uploadImgHeaders; // 钩子函数

    var hooks = config.uploadImgHooks; // 上传图片超时时间

    var timeout = config.uploadImgTimeout; // 跨域带 cookie

    var withCredentials = config.withCredentials; // 自定义上传图片

    var customUploadImg = config.customUploadImg;

    if (!customUploadImg) {
      // 没有 customUploadImg 的情况下，需要如下两个配置才能继续进行图片上传
      if (!uploadImgServer && !uploadImgShowBase64) {
        return;
      }
    } // ------------------------------ 验证文件信息 ------------------------------


    var resultFiles = [];
    var errInfos = [];
    util_1.arrForEach(files, function (file) {
      // chrome 低版本 粘贴一张图时files为 [null, File]
      if (!file) return;
      var name = file.name || file.type.replace('/', '.'); // 兼容低版本chrome 没有name

      var size = file.size; // chrome 低版本 name === undefined

      if (!name || !size) {
        return;
      } // 将uploadImgAccept数组转换为正则对象


      var imgType = editor.config.uploadImgAccept.join('|');
      var imgTypeRuleStr = ".(" + imgType + ")$";
      var uploadImgAcceptRule = new RegExp(imgTypeRuleStr, 'i');

      if (uploadImgAcceptRule.test(name) === false) {
        // 后缀名不合法，不是图片
        errInfos.push("\u3010" + name + "\u3011" + t('不是图片'));
        return;
      }

      if (maxSize < size) {
        // 上传图片过大
        errInfos.push("\u3010" + name + "\u3011" + t('大于') + " " + maxSizeM + "M");
        return;
      } // 验证通过的加入结果列表


      resultFiles.push(file);
    }); // 抛出验证信息

    if (errInfos.length) {
      config.customAlert(t('图片验证未通过') + ": \n" + errInfos.join('\n'), 'warning');
      return;
    } // 如果过滤后文件列表为空直接返回


    if (resultFiles.length === 0) {
      config.customAlert(t('传入的文件不合法'), 'warning');
      return;
    }

    if (resultFiles.length > maxLength) {
      config.customAlert(t('一次最多上传') + maxLength + t('张图片'), 'warning');
      return;
    } // ------------------------------ 自定义上传 ------------------------------


    if (customUploadImg && typeof customUploadImg === 'function') {
      var _context;

      customUploadImg(resultFiles, (0, _bind["default"])(_context = this.insertImg).call(_context, this)); // 阻止以下代码执行，重要！！！

      return;
    } // ------------------------------ 上传图片 ------------------------------
    // 添加图片数据


    var formData = new FormData();
    (0, _forEach["default"])(resultFiles).call(resultFiles, function (file, index) {
      var name = uploadFileName || file.name;

      if (resultFiles.length > 1) {
        // 多个文件时，filename 不能重复
        name = name + (index + 1);
      }

      formData.append(name, file);
    });

    if (uploadImgServer) {
      // 添加自定义参数
      var uploadImgServerArr = uploadImgServer.split('#');
      uploadImgServer = uploadImgServerArr[0];
      var uploadImgServerHash = uploadImgServerArr[1] || '';
      (0, _forEach["default"])(util_1).call(util_1, uploadImgParams, function (key, val) {
        // 因使用者反应，自定义参数不能默认 encode ，由 v3.1.1 版本开始注释掉
        // val = encodeURIComponent(val)
        // 第一，将参数拼接到 url 中
        if (uploadImgParamsWithUrl) {
          if ((0, _indexOf["default"])(uploadImgServer).call(uploadImgServer, '?') > 0) {
            uploadImgServer += '&';
          } else {
            uploadImgServer += '?';
          }

          uploadImgServer = uploadImgServer + key + '=' + val;
        } // 第二，将参数添加到 formData 中


        formData.append(key, val);
      });

      if (uploadImgServerHash) {
        uploadImgServer += '#' + uploadImgServerHash;
      } // 开始上传


      var xhr = upload_core_1["default"](uploadImgServer, {
        timeout: timeout,
        formData: formData,
        headers: uploadImgHeaders,
        withCredentials: !!withCredentials,
        beforeSend: function beforeSend(xhr) {
          if (hooks.before) return hooks.before(xhr, editor, resultFiles);
        },
        onTimeout: function onTimeout(xhr) {
          config.customAlert(t('上传图片超时'), 'error');
          if (hooks.timeout) hooks.timeout(xhr, editor);
        },
        onProgress: function onProgress(percent, e) {
          var progressBar = new progress_1["default"](editor);

          if (e.lengthComputable) {
            percent = e.loaded / e.total;
            progressBar.show(percent);
          }
        },
        onError: function onError(xhr) {
          config.customAlert(t('上传图片错误'), 'error', t('上传图片错误') + "\uFF0C" + t('服务器返回状态') + ": " + xhr.status);
          if (hooks.error) hooks.error(xhr, editor);
        },
        onFail: function onFail(xhr, resultStr) {
          config.customAlert(t('上传图片失败'), 'error', t('上传图片返回结果错误') + ("\uFF0C" + t('返回结果') + ": ") + resultStr);
          if (hooks.fail) hooks.fail(xhr, editor, resultStr);
        },
        onSuccess: function onSuccess(xhr, result) {
          if (hooks.customInsert) {
            var _context2;

            // 自定义插入图片
            hooks.customInsert((0, _bind["default"])(_context2 = _this_1.insertImg).call(_context2, _this_1), result, editor);
            return;
          }

          if (result.errno != '0') {
            // 返回格式不对，应该为 { errno: 0, data: [...] }
            config.customAlert(t('上传图片失败'), 'error', t('上传图片返回结果错误') + "\uFF0C" + t('返回结果') + " errno=" + result.errno);
            if (hooks.fail) hooks.fail(xhr, editor, result);
            return;
          } // 成功，插入图片


          var data = result.data;
          (0, _forEach["default"])(data).call(data, function (link) {
            if (typeof link === 'string') {
              _this_1.insertImg(link);
            } else {
              _this_1.insertImg(link.url, link.alt, link.href);
            }
          }); // 钩子函数

          if (hooks.success) hooks.success(xhr, editor, result);
        }
      });

      if (typeof xhr === 'string') {
        // 上传被阻止
        config.customAlert(xhr, 'error');
      } // 阻止以下代码执行，重要！！！


      return;
    } // ------------------------------ 显示 base64 格式 ------------------------------


    if (uploadImgShowBase64) {
      util_1.arrForEach(files, function (file) {
        var _this = _this_1;
        var reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = function () {
          if (!this.result) return;
          var imgLink = this.result.toString();

          _this.insertImg(imgLink, imgLink);
        };
      });
    }
  };

  return UploadImg;
}();

exports["default"] = UploadImg;

/***/ }),
/* 98 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _every = _interopRequireDefault(__webpack_require__(410));

var _forEach = _interopRequireDefault(__webpack_require__(4));

var _slice = _interopRequireDefault(__webpack_require__(45));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.dealTextNode = exports.isAllTodo = exports.isTodo = exports.getCursorNextNode = void 0;
/**
 * 判断传入的单行顶级选区选取是不是todo
 * @param editor 编辑器对象
 */

function isTodo($topSelectElem) {
  if ($topSelectElem.length) {
    return $topSelectElem.attr('class') === 'w-e-todo';
  }

  return false;
}

exports.isTodo = isTodo;
/**
 * 判断选中的内容是不是都是todo
 * @param editor 编辑器对象
 */

function isAllTodo(editor) {
  var $topSelectElems = editor.selection.getSelectionRangeTopNodes(); // 排除为[]的情况

  if ($topSelectElems.length === 0) return;
  return (0, _every["default"])($topSelectElems).call($topSelectElems, function ($topSelectElem) {
    return isTodo($topSelectElem);
  });
}

exports.isAllTodo = isAllTodo;
/**
 * 根据所在的文本节点和光标在文本节点的位置获取截断的后节点内容
 * @param node 顶级节点
 * @param textNode 光标所在的文本节点
 * @param pos 光标在文本节点的位置
 */

function getCursorNextNode(node, textNode, pos) {
  var _context;

  if (!node.hasChildNodes()) return;
  var newNode = node.cloneNode(); // 判断光标是否在末尾

  var end = false;

  if (textNode.nodeValue === '') {
    end = true;
  }

  var delArr = [];
  (0, _forEach["default"])(_context = node.childNodes).call(_context, function (v) {
    //光标后的内容
    if (!isContains(v, textNode) && end) {
      newNode.appendChild(v.cloneNode(true));

      if (v.nodeName !== 'BR') {
        delArr.push(v);
      }
    } // 光标所在的区域


    if (isContains(v, textNode)) {
      if (v.nodeType === 1) {
        var childNode = getCursorNextNode(v, textNode, pos);
        if (childNode && childNode.textContent !== '') newNode === null || newNode === void 0 ? void 0 : newNode.appendChild(childNode);
      }

      if (v.nodeType === 3) {
        if (textNode.isEqualNode(v)) {
          var textContent = dealTextNode(v, pos);
          newNode.textContent = textContent;
        }
      }

      end = true;
    }
  }); // 删除选中后原来的节点

  (0, _forEach["default"])(delArr).call(delArr, function (v) {
    var node = v;
    node.remove();
  });
  return newNode;
}

exports.getCursorNextNode = getCursorNextNode;
/**
 * 判断otherNode是否包含在node中
 * @param node 父节点
 * @param otherNode 需要判断是不是被包含的节点
 */

function isContains(node, otherNode) {
  // 兼容ie11中textNode不支持contains方法
  if (node.nodeType === 3) {
    return node.nodeValue === otherNode.nodeValue;
  }

  return node.contains(otherNode);
}
/**
 * 获取新的文本节点
 * @param node 要处理的文本节点
 * @param pos  光标在文本节点所在的位置
 * @param start 设置为true时保留开始位置到光标的内容，设置为false时删去开始的内容
 */


function dealTextNode(node, pos, start) {
  if (start === void 0) {
    start = true;
  }

  var content = node.nodeValue;
  var oldContent = content === null || content === void 0 ? void 0 : (0, _slice["default"])(content).call(content, 0, pos);
  content = content === null || content === void 0 ? void 0 : (0, _slice["default"])(content).call(content, pos); // start为false时替换content和oldContent

  if (!start) {
    var temp = content;
    content = oldContent;
    oldContent = temp;
  }

  node.nodeValue = oldContent;
  return content;
}

exports.dealTextNode = dealTextNode;

/***/ }),
/* 99 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 双栈实现撤销恢复
 * @author fangzhicong
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var stack_1 = __webpack_require__(430);

var Cache =
/** @class */
function () {
  function Cache(maxSize) {
    this.maxSize = maxSize;
    /**
     * 上一步操作是否为 撤销/恢复
     */

    this.isRe = false;
    this.data = new stack_1.CeilStack(maxSize);
    this.revokeData = new stack_1.CeilStack(maxSize);
  }

  (0, _defineProperty["default"])(Cache.prototype, "size", {
    /**
     * 返回当前栈中的数据长度。格式为：[正常的数据的条数，被撤销的数据的条数]
     */
    get: function get() {
      return [this.data.size, this.revokeData.size];
    },
    enumerable: false,
    configurable: true
  });
  /**
   * 重设数据缓存器的缓存长度（第一次有效）
   */

  Cache.prototype.resetMaxSize = function (maxSize) {
    this.data.resetMax(maxSize);
    this.revokeData.resetMax(maxSize);
  };
  /**
   * 保存数据
   */


  Cache.prototype.save = function (data) {
    if (this.isRe) {
      this.revokeData.clear();
      this.isRe = false;
    }

    this.data.instack(data);
    return this;
  };
  /**
   * 撤销
   * @param fn 撤销时，如果有数据，执行的回调函数
   */


  Cache.prototype.revoke = function (fn) {
    !this.isRe && (this.isRe = true);
    var data = this.data.outstack();

    if (data) {
      this.revokeData.instack(data);
      fn(data);
      return true;
    }

    return false;
  };
  /**
   * 恢复
   * @param fn 恢复时，如果有数据，执行的回调函数
   */


  Cache.prototype.restore = function (fn) {
    !this.isRe && (this.isRe = true);
    var data = this.revokeData.outstack();

    if (data) {
      this.data.instack(data);
      fn(data);
      return true;
    }

    return false;
  };

  return Cache;
}();

exports["default"] = Cache;

/***/ }),
/* 100 */
/***/ (function(module, exports, __webpack_require__) {

var DESCRIPTORS = __webpack_require__(14);
var fails = __webpack_require__(11);
var createElement = __webpack_require__(73);

// Thank's IE8 for his funny defineProperty
module.exports = !DESCRIPTORS && !fails(function () {
  return Object.defineProperty(createElement('div'), 'a', {
    get: function () { return 7; }
  }).a != 7;
});


/***/ }),
/* 101 */
/***/ (function(module, exports, __webpack_require__) {

var fails = __webpack_require__(11);

var replacement = /#|\.prototype\./;

var isForced = function (feature, detection) {
  var value = data[normalize(feature)];
  return value == POLYFILL ? true
    : value == NATIVE ? false
    : typeof detection == 'function' ? fails(detection)
    : !!detection;
};

var normalize = isForced.normalize = function (string) {
  return String(string).replace(replacement, '.').toLowerCase();
};

var data = isForced.data = {};
var NATIVE = isForced.NATIVE = 'N';
var POLYFILL = isForced.POLYFILL = 'P';

module.exports = isForced;


/***/ }),
/* 102 */
/***/ (function(module, exports, __webpack_require__) {

var store = __webpack_require__(103);

var functionToString = Function.toString;

// this helper broken in `3.4.1-3.4.4`, so we can't use `shared` helper
if (typeof store.inspectSource != 'function') {
  store.inspectSource = function (it) {
    return functionToString.call(it);
  };
}

module.exports = store.inspectSource;


/***/ }),
/* 103 */
/***/ (function(module, exports, __webpack_require__) {

var global = __webpack_require__(8);
var setGlobal = __webpack_require__(166);

var SHARED = '__core-js_shared__';
var store = global[SHARED] || setGlobal(SHARED, {});

module.exports = store;


/***/ }),
/* 104 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var getPrototypeOf = __webpack_require__(105);
var createNonEnumerableProperty = __webpack_require__(19);
var has = __webpack_require__(16);
var wellKnownSymbol = __webpack_require__(10);
var IS_PURE = __webpack_require__(43);

var ITERATOR = wellKnownSymbol('iterator');
var BUGGY_SAFARI_ITERATORS = false;

var returnThis = function () { return this; };

// `%IteratorPrototype%` object
// https://tc39.github.io/ecma262/#sec-%iteratorprototype%-object
var IteratorPrototype, PrototypeOfArrayIteratorPrototype, arrayIterator;

if ([].keys) {
  arrayIterator = [].keys();
  // Safari 8 has buggy iterators w/o `next`
  if (!('next' in arrayIterator)) BUGGY_SAFARI_ITERATORS = true;
  else {
    PrototypeOfArrayIteratorPrototype = getPrototypeOf(getPrototypeOf(arrayIterator));
    if (PrototypeOfArrayIteratorPrototype !== Object.prototype) IteratorPrototype = PrototypeOfArrayIteratorPrototype;
  }
}

if (IteratorPrototype == undefined) IteratorPrototype = {};

// 25.1.2.1.1 %IteratorPrototype%[@@iterator]()
if (!IS_PURE && !has(IteratorPrototype, ITERATOR)) {
  createNonEnumerableProperty(IteratorPrototype, ITERATOR, returnThis);
}

module.exports = {
  IteratorPrototype: IteratorPrototype,
  BUGGY_SAFARI_ITERATORS: BUGGY_SAFARI_ITERATORS
};


/***/ }),
/* 105 */
/***/ (function(module, exports, __webpack_require__) {

var has = __webpack_require__(16);
var toObject = __webpack_require__(31);
var sharedKey = __webpack_require__(63);
var CORRECT_PROTOTYPE_GETTER = __webpack_require__(168);

var IE_PROTO = sharedKey('IE_PROTO');
var ObjectPrototype = Object.prototype;

// `Object.getPrototypeOf` method
// https://tc39.github.io/ecma262/#sec-object.getprototypeof
module.exports = CORRECT_PROTOTYPE_GETTER ? Object.getPrototypeOf : function (O) {
  O = toObject(O);
  if (has(O, IE_PROTO)) return O[IE_PROTO];
  if (typeof O.constructor == 'function' && O instanceof O.constructor) {
    return O.constructor.prototype;
  } return O instanceof Object ? ObjectPrototype : null;
};


/***/ }),
/* 106 */
/***/ (function(module, exports, __webpack_require__) {

var NATIVE_SYMBOL = __webpack_require__(76);

module.exports = NATIVE_SYMBOL
  // eslint-disable-next-line no-undef
  && !Symbol.sham
  // eslint-disable-next-line no-undef
  && typeof Symbol.iterator == 'symbol';


/***/ }),
/* 107 */
/***/ (function(module, exports, __webpack_require__) {

var has = __webpack_require__(16);
var toIndexedObject = __webpack_require__(30);
var indexOf = __webpack_require__(78).indexOf;
var hiddenKeys = __webpack_require__(51);

module.exports = function (object, names) {
  var O = toIndexedObject(object);
  var i = 0;
  var result = [];
  var key;
  for (key in O) !has(hiddenKeys, key) && has(O, key) && result.push(key);
  // Don't enum bug & hidden keys
  while (names.length > i) if (has(O, key = names[i++])) {
    ~indexOf(result, key) || result.push(key);
  }
  return result;
};


/***/ }),
/* 108 */
/***/ (function(module, exports, __webpack_require__) {

var getBuiltIn = __webpack_require__(36);

module.exports = getBuiltIn('document', 'documentElement');


/***/ }),
/* 109 */
/***/ (function(module, exports, __webpack_require__) {

var global = __webpack_require__(8);

module.exports = global.Promise;


/***/ }),
/* 110 */
/***/ (function(module, exports, __webpack_require__) {

var redefine = __webpack_require__(53);

module.exports = function (target, src, options) {
  for (var key in src) {
    if (options && options.unsafe && target[key]) target[key] = src[key];
    else redefine(target, key, src[key], options);
  } return target;
};


/***/ }),
/* 111 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var getBuiltIn = __webpack_require__(36);
var definePropertyModule = __webpack_require__(18);
var wellKnownSymbol = __webpack_require__(10);
var DESCRIPTORS = __webpack_require__(14);

var SPECIES = wellKnownSymbol('species');

module.exports = function (CONSTRUCTOR_NAME) {
  var Constructor = getBuiltIn(CONSTRUCTOR_NAME);
  var defineProperty = definePropertyModule.f;

  if (DESCRIPTORS && Constructor && !Constructor[SPECIES]) {
    defineProperty(Constructor, SPECIES, {
      configurable: true,
      get: function () { return this; }
    });
  }
};


/***/ }),
/* 112 */
/***/ (function(module, exports, __webpack_require__) {

var wellKnownSymbol = __webpack_require__(10);
var Iterators = __webpack_require__(44);

var ITERATOR = wellKnownSymbol('iterator');
var ArrayPrototype = Array.prototype;

// check on default Array iterator
module.exports = function (it) {
  return it !== undefined && (Iterators.Array === it || ArrayPrototype[ITERATOR] === it);
};


/***/ }),
/* 113 */
/***/ (function(module, exports, __webpack_require__) {

var classof = __webpack_require__(65);
var Iterators = __webpack_require__(44);
var wellKnownSymbol = __webpack_require__(10);

var ITERATOR = wellKnownSymbol('iterator');

module.exports = function (it) {
  if (it != undefined) return it[ITERATOR]
    || it['@@iterator']
    || Iterators[classof(it)];
};


/***/ }),
/* 114 */
/***/ (function(module, exports, __webpack_require__) {

var anObject = __webpack_require__(25);

// call something on iterator step with safe closing on error
module.exports = function (iterator, fn, value, ENTRIES) {
  try {
    return ENTRIES ? fn(anObject(value)[0], value[1]) : fn(value);
  // 7.4.6 IteratorClose(iterator, completion)
  } catch (error) {
    var returnMethod = iterator['return'];
    if (returnMethod !== undefined) anObject(returnMethod.call(iterator));
    throw error;
  }
};


/***/ }),
/* 115 */
/***/ (function(module, exports, __webpack_require__) {

var wellKnownSymbol = __webpack_require__(10);

var ITERATOR = wellKnownSymbol('iterator');
var SAFE_CLOSING = false;

try {
  var called = 0;
  var iteratorWithReturn = {
    next: function () {
      return { done: !!called++ };
    },
    'return': function () {
      SAFE_CLOSING = true;
    }
  };
  iteratorWithReturn[ITERATOR] = function () {
    return this;
  };
  // eslint-disable-next-line no-throw-literal
  Array.from(iteratorWithReturn, function () { throw 2; });
} catch (error) { /* empty */ }

module.exports = function (exec, SKIP_CLOSING) {
  if (!SKIP_CLOSING && !SAFE_CLOSING) return false;
  var ITERATION_SUPPORT = false;
  try {
    var object = {};
    object[ITERATOR] = function () {
      return {
        next: function () {
          return { done: ITERATION_SUPPORT = true };
        }
      };
    };
    exec(object);
  } catch (error) { /* empty */ }
  return ITERATION_SUPPORT;
};


/***/ }),
/* 116 */
/***/ (function(module, exports, __webpack_require__) {

var anObject = __webpack_require__(25);
var aFunction = __webpack_require__(41);
var wellKnownSymbol = __webpack_require__(10);

var SPECIES = wellKnownSymbol('species');

// `SpeciesConstructor` abstract operation
// https://tc39.github.io/ecma262/#sec-speciesconstructor
module.exports = function (O, defaultConstructor) {
  var C = anObject(O).constructor;
  var S;
  return C === undefined || (S = anObject(C)[SPECIES]) == undefined ? defaultConstructor : aFunction(S);
};


/***/ }),
/* 117 */
/***/ (function(module, exports, __webpack_require__) {

var global = __webpack_require__(8);
var fails = __webpack_require__(11);
var classof = __webpack_require__(34);
var bind = __webpack_require__(40);
var html = __webpack_require__(108);
var createElement = __webpack_require__(73);
var IS_IOS = __webpack_require__(118);

var location = global.location;
var set = global.setImmediate;
var clear = global.clearImmediate;
var process = global.process;
var MessageChannel = global.MessageChannel;
var Dispatch = global.Dispatch;
var counter = 0;
var queue = {};
var ONREADYSTATECHANGE = 'onreadystatechange';
var defer, channel, port;

var run = function (id) {
  // eslint-disable-next-line no-prototype-builtins
  if (queue.hasOwnProperty(id)) {
    var fn = queue[id];
    delete queue[id];
    fn();
  }
};

var runner = function (id) {
  return function () {
    run(id);
  };
};

var listener = function (event) {
  run(event.data);
};

var post = function (id) {
  // old engines have not location.origin
  global.postMessage(id + '', location.protocol + '//' + location.host);
};

// Node.js 0.9+ & IE10+ has setImmediate, otherwise:
if (!set || !clear) {
  set = function setImmediate(fn) {
    var args = [];
    var i = 1;
    while (arguments.length > i) args.push(arguments[i++]);
    queue[++counter] = function () {
      // eslint-disable-next-line no-new-func
      (typeof fn == 'function' ? fn : Function(fn)).apply(undefined, args);
    };
    defer(counter);
    return counter;
  };
  clear = function clearImmediate(id) {
    delete queue[id];
  };
  // Node.js 0.8-
  if (classof(process) == 'process') {
    defer = function (id) {
      process.nextTick(runner(id));
    };
  // Sphere (JS game engine) Dispatch API
  } else if (Dispatch && Dispatch.now) {
    defer = function (id) {
      Dispatch.now(runner(id));
    };
  // Browsers with MessageChannel, includes WebWorkers
  // except iOS - https://github.com/zloirock/core-js/issues/624
  } else if (MessageChannel && !IS_IOS) {
    channel = new MessageChannel();
    port = channel.port2;
    channel.port1.onmessage = listener;
    defer = bind(port.postMessage, port, 1);
  // Browsers with postMessage, skip WebWorkers
  // IE8 has postMessage, but it's sync & typeof its postMessage is 'object'
  } else if (
    global.addEventListener &&
    typeof postMessage == 'function' &&
    !global.importScripts &&
    !fails(post) &&
    location.protocol !== 'file:'
  ) {
    defer = post;
    global.addEventListener('message', listener, false);
  // IE8-
  } else if (ONREADYSTATECHANGE in createElement('script')) {
    defer = function (id) {
      html.appendChild(createElement('script'))[ONREADYSTATECHANGE] = function () {
        html.removeChild(this);
        run(id);
      };
    };
  // Rest old browsers
  } else {
    defer = function (id) {
      setTimeout(runner(id), 0);
    };
  }
}

module.exports = {
  set: set,
  clear: clear
};


/***/ }),
/* 118 */
/***/ (function(module, exports, __webpack_require__) {

var userAgent = __webpack_require__(84);

module.exports = /(iphone|ipod|ipad).*applewebkit/i.test(userAgent);


/***/ }),
/* 119 */
/***/ (function(module, exports, __webpack_require__) {

var anObject = __webpack_require__(25);
var isObject = __webpack_require__(13);
var newPromiseCapability = __webpack_require__(85);

module.exports = function (C, x) {
  anObject(C);
  if (isObject(x) && x.constructor === C) return x;
  var promiseCapability = newPromiseCapability.f(C);
  var resolve = promiseCapability.resolve;
  resolve(x);
  return promiseCapability.promise;
};


/***/ }),
/* 120 */
/***/ (function(module, exports) {

module.exports = function (exec) {
  try {
    return { error: false, value: exec() };
  } catch (error) {
    return { error: true, value: error };
  }
};


/***/ }),
/* 121 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(197);

/***/ }),
/* 122 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var $ = __webpack_require__(5);
var global = __webpack_require__(8);
var InternalMetadataModule = __webpack_require__(123);
var fails = __webpack_require__(11);
var createNonEnumerableProperty = __webpack_require__(19);
var iterate = __webpack_require__(66);
var anInstance = __webpack_require__(83);
var isObject = __webpack_require__(13);
var setToStringTag = __webpack_require__(37);
var defineProperty = __webpack_require__(18).f;
var forEach = __webpack_require__(32).forEach;
var DESCRIPTORS = __webpack_require__(14);
var InternalStateModule = __webpack_require__(42);

var setInternalState = InternalStateModule.set;
var internalStateGetterFor = InternalStateModule.getterFor;

module.exports = function (CONSTRUCTOR_NAME, wrapper, common) {
  var IS_MAP = CONSTRUCTOR_NAME.indexOf('Map') !== -1;
  var IS_WEAK = CONSTRUCTOR_NAME.indexOf('Weak') !== -1;
  var ADDER = IS_MAP ? 'set' : 'add';
  var NativeConstructor = global[CONSTRUCTOR_NAME];
  var NativePrototype = NativeConstructor && NativeConstructor.prototype;
  var exported = {};
  var Constructor;

  if (!DESCRIPTORS || typeof NativeConstructor != 'function'
    || !(IS_WEAK || NativePrototype.forEach && !fails(function () { new NativeConstructor().entries().next(); }))
  ) {
    // create collection constructor
    Constructor = common.getConstructor(wrapper, CONSTRUCTOR_NAME, IS_MAP, ADDER);
    InternalMetadataModule.REQUIRED = true;
  } else {
    Constructor = wrapper(function (target, iterable) {
      setInternalState(anInstance(target, Constructor, CONSTRUCTOR_NAME), {
        type: CONSTRUCTOR_NAME,
        collection: new NativeConstructor()
      });
      if (iterable != undefined) iterate(iterable, target[ADDER], target, IS_MAP);
    });

    var getInternalState = internalStateGetterFor(CONSTRUCTOR_NAME);

    forEach(['add', 'clear', 'delete', 'forEach', 'get', 'has', 'set', 'keys', 'values', 'entries'], function (KEY) {
      var IS_ADDER = KEY == 'add' || KEY == 'set';
      if (KEY in NativePrototype && !(IS_WEAK && KEY == 'clear')) {
        createNonEnumerableProperty(Constructor.prototype, KEY, function (a, b) {
          var collection = getInternalState(this).collection;
          if (!IS_ADDER && IS_WEAK && !isObject(a)) return KEY == 'get' ? undefined : false;
          var result = collection[KEY](a === 0 ? 0 : a, b);
          return IS_ADDER ? this : result;
        });
      }
    });

    IS_WEAK || defineProperty(Constructor.prototype, 'size', {
      configurable: true,
      get: function () {
        return getInternalState(this).collection.size;
      }
    });
  }

  setToStringTag(Constructor, CONSTRUCTOR_NAME, false, true);

  exported[CONSTRUCTOR_NAME] = Constructor;
  $({ global: true, forced: true }, exported);

  if (!IS_WEAK) common.setStrong(Constructor, CONSTRUCTOR_NAME, IS_MAP);

  return Constructor;
};


/***/ }),
/* 123 */
/***/ (function(module, exports, __webpack_require__) {

var hiddenKeys = __webpack_require__(51);
var isObject = __webpack_require__(13);
var has = __webpack_require__(16);
var defineProperty = __webpack_require__(18).f;
var uid = __webpack_require__(64);
var FREEZING = __webpack_require__(200);

var METADATA = uid('meta');
var id = 0;

var isExtensible = Object.isExtensible || function () {
  return true;
};

var setMetadata = function (it) {
  defineProperty(it, METADATA, { value: {
    objectID: 'O' + ++id, // object ID
    weakData: {}          // weak collections IDs
  } });
};

var fastKey = function (it, create) {
  // return a primitive with prefix
  if (!isObject(it)) return typeof it == 'symbol' ? it : (typeof it == 'string' ? 'S' : 'P') + it;
  if (!has(it, METADATA)) {
    // can't set metadata to uncaught frozen object
    if (!isExtensible(it)) return 'F';
    // not necessary to add metadata
    if (!create) return 'E';
    // add missing metadata
    setMetadata(it);
  // return object ID
  } return it[METADATA].objectID;
};

var getWeakData = function (it, create) {
  if (!has(it, METADATA)) {
    // can't set metadata to uncaught frozen object
    if (!isExtensible(it)) return true;
    // not necessary to add metadata
    if (!create) return false;
    // add missing metadata
    setMetadata(it);
  // return the store of weak collections IDs
  } return it[METADATA].weakData;
};

// add metadata on freeze-family methods calling
var onFreeze = function (it) {
  if (FREEZING && meta.REQUIRED && isExtensible(it) && !has(it, METADATA)) setMetadata(it);
  return it;
};

var meta = module.exports = {
  REQUIRED: false,
  fastKey: fastKey,
  getWeakData: getWeakData,
  onFreeze: onFreeze
};

hiddenKeys[METADATA] = true;


/***/ }),
/* 124 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var defineProperty = __webpack_require__(18).f;
var create = __webpack_require__(77);
var redefineAll = __webpack_require__(110);
var bind = __webpack_require__(40);
var anInstance = __webpack_require__(83);
var iterate = __webpack_require__(66);
var defineIterator = __webpack_require__(75);
var setSpecies = __webpack_require__(111);
var DESCRIPTORS = __webpack_require__(14);
var fastKey = __webpack_require__(123).fastKey;
var InternalStateModule = __webpack_require__(42);

var setInternalState = InternalStateModule.set;
var internalStateGetterFor = InternalStateModule.getterFor;

module.exports = {
  getConstructor: function (wrapper, CONSTRUCTOR_NAME, IS_MAP, ADDER) {
    var C = wrapper(function (that, iterable) {
      anInstance(that, C, CONSTRUCTOR_NAME);
      setInternalState(that, {
        type: CONSTRUCTOR_NAME,
        index: create(null),
        first: undefined,
        last: undefined,
        size: 0
      });
      if (!DESCRIPTORS) that.size = 0;
      if (iterable != undefined) iterate(iterable, that[ADDER], that, IS_MAP);
    });

    var getInternalState = internalStateGetterFor(CONSTRUCTOR_NAME);

    var define = function (that, key, value) {
      var state = getInternalState(that);
      var entry = getEntry(that, key);
      var previous, index;
      // change existing entry
      if (entry) {
        entry.value = value;
      // create new entry
      } else {
        state.last = entry = {
          index: index = fastKey(key, true),
          key: key,
          value: value,
          previous: previous = state.last,
          next: undefined,
          removed: false
        };
        if (!state.first) state.first = entry;
        if (previous) previous.next = entry;
        if (DESCRIPTORS) state.size++;
        else that.size++;
        // add to index
        if (index !== 'F') state.index[index] = entry;
      } return that;
    };

    var getEntry = function (that, key) {
      var state = getInternalState(that);
      // fast case
      var index = fastKey(key);
      var entry;
      if (index !== 'F') return state.index[index];
      // frozen object case
      for (entry = state.first; entry; entry = entry.next) {
        if (entry.key == key) return entry;
      }
    };

    redefineAll(C.prototype, {
      // 23.1.3.1 Map.prototype.clear()
      // 23.2.3.2 Set.prototype.clear()
      clear: function clear() {
        var that = this;
        var state = getInternalState(that);
        var data = state.index;
        var entry = state.first;
        while (entry) {
          entry.removed = true;
          if (entry.previous) entry.previous = entry.previous.next = undefined;
          delete data[entry.index];
          entry = entry.next;
        }
        state.first = state.last = undefined;
        if (DESCRIPTORS) state.size = 0;
        else that.size = 0;
      },
      // 23.1.3.3 Map.prototype.delete(key)
      // 23.2.3.4 Set.prototype.delete(value)
      'delete': function (key) {
        var that = this;
        var state = getInternalState(that);
        var entry = getEntry(that, key);
        if (entry) {
          var next = entry.next;
          var prev = entry.previous;
          delete state.index[entry.index];
          entry.removed = true;
          if (prev) prev.next = next;
          if (next) next.previous = prev;
          if (state.first == entry) state.first = next;
          if (state.last == entry) state.last = prev;
          if (DESCRIPTORS) state.size--;
          else that.size--;
        } return !!entry;
      },
      // 23.2.3.6 Set.prototype.forEach(callbackfn, thisArg = undefined)
      // 23.1.3.5 Map.prototype.forEach(callbackfn, thisArg = undefined)
      forEach: function forEach(callbackfn /* , that = undefined */) {
        var state = getInternalState(this);
        var boundFunction = bind(callbackfn, arguments.length > 1 ? arguments[1] : undefined, 3);
        var entry;
        while (entry = entry ? entry.next : state.first) {
          boundFunction(entry.value, entry.key, this);
          // revert to the last existing entry
          while (entry && entry.removed) entry = entry.previous;
        }
      },
      // 23.1.3.7 Map.prototype.has(key)
      // 23.2.3.7 Set.prototype.has(value)
      has: function has(key) {
        return !!getEntry(this, key);
      }
    });

    redefineAll(C.prototype, IS_MAP ? {
      // 23.1.3.6 Map.prototype.get(key)
      get: function get(key) {
        var entry = getEntry(this, key);
        return entry && entry.value;
      },
      // 23.1.3.9 Map.prototype.set(key, value)
      set: function set(key, value) {
        return define(this, key === 0 ? 0 : key, value);
      }
    } : {
      // 23.2.3.1 Set.prototype.add(value)
      add: function add(value) {
        return define(this, value = value === 0 ? 0 : value, value);
      }
    });
    if (DESCRIPTORS) defineProperty(C.prototype, 'size', {
      get: function () {
        return getInternalState(this).size;
      }
    });
    return C;
  },
  setStrong: function (C, CONSTRUCTOR_NAME, IS_MAP) {
    var ITERATOR_NAME = CONSTRUCTOR_NAME + ' Iterator';
    var getInternalCollectionState = internalStateGetterFor(CONSTRUCTOR_NAME);
    var getInternalIteratorState = internalStateGetterFor(ITERATOR_NAME);
    // add .keys, .values, .entries, [@@iterator]
    // 23.1.3.4, 23.1.3.8, 23.1.3.11, 23.1.3.12, 23.2.3.5, 23.2.3.8, 23.2.3.10, 23.2.3.11
    defineIterator(C, CONSTRUCTOR_NAME, function (iterated, kind) {
      setInternalState(this, {
        type: ITERATOR_NAME,
        target: iterated,
        state: getInternalCollectionState(iterated),
        kind: kind,
        last: undefined
      });
    }, function () {
      var state = getInternalIteratorState(this);
      var kind = state.kind;
      var entry = state.last;
      // revert to the last existing entry
      while (entry && entry.removed) entry = entry.previous;
      // get next entry
      if (!state.target || !(state.last = entry = entry ? entry.next : state.state.first)) {
        // or finish the iteration
        state.target = undefined;
        return { value: undefined, done: true };
      }
      // return step by kind
      if (kind == 'keys') return { value: entry.key, done: false };
      if (kind == 'values') return { value: entry.value, done: false };
      return { value: [entry.key, entry.value], done: false };
    }, IS_MAP ? 'entries' : 'values', !IS_MAP, true);

    // add [@@species], 23.1.2.2, 23.2.2.2
    setSpecies(CONSTRUCTOR_NAME);
  }
};


/***/ }),
/* 125 */
/***/ (function(module, exports, __webpack_require__) {

var defineWellKnownSymbol = __webpack_require__(12);

// `Symbol.iterator` well-known symbol
// https://tc39.github.io/ecma262/#sec-symbol.iterator
defineWellKnownSymbol('iterator');


/***/ }),
/* 126 */
/***/ (function(module, exports, __webpack_require__) {

var internalObjectKeys = __webpack_require__(107);
var enumBugKeys = __webpack_require__(80);

var hiddenKeys = enumBugKeys.concat('length', 'prototype');

// `Object.getOwnPropertyNames` method
// https://tc39.github.io/ecma262/#sec-object.getownpropertynames
exports.f = Object.getOwnPropertyNames || function getOwnPropertyNames(O) {
  return internalObjectKeys(O, hiddenKeys);
};


/***/ }),
/* 127 */
/***/ (function(module, exports) {

exports.f = Object.getOwnPropertySymbols;


/***/ }),
/* 128 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(268);

/***/ }),
/* 129 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 样式配置
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports["default"] = {
  zIndex: 10000
};

/***/ }),
/* 130 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 默认常量配置
 * @author xiaokyo
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports["default"] = {
  focus: true,
  height: 300,
  placeholder: '请输入正文',
  zIndexFullScreen: 10002,
  showFullScreen: true
};

/***/ }),
/* 131 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 处理粘贴逻辑
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.getPasteImgs = exports.getPasteHtml = exports.getPasteText = void 0;

var tslib_1 = __webpack_require__(2);

var util_1 = __webpack_require__(6);

var parse_html_1 = tslib_1.__importDefault(__webpack_require__(292));
/**
 * 获取粘贴的纯文本
 * @param e Event 参数
 */


function getPasteText(e) {
  // const clipboardData = e.clipboardData || (e.originalEvent && e.originalEvent.clipboardData)
  var clipboardData = e.clipboardData; // 暂不考虑 originalEvent 的情况

  var pasteText = '';

  if (clipboardData == null) {
    pasteText = window.clipboardData && window.clipboardData.getData('text');
  } else {
    pasteText = clipboardData.getData('text/plain');
  }

  return util_1.replaceHtmlSymbol(pasteText);
}

exports.getPasteText = getPasteText;
/**
 * 获取粘贴的 html 字符串
 * @param e Event 参数
 * @param filterStyle 是否过滤 style 样式
 * @param ignoreImg 是否忽略 img 标签
 */

function getPasteHtml(e, filterStyle, ignoreImg) {
  if (filterStyle === void 0) {
    filterStyle = true;
  }

  if (ignoreImg === void 0) {
    ignoreImg = false;
  }

  var clipboardData = e.clipboardData; // 暂不考虑 originalEvent 的情况

  var pasteHtml = '';

  if (clipboardData) {
    pasteHtml = clipboardData.getData('text/html');
  } // 无法通过 'text/html' 格式获取 html，则尝试获取 text


  if (!pasteHtml) {
    var text = getPasteText(e);

    if (!text) {
      return ''; // 没有找到任何文字，则返回
    }

    pasteHtml = "<p>" + text + "</p>";
  } // 转译<1，后面跟数字的转译成 &lt;1


  pasteHtml = pasteHtml.replace(/<(\d)/gm, function (_, num) {
    return '&lt;' + num;
  }); // pdf复制只会有一个meta标签，parseHtml中的过滤meta标签会导致后面内容丢失

  pasteHtml = pasteHtml.replace(/<(\/?meta.*?)>/gim, ''); // 剔除多余的标签、属性

  pasteHtml = parse_html_1["default"](pasteHtml, filterStyle, ignoreImg);
  return pasteHtml;
}

exports.getPasteHtml = getPasteHtml;
/**
 * 获取粘贴的图片文件
 * @param e Event 参数
 */

function getPasteImgs(e) {
  var _a;

  var result = [];
  var txt = getPasteText(e);

  if (txt) {
    // 有文字，就忽略图片
    return result;
  }

  var items = (_a = e.clipboardData) === null || _a === void 0 ? void 0 : _a.items;
  if (!items) return result;
  (0, _forEach["default"])(util_1).call(util_1, items, function (key, value) {
    var type = value.type;

    if (/image/i.test(type)) {
      result.push(value.getAsFile());
    }
  });
  return result;
}

exports.getPasteImgs = getPasteImgs;

/***/ }),
/* 132 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(294);

/***/ }),
/* 133 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(310);

/***/ }),
/* 134 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 下拉列表 class
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

var _setTimeout2 = _interopRequireDefault(__webpack_require__(46));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var const_1 = __webpack_require__(7);

var DropList =
/** @class */
function () {
  function DropList(menu, conf) {
    var _this = this;

    this.hideTimeoutId = 0;
    this.menu = menu;
    this.conf = conf; // 容器

    var $container = dom_core_1["default"]('<div class="w-e-droplist"></div>'); // 标题

    var $title = dom_core_1["default"]("<p>" + conf.title + "</p>");
    $title.addClass('w-e-dp-title');
    $container.append($title); // 列表和类型

    var list = conf.list || [];
    var type = conf.type || 'list'; // item 的点击事件

    var clickHandler = conf.clickHandler || const_1.EMPTY_FN; // 加入 DOM 并绑定事件

    var $list = dom_core_1["default"]('<ul class="' + (type === 'list' ? 'w-e-list' : 'w-e-block') + '"></ul>');
    (0, _forEach["default"])(list).call(list, function (item) {
      var $elem = item.$elem;
      var value = item.value;
      var $li = dom_core_1["default"]('<li class="w-e-item"></li>');

      if ($elem) {
        $li.append($elem);
        $list.append($li);
        $li.on('click', function (e) {
          clickHandler(value); // 阻止冒泡

          e.stopPropagation(); // item 点击之后，隐藏 list

          _this.hideTimeoutId = (0, _setTimeout2["default"])(function () {
            _this.hide();
          });
        });
      }
    });
    $container.append($list); // 绑定隐藏事件

    $container.on('mouseleave', function () {
      _this.hideTimeoutId = (0, _setTimeout2["default"])(function () {
        _this.hide();
      });
    }); // 记录属性

    this.$container = $container;
    this.rendered = false;
    this._show = false;
  }
  /**
   * 显示 DropList
   */


  DropList.prototype.show = function () {
    if (this.hideTimeoutId) {
      // 清除之前的定时隐藏
      clearTimeout(this.hideTimeoutId);
    }

    var menu = this.menu;
    var $menuELem = menu.$elem;
    var $container = this.$container;

    if (this._show) {
      return;
    }

    if (this.rendered) {
      // 显示
      $container.show();
    } else {
      // 加入 DOM 之前先定位位置
      var menuHeight = $menuELem.getBoundingClientRect().height || 0;
      var width = this.conf.width || 100; // 默认为 100

      $container.css('margin-top', menuHeight + 'px').css('width', width + 'px'); // 加入到 DOM

      $menuELem.append($container);
      this.rendered = true;
    } // 修改属性


    this._show = true;
  };
  /**
   * 隐藏 DropList
   */


  DropList.prototype.hide = function () {
    var $container = this.$container;

    if (!this._show) {
      return;
    } // 隐藏并需改属性


    $container.hide();
    this._show = false;
  };

  (0, _defineProperty["default"])(DropList.prototype, "isShow", {
    get: function get() {
      return this._show;
    },
    enumerable: false,
    configurable: true
  });
  return DropList;
}();

exports["default"] = DropList;

/***/ }),
/* 135 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 上传的核心方法
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _typeof2 = _interopRequireDefault(__webpack_require__(92));

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var util_1 = __webpack_require__(6);
/**
 * 发送 post 请求（用于文件上传）
 * @param url url
 * @param option 配置项
 */


function post(url, option) {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', url); // 超时，默认 10s

  xhr.timeout = option.timeout || 10 * 1000;

  xhr.ontimeout = function () {
    console.error('wangEditor - 请求超时');
    option.onTimeout && option.onTimeout(xhr);
  }; // 进度


  if (xhr.upload) {
    xhr.upload.onprogress = function (e) {
      var percent = e.loaded / e.total;
      option.onProgress && option.onProgress(percent, e);
    };
  } // 自定义 header


  if (option.headers) {
    (0, _forEach["default"])(util_1).call(util_1, option.headers, function (key, val) {
      xhr.setRequestHeader(key, val);
    });
  } // 跨域传 cookie


  xhr.withCredentials = !!option.withCredentials; // 上传之前的钩子函数，在 xhr.send() 之前执行

  if (option.beforeSend) {
    var beforeResult = option.beforeSend(xhr);

    if (beforeResult && (0, _typeof2["default"])(beforeResult) === 'object') {
      if (beforeResult.prevent) {
        // 如果返回的结果是 {prevent: true, msg: 'xxxx'} 则表示用户放弃上传
        return beforeResult.msg;
      }
    }
  } // 服务端返回之后


  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;
    var status = xhr.status;
    if (status < 200) return; // 请求发送过程中，尚未返回

    if (status >= 300 && status < 400) return; // 重定向

    if (status >= 400) {
      // 40x 50x 报错
      console.error('wangEditor - XHR 报错，状态码 ' + status);
      if (option.onError) option.onError(xhr); // 有，则执行 onError 函数即可

      return;
    } // status = 200 ，得到结果


    var resultStr = xhr.responseText;
    var result;

    if ((0, _typeof2["default"])(resultStr) !== 'object') {
      try {
        result = JSON.parse(resultStr);
      } catch (ex) {
        console.error('wangEditor - 返回结果不是 JSON 格式', resultStr);
        if (option.onFail) option.onFail(xhr, resultStr);
        return;
      }
    } else {
      result = resultStr;
    }

    option.onSuccess(xhr, result);
  }; // 发送请求


  xhr.send(option.formData || null);
  return xhr;
}

exports["default"] = post;

/***/ }),
/* 136 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 上传进度条
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _now = _interopRequireDefault(__webpack_require__(342));

var _setTimeout2 = _interopRequireDefault(__webpack_require__(46));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var Progress =
/** @class */
function () {
  function Progress(editor) {
    this.editor = editor;
    this.$textContainer = editor.$textContainerElem;
    this.$bar = dom_core_1["default"]('<div class="w-e-progress"></div>');
    this.isShow = false;
    this.time = 0;
    this.timeoutId = 0;
  }
  /**
   * 显示进度条
   * @param progress 进度百分比
   */


  Progress.prototype.show = function (progress) {
    var _this = this; // 不要重新显示


    if (this.isShow) {
      return;
    }

    this.isShow = true; // 渲染 $bar

    var $bar = this.$bar;
    var $textContainer = this.$textContainer;
    $textContainer.append($bar); // 改变进度条（防抖，100ms 渲染一次）

    if ((0, _now["default"])() - this.time > 100) {
      if (progress <= 1) {
        $bar.css('width', progress * 100 + '%');
        this.time = (0, _now["default"])();
      }
    } // 500ms 之后隐藏


    var timeoutId = this.timeoutId;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    this.timeoutId = (0, _setTimeout2["default"])(function () {
      _this.hide();
    }, 500);
  };
  /**
   * 隐藏
   */


  Progress.prototype.hide = function () {
    var $bar = this.$bar;
    $bar.remove();
    this.isShow = false;
    this.time = 0;
    this.timeoutId = 0;
  };

  return Progress;
}();

exports["default"] = Progress;

/***/ }),
/* 137 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 无序列表/有序列表
 * @author tonghan
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.ListType = void 0;

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var DropListMenu_1 = tslib_1.__importDefault(__webpack_require__(24));

var utils_1 = __webpack_require__(47);

var ListHandle_1 = tslib_1.__importStar(__webpack_require__(371));
/**
 * 列表的种类
 */


var ListType;

(function (ListType) {
  ListType["OrderedList"] = "OL";
  ListType["UnorderedList"] = "UL";
})(ListType = exports.ListType || (exports.ListType = {}));

var List =
/** @class */
function (_super) {
  tslib_1.__extends(List, _super);

  function List(editor) {
    var _this = this;

    var $elem = dom_core_1["default"]("<div class=\"w-e-menu\" data-title=\"\u5E8F\u5217\">\n                <i class=\"w-e-icon-list2\"></i>\n            </div>");
    var dropListConf = {
      width: 130,
      title: '序列',
      type: 'list',
      list: [{
        $elem: dom_core_1["default"]("\n                        <p>\n                            <i class=\"w-e-icon-list2 w-e-drop-list-item\"></i>\n                            " + editor.i18next.t('menus.dropListMenu.list.无序列表') + "\n                        <p>"),
        value: ListType.UnorderedList
      }, {
        $elem: dom_core_1["default"]("<p>\n                            <i class=\"w-e-icon-list-numbered w-e-drop-list-item\"></i>\n                            " + editor.i18next.t('menus.dropListMenu.list.有序列表') + "\n                        <p>"),
        value: ListType.OrderedList
      }],
      clickHandler: function clickHandler(value) {
        // 注意 this 是指向当前的 List 对象
        _this.command(value);
      }
    };
    _this = _super.call(this, $elem, editor, dropListConf) || this;
    return _this;
  }

  List.prototype.command = function (type) {
    var editor = this.editor;
    var $selectionElem = editor.selection.getSelectionContainerElem(); // 选区范围的 DOM 元素不存在，不执行命令

    if ($selectionElem === undefined) return; // 获取选区范围内的顶级 DOM 元素

    this.handleSelectionRangeNodes(type); // 是否激活

    this.tryChangeActive();
  };

  List.prototype.validator = function ($startElem, $endElem, $textElem) {
    if (!$startElem.length || !$endElem.length || $textElem.equal($startElem) || $textElem.equal($endElem)) {
      return false;
    }

    return true;
  };

  List.prototype.handleSelectionRangeNodes = function (listType) {
    var editor = this.editor;
    var selection = editor.selection; // 获取 序列标签

    var listTarget = listType.toLowerCase(); // 获取相对应的 元属节点

    var $selectionElem = selection.getSelectionContainerElem();
    var $startElem = selection.getSelectionStartElem().getNodeTop(editor);
    var $endElem = selection.getSelectionEndElem().getNodeTop(editor); // 验证是否执行 处理逻辑

    if (!this.validator($startElem, $endElem, editor.$textElem)) {
      return;
    } // 获取选区


    var _range = selection.getRange();

    var _collapsed = _range === null || _range === void 0 ? void 0 : _range.collapsed; // 防止光标的时候判断异常


    if (!editor.$textElem.equal($selectionElem)) {
      $selectionElem = $selectionElem.getNodeTop(editor);
    }

    var options = {
      editor: editor,
      listType: listType,
      listTarget: listTarget,
      $selectionElem: $selectionElem,
      $startElem: $startElem,
      $endElem: $endElem
    };
    var classType; // =====================================
    // 当 selectionElem 属于序列元素的时候
    // 代表着当前选区一定是在一个序列元素内的
    // =====================================

    if (this.isOrderElem($selectionElem)) {
      classType = ListHandle_1.ClassType.Wrap;
    } // =====================================
    // 当 startElem 和 endElem 属于序列元素的时候
    // 代表着当前选区一定是在再两个序列的中间(包括两个序列)
    // =====================================
    else if (this.isOrderElem($startElem) && this.isOrderElem($endElem)) {
        classType = ListHandle_1.ClassType.Join;
      } // =====================================
      // 选区开始元素为 序列 的时候
      // =====================================
      else if (this.isOrderElem($startElem)) {
          classType = ListHandle_1.ClassType.StartJoin;
        } // =====================================
        // 选区结束元素为 序列 的时候
        // =====================================
        else if (this.isOrderElem($endElem)) {
            classType = ListHandle_1.ClassType.EndJoin;
          } // =====================================
          // 当选区不是序列内且开头和结尾不是序列的时候
          // 直接获取所有顶级段落然后过滤
          // 代表着 设置序列 的操作
          // =====================================
          else {
              classType = ListHandle_1.ClassType.Other;
            }

    var listHandleCmd = new ListHandle_1["default"](ListHandle_1.createListHandle(classType, options, _range)); // 更新选区

    utils_1.updateRange(editor, listHandleCmd.getSelectionRangeElem(), !!_collapsed);
  };
  /**
   * 是否是序列元素节点 UL and OL
   * @param $node
   */


  List.prototype.isOrderElem = function ($node) {
    var nodeName = $node.getNodeName();

    if (nodeName === ListType.OrderedList || nodeName === ListType.UnorderedList) {
      return true;
    }

    return false;
  };

  List.prototype.tryChangeActive = function () {};

  return List;
}(DropListMenu_1["default"]);

exports["default"] = List;

/***/ }),
/* 138 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(395);

/***/ }),
/* 139 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 检查选区是否在代码中，即菜单是否应该 active
 * @author lkw
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

function isActive(editor) {
  var $selectionELem = editor.selection.getSelectionContainerElem();

  if (!($selectionELem === null || $selectionELem === void 0 ? void 0 : $selectionELem.length)) {
    return false;
  }

  if ($selectionELem.getNodeName() == 'CODE' || $selectionELem.getNodeName() == 'PRE' || $selectionELem.parent().getNodeName() == 'CODE' || $selectionELem.parent().getNodeName() == 'PRE' || /hljs/.test($selectionELem.parent().attr('class'))) {
    return true;
  } else {
    return false;
  }
}

exports["default"] = isActive;

/***/ }),
/* 140 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _find = _interopRequireDefault(__webpack_require__(29));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.todo = void 0;

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var todo =
/** @class */
function () {
  function todo($orginElem) {
    var _a;

    this.template = "<ul class=\"w-e-todo\"><li><span contenteditable=\"false\"><input type=\"checkbox\"></span></li></ul>";
    this.checked = false;
    this.$todo = dom_core_1["default"](this.template);
    this.$child = (_a = $orginElem === null || $orginElem === void 0 ? void 0 : $orginElem.childNodes()) === null || _a === void 0 ? void 0 : _a.clone(true);
  }

  todo.prototype.init = function () {
    var $child = this.$child;
    var $inputContainer = this.getInputContainer();

    if ($child) {
      $child.insertAfter($inputContainer);
    }
  };

  todo.prototype.getInput = function () {
    var $todo = this.$todo;
    var $input = (0, _find["default"])($todo).call($todo, 'input');
    return $input;
  };

  todo.prototype.getInputContainer = function () {
    var $inputContainer = this.getInput().parent();
    return $inputContainer;
  };

  todo.prototype.getTodo = function () {
    return this.$todo;
  };

  return todo;
}();

exports.todo = todo;

function createTodo($orginElem) {
  var t = new todo($orginElem);
  t.init();
  return t;
}

exports["default"] = createTodo;

/***/ }),
/* 141 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 入口文件
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

__webpack_require__(146);

__webpack_require__(148);

__webpack_require__(152);

__webpack_require__(154);

__webpack_require__(156);

__webpack_require__(158);

__webpack_require__(160);

var index_1 = tslib_1.__importDefault(__webpack_require__(87));

tslib_1.__exportStar(__webpack_require__(442), exports); // 检验是否浏览器环境


try {
  document;
} catch (ex) {
  throw new Error('请在浏览器环境下运行');
}

exports["default"] = index_1["default"];

/***/ }),
/* 142 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(143);

module.exports = parent;


/***/ }),
/* 143 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(144);
var path = __webpack_require__(9);

var Object = path.Object;

var defineProperty = module.exports = function defineProperty(it, key, desc) {
  return Object.defineProperty(it, key, desc);
};

if (Object.defineProperty.sham) defineProperty.sham = true;


/***/ }),
/* 144 */
/***/ (function(module, exports, __webpack_require__) {

var $ = __webpack_require__(5);
var DESCRIPTORS = __webpack_require__(14);
var objectDefinePropertyModile = __webpack_require__(18);

// `Object.defineProperty` method
// https://tc39.github.io/ecma262/#sec-object.defineproperty
$({ target: 'Object', stat: true, forced: !DESCRIPTORS, sham: !DESCRIPTORS }, {
  defineProperty: objectDefinePropertyModile.f
});


/***/ }),
/* 145 */
/***/ (function(module, exports) {

var g;

// This works in non-strict mode
g = (function() {
	return this;
})();

try {
	// This works if eval is allowed (see CSP)
	g = g || new Function("return this")();
} catch (e) {
	// This works if the window reference is available
	if (typeof window === "object") g = window;
}

// g can still be undefined, but nothing to do about it...
// We return undefined, instead of nothing here, so it's
// easier to handle this case. if(!global) { ...}

module.exports = g;


/***/ }),
/* 146 */
/***/ (function(module, exports, __webpack_require__) {

var api = __webpack_require__(20);
            var content = __webpack_require__(147);

            content = content.__esModule ? content.default : content;

            if (typeof content === 'string') {
              content = [[module.i, content, '']];
            }

var options = {};

options.insert = "head";
options.singleton = false;

var update = api(content, options);



module.exports = content.locals || {};

/***/ }),
/* 147 */
/***/ (function(module, exports, __webpack_require__) {

// Imports
var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(21);
exports = ___CSS_LOADER_API_IMPORT___(false);
// Module
exports.push([module.i, ".w-e-toolbar,\n.w-e-text-container,\n.w-e-menu-panel {\n  padding: 0;\n  margin: 0;\n  box-sizing: border-box;\n  background-color: #fff;\n  /*表情菜单样式*/\n  /*分割线样式*/\n}\n.w-e-toolbar h1,\n.w-e-text-container h1,\n.w-e-menu-panel h1 {\n  font-size: 32px !important;\n}\n.w-e-toolbar h2,\n.w-e-text-container h2,\n.w-e-menu-panel h2 {\n  font-size: 24px !important;\n}\n.w-e-toolbar h3,\n.w-e-text-container h3,\n.w-e-menu-panel h3 {\n  font-size: 18.72px !important;\n}\n.w-e-toolbar h4,\n.w-e-text-container h4,\n.w-e-menu-panel h4 {\n  font-size: 16px !important;\n}\n.w-e-toolbar h5,\n.w-e-text-container h5,\n.w-e-menu-panel h5 {\n  font-size: 13.28px !important;\n}\n.w-e-toolbar p,\n.w-e-text-container p,\n.w-e-menu-panel p {\n  font-size: 16px !important;\n}\n.w-e-toolbar .eleImg,\n.w-e-text-container .eleImg,\n.w-e-menu-panel .eleImg {\n  cursor: pointer;\n  display: inline-block;\n  font-size: 18px;\n  padding: 0 3px;\n}\n.w-e-toolbar *,\n.w-e-text-container *,\n.w-e-menu-panel * {\n  padding: 0;\n  margin: 0;\n  box-sizing: border-box;\n}\n.w-e-toolbar hr,\n.w-e-text-container hr,\n.w-e-menu-panel hr {\n  cursor: pointer;\n  display: block;\n  height: 0px;\n  border: 0;\n  border-top: 3px solid #ccc;\n  margin: 20px 0;\n}\n.w-e-clear-fix:after {\n  content: \"\";\n  display: table;\n  clear: both;\n}\n.w-e-drop-list-item {\n  position: relative;\n  top: 1px;\n  padding-right: 7px;\n  color: #333 !important;\n}\n.w-e-drop-list-tl {\n  padding-left: 10px;\n  text-align: left;\n}\n", ""]);
// Exports
module.exports = exports;


/***/ }),
/* 148 */
/***/ (function(module, exports, __webpack_require__) {

var api = __webpack_require__(20);
            var content = __webpack_require__(149);

            content = content.__esModule ? content.default : content;

            if (typeof content === 'string') {
              content = [[module.i, content, '']];
            }

var options = {};

options.insert = "head";
options.singleton = false;

var update = api(content, options);



module.exports = content.locals || {};

/***/ }),
/* 149 */
/***/ (function(module, exports, __webpack_require__) {

// Imports
var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(21);
var ___CSS_LOADER_GET_URL_IMPORT___ = __webpack_require__(150);
var ___CSS_LOADER_URL_IMPORT_0___ = __webpack_require__(151);
exports = ___CSS_LOADER_API_IMPORT___(false);
var ___CSS_LOADER_URL_REPLACEMENT_0___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_0___);
// Module
exports.push([module.i, "@font-face {\n  font-family: 'w-e-icon';\n  src: url(" + ___CSS_LOADER_URL_REPLACEMENT_0___ + ") format('truetype');\n  font-weight: normal;\n  font-style: normal;\n}\n[class^=\"w-e-icon-\"],\n[class*=\" w-e-icon-\"] {\n  /* use !important to prevent issues with browser extensions that change fonts */\n  font-family: 'w-e-icon' !important;\n  speak: none;\n  font-style: normal;\n  font-weight: normal;\n  font-variant: normal;\n  text-transform: none;\n  line-height: 1;\n  /* Better Font Rendering =========== */\n  -webkit-font-smoothing: antialiased;\n  -moz-osx-font-smoothing: grayscale;\n}\n.w-e-icon-close:before {\n  content: \"\\f00d\";\n}\n.w-e-icon-upload2:before {\n  content: \"\\e9c6\";\n}\n.w-e-icon-trash-o:before {\n  content: \"\\f014\";\n}\n.w-e-icon-header:before {\n  content: \"\\f1dc\";\n}\n.w-e-icon-pencil2:before {\n  content: \"\\e906\";\n}\n.w-e-icon-paint-brush:before {\n  content: \"\\f1fc\";\n}\n.w-e-icon-image:before {\n  content: \"\\e90d\";\n}\n.w-e-icon-play:before {\n  content: \"\\e912\";\n}\n.w-e-icon-location:before {\n  content: \"\\e947\";\n}\n.w-e-icon-undo:before {\n  content: \"\\e965\";\n}\n.w-e-icon-redo:before {\n  content: \"\\e966\";\n}\n.w-e-icon-quotes-left:before {\n  content: \"\\e977\";\n}\n.w-e-icon-list-numbered:before {\n  content: \"\\e9b9\";\n}\n.w-e-icon-list2:before {\n  content: \"\\e9bb\";\n}\n.w-e-icon-link:before {\n  content: \"\\e9cb\";\n}\n.w-e-icon-happy:before {\n  content: \"\\e9df\";\n}\n.w-e-icon-bold:before {\n  content: \"\\ea62\";\n}\n.w-e-icon-underline:before {\n  content: \"\\ea63\";\n}\n.w-e-icon-italic:before {\n  content: \"\\ea64\";\n}\n.w-e-icon-strikethrough:before {\n  content: \"\\ea65\";\n}\n.w-e-icon-table2:before {\n  content: \"\\ea71\";\n}\n.w-e-icon-paragraph-left:before {\n  content: \"\\ea77\";\n}\n.w-e-icon-paragraph-center:before {\n  content: \"\\ea78\";\n}\n.w-e-icon-paragraph-right:before {\n  content: \"\\ea79\";\n}\n.w-e-icon-paragraph-justify:before {\n  content: \"\\ea7a\";\n}\n.w-e-icon-terminal:before {\n  content: \"\\f120\";\n}\n.w-e-icon-page-break:before {\n  content: \"\\ea68\";\n}\n.w-e-icon-cancel-circle:before {\n  content: \"\\ea0d\";\n}\n.w-e-icon-font:before {\n  content: \"\\ea5c\";\n}\n.w-e-icon-text-heigh:before {\n  content: \"\\ea5f\";\n}\n.w-e-icon-paint-format:before {\n  content: \"\\e90c\";\n}\n.w-e-icon-indent-increase:before {\n  content: \"\\ea7b\";\n}\n.w-e-icon-indent-decrease:before {\n  content: \"\\ea7c\";\n}\n.w-e-icon-row-height:before {\n  content: \"\\e9be\";\n}\n.w-e-icon-fullscreen_exit:before {\n  content: \"\\e900\";\n}\n.w-e-icon-fullscreen:before {\n  content: \"\\e901\";\n}\n.w-e-icon-split-line:before {\n  content: \"\\ea0b\";\n}\n.w-e-icon-checkbox-checked:before {\n  content: \"\\ea52\";\n}\n", ""]);
// Exports
module.exports = exports;


/***/ }),
/* 150 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = function (url, options) {
  if (!options) {
    // eslint-disable-next-line no-param-reassign
    options = {};
  } // eslint-disable-next-line no-underscore-dangle, no-param-reassign


  url = url && url.__esModule ? url.default : url;

  if (typeof url !== 'string') {
    return url;
  } // If url is already wrapped in quotes, remove them


  if (/^['"].*['"]$/.test(url)) {
    // eslint-disable-next-line no-param-reassign
    url = url.slice(1, -1);
  }

  if (options.hash) {
    // eslint-disable-next-line no-param-reassign
    url += options.hash;
  } // Should url be wrapped?
  // See https://drafts.csswg.org/css-values-3/#urls


  if (/["'() \t\n]/.test(url) || options.needQuotes) {
    return "\"".concat(url.replace(/"/g, '\\"').replace(/\n/g, '\\n'), "\"");
  }

  return url;
};

/***/ }),
/* 151 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = ("data:font/woff;base64,d09GRgABAAAAABskAAsAAAAAGtgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABPUy8yAAABCAAAAGAAAABgDxIPFWNtYXAAAAFoAAABHAAAARz2mfAgZ2FzcAAAAoQAAAAIAAAACAAAABBnbHlmAAACjAAAFXwAABV8IH7+mGhlYWQAABgIAAAANgAAADYb6gumaGhlYQAAGEAAAAAkAAAAJAkjBWlobXR4AAAYZAAAAKQAAACkmYcEbmxvY2EAABkIAAAAVAAAAFReAmKYbWF4cAAAGVwAAAAgAAAAIAA0ALZuYW1lAAAZfAAAAYYAAAGGmUoJ+3Bvc3QAABsEAAAAIAAAACAAAwAAAAMD7wGQAAUAAAKZAswAAACPApkCzAAAAesAMwEJAAAAAAAAAAAAAAAAAAAAARAAAAAAAAAAAAAAAAAAAAAAQAAA8fwDwP/AAEADwABAAAAAAQAAAAAAAAAAAAAAIAAAAAAAAwAAAAMAAAAcAAEAAwAAABwAAwABAAAAHAAEAQAAAAA8ACAABAAcAAEAIOkB6QbpDekS6UfpZul36bnpu+m+6cbpy+nf6gvqDepS6lzqX+pl6nHqfPAN8BTxIPHc8fz//f//AAAAAAAg6QDpBukM6RLpR+ll6Xfpuem76b7pxunL6d/qC+oN6lLqXOpf6mLqcep38A3wFPEg8dzx/P/9//8AAf/jFwQXABb7FvcWwxamFpYWVRZUFlIWSxZHFjQWCRYIFcQVuxW5FbcVrBWnEBcQEQ8GDksOLAADAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAB//8ADwABAAAAAAAAAAAAAgAANzkBAAAAAAEAAAAAAAAAAAACAAA3OQEAAAAAAQAAAAAAAAAAAAIAADc5AQAAAAAEAEEAAQO/A38ABQALABEAFwAAATMVIREzAxEhFSMVATUzESE1ETUhESM1Av/A/sJ+fgE+wP4Cfv7CAT5+Ar9+AT78ggE+fsACvsD+wn7+An7+wsAAAAAABABBAAEDvwN/AAUACwARABcAAAEhESM1IxM1MxEhNQERIRUjFREVMxUhEQKBAT5+wMB+/sL9wAE+wMD+wgN//sLA/X7A/sJ+AcIBPn7A/v7AfgE+AAAAAAIAAP/ABAADwAAEABMAAAE3AScBAy4BJxM3ASMBAyUBNQEHAYCAAcBA/kCfFzsyY4ABgMD+gMACgAGA/oBOAUBAAcBA/kD+nTI7FwERTgGA/oD9gMABgMD+gIAAAgAA/8AEAAOAACkALQAAAREjNTQmIyEiBh0BFBYzITI2PQEzESEVIyIGFREUFjsBMjY1ETQmKwE1ASE1IQQAwCYa/UAaJiYaAsAaJoD9wCANExMNgA0TEw0gAUD9QALAAYABgEAaJiYawBomJhpA/wCAEw3+wA0TEw0BQA0TQAGAQAAABAAAAAAEAAOAABAAIQAtADQAAAE4ATEROAExITgBMRE4ATEhNSEiBhURFBYzITI2NRE0JiMHFAYjIiY1NDYzMhYTITUTATM3A8D8gAOA/IAaJiYaA4AaJiYagDgoKDg4KCg4QP0A4AEAQOADQP0AAwBAJhr9ABomJhoDABom4Cg4OCgoODj9uIABgP7AwAAAAgAAAEAEAANAADgAPAAAASYnLgEnJiMiBw4BBwYHBgcOAQcGFRQXHgEXFhcWFx4BFxYzMjc+ATc2NzY3PgE3NjU0Jy4BJyYnARENAQPVNjg5djw9Pz89PHY5ODYLBwgLAwMDAwsIBws2ODl2PD0/Pz08djk4NgsHCAsDAwMDCwgHC/2rAUD+wAMgCAYGCAICAgIIBgYIKSoqWS0uLy8uLVkqKikIBgYIAgICAggGBggpKipZLS4vLy4tWSoqKf3gAYDAwAAAAAACAMD/wANAA8AAGwAnAAABIgcOAQcGFRQXHgEXFjEwNz4BNzY1NCcuAScmAyImNTQ2MzIWFRQGAgBCOzpXGRkyMngyMjIyeDIyGRlXOjtCUHBwUFBwcAPAGRlXOjtCeH19zEFBQUHMfX14Qjs6VxkZ/gBwUFBwcFBQcAAAAQAAAAAEAAOAACsAAAEiBw4BBwYHJxEhJz4BMzIXHgEXFhUUBw4BBwYHFzY3PgE3NjU0Jy4BJyYjAgA1MjJcKSkjlgGAkDWLUFBFRmkeHgkJIhgYHlUoICAtDAwoKIteXWoDgAoLJxscI5b+gJA0PB4eaUZFUCsoKUkgIRpgIysrYjY2OWpdXosoKAABAAAAAAQAA4AAKgAAExQXHgEXFhc3JicuAScmNTQ3PgE3NjMyFhcHIREHJicuAScmIyIHDgEHBgAMDC0gIChVHhgYIgkJHh5pRkVQUIs1kAGAliMpKVwyMjVqXV6LKCgBgDk2NmIrKyNgGiEgSSkoK1BFRmkeHjw0kAGAliMcGycLCigoi15dAAAAAAIAAABABAEDAAAmAE0AABMyFx4BFxYVFAcOAQcGIyInLgEnJjUnNDc+ATc2MxUiBgcOAQc+ASEyFx4BFxYVFAcOAQcGIyInLgEnJjUnNDc+ATc2MxUiBgcOAQc+AeEuKSk9ERISET0pKS4uKSk9ERIBIyN6UlFdQHUtCRAHCBICSS4pKT0REhIRPSkpLi4pKT0REgEjI3pSUV1AdS0JEAcIEgIAEhE9KSkuLikpPRESEhE9KSkuIF1RUnojI4AwLggTCgIBEhE9KSkuLikpPRESEhE9KSkuIF1RUnojI4AwLggTCgIBAAAGAED/wAQAA8AAAwAHAAsAEQAdACkAACUhFSERIRUhESEVIScRIzUjNRMVMxUjNTc1IzUzFRURIzUzNSM1MzUjNQGAAoD9gAKA/YACgP2AwEBAQIDAgIDAwICAgICAgAIAgAIAgMD/AMBA/fIyQJI8MkCS7v7AQEBAQEAABgAA/8AEAAPAAAMABwALABcAIwAvAAABIRUhESEVIREhFSEBNDYzMhYVFAYjIiYRNDYzMhYVFAYjIiYRNDYzMhYVFAYjIiYBgAKA/YACgP2AAoD9gP6ASzU1S0s1NUtLNTVLSzU1S0s1NUtLNTVLA4CA/wCA/wCAA0A1S0s1NUtL/rU1S0s1NUtL/rU1S0s1NUtLAAUAAABABWADAAADAAcACwAOABEAABMhFSEVIRUhFSEVIQEXNzUnBwADgPyAA4D8gAOA/IAD4MDAwMADAMBAwEDAAUDAwEDAwAAAAAADAAAAAAQAA6AAAwANABQAADchFSElFSE1EyEVITUhJQkBIxEjEQAEAPwABAD8AIABAAEAAQD9YAEgASDggEBAwEBAAQCAgMABIP7g/wABAAAAAAACAB7/zAPiA7QAMwBkAAABIiYnJicmNDc2PwE+ATMyFhcWFxYUBwYPAQYiJyY0PwE2NCcuASMiBg8BBhQXFhQHDgEjAyImJyYnJjQ3Nj8BNjIXFhQPAQYUFx4BMzI2PwE2NCcmNDc2MhcWFxYUBwYPAQ4BIwG4ChMIIxISEhIjwCNZMTFZIyMSEhISI1gPLA8PD1gpKRQzHBwzFMApKQ8PCBMKuDFZIyMSEhISI1gPLA8PD1gpKRQzHBwzFMApKQ8PDysQIxISEhIjwCNZMQFECAckLS1eLS0kwCIlJSIkLS1eLS0kVxAQDysPWCl0KRQVFRTAKXQpDysQBwj+iCUiJC0tXi0tJFcQEA8rD1gpdCkUFRUUwCl0KQ8rEA8PJC0tXi0tJMAiJQAAAAAFAAD/wAQAA8AAGwA3AFMAXwBrAAAFMjc+ATc2NTQnLgEnJiMiBw4BBwYVFBceARcWEzIXHgEXFhUUBw4BBwYjIicuAScmNTQ3PgE3NhMyNz4BNzY3BgcOAQcGIyInLgEnJicWFx4BFxYnNDYzMhYVFAYjIiYlNDYzMhYVFAYjIiYCAGpdXosoKCgoi15dampdXosoKCgoi15dalZMTHEgISEgcUxMVlZMTHEgISEgcUxMVisrKlEmJiMFHBtWODc/Pzc4VhscBSMmJlEqK9UlGxslJRsbJQGAJRsbJSUbGyVAKCiLXl1qal1eiygoKCiLXl1qal1eiygoA6AhIHFMTFZWTExxICEhIHFMTFZWTExxICH+CQYGFRAQFEM6OlYYGRkYVjo6QxQQEBUGBvcoODgoKDg4KCg4OCgoODgAAAEAAAFABAACQAAPAAATFRQWMyEyNj0BNCYjISIGABMNA8ANExMN/EANEwIgwA0TEw3ADRMTAAAAAwAA/8AEAAPAABsANwBDAAABIgcOAQcGFRQXHgEXFjMyNz4BNzY1NCcuAScmAyInLgEnJjU0Nz4BNzYzMhceARcWFRQHDgEHBhMHJwcXBxc3FzcnNwIAal1eiygoKCiLXl1qal1eiygoKCiLXl1qVkxMcSAhISBxTExWVkxMcSAhISBxTExKoKBgoKBgoKBgoKADwCgoi15dampdXosoKCgoi15dampdXosoKPxgISBxTExWVkxMcSAhISBxTExWVkxMcSAhAqCgoGCgoGCgoGCgoAACAAD/wAQAA8AADwAVAAABISIGFREUFjMhMjY1ETQmASc3FwEXA4D9ADVLSzUDADVLS/4L7VqTATNaA8BLNf0ANUtLNQMANUv85e5akgEyWgAAAAABAGX/wAObA8AAKQAAASImIyIHDgEHBhUUFjMuATU0NjcwBwYCBwYHFSETMzcjNx4BMzI2Nw4BAyBEaEZxU1RtGhtJSAYNZUoQEEs8PFkBPWzGLNc0LVUmLlAYHT0DsBAeHWE+P0FNOwsmN5lvA31+/sWPkCMZAgCA9gkPN2sJBwAAAAACAAAAAAQAA4AACQAXAAAlMwcnMxEjNxcjJREnIxEzFSE1MxEjBxEDgICgoICAoKCA/wBAwID+gIDAQMDAwAIAwMDA/wCA/UBAQALAgAEAAAMAwAAAA0ADgAAWAB8AKAAAAT4BNTQnLgEnJiMhESEyNz4BNzY1NCYBMzIWFRQGKwETIxEzMhYVFAYCxBwgFBRGLi81/sABgDUvLkYUFET+hGUqPDwpZp+fnyw+PgHbIlQvNS8uRhQU/IAUFEYuLzVGdAFGSzU1S/6AAQBLNTVLAAAAAAIAwAAAA0ADgAAfACMAAAEzERQHDgEHBiMiJy4BJyY1ETMRFBYXHgEzMjY3PgE1ASEVIQLAgBkZVzo7QkI7OlcZGYAbGBxJKChJHBgb/gACgP2AA4D+YDw0NU4WFxcWTjU0PAGg/mAeOBcYGxsYFzge/qCAAAAAAAEAgAAAA4ADgAALAAABFSMBMxUhNTMBIzUDgID+wID+QIABQIADgED9AEBAAwBAAAEAAAAABAADgAA9AAABFSMeARUUBgcOASMiJicuATUzFBYzMjY1NCYjITUhLgEnLgE1NDY3PgEzMhYXHgEVIzQmIyIGFRQWMzIWFwQA6xUWNTAscT4+cSwwNYByTk5yck7+AAEsAgQBMDU1MCxxPj5xLDA1gHJOTnJyTjtuKwHAQB1BIjViJCEkJCEkYjU0TEw0NExAAQMBJGI1NWIkISQkISRiNTRMTDQ0TCEfAAAACgAAAAAEAAOAAAMABwALAA8AEwAXABsAHwAjACcAABMRIREBNSEVHQEhNQEVITUjFSE1ESEVISUhFSERNSEVASEVISE1IRUABAD9gAEA/wABAP8AQP8AAQD/AAKAAQD/AAEA/IABAP8AAoABAAOA/IADgP3AwMBAwMACAMDAwMD/AMDAwAEAwMD+wMDAwAAABQAAAAAEAAOAAAMABwALAA8AEwAAEyEVIRUhFSERIRUhESEVIREhFSEABAD8AAKA/YACgP2ABAD8AAQA/AADgIBAgP8AgAFAgP8AgAAAAAAFAAAAAAQAA4AAAwAHAAsADwATAAATIRUhFyEVIREhFSEDIRUhESEVIQAEAPwAwAKA/YACgP2AwAQA/AAEAPwAA4CAQID/AIABQID/AIAAAAUAAAAABAADgAADAAcACwAPABMAABMhFSEFIRUhESEVIQEhFSERIRUhAAQA/AABgAKA/YACgP2A/oAEAPwABAD8AAOAgECA/wCAAUCA/wCAAAAAAAUAAAAABAADgAADAAcACwAPABMAABMhFSEVIRUhFSEVIRUhFSEVIRUhAAQA/AAEAPwABAD8AAQA/AAEAPwAA4CAQIBAgECAQIAAAAAGAAAAAAQAA4AAAwAHAAsADwATABYAABMhFSEFIRUhFSEVIRUhFSEFIRUhGQEFAAQA/AABgAKA/YACgP2AAoD9gP6ABAD8AAEAA4CAQIBAgECAQIABAAGAwAAAAAYAAAAABAADgAADAAcACwAPABMAFgAAEyEVIQUhFSEVIRUhFSEVIQUhFSEBESUABAD8AAGAAoD9gAKA/YACgP2A/oAEAPwAAQD/AAOAgECAQIBAgECAAoD+gMAAAQA/AD8C5gLmACwAACUUDwEGIyIvAQcGIyIvASY1ND8BJyY1ND8BNjMyHwE3NjMyHwEWFRQPARcWFQLmEE4QFxcQqKgQFxYQThAQqKgQEE4QFhcQqKgQFxcQThAQqKgQwxYQThAQqKgQEE4QFhcQqKgQFxcQThAQqKgQEE4QFxcQqKgQFwAAAAYAAAAAAyUDbgAUACgAPABNAFUAggAAAREUBwYrASInJjURNDc2OwEyFxYVMxEUBwYrASInJjURNDc2OwEyFxYXERQHBisBIicmNRE0NzY7ATIXFhMRIREUFxYXFjMhMjc2NzY1ASEnJicjBgcFFRQHBisBERQHBiMhIicmNREjIicmPQE0NzY7ATc2NzY7ATIXFh8BMzIXFhUBJQYFCCQIBQYGBQgkCAUGkgUFCCUIBQUFBQglCAUFkgUFCCUIBQUFBQglCAUFSf4ABAQFBAIB2wIEBAQE/oABABsEBrUGBAH3BgUINxobJv4lJhsbNwgFBQUFCLEoCBcWF7cXFhYJKLAIBQYCEv63CAUFBQUIAUkIBQYGBQj+twgFBQUFCAFJCAUGBgUI/rcIBQUFBQgBSQgFBgYF/lsCHf3jDQsKBQUFBQoLDQJmQwUCAgVVJAgGBf3jMCIjISIvAiAFBggkCAUFYBUPDw8PFWAFBQgAAgAHAEkDtwKvABoALgAACQEGIyIvASY1ND8BJyY1ND8BNjMyFwEWFRQHARUUBwYjISInJj0BNDc2MyEyFxYBTv72BgcIBR0GBuHhBgYdBQgHBgEKBgYCaQUFCP3bCAUFBQUIAiUIBQUBhf72BgYcBggHBuDhBgcHBh0FBf71BQgHBv77JQgFBQUFCCUIBQUFBQAAAAEAIwAAA90DbgCzAAAlIicmIyIHBiMiJyY1NDc2NzY3Njc2PQE0JyYjISIHBh0BFBcWFxYzFhcWFRQHBiMiJyYjIgcGIyInJjU0NzY3Njc2NzY9ARE0NTQ1NCc0JyYnJicmJyYnJiMiJyY1NDc2MzIXFjMyNzYzMhcWFRQHBiMGBwYHBh0BFBcWMyEyNzY9ATQnJicmJyY1NDc2MzIXFjMyNzYzMhcWFRQHBgciBwYHBhURFBcWFxYXMhcWFRQHBiMDwRkzMhoZMjMZDQgHCQoNDBEQChIBBxX+fhYHARUJEhMODgwLBwcOGzU1GhgxMRgNBwcJCQsMEA8JEgECAQIDBAQFCBIRDQ0KCwcHDho1NRoYMDEYDgcHCQoMDRAQCBQBBw8BkA4HARQKFxcPDgcHDhkzMhkZMTEZDgcHCgoNDRARCBQUCRERDg0KCwcHDgACAgICDAsPEQkJAQEDAwUMROAMBQMDBQzUUQ0GAQIBCAgSDwwNAgICAgwMDhEICQECAwMFDUUhAdACDQ0ICA4OCgoLCwcHAwYBAQgIEg8MDQICAgINDA8RCAgBAgEGDFC2DAcBAQcMtlAMBgEBBgcWDwwNAgICAg0MDxEICAEBAgYNT/3mRAwGAgIBCQgRDwwNAAACAAD/twP/A7cAEwA5AAABMhcWFRQHAgcGIyInJjU0NwE2MwEWFxYfARYHBiMiJyYnJicmNRYXFhcWFxYzMjc2NzY3Njc2NzY3A5soHh4avkw3RUg0NDUBbSEp/fgXJicvAQJMTHtHNjYhIRARBBMUEBASEQkXCA8SExUVHR0eHikDtxsaKCQz/plGNDU0SUkwAUsf/bErHx8NKHpNTBobLi86OkQDDw4LCwoKFiUbGhERCgsEBAIAAQAAAAAAAIWwaoFfDzz1AAsEAAAAAADbteOZAAAAANu145kAAP+3BWADwAAAAAgAAgAAAAAAAAABAAADwP/AAAAFgAAA//8FYAABAAAAAAAAAAAAAAAAAAAAKQQAAAAAAAAAAAAAAAIAAAAEAABBBAAAQQQAAAAEAAAABAAAAAQAAAAEAADABAAAAAQAAAAEAAAABAAAQAQAAAAFgAAABAAAAAQAAB4EAAAABAAAAAQAAAAEAAAABAAAZQQAAAAEAADABAAAwAQAAIAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAMlAD8DJQAAA74ABwQAACMD/wAAAAAAAAAKABQAHgBKAHYApADmAS4BkgHQAhYCXALQAw4DWAN+A6gEPgTeBPoFZAWOBdAF+AY6BnYGjgbmBy4HVgd+B6gHzgf8CCoIbgkmCXAKYgq+AAEAAAApALQACgAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAOAK4AAQAAAAAAAQAHAAAAAQAAAAAAAgAHAGAAAQAAAAAAAwAHADYAAQAAAAAABAAHAHUAAQAAAAAABQALABUAAQAAAAAABgAHAEsAAQAAAAAACgAaAIoAAwABBAkAAQAOAAcAAwABBAkAAgAOAGcAAwABBAkAAwAOAD0AAwABBAkABAAOAHwAAwABBAkABQAWACAAAwABBAkABgAOAFIAAwABBAkACgA0AKRpY29tb29uAGkAYwBvAG0AbwBvAG5WZXJzaW9uIDEuMABWAGUAcgBzAGkAbwBuACAAMQAuADBpY29tb29uAGkAYwBvAG0AbwBvAG5pY29tb29uAGkAYwBvAG0AbwBvAG5SZWd1bGFyAFIAZQBnAHUAbABhAHJpY29tb29uAGkAYwBvAG0AbwBvAG5Gb250IGdlbmVyYXRlZCBieSBJY29Nb29uLgBGAG8AbgB0ACAAZwBlAG4AZQByAGEAdABlAGQAIABiAHkAIABJAGMAbwBNAG8AbwBuAC4AAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

/***/ }),
/* 152 */
/***/ (function(module, exports, __webpack_require__) {

var api = __webpack_require__(20);
            var content = __webpack_require__(153);

            content = content.__esModule ? content.default : content;

            if (typeof content === 'string') {
              content = [[module.i, content, '']];
            }

var options = {};

options.insert = "head";
options.singleton = false;

var update = api(content, options);



module.exports = content.locals || {};

/***/ }),
/* 153 */
/***/ (function(module, exports, __webpack_require__) {

// Imports
var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(21);
exports = ___CSS_LOADER_API_IMPORT___(false);
// Module
exports.push([module.i, ".w-e-toolbar {\n  display: flex;\n  padding: 0 6px;\n  flex-wrap: wrap;\n  position: relative;\n  /* 单个菜单 */\n}\n.w-e-toolbar .w-e-menu {\n  position: relative;\n  display: flex;\n  width: 40px;\n  height: 40px;\n  align-items: center;\n  justify-content: center;\n  text-align: center;\n  cursor: pointer;\n}\n.w-e-toolbar .w-e-menu i {\n  color: #999;\n}\n.w-e-toolbar .w-e-menu:hover {\n  background-color: #F6F6F6;\n}\n.w-e-toolbar .w-e-menu:hover i {\n  color: #333;\n}\n.w-e-toolbar .w-e-active i {\n  color: #1e88e5;\n}\n.w-e-toolbar .w-e-active:hover i {\n  color: #1e88e5;\n}\n.w-e-menu-tooltip {\n  position: absolute;\n  display: flex;\n  color: #f1f1f1;\n  background-color: rgba(0, 0, 0, 0.75);\n  box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.15);\n  border-radius: 4px;\n  padding: 4px 5px 6px;\n  justify-content: center;\n  align-items: center;\n}\n.w-e-menu-tooltip-up::after {\n  content: \"\";\n  position: absolute;\n  top: 100%;\n  left: 50%;\n  margin-left: -5px;\n  border: 5px solid rgba(0, 0, 0, 0);\n  border-top-color: rgba(0, 0, 0, 0.73);\n}\n.w-e-menu-tooltip-down::after {\n  content: \"\";\n  position: absolute;\n  bottom: 100%;\n  left: 50%;\n  margin-left: -5px;\n  border: 5px solid rgba(0, 0, 0, 0);\n  border-bottom-color: rgba(0, 0, 0, 0.73);\n}\n.w-e-menu-tooltip-item-wrapper {\n  font-size: 14px;\n  margin: 0 5px;\n}\n", ""]);
// Exports
module.exports = exports;


/***/ }),
/* 154 */
/***/ (function(module, exports, __webpack_require__) {

var api = __webpack_require__(20);
            var content = __webpack_require__(155);

            content = content.__esModule ? content.default : content;

            if (typeof content === 'string') {
              content = [[module.i, content, '']];
            }

var options = {};

options.insert = "head";
options.singleton = false;

var update = api(content, options);



module.exports = content.locals || {};

/***/ }),
/* 155 */
/***/ (function(module, exports, __webpack_require__) {

// Imports
var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(21);
exports = ___CSS_LOADER_API_IMPORT___(false);
// Module
exports.push([module.i, ".w-e-text-container {\n  position: relative;\n  height: 100%;\n}\n.w-e-text-container .w-e-progress {\n  position: absolute;\n  background-color: #1e88e5;\n  top: 0;\n  left: 0;\n  height: 1px;\n}\n.w-e-text-container .placeholder {\n  color: #D4D4D4;\n  position: absolute;\n  font-size: 11pt;\n  line-height: 22px;\n  left: 10px;\n  top: 10px;\n  -webkit-user-select: none;\n     -moz-user-select: none;\n      -ms-user-select: none;\n          user-select: none;\n  z-index: -1;\n}\n.w-e-text {\n  padding: 0 10px;\n  overflow-y: auto;\n}\n.w-e-text p,\n.w-e-text h1,\n.w-e-text h2,\n.w-e-text h3,\n.w-e-text h4,\n.w-e-text h5,\n.w-e-text table,\n.w-e-text pre {\n  margin: 10px 0;\n  line-height: 1.5;\n}\n.w-e-text ul,\n.w-e-text ol {\n  margin: 10px 0 10px 20px;\n}\n.w-e-text blockquote {\n  display: block;\n  border-left: 8px solid #d0e5f2;\n  padding: 5px 10px;\n  margin: 10px 0;\n  line-height: 1.4;\n  font-size: 100%;\n  background-color: #f1f1f1;\n}\n.w-e-text code {\n  display: inline-block;\n  background-color: #f1f1f1;\n  border-radius: 3px;\n  padding: 3px 5px;\n  margin: 0 3px;\n}\n.w-e-text pre code {\n  display: block;\n}\n.w-e-text table {\n  border-top: 1px solid #ccc;\n  border-left: 1px solid #ccc;\n}\n.w-e-text table td,\n.w-e-text table th {\n  border-bottom: 1px solid #ccc;\n  border-right: 1px solid #ccc;\n  padding: 3px 5px;\n  min-height: 30px;\n  height: 30px;\n}\n.w-e-text table th {\n  border-bottom: 2px solid #ccc;\n  text-align: center;\n  background-color: #f1f1f1;\n}\n.w-e-text:focus {\n  outline: none;\n}\n.w-e-text img {\n  cursor: pointer;\n}\n.w-e-text img:hover {\n  box-shadow: 0 0 5px #333;\n}\n.w-e-text .w-e-todo {\n  margin: 0 0 0 20px;\n}\n.w-e-text .w-e-todo li {\n  list-style: none;\n  font-size: 1em;\n}\n.w-e-text .w-e-todo li span:nth-child(1) {\n  position: relative;\n  left: -18px;\n}\n.w-e-text .w-e-todo li span:nth-child(1) input {\n  position: absolute;\n  margin-right: 3px;\n}\n.w-e-text .w-e-todo li span:nth-child(1) input[type=checkbox] {\n  top: 50%;\n  margin-top: -6px;\n}\n.w-e-tooltip {\n  position: absolute;\n  display: flex;\n  color: #f1f1f1;\n  background-color: rgba(0, 0, 0, 0.75);\n  box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.15);\n  border-radius: 4px;\n  padding: 4px 5px 6px;\n  justify-content: center;\n  align-items: center;\n}\n.w-e-tooltip-up::after {\n  content: \"\";\n  position: absolute;\n  top: 100%;\n  left: 50%;\n  margin-left: -5px;\n  border: 5px solid rgba(0, 0, 0, 0);\n  border-top-color: rgba(0, 0, 0, 0.73);\n}\n.w-e-tooltip-down::after {\n  content: \"\";\n  position: absolute;\n  bottom: 100%;\n  left: 50%;\n  margin-left: -5px;\n  border: 5px solid rgba(0, 0, 0, 0);\n  border-bottom-color: rgba(0, 0, 0, 0.73);\n}\n.w-e-tooltip-item-wrapper {\n  cursor: pointer;\n  font-size: 14px;\n  margin: 0 5px;\n}\n.w-e-tooltip-item-wrapper:hover {\n  color: #ccc;\n  text-decoration: underline;\n}\n", ""]);
// Exports
module.exports = exports;


/***/ }),
/* 156 */
/***/ (function(module, exports, __webpack_require__) {

var api = __webpack_require__(20);
            var content = __webpack_require__(157);

            content = content.__esModule ? content.default : content;

            if (typeof content === 'string') {
              content = [[module.i, content, '']];
            }

var options = {};

options.insert = "head";
options.singleton = false;

var update = api(content, options);



module.exports = content.locals || {};

/***/ }),
/* 157 */
/***/ (function(module, exports, __webpack_require__) {

// Imports
var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(21);
exports = ___CSS_LOADER_API_IMPORT___(false);
// Module
exports.push([module.i, ".w-e-menu .w-e-panel-container {\n  position: absolute;\n  top: 0;\n  left: 50%;\n  border: 1px solid #ccc;\n  border-top: 0;\n  box-shadow: 1px 1px 2px #ccc;\n  color: #333;\n  background-color: #fff;\n  text-align: left;\n  /* 为 emotion panel 定制的样式 */\n  /* 上传图片、上传视频的 panel 定制样式 */\n}\n.w-e-menu .w-e-panel-container .w-e-panel-close {\n  position: absolute;\n  right: 0;\n  top: 0;\n  padding: 5px;\n  margin: 2px 5px 0 0;\n  cursor: pointer;\n  color: #999;\n}\n.w-e-menu .w-e-panel-container .w-e-panel-close:hover {\n  color: #333;\n}\n.w-e-menu .w-e-panel-container .w-e-panel-tab-title {\n  list-style: none;\n  display: flex;\n  font-size: 14px;\n  margin: 2px 10px 0 10px;\n  border-bottom: 1px solid #f1f1f1;\n}\n.w-e-menu .w-e-panel-container .w-e-panel-tab-title .w-e-item {\n  padding: 3px 5px;\n  color: #999;\n  cursor: pointer;\n  margin: 0 3px;\n  position: relative;\n  top: 1px;\n}\n.w-e-menu .w-e-panel-container .w-e-panel-tab-title .w-e-active {\n  color: #333;\n  border-bottom: 1px solid #333;\n  cursor: default;\n  font-weight: 700;\n}\n.w-e-menu .w-e-panel-container .w-e-panel-tab-content {\n  padding: 10px 15px 10px 15px;\n  font-size: 16px;\n  /* 输入框的样式 */\n  /* 按钮的样式 */\n}\n.w-e-menu .w-e-panel-container .w-e-panel-tab-content input:focus,\n.w-e-menu .w-e-panel-container .w-e-panel-tab-content textarea:focus,\n.w-e-menu .w-e-panel-container .w-e-panel-tab-content button:focus {\n  outline: none;\n}\n.w-e-menu .w-e-panel-container .w-e-panel-tab-content textarea {\n  width: 100%;\n  border: 1px solid #ccc;\n  padding: 5px;\n  margin-top: 10px;\n}\n.w-e-menu .w-e-panel-container .w-e-panel-tab-content textarea:focus {\n  border-color: #1e88e5;\n}\n.w-e-menu .w-e-panel-container .w-e-panel-tab-content input[type=text] {\n  border: none;\n  border-bottom: 1px solid #ccc;\n  font-size: 14px;\n  height: 20px;\n  color: #333;\n  text-align: left;\n}\n.w-e-menu .w-e-panel-container .w-e-panel-tab-content input[type=text].small {\n  width: 30px;\n  text-align: center;\n}\n.w-e-menu .w-e-panel-container .w-e-panel-tab-content input[type=text].block {\n  display: block;\n  width: 100%;\n  margin: 10px 0;\n}\n.w-e-menu .w-e-panel-container .w-e-panel-tab-content input[type=text]:focus {\n  border-bottom: 2px solid #1e88e5;\n}\n.w-e-menu .w-e-panel-container .w-e-panel-tab-content .w-e-button-container button {\n  font-size: 14px;\n  color: #1e88e5;\n  border: none;\n  padding: 5px 10px;\n  background-color: #fff;\n  cursor: pointer;\n  border-radius: 3px;\n}\n.w-e-menu .w-e-panel-container .w-e-panel-tab-content .w-e-button-container button.left {\n  float: left;\n  margin-right: 10px;\n}\n.w-e-menu .w-e-panel-container .w-e-panel-tab-content .w-e-button-container button.right {\n  float: right;\n  margin-left: 10px;\n}\n.w-e-menu .w-e-panel-container .w-e-panel-tab-content .w-e-button-container button.gray {\n  color: #999;\n}\n.w-e-menu .w-e-panel-container .w-e-panel-tab-content .w-e-button-container button.red {\n  color: #c24f4a;\n}\n.w-e-menu .w-e-panel-container .w-e-panel-tab-content .w-e-button-container button:hover {\n  background-color: #f1f1f1;\n}\n.w-e-menu .w-e-panel-container .w-e-panel-tab-content .w-e-button-container:after {\n  content: \"\";\n  display: table;\n  clear: both;\n}\n.w-e-menu .w-e-panel-container .w-e-emoticon-container .w-e-item {\n  cursor: pointer;\n  font-size: 18px;\n  padding: 0 3px;\n  display: inline-block;\n}\n.w-e-menu .w-e-panel-container .w-e-up-img-container,\n.w-e-menu .w-e-panel-container .w-e-up-video-container {\n  text-align: center;\n}\n.w-e-menu .w-e-panel-container .w-e-up-img-container .w-e-up-btn,\n.w-e-menu .w-e-panel-container .w-e-up-video-container .w-e-up-btn {\n  display: inline-block;\n  color: #999;\n  cursor: pointer;\n  font-size: 60px;\n  line-height: 1;\n}\n.w-e-menu .w-e-panel-container .w-e-up-img-container .w-e-up-btn:hover,\n.w-e-menu .w-e-panel-container .w-e-up-video-container .w-e-up-btn:hover {\n  color: #333;\n}\n", ""]);
// Exports
module.exports = exports;


/***/ }),
/* 158 */
/***/ (function(module, exports, __webpack_require__) {

var api = __webpack_require__(20);
            var content = __webpack_require__(159);

            content = content.__esModule ? content.default : content;

            if (typeof content === 'string') {
              content = [[module.i, content, '']];
            }

var options = {};

options.insert = "head";
options.singleton = false;

var update = api(content, options);



module.exports = content.locals || {};

/***/ }),
/* 159 */
/***/ (function(module, exports, __webpack_require__) {

// Imports
var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(21);
exports = ___CSS_LOADER_API_IMPORT___(false);
// Module
exports.push([module.i, ".w-e-toolbar .w-e-droplist {\n  position: absolute;\n  left: 0;\n  top: 0;\n  background-color: #fff;\n  border: 1px solid #f1f1f1;\n  border-right-color: #ccc;\n  border-bottom-color: #ccc;\n}\n.w-e-toolbar .w-e-droplist .w-e-dp-title {\n  text-align: center;\n  color: #999;\n  line-height: 2;\n  border-bottom: 1px solid #f1f1f1;\n  font-size: 13px;\n}\n.w-e-toolbar .w-e-droplist ul.w-e-list {\n  list-style: none;\n  line-height: 1;\n}\n.w-e-toolbar .w-e-droplist ul.w-e-list li.w-e-item {\n  color: #333;\n  padding: 5px 0;\n}\n.w-e-toolbar .w-e-droplist ul.w-e-list li.w-e-item:hover {\n  background-color: #f1f1f1;\n}\n.w-e-toolbar .w-e-droplist ul.w-e-block {\n  list-style: none;\n  text-align: left;\n  padding: 5px;\n}\n.w-e-toolbar .w-e-droplist ul.w-e-block li.w-e-item {\n  display: inline-block;\n  padding: 3px 5px;\n}\n.w-e-toolbar .w-e-droplist ul.w-e-block li.w-e-item:hover {\n  background-color: #f1f1f1;\n}\n", ""]);
// Exports
module.exports = exports;


/***/ }),
/* 160 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description polyfill 【注意，js 语法的兼容，都通过 babel transform runtime 支持】
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _promise = _interopRequireDefault(__webpack_require__(161));

if (!Element.prototype.matches) {
  Element.prototype.matches = function (s) {
    var matches = this.ownerDocument.querySelectorAll(s);
    var i = matches.length;

    for (i; i >= 0; i--) {
      if (matches.item(i) === this) break;
    }

    return i > -1;
  };
} // 有的第三方库需要原生 Promise ，而 IE11 又没有原生 Promise ，就报错


if (!_promise["default"]) {
  window.Promise = _promise["default"];
}

/***/ }),
/* 161 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(162);

/***/ }),
/* 162 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(163);

module.exports = parent;


/***/ }),
/* 163 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(61);
__webpack_require__(50);
__webpack_require__(54);
__webpack_require__(175);
__webpack_require__(178);
__webpack_require__(179);
var path = __webpack_require__(9);

module.exports = path.Promise;


/***/ }),
/* 164 */
/***/ (function(module, exports, __webpack_require__) {

var toInteger = __webpack_require__(62);
var requireObjectCoercible = __webpack_require__(49);

// `String.prototype.{ codePointAt, at }` methods implementation
var createMethod = function (CONVERT_TO_STRING) {
  return function ($this, pos) {
    var S = String(requireObjectCoercible($this));
    var position = toInteger(pos);
    var size = S.length;
    var first, second;
    if (position < 0 || position >= size) return CONVERT_TO_STRING ? '' : undefined;
    first = S.charCodeAt(position);
    return first < 0xD800 || first > 0xDBFF || position + 1 === size
      || (second = S.charCodeAt(position + 1)) < 0xDC00 || second > 0xDFFF
        ? CONVERT_TO_STRING ? S.charAt(position) : first
        : CONVERT_TO_STRING ? S.slice(position, position + 2) : (first - 0xD800 << 10) + (second - 0xDC00) + 0x10000;
  };
};

module.exports = {
  // `String.prototype.codePointAt` method
  // https://tc39.github.io/ecma262/#sec-string.prototype.codepointat
  codeAt: createMethod(false),
  // `String.prototype.at` method
  // https://github.com/mathiasbynens/String.prototype.at
  charAt: createMethod(true)
};


/***/ }),
/* 165 */
/***/ (function(module, exports, __webpack_require__) {

var global = __webpack_require__(8);
var inspectSource = __webpack_require__(102);

var WeakMap = global.WeakMap;

module.exports = typeof WeakMap === 'function' && /native code/.test(inspectSource(WeakMap));


/***/ }),
/* 166 */
/***/ (function(module, exports, __webpack_require__) {

var global = __webpack_require__(8);
var createNonEnumerableProperty = __webpack_require__(19);

module.exports = function (key, value) {
  try {
    createNonEnumerableProperty(global, key, value);
  } catch (error) {
    global[key] = value;
  } return value;
};


/***/ }),
/* 167 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var IteratorPrototype = __webpack_require__(104).IteratorPrototype;
var create = __webpack_require__(77);
var createPropertyDescriptor = __webpack_require__(48);
var setToStringTag = __webpack_require__(37);
var Iterators = __webpack_require__(44);

var returnThis = function () { return this; };

module.exports = function (IteratorConstructor, NAME, next) {
  var TO_STRING_TAG = NAME + ' Iterator';
  IteratorConstructor.prototype = create(IteratorPrototype, { next: createPropertyDescriptor(1, next) });
  setToStringTag(IteratorConstructor, TO_STRING_TAG, false, true);
  Iterators[TO_STRING_TAG] = returnThis;
  return IteratorConstructor;
};


/***/ }),
/* 168 */
/***/ (function(module, exports, __webpack_require__) {

var fails = __webpack_require__(11);

module.exports = !fails(function () {
  function F() { /* empty */ }
  F.prototype.constructor = null;
  return Object.getPrototypeOf(new F()) !== F.prototype;
});


/***/ }),
/* 169 */
/***/ (function(module, exports, __webpack_require__) {

var DESCRIPTORS = __webpack_require__(14);
var definePropertyModule = __webpack_require__(18);
var anObject = __webpack_require__(25);
var objectKeys = __webpack_require__(52);

// `Object.defineProperties` method
// https://tc39.github.io/ecma262/#sec-object.defineproperties
module.exports = DESCRIPTORS ? Object.defineProperties : function defineProperties(O, Properties) {
  anObject(O);
  var keys = objectKeys(Properties);
  var length = keys.length;
  var index = 0;
  var key;
  while (length > index) definePropertyModule.f(O, key = keys[index++], Properties[key]);
  return O;
};


/***/ }),
/* 170 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var TO_STRING_TAG_SUPPORT = __webpack_require__(81);
var classof = __webpack_require__(65);

// `Object.prototype.toString` method implementation
// https://tc39.github.io/ecma262/#sec-object.prototype.tostring
module.exports = TO_STRING_TAG_SUPPORT ? {}.toString : function toString() {
  return '[object ' + classof(this) + ']';
};


/***/ }),
/* 171 */
/***/ (function(module, exports, __webpack_require__) {

var anObject = __webpack_require__(25);
var aPossiblePrototype = __webpack_require__(172);

// `Object.setPrototypeOf` method
// https://tc39.github.io/ecma262/#sec-object.setprototypeof
// Works with __proto__ only. Old v8 can't work with null proto objects.
/* eslint-disable no-proto */
module.exports = Object.setPrototypeOf || ('__proto__' in {} ? function () {
  var CORRECT_SETTER = false;
  var test = {};
  var setter;
  try {
    setter = Object.getOwnPropertyDescriptor(Object.prototype, '__proto__').set;
    setter.call(test, []);
    CORRECT_SETTER = test instanceof Array;
  } catch (error) { /* empty */ }
  return function setPrototypeOf(O, proto) {
    anObject(O);
    aPossiblePrototype(proto);
    if (CORRECT_SETTER) setter.call(O, proto);
    else O.__proto__ = proto;
    return O;
  };
}() : undefined);


/***/ }),
/* 172 */
/***/ (function(module, exports, __webpack_require__) {

var isObject = __webpack_require__(13);

module.exports = function (it) {
  if (!isObject(it) && it !== null) {
    throw TypeError("Can't set " + String(it) + ' as a prototype');
  } return it;
};


/***/ }),
/* 173 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var toIndexedObject = __webpack_require__(30);
var addToUnscopables = __webpack_require__(82);
var Iterators = __webpack_require__(44);
var InternalStateModule = __webpack_require__(42);
var defineIterator = __webpack_require__(75);

var ARRAY_ITERATOR = 'Array Iterator';
var setInternalState = InternalStateModule.set;
var getInternalState = InternalStateModule.getterFor(ARRAY_ITERATOR);

// `Array.prototype.entries` method
// https://tc39.github.io/ecma262/#sec-array.prototype.entries
// `Array.prototype.keys` method
// https://tc39.github.io/ecma262/#sec-array.prototype.keys
// `Array.prototype.values` method
// https://tc39.github.io/ecma262/#sec-array.prototype.values
// `Array.prototype[@@iterator]` method
// https://tc39.github.io/ecma262/#sec-array.prototype-@@iterator
// `CreateArrayIterator` internal method
// https://tc39.github.io/ecma262/#sec-createarrayiterator
module.exports = defineIterator(Array, 'Array', function (iterated, kind) {
  setInternalState(this, {
    type: ARRAY_ITERATOR,
    target: toIndexedObject(iterated), // target
    index: 0,                          // next index
    kind: kind                         // kind
  });
// `%ArrayIteratorPrototype%.next` method
// https://tc39.github.io/ecma262/#sec-%arrayiteratorprototype%.next
}, function () {
  var state = getInternalState(this);
  var target = state.target;
  var kind = state.kind;
  var index = state.index++;
  if (!target || index >= target.length) {
    state.target = undefined;
    return { value: undefined, done: true };
  }
  if (kind == 'keys') return { value: index, done: false };
  if (kind == 'values') return { value: target[index], done: false };
  return { value: [index, target[index]], done: false };
}, 'values');

// argumentsList[@@iterator] is %ArrayProto_values%
// https://tc39.github.io/ecma262/#sec-createunmappedargumentsobject
// https://tc39.github.io/ecma262/#sec-createmappedargumentsobject
Iterators.Arguments = Iterators.Array;

// https://tc39.github.io/ecma262/#sec-array.prototype-@@unscopables
addToUnscopables('keys');
addToUnscopables('values');
addToUnscopables('entries');


/***/ }),
/* 174 */
/***/ (function(module, exports) {

// iterable DOM collections
// flag - `iterable` interface - 'entries', 'keys', 'values', 'forEach' methods
module.exports = {
  CSSRuleList: 0,
  CSSStyleDeclaration: 0,
  CSSValueList: 0,
  ClientRectList: 0,
  DOMRectList: 0,
  DOMStringList: 0,
  DOMTokenList: 1,
  DataTransferItemList: 0,
  FileList: 0,
  HTMLAllCollection: 0,
  HTMLCollection: 0,
  HTMLFormElement: 0,
  HTMLSelectElement: 0,
  MediaList: 0,
  MimeTypeArray: 0,
  NamedNodeMap: 0,
  NodeList: 1,
  PaintRequestList: 0,
  Plugin: 0,
  PluginArray: 0,
  SVGLengthList: 0,
  SVGNumberList: 0,
  SVGPathSegList: 0,
  SVGPointList: 0,
  SVGStringList: 0,
  SVGTransformList: 0,
  SourceBufferList: 0,
  StyleSheetList: 0,
  TextTrackCueList: 0,
  TextTrackList: 0,
  TouchList: 0
};


/***/ }),
/* 175 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var $ = __webpack_require__(5);
var IS_PURE = __webpack_require__(43);
var global = __webpack_require__(8);
var getBuiltIn = __webpack_require__(36);
var NativePromise = __webpack_require__(109);
var redefine = __webpack_require__(53);
var redefineAll = __webpack_require__(110);
var setToStringTag = __webpack_require__(37);
var setSpecies = __webpack_require__(111);
var isObject = __webpack_require__(13);
var aFunction = __webpack_require__(41);
var anInstance = __webpack_require__(83);
var classof = __webpack_require__(34);
var inspectSource = __webpack_require__(102);
var iterate = __webpack_require__(66);
var checkCorrectnessOfIteration = __webpack_require__(115);
var speciesConstructor = __webpack_require__(116);
var task = __webpack_require__(117).set;
var microtask = __webpack_require__(176);
var promiseResolve = __webpack_require__(119);
var hostReportErrors = __webpack_require__(177);
var newPromiseCapabilityModule = __webpack_require__(85);
var perform = __webpack_require__(120);
var InternalStateModule = __webpack_require__(42);
var isForced = __webpack_require__(101);
var wellKnownSymbol = __webpack_require__(10);
var V8_VERSION = __webpack_require__(86);

var SPECIES = wellKnownSymbol('species');
var PROMISE = 'Promise';
var getInternalState = InternalStateModule.get;
var setInternalState = InternalStateModule.set;
var getInternalPromiseState = InternalStateModule.getterFor(PROMISE);
var PromiseConstructor = NativePromise;
var TypeError = global.TypeError;
var document = global.document;
var process = global.process;
var $fetch = getBuiltIn('fetch');
var newPromiseCapability = newPromiseCapabilityModule.f;
var newGenericPromiseCapability = newPromiseCapability;
var IS_NODE = classof(process) == 'process';
var DISPATCH_EVENT = !!(document && document.createEvent && global.dispatchEvent);
var UNHANDLED_REJECTION = 'unhandledrejection';
var REJECTION_HANDLED = 'rejectionhandled';
var PENDING = 0;
var FULFILLED = 1;
var REJECTED = 2;
var HANDLED = 1;
var UNHANDLED = 2;
var Internal, OwnPromiseCapability, PromiseWrapper, nativeThen;

var FORCED = isForced(PROMISE, function () {
  var GLOBAL_CORE_JS_PROMISE = inspectSource(PromiseConstructor) !== String(PromiseConstructor);
  if (!GLOBAL_CORE_JS_PROMISE) {
    // V8 6.6 (Node 10 and Chrome 66) have a bug with resolving custom thenables
    // https://bugs.chromium.org/p/chromium/issues/detail?id=830565
    // We can't detect it synchronously, so just check versions
    if (V8_VERSION === 66) return true;
    // Unhandled rejections tracking support, NodeJS Promise without it fails @@species test
    if (!IS_NODE && typeof PromiseRejectionEvent != 'function') return true;
  }
  // We need Promise#finally in the pure version for preventing prototype pollution
  if (IS_PURE && !PromiseConstructor.prototype['finally']) return true;
  // We can't use @@species feature detection in V8 since it causes
  // deoptimization and performance degradation
  // https://github.com/zloirock/core-js/issues/679
  if (V8_VERSION >= 51 && /native code/.test(PromiseConstructor)) return false;
  // Detect correctness of subclassing with @@species support
  var promise = PromiseConstructor.resolve(1);
  var FakePromise = function (exec) {
    exec(function () { /* empty */ }, function () { /* empty */ });
  };
  var constructor = promise.constructor = {};
  constructor[SPECIES] = FakePromise;
  return !(promise.then(function () { /* empty */ }) instanceof FakePromise);
});

var INCORRECT_ITERATION = FORCED || !checkCorrectnessOfIteration(function (iterable) {
  PromiseConstructor.all(iterable)['catch'](function () { /* empty */ });
});

// helpers
var isThenable = function (it) {
  var then;
  return isObject(it) && typeof (then = it.then) == 'function' ? then : false;
};

var notify = function (promise, state, isReject) {
  if (state.notified) return;
  state.notified = true;
  var chain = state.reactions;
  microtask(function () {
    var value = state.value;
    var ok = state.state == FULFILLED;
    var index = 0;
    // variable length - can't use forEach
    while (chain.length > index) {
      var reaction = chain[index++];
      var handler = ok ? reaction.ok : reaction.fail;
      var resolve = reaction.resolve;
      var reject = reaction.reject;
      var domain = reaction.domain;
      var result, then, exited;
      try {
        if (handler) {
          if (!ok) {
            if (state.rejection === UNHANDLED) onHandleUnhandled(promise, state);
            state.rejection = HANDLED;
          }
          if (handler === true) result = value;
          else {
            if (domain) domain.enter();
            result = handler(value); // can throw
            if (domain) {
              domain.exit();
              exited = true;
            }
          }
          if (result === reaction.promise) {
            reject(TypeError('Promise-chain cycle'));
          } else if (then = isThenable(result)) {
            then.call(result, resolve, reject);
          } else resolve(result);
        } else reject(value);
      } catch (error) {
        if (domain && !exited) domain.exit();
        reject(error);
      }
    }
    state.reactions = [];
    state.notified = false;
    if (isReject && !state.rejection) onUnhandled(promise, state);
  });
};

var dispatchEvent = function (name, promise, reason) {
  var event, handler;
  if (DISPATCH_EVENT) {
    event = document.createEvent('Event');
    event.promise = promise;
    event.reason = reason;
    event.initEvent(name, false, true);
    global.dispatchEvent(event);
  } else event = { promise: promise, reason: reason };
  if (handler = global['on' + name]) handler(event);
  else if (name === UNHANDLED_REJECTION) hostReportErrors('Unhandled promise rejection', reason);
};

var onUnhandled = function (promise, state) {
  task.call(global, function () {
    var value = state.value;
    var IS_UNHANDLED = isUnhandled(state);
    var result;
    if (IS_UNHANDLED) {
      result = perform(function () {
        if (IS_NODE) {
          process.emit('unhandledRejection', value, promise);
        } else dispatchEvent(UNHANDLED_REJECTION, promise, value);
      });
      // Browsers should not trigger `rejectionHandled` event if it was handled here, NodeJS - should
      state.rejection = IS_NODE || isUnhandled(state) ? UNHANDLED : HANDLED;
      if (result.error) throw result.value;
    }
  });
};

var isUnhandled = function (state) {
  return state.rejection !== HANDLED && !state.parent;
};

var onHandleUnhandled = function (promise, state) {
  task.call(global, function () {
    if (IS_NODE) {
      process.emit('rejectionHandled', promise);
    } else dispatchEvent(REJECTION_HANDLED, promise, state.value);
  });
};

var bind = function (fn, promise, state, unwrap) {
  return function (value) {
    fn(promise, state, value, unwrap);
  };
};

var internalReject = function (promise, state, value, unwrap) {
  if (state.done) return;
  state.done = true;
  if (unwrap) state = unwrap;
  state.value = value;
  state.state = REJECTED;
  notify(promise, state, true);
};

var internalResolve = function (promise, state, value, unwrap) {
  if (state.done) return;
  state.done = true;
  if (unwrap) state = unwrap;
  try {
    if (promise === value) throw TypeError("Promise can't be resolved itself");
    var then = isThenable(value);
    if (then) {
      microtask(function () {
        var wrapper = { done: false };
        try {
          then.call(value,
            bind(internalResolve, promise, wrapper, state),
            bind(internalReject, promise, wrapper, state)
          );
        } catch (error) {
          internalReject(promise, wrapper, error, state);
        }
      });
    } else {
      state.value = value;
      state.state = FULFILLED;
      notify(promise, state, false);
    }
  } catch (error) {
    internalReject(promise, { done: false }, error, state);
  }
};

// constructor polyfill
if (FORCED) {
  // 25.4.3.1 Promise(executor)
  PromiseConstructor = function Promise(executor) {
    anInstance(this, PromiseConstructor, PROMISE);
    aFunction(executor);
    Internal.call(this);
    var state = getInternalState(this);
    try {
      executor(bind(internalResolve, this, state), bind(internalReject, this, state));
    } catch (error) {
      internalReject(this, state, error);
    }
  };
  // eslint-disable-next-line no-unused-vars
  Internal = function Promise(executor) {
    setInternalState(this, {
      type: PROMISE,
      done: false,
      notified: false,
      parent: false,
      reactions: [],
      rejection: false,
      state: PENDING,
      value: undefined
    });
  };
  Internal.prototype = redefineAll(PromiseConstructor.prototype, {
    // `Promise.prototype.then` method
    // https://tc39.github.io/ecma262/#sec-promise.prototype.then
    then: function then(onFulfilled, onRejected) {
      var state = getInternalPromiseState(this);
      var reaction = newPromiseCapability(speciesConstructor(this, PromiseConstructor));
      reaction.ok = typeof onFulfilled == 'function' ? onFulfilled : true;
      reaction.fail = typeof onRejected == 'function' && onRejected;
      reaction.domain = IS_NODE ? process.domain : undefined;
      state.parent = true;
      state.reactions.push(reaction);
      if (state.state != PENDING) notify(this, state, false);
      return reaction.promise;
    },
    // `Promise.prototype.catch` method
    // https://tc39.github.io/ecma262/#sec-promise.prototype.catch
    'catch': function (onRejected) {
      return this.then(undefined, onRejected);
    }
  });
  OwnPromiseCapability = function () {
    var promise = new Internal();
    var state = getInternalState(promise);
    this.promise = promise;
    this.resolve = bind(internalResolve, promise, state);
    this.reject = bind(internalReject, promise, state);
  };
  newPromiseCapabilityModule.f = newPromiseCapability = function (C) {
    return C === PromiseConstructor || C === PromiseWrapper
      ? new OwnPromiseCapability(C)
      : newGenericPromiseCapability(C);
  };

  if (!IS_PURE && typeof NativePromise == 'function') {
    nativeThen = NativePromise.prototype.then;

    // wrap native Promise#then for native async functions
    redefine(NativePromise.prototype, 'then', function then(onFulfilled, onRejected) {
      var that = this;
      return new PromiseConstructor(function (resolve, reject) {
        nativeThen.call(that, resolve, reject);
      }).then(onFulfilled, onRejected);
    // https://github.com/zloirock/core-js/issues/640
    }, { unsafe: true });

    // wrap fetch result
    if (typeof $fetch == 'function') $({ global: true, enumerable: true, forced: true }, {
      // eslint-disable-next-line no-unused-vars
      fetch: function fetch(input /* , init */) {
        return promiseResolve(PromiseConstructor, $fetch.apply(global, arguments));
      }
    });
  }
}

$({ global: true, wrap: true, forced: FORCED }, {
  Promise: PromiseConstructor
});

setToStringTag(PromiseConstructor, PROMISE, false, true);
setSpecies(PROMISE);

PromiseWrapper = getBuiltIn(PROMISE);

// statics
$({ target: PROMISE, stat: true, forced: FORCED }, {
  // `Promise.reject` method
  // https://tc39.github.io/ecma262/#sec-promise.reject
  reject: function reject(r) {
    var capability = newPromiseCapability(this);
    capability.reject.call(undefined, r);
    return capability.promise;
  }
});

$({ target: PROMISE, stat: true, forced: IS_PURE || FORCED }, {
  // `Promise.resolve` method
  // https://tc39.github.io/ecma262/#sec-promise.resolve
  resolve: function resolve(x) {
    return promiseResolve(IS_PURE && this === PromiseWrapper ? PromiseConstructor : this, x);
  }
});

$({ target: PROMISE, stat: true, forced: INCORRECT_ITERATION }, {
  // `Promise.all` method
  // https://tc39.github.io/ecma262/#sec-promise.all
  all: function all(iterable) {
    var C = this;
    var capability = newPromiseCapability(C);
    var resolve = capability.resolve;
    var reject = capability.reject;
    var result = perform(function () {
      var $promiseResolve = aFunction(C.resolve);
      var values = [];
      var counter = 0;
      var remaining = 1;
      iterate(iterable, function (promise) {
        var index = counter++;
        var alreadyCalled = false;
        values.push(undefined);
        remaining++;
        $promiseResolve.call(C, promise).then(function (value) {
          if (alreadyCalled) return;
          alreadyCalled = true;
          values[index] = value;
          --remaining || resolve(values);
        }, reject);
      });
      --remaining || resolve(values);
    });
    if (result.error) reject(result.value);
    return capability.promise;
  },
  // `Promise.race` method
  // https://tc39.github.io/ecma262/#sec-promise.race
  race: function race(iterable) {
    var C = this;
    var capability = newPromiseCapability(C);
    var reject = capability.reject;
    var result = perform(function () {
      var $promiseResolve = aFunction(C.resolve);
      iterate(iterable, function (promise) {
        $promiseResolve.call(C, promise).then(capability.resolve, reject);
      });
    });
    if (result.error) reject(result.value);
    return capability.promise;
  }
});


/***/ }),
/* 176 */
/***/ (function(module, exports, __webpack_require__) {

var global = __webpack_require__(8);
var getOwnPropertyDescriptor = __webpack_require__(71).f;
var classof = __webpack_require__(34);
var macrotask = __webpack_require__(117).set;
var IS_IOS = __webpack_require__(118);

var MutationObserver = global.MutationObserver || global.WebKitMutationObserver;
var process = global.process;
var Promise = global.Promise;
var IS_NODE = classof(process) == 'process';
// Node.js 11 shows ExperimentalWarning on getting `queueMicrotask`
var queueMicrotaskDescriptor = getOwnPropertyDescriptor(global, 'queueMicrotask');
var queueMicrotask = queueMicrotaskDescriptor && queueMicrotaskDescriptor.value;

var flush, head, last, notify, toggle, node, promise, then;

// modern engines have queueMicrotask method
if (!queueMicrotask) {
  flush = function () {
    var parent, fn;
    if (IS_NODE && (parent = process.domain)) parent.exit();
    while (head) {
      fn = head.fn;
      head = head.next;
      try {
        fn();
      } catch (error) {
        if (head) notify();
        else last = undefined;
        throw error;
      }
    } last = undefined;
    if (parent) parent.enter();
  };

  // Node.js
  if (IS_NODE) {
    notify = function () {
      process.nextTick(flush);
    };
  // browsers with MutationObserver, except iOS - https://github.com/zloirock/core-js/issues/339
  } else if (MutationObserver && !IS_IOS) {
    toggle = true;
    node = document.createTextNode('');
    new MutationObserver(flush).observe(node, { characterData: true });
    notify = function () {
      node.data = toggle = !toggle;
    };
  // environments with maybe non-completely correct, but existent Promise
  } else if (Promise && Promise.resolve) {
    // Promise.resolve without an argument throws an error in LG WebOS 2
    promise = Promise.resolve(undefined);
    then = promise.then;
    notify = function () {
      then.call(promise, flush);
    };
  // for other environments - macrotask based on:
  // - setImmediate
  // - MessageChannel
  // - window.postMessag
  // - onreadystatechange
  // - setTimeout
  } else {
    notify = function () {
      // strange IE + webpack dev server bug - use .call(global)
      macrotask.call(global, flush);
    };
  }
}

module.exports = queueMicrotask || function (fn) {
  var task = { fn: fn, next: undefined };
  if (last) last.next = task;
  if (!head) {
    head = task;
    notify();
  } last = task;
};


/***/ }),
/* 177 */
/***/ (function(module, exports, __webpack_require__) {

var global = __webpack_require__(8);

module.exports = function (a, b) {
  var console = global.console;
  if (console && console.error) {
    arguments.length === 1 ? console.error(a) : console.error(a, b);
  }
};


/***/ }),
/* 178 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var $ = __webpack_require__(5);
var aFunction = __webpack_require__(41);
var newPromiseCapabilityModule = __webpack_require__(85);
var perform = __webpack_require__(120);
var iterate = __webpack_require__(66);

// `Promise.allSettled` method
// https://github.com/tc39/proposal-promise-allSettled
$({ target: 'Promise', stat: true }, {
  allSettled: function allSettled(iterable) {
    var C = this;
    var capability = newPromiseCapabilityModule.f(C);
    var resolve = capability.resolve;
    var reject = capability.reject;
    var result = perform(function () {
      var promiseResolve = aFunction(C.resolve);
      var values = [];
      var counter = 0;
      var remaining = 1;
      iterate(iterable, function (promise) {
        var index = counter++;
        var alreadyCalled = false;
        values.push(undefined);
        remaining++;
        promiseResolve.call(C, promise).then(function (value) {
          if (alreadyCalled) return;
          alreadyCalled = true;
          values[index] = { status: 'fulfilled', value: value };
          --remaining || resolve(values);
        }, function (e) {
          if (alreadyCalled) return;
          alreadyCalled = true;
          values[index] = { status: 'rejected', reason: e };
          --remaining || resolve(values);
        });
      });
      --remaining || resolve(values);
    });
    if (result.error) reject(result.value);
    return capability.promise;
  }
});


/***/ }),
/* 179 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var $ = __webpack_require__(5);
var IS_PURE = __webpack_require__(43);
var NativePromise = __webpack_require__(109);
var fails = __webpack_require__(11);
var getBuiltIn = __webpack_require__(36);
var speciesConstructor = __webpack_require__(116);
var promiseResolve = __webpack_require__(119);
var redefine = __webpack_require__(53);

// Safari bug https://bugs.webkit.org/show_bug.cgi?id=200829
var NON_GENERIC = !!NativePromise && fails(function () {
  NativePromise.prototype['finally'].call({ then: function () { /* empty */ } }, function () { /* empty */ });
});

// `Promise.prototype.finally` method
// https://tc39.github.io/ecma262/#sec-promise.prototype.finally
$({ target: 'Promise', proto: true, real: true, forced: NON_GENERIC }, {
  'finally': function (onFinally) {
    var C = speciesConstructor(this, getBuiltIn('Promise'));
    var isFunction = typeof onFinally == 'function';
    return this.then(
      isFunction ? function (x) {
        return promiseResolve(C, onFinally()).then(function () { return x; });
      } : onFinally,
      isFunction ? function (e) {
        return promiseResolve(C, onFinally()).then(function () { throw e; });
      } : onFinally
    );
  }
});

// patch native Promise.prototype for native async functions
if (!IS_PURE && typeof NativePromise == 'function' && !NativePromise.prototype['finally']) {
  redefine(NativePromise.prototype, 'finally', getBuiltIn('Promise').prototype['finally']);
}


/***/ }),
/* 180 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(54);
var forEach = __webpack_require__(181);
var classof = __webpack_require__(65);
var ArrayPrototype = Array.prototype;

var DOMIterables = {
  DOMTokenList: true,
  NodeList: true
};

module.exports = function (it) {
  var own = it.forEach;
  return it === ArrayPrototype || (it instanceof Array && own === ArrayPrototype.forEach)
    // eslint-disable-next-line no-prototype-builtins
    || DOMIterables.hasOwnProperty(classof(it)) ? forEach : own;
};


/***/ }),
/* 181 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(182);

module.exports = parent;


/***/ }),
/* 182 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(183);
var entryVirtual = __webpack_require__(15);

module.exports = entryVirtual('Array').forEach;


/***/ }),
/* 183 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var $ = __webpack_require__(5);
var forEach = __webpack_require__(184);

// `Array.prototype.forEach` method
// https://tc39.github.io/ecma262/#sec-array.prototype.foreach
$({ target: 'Array', proto: true, forced: [].forEach != forEach }, {
  forEach: forEach
});


/***/ }),
/* 184 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var $forEach = __webpack_require__(32).forEach;
var arrayMethodIsStrict = __webpack_require__(67);
var arrayMethodUsesToLength = __webpack_require__(22);

var STRICT_METHOD = arrayMethodIsStrict('forEach');
var USES_TO_LENGTH = arrayMethodUsesToLength('forEach');

// `Array.prototype.forEach` method implementation
// https://tc39.github.io/ecma262/#sec-array.prototype.foreach
module.exports = (!STRICT_METHOD || !USES_TO_LENGTH) ? function forEach(callbackfn /* , thisArg */) {
  return $forEach(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
} : [].forEach;


/***/ }),
/* 185 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(186);

module.exports = parent;


/***/ }),
/* 186 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(187);
var path = __webpack_require__(9);

module.exports = path.Array.isArray;


/***/ }),
/* 187 */
/***/ (function(module, exports, __webpack_require__) {

var $ = __webpack_require__(5);
var isArray = __webpack_require__(55);

// `Array.isArray` method
// https://tc39.github.io/ecma262/#sec-array.isarray
$({ target: 'Array', stat: true }, {
  isArray: isArray
});


/***/ }),
/* 188 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(189);

module.exports = parent;


/***/ }),
/* 189 */
/***/ (function(module, exports, __webpack_require__) {

var map = __webpack_require__(190);

var ArrayPrototype = Array.prototype;

module.exports = function (it) {
  var own = it.map;
  return it === ArrayPrototype || (it instanceof Array && own === ArrayPrototype.map) ? map : own;
};


/***/ }),
/* 190 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(191);
var entryVirtual = __webpack_require__(15);

module.exports = entryVirtual('Array').map;


/***/ }),
/* 191 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var $ = __webpack_require__(5);
var $map = __webpack_require__(32).map;
var arrayMethodHasSpeciesSupport = __webpack_require__(56);
var arrayMethodUsesToLength = __webpack_require__(22);

var HAS_SPECIES_SUPPORT = arrayMethodHasSpeciesSupport('map');
// FF49- issue
var USES_TO_LENGTH = arrayMethodUsesToLength('map');

// `Array.prototype.map` method
// https://tc39.github.io/ecma262/#sec-array.prototype.map
// with adding support of @@species
$({ target: 'Array', proto: true, forced: !HAS_SPECIES_SUPPORT || !USES_TO_LENGTH }, {
  map: function map(callbackfn /* , thisArg */) {
    return $map(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
  }
});


/***/ }),
/* 192 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(193);

module.exports = parent;


/***/ }),
/* 193 */
/***/ (function(module, exports, __webpack_require__) {

var trim = __webpack_require__(194);

var StringPrototype = String.prototype;

module.exports = function (it) {
  var own = it.trim;
  return typeof it === 'string' || it === StringPrototype
    || (it instanceof String && own === StringPrototype.trim) ? trim : own;
};


/***/ }),
/* 194 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(195);
var entryVirtual = __webpack_require__(15);

module.exports = entryVirtual('String').trim;


/***/ }),
/* 195 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var $ = __webpack_require__(5);
var $trim = __webpack_require__(90).trim;
var forcedStringTrimMethod = __webpack_require__(196);

// `String.prototype.trim` method
// https://tc39.github.io/ecma262/#sec-string.prototype.trim
$({ target: 'String', proto: true, forced: forcedStringTrimMethod('trim') }, {
  trim: function trim() {
    return $trim(this);
  }
});


/***/ }),
/* 196 */
/***/ (function(module, exports, __webpack_require__) {

var fails = __webpack_require__(11);
var whitespaces = __webpack_require__(68);

var non = '\u200B\u0085\u180E';

// check that a method works with the correct list
// of whitespaces and has a correct name
module.exports = function (METHOD_NAME) {
  return fails(function () {
    return !!whitespaces[METHOD_NAME]() || non[METHOD_NAME]() != non || whitespaces[METHOD_NAME].name !== METHOD_NAME;
  });
};


/***/ }),
/* 197 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(198);

module.exports = parent;


/***/ }),
/* 198 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(199);
__webpack_require__(61);
__webpack_require__(50);
__webpack_require__(54);
var path = __webpack_require__(9);

module.exports = path.Map;


/***/ }),
/* 199 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var collection = __webpack_require__(122);
var collectionStrong = __webpack_require__(124);

// `Map` constructor
// https://tc39.github.io/ecma262/#sec-map-objects
module.exports = collection('Map', function (init) {
  return function Map() { return init(this, arguments.length ? arguments[0] : undefined); };
}, collectionStrong);


/***/ }),
/* 200 */
/***/ (function(module, exports, __webpack_require__) {

var fails = __webpack_require__(11);

module.exports = !fails(function () {
  return Object.isExtensible(Object.preventExtensions({}));
});


/***/ }),
/* 201 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(202);

module.exports = parent;


/***/ }),
/* 202 */
/***/ (function(module, exports, __webpack_require__) {

var indexOf = __webpack_require__(203);

var ArrayPrototype = Array.prototype;

module.exports = function (it) {
  var own = it.indexOf;
  return it === ArrayPrototype || (it instanceof Array && own === ArrayPrototype.indexOf) ? indexOf : own;
};


/***/ }),
/* 203 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(204);
var entryVirtual = __webpack_require__(15);

module.exports = entryVirtual('Array').indexOf;


/***/ }),
/* 204 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var $ = __webpack_require__(5);
var $indexOf = __webpack_require__(78).indexOf;
var arrayMethodIsStrict = __webpack_require__(67);
var arrayMethodUsesToLength = __webpack_require__(22);

var nativeIndexOf = [].indexOf;

var NEGATIVE_ZERO = !!nativeIndexOf && 1 / [1].indexOf(1, -0) < 0;
var STRICT_METHOD = arrayMethodIsStrict('indexOf');
var USES_TO_LENGTH = arrayMethodUsesToLength('indexOf', { ACCESSORS: true, 1: 0 });

// `Array.prototype.indexOf` method
// https://tc39.github.io/ecma262/#sec-array.prototype.indexof
$({ target: 'Array', proto: true, forced: NEGATIVE_ZERO || !STRICT_METHOD || !USES_TO_LENGTH }, {
  indexOf: function indexOf(searchElement /* , fromIndex = 0 */) {
    return NEGATIVE_ZERO
      // convert -0 to +0
      ? nativeIndexOf.apply(this, arguments) || 0
      : $indexOf(this, searchElement, arguments.length > 1 ? arguments[1] : undefined);
  }
});


/***/ }),
/* 205 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(206);

module.exports = parent;


/***/ }),
/* 206 */
/***/ (function(module, exports, __webpack_require__) {

var splice = __webpack_require__(207);

var ArrayPrototype = Array.prototype;

module.exports = function (it) {
  var own = it.splice;
  return it === ArrayPrototype || (it instanceof Array && own === ArrayPrototype.splice) ? splice : own;
};


/***/ }),
/* 207 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(208);
var entryVirtual = __webpack_require__(15);

module.exports = entryVirtual('Array').splice;


/***/ }),
/* 208 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var $ = __webpack_require__(5);
var toAbsoluteIndex = __webpack_require__(79);
var toInteger = __webpack_require__(62);
var toLength = __webpack_require__(35);
var toObject = __webpack_require__(31);
var arraySpeciesCreate = __webpack_require__(88);
var createProperty = __webpack_require__(69);
var arrayMethodHasSpeciesSupport = __webpack_require__(56);
var arrayMethodUsesToLength = __webpack_require__(22);

var HAS_SPECIES_SUPPORT = arrayMethodHasSpeciesSupport('splice');
var USES_TO_LENGTH = arrayMethodUsesToLength('splice', { ACCESSORS: true, 0: 0, 1: 2 });

var max = Math.max;
var min = Math.min;
var MAX_SAFE_INTEGER = 0x1FFFFFFFFFFFFF;
var MAXIMUM_ALLOWED_LENGTH_EXCEEDED = 'Maximum allowed length exceeded';

// `Array.prototype.splice` method
// https://tc39.github.io/ecma262/#sec-array.prototype.splice
// with adding support of @@species
$({ target: 'Array', proto: true, forced: !HAS_SPECIES_SUPPORT || !USES_TO_LENGTH }, {
  splice: function splice(start, deleteCount /* , ...items */) {
    var O = toObject(this);
    var len = toLength(O.length);
    var actualStart = toAbsoluteIndex(start, len);
    var argumentsLength = arguments.length;
    var insertCount, actualDeleteCount, A, k, from, to;
    if (argumentsLength === 0) {
      insertCount = actualDeleteCount = 0;
    } else if (argumentsLength === 1) {
      insertCount = 0;
      actualDeleteCount = len - actualStart;
    } else {
      insertCount = argumentsLength - 2;
      actualDeleteCount = min(max(toInteger(deleteCount), 0), len - actualStart);
    }
    if (len + insertCount - actualDeleteCount > MAX_SAFE_INTEGER) {
      throw TypeError(MAXIMUM_ALLOWED_LENGTH_EXCEEDED);
    }
    A = arraySpeciesCreate(O, actualDeleteCount);
    for (k = 0; k < actualDeleteCount; k++) {
      from = actualStart + k;
      if (from in O) createProperty(A, k, O[from]);
    }
    A.length = actualDeleteCount;
    if (insertCount < actualDeleteCount) {
      for (k = actualStart; k < len - actualDeleteCount; k++) {
        from = k + actualDeleteCount;
        to = k + insertCount;
        if (from in O) O[to] = O[from];
        else delete O[to];
      }
      for (k = len; k > len - actualDeleteCount + insertCount; k--) delete O[k - 1];
    } else if (insertCount > actualDeleteCount) {
      for (k = len - actualDeleteCount; k > actualStart; k--) {
        from = k + actualDeleteCount - 1;
        to = k + insertCount - 1;
        if (from in O) O[to] = O[from];
        else delete O[to];
      }
    }
    for (k = 0; k < insertCount; k++) {
      O[k + actualStart] = arguments[k + 2];
    }
    O.length = len - actualDeleteCount + insertCount;
    return A;
  }
});


/***/ }),
/* 209 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(210);

module.exports = parent;


/***/ }),
/* 210 */
/***/ (function(module, exports, __webpack_require__) {

var filter = __webpack_require__(211);

var ArrayPrototype = Array.prototype;

module.exports = function (it) {
  var own = it.filter;
  return it === ArrayPrototype || (it instanceof Array && own === ArrayPrototype.filter) ? filter : own;
};


/***/ }),
/* 211 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(212);
var entryVirtual = __webpack_require__(15);

module.exports = entryVirtual('Array').filter;


/***/ }),
/* 212 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var $ = __webpack_require__(5);
var $filter = __webpack_require__(32).filter;
var arrayMethodHasSpeciesSupport = __webpack_require__(56);
var arrayMethodUsesToLength = __webpack_require__(22);

var HAS_SPECIES_SUPPORT = arrayMethodHasSpeciesSupport('filter');
// Edge 14- issue
var USES_TO_LENGTH = arrayMethodUsesToLength('filter');

// `Array.prototype.filter` method
// https://tc39.github.io/ecma262/#sec-array.prototype.filter
// with adding support of @@species
$({ target: 'Array', proto: true, forced: !HAS_SPECIES_SUPPORT || !USES_TO_LENGTH }, {
  filter: function filter(callbackfn /* , thisArg */) {
    return $filter(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
  }
});


/***/ }),
/* 213 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(214);

module.exports = parent;


/***/ }),
/* 214 */
/***/ (function(module, exports, __webpack_require__) {

var arrayIncludes = __webpack_require__(215);
var stringIncludes = __webpack_require__(217);

var ArrayPrototype = Array.prototype;
var StringPrototype = String.prototype;

module.exports = function (it) {
  var own = it.includes;
  if (it === ArrayPrototype || (it instanceof Array && own === ArrayPrototype.includes)) return arrayIncludes;
  if (typeof it === 'string' || it === StringPrototype || (it instanceof String && own === StringPrototype.includes)) {
    return stringIncludes;
  } return own;
};


/***/ }),
/* 215 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(216);
var entryVirtual = __webpack_require__(15);

module.exports = entryVirtual('Array').includes;


/***/ }),
/* 216 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var $ = __webpack_require__(5);
var $includes = __webpack_require__(78).includes;
var addToUnscopables = __webpack_require__(82);
var arrayMethodUsesToLength = __webpack_require__(22);

var USES_TO_LENGTH = arrayMethodUsesToLength('indexOf', { ACCESSORS: true, 1: 0 });

// `Array.prototype.includes` method
// https://tc39.github.io/ecma262/#sec-array.prototype.includes
$({ target: 'Array', proto: true, forced: !USES_TO_LENGTH }, {
  includes: function includes(el /* , fromIndex = 0 */) {
    return $includes(this, el, arguments.length > 1 ? arguments[1] : undefined);
  }
});

// https://tc39.github.io/ecma262/#sec-array.prototype-@@unscopables
addToUnscopables('includes');


/***/ }),
/* 217 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(218);
var entryVirtual = __webpack_require__(15);

module.exports = entryVirtual('String').includes;


/***/ }),
/* 218 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var $ = __webpack_require__(5);
var notARegExp = __webpack_require__(219);
var requireObjectCoercible = __webpack_require__(49);
var correctIsRegExpLogic = __webpack_require__(221);

// `String.prototype.includes` method
// https://tc39.github.io/ecma262/#sec-string.prototype.includes
$({ target: 'String', proto: true, forced: !correctIsRegExpLogic('includes') }, {
  includes: function includes(searchString /* , position = 0 */) {
    return !!~String(requireObjectCoercible(this))
      .indexOf(notARegExp(searchString), arguments.length > 1 ? arguments[1] : undefined);
  }
});


/***/ }),
/* 219 */
/***/ (function(module, exports, __webpack_require__) {

var isRegExp = __webpack_require__(220);

module.exports = function (it) {
  if (isRegExp(it)) {
    throw TypeError("The method doesn't accept regular expressions");
  } return it;
};


/***/ }),
/* 220 */
/***/ (function(module, exports, __webpack_require__) {

var isObject = __webpack_require__(13);
var classof = __webpack_require__(34);
var wellKnownSymbol = __webpack_require__(10);

var MATCH = wellKnownSymbol('match');

// `IsRegExp` abstract operation
// https://tc39.github.io/ecma262/#sec-isregexp
module.exports = function (it) {
  var isRegExp;
  return isObject(it) && ((isRegExp = it[MATCH]) !== undefined ? !!isRegExp : classof(it) == 'RegExp');
};


/***/ }),
/* 221 */
/***/ (function(module, exports, __webpack_require__) {

var wellKnownSymbol = __webpack_require__(10);

var MATCH = wellKnownSymbol('match');

module.exports = function (METHOD_NAME) {
  var regexp = /./;
  try {
    '/./'[METHOD_NAME](regexp);
  } catch (e) {
    try {
      regexp[MATCH] = false;
      return '/./'[METHOD_NAME](regexp);
    } catch (f) { /* empty */ }
  } return false;
};


/***/ }),
/* 222 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(223);

module.exports = parent;


/***/ }),
/* 223 */
/***/ (function(module, exports, __webpack_require__) {

var bind = __webpack_require__(224);

var FunctionPrototype = Function.prototype;

module.exports = function (it) {
  var own = it.bind;
  return it === FunctionPrototype || (it instanceof Function && own === FunctionPrototype.bind) ? bind : own;
};


/***/ }),
/* 224 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(225);
var entryVirtual = __webpack_require__(15);

module.exports = entryVirtual('Function').bind;


/***/ }),
/* 225 */
/***/ (function(module, exports, __webpack_require__) {

var $ = __webpack_require__(5);
var bind = __webpack_require__(226);

// `Function.prototype.bind` method
// https://tc39.github.io/ecma262/#sec-function.prototype.bind
$({ target: 'Function', proto: true }, {
  bind: bind
});


/***/ }),
/* 226 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var aFunction = __webpack_require__(41);
var isObject = __webpack_require__(13);

var slice = [].slice;
var factories = {};

var construct = function (C, argsLength, args) {
  if (!(argsLength in factories)) {
    for (var list = [], i = 0; i < argsLength; i++) list[i] = 'a[' + i + ']';
    // eslint-disable-next-line no-new-func
    factories[argsLength] = Function('C,a', 'return new C(' + list.join(',') + ')');
  } return factories[argsLength](C, args);
};

// `Function.prototype.bind` method implementation
// https://tc39.github.io/ecma262/#sec-function.prototype.bind
module.exports = Function.bind || function bind(that /* , ...args */) {
  var fn = aFunction(this);
  var partArgs = slice.call(arguments, 1);
  var boundFunction = function bound(/* args... */) {
    var args = partArgs.concat(slice.call(arguments));
    return this instanceof boundFunction ? construct(fn, args.length, args) : fn.apply(that, args);
  };
  if (isObject(fn.prototype)) boundFunction.prototype = fn.prototype;
  return boundFunction;
};


/***/ }),
/* 227 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(228);

/***/ }),
/* 228 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(229);

module.exports = parent;


/***/ }),
/* 229 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(125);
__webpack_require__(50);
__webpack_require__(54);
var WrappedWellKnownSymbolModule = __webpack_require__(93);

module.exports = WrappedWellKnownSymbolModule.f('iterator');


/***/ }),
/* 230 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(231);

/***/ }),
/* 231 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(232);
__webpack_require__(251);
__webpack_require__(252);
__webpack_require__(253);
__webpack_require__(254);
// TODO: Remove from `core-js@4`
__webpack_require__(255);

module.exports = parent;


/***/ }),
/* 232 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(233);
__webpack_require__(61);
__webpack_require__(234);
__webpack_require__(236);
__webpack_require__(237);
__webpack_require__(238);
__webpack_require__(239);
__webpack_require__(125);
__webpack_require__(240);
__webpack_require__(241);
__webpack_require__(242);
__webpack_require__(243);
__webpack_require__(244);
__webpack_require__(245);
__webpack_require__(246);
__webpack_require__(247);
__webpack_require__(248);
__webpack_require__(249);
__webpack_require__(250);
var path = __webpack_require__(9);

module.exports = path.Symbol;


/***/ }),
/* 233 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var $ = __webpack_require__(5);
var fails = __webpack_require__(11);
var isArray = __webpack_require__(55);
var isObject = __webpack_require__(13);
var toObject = __webpack_require__(31);
var toLength = __webpack_require__(35);
var createProperty = __webpack_require__(69);
var arraySpeciesCreate = __webpack_require__(88);
var arrayMethodHasSpeciesSupport = __webpack_require__(56);
var wellKnownSymbol = __webpack_require__(10);
var V8_VERSION = __webpack_require__(86);

var IS_CONCAT_SPREADABLE = wellKnownSymbol('isConcatSpreadable');
var MAX_SAFE_INTEGER = 0x1FFFFFFFFFFFFF;
var MAXIMUM_ALLOWED_INDEX_EXCEEDED = 'Maximum allowed index exceeded';

// We can't use this feature detection in V8 since it causes
// deoptimization and serious performance degradation
// https://github.com/zloirock/core-js/issues/679
var IS_CONCAT_SPREADABLE_SUPPORT = V8_VERSION >= 51 || !fails(function () {
  var array = [];
  array[IS_CONCAT_SPREADABLE] = false;
  return array.concat()[0] !== array;
});

var SPECIES_SUPPORT = arrayMethodHasSpeciesSupport('concat');

var isConcatSpreadable = function (O) {
  if (!isObject(O)) return false;
  var spreadable = O[IS_CONCAT_SPREADABLE];
  return spreadable !== undefined ? !!spreadable : isArray(O);
};

var FORCED = !IS_CONCAT_SPREADABLE_SUPPORT || !SPECIES_SUPPORT;

// `Array.prototype.concat` method
// https://tc39.github.io/ecma262/#sec-array.prototype.concat
// with adding support of @@isConcatSpreadable and @@species
$({ target: 'Array', proto: true, forced: FORCED }, {
  concat: function concat(arg) { // eslint-disable-line no-unused-vars
    var O = toObject(this);
    var A = arraySpeciesCreate(O, 0);
    var n = 0;
    var i, k, length, len, E;
    for (i = -1, length = arguments.length; i < length; i++) {
      E = i === -1 ? O : arguments[i];
      if (isConcatSpreadable(E)) {
        len = toLength(E.length);
        if (n + len > MAX_SAFE_INTEGER) throw TypeError(MAXIMUM_ALLOWED_INDEX_EXCEEDED);
        for (k = 0; k < len; k++, n++) if (k in E) createProperty(A, n, E[k]);
      } else {
        if (n >= MAX_SAFE_INTEGER) throw TypeError(MAXIMUM_ALLOWED_INDEX_EXCEEDED);
        createProperty(A, n++, E);
      }
    }
    A.length = n;
    return A;
  }
});


/***/ }),
/* 234 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var $ = __webpack_require__(5);
var global = __webpack_require__(8);
var getBuiltIn = __webpack_require__(36);
var IS_PURE = __webpack_require__(43);
var DESCRIPTORS = __webpack_require__(14);
var NATIVE_SYMBOL = __webpack_require__(76);
var USE_SYMBOL_AS_UID = __webpack_require__(106);
var fails = __webpack_require__(11);
var has = __webpack_require__(16);
var isArray = __webpack_require__(55);
var isObject = __webpack_require__(13);
var anObject = __webpack_require__(25);
var toObject = __webpack_require__(31);
var toIndexedObject = __webpack_require__(30);
var toPrimitive = __webpack_require__(60);
var createPropertyDescriptor = __webpack_require__(48);
var nativeObjectCreate = __webpack_require__(77);
var objectKeys = __webpack_require__(52);
var getOwnPropertyNamesModule = __webpack_require__(126);
var getOwnPropertyNamesExternal = __webpack_require__(235);
var getOwnPropertySymbolsModule = __webpack_require__(127);
var getOwnPropertyDescriptorModule = __webpack_require__(71);
var definePropertyModule = __webpack_require__(18);
var propertyIsEnumerableModule = __webpack_require__(59);
var createNonEnumerableProperty = __webpack_require__(19);
var redefine = __webpack_require__(53);
var shared = __webpack_require__(74);
var sharedKey = __webpack_require__(63);
var hiddenKeys = __webpack_require__(51);
var uid = __webpack_require__(64);
var wellKnownSymbol = __webpack_require__(10);
var wrappedWellKnownSymbolModule = __webpack_require__(93);
var defineWellKnownSymbol = __webpack_require__(12);
var setToStringTag = __webpack_require__(37);
var InternalStateModule = __webpack_require__(42);
var $forEach = __webpack_require__(32).forEach;

var HIDDEN = sharedKey('hidden');
var SYMBOL = 'Symbol';
var PROTOTYPE = 'prototype';
var TO_PRIMITIVE = wellKnownSymbol('toPrimitive');
var setInternalState = InternalStateModule.set;
var getInternalState = InternalStateModule.getterFor(SYMBOL);
var ObjectPrototype = Object[PROTOTYPE];
var $Symbol = global.Symbol;
var $stringify = getBuiltIn('JSON', 'stringify');
var nativeGetOwnPropertyDescriptor = getOwnPropertyDescriptorModule.f;
var nativeDefineProperty = definePropertyModule.f;
var nativeGetOwnPropertyNames = getOwnPropertyNamesExternal.f;
var nativePropertyIsEnumerable = propertyIsEnumerableModule.f;
var AllSymbols = shared('symbols');
var ObjectPrototypeSymbols = shared('op-symbols');
var StringToSymbolRegistry = shared('string-to-symbol-registry');
var SymbolToStringRegistry = shared('symbol-to-string-registry');
var WellKnownSymbolsStore = shared('wks');
var QObject = global.QObject;
// Don't use setters in Qt Script, https://github.com/zloirock/core-js/issues/173
var USE_SETTER = !QObject || !QObject[PROTOTYPE] || !QObject[PROTOTYPE].findChild;

// fallback for old Android, https://code.google.com/p/v8/issues/detail?id=687
var setSymbolDescriptor = DESCRIPTORS && fails(function () {
  return nativeObjectCreate(nativeDefineProperty({}, 'a', {
    get: function () { return nativeDefineProperty(this, 'a', { value: 7 }).a; }
  })).a != 7;
}) ? function (O, P, Attributes) {
  var ObjectPrototypeDescriptor = nativeGetOwnPropertyDescriptor(ObjectPrototype, P);
  if (ObjectPrototypeDescriptor) delete ObjectPrototype[P];
  nativeDefineProperty(O, P, Attributes);
  if (ObjectPrototypeDescriptor && O !== ObjectPrototype) {
    nativeDefineProperty(ObjectPrototype, P, ObjectPrototypeDescriptor);
  }
} : nativeDefineProperty;

var wrap = function (tag, description) {
  var symbol = AllSymbols[tag] = nativeObjectCreate($Symbol[PROTOTYPE]);
  setInternalState(symbol, {
    type: SYMBOL,
    tag: tag,
    description: description
  });
  if (!DESCRIPTORS) symbol.description = description;
  return symbol;
};

var isSymbol = USE_SYMBOL_AS_UID ? function (it) {
  return typeof it == 'symbol';
} : function (it) {
  return Object(it) instanceof $Symbol;
};

var $defineProperty = function defineProperty(O, P, Attributes) {
  if (O === ObjectPrototype) $defineProperty(ObjectPrototypeSymbols, P, Attributes);
  anObject(O);
  var key = toPrimitive(P, true);
  anObject(Attributes);
  if (has(AllSymbols, key)) {
    if (!Attributes.enumerable) {
      if (!has(O, HIDDEN)) nativeDefineProperty(O, HIDDEN, createPropertyDescriptor(1, {}));
      O[HIDDEN][key] = true;
    } else {
      if (has(O, HIDDEN) && O[HIDDEN][key]) O[HIDDEN][key] = false;
      Attributes = nativeObjectCreate(Attributes, { enumerable: createPropertyDescriptor(0, false) });
    } return setSymbolDescriptor(O, key, Attributes);
  } return nativeDefineProperty(O, key, Attributes);
};

var $defineProperties = function defineProperties(O, Properties) {
  anObject(O);
  var properties = toIndexedObject(Properties);
  var keys = objectKeys(properties).concat($getOwnPropertySymbols(properties));
  $forEach(keys, function (key) {
    if (!DESCRIPTORS || $propertyIsEnumerable.call(properties, key)) $defineProperty(O, key, properties[key]);
  });
  return O;
};

var $create = function create(O, Properties) {
  return Properties === undefined ? nativeObjectCreate(O) : $defineProperties(nativeObjectCreate(O), Properties);
};

var $propertyIsEnumerable = function propertyIsEnumerable(V) {
  var P = toPrimitive(V, true);
  var enumerable = nativePropertyIsEnumerable.call(this, P);
  if (this === ObjectPrototype && has(AllSymbols, P) && !has(ObjectPrototypeSymbols, P)) return false;
  return enumerable || !has(this, P) || !has(AllSymbols, P) || has(this, HIDDEN) && this[HIDDEN][P] ? enumerable : true;
};

var $getOwnPropertyDescriptor = function getOwnPropertyDescriptor(O, P) {
  var it = toIndexedObject(O);
  var key = toPrimitive(P, true);
  if (it === ObjectPrototype && has(AllSymbols, key) && !has(ObjectPrototypeSymbols, key)) return;
  var descriptor = nativeGetOwnPropertyDescriptor(it, key);
  if (descriptor && has(AllSymbols, key) && !(has(it, HIDDEN) && it[HIDDEN][key])) {
    descriptor.enumerable = true;
  }
  return descriptor;
};

var $getOwnPropertyNames = function getOwnPropertyNames(O) {
  var names = nativeGetOwnPropertyNames(toIndexedObject(O));
  var result = [];
  $forEach(names, function (key) {
    if (!has(AllSymbols, key) && !has(hiddenKeys, key)) result.push(key);
  });
  return result;
};

var $getOwnPropertySymbols = function getOwnPropertySymbols(O) {
  var IS_OBJECT_PROTOTYPE = O === ObjectPrototype;
  var names = nativeGetOwnPropertyNames(IS_OBJECT_PROTOTYPE ? ObjectPrototypeSymbols : toIndexedObject(O));
  var result = [];
  $forEach(names, function (key) {
    if (has(AllSymbols, key) && (!IS_OBJECT_PROTOTYPE || has(ObjectPrototype, key))) {
      result.push(AllSymbols[key]);
    }
  });
  return result;
};

// `Symbol` constructor
// https://tc39.github.io/ecma262/#sec-symbol-constructor
if (!NATIVE_SYMBOL) {
  $Symbol = function Symbol() {
    if (this instanceof $Symbol) throw TypeError('Symbol is not a constructor');
    var description = !arguments.length || arguments[0] === undefined ? undefined : String(arguments[0]);
    var tag = uid(description);
    var setter = function (value) {
      if (this === ObjectPrototype) setter.call(ObjectPrototypeSymbols, value);
      if (has(this, HIDDEN) && has(this[HIDDEN], tag)) this[HIDDEN][tag] = false;
      setSymbolDescriptor(this, tag, createPropertyDescriptor(1, value));
    };
    if (DESCRIPTORS && USE_SETTER) setSymbolDescriptor(ObjectPrototype, tag, { configurable: true, set: setter });
    return wrap(tag, description);
  };

  redefine($Symbol[PROTOTYPE], 'toString', function toString() {
    return getInternalState(this).tag;
  });

  redefine($Symbol, 'withoutSetter', function (description) {
    return wrap(uid(description), description);
  });

  propertyIsEnumerableModule.f = $propertyIsEnumerable;
  definePropertyModule.f = $defineProperty;
  getOwnPropertyDescriptorModule.f = $getOwnPropertyDescriptor;
  getOwnPropertyNamesModule.f = getOwnPropertyNamesExternal.f = $getOwnPropertyNames;
  getOwnPropertySymbolsModule.f = $getOwnPropertySymbols;

  wrappedWellKnownSymbolModule.f = function (name) {
    return wrap(wellKnownSymbol(name), name);
  };

  if (DESCRIPTORS) {
    // https://github.com/tc39/proposal-Symbol-description
    nativeDefineProperty($Symbol[PROTOTYPE], 'description', {
      configurable: true,
      get: function description() {
        return getInternalState(this).description;
      }
    });
    if (!IS_PURE) {
      redefine(ObjectPrototype, 'propertyIsEnumerable', $propertyIsEnumerable, { unsafe: true });
    }
  }
}

$({ global: true, wrap: true, forced: !NATIVE_SYMBOL, sham: !NATIVE_SYMBOL }, {
  Symbol: $Symbol
});

$forEach(objectKeys(WellKnownSymbolsStore), function (name) {
  defineWellKnownSymbol(name);
});

$({ target: SYMBOL, stat: true, forced: !NATIVE_SYMBOL }, {
  // `Symbol.for` method
  // https://tc39.github.io/ecma262/#sec-symbol.for
  'for': function (key) {
    var string = String(key);
    if (has(StringToSymbolRegistry, string)) return StringToSymbolRegistry[string];
    var symbol = $Symbol(string);
    StringToSymbolRegistry[string] = symbol;
    SymbolToStringRegistry[symbol] = string;
    return symbol;
  },
  // `Symbol.keyFor` method
  // https://tc39.github.io/ecma262/#sec-symbol.keyfor
  keyFor: function keyFor(sym) {
    if (!isSymbol(sym)) throw TypeError(sym + ' is not a symbol');
    if (has(SymbolToStringRegistry, sym)) return SymbolToStringRegistry[sym];
  },
  useSetter: function () { USE_SETTER = true; },
  useSimple: function () { USE_SETTER = false; }
});

$({ target: 'Object', stat: true, forced: !NATIVE_SYMBOL, sham: !DESCRIPTORS }, {
  // `Object.create` method
  // https://tc39.github.io/ecma262/#sec-object.create
  create: $create,
  // `Object.defineProperty` method
  // https://tc39.github.io/ecma262/#sec-object.defineproperty
  defineProperty: $defineProperty,
  // `Object.defineProperties` method
  // https://tc39.github.io/ecma262/#sec-object.defineproperties
  defineProperties: $defineProperties,
  // `Object.getOwnPropertyDescriptor` method
  // https://tc39.github.io/ecma262/#sec-object.getownpropertydescriptors
  getOwnPropertyDescriptor: $getOwnPropertyDescriptor
});

$({ target: 'Object', stat: true, forced: !NATIVE_SYMBOL }, {
  // `Object.getOwnPropertyNames` method
  // https://tc39.github.io/ecma262/#sec-object.getownpropertynames
  getOwnPropertyNames: $getOwnPropertyNames,
  // `Object.getOwnPropertySymbols` method
  // https://tc39.github.io/ecma262/#sec-object.getownpropertysymbols
  getOwnPropertySymbols: $getOwnPropertySymbols
});

// Chrome 38 and 39 `Object.getOwnPropertySymbols` fails on primitives
// https://bugs.chromium.org/p/v8/issues/detail?id=3443
$({ target: 'Object', stat: true, forced: fails(function () { getOwnPropertySymbolsModule.f(1); }) }, {
  getOwnPropertySymbols: function getOwnPropertySymbols(it) {
    return getOwnPropertySymbolsModule.f(toObject(it));
  }
});

// `JSON.stringify` method behavior with symbols
// https://tc39.github.io/ecma262/#sec-json.stringify
if ($stringify) {
  var FORCED_JSON_STRINGIFY = !NATIVE_SYMBOL || fails(function () {
    var symbol = $Symbol();
    // MS Edge converts symbol values to JSON as {}
    return $stringify([symbol]) != '[null]'
      // WebKit converts symbol values to JSON as null
      || $stringify({ a: symbol }) != '{}'
      // V8 throws on boxed symbols
      || $stringify(Object(symbol)) != '{}';
  });

  $({ target: 'JSON', stat: true, forced: FORCED_JSON_STRINGIFY }, {
    // eslint-disable-next-line no-unused-vars
    stringify: function stringify(it, replacer, space) {
      var args = [it];
      var index = 1;
      var $replacer;
      while (arguments.length > index) args.push(arguments[index++]);
      $replacer = replacer;
      if (!isObject(replacer) && it === undefined || isSymbol(it)) return; // IE8 returns string on undefined
      if (!isArray(replacer)) replacer = function (key, value) {
        if (typeof $replacer == 'function') value = $replacer.call(this, key, value);
        if (!isSymbol(value)) return value;
      };
      args[1] = replacer;
      return $stringify.apply(null, args);
    }
  });
}

// `Symbol.prototype[@@toPrimitive]` method
// https://tc39.github.io/ecma262/#sec-symbol.prototype-@@toprimitive
if (!$Symbol[PROTOTYPE][TO_PRIMITIVE]) {
  createNonEnumerableProperty($Symbol[PROTOTYPE], TO_PRIMITIVE, $Symbol[PROTOTYPE].valueOf);
}
// `Symbol.prototype[@@toStringTag]` property
// https://tc39.github.io/ecma262/#sec-symbol.prototype-@@tostringtag
setToStringTag($Symbol, SYMBOL);

hiddenKeys[HIDDEN] = true;


/***/ }),
/* 235 */
/***/ (function(module, exports, __webpack_require__) {

var toIndexedObject = __webpack_require__(30);
var nativeGetOwnPropertyNames = __webpack_require__(126).f;

var toString = {}.toString;

var windowNames = typeof window == 'object' && window && Object.getOwnPropertyNames
  ? Object.getOwnPropertyNames(window) : [];

var getWindowNames = function (it) {
  try {
    return nativeGetOwnPropertyNames(it);
  } catch (error) {
    return windowNames.slice();
  }
};

// fallback for IE11 buggy Object.getOwnPropertyNames with iframe and window
module.exports.f = function getOwnPropertyNames(it) {
  return windowNames && toString.call(it) == '[object Window]'
    ? getWindowNames(it)
    : nativeGetOwnPropertyNames(toIndexedObject(it));
};


/***/ }),
/* 236 */
/***/ (function(module, exports, __webpack_require__) {

var defineWellKnownSymbol = __webpack_require__(12);

// `Symbol.asyncIterator` well-known symbol
// https://tc39.github.io/ecma262/#sec-symbol.asynciterator
defineWellKnownSymbol('asyncIterator');


/***/ }),
/* 237 */
/***/ (function(module, exports) {

// empty


/***/ }),
/* 238 */
/***/ (function(module, exports, __webpack_require__) {

var defineWellKnownSymbol = __webpack_require__(12);

// `Symbol.hasInstance` well-known symbol
// https://tc39.github.io/ecma262/#sec-symbol.hasinstance
defineWellKnownSymbol('hasInstance');


/***/ }),
/* 239 */
/***/ (function(module, exports, __webpack_require__) {

var defineWellKnownSymbol = __webpack_require__(12);

// `Symbol.isConcatSpreadable` well-known symbol
// https://tc39.github.io/ecma262/#sec-symbol.isconcatspreadable
defineWellKnownSymbol('isConcatSpreadable');


/***/ }),
/* 240 */
/***/ (function(module, exports, __webpack_require__) {

var defineWellKnownSymbol = __webpack_require__(12);

// `Symbol.match` well-known symbol
// https://tc39.github.io/ecma262/#sec-symbol.match
defineWellKnownSymbol('match');


/***/ }),
/* 241 */
/***/ (function(module, exports, __webpack_require__) {

var defineWellKnownSymbol = __webpack_require__(12);

// `Symbol.matchAll` well-known symbol
defineWellKnownSymbol('matchAll');


/***/ }),
/* 242 */
/***/ (function(module, exports, __webpack_require__) {

var defineWellKnownSymbol = __webpack_require__(12);

// `Symbol.replace` well-known symbol
// https://tc39.github.io/ecma262/#sec-symbol.replace
defineWellKnownSymbol('replace');


/***/ }),
/* 243 */
/***/ (function(module, exports, __webpack_require__) {

var defineWellKnownSymbol = __webpack_require__(12);

// `Symbol.search` well-known symbol
// https://tc39.github.io/ecma262/#sec-symbol.search
defineWellKnownSymbol('search');


/***/ }),
/* 244 */
/***/ (function(module, exports, __webpack_require__) {

var defineWellKnownSymbol = __webpack_require__(12);

// `Symbol.species` well-known symbol
// https://tc39.github.io/ecma262/#sec-symbol.species
defineWellKnownSymbol('species');


/***/ }),
/* 245 */
/***/ (function(module, exports, __webpack_require__) {

var defineWellKnownSymbol = __webpack_require__(12);

// `Symbol.split` well-known symbol
// https://tc39.github.io/ecma262/#sec-symbol.split
defineWellKnownSymbol('split');


/***/ }),
/* 246 */
/***/ (function(module, exports, __webpack_require__) {

var defineWellKnownSymbol = __webpack_require__(12);

// `Symbol.toPrimitive` well-known symbol
// https://tc39.github.io/ecma262/#sec-symbol.toprimitive
defineWellKnownSymbol('toPrimitive');


/***/ }),
/* 247 */
/***/ (function(module, exports, __webpack_require__) {

var defineWellKnownSymbol = __webpack_require__(12);

// `Symbol.toStringTag` well-known symbol
// https://tc39.github.io/ecma262/#sec-symbol.tostringtag
defineWellKnownSymbol('toStringTag');


/***/ }),
/* 248 */
/***/ (function(module, exports, __webpack_require__) {

var defineWellKnownSymbol = __webpack_require__(12);

// `Symbol.unscopables` well-known symbol
// https://tc39.github.io/ecma262/#sec-symbol.unscopables
defineWellKnownSymbol('unscopables');


/***/ }),
/* 249 */
/***/ (function(module, exports, __webpack_require__) {

var setToStringTag = __webpack_require__(37);

// Math[@@toStringTag] property
// https://tc39.github.io/ecma262/#sec-math-@@tostringtag
setToStringTag(Math, 'Math', true);


/***/ }),
/* 250 */
/***/ (function(module, exports, __webpack_require__) {

var global = __webpack_require__(8);
var setToStringTag = __webpack_require__(37);

// JSON[@@toStringTag] property
// https://tc39.github.io/ecma262/#sec-json-@@tostringtag
setToStringTag(global.JSON, 'JSON', true);


/***/ }),
/* 251 */
/***/ (function(module, exports, __webpack_require__) {

var defineWellKnownSymbol = __webpack_require__(12);

// `Symbol.asyncDispose` well-known symbol
// https://github.com/tc39/proposal-using-statement
defineWellKnownSymbol('asyncDispose');


/***/ }),
/* 252 */
/***/ (function(module, exports, __webpack_require__) {

var defineWellKnownSymbol = __webpack_require__(12);

// `Symbol.dispose` well-known symbol
// https://github.com/tc39/proposal-using-statement
defineWellKnownSymbol('dispose');


/***/ }),
/* 253 */
/***/ (function(module, exports, __webpack_require__) {

var defineWellKnownSymbol = __webpack_require__(12);

// `Symbol.observable` well-known symbol
// https://github.com/tc39/proposal-observable
defineWellKnownSymbol('observable');


/***/ }),
/* 254 */
/***/ (function(module, exports, __webpack_require__) {

var defineWellKnownSymbol = __webpack_require__(12);

// `Symbol.patternMatch` well-known symbol
// https://github.com/tc39/proposal-pattern-matching
defineWellKnownSymbol('patternMatch');


/***/ }),
/* 255 */
/***/ (function(module, exports, __webpack_require__) {

// TODO: remove from `core-js@4`
var defineWellKnownSymbol = __webpack_require__(12);

defineWellKnownSymbol('replaceAll');


/***/ }),
/* 256 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(257);

/***/ }),
/* 257 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(258);

module.exports = parent;


/***/ }),
/* 258 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(259);
var path = __webpack_require__(9);

module.exports = path.parseInt;


/***/ }),
/* 259 */
/***/ (function(module, exports, __webpack_require__) {

var $ = __webpack_require__(5);
var parseIntImplementation = __webpack_require__(260);

// `parseInt` method
// https://tc39.github.io/ecma262/#sec-parseint-string-radix
$({ global: true, forced: parseInt != parseIntImplementation }, {
  parseInt: parseIntImplementation
});


/***/ }),
/* 260 */
/***/ (function(module, exports, __webpack_require__) {

var global = __webpack_require__(8);
var trim = __webpack_require__(90).trim;
var whitespaces = __webpack_require__(68);

var $parseInt = global.parseInt;
var hex = /^[+-]?0[Xx]/;
var FORCED = $parseInt(whitespaces + '08') !== 8 || $parseInt(whitespaces + '0x16') !== 22;

// `parseInt` method
// https://tc39.github.io/ecma262/#sec-parseint-string-radix
module.exports = FORCED ? function parseInt(string, radix) {
  var S = trim(String(string));
  return $parseInt(S, (radix >>> 0) || (hex.test(S) ? 16 : 10));
} : $parseInt;


/***/ }),
/* 261 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(262);

module.exports = parent;


/***/ }),
/* 262 */
/***/ (function(module, exports, __webpack_require__) {

var slice = __webpack_require__(263);

var ArrayPrototype = Array.prototype;

module.exports = function (it) {
  var own = it.slice;
  return it === ArrayPrototype || (it instanceof Array && own === ArrayPrototype.slice) ? slice : own;
};


/***/ }),
/* 263 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(264);
var entryVirtual = __webpack_require__(15);

module.exports = entryVirtual('Array').slice;


/***/ }),
/* 264 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var $ = __webpack_require__(5);
var isObject = __webpack_require__(13);
var isArray = __webpack_require__(55);
var toAbsoluteIndex = __webpack_require__(79);
var toLength = __webpack_require__(35);
var toIndexedObject = __webpack_require__(30);
var createProperty = __webpack_require__(69);
var wellKnownSymbol = __webpack_require__(10);
var arrayMethodHasSpeciesSupport = __webpack_require__(56);
var arrayMethodUsesToLength = __webpack_require__(22);

var HAS_SPECIES_SUPPORT = arrayMethodHasSpeciesSupport('slice');
var USES_TO_LENGTH = arrayMethodUsesToLength('slice', { ACCESSORS: true, 0: 0, 1: 2 });

var SPECIES = wellKnownSymbol('species');
var nativeSlice = [].slice;
var max = Math.max;

// `Array.prototype.slice` method
// https://tc39.github.io/ecma262/#sec-array.prototype.slice
// fallback for not array-like ES3 strings and DOM objects
$({ target: 'Array', proto: true, forced: !HAS_SPECIES_SUPPORT || !USES_TO_LENGTH }, {
  slice: function slice(start, end) {
    var O = toIndexedObject(this);
    var length = toLength(O.length);
    var k = toAbsoluteIndex(start, length);
    var fin = toAbsoluteIndex(end === undefined ? length : end, length);
    // inline `ArraySpeciesCreate` for usage native `Array#slice` where it's possible
    var Constructor, result, n;
    if (isArray(O)) {
      Constructor = O.constructor;
      // cross-realm fallback
      if (typeof Constructor == 'function' && (Constructor === Array || isArray(Constructor.prototype))) {
        Constructor = undefined;
      } else if (isObject(Constructor)) {
        Constructor = Constructor[SPECIES];
        if (Constructor === null) Constructor = undefined;
      }
      if (Constructor === Array || Constructor === undefined) {
        return nativeSlice.call(O, k, fin);
      }
    }
    result = new (Constructor === undefined ? Array : Constructor)(max(fin - k, 0));
    for (n = 0; k < fin; k++, n++) if (k in O) createProperty(result, n, O[k]);
    result.length = n;
    return result;
  }
});


/***/ }),
/* 265 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(266);
var path = __webpack_require__(9);

module.exports = path.setTimeout;


/***/ }),
/* 266 */
/***/ (function(module, exports, __webpack_require__) {

var $ = __webpack_require__(5);
var global = __webpack_require__(8);
var userAgent = __webpack_require__(84);

var slice = [].slice;
var MSIE = /MSIE .\./.test(userAgent); // <- dirty ie9- check

var wrap = function (scheduler) {
  return function (handler, timeout /* , ...arguments */) {
    var boundArgs = arguments.length > 2;
    var args = boundArgs ? slice.call(arguments, 2) : undefined;
    return scheduler(boundArgs ? function () {
      // eslint-disable-next-line no-new-func
      (typeof handler == 'function' ? handler : Function(handler)).apply(this, args);
    } : handler, timeout);
  };
};

// ie9- setTimeout & setInterval additional parameters fix
// https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#timers
$({ global: true, bind: true, forced: MSIE }, {
  // `setTimeout` method
  // https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#dom-settimeout
  setTimeout: wrap(global.setTimeout),
  // `setInterval` method
  // https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#dom-setinterval
  setInterval: wrap(global.setInterval)
});


/***/ }),
/* 267 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 编辑器配置
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _assign = _interopRequireDefault(__webpack_require__(128));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var menus_1 = tslib_1.__importDefault(__webpack_require__(272));

var events_1 = tslib_1.__importDefault(__webpack_require__(273));

var style_1 = tslib_1.__importDefault(__webpack_require__(129));

var paste_1 = tslib_1.__importDefault(__webpack_require__(274));

var cmd_1 = tslib_1.__importDefault(__webpack_require__(275));

var image_1 = tslib_1.__importDefault(__webpack_require__(276));

var text_1 = tslib_1.__importDefault(__webpack_require__(130));

var lang_1 = tslib_1.__importDefault(__webpack_require__(277));

var history_1 = tslib_1.__importDefault(__webpack_require__(278));

var video_1 = tslib_1.__importDefault(__webpack_require__(279)); // 合并所有的配置信息


var defaultConfig = (0, _assign["default"])({}, menus_1["default"], events_1["default"], style_1["default"], cmd_1["default"], paste_1["default"], image_1["default"], text_1["default"], lang_1["default"], history_1["default"], video_1["default"], //链接校验的配置函数
{
  linkCheck: function linkCheck(text, link) {
    return true;
  }
});
exports["default"] = defaultConfig;

/***/ }),
/* 268 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(269);

module.exports = parent;


/***/ }),
/* 269 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(270);
var path = __webpack_require__(9);

module.exports = path.Object.assign;


/***/ }),
/* 270 */
/***/ (function(module, exports, __webpack_require__) {

var $ = __webpack_require__(5);
var assign = __webpack_require__(271);

// `Object.assign` method
// https://tc39.github.io/ecma262/#sec-object.assign
$({ target: 'Object', stat: true, forced: Object.assign !== assign }, {
  assign: assign
});


/***/ }),
/* 271 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var DESCRIPTORS = __webpack_require__(14);
var fails = __webpack_require__(11);
var objectKeys = __webpack_require__(52);
var getOwnPropertySymbolsModule = __webpack_require__(127);
var propertyIsEnumerableModule = __webpack_require__(59);
var toObject = __webpack_require__(31);
var IndexedObject = __webpack_require__(72);

var nativeAssign = Object.assign;
var defineProperty = Object.defineProperty;

// `Object.assign` method
// https://tc39.github.io/ecma262/#sec-object.assign
module.exports = !nativeAssign || fails(function () {
  // should have correct order of operations (Edge bug)
  if (DESCRIPTORS && nativeAssign({ b: 1 }, nativeAssign(defineProperty({}, 'a', {
    enumerable: true,
    get: function () {
      defineProperty(this, 'b', {
        value: 3,
        enumerable: false
      });
    }
  }), { b: 2 })).b !== 1) return true;
  // should work with symbols and should have deterministic property order (V8 bug)
  var A = {};
  var B = {};
  // eslint-disable-next-line no-undef
  var symbol = Symbol();
  var alphabet = 'abcdefghijklmnopqrst';
  A[symbol] = 7;
  alphabet.split('').forEach(function (chr) { B[chr] = chr; });
  return nativeAssign({}, A)[symbol] != 7 || objectKeys(nativeAssign({}, B)).join('') != alphabet;
}) ? function assign(target, source) { // eslint-disable-line no-unused-vars
  var T = toObject(target);
  var argumentsLength = arguments.length;
  var index = 1;
  var getOwnPropertySymbols = getOwnPropertySymbolsModule.f;
  var propertyIsEnumerable = propertyIsEnumerableModule.f;
  while (argumentsLength > index) {
    var S = IndexedObject(arguments[index++]);
    var keys = getOwnPropertySymbols ? objectKeys(S).concat(getOwnPropertySymbols(S)) : objectKeys(S);
    var length = keys.length;
    var j = 0;
    var key;
    while (length > j) {
      key = keys[j++];
      if (!DESCRIPTORS || propertyIsEnumerable.call(S, key)) T[key] = S[key];
    }
  } return T;
} : nativeAssign;


/***/ }),
/* 272 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 菜单配置
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
/*表情菜单数据结构类型END*/

exports["default"] = {
  menus: ['head', 'bold', 'fontSize', // 'customFontSize',
  'fontName', 'italic', 'underline', 'strikeThrough', 'indent', 'lineHeight', 'foreColor', 'backColor', 'link', 'list', 'todo', 'justify', 'quote', 'emoticon', 'image', 'video', 'table', 'code', 'splitLine', 'undo', 'redo'],
  fontNames: ['黑体', '仿宋', '楷体', '标楷体', '华文仿宋', '华文楷体', '宋体', '微软雅黑', 'Arial', 'Tahoma', 'Verdana', 'Times New Roman', 'Courier New'],
  //  fontNames: [{ name: '宋体', value: '宋体' }],
  fontSizes: {
    'x-small': {
      name: '10px',
      value: '1'
    },
    small: {
      name: '13px',
      value: '2'
    },
    normal: {
      name: '16px',
      value: '3'
    },
    large: {
      name: '18px',
      value: '4'
    },
    'x-large': {
      name: '24px',
      value: '5'
    },
    'xx-large': {
      name: '32px',
      value: '6'
    },
    'xxx-large': {
      name: '48px',
      value: '7'
    }
  },
  // customFontSize: [ // 该菜单暂时不用 - 王福朋 20200924
  //     { value: '9px', text: '9' },
  //     { value: '10px', text: '10' },
  //     { value: '12px', text: '12' },
  //     { value: '14px', text: '14' },
  //     { value: '16px', text: '16' },
  //     { value: '20px', text: '20' },
  //     { value: '42px', text: '42' },
  //     { value: '72px', text: '72' },
  // ],
  colors: ['#000000', '#ffffff', '#eeece0', '#1c487f', '#4d80bf', '#c24f4a', '#8baa4a', '#7b5ba1', '#46acc8', '#f9963b'],
  //插入代码语言配置
  languageType: ['Bash', 'C', 'C#', 'C++', 'CSS', 'Java', 'JavaScript', 'JSON', 'TypeScript', 'Plain text', 'Html', 'XML', 'SQL', 'Go', 'Kotlin', 'Lua', 'Markdown', 'PHP', 'Python', 'Shell Session', 'Ruby'],
  languageTab: '　　　　',

  /**
   * 表情配置菜单
   * 如果为emoji表情直接作为元素插入
   * emoticon:Array<EmotionsType>
   */
  emotions: [{
    // tab 的标题
    title: '表情',
    // type -> 'emoji' / 'image'
    type: 'emoji',
    // content -> 数组
    content: '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 😘 😗 😙 😚 😋 😛 😝 😜 🤓 😎 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 😢 😭 😤 😠 😡 😳 😱 😨 🤗 🤔 😶 😑 😬 🙄 😯 😴 😷 🤑 😈 🤡 💩 👻 💀 👀 👣'.split(/\s/)
  }, {
    // tab 的标题
    title: '手势',
    // type -> 'emoji' / 'image'
    type: 'emoji',
    // content -> 数组
    content: '👐 🙌 👏 🤝 👍 👎 👊 ✊ 🤛 🤜 🤞 ✌️ 🤘 👌 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐 🖖 👋 🤙 💪 🖕 ✍️ 🙏'.split(/\s/)
  }],
  lineHeights: ['1', '1.15', '1.6', '2', '2.5', '3'],
  undoLimit: 20,
  indentation: '2em',
  showMenuTooltips: true,
  // 菜单栏tooltip为上标还是下标
  menuTooltipPosition: 'up'
};

/***/ }),
/* 273 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 事件配置
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var const_1 = __webpack_require__(7);
/**
 * 提示信息
 * @param alertInfo alert info
 * @param alertType 错误提示类型
 * @param debugInfo debug info
 */


function customAlert(alertInfo, alertType, debugInfo) {
  window.alert(alertInfo);

  if (debugInfo) {
    console.error('wangEditor: ' + debugInfo);
  }
}

exports["default"] = {
  onchangeTimeout: 200,
  onchange: null,
  onfocus: const_1.EMPTY_FN,
  onblur: const_1.EMPTY_FN,
  onCatalogChange: null,
  customAlert: customAlert
};

/***/ }),
/* 274 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 粘贴，配置文件
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports["default"] = {
  // 粘贴过滤样式，默认开启
  pasteFilterStyle: true,
  // 粘贴内容时，忽略图片。默认关闭
  pasteIgnoreImg: false,
  // 对粘贴的文字进行自定义处理，返回处理后的结果。编辑器会将处理后的结果粘贴到编辑区域中。
  // IE 暂时不支持
  pasteTextHandle: function pasteTextHandle(content) {
    // content 即粘贴过来的内容（html 或 纯文本），可进行自定义处理然后返回
    return content;
  }
};

/***/ }),
/* 275 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 命令配置项
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports["default"] = {
  styleWithCSS: false
};

/***/ }),
/* 276 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 图片相关的配置
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var const_1 = __webpack_require__(7);

exports["default"] = {
  // 网络图片校验的配置函数
  linkImgCheck: function linkImgCheck(src, alt, href) {
    return true;
  },
  // 显示“插入网络图片”
  showLinkImg: true,
  // 显示“插入图片alt”
  showLinkImgAlt: true,
  // 显示“插入图片href”
  showLinkImgHref: true,
  // 插入图片成功之后的回调函数
  linkImgCallback: const_1.EMPTY_FN,
  // accept
  uploadImgAccept: ['jpg', 'jpeg', 'png', 'gif', 'bmp'],
  // 服务端地址
  uploadImgServer: '',
  // 使用 base64 存储图片
  uploadImgShowBase64: false,
  // 上传图片的最大体积，默认 5M
  uploadImgMaxSize: 5 * 1024 * 1024,
  // 一次最多上传多少个图片
  uploadImgMaxLength: 100,
  // 自定义上传图片的名称
  uploadFileName: '',
  // 上传图片自定义参数
  uploadImgParams: {},
  // 自定义参数拼接到 url 中
  uploadImgParamsWithUrl: false,
  // 上传图片自定义 header
  uploadImgHeaders: {},
  // 钩子函数
  uploadImgHooks: {},
  // 上传图片超时时间 ms
  uploadImgTimeout: 10 * 1000,
  // 跨域带 cookie
  withCredentials: false,
  // 自定义上传
  customUploadImg: null,
  // 从媒体库上传
  uploadImgFromMedia: null
};

/***/ }),
/* 277 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports["default"] = {
  lang: 'zh-CN',
  languages: {
    'zh-CN': {
      wangEditor: {
        重置: '重置',
        插入: '插入',
        默认: '默认',
        创建: '创建',
        修改: '修改',
        如: '如',
        请输入正文: '请输入正文',
        menus: {
          title: {
            标题: '标题',
            加粗: '加粗',
            字号: '字号',
            字体: '字体',
            斜体: '斜体',
            下划线: '下划线',
            删除线: '删除线',
            缩进: '缩进',
            行高: '行高',
            文字颜色: '文字颜色',
            背景色: '背景色',
            链接: '链接',
            序列: '序列',
            对齐: '对齐',
            引用: '引用',
            表情: '表情',
            图片: '图片',
            视频: '视频',
            表格: '表格',
            代码: '代码',
            分割线: '分割线',
            恢复: '恢复',
            撤销: '撤销',
            全屏: '全屏',
            取消全屏: '取消全屏',
            待办事项: '待办事项'
          },
          dropListMenu: {
            设置标题: '设置标题',
            背景颜色: '背景颜色',
            文字颜色: '文字颜色',
            设置字号: '设置字号',
            设置字体: '设置字体',
            设置缩进: '设置缩进',
            对齐方式: '对齐方式',
            设置行高: '设置行高',
            序列: '序列',
            head: {
              正文: '正文'
            },
            indent: {
              增加缩进: '增加缩进',
              减少缩进: '减少缩进'
            },
            justify: {
              靠左: '靠左',
              居中: '居中',
              靠右: '靠右',
              两端: '两端'
            },
            list: {
              无序列表: '无序列表',
              有序列表: '有序列表'
            }
          },
          panelMenus: {
            emoticon: {
              默认: '默认',
              新浪: '新浪',
              emoji: 'emoji',
              手势: '手势'
            },
            image: {
              上传图片: '上传图片',
              网络图片: '网络图片',
              图片地址: '图片地址',
              图片文字说明: '图片文字说明',
              跳转链接: '跳转链接'
            },
            link: {
              链接: '链接',
              链接文字: '链接文字',
              取消链接: '取消链接',
              查看链接: '查看链接'
            },
            video: {
              插入视频: '插入视频',
              上传视频: '上传视频'
            },
            table: {
              行: '行',
              列: '列',
              的: '的',
              表格: '表格',
              添加行: '添加行',
              删除行: '删除行',
              添加列: '添加列',
              删除列: '删除列',
              设置表头: '设置表头',
              取消表头: '取消表头',
              插入表格: '插入表格',
              删除表格: '删除表格'
            },
            code: {
              删除代码: '删除代码',
              修改代码: '修改代码',
              插入代码: '插入代码'
            }
          }
        },
        validate: {
          张图片: '张图片',
          大于: '大于',
          图片链接: '图片链接',
          不是图片: '不是图片',
          返回结果: '返回结果',
          上传图片超时: '上传图片超时',
          上传图片错误: '上传图片错误',
          上传图片失败: '上传图片失败',
          插入图片错误: '插入图片错误',
          一次最多上传: '一次最多上传',
          下载链接失败: '下载链接失败',
          图片验证未通过: '图片验证未通过',
          服务器返回状态: '服务器返回状态',
          上传图片返回结果错误: '上传图片返回结果错误',
          请替换为支持的图片类型: '请替换为支持的图片类型',
          您插入的网络图片无法识别: '您插入的网络图片无法识别',
          您刚才插入的图片链接未通过编辑器校验: '您刚才插入的图片链接未通过编辑器校验',
          插入视频错误: '插入视频错误',
          视频链接: '视频链接',
          不是视频: '不是视频',
          视频验证未通过: '视频验证未通过',
          个视频: '个视频',
          上传视频超时: '上传视频超时',
          上传视频错误: '上传视频错误',
          上传视频失败: '上传视频失败',
          上传视频返回结果错误: '上传视频返回结果错误'
        }
      }
    },
    en: {
      wangEditor: {
        重置: 'reset',
        插入: 'insert',
        默认: 'default',
        创建: 'create',
        修改: 'edit',
        如: 'like',
        请输入正文: 'please enter the text',
        menus: {
          title: {
            标题: 'head',
            加粗: 'bold',
            字号: 'font size',
            字体: 'font family',
            斜体: 'italic',
            下划线: 'underline',
            删除线: 'strikethrough',
            缩进: 'indent',
            行高: 'line heihgt',
            文字颜色: 'font color',
            背景色: 'background',
            链接: 'link',
            序列: 'numbered list',
            对齐: 'align',
            引用: 'quote',
            表情: 'emoticons',
            图片: 'image',
            视频: 'media',
            表格: 'table',
            代码: 'code',
            分割线: 'split line',
            恢复: 'redo',
            撤销: 'undo',
            全屏: 'fullscreen',
            取消全屏: 'cancel fullscreen',
            待办事项: 'todo'
          },
          dropListMenu: {
            设置标题: 'title',
            背景颜色: 'background',
            文字颜色: 'font color',
            设置字号: 'font size',
            设置字体: 'font family',
            设置缩进: 'indent',
            对齐方式: 'align',
            设置行高: 'line heihgt',
            序列: 'list',
            head: {
              正文: 'text'
            },
            indent: {
              增加缩进: 'indent',
              减少缩进: 'outdent'
            },
            justify: {
              靠左: 'left',
              居中: 'center',
              靠右: 'right',
              两端: 'justify'
            },
            list: {
              无序列表: 'unordered',
              有序列表: 'ordered'
            }
          },
          panelMenus: {
            emoticon: {
              表情: 'emoji',
              手势: 'gesture'
            },
            image: {
              上传图片: 'upload image',
              网络图片: 'network image',
              图片地址: 'image link',
              图片文字说明: 'image alt',
              跳转链接: 'hyperlink'
            },
            link: {
              链接: 'link',
              链接文字: 'link text',
              取消链接: 'unlink',
              查看链接: 'view links'
            },
            video: {
              插入视频: 'insert video',
              上传视频: 'upload local video'
            },
            table: {
              行: 'rows',
              列: 'columns',
              的: ' ',
              表格: 'table',
              添加行: 'insert row',
              删除行: 'delete row',
              添加列: 'insert column',
              删除列: 'delete column',
              设置表头: 'set header',
              取消表头: 'cancel header',
              插入表格: 'insert table',
              删除表格: 'delete table'
            },
            code: {
              删除代码: 'delete code',
              修改代码: 'edit code',
              插入代码: 'insert code'
            }
          }
        },
        validate: {
          张图片: 'images',
          大于: 'greater than',
          图片链接: 'image link',
          不是图片: 'is not image',
          返回结果: 'return results',
          上传图片超时: 'upload image timeout',
          上传图片错误: 'upload image error',
          上传图片失败: 'upload image failed',
          插入图片错误: 'insert image error',
          一次最多上传: 'once most at upload',
          下载链接失败: 'download link failed',
          图片验证未通过: 'image validate failed',
          服务器返回状态: 'server return status',
          上传图片返回结果错误: 'upload image return results error',
          请替换为支持的图片类型: 'please replace with a supported image type',
          您插入的网络图片无法识别: 'the network picture you inserted is not recognized',
          您刚才插入的图片链接未通过编辑器校验: 'the image link you just inserted did not pass the editor verification',
          插入视频错误: 'insert video error',
          视频链接: 'video link',
          不是视频: 'is not video',
          视频验证未通过: 'video validate failed',
          个视频: 'videos',
          上传视频超时: 'upload video timeout',
          上传视频错误: 'upload video error',
          上传视频失败: 'upload video failed',
          上传视频返回结果错误: 'upload video return results error'
        }
      }
    }
  }
};

/***/ }),
/* 278 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 历史记录 - 数据缓存的模式
 * @author fangzhicong
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var util_1 = __webpack_require__(6);
/**
 * 是否为兼容模式。返回 true 表示当前使用兼容（内容备份）模式，否则使用标准（差异备份）模式
 */


function compatibleMode() {
  if (util_1.UA.isIE() || util_1.UA.isOldEdge) {
    return true;
  }

  return false;
}

exports["default"] = {
  compatibleMode: compatibleMode,
  historyMaxSize: 30
};

/***/ }),
/* 279 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 视频相关的配置
 * @author hutianhao
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var const_1 = __webpack_require__(7);

exports["default"] = {
  // 插入网络视频前的回调函数
  onlineVideoCheck: function onlineVideoCheck(video) {
    return true;
  },
  // 插入网络视频成功之后的回调函数
  onlineVideoCallback: const_1.EMPTY_FN,
  // 显示“插入视频”
  showLinkVideo: true,
  // accept
  uploadVideoAccept: ['mp4'],
  // 服务端地址
  uploadVideoServer: '',
  // 上传视频的最大体积，默认 1024M
  uploadVideoMaxSize: 1 * 1024 * 1024 * 1024,
  // 一次最多上传多少个视频
  // uploadVideoMaxLength: 2,
  // 自定义上传视频的名称
  uploadVideoName: '',
  // 上传视频自定义参数
  uploadVideoParams: {},
  // 自定义参数拼接到 url 中
  uploadVideoParamsWithUrl: false,
  // 上传视频自定义 header
  uploadVideoHeaders: {},
  // 钩子函数
  uploadVideoHooks: {},
  // 上传视频超时时间 ms 默认2个小时
  uploadVideoTimeout: 1000 * 60 * 60 * 2,
  // 跨域带 cookie
  withVideoCredentials: false,
  // 自定义上传
  customUploadVideo: null,
  // 自定义插入视频
  customInsertVideo: null
};

/***/ }),
/* 280 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _trim = _interopRequireDefault(__webpack_require__(17));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);
/**
 * @description selection range API
 * @author wangfupeng
 */


var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var util_1 = __webpack_require__(6);

var const_1 = __webpack_require__(7);

var SelectionAndRange =
/** @class */
function () {
  function SelectionAndRange(editor) {
    this._currentRange = null;
    this.editor = editor;
  }
  /**
   * 获取当前 range
   */


  SelectionAndRange.prototype.getRange = function () {
    return this._currentRange;
  };
  /**
   * 保存选区范围
   * @param _range 选区范围
   */


  SelectionAndRange.prototype.saveRange = function (_range) {
    if (_range) {
      // 保存已有选区
      this._currentRange = _range;
      return;
    } // 获取当前的选区


    var selection = window.getSelection();

    if (selection.rangeCount === 0) {
      return;
    }

    var range = selection.getRangeAt(0); // 获取选区范围的 DOM 元素

    var $containerElem = this.getSelectionContainerElem(range);

    if (!($containerElem === null || $containerElem === void 0 ? void 0 : $containerElem.length)) {
      // 当 选区范围内没有 DOM元素 则抛出
      return;
    }

    if ($containerElem.attr('contenteditable') === 'false' || $containerElem.parentUntil('[contenteditable=false]')) {
      // 这里大体意义上就是个保险
      // 确保 编辑区域 的 contenteditable属性 的值为 true
      return;
    }

    var editor = this.editor;
    var $textElem = editor.$textElem;

    if ($textElem.isContain($containerElem)) {
      if ($textElem.elems[0] === $containerElem.elems[0]) {
        var _context;

        if ((0, _trim["default"])(_context = $textElem.html()).call(_context) === const_1.EMPTY_P) {
          var $children = $textElem.children();
          var $last = $children === null || $children === void 0 ? void 0 : $children.last();
          editor.selection.createRangeByElem($last, true, true);
          editor.selection.restoreSelection();
        }
      } // 是编辑内容之内的


      this._currentRange = range;
    }
  };
  /**
   * 折叠选区范围
   * @param toStart true 开始位置，false 结束位置
   */


  SelectionAndRange.prototype.collapseRange = function (toStart) {
    if (toStart === void 0) {
      toStart = false;
    }

    var range = this._currentRange;

    if (range) {
      range.collapse(toStart);
    }
  };
  /**
   * 获取选区范围内的文字
   */


  SelectionAndRange.prototype.getSelectionText = function () {
    var range = this._currentRange;

    if (range) {
      return range.toString();
    } else {
      return '';
    }
  };
  /**
   * 获取选区范围的 DOM 元素
   * @param range 选区范围
   */


  SelectionAndRange.prototype.getSelectionContainerElem = function (range) {
    var r;
    r = range || this._currentRange;
    var elem;

    if (r) {
      elem = r.commonAncestorContainer;
      return dom_core_1["default"](elem.nodeType === 1 ? elem : elem.parentNode);
    }
  };
  /**
   * 选区范围开始的 DOM 元素
   * @param range 选区范围
   */


  SelectionAndRange.prototype.getSelectionStartElem = function (range) {
    var r;
    r = range || this._currentRange;
    var elem;

    if (r) {
      elem = r.startContainer;
      return dom_core_1["default"](elem.nodeType === 1 ? elem : elem.parentNode);
    }
  };
  /**
   * 选区范围结束的 DOM 元素
   * @param range 选区范围
   */


  SelectionAndRange.prototype.getSelectionEndElem = function (range) {
    var r;
    r = range || this._currentRange;
    var elem;

    if (r) {
      elem = r.endContainer;
      return dom_core_1["default"](elem.nodeType === 1 ? elem : elem.parentNode);
    }
  };
  /**
   * 选区是否为空（没有选择文字）
   */


  SelectionAndRange.prototype.isSelectionEmpty = function () {
    var range = this._currentRange;

    if (range && range.startContainer) {
      if (range.startContainer === range.endContainer) {
        if (range.startOffset === range.endOffset) {
          return true;
        }
      }
    }

    return false;
  };
  /**
   * 恢复选区范围
   */


  SelectionAndRange.prototype.restoreSelection = function () {
    var selection = window.getSelection();
    var r = this._currentRange;

    if (selection && r) {
      selection.removeAllRanges();
      selection.addRange(r);
    }
  };
  /**
   * 创建一个空白（即 &#8203 字符）选区
   */


  SelectionAndRange.prototype.createEmptyRange = function () {
    var editor = this.editor;
    var range = this.getRange();
    var $elem;

    if (!range) {
      // 当前无 range
      return;
    }

    if (!this.isSelectionEmpty()) {
      // 当前选区必须没有内容才可以，有内容就直接 return
      return;
    }

    try {
      // 目前只支持 webkit 内核
      if (util_1.UA.isWebkit()) {
        // 插入 &#8203
        editor.cmd["do"]('insertHTML', '&#8203;'); // 修改 offset 位置

        range.setEnd(range.endContainer, range.endOffset + 1); // 存储

        this.saveRange(range);
      } else {
        $elem = dom_core_1["default"]('<strong>&#8203;</strong>');
        editor.cmd["do"]('insertElem', $elem);
        this.createRangeByElem($elem, true);
      }
    } catch (ex) {// 部分情况下会报错，兼容一下
    }
  };
  /**
   * 重新设置选区
   * @param startDom 选区开始的元素
   * @param endDom 选区结束的元素
   */


  SelectionAndRange.prototype.createRangeByElems = function (startDom, endDom) {
    var selection = window.getSelection ? window.getSelection() : document.getSelection(); //清除所有的选区

    selection === null || selection === void 0 ? void 0 : selection.removeAllRanges();
    var range = document.createRange();
    range.setStart(startDom, 0); // 设置多行标签之后，第二个参数会被h标签内的b、font标签等影响range范围的选取

    range.setEnd(endDom, endDom.childNodes.length || 1); // 保存设置好的选区

    this.saveRange(range); //恢复选区

    this.restoreSelection();
  };
  /**
   * 根据 DOM 元素设置选区
   * @param $elem DOM 元素
   * @param toStart true 开始位置，false 结束位置
   * @param isContent 是否选中 $elem 的内容
   */


  SelectionAndRange.prototype.createRangeByElem = function ($elem, toStart, isContent) {
    if (!$elem.length) {
      return;
    }

    var elem = $elem.elems[0];
    var range = document.createRange();

    if (isContent) {
      range.selectNodeContents(elem);
    } else {
      // 如果用户没有传入 isContent 参数，那就默认为 false
      range.selectNode(elem);
    }

    if (toStart != null) {
      // 传入了 toStart 参数，折叠选区。如果没传入 toStart 参数，则忽略这一步
      range.collapse(toStart);

      if (!toStart) {
        this.saveRange(range);
        this.editor.selection.moveCursor(elem);
      }
    } // 存储 range


    this.saveRange(range);
  };
  /**
   * 获取 当前 选取范围的 顶级(段落) 元素
   * @param $editor
   */


  SelectionAndRange.prototype.getSelectionRangeTopNodes = function () {
    var _a, _b; // 清空，防止叠加元素


    var $nodeList;
    var $startElem = (_a = this.getSelectionStartElem()) === null || _a === void 0 ? void 0 : _a.getNodeTop(this.editor);
    var $endElem = (_b = this.getSelectionEndElem()) === null || _b === void 0 ? void 0 : _b.getNodeTop(this.editor);
    $nodeList = this.recordSelectionNodes(dom_core_1["default"]($startElem), dom_core_1["default"]($endElem));
    return $nodeList;
  };
  /**
   * 移动光标位置,默认情况下在尾部
   * 有一个特殊情况是firefox下的文本节点会自动补充一个br元素，会导致自动换行
   * 所以默认情况下在firefox下的文本节点会自动移动到br前面
   * @param {Node} node 元素节点
   * @param {number} position 光标的位置
   */


  SelectionAndRange.prototype.moveCursor = function (node, position) {
    var _a;

    var range = this.getRange(); //对文本节点特殊处理

    var len = node.nodeType === 3 ? (_a = node.nodeValue) === null || _a === void 0 ? void 0 : _a.length : node.childNodes.length;

    if ((util_1.UA.isFirefox || util_1.UA.isIE()) && len !== 0) {
      // firefox下在节点为文本节点和节点最后一个元素为文本节点的情况下
      if (node.nodeType === 3 || node.childNodes[len - 1].nodeName === 'BR') {
        len = len - 1;
      }
    }

    var pos = position !== null && position !== void 0 ? position : len;

    if (!range) {
      return;
    }

    if (node) {
      range.setStart(node, pos);
      range.setEnd(node, pos);
      this.restoreSelection();
    }
  };
  /**
   * 获取光标在当前选区的位置
   */


  SelectionAndRange.prototype.getCursorPos = function () {
    var selection = window.getSelection();
    return selection === null || selection === void 0 ? void 0 : selection.anchorOffset;
  };
  /**
   * 清除当前选区的Range,notice:不影响已保存的Range
   */


  SelectionAndRange.prototype.clearWindowSelectionRange = function () {
    var selection = window.getSelection();

    if (selection) {
      selection.removeAllRanges();
    }
  };
  /**
   * 记录节点 - 从选区开始节点开始 一直到匹配到选区结束节点为止
   * @param $node 节点
   */


  SelectionAndRange.prototype.recordSelectionNodes = function ($node, $endElem) {
    var $list = [];
    var isEnd = true;
    /**
    @author:lw
    @description 解决ctrl+a全选报错的bug $elem.getNodeName()可能会触发$elem[0]未定义
    **/

    try {
      var $NODE = $node;
      var $textElem = this.editor.$textElem; // $NODE元素为空时不需要进行循环

      while (isEnd) {
        var $elem = $NODE === null || $NODE === void 0 ? void 0 : $NODE.getNodeTop(this.editor);
        if ($elem.getNodeName() === 'BODY') isEnd = false; // 兜底

        if ($elem.length > 0) {
          $list.push(dom_core_1["default"]($NODE)); // 两个边界情况：
          // 1. 当前元素就是我们要找的末尾元素
          // 2. 当前元素已经是编辑区顶级元素（否则会找到编辑区的兄弟节点，比如placeholder元素）

          if (($endElem === null || $endElem === void 0 ? void 0 : $endElem.equal($elem)) || $textElem.equal($elem)) {
            isEnd = false;
          } else {
            $NODE = $elem.getNextSibling();
          }
        }
      }
    } catch (e) {
      isEnd = false;
    }

    return $list;
  };
  /**
   * 将当前 range 设置到 node 元素并初始化位置
   * 解决编辑器内容为空时，菜单不生效的问题
   * @param node 元素节点
   */


  SelectionAndRange.prototype.setRangeToElem = function (node) {
    var range = this.getRange();
    range === null || range === void 0 ? void 0 : range.setStart(node, 0);
    range === null || range === void 0 ? void 0 : range.setEnd(node, 0);
  };

  return SelectionAndRange;
}();

exports["default"] = SelectionAndRange;

/***/ }),
/* 281 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 封装 document.execCommand
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var Command =
/** @class */
function () {
  function Command(editor) {
    this.editor = editor;
  }
  /**
   * 执行富文本操作的命令
   * @param name name
   * @param value value
   */


  Command.prototype["do"] = function (name, value) {
    var editor = this.editor;

    if (editor.config.styleWithCSS) {
      document.execCommand('styleWithCSS', false, 'true');
    }

    var selection = editor.selection; // 如果无选区，忽略

    if (!selection.getRange()) {
      return;
    } // 恢复选取


    selection.restoreSelection(); // 执行

    switch (name) {
      case 'insertHTML':
        this.insertHTML(value);
        break;

      case 'insertElem':
        this.insertElem(value);
        break;

      default:
        // 默认 command
        this.execCommand(name, value);
        break;
    } // 修改菜单状态


    editor.menus.changeActive(); // 最后，恢复选取保证光标在原来的位置闪烁

    selection.saveRange();
    selection.restoreSelection();
  };
  /**
   * 插入 html
   * @param html html 字符串
   */


  Command.prototype.insertHTML = function (html) {
    var editor = this.editor;
    var range = editor.selection.getRange();
    if (range == null) return;

    if (this.queryCommandSupported('insertHTML')) {
      // W3C
      this.execCommand('insertHTML', html);
    } else if (range.insertNode) {
      // IE
      range.deleteContents();

      if (dom_core_1["default"](html).elems.length > 0) {
        range.insertNode(dom_core_1["default"](html).elems[0]);
      } else {
        var newNode = document.createElement('p');
        newNode.appendChild(document.createTextNode(html));
        range.insertNode(newNode);
      }

      editor.selection.collapseRange();
    } // else if (range.pasteHTML) {
    //     // IE <= 10
    //     range.pasteHTML(html)
    // }

  };
  /**
   * 插入 DOM 元素
   * @param $elem DOM 元素
   */


  Command.prototype.insertElem = function ($elem) {
    var editor = this.editor;
    var range = editor.selection.getRange();
    if (range == null) return;

    if (range.insertNode) {
      range.deleteContents();
      range.insertNode($elem.elems[0]);
    }
  };
  /**
   * 执行 document.execCommand
   * @param name name
   * @param value value
   */


  Command.prototype.execCommand = function (name, value) {
    document.execCommand(name, false, value);
  };
  /**
   * 执行 document.queryCommandValue
   * @param name name
   */


  Command.prototype.queryCommandValue = function (name) {
    return document.queryCommandValue(name);
  };
  /**
   * 执行 document.queryCommandState
   * @param name name
   */


  Command.prototype.queryCommandState = function (name) {
    return document.queryCommandState(name);
  };
  /**
   * 执行 document.queryCommandSupported
   * @param name name
   */


  Command.prototype.queryCommandSupported = function (name) {
    return document.queryCommandSupported(name);
  };

  return Command;
}();

exports["default"] = Command;

/***/ }),
/* 282 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 编辑区域，入口文件
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _find = _interopRequireDefault(__webpack_require__(29));

var _forEach = _interopRequireDefault(__webpack_require__(4));

var _trim = _interopRequireDefault(__webpack_require__(17));

var _indexOf = _interopRequireDefault(__webpack_require__(27));

var _setTimeout2 = _interopRequireDefault(__webpack_require__(46));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var index_1 = tslib_1.__importDefault(__webpack_require__(287));

var util_1 = __webpack_require__(6);

var getChildrenJSON_1 = tslib_1.__importDefault(__webpack_require__(299));

var getHtmlByNodeList_1 = tslib_1.__importDefault(__webpack_require__(300));

var const_1 = __webpack_require__(7);

var Text =
/** @class */
function () {
  function Text(editor) {
    this.editor = editor;
    this.eventHooks = {
      onBlurEvents: [],
      changeEvents: [],
      dropEvents: [],
      clickEvents: [],
      keydownEvents: [],
      keyupEvents: [],
      tabUpEvents: [],
      tabDownEvents: [],
      enterUpEvents: [],
      enterDownEvents: [],
      deleteUpEvents: [],
      deleteDownEvents: [],
      pasteEvents: [],
      linkClickEvents: [],
      codeClickEvents: [],
      textScrollEvents: [],
      toolbarClickEvents: [],
      imgClickEvents: [],
      imgDragBarMouseDownEvents: [],
      tableClickEvents: [],
      menuClickEvents: [],
      dropListMenuHoverEvents: [],
      splitLineEvents: [],
      videoClickEvents: []
    };
  }
  /**
   * 初始化
   */


  Text.prototype.init = function () {
    // 实时保存选取范围
    this._saveRange(); // 绑定事件


    this._bindEventHooks(); // 初始化 text 事件钩子函数


    index_1["default"](this);
  };
  /**
   * 切换placeholder
   */


  Text.prototype.togglePlaceholder = function () {
    var _context;

    var html = this.html();
    var $placeholder = (0, _find["default"])(_context = this.editor.$textContainerElem).call(_context, '.placeholder');
    $placeholder.hide();
    if (this.editor.isComposing) return;
    if (!html || html === ' ') $placeholder.show();
  };
  /**
   * 清空内容
   */


  Text.prototype.clear = function () {
    this.html(const_1.EMPTY_P);
  };
  /**
   * 设置/获取 html
   * @param val html 字符串
   */


  Text.prototype.html = function (val) {
    var editor = this.editor;
    var $textElem = editor.$textElem; // 没有 val ，则是获取 html

    if (val == null) {
      var html_1 = $textElem.html(); // 未选中任何内容的时候点击“加粗”或者“斜体”等按钮，就得需要一个空的占位符 &#8203 ，这里替换掉

      html_1 = html_1.replace(/\u200b/gm, ''); // 去掉空行

      html_1 = html_1.replace(/<p><\/p>/gim, ''); // 去掉最后的 空标签

      html_1 = html_1.replace(const_1.EMPTY_P_LAST_REGEX, ''); // 为了避免用户在最后生成的EMPTY_P标签中编辑数据, 最后产生多余标签, 去除所有p标签上的data-we-empty-p属性

      html_1 = html_1.replace(const_1.EMPTY_P_REGEX, '<p>');
      /**
       * 这里的代码为了处理火狐多余的空行标签,但是强制删除空行标签会带来其他问题
       * html()方法返回的的值,EMPTY_P中pr会被删除,只留下<p>,点不进去,从而产生垃圾数据
       * 目前在末位有多个空行的情况下执行撤销重做操作,会产生一种不记录末尾空行的错觉
       * 暂时注释, 等待进一步的兼容处理
       */
      // html = html.replace(/><br>(?!<)/gi, '>') // 过滤 <p><br>内容</p> 中的br
      // html = html.replace(/(?!>)<br></gi, '<') // 过滤 <p>内容<br></p> 中的br

      /**
       * pre标签格式化
       * html()方法理论上应当输出纯净的代码文本,但是对于是否解析html标签还没有良好的判断
       * 如果去除hljs的标签,在解析状态下回显,会造成显示错误并且无法再通过hljs方法渲染
       * 暂且其弃用
       */
      // html = formatCodeHtml(editor, html)
      // 将没有自闭和的标签过滤为自闭和

      var selfCloseHtmls = html_1.match(/<(img|br|hr|input)[^>]*>/gi);

      if (selfCloseHtmls !== null) {
        (0, _forEach["default"])(selfCloseHtmls).call(selfCloseHtmls, function (item) {
          if (!item.match(/\/>/)) {
            html_1 = html_1.replace(item, item.substring(0, item.length - 1) + '/>');
          }
        });
      }

      return html_1;
    } // 有 val ，则是设置 html


    val = (0, _trim["default"])(val).call(val);

    if (val === '') {
      val = const_1.EMPTY_P;
    }

    if ((0, _indexOf["default"])(val).call(val, '<') !== 0) {
      // 内容用 p 标签包裹
      val = "<p>" + val + "</p>";
    }

    $textElem.html(val); // 初始化选区，将光标定位到内容尾部

    editor.initSelection();
  };
  /**
   * 将json设置成html至编辑器
   * @param nodeList json格式
   */


  Text.prototype.setJSON = function (nodeList) {
    var html = getHtmlByNodeList_1["default"](nodeList).children();
    var editor = this.editor;
    var $textElem = editor.$textElem; // 没有获取到元素的情况

    if (!html) return; // 替换文本节点下全部子节点

    $textElem.replaceChildAll(html);
  };
  /**
   * 获取 json 格式的数据
   */


  Text.prototype.getJSON = function () {
    var editor = this.editor;
    var $textElem = editor.$textElem;
    return getChildrenJSON_1["default"]($textElem);
  };

  Text.prototype.text = function (val) {
    var editor = this.editor;
    var $textElem = editor.$textElem; // 没有 val ，是获取 text

    if (val == null) {
      var text = $textElem.text(); // 未选中任何内容的时候点击“加粗”或者“斜体”等按钮，就得需要一个空的占位符 &#8203 ，这里替换掉

      text = text.replace(/\u200b/gm, '');
      return text;
    } // 有 val ，则是设置 text


    $textElem.text("<p>" + val + "</p>"); // 初始化选区，将光标定位到内容尾部

    editor.initSelection();
  };
  /**
   * 追加 html 内容
   * @param html html 字符串
   */


  Text.prototype.append = function (html) {
    var editor = this.editor;

    if ((0, _indexOf["default"])(html).call(html, '<') !== 0) {
      // 普通字符串，用 <p> 包裹
      html = "<p>" + html + "</p>";
    }

    this.html(this.html() + html); // 初始化选区，将光标定位到内容尾部

    editor.initSelection();
  };
  /**
   * 每一步操作，都实时保存选区范围
   */


  Text.prototype._saveRange = function () {
    var editor = this.editor;
    var $textElem = editor.$textElem;
    var $document = dom_core_1["default"](document); // 保存当前的选区

    function saveRange() {
      // 随时保存选区
      editor.selection.saveRange(); // 更新按钮 active 状态

      editor.menus.changeActive();
    } // 按键后保存


    $textElem.on('keyup', saveRange); // 点击后保存，为了避免被多次执行而导致造成浪费，这里对 click 使用一次性绑定

    function onceClickSaveRange() {
      saveRange();
      $textElem.off('click', onceClickSaveRange);
    }

    $textElem.on('click', onceClickSaveRange);

    function handleMouseUp() {
      // 在编辑器区域之外完成抬起，保存此时编辑区内的新选区，取消此时鼠标抬起事件
      saveRange();
      $document.off('mouseup', handleMouseUp);
    }

    function listenMouseLeave() {
      // 当鼠标移动到外面，要监听鼠标抬起操作
      $document.on('mouseup', handleMouseUp); // 首次移出时即接触leave监听，防止用户不断移入移出多次注册handleMouseUp

      $textElem.off('mouseleave', listenMouseLeave);
    }

    $textElem.on('mousedown', function () {
      // mousedown 状态下，要坚听鼠标滑动到编辑区域外面
      $textElem.on('mouseleave', listenMouseLeave);
    });
    $textElem.on('mouseup', function (e) {
      // 记得移除$textElem的mouseleave事件, 避免内存泄露
      $textElem.off('mouseleave', listenMouseLeave); // fix：避免当选中一段文字之后，再次点击文字中间位置无法更新selection问题。issue#3096

      (0, _setTimeout2["default"])(function () {
        var selection = editor.selection;
        var range = selection.getRange();
        if (range === null) return;
        saveRange();
      }, 0);
    });
  };
  /**
   * 绑定事件，事件会触发钩子函数
   */


  Text.prototype._bindEventHooks = function () {
    var editor = this.editor;
    var $textElem = editor.$textElem;
    var eventHooks = this.eventHooks; // click hooks

    $textElem.on('click', function (e) {
      var clickEvents = eventHooks.clickEvents;
      (0, _forEach["default"])(clickEvents).call(clickEvents, function (fn) {
        return fn(e);
      });
    }); // enter 键 up 时的 hooks

    $textElem.on('keyup', function (e) {
      if (e.keyCode !== 13) return;
      var enterUpEvents = eventHooks.enterUpEvents;
      (0, _forEach["default"])(enterUpEvents).call(enterUpEvents, function (fn) {
        return fn(e);
      });
    }); // 键盘 up 时的 hooks

    $textElem.on('keyup', function (e) {
      var keyupEvents = eventHooks.keyupEvents;
      (0, _forEach["default"])(keyupEvents).call(keyupEvents, function (fn) {
        return fn(e);
      });
    }); // 键盘 down 时的 hooks

    $textElem.on('keydown', function (e) {
      var keydownEvents = eventHooks.keydownEvents;
      (0, _forEach["default"])(keydownEvents).call(keydownEvents, function (fn) {
        return fn(e);
      });
    }); // delete 键 up 时 hooks

    $textElem.on('keyup', function (e) {
      if (e.keyCode !== 8 && e.keyCode !== 46) return;
      var deleteUpEvents = eventHooks.deleteUpEvents;
      (0, _forEach["default"])(deleteUpEvents).call(deleteUpEvents, function (fn) {
        return fn(e);
      });
    }); // delete 键 down 时 hooks

    $textElem.on('keydown', function (e) {
      if (e.keyCode !== 8 && e.keyCode !== 46) return;
      var deleteDownEvents = eventHooks.deleteDownEvents;
      (0, _forEach["default"])(deleteDownEvents).call(deleteDownEvents, function (fn) {
        return fn(e);
      });
    }); // 粘贴

    $textElem.on('paste', function (e) {
      if (util_1.UA.isIE()) return; // IE 不支持
      // 阻止默认行为，使用 execCommand 的粘贴命令

      e.preventDefault();
      var pasteEvents = eventHooks.pasteEvents;
      (0, _forEach["default"])(pasteEvents).call(pasteEvents, function (fn) {
        return fn(e);
      });
    }); // 撤销/恢复 快捷键

    $textElem.on('keydown', function (e) {
      if ( // 编辑器处于聚焦状态下（多编辑器实例） || 当前处于兼容模式（兼容模式撤销/恢复后不聚焦，所以直接过，但会造成多编辑器同时撤销/恢复）
      (editor.isFocus || editor.isCompatibleMode) && (e.ctrlKey || e.metaKey) && e.keyCode === 90) {
        // 取消默认行为
        e.preventDefault(); // 执行事件

        if (e.shiftKey) {
          // 恢复
          editor.history.restore();
        } else {
          // 撤销
          editor.history.revoke();
        }
      }
    }); // tab up

    $textElem.on('keyup', function (e) {
      if (e.keyCode !== 9) return;
      e.preventDefault();
      var tabUpEvents = eventHooks.tabUpEvents;
      (0, _forEach["default"])(tabUpEvents).call(tabUpEvents, function (fn) {
        return fn(e);
      });
    }); // tab down

    $textElem.on('keydown', function (e) {
      if (e.keyCode !== 9) return;
      e.preventDefault();
      var tabDownEvents = eventHooks.tabDownEvents;
      (0, _forEach["default"])(tabDownEvents).call(tabDownEvents, function (fn) {
        return fn(e);
      });
    }); // 文本编辑区域 滚动时触发

    $textElem.on('scroll', // 使用节流
    util_1.throttle(function (e) {
      var textScrollEvents = eventHooks.textScrollEvents;
      (0, _forEach["default"])(textScrollEvents).call(textScrollEvents, function (fn) {
        return fn(e);
      });
    }, 100)); // 拖拽相关的事件

    function preventDefault(e) {
      // 禁用 document 拖拽事件
      e.preventDefault();
    }

    dom_core_1["default"](document).on('dragleave', preventDefault).on('drop', preventDefault).on('dragenter', preventDefault).on('dragover', preventDefault); // 全局事件在编辑器实例销毁的时候进行解绑

    editor.beforeDestroy(function () {
      dom_core_1["default"](document).off('dragleave', preventDefault).off('drop', preventDefault).off('dragenter', preventDefault).off('dragover', preventDefault);
    });
    $textElem.on('drop', function (e) {
      e.preventDefault();
      var events = eventHooks.dropEvents;
      (0, _forEach["default"])(events).call(events, function (fn) {
        return fn(e);
      });
    }); // link click

    $textElem.on('click', function (e) {
      // 存储链接元素
      var $link = null;
      var target = e.target;
      var $target = dom_core_1["default"](target);

      if ($target.getNodeName() === 'A') {
        // 当前点击的就是一个链接
        $link = $target;
      } else {
        // 否则，向父节点中寻找链接
        var $parent = $target.parentUntil('a');

        if ($parent != null) {
          // 找到了
          $link = $parent;
        }
      }

      if (!$link) return; // 没有点击链接，则返回

      var linkClickEvents = eventHooks.linkClickEvents;
      (0, _forEach["default"])(linkClickEvents).call(linkClickEvents, function (fn) {
        return fn($link);
      });
    }); // img click

    $textElem.on('click', function (e) {
      // 存储图片元素
      var $img = null;
      var target = e.target;
      var $target = dom_core_1["default"](target); //处理图片点击 去除掉emoji图片的情况

      if ($target.getNodeName() === 'IMG' && !$target.elems[0].getAttribute('data-emoji')) {
        // 当前点击的就是img
        e.stopPropagation();
        $img = $target;
      }

      if (!$img) return; // 没有点击图片，则返回

      var imgClickEvents = eventHooks.imgClickEvents;
      (0, _forEach["default"])(imgClickEvents).call(imgClickEvents, function (fn) {
        return fn($img);
      });
    }); // code click

    $textElem.on('click', function (e) {
      // 存储代码元素
      var $code = null;
      var target = e.target;
      var $target = dom_core_1["default"](target);

      if ($target.getNodeName() === 'PRE') {
        // 当前点击的就是一个链接
        $code = $target;
      } else {
        // 否则，向父节点中寻找链接
        var $parent = $target.parentUntil('pre');

        if ($parent !== null) {
          // 找到了
          $code = $parent;
        }
      }

      if (!$code) return;
      var codeClickEvents = eventHooks.codeClickEvents;
      (0, _forEach["default"])(codeClickEvents).call(codeClickEvents, function (fn) {
        return fn($code);
      });
    }); // splitLine click

    $textElem.on('click', function (e) {
      // 存储分割线元素
      var $splitLine = null;
      var target = e.target;
      var $target = dom_core_1["default"](target); // 判断当前点击元素

      if ($target.getNodeName() === 'HR') {
        $splitLine = $target;
      } else {
        $target == null;
      }

      if (!$splitLine) return; // 没有点击分割线，则返回
      // 设置、恢复选区

      editor.selection.createRangeByElem($splitLine);
      editor.selection.restoreSelection();
      var splitLineClickEvents = eventHooks.splitLineEvents;
      (0, _forEach["default"])(splitLineClickEvents).call(splitLineClickEvents, function (fn) {
        return fn($splitLine);
      });
    }); // 菜单栏被点击

    editor.$toolbarElem.on('click', function (e) {
      var toolbarClickEvents = eventHooks.toolbarClickEvents;
      (0, _forEach["default"])(toolbarClickEvents).call(toolbarClickEvents, function (fn) {
        return fn(e);
      });
    }); //mousedown事件

    editor.$textContainerElem.on('mousedown', function (e) {
      var target = e.target;
      var $target = dom_core_1["default"](target);

      if ($target.hasClass('w-e-img-drag-rb')) {
        // 点击的元素，是图片拖拽调整大小的 bar
        var imgDragBarMouseDownEvents = eventHooks.imgDragBarMouseDownEvents;
        (0, _forEach["default"])(imgDragBarMouseDownEvents).call(imgDragBarMouseDownEvents, function (fn) {
          return fn();
        });
      }
    }); //table click

    $textElem.on('click', function (e) {
      // 存储元素
      var $dom = null;
      var target = e.target; //获取最祖父元素

      $dom = dom_core_1["default"](target).parentUntilEditor('TABLE', editor, target); // 没有table范围内，则返回

      if (!$dom) return;
      var tableClickEvents = eventHooks.tableClickEvents;
      (0, _forEach["default"])(tableClickEvents).call(tableClickEvents, function (fn) {
        return fn($dom, e);
      });
    }); // enter 键 down

    $textElem.on('keydown', function (e) {
      if (e.keyCode !== 13) return;
      var enterDownEvents = eventHooks.enterDownEvents;
      (0, _forEach["default"])(enterDownEvents).call(enterDownEvents, function (fn) {
        return fn(e);
      });
    }); // 视频 click

    $textElem.on('click', function (e) {
      // 存储视频
      var $video = null;
      var target = e.target;
      var $target = dom_core_1["default"](target); //处理视频点击 简单的video 标签

      if ($target.getNodeName() === 'VIDEO') {
        // 当前点击的就是视频
        e.stopPropagation();
        $video = $target;
      }

      if (!$video) return; // 没有点击视频，则返回

      var videoClickEvents = eventHooks.videoClickEvents;
      (0, _forEach["default"])(videoClickEvents).call(videoClickEvents, function (fn) {
        return fn($video);
      });
    });
  };

  return Text;
}();

exports["default"] = Text;

/***/ }),
/* 283 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(284);

module.exports = parent;


/***/ }),
/* 284 */
/***/ (function(module, exports, __webpack_require__) {

var find = __webpack_require__(285);

var ArrayPrototype = Array.prototype;

module.exports = function (it) {
  var own = it.find;
  return it === ArrayPrototype || (it instanceof Array && own === ArrayPrototype.find) ? find : own;
};


/***/ }),
/* 285 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(286);
var entryVirtual = __webpack_require__(15);

module.exports = entryVirtual('Array').find;


/***/ }),
/* 286 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var $ = __webpack_require__(5);
var $find = __webpack_require__(32).find;
var addToUnscopables = __webpack_require__(82);
var arrayMethodUsesToLength = __webpack_require__(22);

var FIND = 'find';
var SKIPS_HOLES = true;

var USES_TO_LENGTH = arrayMethodUsesToLength(FIND);

// Shouldn't skip holes
if (FIND in []) Array(1)[FIND](function () { SKIPS_HOLES = false; });

// `Array.prototype.find` method
// https://tc39.github.io/ecma262/#sec-array.prototype.find
$({ target: 'Array', proto: true, forced: SKIPS_HOLES || !USES_TO_LENGTH }, {
  find: function find(callbackfn /* , that = undefined */) {
    return $find(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
  }
});

// https://tc39.github.io/ecma262/#sec-array.prototype-@@unscopables
addToUnscopables(FIND);


/***/ }),
/* 287 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description Text 事件钩子函数。Text 公共的，不是某个菜单独有的
 * @wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var enter_to_create_p_1 = tslib_1.__importDefault(__webpack_require__(288));

var del_to_keep_p_1 = tslib_1.__importStar(__webpack_require__(289));

var tab_to_space_1 = tslib_1.__importDefault(__webpack_require__(290));

var paste_text_html_1 = tslib_1.__importDefault(__webpack_require__(291));

var img_click_active_1 = tslib_1.__importDefault(__webpack_require__(298));
/**
 * 初始化 text 事件钩子函数
 * @param text text 实例
 */


function initTextHooks(text) {
  var editor = text.editor;
  var eventHooks = text.eventHooks; // 回车时，保证生成的是 <p> 标签

  enter_to_create_p_1["default"](editor, eventHooks.enterUpEvents, eventHooks.enterDownEvents); // 删除时，保留 EMPTY_P

  del_to_keep_p_1["default"](editor, eventHooks.deleteUpEvents, eventHooks.deleteDownEvents); // 剪切时, 保留p

  del_to_keep_p_1.cutToKeepP(editor, eventHooks.keyupEvents); // tab 转换为空格

  tab_to_space_1["default"](editor, eventHooks.tabDownEvents); // 粘贴 text html

  paste_text_html_1["default"](editor, eventHooks.pasteEvents); // img click active

  img_click_active_1["default"](editor, eventHooks.imgClickEvents);
}

exports["default"] = initTextHooks;

/***/ }),
/* 288 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 回车时，保证生成的是 <p> 标签
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _indexOf = _interopRequireDefault(__webpack_require__(27));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var const_1 = __webpack_require__(7);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));
/**
 * 回车时，保证生成的是 <p> 标签
 * @param editor 编辑器实例
 * @param enterUpEvents enter 键 up 时的 hooks
 * @param enterDownEvents enter 键 down 时的 hooks
 */


function enterToCreateP(editor, enterUpEvents, enterDownEvents) {
  function insertEmptyP($selectionElem) {
    var _context;

    var $p = dom_core_1["default"](const_1.EMPTY_P);
    $p.insertBefore($selectionElem);

    if ((0, _indexOf["default"])(_context = $selectionElem.html()).call(_context, '<img') >= 0) {
      // 有图片的回车键弹起时
      $p.remove();
      return;
    }

    editor.selection.createRangeByElem($p, true, true);
    editor.selection.restoreSelection();
    $selectionElem.remove();
  } // enter up 时


  function fn() {
    var $textElem = editor.$textElem;
    var $selectionElem = editor.selection.getSelectionContainerElem();
    var $parentElem = $selectionElem.parent();

    if ($parentElem.html() === '<code><br></code>') {
      // 回车之前光标所在一个 <p><code>.....</code></p> ，忽然回车生成一个空的 <p><code><br></code></p>
      // 而且继续回车跳不出去，因此只能特殊处理
      insertEmptyP($parentElem);
      return;
    }

    if ($selectionElem.getNodeName() === 'FONT' && $selectionElem.text() === '' && $selectionElem.attr('face') === 'monospace') {
      // 行内code回车时会产生一个<font face="monospace"><br></font>，导致样式问题
      insertEmptyP($parentElem);
      return;
    }

    if (!$parentElem.equal($textElem)) {
      // 不是顶级标签
      return;
    }

    var nodeName = $selectionElem.getNodeName();

    if (nodeName === 'P' && $selectionElem.attr('data-we-empty-p') === null) {
      // 当前的标签是 P 且不为 editor 生成的空白占位 p 标签，不用做处理
      return;
    }

    if ($selectionElem.text()) {
      // 有内容，不做处理
      return;
    } // 插入 <p> ，并将选取定位到 <p>，删除当前标签


    insertEmptyP($selectionElem);
  }

  enterUpEvents.push(fn); // enter down 时

  function createPWhenEnterText(e) {
    var _a; // selection中的range缓存还有问题,更新不及时,此处手动更新range,处理enter的bug


    editor.selection.saveRange((_a = getSelection()) === null || _a === void 0 ? void 0 : _a.getRangeAt(0));
    var $selectElem = editor.selection.getSelectionContainerElem();

    if ($selectElem.id === editor.textElemId) {
      // 回车时，默认创建了 text 标签（没有 p 标签包裹），父元素直接就是 $textElem
      // 例如，光标放在 table 最后侧，回车时，默认就是这个情况
      e.preventDefault();
      editor.cmd["do"]('insertHTML', '<p><br></p>');
    }
  }

  enterDownEvents.push(createPWhenEnterText);
}

exports["default"] = enterToCreateP;

/***/ }),
/* 289 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 删除时保留 EMPTY_P
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _trim = _interopRequireDefault(__webpack_require__(17));

var _includes = _interopRequireDefault(__webpack_require__(28));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.cutToKeepP = void 0;

var tslib_1 = __webpack_require__(2);

var const_1 = __webpack_require__(7);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));
/**
 * 删除时保留 EMPTY_P
 * @param editor 编辑器实例
 * @param deleteUpEvents delete 键 up 时的 hooks
 * @param deleteDownEvents delete 建 down 时的 hooks
 */


function deleteToKeepP(editor, deleteUpEvents, deleteDownEvents) {
  function upFn() {
    var $textElem = editor.$textElem;
    var html = editor.$textElem.html();
    var text = editor.$textElem.text();
    var txtHtml = (0, _trim["default"])(html).call(html);
    /**
      @description
        如果编辑区清空的状态下，单单插入一张图片，删除图片后，会存在空的情况：'<p data-we-empty-p=""></p>'
        需要包含这种边界情况
    **/

    var emptyTags = ['<p><br></p>', '<br>', '<p data-we-empty-p=""></p>', const_1.EMPTY_P]; // 编辑器中的字符是""或空白，说明内容为空

    if (/^\s*$/.test(text) && (!txtHtml || (0, _includes["default"])(emptyTags).call(emptyTags, txtHtml))) {
      // 内容空了
      $textElem.html(const_1.EMPTY_P);
      /**
       * 当编辑器 - 文本区内容为空的情况下，会插入一个空的P，此时应该将选区移动到这个空标签上，重置选区
       * bug: 如果选区没有从$textElem上调整到p上，就会有问题，在清空内容，设置标题时，会报错。
       */

      var containerElem = $textElem.getNode(); // 设置新的选区

      editor.selection.createRangeByElems(containerElem.childNodes[0], containerElem.childNodes[0]);
      var $selectionElem = editor.selection.getSelectionContainerElem();
      editor.selection.restoreSelection(); // 设置折叠后的光标位置，在firebox等浏览器下
      // 光标设置在end位置会自动换行

      editor.selection.moveCursor($selectionElem.getNode(), 0);
    }
  }

  deleteUpEvents.push(upFn);

  function downFn(e) {
    var _context;

    var $textElem = editor.$textElem;
    var txtHtml = (0, _trim["default"])(_context = $textElem.html().toLowerCase()).call(_context);

    if (txtHtml === const_1.EMPTY_P) {
      // 最后剩下一个空行，就不再删除了
      e.preventDefault();
      return;
    }
  }

  deleteDownEvents.push(downFn);
}
/**
 * 剪切时保留 EMPTY_P
 * @param editor 编辑器实例
 * @param cutEvents keydown hooks
 */


function cutToKeepP(editor, cutEvents) {
  function upFn(e) {
    var _context2;

    if (e.keyCode !== 88) {
      return;
    }

    var $textElem = editor.$textElem;
    var txtHtml = (0, _trim["default"])(_context2 = $textElem.html().toLowerCase()).call(_context2); // firefox 时用 txtHtml === '<br>' 判断，其他用 !txtHtml 判断

    if (!txtHtml || txtHtml === '<br>') {
      // 内容空了
      var $p = dom_core_1["default"](const_1.EMPTY_P);
      $textElem.html(' '); // 一定要先清空，否则在 firefox 下有问题

      $textElem.append($p);
      editor.selection.createRangeByElem($p, false, true);
      editor.selection.restoreSelection(); // 设置折叠后的光标位置，在firebox等浏览器下
      // 光标设置在end位置会自动换行

      editor.selection.moveCursor($p.getNode(), 0);
    }
  }

  cutEvents.push(upFn);
}

exports.cutToKeepP = cutToKeepP;
exports["default"] = deleteToKeepP;

/***/ }),
/* 290 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 编辑区域 tab 的特殊处理
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
/**
 * 编辑区域 tab 的特殊处理，转换为空格
 * @param editor 编辑器实例
 * @param tabDownEvents tab down 事件钩子
 */

function tabHandler(editor, tabDownEvents) {
  // 定义函数
  function fn() {
    if (!editor.cmd.queryCommandSupported('insertHTML')) {
      // 必须原生支持 insertHTML 命令
      return;
    }

    var $selectionElem = editor.selection.getSelectionContainerElem();

    if (!$selectionElem) {
      return;
    }

    var $parentElem = $selectionElem.parent();
    var selectionNodeName = $selectionElem.getNodeName();
    var parentNodeName = $parentElem.getNodeName();

    if (selectionNodeName == 'CODE' || parentNodeName === 'CODE' || parentNodeName === 'PRE' || /hljs/.test(parentNodeName)) {
      // <pre><code> 里面
      editor.cmd["do"]('insertHTML', editor.config.languageTab);
    } else {
      // 普通文字
      editor.cmd["do"]('insertHTML', '&nbsp;&nbsp;&nbsp;&nbsp;');
    }
  } // 保留函数


  tabDownEvents.push(fn);
}

exports["default"] = tabHandler;

/***/ }),
/* 291 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 粘贴 text html
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _trim = _interopRequireDefault(__webpack_require__(17));

var _forEach = _interopRequireDefault(__webpack_require__(4));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var paste_event_1 = __webpack_require__(131);

var util_1 = __webpack_require__(6);

var const_1 = __webpack_require__(7);
/**
 * 格式化html
 * @param val 粘贴的html
 * @author Gavin
 * @description
    格式化html，需要特别注意
    功能：
        1. 将htmlText中的div，都替换成p标签
        2. 将处理后的htmlText模拟先插入到真实dom中，处理P截断问题。

    注意点：
        由于P不能嵌套p，会导致标签截断，从而将<p><p>xx</p></p>这样一个结构插入到页面时，会出现很多问题，包括光标位置问题，页面凭空多很多元素的问题。
 */


function formatHtml(htmlText) {
  var _context;

  var paste = (0, _trim["default"])(_context = htmlText.replace(/<div>/gim, '<p>') // div 全部替换为 p 标签
  .replace(/<\/div>/gim, '</p>')).call(_context); // 去除''
  // 模拟插入到真实dom中

  var tempContainer = document.createElement('div');
  tempContainer.innerHTML = paste;
  return tempContainer.innerHTML.replace(/<p><\/p>/gim, ''); // 将被截断的p，都替换掉
}
/**
 * 格式化html
 * @param val 粘贴的html
 * @author liuwei
 */


function formatCode(val) {
  var pasteText = val.replace(/<br>|<br\/>/gm, '\n').replace(/<[^>]+>/gm, '');
  return pasteText;
}
/**
 * 判断html是否使用P标签包裹
 * @param html 粘贴的html
 * @author luochao
 */


function isParagraphHtml(html) {
  var _a;

  if (html === '') return false;
  var container = document.createElement('div');
  container.innerHTML = html;
  return ((_a = container.firstChild) === null || _a === void 0 ? void 0 : _a.nodeName) === 'P';
}
/**
 * 判断当前选区是否是空段落
 * @param topElem 选区顶层元素
 * @author luochao
 */


function isEmptyParagraph(topElem) {
  if (!(topElem === null || topElem === void 0 ? void 0 : topElem.length)) return false;
  var dom = topElem.elems[0];
  return dom.nodeName === 'P' && dom.innerHTML === '<br>';
}
/**
 * 粘贴文本和 html
 * @param editor 编辑器对象
 * @param pasteEvents 粘贴事件列表
 */


function pasteTextHtml(editor, pasteEvents) {
  function fn(e) {
    // 获取配置
    var config = editor.config;
    var pasteFilterStyle = config.pasteFilterStyle;
    var pasteIgnoreImg = config.pasteIgnoreImg;
    var pasteTextHandle = config.pasteTextHandle; // 获取粘贴的文字

    var pasteHtml = paste_event_1.getPasteHtml(e, pasteFilterStyle, pasteIgnoreImg);
    var pasteText = paste_event_1.getPasteText(e);
    pasteText = pasteText.replace(/\n/gm, '<br>'); // 当前选区所在的 DOM 节点

    var $selectionElem = editor.selection.getSelectionContainerElem();

    if (!$selectionElem) {
      return;
    }

    var nodeName = $selectionElem === null || $selectionElem === void 0 ? void 0 : $selectionElem.getNodeName();
    var $topElem = $selectionElem === null || $selectionElem === void 0 ? void 0 : $selectionElem.getNodeTop(editor); // 当前节点顶级可能没有

    var topNodeName = '';

    if ($topElem.elems[0]) {
      topNodeName = $topElem === null || $topElem === void 0 ? void 0 : $topElem.getNodeName();
    } // code 中只能粘贴纯文本


    if (nodeName === 'CODE' || topNodeName === 'PRE') {
      if (pasteTextHandle && util_1.isFunction(pasteTextHandle)) {
        // 用户自定义过滤处理粘贴内容
        pasteText = '' + (pasteTextHandle(pasteText) || '');
      }

      editor.cmd["do"]('insertHTML', formatCode(pasteText));
      return;
    } // 如果用户开启闭粘贴样式注释则将复制进来为url的直接转为链接 否则不转换。
    //  在群中有用户提到关闭样式粘贴复制的文字进来后链接直接转为文字了，不符合预期，这里优化下


    if (const_1.urlRegex.test(pasteText) && pasteFilterStyle) {
      //当复制的内容为链接时，也应该判断用户是否定义了处理粘贴的事件
      if (pasteTextHandle && util_1.isFunction(pasteTextHandle)) {
        // 用户自定义过滤处理粘贴内容
        pasteText = '' + (pasteTextHandle(pasteText) || ''); // html
      } // 当复制一个链接和文本时，需要区分出文本和a链接, 如：http://www.baidu.com  搜索。 issue: #3129
      // 目前也支持粘贴文案：粘贴http://www.baidu.com粘贴http://www.baidu.com，连个链接。


      var resultText = pasteText.replace(const_1.urlRegex, function (link) {
        return "<a href=\"" + link + "\" target=\"_blank\">" + link + "</a>";
      });
      var range = editor.selection.getRange(); // 文本转义问题，如果直接使用innerHTML插入html结构，地址中的特殊字符会被转义
      // 先生成元素，替换里面的文本，利用insertElem插入到页面

      var div = document.createElement('div');
      var fragment = document.createDocumentFragment();
      div.innerHTML = resultText;
      if (range == null) return; // 将div里的dom结构，搬到fragment里

      while (div.childNodes.length) {
        fragment.append(div.childNodes[0]);
      } // 修改a 链接文案，使用innerText插入文本，这样就避免了使用innerHTML时把特殊符号转义


      var linkEle = fragment.querySelectorAll('a');
      (0, _forEach["default"])(linkEle).call(linkEle, function (ele) {
        ele.innerText = ele.href;
      });

      if (range.insertNode) {
        range.deleteContents();
        range.insertNode(fragment);
      }

      editor.selection.clearWindowSelectionRange();
      return;
    } // table 中（td、th），待开发。。。


    if (!pasteHtml) {
      return;
    }

    try {
      // firefox 中，获取的 pasteHtml 可能是没有 <ul> 包裹的 <li>
      // 因此执行 insertHTML 会报错
      if (pasteTextHandle && util_1.isFunction(pasteTextHandle)) {
        // 用户自定义过滤处理粘贴内容
        pasteHtml = '' + (pasteTextHandle(pasteHtml) || ''); // html
      } // 粘贴的html的是否是css的style样式


      var isCssStyle = /[\.\#\@]?\w+[ ]+\{[^}]*\}/.test(pasteHtml); // eslint-disable-line
      // 经过处理后还是包含暴露的css样式则直接插入它的text

      if (isCssStyle && pasteFilterStyle) {
        editor.cmd["do"]('insertHTML', "" + formatHtml(pasteText)); // text
      } else {
        var html = formatHtml(pasteHtml); // 如果是段落，为了兼容 firefox 和 chrome差异，自定义插入

        if (isParagraphHtml(html)) {
          var $textEl = editor.$textElem;
          editor.cmd["do"]('insertHTML', html); // 全选的情况下覆盖原有内容

          if ($textEl.equal($selectionElem)) {
            // 更新选区
            editor.selection.createEmptyRange();
            return;
          } // 如果选区是空段落，移除空段落


          if (isEmptyParagraph($topElem)) {
            $topElem.remove();
          }
        } else {
          editor.cmd["do"]('insertHTML', html); // 如果用户从百度等网站点击复制得到的图片是一串img标签且待src的http地址
          // 见 https://github.com/wangeditor-team/wangEditor/issues/3119
          // 如果是走用户定义的图片上传逻辑
          // const isHasOnlyImgEleReg = /^<img [^>]*src=['"]([^'"]+)[^>]*>$/g
          // if (!isHasOnlyImgEleReg.test(html)) {
          //     editor.cmd.do('insertHTML', html)
          // }
        }
      }
    } catch (ex) {
      // 此时使用 pasteText 来兼容一下
      if (pasteTextHandle && util_1.isFunction(pasteTextHandle)) {
        // 用户自定义过滤处理粘贴内容
        pasteText = '' + (pasteTextHandle(pasteText) || '');
      }

      editor.cmd["do"]('insertHTML', "" + formatHtml(pasteText)); // text
    }
  }

  pasteEvents.push(fn);
}

exports["default"] = pasteTextHtml;

/***/ }),
/* 292 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 将粘贴的 html 字符串，转换为正确、简洁的 html 代码。剔除不必要的标签和属性。
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _trim = _interopRequireDefault(__webpack_require__(17));

var _forEach = _interopRequireDefault(__webpack_require__(4));

var _includes = _interopRequireDefault(__webpack_require__(28));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var tags_1 = __webpack_require__(293);

var simplehtmlparser_js_1 = tslib_1.__importDefault(__webpack_require__(297));
/**
 * 过滤掉空 span
 * @param html html
 */


function filterEmptySpan(html) {
  var regForReplace = /<span>.*?<\/span>/gi;
  var regForMatch = /<span>(.*?)<\/span>/;
  return html.replace(regForReplace, function (s) {
    // s 是单个 span ，如 <span>文字</span>
    var result = s.match(regForMatch);
    if (result == null) return '';
    return result[1];
  });
}
/**
 * 是否忽略标签
 * @param tag tag
 * @param ignoreImg 是否忽略 img 标签
 */


function isIgnoreTag(tag, ignoreImg) {
  var _context;

  tag = (0, _trim["default"])(_context = tag.toLowerCase()).call(_context); // 忽略的标签

  if (tags_1.IGNORE_TAGS.has(tag)) {
    return true;
  } // 是否忽略图片


  if (ignoreImg) {
    if (tag === 'img') {
      return true;
    }
  }

  return false;
}
/**
 * 为 tag 生成 html 字符串，开始部分
 * @param tag tag
 * @param attrs 属性
 */


function genStartHtml(tag, attrs) {
  var result = ''; // tag < 符号

  result = "<" + tag; // 拼接属性

  var attrStrArr = [];
  (0, _forEach["default"])(attrs).call(attrs, function (attr) {
    attrStrArr.push(attr.name + "=\"" + attr.value + "\"");
  });

  if (attrStrArr.length > 0) {
    result = result + ' ' + attrStrArr.join(' ');
  } // tag > 符号


  var isEmpty = tags_1.EMPTY_TAGS.has(tag); // 没有子节点或文本的标签，如 img

  result = result + (isEmpty ? '/' : '') + '>';
  return result;
}
/**
 * 为 tag 生成 html 字符串，结尾部分
 * @param tag tag
 */


function genEndHtml(tag) {
  return "</" + tag + ">";
}
/**
 * 处理粘贴的 html
 * @param html html 字符串
 * @param filterStyle 是否过滤 style 样式
 * @param ignoreImg 是否忽略 img 标签
 */


function parseHtml(html, filterStyle, ignoreImg) {
  if (filterStyle === void 0) {
    filterStyle = true;
  }

  if (ignoreImg === void 0) {
    ignoreImg = false;
  }

  var resultArr = []; // 存储结果，数组形式，最后再 join
  // 当前正在处理的标签，以及记录和清除的方法

  var CUR_TAG = '';

  function markTagStart(tag) {
    tag = (0, _trim["default"])(tag).call(tag);
    if (!tag) return;
    if (tags_1.EMPTY_TAGS.has(tag)) return; // 内容为空的标签，如 img ，不用记录

    CUR_TAG = tag;
  }

  function markTagEnd() {
    CUR_TAG = '';
  } // 能通过 'text/html' 格式获取 html


  var htmlParser = new simplehtmlparser_js_1["default"]();
  htmlParser.parse(html, {
    startElement: function startElement(tag, attrs) {
      // 首先，标记开始
      markTagStart(tag); // 忽略的标签

      if (isIgnoreTag(tag, ignoreImg)) {
        return;
      } // 找出该标签必须的属性（其他的属性忽略）


      var necessaryAttrKeys = tags_1.NECESSARY_ATTRS.get(tag) || [];
      var attrsForTag = [];
      (0, _forEach["default"])(attrs).call(attrs, function (attr) {
        // 属性名
        var name = attr.name; // style 单独处理

        if (name === 'style') {
          // 保留 style 样式
          if (!filterStyle) {
            attrsForTag.push(attr);
          }

          return;
        } // 除了 style 之外的其他属性


        if ((0, _includes["default"])(necessaryAttrKeys).call(necessaryAttrKeys, name) === false) {
          // 不是必须的属性，忽略
          return;
        }

        attrsForTag.push(attr);
      }); // 拼接为 HTML 标签

      var html = genStartHtml(tag, attrsForTag);
      resultArr.push(html);
    },
    characters: function characters(str) {
      if (!str) {
        return;
      } // 忽略的标签


      if (isIgnoreTag(CUR_TAG, ignoreImg)) return;
      resultArr.push(str);
    },
    endElement: function endElement(tag) {
      // 忽略的标签
      if (isIgnoreTag(tag, ignoreImg)) {
        return;
      } // 拼接为 HTML 标签


      var html = genEndHtml(tag);
      resultArr.push(html); // 最后，标记结束

      markTagEnd();
    },
    comment: function comment(str) {
      /* 注释，不做处理 */
      markTagStart(str);
    }
  });
  var result = resultArr.join(''); // 转换为字符串
  // 过滤掉空 span 标签

  result = filterEmptySpan(result);
  return result;
}

exports["default"] = parseHtml;

/***/ }),
/* 293 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 粘贴相关的 tags
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _set = _interopRequireDefault(__webpack_require__(132));

var _map = _interopRequireDefault(__webpack_require__(121));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.TOP_LEVEL_TAGS = exports.EMPTY_TAGS = exports.NECESSARY_ATTRS = exports.IGNORE_TAGS = void 0; // 忽略的标签

exports.IGNORE_TAGS = new _set["default"](['doctype', '!doctype', 'html', 'head', 'meta', 'body', 'script', 'style', 'link', 'frame', 'iframe', 'title', 'svg', 'center', 'o:p']); // 指定标签必要的属性

exports.NECESSARY_ATTRS = new _map["default"]([['img', ['src', 'alt']], ['a', ['href', 'target']], ['td', ['colspan', 'rowspan']], ['th', ['colspan', 'rowspan']]]); // 没有子节点或文本的标签

exports.EMPTY_TAGS = new _set["default"](['area', 'base', 'basefont', 'br', 'col', 'hr', 'img', 'input', 'isindex', 'embed']); // 编辑区域顶级节点

exports.TOP_LEVEL_TAGS = new _set["default"](['h1', 'h2', 'h3', 'h4', 'h5', 'p', 'ul', 'ol', 'table', 'blockquote', 'pre', 'hr', 'form']);

/***/ }),
/* 294 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(295);

module.exports = parent;


/***/ }),
/* 295 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(296);
__webpack_require__(61);
__webpack_require__(50);
__webpack_require__(54);
var path = __webpack_require__(9);

module.exports = path.Set;


/***/ }),
/* 296 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var collection = __webpack_require__(122);
var collectionStrong = __webpack_require__(124);

// `Set` constructor
// https://tc39.github.io/ecma262/#sec-set-objects
module.exports = collection('Set', function (init) {
  return function Set() { return init(this, arguments.length ? arguments[0] : undefined); };
}, collectionStrong);


/***/ }),
/* 297 */
/***/ (function(module, exports) {

// Copyright 2004 Erik Arvidsson. All Rights Reserved.
//
// This code is triple licensed using Apache Software License 2.0,
// Mozilla Public License or GNU Public License
//
///////////////////////////////////////////////////////////////////////////////
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License.  You may obtain a copy
// of the License at http://www.apache.org/licenses/LICENSE-2.0
//
///////////////////////////////////////////////////////////////////////////////
//
// The contents of this file are subject to the Mozilla Public License
// Version 1.1 (the "License"); you may not use this file except in
// compliance with the License. You may obtain a copy of the License at
// http://www.mozilla.org/MPL/
//
// Software distributed under the License is distributed on an "AS IS"
// basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
// License for the specific language governing rights and limitations
// under the License.
//
// The Original Code is Simple HTML Parser.
//
// The Initial Developer of the Original Code is Erik Arvidsson.
// Portions created by Erik Arvidssson are Copyright (C) 2004. All Rights
// Reserved.
//
///////////////////////////////////////////////////////////////////////////////
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
//
///////////////////////////////////////////////////////////////////////////////

/*
var handler ={
	startElement:   function (sTagName, oAttrs) {},
	endElement:     function (sTagName) {},
    characters:		function (s) {},
    comment:		function (s) {}
};
*/

function SimpleHtmlParser() {}

SimpleHtmlParser.prototype = {
    handler: null,

    // regexps

    startTagRe: /^<([^>\s\/]+)((\s+[^=>\s]+(\s*=\s*((\"[^"]*\")|(\'[^']*\')|[^>\s]+))?)*)\s*\/?\s*>/m,
    endTagRe: /^<\/([^>\s]+)[^>]*>/m,
    attrRe: /([^=\s]+)(\s*=\s*((\"([^"]*)\")|(\'([^']*)\')|[^>\s]+))?/gm,

    parse: function (s, oHandler) {
        if (oHandler) this.contentHandler = oHandler

        var i = 0
        var res, lc, lm, rc, index
        var treatAsChars = false
        var oThis = this
        while (s.length > 0) {
            // Comment
            if (s.substring(0, 4) == '<!--') {
                index = s.indexOf('-->')
                if (index != -1) {
                    this.contentHandler.comment(s.substring(4, index))
                    s = s.substring(index + 3)
                    treatAsChars = false
                } else {
                    treatAsChars = true
                }
            }

            // end tag
            else if (s.substring(0, 2) == '</') {
                if (this.endTagRe.test(s)) {
                    lc = RegExp.leftContext
                    lm = RegExp.lastMatch
                    rc = RegExp.rightContext

                    lm.replace(this.endTagRe, function () {
                        return oThis.parseEndTag.apply(oThis, arguments)
                    })

                    s = rc
                    treatAsChars = false
                } else {
                    treatAsChars = true
                }
            }
            // start tag
            else if (s.charAt(0) == '<') {
                if (this.startTagRe.test(s)) {
                    lc = RegExp.leftContext
                    lm = RegExp.lastMatch
                    rc = RegExp.rightContext

                    lm.replace(this.startTagRe, function () {
                        return oThis.parseStartTag.apply(oThis, arguments)
                    })

                    s = rc
                    treatAsChars = false
                } else {
                    treatAsChars = true
                }
            }

            if (treatAsChars) {
                index = s.indexOf('<')
                if (index == -1) {
                    this.contentHandler.characters(s)
                    s = ''
                } else {
                    this.contentHandler.characters(s.substring(0, index))
                    s = s.substring(index)
                }
            }

            treatAsChars = true
        }
    },

    parseStartTag: function (sTag, sTagName, sRest) {
        var attrs = this.parseAttributes(sTagName, sRest)
        this.contentHandler.startElement(sTagName, attrs)
    },

    parseEndTag: function (sTag, sTagName) {
        this.contentHandler.endElement(sTagName)
    },

    parseAttributes: function (sTagName, s) {
        var oThis = this
        var attrs = []
        s.replace(this.attrRe, function (a0, a1, a2, a3, a4, a5, a6, a7) {
            attrs.push(oThis.parseAttribute(sTagName, a0, a1, a2, a3, a4, a5, a6, a7))
        })
        return attrs
    },

    parseAttribute: function (sTagName, sAttribute, sName) {
        var value = ''
        if (arguments[7]) value = arguments[8]
        else if (arguments[5]) value = arguments[6]
        else if (arguments[3]) value = arguments[4]

        var empty = !value && !arguments[3]
        return { name: sName, value: empty ? null : value }
    },
}

// export default SimpleHtmlParser
module.exports = SimpleHtmlParser


/***/ }),
/* 298 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 图片点击后选区更新到img的位置
 * @author tonghan
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
/**
 * 图片点击后选区更新到img的位置
 * @param editor 编辑器实例
 * @param imgClickEvents delete 键 up 时的 hooks
 */

function imgClickActive(editor, imgClickEvents) {
  function clickFn($img) {
    editor.selection.createRangeByElem($img);
    editor.selection.restoreSelection();
  }

  imgClickEvents.push(clickFn);
}

exports["default"] = imgClickActive;

/***/ }),
/* 299 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 获取子元素的 JSON 格式数据
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var util_1 = __webpack_require__(6);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));
/**
 * 获取子元素的 JSON 格式数据
 * @param $elem DOM 节点
 */


function getChildrenJSON($elem) {
  var result = []; // 存储结果

  var $children = $elem.childNodes() || []; // 注意 childNodes() 可以获取文本节点

  (0, _forEach["default"])($children).call($children, function (curElem) {
    var elemResult;
    var nodeType = curElem.nodeType; // 文本节点

    if (nodeType === 3) {
      elemResult = curElem.textContent || '';
      elemResult = util_1.replaceHtmlSymbol(elemResult);
    } // 普通 DOM 节点


    if (nodeType === 1) {
      elemResult = {};
      elemResult = elemResult; // tag

      elemResult.tag = curElem.nodeName.toLowerCase(); // attr

      var attrData = [];
      var attrList = curElem.attributes;
      var attrListLength = attrList.length || 0;

      for (var i = 0; i < attrListLength; i++) {
        var attr = attrList[i];
        attrData.push({
          name: attr.name,
          value: attr.value
        });
      }

      elemResult.attrs = attrData; // children（递归）

      elemResult.children = getChildrenJSON(dom_core_1["default"](curElem));
    }

    if (elemResult) {
      result.push(elemResult);
    }
  });
  return result;
}

exports["default"] = getChildrenJSON;

/***/ }),
/* 300 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 从nodeList json格式中遍历生成dom元素
 * @author zhengwenjian
 */

var _interopRequireDefault = __webpack_require__(0);

var _typeof2 = _interopRequireDefault(__webpack_require__(92));

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

function getHtmlByNodeList(nodeList, parent) {
  if (parent === void 0) {
    parent = document.createElement('div');
  } // 设置一个父节点存储所有子节点


  var root = parent; // 遍历节点JSON

  (0, _forEach["default"])(nodeList).call(nodeList, function (item) {
    var elem; // 当为文本节点时

    if (typeof item === 'string') {
      elem = document.createTextNode(item);
    } // 当为普通节点时


    if ((0, _typeof2["default"])(item) === 'object') {
      var _context;

      elem = document.createElement(item.tag);
      (0, _forEach["default"])(_context = item.attrs).call(_context, function (attr) {
        dom_core_1["default"](elem).attr(attr.name, attr.value);
      }); // 有子节点时递归将子节点加入当前节点

      if (item.children && item.children.length > 0) {
        getHtmlByNodeList(item.children, elem.getRootNode());
      }
    }

    elem && root.appendChild(elem);
  });
  return dom_core_1["default"](root);
}

exports["default"] = getHtmlByNodeList;

/***/ }),
/* 301 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description Menus 菜单栏 入口文件
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _isArray = _interopRequireDefault(__webpack_require__(89));

var _filter = _interopRequireDefault(__webpack_require__(70));

var _includes = _interopRequireDefault(__webpack_require__(28));

var _keys = _interopRequireDefault(__webpack_require__(302));

var _forEach = _interopRequireDefault(__webpack_require__(4));

var _entries = _interopRequireDefault(__webpack_require__(94));

var _some = _interopRequireDefault(__webpack_require__(133));

var _setTimeout2 = _interopRequireDefault(__webpack_require__(46));

var _bind = _interopRequireDefault(__webpack_require__(57));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var index_1 = tslib_1.__importDefault(__webpack_require__(87));

var menu_list_1 = tslib_1.__importDefault(__webpack_require__(314));

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3)); // import { MenuActive } from './menu-constructors/Menu'


var Menus =
/** @class */
function () {
  function Menus(editor) {
    this.editor = editor;
    this.menuList = [];
    this.constructorList = menu_list_1["default"]; // 所有菜单构造函数的列表
  }
  /**
   * 自定义添加菜单
   * @param key 菜单 key ，和 editor.config.menus 对应
   * @param Menu 菜单构造函数
   */


  Menus.prototype.extend = function (key, Menu) {
    if (!Menu || typeof Menu !== 'function') return;
    this.constructorList[key] = Menu;
  }; // 初始化菜单


  Menus.prototype.init = function () {
    var _context, _context2;

    var _this = this; // 从用户配置的 menus 入手，看需要初始化哪些菜单


    var config = this.editor.config; // 排除exclude包含的菜单

    var excludeMenus = config.excludeMenus;
    if ((0, _isArray["default"])(excludeMenus) === false) excludeMenus = [];
    config.menus = (0, _filter["default"])(_context = config.menus).call(_context, function (key) {
      return (0, _includes["default"])(excludeMenus).call(excludeMenus, key) === false;
    }); // 排除自扩展中exclude包含的菜单

    var CustomMenuKeysList = (0, _keys["default"])(index_1["default"].globalCustomMenuConstructorList);
    CustomMenuKeysList = (0, _filter["default"])(CustomMenuKeysList).call(CustomMenuKeysList, function (key) {
      return (0, _includes["default"])(excludeMenus).call(excludeMenus, key);
    });
    (0, _forEach["default"])(CustomMenuKeysList).call(CustomMenuKeysList, function (key) {
      delete index_1["default"].globalCustomMenuConstructorList[key];
    });
    (0, _forEach["default"])(_context2 = config.menus).call(_context2, function (menuKey) {
      var MenuConstructor = _this.constructorList[menuKey]; // 暂用 any ，后面再替换

      _this._initMenuList(menuKey, MenuConstructor);
    }); // 全局注册

    for (var _i = 0, _a = (0, _entries["default"])(index_1["default"].globalCustomMenuConstructorList); _i < _a.length; _i++) {
      var _b = _a[_i],
          menuKey = _b[0],
          menuFun = _b[1];
      var MenuConstructor = menuFun; // 暂用 any ，后面再替换

      this._initMenuList(menuKey, MenuConstructor);
    } // 渲染 DOM


    this._addToToolbar();

    if (config.showMenuTooltips) {
      // 添加菜单栏tooltips
      this._bindMenuTooltips();
    }
  };
  /**
   * 创建 menu 实例，并放到 menuList 中
   * @param menuKey 菜单 key ，和 editor.config.menus 对应
   * @param MenuConstructor 菜单构造函数
   */


  Menus.prototype._initMenuList = function (menuKey, MenuConstructor) {
    var _context3;

    if (MenuConstructor == null || typeof MenuConstructor !== 'function') {
      // 必须是 class
      return;
    }

    if ((0, _some["default"])(_context3 = this.menuList).call(_context3, function (menu) {
      return menu.key === menuKey;
    })) {
      console.warn('菜单名称重复:' + menuKey);
    } else {
      var m = new MenuConstructor(this.editor);
      m.key = menuKey;
      this.menuList.push(m);
    }
  }; // 绑定菜单栏tooltips


  Menus.prototype._bindMenuTooltips = function () {
    var editor = this.editor;
    var $toolbarElem = editor.$toolbarElem;
    var config = editor.config; // 若isTooltipShowTop为true则伪元素为下三角，反之为上三角

    var menuTooltipPosition = config.menuTooltipPosition;
    var $tooltipEl = dom_core_1["default"]("<div class=\"w-e-menu-tooltip w-e-menu-tooltip-" + menuTooltipPosition + "\">\n            <div class=\"w-e-menu-tooltip-item-wrapper\">\n              <div></div>\n            </div>\n          </div>");
    $tooltipEl.css('visibility', 'hidden');
    $toolbarElem.append($tooltipEl); // 设置 z-index

    $tooltipEl.css('z-index', editor.zIndex.get('tooltip'));
    var showTimeoutId = 0; // 定时器，延时200ms显示tooltips
    // 清空计时器

    function clearShowTimeoutId() {
      if (showTimeoutId) {
        clearTimeout(showTimeoutId);
      }
    } // 隐藏tooltip


    function hide() {
      clearShowTimeoutId();
      $tooltipEl.css('visibility', 'hidden');
    } // 事件监听


    $toolbarElem.on('mouseover', function (e) {
      var target = e.target;
      var $target = dom_core_1["default"](target);
      var title;
      var $menuEl;

      if ($target.isContain($toolbarElem)) {
        hide();
        return;
      }

      if ($target.parentUntil('.w-e-droplist') != null) {
        // 处于droplist中时隐藏
        hide();
      } else {
        if ($target.attr('data-title')) {
          title = $target.attr('data-title');
          $menuEl = $target;
        } else {
          var $parent = $target.parentUntil('.w-e-menu');

          if ($parent != null) {
            title = $parent.attr('data-title');
            $menuEl = $parent;
          }
        }
      }

      if (title && $menuEl) {
        clearShowTimeoutId();
        var targetOffset = $menuEl.getOffsetData();
        $tooltipEl.text(editor.i18next.t('menus.title.' + title));
        var tooltipOffset = $tooltipEl.getOffsetData();
        var left = targetOffset.left + targetOffset.width / 2 - tooltipOffset.width / 2;
        $tooltipEl.css('left', left + "px"); // 2. 高度设置

        if (menuTooltipPosition === 'up') {
          $tooltipEl.css('top', targetOffset.top - tooltipOffset.height - 8 + "px");
        } else if (menuTooltipPosition === 'down') {
          $tooltipEl.css('top', targetOffset.top + targetOffset.height + 8 + "px");
        }

        showTimeoutId = (0, _setTimeout2["default"])(function () {
          $tooltipEl.css('visibility', 'visible');
        }, 200);
      } else {
        hide();
      }
    }).on('mouseleave', function () {
      hide();
    });
  }; // 添加到菜单栏


  Menus.prototype._addToToolbar = function () {
    var _context4;

    var editor = this.editor;
    var $toolbarElem = editor.$toolbarElem; // 遍历添加到 DOM

    (0, _forEach["default"])(_context4 = this.menuList).call(_context4, function (menu) {
      var $elem = menu.$elem;

      if ($elem) {
        $toolbarElem.append($elem);
      }
    });
  };
  /**
   * 获取菜单对象
   * @param 菜单名称 小写
   * @return Menus 菜单对象
   */


  Menus.prototype.menuFind = function (key) {
    var menuList = this.menuList;

    for (var i = 0, l = menuList.length; i < l; i++) {
      if (menuList[i].key === key) return menuList[i];
    }

    return menuList[0];
  };
  /**
   * @description 修改菜单激活状态
   */


  Menus.prototype.changeActive = function () {
    var _context5;

    (0, _forEach["default"])(_context5 = this.menuList).call(_context5, function (menu) {
      var _context6;

      (0, _setTimeout2["default"])((0, _bind["default"])(_context6 = menu.tryChangeActive).call(_context6, menu), 100); // 暂用 any ，后面再替换
    });
  };

  return Menus;
}();

exports["default"] = Menus;

/***/ }),
/* 302 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(303);

/***/ }),
/* 303 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(304);

module.exports = parent;


/***/ }),
/* 304 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(305);
var path = __webpack_require__(9);

module.exports = path.Object.keys;


/***/ }),
/* 305 */
/***/ (function(module, exports, __webpack_require__) {

var $ = __webpack_require__(5);
var toObject = __webpack_require__(31);
var nativeKeys = __webpack_require__(52);
var fails = __webpack_require__(11);

var FAILS_ON_PRIMITIVES = fails(function () { nativeKeys(1); });

// `Object.keys` method
// https://tc39.github.io/ecma262/#sec-object.keys
$({ target: 'Object', stat: true, forced: FAILS_ON_PRIMITIVES }, {
  keys: function keys(it) {
    return nativeKeys(toObject(it));
  }
});


/***/ }),
/* 306 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(307);

module.exports = parent;


/***/ }),
/* 307 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(308);
var path = __webpack_require__(9);

module.exports = path.Object.entries;


/***/ }),
/* 308 */
/***/ (function(module, exports, __webpack_require__) {

var $ = __webpack_require__(5);
var $entries = __webpack_require__(309).entries;

// `Object.entries` method
// https://tc39.github.io/ecma262/#sec-object.entries
$({ target: 'Object', stat: true }, {
  entries: function entries(O) {
    return $entries(O);
  }
});


/***/ }),
/* 309 */
/***/ (function(module, exports, __webpack_require__) {

var DESCRIPTORS = __webpack_require__(14);
var objectKeys = __webpack_require__(52);
var toIndexedObject = __webpack_require__(30);
var propertyIsEnumerable = __webpack_require__(59).f;

// `Object.{ entries, values }` methods implementation
var createMethod = function (TO_ENTRIES) {
  return function (it) {
    var O = toIndexedObject(it);
    var keys = objectKeys(O);
    var length = keys.length;
    var i = 0;
    var result = [];
    var key;
    while (length > i) {
      key = keys[i++];
      if (!DESCRIPTORS || propertyIsEnumerable.call(O, key)) {
        result.push(TO_ENTRIES ? [key, O[key]] : O[key]);
      }
    }
    return result;
  };
};

module.exports = {
  // `Object.entries` method
  // https://tc39.github.io/ecma262/#sec-object.entries
  entries: createMethod(true),
  // `Object.values` method
  // https://tc39.github.io/ecma262/#sec-object.values
  values: createMethod(false)
};


/***/ }),
/* 310 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(311);

module.exports = parent;


/***/ }),
/* 311 */
/***/ (function(module, exports, __webpack_require__) {

var some = __webpack_require__(312);

var ArrayPrototype = Array.prototype;

module.exports = function (it) {
  var own = it.some;
  return it === ArrayPrototype || (it instanceof Array && own === ArrayPrototype.some) ? some : own;
};


/***/ }),
/* 312 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(313);
var entryVirtual = __webpack_require__(15);

module.exports = entryVirtual('Array').some;


/***/ }),
/* 313 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var $ = __webpack_require__(5);
var $some = __webpack_require__(32).some;
var arrayMethodIsStrict = __webpack_require__(67);
var arrayMethodUsesToLength = __webpack_require__(22);

var STRICT_METHOD = arrayMethodIsStrict('some');
var USES_TO_LENGTH = arrayMethodUsesToLength('some');

// `Array.prototype.some` method
// https://tc39.github.io/ecma262/#sec-array.prototype.some
$({ target: 'Array', proto: true, forced: !STRICT_METHOD || !USES_TO_LENGTH }, {
  some: function some(callbackfn /* , thisArg */) {
    return $some(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
  }
});


/***/ }),
/* 314 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 所有菜单的构造函数
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var index_1 = tslib_1.__importDefault(__webpack_require__(315));

var index_2 = tslib_1.__importDefault(__webpack_require__(316));

var index_3 = tslib_1.__importDefault(__webpack_require__(321));

var index_4 = tslib_1.__importDefault(__webpack_require__(326));

var index_5 = tslib_1.__importDefault(__webpack_require__(327));

var index_6 = tslib_1.__importDefault(__webpack_require__(328));

var index_7 = tslib_1.__importDefault(__webpack_require__(329));

var font_size_1 = tslib_1.__importDefault(__webpack_require__(331));

var index_8 = tslib_1.__importDefault(__webpack_require__(333));

var index_9 = tslib_1.__importDefault(__webpack_require__(334));

var index_10 = tslib_1.__importDefault(__webpack_require__(337));

var index_11 = tslib_1.__importDefault(__webpack_require__(338));

var index_12 = tslib_1.__importDefault(__webpack_require__(339));

var index_13 = tslib_1.__importDefault(__webpack_require__(350));

var index_14 = tslib_1.__importDefault(__webpack_require__(365));

var index_15 = tslib_1.__importDefault(__webpack_require__(369));

var index_16 = tslib_1.__importDefault(__webpack_require__(137));

var index_17 = tslib_1.__importDefault(__webpack_require__(378));

var index_18 = tslib_1.__importDefault(__webpack_require__(380));

var index_19 = tslib_1.__importDefault(__webpack_require__(381));

var index_20 = tslib_1.__importDefault(__webpack_require__(382));

var code_1 = tslib_1.__importDefault(__webpack_require__(401));

var index_21 = tslib_1.__importDefault(__webpack_require__(406));

var todo_1 = tslib_1.__importDefault(__webpack_require__(409));

exports["default"] = {
  bold: index_1["default"],
  head: index_2["default"],
  italic: index_4["default"],
  link: index_3["default"],
  underline: index_5["default"],
  strikeThrough: index_6["default"],
  fontName: index_7["default"],
  fontSize: font_size_1["default"],
  justify: index_8["default"],
  quote: index_9["default"],
  backColor: index_10["default"],
  foreColor: index_11["default"],
  video: index_12["default"],
  image: index_13["default"],
  indent: index_14["default"],
  emoticon: index_15["default"],
  list: index_16["default"],
  lineHeight: index_17["default"],
  undo: index_18["default"],
  redo: index_19["default"],
  table: index_20["default"],
  code: code_1["default"],
  splitLine: index_21["default"],
  todo: todo_1["default"]
};

/***/ }),
/* 315 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 加粗
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var BtnMenu_1 = tslib_1.__importDefault(__webpack_require__(23));

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var Bold =
/** @class */
function (_super) {
  tslib_1.__extends(Bold, _super);

  function Bold(editor) {
    var _this = this;

    var $elem = dom_core_1["default"]("<div class=\"w-e-menu\" data-title=\"\u52A0\u7C97\">\n                <i class=\"w-e-icon-bold\"></i>\n            </div>");
    _this = _super.call(this, $elem, editor) || this;
    return _this;
  }
  /**
   * 点击事件
   */


  Bold.prototype.clickHandler = function () {
    var editor = this.editor;
    var isSelectEmpty = editor.selection.isSelectionEmpty();

    if (isSelectEmpty) {
      // 选区范围是空的，插入并选中一个“空白”
      editor.selection.createEmptyRange();
    } // 执行 bold 命令


    editor.cmd["do"]('bold');

    if (isSelectEmpty) {
      // 需要将选区范围折叠起来
      editor.selection.collapseRange();
      editor.selection.restoreSelection();
    }
  };
  /**
   * 尝试修改菜单激活状态
   */


  Bold.prototype.tryChangeActive = function () {
    var editor = this.editor;

    if (editor.cmd.queryCommandState('bold')) {
      this.active();
    } else {
      this.unActive();
    }
  };

  return Bold;
}(BtnMenu_1["default"]);

exports["default"] = Bold;

/***/ }),
/* 316 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 标题
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _indexOf = _interopRequireDefault(__webpack_require__(27));

var _find = _interopRequireDefault(__webpack_require__(29));

var _forEach = _interopRequireDefault(__webpack_require__(4));

var _stringify = _interopRequireDefault(__webpack_require__(317));

var _includes = _interopRequireDefault(__webpack_require__(28));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var DropListMenu_1 = tslib_1.__importDefault(__webpack_require__(24));

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var util_1 = __webpack_require__(6);

var const_1 = __webpack_require__(7);

var Head =
/** @class */
function (_super) {
  tslib_1.__extends(Head, _super);

  function Head(editor) {
    var _this = this;

    var $elem = dom_core_1["default"]('<div class="w-e-menu" data-title="标题"><i class="w-e-icon-header"></i></div>');
    var dropListConf = {
      width: 100,
      title: '设置标题',
      type: 'list',
      list: [{
        $elem: dom_core_1["default"]('<h1>H1</h1>'),
        value: '<h1>'
      }, {
        $elem: dom_core_1["default"]('<h2>H2</h2>'),
        value: '<h2>'
      }, {
        $elem: dom_core_1["default"]('<h3>H3</h3>'),
        value: '<h3>'
      }, {
        $elem: dom_core_1["default"]('<h4>H4</h4>'),
        value: '<h4>'
      }, {
        $elem: dom_core_1["default"]('<h5>H5</h5>'),
        value: '<h5>'
      }, {
        $elem: dom_core_1["default"]("<p>" + editor.i18next.t('menus.dropListMenu.head.正文') + "</p>"),
        value: '<p>'
      }],
      clickHandler: function clickHandler(value) {
        // 注意 this 是指向当前的 Head 对象
        _this.command(value);
      }
    };
    _this = _super.call(this, $elem, editor, dropListConf) || this;
    var onCatalogChange = editor.config.onCatalogChange; // 未配置目录change监听回调时不运行下面操作

    if (onCatalogChange) {
      _this.oldCatalogs = [];

      _this.addListenerCatalog(); // 监听文本框编辑时的大纲信息


      _this.getCatalogs(); // 初始有值的情况获取一遍大纲信息

    }

    return _this;
  }
  /**
   * 执行命令
   * @param value value
   */


  Head.prototype.command = function (value) {
    var editor = this.editor;
    var $selectionElem = editor.selection.getSelectionContainerElem();

    if ($selectionElem && editor.$textElem.equal($selectionElem)) {
      // 不能选中多行来设置标题，否则会出现问题
      // 例如选中的是 <p>xxx</p><p>yyy</p> 来设置标题，设置之后会成为 <h1>xxx<br>yyy</h1> 不符合预期
      this.setMultilineHead(value);
    } else {
      var _context;

      // 选中内容包含序列，code，表格，分割线时不处理
      if ((0, _indexOf["default"])(_context = ['OL', 'UL', 'LI', 'TABLE', 'TH', 'TR', 'CODE', 'HR']).call(_context, dom_core_1["default"]($selectionElem).getNodeName()) > -1) {
        return;
      }

      editor.cmd["do"]('formatBlock', value);
    } // 标题设置成功且不是<p>正文标签就配置大纲id


    value !== '<p>' && this.addUidForSelectionElem();
  };
  /**
   * 为标题设置大纲
   */


  Head.prototype.addUidForSelectionElem = function () {
    var editor = this.editor;
    var tag = editor.selection.getSelectionContainerElem();
    var id = util_1.getRandomCode(); // 默认五位数id

    dom_core_1["default"](tag).attr('id', id);
  };
  /**
   * 监听change事件来返回大纲信息
   */


  Head.prototype.addListenerCatalog = function () {
    var _this = this;

    var editor = this.editor;
    editor.txt.eventHooks.changeEvents.push(function () {
      _this.getCatalogs();
    });
  };
  /**
   * 获取大纲数组
   */


  Head.prototype.getCatalogs = function () {
    var editor = this.editor;
    var $textElem = this.editor.$textElem;
    var onCatalogChange = editor.config.onCatalogChange;
    var elems = (0, _find["default"])($textElem).call($textElem, 'h1,h2,h3,h4,h5');
    var catalogs = [];
    (0, _forEach["default"])(elems).call(elems, function (elem, index) {
      var $elem = dom_core_1["default"](elem);
      var id = $elem.attr('id');
      var tag = $elem.getNodeName();
      var text = $elem.text();

      if (!id) {
        id = util_1.getRandomCode();
        $elem.attr('id', id);
      } // 标题为空的情况不生成目录


      if (!text) return;
      catalogs.push({
        tag: tag,
        id: id,
        text: text
      });
    }); // 旧目录和新目录对比是否相等，不相等则运行回调并保存新目录到旧目录变量，以方便下一次对比

    if ((0, _stringify["default"])(this.oldCatalogs) !== (0, _stringify["default"])(catalogs)) {
      this.oldCatalogs = catalogs;
      onCatalogChange && onCatalogChange(catalogs);
    }
  };
  /**
   * 设置选中的多行标题
   * @param value  需要执行的命令值
   */


  Head.prototype.setMultilineHead = function (value) {
    var _this = this;

    var _a, _b;

    var editor = this.editor;
    var $selection = editor.selection; // 初始选区的父节点

    var containerElem = (_a = $selection.getSelectionContainerElem()) === null || _a === void 0 ? void 0 : _a.elems[0]; // 白名单：用户选区里如果有该元素则不进行转换

    var _WHITE_LIST = ['IMG', 'VIDEO', 'TABLE', 'TH', 'TR', 'UL', 'OL', 'PRE', 'HR', 'BLOCKQUOTE']; // 获取选中的首、尾元素

    var startElem = dom_core_1["default"]($selection.getSelectionStartElem());
    var endElem = dom_core_1["default"]($selection.getSelectionEndElem()); // 判断用户选中元素是否为最后一个空元素，如果是将endElem指向上一个元素

    if (endElem.elems[0].outerHTML === dom_core_1["default"](const_1.EMPTY_P).elems[0].outerHTML && !endElem.elems[0].nextSibling) {
      endElem = endElem.prev();
    } // 存放选中的所有元素


    var cacheDomList = [];
    cacheDomList.push(startElem.getNodeTop(editor)); // 选中首尾元素在父级下的坐标

    var indexList = []; // 选区共同祖先元素的所有子节点

    var childList = (_b = $selection.getRange()) === null || _b === void 0 ? void 0 : _b.commonAncestorContainer.childNodes; // 找到选区的首尾元素的下标，方便最后恢复选区

    childList === null || childList === void 0 ? void 0 : (0, _forEach["default"])(childList).call(childList, function (item, index) {
      if (item === cacheDomList[0].getNode()) {
        indexList.push(index);
      }

      if (item === endElem.getNodeTop(editor).getNode()) {
        indexList.push(index);
      }
    }); // 找到首尾元素中间所包含的所有dom

    var i = 0; // 数组中的当前元素不等于选区最后一个节点时循环寻找中间节点

    while (cacheDomList[i].getNode() !== endElem.getNodeTop(editor).getNode()) {
      // 严谨性判断，是否元素为空
      if (!cacheDomList[i].elems[0]) return;
      var d = dom_core_1["default"](cacheDomList[i].next().getNode());
      cacheDomList.push(d);
      i++;
    } // 将选区内的所有子节点进行遍历生成对应的标签


    cacheDomList === null || cacheDomList === void 0 ? void 0 : (0, _forEach["default"])(cacheDomList).call(cacheDomList, function (_node, index) {
      // 判断元素是否含有白名单内的标签元素
      if (!_this.hasTag(_node, _WHITE_LIST)) {
        var $h = dom_core_1["default"](value);

        var $parentNode = _node.parent().getNode(); // 设置标签内容


        $h.html("" + _node.html()); // 插入生成的新标签

        $parentNode.insertBefore($h.getNode(), _node.getNode()); // 移除原有的标签

        _node.remove();
      }
    }); // 重新设置选区起始位置，保留拖蓝区域

    $selection.createRangeByElems(containerElem.children[indexList[0]], containerElem.children[indexList[1]]);
  };
  /**
   * 是否含有某元素
   * @param elem 需要检查的元素
   * @param whiteList 白名单
   */


  Head.prototype.hasTag = function (elem, whiteList) {
    var _this = this;

    var _a;

    if (!elem) return false;
    if ((0, _includes["default"])(whiteList).call(whiteList, elem === null || elem === void 0 ? void 0 : elem.getNodeName())) return true;
    var _flag = false;
    (_a = elem.children()) === null || _a === void 0 ? void 0 : (0, _forEach["default"])(_a).call(_a, function (child) {
      _flag = _this.hasTag(dom_core_1["default"](child), whiteList);
    });
    return _flag;
  };
  /**
   * 尝试改变菜单激活（高亮）状态
   */


  Head.prototype.tryChangeActive = function () {
    var editor = this.editor;
    var reg = /^h/i;
    var cmdValue = editor.cmd.queryCommandValue('formatBlock');

    if (reg.test(cmdValue)) {
      this.active();
    } else {
      this.unActive();
    }
  };

  return Head;
}(DropListMenu_1["default"]);

exports["default"] = Head;

/***/ }),
/* 317 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(318);

/***/ }),
/* 318 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(319);

module.exports = parent;


/***/ }),
/* 319 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(320);
var core = __webpack_require__(9);

if (!core.JSON) core.JSON = { stringify: JSON.stringify };

// eslint-disable-next-line no-unused-vars
module.exports = function stringify(it, replacer, space) {
  return core.JSON.stringify.apply(null, arguments);
};


/***/ }),
/* 320 */
/***/ (function(module, exports, __webpack_require__) {

var $ = __webpack_require__(5);
var getBuiltIn = __webpack_require__(36);
var fails = __webpack_require__(11);

var $stringify = getBuiltIn('JSON', 'stringify');
var re = /[\uD800-\uDFFF]/g;
var low = /^[\uD800-\uDBFF]$/;
var hi = /^[\uDC00-\uDFFF]$/;

var fix = function (match, offset, string) {
  var prev = string.charAt(offset - 1);
  var next = string.charAt(offset + 1);
  if ((low.test(match) && !hi.test(next)) || (hi.test(match) && !low.test(prev))) {
    return '\\u' + match.charCodeAt(0).toString(16);
  } return match;
};

var FORCED = fails(function () {
  return $stringify('\uDF06\uD834') !== '"\\udf06\\ud834"'
    || $stringify('\uDEAD') !== '"\\udead"';
});

if ($stringify) {
  // https://github.com/tc39/proposal-well-formed-stringify
  $({ target: 'JSON', stat: true, forced: FORCED }, {
    // eslint-disable-next-line no-unused-vars
    stringify: function stringify(it, replacer, space) {
      var result = $stringify.apply(null, arguments);
      return typeof result == 'string' ? result.replace(re, fix) : result;
    }
  });
}


/***/ }),
/* 321 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 链接 菜单
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _trim = _interopRequireDefault(__webpack_require__(17));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var PanelMenu_1 = tslib_1.__importDefault(__webpack_require__(38));

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var create_panel_conf_1 = tslib_1.__importDefault(__webpack_require__(322));

var is_active_1 = tslib_1.__importStar(__webpack_require__(96));

var Panel_1 = tslib_1.__importDefault(__webpack_require__(33));

var index_1 = tslib_1.__importDefault(__webpack_require__(324));

var const_1 = __webpack_require__(7);

var Link =
/** @class */
function (_super) {
  tslib_1.__extends(Link, _super);

  function Link(editor) {
    var _this = this;

    var $elem = dom_core_1["default"]('<div class="w-e-menu" data-title="链接"><i class="w-e-icon-link"></i></div>');
    _this = _super.call(this, $elem, editor) || this; // 绑定事件，如点击链接时，可以查看链接

    index_1["default"](editor);
    return _this;
  }
  /**
   * 菜单点击事件
   */


  Link.prototype.clickHandler = function () {
    var editor = this.editor;
    var $linkElem;
    /**
        @author:Gavin
        @description
            解决当全选删除编辑区内容时，点击链接没反应的问题(因为选区有问题)
          
    **/

    var $selectionElem = editor.selection.getSelectionContainerElem();
    var $textElem = editor.$textElem;
    var html = $textElem.html();
    var $txtHtml = (0, _trim["default"])(html).call(html);

    if ($txtHtml === const_1.EMPTY_P) {
      var $emptyChild = $textElem.children(); // 调整选区

      editor.selection.createRangeByElem($emptyChild, true, true); // 重新获取选区

      $selectionElem = editor.selection.getSelectionContainerElem();
    } // 判断是否是多行 多行则退出 否则会出现问题


    if ($selectionElem && editor.$textElem.equal($selectionElem)) {
      return;
    }

    if (this.isActive) {
      var text = '';
      var href = ''; // 菜单被激活，说明选区在链接里

      $linkElem = editor.selection.getSelectionContainerElem();

      if (!$linkElem) {
        return;
      }

      if ($linkElem.getNodeName() !== 'A') {
        var parentNodeA = is_active_1.getParentNodeA($linkElem);
        $linkElem = dom_core_1["default"](parentNodeA);
      }

      text = $linkElem.elems[0].innerText;
      href = $linkElem.attr('href'); // 弹出 panel

      this.createPanel(text, href);
    } else {
      // 菜单未被激活，说明选区不在链接里
      if (editor.selection.isSelectionEmpty()) {
        // 选区是空的，未选中内容
        this.createPanel('', '');
      } else {
        // 选中内容了
        this.createPanel(editor.selection.getSelectionText(), '');
      }
    }
  };
  /**
   * 创建 panel
   * @param text 文本
   * @param link 链接
   */


  Link.prototype.createPanel = function (text, link) {
    var conf = create_panel_conf_1["default"](this.editor, text, link);
    var panel = new Panel_1["default"](this, conf);
    panel.create();
  };
  /**
   * 尝试修改菜单 active 状态
   */


  Link.prototype.tryChangeActive = function () {
    var editor = this.editor;

    if (is_active_1["default"](editor)) {
      this.active();
    } else {
      this.unActive();
    }
  };

  return Link;
}(PanelMenu_1["default"]);

exports["default"] = Link;

/***/ }),
/* 322 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description link 菜单 panel tab 配置
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _includes = _interopRequireDefault(__webpack_require__(28));

var _trim = _interopRequireDefault(__webpack_require__(17));

var _find = _interopRequireDefault(__webpack_require__(29));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var util_1 = __webpack_require__(6);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var is_active_1 = tslib_1.__importStar(__webpack_require__(96));

var util_2 = __webpack_require__(323);

function default_1(editor, text, link) {
  // panel 中需要用到的id
  var inputLinkId = util_1.getRandom('input-link');
  var inputTextId = util_1.getRandom('input-text');
  var btnOkId = util_1.getRandom('btn-ok');
  var btnDelId = util_1.getRandom('btn-del'); // 是否显示“取消链接”

  var delBtnDisplay = is_active_1["default"](editor) ? 'inline-block' : 'none';
  var $selectedLink;
  /**
   * 选中整个链接元素
   */

  function selectLinkElem() {
    if (!is_active_1["default"](editor)) return;
    var $linkElem = editor.selection.getSelectionContainerElem();
    if (!$linkElem) return;
    editor.selection.createRangeByElem($linkElem);
    editor.selection.restoreSelection();
    $selectedLink = $linkElem; // 赋值给函数内全局变量
  }
  /**
   * 插入链接
   * @param text 文字
   * @param link 链接
   */


  function insertLink(text, link) {
    // fix: 修复列表下无法设置超链接的问题(替换选中文字中的标签)
    // const TagRegExp = new RegExp(/(<\/?ul>)|(<\/?li>)|(<\/?ol>)/g)
    // const resultText = text.replace(TagRegExp, '')

    /**
     * fix: 插入链接后再修改链接地址问题，会导致页面链接有问题
     *
     * 同上，列表无法插入链接的原因，是因为在insertLink, 处理text时有问题。
     */
    var resultText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;'); // Link xss

    var $elem = dom_core_1["default"]("<a target=\"_blank\">" + resultText + "</a>");
    var linkDom = $elem.elems[0]; // fix: 字符转义问题，https://xxx.org?bar=1&macro=2 => https://xxx.org?bar=1¯o=2

    linkDom.innerText = text; // 避免拼接字符串，带来的字符串嵌套问题：如: <a href=""><img src=1 xx />"> 造成xss攻击

    linkDom.href = link;

    if (is_active_1["default"](editor)) {
      // 选区处于链接中，则选中整个菜单，再执行 insertHTML
      selectLinkElem();
      editor.cmd["do"]('insertElem', $elem);
    } else {
      // 选区未处于链接中，直接插入即可
      editor.cmd["do"]('insertElem', $elem);
    }
  }
  /**
   * 取消链接
   */


  function delLink() {
    if (!is_active_1["default"](editor)) {
      return;
    } // 选中整个链接


    selectLinkElem();
    /**
     * 替换链接
     *
     * 两种情况
     * 1. 特殊标签里嵌套a，也要保留特殊标签：<b><a></a></b>  先加粗后添加链接
     * 2. a标签里面可能会含有其他元素如：b, i等，要保留： <a><b></b></a> 先添加链接后加粗
     */

    if ($selectedLink.getNodeName() === 'A') {
      var _context;

      var linkElem = $selectedLink.elems[0];
      var linkParentNode = linkElem.parentElement; // 判断父级元素是不是特殊元素

      if (linkParentNode && (0, _includes["default"])(_context = is_active_1.EXTRA_TAG).call(_context, linkParentNode.nodeName)) {
        // 将特殊元素的内容设置为a标签的内容
        linkParentNode.innerHTML = linkElem.innerHTML;
      } else {
        // 如果父级不是特殊元素，直接设置内容
        editor.cmd["do"]('insertHTML', '<span>' + linkElem.innerHTML + '</span>');
      }
    } else {
      // 如果链接上选区是特殊元素，需要获取最近的a标签，获取html结果，以保留特殊元素
      var parentNodeA = is_active_1.getParentNodeA($selectedLink);
      var selectionContent = parentNodeA.innerHTML;
      editor.cmd["do"]('insertHTML', '<span>' + selectionContent + '</span>');
    }
  }
  /**
   * 校验链接是否合法
   * @param link 链接
   */


  function checkLink(text, link) {
    //查看开发者自定义配置的返回值
    var check = editor.config.linkCheck(text, link);

    if (check === undefined) {//用户未能通过开发者的校验，且开发者不希望编辑器提示用户
    } else if (check === true) {
      //用户通过了开发者的校验
      return true;
    } else {
      //用户未能通过开发者的校验，开发者希望我们提示这一字符串
      editor.config.customAlert(check, 'warning');
    }

    return false;
  }

  var conf = {
    width: 300,
    height: 0,
    // 拼接字符串的：xss 攻击：
    //    如值为："><img src=1 onerror=alert(/xss/)>， 插入后：value=""><img src=1 onerror=alert(/xss/)>", 插入一个img元素
    // panel 中可包含多个 tab
    tabs: [{
      // tab 的标题
      title: editor.i18next.t('menus.panelMenus.link.链接'),
      // 模板
      tpl: "<div>\n                        <input\n                            id=\"" + inputTextId + "\"\n                            type=\"text\"\n                            class=\"block\"\n                            placeholder=\"" + editor.i18next.t('menus.panelMenus.link.链接文字') + "\"/>\n                        </td>\n                        <input\n                            id=\"" + inputLinkId + "\"\n                            type=\"text\"\n                            class=\"block\"\n                            placeholder=\"" + editor.i18next.t('如') + " https://...\"/>\n                        </td>\n                        <div class=\"w-e-button-container\">\n                            <button type=\"button\" id=\"" + btnOkId + "\" class=\"right\">\n                                " + editor.i18next.t('插入') + "\n                            </button>\n                            <button type=\"button\" id=\"" + btnDelId + "\" class=\"gray right\" style=\"display:" + delBtnDisplay + "\">\n                                " + editor.i18next.t('menus.panelMenus.link.取消链接') + "\n                            </button>\n                        </div>\n                    </div>",
      // 事件绑定
      events: [// 插入链接
      {
        selector: '#' + btnOkId,
        type: 'click',
        fn: function fn() {
          var _context2, _context3, _context4;

          var _a, _b; // 获取链接区间的顶层元素


          var $selectionContainerElem = editor.selection.getSelectionContainerElem();
          var $elem = $selectionContainerElem === null || $selectionContainerElem === void 0 ? void 0 : $selectionContainerElem.elems[0]; // 获取选取

          editor.selection.restoreSelection();
          var topNode = editor.selection.getSelectionRangeTopNodes()[0].getNode();
          var selection = window.getSelection(); // 执行插入链接

          var $link = dom_core_1["default"]('#' + inputLinkId);
          var $text = dom_core_1["default"]('#' + inputTextId);
          var link = (0, _trim["default"])(_context2 = $link.val()).call(_context2);
          var text = (0, _trim["default"])(_context3 = $text.val()).call(_context3);
          var html = '';

          if (selection && !(selection === null || selection === void 0 ? void 0 : selection.isCollapsed)) {
            html = (_a = util_2.insertHtml(selection, topNode)) === null || _a === void 0 ? void 0 : (0, _trim["default"])(_a).call(_a);
          } // 去除html的tag标签


          var htmlText = html === null || html === void 0 ? void 0 : html.replace(/<.*?>/g, '');
          var htmlTextLen = (_b = htmlText === null || htmlText === void 0 ? void 0 : htmlText.length) !== null && _b !== void 0 ? _b : 0; // 当input中的text的长度大于等于选区的文字时
          // 需要判断两者相同的长度的text内容是否相同
          // 相同则只需把多余的部分添加上去即可，否则使用input中的内容

          if (htmlTextLen <= text.length) {
            var startText = text.substring(0, htmlTextLen);
            var endText = text.substring(htmlTextLen);

            if (htmlText === startText) {
              text = htmlText + endText;
            }
          } // 链接为空，则不插入


          if (!link) return; // 文本为空，则用链接代替

          if (!text) text = link; // 校验链接是否满足用户的规则，若不满足则不插入

          if (!checkLink(text, link)) return;
          /**
           * 插入链接
           * 1、针对首次插入链接，利用选区插入a标签即可
           * 1、针对：<a><b>xxxx</b></a> 情况，用户操作修改或者替换链接时，编辑得到a，修改已有a标签的href
           * 2、针对：<b><a>xxxx</a></b> 情况, 用户操作修改或者替换链接时，只要修改已有a标签的href
           */
          // 选区范围是a标签，直接替换href链接即可

          if (($elem === null || $elem === void 0 ? void 0 : $elem.nodeName) === 'A') {
            $elem.setAttribute('href', link);
            $elem.innerText = text;
            return true;
          } // 不是a标签，并且为特殊元素, 需要检查是不是首次设置链接，还是已经设置过链接。


          if (($elem === null || $elem === void 0 ? void 0 : $elem.nodeName) !== 'A' && (0, _includes["default"])(_context4 = is_active_1.EXTRA_TAG).call(_context4, $elem.nodeName)) {
            var nodeA = is_active_1.getParentNodeA($selectionContainerElem); // 防止第一次设置就为特殊元素，这种情况应该为首次设置链接

            if (nodeA) {
              // 链接设置a
              nodeA.setAttribute('href', link); // 文案还是要设置刚开始的元素内的文字，比如加粗的元素，不然会将加粗替代

              $elem.innerText = text;
              return true;
            }
          } // 首次插入链接


          insertLink(text, link); // 返回 true，表示该事件执行完之后，panel 要关闭。否则 panel 不会关闭

          return true;
        },
        bindEnter: true
      }, // 取消链接
      {
        selector: '#' + btnDelId,
        type: 'click',
        fn: function fn() {
          // 执行取消链接
          delLink(); // 返回 true，表示该事件执行完之后，panel 要关闭。否则 panel 不会关闭

          return true;
        }
      }]
    }],

    /**
     * 设置input的值，分别为文案和链接地址设置值
     *
     * 利用dom 设置链接文案的值，防止回填拼接引号问题, 出现xss攻击
     *
     * @param $container 对应上面生成的dom容器
     * @param type text | link
     */
    setLinkValue: function setLinkValue($container, type) {
      var inputId = '';
      var inputValue = '';
      var inputDom; // 设置链接文案

      if (type === 'text') {
        inputId = "#" + inputTextId;
        inputValue = text;
      } // 这只链接地址


      if (type === 'link') {
        inputId = "#" + inputLinkId;
        inputValue = link;
      }

      inputDom = (0, _find["default"])($container).call($container, inputId).elems[0];
      inputDom.value = inputValue;
    }
  };
  return conf;
}

exports["default"] = default_1;

/***/ }),
/* 323 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.insertHtml = exports.createPartHtml = exports.makeHtmlString = exports.getTopNode = void 0;
/**
 * 获取除了包裹在整行区域的顶级Node
 * @param node 最外层node下的某个childNode
 * @param topText 最外层node中文本内容
 */

function getTopNode(node, topText) {
  var pointerNode = node;
  var topNode = node;

  do {
    if (pointerNode.textContent === topText) break;
    topNode = pointerNode;

    if (pointerNode.parentNode) {
      pointerNode = pointerNode === null || pointerNode === void 0 ? void 0 : pointerNode.parentNode;
    }
  } while ((pointerNode === null || pointerNode === void 0 ? void 0 : pointerNode.nodeName) !== 'P');

  return topNode;
}

exports.getTopNode = getTopNode;
/**
 * 生成html的string形式
 * @param tagName 标签名
 * @param content 需要包裹的内容
 */

function makeHtmlString(node, content) {
  var tagName = node.nodeName;
  var attr = '';

  if (node.nodeType === 3 || /^(h|H)[1-6]$/.test(tagName)) {
    return content;
  }

  if (node.nodeType === 1) {
    var style = node.getAttribute('style');
    var face = node.getAttribute('face');
    var color = node.getAttribute('color');
    if (style) attr = attr + (" style=\"" + style + "\"");
    if (face) attr = attr + (" face=\"" + face + "\"");
    if (color) attr = attr + (" color=\"" + color + "\"");
  }

  tagName = tagName.toLowerCase();
  return "<" + tagName + attr + ">" + content + "</" + tagName + ">";
}

exports.makeHtmlString = makeHtmlString;
/**
 * 生成开始或者结束位置的html字符片段
 * @param topText 选区所在的行的文本内容
 * @param node 选区给出的node节点
 * @param startPos node文本内容选取的开始位置
 * @param endPos node文本内容选取的结束位置
 */

function createPartHtml(topText, node, startPos, endPost) {
  var _a;

  var selectionContent = (_a = node.textContent) === null || _a === void 0 ? void 0 : _a.substring(startPos, endPost);
  var pointerNode = node;
  var content = '';

  do {
    content = makeHtmlString(pointerNode, selectionContent !== null && selectionContent !== void 0 ? selectionContent : '');
    selectionContent = content;
    pointerNode = pointerNode === null || pointerNode === void 0 ? void 0 : pointerNode.parentElement;
  } while (pointerNode && pointerNode.textContent !== topText);

  return content;
}

exports.createPartHtml = createPartHtml;
/**
 * 生成需要插入的html内容的字符串形式
 * @param selection 选区对象
 * @param topNode 选区所在行的顶级node节点
 */

function insertHtml(selection, topNode) {
  var _a, _b, _c, _d, _e;

  var anchorNode = selection.anchorNode,
      focusNode = selection.focusNode,
      anchorPos = selection.anchorOffset,
      focusPos = selection.focusOffset;
  var topText = (_a = topNode.textContent) !== null && _a !== void 0 ? _a : '';
  var TagArr = getContainerTag(topNode);
  var content = '';
  var startContent = '';
  var middleContent = '';
  var endContent = '';
  var startNode = anchorNode;
  var endNode = focusNode; // 用来保存 anchorNode的非p最外层节点

  var pointerNode = anchorNode; // 节点是同一个的处理

  if (anchorNode === null || anchorNode === void 0 ? void 0 : anchorNode.isEqualNode(focusNode !== null && focusNode !== void 0 ? focusNode : null)) {
    var innerContent = createPartHtml(topText, anchorNode, anchorPos, focusPos);
    innerContent = addContainer(TagArr, innerContent);
    return innerContent;
  } // 选中开始位置节点的处理


  if (anchorNode) startContent = createPartHtml(topText, anchorNode, anchorPos !== null && anchorPos !== void 0 ? anchorPos : 0); // 结束位置节点的处理

  if (focusNode) endContent = createPartHtml(topText, focusNode, 0, focusPos); // 将指针节点位置放置到开始的节点

  if (anchorNode) {
    // 获取start的非p顶级node
    startNode = getTopNode(anchorNode, topText);
  }

  if (focusNode) {
    // 获取end的非p顶级node
    endNode = getTopNode(focusNode, topText);
  } // 处于开始和结束节点位置之间的节点的处理


  pointerNode = (_b = startNode === null || startNode === void 0 ? void 0 : startNode.nextSibling) !== null && _b !== void 0 ? _b : anchorNode;

  while (!(pointerNode === null || pointerNode === void 0 ? void 0 : pointerNode.isEqualNode(endNode !== null && endNode !== void 0 ? endNode : null))) {
    var pointerNodeName = pointerNode === null || pointerNode === void 0 ? void 0 : pointerNode.nodeName;

    if (pointerNodeName === '#text') {
      middleContent = middleContent + (pointerNode === null || pointerNode === void 0 ? void 0 : pointerNode.textContent);
    } else {
      var htmlString = (_d = (_c = pointerNode === null || pointerNode === void 0 ? void 0 : pointerNode.firstChild) === null || _c === void 0 ? void 0 : _c.parentElement) === null || _d === void 0 ? void 0 : _d.innerHTML;
      if (pointerNode) middleContent = middleContent + makeHtmlString(pointerNode, htmlString !== null && htmlString !== void 0 ? htmlString : '');
    } // 解决文字和图片同一行时会触发无限循环, 到不了endNode === pointerNode条件


    var nextPointNode = (_e = pointerNode === null || pointerNode === void 0 ? void 0 : pointerNode.nextSibling) !== null && _e !== void 0 ? _e : pointerNode;
    if (nextPointNode === pointerNode) break;
    pointerNode = nextPointNode;
  }

  content = "" + startContent + middleContent + endContent; // 增加最外层包裹标签

  content = addContainer(TagArr, content);
  return content;
}

exports.insertHtml = insertHtml;
/**
 * 获取包裹在最外层的非p Node tagName 数组
 * @param node 选区所在行的node节点
 */

function getContainerTag(node) {
  var _a;

  var topText = (_a = node.textContent) !== null && _a !== void 0 ? _a : '';
  var tagArr = [];

  while ((node === null || node === void 0 ? void 0 : node.textContent) === topText) {
    if (node.nodeName !== 'P' && node.nodeName !== 'TABLE') {
      tagArr.push(node);
    }

    node = node.childNodes[0];
  }

  return tagArr;
}
/**
 * 为内容增加包裹标签
 * @param tagArr 最外层包裹的tag数组，索引越小tag越在外面
 * @param content tag要包裹的内容
 */


function addContainer(tagArr, content) {
  (0, _forEach["default"])(tagArr).call(tagArr, function (v) {
    content = makeHtmlString(v, content);
  });
  return content;
}

/***/ }),
/* 324 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 绑定链接元素的事件，入口
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var tooltip_event_1 = tslib_1.__importDefault(__webpack_require__(325));
/**
 * 绑定事件
 * @param editor 编辑器实例
 */


function bindEvent(editor) {
  // tooltip 事件
  tooltip_event_1["default"](editor);
}

exports["default"] = bindEvent;

/***/ }),
/* 325 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description tooltip 事件
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _includes = _interopRequireDefault(__webpack_require__(28));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var Tooltip_1 = tslib_1.__importDefault(__webpack_require__(39));

var is_active_1 = __webpack_require__(96);
/**
 * 生成 Tooltip 的显示隐藏函数
 */


function createShowHideFn(editor) {
  var tooltip;
  /**
   * 显示 tooltip
   * @param $link 链接元素
   */

  function showLinkTooltip($link) {
    var conf = [{
      $elem: dom_core_1["default"]("<span>" + editor.i18next.t('menus.panelMenus.link.查看链接') + "</span>"),
      onClick: function onClick(editor, $link) {
        var link = $link.attr('href');
        window.open(link, '_target'); // 返回 true，表示执行完之后，隐藏 tooltip。否则不隐藏。

        return true;
      }
    }, {
      $elem: dom_core_1["default"]("<span>" + editor.i18next.t('menus.panelMenus.link.取消链接') + "</span>"),
      onClick: function onClick(editor, $link) {
        var _a, _b; // 选中链接元素


        editor.selection.createRangeByElem($link);
        editor.selection.restoreSelection();
        var $childNodes = $link.childNodes(); // 如果链接是图片

        if (($childNodes === null || $childNodes === void 0 ? void 0 : $childNodes.getNodeName()) === 'IMG') {
          // 获取选中的图片
          var $selectIMG = (_b = (_a = editor.selection.getSelectionContainerElem()) === null || _a === void 0 ? void 0 : _a.children()) === null || _b === void 0 ? void 0 : _b.elems[0].children[0]; // 插入图片

          editor.cmd["do"]('insertHTML', "<img \n                                src=" + ($selectIMG === null || $selectIMG === void 0 ? void 0 : $selectIMG.getAttribute('src')) + " \n                                style=" + ($selectIMG === null || $selectIMG === void 0 ? void 0 : $selectIMG.getAttribute('style')) + ">");
        } else {
          var _context;

          /**
           * 替换链接
           *
           * 两种情况
           * 1. a标签里面可能会含有其他元素如：b, i等，要保留： <a><b></b></a> 先添加链接后加粗
           * 2. 特殊标签里嵌套a，也要保留特殊标签：<b><a></a></b>  先加粗后添加链接
           */
          var linkElem = $link.elems[0]; // a标签里面的html结构

          var selectionContent = linkElem.innerHTML; // a标签的父元素

          var linkParentNode = linkElem.parentElement;

          if (linkParentNode && (0, _includes["default"])(_context = is_active_1.EXTRA_TAG).call(_context, linkParentNode.nodeName)) {
            linkParentNode.innerHTML = selectionContent;
          } else {
            editor.cmd["do"]('insertHTML', '<span>' + selectionContent + '</span>');
          }
        } // 返回 true，表示执行完之后，隐藏 tooltip。否则不隐藏。


        return true;
      }
    }]; // 创建 tooltip

    tooltip = new Tooltip_1["default"](editor, $link, conf);
    tooltip.create();
  }
  /**
   * 隐藏 tooltip
   */


  function hideLinkTooltip() {
    // 移除 tooltip
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }
  }

  return {
    showLinkTooltip: showLinkTooltip,
    hideLinkTooltip: hideLinkTooltip
  };
}
/**
 * 绑定 tooltip 事件
 * @param editor 编辑器实例
 */


function bindTooltipEvent(editor) {
  var _a = createShowHideFn(editor),
      showLinkTooltip = _a.showLinkTooltip,
      hideLinkTooltip = _a.hideLinkTooltip; // 点击链接元素是，显示 tooltip


  editor.txt.eventHooks.linkClickEvents.push(showLinkTooltip); // 点击其他地方，或者滚动时，隐藏 tooltip

  editor.txt.eventHooks.clickEvents.push(hideLinkTooltip);
  editor.txt.eventHooks.keyupEvents.push(hideLinkTooltip);
  editor.txt.eventHooks.toolbarClickEvents.push(hideLinkTooltip);
  editor.txt.eventHooks.menuClickEvents.push(hideLinkTooltip);
  editor.txt.eventHooks.textScrollEvents.push(hideLinkTooltip);
}

exports["default"] = bindTooltipEvent;

/***/ }),
/* 326 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 斜体
 * @author liuwei
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var BtnMenu_1 = tslib_1.__importDefault(__webpack_require__(23));

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var Italic =
/** @class */
function (_super) {
  tslib_1.__extends(Italic, _super);

  function Italic(editor) {
    var _this = this;

    var $elem = dom_core_1["default"]("<div class=\"w-e-menu\" data-title=\"\u659C\u4F53\">\n                <i class=\"w-e-icon-italic\"></i>\n            </div>");
    _this = _super.call(this, $elem, editor) || this;
    return _this;
  }
  /**
   * 点击事件
   */


  Italic.prototype.clickHandler = function () {
    var editor = this.editor;
    var isSelectEmpty = editor.selection.isSelectionEmpty();

    if (isSelectEmpty) {
      // 选区范围是空的，插入并选中一个“空白”
      editor.selection.createEmptyRange();
    } // 执行 italic 命令


    editor.cmd["do"]('italic');

    if (isSelectEmpty) {
      // 需要将选区范围折叠起来
      editor.selection.collapseRange();
      editor.selection.restoreSelection();
    }
  };
  /**
   * 尝试修改菜单激活状态
   */


  Italic.prototype.tryChangeActive = function () {
    var editor = this.editor;

    if (editor.cmd.queryCommandState('italic')) {
      this.active();
    } else {
      this.unActive();
    }
  };

  return Italic;
}(BtnMenu_1["default"]);

exports["default"] = Italic;

/***/ }),
/* 327 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 下划线 underline
 * @author dyl
 *
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var BtnMenu_1 = tslib_1.__importDefault(__webpack_require__(23));

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var Underline =
/** @class */
function (_super) {
  tslib_1.__extends(Underline, _super);

  function Underline(editor) {
    var _this = this;

    var $elem = dom_core_1["default"]("<div class=\"w-e-menu\" data-title=\"\u4E0B\u5212\u7EBF\">\n                <i class=\"w-e-icon-underline\"></i>\n            </div>");
    _this = _super.call(this, $elem, editor) || this;
    return _this;
  }
  /**
   * 点击事件
   */


  Underline.prototype.clickHandler = function () {
    var editor = this.editor;
    var isSelectEmpty = editor.selection.isSelectionEmpty();

    if (isSelectEmpty) {
      // 选区范围是空的，插入并选中一个“空白”
      editor.selection.createEmptyRange();
    } // 执行 Underline 命令


    editor.cmd["do"]('underline');

    if (isSelectEmpty) {
      // 需要将选区范围折叠起来
      editor.selection.collapseRange();
      editor.selection.restoreSelection();
    }
  };
  /**
   * 尝试修改菜单激活状态
   */


  Underline.prototype.tryChangeActive = function () {
    var editor = this.editor;

    if (editor.cmd.queryCommandState('underline')) {
      this.active();
    } else {
      this.unActive();
    }
  };

  return Underline;
}(BtnMenu_1["default"]);

exports["default"] = Underline;

/***/ }),
/* 328 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 删除线
 * @author lkw
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var BtnMenu_1 = tslib_1.__importDefault(__webpack_require__(23));

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var StrikeThrough =
/** @class */
function (_super) {
  tslib_1.__extends(StrikeThrough, _super);

  function StrikeThrough(editor) {
    var _this = this;

    var $elem = dom_core_1["default"]("<div class=\"w-e-menu\" data-title=\"\u5220\u9664\u7EBF\">\n                <i class=\"w-e-icon-strikethrough\"></i>\n            </div>");
    _this = _super.call(this, $elem, editor) || this;
    return _this;
  }
  /**
   * 点击事件
   */


  StrikeThrough.prototype.clickHandler = function () {
    var editor = this.editor;
    var isSelectEmpty = editor.selection.isSelectionEmpty();

    if (isSelectEmpty) {
      // 选区范围是空的，插入并选中一个“空白”
      editor.selection.createEmptyRange();
    } // 执行 strikeThrough 命令


    editor.cmd["do"]('strikeThrough');

    if (isSelectEmpty) {
      // 需要将选区范围折叠起来
      editor.selection.collapseRange();
      editor.selection.restoreSelection();
    }
  };
  /**
   * 尝试修改菜单激活状态
   */


  StrikeThrough.prototype.tryChangeActive = function () {
    var editor = this.editor;

    if (editor.cmd.queryCommandState('strikeThrough')) {
      this.active();
    } else {
      this.unActive();
    }
  };

  return StrikeThrough;
}(BtnMenu_1["default"]);

exports["default"] = StrikeThrough;

/***/ }),
/* 329 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 字体样式 FontStyle
 * @author dyl
 *
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var DropListMenu_1 = tslib_1.__importDefault(__webpack_require__(24));

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var FontStyleList_1 = tslib_1.__importDefault(__webpack_require__(330));

var FontStyle =
/** @class */
function (_super) {
  tslib_1.__extends(FontStyle, _super);

  function FontStyle(editor) {
    var _this = this;

    var $elem = dom_core_1["default"]("<div class=\"w-e-menu\" data-title=\"\u5B57\u4F53\">\n                <i class=\"w-e-icon-font\"></i>\n            </div>");
    var fontStyleList = new FontStyleList_1["default"](editor.config.fontNames);
    var fontListConf = {
      width: 100,
      title: '设置字体',
      type: 'list',
      list: fontStyleList.getItemList(),
      clickHandler: function clickHandler(value) {
        // this 是指向当前的 FontStyle 对象
        _this.command(value);
      }
    };
    _this = _super.call(this, $elem, editor, fontListConf) || this;
    return _this;
  }
  /**
   * 执行命令
   * @param value value
   */


  FontStyle.prototype.command = function (value) {
    var _a;

    var editor = this.editor;
    var isEmptySelection = editor.selection.isSelectionEmpty();
    var $selectionElem = (_a = editor.selection.getSelectionContainerElem()) === null || _a === void 0 ? void 0 : _a.elems[0];
    if ($selectionElem == null) return;
    var isFont = ($selectionElem === null || $selectionElem === void 0 ? void 0 : $selectionElem.nodeName.toLowerCase()) !== 'p';
    var isSameValue = ($selectionElem === null || $selectionElem === void 0 ? void 0 : $selectionElem.getAttribute('face')) === value;

    if (isEmptySelection) {
      if (isFont && !isSameValue) {
        var $elems = editor.selection.getSelectionRangeTopNodes();
        editor.selection.createRangeByElem($elems[0]);
        editor.selection.moveCursor($elems[0].elems[0]);
      }

      editor.selection.setRangeToElem($selectionElem); // 插入空白选区

      editor.selection.createEmptyRange();
    }

    editor.cmd["do"]('fontName', value);

    if (isEmptySelection) {
      // 需要将选区范围折叠起来
      editor.selection.collapseRange();
      editor.selection.restoreSelection();
    }
  };
  /**
   * 尝试修改菜单激活状态
   * ?字体是否需要有激活状态这个操作?
   */


  FontStyle.prototype.tryChangeActive = function () {// const editor = this.editor
    // const cmdValue = editor.cmd.queryCommandValue('fontName')
    // if (menusConfig.fontNames.indexOf(cmdValue) >= 0) {
    //     this.active()
    // } else {
    //     this.unActive()
    // }
  };

  return FontStyle;
}(DropListMenu_1["default"]);

exports["default"] = FontStyle;

/***/ }),
/* 330 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);
/**
 * @description 字体 class
 * @author dyl
 */


var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));
/**
 * 封装的一个字体菜单列表数据的组装对象,
 * 原因是因为在constructor函数中,直接执行此流程,会让代码量看起来较多,
 * 如果要在constructor调用外部函数,个人目前发现会有错误提示,
 * 因此,想着顺便研究实践下ts,遍创建了这样一个类
 */


var FontStyleList =
/** @class */
function () {
  function FontStyleList(list) {
    var _this = this;

    this.itemList = [];
    (0, _forEach["default"])(list).call(list, function (fontValue) {
      // fontValue 2种情况一种是string类型的直接value等同于font-family
      // Object类型value为font-family name为ui视图呈现
      var fontFamily = typeof fontValue === 'string' ? fontValue : fontValue.value;
      var fontName = typeof fontValue === 'string' ? fontValue : fontValue.name;

      _this.itemList.push({
        $elem: dom_core_1["default"]("<p style=\"font-family:'" + fontFamily + "'\">" + fontName + "</p>"),
        value: fontName
      });
    });
  }

  FontStyleList.prototype.getItemList = function () {
    return this.itemList;
  };

  return FontStyleList;
}();

exports["default"] = FontStyleList;

/***/ }),
/* 331 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 字号 FontSize
 * @author lkw
 *
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var DropListMenu_1 = tslib_1.__importDefault(__webpack_require__(24));

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var FontSizeList_1 = tslib_1.__importDefault(__webpack_require__(332));

var FontSize =
/** @class */
function (_super) {
  tslib_1.__extends(FontSize, _super);

  function FontSize(editor) {
    var _this = this;

    var $elem = dom_core_1["default"]("<div class=\"w-e-menu\" data-title=\"\u5B57\u53F7\">\n                <i class=\"w-e-icon-text-heigh\"></i>\n            </div>");
    var fontStyleList = new FontSizeList_1["default"](editor.config.fontSizes);
    var fontListConf = {
      width: 160,
      title: '设置字号',
      type: 'list',
      list: fontStyleList.getItemList(),
      clickHandler: function clickHandler(value) {
        // this 是指向当前的 FontSize 对象
        _this.command(value);
      }
    };
    _this = _super.call(this, $elem, editor, fontListConf) || this;
    return _this;
  }
  /**
   * 执行命令
   * @param value value
   */


  FontSize.prototype.command = function (value) {
    var _a;

    var editor = this.editor;
    var isEmptySelection = editor.selection.isSelectionEmpty();
    var selectionElem = (_a = editor.selection.getSelectionContainerElem()) === null || _a === void 0 ? void 0 : _a.elems[0];
    if (selectionElem == null) return;
    editor.cmd["do"]('fontSize', value);

    if (isEmptySelection) {
      // 需要将选区范围折叠起来
      editor.selection.collapseRange();
      editor.selection.restoreSelection();
    }
  };
  /**
   * 尝试修改菜单激活状态
   * ?字号是否需要有激活状态这个操作?
   */


  FontSize.prototype.tryChangeActive = function () {};

  return FontSize;
}(DropListMenu_1["default"]);

exports["default"] = FontSize;

/***/ }),
/* 332 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);
/**
 * @description 字号 class
 * @author lkw
 */


var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));
/**
 * FontSizeList 字号配置列表
 */


var FontSizeList =
/** @class */
function () {
  function FontSizeList(list) {
    this.itemList = [];

    for (var key in list) {
      var item = list[key];
      this.itemList.push({
        $elem: dom_core_1["default"]("<p style=\"font-size:" + key + "\">" + item.name + "</p>"),
        value: item.value
      });
    }
  }

  FontSizeList.prototype.getItemList = function () {
    return this.itemList;
  };

  return FontSizeList;
}();

exports["default"] = FontSizeList;

/***/ }),
/* 333 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 对齐方式
 * @author liuwei
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

var _indexOf = _interopRequireDefault(__webpack_require__(27));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var DropListMenu_1 = tslib_1.__importDefault(__webpack_require__(24));

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var SPECIAL_NODE_LIST = ['LI'];
var SPECIAL_TOP_NODE_LIST = ['BLOCKQUOTE'];

var Justify =
/** @class */
function (_super) {
  tslib_1.__extends(Justify, _super);

  function Justify(editor) {
    var _this = this;

    var $elem = dom_core_1["default"]('<div class="w-e-menu" data-title="对齐"><i class="w-e-icon-paragraph-left"></i></div>');
    var dropListConf = {
      width: 100,
      title: '对齐方式',
      type: 'list',
      list: [{
        $elem: dom_core_1["default"]("<p>\n                            <i class=\"w-e-icon-paragraph-left w-e-drop-list-item\"></i>\n                            " + editor.i18next.t('menus.dropListMenu.justify.靠左') + "\n                        </p>"),
        value: 'left'
      }, {
        $elem: dom_core_1["default"]("<p>\n                            <i class=\"w-e-icon-paragraph-center w-e-drop-list-item\"></i>\n                            " + editor.i18next.t('menus.dropListMenu.justify.居中') + "\n                        </p>"),
        value: 'center'
      }, {
        $elem: dom_core_1["default"]("<p>\n                            <i class=\"w-e-icon-paragraph-right w-e-drop-list-item\"></i>\n                            " + editor.i18next.t('menus.dropListMenu.justify.靠右') + "\n                        </p>"),
        value: 'right'
      }, {
        $elem: dom_core_1["default"]("<p>\n                            <i class=\"w-e-icon-paragraph-justify w-e-drop-list-item\"></i>\n                            " + editor.i18next.t('menus.dropListMenu.justify.两端') + "\n                        </p>"),
        value: 'justify'
      }],
      clickHandler: function clickHandler(value) {
        // 执行对应的value操作
        _this.command(value);
      }
    };
    _this = _super.call(this, $elem, editor, dropListConf) || this;
    return _this;
  }
  /**
   * 执行命令
   * @param value value
   */


  Justify.prototype.command = function (value) {
    var editor = this.editor;
    var selection = editor.selection;
    var $selectionElem = selection.getSelectionContainerElem(); // 保存选区

    selection.saveRange(); // 获取顶级元素

    var $elems = editor.selection.getSelectionRangeTopNodes();

    if ($selectionElem === null || $selectionElem === void 0 ? void 0 : $selectionElem.length) {
      // list 在chrome下默认多包裹一个 p，导致不能通过顶层元素判断，所以单独加个判断
      if (this.isSpecialNode($selectionElem, $elems[0]) || this.isSpecialTopNode($elems[0])) {
        var el = this.getSpecialNodeUntilTop($selectionElem, $elems[0]);
        if (el == null) return;
        dom_core_1["default"](el).css('text-align', value);
      } else {
        (0, _forEach["default"])($elems).call($elems, function (el) {
          el.css('text-align', value);
        });
      }
    } //恢复选区


    selection.restoreSelection();
  };
  /**
   * 获取选区中的特殊元素，如果不存在，则直接返回顶层元素子元素
   * @param el DomElement
   * @param topEl DomElement
   */


  Justify.prototype.getSpecialNodeUntilTop = function (el, topEl) {
    var parentNode = el.elems[0];
    var topNode = topEl.elems[0]; // 可能出现嵌套的情况，所以一级一级向上找，是否是特殊元素

    while (parentNode != null) {
      if ((0, _indexOf["default"])(SPECIAL_NODE_LIST).call(SPECIAL_NODE_LIST, parentNode === null || parentNode === void 0 ? void 0 : parentNode.nodeName) !== -1) {
        return parentNode;
      } // 如果再到 top 元素之前还没找到特殊元素，直接返回元素


      if (parentNode.parentNode === topNode) {
        return parentNode;
      }

      parentNode = parentNode.parentNode;
    }

    return parentNode;
  };
  /**
   * 当选区元素或者顶层元素是某些特殊元素时，只需要修改子元素的对齐样式的元素
   * @param el DomElement
   * @param topEl DomElement
   */


  Justify.prototype.isSpecialNode = function (el, topEl) {
    // 如果以后有类似的元素要这样处理，直接修改这个数组即可
    var parentNode = this.getSpecialNodeUntilTop(el, topEl);
    if (parentNode == null) return false;
    return (0, _indexOf["default"])(SPECIAL_NODE_LIST).call(SPECIAL_NODE_LIST, parentNode.nodeName) !== -1;
  };
  /**
   * 当选区 top 元素为某些特殊元素时，只需要修改子元素的对齐样式的元素
   * @param el DomElement
   */


  Justify.prototype.isSpecialTopNode = function (topEl) {
    var _a;

    if (topEl == null) return false;
    return (0, _indexOf["default"])(SPECIAL_TOP_NODE_LIST).call(SPECIAL_TOP_NODE_LIST, (_a = topEl.elems[0]) === null || _a === void 0 ? void 0 : _a.nodeName) !== -1;
  };
  /**
   * 尝试改变菜单激活（高亮）状态
   * 默认左对齐,若选择其他对其方式对active进行高亮否则unActive
   * ?考虑优化的话 是否可以对具体选中的进行高亮
   */


  Justify.prototype.tryChangeActive = function () {};

  return Justify;
}(DropListMenu_1["default"]);

exports["default"] = Justify;

/***/ }),
/* 334 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 引用
 * @author tonghan
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var BtnMenu_1 = tslib_1.__importDefault(__webpack_require__(23));

var bind_event_1 = tslib_1.__importDefault(__webpack_require__(335));

var create_quote_node_1 = tslib_1.__importDefault(__webpack_require__(336));

var const_1 = __webpack_require__(7);

var Quote =
/** @class */
function (_super) {
  tslib_1.__extends(Quote, _super);

  function Quote(editor) {
    var _this = this;

    var $elem = dom_core_1["default"]("<div class=\"w-e-menu\" data-title=\"\u5F15\u7528\">\n                <i class=\"w-e-icon-quotes-left\"></i>\n            </div>");
    _this = _super.call(this, $elem, editor) || this;
    bind_event_1["default"](editor);
    return _this;
  }
  /**
   * 点击事件
   */


  Quote.prototype.clickHandler = function () {
    var _a, _b;

    var editor = this.editor;
    var isSelectEmpty = editor.selection.isSelectionEmpty();
    var topNodeElem = editor.selection.getSelectionRangeTopNodes();
    var $topNodeElem = topNodeElem[topNodeElem.length - 1];
    var nodeName = this.getTopNodeName(); // IE 中不支持 formatBlock <BLOCKQUOTE> ，要用其他方式兼容
    // 兼容firefox无法取消blockquote的问题

    if (nodeName === 'BLOCKQUOTE') {
      // 撤销 quote
      var $targetELem = dom_core_1["default"]($topNodeElem.childNodes());
      var len = $targetELem.length;
      var $middle_1 = $topNodeElem;
      (0, _forEach["default"])($targetELem).call($targetELem, function (elem) {
        var $elem = dom_core_1["default"](elem);
        $elem.insertAfter($middle_1);
        $middle_1 = $elem;
      });
      $topNodeElem.remove();
      editor.selection.moveCursor($targetELem.elems[len - 1]); // 即时更新btn状态

      this.tryChangeActive();
    } else {
      // 将 P 转换为 quote

      /**
      @author:gavin
      @description
          1. 解决ctrl+a全选删除后，选区错位的问题。
          2. 或者内容清空，按删除键后，选区错位。
           导致topNodeElem选择的是编辑器顶层元素，在进行dom操作时，quote插入的位置有问题。
      **/
      var $quote = create_quote_node_1["default"](topNodeElem); //如果选择的元素时顶层元素，就将选区移动到正确的位置

      if (editor.$textElem.equal($topNodeElem)) {
        var containerElem = (_a = editor.selection.getSelectionContainerElem()) === null || _a === void 0 ? void 0 : _a.elems[0];
        editor.selection.createRangeByElems(containerElem.children[0], containerElem.children[0]);
        topNodeElem = editor.selection.getSelectionRangeTopNodes();
        $quote = create_quote_node_1["default"](topNodeElem);
        $topNodeElem.append($quote);
      } else {
        $quote.insertAfter($topNodeElem);
      }

      this.delSelectNode(topNodeElem);
      var moveNode = (_b = $quote.childNodes()) === null || _b === void 0 ? void 0 : _b.last().getNode();
      if (moveNode == null) return; // 兼容firefox（firefox下空行情况下选区会在br后，造成自动换行的问题）

      moveNode.textContent ? editor.selection.moveCursor(moveNode) : editor.selection.moveCursor(moveNode, 0); // 即时更新btn状态

      this.tryChangeActive(); // 防止最后一行无法跳出

      dom_core_1["default"](const_1.EMPTY_P).insertAfter($quote);
      return;
    }

    if (isSelectEmpty) {
      // 需要将选区范围折叠起来
      editor.selection.collapseRange();
      editor.selection.restoreSelection();
    }
  };
  /**
   * 尝试修改菜单激活状态
   */


  Quote.prototype.tryChangeActive = function () {
    var _a;

    var editor = this.editor;
    var cmdValue = (_a = editor.selection.getSelectionRangeTopNodes()[0]) === null || _a === void 0 ? void 0 : _a.getNodeName();

    if (cmdValue === 'BLOCKQUOTE') {
      this.active();
    } else {
      this.unActive();
    }
  };
  /**
   * 获取包裹在最外层的节点(防止内部嵌入多个样式)
   * @param selectionElem 选中的节点
   * @returns {string} 最终要处理的节点名称
   */


  Quote.prototype.getTopNodeName = function () {
    var editor = this.editor;
    var $topNodeElem = editor.selection.getSelectionRangeTopNodes()[0];
    var nodeName = $topNodeElem === null || $topNodeElem === void 0 ? void 0 : $topNodeElem.getNodeName();
    return nodeName;
  };
  /**
   * 删除选中的元素
   * @param selectElem 选中的元素节点数组
   */


  Quote.prototype.delSelectNode = function (selectElem) {
    (0, _forEach["default"])(selectElem).call(selectElem, function (node) {
      node.remove();
    });
  };

  return Quote;
}(BtnMenu_1["default"]);

exports["default"] = Quote;

/***/ }),
/* 335 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var const_1 = __webpack_require__(7);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

function bindEvent(editor) {
  function quoteEnter(e) {
    var _a;

    var $selectElem = editor.selection.getSelectionContainerElem();
    var $topSelectElem = editor.selection.getSelectionRangeTopNodes()[0]; // 对quote的enter进行特殊处理
    //最后一行为空标签时再按会出跳出blockquote

    if (($topSelectElem === null || $topSelectElem === void 0 ? void 0 : $topSelectElem.getNodeName()) === 'BLOCKQUOTE') {
      // firefox下点击引用按钮会选中外容器<blockquote></blockquote>
      if ($selectElem.getNodeName() === 'BLOCKQUOTE') {
        var selectNode = (_a = $selectElem.childNodes()) === null || _a === void 0 ? void 0 : _a.getNode();
        editor.selection.moveCursor(selectNode);
      }

      if ($selectElem.text() === '') {
        e.preventDefault();
        $selectElem.remove();
        var $newLine = dom_core_1["default"](const_1.EMPTY_P);
        $newLine.insertAfter($topSelectElem); // 将光标移动br前面

        editor.selection.moveCursor($newLine.getNode(), 0);
      } // 当blockQuote中没有内容回车后移除blockquote


      if ($topSelectElem.text() === '') {
        $topSelectElem.remove();
      }
    }
  }

  editor.txt.eventHooks.enterDownEvents.push(quoteEnter);
}

exports["default"] = bindEvent;

/***/ }),
/* 336 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));
/**
 * 创建一个blockquote元素节点
 * @param editor 编辑器实例
 */


function createQuote($childElem) {
  var $targetElem = dom_core_1["default"]("<blockquote></blockquote>");
  (0, _forEach["default"])($childElem).call($childElem, function (node) {
    $targetElem.append(node.clone(true));
  });
  return $targetElem;
}

exports["default"] = createQuote;

/***/ }),
/* 337 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 背景颜色 BackColor
 * @author lkw
 *
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _map = _interopRequireDefault(__webpack_require__(26));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var DropListMenu_1 = tslib_1.__importDefault(__webpack_require__(24));

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var util_1 = __webpack_require__(6);

var BackColor =
/** @class */
function (_super) {
  tslib_1.__extends(BackColor, _super);

  function BackColor(editor) {
    var _context;

    var _this = this;

    var $elem = dom_core_1["default"]("<div class=\"w-e-menu\" data-title=\"\u80CC\u666F\u8272\">\n                <i class=\"w-e-icon-paint-brush\"></i>\n            </div>");
    var colorListConf = {
      width: 120,
      title: '背景颜色',
      // droplist 内容以 block 形式展示
      type: 'inline-block',
      list: (0, _map["default"])(_context = editor.config.colors).call(_context, function (color) {
        return {
          $elem: dom_core_1["default"]("<i style=\"color:" + color + ";\" class=\"w-e-icon-paint-brush\"></i>"),
          value: color
        };
      }),
      clickHandler: function clickHandler(value) {
        // this 是指向当前的 BackColor 对象
        _this.command(value);
      }
    };
    _this = _super.call(this, $elem, editor, colorListConf) || this;
    return _this;
  }
  /**
   * 执行命令
   * @param value value
   */


  BackColor.prototype.command = function (value) {
    var _a;

    var editor = this.editor;
    var isEmptySelection = editor.selection.isSelectionEmpty();
    var $selectionElem = (_a = editor.selection.getSelectionContainerElem()) === null || _a === void 0 ? void 0 : _a.elems[0];
    if ($selectionElem == null) return;
    var isSpan = ($selectionElem === null || $selectionElem === void 0 ? void 0 : $selectionElem.nodeName.toLowerCase()) !== 'p';
    var bgColor = $selectionElem === null || $selectionElem === void 0 ? void 0 : $selectionElem.style.backgroundColor;
    var isSameColor = util_1.hexToRgb(value) === bgColor;

    if (isEmptySelection) {
      if (isSpan && !isSameColor) {
        var $elems = editor.selection.getSelectionRangeTopNodes();
        editor.selection.createRangeByElem($elems[0]);
        editor.selection.moveCursor($elems[0].elems[0]);
      } // 插入空白选区


      editor.selection.createEmptyRange();
    }

    editor.cmd["do"]('backColor', value);

    if (isEmptySelection) {
      // 需要将选区范围折叠起来
      editor.selection.collapseRange();
      editor.selection.restoreSelection();
    }
  };
  /**
   * 尝试修改菜单激活状态
   */


  BackColor.prototype.tryChangeActive = function () {};

  return BackColor;
}(DropListMenu_1["default"]);

exports["default"] = BackColor;

/***/ }),
/* 338 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 文字颜色 FontColor
 * @author lkw
 *
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _map = _interopRequireDefault(__webpack_require__(26));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var DropListMenu_1 = tslib_1.__importDefault(__webpack_require__(24));

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var FontColor =
/** @class */
function (_super) {
  tslib_1.__extends(FontColor, _super);

  function FontColor(editor) {
    var _context;

    var _this = this;

    var $elem = dom_core_1["default"]("<div class=\"w-e-menu\" data-title=\"\u6587\u5B57\u989C\u8272\">\n                <i class=\"w-e-icon-pencil2\"></i>\n            </div>");
    var colorListConf = {
      width: 120,
      title: '文字颜色',
      // droplist 内容以 block 形式展示
      type: 'inline-block',
      list: (0, _map["default"])(_context = editor.config.colors).call(_context, function (color) {
        return {
          $elem: dom_core_1["default"]("<i style=\"color:" + color + ";\" class=\"w-e-icon-pencil2\"></i>"),
          value: color
        };
      }),
      clickHandler: function clickHandler(value) {
        // this 是指向当前的 BackColor 对象
        _this.command(value);
      }
    };
    _this = _super.call(this, $elem, editor, colorListConf) || this;
    return _this;
  }
  /**
   * 执行命令
   * @param value value
   */


  FontColor.prototype.command = function (value) {
    var _a;

    var editor = this.editor;
    var isEmptySelection = editor.selection.isSelectionEmpty();
    var $selectionElem = (_a = editor.selection.getSelectionContainerElem()) === null || _a === void 0 ? void 0 : _a.elems[0];
    if ($selectionElem == null) return; // 获取选区范围的文字

    var $selectionText = editor.selection.getSelectionText(); // 如果设置的是 a 标签就特殊处理一下，避免回车换行设置颜色无效的情况
    // 只处理选中a标签内全部文字的情况，因为选中部分文字不存在换行颜色失效的情况

    if ($selectionElem.nodeName === 'A' && $selectionElem.textContent === $selectionText) {
      // 创建一个相当于占位的元素
      var _payloadElem = dom_core_1["default"]('<span>&#8203;</span>').getNode(); // 添加到a标签之后


      $selectionElem.appendChild(_payloadElem);
    }

    editor.cmd["do"]('foreColor', value);

    if (isEmptySelection) {
      // 需要将选区范围折叠起来
      editor.selection.collapseRange();
      editor.selection.restoreSelection();
    }
  };
  /**
   * 尝试修改菜单激活状态
   */


  FontColor.prototype.tryChangeActive = function () {};

  return FontColor;
}(DropListMenu_1["default"]);

exports["default"] = FontColor;

/***/ }),
/* 339 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 视频 菜单
 * @author tonghan
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var Panel_1 = tslib_1.__importDefault(__webpack_require__(33));

var PanelMenu_1 = tslib_1.__importDefault(__webpack_require__(38));

var create_panel_conf_1 = tslib_1.__importDefault(__webpack_require__(340));

var index_1 = tslib_1.__importDefault(__webpack_require__(346));

var Video =
/** @class */
function (_super) {
  tslib_1.__extends(Video, _super);

  function Video(editor) {
    var _this = this;

    var $elem = dom_core_1["default"]("<div class=\"w-e-menu\" data-title=\"\u89C6\u9891\">\n                <i class=\"w-e-icon-play\"></i>\n            </div>");
    _this = _super.call(this, $elem, editor) || this; // 绑定事件 tootip

    index_1["default"](editor);
    return _this;
  }
  /**
   * 菜单点击事件
   */


  Video.prototype.clickHandler = function () {
    // 弹出 panel
    this.createPanel('');
  };
  /**
   * 创建 panel
   * @param link 链接
   */


  Video.prototype.createPanel = function (iframe) {
    var conf = create_panel_conf_1["default"](this.editor, iframe);
    var panel = new Panel_1["default"](this, conf);
    panel.create();
  };
  /**
   * 尝试修改菜单 active 状态
   */


  Video.prototype.tryChangeActive = function () {};

  return Video;
}(PanelMenu_1["default"]);

exports["default"] = Video;

/***/ }),
/* 340 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description video 菜单 panel tab 配置
 * @author tonghan
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _trim = _interopRequireDefault(__webpack_require__(17));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var util_1 = __webpack_require__(6);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var upload_video_1 = tslib_1.__importDefault(__webpack_require__(341));

var const_1 = __webpack_require__(7);

function default_1(editor, video) {
  var config = editor.config;
  var uploadVideo = new upload_video_1["default"](editor); // panel 中需要用到的id

  var inputIFrameId = util_1.getRandom('input-iframe');
  var btnOkId = util_1.getRandom('btn-ok');
  var inputUploadId = util_1.getRandom('input-upload');
  var btnStartId = util_1.getRandom('btn-local-ok');
  /**
   * 插入链接
   * @param iframe html标签
   */

  function insertVideo(video) {
    editor.cmd["do"]('insertHTML', video + const_1.EMPTY_P); // video添加后的回调

    editor.config.onlineVideoCallback(video);
  }
  /**
   * 校验在线视频链接
   * @param video 在线视频链接
   */


  function checkOnlineVideo(video) {
    // 查看开发者自定义配置的返回值
    var check = editor.config.onlineVideoCheck(video);

    if (check === true) {
      return true;
    }

    if (typeof check === 'string') {
      //用户未能通过开发者的校验，开发者希望我们提示这一字符串
      editor.config.customAlert(check, 'error');
    }

    return false;
  } // tabs配置
  // const fileMultipleAttr = config.uploadVideoMaxLength === 1 ? '' : 'multiple="multiple"'


  var tabsConf = [{
    // tab 的标题
    title: editor.i18next.t('menus.panelMenus.video.上传视频'),
    tpl: "<div class=\"w-e-up-video-container\">\n                    <div id=\"" + btnStartId + "\" class=\"w-e-up-btn\">\n                        <i class=\"w-e-icon-upload2\"></i>\n                    </div>\n                    <div style=\"display:none;\">\n                        <input id=\"" + inputUploadId + "\" type=\"file\" accept=\"video/*\"/>\n                    </div>\n                 </div>",
    events: [// 触发选择视频
    {
      selector: '#' + btnStartId,
      type: 'click',
      fn: function fn() {
        var $file = dom_core_1["default"]('#' + inputUploadId);
        var fileElem = $file.elems[0];

        if (fileElem) {
          fileElem.click();
        } else {
          // 返回 true 可关闭 panel
          return true;
        }
      }
    }, // 选择视频完毕
    {
      selector: '#' + inputUploadId,
      type: 'change',
      fn: function fn() {
        var $file = dom_core_1["default"]('#' + inputUploadId);
        var fileElem = $file.elems[0];

        if (!fileElem) {
          // 返回 true 可关闭 panel
          return true;
        } // 获取选中的 file 对象列表


        var fileList = fileElem.files;

        if (fileList.length) {
          uploadVideo.uploadVideo(fileList);
        } // 返回 true 可关闭 panel


        return true;
      }
    }]
  }, {
    // tab 的标题
    title: editor.i18next.t('menus.panelMenus.video.插入视频'),
    // 模板
    tpl: "<div>\n                    <input \n                        id=\"" + inputIFrameId + "\" \n                        type=\"text\" \n                        class=\"block\" \n                        placeholder=\"" + editor.i18next.t('如') + "\uFF1A<iframe src=... ></iframe>\"/>\n                    </td>\n                    <div class=\"w-e-button-container\">\n                        <button type=\"button\" id=\"" + btnOkId + "\" class=\"right\">\n                            " + editor.i18next.t('插入') + "\n                        </button>\n                    </div>\n                </div>",
    // 事件绑定
    events: [// 插入视频
    {
      selector: '#' + btnOkId,
      type: 'click',
      fn: function fn() {
        var _context;

        // 执行插入视频
        var $video = dom_core_1["default"]('#' + inputIFrameId);
        var video = (0, _trim["default"])(_context = $video.val()).call(_context); // 视频为空，则不插入

        if (!video) return; // 对当前用户插入的内容进行判断，插入为空，或者返回false，都停止插入

        if (!checkOnlineVideo(video)) return;
        insertVideo(video); // 返回 true，表示该事件执行完之后，panel 要关闭。否则 panel 不会关闭

        return true;
      },
      bindEnter: true
    }]
  }];
  var conf = {
    width: 300,
    height: 0,
    // panel 中可包含多个 tab
    tabs: []
  }; // 显示“上传视频”

  if (window.FileReader && (config.uploadVideoServer || config.customUploadVideo)) {
    conf.tabs.push(tabsConf[0]);
  } // 显示“插入视频”


  if (config.showLinkVideo) {
    conf.tabs.push(tabsConf[1]);
  }

  return conf;
}

exports["default"] = default_1;

/***/ }),
/* 341 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 上传视频
 * @author lichunlin
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _some = _interopRequireDefault(__webpack_require__(133));

var _bind = _interopRequireDefault(__webpack_require__(57));

var _forEach = _interopRequireDefault(__webpack_require__(4));

var _indexOf = _interopRequireDefault(__webpack_require__(27));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var util_1 = __webpack_require__(6);

var upload_core_1 = tslib_1.__importDefault(__webpack_require__(135));

var progress_1 = tslib_1.__importDefault(__webpack_require__(136));

var const_1 = __webpack_require__(7);

var util_2 = __webpack_require__(6);

var UploadVideo =
/** @class */
function () {
  function UploadVideo(editor) {
    this.editor = editor;
  }
  /**
   * 上传视频
   * @param files 文件列表
   */


  UploadVideo.prototype.uploadVideo = function (files) {
    var _this = this;

    if (!files.length) {
      return;
    }

    var editor = this.editor;
    var config = editor.config; // ------------------------------ i18next ------------------------------

    var i18nPrefix = 'validate.';

    var t = function t(text) {
      return editor.i18next.t(i18nPrefix + text);
    }; // ------------------------------ 获取配置信息 ------------------------------
    // 服务端地址


    var uploadVideoServer = config.uploadVideoServer; // 上传视频的最大体积，默认 1024M

    var maxSize = config.uploadVideoMaxSize;
    var uploadVideoMaxSize = maxSize / 1024; // 一次最多上传多少个视频
    // const uploadVideoMaxLength = config.uploadVideoMaxLength
    // 自定义上传视频的名称

    var uploadVideoName = config.uploadVideoName; // 上传视频自定义参数

    var uploadVideoParams = config.uploadVideoParams; // 自定义参数拼接到 url 中

    var uploadVideoParamsWithUrl = config.uploadVideoParamsWithUrl; // 上传视频自定义 header

    var uploadVideoHeaders = config.uploadVideoHeaders; // 钩子函数

    var uploadVideoHooks = config.uploadVideoHooks; // 上传视频超时时间 ms 默认2个小时

    var uploadVideoTimeout = config.uploadVideoTimeout; // 跨域带 cookie

    var withVideoCredentials = config.withVideoCredentials; // 自定义上传

    var customUploadVideo = config.customUploadVideo; // 格式校验

    var uploadVideoAccept = config.uploadVideoAccept; // ------------------------------ 验证文件信息 ------------------------------

    var resultFiles = [];
    var errInfos = [];
    util_1.arrForEach(files, function (file) {
      var name = file.name;
      var size = file.size / 1024 / 1024; // chrome 低版本 name === undefined

      if (!name || !size) {
        return;
      }

      if (!(uploadVideoAccept instanceof Array)) {
        // 格式不是数组
        errInfos.push("\u3010" + uploadVideoAccept + "\u3011" + t('uploadVideoAccept 不是Array'));
        return;
      }

      if (!(0, _some["default"])(uploadVideoAccept).call(uploadVideoAccept, function (item) {
        return item === name.split('.')[name.split('.').length - 1];
      })) {
        // 后缀名不合法，不是视频
        errInfos.push("\u3010" + name + "\u3011" + t('不是视频'));
        return;
      }

      if (uploadVideoMaxSize < size) {
        // 上传视频过大
        errInfos.push("\u3010" + name + "\u3011" + t('大于') + " " + uploadVideoMaxSize + "M");
        return;
      } //验证通过的加入结果列表


      resultFiles.push(file);
    }); // 抛出验证信息

    if (errInfos.length) {
      config.customAlert(t('视频验证未通过') + ": \n" + errInfos.join('\n'), 'warning');
      return;
    } // 如果过滤后文件列表为空直接返回


    if (resultFiles.length === 0) {
      config.customAlert(t('传入的文件不合法'), 'warning');
      return;
    } // ------------------------------ 自定义上传 ------------------------------


    if (customUploadVideo && typeof customUploadVideo === 'function') {
      var _context;

      customUploadVideo(resultFiles, (0, _bind["default"])(_context = this.insertVideo).call(_context, this));
      return;
    } // 添加视频数据


    var formData = new FormData();
    (0, _forEach["default"])(resultFiles).call(resultFiles, function (file, index) {
      var name = uploadVideoName || file.name;

      if (resultFiles.length > 1) {
        // 多个文件时，filename 不能重复
        name = name + (index + 1);
      }

      formData.append(name, file);
    }); // ------------------------------ 上传视频 ------------------------------
    //添加自定义参数  基于有服务端地址的情况下

    if (uploadVideoServer) {
      // 添加自定义参数
      var uploadVideoServerArr = uploadVideoServer.split('#');
      uploadVideoServer = uploadVideoServerArr[0];
      var uploadVideoServerHash = uploadVideoServerArr[1] || '';
      (0, _forEach["default"])(util_1).call(util_1, uploadVideoParams, function (key, val) {
        // 因使用者反应，自定义参数不能默认 encode ，由 v3.1.1 版本开始注释掉
        // val = encodeURIComponent(val)
        // 第一，将参数拼接到 url 中
        if (uploadVideoParamsWithUrl) {
          if ((0, _indexOf["default"])(uploadVideoServer).call(uploadVideoServer, '?') > 0) {
            uploadVideoServer += '&';
          } else {
            uploadVideoServer += '?';
          }

          uploadVideoServer = uploadVideoServer + key + '=' + val;
        } // 第二，将参数添加到 formData 中


        formData.append(key, val);
      });

      if (uploadVideoServerHash) {
        uploadVideoServer += '#' + uploadVideoServerHash;
      } // 开始上传


      var xhr = upload_core_1["default"](uploadVideoServer, {
        timeout: uploadVideoTimeout,
        formData: formData,
        headers: uploadVideoHeaders,
        withCredentials: !!withVideoCredentials,
        beforeSend: function beforeSend(xhr) {
          if (uploadVideoHooks.before) return uploadVideoHooks.before(xhr, editor, resultFiles);
        },
        onTimeout: function onTimeout(xhr) {
          config.customAlert(t('上传视频超时'), 'error');
          if (uploadVideoHooks.timeout) uploadVideoHooks.timeout(xhr, editor);
        },
        onProgress: function onProgress(percent, e) {
          var progressBar = new progress_1["default"](editor);

          if (e.lengthComputable) {
            percent = e.loaded / e.total;
            progressBar.show(percent);
          }
        },
        onError: function onError(xhr) {
          config.customAlert(t('上传视频错误'), 'error', t('上传视频错误') + "\uFF0C" + t('服务器返回状态') + ": " + xhr.status);
          if (uploadVideoHooks.error) uploadVideoHooks.error(xhr, editor);
        },
        onFail: function onFail(xhr, resultStr) {
          config.customAlert(t('上传视频失败'), 'error', t('上传视频返回结果错误') + ("\uFF0C" + t('返回结果') + ": ") + resultStr);
          if (uploadVideoHooks.fail) uploadVideoHooks.fail(xhr, editor, resultStr);
        },
        onSuccess: function onSuccess(xhr, result) {
          if (uploadVideoHooks.customInsert) {
            var _context2;

            // 自定义插入视频
            uploadVideoHooks.customInsert((0, _bind["default"])(_context2 = _this.insertVideo).call(_context2, _this), result, editor);
            return;
          }

          if (result.errno != '0') {
            // 返回格式不对，应该为 { errno: 0, data: [...] }
            config.customAlert(t('上传视频失败'), 'error', t('上传视频返回结果错误') + "\uFF0C" + t('返回结果') + " errno=" + result.errno);
            if (uploadVideoHooks.fail) uploadVideoHooks.fail(xhr, editor, result);
            return;
          } // 成功，插入视频


          var data = result.data;

          _this.insertVideo(data.url); // 钩子函数


          if (uploadVideoHooks.success) uploadVideoHooks.success(xhr, editor, result);
        }
      });

      if (typeof xhr === 'string') {
        // 上传被阻止
        config.customAlert(xhr, 'error');
      }
    }
  };
  /**
   * 往编辑器区域插入视频
   * @param url 视频访问地址
   */


  UploadVideo.prototype.insertVideo = function (url) {
    var editor = this.editor;
    var config = editor.config;
    var i18nPrefix = 'validate.';

    var t = function t(text, prefix) {
      if (prefix === void 0) {
        prefix = i18nPrefix;
      }

      return editor.i18next.t(prefix + text);
    }; // 判断用户是否自定义插入视频


    if (!config.customInsertVideo) {
      if (util_2.UA.isFirefox) {
        editor.cmd["do"]('insertHTML', "<p data-we-video-p=\"true\"><video src=\"" + url + "\" controls=\"controls\" style=\"max-width:100%\"></video></p><p>&#8203</p>");
      } else {
        editor.cmd["do"]('insertHTML', "<video src=\"" + url + "\" controls=\"controls\" style=\"max-width:100%\"></video>" + const_1.EMPTY_P);
      }
    } else {
      config.customInsertVideo(url);
      return;
    } // 加载视频


    var video = document.createElement('video');

    video.onload = function () {
      video = null;
    };

    video.onerror = function () {
      config.customAlert(t('插入视频错误'), 'error', "wangEditor: " + t('插入视频错误') + "\uFF0C" + t('视频链接') + " \"" + url + "\"\uFF0C" + t('下载链接失败'));
      video = null;
    };

    video.onabort = function () {
      return video = null;
    };

    video.src = url;
  };

  return UploadVideo;
}();

exports["default"] = UploadVideo;

/***/ }),
/* 342 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(343);

/***/ }),
/* 343 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(344);

module.exports = parent;


/***/ }),
/* 344 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(345);
var path = __webpack_require__(9);

module.exports = path.Date.now;


/***/ }),
/* 345 */
/***/ (function(module, exports, __webpack_require__) {

var $ = __webpack_require__(5);

// `Date.now` method
// https://tc39.github.io/ecma262/#sec-date.now
$({ target: 'Date', stat: true }, {
  now: function now() {
    return new Date().getTime();
  }
});


/***/ }),
/* 346 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 绑定视频的事件
 * @author lichunlin
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var tooltip_event_1 = tslib_1.__importDefault(__webpack_require__(347));

var keyboard_1 = tslib_1.__importDefault(__webpack_require__(349));
/**
 * 绑定事件
 * @param editor 编辑器实例
 */


function bindEvent(editor) {
  //Tooltip
  tooltip_event_1["default"](editor);
  keyboard_1["default"](editor);
}

exports["default"] = bindEvent;

/***/ }),
/* 347 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description tooltip 事件
 * @author lichunlin
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.createShowHideFn = void 0;

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var Tooltip_1 = tslib_1.__importDefault(__webpack_require__(39));

var video_alignment_1 = tslib_1.__importDefault(__webpack_require__(348));
/**
 * 生成 Tooltip 的显示隐藏函数
 */


function createShowHideFn(editor) {
  var tooltip;

  var t = function t(text, prefix) {
    if (prefix === void 0) {
      prefix = '';
    }

    return editor.i18next.t(prefix + text);
  };
  /**
   * 显示 tooltip
   * @param $node 链接元素
   */


  function showVideoTooltip($node) {
    var conf = [{
      $elem: dom_core_1["default"]("<span class='w-e-icon-trash-o'></span>"),
      onClick: function onClick(editor, $node) {
        // 选中video元素 删除
        $node.remove(); // 返回 true，表示执行完之后，隐藏 tooltip。否则不隐藏。

        return true;
      }
    }, {
      $elem: dom_core_1["default"]('<span>100%</span>'),
      onClick: function onClick(editor, $node) {
        $node.attr('width', '100%');
        $node.removeAttr('height'); // 返回 true，表示执行完之后，隐藏 tooltip。否则不隐藏。

        return true;
      }
    }, {
      $elem: dom_core_1["default"]('<span>50%</span>'),
      onClick: function onClick(editor, $node) {
        $node.attr('width', '50%');
        $node.removeAttr('height'); // 返回 true，表示执行完之后，隐藏 tooltip。否则不隐藏。

        return true;
      }
    }, {
      $elem: dom_core_1["default"]('<span>30%</span>'),
      onClick: function onClick(editor, $node) {
        $node.attr('width', '30%');
        $node.removeAttr('height'); // 返回 true，表示执行完之后，隐藏 tooltip。否则不隐藏。

        return true;
      }
    }, {
      $elem: dom_core_1["default"]("<span>" + t('重置') + "</span>"),
      onClick: function onClick(editor, $node) {
        $node.removeAttr('width');
        $node.removeAttr('height'); // 返回 true，表示执行完之后，隐藏 tooltip。否则不隐藏。

        return true;
      }
    }, {
      $elem: dom_core_1["default"]("<span>" + t('menus.justify.靠左') + "</span>"),
      onClick: function onClick(editor, $node) {
        // 获取顶级元素
        video_alignment_1["default"]($node, 'left'); // 返回 true，表示执行完之后，隐藏 tooltip。否则不隐藏。

        return true;
      }
    }, {
      $elem: dom_core_1["default"]("<span>" + t('menus.justify.居中') + "</span>"),
      onClick: function onClick(editor, $node) {
        // 获取顶级元素
        video_alignment_1["default"]($node, 'center'); // 返回 true，表示执行完之后，隐藏 tooltip。否则不隐藏。

        return true;
      }
    }, {
      $elem: dom_core_1["default"]("<span>" + t('menus.justify.靠右') + "</span>"),
      onClick: function onClick(editor, $node) {
        // 获取顶级元素
        video_alignment_1["default"]($node, 'right'); // 返回 true，表示执行完之后，隐藏 tooltip。否则不隐藏。

        return true;
      }
    }];
    tooltip = new Tooltip_1["default"](editor, $node, conf);
    tooltip.create();
  }
  /**
   * 隐藏 tooltip
   */


  function hideVideoTooltip() {
    // 移除 tooltip
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }
  }

  return {
    showVideoTooltip: showVideoTooltip,
    hideVideoTooltip: hideVideoTooltip
  };
}

exports.createShowHideFn = createShowHideFn;
/**
 * 绑定 tooltip 事件
 * @param editor 编辑器实例
 */

function bindTooltipEvent(editor) {
  var _a = createShowHideFn(editor),
      showVideoTooltip = _a.showVideoTooltip,
      hideVideoTooltip = _a.hideVideoTooltip; // 点击视频元素是，显示 tooltip


  editor.txt.eventHooks.videoClickEvents.push(showVideoTooltip); // 点击其他地方，或者滚动时，隐藏 tooltip

  editor.txt.eventHooks.clickEvents.push(hideVideoTooltip);
  editor.txt.eventHooks.keyupEvents.push(hideVideoTooltip);
  editor.txt.eventHooks.toolbarClickEvents.push(hideVideoTooltip);
  editor.txt.eventHooks.menuClickEvents.push(hideVideoTooltip);
  editor.txt.eventHooks.textScrollEvents.push(hideVideoTooltip); // change 时隐藏

  editor.txt.eventHooks.changeEvents.push(hideVideoTooltip);
}

exports["default"] = bindTooltipEvent;

/***/ }),
/* 348 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 视频布局 事件
 * @author lichunlin
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _includes = _interopRequireDefault(__webpack_require__(28));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3)); // 设置布局方式


function setAlignment($node, value) {
  // 设置顶级元素匹配
  var NODENAME = ['P']; // 获取匹配得顶级元素

  var topNode = getSelectedTopNode($node, NODENAME); // 判断是否存在

  if (topNode) {
    dom_core_1["default"](topNode).css('text-align', value);
  }
}

exports["default"] = setAlignment;
/**
 * 获取选中的元素的顶级元素
 * @params el 选中的元素
 * @params tag 匹配顶级的元素 如 P LI ....
 */

function getSelectedTopNode(el, tag) {
  var _a;

  var parentNode = el.elems[0]; // 可能出现嵌套的情况，所以一级一级向上找，找到指定得顶级元素

  while (parentNode != null) {
    if ((0, _includes["default"])(tag).call(tag, parentNode === null || parentNode === void 0 ? void 0 : parentNode.nodeName)) {
      return parentNode;
    } // 兜底 body


    if (((_a = parentNode === null || parentNode === void 0 ? void 0 : parentNode.parentNode) === null || _a === void 0 ? void 0 : _a.nodeName) === 'BODY') {
      return null;
    }

    parentNode = parentNode.parentNode;
  }

  return parentNode;
}

/***/ }),
/* 349 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var util_1 = __webpack_require__(6);

function bindEventKeyboardEvent(editor) {
  if (!util_1.UA.isFirefox) return;
  var txt = editor.txt,
      selection = editor.selection;
  var keydownEvents = txt.eventHooks.keydownEvents;
  keydownEvents.push(function (e) {
    // 实时保存选区
    // editor.selection.saveRange()
    var $selectionContainerElem = selection.getSelectionContainerElem();

    if ($selectionContainerElem) {
      var $topElem = $selectionContainerElem.getNodeTop(editor);
      var $preElem = $topElem.length ? $topElem.prev().length ? $topElem.prev() : null : null;

      if ($preElem && $preElem.attr('data-we-video-p')) {
        // 光标处于选区开头
        if (selection.getCursorPos() === 0) {
          // 如果上一个dom是包含video， 按下删除连video一块删除
          if (e.keyCode === 8) {
            $preElem.remove();
          }
        }
      }
    }
  });
}

exports["default"] = bindEventKeyboardEvent;

/***/ }),
/* 350 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 插入、上传图片
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _map = _interopRequireDefault(__webpack_require__(26));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var const_1 = __webpack_require__(7);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var Panel_1 = tslib_1.__importDefault(__webpack_require__(33));

var PanelMenu_1 = tslib_1.__importDefault(__webpack_require__(38));

var index_1 = tslib_1.__importDefault(__webpack_require__(351));

var create_panel_conf_1 = tslib_1.__importDefault(__webpack_require__(364));

var Image =
/** @class */
function (_super) {
  tslib_1.__extends(Image, _super);

  function Image(editor) {
    var _this = this;

    var $elem = dom_core_1["default"]('<div class="w-e-menu" data-title="图片"><i class="w-e-icon-image"></i></div>');
    var imgPanelConfig = create_panel_conf_1["default"](editor);

    if (imgPanelConfig.onlyUploadConf) {
      var _context;

      $elem = imgPanelConfig.onlyUploadConf.$elem;
      (0, _map["default"])(_context = imgPanelConfig.onlyUploadConf.events).call(_context, function (event) {
        var type = event.type;
        var fn = event.fn || const_1.EMPTY_FN;
        $elem.on(type, function (e) {
          e.stopPropagation();
          fn(e);
        });
      });
    }

    _this = _super.call(this, $elem, editor) || this;
    _this.imgPanelConfig = imgPanelConfig; // 绑定事件，如粘贴图片

    index_1["default"](editor);
    return _this;
  }
  /**
   * 菜单点击事件
   */


  Image.prototype.clickHandler = function () {
    if (!this.imgPanelConfig.onlyUploadConf) {
      this.createPanel();
    }
  };
  /**
   * 创建 panel
   */


  Image.prototype.createPanel = function () {
    var conf = this.imgPanelConfig;
    var panel = new Panel_1["default"](this, conf);
    this.setPanel(panel);
    panel.create();
  };
  /**
   * 尝试修改菜单 active 状态
   */


  Image.prototype.tryChangeActive = function () {};

  return Image;
}(PanelMenu_1["default"]);

exports["default"] = Image;

/***/ }),
/* 351 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 绑定图片的事件
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var paste_img_1 = tslib_1.__importDefault(__webpack_require__(352));

var drop_img_1 = tslib_1.__importDefault(__webpack_require__(353));

var drag_size_1 = tslib_1.__importDefault(__webpack_require__(354));

var tooltip_event_1 = tslib_1.__importDefault(__webpack_require__(362));

var keyboard_event_1 = tslib_1.__importDefault(__webpack_require__(363));
/**
 * 绑定事件
 * @param editor 编辑器实例
 */


function bindEvent(editor) {
  // 粘贴图片
  paste_img_1["default"](editor); // 拖拽图片

  drop_img_1["default"](editor); // 可再扩展其他事件...如图片 tooltip 等
  // 拖拽图片尺寸

  drag_size_1["default"](editor); //Tooltip

  tooltip_event_1["default"](editor);
  keyboard_event_1["default"](editor);
}

exports["default"] = bindEvent;

/***/ }),
/* 352 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 粘贴图片
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var paste_event_1 = __webpack_require__(131);

var upload_img_1 = tslib_1.__importDefault(__webpack_require__(97));
/**
 * 剪切板是否有 text 或者 html ？
 * @param editor 编辑器对象
 * @param e 粘贴事件参数
 */


function _haveTextOrHtml(editor, e) {
  var config = editor.config;
  var pasteFilterStyle = config.pasteFilterStyle;
  var pasteIgnoreImg = config.pasteIgnoreImg;
  var pasteHtml = paste_event_1.getPasteHtml(e, pasteFilterStyle, pasteIgnoreImg);
  if (pasteHtml) return true;
  var pasteText = paste_event_1.getPasteText(e);
  if (pasteText) return true;
  return false; // text html 都没有，则返回 false
}
/**
 * 剪切板是否有 Files
 * @param editor 编辑器对象
 * @param e 粘贴事件参数
 */


function _haveFiles(editor, e) {
  var _a;

  var types = ((_a = e.clipboardData) === null || _a === void 0 ? void 0 : _a.types) || [];

  for (var i = 0; i < types.length; i++) {
    var type = types[i];

    if (type === 'Files') {
      return true;
    }
  }

  return false;
}
/**
 * 粘贴图片事件方法
 * @param e 事件参数
 */


function pasteImgHandler(e, editor) {
  // 粘贴过来的没有 file 时，判断 text 或者 html
  if (!_haveFiles(editor, e)) {
    if (_haveTextOrHtml(editor, e)) {
      // 粘贴过来的有 text 或者 html ，则不执行粘贴图片逻辑
      return;
    }
  } // 获取粘贴的图片列表


  var pastedFiles = paste_event_1.getPasteImgs(e);

  if (!pastedFiles.length) {
    return;
  } // code 中忽略（暂不管它）
  // 执行上传


  var uploadImg = new upload_img_1["default"](editor);
  uploadImg.uploadImg(pastedFiles);
}
/**
 * 粘贴图片
 * @param editor 编辑器对象
 * @param pasteEvents 粘贴事件列表
 */


function bindPasteImg(editor) {
  /**
   * 绑定 paste 事件
   * 这里使用了unshift，以前是push
   * 在以前的流程中，pasteImgHandler触发之前，会调用到window.getSelection().removeAllRanges()
   * 会导致性能变差。在编辑器中粘贴，粘贴耗时多了100+ms，根本原因未知
   * 最小复现demo，在div内粘贴图片就可以看到getData耗时异常得长
   * <html>
   *     <div id="a" contenteditable="true"></div>
   *     <script>
   *         const div = document.getElementById('a')
   *         div.addEventListener('paste', (e) => {
   *             window.getSelection().removeAllRanges()
   *             e.clipboardData.getData('text/html')
   *         })
   *     </script>
   * </html>
   * 因此改成unshift，先触发pasteImgHandler就不会有性能问题
   */
  editor.txt.eventHooks.pasteEvents.unshift(function (e) {
    pasteImgHandler(e, editor);
  });
}

exports["default"] = bindPasteImg;

/***/ }),
/* 353 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 拖拽上传图片
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var upload_img_1 = tslib_1.__importDefault(__webpack_require__(97));

function bindDropImg(editor) {
  /**
   * 拖拽图片的事件
   * @param e 事件参数
   */
  function dropImgHandler(e) {
    var files = e.dataTransfer && e.dataTransfer.files;

    if (!files || !files.length) {
      return;
    } // 上传图片


    var uploadImg = new upload_img_1["default"](editor);
    uploadImg.uploadImg(files);
  } // 绑定 drop 事件


  editor.txt.eventHooks.dropEvents.push(dropImgHandler);
}

exports["default"] = bindDropImg;

/***/ }),
/* 354 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 图片拖拽事件绑定
 * @author xiaokyo
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _find = _interopRequireDefault(__webpack_require__(29));

var _parseFloat2 = _interopRequireDefault(__webpack_require__(355));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.createShowHideFn = void 0;

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

__webpack_require__(360);

var util_1 = __webpack_require__(6);
/**
 * 设置拖拽框的rect
 * @param $drag drag Dom
 * @param width 要设置的宽度
 * @param height 要设置的高度
 * @param left 要设置的左边
 * @param top 要设置的顶部距离
 */


function setDragStyle($drag, width, height, left, top) {
  $drag.attr('style', "width:" + width + "px; height:" + height + "px; left:" + left + "px; top:" + top + "px;");
}
/**
 * 生成一个图片指定大小的拖拽框
 * @param editor 编辑器实例
 * @param $textContainerElem 编辑框对象
 */


function createDragBox(editor, $textContainerElem) {
  var $drag = dom_core_1["default"]("<div class=\"w-e-img-drag-mask\">\n            <div class=\"w-e-img-drag-show-size\"></div>\n            <div class=\"w-e-img-drag-rb\"></div>\n         </div>");
  $drag.hide();
  $textContainerElem.append($drag);
  return $drag;
}
/**
 * 显示拖拽框并设置宽度
 * @param $textContainerElem 编辑框实例
 * @param $drag 拖拽框对象
 */


function showDargBox($textContainerElem, $drag, $img) {
  var boxRect = $textContainerElem.getBoundingClientRect();
  var rect = $img.getBoundingClientRect();
  var rectW = rect.width.toFixed(2);
  var rectH = rect.height.toFixed(2);
  (0, _find["default"])($drag).call($drag, '.w-e-img-drag-show-size').text(rectW + "px * " + rectH + "px");
  setDragStyle($drag, (0, _parseFloat2["default"])(rectW), (0, _parseFloat2["default"])(rectH), rect.left - boxRect.left, rect.top - boxRect.top);
  $drag.show();
}
/**
 * 生成图片拖拽框的 显示/隐藏 函数
 */


function createShowHideFn(editor) {
  var $textContainerElem = editor.$textContainerElem;
  var $imgTarget; // 生成拖拽框

  var $drag = createDragBox(editor, $textContainerElem);
  /**
   * 设置拖拽事件
   * @param $drag 拖拽框的domElement
   * @param $textContainerElem 编辑器实例
   */

  function bindDragEvents($drag, $container) {
    $drag.on('click', function (e) {
      e.stopPropagation();
    });
    $drag.on('mousedown', '.w-e-img-drag-rb', function (e) {
      // e.stopPropagation()
      e.preventDefault();
      if (!$imgTarget) return;
      var firstX = e.clientX;
      var firstY = e.clientY;
      var boxRect = $container.getBoundingClientRect();
      var imgRect = $imgTarget.getBoundingClientRect();
      var width = imgRect.width;
      var height = imgRect.height;
      var left = imgRect.left - boxRect.left;
      var top = imgRect.top - boxRect.top;
      var ratio = width / height;
      var setW = width;
      var setH = height;
      var $document = dom_core_1["default"](document);

      function offEvents() {
        $document.off('mousemove', mouseMoveHandler);
        $document.off('mouseup', mouseUpHandler);
      }

      function mouseMoveHandler(ev) {
        ev.stopPropagation();
        ev.preventDefault();
        setW = width + (ev.clientX - firstX);
        setH = height + (ev.clientY - firstY); // 等比计算

        if (setW / setH != ratio) {
          setH = setW / ratio;
        }

        setW = (0, _parseFloat2["default"])(setW.toFixed(2));
        setH = (0, _parseFloat2["default"])(setH.toFixed(2));
        (0, _find["default"])($drag).call($drag, '.w-e-img-drag-show-size').text(setW.toFixed(2).replace('.00', '') + "px * " + setH.toFixed(2).replace('.00', '') + "px");
        setDragStyle($drag, setW, setH, left, top);
      }

      $document.on('mousemove', mouseMoveHandler);

      function mouseUpHandler() {
        $imgTarget.attr('width', setW + '');
        $imgTarget.attr('height', setH + '');
        var newImgRect = $imgTarget.getBoundingClientRect();
        setDragStyle($drag, setW, setH, newImgRect.left - boxRect.left, newImgRect.top - boxRect.top); // 解绑事件

        offEvents();
      }

      $document.on('mouseup', mouseUpHandler); // 解绑事件

      $document.on('mouseleave', offEvents);
    });
  } // 显示拖拽框


  function showDrag($target) {
    if (util_1.UA.isIE()) return false;

    if ($target) {
      $imgTarget = $target;
      showDargBox($textContainerElem, $drag, $imgTarget);
    }
  } // 隐藏拖拽框


  function hideDrag() {
    (0, _find["default"])($textContainerElem).call($textContainerElem, '.w-e-img-drag-mask').hide();
  } // 事件绑定


  bindDragEvents($drag, $textContainerElem); // 后期改成 blur 触发

  dom_core_1["default"](document).on('click', hideDrag);
  editor.beforeDestroy(function () {
    dom_core_1["default"](document).off('click', hideDrag);
  });
  return {
    showDrag: showDrag,
    hideDrag: hideDrag
  };
}

exports.createShowHideFn = createShowHideFn;
/**
 * 点击事件委托
 * @param editor 编辑器实例
 */

function bindDragImgSize(editor) {
  var _a = createShowHideFn(editor),
      showDrag = _a.showDrag,
      hideDrag = _a.hideDrag; // 显示拖拽框


  editor.txt.eventHooks.imgClickEvents.push(showDrag); // 隐藏拖拽框

  editor.txt.eventHooks.textScrollEvents.push(hideDrag);
  editor.txt.eventHooks.keyupEvents.push(hideDrag);
  editor.txt.eventHooks.toolbarClickEvents.push(hideDrag);
  editor.txt.eventHooks.menuClickEvents.push(hideDrag);
  editor.txt.eventHooks.changeEvents.push(hideDrag);
}

exports["default"] = bindDragImgSize;

/***/ }),
/* 355 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(356);

/***/ }),
/* 356 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(357);

module.exports = parent;


/***/ }),
/* 357 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(358);
var path = __webpack_require__(9);

module.exports = path.parseFloat;


/***/ }),
/* 358 */
/***/ (function(module, exports, __webpack_require__) {

var $ = __webpack_require__(5);
var parseFloatImplementation = __webpack_require__(359);

// `parseFloat` method
// https://tc39.github.io/ecma262/#sec-parsefloat-string
$({ global: true, forced: parseFloat != parseFloatImplementation }, {
  parseFloat: parseFloatImplementation
});


/***/ }),
/* 359 */
/***/ (function(module, exports, __webpack_require__) {

var global = __webpack_require__(8);
var trim = __webpack_require__(90).trim;
var whitespaces = __webpack_require__(68);

var $parseFloat = global.parseFloat;
var FORCED = 1 / $parseFloat(whitespaces + '-0') !== -Infinity;

// `parseFloat` method
// https://tc39.github.io/ecma262/#sec-parsefloat-string
module.exports = FORCED ? function parseFloat(string) {
  var trimmedString = trim(String(string));
  var result = $parseFloat(trimmedString);
  return result === 0 && trimmedString.charAt(0) == '-' ? -0 : result;
} : $parseFloat;


/***/ }),
/* 360 */
/***/ (function(module, exports, __webpack_require__) {

var api = __webpack_require__(20);
            var content = __webpack_require__(361);

            content = content.__esModule ? content.default : content;

            if (typeof content === 'string') {
              content = [[module.i, content, '']];
            }

var options = {};

options.insert = "head";
options.singleton = false;

var update = api(content, options);



module.exports = content.locals || {};

/***/ }),
/* 361 */
/***/ (function(module, exports, __webpack_require__) {

// Imports
var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(21);
exports = ___CSS_LOADER_API_IMPORT___(false);
// Module
exports.push([module.i, ".w-e-text-container {\n  overflow: hidden;\n}\n.w-e-img-drag-mask {\n  position: absolute;\n  z-index: 1;\n  border: 1px dashed #ccc;\n  box-sizing: border-box;\n}\n.w-e-img-drag-mask .w-e-img-drag-rb {\n  position: absolute;\n  right: -5px;\n  bottom: -5px;\n  width: 16px;\n  height: 16px;\n  border-radius: 50%;\n  background: #ccc;\n  cursor: se-resize;\n}\n.w-e-img-drag-mask .w-e-img-drag-show-size {\n  min-width: 110px;\n  height: 22px;\n  line-height: 22px;\n  font-size: 14px;\n  color: #999;\n  position: absolute;\n  left: 0;\n  top: 0;\n  background-color: #999;\n  color: #fff;\n  border-radius: 2px;\n  padding: 0 5px;\n}\n", ""]);
// Exports
module.exports = exports;


/***/ }),
/* 362 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description tooltip 事件
 * @author lichunlin
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.createShowHideFn = void 0;

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var Tooltip_1 = tslib_1.__importDefault(__webpack_require__(39));
/**
 * 生成 Tooltip 的显示隐藏函数
 */


function createShowHideFn(editor) {
  var tooltip;

  var t = function t(text, prefix) {
    if (prefix === void 0) {
      prefix = '';
    }

    return editor.i18next.t(prefix + text);
  };
  /**
   * 显示 tooltip
   * @param $node 链接元素
   */


  function showImgTooltip($node) {
    var conf = [{
      $elem: dom_core_1["default"]("<span class='w-e-icon-trash-o'></span>"),
      onClick: function onClick(editor, $node) {
        // 选中img元素
        editor.selection.createRangeByElem($node);
        editor.selection.restoreSelection();
        editor.cmd["do"]('delete'); // 返回 true，表示执行完之后，隐藏 tooltip。否则不隐藏。

        return true;
      }
    }, {
      $elem: dom_core_1["default"]('<span>30%</span>'),
      onClick: function onClick(editor, $node) {
        $node.attr('width', '30%');
        $node.removeAttr('height'); // 返回 true，表示执行完之后，隐藏 tooltip。否则不隐藏。

        return true;
      }
    }, {
      $elem: dom_core_1["default"]('<span>50%</span>'),
      onClick: function onClick(editor, $node) {
        $node.attr('width', '50%');
        $node.removeAttr('height'); // 返回 true，表示执行完之后，隐藏 tooltip。否则不隐藏。

        return true;
      }
    }, {
      $elem: dom_core_1["default"]('<span>100%</span>'),
      onClick: function onClick(editor, $node) {
        $node.attr('width', '100%');
        $node.removeAttr('height'); // 返回 true，表示执行完之后，隐藏 tooltip。否则不隐藏。

        return true;
      }
    }];
    conf.push({
      $elem: dom_core_1["default"]("<span>" + t('重置') + "</span>"),
      onClick: function onClick(editor, $node) {
        $node.removeAttr('width');
        $node.removeAttr('height'); // 返回 true，表示执行完之后，隐藏 tooltip。否则不隐藏。

        return true;
      }
    });

    if ($node.attr('data-href')) {
      conf.push({
        $elem: dom_core_1["default"]("<span>" + t('查看链接') + "</span>"),
        onClick: function onClick(editor, $node) {
          var link = $node.attr('data-href');

          if (link) {
            link = decodeURIComponent(link);
            window.open(link, '_target');
          } // 返回 true，表示执行完之后，隐藏 tooltip。否则不隐藏。


          return true;
        }
      });
    }

    tooltip = new Tooltip_1["default"](editor, $node, conf);
    tooltip.create();
  }
  /**
   * 隐藏 tooltip
   */


  function hideImgTooltip() {
    // 移除 tooltip
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }
  }

  return {
    showImgTooltip: showImgTooltip,
    hideImgTooltip: hideImgTooltip
  };
}

exports.createShowHideFn = createShowHideFn;
/**
 * 绑定 tooltip 事件
 * @param editor 编辑器实例
 */

function bindTooltipEvent(editor) {
  var _a = createShowHideFn(editor),
      showImgTooltip = _a.showImgTooltip,
      hideImgTooltip = _a.hideImgTooltip; // 点击图片元素是，显示 tooltip


  editor.txt.eventHooks.imgClickEvents.push(showImgTooltip); // 点击其他地方，或者滚动时，隐藏 tooltip

  editor.txt.eventHooks.clickEvents.push(hideImgTooltip);
  editor.txt.eventHooks.keyupEvents.push(hideImgTooltip);
  editor.txt.eventHooks.toolbarClickEvents.push(hideImgTooltip);
  editor.txt.eventHooks.menuClickEvents.push(hideImgTooltip);
  editor.txt.eventHooks.textScrollEvents.push(hideImgTooltip);
  editor.txt.eventHooks.imgDragBarMouseDownEvents.push(hideImgTooltip); // change 时隐藏

  editor.txt.eventHooks.changeEvents.push(hideImgTooltip);
}

exports["default"] = bindTooltipEvent;

/***/ }),
/* 363 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

function bindEventKeyboardEvent(editor) {
  var txt = editor.txt,
      selection = editor.selection;
  var keydownEvents = txt.eventHooks.keydownEvents;
  keydownEvents.push(function (e) {
    // 删除图片时，有时会因为浏览器bug删不掉。因此这里手动判断光标前面是不是图片，是就删掉
    var $selectionContainerElem = selection.getSelectionContainerElem();
    var range = selection.getRange();

    if (!range || !$selectionContainerElem || e.keyCode !== 8 || !selection.isSelectionEmpty()) {
      return;
    }

    var startContainer = range.startContainer,
        startOffset = range.startOffset; // 同一段落内上一个节点

    var prevNode = null;

    if (startOffset === 0) {
      // 此时上一个节点需要通过previousSibling去找
      while (startContainer !== $selectionContainerElem.elems[0] && $selectionContainerElem.elems[0].contains(startContainer) && startContainer.parentNode && !prevNode) {
        if (startContainer.previousSibling) {
          prevNode = startContainer.previousSibling;
          break;
        }

        startContainer = startContainer.parentNode;
      }
    } else if (startContainer.nodeType !== 3) {
      // 非文本节点才需要被处理，比如p
      prevNode = startContainer.childNodes[startOffset - 1];
    }

    if (!prevNode) {
      return;
    }

    var lastChildNodeInPrevNode = prevNode; // 找到最右侧叶子节点

    while (lastChildNodeInPrevNode.childNodes.length) {
      lastChildNodeInPrevNode = lastChildNodeInPrevNode.childNodes[lastChildNodeInPrevNode.childNodes.length - 1];
    }

    if (lastChildNodeInPrevNode instanceof HTMLElement && lastChildNodeInPrevNode.tagName === 'IMG') {
      lastChildNodeInPrevNode.remove();
      e.preventDefault();
    }
  });
}

exports["default"] = bindEventKeyboardEvent;

/***/ }),
/* 364 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description image 菜单 panel tab 配置
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _map = _interopRequireDefault(__webpack_require__(26));

var _trim = _interopRequireDefault(__webpack_require__(17));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var util_1 = __webpack_require__(6);

var upload_img_1 = tslib_1.__importDefault(__webpack_require__(97));

function default_1(editor) {
  var _context;

  var config = editor.config;
  var uploadImg = new upload_img_1["default"](editor); // panel 中需要用到的id

  var upTriggerId = util_1.getRandom('up-trigger-id');
  var upFileId = util_1.getRandom('up-file-id');
  var linkUrlId = util_1.getRandom('input-link-url');
  var linkUrlAltId = util_1.getRandom('input-link-url-alt');
  var linkUrlHrefId = util_1.getRandom('input-link-url-href');
  var linkBtnId = util_1.getRandom('btn-link');
  var i18nPrefix = 'menus.panelMenus.image.';

  var t = function t(text, prefix) {
    if (prefix === void 0) {
      prefix = i18nPrefix;
    }

    return editor.i18next.t(prefix + text);
  };
  /**
   * 校验网络图片链接是否合法
   * @param linkImg 网络图片链接
   */


  function checkLinkImg(src, linkUrlAltText, linkUrlHrefText) {
    //查看开发者自定义配置的返回值
    var check = config.linkImgCheck(src);

    if (check === true) {
      return true;
    } else if (typeof check === 'string') {
      //用户未能通过开发者的校验，开发者希望我们提示这一字符串
      config.customAlert(check, 'error');
    }

    return false;
  } // tabs 配置 -----------------------------------------


  var fileMultipleAttr = config.uploadImgMaxLength === 1 ? '' : 'multiple="multiple"';
  var accepts = (0, _map["default"])(_context = config.uploadImgAccept).call(_context, function (item) {
    return "image/" + item;
  }).join(',');
  /**
   * 设置模板的类名和icon图标
   * w-e-menu是作为button菜单的模板
   * w-e-up-img-container是做为panel菜单的窗口内容的模板
   * @param containerClass 模板最外层的类名
   * @param iconClass 模板中icon的类名
   * @param titleName 模板中标题的名称 需要则设置不需要则设为空字符
   */

  var getUploadImgTpl = function getUploadImgTpl(containerClass, iconClass, titleName) {
    return "<div class=\"" + containerClass + "\" data-title=\"" + titleName + "\">\n            <div id=\"" + upTriggerId + "\" class=\"w-e-up-btn\">\n                <i class=\"" + iconClass + "\"></i>\n            </div>\n            <div style=\"display:none;\">\n                <input id=\"" + upFileId + "\" type=\"file\" " + fileMultipleAttr + " accept=\"" + accepts + "\"/>\n            </div>\n        </div>";
  };

  var uploadEvents = [// 触发选择图片
  {
    selector: '#' + upTriggerId,
    type: 'click',
    fn: function fn() {
      var uploadImgFromMedia = config.uploadImgFromMedia;

      if (uploadImgFromMedia && typeof uploadImgFromMedia === 'function') {
        uploadImgFromMedia();
        return true;
      }

      var $file = dom_core_1["default"]('#' + upFileId);
      var fileElem = $file.elems[0];

      if (fileElem) {
        fileElem.click();
      } else {
        // 返回 true 可关闭 panel
        return true;
      }
    }
  }, // 选择图片完毕
  {
    selector: '#' + upFileId,
    type: 'change',
    fn: function fn() {
      var $file = dom_core_1["default"]('#' + upFileId);
      var fileElem = $file.elems[0];

      if (!fileElem) {
        // 返回 true 可关闭 panel
        return true;
      } // 获取选中的 file 对象列表


      var fileList = fileElem.files;

      if (fileList === null || fileList === void 0 ? void 0 : fileList.length) {
        uploadImg.uploadImg(fileList);
      } // 判断用于打开文件的input，有没有值，如果有就清空，以防上传同一张图片时，不会触发change事件
      // input的功能只是单单为了打开文件而已，获取到需要的文件参数，当文件数据获取到后，可以清空。


      if (fileElem) {
        fileElem.value = '';
      } // 返回 true 可关闭 panel


      return true;
    }
  }];
  var linkImgInputs = ["<input\n            id=\"" + linkUrlId + "\"\n            type=\"text\"\n            class=\"block\"\n            placeholder=\"" + t('图片地址') + "\"/>"];

  if (config.showLinkImgAlt) {
    linkImgInputs.push("\n        <input\n            id=\"" + linkUrlAltId + "\"\n            type=\"text\"\n            class=\"block\"\n            placeholder=\"" + t('图片文字说明') + "\"/>");
  }

  if (config.showLinkImgHref) {
    linkImgInputs.push("\n        <input\n            id=\"" + linkUrlHrefId + "\"\n            type=\"text\"\n            class=\"block\"\n            placeholder=\"" + t('跳转链接') + "\"/>");
  }

  var tabsConf = [// first tab
  {
    // 标题
    title: t('上传图片'),
    // 模板
    tpl: getUploadImgTpl('w-e-up-img-container', 'w-e-icon-upload2', ''),
    // 事件绑定
    events: uploadEvents
  }, // second tab
  {
    title: t('网络图片'),
    tpl: "<div>\n                    " + linkImgInputs.join('') + "\n                    <div class=\"w-e-button-container\">\n                        <button type=\"button\" id=\"" + linkBtnId + "\" class=\"right\">" + t('插入', '') + "</button>\n                    </div>\n                </div>",
    events: [{
      selector: '#' + linkBtnId,
      type: 'click',
      fn: function fn() {
        var _context2;

        var $linkUrl = dom_core_1["default"]('#' + linkUrlId);
        var url = (0, _trim["default"])(_context2 = $linkUrl.val()).call(_context2); //如果url为空则直接返回

        if (!url) return;
        var linkUrlAltText;

        if (config.showLinkImgAlt) {
          var _context3;

          linkUrlAltText = (0, _trim["default"])(_context3 = dom_core_1["default"]('#' + linkUrlAltId).val()).call(_context3);
        }

        var linkUrlHrefText;

        if (config.showLinkImgHref) {
          var _context4;

          linkUrlHrefText = (0, _trim["default"])(_context4 = dom_core_1["default"]('#' + linkUrlHrefId).val()).call(_context4);
        } //如果不能通过校验也直接返回


        if (!checkLinkImg(url, linkUrlAltText, linkUrlHrefText)) return; //插入图片url

        uploadImg.insertImg(url, linkUrlAltText, linkUrlHrefText); // 返回 true 表示函数执行结束之后关闭 panel

        return true;
      },
      bindEnter: true
    }]
  }]; // tabs end
  // 最终的配置 -----------------------------------------

  var conf = {
    width: 300,
    height: 0,
    tabs: [],
    onlyUploadConf: {
      $elem: dom_core_1["default"](getUploadImgTpl('w-e-menu', 'w-e-icon-image', '图片')),
      events: uploadEvents
    }
  }; // 显示“上传图片”

  if (window.FileReader && (config.uploadImgShowBase64 || config.uploadImgServer || config.customUploadImg || config.uploadImgFromMedia)) {
    conf.tabs.push(tabsConf[0]);
  } // 显示“插入网络图片”


  if (config.showLinkImg) {
    conf.tabs.push(tabsConf[1]);
    conf.onlyUploadConf = undefined;
  }

  return conf;
}

exports["default"] = default_1;

/***/ }),
/* 365 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 增加缩进/减少缩进
 * @author tonghan
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var DropListMenu_1 = tslib_1.__importDefault(__webpack_require__(24));

var operate_element_1 = tslib_1.__importDefault(__webpack_require__(366));

var Indent =
/** @class */
function (_super) {
  tslib_1.__extends(Indent, _super);

  function Indent(editor) {
    var _this = this;

    var $elem = dom_core_1["default"]("<div class=\"w-e-menu\" data-title=\"\u7F29\u8FDB\">\n                <i class=\"w-e-icon-indent-increase\"></i>\n            </div>");
    var dropListConf = {
      width: 130,
      title: '设置缩进',
      type: 'list',
      list: [{
        $elem: dom_core_1["default"]("<p>\n                            <i class=\"w-e-icon-indent-increase w-e-drop-list-item\"></i>\n                            " + editor.i18next.t('menus.dropListMenu.indent.增加缩进') + "\n                        <p>"),
        value: 'increase'
      }, {
        $elem: dom_core_1["default"]("<p>\n                            <i class=\"w-e-icon-indent-decrease w-e-drop-list-item\"></i>\n                            " + editor.i18next.t('menus.dropListMenu.indent.减少缩进') + "\n                        <p>"),
        value: 'decrease'
      }],
      clickHandler: function clickHandler(value) {
        // 注意 this 是指向当前的 Indent 对象
        _this.command(value);
      }
    };
    _this = _super.call(this, $elem, editor, dropListConf) || this;
    return _this;
  }
  /**
   * 执行命令
   * @param value value
   */


  Indent.prototype.command = function (value) {
    var editor = this.editor;
    var $selectionElem = editor.selection.getSelectionContainerElem(); // 判断 当前选区为 textElem 时

    if ($selectionElem && editor.$textElem.equal($selectionElem)) {
      // 当 当前选区 等于 textElem 时
      // 代表 当前选区 可能是一个选择了一个完整的段落或者多个段落
      var $elems = editor.selection.getSelectionRangeTopNodes();

      if ($elems.length > 0) {
        (0, _forEach["default"])($elems).call($elems, function (item) {
          operate_element_1["default"](dom_core_1["default"](item), value, editor);
        });
      }
    } else {
      // 当 当前选区 不等于 textElem 时
      // 代表 当前选区要么是一个段落，要么是段落中的一部分
      if ($selectionElem && $selectionElem.length > 0) {
        (0, _forEach["default"])($selectionElem).call($selectionElem, function (item) {
          operate_element_1["default"](dom_core_1["default"](item), value, editor);
        });
      }
    } // 恢复选区


    editor.selection.restoreSelection();
    this.tryChangeActive();
  };
  /**
   * 尝试改变菜单激活（高亮）状态
   */


  Indent.prototype.tryChangeActive = function () {
    var editor = this.editor;
    var $selectionElem = editor.selection.getSelectionStartElem();
    var $selectionStartElem = dom_core_1["default"]($selectionElem).getNodeTop(editor);
    if ($selectionStartElem.length <= 0) return;

    if ($selectionStartElem.elems[0].style['paddingLeft'] != '') {
      this.active();
    } else {
      this.unActive();
    }
  };

  return Indent;
}(DropListMenu_1["default"]);

exports["default"] = Indent;

/***/ }),
/* 366 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 对节点 操作 进行封装
 *                  获取当前节点的段落
 *                  根据type判断是增加还是减少缩进
 * @author tonghan
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _slice = _interopRequireDefault(__webpack_require__(45));

var _trim = _interopRequireDefault(__webpack_require__(17));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var increase_indent_style_1 = tslib_1.__importDefault(__webpack_require__(367));

var decrease_indent_style_1 = tslib_1.__importDefault(__webpack_require__(368));

var lengthRegex = /^(\d+)(\w+)$/;
var percentRegex = /^(\d+)%$/;

function parseIndentation(editor) {
  var indentation = editor.config.indentation;

  if (typeof indentation === 'string') {
    if (lengthRegex.test(indentation)) {
      var _context;

      var _a = (0, _slice["default"])(_context = (0, _trim["default"])(indentation).call(indentation).match(lengthRegex)).call(_context, 1, 3),
          value = _a[0],
          unit = _a[1];

      return {
        value: Number(value),
        unit: unit
      };
    } else if (percentRegex.test(indentation)) {
      return {
        value: Number((0, _trim["default"])(indentation).call(indentation).match(percentRegex)[1]),
        unit: '%'
      };
    }
  } else if (indentation.value !== void 0 && indentation.unit) {
    return indentation;
  }

  return {
    value: 2,
    unit: 'em'
  };
}

function operateElement($node, type, editor) {
  var $elem = $node.getNodeTop(editor);
  var reg = /^(P|H[0-9]*)$/;

  if (reg.test($elem.getNodeName())) {
    if (type === 'increase') increase_indent_style_1["default"]($elem, parseIndentation(editor));else if (type === 'decrease') decrease_indent_style_1["default"]($elem, parseIndentation(editor));
  }
}

exports["default"] = operateElement;

/***/ }),
/* 367 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 增加缩进
 * @author tonghan
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _slice = _interopRequireDefault(__webpack_require__(45));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

function increaseIndentStyle($node, options) {
  var $elem = $node.elems[0];

  if ($elem.style['paddingLeft'] === '') {
    $node.css('padding-left', options.value + options.unit);
  } else {
    var oldPL = $elem.style['paddingLeft'];
    var oldVal = (0, _slice["default"])(oldPL).call(oldPL, 0, oldPL.length - options.unit.length);
    var newVal = Number(oldVal) + options.value;
    $node.css('padding-left', "" + newVal + options.unit);
  }
}

exports["default"] = increaseIndentStyle;

/***/ }),
/* 368 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 减少缩进
 * @author tonghan
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _slice = _interopRequireDefault(__webpack_require__(45));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

function decreaseIndentStyle($node, options) {
  var $elem = $node.elems[0];

  if ($elem.style['paddingLeft'] !== '') {
    var oldPL = $elem.style['paddingLeft'];
    var oldVal = (0, _slice["default"])(oldPL).call(oldPL, 0, oldPL.length - options.unit.length);
    var newVal = Number(oldVal) - options.value;

    if (newVal > 0) {
      $node.css('padding-left', "" + newVal + options.unit);
    } else {
      $node.css('padding-left', '');
    }
  }
}

exports["default"] = decreaseIndentStyle;

/***/ }),
/* 369 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);
/**
 * @description 插入表情
 * @author liuwe
 */


var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var PanelMenu_1 = tslib_1.__importDefault(__webpack_require__(38));

var Panel_1 = tslib_1.__importDefault(__webpack_require__(33));

var create_panel_conf_1 = tslib_1.__importDefault(__webpack_require__(370));

var Emoticon =
/** @class */
function (_super) {
  tslib_1.__extends(Emoticon, _super);

  function Emoticon(editor) {
    var _this = this;

    var $elem = dom_core_1["default"]("<div class=\"w-e-menu\" data-title=\"\u8868\u60C5\">\n                <i class=\"w-e-icon-happy\"></i>\n            </div>");
    _this = _super.call(this, $elem, editor) || this;
    return _this;
  }
  /**
   * 创建 panel
   */


  Emoticon.prototype.createPanel = function () {
    var conf = create_panel_conf_1["default"](this.editor);
    var panel = new Panel_1["default"](this, conf);
    panel.create();
  };
  /**
   * 菜单表情点击事件
   */


  Emoticon.prototype.clickHandler = function () {
    this.createPanel();
  };

  Emoticon.prototype.tryChangeActive = function () {};

  return Emoticon;
}(PanelMenu_1["default"]);

exports["default"] = Emoticon;

/***/ }),
/* 370 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description  表情菜单 panel配置
 * @author liuwei
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _map = _interopRequireDefault(__webpack_require__(26));

var _filter = _interopRequireDefault(__webpack_require__(70));

var _trim = _interopRequireDefault(__webpack_require__(17));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

function default_1(editor) {
  // 声明emotions数据结构
  var emotions = editor.config.emotions;
  /* tabs配置项 ==================================================================*/
  // 生成表情结构 TODO jele type类型待优化

  function GenerateExpressionStructure(ele) {
    // 返回为一个数组对象
    var res = []; // 如果type是image类型则生成一个img标签

    if (ele.type == 'image') {
      var _context;

      res = (0, _map["default"])(_context = ele.content).call(_context, function (con) {
        if (typeof con == 'string') return '';
        return "<span  title=\"" + con.alt + "\">\n                    <img class=\"eleImg\" data-emoji=\"" + con.alt + "\" style src=\"" + con.src + "\" alt=\"[" + con.alt + "]\">\n                </span>";
      });
      res = (0, _filter["default"])(res).call(res, function (s) {
        return s !== '';
      });
    } //否则直接当内容处理
    else {
        var _context2;

        res = (0, _map["default"])(_context2 = ele.content).call(_context2, function (con) {
          return "<span class=\"eleImg\" title=\"" + con + "\">" + con + "</span>";
        });
      }

    return res.join('').replace(/&nbsp;/g, '');
  }

  var tabsConf = (0, _map["default"])(emotions).call(emotions, function (ele) {
    return {
      title: editor.i18next.t("menus.panelMenus.emoticon." + ele.title),
      // 判断type类型如果是image则以img的形式插入否则以内容
      tpl: "<div>" + GenerateExpressionStructure(ele) + "</div>",
      events: [{
        selector: '.eleImg',
        type: 'click',
        fn: function fn(e) {
          // e为事件对象
          var $target = dom_core_1["default"](e.target);
          var nodeName = $target.getNodeName();
          var insertHtml;

          if (nodeName === 'IMG') {
            var _context3;

            // 插入图片
            insertHtml = (0, _trim["default"])(_context3 = $target.parent().html()).call(_context3);
          } else {
            // 插入 emoji
            insertHtml = '<span>' + $target.html() + '</span>';
          }

          editor.cmd["do"]('insertHTML', insertHtml); // 示函数执行结束之后关闭 panel

          return true;
        }
      }]
    };
  });
  /* tabs配置项 =================================================================end*/
  // 最终的配置 -----------------------------------------

  var conf = {
    width: 300,
    height: 230,
    tabs: tabsConf
  };
  return conf;
}

exports["default"] = default_1;

/***/ }),
/* 371 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.createListHandle = exports.ClassType = void 0;

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var WrapListHandle_1 = tslib_1.__importDefault(__webpack_require__(372));

var JoinListHandle_1 = tslib_1.__importDefault(__webpack_require__(374));

var StartJoinListHandle_1 = tslib_1.__importDefault(__webpack_require__(375));

var EndJoinListHandle_1 = tslib_1.__importDefault(__webpack_require__(376));

var OtherListHandle_1 = tslib_1.__importDefault(__webpack_require__(377));

var ClassType;

(function (ClassType) {
  ClassType["Wrap"] = "WrapListHandle";
  ClassType["Join"] = "JoinListHandle";
  ClassType["StartJoin"] = "StartJoinListHandle";
  ClassType["EndJoin"] = "EndJoinListHandle";
  ClassType["Other"] = "OtherListHandle";
})(ClassType = exports.ClassType || (exports.ClassType = {}));

var handle = {
  WrapListHandle: WrapListHandle_1["default"],
  JoinListHandle: JoinListHandle_1["default"],
  StartJoinListHandle: StartJoinListHandle_1["default"],
  EndJoinListHandle: EndJoinListHandle_1["default"],
  OtherListHandle: OtherListHandle_1["default"]
};

function createListHandle(classType, options, range) {
  if (classType === ClassType.Other && range === undefined) {
    throw new Error('other 类需要传入 range');
  }

  return classType !== ClassType.Other ? new handle[classType](options) : new handle[classType](options, range);
}

exports.createListHandle = createListHandle;
/**
 * 统一执行的接口
 */

var ListHandleCommand =
/** @class */
function () {
  function ListHandleCommand(handle) {
    this.handle = handle;
    this.handle.exec();
  }

  ListHandleCommand.prototype.getSelectionRangeElem = function () {
    return dom_core_1["default"](this.handle.selectionRangeElem.get());
  };

  return ListHandleCommand;
}();

exports["default"] = ListHandleCommand;

/***/ }),
/* 372 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var ListHandle_1 = __webpack_require__(58);

var utils_1 = __webpack_require__(47);
/**
 * 选区在序列内的处理
 */


var WrapListHandle =
/** @class */
function (_super) {
  tslib_1.__extends(WrapListHandle, _super);

  function WrapListHandle(options) {
    return _super.call(this, options) || this;
  }

  WrapListHandle.prototype.exec = function () {
    var _a = this.options,
        listType = _a.listType,
        listTarget = _a.listTarget,
        $selectionElem = _a.$selectionElem,
        $startElem = _a.$startElem,
        $endElem = _a.$endElem;
    var $containerFragment; // 容器 - HTML 文档片段

    var $nodes = []; // 获取选中的段落
    // 获取 selectionElem 的标签名

    var containerNodeName = $selectionElem === null || $selectionElem === void 0 ? void 0 : $selectionElem.getNodeName(); // 获取开始以及结束的 li 元素

    var $start = $startElem.prior;
    var $end = $endElem.prior; // =====================================
    // 当 开始节点 和 结束节点 没有 prior
    // 并且 开始节点 没有前一个兄弟节点
    // 并且 结束节点 没有后一个兄弟节点
    // 即代表 全选序列
    // =====================================

    if (!$startElem.prior && !$endElem.prior || !($start === null || $start === void 0 ? void 0 : $start.prev().length) && !($end === null || $end === void 0 ? void 0 : $end.next().length)) {
      var _context;

      // 获取当前序列下的所有 li 标签
      ;
      (0, _forEach["default"])(_context = $selectionElem === null || $selectionElem === void 0 ? void 0 : $selectionElem.children()).call(_context, function ($node) {
        $nodes.push(dom_core_1["default"]($node));
      }); // =====================================
      // 当 selectionElem 的标签名和按钮类型 一致 的时候
      // 代表着当前的操作是 取消 序列
      // =====================================

      if (containerNodeName === listType) {
        // 生成对应的段落(p)并添加到文档片段中，然后删除掉无用的 li
        $containerFragment = utils_1.createElementFragment($nodes, utils_1.createDocumentFragment(), // 创建 文档片段
        'p');
      } // =====================================
      // 当 selectionElem 的标签名和按钮类型 不一致 的时候
      // 代表着当前的操作是 转换 序列
      // =====================================
      else {
          // 创建 序列节点
          $containerFragment = utils_1.createElement(listTarget); // 因为是转换，所以 li 元素可以直接使用

          (0, _forEach["default"])($nodes).call($nodes, function ($node) {
            $containerFragment.appendChild($node.elems[0]);
          });
        } // 把 文档片段 或 序列节点 插入到 selectionElem 的前面


      this.selectionRangeElem.set($containerFragment); // 插入到 $selectionElem 之前

      utils_1.insertBefore($selectionElem, $containerFragment, $selectionElem.elems[0]); // 删除无用的 selectionElem 因为它被掏空了

      $selectionElem.remove();
    } // =====================================
    // 当不是全选序列的时候就代表是非全选序列(废话)
    // 非全选序列的情况
    // =====================================
    else {
        // 获取选中的内容
        var $startDom = $start;

        while ($startDom.length) {
          $nodes.push($startDom);
          ($end === null || $end === void 0 ? void 0 : $end.equal($startDom)) ? $startDom = dom_core_1["default"](undefined) : // 结束
          $startDom = $startDom.next(); // 继续
        } // 获取开始节点的上一个兄弟节点


        var $prveDom = $start.prev(); // 获取结束节点的下一个兄弟节点

        var $nextDom = $end.next(); // =====================================
        // 当 selectionElem 的标签名和按钮类型一致的时候
        // 代表着当前的操作是 取消 序列
        // =====================================

        if (containerNodeName === listType) {
          // 生成对应的段落(p)并添加到文档片段中，然后删除掉无用的 li
          $containerFragment = utils_1.createElementFragment($nodes, utils_1.createDocumentFragment(), // 创建 文档片段
          'p');
        } // =====================================
        // 当 selectionElem 的标签名和按钮类型不一致的时候
        // 代表着当前的操作是 转换 序列
        // =====================================
        else {
            // 创建 文档片段
            $containerFragment = utils_1.createElement(listTarget); // 因为是转换，所以 li 元素可以直接使用

            (0, _forEach["default"])($nodes).call($nodes, function ($node) {
              $containerFragment.append($node.elems[0]);
            });
          } // =====================================
        // 当 prveDom 和 nextDom 都存在的时候
        // 代表着当前选区是在序列的中间
        // 所以要先把 下半部分 未选择的 li 元素独立出来生成一个 序列
        // =====================================


        if ($prveDom.length && $nextDom.length) {
          // 获取尾部的元素
          var $tailDomArr = [];

          while ($nextDom.length) {
            $tailDomArr.push($nextDom);
            $nextDom = $nextDom.next();
          } // 创建 尾部序列节点


          var $tailDocFragment_1 = utils_1.createElement(containerNodeName); // 把尾部元素节点添加到尾部序列节点中

          (0, _forEach["default"])($tailDomArr).call($tailDomArr, function ($node) {
            $tailDocFragment_1.append($node.elems[0]);
          }); // 把尾部序列节点插入到 selectionElem 的后面

          dom_core_1["default"]($tailDocFragment_1).insertAfter($selectionElem); // =====================================
          // 获取选区容器元素的父元素，一般就是编辑区域
          // 然后判断 selectionElem 是否还有下一个兄弟节点
          // 如果有，就把文档片段添加到 selectionElem 下一个兄弟节点前
          // 如果没有，就把文档片段添加到 编辑区域 末尾
          // =====================================

          this.selectionRangeElem.set($containerFragment);
          var $selectionNextDom = $selectionElem.next();
          $selectionNextDom.length ? utils_1.insertBefore($selectionElem, $containerFragment, $selectionNextDom.elems[0]) : $selectionElem.parent().elems[0].append($containerFragment);
        } // =====================================
        // 不管是 取消 还是 转换 都需要重新插入节点
        //
        // prveDom.length 等于 0 即代表选区是 selectionElem 序列的上半部分
        // 上半部分的 li 元素
        // =====================================
        else if (!$prveDom.length) {
            // 文档片段插入到 selectionElem 之前
            this.selectionRangeElem.set($containerFragment);
            utils_1.insertBefore($selectionElem, $containerFragment, $selectionElem.elems[0]);
          } // =====================================
          // 不管是 取消 还是 转换 都需要重新插入节点
          //
          // nextDom.length 等于 0 即代表选区是 selectionElem 序列的下半部分
          // 下半部分的 li 元素  if (!$nextDom.length)
          // =====================================
          else {
              // 文档片段插入到 selectionElem 之后
              this.selectionRangeElem.set($containerFragment);
              var $selectionNextDom = $selectionElem.next();
              $selectionNextDom.length ? utils_1.insertBefore($selectionElem, $containerFragment, $selectionNextDom.elems[0]) : $selectionElem.parent().elems[0].append($containerFragment);
            }
      }
  };

  return WrapListHandle;
}(ListHandle_1.ListHandle);

exports["default"] = WrapListHandle;

/***/ }),
/* 373 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
/**
 * @description 选区的 Element
 * @author tonghan
 */

var SelectionRangeElem =
/** @class */
function () {
  function SelectionRangeElem() {
    this._element = null;
  }
  /**
   * 设置 SelectionRangeElem 的值
   * @param { SetSelectionRangeType } data
   */


  SelectionRangeElem.prototype.set = function (data) {
    //
    if (data instanceof DocumentFragment) {
      var _context;

      var childNode_1 = [];
      (0, _forEach["default"])(_context = data.childNodes).call(_context, function ($node) {
        childNode_1.push($node);
      });
      data = childNode_1;
    }

    this._element = data;
  };
  /**
   * 获取 SelectionRangeElem 的值
   * @returns { SelectionRangeType } Elem
   */


  SelectionRangeElem.prototype.get = function () {
    return this._element;
  };
  /**
   * 清除 SelectionRangeElem 的值
   */


  SelectionRangeElem.prototype.clear = function () {
    this._element = null;
  };

  return SelectionRangeElem;
}();

exports["default"] = SelectionRangeElem;

/***/ }),
/* 374 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var ListHandle_1 = __webpack_require__(58);

var utils_1 = __webpack_require__(47);

var JoinListHandle =
/** @class */
function (_super) {
  tslib_1.__extends(JoinListHandle, _super);

  function JoinListHandle(options) {
    return _super.call(this, options) || this;
  }

  JoinListHandle.prototype.exec = function () {
    var _a, _b, _c, _d, _e, _f, _g;

    var _h = this.options,
        editor = _h.editor,
        listType = _h.listType,
        listTarget = _h.listTarget,
        $startElem = _h.$startElem,
        $endElem = _h.$endElem; // 容器 - HTML 文档片段

    var $containerFragment; // 获取选中的段落

    var $nodes = editor.selection.getSelectionRangeTopNodes(); // 获取开始段落和结束段落 标签名

    var startNodeName = $startElem === null || $startElem === void 0 ? void 0 : $startElem.getNodeName();
    var endNodeName = $endElem === null || $endElem === void 0 ? void 0 : $endElem.getNodeName(); // =====================================
    // 开头结尾都是序列的情况下
    // 开头序列 和 结尾序列的标签名一致的时候
    // =====================================

    if (startNodeName === endNodeName) {
      // =====================================
      // 开头序列 和 结尾序列 中间还有其他的段落的时候
      // =====================================
      if ($nodes.length > 2) {
        // 弹出 开头 和 结尾
        $nodes.shift();
        $nodes.pop(); // 把中间部分的节点元素转换成 li 元素并添加到文档片段后删除

        $containerFragment = utils_1.createElementFragment(utils_1.filterSelectionNodes($nodes), // 过滤 $nodes 获取到符合要求的选中元素节点
        utils_1.createDocumentFragment() // 创建 文档片段
        ); // =====================================
        // 由于开头序列 和 结尾序列的标签名一样，所以只判断了开头序列的
        // 当开头序列的标签名和按钮类型 一致 的时候
        // 代表着当前是一个 设置序列 的操作
        // =====================================

        if (startNodeName === listType) {
          // 把结束序列的 li 元素添加到 文档片段中
          (_a = $endElem.children()) === null || _a === void 0 ? void 0 : (0, _forEach["default"])(_a).call(_a, function ($list) {
            $containerFragment.append($list);
          }); // 下序列全选被掏空了，就卸磨杀驴吧

          $endElem.remove(); // 在开始序列中添加 文档片段

          this.selectionRangeElem.set($containerFragment);
          $startElem.elems[0].append($containerFragment);
        } // =====================================
        // 由于开头序列 和 结尾序列的标签名一样，所以只判断了开头序列的
        // 当开头序列的标签名和按钮类型 不一致 的时候
        // 代表着当前是一个 转换序列 的操作
        // =====================================
        else {
            // 创建 开始序列和结束序列的文档片段
            var $startFragment = document.createDocumentFragment();
            var $endFragment_1 = document.createDocumentFragment(); // 获取起点元素

            var $startDom = utils_1.getStartPoint($startElem); // 获取上半序列中的选中内容，并添加到文档片段中

            while ($startDom.length) {
              var _element = $startDom.elems[0];
              $startDom = $startDom.next();
              $startFragment.append(_element);
            } // 获取结束元素


            var $endDom = utils_1.getEndPoint($endElem); // 获取下半序列中选中的内容

            var domArr = [];

            while ($endDom.length) {
              domArr.unshift($endDom.elems[0]);
              $endDom = $endDom.prev();
            } // 添加到文档片段中


            (0, _forEach["default"])(domArr).call(domArr, function ($node) {
              $endFragment_1.append($node);
            }); // 合并文档片段

            var $orderFragment = utils_1.createElement(listTarget);
            $orderFragment.append($startFragment);
            $orderFragment.append($containerFragment);
            $orderFragment.append($endFragment_1);
            $containerFragment = $orderFragment; // 插入

            this.selectionRangeElem.set($containerFragment);
            dom_core_1["default"]($orderFragment).insertAfter($startElem); // 序列全选被掏空了后，就卸磨杀驴吧

            !((_b = $startElem.children()) === null || _b === void 0 ? void 0 : _b.length) && $startElem.remove();
            !((_c = $endElem.children()) === null || _c === void 0 ? void 0 : _c.length) && $endElem.remove();
          }
      } // =====================================
      // 开头序列 和 结尾序列 中间没有其他的段落
      // =====================================
      else {
          $nodes.length = 0; // 获取起点元素

          var $startDom = utils_1.getStartPoint($startElem); // 获取上半序列中的选中内容

          while ($startDom.length) {
            $nodes.push($startDom);
            $startDom = $startDom.next();
          } // 获取结束元素


          var $endDom = utils_1.getEndPoint($endElem); // 获取下半序列中选中的内容

          var domArr = []; // 获取下半序列中的选中内容

          while ($endDom.length) {
            domArr.unshift($endDom);
            $endDom = $endDom.prev();
          } // 融合内容


          $nodes.push.apply($nodes, domArr); // =====================================
          // 由于开头序列 和 结尾序列的标签名一样，所以只判断了开头序列的
          // 当开头序列的标签名和按钮类型 一致 的时候
          // 代表着当前是一个 取消序列 的操作
          // =====================================

          if (startNodeName === listType) {
            // 创建 文档片段
            // 把 li 转换为 p 标签
            $containerFragment = utils_1.createElementFragment($nodes, utils_1.createDocumentFragment(), 'p'); // 插入到 endElem 前

            this.selectionRangeElem.set($containerFragment);
            utils_1.insertBefore($startElem, $containerFragment, $endElem.elems[0]);
          } // =====================================
          // 由于开头序列 和 结尾序列的标签名一样，所以只判断了开头序列的
          // 当开头序列的标签名和按钮类型 不一致 的时候
          // 代表着当前是一个 设置序列 的操作
          // =====================================
          else {
              // 创建 序列元素
              $containerFragment = utils_1.createElement(listTarget); // li 元素添加到 序列元素 中

              (0, _forEach["default"])($nodes).call($nodes, function ($list) {
                $containerFragment.append($list.elems[0]);
              }); // 插入到 startElem 之后

              this.selectionRangeElem.set($containerFragment);
              dom_core_1["default"]($containerFragment).insertAfter($startElem);
            } // 序列全选被掏空了后，就卸磨杀驴吧


          !((_d = $startElem.children()) === null || _d === void 0 ? void 0 : _d.length) && $endElem.remove();
          !((_e = $endElem.children()) === null || _e === void 0 ? void 0 : _e.length) && $endElem.remove();
        }
    } // =====================================
    // 由于开头序列 和 结尾序列的标签名不一样
    // =====================================
    else {
        // 下序列元素数组
        var lowerListElems = []; // 获取结束元素

        var $endDom = utils_1.getEndPoint($endElem); // 获取下半序列中选中的内容

        while ($endDom.length) {
          lowerListElems.unshift($endDom);
          $endDom = $endDom.prev();
        } // 上序列元素数组


        var upperListElems = []; // 获取起点元素

        var $startDom = utils_1.getStartPoint($startElem); // 获取上半序列中的选中内容，并添加到文档片段中

        while ($startDom.length) {
          upperListElems.push($startDom);
          $startDom = $startDom.next();
        } // 创建 文档片段


        $containerFragment = utils_1.createDocumentFragment(); // 弹出开头和结尾的序列

        $nodes.shift();
        $nodes.pop(); // 把头部序列的内容添加到文档片段当中

        (0, _forEach["default"])(upperListElems).call(upperListElems, function ($list) {
          return $containerFragment.append($list.elems[0]);
        }); // 生成 li 标签，并且添加到 文档片段中，删除无用节点

        $containerFragment = utils_1.createElementFragment(utils_1.filterSelectionNodes($nodes), // 序列中间的数据 - 进行数据过滤
        $containerFragment); // 把尾部序列的内容添加到文档片段当中

        (0, _forEach["default"])(lowerListElems).call(lowerListElems, function ($list) {
          return $containerFragment.append($list.elems[0]);
        }); // 记录

        this.selectionRangeElem.set($containerFragment); // =====================================
        // 开头序列 和 设置序列类型相同
        // =====================================

        if (startNodeName === listType) {
          // 插入到 开始序列的尾部(作为子元素)
          $startElem.elems[0].append($containerFragment); // 序列全选被掏空了后，就卸磨杀驴吧

          !((_f = $endElem.children()) === null || _f === void 0 ? void 0 : _f.length) && $endElem.remove();
        } // =====================================
        // 结尾序列 和 设置序列类型相同
        // =====================================
        else {
            // 插入到结束序列的顶部(作为子元素)
            if ((_g = $endElem.children()) === null || _g === void 0 ? void 0 : _g.length) {
              var $endElemChild = $endElem.children();
              utils_1.insertBefore($endElemChild, $containerFragment, $endElemChild.elems[0]);
            } else {
              $endElem.elems[0].append($containerFragment);
            }
          }
      }
  };

  return JoinListHandle;
}(ListHandle_1.ListHandle);

exports["default"] = JoinListHandle;

/***/ }),
/* 375 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var ListHandle_1 = __webpack_require__(58);

var utils_1 = __webpack_require__(47);

var StartJoinListHandle =
/** @class */
function (_super) {
  tslib_1.__extends(StartJoinListHandle, _super);

  function StartJoinListHandle(options) {
    return _super.call(this, options) || this;
  }

  StartJoinListHandle.prototype.exec = function () {
    var _a;

    var _b = this.options,
        editor = _b.editor,
        listType = _b.listType,
        listTarget = _b.listTarget,
        $startElem = _b.$startElem; // 容器 - HTML 文档片段

    var $containerFragment; // 获取选中的段落

    var $nodes = editor.selection.getSelectionRangeTopNodes(); // 获取开始段落标签名

    var startNodeName = $startElem === null || $startElem === void 0 ? void 0 : $startElem.getNodeName(); // 弹出 开头序列

    $nodes.shift(); // 上序列元素数组

    var upperListElems = []; // 获取起点元素

    var $startDom = utils_1.getStartPoint($startElem); // 获取上半序列中的选中内容，并添加到文档片段中

    while ($startDom.length) {
      upperListElems.push($startDom);
      $startDom = $startDom.next();
    } // =====================================
    // 当前序列类型和开头序列的类型 一致
    // 代表当前是一个 融合(把其他段落加入到开头序列中) 的操作
    // =====================================


    if (startNodeName === listType) {
      $containerFragment = utils_1.createDocumentFragment();
      (0, _forEach["default"])(upperListElems).call(upperListElems, function ($list) {
        return $containerFragment.append($list.elems[0]);
      }); // 生成 li 元属，并删除

      $containerFragment = utils_1.createElementFragment(utils_1.filterSelectionNodes($nodes), // 过滤元素节点数据
      $containerFragment); // 插入到开始序列末尾

      this.selectionRangeElem.set($containerFragment); // this.selectionRangeElem.set($startElem.elems[0])

      $startElem.elems[0].append($containerFragment);
    } // =====================================
    // 当前序列类型和开头序列的类型 不一致
    // 代表当前是一个 设置序列 的操作
    // =====================================
    else {
        // 创建 序列节点
        $containerFragment = utils_1.createElement(listTarget);
        (0, _forEach["default"])(upperListElems).call(upperListElems, function ($list) {
          return $containerFragment.append($list.elems[0]);
        }); // 生成 li 元素，并添加到 序列节点 当中，删除无用节点

        $containerFragment = utils_1.createElementFragment(utils_1.filterSelectionNodes($nodes), // 过滤普通节点
        $containerFragment); // 插入到开始元素

        this.selectionRangeElem.set($containerFragment);
        dom_core_1["default"]($containerFragment).insertAfter($startElem); // 序列全选被掏空了后，就卸磨杀驴吧

        !((_a = $startElem.children()) === null || _a === void 0 ? void 0 : _a.length) && $startElem.remove();
      }
  };

  return StartJoinListHandle;
}(ListHandle_1.ListHandle);

exports["default"] = StartJoinListHandle;

/***/ }),
/* 376 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var ListHandle_1 = __webpack_require__(58);

var utils_1 = __webpack_require__(47);

var EndJoinListHandle =
/** @class */
function (_super) {
  tslib_1.__extends(EndJoinListHandle, _super);

  function EndJoinListHandle(options) {
    return _super.call(this, options) || this;
  }

  EndJoinListHandle.prototype.exec = function () {
    var _a, _b;

    var _c = this.options,
        editor = _c.editor,
        listType = _c.listType,
        listTarget = _c.listTarget,
        $endElem = _c.$endElem; // 容器 - HTML 文档片段

    var $containerFragment; // 获取选中的段落

    var $nodes = editor.selection.getSelectionRangeTopNodes(); // 获取结束段落标签名

    var endNodeName = $endElem === null || $endElem === void 0 ? void 0 : $endElem.getNodeName(); // 弹出 结束序列

    $nodes.pop(); // 下序列元素数组

    var lowerListElems = []; // 获取结束元素

    var $endDom = utils_1.getEndPoint($endElem); // 获取下半序列中选中的内容

    while ($endDom.length) {
      lowerListElems.unshift($endDom);
      $endDom = $endDom.prev();
    } // =====================================
    // 当前序列类型和结束序列的类型 一致
    // 代表当前是一个 融合(把其他段落加入到结束序列中) 的操作
    // =====================================


    if (endNodeName === listType) {
      // 生成 li 元属，并删除原来的 dom 元素
      $containerFragment = utils_1.createElementFragment(utils_1.filterSelectionNodes($nodes), // 过滤元素节点数据
      utils_1.createDocumentFragment() // 创建 文档片段
      );
      (0, _forEach["default"])(lowerListElems).call(lowerListElems, function ($list) {
        return $containerFragment.append($list.elems[0]);
      }); // 插入到结束序列之前

      this.selectionRangeElem.set($containerFragment);

      if ((_a = $endElem.children()) === null || _a === void 0 ? void 0 : _a.length) {
        var $endElemChild = $endElem.children();
        utils_1.insertBefore($endElemChild, $containerFragment, $endElemChild.elems[0]);
      } else {
        $endElem.elems[0].append($containerFragment);
      }
    } // =====================================
    // 当前序列类型和结束序列的类型 不一致
    // 代表当前是一个 设置序列 的操作
    // =====================================
    else {
        // 过滤元素节点数据
        var $selectionNodes = utils_1.filterSelectionNodes($nodes); // 把下序列的内容添加到过滤元素中

        $selectionNodes.push.apply($selectionNodes, lowerListElems); // 生成 li 元素并且添加到序列节点后删除原节点

        $containerFragment = utils_1.createElementFragment($selectionNodes, utils_1.createElement(listTarget) // 创建 序列节点
        ); // 插入到结束序列之前

        this.selectionRangeElem.set($containerFragment);
        dom_core_1["default"]($containerFragment).insertBefore($endElem); // 序列全选被掏空了后，就卸磨杀驴吧

        !((_b = $endElem.children()) === null || _b === void 0 ? void 0 : _b.length) && $endElem.remove();
      }
  };

  return EndJoinListHandle;
}(ListHandle_1.ListHandle);

exports["default"] = EndJoinListHandle;

/***/ }),
/* 377 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var ListHandle_1 = __webpack_require__(58);

var utils_1 = __webpack_require__(47);

var OtherListHandle =
/** @class */
function (_super) {
  tslib_1.__extends(OtherListHandle, _super);

  function OtherListHandle(options, range) {
    var _this = _super.call(this, options) || this;

    _this.range = range;
    return _this;
  }

  OtherListHandle.prototype.exec = function () {
    var _a = this.options,
        editor = _a.editor,
        listTarget = _a.listTarget; // 获取选中的段落

    var $nodes = editor.selection.getSelectionRangeTopNodes(); // 生成 li 元素并且添加到序列节点后删除原节点

    var $containerFragment = utils_1.createElementFragment(utils_1.filterSelectionNodes($nodes), // 过滤选取的元素
    utils_1.createElement(listTarget) // 创建 序列节点
    ); // 插入节点到选区

    this.selectionRangeElem.set($containerFragment);
    this.range.insertNode($containerFragment);
  };

  return OtherListHandle;
}(ListHandle_1.ListHandle);

exports["default"] = OtherListHandle;

/***/ }),
/* 378 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 段落行高 LineHeight
 * @author lichunlin
 *
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

var _indexOf = _interopRequireDefault(__webpack_require__(27));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var DropListMenu_1 = tslib_1.__importDefault(__webpack_require__(24));

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var lineHeightList_1 = tslib_1.__importDefault(__webpack_require__(379));

var LineHeight =
/** @class */
function (_super) {
  tslib_1.__extends(LineHeight, _super);

  function LineHeight(editor) {
    var _this = this;

    var $elem = dom_core_1["default"]("<div class=\"w-e-menu\" data-title=\"\u884C\u9AD8\">\n                    <i class=\"w-e-icon-row-height\"></i>\n                </div>");
    var lineHeightMenu = new lineHeightList_1["default"](editor, editor.config.lineHeights);
    var DropListMenu = {
      width: 100,
      title: '设置行高',
      type: 'list',
      list: lineHeightMenu.getItemList(),
      clickHandler: function clickHandler(value) {
        //保存焦点
        editor.selection.saveRange();

        _this.command(value);
      }
    };
    _this = _super.call(this, $elem, editor, DropListMenu) || this;
    return _this;
  }
  /**
   * 执行命令
   * @param value value
   */


  LineHeight.prototype.command = function (value) {
    var editor = this.editor; //重置选区

    editor.selection.restoreSelection(); // 获取选区的祖先元素

    var $containerElem = dom_core_1["default"](editor.selection.getSelectionContainerElem());
    if (!$containerElem.elems.length) return; //选中多行操作

    if ($containerElem && editor.$textElem.equal($containerElem)) {
      // 标识是否可以设置行高的样式
      var setStyleLock = false; //获取range 开头结束的dom

      var selectionStartElem = dom_core_1["default"](editor.selection.getSelectionStartElem()).elems[0];
      var SelectionEndElem = dom_core_1["default"](editor.selection.getSelectionEndElem()).elems[0]; // 获取选区中，在contenteditable下的直接父元素

      var StartElemWrap = this.getDom(selectionStartElem);
      var EndElemWrap = this.getDom(SelectionEndElem);
      var containerElemChildren = $containerElem.elems[0].children;

      for (var i = 0; i < containerElemChildren.length; i++) {
        var item = containerElemChildren[i]; // 目前只支持p 段落标签设置行高

        if (dom_core_1["default"](item).getNodeName() !== 'P') {
          continue;
        }

        if (item === StartElemWrap) {
          setStyleLock = true;
        } // 证明在区间节点里


        if (setStyleLock) {
          dom_core_1["default"](item).css('line-height', value);

          if (item === EndElemWrap) {
            setStyleLock = false; // 当设置完选择的EndElemWrap时，就可以退出

            return;
          }
        }
      } //重新设置选区


      editor.selection.createRangeByElems(selectionStartElem, SelectionEndElem);
      return;
    } // 单行操作
    // 选中区间的dom元素


    var selectElem = $containerElem.elems[0]; // 获取选区中，在contenteditable下的直接父元素

    var selectElemWrapdom = this.getDom(selectElem); // 目前只支持p 段落标签设置行高

    if (dom_core_1["default"](selectElemWrapdom).getNodeName() !== 'P') {
      return;
    }

    dom_core_1["default"](selectElemWrapdom).css('line-height', value); //重新设置选区

    editor.selection.createRangeByElems(selectElemWrapdom, selectElemWrapdom);
    return;
  };
  /**
   * 遍历dom 获取祖父元素 直到contenteditable属性的div标签
   *
   */


  LineHeight.prototype.getDom = function (dom) {
    var DOM = dom_core_1["default"](dom).elems[0];

    if (!DOM.parentNode) {
      return DOM;
    }

    function getParentNode($node, editor) {
      var $parent = dom_core_1["default"]($node.parentNode);

      if (editor.$textElem.equal($parent)) {
        return $node;
      } else {
        return getParentNode($parent.elems[0], editor);
      }
    }

    DOM = getParentNode(DOM, this.editor);
    return DOM;
  };
  /**
   * style 处理
   *
   * 废弃的方法
   */


  LineHeight.prototype.styleProcessing = function (styleList) {
    var styleStr = '';
    (0, _forEach["default"])(styleList).call(styleList, function (item) {
      item !== '' && (0, _indexOf["default"])(item).call(item, 'line-height') === -1 ? styleStr = styleStr + item + ';' : '';
    });
    return styleStr;
  };
  /**
   * 段落全选 比如：避免11变成111
   *
   * 废弃的方法
   */


  LineHeight.prototype.setRange = function (startDom, endDom) {
    var editor = this.editor;
    var selection = window.getSelection ? window.getSelection() : document.getSelection(); //清除所有的选区

    selection === null || selection === void 0 ? void 0 : selection.removeAllRanges();
    var range = document.createRange();
    var star = startDom;
    var end = endDom;
    range.setStart(star, 0);
    range.setEnd(end, 1);
    selection === null || selection === void 0 ? void 0 : selection.addRange(range); //保存设置好的选区

    editor.selection.saveRange(); //清除所有的选区

    selection === null || selection === void 0 ? void 0 : selection.removeAllRanges(); //恢复选区

    editor.selection.restoreSelection();
  };
  /**
   * 尝试修改菜单激活状态
   */


  LineHeight.prototype.tryChangeActive = function () {
    var editor = this.editor;
    var $selectionElem = editor.selection.getSelectionContainerElem();

    if ($selectionElem && editor.$textElem.equal($selectionElem)) {
      //避免选中多行设置
      return;
    }

    var dom = dom_core_1["default"](editor.selection.getSelectionStartElem()); // 有些情况下 dom 可能为空，比如编辑器初始化

    if (dom.length === 0) return;
    dom = this.getDom(dom.elems[0]);
    var style = dom.getAttribute('style') ? dom.getAttribute('style') : ''; //判断当前标签是否具有line-height属性

    if (style && (0, _indexOf["default"])(style).call(style, 'line-height') !== -1) {
      this.active();
    } else {
      this.unActive();
    }
  };

  return LineHeight;
}(DropListMenu_1["default"]);

exports["default"] = LineHeight;

/***/ }),
/* 379 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);
/**
 * @description 行高 菜单
 * @author lichunlin
 */


var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var lineHeightList =
/** @class */
function () {
  function lineHeightList(editor, list) {
    var _this = this;

    this.itemList = [{
      $elem: dom_core_1["default"]("<span>" + editor.i18next.t('默认') + "</span>"),
      value: ''
    }];
    (0, _forEach["default"])(list).call(list, function (item) {
      _this.itemList.push({
        $elem: dom_core_1["default"]("<span>" + item + "</span>"),
        value: item
      });
    });
  }

  lineHeightList.prototype.getItemList = function () {
    return this.itemList;
  };

  return lineHeightList;
}();

exports["default"] = lineHeightList;

/***/ }),
/* 380 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 撤销
 * @author tonghan
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var BtnMenu_1 = tslib_1.__importDefault(__webpack_require__(23));

var Undo =
/** @class */
function (_super) {
  tslib_1.__extends(Undo, _super);

  function Undo(editor) {
    var _this = this;

    var $elem = dom_core_1["default"]("<div class=\"w-e-menu\" data-title=\"\u64A4\u9500\">\n                <i class=\"w-e-icon-undo\"></i>\n            </div>");
    _this = _super.call(this, $elem, editor) || this;
    return _this;
  }
  /**
   * 点击事件
   */


  Undo.prototype.clickHandler = function () {
    var editor = this.editor;
    editor.history.revoke(); // 重新创建 range，是处理当初始化编辑器，API插入内容后撤销，range 不在编辑器内部的问题

    var children = editor.$textElem.children();
    if (!(children === null || children === void 0 ? void 0 : children.length)) return;
    var $last = children.last();
    editor.selection.createRangeByElem($last, false, true);
    editor.selection.restoreSelection();
  };
  /**
   * 尝试修改菜单激活状态
   */


  Undo.prototype.tryChangeActive = function () {
    // 标准模式下才进行操作
    if (!this.editor.isCompatibleMode) {
      if (this.editor.history.size[0]) {
        this.active();
      } else {
        this.unActive();
      }
    }
  };

  return Undo;
}(BtnMenu_1["default"]);

exports["default"] = Undo;

/***/ }),
/* 381 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 重做
 * @author tonghan
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var BtnMenu_1 = tslib_1.__importDefault(__webpack_require__(23));

var Redo =
/** @class */
function (_super) {
  tslib_1.__extends(Redo, _super);

  function Redo(editor) {
    var _this = this;

    var $elem = dom_core_1["default"]("<div class=\"w-e-menu\" data-title=\"\u6062\u590D\">\n                <i class=\"w-e-icon-redo\"></i>\n            </div>");
    _this = _super.call(this, $elem, editor) || this;
    return _this;
  }
  /**
   * 点击事件
   */


  Redo.prototype.clickHandler = function () {
    var editor = this.editor;
    editor.history.restore(); // 重新创建 range，是处理当初始化编辑器，API插入内容后撤销，range 不在编辑器内部的问题

    var children = editor.$textElem.children();
    if (!(children === null || children === void 0 ? void 0 : children.length)) return;
    var $last = children.last();
    editor.selection.createRangeByElem($last, false, true);
    editor.selection.restoreSelection();
  };
  /**
   * 尝试修改菜单激活状态
   */


  Redo.prototype.tryChangeActive = function () {
    // 标准模式下才进行操作
    if (!this.editor.isCompatibleMode) {
      if (this.editor.history.size[1]) {
        this.active();
      } else {
        this.unActive();
      }
    }
  };

  return Redo;
}(BtnMenu_1["default"]);

exports["default"] = Redo;

/***/ }),
/* 382 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 创建table
 * @author lichunlin
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var PanelMenu_1 = tslib_1.__importDefault(__webpack_require__(38));

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var create_panel_conf_1 = tslib_1.__importDefault(__webpack_require__(383));

var Panel_1 = tslib_1.__importDefault(__webpack_require__(33));

var index_1 = tslib_1.__importDefault(__webpack_require__(392));

var Table =
/** @class */
function (_super) {
  tslib_1.__extends(Table, _super);

  function Table(editor) {
    var _this = this;

    var $elem = dom_core_1["default"]('<div class="w-e-menu" data-title="表格"><i class="w-e-icon-table2"></i></div>');
    _this = _super.call(this, $elem, editor) || this; // 绑定事件

    index_1["default"](editor);
    return _this;
  }
  /**
   * 菜单点击事件
   */


  Table.prototype.clickHandler = function () {
    this.createPanel();
  };
  /**
   * 创建 panel
   */


  Table.prototype.createPanel = function () {
    var conf = create_panel_conf_1["default"](this.editor);
    var panel = new Panel_1["default"](this, conf);
    panel.create();
  };
  /**
   * 尝试修改菜单 active 状态
   */


  Table.prototype.tryChangeActive = function () {};

  return Table;
}(PanelMenu_1["default"]);

exports["default"] = Table;

/***/ }),
/* 383 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description table 菜单 panel tab 配置
 * @author lichunlin
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _isInteger = _interopRequireDefault(__webpack_require__(384));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var util_1 = __webpack_require__(6);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

__webpack_require__(389);

var create_table_1 = tslib_1.__importDefault(__webpack_require__(391));
/**
 * 判断一个数值是否为正整数
 * @param { number } n 被验证的值
 */


function isPositiveInteger(n) {
  //是否为正整数
  return n > 0 && (0, _isInteger["default"])(n);
}

function default_1(editor) {
  var createTable = new create_table_1["default"](editor); // panel 中需要用到的id

  var colId = util_1.getRandom('w-col-id');
  var rowId = util_1.getRandom('w-row-id');
  var insertBtnId = util_1.getRandom('btn-link');
  var i18nPrefix = 'menus.panelMenus.table.';

  var t = function t(text) {
    return editor.i18next.t(text);
  }; // tabs 配置 -----------------------------------------


  var tabsConf = [{
    title: t(i18nPrefix + "\u63D2\u5165\u8868\u683C"),
    tpl: "<div>\n                    <div class=\"w-e-table\">\n                        <span>" + t('创建') + "</span>\n                        <input id=\"" + rowId + "\"  type=\"text\" class=\"w-e-table-input\" value=\"5\"/></td>\n                        <span>" + t(i18nPrefix + "\u884C") + "</span>\n                        <input id=\"" + colId + "\" type=\"text\" class=\"w-e-table-input\" value=\"5\"/></td>\n                        <span>" + (t(i18nPrefix + "\u5217") + t(i18nPrefix + "\u7684") + t(i18nPrefix + "\u8868\u683C")) + "</span>\n                    </div>\n                    <div class=\"w-e-button-container\">\n                        <button type=\"button\" id=\"" + insertBtnId + "\" class=\"right\">" + t('插入') + "</button>\n                    </div>\n                </div>",
    events: [{
      selector: '#' + insertBtnId,
      type: 'click',
      fn: function fn() {
        var colValue = Number(dom_core_1["default"]('#' + colId).val());
        var rowValue = Number(dom_core_1["default"]('#' + rowId).val()); //校验是否传值

        if (isPositiveInteger(rowValue) && isPositiveInteger(colValue)) {
          createTable.createAction(rowValue, colValue);
          return true;
        } else {
          editor.config.customAlert('表格行列请输入正整数', 'warning');
          return false;
        } // 返回 true 表示函数执行结束之后关闭 panel

      },
      bindEnter: true
    }]
  }]; // tabs end
  // 最终的配置 -----------------------------------------

  var conf = {
    width: 330,
    height: 0,
    tabs: []
  };
  conf.tabs.push(tabsConf[0]);
  return conf;
}

exports["default"] = default_1;

/***/ }),
/* 384 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(385);

/***/ }),
/* 385 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(386);

module.exports = parent;


/***/ }),
/* 386 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(387);
var path = __webpack_require__(9);

module.exports = path.Number.isInteger;


/***/ }),
/* 387 */
/***/ (function(module, exports, __webpack_require__) {

var $ = __webpack_require__(5);
var isInteger = __webpack_require__(388);

// `Number.isInteger` method
// https://tc39.github.io/ecma262/#sec-number.isinteger
$({ target: 'Number', stat: true }, {
  isInteger: isInteger
});


/***/ }),
/* 388 */
/***/ (function(module, exports, __webpack_require__) {

var isObject = __webpack_require__(13);

var floor = Math.floor;

// `Number.isInteger` method implementation
// https://tc39.github.io/ecma262/#sec-number.isinteger
module.exports = function isInteger(it) {
  return !isObject(it) && isFinite(it) && floor(it) === it;
};


/***/ }),
/* 389 */
/***/ (function(module, exports, __webpack_require__) {

var api = __webpack_require__(20);
            var content = __webpack_require__(390);

            content = content.__esModule ? content.default : content;

            if (typeof content === 'string') {
              content = [[module.i, content, '']];
            }

var options = {};

options.insert = "head";
options.singleton = false;

var update = api(content, options);



module.exports = content.locals || {};

/***/ }),
/* 390 */
/***/ (function(module, exports, __webpack_require__) {

// Imports
var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(21);
exports = ___CSS_LOADER_API_IMPORT___(false);
// Module
exports.push([module.i, ".w-e-table {\n  display: flex;\n}\n.w-e-table .w-e-table-input {\n  width: 40px;\n  text-align: center!important;\n  margin: 0 5px;\n}\n", ""]);
// Exports
module.exports = exports;


/***/ }),
/* 391 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 创建tabel
 * @author lichunlin
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var const_1 = __webpack_require__(7);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var CreateTable =
/** @class */
function () {
  function CreateTable(editor) {
    this.editor = editor;
  }
  /**
   * 执行创建
   * @param rowValue 行数
   * @param colValue 列数
   */


  CreateTable.prototype.createAction = function (rowValue, colValue) {
    var editor = this.editor; //不允许在有序列表中添加table

    var $selectionElem = dom_core_1["default"](editor.selection.getSelectionContainerElem());
    var $ul = dom_core_1["default"]($selectionElem.elems[0]).parentUntilEditor('UL', editor);
    var $ol = dom_core_1["default"]($selectionElem.elems[0]).parentUntilEditor('OL', editor);

    if ($ul || $ol) {
      return;
    }

    var tableDom = this.createTableHtml(rowValue, colValue);
    editor.cmd["do"]('insertHTML', tableDom);
  };
  /**
   * 创建table、行、列
   * @param rowValue 行数
   * @param colValue 列数
   */


  CreateTable.prototype.createTableHtml = function (rowValue, colValue) {
    var rowStr = '';
    var colStr = '';

    for (var i = 0; i < rowValue; i++) {
      colStr = '';

      for (var j = 0; j < colValue; j++) {
        if (i === 0) {
          colStr = colStr + '<th></th>';
        } else {
          colStr = colStr + '<td></td>';
        }
      }

      rowStr = rowStr + '<tr>' + colStr + '</tr>';
    }

    var tableDom = "<table border=\"0\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tbody>" + rowStr + ("</tbody></table>" + const_1.EMPTY_P);
    return tableDom;
  };

  return CreateTable;
}();

exports["default"] = CreateTable;

/***/ }),
/* 392 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 绑定点击事件
 * @author lichunlin
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var tooltip_event_1 = tslib_1.__importDefault(__webpack_require__(393));

var table_event_1 = __webpack_require__(400);
/**
 * 绑定事件
 * @param editor 编辑器实例
 */


function bindEvent(editor) {
  //Tooltip
  tooltip_event_1["default"](editor);
  table_event_1.bindEventKeyboardEvent(editor);
  table_event_1.bindClickEvent(editor);
}

exports["default"] = bindEvent;

/***/ }),
/* 393 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description tooltip 事件
 * @author lichunlin
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var Tooltip_1 = tslib_1.__importDefault(__webpack_require__(39)); //操作事件


var operating_event_1 = tslib_1.__importDefault(__webpack_require__(394));

var getNode_1 = tslib_1.__importDefault(__webpack_require__(399));

var const_1 = __webpack_require__(7);
/**
 * 生成 Tooltip 的显示隐藏函数
 */


function createShowHideFn(editor) {
  var tooltip;
  /**
   * 显示 tooltip
   * @param  table元素
   */

  function showTableTooltip($node) {
    var getnode = new getNode_1["default"](editor);
    var i18nPrefix = 'menus.panelMenus.table.';

    var t = function t(text, prefix) {
      if (prefix === void 0) {
        prefix = i18nPrefix;
      }

      return editor.i18next.t(prefix + text);
    };

    var conf = [{
      // $elem: $("<span class='w-e-icon-trash-o'></span>"),
      $elem: dom_core_1["default"]("<span>" + t('删除表格') + "</span>"),
      onClick: function onClick(editor, $node) {
        // 选中img元素
        editor.selection.createRangeByElem($node);
        editor.selection.restoreSelection();
        editor.cmd["do"]('insertHTML', const_1.EMPTY_P); // 返回 true，表示执行完之后，隐藏 tooltip。否则不隐藏。

        return true;
      }
    }, {
      $elem: dom_core_1["default"]("<span>" + t('添加行') + "</span>"),
      onClick: function onClick(editor, $node) {
        // 禁止多选操作
        var isMore = isMoreRowAction(editor);

        if (isMore) {
          return true;
        } //当前元素


        var selectDom = dom_core_1["default"](editor.selection.getSelectionStartElem()); //当前行

        var $currentRow = getnode.getRowNode(selectDom.elems[0]);

        if (!$currentRow) {
          return true;
        } //获取当前行的index


        var index = Number(getnode.getCurrentRowIndex($node.elems[0], $currentRow)); //生成要替换的html

        var htmlStr = getnode.getTableHtml($node.elems[0]); //生成新的table

        var newdom = getnode.getTableHtml(operating_event_1["default"].ProcessingRow(dom_core_1["default"](htmlStr), index).elems[0]);
        newdom = _isEmptyP($node, newdom); // 选中table

        editor.selection.createRangeByElem($node);
        editor.selection.restoreSelection();
        editor.cmd["do"]('insertHTML', newdom);
        return true;
      }
    }, {
      $elem: dom_core_1["default"]("<span>" + t('删除行') + "</span>"),
      onClick: function onClick(editor, $node) {
        // 禁止多选操作
        var isMore = isMoreRowAction(editor);

        if (isMore) {
          return true;
        } //当前元素


        var selectDom = dom_core_1["default"](editor.selection.getSelectionStartElem()); //当前行

        var $currentRow = getnode.getRowNode(selectDom.elems[0]);

        if (!$currentRow) {
          return true;
        } //获取当前行的index


        var index = Number(getnode.getCurrentRowIndex($node.elems[0], $currentRow)); //生成要替换的html

        var htmlStr = getnode.getTableHtml($node.elems[0]); //获取新生成的table 判断是否是最后一行被删除 是 删除整个table

        var trLength = operating_event_1["default"].DeleteRow(dom_core_1["default"](htmlStr), index).elems[0].children[0].children.length; //生成新的table

        var newdom = ''; // 选中table

        editor.selection.createRangeByElem($node);
        editor.selection.restoreSelection();

        if (trLength === 0) {
          newdom = const_1.EMPTY_P;
        } else {
          newdom = getnode.getTableHtml(operating_event_1["default"].DeleteRow(dom_core_1["default"](htmlStr), index).elems[0]);
        }

        newdom = _isEmptyP($node, newdom);
        editor.cmd["do"]('insertHTML', newdom);
        return true;
      }
    }, {
      $elem: dom_core_1["default"]("<span>" + t('添加列') + "</span>"),
      onClick: function onClick(editor, $node) {
        // 禁止多选操作
        var isMore = isMoreRowAction(editor);

        if (isMore) {
          return true;
        } //当前元素


        var selectDom = dom_core_1["default"](editor.selection.getSelectionStartElem()); //当前列的index

        var index = getnode.getCurrentColIndex(selectDom.elems[0]); //生成要替换的html

        var htmlStr = getnode.getTableHtml($node.elems[0]); //生成新的table

        var newdom = getnode.getTableHtml(operating_event_1["default"].ProcessingCol(dom_core_1["default"](htmlStr), index).elems[0]);
        newdom = _isEmptyP($node, newdom); // 选中table

        editor.selection.createRangeByElem($node);
        editor.selection.restoreSelection();
        editor.cmd["do"]('insertHTML', newdom);
        return true;
      }
    }, {
      $elem: dom_core_1["default"]("<span>" + t('删除列') + "</span>"),
      onClick: function onClick(editor, $node) {
        // 禁止多选操作
        var isMore = isMoreRowAction(editor);

        if (isMore) {
          return true;
        } //当前元素


        var selectDom = dom_core_1["default"](editor.selection.getSelectionStartElem()); //当前列的index

        var index = getnode.getCurrentColIndex(selectDom.elems[0]); //生成要替换的html

        var htmlStr = getnode.getTableHtml($node.elems[0]); //获取新生成的table 判断是否是最后一列被删除 是 删除整个table

        var newDom = operating_event_1["default"].DeleteCol(dom_core_1["default"](htmlStr), index); // 获取子节点的数量

        var tdLength = newDom.elems[0].children[0].children[0].children.length; //生成新的table

        var newdom = ''; // 选中table

        editor.selection.createRangeByElem($node);
        editor.selection.restoreSelection(); // 如果没有列了 则替换成空行

        if (tdLength === 0) {
          newdom = const_1.EMPTY_P;
        } else {
          newdom = getnode.getTableHtml(newDom.elems[0]);
        }

        newdom = _isEmptyP($node, newdom);
        editor.cmd["do"]('insertHTML', newdom);
        return true;
      }
    }, {
      $elem: dom_core_1["default"]("<span>" + t('设置表头') + "</span>"),
      onClick: function onClick(editor, $node) {
        // 禁止多选操作
        var isMore = isMoreRowAction(editor);

        if (isMore) {
          return true;
        } //当前元素


        var selectDom = dom_core_1["default"](editor.selection.getSelectionStartElem()); //当前行

        var $currentRow = getnode.getRowNode(selectDom.elems[0]);

        if (!$currentRow) {
          return true;
        } //获取当前行的index


        var index = Number(getnode.getCurrentRowIndex($node.elems[0], $currentRow));

        if (index !== 0) {
          //控制在table的第一行
          index = 0;
        } //生成要替换的html


        var htmlStr = getnode.getTableHtml($node.elems[0]); //生成新的table

        var newdom = getnode.getTableHtml(operating_event_1["default"].setTheHeader(dom_core_1["default"](htmlStr), index, 'th').elems[0]);
        newdom = _isEmptyP($node, newdom); // 选中table

        editor.selection.createRangeByElem($node);
        editor.selection.restoreSelection();
        editor.cmd["do"]('insertHTML', newdom);
        return true;
      }
    }, {
      $elem: dom_core_1["default"]("<span>" + t('取消表头') + "</span>"),
      onClick: function onClick(editor, $node) {
        //当前元素
        var selectDom = dom_core_1["default"](editor.selection.getSelectionStartElem()); //当前行

        var $currentRow = getnode.getRowNode(selectDom.elems[0]);

        if (!$currentRow) {
          return true;
        } //获取当前行的index


        var index = Number(getnode.getCurrentRowIndex($node.elems[0], $currentRow));

        if (index !== 0) {
          //控制在table的第一行
          index = 0;
        } //生成要替换的html


        var htmlStr = getnode.getTableHtml($node.elems[0]); //生成新的table

        var newdom = getnode.getTableHtml(operating_event_1["default"].setTheHeader(dom_core_1["default"](htmlStr), index, 'td').elems[0]);
        newdom = _isEmptyP($node, newdom); // 选中table

        editor.selection.createRangeByElem($node);
        editor.selection.restoreSelection();
        editor.cmd["do"]('insertHTML', newdom);
        return true;
      }
    }];
    tooltip = new Tooltip_1["default"](editor, $node, conf);
    tooltip.create();
  }
  /**
   * 隐藏 tooltip
   */


  function hideTableTooltip() {
    // 移除 tooltip
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }
  }

  return {
    showTableTooltip: showTableTooltip,
    hideTableTooltip: hideTableTooltip
  };
}
/**
 * 判断是否是多行
 */


function isMoreRowAction(editor) {
  var $startElem = editor.selection.getSelectionStartElem();
  var $endElem = editor.selection.getSelectionEndElem();

  if (($startElem === null || $startElem === void 0 ? void 0 : $startElem.elems[0]) !== ($endElem === null || $endElem === void 0 ? void 0 : $endElem.elems[0])) {
    return true;
  } else {
    return false;
  }
}
/**
 * 绑定 tooltip 事件
 * @param editor 编辑器实例
 */


function bindTooltipEvent(editor) {
  var _a = createShowHideFn(editor),
      showTableTooltip = _a.showTableTooltip,
      hideTableTooltip = _a.hideTableTooltip; // 点击table元素是，显示 tooltip


  editor.txt.eventHooks.tableClickEvents.push(showTableTooltip); // 点击其他地方，或者滚动时，隐藏 tooltip

  editor.txt.eventHooks.clickEvents.push(hideTableTooltip);
  editor.txt.eventHooks.keyupEvents.push(hideTableTooltip);
  editor.txt.eventHooks.toolbarClickEvents.push(hideTableTooltip);
  editor.txt.eventHooks.menuClickEvents.push(hideTableTooltip);
  editor.txt.eventHooks.textScrollEvents.push(hideTableTooltip);
}

exports["default"] = bindTooltipEvent;
/**
 * 判断表格的下一个节点是否是空行
 */

function _isEmptyP($node, newdom) {
  // 当表格的下一个兄弟节点是空行时，在 newdom 后添加 EMPTY_P
  var nextNode = $node.elems[0].nextSibling;

  if (!nextNode || nextNode.innerHTML === '<br>') {
    newdom += "" + const_1.EMPTY_P;
  }

  return newdom;
}

/***/ }),
/* 394 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _slice = _interopRequireDefault(__webpack_require__(45));

var _splice = _interopRequireDefault(__webpack_require__(91));

var _forEach = _interopRequireDefault(__webpack_require__(4));

var _from = _interopRequireDefault(__webpack_require__(138));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));
/**
 * 处理新添加行
 * @param $node 整个table
 * @param _index 行的inde
 */


function ProcessingRow($node, _index) {
  //执行获取tbody节点
  var $dom = generateDomAction($node); //取出所有的行

  var domArray = (0, _slice["default"])(Array.prototype).apply($dom.children); //列的数量

  var childrenLength = domArray[0].children.length; //创建新tr

  var tr = document.createElement('tr');

  for (var i = 0; i < childrenLength; i++) {
    var td = document.createElement('td');
    tr.appendChild(td);
  } //插入集合中


  (0, _splice["default"])(domArray).call(domArray, _index + 1, 0, tr); //移除、新增节点事件

  removeAndInsertAction($dom, domArray);
  return dom_core_1["default"]($dom.parentNode);
}
/**
 * 处理新添加列
 * @param $node 整个table
 * @param _index 列的inde
 */


function ProcessingCol($node, _index) {
  //执行获取tbody节点
  var $dom = generateDomAction($node); //取出所有的行

  var domArray = (0, _slice["default"])(Array.prototype).apply($dom.children);

  var _loop_1 = function _loop_1(i) {
    var _context;

    var cArray = []; //取出所有的列

    (0, _forEach["default"])(_context = (0, _from["default"])(domArray[i].children)).call(_context, function (item) {
      cArray.push(item);
    }); //移除行的旧的子节点

    while (domArray[i].children.length !== 0) {
      domArray[i].removeChild(domArray[i].children[0]);
    } //列分th td


    var td = dom_core_1["default"](cArray[0]).getNodeName() !== 'TH' ? document.createElement('td') : document.createElement('th'); // let td = document.createElement('td')

    (0, _splice["default"])(cArray).call(cArray, _index + 1, 0, td); //插入新的子节点

    for (var j = 0; j < cArray.length; j++) {
      domArray[i].appendChild(cArray[j]);
    }
  }; //创建td


  for (var i = 0; i < domArray.length; i++) {
    _loop_1(i);
  } //移除、新增节点事件


  removeAndInsertAction($dom, domArray);
  return dom_core_1["default"]($dom.parentNode);
}
/**
 * 处理删除行
 * @param $node  整个table
 * @param _index  行的inde
 */


function DeleteRow($node, _index) {
  //执行获取tbody节点
  var $dom = generateDomAction($node); //取出所有的行

  var domArray = (0, _slice["default"])(Array.prototype).apply($dom.children); //删除行

  (0, _splice["default"])(domArray).call(domArray, _index, 1); //移除、新增节点事件

  removeAndInsertAction($dom, domArray);
  return dom_core_1["default"]($dom.parentNode);
}
/**
 * 处理删除列
 * @param $node
 * @param _index
 */


function DeleteCol($node, _index) {
  //执行获取tbody节点
  var $dom = generateDomAction($node); //取出所有的行

  var domArray = (0, _slice["default"])(Array.prototype).apply($dom.children);

  var _loop_2 = function _loop_2(i) {
    var _context2;

    var cArray = []; //取出所有的列

    (0, _forEach["default"])(_context2 = (0, _from["default"])(domArray[i].children)).call(_context2, function (item) {
      cArray.push(item);
    }); //移除行的旧的子节点

    while (domArray[i].children.length !== 0) {
      domArray[i].removeChild(domArray[i].children[0]);
    }

    (0, _splice["default"])(cArray).call(cArray, _index, 1); //插入新的子节点

    for (var j = 0; j < cArray.length; j++) {
      domArray[i].appendChild(cArray[j]);
    }
  }; //创建td


  for (var i = 0; i < domArray.length; i++) {
    _loop_2(i);
  } //移除、新增节点事件


  removeAndInsertAction($dom, domArray);
  return dom_core_1["default"]($dom.parentNode);
}
/**
 * 处理设置/取消表头
 * @param $node
 * @param _index
 * @type 替换的标签 th还是td
 */


function setTheHeader($node, _index, type) {
  // 执行获取tbody节点
  var $dom = generateDomAction($node); // 取出所有的行

  var domArray = (0, _slice["default"])(Array.prototype).apply($dom.children); // 列的数量

  var cols = domArray[_index].children; // 创建新tr

  var tr = document.createElement('tr');

  var _loop_3 = function _loop_3(i) {
    var _context3;

    // 根据type(td 或者 th)生成对应的el
    var el = document.createElement(type);
    var col = cols[i];
    /**
     * 没有使用children是因为谷歌纯文本内容children数组就为空，而火狐纯文本内容是“xxx<br>”使用children只能获取br
     * 当然使用childNodes也涵盖支持我们表头使用表情，代码块等，不管是设置还是取消都会保留第一行
     */

    (0, _forEach["default"])(_context3 = (0, _from["default"])(col.childNodes)).call(_context3, function (item) {
      el.appendChild(item);
    });
    tr.appendChild(el);
  };

  for (var i = 0; i < cols.length; i++) {
    _loop_3(i);
  } //插入集合中


  (0, _splice["default"])(domArray).call(domArray, _index, 1, tr); //移除、新增节点事件

  removeAndInsertAction($dom, domArray);
  return dom_core_1["default"]($dom.parentNode);
}
/**
 * 封装移除、新增节点事件
 * @param $dom tbody节点
 * @param domArray  所有的行
 */


function removeAndInsertAction($dom, domArray) {
  //移除所有的旧的子节点
  while ($dom.children.length !== 0) {
    $dom.removeChild($dom.children[0]);
  } //插入新的子节点


  for (var i = 0; i < domArray.length; i++) {
    $dom.appendChild(domArray[i]);
  }
}
/**
 * 封装判断是否tbody节点
 * 粘贴的table 第一个节点是<colgroup> 最后的节点<tbody>
 * @param dom
 */


function generateDomAction($node) {
  var $dom = $node.elems[0].children[0];

  if ($dom.nodeName === 'COLGROUP') {
    $dom = $node.elems[0].children[$node.elems[0].children.length - 1];
  }

  return $dom;
}

exports["default"] = {
  ProcessingRow: ProcessingRow,
  ProcessingCol: ProcessingCol,
  DeleteRow: DeleteRow,
  DeleteCol: DeleteCol,
  setTheHeader: setTheHeader
};

/***/ }),
/* 395 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(396);

module.exports = parent;


/***/ }),
/* 396 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(50);
__webpack_require__(397);
var path = __webpack_require__(9);

module.exports = path.Array.from;


/***/ }),
/* 397 */
/***/ (function(module, exports, __webpack_require__) {

var $ = __webpack_require__(5);
var from = __webpack_require__(398);
var checkCorrectnessOfIteration = __webpack_require__(115);

var INCORRECT_ITERATION = !checkCorrectnessOfIteration(function (iterable) {
  Array.from(iterable);
});

// `Array.from` method
// https://tc39.github.io/ecma262/#sec-array.from
$({ target: 'Array', stat: true, forced: INCORRECT_ITERATION }, {
  from: from
});


/***/ }),
/* 398 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var bind = __webpack_require__(40);
var toObject = __webpack_require__(31);
var callWithSafeIterationClosing = __webpack_require__(114);
var isArrayIteratorMethod = __webpack_require__(112);
var toLength = __webpack_require__(35);
var createProperty = __webpack_require__(69);
var getIteratorMethod = __webpack_require__(113);

// `Array.from` method implementation
// https://tc39.github.io/ecma262/#sec-array.from
module.exports = function from(arrayLike /* , mapfn = undefined, thisArg = undefined */) {
  var O = toObject(arrayLike);
  var C = typeof this == 'function' ? this : Array;
  var argumentsLength = arguments.length;
  var mapfn = argumentsLength > 1 ? arguments[1] : undefined;
  var mapping = mapfn !== undefined;
  var iteratorMethod = getIteratorMethod(O);
  var index = 0;
  var length, result, step, iterator, next, value;
  if (mapping) mapfn = bind(mapfn, argumentsLength > 2 ? arguments[2] : undefined, 2);
  // if the target is not iterable or it's an array with the default iterator - use a simple case
  if (iteratorMethod != undefined && !(C == Array && isArrayIteratorMethod(iteratorMethod))) {
    iterator = iteratorMethod.call(O);
    next = iterator.next;
    result = new C();
    for (;!(step = next.call(iterator)).done; index++) {
      value = mapping ? callWithSafeIterationClosing(iterator, mapfn, [step.value, index], true) : step.value;
      createProperty(result, index, value);
    }
  } else {
    length = toLength(O.length);
    result = new C(length);
    for (;length > index; index++) {
      value = mapping ? mapfn(O[index], index) : O[index];
      createProperty(result, index, value);
    }
  }
  result.length = index;
  return result;
};


/***/ }),
/* 399 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 获取dom节点
 * @author lichunlin
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

var _from = _interopRequireDefault(__webpack_require__(138));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var getNode =
/** @class */
function () {
  function getNode(editor) {
    this.editor = editor;
  }
  /**
   * 获取焦点所在行
   * @param $node 当前table
   */


  getNode.prototype.getRowNode = function ($node) {
    var _a;

    var DOM = dom_core_1["default"]($node).elems[0];

    if (!DOM.parentNode) {
      return DOM;
    }

    DOM = (_a = dom_core_1["default"](DOM).parentUntil('TR', DOM)) === null || _a === void 0 ? void 0 : _a.elems[0];
    return DOM;
  };
  /**
   * 获取当前行的下标
   * @param $node 当前table
   * @param $dmo 当前行节点
   */


  getNode.prototype.getCurrentRowIndex = function ($node, $dom) {
    var _context;

    var _index = 0;
    var $nodeChild = $node.children[0]; //粘贴的table 最后一个节点才是tbody

    if ($nodeChild.nodeName === 'COLGROUP') {
      $nodeChild = $node.children[$node.children.length - 1];
    }

    (0, _forEach["default"])(_context = (0, _from["default"])($nodeChild.children)).call(_context, function (item, index) {
      item === $dom ? _index = index : '';
    });
    return _index;
  };
  /**
   * 获取当前列的下标
   * @param $node 当前点击元素
   */


  getNode.prototype.getCurrentColIndex = function ($node) {
    var _context2;

    var _a; //当前行


    var _index = 0; //获取当前列 td或th

    var rowDom = dom_core_1["default"]($node).getNodeName() === 'TD' || dom_core_1["default"]($node).getNodeName() === 'TH' ? $node : (_a = dom_core_1["default"]($node).parentUntil('TD', $node)) === null || _a === void 0 ? void 0 : _a.elems[0];
    var colDom = dom_core_1["default"](rowDom).parent();
    (0, _forEach["default"])(_context2 = (0, _from["default"])(colDom.elems[0].children)).call(_context2, function (item, index) {
      item === rowDom ? _index = index : '';
    });
    return _index;
  };
  /**
   * 返回元素html字符串
   * @param $node
   */


  getNode.prototype.getTableHtml = function ($node) {
    var htmlStr = "<table border=\"0\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">" + dom_core_1["default"]($node).html() + "</table>";
    return htmlStr;
  };

  return getNode;
}();

exports["default"] = getNode;

/***/ }),
/* 400 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.bindEventKeyboardEvent = exports.bindClickEvent = void 0;

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));
/**
 * @description 是否是空行
 * @param topElem
 */


function isEmptyLine(topElem) {
  if (!topElem.length) {
    return false;
  }

  var dom = topElem.elems[0];
  return dom.nodeName === 'P' && dom.innerHTML === '<br>';
}

function bindClickEvent(editor) {
  function handleTripleClick($dom, e) {
    // 处理三击事件，此时选区可能离开table，修正回来
    if (e.detail >= 3) {
      var selection = window.getSelection();

      if (selection) {
        var focusNode = selection.focusNode,
            anchorNode = selection.anchorNode;
        var $anchorNode = dom_core_1["default"](anchorNode === null || anchorNode === void 0 ? void 0 : anchorNode.parentElement); // 当focusNode离开了table

        if (!$dom.isContain(dom_core_1["default"](focusNode))) {
          var $td = $anchorNode.elems[0].tagName === 'TD' ? $anchorNode : $anchorNode.parentUntilEditor('td', editor);

          if ($td) {
            var range = editor.selection.getRange();
            range === null || range === void 0 ? void 0 : range.setEnd($td.elems[0], $td.elems[0].childNodes.length);
            editor.selection.restoreSelection();
          }
        }
      }
    }
  }

  editor.txt.eventHooks.tableClickEvents.push(handleTripleClick);
}

exports.bindClickEvent = bindClickEvent;

function bindEventKeyboardEvent(editor) {
  var txt = editor.txt,
      selection = editor.selection;
  var keydownEvents = txt.eventHooks.keydownEvents;
  keydownEvents.push(function (e) {
    // 实时保存选区
    editor.selection.saveRange();
    var $selectionContainerElem = selection.getSelectionContainerElem();

    if ($selectionContainerElem) {
      var $topElem = $selectionContainerElem.getNodeTop(editor);
      var $preElem = $topElem.length ? $topElem.prev().length ? $topElem.prev() : null : null; // 删除时，选区前面是table，且选区没有选中文本，阻止默认行为

      if ($preElem && $preElem.getNodeName() === 'TABLE' && selection.isSelectionEmpty() && selection.getCursorPos() === 0 && e.keyCode === 8) {
        var $nextElem = $topElem.next();
        var hasNext = !!$nextElem.length;
        /**
         * 如果当前是空行，并且当前行下面还有内容，删除当前行
         * 浏览器默认行为不会删除掉当前行的<br>标签
         * 因此阻止默认行为，特殊处理
         */

        if (hasNext && isEmptyLine($topElem)) {
          $topElem.remove();
          editor.selection.setRangeToElem($nextElem.elems[0]);
        }

        e.preventDefault();
      }
    }
  });
}

exports.bindEventKeyboardEvent = bindEventKeyboardEvent;

/***/ }),
/* 401 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 代码 菜单
 * @author lkw
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _map = _interopRequireDefault(__webpack_require__(26));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.formatCodeHtml = void 0;

var tslib_1 = __webpack_require__(2);

var PanelMenu_1 = tslib_1.__importDefault(__webpack_require__(38));

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var util_1 = __webpack_require__(6);

var create_panel_conf_1 = tslib_1.__importDefault(__webpack_require__(402));

var is_active_1 = tslib_1.__importDefault(__webpack_require__(139));

var Panel_1 = tslib_1.__importDefault(__webpack_require__(33));

var index_1 = tslib_1.__importDefault(__webpack_require__(403));

function formatCodeHtml(editor, html) {
  if (!html) return html;
  html = deleteHighlightCode(html);
  html = formatEnterCode(html);
  html = util_1.replaceSpecialSymbol(html);
  return html; // 格式化换换所产生的code标签

  function formatEnterCode(html) {
    var preArr = html.match(/<pre[\s|\S]+?\/pre>/g);
    if (preArr === null) return html;
    (0, _map["default"])(preArr).call(preArr, function (item) {
      //将连续的code标签换为\n换行
      html = html.replace(item, item.replace(/<\/code><code>/g, '\n').replace(/<br>/g, ''));
    });
    return html;
  } // highlight格式化方法


  function deleteHighlightCode(html) {
    var _context;

    // 获取所有hljs文本
    var m = html.match(/<span\sclass="hljs[\s|\S]+?\/span>/gm); // 没有代码渲染文本则退出
    // @ts-ignore

    if (!m || !m.length) return html; // 获取替换文本

    var r = (0, _map["default"])(_context = util_1.deepClone(m)).call(_context, function (i) {
      i = i.replace(/<span\sclass="hljs[^>]+>/, '');
      return i.replace(/<\/span>/, '');
    }); // @ts-ignore

    for (var i = 0; i < m.length; i++) {
      html = html.replace(m[i], r[i]);
    }

    return deleteHighlightCode(html);
  }
}

exports.formatCodeHtml = formatCodeHtml;

var Code =
/** @class */
function (_super) {
  tslib_1.__extends(Code, _super);

  function Code(editor) {
    var _this = this;

    var $elem = dom_core_1["default"]('<div class="w-e-menu" data-title="代码"><i class="w-e-icon-terminal"></i></div>');
    _this = _super.call(this, $elem, editor) || this; // 绑定事件，如点击链接时，可以查看链接

    index_1["default"](editor);
    return _this;
  }
  /**
   * 插入行内代码
   * @param text
   * @return null
   */


  Code.prototype.insertLineCode = function (text) {
    var editor = this.editor; // 行内代码处理

    var $code = dom_core_1["default"]("<code>" + text + "</code>");
    editor.cmd["do"]('insertElem', $code);
    editor.selection.createRangeByElem($code, false);
    editor.selection.restoreSelection();
  };
  /**
   * 菜单点击事件
   */


  Code.prototype.clickHandler = function () {
    var editor = this.editor;
    var selectionText = editor.selection.getSelectionText();

    if (this.isActive) {
      return;
    } else {
      // 菜单未被激活，说明选区不在链接里
      if (editor.selection.isSelectionEmpty()) {
        // 选区是空的，未选中内容
        this.createPanel('', '');
      } else {
        // 行内代码处理 选中了非代码内容
        this.insertLineCode(selectionText);
      }
    }
  };
  /**
   * 创建 panel
   * @param text 代码文本
   * @param languageType 代码类型
   */


  Code.prototype.createPanel = function (text, languageType) {
    var conf = create_panel_conf_1["default"](this.editor, text, languageType);
    var panel = new Panel_1["default"](this, conf);
    panel.create();
  };
  /**
   * 尝试修改菜单 active 状态
   */


  Code.prototype.tryChangeActive = function () {
    var editor = this.editor;

    if (is_active_1["default"](editor)) {
      this.active();
    } else {
      this.unActive();
    }
  };

  return Code;
}(PanelMenu_1["default"]);

exports["default"] = Code;

/***/ }),
/* 402 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description code 菜单 panel tab 配置
 * @author lkw
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _map = _interopRequireDefault(__webpack_require__(26));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var util_1 = __webpack_require__(6);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var is_active_1 = tslib_1.__importDefault(__webpack_require__(139));

var const_1 = __webpack_require__(7);

function default_1(editor, text, languageType) {
  var _context;

  // panel 中需要用到的id
  var inputIFrameId = util_1.getRandom('input-iframe');
  var languageId = util_1.getRandom('select');
  var btnOkId = util_1.getRandom('btn-ok');
  /**
   * 插入代码块
   * @param text 文字
   */

  function insertCode(languateType, code) {
    var _a; // 选区处于链接中，则选中整个菜单，再执行 insertHTML


    var active = is_active_1["default"](editor);

    if (active) {
      selectCodeElem();
    }

    var content = (_a = editor.selection.getSelectionStartElem()) === null || _a === void 0 ? void 0 : _a.elems[0].innerHTML;

    if (content) {
      editor.cmd["do"]('insertHTML', const_1.EMPTY_P);
    } // 过滤标签，防止xss


    var formatCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;'); // 高亮渲染

    if (editor.highlight) {
      formatCode = editor.highlight.highlightAuto(formatCode).value;
    } //增加pre标签


    editor.cmd["do"]('insertHTML', "<pre><code class=\"" + languateType + "\">" + formatCode + "</code></pre>");
    var $code = editor.selection.getSelectionStartElem();
    var $codeElem = $code === null || $code === void 0 ? void 0 : $code.getNodeTop(editor); // 通过dom操作添加换行标签

    if (($codeElem === null || $codeElem === void 0 ? void 0 : $codeElem.getNextSibling().elems.length) === 0) {
      // @ts-ignore
      dom_core_1["default"](const_1.EMPTY_P).insertAfter($codeElem);
    }
  }
  /**
   * 选中整个链接元素
   */


  function selectCodeElem() {
    if (!is_active_1["default"](editor)) return; // eslint-disable-next-line @typescript-eslint/no-unused-vars

    var $selectedCode;
    var $code = editor.selection.getSelectionStartElem();
    var $codeElem = $code === null || $code === void 0 ? void 0 : $code.getNodeTop(editor);
    if (!$codeElem) return;
    editor.selection.createRangeByElem($codeElem);
    editor.selection.restoreSelection();
    $selectedCode = $codeElem; // 赋值给函数内全局变量
  }

  var t = function t(text) {
    return editor.i18next.t(text);
  }; // @ts-ignore


  var conf = {
    width: 500,
    height: 0,
    // panel 中可包含多个 tab
    tabs: [{
      // tab 的标题
      title: t('menus.panelMenus.code.插入代码'),
      // 模板
      tpl: "<div>\n                        <select name=\"\" id=\"" + languageId + "\">\n                            " + (0, _map["default"])(_context = editor.config.languageType).call(_context, function (language) {
        return '<option ' + (languageType == language ? 'selected' : '') + ' value ="' + language + '">' + language + '</option>';
      }) + "\n                        </select>\n                        <textarea id=\"" + inputIFrameId + "\" type=\"text\" class=\"wang-code-textarea\" placeholder=\"\" style=\"height: 160px\">" + text.replace(/&quot;/g, '"') + "</textarea>\n                        <div class=\"w-e-button-container\">\n                            <button type=\"button\" id=\"" + btnOkId + "\" class=\"right\">" + (is_active_1["default"](editor) ? t('修改') : t('插入')) + "</button>\n                        </div>\n                    </div>",
      // 事件绑定
      events: [// 插入链接
      {
        selector: '#' + btnOkId,
        type: 'click',
        fn: function fn() {
          var $code = document.getElementById(inputIFrameId);
          var $select = dom_core_1["default"]('#' + languageId);
          var languageType = $select.val(); // @ts-ignore

          var code = $code.value; // 代码为空，则不插入

          if (!code) return; //增加标签

          if (is_active_1["default"](editor)) {
            return false;
          } else {
            // @ts-ignore
            insertCode(languageType, code);
          } // 返回 true，表示该事件执行完之后，panel 要关闭。否则 panel 不会关闭


          return true;
        }
      }]
    }]
  };
  return conf;
}

exports["default"] = default_1;

/***/ }),
/* 403 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 绑定链接元素的事件，入口
 * @author lkw
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var tooltip_event_1 = tslib_1.__importDefault(__webpack_require__(404));

var jump_code_block_down_1 = tslib_1.__importDefault(__webpack_require__(405));
/**
 * 绑定事件
 * @param editor 编辑器实例
 */


function bindEvent(editor) {
  // tooltip 事件
  tooltip_event_1["default"](editor); // 代码块为最后内容的跳出处理

  jump_code_block_down_1["default"](editor);
}

exports["default"] = bindEvent;

/***/ }),
/* 404 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description tooltip 事件
 * @author lkw
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.createShowHideFn = void 0;

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var Tooltip_1 = tslib_1.__importDefault(__webpack_require__(39));
/**
 * 生成 Tooltip 的显示隐藏函数
 */


function createShowHideFn(editor) {
  var tooltip;
  /**
   * 显示 tooltip
   * @param $code 链接元素
   */

  function showCodeTooltip($code) {
    var i18nPrefix = 'menus.panelMenus.code.';

    var t = function t(text, prefix) {
      if (prefix === void 0) {
        prefix = i18nPrefix;
      }

      return editor.i18next.t(prefix + text);
    };

    var conf = [{
      $elem: dom_core_1["default"]("<span>" + t('删除代码') + "</span>"),
      onClick: function onClick(editor, $code) {
        //dom操作删除
        $code.remove(); // 返回 true，表示执行完之后，隐藏 tooltip。否则不隐藏。

        return true;
      }
    }]; // 创建 tooltip

    tooltip = new Tooltip_1["default"](editor, $code, conf);
    tooltip.create();
  }
  /**
   * 隐藏 tooltip
   */


  function hideCodeTooltip() {
    // 移除 tooltip
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }
  }

  return {
    showCodeTooltip: showCodeTooltip,
    hideCodeTooltip: hideCodeTooltip
  };
}

exports.createShowHideFn = createShowHideFn;
/**
 * preEnterListener是为了统一浏览器 在pre标签内的enter行为而进行的监听
 * 目前并没有使用, 但是在未来处理与Firefox和ie的兼容性时需要用到 暂且放置
 * pre标签内的回车监听
 * @param e
 * @param editor
 */

/* istanbul ignore next */
// eslint-disable-next-line @typescript-eslint/no-unused-vars

function preEnterListener(e, editor) {
  // 获取当前标签元素
  var $selectionElem = editor.selection.getSelectionContainerElem(); // 获取当前节点最顶级标签元素

  var $topElem = $selectionElem === null || $selectionElem === void 0 ? void 0 : $selectionElem.getNodeTop(editor); // 获取顶级节点节点名

  var topNodeName = $topElem === null || $topElem === void 0 ? void 0 : $topElem.getNodeName(); // 非pre标签退出

  if (topNodeName !== 'PRE') return; // 取消默认行为

  e.preventDefault(); // 执行换行

  editor.cmd["do"]('insertHTML', '\n\r');
}
/**
 * 绑定 tooltip 事件
 * @param editor 编辑器实例
 */


function bindTooltipEvent(editor) {
  var _a = createShowHideFn(editor),
      showCodeTooltip = _a.showCodeTooltip,
      hideCodeTooltip = _a.hideCodeTooltip; // 点击代码元素时，显示 tooltip


  editor.txt.eventHooks.codeClickEvents.push(showCodeTooltip); // 点击其他地方，或者滚动时，隐藏 tooltip

  editor.txt.eventHooks.clickEvents.push(hideCodeTooltip);
  editor.txt.eventHooks.toolbarClickEvents.push(hideCodeTooltip);
  editor.txt.eventHooks.menuClickEvents.push(hideCodeTooltip);
  editor.txt.eventHooks.textScrollEvents.push(hideCodeTooltip);
}

exports["default"] = bindTooltipEvent;

/***/ }),
/* 405 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);
/**
 * @description 代码块为最后一块内容时往下跳出代码块
 * @author zhengwenjian
 */


var const_1 = __webpack_require__(7);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));
/**
 * 在代码块最后一行 按方向下键跳出代码块的处理
 * @param editor 编辑器实例
 */


function bindEventJumpCodeBlock(editor) {
  var $textElem = editor.$textElem,
      selection = editor.selection,
      txt = editor.txt;
  var keydownEvents = txt.eventHooks.keydownEvents;
  keydownEvents.push(function (e) {
    var _a; // 40 是键盘中的下方向键


    if (e.keyCode !== 40) return;
    var node = selection.getSelectionContainerElem();
    var $lastNode = (_a = $textElem.children()) === null || _a === void 0 ? void 0 : _a.last();

    if ((node === null || node === void 0 ? void 0 : node.elems[0].tagName) === 'XMP' && ($lastNode === null || $lastNode === void 0 ? void 0 : $lastNode.elems[0].tagName) === 'PRE') {
      // 就是最后一块是代码块的情况插入空p标签并光标移至p
      var $emptyP = dom_core_1["default"](const_1.EMPTY_P);
      $textElem.append($emptyP);
    }
  }); // fix: 修复代码块作为最后一个元素时，用户无法再进行输入的问题

  keydownEvents.push(function (e) {
    // 实时保存选区
    editor.selection.saveRange();
    var $selectionContainerElem = selection.getSelectionContainerElem();

    if ($selectionContainerElem) {
      var $topElem = $selectionContainerElem.getNodeTop(editor); // 获取选区所在节点的上一元素

      var $preElem = $topElem === null || $topElem === void 0 ? void 0 : $topElem.prev(); // 判断该元素后面是否还存在元素
      // 如果存在则允许删除

      var $nextElem = $topElem === null || $topElem === void 0 ? void 0 : $topElem.getNextSibling();

      if ($preElem.length && ($preElem === null || $preElem === void 0 ? void 0 : $preElem.getNodeName()) === 'PRE' && $nextElem.length === 0) {
        // 光标处于选区开头
        if (selection.getCursorPos() === 0) {
          // 按下delete键时末尾追加空行
          if (e.keyCode === 8) {
            var $emptyP = dom_core_1["default"](const_1.EMPTY_P);
            $textElem.append($emptyP);
          }
        }
      }
    }
  });
}

exports["default"] = bindEventJumpCodeBlock;

/***/ }),
/* 406 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);
/**
 * @description 分割线
 * @author wangqiaoling
 */


var BtnMenu_1 = tslib_1.__importDefault(__webpack_require__(23));

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var index_1 = tslib_1.__importDefault(__webpack_require__(407));

var util_1 = __webpack_require__(6);

var const_1 = __webpack_require__(7);

var splitLine =
/** @class */
function (_super) {
  tslib_1.__extends(splitLine, _super);

  function splitLine(editor) {
    var _this = this;

    var $elem = dom_core_1["default"]('<div class="w-e-menu" data-title="分割线"><i class="w-e-icon-split-line"></i></div>');
    _this = _super.call(this, $elem, editor) || this; // 绑定事件

    index_1["default"](editor);
    return _this;
  }
  /**
   * 菜单点击事件
   */


  splitLine.prototype.clickHandler = function () {
    var editor = this.editor;
    var range = editor.selection.getRange();
    var $selectionElem = editor.selection.getSelectionContainerElem();
    if (!($selectionElem === null || $selectionElem === void 0 ? void 0 : $selectionElem.length)) return;
    var $DomElement = dom_core_1["default"]($selectionElem.elems[0]);
    var $tableDOM = $DomElement.parentUntil('TABLE', $selectionElem.elems[0]);
    var $imgDOM = $DomElement.children(); // 禁止在代码块中添加分割线

    if ($DomElement.getNodeName() === 'CODE') return; // 禁止在表格中添加分割线

    if ($tableDOM && dom_core_1["default"]($tableDOM.elems[0]).getNodeName() === 'TABLE') return; // 禁止在图片处添加分割线

    if ($imgDOM && $imgDOM.length !== 0 && dom_core_1["default"]($imgDOM.elems[0]).getNodeName() === 'IMG' && !(range === null || range === void 0 ? void 0 : range.collapsed) // 处理光标在 img 后面的情况
    ) {
        return;
      }

    this.createSplitLine();
  };
  /**
   * 创建 splitLine
   */


  splitLine.prototype.createSplitLine = function () {
    // 防止插入分割线时没有占位元素的尴尬
    var splitLineDOM = "<hr/>" + const_1.EMPTY_P; // 火狐浏览器不需要br标签占位

    if (util_1.UA.isFirefox) {
      splitLineDOM = '<hr/><p></p>';
    }

    this.editor.cmd["do"]('insertHTML', splitLineDOM);
  };
  /**
   * 尝试修改菜单激活状态
   */


  splitLine.prototype.tryChangeActive = function () {};

  return splitLine;
}(BtnMenu_1["default"]);

exports["default"] = splitLine;

/***/ }),
/* 407 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var tooltip_event_1 = tslib_1.__importDefault(__webpack_require__(408));
/**
 * 绑定事件
 * @param editor 编辑器实例
 */


function bindEvent(editor) {
  // 分割线的 tooltip 事件
  tooltip_event_1["default"](editor);
}

exports["default"] = bindEvent;

/***/ }),
/* 408 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);
/**
 * @description tooltip 事件
 * @author wangqiaoling
 */


var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var Tooltip_1 = tslib_1.__importDefault(__webpack_require__(39));
/**
 * 生成 Tooltip 的显示隐藏函数
 */


function createShowHideFn(editor) {
  var tooltip;
  /**
   * 显示分割线的 tooltip
   * @param $splitLine 分割线元素
   */

  function showSplitLineTooltip($splitLine) {
    // 定义 splitLine tooltip 配置
    var conf = [{
      $elem: dom_core_1["default"]("<span>" + editor.i18next.t('menus.panelMenus.删除') + "</span>"),
      onClick: function onClick(editor, $splitLine) {
        // 选中 分割线 元素
        editor.selection.createRangeByElem($splitLine);
        editor.selection.restoreSelection();
        editor.cmd["do"]('delete'); // 返回 true，表示执行完之后，隐藏 tooltip。否则不隐藏。

        return true;
      }
    }]; // 实例化 tooltip

    tooltip = new Tooltip_1["default"](editor, $splitLine, conf); // 创建 tooltip

    tooltip.create();
  }
  /**
   * 隐藏分割线的 tooltip
   */


  function hideSplitLineTooltip() {
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }
  }

  return {
    showSplitLineTooltip: showSplitLineTooltip,
    hideSplitLineTooltip: hideSplitLineTooltip
  };
}

function bindTooltipEvent(editor) {
  var _a = createShowHideFn(editor),
      showSplitLineTooltip = _a.showSplitLineTooltip,
      hideSplitLineTooltip = _a.hideSplitLineTooltip; // 点击分割线时，显示 tooltip


  editor.txt.eventHooks.splitLineEvents.push(showSplitLineTooltip); // 点击其他地方（工具栏、滚动、keyup）时，隐藏 tooltip

  editor.txt.eventHooks.clickEvents.push(hideSplitLineTooltip);
  editor.txt.eventHooks.keyupEvents.push(hideSplitLineTooltip);
  editor.txt.eventHooks.toolbarClickEvents.push(hideSplitLineTooltip);
  editor.txt.eventHooks.menuClickEvents.push(hideSplitLineTooltip);
  editor.txt.eventHooks.textScrollEvents.push(hideSplitLineTooltip);
}

exports["default"] = bindTooltipEvent;

/***/ }),
/* 409 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var BtnMenu_1 = tslib_1.__importDefault(__webpack_require__(23));

var util_1 = __webpack_require__(98);

var bind_event_1 = tslib_1.__importDefault(__webpack_require__(415));

var todo_1 = tslib_1.__importDefault(__webpack_require__(140));

var Todo =
/** @class */
function (_super) {
  tslib_1.__extends(Todo, _super);

  function Todo(editor) {
    var _this = this;

    var $elem = dom_core_1["default"]("<div class=\"w-e-menu\" data-title=\"\u5F85\u529E\u4E8B\u9879\">\n                    <i class=\"w-e-icon-checkbox-checked\"></i>\n                </div>");
    _this = _super.call(this, $elem, editor) || this;
    bind_event_1["default"](editor);
    return _this;
  }
  /**
   * 点击事件
   */


  Todo.prototype.clickHandler = function () {
    var editor = this.editor;

    if (!util_1.isAllTodo(editor)) {
      // 设置todolist
      this.setTodo();
    } else {
      // 取消设置todolist
      this.cancelTodo();
      this.tryChangeActive();
    }
  };

  Todo.prototype.tryChangeActive = function () {
    if (util_1.isAllTodo(this.editor)) {
      this.active();
    } else {
      this.unActive();
    }
  };
  /**
   * 设置todo
   */


  Todo.prototype.setTodo = function () {
    var editor = this.editor;
    var topNodeElem = editor.selection.getSelectionRangeTopNodes();
    (0, _forEach["default"])(topNodeElem).call(topNodeElem, function ($node) {
      var _a;

      var nodeName = $node === null || $node === void 0 ? void 0 : $node.getNodeName();

      if (nodeName === 'P') {
        var todo = todo_1["default"]($node);
        var todoNode = todo.getTodo();
        var child = (_a = todoNode.children()) === null || _a === void 0 ? void 0 : _a.getNode();
        todoNode.insertAfter($node);
        editor.selection.moveCursor(child);
        $node.remove();
      }
    });
    this.tryChangeActive();
  };
  /**
   * 取消设置todo
   */


  Todo.prototype.cancelTodo = function () {
    var editor = this.editor;
    var $topNodeElems = editor.selection.getSelectionRangeTopNodes();
    (0, _forEach["default"])($topNodeElems).call($topNodeElems, function ($topNodeElem) {
      var _a, _b, _c;

      var content = (_b = (_a = $topNodeElem.childNodes()) === null || _a === void 0 ? void 0 : _a.childNodes()) === null || _b === void 0 ? void 0 : _b.clone(true);
      var $p = dom_core_1["default"]("<p></p>");
      $p.append(content);
      $p.insertAfter($topNodeElem); // 移除input

      (_c = $p.childNodes()) === null || _c === void 0 ? void 0 : _c.get(0).remove();
      editor.selection.moveCursor($p.getNode());
      $topNodeElem.remove();
    });
  };

  return Todo;
}(BtnMenu_1["default"]);

exports["default"] = Todo;

/***/ }),
/* 410 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(411);

/***/ }),
/* 411 */
/***/ (function(module, exports, __webpack_require__) {

var parent = __webpack_require__(412);

module.exports = parent;


/***/ }),
/* 412 */
/***/ (function(module, exports, __webpack_require__) {

var every = __webpack_require__(413);

var ArrayPrototype = Array.prototype;

module.exports = function (it) {
  var own = it.every;
  return it === ArrayPrototype || (it instanceof Array && own === ArrayPrototype.every) ? every : own;
};


/***/ }),
/* 413 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(414);
var entryVirtual = __webpack_require__(15);

module.exports = entryVirtual('Array').every;


/***/ }),
/* 414 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var $ = __webpack_require__(5);
var $every = __webpack_require__(32).every;
var arrayMethodIsStrict = __webpack_require__(67);
var arrayMethodUsesToLength = __webpack_require__(22);

var STRICT_METHOD = arrayMethodIsStrict('every');
var USES_TO_LENGTH = arrayMethodUsesToLength('every');

// `Array.prototype.every` method
// https://tc39.github.io/ecma262/#sec-array.prototype.every
$({ target: 'Array', proto: true, forced: !STRICT_METHOD || !USES_TO_LENGTH }, {
  every: function every(callbackfn /* , thisArg */) {
    return $every(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
  }
});


/***/ }),
/* 415 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var util_1 = __webpack_require__(98);

var todo_1 = tslib_1.__importDefault(__webpack_require__(140));

var util_2 = __webpack_require__(98);

var const_1 = __webpack_require__(7);
/**
 * todolist 内部逻辑
 * @param editor
 */


function bindEvent(editor) {
  /**
   * todo的自定义回车事件
   * @param e 事件属性
   */
  function todoEnter(e) {
    var _a, _b; // 判断是否为todo节点


    if (util_1.isAllTodo(editor)) {
      e.preventDefault();
      var selection = editor.selection;
      var $topSelectElem = selection.getSelectionRangeTopNodes()[0];
      var $li = (_a = $topSelectElem.childNodes()) === null || _a === void 0 ? void 0 : _a.get(0);
      var selectionNode = (_b = window.getSelection()) === null || _b === void 0 ? void 0 : _b.anchorNode;
      var range = selection.getRange();

      if (!(range === null || range === void 0 ? void 0 : range.collapsed)) {
        var rangeChildNodes = range === null || range === void 0 ? void 0 : range.commonAncestorContainer.childNodes;
        var startContainer_1 = range === null || range === void 0 ? void 0 : range.startContainer;
        var endContainer_1 = range === null || range === void 0 ? void 0 : range.endContainer;
        var startPos = range === null || range === void 0 ? void 0 : range.startOffset;
        var endPos = range === null || range === void 0 ? void 0 : range.endOffset;
        var startElemIndex_1 = 0;
        var endElemIndex_1 = 0;
        var delList_1 = []; // 找出startContainer和endContainer在rangeChildNodes中的位置

        rangeChildNodes === null || rangeChildNodes === void 0 ? void 0 : (0, _forEach["default"])(rangeChildNodes).call(rangeChildNodes, function (v, i) {
          if (v.contains(startContainer_1)) startElemIndex_1 = i;
          if (v.contains(endContainer_1)) endElemIndex_1 = i;
        }); // 删除两个容器间的内容

        if (endElemIndex_1 - startElemIndex_1 > 1) {
          rangeChildNodes === null || rangeChildNodes === void 0 ? void 0 : (0, _forEach["default"])(rangeChildNodes).call(rangeChildNodes, function (v, i) {
            if (i <= startElemIndex_1) return;
            if (i >= endElemIndex_1) return;
            delList_1.push(v);
          });
          (0, _forEach["default"])(delList_1).call(delList_1, function (v) {
            v.remove();
          });
        } // 删除两个容器里拖蓝的内容


        util_2.dealTextNode(startContainer_1, startPos);
        util_2.dealTextNode(endContainer_1, endPos, false);
        editor.selection.moveCursor(endContainer_1, 0);
      } // 回车时内容为空时，删去此行


      if ($topSelectElem.text() === '') {
        var $p = dom_core_1["default"](const_1.EMPTY_P);
        $p.insertAfter($topSelectElem);
        selection.moveCursor($p.getNode());
        $topSelectElem.remove();
        return;
      }

      var pos = selection.getCursorPos();
      var CursorNextNode = util_1.getCursorNextNode($li === null || $li === void 0 ? void 0 : $li.getNode(), selectionNode, pos);
      var todo = todo_1["default"](dom_core_1["default"](CursorNextNode));
      var $inputcontainer = todo.getInputContainer();
      var todoLiElem = $inputcontainer.parent().getNode();
      var $newTodo = todo.getTodo();
      var contentSection = $inputcontainer.getNode().nextSibling; // 处理光标在最前面时回车input不显示的问题

      if (($li === null || $li === void 0 ? void 0 : $li.text()) === '') {
        $li === null || $li === void 0 ? void 0 : $li.append(dom_core_1["default"]("<br>"));
      }

      $newTodo.insertAfter($topSelectElem); // 处理在google中光标在最后面的，input不显示的问题(必须插入之后移动光标)

      if (!contentSection || (contentSection === null || contentSection === void 0 ? void 0 : contentSection.textContent) === '') {
        // 防止多个br出现的情况
        if ((contentSection === null || contentSection === void 0 ? void 0 : contentSection.nodeName) !== 'BR') {
          var $br = dom_core_1["default"]("<br>");
          $br.insertAfter($inputcontainer);
        }

        selection.moveCursor(todoLiElem, 1);
      } else {
        selection.moveCursor(todoLiElem);
      }
    }
  }
  /**
   * 自定义删除事件，用来处理光标在最前面删除input产生的问题
   */


  function delDown(e) {
    var _a, _b;

    if (util_1.isAllTodo(editor)) {
      var selection = editor.selection;
      var $topSelectElem = selection.getSelectionRangeTopNodes()[0];
      var $li = (_a = $topSelectElem.childNodes()) === null || _a === void 0 ? void 0 : _a.getNode();
      var $p = dom_core_1["default"]("<p></p>");
      var p_1 = $p.getNode();
      var selectionNode = (_b = window.getSelection()) === null || _b === void 0 ? void 0 : _b.anchorNode;
      var pos = selection.getCursorPos();
      var prevNode = selectionNode.previousSibling; // 处理内容为空的情况

      if ($topSelectElem.text() === '') {
        e.preventDefault();
        var $newP = dom_core_1["default"](const_1.EMPTY_P);
        $newP.insertAfter($topSelectElem);
        $topSelectElem.remove();
        selection.moveCursor($newP.getNode(), 0);
        return;
      } // 处理有内容时，光标在最前面的情况


      if ((prevNode === null || prevNode === void 0 ? void 0 : prevNode.nodeName) === 'SPAN' && prevNode.childNodes[0].nodeName === 'INPUT' && pos === 0) {
        var _context;

        e.preventDefault();
        $li === null || $li === void 0 ? void 0 : (0, _forEach["default"])(_context = $li.childNodes).call(_context, function (v, index) {
          if (index === 0) return;
          p_1.appendChild(v.cloneNode(true));
        });
        $p.insertAfter($topSelectElem);
        $topSelectElem.remove();
      }
    }
  }
  /**
   * 自定义删除键up事件
   */


  function deleteUp() {
    var selection = editor.selection;
    var $topSelectElem = selection.getSelectionRangeTopNodes()[0];

    if ($topSelectElem && util_2.isTodo($topSelectElem)) {
      if ($topSelectElem.text() === '') {
        dom_core_1["default"](const_1.EMPTY_P).insertAfter($topSelectElem);
        $topSelectElem.remove();
      }
    }
  }
  /**
   * input 的点击事件（ input 默认不会产生 attribute 的改变 ）
   * @param e 事件属性
   */


  function inputClick(e) {
    if (e && e.target instanceof HTMLInputElement) {
      if (e.target.type === 'checkbox') {
        if (e.target.checked) {
          e.target.setAttribute('checked', 'true');
        } else {
          e.target.removeAttribute('checked');
        }
      }
    }
  }

  editor.txt.eventHooks.enterDownEvents.push(todoEnter);
  editor.txt.eventHooks.deleteUpEvents.push(deleteUp);
  editor.txt.eventHooks.deleteDownEvents.push(delDown);
  editor.txt.eventHooks.clickEvents.push(inputClick);
}

exports["default"] = bindEvent;

/***/ }),
/* 416 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 初始化编辑器 DOM 结构
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.selectorValidator = void 0;

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var util_1 = __webpack_require__(6);

var const_1 = __webpack_require__(7);

var text_1 = tslib_1.__importDefault(__webpack_require__(130));

var styleSettings = {
  border: '1px solid #c9d8db',
  toolbarBgColor: '#FFF',
  toolbarBottomBorder: '1px solid #EEE'
};

function default_1(editor) {
  var toolbarSelector = editor.toolbarSelector;
  var $toolbarSelector = dom_core_1["default"](toolbarSelector);
  var textSelector = editor.textSelector;
  var config = editor.config;
  var height = config.height;
  var i18next = editor.i18next;
  var $toolbarElem = dom_core_1["default"]('<div></div>');
  var $textContainerElem = dom_core_1["default"]('<div></div>');
  var $textElem;
  var $children;
  var $subChildren = null;

  if (textSelector == null) {
    // 将编辑器区域原有的内容，暂存起来
    $children = $toolbarSelector.children(); // 添加到 DOM 结构中

    $toolbarSelector.append($toolbarElem).append($textContainerElem); // 自行创建的，需要配置默认的样式

    $toolbarElem.css('background-color', styleSettings.toolbarBgColor).css('border', styleSettings.border).css('border-bottom', styleSettings.toolbarBottomBorder);
    $textContainerElem.css('border', styleSettings.border).css('border-top', 'none').css('height', height + "px");
  } else {
    // toolbarSelector 和 textSelector 都有
    $toolbarSelector.append($toolbarElem); // 菜单分离后，文本区域内容暂存

    $subChildren = dom_core_1["default"](textSelector).children();
    dom_core_1["default"](textSelector).append($textContainerElem); // 将编辑器区域原有的内容，暂存起来

    $children = $textContainerElem.children();
  } // 编辑区域


  $textElem = dom_core_1["default"]('<div></div>');
  $textElem.attr('contenteditable', 'true').css('width', '100%').css('height', '100%'); // 添加 placeholder

  var $placeholder;
  var placeholder = editor.config.placeholder;

  if (placeholder !== text_1["default"].placeholder) {
    $placeholder = dom_core_1["default"]("<div>" + placeholder + "</div>");
  } else {
    $placeholder = dom_core_1["default"]("<div>" + i18next.t(placeholder) + "</div>");
  }

  $placeholder.addClass('placeholder'); // 初始化编辑区域内容

  if ($children && $children.length) {
    $textElem.append($children); // 编辑器有默认值的时候隐藏placeholder

    $placeholder.hide();
  } else {
    $textElem.append(dom_core_1["default"](const_1.EMPTY_P)); // 新增一行，方便继续编辑
  } // 菜单分离后，文本区域有标签的带入编辑器内


  if ($subChildren && $subChildren.length) {
    $textElem.append($subChildren); // 编辑器有默认值的时候隐藏placeholder

    $placeholder.hide();
  } // 编辑区域加入DOM


  $textContainerElem.append($textElem); // 添加placeholder

  $textContainerElem.append($placeholder); // 设置通用的 class

  $toolbarElem.addClass('w-e-toolbar').css('z-index', editor.zIndex.get('toolbar'));
  $textContainerElem.addClass('w-e-text-container');
  $textContainerElem.css('z-index', editor.zIndex.get());
  $textElem.addClass('w-e-text'); // 添加 ID

  var toolbarElemId = util_1.getRandom('toolbar-elem');
  $toolbarElem.attr('id', toolbarElemId);
  var textElemId = util_1.getRandom('text-elem');
  $textElem.attr('id', textElemId); // 判断编辑区与容器高度是否一致

  var textContainerCliheight = $textContainerElem.getBoundingClientRect().height;
  var textElemClientHeight = $textElem.getBoundingClientRect().height;

  if (textContainerCliheight !== textElemClientHeight) {
    $textElem.css('min-height', textContainerCliheight + 'px');
  } // 记录属性


  editor.$toolbarElem = $toolbarElem;
  editor.$textContainerElem = $textContainerElem;
  editor.$textElem = $textElem;
  editor.toolbarElemId = toolbarElemId;
  editor.textElemId = textElemId;
}

exports["default"] = default_1;
/**
 * 工具栏/文本区域 DOM selector 有效性验证
 * @param editor 编辑器实例
 */

function selectorValidator(editor) {
  var name = 'data-we-id';
  var regexp = /^wangEditor-\d+$/;
  var textSelector = editor.textSelector,
      toolbarSelector = editor.toolbarSelector;
  var $el = {
    bar: dom_core_1["default"]('<div></div>'),
    text: dom_core_1["default"]('<div></div>')
  };

  if (toolbarSelector == null) {
    throw new Error('错误：初始化编辑器时候未传入任何参数，请查阅文档');
  } else {
    $el.bar = dom_core_1["default"](toolbarSelector);

    if (!$el.bar.elems.length) {
      throw new Error("\u65E0\u6548\u7684\u8282\u70B9\u9009\u62E9\u5668\uFF1A" + toolbarSelector);
    }

    if (regexp.test($el.bar.attr(name))) {
      throw new Error('初始化节点已存在编辑器实例，无法重复创建编辑器');
    }
  }

  if (textSelector) {
    $el.text = dom_core_1["default"](textSelector);

    if (!$el.text.elems.length) {
      throw new Error("\u65E0\u6548\u7684\u8282\u70B9\u9009\u62E9\u5668\uFF1A" + textSelector);
    }

    if (regexp.test($el.text.attr(name))) {
      throw new Error('初始化节点已存在编辑器实例，无法重复创建编辑器');
    }
  } // 给节点做上标记


  $el.bar.attr(name, editor.id);
  $el.text.attr(name, editor.id); // 在编辑器销毁前取消标记

  editor.beforeDestroy(function () {
    $el.bar.removeAttr(name);
    $el.text.removeAttr(name);
  });
}

exports.selectorValidator = selectorValidator;

/***/ }),
/* 417 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 初始化编辑器选区，将光标定位到文档末尾
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var const_1 = __webpack_require__(7);
/**
 * 初始化编辑器选区，将光标定位到文档末尾
 * @param editor 编辑器实例
 * @param newLine 是否新增一行
 */


function initSelection(editor, newLine) {
  var $textElem = editor.$textElem;
  var $children = $textElem.children();

  if (!$children || !$children.length) {
    // 如果编辑器区域无内容，添加一个空行，重新设置选区
    $textElem.append(dom_core_1["default"](const_1.EMPTY_P));
    initSelection(editor);
    return;
  }

  var $last = $children.last();

  if (newLine) {
    // 新增一个空行
    var html = $last.html().toLowerCase();
    var nodeName = $last.getNodeName();

    if (html !== '<br>' && html !== '<br/>' || nodeName !== 'P') {
      // 最后一个元素不是 空标签，添加一个空行，重新设置选区
      $textElem.append(dom_core_1["default"](const_1.EMPTY_P));
      initSelection(editor);
      return;
    }
  }

  editor.selection.createRangeByElem($last, false, true);

  if (editor.config.focus) {
    editor.selection.restoreSelection();
  } else {
    // 防止focus=false受其他因素影响
    editor.selection.clearWindowSelectionRange();
  }
}

exports["default"] = initSelection;

/***/ }),
/* 418 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 绑定编辑器事件 change blur focus
 * @author wangfupeng
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

function bindEvent(editor) {
  // 绑定 change 事件
  _bindChange(editor); // 绑定 focus blur 事件


  _bindFocusAndBlur(editor); // 绑定 input 输入


  _bindInput(editor);
}
/**
 * 绑定 change 事件
 * @param editor 编辑器实例
 */


function _bindChange(editor) {
  editor.txt.eventHooks.changeEvents.push(function () {
    var onchange = editor.config.onchange;

    if (onchange) {
      var html = editor.txt.html() || ''; // onchange触发时，是focus状态，详见https://github.com/wangeditor-team/wangEditor/issues/3034

      editor.isFocus = true;
      onchange(html);
    }

    editor.txt.togglePlaceholder();
  });
}
/**
 * 绑定 focus blur 事件
 * @param editor 编辑器实例
 */


function _bindFocusAndBlur(editor) {
  // 当前编辑器是否是焦点状态
  editor.isFocus = false;

  function listener(e) {
    var target = e.target;
    var $target = dom_core_1["default"](target);
    var $textElem = editor.$textElem;
    var $toolbarElem = editor.$toolbarElem; //判断当前点击元素是否在编辑器内

    var isChild = $textElem.isContain($target); //判断当前点击元素是否为工具栏

    var isToolbar = $toolbarElem.isContain($target);
    var isMenu = $toolbarElem.elems[0] == e.target ? true : false;

    if (!isChild) {
      // 若为选择工具栏中的功能，则不视为成 blur 操作
      if (isToolbar && !isMenu || !editor.isFocus) {
        return;
      }

      _blurHandler(editor);

      editor.isFocus = false;
    } else {
      if (!editor.isFocus) {
        _focusHandler(editor);
      }

      editor.isFocus = true;
    }
  } // fix: 增加判断条件，防止当用户设置isFocus=false时，初始化完成后点击其他元素依旧会触发blur事件的问题


  if (document.activeElement === editor.$textElem.elems[0] && editor.config.focus) {
    _focusHandler(editor);

    editor.isFocus = true;
  } // 绑定监听事件


  dom_core_1["default"](document).on('click', listener); // 全局事件在编辑器实例销毁的时候进行解绑

  editor.beforeDestroy(function () {
    dom_core_1["default"](document).off('click', listener);
  });
}
/**
 * 绑定 input 事件
 * @param editor 编辑器实例
 */


function _bindInput(editor) {
  // 绑定中文输入
  editor.$textElem.on('compositionstart', function () {
    editor.isComposing = true;
    editor.txt.togglePlaceholder();
  }).on('compositionend', function () {
    editor.isComposing = false;
    editor.txt.togglePlaceholder();
  });
}
/**
 * blur 事件
 * @param editor 编辑器实例
 */


function _blurHandler(editor) {
  var _context;

  var config = editor.config;
  var onblur = config.onblur;
  var currentHtml = editor.txt.html() || '';
  (0, _forEach["default"])(_context = editor.txt.eventHooks.onBlurEvents).call(_context, function (fn) {
    return fn();
  });
  onblur(currentHtml);
}
/**
 * focus 事件
 * @param editor 编辑器实例
 */


function _focusHandler(editor) {
  var config = editor.config;
  var onfocus = config.onfocus;
  var currentHtml = editor.txt.html() || '';
  onfocus(currentHtml);
}

exports["default"] = bindEvent;

/***/ }),
/* 419 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 国际化 初始化
 * @author tonghan
 * i18next 是使用 JavaScript 编写的国际化框架
 * i18next 提供了标准的i18n功能，例如（复数，上下文，插值，格式）等
 * i18next 文档地址： https://www.i18next.com/overview/getting-started
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

function i18nextInit(editor) {
  var _a = editor.config,
      lang = _a.lang,
      languages = _a.languages;

  if (editor.i18next != null) {
    try {
      editor.i18next.init({
        ns: 'wangEditor',
        lng: lang,
        defaultNS: 'wangEditor',
        resources: languages
      });
    } catch (error) {
      throw new Error('i18next:' + error);
    }

    return;
  } // 没有引入 i18next 的替代品


  editor.i18next = {
    t: function t(str) {
      var strArr = str.split('.');
      return strArr[strArr.length - 1];
    }
  };
}

exports["default"] = i18nextInit;

/***/ }),
/* 420 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 全屏功能
 * @author xiaokyo
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _find = _interopRequireDefault(__webpack_require__(29));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.setUnFullScreen = exports.setFullScreen = void 0;

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

__webpack_require__(421);

var iconFullScreenText = 'w-e-icon-fullscreen'; // 全屏icon class

var iconExitFullScreenText = 'w-e-icon-fullscreen_exit'; // 退出全屏icon class

var classfullScreenEditor = 'w-e-full-screen-editor'; // 全屏添加至编辑器的class

/**
 * 设置全屏
 * @param editor 编辑器实例
 */

exports.setFullScreen = function (editor) {
  var $editorParent = dom_core_1["default"](editor.toolbarSelector);
  var $textContainerElem = editor.$textContainerElem;
  var $toolbarElem = editor.$toolbarElem;
  var $iconElem = (0, _find["default"])($toolbarElem).call($toolbarElem, "i." + iconFullScreenText);
  var config = editor.config;
  $iconElem.removeClass(iconFullScreenText);
  $iconElem.addClass(iconExitFullScreenText);
  $editorParent.addClass(classfullScreenEditor);
  $editorParent.css('z-index', config.zIndexFullScreen);
  var bar = $toolbarElem.getBoundingClientRect();
  $textContainerElem.css('height', "calc(100% - " + bar.height + "px)");
};
/**
 * 取消全屏
 * @param editor 编辑器实例
 */


exports.setUnFullScreen = function (editor) {
  var $editorParent = dom_core_1["default"](editor.toolbarSelector);
  var $textContainerElem = editor.$textContainerElem;
  var $toolbarElem = editor.$toolbarElem;
  var $iconElem = (0, _find["default"])($toolbarElem).call($toolbarElem, "i." + iconExitFullScreenText);
  var config = editor.config;
  $iconElem.removeClass(iconExitFullScreenText);
  $iconElem.addClass(iconFullScreenText);
  $editorParent.removeClass(classfullScreenEditor);
  $editorParent.css('z-index', 'auto');
  $textContainerElem.css('height', config.height + 'px');
};
/**
 * 初始化全屏功能
 * @param editor 编辑器实例
 */


var initFullScreen = function initFullScreen(editor) {
  // 当textSelector有值的时候，也就是编辑器是工具栏和编辑区域分离的情况， 则不生成全屏功能按钮
  if (editor.textSelector) return;
  if (!editor.config.showFullScreen) return;
  var $toolbarElem = editor.$toolbarElem;
  var $elem = dom_core_1["default"]("<div class=\"w-e-menu\" data-title=\"\u5168\u5C4F\">\n            <i class=\"" + iconFullScreenText + "\"></i>\n        </div>");
  $elem.on('click', function (e) {
    var _context;

    var $elemIcon = (0, _find["default"])(_context = dom_core_1["default"](e.currentTarget)).call(_context, 'i');

    if ($elemIcon.hasClass(iconFullScreenText)) {
      $elem.attr('data-title', '取消全屏');
      exports.setFullScreen(editor);
    } else {
      $elem.attr('data-title', '全屏');
      exports.setUnFullScreen(editor);
    }
  });
  $toolbarElem.append($elem);
};

exports["default"] = initFullScreen;

/***/ }),
/* 421 */
/***/ (function(module, exports, __webpack_require__) {

var api = __webpack_require__(20);
            var content = __webpack_require__(422);

            content = content.__esModule ? content.default : content;

            if (typeof content === 'string') {
              content = [[module.i, content, '']];
            }

var options = {};

options.insert = "head";
options.singleton = false;

var update = api(content, options);



module.exports = content.locals || {};

/***/ }),
/* 422 */
/***/ (function(module, exports, __webpack_require__) {

// Imports
var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(21);
exports = ___CSS_LOADER_API_IMPORT___(false);
// Module
exports.push([module.i, ".w-e-full-screen-editor {\n  position: fixed;\n  width: 100%!important;\n  height: 100%!important;\n  left: 0;\n  top: 0;\n}\n", ""]);
// Exports
module.exports = exports;


/***/ }),
/* 423 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 滚动到指定锚点
 * @author zhengwenjian
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _find = _interopRequireDefault(__webpack_require__(29));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
/**
 * 编辑器滚动到指定锚点
 * @param editor 编辑器实例
 * @param id 标题锚点id
 */

var scrollToHead = function scrollToHead(editor, id) {
  var _context;

  var $textElem = editor.isEnable ? editor.$textElem : (0, _find["default"])(_context = editor.$textContainerElem).call(_context, '.w-e-content-mantle');
  var $targetHead = (0, _find["default"])($textElem).call($textElem, "[id='" + id + "']");
  var targetTop = $targetHead.getOffsetData().top;
  $textElem.scrollTop(targetTop);
};

exports["default"] = scrollToHead;

/***/ }),
/* 424 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var style_1 = tslib_1.__importDefault(__webpack_require__(129));

var tier = {
  menu: 2,
  panel: 2,
  toolbar: 1,
  tooltip: 1,
  textContainer: 1
};

var ZIndex =
/** @class */
function () {
  function ZIndex() {
    // 层级参数
    this.tier = tier; // 默认值

    this.baseZIndex = style_1["default"].zIndex;
  } // 获取 tierName 对应的 z-index 的值。如果 tierName 未定义则返回默认的 z-index 值


  ZIndex.prototype.get = function (tierName) {
    if (tierName && this.tier[tierName]) {
      return this.baseZIndex + this.tier[tierName];
    }

    return this.baseZIndex;
  }; // 初始化


  ZIndex.prototype.init = function (editor) {
    if (this.baseZIndex == style_1["default"].zIndex) {
      this.baseZIndex = editor.config.zIndex;
    }
  };

  return ZIndex;
}();

exports["default"] = ZIndex;

/***/ }),
/* 425 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 编辑器 change 事件
 * @author fangzhicong
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _filter = _interopRequireDefault(__webpack_require__(70));

var _forEach = _interopRequireDefault(__webpack_require__(4));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var mutation_1 = tslib_1.__importDefault(__webpack_require__(426));

var util_1 = __webpack_require__(6);

var const_1 = __webpack_require__(7);
/**
 * 剔除编辑区容器的 attribute 变化中的非 contenteditable 变化
 * @param mutations MutationRecord[]
 * @param tar 编辑区容器的 DOM 节点
 */


function mutationsFilter(mutations, tar) {
  // 剔除编辑区容器的 attribute 变化中的非 contenteditable 变化
  return (0, _filter["default"])(mutations).call(mutations, function (_a) {
    var type = _a.type,
        target = _a.target,
        attributeName = _a.attributeName;
    return type != 'attributes' || type == 'attributes' && (attributeName == 'contenteditable' || target != tar);
  });
}
/**
 * Change 实现
 */


var Change =
/** @class */
function (_super) {
  tslib_1.__extends(Change, _super);

  function Change(editor) {
    var _this = _super.call(this, function (mutations, observer) {
      var _a; // 数据过滤


      mutations = mutationsFilter(mutations, observer.target); // 存储数据

      (_a = _this.data).push.apply(_a, mutations); // 标准模式下


      if (!editor.isCompatibleMode) {
        // 在非中文输入状态下时才保存数据
        if (!editor.isComposing) {
          return _this.asyncSave();
        }
      } // 兼容模式下
      else {
          _this.asyncSave();
        }
    }) || this;

    _this.editor = editor;
    /**
     * 变化的数据集合
     */

    _this.data = [];
    /**
     * 异步保存数据
     */

    _this.asyncSave = const_1.EMPTY_FN;
    return _this;
  }
  /**
   * 保存变化的数据并发布 change event
   */


  Change.prototype.save = function () {
    // 有数据
    if (this.data.length) {
      // 保存变化数据
      this.editor.history.save(this.data); // 清除缓存

      this.data.length = 0;
      this.emit();
    }
  };
  /**
   * 发布 change event
   */


  Change.prototype.emit = function () {
    var _context;

    // 执行 onchange 回调
    (0, _forEach["default"])(_context = this.editor.txt.eventHooks.changeEvents).call(_context, function (fn) {
      return fn();
    });
  }; // 重写 observe


  Change.prototype.observe = function () {
    var _this = this;

    _super.prototype.observe.call(this, this.editor.$textElem.elems[0]);

    var timeout = this.editor.config.onchangeTimeout;
    this.asyncSave = util_1.debounce(function () {
      _this.save();
    }, timeout);

    if (!this.editor.isCompatibleMode) {
      this.editor.$textElem.on('compositionend', function () {
        _this.asyncSave();
      });
    }
  };

  return Change;
}(mutation_1["default"]);

exports["default"] = Change;

/***/ }),
/* 426 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 封装 MutationObserver
 * @author fangzhicong
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
/**
 * 封装 MutationObserver，抽离成公共类
 */

var Mutation =
/** @class */
function () {
  /**
   * 构造器
   * @param fn 发生变化时执行的回调函数
   * @param options 自定义配置项
   */
  function Mutation(fn, options) {
    var _this = this;
    /**
     * 默认的 MutationObserverInit 配置
     */


    this.options = {
      subtree: true,
      childList: true,
      attributes: true,
      attributeOldValue: true,
      characterData: true,
      characterDataOldValue: true
    };

    this.callback = function (mutations) {
      fn(mutations, _this);
    };

    this.observer = new MutationObserver(this.callback);
    options && (this.options = options);
  }

  (0, _defineProperty["default"])(Mutation.prototype, "target", {
    get: function get() {
      return this.node;
    },
    enumerable: false,
    configurable: true
  });
  /**
   * 绑定监听节点（初次绑定有效）
   * @param node 需要被监听的节点
   */

  Mutation.prototype.observe = function (node) {
    if (!(this.node instanceof Node)) {
      this.node = node;
      this.connect();
    }
  };
  /**
   * 连接监听器（开始观察）
   */


  Mutation.prototype.connect = function () {
    if (this.node) {
      this.observer.observe(this.node, this.options);
      return this;
    }

    throw new Error('还未初始化绑定，请您先绑定有效的 Node 节点');
  };
  /**
   * 断开监听器（停止观察）
   */


  Mutation.prototype.disconnect = function () {
    var list = this.observer.takeRecords();
    list.length && this.callback(list);
    this.observer.disconnect();
  };

  return Mutation;
}();

exports["default"] = Mutation;

/***/ }),
/* 427 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 历史记录
 * @author fangzhicong
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var content_1 = tslib_1.__importDefault(__webpack_require__(428));

var scroll_1 = tslib_1.__importDefault(__webpack_require__(435));

var range_1 = tslib_1.__importDefault(__webpack_require__(436));
/**
 * 历史记录（撤销、恢复）
 */


var History =
/** @class */
function () {
  function History(editor) {
    this.editor = editor;
    this.content = new content_1["default"](editor);
    this.scroll = new scroll_1["default"](editor);
    this.range = new range_1["default"](editor);
  }

  (0, _defineProperty["default"])(History.prototype, "size", {
    /**
     *  获取缓存中的数据长度。格式为：[正常的数据的条数，被撤销的数据的条数]
     */
    get: function get() {
      return this.scroll.size;
    },
    enumerable: false,
    configurable: true
  });
  /**
   * 初始化绑定。在 editor.create() 结尾时调用
   */

  History.prototype.observe = function () {
    this.content.observe();
    this.scroll.observe(); // 标准模式下才进行初始化绑定

    !this.editor.isCompatibleMode && this.range.observe();
  };
  /**
   * 保存数据
   */


  History.prototype.save = function (mutations) {
    if (mutations.length) {
      this.content.save(mutations);
      this.scroll.save(); // 标准模式下才进行缓存

      !this.editor.isCompatibleMode && this.range.save();
    }
  };
  /**
   * 撤销
   */


  History.prototype.revoke = function () {
    this.editor.change.disconnect();
    var res = this.content.revoke();

    if (res) {
      this.scroll.revoke(); // 标准模式下才执行

      if (!this.editor.isCompatibleMode) {
        this.range.revoke();
        this.editor.$textElem.focus();
      }
    }

    this.editor.change.connect(); // 如果用户在 onchange 中修改了内容（DOM），那么缓存中的节点数据可能不连贯了，不连贯的数据必将导致恢复失败，所以必须将用户的 onchange 处于监控状态中

    res && this.editor.change.emit();
  };
  /**
   * 恢复
   */


  History.prototype.restore = function () {
    this.editor.change.disconnect();
    var res = this.content.restore();

    if (res) {
      this.scroll.restore(); // 标准模式下才执行

      if (!this.editor.isCompatibleMode) {
        this.range.restore();
        this.editor.$textElem.focus();
      }
    }

    this.editor.change.connect(); // 与 revoke 同理

    res && this.editor.change.emit();
  };

  return History;
}();

exports["default"] = History;

/***/ }),
/* 428 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 整合差异备份和内容备份，进行统一管理
 * @author fangzhicong
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var node_1 = tslib_1.__importDefault(__webpack_require__(429));

var html_1 = tslib_1.__importDefault(__webpack_require__(433));

var ContentCache =
/** @class */
function () {
  function ContentCache(editor) {
    this.editor = editor;
  }
  /**
   * 初始化绑定
   */


  ContentCache.prototype.observe = function () {
    if (this.editor.isCompatibleMode) {
      // 兼容模式（内容备份）
      this.cache = new html_1["default"](this.editor);
    } else {
      // 标准模式（差异备份/节点备份）
      this.cache = new node_1["default"](this.editor);
    }

    this.cache.observe();
  };
  /**
   * 保存
   */


  ContentCache.prototype.save = function (mutations) {
    if (this.editor.isCompatibleMode) {
      ;
      this.cache.save();
    } else {
      ;
      this.cache.compile(mutations);
    }
  };
  /**
   * 撤销
   */


  ContentCache.prototype.revoke = function () {
    var _a;

    return (_a = this.cache) === null || _a === void 0 ? void 0 : _a.revoke();
  };
  /**
   * 恢复
   */


  ContentCache.prototype.restore = function () {
    var _a;

    return (_a = this.cache) === null || _a === void 0 ? void 0 : _a.restore();
  };

  return ContentCache;
}();

exports["default"] = ContentCache;

/***/ }),
/* 429 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 差异备份
 * @author fangzhicong
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var cache_1 = tslib_1.__importDefault(__webpack_require__(99));

var compile_1 = tslib_1.__importDefault(__webpack_require__(431));

var decompilation_1 = __webpack_require__(432);

var NodeCache =
/** @class */
function (_super) {
  tslib_1.__extends(NodeCache, _super);

  function NodeCache(editor) {
    var _this = _super.call(this, editor.config.historyMaxSize) || this;

    _this.editor = editor;
    return _this;
  }

  NodeCache.prototype.observe = function () {
    this.resetMaxSize(this.editor.config.historyMaxSize);
  };
  /**
   * 编译并保存数据
   */


  NodeCache.prototype.compile = function (data) {
    this.save(compile_1["default"](data));
    return this;
  };
  /**
   * 撤销
   */


  NodeCache.prototype.revoke = function () {
    return _super.prototype.revoke.call(this, function (data) {
      decompilation_1.revoke(data);
    });
  };
  /**
   * 恢复
   */


  NodeCache.prototype.restore = function () {
    return _super.prototype.restore.call(this, function (data) {
      decompilation_1.restore(data);
    });
  };

  return NodeCache;
}(cache_1["default"]);

exports["default"] = NodeCache;

/***/ }),
/* 430 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 数据结构 - 栈
 * @author fangzhicong
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.CeilStack = void 0;
/**
 * 栈（限制最大数据条数，栈满后可以继续入栈，而先入栈的数据将失效）
 */
// 取名灵感来自 Math.ceil，向上取有效值

var CeilStack =
/** @class */
function () {
  function CeilStack(max) {
    if (max === void 0) {
      max = 0;
    }
    /**
     * 数据缓存
     */


    this.data = [];
    /**
     * 栈的最大长度。为零则长度不限
     */

    this.max = 0;
    /**
     * 标识是否重设过 max 值
     */

    this.reset = false;
    max = Math.abs(max);
    max && (this.max = max);
  }
  /**
   * 允许用户重设一次 max 值
   */


  CeilStack.prototype.resetMax = function (maxSize) {
    maxSize = Math.abs(maxSize);

    if (!this.reset && !isNaN(maxSize)) {
      this.max = maxSize;
      this.reset = true;
    }
  };

  (0, _defineProperty["default"])(CeilStack.prototype, "size", {
    /**
     * 当前栈中的数据条数
     */
    get: function get() {
      return this.data.length;
    },
    enumerable: false,
    configurable: true
  });
  /**
   * 入栈
   * @param data 入栈的数据
   */

  CeilStack.prototype.instack = function (data) {
    this.data.unshift(data);

    if (this.max && this.size > this.max) {
      this.data.length = this.max;
    }

    return this;
  };
  /**
   * 出栈
   */


  CeilStack.prototype.outstack = function () {
    return this.data.shift();
  };
  /**
   * 清空栈
   */


  CeilStack.prototype.clear = function () {
    this.data.length = 0;
    return this;
  };

  return CeilStack;
}();

exports.CeilStack = CeilStack;

/***/ }),
/* 431 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 数据整理
 * @author fangzhicong
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

var _indexOf = _interopRequireDefault(__webpack_require__(27));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.compliePosition = exports.complieNodes = exports.compileValue = exports.compileType = void 0;

var util_1 = __webpack_require__(6);
/**
 * 数据类型
 */


function compileType(data) {
  switch (data) {
    case 'childList':
      return 'node';

    case 'attributes':
      return 'attr';

    default:
      return 'text';
  }
}

exports.compileType = compileType;
/**
 * 获取当前的文本内容
 */

function compileValue(data) {
  switch (data.type) {
    case 'attributes':
      return data.target.getAttribute(data.attributeName) || '';

    case 'characterData':
      return data.target.textContent;

    default:
      return '';
  }
}

exports.compileValue = compileValue;
/**
 * addedNodes/removedNodes
 */

function complieNodes(data) {
  var temp = {};

  if (data.addedNodes.length) {
    temp.add = util_1.toArray(data.addedNodes);
  }

  if (data.removedNodes.length) {
    temp.remove = util_1.toArray(data.removedNodes);
  }

  return temp;
}

exports.complieNodes = complieNodes;
/**
 * addedNodes/removedNodes 的相对位置
 */

function compliePosition(data) {
  var temp;

  if (data.previousSibling) {
    temp = {
      type: 'before',
      target: data.previousSibling
    };
  } else if (data.nextSibling) {
    temp = {
      type: 'after',
      target: data.nextSibling
    };
  } else {
    temp = {
      type: 'parent',
      target: data.target
    };
  }

  return temp;
}

exports.compliePosition = compliePosition;
/**
 * 补全 Firefox 数据的特殊标签
 */

var tag = ['UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
/**
 * 将 MutationRecord 转换成自定义格式的数据
 */

function compile(data) {
  var temp = []; // 以下两个变量是兼容 Firefox 时使用到的
  // 前一次操作为删除元素节点

  var removeNode = false; // 连续的节点删除记录

  var removeCache = [];
  (0, _forEach["default"])(data).call(data, function (record, index) {
    var item = {
      type: compileType(record.type),
      target: record.target,
      attr: record.attributeName || '',
      value: compileValue(record) || '',
      oldValue: record.oldValue || '',
      nodes: complieNodes(record),
      position: compliePosition(record)
    };
    temp.push(item); // 兼容 Firefox，补全数据（这几十行代码写得吐血，跟 IE 有得一拼）

    if (!util_1.UA.isFirefox) {
      return;
    } // 正常的数据：缩进、行高、超链接、对齐方式、引用、插入表情、插入图片、分割线、表格、插入代码
    // 普通的数据补全：标题（纯文本内容）、加粗、斜体、删除线、下划线、颜色、背景色、字体、字号、列表（纯文本内容）
    // 特殊的数据补全：标题（包含 HTMLElement）、列表（包含 HTMLElement 或 ul -> ol 或 ol -> ul 或 Enter）


    if (removeNode && record.addedNodes.length && record.addedNodes[0].nodeType == 1) {
      // 需要被全数据的目标节点
      var replenishNode = record.addedNodes[0];
      var replenishData = {
        type: 'node',
        target: replenishNode,
        attr: '',
        value: '',
        oldValue: '',
        nodes: {
          add: [removeNode]
        },
        position: {
          type: 'parent',
          target: replenishNode
        }
      }; // 特殊的标签：['UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']

      if ((0, _indexOf["default"])(tag).call(tag, replenishNode.nodeName) != -1) {
        replenishData.nodes.add = util_1.toArray(replenishNode.childNodes);
        temp.push(replenishData);
      } // 上一个删除元素是文本节点
      else if (removeNode.nodeType == 3) {
          if (contains(replenishNode, removeCache)) {
            replenishData.nodes.add = util_1.toArray(replenishNode.childNodes);
          }

          temp.push(replenishData);
        } // 上一个删除元素是 Element && 由近到远的删除元素至少有一个是需要补全数据节点的子节点
        else if ((0, _indexOf["default"])(tag).call(tag, record.target.nodeName) == -1 && contains(replenishNode, removeCache)) {
            replenishData.nodes.add = util_1.toArray(replenishNode.childNodes);
            temp.push(replenishData);
          }
    } // 记录本次的节点信息


    if (item.type == 'node' && record.removedNodes.length == 1) {
      removeNode = record.removedNodes[0];
      removeCache.push(removeNode);
    } else {
      removeNode = false;
      removeCache.length = 0;
    }
  });
  return temp;
}

exports["default"] = compile; // 删除元素的历史记录中包含有多少个目标节点的子元素

function contains(tar, childs) {
  var count = 0;

  for (var i = childs.length - 1; i > 0; i--) {
    if (tar.contains(childs[i])) {
      count++;
    } else {
      break;
    }
  }

  return count;
}

/***/ }),
/* 432 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _forEach = _interopRequireDefault(__webpack_require__(4));

var _entries = _interopRequireDefault(__webpack_require__(94));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.restore = exports.revoke = void 0;
/**
 * 将节点添加到 DOM 树中
 * @param data 数据项
 * @param list 节点集合（addedNodes 或 removedNodes）
 */

function insertNode(data, list) {
  var reference = data.position.target;

  switch (data.position.type) {
    // reference 在这些节点的前面
    case 'before':
      if (reference.nextSibling) {
        reference = reference.nextSibling;
        (0, _forEach["default"])(list).call(list, function (item) {
          data.target.insertBefore(item, reference);
        });
      } else {
        (0, _forEach["default"])(list).call(list, function (item) {
          data.target.appendChild(item);
        });
      }

      break;
    // reference 在这些节点的后面

    case 'after':
      (0, _forEach["default"])(list).call(list, function (item) {
        data.target.insertBefore(item, reference);
      });
      break;
    // parent
    // reference 是这些节点的父节点

    default:
      (0, _forEach["default"])(list).call(list, function (item) {
        reference.appendChild(item);
      });
      break;
  }
}
/* ------------------------------------------------------------------ 撤销逻辑 ------------------------------------------------------------------ */


function revokeNode(data) {
  for (var _i = 0, _a = (0, _entries["default"])(data.nodes); _i < _a.length; _i++) {
    var _b = _a[_i],
        relative = _b[0],
        list = _b[1];

    switch (relative) {
      // 反向操作，将这些节点从 DOM 中移除
      case 'add':
        (0, _forEach["default"])(list).call(list, function (item) {
          data.target.removeChild(item);
        });
        break;
      // remove（反向操作，将这些节点添加到 DOM 中）

      default:
        {
          insertNode(data, list);
          break;
        }
    }
  }
}
/**
 * 撤销 attribute
 */


function revokeAttr(data) {
  var target = data.target;

  if (data.oldValue == null) {
    target.removeAttribute(data.attr);
  } else {
    target.setAttribute(data.attr, data.oldValue);
  }
}
/**
 * 撤销文本内容
 */


function revokeText(data) {
  data.target.textContent = data.oldValue;
}

var revokeFns = {
  node: revokeNode,
  text: revokeText,
  attr: revokeAttr
}; // 撤销 - 对外暴露的接口

function revoke(data) {
  for (var i = data.length - 1; i > -1; i--) {
    var item = data[i];
    revokeFns[item.type](item);
  }
}

exports.revoke = revoke;
/* ------------------------------------------------------------------ 恢复逻辑 ------------------------------------------------------------------ */

function restoreNode(data) {
  for (var _i = 0, _a = (0, _entries["default"])(data.nodes); _i < _a.length; _i++) {
    var _b = _a[_i],
        relative = _b[0],
        list = _b[1];

    switch (relative) {
      case 'add':
        {
          insertNode(data, list);
          break;
        }
      // remove

      default:
        {
          (0, _forEach["default"])(list).call(list, function (item) {
            ;
            item.parentNode.removeChild(item);
          });
          break;
        }
    }
  }
}

function restoreText(data) {
  data.target.textContent = data.value;
}

function restoreAttr(data) {
  ;
  data.target.setAttribute(data.attr, data.value);
}

var restoreFns = {
  node: restoreNode,
  text: restoreText,
  attr: restoreAttr
}; // 恢复 - 对外暴露的接口

function restore(data) {
  for (var _i = 0, data_1 = data; _i < data_1.length; _i++) {
    var item = data_1[_i];
    restoreFns[item.type](item);
  }
}

exports.restore = restore;

/***/ }),
/* 433 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var chain_1 = __webpack_require__(434);

var HtmlCache =
/** @class */
function () {
  function HtmlCache(editor) {
    this.editor = editor;
    this.data = new chain_1.TailChain();
  }
  /**
   * 初始化绑定
   */


  HtmlCache.prototype.observe = function () {
    this.data.resetMax(this.editor.config.historyMaxSize); // 保存初始化值

    this.data.insertLast(this.editor.$textElem.html());
  };
  /**
   * 保存
   */


  HtmlCache.prototype.save = function () {
    this.data.insertLast(this.editor.$textElem.html());
    return this;
  };
  /**
   * 撤销
   */


  HtmlCache.prototype.revoke = function () {
    var data = this.data.prev();

    if (data) {
      this.editor.$textElem.html(data);
      return true;
    }

    return false;
  };
  /**
   * 恢复
   */


  HtmlCache.prototype.restore = function () {
    var data = this.data.next();

    if (data) {
      this.editor.$textElem.html(data);
      return true;
    }

    return false;
  };

  return HtmlCache;
}();

exports["default"] = HtmlCache;

/***/ }),
/* 434 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 数据结构 - 链表
 * @author fangzhicong
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _splice = _interopRequireDefault(__webpack_require__(91));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.TailChain = void 0;
/**
 * 特殊链表（数据尾插入、插入前自动清理指针后边的数据、插入后指针永远定位于最后一位元素、可限制链表长度、指针双向移动）
 */

var TailChain =
/** @class */
function () {
  function TailChain() {
    /**
     * 链表数据
     */
    this.data = [];
    /**
     * 链表最大长度，零表示长度不限
     */

    this.max = 0;
    /**
     * 指针
     */

    this.point = 0; // 当前指针是否人为操作过

    this.isRe = false;
  }
  /**
   * 允许用户重设一次 max 值
   */


  TailChain.prototype.resetMax = function (maxSize) {
    maxSize = Math.abs(maxSize);
    maxSize && (this.max = maxSize);
  };

  (0, _defineProperty["default"])(TailChain.prototype, "size", {
    /**
     * 当前链表的长度
     */
    get: function get() {
      return this.data.length;
    },
    enumerable: false,
    configurable: true
  });
  /**
   * 尾插入
   * @param data 插入的数据
   */

  TailChain.prototype.insertLast = function (data) {
    // 人为操作过指针，清除指针后面的元素
    if (this.isRe) {
      var _context;

      (0, _splice["default"])(_context = this.data).call(_context, this.point + 1);
      this.isRe = false;
    }

    this.data.push(data); // 超出链表最大长度

    while (this.max && this.size > this.max) {
      this.data.shift();
    } // 从新定位指针到最后一个元素


    this.point = this.size - 1;
    return this;
  };
  /**
   * 获取当前指针元素
   */


  TailChain.prototype.current = function () {
    return this.data[this.point];
  };
  /**
   * 获取上一指针元素
   */


  TailChain.prototype.prev = function () {
    !this.isRe && (this.isRe = true);
    this.point--;

    if (this.point < 0) {
      this.point = 0;
      return undefined;
    }

    return this.current();
  };
  /**
   * 下一指针元素
   */


  TailChain.prototype.next = function () {
    !this.isRe && (this.isRe = true);
    this.point++;

    if (this.point >= this.size) {
      this.point = this.size - 1;
      return undefined;
    }

    return this.current();
  };

  return TailChain;
}();

exports.TailChain = TailChain;

/***/ }),
/* 435 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 记录 scrollTop
 * @author fangzhicong
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var cache_1 = tslib_1.__importDefault(__webpack_require__(99));

var ScrollCache =
/** @class */
function (_super) {
  tslib_1.__extends(ScrollCache, _super);

  function ScrollCache(editor) {
    var _this = _super.call(this, editor.config.historyMaxSize) || this;

    _this.editor = editor;
    /**
     * 上一次的 scrollTop
     */

    _this.last = 0;
    _this.target = editor.$textElem.elems[0];
    return _this;
  }
  /**
   * 给编辑区容器绑定 scroll 事件
   */


  ScrollCache.prototype.observe = function () {
    var _this = this;

    this.target = this.editor.$textElem.elems[0];
    this.editor.$textElem.on('scroll', function () {
      _this.last = _this.target.scrollTop;
    });
    this.resetMaxSize(this.editor.config.historyMaxSize);
  };
  /**
   * 保存 scrollTop 值
   */


  ScrollCache.prototype.save = function () {
    _super.prototype.save.call(this, [this.last, this.target.scrollTop]);

    return this;
  };
  /**
   * 撤销
   */


  ScrollCache.prototype.revoke = function () {
    var _this = this;

    return _super.prototype.revoke.call(this, function (data) {
      _this.target.scrollTop = data[0];
    });
  };
  /**
   * 恢复
   */


  ScrollCache.prototype.restore = function () {
    var _this = this;

    return _super.prototype.restore.call(this, function (data) {
      _this.target.scrollTop = data[1];
    });
  };

  return ScrollCache;
}(cache_1["default"]);

exports["default"] = ScrollCache;

/***/ }),
/* 436 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @description 记录 range 变化
 * @author fangzhicong
 */

var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var cache_1 = tslib_1.__importDefault(__webpack_require__(99));

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

var util_1 = __webpack_require__(6);
/**
 * 把 Range 对象转换成缓存对象
 * @param range Range 对象
 */


function rangeToObject(range) {
  return {
    start: [range.startContainer, range.startOffset],
    end: [range.endContainer, range.endOffset],
    root: range.commonAncestorContainer,
    collapsed: range.collapsed
  };
}
/**
 * 编辑区 range 缓存管理器
 */


var RangeCache =
/** @class */
function (_super) {
  tslib_1.__extends(RangeCache, _super);

  function RangeCache(editor) {
    var _this = _super.call(this, editor.config.historyMaxSize) || this;

    _this.editor = editor;
    _this.lastRange = rangeToObject(document.createRange());
    _this.root = editor.$textElem.elems[0];
    _this.updateLastRange = util_1.debounce(function () {
      _this.lastRange = rangeToObject(_this.rangeHandle);
    }, editor.config.onchangeTimeout);
    return _this;
  }

  (0, _defineProperty["default"])(RangeCache.prototype, "rangeHandle", {
    /**
     * 获取 Range 对象
     */
    get: function get() {
      var selection = document.getSelection();
      return selection && selection.rangeCount ? selection.getRangeAt(0) : document.createRange();
    },
    enumerable: false,
    configurable: true
  });
  /**
   * 初始化绑定
   */

  RangeCache.prototype.observe = function () {
    var self = this; // 同步节点数据

    this.root = this.editor.$textElem.elems[0];
    this.resetMaxSize(this.editor.config.historyMaxSize); // selection change 回调函数

    function selectionchange() {
      var handle = self.rangeHandle;

      if (self.root === handle.commonAncestorContainer || self.root.contains(handle.commonAncestorContainer)) {
        // 非中文输入状态下才进行记录
        if (!self.editor.isComposing) {
          self.updateLastRange();
        }
      }
    } // backspace 和 delete 手动更新 Range 缓存


    function deletecallback(e) {
      if (e.key == 'Backspace' || e.key == 'Delete') {
        // self.lastRange = rangeToObject(self.rangeHandle)
        self.updateLastRange();
      }
    } // 绑定事件（必须绑定在 document 上，不能绑定在 window 上）


    dom_core_1["default"](document).on('selectionchange', selectionchange); // 解除事件绑定

    this.editor.beforeDestroy(function () {
      dom_core_1["default"](document).off('selectionchange', selectionchange);
    }); // 删除文本时手动更新 range

    self.editor.$textElem.on('keydown', deletecallback);
  };
  /**
   * 保存 Range
   */


  RangeCache.prototype.save = function () {
    var current = rangeToObject(this.rangeHandle);

    _super.prototype.save.call(this, [this.lastRange, current]);

    this.lastRange = current;
    return this;
  };
  /**
   * 设置 Range，在 撤销/恢复 中调用
   * @param range 缓存的 Range 数据
   */


  RangeCache.prototype.set = function (range) {
    try {
      if (range) {
        var handle = this.rangeHandle;
        handle.setStart.apply(handle, range.start);
        handle.setEnd.apply(handle, range.end);
        this.editor.menus.changeActive();
        return true;
      }
    } catch (err) {
      return false;
    }

    return false;
  };
  /**
   * 撤销
   */


  RangeCache.prototype.revoke = function () {
    var _this = this;

    return _super.prototype.revoke.call(this, function (data) {
      _this.set(data[0]);
    });
  };
  /**
   * 恢复
   */


  RangeCache.prototype.restore = function () {
    var _this = this;

    return _super.prototype.restore.call(this, function (data) {
      _this.set(data[1]);
    });
  };

  return RangeCache;
}(cache_1["default"]);

exports["default"] = RangeCache;

/***/ }),
/* 437 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _find = _interopRequireDefault(__webpack_require__(29));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var tslib_1 = __webpack_require__(2);

var dom_core_1 = tslib_1.__importDefault(__webpack_require__(3));

__webpack_require__(438);

function disableInit(editor) {
  var isCurtain = false; // 避免重复生成幕布

  var $contentDom;
  var $menuDom; // 禁用期间，通过 js 修改内容后，刷新内容

  editor.txt.eventHooks.changeEvents.push(function () {
    if (isCurtain) {
      (0, _find["default"])($contentDom).call($contentDom, '.w-e-content-preview').html(editor.$textElem.html());
    }
  }); // 创建幕布

  function disable() {
    if (isCurtain) return; // 隐藏编辑区域

    editor.$textElem.hide(); // 生成div 渲染编辑内容

    var textContainerZindexValue = editor.zIndex.get('textContainer');
    var content = editor.txt.html();
    $contentDom = dom_core_1["default"]("<div class=\"w-e-content-mantle\" style=\"z-index:" + textContainerZindexValue + "\">\n                <div class=\"w-e-content-preview w-e-text\">" + content + "</div>\n            </div>");
    editor.$textContainerElem.append($contentDom); // 生成div 菜单膜布

    var menuZindexValue = editor.zIndex.get('menu');
    $menuDom = dom_core_1["default"]("<div class=\"w-e-menue-mantle\" style=\"z-index:" + menuZindexValue + "\"></div>");
    editor.$toolbarElem.append($menuDom);
    isCurtain = true;
    editor.isEnable = false;
  } // 销毁幕布并显示可编辑区域


  function enable() {
    if (!isCurtain) return;
    $contentDom.remove();
    $menuDom.remove();
    editor.$textElem.show();
    isCurtain = false;
    editor.isEnable = true;
  }

  return {
    disable: disable,
    enable: enable
  };
}

exports["default"] = disableInit;

/***/ }),
/* 438 */
/***/ (function(module, exports, __webpack_require__) {

var api = __webpack_require__(20);
            var content = __webpack_require__(439);

            content = content.__esModule ? content.default : content;

            if (typeof content === 'string') {
              content = [[module.i, content, '']];
            }

var options = {};

options.insert = "head";
options.singleton = false;

var update = api(content, options);



module.exports = content.locals || {};

/***/ }),
/* 439 */
/***/ (function(module, exports, __webpack_require__) {

// Imports
var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(21);
exports = ___CSS_LOADER_API_IMPORT___(false);
// Module
exports.push([module.i, ".w-e-content-mantle {\n  width: 100%;\n  height: 100%;\n  overflow-y: auto;\n}\n.w-e-content-mantle .w-e-content-preview {\n  width: 100%;\n  min-height: 100%;\n  padding: 0 10px;\n  line-height: 1.5;\n}\n.w-e-content-mantle .w-e-content-preview img {\n  cursor: default;\n}\n.w-e-content-mantle .w-e-content-preview img:hover {\n  box-shadow: none;\n}\n.w-e-menue-mantle {\n  position: absolute;\n  height: 100%;\n  width: 100%;\n  top: 0;\n  left: 0;\n}\n", ""]);
// Exports
module.exports = exports;


/***/ }),
/* 440 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

var SelectionChange =
/** @class */
function () {
  function SelectionChange(editor) {
    var _this = this;

    this.editor = editor; // 绑定的事件

    var init = function init() {
      var activeElement = document.activeElement;

      if (activeElement === editor.$textElem.elems[0]) {
        _this.emit();
      }
    }; //  选取变化事件监听


    window.document.addEventListener('selectionchange', init); // 摧毁时移除监听

    this.editor.beforeDestroy(function () {
      window.document.removeEventListener('selectionchange', init);
    });
  }

  SelectionChange.prototype.emit = function () {
    var _a; // 执行rangeChange函数


    var onSelectionChange = this.editor.config.onSelectionChange;

    if (onSelectionChange) {
      var selection = this.editor.selection;
      selection.saveRange();
      if (!selection.isSelectionEmpty()) onSelectionChange({
        // 当前文本
        text: selection.getSelectionText(),
        // 当前的html
        html: (_a = selection.getSelectionContainerElem()) === null || _a === void 0 ? void 0 : _a.elems[0].innerHTML,
        // select对象
        selection: selection
      });
    }
  };

  return SelectionChange;
}();

exports["default"] = SelectionChange;

/***/ }),
/* 441 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

var _assign = _interopRequireDefault(__webpack_require__(128));

var _entries = _interopRequireDefault(__webpack_require__(94));

var _forEach = _interopRequireDefault(__webpack_require__(4));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});
exports.registerPlugin = void 0;

var tslib_1 = __webpack_require__(2);

var editor_1 = tslib_1.__importDefault(__webpack_require__(87));

var util_1 = __webpack_require__(6);
/**
 * 插件注册
 * @param { string } name 插件名
 * @param { RegisterOptions } options 插件配置
 * @param { pluginsListType } memory 存储介质
 */


function registerPlugin(name, options, memory) {
  if (!name) {
    throw new TypeError('name is not define');
  }

  if (!options) {
    throw new TypeError('options is not define');
  }

  if (!options.intention) {
    throw new TypeError('options.intention is not define');
  }

  if (options.intention && typeof options.intention !== 'function') {
    throw new TypeError('options.intention is not function');
  }

  if (memory[name]) {
    console.warn("plugin " + name + " \u5DF2\u5B58\u5728\uFF0C\u5DF2\u8986\u76D6\u3002");
  }

  memory[name] = options;
}

exports.registerPlugin = registerPlugin;
/**
 * 插件初始化
 * @param { Editor } editor 编辑器实例
 */

function initPlugins(editor) {
  var plugins = (0, _assign["default"])({}, util_1.deepClone(editor_1["default"].globalPluginsFunctionList), util_1.deepClone(editor.pluginsFunctionList));
  var values = (0, _entries["default"])(plugins);
  (0, _forEach["default"])(values).call(values, function (_a) {
    var name = _a[0],
        options = _a[1];
    console.info("plugin " + name + " initializing");
    var intention = options.intention,
        config = options.config;
    intention(editor, config);
    console.info("plugin " + name + " initialization complete");
  });
}

exports["default"] = initPlugins;

/***/ }),
/* 442 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _interopRequireDefault = __webpack_require__(0);

var _defineProperty = _interopRequireDefault(__webpack_require__(1));

(0, _defineProperty["default"])(exports, "__esModule", {
  value: true
});

/***/ })
/******/ ])["default"];
});
//# sourceMappingURL=wangEditor.js.map