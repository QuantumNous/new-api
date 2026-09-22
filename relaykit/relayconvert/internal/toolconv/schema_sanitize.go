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

// schemaSanitizeMaxDepth bounds recursion so a hostile or malformed schema
// cannot drive unbounded stack growth.
const schemaSanitizeMaxDepth = 64

// sanitizeToolParameters removes invalid null "required" members anywhere in a
// tool's JSON Schema. It reports whether anything changed.
func sanitizeToolParameters(parameters any) (any, bool) {
	return sanitizeSchemaValue(parameters, 0)
}

func sanitizeSchemaValue(value any, depth int) (any, bool) {
	if depth > schemaSanitizeMaxDepth {
		return value, false
	}
	switch typed := value.(type) {
	case map[string]any:
		changed := false
		if required, ok := typed["required"]; ok && required == nil {
			delete(typed, "required")
			changed = true
		}
		for key, child := range typed {
			next, childChanged := sanitizeSchemaValue(child, depth+1)
			if childChanged {
				typed[key] = next
				changed = true
			}
		}
		return typed, changed
	case []any:
		changed := false
		for index, child := range typed {
			next, childChanged := sanitizeSchemaValue(child, depth+1)
			if childChanged {
				typed[index] = next
				changed = true
			}
		}
		return typed, changed
	default:
		return value, false
	}
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
