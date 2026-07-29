package common

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestJsonRawMessageToString(t *testing.T) {
	tests := []struct {
		name string
		data json.RawMessage
		want string
	}{
		{
			name: "object",
			data: json.RawMessage(`{"city":"Paris","days":0,"strict":false}`),
			want: `{"city":"Paris","days":0,"strict":false}`,
		},
		{
			name: "string",
			data: json.RawMessage(`"{\"city\":\"Paris\",\"days\":0,\"strict\":false}"`),
			want: `{"city":"Paris","days":0,"strict":false}`,
		},
		{
			name: "null",
			data: json.RawMessage(`null`),
			want: "",
		},
		{
			name: "empty",
			data: nil,
			want: "",
		},
		{
			name: "empty object",
			data: json.RawMessage(`{}`),
			want: `{}`,
		},
		{
			name: "array",
			data: json.RawMessage(`[1,2,3]`),
			want: `[1,2,3]`,
		},
		{
			name: "boolean",
			data: json.RawMessage(`true`),
			want: `true`,
		},
		{
			name: "number",
			data: json.RawMessage(`123`),
			want: `123`,
		},
		{
			name: "whitespace padded",
			data: json.RawMessage(`   {"a":1}   `),
			want: `{"a":1}`,
		},
		{
			name: "malformed string",
			data: json.RawMessage(`"unterminated`),
			want: `"unterminated`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, JsonRawMessageToString(tt.data))
		})
	}
}
