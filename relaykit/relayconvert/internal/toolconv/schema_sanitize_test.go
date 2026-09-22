package toolconv

import (
	"testing"
)

func TestSanitizeToolParameters_DropsNullRequired(t *testing.T) {
	parameters := map[string]any{
		"type":       "object",
		"properties": map[string]any{"path": map[string]any{"type": "string"}},
		"required":   nil,
	}

	sanitized, changed := sanitizeToolParameters(parameters)

	if !changed {
		t.Fatal("expected the null required member to be reported as changed")
	}
	schema, ok := sanitized.(map[string]any)
	if !ok {
		t.Fatalf("expected a map, got %T", sanitized)
	}
	if _, exists := schema["required"]; exists {
		t.Error("expected the null required member to be dropped")
	}
	if schema["type"] != "object" {
		t.Errorf("expected type to survive, got %v", schema["type"])
	}
	if _, exists := schema["properties"]; !exists {
		t.Error("expected properties to survive")
	}
}

func TestSanitizeToolParameters_KeepsValidRequired(t *testing.T) {
	parameters := map[string]any{
		"type":     "object",
		"required": []any{"path"},
	}

	sanitized, changed := sanitizeToolParameters(parameters)

	if changed {
		t.Fatal("a valid required array must be left untouched")
	}
	schema := sanitized.(map[string]any)
	required, ok := schema["required"].([]any)
	if !ok || len(required) != 1 || required[0] != "path" {
		t.Errorf("expected required to be preserved, got %v", schema["required"])
	}
}

func TestSanitizeToolParameters_DropsNullRequiredInNestedSchemas(t *testing.T) {
	parameters := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"filter": map[string]any{
				"type":     "object",
				"required": nil,
			},
		},
		"items": []any{
			map[string]any{"type": "object", "required": nil},
		},
	}

	sanitized, changed := sanitizeToolParameters(parameters)

	if !changed {
		t.Fatal("expected nested null required members to be reported as changed")
	}
	schema := sanitized.(map[string]any)
	nested := schema["properties"].(map[string]any)["filter"].(map[string]any)
	if _, exists := nested["required"]; exists {
		t.Error("expected the nested null required member to be dropped")
	}
	item := schema["items"].([]any)[0].(map[string]any)
	if _, exists := item["required"]; exists {
		t.Error("expected the null required member inside an array to be dropped")
	}
}

func TestSanitizeToolParameters_IgnoresNonSchemaValues(t *testing.T) {
	for _, value := range []any{nil, "text", 42, true} {
		if _, changed := sanitizeToolParameters(value); changed {
			t.Errorf("expected %v to be left untouched", value)
		}
	}
}

func TestSanitizeDefinitions_RepairsFunctionTools(t *testing.T) {
	definitions := []Definition{
		{Name: "no_function"},
		{
			Name: "read_file",
			Function: &Function{
				Name:       "read_file",
				Parameters: map[string]any{"type": "object", "required": nil},
			},
		},
	}

	sanitizeDefinitions(definitions)

	schema := definitions[1].Function.Parameters.(map[string]any)
	if _, exists := schema["required"]; exists {
		t.Error("expected the null required member to be dropped")
	}
	if definitions[0].Function != nil {
		t.Error("expected a definition without a function to stay untouched")
	}
}
