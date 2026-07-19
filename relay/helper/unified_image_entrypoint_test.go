package helper

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"testing"

	rootcommon "github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateUnifiedImageEntryPointAllowsCanonicalImageTaskMode(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		OriginModelName: "gpt-image-2",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gemini-3.1-pro-image",
		},
	}
	request := &dto.OpenAIResponsesRequest{
		Tools: json.RawMessage(`[{"type":"image_generation"}]`),
	}

	require.NoError(t, ValidateUnifiedImageEntryPoint(info, request))
}

func TestValidateUnifiedImageEntryPointRejectsNonCanonicalImageGeneration(t *testing.T) {
	tests := []struct {
		name    string
		info    *relaycommon.RelayInfo
		request dto.Request
	}{
		{
			name: "legacy edits mode",
			info: &relaycommon.RelayInfo{
				RelayMode:       relayconstant.RelayModeImagesEdits,
				OriginModelName: "custom-renderer",
			},
			request: &dto.ImageRequest{},
		},
		{
			name: "responses image generation tool",
			info: &relaycommon.RelayInfo{
				RelayMode:       relayconstant.RelayModeResponses,
				OriginModelName: "gpt-5",
			},
			request: &dto.OpenAIResponsesRequest{
				Tools: json.RawMessage(`[{"type":"IMAGE_GENERATION"}]`),
			},
		},
		{
			name: "chat google image config",
			info: &relaycommon.RelayInfo{
				RelayMode:       relayconstant.RelayModeChatCompletions,
				OriginModelName: "gpt-5",
			},
			request: &dto.GeneralOpenAIRequest{
				ExtraBody: json.RawMessage(`{"google":{"image_config":{"aspect_ratio":"1:1"}}}`),
			},
		},
		{
			name: "chat image generation tool",
			info: &relaycommon.RelayInfo{
				RelayMode:       relayconstant.RelayModeChatCompletions,
				OriginModelName: "gpt-5",
			},
			request: &dto.GeneralOpenAIRequest{
				Tools: []dto.ToolCallRequest{{Type: "IMAGE_GENERATION"}},
			},
		},
		{
			name: "chat image output modality",
			info: &relaycommon.RelayInfo{
				RelayMode:       relayconstant.RelayModeChatCompletions,
				OriginModelName: "gpt-4o",
			},
			request: &dto.GeneralOpenAIRequest{
				Modalities: json.RawMessage(`["text","image"]`),
			},
		},
		{
			name: "gemini image output modality",
			info: &relaycommon.RelayInfo{
				RelayMode:       relayconstant.RelayModeGemini,
				OriginModelName: "gemini-2.5-flash",
			},
			request: &dto.GeminiChatRequest{
				GenerationConfig: dto.GeminiChatGenerationConfig{
					ResponseModalities: []string{"TEXT", "IMAGE"},
				},
			},
		},
		{
			name: "gemini image config",
			info: &relaycommon.RelayInfo{
				RelayMode:       relayconstant.RelayModeGemini,
				OriginModelName: "gemini-2.5-flash",
			},
			request: &dto.GeminiChatRequest{
				GenerationConfig: dto.GeminiChatGenerationConfig{
					ImageConfig: json.RawMessage(`{"aspectRatio":"1:1"}`),
				},
			},
		},
		{
			name: "origin image model",
			info: &relaycommon.RelayInfo{
				RelayMode:       relayconstant.RelayModeChatCompletions,
				OriginModelName: "nano-banana-2",
			},
			request: &dto.GeneralOpenAIRequest{},
		},
		{
			name: "mapped upstream image model",
			info: &relaycommon.RelayInfo{
				RelayMode:       relayconstant.RelayModeChatCompletions,
				OriginModelName: "public-model-alias",
				ChannelMeta: &relaycommon.ChannelMeta{
					UpstreamModelName: "gemini-3.1-pro-image",
				},
			},
			request: &dto.GeneralOpenAIRequest{},
		},
		{
			name: "gpt image family",
			info: &relaycommon.RelayInfo{
				RelayMode:       relayconstant.RelayModeResponses,
				OriginModelName: "gpt-image-2-image-to-image",
			},
			request: &dto.OpenAIResponsesRequest{},
		},
		{
			name: "qwen synchronous image family",
			info: &relaycommon.RelayInfo{
				RelayMode:       relayconstant.RelayModeChatCompletions,
				OriginModelName: "qwen-image-edit-plus",
			},
			request: &dto.GeneralOpenAIRequest{},
		},
		{
			name: "gemini thinking suffix normalizes to image model",
			info: &relaycommon.RelayInfo{
				RelayMode:       relayconstant.RelayModeGemini,
				OriginModelName: "gemini-3.1-flash-image-thinking-1024",
			},
			request: &dto.GeminiChatRequest{},
		},
		{
			name: "gemini effort suffix normalizes to image model",
			info: &relaycommon.RelayInfo{
				RelayMode:       relayconstant.RelayModeGemini,
				OriginModelName: "gemini-2.0-flash-exp-high",
			},
			request: &dto.GeminiChatRequest{},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := ValidateUnifiedImageEntryPoint(test.info, test.request)
			require.Error(t, err)
			assert.Contains(t, err.Error(), "POST /v1/images/generations")
		})
	}
}

func TestValidateUnifiedImageEntryPointAllowsTextOutputWithImageInput(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeChatCompletions,
		OriginModelName: "gpt-4o",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-4o",
		},
	}
	request := &dto.GeneralOpenAIRequest{
		Messages: []dto.Message{
			{
				Role: "user",
				Content: []dto.MediaContent{
					{Type: dto.ContentTypeText, Text: "describe this image"},
					{
						Type: dto.ContentTypeImageURL,
						ImageUrl: map[string]any{
							"url": "https://example.com/input.png",
						},
					},
				},
			},
		},
	}

	require.NoError(t, ValidateUnifiedImageEntryPoint(info, request))
}

func TestValidateUnifiedImagePayloadRejectsOverrideInjectedIntent(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeChatCompletions,
		OriginModelName: "gpt-4o",
	}
	tests := []struct {
		name    string
		payload string
	}{
		{
			name:    "responses tool",
			payload: `{"model":"gpt-5","tools":[{"type":"image_generation"}]}`,
		},
		{
			name:    "openai modality",
			payload: `{"model":"gpt-4o","modalities":["text","image"]}`,
		},
		{
			name:    "gemini response modality",
			payload: `{"generationConfig":{"responseModalities":["IMAGE"]}}`,
		},
		{
			name:    "gemini image config",
			payload: `{"generation_config":{"image_config":{"aspect_ratio":"1:1"}}}`,
		},
		{
			name:    "overridden model",
			payload: `{"model":"nano-banana-2"}`,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := ValidateUnifiedImagePayload(info, []byte(test.payload))
			require.Error(t, err)
			assert.Contains(t, err.Error(), "POST /v1/images/generations")
		})
	}
}

func TestValidateUnifiedImagePayloadAllowsImageInputForTextOutput(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeChatCompletions,
		OriginModelName: "gpt-4o",
	}
	payload := []byte(`{
		"model":"gpt-4o",
		"messages":[{
			"role":"user",
			"content":[
				{"type":"text","text":"describe this image"},
				{"type":"image_url","image_url":{"url":"https://example.com/input.png"}}
			]
		}]
	}`)

	require.NoError(t, ValidateUnifiedImagePayload(info, payload))
}

func TestValidateUnifiedImagePayloadStorageRejectsHiddenIntentAndRewinds(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeGemini,
		OriginModelName: "gemini-2.5-flash",
	}
	storage, err := rootcommon.CreateBodyStorage([]byte(`{
		"contents":[{"role":"user","parts":[{"text":"draw a cat"}]}],
		"generationConfig":{
			"responseModalities":["IMAGE"],
			"response_modalities":["TEXT"]
		}
	}`))
	require.NoError(t, err)
	defer storage.Close()

	err = ValidateUnifiedImagePayloadStorage(info, storage)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "POST /v1/images/generations")

	position, seekErr := storage.Seek(0, io.SeekCurrent)
	require.NoError(t, seekErr)
	assert.Equal(t, int64(0), position)
}

func TestValidateUnifiedImagePayloadStorageRejectsAmbiguousPassThroughImageIntent(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeChatCompletions,
		OriginModelName: "gpt-5",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelSetting: dto.ChannelSettings{PassThroughBodyEnabled: true},
		},
	}
	tests := []struct {
		name string
		body string
	}{
		{
			name: "responses case variant cannot hide canonical tool",
			body: `{"model":"gpt-5","input":"draw","tools":[{"type":"image_generation"}],"Tools":[]}`,
		},
		{
			name: "gemini case variant cannot hide canonical generation config",
			body: `{"generationConfig":{"responseModalities":["IMAGE"]},"GenerationConfig":{"responseModalities":["TEXT"]}}`,
		},
		{
			name: "duplicate sensitive key is rejected",
			body: `{"model":"gpt-5","tools":[{"type":"image_generation"}],"tools":[]}`,
		},
		{
			name: "tool type case variant is rejected",
			body: `{"model":"gpt-5","tools":[{"Type":"image_generation","type":"function"}]}`,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			storage, err := rootcommon.CreateBodyStorage([]byte(test.body))
			require.NoError(t, err)
			defer storage.Close()

			err = ValidateUnifiedImagePayloadStorage(info, storage)

			require.Error(t, err)
			assert.Contains(t, err.Error(), "POST /v1/images/generations")
			position, seekErr := storage.Seek(0, io.SeekCurrent)
			require.NoError(t, seekErr)
			assert.Equal(t, int64(0), position)
		})
	}
}

func TestValidateUnifiedImagePayloadStorageAllowsCanonicalPassThroughText(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeChatCompletions,
		OriginModelName: "gpt-5",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelSetting: dto.ChannelSettings{PassThroughBodyEnabled: true},
		},
	}
	storage, err := rootcommon.CreateBodyStorage([]byte(`{
		"model":"gpt-5",
		"messages":[{"role":"user","content":"describe the input image"}],
		"tools":[{"type":"function","function":{"name":"lookup"}}]
	}`))
	require.NoError(t, err)
	defer storage.Close()

	require.NoError(t, ValidateUnifiedImagePayloadStorage(info, storage))
}

type bodyStorageWithoutBytes struct {
	*bytes.Reader
	size int64
}

func (storage *bodyStorageWithoutBytes) Close() error { return nil }

func (storage *bodyStorageWithoutBytes) Bytes() ([]byte, error) {
	return nil, errors.New("Bytes must not be called by the streaming image payload scanner")
}

func (storage *bodyStorageWithoutBytes) Size() int64 { return storage.size }

func (storage *bodyStorageWithoutBytes) IsDisk() bool { return true }

func TestValidateUnifiedImagePayloadStorageStreamsLargeUnknownValues(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeChatCompletions,
		OriginModelName: "gpt-5",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelSetting: dto.ChannelSettings{PassThroughBodyEnabled: true},
		},
	}
	body := make([]byte, 0, (2<<20)+128)
	body = append(body, `{"model":"gpt-5","messages":[{"role":"user","content":"`...)
	body = append(body, bytes.Repeat([]byte("a"), 2<<20)...)
	body = append(body, `"}],"tools":[{"type":"function"}]}`...)
	storage := &bodyStorageWithoutBytes{
		Reader: bytes.NewReader(body),
		size:   int64(len(body)),
	}

	require.NoError(t, ValidateUnifiedImagePayloadStorage(info, storage))
	position, err := storage.Seek(0, io.SeekCurrent)
	require.NoError(t, err)
	assert.Equal(t, int64(0), position)
}

func TestValidateUnifiedImageParamOverrideRejectsPotentialImageOutputWrites(t *testing.T) {
	tests := []struct {
		name          string
		upstreamModel string
		override      map[string]any
	}{
		{
			name:     "legacy image model",
			override: map[string]any{"model": "nano-banana-2"},
		},
		{
			name: "legacy nested image config",
			override: map[string]any{
				"extra_body": map[string]any{
					"google": map[string]any{
						"image_config": map[string]any{"aspect_ratio": "1:1"},
					},
				},
			},
		},
		{
			name: "copy converted field into image config",
			override: map[string]any{
				"operations": []any{map[string]any{
					"mode": "copy",
					"from": "contents",
					"to":   "generationConfig.imageConfig",
				}},
			},
		},
		{
			name: "copy arbitrary source into indexed tool type",
			override: map[string]any{
				"operations": []any{map[string]any{
					"mode": "copy",
					"from": "contents.0.role",
					"to":   "tools.99.type",
				}},
			},
		},
		{
			name: "conditional image modality write",
			override: map[string]any{
				"operations": []any{map[string]any{
					"mode":  "set",
					"path":  "generationConfig.responseModalities",
					"value": []any{"IMAGE"},
					"conditions": []any{map[string]any{
						"path":  "contents.0.role",
						"mode":  "full",
						"value": "user",
					}},
				}},
			},
		},
		{
			name: "shorthand condition writes image model",
			override: map[string]any{
				"operations": []any{map[string]any{
					"mode":  "set",
					"path":  "model",
					"value": "gpt-image-2",
					"conditions": map[string]any{
						"retry_index": 1,
					},
				}},
			},
		},
		{
			name: "sjson colon path writes image model",
			override: map[string]any{
				"operations": []any{map[string]any{
					"mode":  "set",
					"path":  ":model",
					"value": "gpt-image-2",
				}},
			},
		},
		{
			name: "sjson escaped path writes image model",
			override: map[string]any{
				"operations": []any{map[string]any{
					"mode":  "set",
					"path":  "mode\\l",
					"value": "gpt-image-2",
				}},
			},
		},
		{
			name:          "append completes image model",
			upstreamModel: "gpt-image",
			override: map[string]any{
				"operations": []any{map[string]any{
					"mode":  "append",
					"path":  "model",
					"value": "-2",
				}},
			},
		},
		{
			name:          "sequential affixes complete image model",
			upstreamModel: "image",
			override: map[string]any{
				"operations": []any{
					map[string]any{
						"mode":  "ensure_prefix",
						"path":  "model",
						"value": "gpt-",
					},
					map[string]any{
						"mode":  "ensure_suffix",
						"path":  "model",
						"value": "-2",
					},
				},
			},
		},
		{
			name:          "legacy model then operation completes image model",
			upstreamModel: "gpt-5",
			override: map[string]any{
				"model": "gpt-image",
				"operations": []any{map[string]any{
					"mode":  "append",
					"path":  "model",
					"value": "-2",
				}},
			},
		},
		{
			name: "replace second modality with image",
			override: map[string]any{
				"operations": []any{map[string]any{
					"mode": "replace",
					"path": "modalities.1",
					"from": "audio",
					"to":   "image",
				}},
			},
		},
		{
			name: "append can complete client modality fragment",
			override: map[string]any{
				"operations": []any{map[string]any{
					"mode":  "append",
					"path":  "modalities.0",
					"value": "ge",
				}},
			},
		},
		{
			name: "replace can complete client tool type fragment",
			override: map[string]any{
				"operations": []any{map[string]any{
					"mode": "replace",
					"path": "tools.0.type",
					"from": "X",
					"to":   "_",
				}},
			},
		},
		{
			name: "trim can reveal client modality",
			override: map[string]any{
				"operations": []any{map[string]any{
					"mode":  "trim_prefix",
					"path":  "modalities.0",
					"value": "not",
				}},
			},
		},
		{
			name: "ensure can complete client modality fragment",
			override: map[string]any{
				"operations": []any{map[string]any{
					"mode":  "ensure_prefix",
					"path":  "modalities.0",
					"value": "im",
				}},
			},
		},
		{
			name: "wildcard can complete client modality fragment",
			override: map[string]any{
				"operations": []any{map[string]any{
					"mode":  "append",
					"path":  "*.0",
					"value": "ge",
				}},
			},
		},
		{
			name: "wildcard can complete client tool type fragment",
			override: map[string]any{
				"operations": []any{map[string]any{
					"mode":  "append",
					"path":  "*.*.type",
					"value": "generation",
				}},
			},
		},
		{
			name: "question wildcard can complete client modality fragment",
			override: map[string]any{
				"operations": []any{map[string]any{
					"mode":  "append",
					"path":  "modalitie?.0",
					"value": "ge",
				}},
			},
		},
		{
			name: "question wildcard can complete client tool type fragment",
			override: map[string]any{
				"operations": []any{map[string]any{
					"mode":  "append",
					"path":  "t?ols.0.type",
					"value": "generation",
				}},
			},
		},
		{
			name: "query selector can set matching client tool type",
			override: map[string]any{
				"operations": []any{map[string]any{
					"mode":  "set",
					"path":  `t?ols.#(type=="custom").type`,
					"value": "image_generation",
				}},
			},
		},
		{
			name: "set arbitrary tool type to image generation",
			override: map[string]any{
				"operations": []any{map[string]any{
					"mode":  "set",
					"path":  "tools.99.type",
					"value": "image_generation",
				}},
			},
		},
		{
			name: "header sync into model",
			override: map[string]any{
				"operations": []any{map[string]any{
					"mode": "sync_fields",
					"from": "header:x-upstream-model",
					"to":   "json:model",
				}},
			},
		},
		{
			name:          "model transform reveals image model",
			upstreamModel: "proxy/gpt-image-2",
			override: map[string]any{
				"operations": []any{map[string]any{
					"mode":  "trim_prefix",
					"path":  "model",
					"value": "proxy/",
				}},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			upstreamModel := test.upstreamModel
			if upstreamModel == "" {
				upstreamModel = "gpt-5"
			}
			info := &relaycommon.RelayInfo{
				RelayMode:       relayconstant.RelayModeChatCompletions,
				OriginModelName: "gpt-5",
				ChannelMeta: &relaycommon.ChannelMeta{
					UpstreamModelName: upstreamModel,
					ParamOverride:     test.override,
				},
			}

			err := ValidateUnifiedImageParamOverride(info)

			require.Error(t, err)
			assert.Contains(t, err.Error(), "POST /v1/images/generations")
		})
	}
}

func TestValidateUnifiedImageParamOverrideAllowsBenignAndPassThroughOverrides(t *testing.T) {
	tests := []struct {
		name          string
		relayMode     int
		passThrough   bool
		paramOverride map[string]any
	}{
		{
			name:          "legacy temperature",
			paramOverride: map[string]any{"temperature": 0.2},
		},
		{
			name: "provider temperature operation",
			paramOverride: map[string]any{
				"operations": []any{map[string]any{
					"mode":  "set",
					"path":  "generationConfig.temperature",
					"value": 0.2,
				}},
			},
		},
		{
			name: "safe wildcard tool schema trim",
			paramOverride: map[string]any{
				"operations": []any{map[string]any{
					"mode": "trim_space",
					"path": "tools.*.custom.name",
				}},
			},
		},
		{
			name: "safe modality set",
			paramOverride: map[string]any{
				"operations": []any{map[string]any{
					"mode":  "set",
					"path":  "modalities.1",
					"value": "text",
				}},
			},
		},
		{
			name: "function tool set",
			paramOverride: map[string]any{
				"operations": []any{map[string]any{
					"mode": "set",
					"path": "tools",
					"value": []any{map[string]any{
						"type": "function",
					}},
				}},
			},
		},
		{
			name: "text model override",
			paramOverride: map[string]any{
				"operations": []any{map[string]any{
					"mode":  "set",
					"path":  "model",
					"value": "gpt-5-mini",
				}},
			},
		},
		{
			name: "benign sequential model transform",
			paramOverride: map[string]any{
				"operations": []any{
					map[string]any{
						"mode":  "set",
						"path":  "model",
						"value": "gpt",
					},
					map[string]any{
						"mode":  "append",
						"path":  "model",
						"value": "-5-mini",
					},
				},
			},
		},
		{
			name: "delete image config",
			paramOverride: map[string]any{
				"operations": []any{map[string]any{
					"mode": "delete",
					"path": "generationConfig.imageConfig",
				}},
			},
		},
		{
			name:        "pass through ignores image override",
			passThrough: true,
			paramOverride: map[string]any{
				"tools": []any{map[string]any{"type": "image_generation"}},
			},
		},
		{
			name:      "canonical image task allows image override",
			relayMode: relayconstant.RelayModeImagesGenerations,
			paramOverride: map[string]any{
				"model": "nano-banana-2",
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			relayMode := test.relayMode
			if relayMode == 0 {
				relayMode = relayconstant.RelayModeChatCompletions
			}
			info := &relaycommon.RelayInfo{
				RelayMode:       relayMode,
				OriginModelName: "gpt-5",
				ChannelMeta: &relaycommon.ChannelMeta{
					UpstreamModelName: "gpt-5",
					ParamOverride:     test.paramOverride,
					ChannelSetting: dto.ChannelSettings{
						PassThroughBodyEnabled: test.passThrough,
					},
				},
			}

			require.NoError(t, ValidateUnifiedImageParamOverride(info))
		})
	}
}
