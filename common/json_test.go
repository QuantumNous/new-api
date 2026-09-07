package common

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/go-playground/validator/v10"
	"github.com/stretchr/testify/assert"
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

func TestDecodeJsonWithValidation(t *testing.T) {
	type request struct {
		Code string `json:"code" binding:"required"`
	}
	for _, test := range []struct {
		name, body      string
		validationError bool
		decodeError     bool
	}{
		{name: "valid", body: `{"code":"123456"}`},
		{name: "missing required field", body: `{}`, validationError: true},
		{name: "empty required field", body: `{"code":""}`, validationError: true},
		{name: "malformed JSON", body: `{"code":`, decodeError: true},
		{name: "wrong field type", body: `{"code":123456}`, decodeError: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			var value request
			err := DecodeJsonWithValidation(strings.NewReader(test.body), &value)
			if test.validationError {
				var validationErrors validator.ValidationErrors
				require.ErrorAs(t, err, &validationErrors)
				require.Len(t, validationErrors, 1)
				assert.Equal(t, "Code", validationErrors[0].Field())
				assert.Equal(t, "required", validationErrors[0].Tag())
				return
			}
			if test.decodeError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, "123456", value.Code)
		})
	}
	// Existing decoding callers opt into validation explicitly.
	var unvalidated request
	require.NoError(t, DecodeJson(strings.NewReader(`{}`), &unvalidated))
}
