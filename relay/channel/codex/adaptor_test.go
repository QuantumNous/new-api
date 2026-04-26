package codex

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	appconstant "github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

func TestConvertOpenAIResponsesRequest_NormalizesStringInputAndForcesStream(t *testing.T) {
	gin.SetMode(gin.TestMode)
	adaptor := &Adaptor{}

	converted, err := adaptor.ConvertOpenAIResponsesRequest(nil, &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{},
	}, dto.OpenAIResponsesRequest{
		Model: "gpt-5.4",
		Input: json.RawMessage(`"hello"`),
	})
	if err != nil {
		t.Fatalf("ConvertOpenAIResponsesRequest returned error: %v", err)
	}

	request := converted.(dto.OpenAIResponsesRequest)
	if request.Stream == nil || !*request.Stream {
		t.Fatalf("expected stream=true, got %#v", request.Stream)
	}

	var input []map[string]string
	if err := common.Unmarshal(request.Input, &input); err != nil {
		t.Fatalf("input is not a message list: %v", err)
	}
	if len(input) != 1 || input[0]["role"] != "user" || input[0]["content"] != "hello" {
		t.Fatalf("unexpected normalized input: %#v", input)
	}
}

func TestConvertOpenAIResponsesRequest_ArrayInputUnchanged(t *testing.T) {
	adaptor := &Adaptor{}
	rawInput := json.RawMessage(`[{"role":"user","content":"hi"}]`)

	converted, err := adaptor.ConvertOpenAIResponsesRequest(nil, &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{},
	}, dto.OpenAIResponsesRequest{
		Model: "gpt-5.4",
		Input: rawInput,
	})
	if err != nil {
		t.Fatalf("ConvertOpenAIResponsesRequest returned error: %v", err)
	}

	request := converted.(dto.OpenAIResponsesRequest)
	if string(request.Input) != string(rawInput) {
		t.Fatalf("array input changed: got %s want %s", request.Input, rawInput)
	}
}

func TestConvertOpenAIResponsesRequest_RawPassthroughPreservesCodexInputItems(t *testing.T) {
	gin.SetMode(gin.TestMode)
	adaptor := &Adaptor{}
	rawBody := []byte(`{
		"model":"gpt-5.4",
		"input":[
			{"type":"tool_search_call","call_id":"search-1","execution":"client","arguments":{"query":"calendar"}},
			{"type":"function_call","name":"write_file","call_id":"call-1","arguments":"{\"path\":\"a.txt\"}"}
		],
		"tools":[{"type":"image_generation","output_format":"png"}],
		"client_metadata":{"x-codex-installation-id":"install-1"},
		"max_output_tokens":100,
		"temperature":0.7
	}`)
	var request dto.OpenAIResponsesRequest
	if err := common.Unmarshal(rawBody, &request); err != nil {
		t.Fatalf("request unmarshal failed: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", bytes.NewReader(rawBody))
	c.Request.Header.Set("Content-Type", "application/json")

	converted, err := adaptor.ConvertOpenAIResponsesRequest(c, &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{},
	}, request)
	if err != nil {
		t.Fatalf("ConvertOpenAIResponsesRequest returned error: %v", err)
	}

	raw, ok := converted.(json.RawMessage)
	if !ok {
		t.Fatalf("expected raw passthrough request, got %T", converted)
	}
	var out map[string]any
	if err := common.Unmarshal(raw, &out); err != nil {
		t.Fatalf("converted raw request unmarshal failed: %v", err)
	}
	input := out["input"].([]any)
	toolSearch := input[0].(map[string]any)
	if _, ok := toolSearch["arguments"].(map[string]any); !ok {
		t.Fatalf("tool_search_call arguments should remain object: %#v", toolSearch["arguments"])
	}
	functionCall := input[1].(map[string]any)
	if _, ok := functionCall["arguments"].(string); !ok {
		t.Fatalf("function_call arguments should remain string: %#v", functionCall["arguments"])
	}
	if _, ok := out["client_metadata"].(map[string]any); !ok {
		t.Fatalf("client_metadata should be preserved: %#v", out["client_metadata"])
	}
	if out["stream"] != true || out["store"] != false {
		t.Fatalf("codex stream/store defaults not applied: stream=%#v store=%#v", out["stream"], out["store"])
	}
	if _, ok := out["max_output_tokens"]; ok {
		t.Fatalf("max_output_tokens should be removed: %#v", out["max_output_tokens"])
	}
	if _, ok := out["temperature"]; ok {
		t.Fatalf("temperature should be removed: %#v", out["temperature"])
	}
	tools := out["tools"].([]any)
	imageTool := tools[0].(map[string]any)
	if imageTool["model"] != CodexImageModel {
		t.Fatalf("image_generation tool model was not defaulted: %#v", imageTool)
	}
}

func TestConvertOpenAIResponsesRequest_RawPassthroughPreservesSystemPromptSetting(t *testing.T) {
	gin.SetMode(gin.TestMode)
	adaptor := &Adaptor{}
	rawBody := []byte(`{"model":"gpt-5.4","input":[{"role":"user","content":"hi"}],"instructions":"base"}`)
	var request dto.OpenAIResponsesRequest
	if err := common.Unmarshal(rawBody, &request); err != nil {
		t.Fatalf("request unmarshal failed: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", bytes.NewReader(rawBody))
	c.Request.Header.Set("Content-Type", "application/json")

	converted, err := adaptor.ConvertOpenAIResponsesRequest(c, &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelSetting: dto.ChannelSettings{
				SystemPrompt:         "system",
				SystemPromptOverride: true,
			},
		},
	}, request)
	if err != nil {
		t.Fatalf("ConvertOpenAIResponsesRequest returned error: %v", err)
	}

	raw, ok := converted.(json.RawMessage)
	if !ok {
		t.Fatalf("expected raw passthrough request, got %T", converted)
	}
	if got := gjson.GetBytes(raw, "instructions").String(); got != "system\nbase" {
		t.Fatalf("unexpected instructions: %q", got)
	}
}

func TestConvertOpenAIResponsesRequest_DefaultsImageGenerationToolModel(t *testing.T) {
	adaptor := &Adaptor{}

	converted, err := adaptor.ConvertOpenAIResponsesRequest(nil, &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{},
	}, dto.OpenAIResponsesRequest{
		Model: "gpt-5.4",
		Input: json.RawMessage(`[{"role":"user","content":"hi"}]`),
		Tools: json.RawMessage(`[{"type":"image_generation","size":"1024x1024"}]`),
	})
	if err != nil {
		t.Fatalf("ConvertOpenAIResponsesRequest returned error: %v", err)
	}

	request := converted.(dto.OpenAIResponsesRequest)
	var tools []map[string]any
	if err := common.Unmarshal(request.Tools, &tools); err != nil {
		t.Fatalf("tools unmarshal failed: %v", err)
	}
	if tools[0]["model"] != CodexImageModel {
		t.Fatalf("image_generation tool model was not defaulted: %#v", tools[0])
	}
}

func TestConvertOpenAIResponsesRequest_CompactDoesNotForceStream(t *testing.T) {
	adaptor := &Adaptor{}
	stream := false

	converted, err := adaptor.ConvertOpenAIResponsesRequest(nil, &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeResponsesCompact,
		ChannelMeta: &relaycommon.ChannelMeta{},
	}, dto.OpenAIResponsesRequest{
		Model:  "gpt-5.4",
		Input:  json.RawMessage(`[{"role":"user","content":"hi"}]`),
		Stream: &stream,
	})
	if err != nil {
		t.Fatalf("ConvertOpenAIResponsesRequest returned error: %v", err)
	}

	request := converted.(dto.OpenAIResponsesRequest)
	if request.Stream == nil || *request.Stream {
		t.Fatalf("compact stream should remain false, got %#v", request.Stream)
	}
}

func TestHandleResponsesNonStream_AggregatesCodexSSE(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	body := `data: {"type":"response.completed","response":{"id":"resp_1","object":"response","created_at":1,"model":"gpt-5.4","output":[],"usage":{"input_tokens":2,"output_tokens":3,"total_tokens":5}}}` + "\n\n" +
		"data: [DONE]\n\n"
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	usage, err := handleResponsesNonStream(c, resp, &relaycommon.RelayInfo{})
	if err != nil {
		t.Fatalf("handleResponsesNonStream returned error: %v", err)
	}
	if usage.PromptTokens != 2 || usage.CompletionTokens != 3 || usage.TotalTokens != 5 {
		t.Fatalf("unexpected usage: %#v", usage)
	}
	if !strings.Contains(w.Body.String(), `"id":"resp_1"`) {
		t.Fatalf("response body does not contain completed response: %s", w.Body.String())
	}
	if contentType := w.Header().Get("Content-Type"); !strings.Contains(contentType, "application/json") {
		t.Fatalf("expected application/json content type, got %q", contentType)
	}
}

func TestHandleResponsesNonStream_PreservesImageGenerationOutputItemDone(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	body := `data: {"type":"response.output_item.done","item":{"type":"image_generation_call","status":"generating","result":"aGVsbG8=","output_format":"png","size":"1024x1024"}}` + "\n\n" +
		`data: {"type":"response.completed","response":{"id":"resp_1","object":"response","created_at":1,"model":"gpt-5.4","output":[],"tool_usage":{"image_gen":{"input_tokens":4,"output_tokens":5,"total_tokens":9}}}}` + "\n\n"
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	usage, err := handleResponsesNonStream(c, resp, &relaycommon.RelayInfo{})
	if err != nil {
		t.Fatalf("handleResponsesNonStream returned error: %v", err)
	}
	if usage.PromptTokens != 4 || usage.CompletionTokens != 5 || usage.TotalTokens != 9 {
		t.Fatalf("unexpected usage from tool_usage.image_gen: %#v", usage)
	}
	if !c.GetBool("image_generation_call") {
		t.Fatalf("expected image_generation_call context marker")
	}
	if !strings.Contains(w.Body.String(), `"type":"image_generation_call"`) || !strings.Contains(w.Body.String(), `"result":"aGVsbG8="`) {
		t.Fatalf("response body does not preserve image output item: %s", w.Body.String())
	}
}

func TestHandleResponsesNonStream_PreservesTextOutputItemDoneWhenCompletedOutputEmpty(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/backend-api/codex/responses", nil)

	body := `data: {"type":"response.output_item.done","item":{"id":"msg_1","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"OK","annotations":[]}]}}` + "\n\n" +
		`data: {"type":"response.completed","response":{"id":"resp_1","object":"response","created_at":1,"model":"gpt-5.4","output":[],"usage":{"input_tokens":2,"output_tokens":1,"total_tokens":3}}}` + "\n\n"
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	usage, err := handleResponsesNonStream(c, resp, &relaycommon.RelayInfo{})
	if err != nil {
		t.Fatalf("handleResponsesNonStream returned error: %v", err)
	}
	if usage.PromptTokens != 2 || usage.CompletionTokens != 1 || usage.TotalTokens != 3 {
		t.Fatalf("unexpected usage: %#v", usage)
	}
	if !strings.Contains(w.Body.String(), `"type":"message"`) || !strings.Contains(w.Body.String(), `"text":"OK"`) {
		t.Fatalf("response body does not preserve text output item: %s", w.Body.String())
	}
}

func TestHandleResponsesStream_MarksNativeImageGenerationTool(t *testing.T) {
	oldStreamingTimeout := appconstant.StreamingTimeout
	appconstant.StreamingTimeout = 30
	defer func() {
		appconstant.StreamingTimeout = oldStreamingTimeout
	}()

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/backend-api/codex/responses", nil)

	body := `data: {"type":"response.output_item.done","item":{"type":"image_generation_call","status":"generating","result":"aGVsbG8=","output_format":"png","size":"1024x1024"}}` + "\n\n" +
		`data: {"type":"response.completed","response":{"id":"resp_1","object":"response","created_at":1,"model":"gpt-5.4","output":[],"tool_usage":{"image_gen":{"input_tokens":4,"output_tokens":5,"total_tokens":9}}}}` + "\n\n" +
		"data: [DONE]\n\n"
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gpt-5.4"},
		ResponsesUsageInfo: &relaycommon.ResponsesUsageInfo{
			BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
				imageGenerationTool: {ToolName: imageGenerationTool},
			},
		},
	}

	usage, err := handleResponsesStream(c, resp, info)
	if err != nil {
		t.Fatalf("handleResponsesStream returned error: %v", err)
	}
	if usage.PromptTokens != 4 || usage.CompletionTokens != 5 || usage.TotalTokens != 9 {
		t.Fatalf("unexpected usage from tool_usage.image_gen: %#v", usage)
	}
	if !c.GetBool("image_generation_call") {
		t.Fatalf("expected image_generation_call context marker")
	}
	if info.ResponsesUsageInfo.BuiltInTools[imageGenerationTool].CallCount != 1 {
		t.Fatalf("expected image_generation tool call count to be recorded, got %#v", info.ResponsesUsageInfo.BuiltInTools[imageGenerationTool])
	}
	if !strings.Contains(w.Body.String(), `"type":"image_generation_call"`) || !strings.Contains(w.Body.String(), `"result":"aGVsbG8="`) {
		t.Fatalf("stream body does not preserve native image event: %s", w.Body.String())
	}
}

func TestRelayErrorHandlerPlainText(t *testing.T) {
	resp := &http.Response{
		StatusCode: http.StatusInternalServerError,
		Status:     "500 Internal Server Error",
		Body:       io.NopCloser(strings.NewReader("error upstream broke")),
	}

	err := RelayErrorHandler(context.Background(), resp)
	if err == nil {
		t.Fatal("expected error")
	}
	if strings.Contains(err.Error(), "invalid character") {
		t.Fatalf("error should not be JSON parse error: %s", err.Error())
	}
	if !strings.Contains(err.Error(), "error upstream broke") {
		t.Fatalf("plain text body was not preserved: %s", err.Error())
	}
}

func TestBuildCodexImageGenerationResponsesRequest(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	request, err := buildCodexImageResponsesRequest(c, &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesGenerations,
	}, dto.ImageRequest{
		Model:          CodexImageModel,
		Prompt:         "中文海报",
		Size:           "1024x1024",
		ResponseFormat: "b64_json",
	})
	if err != nil {
		t.Fatalf("buildCodexImageResponsesRequest returned error: %v", err)
	}
	if request.Model != defaultImagesMainModel {
		t.Fatalf("unexpected main model: %s", request.Model)
	}
	if request.Stream == nil || !*request.Stream {
		t.Fatalf("expected upstream stream=true")
	}

	var tools []map[string]any
	if err := common.Unmarshal(request.Tools, &tools); err != nil {
		t.Fatalf("tools unmarshal failed: %v", err)
	}
	if tools[0]["type"] != "image_generation" || tools[0]["action"] != "generate" || tools[0]["model"] != CodexImageModel {
		t.Fatalf("unexpected image tool: %#v", tools[0])
	}
}

func TestBuildCodexImageEditResponsesRequestMultipart(t *testing.T) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	_ = writer.WriteField("model", CodexImageModel)
	_ = writer.WriteField("prompt", "把图片改成中文海报")
	_ = writer.WriteField("response_format", "url")
	_ = writer.WriteField("size", "1024x1024")
	_ = writer.WriteField("input_fidelity", "high")
	header := textproto.MIMEHeader{}
	header.Set("Content-Disposition", `form-data; name="image"; filename="source.png"`)
	header.Set("Content-Type", "image/png")
	part, err := writer.CreatePart(header)
	if err != nil {
		t.Fatalf("CreatePart failed: %v", err)
	}
	_, _ = part.Write([]byte("pngdata"))
	_ = writer.Close()

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())

	request, err := buildCodexImageResponsesRequest(c, &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesEdits,
	}, dto.ImageRequest{
		Model:  CodexImageModel,
		Prompt: "把图片改成中文海报",
	})
	if err != nil {
		t.Fatalf("buildCodexImageResponsesRequest returned error: %v", err)
	}
	if !strings.Contains(string(request.Input), "data:image/png;base64,") {
		t.Fatalf("input does not include multipart image data URL: %s", request.Input)
	}

	var tools []map[string]any
	if err := common.Unmarshal(request.Tools, &tools); err != nil {
		t.Fatalf("tools unmarshal failed: %v", err)
	}
	if tools[0]["action"] != "edit" || tools[0]["input_fidelity"] != "high" {
		t.Fatalf("unexpected edit tool: %#v", tools[0])
	}
	if c.GetString(ginKeyCodexImageResponseFormat) != "url" {
		t.Fatalf("response_format was not captured")
	}
}

func TestBuildCodexImageEditResponsesRequestDetectsOctetStreamImage(t *testing.T) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	_ = writer.WriteField("model", CodexImageModel)
	_ = writer.WriteField("prompt", "把图片改成中文海报")
	header := textproto.MIMEHeader{}
	header.Set("Content-Disposition", `form-data; name="image"; filename="source.png"`)
	header.Set("Content-Type", "application/octet-stream")
	part, err := writer.CreatePart(header)
	if err != nil {
		t.Fatalf("CreatePart failed: %v", err)
	}
	_, _ = part.Write([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0, 0, 0, 0})
	_ = writer.Close()

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())

	request, err := buildCodexImageResponsesRequest(c, &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesEdits,
	}, dto.ImageRequest{
		Model:  CodexImageModel,
		Prompt: "把图片改成中文海报",
	})
	if err != nil {
		t.Fatalf("buildCodexImageResponsesRequest returned error: %v", err)
	}
	if !strings.Contains(string(request.Input), "data:image/png;base64,") {
		t.Fatalf("octet-stream upload was not detected as png: %s", request.Input)
	}
}

func TestHandleImageResponseSSE(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	c.Set(ginKeyCodexImageResponseFormat, "b64_json")

	body := `data: {"type":"response.completed","response":{"created_at":123,"output":[{"type":"image_generation_call","result":"aGVsbG8=","output_format":"png","revised_prompt":"poster"}],"usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}}` + "\n\n"
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	usage, err := handleImageResponse(c, resp, &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesGenerations})
	if err != nil {
		t.Fatalf("handleImageResponse returned error: %v", err)
	}
	if usage.TotalTokens != 3 {
		t.Fatalf("unexpected usage: %#v", usage)
	}
	if !strings.Contains(w.Body.String(), `"b64_json":"aGVsbG8="`) {
		t.Fatalf("unexpected image response body: %s", w.Body.String())
	}
}

func TestHandleImageResponseSSEUsesOutputItemDoneWhenCompletedOutputEmpty(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	c.Set(ginKeyCodexImageResponseFormat, "b64_json")

	body := `data: {"type":"response.image_generation_call.partial_image","partial_image_b64":"cGFydGlhbA==","output_format":"png","partial_image_index":0}` + "\n\n" +
		`data: {"type":"response.output_item.done","item":{"type":"image_generation_call","status":"generating","result":"aGVsbG8=","output_format":"png","size":"1024x1024","revised_prompt":"poster"}}` + "\n\n" +
		`data: {"type":"response.completed","response":{"created_at":123,"output":[],"tool_usage":{"image_gen":{"input_tokens":4,"output_tokens":5,"total_tokens":9}}}}` + "\n\n"
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	usage, err := handleImageResponse(c, resp, &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesGenerations})
	if err != nil {
		t.Fatalf("handleImageResponse returned error: %v", err)
	}
	if usage.PromptTokens != 4 || usage.CompletionTokens != 5 || usage.TotalTokens != 9 {
		t.Fatalf("unexpected usage from tool_usage.image_gen: %#v", usage)
	}
	if !strings.Contains(w.Body.String(), `"b64_json":"aGVsbG8="`) {
		t.Fatalf("unexpected image response body: %s", w.Body.String())
	}
	var imageResponse dto.ImageResponse
	if err := common.Unmarshal(w.Body.Bytes(), &imageResponse); err != nil {
		t.Fatalf("image response unmarshal failed: %v", err)
	}
	if len(imageResponse.Data) != 1 {
		t.Fatalf("expected only final output_item.done image, got %d items: %s", len(imageResponse.Data), w.Body.String())
	}
}
