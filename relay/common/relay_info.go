package common

import (
	"one-api/common"
	"one-api/constant"
	"one-api/dto"
	relayconstant "one-api/relay/constant"
	"strings"
	"time"

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

const (
	RelayFormatOpenAI          = "openai"
	RelayFormatClaude          = "claude"
	RelayFormatGemini          = "gemini"
	RelayFormatOpenAIResponses = "openai_responses"
	RelayFormatOpenAIAudio     = "openai_audio"
	RelayFormatOpenAIImage     = "openai_image"
	RelayFormatRerank          = "rerank"
	RelayFormatEmbedding       = "embedding"
)

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

type RelayInfo struct {
	ChannelType       int
	ChannelId         int
	TokenId           int
	TokenKey          string
	UserId            int
	UsingGroup        string // 使用的分组
	UserGroup         string // 用户所在分组
	TokenUnlimited    bool
	StartTime         time.Time
	FirstResponseTime time.Time
	isFirstResponse   bool
	//SendLastReasoningResponse bool
	ApiType           int
	IsStream          bool
	IsPlayground      bool
	UsePrice          bool
	RelayMode         int
	UpstreamModelName string
	OriginModelName   string
	//RecodeModelName      string
	RequestURLPath       string
	ApiVersion           string
	PromptTokens         int
	ApiKey               string
	Organization         string
	BaseUrl              string
	SupportStreamOptions bool
	ShouldIncludeUsage   bool
	IsModelMapped        bool
	ClientWs             *websocket.Conn
	TargetWs             *websocket.Conn
	InputAudioFormat     string
	OutputAudioFormat    string
	RealtimeTools        []dto.RealTimeTool
	IsFirstRequest       bool
	AudioUsage           bool
	ReasoningEffort      string
	ChannelSetting       dto.ChannelSettings
	ParamOverride        map[string]interface{}
	UserSetting          dto.UserSetting
	UserEmail            string
	UserQuota            int
	RelayFormat          string
	SendResponseCount    int
	ChannelCreateTime    int64
	ThinkingContentInfo
	*ClaudeConvertInfo
	*RerankerInfo
	*ResponsesUsageInfo
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
}

func GenRelayInfoWs(c *gin.Context, ws *websocket.Conn) *RelayInfo {
	info := GenRelayInfo(c)
	info.ClientWs = ws
	info.InputAudioFormat = "pcm16"
	info.OutputAudioFormat = "pcm16"
	info.IsFirstRequest = true
	return info
}

func GenRelayInfoClaude(c *gin.Context) *RelayInfo {
	info := GenRelayInfo(c)
	info.RelayFormat = RelayFormatClaude
	info.ShouldIncludeUsage = false
	info.ClaudeConvertInfo = &ClaudeConvertInfo{
		LastMessagesType: LastMessageTypeNone,
	}
	return info
}

func GenRelayInfoRerank(c *gin.Context, req *dto.RerankRequest) *RelayInfo {
	info := GenRelayInfo(c)
	info.RelayMode = relayconstant.RelayModeRerank
	info.RelayFormat = RelayFormatRerank
	info.RerankerInfo = &RerankerInfo{
		Documents:       req.Documents,
		ReturnDocuments: req.GetReturnDocuments(),
	}
	return info
}

func GenRelayInfoOpenAIAudio(c *gin.Context) *RelayInfo {
	info := GenRelayInfo(c)
	info.RelayFormat = RelayFormatOpenAIAudio
	return info
}

func GenRelayInfoEmbedding(c *gin.Context) *RelayInfo {
	info := GenRelayInfo(c)
	info.RelayFormat = RelayFormatEmbedding
	return info
}

func GenRelayInfoResponses(c *gin.Context, req *dto.OpenAIResponsesRequest) *RelayInfo {
	info := GenRelayInfo(c)
	info.RelayMode = relayconstant.RelayModeResponses
	info.RelayFormat = RelayFormatOpenAIResponses

	info.SupportStreamOptions = false

	info.ResponsesUsageInfo = &ResponsesUsageInfo{
		BuiltInTools: make(map[string]*BuildInToolInfo),
	}
	if len(req.Tools) > 0 {
		for _, tool := range req.Tools {
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
	info.IsStream = req.Stream
	return info
}

func GenRelayInfoGemini(c *gin.Context) *RelayInfo {
	info := GenRelayInfo(c)
	info.RelayFormat = RelayFormatGemini
	info.ShouldIncludeUsage = false
	return info
}

func GenRelayInfoImage(c *gin.Context) *RelayInfo {
	info := GenRelayInfo(c)
	info.RelayFormat = RelayFormatOpenAIImage
	return info
}

func GenRelayInfo(c *gin.Context) *RelayInfo {
	channelType := common.GetContextKeyInt(c, constant.ContextKeyChannelType)
	channelId := common.GetContextKeyInt(c, constant.ContextKeyChannelId)
	paramOverride := common.GetContextKeyStringMap(c, constant.ContextKeyChannelParamOverride)

	tokenId := common.GetContextKeyInt(c, constant.ContextKeyTokenId)
	tokenKey := common.GetContextKeyString(c, constant.ContextKeyTokenKey)
	userId := common.GetContextKeyInt(c, constant.ContextKeyUserId)
	tokenUnlimited := common.GetContextKeyBool(c, constant.ContextKeyTokenUnlimited)
	startTime := common.GetContextKeyTime(c, constant.ContextKeyRequestStartTime)
	// firstResponseTime = time.Now() - 1 second

	apiType, _ := common.ChannelType2APIType(channelType)

	info := &RelayInfo{
		UserQuota:         common.GetContextKeyInt(c, constant.ContextKeyUserQuota),
		UserEmail:         common.GetContextKeyString(c, constant.ContextKeyUserEmail),
		isFirstResponse:   true,
		RelayMode:         relayconstant.Path2RelayMode(c.Request.URL.Path),
		BaseUrl:           common.GetContextKeyString(c, constant.ContextKeyChannelBaseUrl),
		RequestURLPath:    c.Request.URL.String(),
		ChannelType:       channelType,
		ChannelId:         channelId,
		TokenId:           tokenId,
		TokenKey:          tokenKey,
		UserId:            userId,
		UsingGroup:        common.GetContextKeyString(c, constant.ContextKeyUsingGroup),
		UserGroup:         common.GetContextKeyString(c, constant.ContextKeyUserGroup),
		TokenUnlimited:    tokenUnlimited,
		StartTime:         startTime,
		FirstResponseTime: startTime.Add(-time.Second),
		OriginModelName:   common.GetContextKeyString(c, constant.ContextKeyOriginalModel),
		UpstreamModelName: common.GetContextKeyString(c, constant.ContextKeyOriginalModel),
		//RecodeModelName:   c.GetString("original_model"),
		IsModelMapped: false,
		ApiType:       apiType,
		ApiVersion:    c.GetString("api_version"),
		ApiKey:        common.GetContextKeyString(c, constant.ContextKeyChannelKey),
		Organization:  c.GetString("channel_organization"),

		ChannelCreateTime: c.GetInt64("channel_create_time"),
		ParamOverride:     paramOverride,
		RelayFormat:       RelayFormatOpenAI,
		ThinkingContentInfo: ThinkingContentInfo{
			IsFirstThinkingContent:  true,
			SendLastThinkingContent: false,
		},
	}
	if strings.HasPrefix(c.Request.URL.Path, "/pg") {
		info.IsPlayground = true
		info.RequestURLPath = strings.TrimPrefix(info.RequestURLPath, "/pg")
		info.RequestURLPath = "/v1" + info.RequestURLPath
	}
	if info.BaseUrl == "" {
		info.BaseUrl = constant.ChannelBaseURLs[channelType]
	}
	if info.ChannelType == constant.ChannelTypeAzure {
		info.ApiVersion = GetAPIVersion(c)
	}
	if info.ChannelType == constant.ChannelTypeVertexAi {
		info.ApiVersion = c.GetString("region")
	}
	if streamSupportedChannels[info.ChannelType] {
		info.SupportStreamOptions = true
	}

	channelSetting, ok := common.GetContextKeyType[dto.ChannelSettings](c, constant.ContextKeyChannelSetting)
	if ok {
		info.ChannelSetting = channelSetting
	}
	userSetting, ok := common.GetContextKeyType[dto.UserSetting](c, constant.ContextKeyUserSetting)
	if ok {
		info.UserSetting = userSetting
	}

	return info
}

func (info *RelayInfo) SetPromptTokens(promptTokens int) {
	info.PromptTokens = promptTokens
}

func (info *RelayInfo) SetIsStream(isStream bool) {
	info.IsStream = isStream
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
	*RelayInfo
	Action       string
	OriginTaskID string

	ConsumeQuota bool
}

func GenTaskRelayInfo(c *gin.Context) *TaskRelayInfo {
	info := &TaskRelayInfo{
		RelayInfo: GenRelayInfo(c),
	}
	return info
}

type TaskSubmitReq struct {
	Prompt   string                 `json:"prompt"`
	Model    string                 `json:"model,omitempty"`
	Mode     string                 `json:"mode,omitempty"`
	Image    string                 `json:"image,omitempty"`
	Size     string                 `json:"size,omitempty"`
	Duration int                    `json:"duration,omitempty"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

type TaskInfo struct {
	Code     int    `json:"code"`
	TaskID   string `json:"task_id"`
	Status   string `json:"status"`
	Reason   string `json:"reason,omitempty"`
	Url      string `json:"url,omitempty"`
	Progress string `json:"progress,omitempty"`
}
