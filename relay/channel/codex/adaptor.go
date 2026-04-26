package codex

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

type Adaptor struct {
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("codex channel: endpoint not supported")
}

func (a *Adaptor) ConvertClaudeRequest(*gin.Context, *relaycommon.RelayInfo, *dto.ClaudeRequest) (any, error) {
	return nil, errors.New("codex channel: /v1/messages endpoint not supported")
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("codex channel: endpoint not supported")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	relayMode := relayconstant.RelayModeUnknown
	if info != nil {
		relayMode = info.RelayMode
	}
	switch relayMode {
	case relayconstant.RelayModeImagesGenerations, relayconstant.RelayModeImagesEdits:
		return buildCodexImageResponsesRequest(c, info, request)
	default:
		return nil, errors.New("codex channel: only /v1/images/generations and /v1/images/edits are supported for image requests")
	}
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	return nil, errors.New("codex channel: /v1/chat/completions endpoint not supported")
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, errors.New("codex channel: /v1/rerank endpoint not supported")
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return nil, errors.New("codex channel: /v1/embeddings endpoint not supported")
}

func normalizeCodexResponsesInput(raw json.RawMessage) (json.RawMessage, error) {
	if common.GetJsonType(raw) != "string" {
		return raw, nil
	}
	var input string
	if err := common.Unmarshal(raw, &input); err != nil {
		return raw, err
	}
	return common.Marshal([]map[string]string{{
		"role":    "user",
		"content": input,
	}})
}

func normalizeCodexResponsesTools(raw json.RawMessage) (json.RawMessage, error) {
	if len(raw) == 0 || common.GetJsonType(raw) != "array" {
		return raw, nil
	}
	var tools []map[string]any
	if err := common.Unmarshal(raw, &tools); err != nil {
		return raw, err
	}
	changed := false
	for i := range tools {
		if common.Interface2String(tools[i]["type"]) != imageGenerationTool {
			continue
		}
		if strings.TrimSpace(common.Interface2String(tools[i]["model"])) == "" {
			tools[i]["model"] = CodexImageModel
			changed = true
		}
	}
	if !changed {
		return raw, nil
	}
	return common.Marshal(tools)
}

func buildCodexRawResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest, isCompact bool) (json.RawMessage, bool, error) {
	if c == nil || c.Request == nil || c.Request.Body == nil {
		return nil, false, nil
	}
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, false, err
	}
	raw, err := storage.Bytes()
	if err != nil {
		return nil, false, err
	}
	if len(raw) == 0 || common.GetJsonType(raw) != "object" {
		return nil, false, nil
	}

	out := string(raw)
	if request.Model != "" && gjson.Get(out, "model").String() != request.Model {
		out, err = sjson.Set(out, "model", request.Model)
		if err != nil {
			return nil, false, err
		}
	}

	input := gjson.Get(out, "input")
	if input.Exists() && input.Type == gjson.String {
		wrapped := []map[string]string{{
			"role":    "user",
			"content": input.String(),
		}}
		out, err = sjson.Set(out, "input", wrapped)
		if err != nil {
			return nil, false, err
		}
	}

	if tools := gjson.Get(out, "tools"); tools.Exists() && tools.IsArray() {
		normalizedTools, err := normalizeCodexResponsesTools(json.RawMessage(tools.Raw))
		if err != nil {
			return nil, false, err
		}
		if string(normalizedTools) != tools.Raw {
			out, err = sjson.SetRaw(out, "tools", string(normalizedTools))
			if err != nil {
				return nil, false, err
			}
		}
	}

	if info != nil && info.ChannelMeta != nil && info.ChannelSetting.SystemPrompt != "" {
		systemPrompt := info.ChannelSetting.SystemPrompt
		instructions := gjson.Get(out, "instructions")
		if !instructions.Exists() {
			out, err = sjson.Set(out, "instructions", systemPrompt)
			if err != nil {
				return nil, false, err
			}
		} else if info.ChannelSetting.SystemPromptOverride {
			if instructions.Type == gjson.String {
				existing := strings.TrimSpace(instructions.String())
				if existing != "" {
					systemPrompt += "\n" + existing
				}
			}
			out, err = sjson.Set(out, "instructions", systemPrompt)
			if err != nil {
				return nil, false, err
			}
		}
	} else if !gjson.Get(out, "instructions").Exists() {
		out, err = sjson.Set(out, "instructions", "")
		if err != nil {
			return nil, false, err
		}
	}

	if !isCompact {
		out, err = sjson.Set(out, "stream", true)
		if err != nil {
			return nil, false, err
		}
		out, err = sjson.Set(out, "store", false)
		if err != nil {
			return nil, false, err
		}
		out, err = sjson.Delete(out, "max_output_tokens")
		if err != nil {
			return nil, false, err
		}
		out, err = sjson.Delete(out, "temperature")
		if err != nil {
			return nil, false, err
		}
	}

	return json.RawMessage(out), true, nil
}

func IsRawResponsesRequest(request any) bool {
	_, ok := request.(json.RawMessage)
	return ok
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	isCompact := info != nil && info.RelayMode == relayconstant.RelayModeResponsesCompact

	if rawRequest, ok, err := buildCodexRawResponsesRequest(c, info, request, isCompact); ok || err != nil {
		return rawRequest, err
	}

	if len(request.Input) > 0 {
		normalizedInput, err := normalizeCodexResponsesInput(request.Input)
		if err != nil {
			return nil, err
		}
		request.Input = normalizedInput
	}
	if len(request.Tools) > 0 {
		normalizedTools, err := normalizeCodexResponsesTools(request.Tools)
		if err != nil {
			return nil, err
		}
		request.Tools = normalizedTools
	}

	if info != nil && info.ChannelMeta != nil && info.ChannelSetting.SystemPrompt != "" {
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
	request.Stream = common.GetPointer(true)
	// codex: store must be false
	request.Store = json.RawMessage("false")
	// rm max_output_tokens
	request.MaxOutputTokens = nil
	request.Temperature = nil
	return request, nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	if isCodexImageRelayMode(info) {
		return handleImageResponse(c, resp, info)
	}

	if info == nil {
		return nil, types.NewError(errors.New("codex channel: relay info is nil"), types.ErrorCodeInvalidRequest)
	}
	if info.RelayMode != relayconstant.RelayModeResponses && info.RelayMode != relayconstant.RelayModeResponsesCompact {
		return nil, types.NewError(errors.New("codex channel: endpoint not supported"), types.ErrorCodeInvalidRequest)
	}

	if info.RelayMode == relayconstant.RelayModeResponsesCompact {
		return openai.OaiResponsesCompactionHandler(c, resp)
	}

	if info.IsStream {
		return handleResponsesStream(c, resp, info)
	}
	return handleResponsesNonStream(c, resp, info)
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info.RelayMode != relayconstant.RelayModeResponses &&
		info.RelayMode != relayconstant.RelayModeResponsesCompact &&
		!isCodexImageRelayMode(info) {
		return "", errors.New("codex channel: only /v1/responses, /v1/responses/compact, /v1/images/generations and /v1/images/edits are supported")
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
	if info.IsStream || info.RelayMode == relayconstant.RelayModeResponses || isCodexImageRelayMode(info) {
		req.Set("Accept", "text/event-stream")
	} else if req.Get("Accept") == "" {
		req.Set("Accept", "application/json")
	}

	return nil
}
