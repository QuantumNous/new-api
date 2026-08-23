package dto

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestToolCallRequestMarshalJSONPreservesCanonicalFieldOrder(t *testing.T) {
	raw, err := json.Marshal(ToolCallRequest{
		ID:   "call_abc",
		Type: "function",
		Function: FunctionRequest{
			Name:      "get_weather",
			Arguments: `{"city":"Paris"}`,
		},
	})
	require.NoError(t, err)
	require.Equal(t, `{"id":"call_abc","type":"function","function":{"name":"get_weather","arguments":"{\"city\":\"Paris\"}"}}`, string(raw))
}

func TestToolCallRequestMarshalJSONKeepsCustomFunctionPayload(t *testing.T) {
	raw, err := json.Marshal(ToolCallRequest{
		ID:     "call_custom",
		Type:   CustomType,
		Custom: json.RawMessage(`{"type":"custom_tool_call","input":"patch body"}`),
		Function: FunctionRequest{
			Name:      "apply_patch",
			Arguments: "patch body",
		},
	})
	require.NoError(t, err)
	require.Equal(t, CustomType, gjson.GetBytes(raw, "type").String())
	require.Equal(t, "apply_patch", gjson.GetBytes(raw, "function.name").String())
	require.Equal(t, "patch body", gjson.GetBytes(raw, "function.arguments").String())
	require.Equal(t, "custom_tool_call", gjson.GetBytes(raw, "custom.type").String())
}

func TestToolCallRequestMarshalJSONOmitsEmptyNonFunctionPayload(t *testing.T) {
	raw, err := json.Marshal(ToolCallRequest{
		ID:   "call_custom",
		Type: CustomType,
	})
	require.NoError(t, err)
	require.False(t, gjson.GetBytes(raw, "function").Exists())
}
