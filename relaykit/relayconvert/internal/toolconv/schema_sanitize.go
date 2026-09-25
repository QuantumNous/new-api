package toolconv

// JSON Schema defines "required" as an array of property names. Some clients
// emit a bare null instead, which strict upstreams reject outright:
//
//	xAI       400 /required: null is not of type "array"
//	Moonshot  400 At path 'required': required must be an array
//	Xiaomi    400 Invalid request parameters
//
// An absent "required" is the semantic equivalent of an empty one, so the key
// is dropped rather than replaced with [] — that preserves the client's intent
// without inventing a constraint the client never asked for.
//
// Traversal follows the schema keywords below instead of walking every value.
// Keywords such as default, examples, const and enum hold instance data, so a
// literal {"required": null} inside them is legitimate payload that must not be
// touched.

// schemaSanitizeMaxDepth bounds recursion so a hostile or malformed schema
// cannot drive unbounded stack growth.
const schemaSanitizeMaxDepth = 64

// schemaSubschemaKeywords hold a single nested schema.
var schemaSubschemaKeywords = map[string]struct{}{
	"additionalItems":       {},
	"additionalProperties":  {},
	"contains":              {},
	"contentSchema":         {},
	"else":                  {},
	"if":                    {},
	"items":                 {},
	"not":                   {},
	"propertyNames":         {},
	"then":                  {},
	"unevaluatedItems":      {},
	"unevaluatedProperties": {},
}

// schemaSubschemaListKeywords hold an array of nested schemas. "items" also
// accepts the legacy tuple form, so it appears here as well.
var schemaSubschemaListKeywords = map[string]struct{}{
	"allOf":       {},
	"anyOf":       {},
	"items":       {},
	"oneOf":       {},
	"prefixItems": {},
}

// schemaSubschemaMapKeywords map property names to nested schemas. Draft-07
// "dependencies" also accepts an array of property names; those entries are not
// maps, so sanitizeSchema leaves them untouched.
var schemaSubschemaMapKeywords = map[string]struct{}{
	"$defs":             {},
	"definitions":       {},
	"dependencies":      {},
	"dependentSchemas":  {},
	"patternProperties": {},
	"properties":        {},
}

// sanitizeToolParameters removes invalid null "required" members from a tool's
// JSON Schema and its nested subschemas. It reports whether anything changed.
func sanitizeToolParameters(parameters any) (any, bool) {
	return sanitizeSchema(parameters, 0)
}

func sanitizeSchema(value any, depth int) (any, bool) {
	if depth > schemaSanitizeMaxDepth {
		return value, false
	}
	schema, ok := value.(map[string]any)
	if !ok {
		return value, false
	}

	changed := false
	if required, exists := schema["required"]; exists && required == nil {
		delete(schema, "required")
		changed = true
	}

	for key, child := range schema {
		if _, ok := schemaSubschemaKeywords[key]; ok {
			if next, childChanged := sanitizeSchema(child, depth+1); childChanged {
				schema[key] = next
				changed = true
			}
		}
		if _, ok := schemaSubschemaListKeywords[key]; ok {
			if sanitizeSchemaList(child, depth+1) {
				changed = true
			}
		}
		if _, ok := schemaSubschemaMapKeywords[key]; ok {
			if sanitizeSchemaMap(child, depth+1) {
				changed = true
			}
		}
	}
	return schema, changed
}

func sanitizeSchemaList(value any, depth int) bool {
	items, ok := value.([]any)
	if !ok {
		return false
	}
	changed := false
	for index, item := range items {
		if next, itemChanged := sanitizeSchema(item, depth); itemChanged {
			items[index] = next
			changed = true
		}
	}
	return changed
}

func sanitizeSchemaMap(value any, depth int) bool {
	entries, ok := value.(map[string]any)
	if !ok {
		return false
	}
	changed := false
	for name, entry := range entries {
		if next, entryChanged := sanitizeSchema(entry, depth); entryChanged {
			entries[name] = next
			changed = true
		}
	}
	return changed
}

// sanitizeDefinitions applies sanitizeToolParameters to every function tool in
// the set.
func sanitizeDefinitions(definitions []Definition) {
	for index := range definitions {
		function := definitions[index].Function
		if function == nil || function.Parameters == nil {
			continue
		}
		if next, changed := sanitizeToolParameters(function.Parameters); changed {
			definitions[index].Function.Parameters = next
		}
	}
}
