package main

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"
)

// RouteEntry binds an HTTP route to its controller handler so we can join
// router declarations with handler analysis.
type RouteEntry struct {
	Method      string // "GET", "POST", ...
	Path        string // resolved full path with {param}-style placeholders
	HandlerName string // bare function name as referenced in router (e.g. "UpdateUser")
}

var routes []RouteEntry

func dedupeRoutes() {
	seen := map[string]bool{}
	out := routes[:0]
	for _, r := range routes {
		k := r.Method + " " + r.Path
		if seen[k] {
			continue
		}
		seen[k] = true
		out = append(out, r)
	}
	routes = out
}

// permissionTableBase maps a []permissionRoute table var name to the group
// prefix it is mounted under (resolved from `for _, route := range table {
// group.Handle(...) }` loops).
var permissionTableBase = map[string]string{}

func parseRoutes(dir string) error {
	fset := token.NewFileSet()
	files, err := filepath.Glob(filepath.Join(dir, "*.go"))
	if err != nil {
		return err
	}
	parsed := []*ast.File{}
	for _, path := range files {
		if strings.HasSuffix(path, "_test.go") {
			continue
		}
		f, err := parser.ParseFile(fset, path, nil, parser.SkipObjectResolution)
		if err != nil {
			continue
		}
		parsed = append(parsed, f)
	}
	// Pass 1: functions — direct .GET/.POST routes + table→prefix bindings.
	for _, f := range parsed {
		for _, decl := range f.Decls {
			fn, ok := decl.(*ast.FuncDecl)
			if !ok || fn.Body == nil {
				continue
			}
			processRouterFunc(fn)
		}
	}
	// Pass 2: package-level []permissionRoute tables, mounted per pass 1.
	for _, f := range parsed {
		for _, decl := range f.Decls {
			gd, ok := decl.(*ast.GenDecl)
			if !ok || gd.Tok != token.VAR {
				continue
			}
			for _, spec := range gd.Specs {
				vs, ok := spec.(*ast.ValueSpec)
				if !ok {
					continue
				}
				processPermissionTable(vs)
			}
		}
	}
	return nil
}

// processPermissionTable emits routes from a
// `var xRoutes = []permissionRoute{{method: http.MethodGet, path: "/", handler: controller.X}, ...}`
// declaration, provided pass 1 resolved its mount prefix.
func processPermissionTable(vs *ast.ValueSpec) {
	for i, name := range vs.Names {
		base, mounted := permissionTableBase[name.Name]
		if !mounted || i >= len(vs.Values) {
			continue
		}
		cl, ok := vs.Values[i].(*ast.CompositeLit)
		if !ok {
			continue
		}
		for _, elt := range cl.Elts {
			entry, ok := elt.(*ast.CompositeLit)
			if !ok {
				continue
			}
			var method, path, handler string
			for _, field := range entry.Elts {
				kv, ok := field.(*ast.KeyValueExpr)
				if !ok {
					continue
				}
				key, _ := kv.Key.(*ast.Ident)
				if key == nil {
					continue
				}
				switch key.Name {
				case "method":
					if sel, ok := kv.Value.(*ast.SelectorExpr); ok {
						// http.MethodGet → GET
						method = strings.ToUpper(strings.TrimPrefix(sel.Sel.Name, "Method"))
					}
				case "path":
					if bl, ok := kv.Value.(*ast.BasicLit); ok && bl.Kind == token.STRING {
						path = strings.Trim(bl.Value, "\"`")
					}
				case "handler":
					if sel, ok := kv.Value.(*ast.SelectorExpr); ok {
						if pkg, ok := sel.X.(*ast.Ident); ok && pkg.Name == "controller" {
							handler = sel.Sel.Name
						}
					}
				}
			}
			if method == "" || path == "" || !isGinMethod(method) {
				continue
			}
			routes = append(routes, RouteEntry{
				Method:      method,
				Path:        joinRoutePath(base, path),
				HandlerName: handler,
			})
		}
	}
}

// joinRoutePath joins a group prefix and a route suffix, normalizing slashes
// and converting :param segments to {param} placeholders.
func joinRoutePath(base, suffix string) string {
	b := strings.TrimRight(base, "/")
	s := suffix
	if !strings.HasPrefix(s, "/") {
		s = "/" + s
	}
	full := strings.ReplaceAll(b+s, "//", "/")
	if full == "" {
		full = "/"
	}
	segs := strings.Split(full, "/")
	for i, seg := range segs {
		if strings.HasPrefix(seg, ":") {
			segs[i] = "{" + seg[1:] + "}"
		}
	}
	return strings.Join(segs, "/")
}

// processRouterFunc walks a Set*Router function body, tracks group prefixes
// in scope, and records every .GET/.POST/... call.
func processRouterFunc(fn *ast.FuncDecl) {
	groups := map[string]string{}
	// Identify the gin engine parameter — its prefix is "".
	if fn.Type.Params != nil {
		for _, p := range fn.Type.Params.List {
			star, _ := p.Type.(*ast.StarExpr)
			if star == nil {
				continue
			}
			sel, _ := star.X.(*ast.SelectorExpr)
			if sel == nil {
				continue
			}
			switch sel.Sel.Name {
			case "Engine":
				for _, name := range p.Names {
					groups[name.Name] = ""
				}
			case "RouterGroup":
				// register*(apiRouter *gin.RouterGroup) helpers extracted from
				// SetApiRouter. Convention: a group param named apiRouter is
				// mounted at /api (single call site in api-router.go).
				for _, name := range p.Names {
					if name.Name == "apiRouter" {
						groups[name.Name] = "/api"
					}
				}
			}
		}
	}

	// Multi-pass to resolve nested group declarations.
	for pass := 0; pass < 6; pass++ {
		ast.Inspect(fn.Body, func(n ast.Node) bool {
			as, ok := n.(*ast.AssignStmt)
			if !ok || as.Tok != token.DEFINE || len(as.Lhs) != 1 || len(as.Rhs) != 1 {
				return true
			}
			lhs, _ := as.Lhs[0].(*ast.Ident)
			call, _ := as.Rhs[0].(*ast.CallExpr)
			if lhs == nil || call == nil {
				return true
			}
			sel, _ := call.Fun.(*ast.SelectorExpr)
			if sel == nil || sel.Sel.Name != "Group" {
				return true
			}
			parent, _ := sel.X.(*ast.Ident)
			if parent == nil {
				return true
			}
			if _, has := groups[parent.Name]; !has {
				return true
			}
			arg := stringArgRoutes(call, 0)
			if arg == "" {
				return true
			}
			base := strings.TrimRight(groups[parent.Name], "/")
			suffix := arg
			if !strings.HasPrefix(suffix, "/") {
				suffix = "/" + suffix
			}
			full := base + suffix
			full = strings.ReplaceAll(full, "//", "/")
			full = strings.TrimRight(full, "/")
			if full == "" {
				full = "/"
			}
			groups[lhs.Name] = full
			return true
		})
	}

	// Bind permission tables to their mount prefix:
	// for _, route := range xRoutes { group.Handle(route.method, route.path, ...) }
	ast.Inspect(fn.Body, func(n ast.Node) bool {
		rs, ok := n.(*ast.RangeStmt)
		if !ok {
			return true
		}
		table, _ := rs.X.(*ast.Ident)
		if table == nil {
			return true
		}
		ast.Inspect(rs.Body, func(inner ast.Node) bool {
			call, ok := inner.(*ast.CallExpr)
			if !ok {
				return true
			}
			sel, _ := call.Fun.(*ast.SelectorExpr)
			if sel == nil || sel.Sel.Name != "Handle" {
				return true
			}
			recv, _ := sel.X.(*ast.Ident)
			if recv == nil {
				return true
			}
			if base, ok := groups[recv.Name]; ok {
				permissionTableBase[table.Name] = base
			}
			return true
		})
		return true
	})

	// Now extract all method calls.
	ast.Inspect(fn.Body, func(n ast.Node) bool {
		call, ok := n.(*ast.CallExpr)
		if !ok {
			return true
		}
		sel, _ := call.Fun.(*ast.SelectorExpr)
		if sel == nil {
			return true
		}
		method := strings.ToUpper(sel.Sel.Name)
		if !isGinMethod(method) {
			return true
		}
		recv, _ := sel.X.(*ast.Ident)
		if recv == nil {
			return true
		}
		basePath, ok := groups[recv.Name]
		if !ok {
			return true
		}
		pathArg := stringArgRoutes(call, 0)
		if pathArg == "" {
			return true
		}
		base := strings.TrimRight(basePath, "/")
		suffix := pathArg
		if !strings.HasPrefix(suffix, "/") {
			suffix = "/" + suffix
		}
		full := base + suffix
		full = strings.ReplaceAll(full, "//", "/")
		// Convert :param → {param}
		segs := strings.Split(full, "/")
		for i, s := range segs {
			if strings.HasPrefix(s, ":") {
				segs[i] = "{" + s[1:] + "}"
			}
		}
		full = strings.Join(segs, "/")
		// Last arg is the handler — find rightmost SelectorExpr referencing controller.
		handler := lastControllerHandler(call.Args[1:])
		routes = append(routes, RouteEntry{
			Method:      method,
			Path:        full,
			HandlerName: handler,
		})
		return true
	})
}

func isGinMethod(s string) bool {
	switch s {
	case "GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS":
		return true
	}
	return false
}

func stringArgRoutes(call *ast.CallExpr, i int) string {
	if i >= len(call.Args) {
		return ""
	}
	bl, ok := call.Args[i].(*ast.BasicLit)
	if !ok || bl.Kind != token.STRING {
		return ""
	}
	return strings.Trim(bl.Value, "\"`")
}

// lastControllerHandler picks `controller.X` from the variadic handler list.
// Middlewares look like `middleware.Y()` (call expressions); the actual handler
// is the last bare selector — e.g. `controller.UpdateUser`.
func lastControllerHandler(args []ast.Expr) string {
	for i := len(args) - 1; i >= 0; i-- {
		if sel, ok := args[i].(*ast.SelectorExpr); ok {
			if pkg, ok := sel.X.(*ast.Ident); ok && pkg.Name == "controller" {
				return sel.Sel.Name
			}
		}
	}
	return ""
}

func init() {
	// Silence unused import warnings if we drop helpers later.
	_ = os.Stderr
}
