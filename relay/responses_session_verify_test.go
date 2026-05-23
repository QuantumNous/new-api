package relay

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

const responsesSessionVerifyGatewayLimit = 900 * 1024

func TestVerifySession019eSanitizedUnderGatewayLimit(t *testing.T) {
	sessionPath := strings.TrimSpace(os.Getenv("CODEX_VERIFY_SESSION_JSONL"))
	if sessionPath == "" {
		t.Skip("set CODEX_VERIFY_SESSION_JSONL to run this session-derived verification")
	}

	requestBody := buildLargestSessionResponsesRequest(t, sessionPath, 286)
	shape := relaycommon.InspectResponsesTranscriptRequestShape(requestBody)
	require.Greater(t, len(requestBody), responsesSessionVerifyGatewayLimit)
	require.Equal(t, 286, shape.InputItems)
	require.True(t, shape.LooksReplacementInput)

	sanitizedBody, ok, reason := relaycommon.SanitizeResponsesTranscriptInitialRequest(requestBody)
	require.True(t, ok, reason)
	sanitizedShape := relaycommon.InspectResponsesTranscriptRequestShape(sanitizedBody)
	require.Equal(t, 0, sanitizedShape.ReasoningItems)
	require.Equal(t, 0, sanitizedShape.EncryptedContentItems)
	require.Less(t, len(sanitizedBody), responsesSessionVerifyGatewayLimit)

	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId: 5,
			ApiType:   constant.APITypeCodex,
		},
	}
	relaycommon.PrepareResponsesTranscriptReplay(info, requestBody)
	relaycommon.UpdateResponsesTranscriptReplayRequest(info, sanitizedBody, false)

	body, closer, newAPIError := newResponsesOutboundJSONBody(info, sanitizedBody)
	require.Nil(t, newAPIError)
	defer closer.Close()

	outboundBody, err := io.ReadAll(body)
	require.NoError(t, err)
	require.Equal(t, int64(len(sanitizedBody)), info.UpstreamRequestBodySize)
	require.Equal(t, sanitizedBody, outboundBody)

	t.Logf(
		"original_body_bytes=%d sanitized_body_bytes=%d original_items=%d sanitized_items=%d original_reasoning=%d sanitized_reasoning=%d original_encrypted=%d sanitized_encrypted=%d original_inline_images=%d sanitized_inline_images=%d reason=%q",
		len(requestBody),
		len(sanitizedBody),
		shape.InputItems,
		sanitizedShape.InputItems,
		shape.ReasoningItems,
		sanitizedShape.ReasoningItems,
		shape.EncryptedContentItems,
		sanitizedShape.EncryptedContentItems,
		shape.InlineImageItems,
		sanitizedShape.InlineImageItems,
		reason,
	)
}

func buildLargestSessionResponsesRequest(t *testing.T, sessionPath string, inputItems int) []byte {
	t.Helper()

	file, err := os.Open(sessionPath)
	require.NoError(t, err)
	defer file.Close()

	type record struct {
		Type    string          `json:"type"`
		Payload json.RawMessage `json:"payload"`
	}

	var transcriptItems []string
	reader := bufio.NewReaderSize(file, 1024*1024)
	for {
		line, readErr := reader.ReadBytes('\n')
		if len(line) > 0 {
			var rec record
			if err := json.Unmarshal(line, &rec); err == nil && rec.Type == "response_item" && len(rec.Payload) > 0 {
				payload := gjson.ParseBytes(rec.Payload)
				switch strings.TrimSpace(payload.Get("type").String()) {
				case "message", "function_call", "function_call_output", "custom_tool_call", "custom_tool_call_output", "reasoning":
					transcriptItems = append(transcriptItems, strings.TrimSpace(string(rec.Payload)))
				}
			}
		}
		if readErr != nil {
			break
		}
	}
	require.GreaterOrEqual(t, len(transcriptItems), inputItems)

	var requestBody []byte
	for i := 0; i+inputItems <= len(transcriptItems); i++ {
		candidate := []byte(fmt.Sprintf(`{
			"model":"gpt-5.5",
			"prompt_cache_key":"019e5382-dadc-7051-a35d-af12c28baa55",
			"input":[%s]
		}`, strings.Join(transcriptItems[i:i+inputItems], ",")))
		if len(candidate) > len(requestBody) {
			requestBody = candidate
		}
	}
	return requestBody
}
