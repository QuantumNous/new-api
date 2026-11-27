package claude

import (
	"encoding/json"
	"reflect"
	"slices"

	"github.com/MoeForge/moego/ojson"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
)

// topLevelUnionKeys are the schema combinators Claude rejects at the top level
// of input_schema ("input_schema does not support oneOf, allOf, or anyOf at the
// top level").
var topLevelUnionKeys = []string{"oneOf", "anyOf", "allOf"}

// FunctionParametersToInputSchema returns function parameters as a Claude
// input_schema, adding type and properties when they are missing or null.
// A top-level oneOf, anyOf or allOf is flattened into one object schema (see
// flattenTopLevelUnion) and its keywords are returned in flattened, so the
// caller can report the loss. Otherwise the client's bytes are kept, so the
// properties keep their order. ok is false when parameters are not a JSON
// object; the result is then an empty object schema.
func FunctionParametersToInputSchema(parameters json.RawMessage) (schema json.RawMessage, flattened []string, ok bool) {
	empty := json.RawMessage(`{"type":"object","properties":{}}`)
	switch kitutil.GetJsonType(parameters) {
	case "unknown", "null":
		return empty, nil, true
	case "object":
	default:
		return empty, nil, false
	}
	var fields struct {
		Type       json.RawMessage `json:"type"`
		Properties json.RawMessage `json:"properties"`
	}
	if err := kitutil.Unmarshal(parameters, &fields); err != nil {
		return empty, nil, false
	}
	schema = parameters
	var err error
	if schema, flattened, err = flattenTopLevelUnion(schema); err != nil {
		return empty, nil, false
	}
	if len(flattened) > 0 {
		fields.Type = json.RawMessage(`"object"`)
		fields.Properties = json.RawMessage(`{}`)
	}
	if len(fields.Type) == 0 || kitutil.GetJsonType(fields.Type) == "null" {
		if schema, err = ojson.SetRawBytes(schema, "type", []byte(`"object"`)); err != nil {
			return empty, nil, false
		}
	}
	if len(fields.Properties) == 0 || kitutil.GetJsonType(fields.Properties) == "null" {
		if schema, err = ojson.SetRawBytes(schema, "properties", []byte(`{}`)); err != nil {
			return empty, nil, false
		}
	}
	return schema, flattened, true
}

// flattenTopLevelUnion rewrites a schema whose top level is a oneOf, anyOf or
// allOf into a single object schema Claude accepts:
//
//   - properties of the top level and of every branch are merged in document
//     order; a name whose schemas differ becomes a nested anyOf of the
//     distinct schemas;
//   - required is the top level's required plus, per keyword, the
//     intersection of the branches' required for oneOf/anyOf and the union
//     for allOf;
//   - the union keywords are removed and type is set to "object"; every other
//     top-level keyword (description, additionalProperties, ...) is kept.
//
// The schema is returned unchanged, with flattened nil, when no union keyword
// is present at the top level.
func flattenTopLevelUnion(schema json.RawMessage) (json.RawMessage, []string, error) {
	root := ojson.ParseBytes(schema)
	var flattened []string
	for _, key := range topLevelUnionKeys {
		if root.Get(key).Exists() {
			flattened = append(flattened, key)
		}
	}
	if len(flattened) == 0 {
		return schema, nil, nil
	}

	var names []string
	variants := map[string][]json.RawMessage{}
	addProperties := func(object ojson.Result) {
		object.Get("properties").ForEach(func(name, value ojson.Result) bool {
			key := name.String()
			raw := json.RawMessage(value.Raw)
			existing, seen := variants[key]
			if !seen {
				names = append(names, key)
			}
			var decoded any
			if err := kitutil.Unmarshal(raw, &decoded); err != nil {
				decoded = value.Raw
			}
			if !slices.ContainsFunc(existing, func(other json.RawMessage) bool {
				var otherDecoded any
				if err := kitutil.Unmarshal(other, &otherDecoded); err != nil {
					otherDecoded = string(other)
				}
				return reflect.DeepEqual(otherDecoded, decoded)
			}) {
				variants[key] = append(existing, raw)
			}
			return true
		})
	}
	required := stringArray(root.Get("required"))
	addProperties(root)
	for _, key := range flattened {
		var branchRequired []string
		first := true
		for _, branch := range root.Get(key).Array() {
			addProperties(branch)
			branchNames := stringArray(branch.Get("required"))
			switch {
			case key == "allOf":
				branchRequired = appendMissing(branchRequired, branchNames...)
			case first:
				branchRequired = branchNames
			default:
				branchRequired = slices.DeleteFunc(branchRequired, func(name string) bool { return !slices.Contains(branchNames, name) })
			}
			first = false
		}
		required = appendMissing(required, branchRequired...)
	}

	properties := []byte{'{'}
	for i, name := range names {
		if i > 0 {
			properties = append(properties, ',')
		}
		properties = ojson.AppendJSONString(properties, name)
		properties = append(properties, ':')
		if schemas := variants[name]; len(schemas) == 1 {
			properties = append(properties, schemas[0]...)
		} else {
			anyOf, err := kitutil.Marshal(map[string][]json.RawMessage{"anyOf": schemas})
			if err != nil {
				return nil, nil, err
			}
			properties = append(properties, anyOf...)
		}
	}
	properties = append(properties, '}')

	out := slices.Clone(schema)
	var err error
	for _, key := range flattened {
		if out, err = ojson.DeleteBytes(out, key); err != nil {
			return nil, nil, err
		}
	}
	if out, err = ojson.SetRawBytes(out, "type", []byte(`"object"`)); err != nil {
		return nil, nil, err
	}
	if out, err = ojson.SetRawBytes(out, "properties", properties); err != nil {
		return nil, nil, err
	}
	if len(required) == 0 {
		out, err = ojson.DeleteBytes(out, "required")
	} else {
		var requiredJSON []byte
		if requiredJSON, err = kitutil.Marshal(required); err == nil {
			out, err = ojson.SetRawBytes(out, "required", requiredJSON)
		}
	}
	if err != nil {
		return nil, nil, err
	}
	return out, flattened, nil
}

func stringArray(value ojson.Result) []string {
	var values []string
	for _, item := range value.Array() {
		if item.Type == ojson.String {
			values = appendMissing(values, item.String())
		}
	}
	return values
}

func appendMissing(values []string, items ...string) []string {
	for _, item := range items {
		if !slices.Contains(values, item) {
			values = append(values, item)
		}
	}
	return values
}
