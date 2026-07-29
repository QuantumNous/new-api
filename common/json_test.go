package common

import (
	"encoding/json"
	"strings"
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
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, JsonRawMessageToString(tt.data))
		})
	}
}

func TestDecodeJsonDisallowUnknownFieldsRejectsUnknownField(t *testing.T) {
	var payload struct {
		Name string `json:"name"`
	}

	err := DecodeJsonDisallowUnknownFields(strings.NewReader(`{"name":"alpha","extra":true}`), &payload)

	require.Error(t, err)
	require.Contains(t, err.Error(), `unknown field "extra"`)
}

func TestDecodeJsonDisallowUnknownFieldsPreservesDecodeBehavior(t *testing.T) {
	tests := []struct {
		name    string
		body    string
		wantErr string
	}{
		{name: "empty", body: ``, wantErr: "EOF"},
		{name: "malformed", body: `{"name":`, wantErr: "unexpected EOF"},
		{name: "multiple documents", body: `{"name":"alpha"}{"name":"beta"}`, wantErr: "multiple JSON values"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			var payload struct {
				Name string `json:"name"`
			}

			err := DecodeJsonDisallowUnknownFields(strings.NewReader(test.body), &payload)

			if test.wantErr == "" {
				require.NoError(t, err)
				return
			}
			require.Error(t, err)
			require.Contains(t, err.Error(), test.wantErr)
		})
	}
}
