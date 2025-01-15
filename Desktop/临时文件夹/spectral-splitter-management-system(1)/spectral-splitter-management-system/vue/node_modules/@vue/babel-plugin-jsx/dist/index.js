"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  default: () => src_default
});
module.exports = __toCommonJS(src_exports);
var t5 = __toESM(require("@babel/types"));
var import_template = __toESM(require("@babel/template"));
var import_plugin_syntax_jsx = __toESM(require("@babel/plugin-syntax-jsx"));
var import_helper_module_imports2 = require("@babel/helper-module-imports");

// src/transform-vue-jsx.ts
var t3 = __toESM(require("@babel/types"));
var import_helper_module_imports = require("@babel/helper-module-imports");

// src/utils.ts
var t = __toESM(require("@babel/types"));
var import_html_tags = __toESM(require("html-tags"));
var import_svg_tags = __toESM(require("svg-tags"));

// src/slotFlags.ts
var SlotFlags = /* @__PURE__ */ ((SlotFlags2) => {
  SlotFlags2[SlotFlags2["STABLE"] = 1] = "STABLE";
  SlotFlags2[SlotFlags2["DYNAMIC"] = 2] = "DYNAMIC";
  SlotFlags2[SlotFlags2["FORWARDED"] = 3] = "FORWARDED";
  return SlotFlags2;
})(SlotFlags || {});
var slotFlags_default = SlotFlags;

// src/utils.ts
var FRAGMENT = "Fragment";
var KEEP_ALIVE = "KeepAlive";
var createIdentifier = (state, name) => state.get(name)();
var isDirective = (src) => src.startsWith("v-") || src.startsWith("v") && src.length >= 2 && src[1] >= "A" && src[1] <= "Z";
var shouldTransformedToSlots = (tag) => !(tag.match(RegExp(`^_?${FRAGMENT}\\d*$`)) || tag === KEEP_ALIVE);
var checkIsComponent = (path, state) => {
  var _a, _b;
  const namePath = path.get("name");
  if (namePath.isJSXMemberExpression()) {
    return shouldTransformedToSlots(namePath.node.property.name);
  }
  const tag = namePath.node.name;
  return !((_b = (_a = state.opts).isCustomElement) == null ? void 0 : _b.call(_a, tag)) && shouldTransformedToSlots(tag) && !import_html_tags.default.includes(tag) && !import_svg_tags.default.includes(tag);
};
var transformJSXMemberExpression = (path) => {
  const objectPath = path.node.object;
  const propertyPath = path.node.property;
  const transformedObject = t.isJSXMemberExpression(objectPath) ? transformJSXMemberExpression(
    path.get("object")
  ) : t.isJSXIdentifier(objectPath) ? t.identifier(objectPath.name) : t.nullLiteral();
  const transformedProperty = t.identifier(propertyPath.name);
  return t.memberExpression(transformedObject, transformedProperty);
};
var getTag = (path, state) => {
  var _a, _b;
  const namePath = path.get("openingElement").get("name");
  if (namePath.isJSXIdentifier()) {
    const { name } = namePath.node;
    if (!import_html_tags.default.includes(name) && !import_svg_tags.default.includes(name)) {
      return name === FRAGMENT ? createIdentifier(state, FRAGMENT) : path.scope.hasBinding(name) ? t.identifier(name) : ((_b = (_a = state.opts).isCustomElement) == null ? void 0 : _b.call(_a, name)) ? t.stringLiteral(name) : t.callExpression(createIdentifier(state, "resolveComponent"), [
        t.stringLiteral(name)
      ]);
    }
    return t.stringLiteral(name);
  }
  if (namePath.isJSXMemberExpression()) {
    return transformJSXMemberExpression(namePath);
  }
  throw new Error(`getTag: ${namePath.type} is not supported`);
};
var getJSXAttributeName = (path) => {
  const nameNode = path.node.name;
  if (t.isJSXIdentifier(nameNode)) {
    return nameNode.name;
  }
  return `${nameNode.namespace.name}:${nameNode.name.name}`;
};
var transformJSXText = (path) => {
  const str = transformText(path.node.value);
  return str !== "" ? t.stringLiteral(str) : null;
};
var transformText = (text) => {
  const lines = text.split(/\r\n|\n|\r/);
  let lastNonEmptyLine = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/[^ \t]/)) {
      lastNonEmptyLine = i;
    }
  }
  let str = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isFirstLine = i === 0;
    const isLastLine = i === lines.length - 1;
    const isLastNonEmptyLine = i === lastNonEmptyLine;
    let trimmedLine = line.replace(/\t/g, " ");
    if (!isFirstLine) {
      trimmedLine = trimmedLine.replace(/^[ ]+/, "");
    }
    if (!isLastLine) {
      trimmedLine = trimmedLine.replace(/[ ]+$/, "");
    }
    if (trimmedLine) {
      if (!isLastNonEmptyLine) {
        trimmedLine += " ";
      }
      str += trimmedLine;
    }
  }
  return str;
};
var transformJSXExpressionContainer = (path) => path.get("expression").node;
var transformJSXSpreadChild = (path) => t.spreadElement(path.get("expression").node);
var walksScope = (path, name, slotFlag) => {
  if (path.scope.hasBinding(name) && path.parentPath) {
    if (t.isJSXElement(path.parentPath.node)) {
      path.parentPath.setData("slotFlag", slotFlag);
    }
    walksScope(path.parentPath, name, slotFlag);
  }
};
var buildIIFE = (path, children) => {
  const { parentPath } = path;
  if (parentPath.isAssignmentExpression()) {
    const { left } = parentPath.node;
    if (t.isIdentifier(left)) {
      return children.map((child) => {
        if (t.isIdentifier(child) && child.name === left.name) {
          const insertName = path.scope.generateUidIdentifier(child.name);
          parentPath.insertBefore(
            t.variableDeclaration("const", [
              t.variableDeclarator(
                insertName,
                t.callExpression(
                  t.functionExpression(
                    null,
                    [],
                    t.blockStatement([t.returnStatement(child)])
                  ),
                  []
                )
              )
            ])
          );
          return insertName;
        }
        return child;
      });
    }
  }
  return children;
};
var onRE = /^on[^a-z]/;
var isOn = (key) => onRE.test(key);
var mergeAsArray = (existing, incoming) => {
  if (t.isArrayExpression(existing.value)) {
    existing.value.elements.push(incoming.value);
  } else {
    existing.value = t.arrayExpression([
      existing.value,
      incoming.value
    ]);
  }
};
var dedupeProperties = (properties = [], mergeProps) => {
  if (!mergeProps) {
    return properties;
  }
  const knownProps = /* @__PURE__ */ new Map();
  const deduped = [];
  properties.forEach((prop) => {
    if (t.isStringLiteral(prop.key)) {
      const { value: name } = prop.key;
      const existing = knownProps.get(name);
      if (existing) {
        if (name === "style" || name === "class" || name.startsWith("on")) {
          mergeAsArray(existing, prop);
        }
      } else {
        knownProps.set(name, prop);
        deduped.push(prop);
      }
    } else {
      deduped.push(prop);
    }
  });
  return deduped;
};
var isConstant = (node) => {
  if (t.isIdentifier(node)) {
    return node.name === "undefined";
  }
  if (t.isArrayExpression(node)) {
    const { elements } = node;
    return elements.every((element) => element && isConstant(element));
  }
  if (t.isObjectExpression(node)) {
    return node.properties.every(
      (property) => isConstant(property.value)
    );
  }
  if (t.isLiteral(node)) {
    return true;
  }
  return false;
};
var transformJSXSpreadAttribute = (nodePath, path, mergeProps, args) => {
  const argument = path.get("argument");
  const properties = t.isObjectExpression(argument.node) ? argument.node.properties : void 0;
  if (!properties) {
    if (argument.isIdentifier()) {
      walksScope(
        nodePath,
        argument.node.name,
        slotFlags_default.DYNAMIC
      );
    }
    args.push(mergeProps ? argument.node : t.spreadElement(argument.node));
  } else if (mergeProps) {
    args.push(t.objectExpression(properties));
  } else {
    args.push(...properties);
  }
};

// src/parseDirectives.ts
var t2 = __toESM(require("@babel/types"));
var getType = (path) => {
  const typePath = path.get("attributes").find((attribute) => {
    if (!attribute.isJSXAttribute()) {
      return false;
    }
    return attribute.get("name").isJSXIdentifier() && attribute.get("name").node.name === "type";
  });
  return typePath ? typePath.get("value").node : null;
};
var parseModifiers = (value) => t2.isArrayExpression(value) ? value.elements.map((el) => t2.isStringLiteral(el) ? el.value : "").filter(Boolean) : [];
var parseDirectives = (params) => {
  var _a, _b;
  const { path, value, state, tag, isComponent } = params;
  const args = [];
  const vals = [];
  const modifiersSet = [];
  let directiveName;
  let directiveArgument;
  let directiveModifiers;
  if ("namespace" in path.node.name) {
    [directiveName, directiveArgument] = params.name.split(":");
    directiveName = path.node.name.namespace.name;
    directiveArgument = path.node.name.name.name;
    directiveModifiers = directiveArgument.split("_").slice(1);
  } else {
    const underscoreModifiers = params.name.split("_");
    directiveName = underscoreModifiers.shift() || "";
    directiveModifiers = underscoreModifiers;
  }
  directiveName = directiveName.replace(/^v/, "").replace(/^-/, "").replace(/^\S/, (s) => s.toLowerCase());
  if (directiveArgument) {
    args.push(t2.stringLiteral(directiveArgument));
  }
  const isVModels = directiveName === "models";
  const isVModel = directiveName === "model";
  if (isVModel && !path.get("value").isJSXExpressionContainer()) {
    throw new Error("You have to use JSX Expression inside your v-model");
  }
  if (isVModels && !isComponent) {
    throw new Error("v-models can only use in custom components");
  }
  const shouldResolve = !["html", "text", "model", "models"].includes(directiveName) || isVModel && !isComponent;
  let modifiers = directiveModifiers;
  if (t2.isArrayExpression(value)) {
    const elementsList = isVModels ? value.elements : [value];
    elementsList.forEach((element) => {
      if (isVModels && !t2.isArrayExpression(element)) {
        throw new Error("You should pass a Two-dimensional Arrays to v-models");
      }
      const { elements } = element;
      const [first, second, third] = elements;
      if (second && !t2.isArrayExpression(second) && !t2.isSpreadElement(second)) {
        args.push(second);
        modifiers = parseModifiers(third);
      } else if (t2.isArrayExpression(second)) {
        if (!shouldResolve) {
          args.push(t2.nullLiteral());
        }
        modifiers = parseModifiers(second);
      } else if (!shouldResolve) {
        args.push(t2.nullLiteral());
      }
      modifiersSet.push(new Set(modifiers));
      vals.push(first);
    });
  } else if (isVModel && !shouldResolve) {
    args.push(t2.nullLiteral());
    modifiersSet.push(new Set(directiveModifiers));
  } else {
    modifiersSet.push(new Set(directiveModifiers));
  }
  return {
    directiveName,
    modifiers: modifiersSet,
    values: vals.length ? vals : [value],
    args,
    directive: shouldResolve ? [
      resolveDirective(path, state, tag, directiveName),
      vals[0] || value,
      ((_a = modifiersSet[0]) == null ? void 0 : _a.size) ? args[0] || t2.unaryExpression("void", t2.numericLiteral(0), true) : args[0],
      !!((_b = modifiersSet[0]) == null ? void 0 : _b.size) && t2.objectExpression(
        [...modifiersSet[0]].map(
          (modifier) => t2.objectProperty(t2.identifier(modifier), t2.booleanLiteral(true))
        )
      )
    ].filter(Boolean) : void 0
  };
};
var resolveDirective = (path, state, tag, directiveName) => {
  if (directiveName === "show") {
    return createIdentifier(state, "vShow");
  }
  if (directiveName === "model") {
    let modelToUse;
    const type = getType(path.parentPath);
    switch (tag.value) {
      case "select":
        modelToUse = createIdentifier(state, "vModelSelect");
        break;
      case "textarea":
        modelToUse = createIdentifier(state, "vModelText");
        break;
      default:
        if (t2.isStringLiteral(type) || !type) {
          switch (type == null ? void 0 : type.value) {
            case "checkbox":
              modelToUse = createIdentifier(state, "vModelCheckbox");
              break;
            case "radio":
              modelToUse = createIdentifier(state, "vModelRadio");
              break;
            default:
              modelToUse = createIdentifier(state, "vModelText");
          }
        } else {
          modelToUse = createIdentifier(state, "vModelDynamic");
        }
    }
    return modelToUse;
  }
  return t2.callExpression(createIdentifier(state, "resolveDirective"), [
    t2.stringLiteral(directiveName)
  ]);
};
var parseDirectives_default = parseDirectives;

// src/transform-vue-jsx.ts
var xlinkRE = /^xlink([A-Z])/;
var getJSXAttributeValue = (path, state) => {
  const valuePath = path.get("value");
  if (valuePath.isJSXElement()) {
    return transformJSXElement(valuePath, state);
  }
  if (valuePath.isStringLiteral()) {
    return t3.stringLiteral(transformText(valuePath.node.value));
  }
  if (valuePath.isJSXExpressionContainer()) {
    return transformJSXExpressionContainer(valuePath);
  }
  return null;
};
var buildProps = (path, state) => {
  const tag = getTag(path, state);
  const isComponent = checkIsComponent(path.get("openingElement"), state);
  const props = path.get("openingElement").get("attributes");
  const directives = [];
  const dynamicPropNames = /* @__PURE__ */ new Set();
  let slots = null;
  let patchFlag = 0;
  if (props.length === 0) {
    return {
      tag,
      isComponent,
      slots,
      props: t3.nullLiteral(),
      directives,
      patchFlag,
      dynamicPropNames
    };
  }
  let properties = [];
  let hasRef = false;
  let hasClassBinding = false;
  let hasStyleBinding = false;
  let hasHydrationEventBinding = false;
  let hasDynamicKeys = false;
  const mergeArgs = [];
  const { mergeProps = true } = state.opts;
  props.forEach((prop) => {
    if (prop.isJSXAttribute()) {
      let name = getJSXAttributeName(prop);
      const attributeValue = getJSXAttributeValue(prop, state);
      if (!isConstant(attributeValue) || name === "ref") {
        if (!isComponent && isOn(name) && // omit the flag for click handlers becaues hydration gives click
        // dedicated fast path.
        name.toLowerCase() !== "onclick" && // omit v-model handlers
        name !== "onUpdate:modelValue") {
          hasHydrationEventBinding = true;
        }
        if (name === "ref") {
          hasRef = true;
        } else if (name === "class" && !isComponent) {
          hasClassBinding = true;
        } else if (name === "style" && !isComponent) {
          hasStyleBinding = true;
        } else if (name !== "key" && !isDirective(name) && name !== "on") {
          dynamicPropNames.add(name);
        }
      }
      if (state.opts.transformOn && (name === "on" || name === "nativeOn")) {
        if (!state.get("transformOn")) {
          state.set(
            "transformOn",
            (0, import_helper_module_imports.addDefault)(path, "@vue/babel-helper-vue-transform-on", {
              nameHint: "_transformOn"
            })
          );
        }
        mergeArgs.push(
          t3.callExpression(state.get("transformOn"), [
            attributeValue || t3.booleanLiteral(true)
          ])
        );
        return;
      }
      if (isDirective(name)) {
        const { directive, modifiers, values, args, directiveName } = parseDirectives_default({
          tag,
          isComponent,
          name,
          path: prop,
          state,
          value: attributeValue
        });
        if (directiveName === "slots") {
          slots = attributeValue;
          return;
        }
        if (directive) {
          directives.push(t3.arrayExpression(directive));
        } else if (directiveName === "html") {
          properties.push(
            t3.objectProperty(t3.stringLiteral("innerHTML"), values[0])
          );
          dynamicPropNames.add("innerHTML");
        } else if (directiveName === "text") {
          properties.push(
            t3.objectProperty(t3.stringLiteral("textContent"), values[0])
          );
          dynamicPropNames.add("textContent");
        }
        if (["models", "model"].includes(directiveName)) {
          values.forEach((value, index) => {
            var _a;
            const propName = args[index];
            const isDynamic = propName && !t3.isStringLiteral(propName) && !t3.isNullLiteral(propName);
            if (!directive) {
              properties.push(
                t3.objectProperty(
                  t3.isNullLiteral(propName) ? t3.stringLiteral("modelValue") : propName,
                  value,
                  isDynamic
                )
              );
              if (!isDynamic) {
                dynamicPropNames.add(
                  (propName == null ? void 0 : propName.value) || "modelValue"
                );
              }
              if ((_a = modifiers[index]) == null ? void 0 : _a.size) {
                properties.push(
                  t3.objectProperty(
                    isDynamic ? t3.binaryExpression(
                      "+",
                      propName,
                      t3.stringLiteral("Modifiers")
                    ) : t3.stringLiteral(
                      `${(propName == null ? void 0 : propName.value) || "model"}Modifiers`
                    ),
                    t3.objectExpression(
                      [...modifiers[index]].map(
                        (modifier) => t3.objectProperty(
                          t3.stringLiteral(modifier),
                          t3.booleanLiteral(true)
                        )
                      )
                    ),
                    isDynamic
                  )
                );
              }
            }
            const updateName = isDynamic ? t3.binaryExpression("+", t3.stringLiteral("onUpdate"), propName) : t3.stringLiteral(
              `onUpdate:${(propName == null ? void 0 : propName.value) || "modelValue"}`
            );
            properties.push(
              t3.objectProperty(
                updateName,
                t3.arrowFunctionExpression(
                  [t3.identifier("$event")],
                  t3.assignmentExpression(
                    "=",
                    value,
                    t3.identifier("$event")
                  )
                ),
                isDynamic
              )
            );
            if (!isDynamic) {
              dynamicPropNames.add(updateName.value);
            } else {
              hasDynamicKeys = true;
            }
          });
        }
      } else {
        if (name.match(xlinkRE)) {
          name = name.replace(
            xlinkRE,
            (_, firstCharacter) => `xlink:${firstCharacter.toLowerCase()}`
          );
        }
        properties.push(
          t3.objectProperty(
            t3.stringLiteral(name),
            attributeValue || t3.booleanLiteral(true)
          )
        );
      }
    } else {
      if (properties.length && mergeProps) {
        mergeArgs.push(
          t3.objectExpression(dedupeProperties(properties, mergeProps))
        );
        properties = [];
      }
      hasDynamicKeys = true;
      transformJSXSpreadAttribute(
        path,
        prop,
        mergeProps,
        mergeProps ? mergeArgs : properties
      );
    }
  });
  if (hasDynamicKeys) {
    patchFlag |= 16 /* FULL_PROPS */;
  } else {
    if (hasClassBinding) {
      patchFlag |= 2 /* CLASS */;
    }
    if (hasStyleBinding) {
      patchFlag |= 4 /* STYLE */;
    }
    if (dynamicPropNames.size) {
      patchFlag |= 8 /* PROPS */;
    }
    if (hasHydrationEventBinding) {
      patchFlag |= 32 /* HYDRATE_EVENTS */;
    }
  }
  if ((patchFlag === 0 || patchFlag === 32 /* HYDRATE_EVENTS */) && (hasRef || directives.length > 0)) {
    patchFlag |= 512 /* NEED_PATCH */;
  }
  let propsExpression = t3.nullLiteral();
  if (mergeArgs.length) {
    if (properties.length) {
      mergeArgs.push(
        t3.objectExpression(dedupeProperties(properties, mergeProps))
      );
    }
    if (mergeArgs.length > 1) {
      propsExpression = t3.callExpression(
        createIdentifier(state, "mergeProps"),
        mergeArgs
      );
    } else {
      propsExpression = mergeArgs[0];
    }
  } else if (properties.length) {
    if (properties.length === 1 && t3.isSpreadElement(properties[0])) {
      propsExpression = properties[0].argument;
    } else {
      propsExpression = t3.objectExpression(
        dedupeProperties(properties, mergeProps)
      );
    }
  }
  return {
    tag,
    props: propsExpression,
    isComponent,
    slots,
    directives,
    patchFlag,
    dynamicPropNames
  };
};
var getChildren = (paths, state) => paths.map((path) => {
  if (path.isJSXText()) {
    const transformedText = transformJSXText(path);
    if (transformedText) {
      return t3.callExpression(createIdentifier(state, "createTextVNode"), [
        transformedText
      ]);
    }
    return transformedText;
  }
  if (path.isJSXExpressionContainer()) {
    const expression = transformJSXExpressionContainer(path);
    if (t3.isIdentifier(expression)) {
      const { name } = expression;
      const { referencePaths = [] } = path.scope.getBinding(name) || {};
      referencePaths.forEach((referencePath) => {
        walksScope(referencePath, name, slotFlags_default.DYNAMIC);
      });
    }
    return expression;
  }
  if (path.isJSXSpreadChild()) {
    return transformJSXSpreadChild(path);
  }
  if (path.isCallExpression()) {
    return path.node;
  }
  if (path.isJSXElement()) {
    return transformJSXElement(path, state);
  }
  throw new Error(`getChildren: ${path.type} is not supported`);
}).filter(
  (value) => value != null && !t3.isJSXEmptyExpression(value)
);
var transformJSXElement = (path, state) => {
  const children = getChildren(path.get("children"), state);
  const {
    tag,
    props,
    isComponent,
    directives,
    patchFlag,
    dynamicPropNames,
    slots
  } = buildProps(path, state);
  const { optimize = false } = state.opts;
  const slotFlag = path.getData("slotFlag") || slotFlags_default.STABLE;
  let VNodeChild;
  if (children.length > 1 || slots) {
    VNodeChild = isComponent ? children.length ? t3.objectExpression(
      [
        !!children.length && t3.objectProperty(
          t3.identifier("default"),
          t3.arrowFunctionExpression(
            [],
            t3.arrayExpression(buildIIFE(path, children))
          )
        ),
        ...slots ? t3.isObjectExpression(slots) ? slots.properties : [t3.spreadElement(slots)] : [],
        optimize && t3.objectProperty(t3.identifier("_"), t3.numericLiteral(slotFlag))
      ].filter(Boolean)
    ) : slots : t3.arrayExpression(children);
  } else if (children.length === 1) {
    const { enableObjectSlots = true } = state.opts;
    const child = children[0];
    const objectExpression4 = t3.objectExpression(
      [
        t3.objectProperty(
          t3.identifier("default"),
          t3.arrowFunctionExpression(
            [],
            t3.arrayExpression(buildIIFE(path, [child]))
          )
        ),
        optimize && t3.objectProperty(
          t3.identifier("_"),
          t3.numericLiteral(slotFlag)
        )
      ].filter(Boolean)
    );
    if (t3.isIdentifier(child) && isComponent) {
      VNodeChild = enableObjectSlots ? t3.conditionalExpression(
        t3.callExpression(
          state.get("@vue/babel-plugin-jsx/runtimeIsSlot")(),
          [child]
        ),
        child,
        objectExpression4
      ) : objectExpression4;
    } else if (t3.isCallExpression(child) && child.loc && isComponent) {
      if (enableObjectSlots) {
        const { scope } = path;
        const slotId = scope.generateUidIdentifier("slot");
        if (scope) {
          scope.push({
            id: slotId,
            kind: "let"
          });
        }
        const alternate = t3.objectExpression(
          [
            t3.objectProperty(
              t3.identifier("default"),
              t3.arrowFunctionExpression(
                [],
                t3.arrayExpression(buildIIFE(path, [slotId]))
              )
            ),
            optimize && t3.objectProperty(
              t3.identifier("_"),
              t3.numericLiteral(slotFlag)
            )
          ].filter(Boolean)
        );
        const assignment = t3.assignmentExpression("=", slotId, child);
        const condition = t3.callExpression(
          state.get("@vue/babel-plugin-jsx/runtimeIsSlot")(),
          [assignment]
        );
        VNodeChild = t3.conditionalExpression(condition, slotId, alternate);
      } else {
        VNodeChild = objectExpression4;
      }
    } else if (t3.isFunctionExpression(child) || t3.isArrowFunctionExpression(child)) {
      VNodeChild = t3.objectExpression([
        t3.objectProperty(t3.identifier("default"), child)
      ]);
    } else if (t3.isObjectExpression(child)) {
      VNodeChild = t3.objectExpression(
        [
          ...child.properties,
          optimize && t3.objectProperty(t3.identifier("_"), t3.numericLiteral(slotFlag))
        ].filter(Boolean)
      );
    } else {
      VNodeChild = isComponent ? t3.objectExpression([
        t3.objectProperty(
          t3.identifier("default"),
          t3.arrowFunctionExpression([], t3.arrayExpression([child]))
        )
      ]) : t3.arrayExpression([child]);
    }
  }
  const createVNode = t3.callExpression(
    createIdentifier(state, "createVNode"),
    [
      tag,
      props,
      VNodeChild || t3.nullLiteral(),
      !!patchFlag && optimize && t3.numericLiteral(patchFlag),
      !!dynamicPropNames.size && optimize && t3.arrayExpression(
        [...dynamicPropNames.keys()].map((name) => t3.stringLiteral(name))
      )
    ].filter(Boolean)
  );
  if (!directives.length) {
    return createVNode;
  }
  return t3.callExpression(createIdentifier(state, "withDirectives"), [
    createVNode,
    t3.arrayExpression(directives)
  ]);
};
var transform_vue_jsx_default = {
  JSXElement: {
    exit(path, state) {
      path.replaceWith(transformJSXElement(path, state));
    }
  }
};

// src/sugar-fragment.ts
var t4 = __toESM(require("@babel/types"));
var transformFragment = (path, Fragment) => {
  const children = path.get("children") || [];
  return t4.jsxElement(
    t4.jsxOpeningElement(Fragment, []),
    t4.jsxClosingElement(Fragment),
    children.map(({ node }) => node),
    false
  );
};
var sugar_fragment_default = {
  JSXFragment: {
    enter(path, state) {
      const fragmentCallee = createIdentifier(state, FRAGMENT);
      path.replaceWith(
        transformFragment(
          path,
          t4.isIdentifier(fragmentCallee) ? t4.jsxIdentifier(fragmentCallee.name) : t4.jsxMemberExpression(
            t4.jsxIdentifier(fragmentCallee.object.name),
            t4.jsxIdentifier(fragmentCallee.property.name)
          )
        )
      );
    }
  }
};

// src/index.ts
var hasJSX = (parentPath) => {
  let fileHasJSX = false;
  parentPath.traverse({
    JSXElement(path) {
      fileHasJSX = true;
      path.stop();
    },
    JSXFragment(path) {
      fileHasJSX = true;
      path.stop();
    }
  });
  return fileHasJSX;
};
var JSX_ANNOTATION_REGEX = /\*?\s*@jsx\s+([^\s]+)/;
var src_default = ({ types }) => ({
  name: "babel-plugin-jsx",
  inherits: import_plugin_syntax_jsx.default,
  visitor: __spreadProps(__spreadValues(__spreadValues({}, transform_vue_jsx_default), sugar_fragment_default), {
    Program: {
      enter(path, state) {
        if (hasJSX(path)) {
          const importNames = [
            "createVNode",
            "Fragment",
            "resolveComponent",
            "withDirectives",
            "vShow",
            "vModelSelect",
            "vModelText",
            "vModelCheckbox",
            "vModelRadio",
            "vModelText",
            "vModelDynamic",
            "resolveDirective",
            "mergeProps",
            "createTextVNode",
            "isVNode"
          ];
          if ((0, import_helper_module_imports2.isModule)(path)) {
            const importMap = {};
            importNames.forEach((name) => {
              state.set(name, () => {
                if (importMap[name]) {
                  return types.cloneNode(importMap[name]);
                }
                const identifier5 = (0, import_helper_module_imports2.addNamed)(path, name, "vue", {
                  ensureLiveReference: true
                });
                importMap[name] = identifier5;
                return identifier5;
              });
            });
            const { enableObjectSlots = true } = state.opts;
            if (enableObjectSlots) {
              state.set("@vue/babel-plugin-jsx/runtimeIsSlot", () => {
                if (importMap.runtimeIsSlot) {
                  return importMap.runtimeIsSlot;
                }
                const { name: isVNodeName } = state.get(
                  "isVNode"
                )();
                const isSlot = path.scope.generateUidIdentifier("isSlot");
                const ast = import_template.default.ast`
                  function ${isSlot.name}(s) {
                    return typeof s === 'function' || (Object.prototype.toString.call(s) === '[object Object]' && !${isVNodeName}(s));
                  }
                `;
                const lastImport = path.get("body").filter((p) => p.isImportDeclaration()).pop();
                if (lastImport) {
                  lastImport.insertAfter(ast);
                }
                importMap.runtimeIsSlot = isSlot;
                return isSlot;
              });
            }
          } else {
            let sourceName;
            importNames.forEach((name) => {
              state.set(name, () => {
                if (!sourceName) {
                  sourceName = (0, import_helper_module_imports2.addNamespace)(path, "vue", {
                    ensureLiveReference: true
                  });
                }
                return t5.memberExpression(sourceName, t5.identifier(name));
              });
            });
            const helpers = {};
            const { enableObjectSlots = true } = state.opts;
            if (enableObjectSlots) {
              state.set("@vue/babel-plugin-jsx/runtimeIsSlot", () => {
                if (helpers.runtimeIsSlot) {
                  return helpers.runtimeIsSlot;
                }
                const isSlot = path.scope.generateUidIdentifier("isSlot");
                const { object: objectName } = state.get(
                  "isVNode"
                )();
                const ast = import_template.default.ast`
                  function ${isSlot.name}(s) {
                    return typeof s === 'function' || (Object.prototype.toString.call(s) === '[object Object]' && !${objectName.name}.isVNode(s));
                  }
                `;
                const nodePaths = path.get("body");
                const lastImport = nodePaths.filter(
                  (p) => p.isVariableDeclaration() && p.node.declarations.some(
                    (d) => {
                      var _a;
                      return ((_a = d.id) == null ? void 0 : _a.name) === sourceName.name;
                    }
                  )
                ).pop();
                if (lastImport) {
                  lastImport.insertAfter(ast);
                }
                return isSlot;
              });
            }
          }
          const {
            opts: { pragma = "" },
            file
          } = state;
          if (pragma) {
            state.set("createVNode", () => t5.identifier(pragma));
          }
          if (file.ast.comments) {
            for (const comment of file.ast.comments) {
              const jsxMatches = JSX_ANNOTATION_REGEX.exec(comment.value);
              if (jsxMatches) {
                state.set("createVNode", () => t5.identifier(jsxMatches[1]));
              }
            }
          }
        }
      },
      exit(path) {
        const body = path.get("body");
        const specifiersMap = /* @__PURE__ */ new Map();
        body.filter(
          (nodePath) => t5.isImportDeclaration(nodePath.node) && nodePath.node.source.value === "vue"
        ).forEach((nodePath) => {
          const { specifiers: specifiers2 } = nodePath.node;
          let shouldRemove = false;
          specifiers2.forEach((specifier) => {
            if (!specifier.loc && t5.isImportSpecifier(specifier) && t5.isIdentifier(specifier.imported)) {
              specifiersMap.set(specifier.imported.name, specifier);
              shouldRemove = true;
            }
          });
          if (shouldRemove) {
            nodePath.remove();
          }
        });
        const specifiers = [...specifiersMap.keys()].map(
          (imported) => specifiersMap.get(imported)
        );
        if (specifiers.length) {
          path.unshiftContainer(
            "body",
            t5.importDeclaration(specifiers, t5.stringLiteral("vue"))
          );
        }
      }
    }
  })
});
