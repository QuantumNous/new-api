"use strict";function _interopDefault(a){return a&&"object"==typeof a&&"default"in a?a["default"]:a}var syntaxJsx=_interopDefault(require("@babel/plugin-syntax-jsx"));/**
 * Check if expression is in method
 * @param t
 * @param path
 * @param parentLimitPath
 * @returns boolean
 */const isInMethod=(a,b,c)=>!!(b&&b!==c)&&(!!a.isObjectMethod(b)||isInMethod(a,b.parentPath,c)),hasJSX=(a,b)=>{let c=!1;return b.traverse({JSXElement(d){isInMethod(a,d,b)||(c=!0)}}),c},isFunctionalComponentDeclarator=(a,b)=>{const c=b.get("id.name").node[0];return!("A">c||"Z"<c)&&hasJSX(a,b)},convertFunctionalComponent=(a,b,c=null)=>{const d=[a.identifier("h"),...b.node.params],e=b.node.body,f=[a.objectProperty(a.identifier("functional"),a.booleanLiteral(!0)),a.objectProperty(a.identifier("render"),a.arrowFunctionExpression(d,e))];"development"===process.env.NODE_ENV&&c&&f.unshift(a.objectProperty(a.identifier("name"),a.stringLiteral(c))),b.replaceWith(a.objectExpression(f))};/**
 * Check path has JSX
 * @param t
 * @param path
 * @returns boolean
 */var index=a=>{const b=a.types;return{inherits:syntaxJsx,visitor:{Program(a){a.traverse({ExportDefaultDeclaration:{exit(a){b.isArrowFunctionExpression(a.node.declaration)&&hasJSX(b,a)&&convertFunctionalComponent(b,a.get("declaration"))}},VariableDeclaration:{exit(a){if(1===a.node.declarations.length&&b.isVariableDeclarator(a.node.declarations[0])&&b.isArrowFunctionExpression(a.node.declarations[0].init)){const c=a.get("declarations")[0];if(isFunctionalComponentDeclarator(b,c)){const c=a.node.declarations[0].id.name;convertFunctionalComponent(b,a.get("declarations")[0].get("init"),c)}}}}})}}}};module.exports=index;
