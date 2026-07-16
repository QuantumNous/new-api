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

// modelTypes maps unqualified Go type name → struct AST node parsed from model/*.go.
// Populated by parseModels.
var modelTypes = map[string]*ast.StructType{}

// modelAliases maps non-struct type aliases (e.g. type TaskStatus string) → underlying primitive.
var modelAliases = map[string]string{}

// referencedTypes tracks which model types must appear in components.schemas.
// Filled while building schemas; transitive refs added on the fly.
var referencedTypes = map[string]bool{}

// fieldTypes maps TypeName → Go field name → field type expression.
// Used by inferValueSchema to resolve `token.RemainQuota` / `user.Group` /
// nested struct accesses to a real OpenAPI schema.
var fieldTypes = map[string]map[string]ast.Expr{}

// methodReturn maps ReceiverType → method name → returned Go type name.
// Used to type expressions like `token.GetFullKey()` or `user.GetSetting()`.
var methodReturn = map[string]map[string]string{}

// packageVarType holds either a primitive type name or the raw AST type
// expression so resolvers can produce arrays/maps/refs accurately.
type packageVarType struct {
	Name string   // primitive name like "int", "string", "bool"; or struct type name
	Expr ast.Expr // raw type AST (when explicit), used by exprToSchema
}

// packageVars maps package name → exported var/const name → typed entry.
var packageVars = map[string]map[string]packageVarType{}

// recordPackageVar stores a single package-level var/const.
func recordPackageVar(pkg, name string, entry packageVarType) {
	if pkg == "" || name == "" || (entry.Name == "" && entry.Expr == nil) {
		return
	}
	if _, ok := packageVars[pkg]; !ok {
		packageVars[pkg] = map[string]packageVarType{}
	}
	if _, exists := packageVars[pkg][name]; !exists {
		packageVars[pkg][name] = entry
	}
}

// init seeds funcReturn with select stdlib calls used by NewAPI controllers
// for primitive returns. Reduces noise from `time.Now().Unix()`, `len(s)`, etc.
func init() {
	funcReturn["Unix"] = "int64"
	funcReturn["UnixNano"] = "int64"
	funcReturn["UnixMilli"] = "int64"
	funcReturn["String"] = "string"
	funcReturn["Error"] = "string"
	funcReturn["GetTimestamp"] = "int64"
	funcReturn["GetTimeString"] = "string"
}

// scanPackageVars walks a directory and indexes top-level var/const
// declarations + struct types + method/function returns for package-qualified
// type resolution. Catches `common.Version`, `setting.MjNotifyEnabled`, and
// `console_setting.GetConsoleSetting() *ConsoleSetting`.
func scanPackageVars(dir string) {
	fset := token.NewFileSet()
	matches, _ := filepath.Glob(filepath.Join(dir, "*.go"))
	for _, p := range matches {
		if strings.HasSuffix(p, "_test.go") {
			continue
		}
		f, err := parser.ParseFile(fset, p, nil, parser.SkipObjectResolution)
		if err != nil {
			continue
		}
		pkgName := f.Name.Name
		for _, decl := range f.Decls {
			switch d := decl.(type) {
			case *ast.GenDecl:
				switch d.Tok {
				case token.VAR, token.CONST:
					for _, spec := range d.Specs {
						vs, ok := spec.(*ast.ValueSpec)
						if !ok {
							continue
						}
						entry := packageVarType{}
						if vs.Type != nil {
							entry.Expr = vs.Type
							entry.Name = goTypeOf(vs.Type)
						} else if len(vs.Values) > 0 {
							entry.Name = goTypeOf(vs.Values[0])
							if cl, ok := vs.Values[0].(*ast.CompositeLit); ok && cl.Type != nil {
								entry.Expr = cl.Type
							}
						}
						if entry.Name == "" && entry.Expr == nil {
							continue
						}
						for _, n := range vs.Names {
							if !isExported(n.Name) {
								continue
							}
							recordPackageVar(pkgName, n.Name, entry)
						}
					}
				case token.TYPE:
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
				}
			case *ast.FuncDecl:
				if d.Type.Results == nil || len(d.Type.Results.List) == 0 {
					continue
				}
				retType := goTypeOf(d.Type.Results.List[0].Type)
				if retType == "" {
					continue
				}
				if d.Recv != nil {
					if recv := receiverTypeName(d.Recv); recv != "" {
						recordMethod(recv, d.Name.Name, retType)
					}
					continue
				}
				if _, exists := funcReturn[d.Name.Name]; !exists {
					funcReturn[d.Name.Name] = retType
				}
			}
		}
	}
}

// recordStructFields indexes raw field types so we can resolve selector
// expressions later. Idempotent on type name.
func recordStructFields(typeName string, st *ast.StructType) {
	if _, exists := fieldTypes[typeName]; exists {
		return
	}
	fields := map[string]ast.Expr{}
	for _, f := range st.Fields.List {
		for _, n := range f.Names {
			fields[n.Name] = f.Type
		}
	}
	fieldTypes[typeName] = fields
}

// recordMethod stores a single method on a receiver type.
// Always overwrites — last definition wins (stable across re-parses).
func recordMethod(receiverType, methodName, returnType string) {
	if receiverType == "" || methodName == "" {
		return
	}
	if _, ok := methodReturn[receiverType]; !ok {
		methodReturn[receiverType] = map[string]string{}
	}
	methodReturn[receiverType][methodName] = returnType
}

// receiverTypeName extracts the bare type name from a method's receiver,
// stripping pointer wrappers. Returns "" for unknown shapes.
func receiverTypeName(recv *ast.FieldList) string {
	if recv == nil || len(recv.List) == 0 {
		return ""
	}
	t := recv.List[0].Type
	if star, ok := t.(*ast.StarExpr); ok {
		t = star.X
	}
	if id, ok := t.(*ast.Ident); ok {
		return id.Name
	}
	return ""
}

func parseModels(dir string) error {
	fset := token.NewFileSet()
	matches, err := filepath.Glob(filepath.Join(dir, "*.go"))
	if err != nil {
		return err
	}
	for _, path := range matches {
		// Skip test files.
		if strings.HasSuffix(path, "_test.go") {
			continue
		}
		f, err := parser.ParseFile(fset, path, nil, parser.SkipObjectResolution)
		if err != nil {
			fmt.Fprintf(os.Stderr, "warn: parse %s: %v\n", path, err)
			continue
		}
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
					switch t := ts.Type.(type) {
					case *ast.StructType:
						modelTypes[ts.Name.Name] = t
						recordStructFields(ts.Name.Name, t)
					case *ast.Ident:
						modelAliases[ts.Name.Name] = t.Name
					case *ast.SelectorExpr:
						modelAliases[ts.Name.Name] = "string"
					}
				}
			case *ast.FuncDecl:
				if d.Recv != nil {
					// Method: index by receiver type.
					recv := receiverTypeName(d.Recv)
					if recv != "" && d.Type.Results != nil && len(d.Type.Results.List) > 0 {
						recordMethod(recv, d.Name.Name, goTypeOf(d.Type.Results.List[0].Type))
					}
				} else if d.Type.Results != nil && len(d.Type.Results.List) > 0 {
					// Plain function: index for `gin.H{"data": GetX()}` resolution.
					if _, exists := funcReturn[d.Name.Name]; !exists {
						funcReturn[d.Name.Name] = goTypeOf(d.Type.Results.List[0].Type)
					}
				}
			}
		}
	}
	return nil
}

// buildSchemas returns the components.schemas additions:
// - All model types referenced in the manifest, transitively.
// - Wrapper schemas: ApiResponse, ApiResponseOf<T>, ApiResponsePagedOfT, PageInfo.
func buildSchemas() map[string]interface{} {
	out := map[string]interface{}{}

	// Always include base wrappers.
	//
	// ApiResponse — no `data` property. Used when the route returns a
	// plain {success,message} body (most POST/DELETE/empty operations).
	// heyAPI generates `{ success: boolean; message: string }` — no `unknown`
	// field that callers must cast.
	out["ApiResponse"] = map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"success": map[string]interface{}{"type": "boolean"},
			"message": map[string]interface{}{"type": "string"},
		},
		"required": []interface{}{"success", "message"},
	}
	out["PageInfo"] = map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"page":      map[string]interface{}{"type": "integer"},
			"page_size": map[string]interface{}{"type": "integer"},
			"total":     map[string]interface{}{"type": "integer"},
			"items":     map[string]interface{}{"description": "Items list (typed in concrete wrappers)."},
		},
	}

	// Collect referenced types from manifest.
	for _, methodMap := range manifest {
		for _, resp := range methodMap {
			if resp.Type != "" {
				referencedTypes[resp.Type] = true
			}
		}
	}
	// Force-include types used by custom envelope schemas (Pricing, Vendor)
	// so the recursive loop below builds them and wrappers can $ref them.
	referencedTypes["Pricing"] = true
	referencedTypes["Vendor"] = true

	// Recursively add transitive deps.
	for {
		added := false
		for name := range referencedTypes {
			if _, done := out[name]; done {
				continue
			}
			st, ok := modelTypes[name]
			if !ok {
				continue
			}
			out[name] = structToSchema(st)
			added = true
		}
		if !added {
			break
		}
	}

	// Build response wrapper schemas keyed off referenced types.
	for name := range referencedTypes {
		out["ApiResponseOf"+name] = wrapResponse(map[string]interface{}{
			"$ref": "#/components/schemas/" + name,
		})
		out["ApiResponsePagedOf"+name] = wrapPagedResponse(map[string]interface{}{
			"$ref": "#/components/schemas/" + name,
		})
		out["ApiResponseListOf"+name] = wrapResponse(map[string]interface{}{
			"type":  "array",
			"items": map[string]interface{}{"$ref": "#/components/schemas/" + name},
		})
	}

	// Generic primitive wrappers.
	out["ApiResponseOfString"] = wrapResponse(map[string]interface{}{"type": "string"})
	out["ApiResponseOfInt"] = wrapResponse(map[string]interface{}{"type": "integer"})
	out["ApiResponseOfBool"] = wrapResponse(map[string]interface{}{"type": "boolean"})
	out["ApiResponseOfStringList"] = wrapResponse(map[string]interface{}{
		"type":  "array",
		"items": map[string]interface{}{"type": "string"},
	})
	out["ApiResponseOfObject"] = wrapResponse(map[string]interface{}{
		"type":                 "object",
		"additionalProperties": true,
	})

	// Backward-compat aliases for legacy hand-maintained spec names that
	// downstream getapi-backend code still imports.
	out["ApiResponseOfStringArrayData"] = wrapResponse(map[string]interface{}{
		"type":  "array",
		"items": map[string]interface{}{"type": "string"},
	})

	// Custom schemas for endpoints that return non-trivial gin.H{} envelopes
	// the AST walker can't infer automatically.
	stringFloatMap := map[string]interface{}{
		"type":                 "object",
		"additionalProperties": map[string]interface{}{"type": "number"},
	}
	out["RatioConfig"] = map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"model_ratio":        stringFloatMap,
			"completion_ratio":   stringFloatMap,
			"cache_ratio":        stringFloatMap,
			"create_cache_ratio": stringFloatMap,
			"model_price":        stringFloatMap,
		},
	}
	out["ApiResponseOfRatioConfig"] = wrapResponse(map[string]interface{}{
		"$ref": "#/components/schemas/RatioConfig",
	})

	// /api/pricing returns multi-field envelope: {data: Pricing[], vendors,
	// group_ratio, usable_group, supported_endpoint, auto_groups, pricing_version}.
	pricingResponseDataSchema := map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"data": map[string]interface{}{
				"type":  "array",
				"items": map[string]interface{}{"$ref": "#/components/schemas/Pricing"},
			},
			"vendors": map[string]interface{}{
				"type":  "array",
				"items": map[string]interface{}{"$ref": "#/components/schemas/Vendor"},
			},
			"group_ratio":        stringFloatMap,
			"usable_group":       map[string]interface{}{"type": "object", "additionalProperties": map[string]interface{}{"type": "string"}},
			"supported_endpoint": map[string]interface{}{"type": "object", "additionalProperties": true},
			"auto_groups": map[string]interface{}{
				"type":  "array",
				"items": map[string]interface{}{"type": "string"},
			},
			"pricing_version": map[string]interface{}{"type": "string"},
			"success":         map[string]interface{}{"type": "boolean"},
		},
	}
	out["PricingResponse"] = pricingResponseDataSchema
	// Force Pricing into components even when nothing else references it.
	referencedTypes["Pricing"] = true
	referencedTypes["Vendor"] = true

	// /api/log/{,self/}stat → ApiResponseOfStat (data = {quota, rpm, tpm}).
	// Stat type lives in model/log.go and is auto-discovered by parseModels.
	// (Legacy synthetic LogStatRow {day, quota} schema removed — endpoint
	// returns aggregate object, not per-day array.)

	// /api/data/* — quota usage timeseries.
	out["QuotaDataRow"] = map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"user_id":    map[string]interface{}{"type": "integer"},
			"username":   map[string]interface{}{"type": "string"},
			"created_at": map[string]interface{}{"type": "integer"},
			"token_name": map[string]interface{}{"type": "string"},
			"model_name": map[string]interface{}{"type": "string"},
			"quota":      map[string]interface{}{"type": "integer"},
			"token_used": map[string]interface{}{"type": "integer"},
			"count":      map[string]interface{}{"type": "integer"},
		},
	}
	out["ApiResponseListOfQuotaDataRow"] = wrapResponse(map[string]interface{}{
		"type":  "array",
		"items": map[string]interface{}{"$ref": "#/components/schemas/QuotaDataRow"},
	})

	// /api/channel/test/:id — single channel test result.
	out["ChannelTestResult"] = map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"time":    map[string]interface{}{"type": "number"},
			"success": map[string]interface{}{"type": "boolean"},
			"message": map[string]interface{}{"type": "string"},
		},
	}
	out["ApiResponseOfChannelTestResult"] = wrapResponse(map[string]interface{}{
		"$ref": "#/components/schemas/ChannelTestResult",
	})

	// /api/channel/:id/key — masked/admin key reveal.
	out["ChannelKeyResult"] = map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"key": map[string]interface{}{"type": "string"},
		},
	}
	out["ApiResponseOfChannelKeyResult"] = wrapResponse(map[string]interface{}{
		"$ref": "#/components/schemas/ChannelKeyResult",
	})

	// /api/token/:id/key — same shape.
	out["TokenKeyResult"] = map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"key": map[string]interface{}{"type": "string"},
		},
	}
	out["ApiResponseOfTokenKeyResult"] = wrapResponse(map[string]interface{}{
		"$ref": "#/components/schemas/TokenKeyResult",
	})

	// Codex usage proxy endpoints (/api/channel/{id}/codex/usage*) return a
	// non-standard envelope: {success, message, upstream_status, data} where
	// data is the upstream Wham payload passed through verbatim.
	out["CodexUpstreamProxyResponse"] = map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"success":         map[string]interface{}{"type": "boolean"},
			"message":         map[string]interface{}{"type": "string"},
			"upstream_status": map[string]interface{}{"type": "integer"},
			"data": map[string]interface{}{
				"description": "Upstream payload, passed through verbatim (JSON object or raw string).",
			},
		},
		"required": []interface{}{"success", "message"},
	}

	// Waffo Pancake handlers reply with {message, data} and no `success` key.
	// perf-metrics summary replies with {success, data} and no `message`.
	// Both need envelopes distinct from wrapResponse.
	for name, ref := range map[string]string{
		"WaffoEnvelopeOfCatalog":             "WaffoPancakeCatalogResponse",
		"WaffoEnvelopeOfProductOptions":      "WaffoPancakeProductOptionsResponse",
		"WaffoEnvelopeOfPair":                "WaffoPancakePairResponse",
		"WaffoEnvelopeOfSave":                "WaffoPancakeSaveResponse",
		"WaffoEnvelopeOfSubscriptionProduct": "WaffoPancakeSubscriptionProductResponse",
		"WaffoEnvelopeOfCheckout":            "WaffoPancakeCheckoutResponse",
	} {
		referencedTypes[ref] = true
		out[name] = wrapWaffoResponse(map[string]interface{}{
			"$ref": "#/components/schemas/" + ref,
		})
	}
	// {message, data: string} — shared by waffo/waffo-pancake/epay amount
	// endpoints (no `success` key).
	out["MessageEnvelopeOfString"] = wrapWaffoResponse(map[string]interface{}{"type": "string"})

	// Epay checkout endpoints (/api/user/pay, /api/subscription/epay/pay):
	// {message, data: map[string]string form params, url}.
	out["EpayCheckoutEnvelope"] = map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"message": map[string]interface{}{"type": "string"},
			"data": map[string]interface{}{
				"type":                 "object",
				"additionalProperties": map[string]interface{}{"type": "string"},
				"description":          "Payment gateway form parameters.",
			},
			"url": map[string]interface{}{"type": "string"},
		},
		"required": []interface{}{"message"},
	}

	// /api/channel/update_balance/{id} extends the envelope with a top-level
	// `balance` key instead of using `data`.
	out["ChannelBalanceEnvelope"] = map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"success": map[string]interface{}{"type": "boolean"},
			"message": map[string]interface{}{"type": "string"},
			"balance": map[string]interface{}{"type": "number"},
		},
		"required": []interface{}{"success"},
	}

	// /api/channel/multi_key/manage returns different data per action:
	// get_key_status → MultiKeyStatusResponse, delete_disabled_keys → int,
	// mutations → null.
	referencedTypes["MultiKeyStatusResponse"] = true
	out["ApiResponseOfMultiKeyManageResult"] = wrapResponse(map[string]interface{}{
		"oneOf": []interface{}{
			map[string]interface{}{"$ref": "#/components/schemas/MultiKeyStatusResponse"},
			map[string]interface{}{"type": "integer"},
		},
		"description": "MultiKeyStatusResponse for get_key_status, deleted count for delete_disabled_keys, null for mutations.",
	})
	referencedTypes["PerfMetricsSummaryResponse"] = true
	out["SuccessEnvelopeOfPerfMetricsSummary"] = map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"success": map[string]interface{}{"type": "boolean"},
			"data":    map[string]interface{}{"$ref": "#/components/schemas/PerfMetricsSummaryResponse"},
		},
		"required": []interface{}{"success"},
	}

	// Second transitive pass: referencedTypes added above (custom envelopes)
	// need their struct schemas materialized too.
	for {
		added := false
		for name := range referencedTypes {
			if _, done := out[name]; done {
				continue
			}
			st, ok := modelTypes[name]
			if !ok {
				continue
			}
			out[name] = structToSchema(st)
			added = true
		}
		if !added {
			break
		}
	}

	return out
}

// wrapWaffoResponse builds the {message, data} envelope used by the Waffo
// Pancake controllers (no `success` field).
func wrapWaffoResponse(dataSchema map[string]interface{}) map[string]interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"message": map[string]interface{}{"type": "string"},
			"data":    dataSchema,
		},
		"required": []interface{}{"message"},
	}
}

func wrapResponse(dataSchema map[string]interface{}) map[string]interface{} {
	// `message` stays optional: a handful of handlers (ollama version, perf
	// summary) emit {success, data} without it, and clients treat it as
	// best-effort text anyway.
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"success": map[string]interface{}{"type": "boolean"},
			"message": map[string]interface{}{"type": "string"},
			"data":    dataSchema,
		},
		"required": []interface{}{"success"},
	}
}

func wrapPagedResponse(itemSchema map[string]interface{}) map[string]interface{} {
	return wrapResponse(map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"page":      map[string]interface{}{"type": "integer"},
			"page_size": map[string]interface{}{"type": "integer"},
			"total":     map[string]interface{}{"type": "integer"},
			"items": map[string]interface{}{
				"type":  "array",
				"items": itemSchema,
			},
		},
	})
}

// structToSchema converts a Go struct to an OpenAPI 3.0 object schema.
//
// Field inclusion rules — match Go encoding/json semantics:
//   - skip if json:"-" (explicit JSON exclusion)
//   - keep if gorm:"-" or gorm:"-:all" — these fields are NOT in DB but ARE
//     serialized to JSON (e.g. Model.MatchedModels, Model.BoundChannels),
//     so they must appear in the schema.
//   - if no json tag, fall back to the Go field name (encoding/json default).
//   - skip embedded fields without explicit names (we don't recurse here).
func structToSchema(st *ast.StructType) map[string]interface{} {
	props := map[string]interface{}{}
	for _, field := range st.Fields.List {
		jsonTag := ""
		if field.Tag != nil {
			tag := strings.Trim(field.Tag.Value, "`")
			jsonTag = extractTag(tag, "json")
			if jsonTag == "-" {
				continue
			}
		}
		if len(field.Names) == 0 {
			// Embedded type — skip, would require recursion.
			continue
		}
		jsonName := strings.SplitN(jsonTag, ",", 2)[0]
		if jsonName == "" {
			jsonName = field.Names[0].Name
		}
		schema := exprToSchema(field.Type)
		if schema == nil {
			continue
		}
		props[jsonName] = schema
	}
	return map[string]interface{}{
		"type":       "object",
		"properties": props,
	}
}

func extractTag(tag, key string) string {
	prefix := key + ":\""
	idx := strings.Index(tag, prefix)
	if idx < 0 {
		return ""
	}
	rest := tag[idx+len(prefix):]
	end := strings.Index(rest, "\"")
	if end < 0 {
		return ""
	}
	return rest[:end]
}

// exprToSchema converts a Go type expression into an OpenAPI schema.
// For named types it adds them to referencedTypes for transitive resolution.
func exprToSchema(expr ast.Expr) map[string]interface{} {
	switch t := expr.(type) {
	case *ast.Ident:
		return identToSchema(t.Name)
	case *ast.StarExpr:
		// Pointer fields are optional but not marked nullable.
		// `nullable: true` produces `T | null` in TS clients which collides with
		// hand-written mappers that use `T | undefined`. Pointers in Go can be
		// nil but downstream consumers of NewAPI typically treat absent and null
		// equivalently — keep as plain optional.
		return exprToSchema(t.X)
	case *ast.ArrayType:
		// []byte → string base64 not used here; treat as bytes/string for json.RawMessage too
		if id, ok := t.Elt.(*ast.Ident); ok && id.Name == "byte" {
			return map[string]interface{}{"type": "string"}
		}
		items := exprToSchema(t.Elt)
		if items == nil {
			items = map[string]interface{}{}
		}
		return map[string]interface{}{
			"type":  "array",
			"items": items,
		}
	case *ast.MapType:
		val := exprToSchema(t.Value)
		if val == nil {
			val = map[string]interface{}{}
		}
		return map[string]interface{}{
			"type":                 "object",
			"additionalProperties": val,
		}
	case *ast.SelectorExpr:
		// Qualified name like time.Time, gorm.DeletedAt, json.RawMessage, constant.X
		pkgIdent, _ := t.X.(*ast.Ident)
		typeName := ""
		if pkgIdent != nil {
			typeName = pkgIdent.Name + "." + t.Sel.Name
		} else {
			typeName = t.Sel.Name
		}
		return qualifiedToSchema(typeName)
	case *ast.InterfaceType:
		return map[string]interface{}{"description": "Any value."}
	case *ast.StructType:
		return structToSchema(t)
	}
	return map[string]interface{}{}
}

func identToSchema(name string) map[string]interface{} {
	switch name {
	case "string":
		return map[string]interface{}{"type": "string"}
	case "bool":
		return map[string]interface{}{"type": "boolean"}
	case "int", "int8", "int16", "int32", "int64",
		"uint", "uint8", "uint16", "uint32", "uint64", "byte", "rune":
		return map[string]interface{}{"type": "integer"}
	case "float32", "float64":
		return map[string]interface{}{"type": "number"}
	case "any":
		return map[string]interface{}{"description": "Any value."}
	}
	// Alias to primitive?
	if alias, ok := modelAliases[name]; ok {
		return identToSchema(alias)
	}
	// Struct type from model package — emit $ref and queue.
	if _, ok := modelTypes[name]; ok {
		referencedTypes[name] = true
		return map[string]interface{}{
			"$ref": "#/components/schemas/" + name,
		}
	}
	// Unknown — fallback to opaque.
	return map[string]interface{}{}
}

func qualifiedToSchema(qname string) map[string]interface{} {
	switch qname {
	case "time.Time":
		return map[string]interface{}{"type": "string", "format": "date-time"}
	case "gorm.DeletedAt":
		// Soft-delete timestamp; usually only present after deletion. Not nullable
		// in the TS sense — see note in *ast.StarExpr handling.
		return map[string]interface{}{"type": "string", "format": "date-time"}
	case "json.RawMessage":
		return map[string]interface{}{"description": "Raw JSON value."}
	case "decimal.Decimal":
		return map[string]interface{}{"type": "string"}
	}
	// Cross-package reference to a parsed struct (e.g. dto fields typed as
	// ionet.HardwareType) — emit a $ref instead of an opaque scalar.
	if dot := strings.Index(qname, "."); dot >= 0 {
		if bare := qname[dot+1:]; bare != "" {
			if _, ok := modelTypes[bare]; ok {
				return identToSchema(bare)
			}
		}
	}
	// constant.* and other typed strings/ints — opaque scalar.
	return map[string]interface{}{"type": "string"}
}
