package helper

import (
	"testing"
)

func TestMatchWildcard(t *testing.T) {
	tests := []struct {
		name      string
		pattern   string
		modelName string
		expected  bool
	}{
		// Exact match
		{"exact match", "gpt-4", "gpt-4", true},
		{"exact no match", "gpt-4", "gpt-3.5", false},

		// Prefix wildcard (prefix*)
		{"prefix wildcard match", "gpt-*", "gpt-4", true},
		{"prefix wildcard match long", "gpt-*", "gpt-4-turbo", true},
		{"prefix wildcard no match", "gpt-*", "claude-3", false},
		{"prefix wildcard exact prefix", "Pro/*", "Pro/deepseek-ai/DeepSeek-R1", true},

		// Suffix wildcard (*suffix)
		{"suffix wildcard match", "*-turbo", "gpt-4-turbo", true},
		{"suffix wildcard match deepseek", "*DeepSeek-R1", "Pro/deepseek-ai/DeepSeek-R1", true},
		{"suffix wildcard no match", "*-turbo", "gpt-4", false},

		// Contains wildcard (*contains*)
		{"contains wildcard match", "*deepseek*", "Pro/deepseek-ai/DeepSeek-R1", true},
		{"contains wildcard match middle", "*turbo*", "gpt-4-turbo-preview", true},
		{"contains wildcard no match", "*claude*", "gpt-4", false},
		{"single star matches all", "*", "anything", true},

		// No wildcard
		{"no wildcard exact", "model", "model", true},
		{"no wildcard no match", "model", "different", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := matchWildcard(tt.pattern, tt.modelName)
			if result != tt.expected {
				t.Errorf("matchWildcard(%q, %q) = %v, expected %v",
					tt.pattern, tt.modelName, result, tt.expected)
			}
		})
	}
}

func TestApplyWildcardReplacement(t *testing.T) {
	tests := []struct {
		name      string
		pattern   string
		modelName string
		target    string
		expected  string
	}{
		// No wildcard in target
		{"no wildcard in target", "gpt-*", "gpt-4", "claude-3", "claude-3"},

		// Prefix pattern with wildcard target
		{"prefix pattern with wildcard target", "Pro/*", "Pro/deepseek-ai/DeepSeek-R1", "*", "deepseek-ai/DeepSeek-R1"},
		{"prefix pattern specific replacement", "old-*", "old-model-v2", "new-*", "new-model-v2"},

		// Suffix pattern with wildcard target
		{"suffix pattern with wildcard target", "*-old", "model-old", "*-new", "model-new"},

		// Contains pattern
		{"contains pattern", "*middle*", "prefix-middle-suffix", "*", "prefix-middle-suffix"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := applyWildcardReplacement(tt.pattern, tt.modelName, tt.target)
			if result != tt.expected {
				t.Errorf("applyWildcardReplacement(%q, %q, %q) = %q, expected %q",
					tt.pattern, tt.modelName, tt.target, result, tt.expected)
			}
		})
	}
}

func TestFindMappedModel(t *testing.T) {
	tests := []struct {
		name          string
		modelMap      map[string]interface{}
		modelName     string
		expectedModel string
		expectedFound bool
	}{
		{
			name: "exact match string value",
			modelMap: map[string]interface{}{
				"gpt-3.5-turbo": "gpt-3.5-turbo-0125",
			},
			modelName:     "gpt-3.5-turbo",
			expectedModel: "gpt-3.5-turbo-0125",
			expectedFound: true,
		},
		{
			name: "wildcard prefix match",
			modelMap: map[string]interface{}{
				"Pro/*": "deepseek-r1",
			},
			modelName:     "Pro/deepseek-ai/DeepSeek-R1",
			expectedModel: "deepseek-r1",
			expectedFound: true,
		},
		{
			name: "wildcard with replacement",
			modelMap: map[string]interface{}{
				"Pro/*": "*",
			},
			modelName:     "Pro/deepseek-ai/DeepSeek-R1",
			expectedModel: "deepseek-ai/DeepSeek-R1",
			expectedFound: true,
		},
		{
			name: "no match",
			modelMap: map[string]interface{}{
				"gpt-4": "gpt-4-turbo",
			},
			modelName:     "claude-3",
			expectedModel: "",
			expectedFound: false,
		},
		{
			name: "exact match takes priority over wildcard",
			modelMap: map[string]interface{}{
				"gpt-*":   "generic-gpt",
				"gpt-4":   "gpt-4-turbo",
			},
			modelName:     "gpt-4",
			expectedModel: "gpt-4-turbo",
			expectedFound: true,
		},
		{
			name: "array value should not be matched by findMappedModel",
			modelMap: map[string]interface{}{
				"DeepSeek-R1": []interface{}{"Pro/deepseek-ai/DeepSeek-R1", "deepseek-ai/DeepSeek-R1"},
			},
			modelName:     "DeepSeek-R1",
			expectedModel: "",
			expectedFound: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, found := findMappedModel(tt.modelMap, tt.modelName)
			if found != tt.expectedFound {
				t.Errorf("findMappedModel() found = %v, expected %v", found, tt.expectedFound)
			}
			if result != tt.expectedModel {
				t.Errorf("findMappedModel() = %q, expected %q", result, tt.expectedModel)
			}
		})
	}
}
