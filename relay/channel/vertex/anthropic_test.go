package vertex

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func vertexMessagesFixture(t *testing.T, stream bool) (*gin.Context, *httptest.ResponseRecorder, *relaycommon.RelayInfo, *Adaptor) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatClaude, IsStream: stream, OriginModelName: "gemini-2.5-flash",
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gemini-2.5-flash"},
	}
	info.SetEstimatePromptTokens(99)
	adaptor := &Adaptor{}
	adaptor.Init(info)
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 300
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })
	return c, recorder, info, adaptor
}

func TestVertexAnthropicRequestConvertsToGemini(t *testing.T) {
	c, _, info, adaptor := vertexMessagesFixture(t, false)
	var request dto.ClaudeRequest
	require.NoError(t, common.UnmarshalJsonStr(`{
		"model":"gemini-2.5-flash","max_tokens":123,"temperature":0,"top_p":0,"top_k":0,
		"system":[{"type":"text","text":"Be precise"}],"stop_sequences":["END"],
		"tools":[{"name":"lookup","description":"Lookup","input_schema":{"type":"object","properties":{"city":{"type":"string"}}}}],
		"messages":[
			{"role":"user","content":[{"type":"text","text":"Weather?"},{"type":"image","source":{"type":"base64","media_type":"image/png","data":"aGVsbG8="}}]},
			{"role":"assistant","content":[{"type":"tool_use","id":"toolu_1","name":"lookup","input":{"city":"Paris"},"signature":"gemini-signature"}]},
			{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_1","content":"Sunny"}]}
		]}`, &request))
	oldRemoveIDs := model_setting.GetGeminiSettings().RemoveFunctionResponseIdEnabled
	t.Cleanup(func() { model_setting.GetGeminiSettings().RemoveFunctionResponseIdEnabled = oldRemoveIDs })
	for _, removeIDs := range []bool{true, false} {
		model_setting.GetGeminiSettings().RemoveFunctionResponseIdEnabled = removeIDs
		value, err := adaptor.ConvertClaudeRequest(c, info, &request)
		require.NoError(t, err)
		geminiRequest, ok := value.(*dto.GeminiChatRequest)
		require.True(t, ok, "must never forward an Anthropic envelope to generateContent")
		data, err := common.Marshal(geminiRequest)
		require.NoError(t, err)
		var wire map[string]any
		require.NoError(t, common.Unmarshal(data, &wire))
		assert.NotContains(t, wire, "messages")
		assert.NotContains(t, wire, "anthropic_version")
		config := wire["generationConfig"].(map[string]any)
		assert.Equal(t, float64(123), config["maxOutputTokens"])
		assert.Equal(t, float64(0), config["temperature"])
		assert.Equal(t, float64(0), config["topP"])
		assert.Equal(t, float64(0), config["topK"])
		assert.Equal(t, []any{"END"}, config["stopSequences"])
		assert.Contains(t, string(data), "Be precise")
		require.Len(t, geminiRequest.Contents, 3)
		assert.Equal(t, "aGVsbG8=", geminiRequest.Contents[0].Parts[1].InlineData.Data)
		call := geminiRequest.Contents[1].Parts[0].FunctionCall
		assert.Equal(t, "lookup", call.FunctionName)
		assert.JSONEq(t, `"gemini-signature"`, string(geminiRequest.Contents[1].Parts[0].ThoughtSignature))
		result := geminiRequest.Contents[2].Parts[0].FunctionResponse
		assert.Equal(t, "lookup", result.Name)
		assert.Contains(t, string(data), "Sunny")
		if removeIDs {
			assert.Empty(t, call.ID)
			assert.Empty(t, result.ID)
		} else {
			assert.Equal(t, "toolu_1", call.ID)
			assert.JSONEq(t, `"toolu_1"`, string(result.ID))
		}
	}
	request.Thinking = &dto.Thinking{Type: "enabled", BudgetTokens: common.GetPointer(1024)}
	value, err := adaptor.ConvertClaudeRequest(c, info, &request)
	require.NoError(t, err)
	require.NotNil(t, value.(*dto.GeminiChatRequest).GenerationConfig.ThinkingConfig)
	assert.Equal(t, 1024, *value.(*dto.GeminiChatRequest).GenerationConfig.ThinkingConfig.ThinkingBudget)
	var assistant dto.ClaudeMessage
	require.NoError(t, common.UnmarshalJsonStr(`{"role":"assistant","content":[
		{"type":"thinking","thinking":"Looking up the forecast","signature":"thought-signature"},
		{"type":"text","text":"Checking the weather"},
		{"type":"tool_use","id":"toolu_1","name":"lookup","input":{"city":"Paris"},"signature":"gemini-signature"},
		{"type":"text","text":"Waiting for the result"}]}`, &assistant))
	request.Messages[1] = assistant
	request.ToolChoice = map[string]any{"type": "tool", "name": "lookup"}
	value, err = adaptor.ConvertClaudeRequest(c, info, &request)
	require.NoError(t, err)
	geminiRequest := value.(*dto.GeminiChatRequest)
	require.Len(t, geminiRequest.Contents[1].Parts, 4)
	assert.True(t, geminiRequest.Contents[1].Parts[0].Thought)
	assert.Equal(t, "Looking up the forecast", geminiRequest.Contents[1].Parts[0].Text)
	assert.JSONEq(t, `"thought-signature"`, string(geminiRequest.Contents[1].Parts[0].ThoughtSignature))
	assert.Equal(t, "Checking the weather", geminiRequest.Contents[1].Parts[1].Text)
	assert.Equal(t, "lookup", geminiRequest.Contents[1].Parts[2].FunctionCall.FunctionName)
	assert.JSONEq(t, `"gemini-signature"`, string(geminiRequest.Contents[1].Parts[2].ThoughtSignature))
	assert.Equal(t, "Waiting for the result", geminiRequest.Contents[1].Parts[3].Text)
	assert.Equal(t, "lookup", geminiRequest.Contents[2].Parts[0].FunctionResponse.Name)
	assert.Equal(t, map[string]any{"output": map[string]any{"content": "Sunny"}}, geminiRequest.Contents[2].Parts[0].FunctionResponse.Response)
	assert.Equal(t, dto.FunctionCallingConfigMode("ANY"), geminiRequest.ToolConfig.FunctionCallingConfig.Mode)
	assert.Equal(t, []string{"lookup"}, geminiRequest.ToolConfig.FunctionCallingConfig.AllowedFunctionNames)

	adaptor.RequestMode = RequestModeOpenSource
	_, err = adaptor.ConvertClaudeRequest(c, info, &request)
	require.ErrorContains(t, err, "unsupported")
	adaptor.RequestMode = RequestModeClaude
	request.Model = "claude-sonnet-4-5-20250929"
	info.UpstreamModelName = request.Model
	value, err = adaptor.ConvertClaudeRequest(c, info, &request)
	require.NoError(t, err)
	wire, err := common.Marshal(value)
	require.NoError(t, err)
	assert.Contains(t, string(wire), `"anthropic_version":"vertex-2023-10-16"`)
	assert.NotContains(t, string(wire), `"contents"`)
}

func TestVertexAnthropicRejectsUnsupportedGeminiSemantics(t *testing.T) {
	for _, tc := range []struct {
		name, extra, messages string
	}{
		{"container", `"container":{"id":"session"}`, ""},
		{"context management", `"context_management":{"edits":[]}`, ""},
		{"output schema", `"output_config":{"format":{"type":"json_schema"}}`, ""},
		{"parallel tool restriction", `"tools":[{"name":"lookup","input_schema":{"type":"object"}}],"tool_choice":{"type":"auto","disable_parallel_tool_use":true}`, ""},
		{"image reference", "", `[{"role":"user","content":[{"type":"image","source":{"type":"file","file_id":"file_1"}}]}]`},
		{"audio block", "", `[{"role":"user","content":[{"type":"audio","data":"aGVsbG8="}]}]`},
		{"redacted thinking", "", `[{"role":"assistant","content":[{"type":"redacted_thinking","data":"opaque"},{"type":"text","text":"Answer"}]}]`},
		{"thinking only", "", `[{"role":"assistant","content":[{"type":"thinking","thinking":"Reasoning","signature":"opaque"}]}]`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, _, info, adaptor := vertexMessagesFixture(t, false)
			messages := tc.messages
			if messages == "" {
				messages = `[{"role":"user","content":"Hello"}]`
			}
			body := `{"model":"gemini-2.5-flash","max_tokens":32,"messages":` + messages
			if tc.extra != "" {
				body += "," + tc.extra
			}
			body += "}"
			var request dto.ClaudeRequest
			require.NoError(t, common.UnmarshalJsonStr(body, &request))
			value, err := adaptor.ConvertClaudeRequest(c, info, &request)
			require.Error(t, err, "must reject features that would be silently discarded")
			assert.Nil(t, value)
		})
	}
}

func TestVertexAnthropicClaudeCodeCacheHintsAndToolErrors(t *testing.T) {
	c, _, info, adaptor := vertexMessagesFixture(t, false)
	var request dto.ClaudeRequest
	require.NoError(t, common.UnmarshalJsonStr(`{
		"model":"gemini-2.5-flash","max_tokens":1024,"temperature":0,
		"cache_control":{"type":"ephemeral"},"service_tier":"auto",
		"system":[{"type":"text","text":"You are a coding assistant","cache_control":{"type":"ephemeral","ttl":"1h"}}],
		"tools":[
			{"name":"Bash","input_schema":{"type":"object","properties":{"command":{"type":"string"}}},"cache_control":{"type":"ephemeral"}},
			{"name":"Read","input_schema":{"type":"object","properties":{"file_path":{"type":"string"}}},"cache_control":{"type":"ephemeral"}}
		],
		"messages":[
			{"role":"user","content":[{"type":"text","text":"Inspect the project","cache_control":{"type":"ephemeral"}}]},
			{"role":"assistant","content":[
				{"type":"thinking","thinking":"Inspect files first","signature":"thought-signature"},
				{"type":"text","text":"Checking the project","cache_control":{"type":"ephemeral"},"citations":[{"type":"web_search_result_location","url":"https://reference.example","cited_text":"Project guidance"}]},
				{"type":"tool_use","id":"call_bash","name":"Bash","input":{"command":"ls"},"signature":"bash-signature"},
				{"type":"text","text":"Then read the file"},
				{"type":"tool_use","id":"call_read","name":"Read","input":{"file_path":"missing.go"},"signature":"read-signature"}
			]},
			{"role":"user","content":[
				{"type":"tool_result","tool_use_id":"call_read","is_error":true,"content":[{"type":"text","text":"File not found"}],"cache_control":{"type":"ephemeral"}},
				{"type":"tool_result","tool_use_id":"call_bash","is_error":false,"content":"main.go"}
			]}
		]}`, &request))
	oldRemoveIDs := model_setting.GetGeminiSettings().RemoveFunctionResponseIdEnabled
	t.Cleanup(func() { model_setting.GetGeminiSettings().RemoveFunctionResponseIdEnabled = oldRemoveIDs })
	for _, removeIDs := range []bool{false, true} {
		model_setting.GetGeminiSettings().RemoveFunctionResponseIdEnabled = removeIDs
		value, err := adaptor.ConvertClaudeRequest(c, info, &request)
		require.NoError(t, err)
		geminiRequest := value.(*dto.GeminiChatRequest)
		require.Len(t, geminiRequest.Contents, 3)
		parts := geminiRequest.Contents[1].Parts
		require.Len(t, parts, 5)
		assert.True(t, parts[0].Thought)
		assert.Equal(t, "Inspect files first", parts[0].Text)
		assert.JSONEq(t, `"thought-signature"`, string(parts[0].ThoughtSignature))
		assert.Equal(t, "Checking the project", parts[1].Text)
		assert.Equal(t, "Bash", parts[2].FunctionCall.FunctionName)
		assert.JSONEq(t, `"bash-signature"`, string(parts[2].ThoughtSignature))
		assert.Equal(t, "Then read the file", parts[3].Text)
		assert.Equal(t, "Read", parts[4].FunctionCall.FunctionName)
		assert.JSONEq(t, `"read-signature"`, string(parts[4].ThoughtSignature))
		responses := geminiRequest.Contents[2].Parts
		require.Len(t, responses, 2)
		assert.Equal(t, "Read", responses[0].FunctionResponse.Name)
		assert.Equal(t, map[string]any{"error": map[string]any{"content": "File not found"}}, responses[0].FunctionResponse.Response)
		assert.Equal(t, "Bash", responses[1].FunctionResponse.Name)
		assert.Equal(t, map[string]any{"output": map[string]any{"content": "main.go"}}, responses[1].FunctionResponse.Response)
		if removeIDs {
			assert.Empty(t, parts[2].FunctionCall.ID)
			assert.Empty(t, responses[0].FunctionResponse.ID)
		} else {
			assert.Equal(t, "call_bash", parts[2].FunctionCall.ID)
			assert.JSONEq(t, `"call_read"`, string(responses[0].FunctionResponse.ID))
		}
		wire, err := common.Marshal(geminiRequest)
		require.NoError(t, err)
		assert.Contains(t, string(wire), "You are a coding assistant")
		assert.NotContains(t, string(wire), `"cache_control"`)
		assert.NotContains(t, string(wire), `"citations"`)
		assert.NotContains(t, string(wire), `"is_error"`)
	}
}

func TestVertexAnthropicNonstreamResponses(t *testing.T) {
	for _, tc := range []struct {
		name, parts, finish, reason string
	}{
		{"text", `[{"text":"Hello"}]`, "STOP", "end_turn"},
		{"tools", `[{"text":"Checking"},{"functionCall":{"name":"lookup","args":{"city":"Paris"}}},{"functionCall":{"name":"lookup","args":{"city":"London"}}}]`, "STOP", "tool_use"},
		{"thinking", `[{"thought":true,"text":"First","thoughtSignature":"signature-1"},{"text":"Answer"},{"thought":true,"text":"Second","thoughtSignature":"signature-2"}]`, "MAX_TOKENS", "max_tokens"},
		{"separate signature", `[{"thought":true,"text":"Reasoning"},{"thoughtSignature":"signature-1"},{"text":"Answer"}]`, "STOP", "end_turn"},
		{"truncated tool", `[{"functionCall":{"name":"lookup","args":{}}}]`, "MAX_TOKENS", "max_tokens"},
		{"safety", `[{"text":"Cannot answer"}]`, "SAFETY", "refusal"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, recorder, info, adaptor := vertexMessagesFixture(t, false)
			body := `{"candidates":[{"content":{"role":"model","parts":` + tc.parts + `},"finishReason":"` + tc.finish + `"}],"usageMetadata":{"promptTokenCount":12,"candidatesTokenCount":8,"thoughtsTokenCount":2,"cachedContentTokenCount":3,"totalTokenCount":22}}`
			usage, apiErr := adaptor.DoResponse(c, &http.Response{StatusCode: 200, Header: http.Header{}, Body: io.NopCloser(strings.NewReader(body))}, info)
			require.Nil(t, apiErr)
			require.NotNil(t, usage)
			var response dto.ClaudeResponse
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
			assert.Equal(t, "message", response.Type)
			assert.Equal(t, "assistant", response.Role)
			assert.Equal(t, "gemini-2.5-flash", response.Model)
			assert.NotEmpty(t, response.Id)
			assert.Equal(t, tc.reason, response.StopReason)
			require.NotNil(t, response.Usage)
			assert.Equal(t, 9, response.Usage.InputTokens)
			assert.Equal(t, 3, response.Usage.CacheReadInputTokens)
			assert.Equal(t, 10, response.Usage.OutputTokens)
			switch tc.name {
			case "tools":
				require.Len(t, response.Content, 3)
				assert.Equal(t, map[string]any{"city": "Paris"}, response.Content[1].Input)
				assert.Equal(t, map[string]any{"city": "London"}, response.Content[2].Input)
				assert.NotEqual(t, response.Content[1].Id, response.Content[2].Id)
			case "thinking":
				require.Len(t, response.Content, 3)
				assert.Equal(t, "thinking", response.Content[0].Type)
				assert.Equal(t, "signature-1", response.Content[0].Signature)
				assert.Equal(t, "text", response.Content[1].Type)
				assert.Equal(t, "signature-2", response.Content[2].Signature)
			case "separate signature":
				require.Len(t, response.Content, 2)
				assert.Equal(t, "signature-1", response.Content[0].Signature)
			}
		})
	}
}

func vertexClaudeEvents(t *testing.T, recorder *httptest.ResponseRecorder) []dto.ClaudeResponse {
	t.Helper()
	var events []dto.ClaudeResponse
	for line := range strings.SplitSeq(recorder.Body.String(), "\n") {
		data, ok := strings.CutPrefix(line, "data: ")
		if !ok {
			continue
		}
		var event dto.ClaudeResponse
		require.NoError(t, common.UnmarshalJsonStr(data, &event))
		events = append(events, event)
	}
	return events
}

func TestVertexAnthropicStreamBlocksAndTerminalUsage(t *testing.T) {
	for _, tc := range []struct {
		name, frames, reason string
		wantTypes            []string
		wantArgs             []string
	}{
		{"text", `{"candidates":[{"content":{"parts":[{"text":"Hel"}]}}],"usageMetadata":{"promptTokenCount":12,"candidatesTokenCount":1,"totalTokenCount":13}}
{"candidates":[{"content":{"parts":[{"text":"lo"}]},"finishReason":"STOP"}]}`, "end_turn", []string{"text"}, nil},
		{"single tool", `{"candidates":[{"content":{"parts":[{"functionCall":{"name":"lookup","args":{"city":"Paris"}}}]},"finishReason":"STOP"}]}`, "tool_use", []string{"tool_use"}, []string{`{"city":"Paris"}`}},
		{"empty args", `{"candidates":[{"content":{"parts":[{"functionCall":{"name":"lookup"}}]},"finishReason":"STOP"}]}`, "tool_use", []string{"tool_use"}, []string{`{}`}},
		{"multiple tools", `{"candidates":[{"content":{"parts":[{"text":"Checking"},{"functionCall":{"name":"lookup","args":{"city":"Paris"}}},{"functionCall":{"name":"lookup","args":{"city":"London"}}}]}}]}
{"candidates":[{"finishReason":"STOP"}]}`, "tool_use", []string{"text", "tool_use", "tool_use"}, []string{`{"city":"Paris"}`, `{"city":"London"}`}},
		{"partial args", `{"candidates":[{"content":{"parts":[{"thoughtSignature":"tool-signature","functionCall":{"name":"lookup","willContinue":true,"partialArgs":[{"jsonPath":"$.city","stringValue":"Pa"}]}}]}}]}
{"candidates":[{"content":{"parts":[{"functionCall":{"willContinue":false,"partialArgs":[{"jsonPath":"$.city","stringValue":"ris"}]}}]},"finishReason":"STOP"}]}`, "tool_use", []string{"tool_use"}, []string{`{"city":"Paris"}`}},
		{"thinking + partial args", `{"candidates":[{"content":{"parts":[{"thought":true,"text":"Reasoning","thoughtSignature":"thought-signature"},{"thoughtSignature":"tool-signature","functionCall":{"name":"lookup","willContinue":true,"partialArgs":[{"jsonPath":"$.city","stringValue":"Pa"}]}}]}}]}
{"candidates":[{"content":{"parts":[{"functionCall":{"willContinue":false,"partialArgs":[{"jsonPath":"$.city","stringValue":"ris"}]}}]},"finishReason":"STOP"}]}`, "tool_use", []string{"thinking", "tool_use"}, []string{`{"city":"Paris"}`}},
		{"mixed thinking", `{"candidates":[{"content":{"parts":[{"thought":true,"text":"Reasoning","thoughtSignature":"thought-signature"},{"text":"Answer"},{"functionCall":{"name":"lookup","args":{"city":"Paris"}}}]}}]}
{"candidates":[{"finishReason":"STOP"}]}`, "tool_use", []string{"thinking", "text", "tool_use"}, []string{`{"city":"Paris"}`}},
		{"separate signature", `{"candidates":[{"content":{"parts":[{"thought":true,"text":"Reasoning"},{"thoughtSignature":"thought-signature"},{"text":"Answer"}]},"finishReason":"STOP"}]}`, "end_turn", []string{"thinking", "text"}, nil},
		{"max tokens", `{"candidates":[{"content":{"parts":[{"text":"Partial"}]},"finishReason":"MAX_TOKENS"}]}`, "max_tokens", []string{"text"}, nil},
		{"safety", `{"candidates":[{"content":{"parts":[{"text":"Refused"}]},"finishReason":"SAFETY"}]}`, "refusal", []string{"text"}, nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, recorder, info, adaptor := vertexMessagesFixture(t, true)
			var stream strings.Builder
			for frame := range strings.SplitSeq(tc.frames, "\n") {
				stream.WriteString("data: " + frame + "\n\n")
			}
			stream.WriteString("data: " + `{"usageMetadata":{"promptTokenCount":12,"candidatesTokenCount":8,"thoughtsTokenCount":2,"totalTokenCount":22}}` + "\n\n")
			usage, apiErr := adaptor.DoResponse(c, &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(stream.String()))}, info)
			require.Nil(t, apiErr)
			assert.Equal(t, 10, usage.(*dto.Usage).CompletionTokens)
			events := vertexClaudeEvents(t, recorder)
			require.NotEmpty(t, events)
			assert.Equal(t, "message_start", events[0].Type)
			assert.Equal(t, "message_stop", events[len(events)-1].Type)
			open := map[int]string{}
			var blockTypes, args []string
			var messageStops int
			for _, event := range events {
				switch event.Type {
				case "content_block_start":
					require.NotContains(t, open, *event.Index)
					open[*event.Index] = event.ContentBlock.Type
					blockTypes = append(blockTypes, event.ContentBlock.Type)
					if strings.Contains(tc.name, "partial args") && event.ContentBlock.Type == "tool_use" {
						assert.Equal(t, "tool-signature", event.ContentBlock.Signature)
					}
				case "content_block_delta":
					require.Contains(t, open, *event.Index)
					switch event.Delta.Type {
					case "input_json_delta":
						assert.Equal(t, "tool_use", open[*event.Index])
						args = append(args, *event.Delta.PartialJson)
					case "signature_delta":
						assert.Equal(t, "thinking", open[*event.Index])
						assert.Equal(t, "thought-signature", event.Delta.Signature)
					case "text_delta":
						assert.Equal(t, "text", open[*event.Index])
					case "thinking_delta":
						assert.Equal(t, "thinking", open[*event.Index])
					}
				case "content_block_stop":
					require.Contains(t, open, *event.Index)
					delete(open, *event.Index)
				case "message_delta":
					assert.Equal(t, tc.reason, *event.Delta.StopReason)
					assert.Equal(t, 12, event.Usage.InputTokens)
					assert.Equal(t, 10, event.Usage.OutputTokens)
				case "message_stop":
					messageStops++
				}
			}
			assert.Empty(t, open)
			assert.Equal(t, 1, messageStops)
			assert.Equal(t, tc.wantTypes, blockTypes)
			assert.Equal(t, tc.wantArgs, args)
		})
	}
}

func TestVertexAnthropicGroundingPreservesCitations(t *testing.T) {
	parts := `[{"thought":true,"text":"Reasoning","thoughtSignature":"thought-signature"},{"text":"東京"},{"functionCall":{"name":"lookup","args":{}}},{"text":"Sunny"}]`
	metadata := `{"webSearchQueries":["weather"," weather ","forecast"],"groundingChunks":[{"web":{"uri":"https://city.example","title":"City"}},{"web":{"uri":"https://weather.example","title":"Weather"}}],"groundingSupports":[{"segment":{"partIndex":1,"startIndex":0,"endIndex":6,"text":"東京"},"groundingChunkIndices":[0]},{"segment":{"partIndex":3,"startIndex":0,"endIndex":5,"text":"Sunny"},"groundingChunkIndices":[1]}]}`
	tokens := `"usageMetadata":{"promptTokenCount":12,"candidatesTokenCount":8,"totalTokenCount":20}`
	for _, mode := range []string{"nonstream", "combined stream", "delayed stream"} {
		t.Run(mode, func(t *testing.T) {
			c, recorder, info, adaptor := vertexMessagesFixture(t, mode != "nonstream")
			body := `{"candidates":[{"content":{"role":"model","parts":` + parts + `},"finishReason":"STOP","groundingMetadata":` + metadata + `}],` + tokens + `}`
			if mode == "combined stream" {
				body = "data: " + body + "\n\n"
			} else if mode == "delayed stream" {
				body = "data: " + `{"candidates":[{"content":{"parts":` + parts + `}}],` + tokens + `}` + "\n\n" +
					"data: " + `{"candidates":[{"finishReason":"STOP","groundingMetadata":` + metadata + `}]}` + "\n\n" +
					"data: " + `{"candidates":[{"groundingMetadata":` + metadata + `}]}` + "\n\n"
			}
			usage, apiError := adaptor.DoResponse(c, &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body))}, info)
			require.Nil(t, apiError)
			assert.Equal(t, 12, usage.(*dto.Usage).PromptTokens)
			assert.Equal(t, 8, usage.(*dto.Usage).CompletionTokens)
			require.NotNil(t, info.ResponsesUsageInfo)
			require.Contains(t, info.ResponsesUsageInfo.BuiltInTools, dto.BuildInToolGoogleSearch)
			assert.Equal(t, 2, info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolGoogleSearch].CallCount)
			assert.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools[relaycommon.GoogleSearchGroundedPromptTool].CallCount)
			if mode == "nonstream" {
				var response dto.ClaudeResponse
				require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
				require.Len(t, response.Content, 4)
				assert.Equal(t, "thinking", response.Content[0].Type)
				assert.JSONEq(t, `[{"type":"web_search_result_location","url":"https://city.example","title":"City","cited_text":"東京"}]`, string(response.Content[1].Citations))
				assert.Equal(t, "tool_use", response.Content[2].Type)
				assert.JSONEq(t, `[{"type":"web_search_result_location","url":"https://weather.example","title":"Weather","cited_text":"Sunny"}]`, string(response.Content[3].Citations))
				return
			}
			var urls []string
			open := map[int]string{}
			events := vertexClaudeEvents(t, recorder)
			for _, event := range events {
				switch event.Type {
				case "content_block_start":
					open[*event.Index] = event.ContentBlock.Type
				case "content_block_stop":
					delete(open, *event.Index)
				case "content_block_delta":
					if event.Delta.Type == "citations_delta" {
						assert.Equal(t, "text", open[*event.Index])
						var citation map[string]any
						require.NoError(t, common.Unmarshal(event.Delta.Citation, &citation))
						assert.Equal(t, "web_search_result_location", citation["type"])
						urls = append(urls, citation["url"].(string))
					}
				}
			}
			assert.Equal(t, []string{"https://city.example", "https://weather.example"}, urls)
			assert.Equal(t, "message_stop", events[len(events)-1].Type)
		})
	}
}

type vertexBrokenStream struct {
	io.Reader
}

func (r vertexBrokenStream) Read(p []byte) (int, error) {
	n, err := r.Reader.Read(p)
	if err == io.EOF {
		err = errors.New("interrupted upstream")
	}
	return n, err
}

type vertexCancelStreamWriter struct {
	gin.ResponseWriter
	cancel context.CancelFunc
}

func (w vertexCancelStreamWriter) Write(data []byte) (int, error) {
	n, err := w.ResponseWriter.Write(data)
	if strings.Contains(string(data), "event: content_block_delta\n") {
		w.cancel()
	}
	return n, err
}

func TestVertexAnthropicFailedStreamsNeverStopSuccessfully(t *testing.T) {
	first := `data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}],"usageMetadata":{"promptTokenCount":12,"candidatesTokenCount":8,"totalTokenCount":20}}` + "\n\n"
	for _, tc := range []struct {
		name, suffix      string
		broken, cancelled bool
	}{
		{"malformed", "data: {broken\n\n", false, false},
		{"upstream error", "data: " + `{"error":{"code":503,"status":"UNAVAILABLE","message":"Try later"}}` + "\n\n", false, false},
		{"prompt blocked", "data: " + `{"promptFeedback":{"blockReason":"SAFETY"}}` + "\n\n", false, false},
		{"error after terminal", "data: " + `{"candidates":[{"finishReason":"STOP"}]}` + "\n\n" + "data: " + `{"error":{"code":500,"message":"Failed"}}` + "\n\n", false, false},
		{"truncated", "", false, false},
		{"interrupted", "", true, false},
		{"cancelled", "", false, true},
		{"cancelled after content", "", false, true},
		{"unfinished partial call", "data: " + `{"candidates":[{"content":{"parts":[{"functionCall":{"name":"lookup","willContinue":true,"partialArgs":[{"jsonPath":"$.city","stringValue":"Pa"}]}}]},"finishReason":"STOP"}]}` + "\n\n", false, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, recorder, info, adaptor := vertexMessagesFixture(t, true)
			var reader io.Reader = strings.NewReader(first + tc.suffix)
			if tc.broken {
				reader = vertexBrokenStream{reader}
			}
			if tc.cancelled {
				ctx, cancel := context.WithCancel(c.Request.Context())
				t.Cleanup(cancel)
				c.Request = c.Request.WithContext(ctx)
				if tc.name == "cancelled after content" {
					c.Writer = vertexCancelStreamWriter{ResponseWriter: c.Writer, cancel: cancel}
				} else {
					cancel()
				}
			}
			usage, apiErr := adaptor.DoResponse(c, &http.Response{StatusCode: 200, Body: io.NopCloser(reader)}, info)
			require.Nil(t, apiErr, "handled SSE failures must not trigger controller JSON or retries")
			assert.NotContains(t, recorder.Body.String(), "message_stop")
			if tc.cancelled {
				assert.NotContains(t, recorder.Body.String(), "event: error")
				assert.Equal(t, string(relaycommon.ResponseOutcomeCancelled), info.StreamStatus.ResponseOutcome())
				if tc.name == "cancelled after content" {
					assert.Contains(t, recorder.Body.String(), `"text":"Hello"`)
				}
				return
			}
			assert.Equal(t, 12, usage.(*dto.Usage).PromptTokens)
			assert.Equal(t, 8, usage.(*dto.Usage).CompletionTokens)
			require.True(t, info.StreamStatus.ResponseFailed())
			events := vertexClaudeEvents(t, recorder)
			require.NotEmpty(t, events)
			assert.Equal(t, "error", events[len(events)-1].Type)
			var errorEvents int
			for _, event := range events {
				if event.Type == "error" {
					errorEvents++
					claudeError := event.GetClaudeError()
					require.NotNil(t, claudeError)
					assert.NotEmpty(t, claudeError.Message)
					switch tc.name {
					case "upstream error":
						assert.Equal(t, "overloaded_error", claudeError.Type)
						assert.Equal(t, 503, info.StreamStatus.OutcomeSnapshot().ErrorStatus)
					case "prompt blocked":
						assert.Equal(t, "invalid_request_error", claudeError.Type)
						assert.Equal(t, 400, info.StreamStatus.OutcomeSnapshot().ErrorStatus)
					default:
						assert.Equal(t, "api_error", claudeError.Type)
					}
				}
			}
			assert.Equal(t, 1, errorEvents)
			for frame := range strings.SplitSeq(strings.TrimSpace(recorder.Body.String()), "\n\n") {
				event, data, ok := strings.Cut(frame, "\n")
				require.True(t, ok)
				assert.True(t, strings.HasPrefix(event, "event: "))
				assert.True(t, strings.HasPrefix(data, "data: "), "must not append raw controller JSON")
			}
		})
	}
}

func TestVertexGeminiErrorsUseAnthropicTypes(t *testing.T) {
	for _, tc := range []struct {
		status int
		want   string
	}{
		{400, "invalid_request_error"},
		{401, "authentication_error"},
		{403, "permission_error"},
		{404, "not_found_error"},
		{413, "request_too_large"},
		{429, "rate_limit_error"},
		{500, "api_error"},
		{503, "overloaded_error"},
		{529, "overloaded_error"},
	} {
		for _, stream := range []bool{false, true} {
			t.Run(fmt.Sprintf("%d/stream=%t", tc.status, stream), func(t *testing.T) {
				c, recorder, info, adaptor := vertexMessagesFixture(t, stream)
				body := fmt.Sprintf(`{"error":{"code":%d,"message":"Upstream failed"}}`, tc.status)
				if stream {
					body = "data: " + body + "\n\n"
				}
				_, apiError := adaptor.DoResponse(c, &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body))}, info)
				if !stream {
					require.NotNil(t, apiError)
					assert.Equal(t, tc.want, apiError.ToClaudeError().Type)
					assert.Contains(t, apiError.ToClaudeError().Message, "Upstream failed")
					assert.Equal(t, tc.status, apiError.StatusCode)
					return
				}
				require.Nil(t, apiError)
				events := vertexClaudeEvents(t, recorder)
				require.Len(t, events, 1)
				assert.Equal(t, "error", events[0].Type)
				claudeError := events[0].GetClaudeError()
				require.NotNil(t, claudeError)
				assert.Equal(t, tc.want, claudeError.Type)
				assert.Contains(t, claudeError.Message, "Upstream failed")
				assert.Equal(t, tc.status, info.StreamStatus.OutcomeSnapshot().ErrorStatus)
				assert.True(t, info.StreamStatus.ResponseFailed())
				assert.Contains(t, recorder.Body.String(), "event: error\n")
			})
		}
	}
}

func TestVertexAnthropicNonstreamErrorsAndOpenAIEntry(t *testing.T) {
	for _, body := range []string{`{broken`, `{"error":{"code":503,"message":"Unavailable"}}`} {
		c, recorder, info, adaptor := vertexMessagesFixture(t, false)
		_, apiErr := adaptor.DoResponse(c, &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body))}, info)
		require.NotNil(t, apiErr)
		assert.NotContains(t, recorder.Body.String(), `"type":"message"`)
	}
	c, recorder, info, adaptor := vertexMessagesFixture(t, false)
	info.RelayFormat = types.RelayFormatOpenAI
	request := &dto.GeneralOpenAIRequest{Model: "gemini-2.5-flash", Messages: []dto.Message{{Role: "user", Content: "Hi"}}}
	value, err := adaptor.ConvertOpenAIRequest(c, info, request)
	require.NoError(t, err)
	assert.IsType(t, &dto.GeminiChatRequest{}, value)
	_, apiErr := adaptor.DoResponse(c, &http.Response{StatusCode: 200, Header: http.Header{}, Body: io.NopCloser(strings.NewReader(
		`{"candidates":[{"content":{"parts":[{"text":"Hello"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":12,"candidatesTokenCount":8,"totalTokenCount":20}}`))}, info)
	require.Nil(t, apiErr)
	assert.Contains(t, recorder.Body.String(), `"object":"chat.completion"`)
	assert.Contains(t, recorder.Body.String(), `"content":"Hello"`)
	for _, parts := range []string{`[{"text":"Hello"}]`, `[{"functionCall":{"name":"lookup","args":{"city":"Paris"}}}]`} {
		c, recorder, info, adaptor := vertexMessagesFixture(t, true)
		info.RelayFormat = types.RelayFormatOpenAI
		stream := `data: {"candidates":[{"content":{"parts":` + parts + `},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":12,"candidatesTokenCount":8,"totalTokenCount":20}}` + "\n\n"
		_, apiErr := adaptor.DoResponse(c, &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(stream))}, info)
		require.Nil(t, apiErr)
		assert.Contains(t, recorder.Body.String(), "[DONE]")
		var calls []dto.ToolCallResponse
		for line := range strings.SplitSeq(recorder.Body.String(), "\n") {
			data, ok := strings.CutPrefix(line, "data: ")
			if !ok || data == "[DONE]" {
				continue
			}
			var chunk dto.ChatCompletionsStreamResponse
			require.NoError(t, common.UnmarshalJsonStr(data, &chunk))
			for _, choice := range chunk.Choices {
				calls = append(calls, choice.Delta.ToolCalls...)
			}
		}
		if strings.Contains(parts, "functionCall") {
			require.Len(t, calls, 1)
			assert.Equal(t, "lookup", calls[0].Function.Name)
			assert.JSONEq(t, `{"city":"Paris"}`, calls[0].Function.Arguments)
		} else {
			assert.Contains(t, recorder.Body.String(), `"content":"Hello"`)
		}
	}
}
