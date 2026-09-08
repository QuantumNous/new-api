package helper

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestStripModelPrefixFromBody(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		prefix     string
		wantModel  string
		wantUnmod  bool // expect body returned unchanged
	}{
		{
			name:      "strips prefix from model field",
			body:      `{"model": "dashscope/gpt-4", "messages": []}`,
			prefix:    "dashscope",
			wantModel: "gpt-4",
		},
		{
			name:     "empty prefix returns body unchanged",
			body:     `{"model": "dashscope/gpt-4", "messages": []}`,
			prefix:   "",
			wantUnmod: true,
		},
		{
			name:     "no model key returns body unchanged",
			body:     `{"messages": []}`,
			prefix:   "dashscope",
			wantUnmod: true,
		},
		{
			name:     "malformed JSON returns body unchanged",
			body:     `not json`,
			prefix:   "dashscope",
			wantUnmod: true,
		},
		{
			name:      "model without matching prefix is unchanged",
			body:      `{"model": "gpt-4", "messages": []}`,
			prefix:    "dashscope",
			wantModel: "gpt-4",
		},
		{
			name:     "non-string model field returns body unchanged",
			body:     `{"model": 123}`,
			prefix:   "dashscope",
			wantUnmod: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			out, err := StripModelPrefixFromBody([]byte(tt.body), tt.prefix)
			require.NoError(t, err)

			if tt.wantUnmod {
				require.Equal(t, tt.body, string(out), "body should be returned unchanged")
				return
			}
			require.Contains(t, string(out), `"model":"`+tt.wantModel+`"`)
		})
	}
}
