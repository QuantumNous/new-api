package channels

import (
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

// BaseChannelPlugin 基础Channel插件
// 包装现有的Adaptor实现，使其符合ChannelPlugin接口
type BaseChannelPlugin struct {
	adaptor  channel.Adaptor
	name     string
	version  string
	priority int
}

// NewBaseChannelPlugin 创建基础Channel插件
func NewBaseChannelPlugin(adaptor channel.Adaptor, name, version string, priority int) *BaseChannelPlugin {
	return &BaseChannelPlugin{
		adaptor:  adaptor,
		name:     name,
		version:  version,
		priority: priority,
	}
}

// Name 返回插件名称
func (p *BaseChannelPlugin) Name() string {
	return p.name
}

// Version 返回插件版本
func (p *BaseChannelPlugin) Version() string {
	return p.version
}

// Priority 返回优先级
func (p *BaseChannelPlugin) Priority() int {
	return p.priority
}

// 以下方法直接委托给内部的Adaptor

func (p *BaseChannelPlugin) Init(info *relaycommon.RelayInfo) {
	p.adaptor.Init(info)
}

func (p *BaseChannelPlugin) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return p.adaptor.GetRequestURL(info)
}

func (p *BaseChannelPlugin) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	return p.adaptor.SetupRequestHeader(c, req, info)
}

func (p *BaseChannelPlugin) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	return p.adaptor.ConvertOpenAIRequest(c, info, request)
}

func (p *BaseChannelPlugin) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return p.adaptor.ConvertRerankRequest(c, relayMode, request)
}

func (p *BaseChannelPlugin) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return p.adaptor.ConvertEmbeddingRequest(c, info, request)
}

func (p *BaseChannelPlugin) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return p.adaptor.ConvertAudioRequest(c, info, request)
}

func (p *BaseChannelPlugin) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return p.adaptor.ConvertImageRequest(c, info, request)
}

func (p *BaseChannelPlugin) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return p.adaptor.ConvertOpenAIResponsesRequest(c, info, request)
}

func (p *BaseChannelPlugin) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return p.adaptor.DoRequest(c, info, requestBody)
}

func (p *BaseChannelPlugin) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	return p.adaptor.DoResponse(c, resp, info)
}

func (p *BaseChannelPlugin) GetModelList() []string {
	return p.adaptor.GetModelList()
}

func (p *BaseChannelPlugin) GetChannelName() string {
	return p.adaptor.GetChannelName()
}

func (p *BaseChannelPlugin) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return p.adaptor.ConvertClaudeRequest(c, info, request)
}

func (p *BaseChannelPlugin) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return p.adaptor.ConvertGeminiRequest(c, info, request)
}

// GetAdaptor 获取内部的Adaptor（用于向后兼容）
func (p *BaseChannelPlugin) GetAdaptor() channel.Adaptor {
	return p.adaptor
}

