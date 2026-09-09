package model_test

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
)

func strPtr(s string) *string { return &s }

func TestRuntimeAndDisplayBaseURL(t *testing.T) {
	cases := []struct {
		name                           string
		base, actual                   *string
		wantRuntime, wantDisp, wantAct string
	}{
		{"both nil", nil, nil, "", "", ""},
		{"base only", strPtr("https://platform.claude.com"), nil, "https://platform.claude.com", "https://platform.claude.com", ""},
		{"actual only", nil, strPtr("https://upstream.example.com"), "https://upstream.example.com", "", "https://upstream.example.com"},
		{"both set", strPtr("https://platform.claude.com"), strPtr("https://upstream.example.com"), "https://upstream.example.com", "https://platform.claude.com", "https://upstream.example.com"},
		{"actual whitespace falls back", strPtr("https://platform.claude.com"), strPtr("   "), "https://platform.claude.com", "https://platform.claude.com", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			ch := &model.Channel{BaseURL: c.base, ActualBaseURL: c.actual}
			assert.Equal(t, c.wantRuntime, ch.GetRuntimeBaseURL())
			assert.Equal(t, c.wantDisp, ch.GetDisplayBaseURL())
			assert.Equal(t, c.wantAct, ch.GetActualBaseURL())
		})
	}
}
