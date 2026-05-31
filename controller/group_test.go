package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestValidateGroupName(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{"ascii letters", "default", false},
		{"with numbers", "group123", false},
		{"with underscore", "my_group", false},
		{"with hyphen", "my-group", false},
		{"with dot", "my.group", false},
		{"chinese characters", "中文分组", false},
		{"mixed chinese and ascii", "测试group", false},
		{"japanese", "テスト", false},
		{"korean", "테스트", false},
		{"empty string", "", true},
		{"too long", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", true},
		{"with space", "my group", true},
		{"with special char", "my@group", true},
		{"with slash", "my/group", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validateGroupName(tt.input)
			if tt.wantErr && result == "" {
				t.Errorf("validateGroupName(%q) = empty, want error", tt.input)
			}
			if !tt.wantErr && result != "" {
				t.Errorf("validateGroupName(%q) = %q, want empty", tt.input, result)
			}
		})
	}
}

func TestIsPathAllowed(t *testing.T) {
	tests := []struct {
		name        string
		paths       string
		requestPath string
		expected    bool
	}{
		{"empty paths allows all", "", "/v1/chat/completions", true},
		{"exact match", "/v1/chat/completions", "/v1/chat/completions", true},
		{"prefix match", "/v1/images", "/v1/images/generations", true},
		{"no match", "/v1/chat/completions", "/v1/images/generations", false},
		{"multiple paths one matches", "/v1/chat/completions,/v1/images", "/v1/images/generations", true},
		{"multiple paths none match", "/v1/chat/completions,/v1/audio", "/v1/images/generations", false},
		{"broad prefix", "/v1/", "/v1/chat/completions", true},
		{"mismatch prefix", "/v1/chat", "/v1/images/generations", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			g := &model.Group{AllowedPaths: tt.paths}
			result := g.IsPathAllowed(tt.requestPath)
			if result != tt.expected {
				t.Errorf("IsPathAllowed(%q) = %v, want %v", tt.requestPath, result, tt.expected)
			}
		})
	}
}
