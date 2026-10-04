package claude

import "github.com/QuantumNous/new-api/common"

func FunctionParametersToInputSchema(parameters any) map[string]any {
	params, ok := parameters.(map[string]any)
	if !ok && parameters != nil {
		if p, err := common.Any2Type[map[string]any](parameters); err == nil {
			params = p
		}
	}
	schema := make(map[string]any, len(params))
	for key, value := range params {
		schema[key] = value
	}
	if schema["type"] == nil {
		schema["type"] = "object"
	}
	if schema["properties"] == nil {
		schema["properties"] = map[string]any{}
	}
	return schema
}
