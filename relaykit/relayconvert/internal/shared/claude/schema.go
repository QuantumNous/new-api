package claude

import (
	"encoding/json"

	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/tidwall/sjson"
)

// FunctionParametersToInputSchema returns function parameters as a Claude
// input_schema, adding type and properties when they are missing or null.
// Otherwise the client's bytes are kept, so the properties keep their order.
// ok is false when parameters are not a JSON object; the result is then an
// empty object schema.
func FunctionParametersToInputSchema(parameters json.RawMessage) (schema json.RawMessage, ok bool) {
	empty := json.RawMessage(`{"type":"object","properties":{}}`)
	switch kitutil.GetJsonType(parameters) {
	case "unknown", "null":
		return empty, true
	case "object":
	default:
		return empty, false
	}
	var fields struct {
		Type       json.RawMessage `json:"type"`
		Properties json.RawMessage `json:"properties"`
	}
	if err := kitutil.Unmarshal(parameters, &fields); err != nil {
		return empty, false
	}
	schema = parameters
	var err error
	if len(fields.Type) == 0 || kitutil.GetJsonType(fields.Type) == "null" {
		if schema, err = sjson.SetRawBytes(schema, "type", []byte(`"object"`)); err != nil {
			return empty, false
		}
	}
	if len(fields.Properties) == 0 || kitutil.GetJsonType(fields.Properties) == "null" {
		if schema, err = sjson.SetRawBytes(schema, "properties", []byte(`{}`)); err != nil {
			return empty, false
		}
	}
	return schema, true
}
