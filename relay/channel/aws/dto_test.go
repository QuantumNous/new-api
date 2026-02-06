package aws

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

func TestFormatRequestAllowsOutputConfigAndUnknownFields(t *testing.T) {
	body := `{"model":"claude-3-5-sonnet","messages":[{"role":"user","content":"hi"}],"output_config":{"effort":"high","extra":true},"thinking":{"type":"enabled","budget_tokens":1024},"foo":"bar"}`
	awsReq, err := formatRequest(strings.NewReader(body), http.Header{})
	require.NoError(t, err)

	require.Equal(t, "bedrock-2023-05-31", awsReq.AnthropicVersion)

	var outputCfg map[string]any
	require.NoError(t, json.Unmarshal(awsReq.OutputConfig, &outputCfg))
	require.Equal(t, "high", outputCfg["effort"])
	require.Equal(t, true, outputCfg["extra"])

	require.NotNil(t, awsReq.Thinking)
	require.Equal(t, "enabled", awsReq.Thinking.Type)
	require.Equal(t, 1024, awsReq.Thinking.GetBudgetTokens())

	bodyBytes, err := buildAwsRequestBody(nil, &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}, awsReq)
	require.NoError(t, err)

	var serialized map[string]any
	require.NoError(t, json.Unmarshal(bodyBytes, &serialized))
	require.Contains(t, serialized, "output_config")
	require.NotContains(t, serialized, "foo")
}

func TestFormatRequestAllowsEmptyOutputConfig(t *testing.T) {
	body := `{"model":"claude-3-5-sonnet","messages":[{"role":"user","content":"hi"}],"output_config":{},"stream":true}`
	awsReq, err := formatRequest(strings.NewReader(body), http.Header{})
	require.NoError(t, err)

	require.Equal(t, "bedrock-2023-05-31", awsReq.AnthropicVersion)
	require.NotNil(t, awsReq.OutputConfig)
	require.NotEmpty(t, awsReq.OutputConfig)

	bodyBytes, err := buildAwsRequestBody(nil, &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}, awsReq)
	require.NoError(t, err)

	var serialized map[string]any
	require.NoError(t, json.Unmarshal(bodyBytes, &serialized))
	require.Contains(t, serialized, "output_config")
	require.NotContains(t, serialized, "stream")
}
