package claude

import (
	"encoding/json"
	"fmt"

	"github.com/MoeForge/moego/ojson"
	"github.com/QuantumNous/new-api/relaykit/dto"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
)

// ApplyResponseFormat maps OpenAI JSON Schema output onto Claude's native
// output_config.format. Keep schema bytes intact: rewriting unsupported
// constraints would silently weaken validation, and property order affects
// the generated output. Supplied formats must declare a type; nil and text
// formats need no conversion. The upstream validates its supported schema subset.
func ApplyResponseFormat(req *dto.ClaudeRequest, format *dto.ResponseFormat) error {
	if format == nil || format.Type == "text" {
		return nil
	}
	if format.Type == "" {
		return fmt.Errorf("response format type is required for Claude Messages")
	}
	if format.Type != "json_schema" {
		return fmt.Errorf("Claude Messages cannot represent response format %q; use json_schema with an explicit schema", format.Type)
	}
	var definition struct {
		Schema json.RawMessage `json:"schema"`
	}
	if err := kitutil.Unmarshal(format.JsonSchema, &definition); err != nil {
		return fmt.Errorf("invalid json_schema response format: %w", err)
	}
	if kitutil.GetJsonType(definition.Schema) != "object" {
		return fmt.Errorf("json_schema response format schema must be a JSON object")
	}
	outputFormat, err := kitutil.Marshal(struct {
		Type   string          `json:"type"`
		Schema json.RawMessage `json:"schema"`
	}{Type: "json_schema", Schema: definition.Schema})
	if err != nil {
		return fmt.Errorf("encode Claude output format: %w", err)
	}
	outputConfig := make(map[string]json.RawMessage)
	if len(req.OutputConfig) > 0 {
		if err := kitutil.Unmarshal(req.OutputConfig, &outputConfig); err != nil {
			return fmt.Errorf("invalid Claude output_config: %w", err)
		}
		if outputConfig == nil {
			outputConfig = make(map[string]json.RawMessage)
		}
	}
	outputConfig["format"] = outputFormat
	req.OutputConfig, err = kitutil.Marshal(outputConfig)
	return err
}

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
		if schema, err = ojson.SetRawBytes(schema, "type", []byte(`"object"`)); err != nil {
			return empty, false
		}
	}
	if len(fields.Properties) == 0 || kitutil.GetJsonType(fields.Properties) == "null" {
		if schema, err = ojson.SetRawBytes(schema, "properties", []byte(`{}`)); err != nil {
			return empty, false
		}
	}
	return schema, true
}
