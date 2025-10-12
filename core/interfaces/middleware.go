package interfaces

import (
	"github.com/gin-gonic/gin"
)

// MiddlewarePlugin 中间件插件接口
type MiddlewarePlugin interface {
	// 插件元数据
	Name() string
	Priority() int
	Enabled() bool
	
	// 返回Gin中间件处理函数
	Handler() gin.HandlerFunc
	
	// 初始化（可选）
	Initialize(config MiddlewareConfig) error
}

// MiddlewareConfig 中间件配置
type MiddlewareConfig struct {
	Name     string                 `yaml:"name"`
	Enabled  bool                   `yaml:"enabled"`
	Priority int                    `yaml:"priority"`
	Config   map[string]interface{} `yaml:"config"`
}

// MiddlewareFactory 中间件工厂函数类型
type MiddlewareFactory func(config MiddlewareConfig) (MiddlewarePlugin, error)

