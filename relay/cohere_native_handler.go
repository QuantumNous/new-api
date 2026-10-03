package relay

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

// CohereNativeHelper forwards the three supported v2 endpoints without changing their wire format.
func CohereNativeHelper(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
	info.InitChannelMeta(c)
	if info.ChannelType != constant.ChannelTypeCohere {
		return types.NewErrorWithStatusCode(errors.New("unsupported endpoint for selected channel"), types.ErrorCodeInvalidApiType, http.StatusNotImplemented, types.ErrOptionWithSkipRetry())
	}
	path := c.Request.URL.Path
	if c.Request.Method != http.MethodPost || (path != "/v2/chat" && path != "/v2/embed" && path != "/v2/rerank") {
		return types.NewErrorWithStatusCode(errors.New("unsupported endpoint"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	info.RequestURLPath = path
	if c.Request.URL.RawQuery != "" {
		info.RequestURLPath += "?" + c.Request.URL.RawQuery
	}
	request, ok := info.Request.(*dto.CohereNativeRequest)
	if !ok {
		return types.NewErrorWithStatusCode(errors.New("invalid request"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	if path != "/v2/chat" && request.Stream {
		return types.NewErrorWithStatusCode(errors.New("stream is only supported for Cohere chat"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	if err := helper.ModelMappedHelper(c, info, request); err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}
	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(errors.New("invalid API type"), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)
	body, size, err := relaycommon.PassThroughRequestBody(c, info)
	if err != nil {
		return types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	if len(info.ParamOverride) > 0 {
		raw, readErr := io.ReadAll(body)
		if readErr != nil {
			return types.NewError(readErr, types.ErrorCodeReadRequestBodyFailed)
		}
		raw, err = relaycommon.ApplyParamOverrideWithRelayInfo(raw, info)
		if err != nil {
			return newAPIErrorFromParamOverride(err)
		}
		body, size = bytes.NewReader(raw), int64(len(raw))
	}
	info.UpstreamRequestBodySize = size
	response, err := adaptor.DoRequest(c, info, body)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}
	resp, ok := response.(*http.Response)
	if !ok || resp == nil {
		return types.NewError(fmt.Errorf("invalid upstream response type %T", response), types.ErrorCodeBadResponse)
	}
	defer service.CloseResponseBodyGracefully(resp)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		upstreamErr := service.RelayErrorHandler(c.Request.Context(), resp, false)
		service.ResetStatusCode(upstreamErr, c.GetString("status_code_mapping"))
		return upstreamErr
	}
	for _, key := range []string{"Content-Type", "Cache-Control"} {
		if value := resp.Header.Get(key); value != "" {
			c.Writer.Header().Set(key, value)
		}
	}
	var usage *dto.Usage
	if strings.Contains(strings.ToLower(resp.Header.Get("Content-Type")), "text/event-stream") {
		c.Writer.WriteHeader(resp.StatusCode)
		usage, err = copyCohereNativeStream(c, resp.Body)
	} else {
		var raw []byte
		raw, err = io.ReadAll(resp.Body)
		if err != nil {
			return types.NewError(err, types.ErrorCodeReadResponseBodyFailed, types.ErrOptionWithSkipRetry())
		}
		usage = cohereNativeUsage(raw, path)
		c.Writer.WriteHeader(resp.StatusCode)
		_, err = c.Writer.Write(raw)
	}
	// A client disconnect after the upstream has responded must not refund a consumed request.
	if err != nil {
		common.SysLog("native response forwarding failed")
	}
	if usage == nil || usage.TotalTokens == 0 {
		// Count the original input when upstream usage is unavailable, including when global token counting is off.
		prompt := info.GetEstimatePromptTokens()
		if prompt < 1 {
			prompt = service.CountTextToken(request.GetTokenCountMeta().CombineText, info.OriginModelName)
		}
		if prompt < 1 {
			prompt = 1
		}
		usage = &dto.Usage{PromptTokens: prompt, InputTokens: prompt, TotalTokens: prompt}
		common.SysLog("native response missing usage; input estimated for billing")
	}
	service.PostTextConsumeQuota(c, info, usage, nil)
	return nil
}

func cohereNativeUsage(raw []byte, path string) *dto.Usage {
	var parsed struct {
		Usage struct {
			Tokens struct {
				InputTokens  int `json:"input_tokens"`
				OutputTokens int `json:"output_tokens"`
			} `json:"tokens"`
			BilledUnits struct {
				InputTokens  int `json:"input_tokens"`
				OutputTokens int `json:"output_tokens"`
			} `json:"billed_units"`
		} `json:"usage"`
		Meta struct {
			Tokens struct {
				InputTokens  int `json:"input_tokens"`
				OutputTokens int `json:"output_tokens"`
			} `json:"tokens"`
			BilledUnits struct {
				InputTokens  int `json:"input_tokens"`
				OutputTokens int `json:"output_tokens"`
			} `json:"billed_units"`
		} `json:"meta"`
	}
	if common.Unmarshal(raw, &parsed) != nil {
		return nil
	}
	input, output := parsed.Usage.Tokens.InputTokens, parsed.Usage.Tokens.OutputTokens
	if path != "/v2/chat" {
		input, output = parsed.Meta.Tokens.InputTokens, parsed.Meta.Tokens.OutputTokens
	}
	if input == 0 && output == 0 {
		if path == "/v2/chat" {
			input, output = parsed.Usage.BilledUnits.InputTokens, parsed.Usage.BilledUnits.OutputTokens
		} else {
			input, output = parsed.Meta.BilledUnits.InputTokens, parsed.Meta.BilledUnits.OutputTokens
		}
	}
	return &dto.Usage{PromptTokens: input, CompletionTokens: output, TotalTokens: input + output, InputTokens: input, OutputTokens: output}
}

func copyCohereNativeStream(c *gin.Context, body io.Reader) (*dto.Usage, error) {
	reader := bufio.NewReader(body)
	var usage *dto.Usage
	for {
		line, err := reader.ReadBytes('\n')
		if len(line) > 0 {
			trimmed := bytes.TrimSpace(line)
			if bytes.HasPrefix(trimmed, []byte("data:")) {
				var event struct {
					Type  string `json:"type"`
					Delta struct {
						Usage struct {
							Tokens struct {
								InputTokens  int `json:"input_tokens"`
								OutputTokens int `json:"output_tokens"`
							} `json:"tokens"`
							BilledUnits struct {
								InputTokens  int `json:"input_tokens"`
								OutputTokens int `json:"output_tokens"`
							} `json:"billed_units"`
						} `json:"usage"`
					} `json:"delta"`
				}
				if common.Unmarshal(bytes.TrimSpace(bytes.TrimPrefix(trimmed, []byte("data:"))), &event) == nil && event.Type == "message-end" {
					input, output := event.Delta.Usage.Tokens.InputTokens, event.Delta.Usage.Tokens.OutputTokens
					if input == 0 && output == 0 {
						input, output = event.Delta.Usage.BilledUnits.InputTokens, event.Delta.Usage.BilledUnits.OutputTokens
					}
					usage = &dto.Usage{PromptTokens: input, CompletionTokens: output, TotalTokens: input + output, InputTokens: input, OutputTokens: output}
				}
			}
			if _, writeErr := c.Writer.Write(line); writeErr != nil {
				return nil, writeErr
			}
			c.Writer.Flush()
		}
		if err == io.EOF {
			return usage, nil
		}
		if err != nil {
			return nil, err
		}
	}
}
