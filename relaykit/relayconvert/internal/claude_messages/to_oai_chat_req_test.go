package claudemessages

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// These cases lock a real incident: when a Claude tool_result carried an image,
// the converter marshalled the whole content array into the tool message's
// string content. The upstream tokenizer then counted the base64 as text — a
// 1280x543 PNG (926 tokens by pixel size) was billed as 745,305 tokens, blowing
// the context window and, because the tool_use/tool_result pair survives
// compaction, leaving the session unrecoverable.
//
// The fix keeps text on the tool message and hoists images into the following
// user message as image_url blocks.

const testImageBase64 = "iVBORw0KGgoAAAANSUhEUg" + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"

func imageBlock() dto.ClaudeMediaMessage {
	return dto.ClaudeMediaMessage{
		Type: "image",
		Source: &dto.ClaudeMessageSource{
			Type: "base64", MediaType: "image/png", Data: testImageBase64,
		},
	}
}

func convertToolResult(t *testing.T, content []dto.ClaudeMediaMessage) *dto.GeneralOpenAIRequest {
	t.Helper()

	maxTokens := uint(1024)
	prompt := "see the image"
	out, err := ClaudeMessagesRequestToOpenAIChat(context.Background(), dto.ClaudeRequest{
		Model:     "test-model",
		MaxTokens: &maxTokens,
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "read the file"},
			{Role: "assistant", Content: []dto.ClaudeMediaMessage{
				{Type: "tool_use", Id: "toolu_1", Name: "Read"},
			}},
			{Role: "user", Content: []dto.ClaudeMediaMessage{
				{Type: "tool_result", ToolUseId: "toolu_1", Content: content},
				{Type: "text", Text: &prompt},
			}},
		},
	}, &convmeta.Values{})
	require.NoError(t, err)
	return out
}

// toolMessage returns the sole role:tool message, failing if it is absent.
func toolMessage(t *testing.T, out *dto.GeneralOpenAIRequest) *dto.Message {
	t.Helper()
	for i := range out.Messages {
		if out.Messages[i].Role == "tool" {
			return &out.Messages[i]
		}
	}
	t.Fatal("no tool message produced")
	return nil
}

// carrierImageURLs returns every image_url emitted on non-tool messages.
func carrierImageURLs(t *testing.T, out *dto.GeneralOpenAIRequest) []string {
	t.Helper()
	var urls []string
	for i := range out.Messages {
		msg := &out.Messages[i]
		if msg.Role == "tool" {
			continue
		}
		raw, err := json.Marshal(msg.Content)
		if err != nil {
			continue
		}
		var parts []struct {
			Type     string `json:"type"`
			ImageURL struct {
				URL string `json:"url"`
			} `json:"image_url"`
		}
		if err := json.Unmarshal(raw, &parts); err != nil {
			continue
		}
		for _, p := range parts {
			if p.Type == "image_url" {
				urls = append(urls, p.ImageURL.URL)
			}
		}
	}
	return urls
}

func TestToolResultImageIsHoistedNotStringified(t *testing.T) {
	t.Parallel()

	out := convertToolResult(t, []dto.ClaudeMediaMessage{imageBlock()})

	tool := toolMessage(t, out)
	assert.NotContains(t, tool.StringContent(), testImageBase64,
		"tool content must never carry image base64")
	assert.Equal(t, "[image]", tool.StringContent(),
		"upstream requires non-empty tool content")

	urls := carrierImageURLs(t, out)
	require.Len(t, urls, 1, "exactly one hoisted image expected")
	assert.True(t, strings.HasPrefix(urls[0], "data:image/png;base64,"),
		"hoisted image must be a data URL, got %q", urls[0])
	assert.Contains(t, urls[0], testImageBase64)
}

func TestToolResultTextAndImageKeepsBoth(t *testing.T) {
	t.Parallel()

	note := "screenshot below"
	out := convertToolResult(t, []dto.ClaudeMediaMessage{
		{Type: "text", Text: &note},
		imageBlock(),
	})

	assert.Equal(t, "screenshot below", toolMessage(t, out).StringContent())
	assert.Len(t, carrierImageURLs(t, out), 1, "image must not be dropped")
}

func TestToolResultUnknownShapeStillStringified(t *testing.T) {
	t.Parallel()

	out := convertToolResult(t, []dto.ClaudeMediaMessage{
		{Type: "document", Data: "opaque"},
	})

	assert.Contains(t, toolMessage(t, out).StringContent(), "opaque",
		"unknown shapes keep the whole-array fallback")
	assert.Empty(t, carrierImageURLs(t, out),
		"no image means no extra carrier message")
}
