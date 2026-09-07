package main

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"
)

// HandlerInfo summarizes what a controller function reads/writes — used by
// the manifest layer to enrich operations with typed body, query params, and
// response shape inferred from controller source.
//
// Body and response can be expressed either as a named type ($ref) or as an
// inline schema (for anonymous struct bodies, gin.H responses, etc.).
type HandlerInfo struct {
	Name        string
	BodyType    string                 // model/dto type name → $ref
	BodySchema  map[string]interface{} // inline schema (when struct is anonymous)
	QueryParams []QueryParam
	RespType    string                 // single named model type
	RespSchema  map[string]interface{} // inline schema for gin.H{...} responses
	RespStatus  int
	RespIsList  bool
	RespIsPaged bool
	ErrorCodes  []ErrorCode // populated by analyzeErrorCalls — see enrichErrorResponses
}

type QueryParam struct {
	Name string
	Type string // "string" | "integer" | "boolean" | "number"
}

// ErrorCode — extracted (HTTP status, machine-readable code) pair from a
// `common.ApiError*StatusCode` call inside a handler body. Status comes from
// the http.StatusXxx selector; Code is the string literal third argument.
type ErrorCode struct {
	Status int    // 400, 404, 500, ...
	Code   string // "user_not_found", "invalid_params", ...
}

// httpStatusMap resolves `http.StatusXxx` selectors to integer codes during
// AST inspection. Covers all status codes the migrated handlers currently
// emit (waves 1–7). Extend when a new status is introduced in handlers.
var httpStatusMap = map[string]int{
	"StatusOK":                  200,
	"StatusCreated":             201,
	"StatusAccepted":            202,
	"StatusNoContent":           204,
	"StatusBadRequest":          400,
	"StatusUnauthorized":        401,
	"StatusForbidden":           403,
	"StatusNotFound":            404,
	"StatusMethodNotAllowed":    405,
	"StatusConflict":            409,
	"StatusGone":                410,
	"StatusUnprocessableEntity": 422,
	"StatusTooManyRequests":     429,
	"StatusInternalServerError": 500,
	"StatusNotImplemented":      501,
	"StatusBadGateway":          502,
	"StatusServiceUnavailable":  503,
	"StatusGatewayTimeout":      504,
}

// errorHelperNames — Set of common.ApiError*StatusCode helpers analyzeErrorCall
// recognizes. All have the same signature: (c, http.StatusXxx, codeString, ...).
var errorHelperNames = map[string]struct{}{
	"ApiErrorStatusCode":     {},
	"ApiErrorMsgStatusCode":  {},
	"ApiErrorI18nStatusCode": {},
}

// Global tables populated by parseControllers + parseModels.
var (
	handlers         = map[string]*HandlerInfo{}
	funcReturn       = map[string]string{} // function name → primary returned Go type (best-effort)
	handlerSummaries = map[string]string{} // handler name → godoc-extracted summary (typically zh)
)

// parseControllers runs a two-pass scan: first registers all declarations
// (types, methods, function return types) so that handler-body inference has
// the full symbol table; second analyzes Gin handler bodies.
func parseControllers(dir string) error {
	fset := token.NewFileSet()
	files, err := filepath.Glob(filepath.Join(dir, "*.go"))
	if err != nil {
		return err
	}
	parsedFiles := make([]*ast.File, 0, len(files))
	for _, path := range files {
		if strings.HasSuffix(path, "_test.go") {
			continue
		}
		f, err := parser.ParseFile(fset, path, nil, parser.SkipObjectResolution)
		if err != nil {
			fmt.Fprintf(os.Stderr, "warn: parse %s: %v\n", path, err)
			continue
		}
		parsedFiles = append(parsedFiles, f)
	}

	// Pass 1: declarations only (types, methods, plain functions).
	for _, f := range parsedFiles {
		for _, decl := range f.Decls {
			switch d := decl.(type) {
			case *ast.GenDecl:
				if d.Tok != token.TYPE {
					continue
				}
				for _, spec := range d.Specs {
					ts, ok := spec.(*ast.TypeSpec)
					if !ok {
						continue
					}
					if st, ok := ts.Type.(*ast.StructType); ok {
						if _, exists := modelTypes[ts.Name.Name]; !exists {
							modelTypes[ts.Name.Name] = st
						}
						recordStructFields(ts.Name.Name, st)
					}
				}
			case *ast.FuncDecl:
				if d.Body == nil {
					continue
				}
				if d.Recv != nil {
					if recv := receiverTypeName(d.Recv); recv != "" && d.Type.Results != nil && len(d.Type.Results.List) > 0 {
						recordMethod(recv, d.Name.Name, goTypeOf(d.Type.Results.List[0].Type))
					}
					continue
				}
				recordFuncReturn(d)
				// godoc summary: first comment line of the form
				// `// HandlerName 描述` becomes the operation summary (zh source).
				// en/ru pull from translations["summary."+HandlerName]; this is
				// the fallback if no manual translation exists.
				if d.Doc != nil && len(d.Doc.List) > 0 {
					if s := trimGodocPrefix(d.Doc.List[0].Text, d.Name.Name); s != "" {
						handlerSummaries[d.Name.Name] = s
					}
				}
			}
		}
	}

	// Pass 2: handler analysis with fully-populated symbol tables.
	for _, f := range parsedFiles {
		for _, decl := range f.Decls {
			fn, ok := decl.(*ast.FuncDecl)
			if !ok || fn.Body == nil || fn.Recv != nil {
				continue
			}
			if !isExported(fn.Name.Name) || !looksLikeHandler(fn) {
				continue
			}
			handlers[fn.Name.Name] = analyzeHandler(fn)
		}
	}
	return nil
}

// recordFuncReturn extracts the primary returned type name from a function's
// signature so callers like `common.ApiSuccess(c, GetX())` can be resolved
// to the proper Go type.
func recordFuncReturn(fn *ast.FuncDecl) {
	if fn.Type.Results == nil || len(fn.Type.Results.List) == 0 {
		return
	}
	first := fn.Type.Results.List[0].Type
	t := goTypeOf(first)
	if t == "" {
		return
	}
	if _, exists := funcReturn[fn.Name.Name]; !exists {
		funcReturn[fn.Name.Name] = t
	}
}

func isExported(name string) bool {
	return name != "" && name[0] >= 'A' && name[0] <= 'Z'
}

func looksLikeHandler(fn *ast.FuncDecl) bool {
	if fn.Type.Params == nil || len(fn.Type.Params.List) != 1 {
		return false
	}
	p := fn.Type.Params.List[0]
	star, ok := p.Type.(*ast.StarExpr)
	if !ok {
		return false
	}
	sel, ok := star.X.(*ast.SelectorExpr)
	if !ok {
		return false
	}
	pkg, _ := sel.X.(*ast.Ident)
	return pkg != nil && pkg.Name == "gin" && sel.Sel.Name == "Context"
}

// localVar captures both the resolved type name and the raw AST type node so
// callers can inline-build schemas for anonymous structs etc.
type localVar struct {
	TypeName string   // e.g. "Token", "PageInfo", or "" for anonymous
	TypeExpr ast.Expr // the underlying ast.Expr if known (struct/slice/map)
	Init     ast.Expr // RHS expression at declaration (for recursion into gin.H literals etc.)
}

func analyzeHandler(fn *ast.FuncDecl) *HandlerInfo {
	info := &HandlerInfo{Name: fn.Name.Name}

	locals := collectLocals(fn.Body)
	seen := map[ErrorCode]struct{}{}

	ast.Inspect(fn.Body, func(n ast.Node) bool {
		call, ok := n.(*ast.CallExpr)
		if !ok {
			return true
		}
		analyzeCall(call, locals, info)
		if ec := analyzeErrorCall(call); ec != nil {
			if _, dup := seen[*ec]; !dup {
				seen[*ec] = struct{}{}
				info.ErrorCodes = append(info.ErrorCodes, *ec)
			}
		}
		return true
	})

	return info
}

// analyzeErrorCall recognizes calls to the common.ApiError*StatusCode helpers
// and extracts (status, code) tuples. Returns nil when the call shape doesn't
// match (different package, different fn name, non-literal args, etc.).
//
// Expected shapes:
//
//	common.ApiErrorStatusCode(c, http.StatusXxx, "code", err)
//	common.ApiErrorMsgStatusCode(c, http.StatusXxx, "code", msg)
//	common.ApiErrorI18nStatusCode(c, http.StatusXxx, "code", i18nKey, ...)
//
// AST shape: CallExpr{Fun: SelectorExpr{X:Ident("common"), Sel:Ident("ApiErrorI18nStatusCode")}}.
// Args[1] is http.StatusXxx (SelectorExpr), Args[2] is the code BasicLit.
func analyzeErrorCall(call *ast.CallExpr) *ErrorCode {
	sel, ok := call.Fun.(*ast.SelectorExpr)
	if !ok {
		return nil
	}
	pkg, _ := sel.X.(*ast.Ident)
	if pkg == nil || pkg.Name != "common" {
		return nil
	}
	if _, recognized := errorHelperNames[sel.Sel.Name]; !recognized {
		return nil
	}
	if len(call.Args) < 3 {
		return nil
	}
	// arg[1]: http.StatusXxx
	statusSel, ok := call.Args[1].(*ast.SelectorExpr)
	if !ok {
		return nil
	}
	pkgIdent, _ := statusSel.X.(*ast.Ident)
	if pkgIdent == nil || pkgIdent.Name != "http" {
		return nil
	}
	status, ok := httpStatusMap[statusSel.Sel.Name]
	if !ok {
		return nil
	}
	// arg[2]: "code" string literal
	codeLit, ok := call.Args[2].(*ast.BasicLit)
	if !ok || codeLit.Kind != token.STRING {
		return nil
	}
	code := strings.Trim(codeLit.Value, "`\"")
	if code == "" {
		return nil
	}
	return &ErrorCode{Status: status, Code: code}
}

// collectLocals scans top-level var decls and `:=` assignments inside the
// function body. Both `var x T` and `x := T{}` are tracked. Nested scopes
// (inside if/for) are also walked because Go's lexical scoping doesn't
// matter for our purposes — controllers rarely shadow request vars.
func collectLocals(body *ast.BlockStmt) map[string]localVar {
	out := map[string]localVar{}
	ast.Inspect(body, func(n ast.Node) bool {
		switch s := n.(type) {
		case *ast.AssignStmt:
			if s.Tok != token.DEFINE {
				return true
			}
			// Multi-LHS, single RHS: `value, err := fn()` → first LHS gets
			// type of first return value of fn.
			if len(s.Lhs) >= 1 && len(s.Rhs) == 1 {
				if id, ok := s.Lhs[0].(*ast.Ident); ok && id.Name != "_" {
					out[id.Name] = inferLocal(s.Rhs[0])
				}
				return true
			}
			// Parallel LHS = parallel RHS — each ident gets its corresponding
			// expression's type.
			if len(s.Lhs) == len(s.Rhs) {
				for i, l := range s.Lhs {
					id, ok := l.(*ast.Ident)
					if !ok || id.Name == "_" {
						continue
					}
					out[id.Name] = inferLocal(s.Rhs[i])
				}
				return true
			}
		case *ast.DeclStmt:
			gen, _ := s.Decl.(*ast.GenDecl)
			if gen == nil || gen.Tok != token.VAR {
				return true
			}
			for _, spec := range gen.Specs {
				vs, _ := spec.(*ast.ValueSpec)
				if vs == nil {
					continue
				}
				if vs.Type != nil {
					name := goTypeOf(vs.Type)
					for _, n := range vs.Names {
						out[n.Name] = localVar{TypeName: name, TypeExpr: vs.Type}
					}
				} else if len(vs.Values) == len(vs.Names) {
					for i, n := range vs.Names {
						out[n.Name] = inferLocal(vs.Values[i])
					}
				}
			}
		}
		return true
	})
	return out
}

func inferLocal(expr ast.Expr) localVar {
	t := goTypeOf(expr)
	switch v := expr.(type) {
	case *ast.CompositeLit:
		return localVar{TypeName: t, TypeExpr: v.Type, Init: v}
	case *ast.UnaryExpr:
		inner := inferLocal(v.X)
		inner.Init = v
		return inner
	case *ast.CallExpr:
		if name := callFuncName(v); name != "" {
			if r, ok := funcReturn[name]; ok && r != "" {
				return localVar{TypeName: r, Init: v}
			}
		}
		return localVar{TypeName: t, Init: v}
	}
	return localVar{TypeName: t, Init: expr}
}

func callFuncName(call *ast.CallExpr) string {
	switch f := call.Fun.(type) {
	case *ast.Ident:
		return f.Name
	case *ast.SelectorExpr:
		return f.Sel.Name
	}
	return ""
}

// goTypeOf renders a Go expression's static type as a string we can match
// against — strips `&`, package selectors, pointer/array wrappers.
func goTypeOf(expr ast.Expr) string {
	switch t := expr.(type) {
	case *ast.UnaryExpr:
		if t.Op == token.NOT {
			return "bool"
		}
		return goTypeOf(t.X)
	case *ast.CompositeLit:
		return goTypeOf(t.Type)
	case *ast.Ident:
		switch t.Name {
		case "true", "false":
			return "bool"
		case "nil":
			return ""
		}
		return t.Name
	case *ast.SelectorExpr:
		return t.Sel.Name
	case *ast.StarExpr:
		return goTypeOf(t.X)
	case *ast.ArrayType:
		return goTypeOf(t.Elt)
	case *ast.BasicLit:
		switch t.Kind {
		case token.INT:
			return "int"
		case token.FLOAT:
			return "float64"
		case token.STRING:
			return "string"
		case token.CHAR:
			return "rune"
		}
	case *ast.CallExpr:
		// Type conversion: int("..."), bool(x), string(x), float64(...)
		if id, ok := t.Fun.(*ast.Ident); ok {
			switch id.Name {
			case "int", "int8", "int16", "int32", "int64", "uint", "uint8", "uint16", "uint32", "uint64":
				return "int"
			case "float32", "float64":
				return "float64"
			case "string":
				return "string"
			case "bool":
				return "bool"
			case "len", "cap":
				return "int"
			}
		}
		if name := callFuncName(t); name != "" {
			if r, ok := funcReturn[name]; ok {
				return r
			}
			if guess := guessFromFnName(name); guess != "" {
				return guess
			}
		}
	case *ast.BinaryExpr:
		switch t.Op {
		case token.EQL, token.NEQ, token.LSS, token.LEQ, token.GTR, token.GEQ,
			token.LAND, token.LOR:
			return "bool"
		case token.ADD, token.SUB, token.MUL, token.QUO, token.REM:
			if l := goTypeOf(t.X); l != "" {
				return l
			}
			return goTypeOf(t.Y)
		}
	}
	return ""
}

// analyzeCall inspects a single call expression and updates HandlerInfo.
func analyzeCall(call *ast.CallExpr, locals map[string]localVar, info *HandlerInfo) {
	sel, ok := call.Fun.(*ast.SelectorExpr)
	if !ok {
		return
	}
	recv, _ := sel.X.(*ast.Ident)
	method := sel.Sel.Name

	switch {
	case recv != nil && recv.Name == "c" && (method == "Query" || method == "DefaultQuery"):
		if name := stringArg(call, 0); name != "" {
			info.QueryParams = appendUniqueParam(info.QueryParams, QueryParam{Name: name, Type: queryTypeFor(name)})
		}
	case recv != nil && recv.Name == "c" && (method == "ShouldBindJSON" || method == "BindJSON" || method == "ShouldBindBodyWithJSON"):
		captureBody(call, 0, locals, info)
	case method == "Decode" && isRequestBodyDecoder(sel.X):
		// Only treat json.NewDecoder(...).Decode(&X) as a body capture when the
		// decoder was created from c.Request.Body. Decoders fed from upstream
		// HTTP response bodies (response.Body, resp.Body, ...) are NOT request
		// bodies — they shape upstream data, not our endpoint contract.
		captureBody(call, 0, locals, info)
	case recv != nil && recv.Name == "common" && method == "DecodeJson":
		// common.DecodeJson(reader, &X) — only count when reader is request body.
		if len(call.Args) >= 1 && isRequestBodyExpr(call.Args[0]) {
			captureBody(call, 1, locals, info)
		}
	case recv != nil && recv.Name == "common" && method == "GetPageQuery":
		info.QueryParams = appendUniqueParam(info.QueryParams, QueryParam{Name: "p", Type: "integer"})
		info.QueryParams = appendUniqueParam(info.QueryParams, QueryParam{Name: "page_size", Type: "integer"})
	case recv != nil && recv.Name == "common" && (method == "ApiSuccess" || method == "ApiSuccessI18n" || method == "ApiSuccessStatus"):
		idx := 1
		if method == "ApiSuccessI18n" || method == "ApiSuccessStatus" {
			idx = 2
		}
		if method == "ApiSuccessStatus" && len(call.Args) > 1 {
			if status, ok := call.Args[1].(*ast.SelectorExpr); ok {
				info.RespStatus = httpStatusMap[status.Sel.Name]
			}
		}
		if len(call.Args) > idx {
			analyzeResponseValue(call.Args[idx], locals, info)
		}
	case recv != nil && recv.Name == "c" && method == "JSON":
		if len(call.Args) >= 2 {
			if status, ok := call.Args[0].(*ast.SelectorExpr); ok && httpStatusMap[status.Sel.Name] >= 200 && httpStatusMap[status.Sel.Name] < 300 {
				analyzeJSONResponse(call.Args[1], locals, info)
			}
		}
	}
}

// isRequestBodyDecoder returns true when expr is a `json.NewDecoder(c.Request.Body)`
// call expression. Used to distinguish request-body parsing from upstream
// HTTP response parsing — both use Decoder.Decode(&X), but only the former
// describes our endpoint's contract.
func isRequestBodyDecoder(expr ast.Expr) bool {
	call, ok := expr.(*ast.CallExpr)
	if !ok {
		return false
	}
	sel, ok := call.Fun.(*ast.SelectorExpr)
	if !ok {
		return false
	}
	if sel.Sel.Name != "NewDecoder" {
		return false
	}
	pkg, _ := sel.X.(*ast.Ident)
	if pkg == nil || pkg.Name != "json" {
		return false
	}
	if len(call.Args) == 0 {
		return false
	}
	return isRequestBodyExpr(call.Args[0])
}

// isRequestBodyExpr returns true when expr accesses c.Request.Body — the only
// reader that holds the inbound HTTP request payload in a Gin handler.
func isRequestBodyExpr(expr ast.Expr) bool {
	sel, ok := expr.(*ast.SelectorExpr)
	if !ok {
		return false
	}
	if sel.Sel.Name != "Body" {
		return false
	}
	inner, ok := sel.X.(*ast.SelectorExpr)
	if !ok {
		return false
	}
	if inner.Sel.Name != "Request" {
		return false
	}
	id, ok := inner.X.(*ast.Ident)
	if !ok {
		return false
	}
	return id.Name == "c"
}

// captureBody finds the body type at args[idx] of a `&body` expression.
// If body var is anonymous struct → inline schema. If named → BodyType ref.
func captureBody(call *ast.CallExpr, idx int, locals map[string]localVar, info *HandlerInfo) {
	if idx >= len(call.Args) {
		return
	}
	arg := call.Args[idx]
	un, _ := arg.(*ast.UnaryExpr)
	target := arg
	if un != nil {
		target = un.X
	}
	switch x := target.(type) {
	case *ast.Ident:
		lv, ok := locals[x.Name]
		if !ok {
			return
		}
		if isKnownModel(lv.TypeName) {
			info.BodyType = lv.TypeName
			return
		}
		if st, ok := lv.TypeExpr.(*ast.StructType); ok {
			info.BodySchema = structToSchema(st)
		}
	case *ast.CompositeLit:
		if st, ok := x.Type.(*ast.StructType); ok {
			info.BodySchema = structToSchema(st)
		} else if t := goTypeOf(x); isKnownModel(t) {
			info.BodyType = t
		}
	}
}

// analyzeResponseValue handles `common.ApiSuccess(c, X)` where X may be a
// named local, a struct literal, gin.H, or a function call.
func analyzeResponseValue(arg ast.Expr, locals map[string]localVar, info *HandlerInfo) {
	switch v := arg.(type) {
	case *ast.Ident:
		lv, ok := locals[v.Name]
		if !ok {
			return
		}
		switch lv.TypeName {
		case "PageInfo":
			info.RespIsPaged = true
		default:
			if isKnownModel(lv.TypeName) {
				info.RespType = lv.TypeName
			}
		}
	case *ast.CompositeLit:
		if isGinH(v) {
			info.RespSchema = map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"success": map[string]interface{}{"type": "boolean"},
					"message": map[string]interface{}{"type": "string"},
					"data":    ginHSchema(v, locals),
				},
			}
			return
		}
		if t := goTypeOf(v.Type); isKnownModel(t) {
			info.RespType = t
		}
	case *ast.CallExpr:
		name := callFuncName(v)
		if r, ok := funcReturn[name]; ok && isKnownModel(r) {
			info.RespType = r
			return
		}
		if t := guessFromFnName(name); isKnownModel(t) {
			info.RespType = t
		}
	}
}

// analyzeJSONResponse handles `c.JSON(status, body)` where body is typically
// a gin.H{...}. Wraps shape inference into a full {success,message,data} envelope.
func analyzeJSONResponse(arg ast.Expr, locals map[string]localVar, info *HandlerInfo) {
	cl, ok := arg.(*ast.CompositeLit)
	if !ok || !isGinH(cl) {
		return
	}
	props := map[string]interface{}{}
	for _, elt := range cl.Elts {
		kv, ok := elt.(*ast.KeyValueExpr)
		if !ok {
			continue
		}
		key := stringLit(kv.Key)
		if key == "" {
			continue
		}
		props[key] = inferValueSchema(kv.Value, locals)
	}
	if len(props) == 0 {
		return
	}
	// Ensure success/message are typed even if not literal-set.
	if _, ok := props["success"]; !ok {
		props["success"] = map[string]interface{}{"type": "boolean"}
	}
	if _, ok := props["message"]; !ok {
		props["message"] = map[string]interface{}{"type": "string"}
	}
	info.RespSchema = map[string]interface{}{
		"type":       "object",
		"properties": props,
	}
}

// ginHSchema converts a gin.H{...} composite literal into an inline schema.
// Keys become property names. Values get type-inferred recursively.
func ginHSchema(cl *ast.CompositeLit, locals map[string]localVar) map[string]interface{} {
	props := map[string]interface{}{}
	for _, elt := range cl.Elts {
		kv, ok := elt.(*ast.KeyValueExpr)
		if !ok {
			continue
		}
		k := stringLit(kv.Key)
		if k == "" {
			continue
		}
		props[k] = inferValueSchema(kv.Value, locals)
	}
	return map[string]interface{}{
		"type":       "object",
		"properties": props,
	}
}

// inferValueSchema produces an OpenAPI schema fragment for a Go expression
// used as a response value. Best-effort — falls back to opaque {} when type
// can't be determined.
func inferValueSchema(expr ast.Expr, locals map[string]localVar) map[string]interface{} {
	switch v := expr.(type) {
	case *ast.ArrayType:
		return map[string]interface{}{"type": "array", "items": refOrPrimitive(goTypeOf(v.Elt))}
	case *ast.BasicLit:
		switch v.Kind {
		case token.STRING:
			return map[string]interface{}{"type": "string"}
		case token.INT:
			return map[string]interface{}{"type": "integer"}
		case token.FLOAT:
			return map[string]interface{}{"type": "number"}
		}
	case *ast.Ident:
		if v.Name == "true" || v.Name == "false" {
			return map[string]interface{}{"type": "boolean"}
		}
		if v.Name == "nil" {
			return map[string]interface{}{}
		}
		if lv, ok := locals[v.Name]; ok {
			// If we have a recorded init expression (e.g. `data := gin.H{...}`),
			// recurse into it for richer schema. Avoid infinite loop by not
			// recursing on bare Ident (which would loop on itself).
			if lv.Init != nil {
				if _, isIdent := lv.Init.(*ast.Ident); !isIdent {
					if s := inferValueSchema(lv.Init, locals); len(s) > 0 {
						return s
					}
				}
			}
			return refOrPrimitive(lv.TypeName)
		}
	case *ast.UnaryExpr:
		return inferValueSchema(v.X, locals)
	case *ast.CompositeLit:
		if isGinH(v) {
			return ginHSchema(v, locals)
		}
		if t := goTypeOf(v.Type); isKnownModel(t) {
			referencedTypes[t] = true
			if _, isArr := v.Type.(*ast.ArrayType); isArr {
				return map[string]interface{}{
					"type":  "array",
					"items": map[string]interface{}{"$ref": "#/components/schemas/" + t},
				}
			}
			return map[string]interface{}{"$ref": "#/components/schemas/" + t}
		}
		// Slice/map literals without known element type → opaque
		if _, isArr := v.Type.(*ast.ArrayType); isArr {
			return map[string]interface{}{"type": "array", "items": map[string]interface{}{}}
		}
	case *ast.CallExpr:
		// Builtins: len/cap → integer; type conversions int(x)/string(x)/bool(x).
		if id, ok := v.Fun.(*ast.Ident); ok {
			switch id.Name {
			case "len", "cap", "int", "int32", "int64", "uint", "uint32", "uint64":
				return map[string]interface{}{"type": "integer"}
			case "float32", "float64":
				return map[string]interface{}{"type": "number"}
			case "string":
				return map[string]interface{}{"type": "string"}
			case "bool":
				return map[string]interface{}{"type": "boolean"}
			case "make", "new", "append":
				if len(v.Args) >= 1 {
					return inferValueSchema(v.Args[0], locals)
				}
			}
		}
		// Method call: `token.GetFullKey()` → look up Token.GetFullKey return.
		if sel, ok := v.Fun.(*ast.SelectorExpr); ok {
			if recv, ok := sel.X.(*ast.Ident); ok {
				if lv, ok := locals[recv.Name]; ok {
					if mr, ok := methodReturn[lv.TypeName][sel.Sel.Name]; ok && mr != "" {
						return refOrPrimitive(mr)
					}
				}
			}
		}
		// Plain call: `GetX()` or `pkg.GetX()` → look up funcReturn or guess.
		name := callFuncName(v)
		if r, ok := funcReturn[name]; ok {
			return refOrPrimitive(r)
		}
		if g := guessFromFnName(name); g != "" && isKnownModel(g) {
			referencedTypes[g] = true
			return map[string]interface{}{"$ref": "#/components/schemas/" + g}
		}
	case *ast.SelectorExpr:
		// Field access: `token.RemainQuota` (local) or `common.Version` (package var).
		if recv, ok := v.X.(*ast.Ident); ok {
			if lv, ok := locals[recv.Name]; ok {
				if expr, ok := fieldTypes[lv.TypeName][v.Sel.Name]; ok {
					return exprToSchema(expr)
				}
			}
			if pv, ok := packageVars[recv.Name]; ok {
				if entry, ok := pv[v.Sel.Name]; ok {
					if entry.Expr != nil {
						if s := exprToSchema(entry.Expr); len(s) > 0 {
							return s
						}
					}
					return refOrPrimitive(entry.Name)
				}
			}
		}
		// Method-chain field access: `system_setting.GetDiscordSettings().Enabled`
		// → resolve call's return type, then look up field on that type.
		if call, ok := v.X.(*ast.CallExpr); ok {
			retType := ""
			if name := callFuncName(call); name != "" {
				if r, ok := funcReturn[name]; ok {
					retType = r
				}
			}
			if retType != "" {
				if expr, ok := fieldTypes[retType][v.Sel.Name]; ok {
					return exprToSchema(expr)
				}
			}
		}
	case *ast.BinaryExpr:
		switch v.Op {
		case token.EQL, token.NEQ, token.LSS, token.LEQ, token.GTR, token.GEQ,
			token.LAND, token.LOR:
			return map[string]interface{}{"type": "boolean"}
		}
		left := inferValueSchema(v.X, locals)
		right := inferValueSchema(v.Y, locals)
		if left["type"] == "number" || right["type"] == "number" {
			return map[string]interface{}{"type": "number"}
		}
		if left["type"] == "integer" || right["type"] == "integer" {
			return map[string]interface{}{"type": "integer"}
		}
	case *ast.IndexExpr:
		// Slice/map index — opaque.
	case *ast.SliceExpr:
	}
	return map[string]interface{}{}
}

func refOrPrimitive(typeName string) map[string]interface{} {
	switch typeName {
	case "string":
		return map[string]interface{}{"type": "string"}
	case "int", "int64", "int32", "uint", "uint64", "uint32":
		return map[string]interface{}{"type": "integer"}
	case "float32", "float64":
		return map[string]interface{}{"type": "number"}
	case "bool":
		return map[string]interface{}{"type": "boolean"}
	}
	if isKnownModel(typeName) {
		referencedTypes[typeName] = true
		return map[string]interface{}{"$ref": "#/components/schemas/" + typeName}
	}
	return map[string]interface{}{}
}

func stringLit(expr ast.Expr) string {
	bl, ok := expr.(*ast.BasicLit)
	if !ok || bl.Kind != token.STRING {
		return ""
	}
	return strings.Trim(bl.Value, "\"`")
}

func stringArg(call *ast.CallExpr, i int) string {
	if i >= len(call.Args) {
		return ""
	}
	return stringLit(call.Args[i])
}

func isGinH(cl *ast.CompositeLit) bool {
	sel, ok := cl.Type.(*ast.SelectorExpr)
	if !ok {
		return false
	}
	pkg, _ := sel.X.(*ast.Ident)
	return pkg != nil && pkg.Name == "gin" && sel.Sel.Name == "H"
}

func guessFromFnName(name string) string {
	knownTypes := []string{
		"User", "Channel", "Token", "Log", "Redemption", "TopUp", "Task",
		"Midjourney", "Model", "Vendor", "PrefillGroup", "Option",
		"SubscriptionPlan", "UserSubscription", "CustomOAuthProvider", "PerfMetric",
		"Pricing",
	}
	for _, t := range knownTypes {
		if strings.Contains(name, t) {
			return t
		}
	}
	return ""
}

func isKnownModel(name string) bool {
	if name == "" {
		return false
	}
	_, ok := modelTypes[name]
	return ok
}

func queryTypeFor(name string) string {
	switch {
	case strings.HasSuffix(name, "_timestamp"),
		strings.HasSuffix(name, "_time"),
		strings.HasSuffix(name, "_at"),
		name == "p", name == "page", name == "page_size",
		name == "ps", name == "size", name == "limit", name == "offset",
		name == "user_id", name == "channel_id", name == "token_id",
		name == "id", name == "type", name == "status":
		return "integer"
	case strings.HasSuffix(name, "_enabled"), strings.HasSuffix(name, "_disabled"):
		return "boolean"
	}
	return "string"
}

func appendUniqueParam(list []QueryParam, p QueryParam) []QueryParam {
	for _, x := range list {
		if x.Name == p.Name {
			return list
		}
	}
	return append(list, p)
}
