"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _core = require("@babel/core");
var _helperPluginUtils = require("@babel/helper-plugin-utils");
var _template = require("@babel/template");
{
  var DefineAccessorHelper = _template.default.expression.ast`
    function (type, obj, key, fn) {
      var desc = { configurable: true, enumerable: true };
      desc[type] = fn;
      return Object.defineProperty(obj, key, desc);
    }
  `;
  DefineAccessorHelper._compact = true;
}
var _default = (0, _helperPluginUtils.declare)((api, options) => {
  var _api$assumption;
  api.assertVersion(7);
  const setComputedProperties = (_api$assumption = api.assumption("setComputedProperties")) != null ? _api$assumption : options.loose;
  const pushComputedProps = setComputedProperties ? pushComputedPropsLoose : pushComputedPropsSpec;
  function buildDefineAccessor(state, type, obj, key, fn) {
    {
      let helper;
      if (state.availableHelper("defineAccessor")) {
        helper = state.addHelper("defineAccessor");
      } else {
        const file = state.file;
        helper = file.get("fallbackDefineAccessorHelper");
        if (!helper) {
          const id = file.scope.generateUidIdentifier("defineAccessor");
          file.scope.push({
            id,
            init: DefineAccessorHelper
          });
          file.set("fallbackDefineAccessorHelper", helper = id);
        }
        helper = _core.types.cloneNode(helper);
      }
      return _core.types.callExpression(helper, [_core.types.stringLiteral(type), obj, key, fn]);
    }
  }
  function getValue(prop) {
    if (_core.types.isObjectProperty(prop)) {
      return prop.value;
    } else if (_core.types.isObjectMethod(prop)) {
      return _core.types.functionExpression(null, prop.params, prop.body, prop.generator, prop.async);
    }
  }
  function pushAssign(objId, prop, body) {
    body.push(_core.types.expressionStatement(_core.types.assignmentExpression("=", _core.types.memberExpression(_core.types.cloneNode(objId), prop.key, prop.computed || _core.types.isLiteral(prop.key)), getValue(prop))));
  }
  function pushAccessorDefine({
    body,
    computedProps,
    initPropExpression,
    objId,
    state
  }, prop) {
    const kind = prop.kind;
    const key = !prop.computed && _core.types.isIdentifier(prop.key) ? _core.types.stringLiteral(prop.key.name) : prop.key;
    const value = getValue(prop);
    if (computedProps.length === 1) {
      return buildDefineAccessor(state, kind, initPropExpression, key, value);
    } else {
      body.push(_core.types.expressionStatement(buildDefineAccessor(state, kind, _core.types.cloneNode(objId), key, value)));
    }
  }
  function pushComputedPropsLoose(info) {
    for (const prop of info.computedProps) {
      if (_core.types.isObjectMethod(prop) && (prop.kind === "get" || prop.kind === "set")) {
        const single = pushAccessorDefine(info, prop);
        if (single) return single;
      } else {
        pushAssign(_core.types.cloneNode(info.objId), prop, info.body);
      }
    }
  }
  function pushComputedPropsSpec(info) {
    const {
      objId,
      body,
      computedProps,
      state
    } = info;
    for (const prop of computedProps) {
      const key = _core.types.toComputedKey(prop);
      if (_core.types.isObjectMethod(prop) && (prop.kind === "get" || prop.kind === "set")) {
        const single = pushAccessorDefine(info, prop);
        if (single) return single;
      } else {
        const value = getValue(prop);
        if (computedProps.length === 1) {
          return _core.types.callExpression(state.addHelper("defineProperty"), [info.initPropExpression, key, value]);
        } else {
          body.push(_core.types.expressionStatement(_core.types.callExpression(state.addHelper("defineProperty"), [_core.types.cloneNode(objId), key, value])));
        }
      }
    }
  }
  return {
    name: "transform-computed-properties",
    visitor: {
      ObjectExpression: {
        exit(path, state) {
          const {
            node,
            parent,
            scope
          } = path;
          let hasComputed = false;
          for (const prop of node.properties) {
            hasComputed = prop.computed === true;
            if (hasComputed) break;
          }
          if (!hasComputed) return;
          const initProps = [];
          const computedProps = [];
          let foundComputed = false;
          for (const prop of node.properties) {
            if (_core.types.isSpreadElement(prop)) {
              continue;
            }
            if (prop.computed) {
              foundComputed = true;
            }
            if (foundComputed) {
              computedProps.push(prop);
            } else {
              initProps.push(prop);
            }
          }
          const objId = scope.generateUidIdentifierBasedOnNode(parent);
          const initPropExpression = _core.types.objectExpression(initProps);
          const body = [];
          body.push(_core.types.variableDeclaration("var", [_core.types.variableDeclarator(objId, initPropExpression)]));
          const single = pushComputedProps({
            scope,
            objId,
            body,
            computedProps,
            initPropExpression,
            state
          });
          if (single) {
            path.replaceWith(single);
          } else {
            body.push(_core.types.expressionStatement(_core.types.cloneNode(objId)));
            path.replaceWithMultiple(body);
          }
        }
      }
    }
  };
});
exports.default = _default;

//# sourceMappingURL=index.js.map
