package controller

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

var errIQInvalidOutput = errors.New("invalid IQ output")

// Only known single-HTTP-request adaptors are eligible. SDK/job/image/audio
// adaptors must not silently acquire retry/tool/job semantics through IQ.
func iqEndpoint(channel *model.Channel, name string) string {
	switch channel.Type {
	case constant.ChannelTypeOpenAI, constant.ChannelTypeAzure, constant.ChannelTypeAnthropic, constant.ChannelTypeGemini, constant.ChannelTypeCodex, constant.ChannelTypeNewAPI, constant.ChannelTypeSub2API, constant.ChannelTypeOpenRouter, constant.ChannelTypeDeepSeek, constant.ChannelTypeXai, constant.ChannelTypeAdvancedCustom, constant.ChannelTypeVLLM, constant.ChannelTypeSGLang:
	default:
		return ""
	}
	// Reuse production chained mapping (including cycle detection) before native
	// endpoint selection; a public alias may actually target Responses-only Codex.
	if channel.GetModelMapping() != "" {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Set("model_mapping", channel.GetModelMapping())
		info := &relaycommon.RelayInfo{OriginModelName: name, ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: name}}
		if err := helper.ModelMappedHelper(c, info, nil); err != nil {
			return ""
		}
		name = info.UpstreamModelName
	}
	lower := strings.ToLower(name)
	if common.IsImageGenerationModel(name) || strings.Contains(lower, "embed") || strings.Contains(lower, "rerank") || strings.Contains(lower, "tts") || strings.Contains(lower, "whisper") || strings.Contains(lower, "audio") || strings.Contains(lower, "realtime") {
		return ""
	}
	for _, nonText := range []string{"sora", "veo", "kling", "seedream", "suno", "midjourney", "video", "stable-diffusion"} {
		if strings.Contains(lower, nonText) {
			return ""
		}
	}
	endpoints := common.GetEndpointTypesByChannelType(channel.Type, name)
	if constant.IsAdvancedCustomChannel(channel.Type) {
		if cfg := channel.GetOtherSettings().AdvancedCustom; cfg != nil {
			endpoints = cfg.SupportedEndpointTypesForModel(name)
		}
	}
	if strings.Contains(lower, "codex") {
		if channel.Type == constant.ChannelTypeOpenAI || channel.Type == constant.ChannelTypeAzure {
			return string(constant.EndpointTypeOpenAIResponse)
		}
		for _, e := range endpoints {
			if e == constant.EndpointTypeOpenAIResponse {
				return string(e)
			}
		}
		return ""
	}
	if common.IsOpenAIResponseOnlyModel(name) {
		for _, e := range endpoints {
			if e == constant.EndpointTypeOpenAIResponse {
				return string(e)
			}
		}
		return ""
	}
	for _, e := range endpoints {
		switch e {
		case constant.EndpointTypeOpenAI, constant.EndpointTypeOpenAIResponse, constant.EndpointTypeAnthropic, constant.EndpointTypeGemini:
			return string(e)
		}
	}
	return ""
}
func buildIQRequest(name, endpoint, prompt string, stream bool) dto.Request {
	limit := uint(model.IQOutputTokens)
	switch constant.EndpointType(endpoint) {
	case constant.EndpointTypeOpenAIResponse:
		input, _ := json.Marshal([]dto.Message{{Role: "user", Content: prompt}})
		return &dto.OpenAIResponsesRequest{Model: name, Input: input, Stream: &stream, MaxOutputTokens: &limit}
	case constant.EndpointTypeAnthropic:
		return &dto.ClaudeRequest{Model: name, Stream: &stream, MaxTokens: &limit, Messages: []dto.ClaudeMessage{{Role: "user", Content: prompt}}}
	case constant.EndpointTypeGemini:
		return &dto.GeminiChatRequest{Contents: []dto.GeminiChatContent{{Role: "user", Parts: []dto.GeminiPart{{Text: prompt}}}}, GenerationConfig: dto.GeminiChatGenerationConfig{MaxOutputTokens: &limit}}
	default:
		return &dto.GeneralOpenAIRequest{Model: name, Stream: &stream, MaxTokens: &limit, Messages: []dto.Message{{Role: "user", Content: prompt}}}
	}
}

// Keep the converted saved user input intact even when a channel has parameter
// overrides. Adapter-added system instructions remain part of normal routing.
func restoreIQInput(body, original []byte) ([]byte, error) {
	for _, key := range []string{"messages", "input", "contents"} {
		if value := gjson.GetBytes(original, key); value.Exists() {
			var err error
			body, err = sjson.SetRawBytes(body, key, []byte(value.Raw))
			if err != nil {
				return nil, err
			}
		}
	}
	return body, nil
}

func boundIQRequest(body []byte, endpoint string) ([]byte, error) {
	key := "max_tokens"
	// Advanced-custom converters can change the wire protocol. Bound its actual
	// body, not just the originally requested endpoint.
	switch {
	case gjson.GetBytes(body, "contents").Exists():
		key = "generationConfig.maxOutputTokens"
		endpoint = string(constant.EndpointTypeGemini)
	case gjson.GetBytes(body, "input").Exists():
		key = "max_output_tokens"
	case gjson.GetBytes(body, "messages").Exists():
		if gjson.GetBytes(body, "max_completion_tokens").Exists() {
			key = "max_completion_tokens"
		}
	default:
		return nil, errors.New("unsupported IQ wire format")
	}

	// One candidate, no model tools or n-sampling. Channel overrides cannot expand cost.
	for _, k := range []string{"tools", "tool_choice", "parallel_tool_calls", "n", "functions", "function_call", "audio", "modalities", "generationConfig.imageConfig", "generationConfig.speechConfig"} {
		body, _ = sjson.DeleteBytes(body, k)
	}
	if endpoint == string(constant.EndpointTypeGemini) {
		body, _ = sjson.DeleteBytes(body, "generationConfig.candidateCount")
		body, _ = sjson.SetBytes(body, "generationConfig.responseModalities", []string{"TEXT"})
	}
	for _, k := range []string{"max_tokens", "max_completion_tokens", "max_output_tokens", "generationConfig.maxOutputTokens"} {
		if gjson.GetBytes(body, k).Exists() {
			var err error
			body, err = sjson.SetBytes(body, k, model.IQOutputTokens)
			if err != nil {
				return nil, err
			}
		}
	}
	return sjson.SetBytes(body, key, model.IQOutputTokens)
}
func captureIQResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo, userID, channelID int, price hosttypes.PriceData, started time.Time) testResult {
	defer resp.Body.Close()
	// Never pass error bodies/headers into logs or generic provider error DTOs.
	if resp.StatusCode != http.StatusOK {
		return testResult{localErr: errors.New("upstream rejected IQ request")}
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, model.IQMaxResponseBytes+1))
	if err != nil {
		return testResult{localErr: err}
	}
	if len(body) > model.IQMaxResponseBytes {
		return testResult{localErr: errors.New("IQ response exceeds 2 MiB")}
	}
	stream := strings.Contains(resp.Header.Get("Content-Type"), "text/event-stream") || info.IsStream
	text, textErr := service.IQVisibleText(body, stream)
	if textErr != nil {
		textErr = errors.Join(errIQInvalidOutput, textErr)
	}
	// Existing test funding records usage without pre-consuming/debiting quota.
	usage := iqResponseUsage(body, stream)
	quota, tiered := settleTestQuota(info, price, usage)
	model.RecordConsumeLog(c, userID, model.RecordConsumeLogParams{ChannelId: channelID, PromptTokens: usage.PromptTokens, CompletionTokens: usage.CompletionTokens, ModelName: info.OriginModelName, TokenName: "IQ test", Quota: quota, Content: []*common.Message{common.NewMessage("IQ test")}, UseTimeSeconds: int(time.Since(started).Seconds()), IsStream: stream, Group: info.UsingGroup, Other: buildTestLogOther(c, info, price, usage, tiered)})
	return testResult{context: c, text: text, localErr: textErr}
}
func iqResponseUsage(body []byte, stream bool) *dto.Usage {
	var input, output int64
	consume := func(v gjson.Result) {
		for _, path := range []string{"usage.prompt_tokens", "usage.input_tokens", "usageMetadata.promptTokenCount", "response.usage.input_tokens", "message.usage.input_tokens"} {
			if n := v.Get(path).Int(); n > input {
				input = n
			}
		}
		for _, path := range []string{"usage.completion_tokens", "usage.output_tokens", "usageMetadata.candidatesTokenCount", "response.usage.output_tokens"} {
			if n := v.Get(path).Int(); n > output {
				output = n
			}
		}
	}
	if !stream {
		consume(gjson.ParseBytes(body))
	} else {
		for _, line := range strings.Split(string(body), "\n") {
			if strings.HasPrefix(strings.TrimSpace(line), "data:") {
				consume(gjson.Parse(strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(line), "data:"))))
			}
		}
	}
	return &dto.Usage{PromptTokens: int(input), CompletionTokens: int(output), TotalTokens: int(input + output)}
}

type iqPairExecutor func(context.Context, int, string, string, string) model.IQResult

func executeIQPair(ctx context.Context, userID int, group, name, prompt string) model.IQResult {
	r := model.IQResult{Group: group, Model: name, Status: "unavailable", ErrorCode: "unavailable", ErrorMessage: "No compatible enabled route is available"}
	if ctx.Err() != nil {
		r.Status = "interrupted"
		r.ErrorCode = "interrupted"
		r.ErrorMessage = "Execution interrupted; not retried"
		return r
	}
	if !ratio_setting.ContainsGroupRatio(group) {
		return r
	}
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequestWithContext(ctx, http.MethodPost, "/v1/chat/completions", nil)
	common.SetContextKey(c, constant.ContextKeyUsingGroup, group)
	// No enumeration, priority fallback, retry controller or channel-health updates.
	channel, _, err := service.CacheGetRandomSatisfiedChannel(&service.RetryParam{Ctx: c, TokenGroup: group, ModelName: name, Retry: lo.ToPtr(0)})
	if err != nil || channel == nil || channel.Status != common.ChannelStatusEnabled {
		return r
	}
	endpoint := iqEndpoint(channel, name)
	if endpoint == "" {
		return r
	}
	result := testChannelWithIQ(ctx, channel, userID, name, endpoint, channel.Type == constant.ChannelTypeCodex, &iqChannelTestOptions{group: group, prompt: prompt})
	if result.localErr != nil {
		r.Status = "error"
		r.ErrorCode = "execution_failed"
		r.ErrorMessage = "IQ request failed"
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			r.Status = "timeout"
			r.ErrorCode = "timeout"
			r.ErrorMessage = "IQ request exceeded the three-minute limit"
		} else if ctx.Err() != nil {
			r.Status = "interrupted"
			r.ErrorCode = "interrupted"
			r.ErrorMessage = "Execution interrupted; not retried"
		} else if errors.Is(result.localErr, errIQInvalidOutput) || errors.Is(result.localErr, io.ErrUnexpectedEOF) || strings.Contains(result.localErr.Error(), "exceeds 2 MiB") {
			r.Status = "invalid_artifact"
			r.ErrorCode = "invalid_artifact"
			r.ErrorMessage = "Model output was incomplete or exceeded the size limit"
		}
		return r
	}
	kind, artifact, err := service.ExtractIQArtifact(result.text)
	if err != nil {
		r.Status = "invalid_artifact"
		r.ErrorCode = "invalid_artifact"
		r.ErrorMessage = "Model did not return a complete bounded HTML or SVG artifact"
		return r
	}
	r.Status = "success"
	r.ArtifactKind = kind
	r.Artifact = model.IQText(artifact)
	r.ErrorCode = ""
	r.ErrorMessage = ""
	return r
}
