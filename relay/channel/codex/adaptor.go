package codex

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	appconstant "github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("codex channel: endpoint not supported")
}

func (a *Adaptor) ConvertClaudeRequest(*gin.Context, *relaycommon.RelayInfo, *dto.ClaudeRequest) (any, error) {
	return nil, errors.New("codex channel: endpoint not supported")
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("codex channel: endpoint not supported")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return nil, errors.New("codex channel: endpoint not supported")
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	return nil, errors.New("codex channel: endpoint not supported")
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, errors.New("codex channel: endpoint not supported")
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return nil, errors.New("codex channel: endpoint not supported")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	isCompact := info != nil && info.RelayMode == relayconstant.RelayModeResponsesCompact

	if info != nil && info.ChannelSetting.SystemPrompt != "" {
		systemPrompt := info.ChannelSetting.SystemPrompt

		if len(request.Instructions) == 0 {
			if b, err := common.Marshal(systemPrompt); err == nil {
				request.Instructions = b
			} else {
				return nil, err
			}
		} else if info.ChannelSetting.SystemPromptOverride {
			var existing string
			if err := common.Unmarshal(request.Instructions, &existing); err == nil {
				existing = strings.TrimSpace(existing)
				if existing == "" {
					if b, err := common.Marshal(systemPrompt); err == nil {
						request.Instructions = b
					} else {
						return nil, err
					}
				} else {
					if b, err := common.Marshal(systemPrompt + "\n" + existing); err == nil {
						request.Instructions = b
					} else {
						return nil, err
					}
				}
			} else {
				if b, err := common.Marshal(systemPrompt); err == nil {
					request.Instructions = b
				} else {
					return nil, err
				}
			}
		}
	}
	// Codex backend requires the `instructions` field to be present.
	// Keep it consistent with Codex CLI behavior by defaulting to an empty string.
	if len(request.Instructions) == 0 {
		request.Instructions = json.RawMessage(`""`)
	}

	if isCompact {
		return request, nil
	}
	// codex: store must be false
	request.Store = json.RawMessage("false")
	// Codex backend only supports streaming for /responses. For non-stream requests, we still send
	// stream=true upstream and buffer the SSE response into a single JSON response for the client.
	request.Stream = true
	// rm max_output_tokens
	request.MaxOutputTokens = 0
	request.Temperature = nil
	return request, nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	if info.RelayMode != relayconstant.RelayModeResponses && info.RelayMode != relayconstant.RelayModeResponsesCompact {
		return nil, types.NewError(errors.New("codex channel: endpoint not supported"), types.ErrorCodeInvalidRequest)
	}

	if info.RelayMode == relayconstant.RelayModeResponsesCompact {
		return openai.OaiResponsesCompactionHandler(c, resp)
	}

	if info.IsStream {
		return openai.OaiResponsesStreamHandler(c, info, resp)
	}

	// Codex upstream requires streaming for /responses. If the client requested non-stream, we need to
	// buffer SSE until response.completed and return the completed response JSON.
	return responsesNonStreamViaStreamHandler(c, info, resp)
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info.RelayMode != relayconstant.RelayModeResponses && info.RelayMode != relayconstant.RelayModeResponsesCompact {
		return "", errors.New("codex channel: only /v1/responses and /v1/responses/compact are supported")
	}
	path := "/backend-api/codex/responses"
	if info.RelayMode == relayconstant.RelayModeResponsesCompact {
		path = "/backend-api/codex/responses/compact"
	}
	return relaycommon.GetFullRequestURL(info.ChannelBaseUrl, path, info.ChannelType), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)

	key := strings.TrimSpace(info.ApiKey)
	if !strings.HasPrefix(key, "{") {
		return errors.New("codex channel: key must be a JSON object")
	}

	oauthKey, err := ParseOAuthKey(key)
	if err != nil {
		return err
	}

	accessToken := strings.TrimSpace(oauthKey.AccessToken)
	accountID := strings.TrimSpace(oauthKey.AccountID)

	if accessToken == "" {
		return errors.New("codex channel: access_token is required")
	}
	if accountID == "" {
		return errors.New("codex channel: account_id is required")
	}

	req.Set("Authorization", "Bearer "+accessToken)
	req.Set("chatgpt-account-id", accountID)

	if req.Get("OpenAI-Beta") == "" {
		req.Set("OpenAI-Beta", "responses=experimental")
	}
	if req.Get("originator") == "" {
		req.Set("originator", "codex_cli_rs")
	}

	// chatgpt.com/backend-api/codex/responses is strict about Content-Type.
	// Clients may omit it or include parameters like `application/json; charset=utf-8`,
	// which can be rejected by the upstream. Force the exact media type.
	req.Set("Content-Type", "application/json")
	// Codex upstream requires streaming for /responses.
	if info.RelayMode == relayconstant.RelayModeResponses {
		req.Set("Accept", "text/event-stream")
	} else if info.IsStream {
		req.Set("Accept", "text/event-stream")
	} else if req.Get("Accept") == "" {
		req.Set("Accept", "application/json")
	}

	return nil
}

type codexResponsesEvent struct {
	Type     string          `json:"type"`
	Response json.RawMessage `json:"response,omitempty"`
}

func responsesNonStreamViaStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (any, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse)
	}
	defer service.CloseResponseBodyGracefully(resp)

	responseBody, newAPIError := extractCompletedResponseFromSSE(resp.Body)
	if newAPIError != nil {
		return nil, newAPIError
	}

	synth := &http.Response{
		StatusCode: resp.StatusCode,
		Header:     sanitizeHeadersForNonStream(resp.Header),
		Body:       io.NopCloser(bytes.NewReader(responseBody)),
	}
	synth.Header.Set("Content-Type", "application/json")
	return openai.OaiResponsesHandler(c, info, synth)
}

func extractCompletedResponseFromSSE(body io.Reader) ([]byte, *types.NewAPIError) {
	if body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("empty response body"), types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	reader := bufio.NewReader(body)
	if peek, err := reader.Peek(256); err == nil || len(peek) > 0 {
		trimmed := bytes.TrimSpace(peek)
		if len(trimmed) > 0 && (trimmed[0] == '{' || trimmed[0] == '[') {
			b, readErr := io.ReadAll(reader)
			if readErr != nil {
				return nil, types.NewOpenAIError(readErr, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
			}
			return b, nil
		}
	}

	maxSize := helper.DefaultMaxScannerBufferSize
	if appconstant.StreamScannerMaxBufferMB > 0 {
		maxSize = appconstant.StreamScannerMaxBufferMB << 20
	}

	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, helper.InitialScannerBufferSize), maxSize)
	scanner.Split(bufio.ScanLines)

	var currentEventType string
	for scanner.Scan() {
		line := strings.TrimSpace(strings.TrimSuffix(scanner.Text(), "\r"))
		if line == "" {
			continue
		}

		if strings.HasPrefix(line, ":") {
			// SSE comment line
			continue
		}

		if strings.HasPrefix(line, "[DONE]") {
			break
		}

		if strings.HasPrefix(line, "event:") {
			currentEventType = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
			continue
		}

		if !strings.HasPrefix(line, "data:") {
			continue
		}

		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		eventTypeForData := currentEventType
		currentEventType = ""
		if strings.HasPrefix(data, "[DONE]") {
			break
		}
		if data == "" {
			continue
		}

		var event codexResponsesEvent
		if err := common.UnmarshalJsonStr(data, &event); err != nil {
			switch eventTypeForData {
			case "response.completed":
				return []byte(data), nil
			case "response.error", "response.failed":
				return nil, types.NewOpenAIError(fmt.Errorf("responses stream error: %s", eventTypeForData), types.ErrorCodeBadResponse, http.StatusInternalServerError)
			default:
				continue
			}
		}

		if event.Type == "" {
			switch eventTypeForData {
			case "response.completed":
				return []byte(data), nil
			case "response.error", "response.failed":
				return nil, types.NewOpenAIError(fmt.Errorf("responses stream error: %s", eventTypeForData), types.ErrorCodeBadResponse, http.StatusInternalServerError)
			default:
				continue
			}
		}

		switch event.Type {
		case "response.completed":
			if len(event.Response) == 0 {
				return nil, types.NewOpenAIError(fmt.Errorf("responses stream error: missing response on response.completed"), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
			}
			return event.Response, nil
		case "response.error", "response.failed":
			if len(event.Response) > 0 {
				var response dto.OpenAIResponsesResponse
				if err := common.Unmarshal(event.Response, &response); err == nil {
					if oaiErr := response.GetOpenAIError(); oaiErr != nil && oaiErr.Type != "" {
						return nil, types.WithOpenAIError(*oaiErr, http.StatusInternalServerError)
					}
				}
			}
			return nil, types.NewOpenAIError(fmt.Errorf("responses stream error: %s", event.Type), types.ErrorCodeBadResponse, http.StatusInternalServerError)
		default:
		}
	}

	if err := scanner.Err(); err != nil && err != io.EOF {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	return nil, types.NewOpenAIError(fmt.Errorf("stream disconnected before completion"), types.ErrorCodeBadResponse, http.StatusRequestTimeout)
}

func sanitizeHeadersForNonStream(upstream http.Header) http.Header {
	out := make(http.Header, len(upstream))
	for k, v := range upstream {
		if strings.EqualFold(k, "Content-Type") ||
			strings.EqualFold(k, "Content-Length") ||
			strings.EqualFold(k, "Transfer-Encoding") ||
			strings.EqualFold(k, "Connection") ||
			strings.EqualFold(k, "Keep-Alive") ||
			strings.EqualFold(k, "Trailer") {
			continue
		}
		out[k] = append([]string(nil), v...)
	}
	return out
}
