package service

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

// TestClaudeToOpenAIRequest_ToolResultImages verifies that Claude tool_result
// content blocks are correctly converted to OpenAI format. It covers text-only,
// image-only, mixed text+image, multiple images, URL sources, empty data,
// and unknown block type serialization.
func TestClaudeToOpenAIRequest_ToolResultImages(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name               string
		messages           []dto.ClaudeMessage
		expectToolContent  string
		expectToolContains string
		expectImageURL     string
		expectUserImageMsg bool
	}{
		{
			name: "pure string tool_result stays as tool text",
			messages: []dto.ClaudeMessage{
				{
					Role:    "assistant",
					Content: []any{map[string]any{"type": "tool_use", "id": "toolu_1", "name": "Read"}},
				},
				{
					Role:    "user",
					Content: []any{map[string]any{"type": "tool_result", "tool_use_id": "toolu_1", "content": "hello from tool"}},
				},
			},
			expectToolContent: "hello from tool",
		},
		{
			name: "text block tool_result becomes tool text",
			messages: []dto.ClaudeMessage{
				{
					Role:    "assistant",
					Content: []any{map[string]any{"type": "tool_use", "id": "toolu_1", "name": "Read"}},
				},
				{
					Role: "user",
					Content: []any{
						map[string]any{
							"type":        "tool_result",
							"tool_use_id": "toolu_1",
							"content": []any{
								map[string]any{"type": "text", "text": "hello from tool"},
							},
						},
					},
				},
			},
			expectToolContent: "hello from tool",
		},
		{
			name: "image block tool_result splits into tool+user",
			messages: []dto.ClaudeMessage{
				{
					Role:    "assistant",
					Content: []any{map[string]any{"type": "tool_use", "id": "toolu_1", "name": "Read"}},
				},
				{
					Role: "user",
					Content: []any{
						map[string]any{
							"type":        "tool_result",
							"tool_use_id": "toolu_1",
							"content": []any{
								map[string]any{
									"type": "image",
									"source": map[string]any{
										"type":       "base64",
										"media_type": "image/png",
										"data":       "abc123",
									},
								},
							},
						},
					},
				},
			},
			expectToolContent:  "[Tool result contained image content. The image content is provided in the following user message.]",
			expectImageURL:     "data:image/png;base64,abc123",
			expectUserImageMsg: true,
		},
		{
			name: "mixed text and image preserves text in tool and image in user",
			messages: []dto.ClaudeMessage{
				{
					Role:    "assistant",
					Content: []any{map[string]any{"type": "tool_use", "id": "toolu_1", "name": "Read"}},
				},
				{
					Role: "user",
					Content: []any{
						map[string]any{
							"type":        "tool_result",
							"tool_use_id": "toolu_1",
							"content": []any{
								map[string]any{"type": "text", "text": "screenshot output"},
								map[string]any{
									"type": "image",
									"source": map[string]any{
										"type":       "base64",
										"media_type": "image/png",
										"data":       "xyz789",
									},
								},
							},
						},
					},
				},
			},
			expectToolContent:  "screenshot output\n[Tool result contained image content. The image content is provided in the following user message.]",
			expectImageURL:     "data:image/png;base64,xyz789",
			expectUserImageMsg: true,
		},
		{
			name: "multiple images in tool_result",
			messages: []dto.ClaudeMessage{
				{
					Role:    "assistant",
					Content: []any{map[string]any{"type": "tool_use", "id": "toolu_1", "name": "Read"}},
				},
				{
					Role: "user",
					Content: []any{
						map[string]any{
							"type":        "tool_result",
							"tool_use_id": "toolu_1",
							"content": []any{
								map[string]any{
									"type": "image",
									"source": map[string]any{
										"type":       "base64",
										"media_type": "image/png",
										"data":       "image1",
									},
								},
								map[string]any{
									"type": "image",
									"source": map[string]any{
										"type":       "base64",
										"media_type": "image/jpeg",
										"data":       "image2",
									},
								},
							},
						},
					},
				},
			},
			expectToolContent:  "[Tool result contained image content. The image content is provided in the following user message.]",
			expectImageURL:     "data:image/jpeg;base64,image2",
			expectUserImageMsg: true,
		},
		{
			name: "image with url instead of data",
			messages: []dto.ClaudeMessage{
				{
					Role:    "assistant",
					Content: []any{map[string]any{"type": "tool_use", "id": "toolu_1", "name": "Read"}},
				},
				{
					Role: "user",
					Content: []any{
						map[string]any{
							"type":        "tool_result",
							"tool_use_id": "toolu_1",
							"content": []any{
								map[string]any{
									"type": "image",
									"source": map[string]any{
										"type": "url",
										"url":  "https://example.com/img.png",
									},
								},
							},
						},
					},
				},
			},
			expectToolContent:  "[Tool result contained image content. The image content is provided in the following user message.]",
			expectImageURL:     "https://example.com/img.png",
			expectUserImageMsg: true,
		},
		{
			name: "empty data image is skipped",
			messages: []dto.ClaudeMessage{
				{
					Role:    "assistant",
					Content: []any{map[string]any{"type": "tool_use", "id": "toolu_1", "name": "Read"}},
				},
				{
					Role: "user",
					Content: []any{
						map[string]any{
							"type":        "tool_result",
							"tool_use_id": "toolu_1",
							"content": []any{
								map[string]any{
									"type": "image",
									"source": map[string]any{
										"type":       "base64",
										"media_type": "image/png",
										"data":       "",
									},
								},
								map[string]any{"type": "text", "text": "no image available"},
							},
						},
					},
				},
			},
			expectToolContent: "no image available",
		},
		{
			name: "unknown block type serializes as text alongside real text",
			messages: []dto.ClaudeMessage{
				{
					Role:    "assistant",
					Content: []any{map[string]any{"type": "tool_use", "id": "toolu_1", "name": "Read"}},
				},
				{
					Role: "user",
					Content: []any{
						map[string]any{
							"type":        "tool_result",
							"tool_use_id": "toolu_1",
							"content": []any{
								map[string]any{"type": "text", "text": "result"},
								map[string]any{"type": "doc", "content": "doc content here"},
							},
						},
					},
				},
			},
			expectToolContent: "result\n",
			expectToolContains: `{"type":"doc"`,
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			claudeReq := dto.ClaudeRequest{
				Model:    "claude-3-5-sonnet",
				Messages: tc.messages,
			}

			info := &common.RelayInfo{
				ChannelMeta: &common.ChannelMeta{
					ChannelType: 1,
				},
			}

			oaiReq, err := ClaudeToOpenAIRequest(claudeReq, info)
			require.NoError(t, err)

			var toolMsg *dto.Message
			var imgUserMsg *dto.Message
			for i := range oaiReq.Messages {
				msg := &oaiReq.Messages[i]
				if msg.Role == "tool" {
					toolMsg = msg
				}
				if msg.Role == "user" {
					content := msg.ParseContent()
					for _, block := range content {
						if block.Type == dto.ContentTypeImageURL {
							imgUserMsg = msg
							break
						}
					}
				}
			}

			require.NotNil(t, toolMsg, "tool message should exist")
			if tc.expectToolContains != "" {
				require.Contains(t, toolMsg.StringContent(), tc.expectToolContent)
				require.Contains(t, toolMsg.StringContent(), tc.expectToolContains)
			} else {
				require.Equal(t, tc.expectToolContent, toolMsg.StringContent())
			}

			if tc.expectUserImageMsg {
				require.NotNil(t, imgUserMsg, "user message with image_url should exist")
				content := imgUserMsg.ParseContent()
				var foundURL string
				for _, block := range content {
					if block.Type == dto.ContentTypeImageURL && block.ImageUrl != nil {
						if url, ok := block.ImageUrl.(*dto.MessageImageUrl); ok {
							foundURL = url.Url
						} else if urlMap, ok := block.ImageUrl.(map[string]any); ok {
							foundURL, _ = urlMap["url"].(string)
						}
					}
				}
				require.Equal(t, tc.expectImageURL, foundURL)
			} else {
				require.Nil(t, imgUserMsg, "user message with image_url should not exist for text-only")
			}
		})
	}
}
