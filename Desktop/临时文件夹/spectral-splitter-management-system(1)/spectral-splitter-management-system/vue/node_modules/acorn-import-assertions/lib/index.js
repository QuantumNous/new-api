"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.importAssertions = importAssertions;
var _acorn = _interopRequireWildcard(require("acorn"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
const leftCurlyBrace = "{".charCodeAt(0);
const space = " ".charCodeAt(0);
const keyword = "assert";
const FUNC_STATEMENT = 1,
  FUNC_HANGING_STATEMENT = 2,
  FUNC_NULLABLE_ID = 4;
function importAssertions(Parser) {
  // Use supplied version acorn version if present, to avoid
  // reference mismatches due to different acorn versions. This
  // allows this plugin to be used with Rollup which supplies
  // its own internal version of acorn and thereby sidesteps
  // the package manager.
  const acorn = Parser.acorn || _acorn;
  const {
    tokTypes: tt,
    TokenType
  } = acorn;
  return class extends Parser {
    constructor(...args) {
      super(...args);
      this.assertToken = new TokenType(keyword);
    }
    _codeAt(i) {
      return this.input.charCodeAt(i);
    }
    _eat(t) {
      if (this.type !== t) {
        this.unexpected();
      }
      this.next();
    }
    readToken(code) {
      let i = 0;
      for (; i < keyword.length; i++) {
        if (this._codeAt(this.pos + i) !== keyword.charCodeAt(i)) {
          return super.readToken(code);
        }
      }

      // ensure that the keyword is at the correct location
      // ie `assert{...` or `assert {...`
      for (;; i++) {
        if (this._codeAt(this.pos + i) === leftCurlyBrace) {
          // Found '{'
          break;
        } else if (this._codeAt(this.pos + i) === space) {
          // white space is allowed between `assert` and `{`, so continue.
          continue;
        } else {
          return super.readToken(code);
        }
      }

      // If we're inside a dynamic import expression we'll parse
      // the `assert` keyword as a standard object property name
      // ie `import(""./foo.json", { assert: { type: "json" } })`
      if (this.type.label === "{") {
        return super.readToken(code);
      }
      this.pos += keyword.length;
      return this.finishToken(this.assertToken);
    }
    parseDynamicImport(node) {
      this.next(); // skip `(`

      // Parse node.source.
      node.source = this.parseMaybeAssign();
      if (this.eat(tt.comma)) {
        const obj = this.parseObj(false);
        node.arguments = [obj];
      }
      this._eat(tt.parenR);
      return this.finishNode(node, "ImportExpression");
    }

    // ported from acorn/src/statement.js pp.parseExport
    parseExport(node, exports) {
      this.next();
      // export * from '...'
      if (this.eat(tt.star)) {
        if (this.options.ecmaVersion >= 11) {
          if (this.eatContextual("as")) {
            node.exported = this.parseIdent(true);
            this.checkExport(exports, node.exported.name, this.lastTokStart);
          } else {
            node.exported = null;
          }
        }
        this.expectContextual("from");
        if (this.type !== tt.string) {
          this.unexpected();
        }
        node.source = this.parseExprAtom();
        if (this.type === this.assertToken || this.type === tt._with) {
          this.next();
          const assertions = this.parseImportAssertions();
          if (assertions) {
            node.assertions = assertions;
          }
        }
        this.semicolon();
        return this.finishNode(node, "ExportAllDeclaration");
      }
      if (this.eat(tt._default)) {
        // export default ...
        this.checkExport(exports, "default", this.lastTokStart);
        var isAsync;
        if (this.type === tt._function || (isAsync = this.isAsyncFunction())) {
          var fNode = this.startNode();
          this.next();
          if (isAsync) {
            this.next();
          }
          node.declaration = this.parseFunction(fNode, FUNC_STATEMENT | FUNC_NULLABLE_ID, false, isAsync);
        } else if (this.type === tt._class) {
          var cNode = this.startNode();
          node.declaration = this.parseClass(cNode, "nullableID");
        } else {
          node.declaration = this.parseMaybeAssign();
          this.semicolon();
        }
        return this.finishNode(node, "ExportDefaultDeclaration");
      }
      // export var|const|let|function|class ...
      if (this.shouldParseExportStatement()) {
        node.declaration = this.parseStatement(null);
        if (node.declaration.type === "VariableDeclaration") {
          this.checkVariableExport(exports, node.declaration.declarations);
        } else {
          this.checkExport(exports, node.declaration.id.name, node.declaration.id.start);
        }
        node.specifiers = [];
        node.source = null;
      } else {
        // export { x, y as z } [from '...']
        node.declaration = null;
        node.specifiers = this.parseExportSpecifiers(exports);
        if (this.eatContextual("from")) {
          if (this.type !== tt.string) {
            this.unexpected();
          }
          node.source = this.parseExprAtom();
          if (this.type === this.assertToken || this.type === tt._with) {
            this.next();
            const assertions = this.parseImportAssertions();
            if (assertions) {
              node.assertions = assertions;
            }
          }
        } else {
          for (var i = 0, list = node.specifiers; i < list.length; i += 1) {
            // check for keywords used as local names
            var spec = list[i];
            this.checkUnreserved(spec.local);
            // check if export is defined
            this.checkLocalExport(spec.local);
          }
          node.source = null;
        }
        this.semicolon();
      }
      return this.finishNode(node, "ExportNamedDeclaration");
    }
    parseImport(node) {
      this.next();
      // import '...'
      if (this.type === tt.string) {
        node.specifiers = [];
        node.source = this.parseExprAtom();
      } else {
        node.specifiers = this.parseImportSpecifiers();
        this.expectContextual("from");
        node.source = this.type === tt.string ? this.parseExprAtom() : this.unexpected();
      }
      if (this.type === this.assertToken || this.type == tt._with) {
        this.next();
        const assertions = this.parseImportAssertions();
        if (assertions) {
          node.assertions = assertions;
        }
      }
      this.semicolon();
      return this.finishNode(node, "ImportDeclaration");
    }
    parseImportAssertions() {
      this._eat(tt.braceL);
      const attrs = this.parseAssertEntries();
      this._eat(tt.braceR);
      return attrs;
    }
    parseAssertEntries() {
      const attrs = [];
      const attrNames = new Set();
      do {
        if (this.type === tt.braceR) {
          break;
        }
        const node = this.startNode();

        // parse AssertionKey : IdentifierName, StringLiteral
        let assertionKeyNode;
        if (this.type === tt.string) {
          assertionKeyNode = this.parseLiteral(this.value);
        } else {
          assertionKeyNode = this.parseIdent(true);
        }
        this.next();
        node.key = assertionKeyNode;

        // check if we already have an entry for an attribute
        // if a duplicate entry is found, throw an error
        // for now this logic will come into play only when someone declares `type` twice
        if (attrNames.has(node.key.name)) {
          this.raise(this.pos, "Duplicated key in assertions");
        }
        attrNames.add(node.key.name);
        if (this.type !== tt.string) {
          this.raise(this.pos, "Only string is supported as an assertion value");
        }
        node.value = this.parseLiteral(this.value);
        attrs.push(this.finishNode(node, "ImportAttribute"));
      } while (this.eat(tt.comma));
      return attrs;
    }
  };
}