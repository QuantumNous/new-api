package codex

import (
	"bytes"
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
	return nil, errors.New("codex channel: endpoint not supported")
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

// normalizeCodexResponsesInput rewrites the Responses-API `input` payload so the
// Codex backend receives the per-item-type shapes it expects.
//
// Two shapes are observed in real Codex CLI / Codex Desktop sessions:
//   - A bare JSON string: wrapped into a single user message so the upstream sees
//     a list of message items (matching Codex CLI's behavior).
//   - A JSON array of items: items whose `type` is listed in
//     dto.ObjectArgumentItemTypes (tool_search_call / web_search_call / ...) must
//     have `arguments` as a JSON object. function_call items keep `arguments`
//     as a JSON string, per the OpenAI Responses spec. Items already in the
//     correct shape are left untouched.
//
// Returns the original bytes unchanged when no rewrite is required.
func normalizeCodexResponsesInput(raw json.RawMessage) (json.RawMessage, error) {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 {
		return raw, nil
	}

	if raw[0] == '"' {
		var strInput string
		if err := common.Unmarshal(raw, &strInput); err != nil {
			return raw, err
		}
		wrapped := []map[string]string{
			{"role": "user", "content": strInput},
		}
		return common.Marshal(wrapped)
	}

	if raw[0] == '[' {
		var items []any
		if err := common.Unmarshal(raw, &items); err != nil {
			return raw, err
		}
		if convertCodexObjectArgItems(items) {
			return common.Marshal(items)
		}
		return raw, nil
	}

	return raw, nil
}

// convertCodexObjectArgItems walks the input array and converts string
// `arguments` values to JSON objects for item types that require it. Returns
// true if any item was modified.
func convertCodexObjectArgItems(items []any) bool {
	changed := false
	for _, item := range items {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		typ, _ := m["type"].(string)
		if !dto.ObjectArgumentItemTypes[typ] {
			continue
		}
		raw, has := m["arguments"]
		if !has {
			continue
		}
		switch v := raw.(type) {
		case map[string]any, []any:
			// already a JSON object/array
			continue
		case nil:
			m["arguments"] = map[string]any{}
			changed = true
		case string:
			m["arguments"] = parseStringArgsToObject(v)
			changed = true
		default:
			m["arguments"] = map[string]any{"value": v}
			changed = true
		}
	}
	return changed
}

// parseStringArgsToObject parses a JSON-string arguments value into a map.
//
// Compliant clients (Codex Desktop, Codex CLI) always send object-shaped
// arguments for the item types listed in dto.ObjectArgumentItemTypes, so this
// function is only reached on misbehaving / legacy clients that wrap the
// arguments into a string. Behavior:
//
//   - empty string                 -> {}
//   - valid JSON object            -> the object itself
//   - valid JSON null              -> {}
//   - valid JSON of any other kind -> {"value": <parsed value>}
//   - invalid JSON                 -> {"value": <original string>}
//
// The fallback wrapper (`{"value": ...}`) is best-effort: it preserves the
// payload so the upstream can choose to accept or reject it, instead of
// silently dropping data here. If the upstream's tool schema doesn't accept
// the wrapped shape, the upstream will surface the error to the client,
// which is the desired behavior for a relay.
func parseStringArgsToObject(s string) map[string]any {
	trimmed := strings.TrimSpace(s)
	if trimmed == "" {
		return map[string]any{}
	}
	var parsed any
	if err := common.UnmarshalJsonStr(trimmed, &parsed); err != nil {
		return map[string]any{"value": s}
	}
	if parsed == nil {
		return map[string]any{}
	}
	if obj, ok := parsed.(map[string]any); ok {
		return obj
	}
	return map[string]any{"value": parsed}
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	isCompact := info != nil && info.RelayMode == relayconstant.RelayModeResponsesCompact

	if len(request.Input) > 0 {
		normalizedInput, err := normalizeCodexResponsesInput(request.Input)
		if err != nil {
			return nil, err
		}
		request.Input = normalizedInput
	}

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
	// rm max_output_tokens
	request.MaxOutputTokens = nil
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
	return openai.OaiResponsesHandler(c, info, resp)
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
	if info.IsStream {
		req.Set("Accept", "text/event-stream")
	} else if req.Get("Accept") == "" {
		req.Set("Accept", "application/json")
	}

	return nil
}
