"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getImportSource = getImportSource;
exports.getRequireSource = getRequireSource;
exports.isPolyfillSource = isPolyfillSource;
var _t = require("@babel/types");
const {
  isCallExpression,
  isExpressionStatement,
  isIdentifier,
  isStringLiteral
} = _t;
function getImportSource({
  node
}) {
  if (node.specifiers.length === 0) return node.source.value;
}
function getRequireSource({
  node
}) {
  if (!isExpressionStatement(node)) return;
  const {
    expression
  } = node;
  if (isCallExpression(expression) && isIdentifier(expression.callee) && expression.callee.name === "require" && expression.arguments.length === 1 && isStringLiteral(expression.arguments[0])) {
    return expression.arguments[0].value;
  }
}
function isPolyfillSource(source) {
  return source === "@babel/polyfill" || source === "core-js";
}

//# sourceMappingURL=utils.js.map
