package toolconv

import (
	"encoding/json"

	"github.com/QuantumNous/new-api/relaykit/dto"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
)

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

// SanitizeChatRequestTools repairs tool schemas on a Chat Completions request
// in place. Same-protocol routes never pass through ExtractRequest, so the
// relay layer calls this directly to cover them.
func SanitizeChatRequestTools(request *dto.GeneralOpenAIRequest) {
	if request == nil {
		return
	}
	for index := range request.Tools {
		if next, changed := sanitizeToolParameters(request.Tools[index].Function.Parameters); changed {
			request.Tools[index].Function.Parameters = next
		}
	}
	if next, changed := sanitizeRawToolList(request.Functions); changed {
		request.Functions = next
	}
}

// SanitizeResponsesRequestTools repairs tool schemas on a Responses request in
// place, for the same reason as SanitizeChatRequestTools.
func SanitizeResponsesRequestTools(request *dto.OpenAIResponsesRequest) {
	if request == nil {
		return
	}
	if next, changed := sanitizeRawToolList(request.Tools); changed {
		request.Tools = next
	}
}

// sanitizeRawToolList repairs a raw JSON array of tool or function
// declarations. It stays on json.RawMessage: only the objects on the path to a
// repaired schema are decoded and re-encoded, and every other member keeps its
// original bytes. Numbers in particular are never routed through float64, so
// values such as 9007199254740993 survive exactly. A list with nothing to
// repair is returned unchanged.
func sanitizeRawToolList(raw json.RawMessage) (json.RawMessage, bool) {
	return rewriteRawArray(raw, 0, sanitizeRawTool)
}

// sanitizeRawTool repairs one raw tool declaration.
func sanitizeRawTool(raw json.RawMessage, depth int) (json.RawMessage, bool) {
	return rewriteRawObject(raw, depth, repairRawToolMembers)
}

// repairRawToolMembers covers the declaration shapes the request formats use: a
// top-level "parameters" (Responses, legacy functions), a nested
// "function.parameters" (Chat), and a "tools" list inside namespace tools.
func repairRawToolMembers(tool map[string]json.RawMessage, depth int) bool {
	changed := false
	if next, repaired := sanitizeRawSchema(tool["parameters"], 0); repaired {
		tool["parameters"] = next
		changed = true
	}
	if next, repaired := sanitizeRawTool(tool["function"], depth+1); repaired {
		tool["function"] = next
		changed = true
	}
	if next, repaired := rewriteRawArray(tool["tools"], depth+1, sanitizeRawTool); repaired {
		tool["tools"] = next
		changed = true
	}
	return changed
}

// sanitizeRawSchema is the json.RawMessage counterpart of sanitizeSchema and
// follows the same keyword tables.
func sanitizeRawSchema(raw json.RawMessage, depth int) (json.RawMessage, bool) {
	return rewriteRawObject(raw, depth, repairRawSchemaMembers)
}

// repairRawSchemaMembers drops a null "required" from one schema object and
// descends into the keywords that hold subschemas.
func repairRawSchemaMembers(schema map[string]json.RawMessage, depth int) bool {
	changed := false
	if required, exists := schema["required"]; exists && kitutil.GetJsonType(required) == "null" {
		delete(schema, "required")
		changed = true
	}
	for key, child := range schema {
		if next, repaired := sanitizeRawSubschemas(key, child, depth+1); repaired {
			schema[key] = next
			changed = true
		}
	}
	return changed
}

// sanitizeRawSubschemas repairs the subschemas held by one schema keyword.
// "items" accepts either a single schema or a legacy tuple, so it is tried in
// both shapes; any keyword outside the tables is instance data and is skipped.
func sanitizeRawSubschemas(key string, raw json.RawMessage, depth int) (json.RawMessage, bool) {
	if _, ok := schemaSubschemaKeywords[key]; ok {
		if next, repaired := sanitizeRawSchema(raw, depth); repaired {
			return next, true
		}
	}
	if _, ok := schemaSubschemaListKeywords[key]; ok {
		return rewriteRawArray(raw, depth, sanitizeRawSchema)
	}
	if _, ok := schemaSubschemaMapKeywords[key]; ok {
		return rewriteRawObject(raw, depth, repairRawSchemaMap)
	}
	return raw, false
}

// repairRawSchemaMap repairs every schema in a name-to-schema map such as
// "properties" or "$defs".
func repairRawSchemaMap(entries map[string]json.RawMessage, depth int) bool {
	changed := false
	for name, entry := range entries {
		if next, repaired := sanitizeRawSchema(entry, depth); repaired {
			entries[name] = next
			changed = true
		}
	}
	return changed
}

// rewriteRawObject decodes raw into raw members, lets repair edit them, and
// re-encodes only when repair reports a change. Values that are not JSON
// objects, or that sit beyond schemaSanitizeMaxDepth, are returned as is.
func rewriteRawObject(raw json.RawMessage, depth int, repair func(map[string]json.RawMessage, int) bool) (json.RawMessage, bool) {
	if depth > schemaSanitizeMaxDepth || kitutil.GetJsonType(raw) != "object" {
		return raw, false
	}
	var object map[string]json.RawMessage
	if err := kitutil.Unmarshal(raw, &object); err != nil || !repair(object, depth) {
		return raw, false
	}
	encoded, err := kitutil.Marshal(object)
	if err != nil {
		return raw, false
	}
	return encoded, true
}

// rewriteRawArray is the array counterpart of rewriteRawObject: each element
// goes through repair, and the array is re-encoded only if one changed.
func rewriteRawArray(raw json.RawMessage, depth int, repair func(json.RawMessage, int) (json.RawMessage, bool)) (json.RawMessage, bool) {
	if depth > schemaSanitizeMaxDepth || kitutil.GetJsonType(raw) != "array" {
		return raw, false
	}
	var items []json.RawMessage
	if err := kitutil.Unmarshal(raw, &items); err != nil {
		return raw, false
	}
	changed := false
	for index, item := range items {
		if next, repaired := repair(item, depth); repaired {
			items[index] = next
			changed = true
		}
	}
	if !changed {
		return raw, false
	}
	encoded, err := kitutil.Marshal(items)
	if err != nil {
		return raw, false
	}
	return encoded, true
}
