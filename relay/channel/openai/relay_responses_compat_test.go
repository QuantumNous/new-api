package openai

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOaiResponsesStreamHandlerAddsMissingItemCollections(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := strings.Join([]string{
		`data: {"type":"response.output_item.added","output_index":0,"item":{"id":"rs_missing","type":"reasoning","status":"in_progress"},"sequence_number":2}`,
		`data: {"type":"response.output_item.added","output_index":1,"item":{"id":"msg_missing","type":"message","role":"assistant","status":"in_progress"},"sequence_number":3}`,
		`data: {"type":"response.output_item.added","output_index":2,"item":{"id":"rs_existing","type":"reasoning","summary":[{"type":"summary_text","text":"kept"}],"status":"in_progress"},"sequence_number":4}`,
		`data: {"type":"response.output_item.added","output_index":3,"item":{"id":"fc_1","type":"function_call","call_id":"call_1","name":"lookup"},"sequence_number":5}`,
		`data: {"type":"response.completed","response":{"id":"resp_1","status":"completed","usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}}`,
		`data: [DONE]`,
		``,
	}, "\n")

	c, recorder, resp, info := newResponsesChatTestContext(t, body, true)
	usage, relayErr := OaiResponsesStreamHandler(c, info, resp)
	require.Nil(t, relayErr)
	require.NotNil(t, usage)
	require.Equal(t, 2, usage.TotalTokens)

	items := make(map[string]map[string]any)
	sequences := make(map[string]any)
	for _, line := range strings.Split(recorder.Body.String(), "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "data: ") || line == "data: [DONE]" {
			continue
		}
		var event map[string]any
		require.NoError(t, common.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &event))
		if event["type"] != dto.ResponsesOutputTypeItemAdded {
			continue
		}
		item, ok := event["item"].(map[string]any)
		require.True(t, ok)
		id, ok := item["id"].(string)
		require.True(t, ok)
		items[id] = item
		sequences[id] = event["sequence_number"]
	}

	require.Len(t, items, 4)
	assert.Equal(t, []any{}, items["rs_missing"]["summary"])
	assert.Equal(t, []any{}, items["msg_missing"]["content"])
	assert.Equal(t, []any{map[string]any{"type": "summary_text", "text": "kept"}}, items["rs_existing"]["summary"])
	assert.NotContains(t, items["fc_1"], "content")
	assert.Equal(t, float64(2), sequences["rs_missing"])
	assert.Equal(t, float64(5), sequences["fc_1"])
}
