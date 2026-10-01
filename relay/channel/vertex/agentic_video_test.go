package vertex

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/channel/gemini"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAgenticVideoRequestRoundTrip(t *testing.T) {
	for _, input := range []string{
		`{"fileData":{"fileUri":"gs://bucket/lecture.mp4","mimeType":"video/mp4"},"mediaProcessing":"AGENTIC","mediaResolution":{"level":"MEDIA_RESOLUTION_LOW"}}`,
		`{"file_data":{"file_uri":"gs://bucket/lecture.mp4","mime_type":"video/mp4"},"media_processing":"AGENTIC","media_resolution":{"level":"MEDIA_RESOLUTION_LOW"}}`,
	} {
		t.Run(input, func(t *testing.T) {
			var request dto.GeminiChatRequest
			require.NoError(t, common.UnmarshalJsonStr(`{"contents":[{"role":"user","parts":[`+input+`,{"inline_data":{"mime_type":"video/mp4","data":"AAAA"},"media_processing":"STATIC","video_metadata":{"fps":0.5}},{"text":"Compare the videos"}]}]}`, &request))
			copied, err := common.DeepCopy(&request)
			require.NoError(t, err)
			info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gemini-3.8-flash"}}
			converted, err := (&Adaptor{}).ConvertGeminiRequest(nil, info, copied)
			require.NoError(t, err)
			out := converted.(*dto.GeminiChatRequest)
			parts := out.Contents[0].Parts
			require.Len(t, parts, 3)
			require.NotNil(t, parts[0].FileData)
			assert.Equal(t, "gs://bucket/lecture.mp4", parts[0].FileData.FileUri)
			assert.Equal(t, "video/mp4", parts[0].FileData.MimeType)
			assert.Equal(t, "AGENTIC", *parts[0].MediaProcessing)
			assert.JSONEq(t, `{"level":"MEDIA_RESOLUTION_LOW"}`, string(parts[0].MediaResolution))
			assert.Equal(t, "STATIC", *parts[1].MediaProcessing)
			assert.Equal(t, "AAAA", parts[1].InlineData.Data)
			assert.JSONEq(t, `{"fps":0.5}`, string(parts[1].VideoMetadata))
			data, err := common.Marshal(parts[2])
			require.NoError(t, err)
			assert.JSONEq(t, `{"text":"Compare the videos"}`, string(data))
			data, err = common.Marshal(out)
			require.NoError(t, err)
			assert.JSONEq(t, `{"contents":[{"role":"user","parts":[{"fileData":{"mimeType":"video/mp4","fileUri":"gs://bucket/lecture.mp4"},"mediaResolution":{"level":"MEDIA_RESOLUTION_LOW"},"mediaProcessing":"AGENTIC"},{"inlineData":{"mimeType":"video/mp4","data":"AAAA"},"mediaProcessing":"STATIC","videoMetadata":{"fps":0.5}},{"text":"Compare the videos"}]}],"generationConfig":{}}`, string(data))
		})
	}
}

func TestAgenticVideoHistoryCompatibility(t *testing.T) {
	for _, vertex := range []bool{false, true} {
		for _, tc := range []struct {
			name, media, role, part, geminiWant, vertexWant string
		}{
			{"opaque call", "AGENTIC", "model", `{"toolCall":{"id":"call_1"},"thoughtSignature":"sig"}`, ``, ``},
			{"opaque result", "AGENTIC", "model", `{"tool_response":{"id":"call_1"}}`, ``, ``},
			{"typed call", "AGENTIC", "model", `{"toolCall":{"toolType":"MEDIA_PROCESSING","args":{}},"text":"summary"}`, `{"text":"summary"}`, `{"text":"summary"}`},
			{"typed result", "AGENTIC", "model", `{"tool_response":{"tool_type":"MEDIA_PROCESSING","response":{}}}`, ``, ``},
			{"static video", "STATIC", "model", `{"toolCall":{"id":"call_1"}}`, `{"toolCall":{"id":"call_1"}}`, `{"toolCall":{"id":"call_1"}}`},
			{"user content", "AGENTIC", "user", `{"toolCall":{"id":"call_1"}}`, `{"toolCall":{"id":"call_1"}}`, `{"toolCall":{"id":"call_1"}}`},
			{"unknown tool", "AGENTIC", "model", `{"toolCall":{"toolType":"OTHER","id":"call_1"}}`, `{"toolCall":{"toolType":"OTHER","id":"call_1"}}`, `{"toolCall":{"toolType":"OTHER","id":"call_1"}}`},
			{"unknown payload", "AGENTIC", "model", `{"toolCall":{"id":"call_1","args":{}}}`, `{"toolCall":{"id":"call_1","args":{}}}`, `{"toolCall":{"id":"call_1","args":{}}}`},
			{"function call", "AGENTIC", "model", `{"functionCall":{"name":"lookup","args":{}},"thoughtSignature":"required"}`, `{"functionCall":{"name":"lookup","args":{}},"thoughtSignature":"required"}`, `{"functionCall":{"name":"lookup","args":{}},"thoughtSignature":"required"}`},
			{"function result", "AGENTIC", "model", `{"functionResponse":{"name":"lookup","response":{}}}`, `{"functionResponse":{"name":"lookup","response":{}}}`, `{"functionResponse":{"name":"lookup","response":{}}}`},
			{"signature only", "AGENTIC", "model", `{"thoughtSignature":"sig"}`, `{"thoughtSignature":"sig"}`, ``},
			{"Google Search", "AGENTIC", "model", `{"toolCall":{"toolType":"GOOGLE_SEARCH","id":"s"},"thoughtSignature":"sig"}`, `{"toolCall":{"toolType":"GOOGLE_SEARCH","id":"s"},"thoughtSignature":"sig"}`, `{"toolCall":{"toolType":"GOOGLE_SEARCH","id":"s"}}`},
			{"URL Context", "AGENTIC", "model", `{"toolResponse":{"tool_type":"URL_CONTEXT","id":"u"}}`, `{"toolResponse":{"tool_type":"URL_CONTEXT","id":"u"}}`, `{"toolResponse":{"tool_type":"URL_CONTEXT","id":"u"}}`},
			{"code execution", "AGENTIC", "model", `{"executableCode":{"language":"PYTHON","code":"print(1)"},"thoughtSignature":"sig"}`, `{"executableCode":{"language":"PYTHON","code":"print(1)"},"thoughtSignature":"sig"}`, `{"executableCode":{"language":"PYTHON","code":"print(1)"}}`},
			{"code result", "AGENTIC", "model", `{"codeExecutionResult":{"outcome":"OUTCOME_OK","output":"1"}}`, `{"codeExecutionResult":{"outcome":"OUTCOME_OK","output":"1"}}`, `{"codeExecutionResult":{"outcome":"OUTCOME_OK","output":"1"}}`},
		} {
			t.Run(tc.name+map[bool]string{false: "/gemini", true: "/vertex"}[vertex], func(t *testing.T) {
				var request dto.GeminiChatRequest
				require.NoError(t, common.UnmarshalJsonStr(`{"contents":[{"role":"user","parts":[{"file_data":{"file_uri":"gs://bucket/video.mp4","mime_type":"video/mp4"},"media_processing":"`+tc.media+`"}]},{"role":"`+tc.role+`","parts":[`+tc.part+`]},{"role":"user","parts":[{"text":"Explain the second scene"}]}]}`, &request))
				original, err := common.Marshal(request.Contents[0])
				require.NoError(t, err)
				channelType := constant.ChannelTypeGemini
				if vertex {
					channelType = constant.ChannelTypeVertexAi
				}
				info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelType: channelType, UpstreamModelName: "gemini-3.8-flash"}}
				if vertex {
					_, err = (&Adaptor{}).ConvertGeminiRequest(nil, info, &request)
				} else {
					_, err = (&gemini.Adaptor{}).ConvertGeminiRequest(nil, info, &request)
				}
				require.NoError(t, err)
				video, err := common.Marshal(request.Contents[0])
				require.NoError(t, err)
				assert.JSONEq(t, string(original), string(video))
				want := tc.geminiWant
				if vertex {
					want = tc.vertexWant
				}
				if want == "" {
					require.Len(t, request.Contents, 2)
				} else {
					require.Len(t, request.Contents, 3)
					require.Len(t, request.Contents[1].Parts, 1)
					part, err := common.Marshal(request.Contents[1].Parts[0])
					require.NoError(t, err)
					assert.JSONEq(t, want, string(part))
				}
				assert.Equal(t, "Explain the second scene", request.Contents[len(request.Contents)-1].Parts[0].Text)
			})
		}
	}
}

func TestAgenticVideoMixedToolsDropMediaTraces(t *testing.T) {
	for _, tools := range []string{`[{"googleSearch":{}}]`, `[{"urlContext":{}}]`, `[{"codeExecution":{}}]`, `[{"functionDeclarations":[{"name":"lookup"}]}]`} {
		var request dto.GeminiChatRequest
		require.NoError(t, common.UnmarshalJsonStr(`{"tools":`+tools+`,"contents":[{"role":"user","parts":[{"inlineData":{"mimeType":"video/mp4","data":"AAAA"},"mediaProcessing":"AGENTIC"}]},{"role":"model","parts":[{"toolCall":{"id":"unknown"},"thoughtSignature":"keep"},{"toolResponse":{"id":"unknown"}},{"toolCall":{"toolType":"MEDIA_PROCESSING","id":"media"},"thoughtSignature":"remove"},{"text":"Summary","thoughtSignature":"text-sig"}]}]}`, &request))
		info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gemini-3.8-flash"}}
		_, err := (&gemini.Adaptor{}).ConvertGeminiRequest(nil, info, &request)
		require.NoError(t, err)
		require.Len(t, request.Contents[1].Parts, 1)
		data, err := common.Marshal(request.Contents[1].Parts)
		require.NoError(t, err)
		assert.JSONEq(t, `[{"text":"Summary","thoughtSignature":"text-sig"}]`, string(data))
		assert.JSONEq(t, tools, string(request.Tools))
	}
}

func TestAgenticVideoVertexURL(t *testing.T) {
	for _, keyType := range []dto.VertexKeyType{dto.VertexKeyTypeAPIKey, ""} {
		for _, stream := range []bool{false, true} {
			for _, tc := range []struct{ part, version string }{
				{`{"media_processing":"AGENTIC"}`, "v1beta1"},
				{`{"mediaProcessing":"STATIC"}`, "v1"},
				{`{"text":"hello"}`, "v1"},
				{`{"tool_call":{"tool_type":"MEDIA_PROCESSING"},"thought_signature":"sig_A"}`, "v1beta1"},
				{`{"toolResponse":{"toolType":"MEDIA_PROCESSING"},"thoughtSignature":"sig_B"}`, "v1beta1"},
			} {
				var request dto.GeminiChatRequest
				require.NoError(t, common.UnmarshalJsonStr(`{"contents":[{"parts":[`+tc.part+`]}]}`, &request))
				apiKey := `{"project_id":"test-project"}`
				projectPath := "/projects/test-project/locations/global"
				keySuffix := ""
				if keyType == dto.VertexKeyTypeAPIKey {
					apiKey = "test-key"
					projectPath = ""
					keySuffix = "?key=test-key"
				}
				action := "generateContent"
				if stream {
					action = "streamGenerateContent?alt=sse"
					if keySuffix != "" {
						keySuffix = "&key=test-key"
					}
				}
				info := &relaycommon.RelayInfo{Request: &request, IsStream: stream, ChannelMeta: &relaycommon.ChannelMeta{
					UpstreamModelName: "gemini-3.8-flash", ApiKey: apiKey,
				}}
				info.ChannelOtherSettings.VertexKeyType = keyType
				adaptor := &Adaptor{}
				adaptor.Init(info)
				url, err := adaptor.GetRequestURL(info)
				require.NoError(t, err)
				expectedPath := "/" + tc.version + projectPath + "/publishers/google/models/gemini-3.8-flash:" + action + keySuffix
				assert.Equal(t, "https://aiplatform.googleapis.com"+expectedPath, url)
				info.ChannelBaseUrl = "https://vertex.example/v1/"
				customURL, err := adaptor.GetRequestURL(info)
				require.NoError(t, err)
				assert.Equal(t, "https://vertex.example"+expectedPath, customURL)
			}
		}
	}
}

func TestAgenticVideoNativeResponseAndReplay(t *testing.T) {
	gin.SetMode(gin.TestMode)
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })
	const payload = `{"candidates":[{"content":{"role":"model","parts":[{"thought":true,"text":"Inspecting video"},{"tool_call":{"tool_type":"MEDIA_PROCESSING","args":{"opaque":"value"}},"thought_signature":"sig_A"},{"tool_response":{"tool_type":"MEDIA_PROCESSING","response":{"frames":[1,2]}},"thought_signature":"sig_B"},{"text":"Summary","thoughtSignature":"sig_C"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":100,"toolUsePromptTokenCount":40,"candidatesTokenCount":20,"thoughtsTokenCount":10,"totalTokenCount":170}}`
	for _, stream := range []bool{false, true} {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(http.MethodPost, "/v1beta/models/gemini-3.8-flash:generateContent", nil)
		info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatGemini, IsStream: stream,
			ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gemini-3.8-flash"}}
		body := payload
		if stream {
			body = "data: " + payload + "\n\n"
		}
		resp := &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body))}
		var usage *dto.Usage
		if stream {
			var apiErr *types.NewAPIError
			usage, apiErr = gemini.GeminiTextGenerationStreamHandler(c, info, resp)
			require.Nil(t, apiErr)
			assert.Contains(t, recorder.Body.String(), payload)
		} else {
			var apiErr *types.NewAPIError
			usage, apiErr = gemini.GeminiTextGenerationHandler(c, info, resp)
			require.Nil(t, apiErr)
			assert.JSONEq(t, payload, recorder.Body.String())
		}
		require.NotNil(t, usage)
		assert.Equal(t, 140, usage.PromptTokens)
		assert.Equal(t, 30, usage.CompletionTokens)
		require.NotNil(t, usage.BillingUsage)
		require.NotNil(t, usage.BillingUsage.GeminiUsageMetadata)
		assert.Equal(t, 40, usage.BillingUsage.GeminiUsageMetadata.ToolUsePromptTokenCount)
	}
	var response dto.GeminiChatResponse
	require.NoError(t, common.UnmarshalJsonStr(payload, &response))
	replay := &dto.GeminiChatRequest{Contents: []dto.GeminiChatContent{response.Candidates[0].Content}}
	copied, err := common.DeepCopy(replay)
	require.NoError(t, err)
	parts := copied.Contents[0].Parts
	assert.JSONEq(t, `{"tool_type":"MEDIA_PROCESSING","args":{"opaque":"value"}}`, string(parts[1].ToolCall))
	assert.JSONEq(t, `"sig_A"`, string(parts[1].ThoughtSignature))
	assert.JSONEq(t, `{"tool_type":"MEDIA_PROCESSING","response":{"frames":[1,2]}}`, string(parts[2].ToolResponse))
	assert.JSONEq(t, `"sig_B"`, string(parts[2].ThoughtSignature))
}
