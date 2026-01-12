package common

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type ThinkingContentInfo struct {
	IsFirstThinkingContent  bool
	SendLastThinkingContent bool
	HasSentThinkingContent  bool
}

const (
	LastMessageTypeNone     = "none"
	LastMessageTypeText     = "text"
	LastMessageTypeTools    = "tools"
	LastMessageTypeThinking = "thinking"
)

type ClaudeConvertInfo struct {
	LastMessagesType string
	Index            int
	Usage            *dto.Usage
	FinishReason     string
	Done             bool
}

type RerankerInfo struct {
	Documents       []any
	ReturnDocuments bool
}

type BuildInToolInfo struct {
	ToolName          string
	CallCount         int
	SearchContextSize string
}

type ResponsesUsageInfo struct {
	BuiltInTools map[string]*BuildInToolInfo
}

type ChannelMeta struct {
	ChannelType          int
	ChannelId            int
	ChannelIsMultiKey    bool
	ChannelMultiKeyIndex int
	ChannelBaseUrl       string
	ApiType              int
	ApiVersion           string
	ApiKey               string
	Organization         string
	ChannelCreateTime    int64
	ParamOverride        map[string]interface{}
	HeadersOverride      map[string]interface{}
	ChannelSetting       dto.ChannelSettings
	ChannelOtherSettings dto.ChannelOtherSettings
	UpstreamModelName    string
	IsModelMapped        bool
	SupportStreamOptions bool // 是否支持流式选项
}

type TokenCountMeta struct {
	//promptTokens int
	estimatePromptTokens int
}

type RelayInfo struct {
	TokenId           int
	TokenKey          string
	TokenGroup        string
	UserId            int
	UsingGroup        string // 使用的分组，当auto跨分组重试时，会变动
	UserGroup         string // 用户所在分组
	TokenUnlimited    bool
	StartTime         time.Time
	FirstResponseTime time.Time
	isFirstResponse   bool
	//SendLastReasoningResponse bool
	IsStream               bool
	IsGeminiBatchEmbedding bool
	IsPlayground           bool
	UsePrice               bool
	RelayMode              int
	OriginModelName        string
	RequestURLPath         string
	ShouldIncludeUsage     bool
	DisablePing            bool // 是否禁止向下游发送自定义 Ping
	ClientWs               *websocket.Conn
	TargetWs               *websocket.Conn
	InputAudioFormat       string
	OutputAudioFormat      string
	RealtimeTools          []dto.RealTimeTool
	IsFirstRequest         bool
	AudioUsage             bool
	ReasoningEffort        string
	UserSetting            dto.UserSetting
	UserEmail              string
	UserQuota              int
	RelayFormat            types.RelayFormat
	SendResponseCount      int
	FinalPreConsumedQuota  int  // 最终预消耗的配额
	IsClaudeBetaQuery      bool // /v1/messages?beta=true
	IsChannelTest          bool // channel test request

	PriceData types.PriceData

	Request dto.Request

	ThinkingContentInfo
	TokenCountMeta
	*ClaudeConvertInfo
	*RerankerInfo
	*ResponsesUsageInfo
	*ChannelMeta
	*TaskRelayInfo
}

func (info *RelayInfo) InitChannelMeta(c *gin.Context) {
	channelType := common.GetContextKeyInt(c, constant.ContextKeyChannelType)
	paramOverride := common.GetContextKeyStringMap(c, constant.ContextKeyChannelParamOverride)
	headerOverride := common.GetContextKeyStringMap(c, constant.ContextKeyChannelHeaderOverride)
	apiType, _ := common.ChannelType2APIType(channelType)
	channelMeta := &ChannelMeta{
		ChannelType:          channelType,
		ChannelId:            common.GetContextKeyInt(c, constant.ContextKeyChannelId),
		ChannelIsMultiKey:    common.GetContextKeyBool(c, constant.ContextKeyChannelIsMultiKey),
		ChannelMultiKeyIndex: common.GetContextKeyInt(c, constant.ContextKeyChannelMultiKeyIndex),
		ChannelBaseUrl:       common.GetContextKeyString(c, constant.ContextKeyChannelBaseUrl),
		ApiType:              apiType,
		ApiVersion:           c.GetString("api_version"),
		ApiKey:               common.GetContextKeyString(c, constant.ContextKeyChannelKey),
		Organization:         c.GetString("channel_organization"),
		ChannelCreateTime:    c.GetInt64("channel_create_time"),
		ParamOverride:        paramOverride,
		HeadersOverride:      headerOverride,
		UpstreamModelName:    common.GetContextKeyString(c, constant.ContextKeyOriginalModel),
		IsModelMapped:        false,
		SupportStreamOptions: false,
	}

	if channelType == constant.ChannelTypeAzure {
		channelMeta.ApiVersion = GetAPIVersion(c)
	}
	if channelType == constant.ChannelTypeVertexAi {
		channelMeta.ApiVersion = c.GetString("region")
	}

	channelSetting, ok := common.GetContextKeyType[dto.ChannelSettings](c, constant.ContextKeyChannelSetting)
	if ok {
		channelMeta.ChannelSetting = channelSetting
	}

	channelOtherSettings, ok := common.GetContextKeyType[dto.ChannelOtherSettings](c, constant.ContextKeyChannelOtherSetting)
	if ok {
		channelMeta.ChannelOtherSettings = channelOtherSettings
	}

	if streamSupportedChannels[channelMeta.ChannelType] {
		channelMeta.SupportStreamOptions = true
	}

	info.ChannelMeta = channelMeta

	// reset some fields based on channel meta
	// 重置某些字段，例如模型名称等
	if info.Request != nil {
		info.Request.SetModelName(info.OriginModelName)
	}
}

func (info *RelayInfo) ToString() string {
	if info == nil {
		return "RelayInfo<nil>"
	}

	// Basic info
	b := &strings.Builder{}
	fmt.Fprintf(b, "RelayInfo{ ")
	fmt.Fprintf(b, "RelayFormat: %s, ", info.RelayFormat)
	fmt.Fprintf(b, "RelayMode: %d, ", info.RelayMode)
	fmt.Fprintf(b, "IsStream: %t, ", info.IsStream)
	fmt.Fprintf(b, "IsPlayground: %t, ", info.IsPlayground)
	fmt.Fprintf(b, "RequestURLPath: %q, ", info.RequestURLPath)
	fmt.Fprintf(b, "OriginModelName: %q, ", info.OriginModelName)
	fmt.Fprintf(b, "EstimatePromptTokens: %d, ", info.estimatePromptTokens)
	fmt.Fprintf(b, "ShouldIncludeUsage: %t, ", info.ShouldIncludeUsage)
	fmt.Fprintf(b, "DisablePing: %t, ", info.DisablePing)
	fmt.Fprintf(b, "SendResponseCount: %d, ", info.SendResponseCount)
	fmt.Fprintf(b, "FinalPreConsumedQuota: %d, ", info.FinalPreConsumedQuota)

	// User & token info (mask secrets)
	fmt.Fprintf(b, "User{ Id: %d, Email: %q, Group: %q, UsingGroup: %q, Quota: %d }, ",
		info.UserId, common.MaskEmail(info.UserEmail), info.UserGroup, info.UsingGroup, info.UserQuota)
	fmt.Fprintf(b, "Token{ Id: %d, Unlimited: %t, Key: ***masked*** }, ", info.TokenId, info.TokenUnlimited)

	// Time info
	latencyMs := info.FirstResponseTime.Sub(info.StartTime).Milliseconds()
	fmt.Fprintf(b, "Timing{ Start: %s, FirstResponse: %s, LatencyMs: %d }, ",
		info.StartTime.Format(time.RFC3339Nano), info.FirstResponseTime.Format(time.RFC3339Nano), latencyMs)

	// Audio / realtime
	if info.InputAudioFormat != "" || info.OutputAudioFormat != "" || len(info.RealtimeTools) > 0 || info.AudioUsage {
		fmt.Fprintf(b, "Realtime{ AudioUsage: %t, InFmt: %q, OutFmt: %q, Tools: %d }, ",
			info.AudioUsage, info.InputAudioFormat, info.OutputAudioFormat, len(info.RealtimeTools))
	}

	// Reasoning
	if info.ReasoningEffort != "" {
		fmt.Fprintf(b, "ReasoningEffort: %q, ", info.ReasoningEffort)
	}

	// Price data (non-sensitive)
	if info.PriceData.UsePrice {
		fmt.Fprintf(b, "PriceData{ %s }, ", info.PriceData.ToSetting())
	}

	// Channel metadata (mask ApiKey)
	if info.ChannelMeta != nil {
		cm := info.ChannelMeta
		fmt.Fprintf(b, "ChannelMeta{ Type: %d, Id: %d, IsMultiKey: %t, MultiKeyIndex: %d, BaseURL: %q, ApiType: %d, ApiVersion: %q, Organization: %q, CreateTime: %d, UpstreamModelName: %q, IsModelMapped: %t, SupportStreamOptions: %t, ApiKey: ***masked*** }, ",
			cm.ChannelType, cm.ChannelId, cm.ChannelIsMultiKey, cm.ChannelMultiKeyIndex, cm.ChannelBaseUrl, cm.ApiType, cm.ApiVersion, cm.Organization, cm.ChannelCreateTime, cm.UpstreamModelName, cm.IsModelMapped, cm.SupportStreamOptions)
	}

	// Responses usage info (non-sensitive)
	if info.ResponsesUsageInfo != nil && len(info.ResponsesUsageInfo.BuiltInTools) > 0 {
		fmt.Fprintf(b, "ResponsesTools{ ")
		first := true
		for name, tool := range info.ResponsesUsageInfo.BuiltInTools {
			if !first {
				fmt.Fprintf(b, ", ")
			}
			first = false
			if tool != nil {
				fmt.Fprintf(b, "%s: calls=%d", name, tool.CallCount)
			} else {
				fmt.Fprintf(b, "%s: calls=0", name)
			}
		}
		fmt.Fprintf(b, " }, ")
	}

	fmt.Fprintf(b, "}")
	return b.String()
}

// 定义支持流式选项的通道类型
var streamSupportedChannels = map[int]bool{
	constant.ChannelTypeOpenAI:     true,
	constant.ChannelTypeAnthropic:  true,
	constant.ChannelTypeAws:        true,
	constant.ChannelTypeGemini:     true,
	constant.ChannelCloudflare:     true,
	constant.ChannelTypeAzure:      true,
	constant.ChannelTypeVolcEngine: true,
	constant.ChannelTypeOllama:     true,
	constant.ChannelTypeXai:        true,
	constant.ChannelTypeDeepSeek:   true,
	constant.ChannelTypeBaiduV2:    true,
	constant.ChannelTypeZhipu_v4:   true,
	constant.ChannelTypeAli:        true,
	constant.ChannelTypeSubmodel:   true,
}

func GenRelayInfoWs(c *gin.Context, ws *websocket.Conn) *RelayInfo {
	info := genBaseRelayInfo(c, nil)
	info.RelayFormat = types.RelayFormatOpenAIRealtime
	info.ClientWs = ws
	info.InputAudioFormat = "pcm16"
	info.OutputAudioFormat = "pcm16"
	info.IsFirstRequest = true
	return info
}

func GenRelayInfoClaude(c *gin.Context, request dto.Request) *RelayInfo {
	info := genBaseRelayInfo(c, request)
	info.RelayFormat = types.RelayFormatClaude
	info.ShouldIncludeUsage = false
	info.ClaudeConvertInfo = &ClaudeConvertInfo{
		LastMessagesType: LastMessageTypeNone,
	}
	if c.Query("beta") == "true" {
		info.IsClaudeBetaQuery = true
	}
	return info
}

func GenRelayInfoRerank(c *gin.Context, request *dto.RerankRequest) *RelayInfo {
	info := genBaseRelayInfo(c, request)
	info.RelayMode = relayconstant.RelayModeRerank
	info.RelayFormat = types.RelayFormatRerank
	info.RerankerInfo = &RerankerInfo{
		Documents:       request.Documents,
		ReturnDocuments: request.GetReturnDocuments(),
	}
	return info
}

func GenRelayInfoOpenAIAudio(c *gin.Context, request dto.Request) *RelayInfo {
	info := genBaseRelayInfo(c, request)
	info.RelayFormat = types.RelayFormatOpenAIAudio
	return info
}

func GenRelayInfoEmbedding(c *gin.Context, request dto.Request) *RelayInfo {
	info := genBaseRelayInfo(c, request)
	info.RelayFormat = types.RelayFormatEmbedding
	return info
}

func GenRelayInfoResponses(c *gin.Context, request *dto.OpenAIResponsesRequest) *RelayInfo {
	info := genBaseRelayInfo(c, request)
	info.RelayMode = relayconstant.RelayModeResponses
	info.RelayFormat = types.RelayFormatOpenAIResponses

	info.ResponsesUsageInfo = &ResponsesUsageInfo{
		BuiltInTools: make(map[string]*BuildInToolInfo),
	}
	if len(request.Tools) > 0 {
		for _, tool := range request.GetToolsMap() {
			toolType := common.Interface2String(tool["type"])
			info.ResponsesUsageInfo.BuiltInTools[toolType] = &BuildInToolInfo{
				ToolName:  toolType,
				CallCount: 0,
			}
			switch toolType {
			case dto.BuildInToolWebSearchPreview:
				searchContextSize := common.Interface2String(tool["search_context_size"])
				if searchContextSize == "" {
					searchContextSize = "medium"
				}
				info.ResponsesUsageInfo.BuiltInTools[toolType].SearchContextSize = searchContextSize
			}
		}
	}
	return info
}

func GenRelayInfoGemini(c *gin.Context, request dto.Request) *RelayInfo {
	info := genBaseRelayInfo(c, request)
	info.RelayFormat = types.RelayFormatGemini
	info.ShouldIncludeUsage = false

	return info
}

func GenRelayInfoImage(c *gin.Context, request dto.Request) *RelayInfo {
	info := genBaseRelayInfo(c, request)
	info.RelayFormat = types.RelayFormatOpenAIImage
	return info
}

func GenRelayInfoOpenAI(c *gin.Context, request dto.Request) *RelayInfo {
	info := genBaseRelayInfo(c, request)
	info.RelayFormat = types.RelayFormatOpenAI
	return info
}

func genBaseRelayInfo(c *gin.Context, request dto.Request) *RelayInfo {

	//channelType := common.GetContextKeyInt(c, constant.ContextKeyChannelType)
	//channelId := common.GetContextKeyInt(c, constant.ContextKeyChannelId)
	//paramOverride := common.GetContextKeyStringMap(c, constant.ContextKeyChannelParamOverride)

	tokenGroup := common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
	// 当令牌分组为空时，表示使用用户分组
	if tokenGroup == "" {
		tokenGroup = common.GetContextKeyString(c, constant.ContextKeyUserGroup)
	}

	startTime := common.GetContextKeyTime(c, constant.ContextKeyRequestStartTime)
	if startTime.IsZero() {
		startTime = time.Now()
	}

	isStream := false

	if request != nil {
		isStream = request.IsStream(c)
	}

	// firstResponseTime = time.Now() - 1 second

	info := &RelayInfo{
		Request: request,

		UserId:     common.GetContextKeyInt(c, constant.ContextKeyUserId),
		UsingGroup: common.GetContextKeyString(c, constant.ContextKeyUsingGroup),
		UserGroup:  common.GetContextKeyString(c, constant.ContextKeyUserGroup),
		UserQuota:  common.GetContextKeyInt(c, constant.ContextKeyUserQuota),
		UserEmail:  common.GetContextKeyString(c, constant.ContextKeyUserEmail),

		OriginModelName: common.GetContextKeyString(c, constant.ContextKeyOriginalModel),

		TokenId:        common.GetContextKeyInt(c, constant.ContextKeyTokenId),
		TokenKey:       common.GetContextKeyString(c, constant.ContextKeyTokenKey),
		TokenUnlimited: common.GetContextKeyBool(c, constant.ContextKeyTokenUnlimited),
		TokenGroup:     tokenGroup,

		isFirstResponse: true,
		RelayMode:       relayconstant.Path2RelayMode(c.Request.URL.Path),
		RequestURLPath:  c.Request.URL.String(),
		IsStream:        isStream,

		StartTime:         startTime,
		FirstResponseTime: startTime.Add(-time.Second),
		ThinkingContentInfo: ThinkingContentInfo{
			IsFirstThinkingContent:  true,
			SendLastThinkingContent: false,
		},
		TokenCountMeta: TokenCountMeta{
			//promptTokens: common.GetContextKeyInt(c, constant.ContextKeyPromptTokens),
			estimatePromptTokens: common.GetContextKeyInt(c, constant.ContextKeyEstimatedTokens),
		},
	}

	if info.RelayMode == relayconstant.RelayModeUnknown {
		info.RelayMode = c.GetInt("relay_mode")
	}

	if strings.HasPrefix(c.Request.URL.Path, "/pg") {
		info.IsPlayground = true
		info.RequestURLPath = strings.TrimPrefix(info.RequestURLPath, "/pg")
		info.RequestURLPath = "/v1" + info.RequestURLPath
	}

	userSetting, ok := common.GetContextKeyType[dto.UserSetting](c, constant.ContextKeyUserSetting)
	if ok {
		info.UserSetting = userSetting
	}

	return info
}

func GenRelayInfo(c *gin.Context, relayFormat types.RelayFormat, request dto.Request, ws *websocket.Conn) (*RelayInfo, error) {
	switch relayFormat {
	case types.RelayFormatOpenAI:
		return GenRelayInfoOpenAI(c, request), nil
	case types.RelayFormatOpenAIAudio:
		return GenRelayInfoOpenAIAudio(c, request), nil
	case types.RelayFormatOpenAIImage:
		return GenRelayInfoImage(c, request), nil
	case types.RelayFormatOpenAIRealtime:
		return GenRelayInfoWs(c, ws), nil
	case types.RelayFormatClaude:
		return GenRelayInfoClaude(c, request), nil
	case types.RelayFormatRerank:
		if request, ok := request.(*dto.RerankRequest); ok {
			return GenRelayInfoRerank(c, request), nil
		}
		return nil, errors.New("request is not a RerankRequest")
	case types.RelayFormatGemini:
		return GenRelayInfoGemini(c, request), nil
	case types.RelayFormatEmbedding:
		return GenRelayInfoEmbedding(c, request), nil
	case types.RelayFormatOpenAIResponses:
		if request, ok := request.(*dto.OpenAIResponsesRequest); ok {
			return GenRelayInfoResponses(c, request), nil
		}
		return nil, errors.New("request is not a OpenAIResponsesRequest")
	case types.RelayFormatTask:
		return genBaseRelayInfo(c, nil), nil
	case types.RelayFormatMjProxy:
		return genBaseRelayInfo(c, nil), nil
	default:
		return nil, errors.New("invalid relay format")
	}
}

//func (info *RelayInfo) SetPromptTokens(promptTokens int) {
//	info.promptTokens = promptTokens
//}

func (info *RelayInfo) SetEstimatePromptTokens(promptTokens int) {
	info.estimatePromptTokens = promptTokens
}

func (info *RelayInfo) GetEstimatePromptTokens() int {
	return info.estimatePromptTokens
}

func (info *RelayInfo) SetFirstResponseTime() {
	if info.isFirstResponse {
		info.FirstResponseTime = time.Now()
		info.isFirstResponse = false
	}
}

func (info *RelayInfo) HasSendResponse() bool {
	return info.FirstResponseTime.After(info.StartTime)
}

type TaskRelayInfo struct {
	Action       string
	OriginTaskID string

	ConsumeQuota bool
}

type TaskSubmitReq struct {
	Prompt         string                 `json:"prompt"`
	Model          string                 `json:"model,omitempty"`
	Mode           string                 `json:"mode,omitempty"`
	Image          string                 `json:"image,omitempty"`
	Images         []string               `json:"images,omitempty"`
	Size           string                 `json:"size,omitempty"`
	Duration       int                    `json:"duration,omitempty"`
	Seconds        string                 `json:"seconds,omitempty"`
	InputReference string                 `json:"input_reference,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

func (t *TaskSubmitReq) GetPrompt() string {
	return t.Prompt
}

func (t *TaskSubmitReq) HasImage() bool {
	return len(t.Images) > 0
}

func (t *TaskSubmitReq) UnmarshalJSON(data []byte) error {
	type Alias TaskSubmitReq
	aux := &struct {
		Metadata json.RawMessage `json:"metadata,omitempty"`
		*Alias
	}{
		Alias: (*Alias)(t),
	}

	if err := common.Unmarshal(data, &aux); err != nil {
		return err
	}

	if len(aux.Metadata) > 0 {
		var metadataStr string
		if err := common.Unmarshal(aux.Metadata, &metadataStr); err == nil && metadataStr != "" {
			var metadataObj map[string]interface{}
			if err := common.Unmarshal([]byte(metadataStr), &metadataObj); err == nil {
				t.Metadata = metadataObj
				return nil
			}
		}

		var metadataObj map[string]interface{}
		if err := common.Unmarshal(aux.Metadata, &metadataObj); err == nil {
			t.Metadata = metadataObj
		}
	}

	return nil
}
func (t *TaskSubmitReq) UnmarshalMetadata(v any) error {
	metadata := t.Metadata
	if metadata != nil {
		metadataBytes, err := json.Marshal(metadata)
		if err != nil {
			return fmt.Errorf("marshal metadata failed: %w", err)
		}
		err = json.Unmarshal(metadataBytes, v)
		if err != nil {
			return fmt.Errorf("unmarshal metadata to target failed: %w", err)
		}
	}
	return nil
}

type TaskInfo struct {
	Code             int    `json:"code"`
	TaskID           string `json:"task_id"`
	Status           string `json:"status"`
	Reason           string `json:"reason,omitempty"`
	Url              string `json:"url,omitempty"`
	RemoteUrl        string `json:"remote_url,omitempty"`
	Progress         string `json:"progress,omitempty"`
	CompletionTokens int    `json:"completion_tokens,omitempty"` // 用于按倍率计费
	TotalTokens      int    `json:"total_tokens,omitempty"`      // 用于按倍率计费
}

func FailTaskInfo(reason string) *TaskInfo {
	return &TaskInfo{
		Status: "FAILURE",
		Reason: reason,
	}
}

// RemoveDisabledFields 从请求 JSON 数据中移除渠道设置中禁用的字段
// service_tier: 服务层级字段，可能导致额外计费（OpenAI、Claude、Responses API 支持）
// store: 数据存储授权字段，涉及用户隐私（仅 OpenAI、Responses API 支持，默认允许透传，禁用后可能导致 Codex 无法使用）
// safety_identifier: 安全标识符，用于向 OpenAI 报告违规用户（仅 OpenAI 支持，涉及用户隐私）
func RemoveDisabledFields(jsonData []byte, channelOtherSettings dto.ChannelOtherSettings) ([]byte, error) {
	var data map[string]interface{}
	if err := common.Unmarshal(jsonData, &data); err != nil {
		common.SysError("RemoveDisabledFields Unmarshal error :" + err.Error())
		return jsonData, nil
	}

	// 默认移除 service_tier，除非明确允许（避免额外计费风险）
	if !channelOtherSettings.AllowServiceTier {
		if _, exists := data["service_tier"]; exists {
			delete(data, "service_tier")
		}
	}

	// 默认允许 store 透传，除非明确禁用（禁用可能影响 Codex 使用）
	if channelOtherSettings.DisableStore {
		if _, exists := data["store"]; exists {
			delete(data, "store")
		}
	}

	// 默认移除 safety_identifier，除非明确允许（保护用户隐私，避免向 OpenAI 报告用户信息）
	if !channelOtherSettings.AllowSafetyIdentifier {
		if _, exists := data["safety_identifier"]; exists {
			delete(data, "safety_identifier")
		}
	}

	jsonDataAfter, err := common.Marshal(data)
	if err != nil {
		common.SysError("RemoveDisabledFields Marshal error :" + err.Error())
		return jsonData, nil
	}
	return jsonDataAfter, nil
}

// RemoveGeminiDisabledFields removes disabled fields from Gemini request JSON data
// Currently supports removing functionResponse.id field which Vertex AI does not support
func RemoveGeminiDisabledFields(jsonData []byte) ([]byte, error) {
	if !model_setting.GetGeminiSettings().RemoveFunctionResponseIdEnabled {
		return jsonData, nil
	}

	var data map[string]interface{}
	if err := common.Unmarshal(jsonData, &data); err != nil {
		common.SysError("RemoveGeminiDisabledFields Unmarshal error: " + err.Error())
		return jsonData, nil
	}

	// Process contents array
	// Handle both camelCase (functionResponse) and snake_case (function_response)
	if contents, ok := data["contents"].([]interface{}); ok {
		for _, content := range contents {
			if contentMap, ok := content.(map[string]interface{}); ok {
				if parts, ok := contentMap["parts"].([]interface{}); ok {
					for _, part := range parts {
						if partMap, ok := part.(map[string]interface{}); ok {
							// Check functionResponse (camelCase)
							if funcResp, ok := partMap["functionResponse"].(map[string]interface{}); ok {
								delete(funcResp, "id")
							}
							// Check function_response (snake_case)
							if funcResp, ok := partMap["function_response"].(map[string]interface{}); ok {
								delete(funcResp, "id")
							}
						}
					}
				}
			}
		}
	}

	jsonDataAfter, err := common.Marshal(data)
	if err != nil {
		common.SysError("RemoveGeminiDisabledFields Marshal error: " + err.Error())
		return jsonData, nil
	}
	return jsonDataAfter, nil
}
