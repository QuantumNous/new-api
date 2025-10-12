package interfaces

import (
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

// HookContext Relay Hook执行上下文
type HookContext struct {
	// Gin Context
	GinContext *gin.Context
	
	// Request相关
	Request     *http.Request
	RequestBody []byte
	
	// Response相关
	Response     *http.Response
	ResponseBody []byte
	
	// Channel信息
	ChannelID   int
	ChannelType int
	ChannelName string
	
	// Model信息
	Model         string
	OriginalModel string
	
	// User信息
	UserID   int
	TokenID  int
	Group    string
	
	// 扩展数据（插件间共享）
	Data map[string]interface{}
	
	// 错误信息
	Error error
	
	// 是否跳过后续处理
	ShouldSkip bool
}

// RelayHook Relay Hook接口
type RelayHook interface {
	// 插件元数据
	Name() string
	Priority() int
	Enabled() bool
	
	// 生命周期钩子
	// OnBeforeRequest 在请求发送到上游之前执行
	OnBeforeRequest(ctx *HookContext) error
	
	// OnAfterResponse 在收到上游响应之后执行
	OnAfterResponse(ctx *HookContext) error
	
	// OnError 在发生错误时执行
	OnError(ctx *HookContext, err error) error
}

// RequestModifier 请求修改器接口
// 实现此接口的Hook可以修改请求内容
type RequestModifier interface {
	RelayHook
	ModifyRequest(ctx *HookContext, body io.Reader) (io.Reader, error)
}

// ResponseProcessor 响应处理器接口
// 实现此接口的Hook可以处理响应内容
type ResponseProcessor interface {
	RelayHook
	ProcessResponse(ctx *HookContext, body []byte) ([]byte, error)
}

// StreamProcessor 流式响应处理器接口
// 实现此接口的Hook可以处理流式响应
type StreamProcessor interface {
	RelayHook
	ProcessStreamChunk(ctx *HookContext, chunk []byte) ([]byte, error)
}

// HookConfig Hook配置
type HookConfig struct {
	Name     string                 `yaml:"name"`
	Enabled  bool                   `yaml:"enabled"`
	Priority int                    `yaml:"priority"`
	Config   map[string]interface{} `yaml:"config"`
}

