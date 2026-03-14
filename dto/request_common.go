package dto

import (
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

type Request interface {
	GetTokenCountMeta() *types.TokenCountMeta
	IsStream(c *gin.Context) bool
	SetModelName(modelName string)
}

// RequestMetadata 请求元数据，用于参数重写功能
type RequestMetadata struct {
	MessageCount   int
	CountImage     int
	CountAudio     int
	CountVideo     int
	CountFile      int
	TextLength     int
	TextLengthLast int
}

// MetadataExtractor 元数据提取接口
// 请求类型可以实现此接口来提供元数据
type MetadataExtractor interface {
	ExtractMetadata() *RequestMetadata
}

type BaseRequest struct {
}

func (b *BaseRequest) GetTokenCountMeta() *types.TokenCountMeta {
	return &types.TokenCountMeta{
		TokenType: types.TokenTypeTokenizer,
	}
}
func (b *BaseRequest) IsStream(c *gin.Context) bool {
	return false
}
func (b *BaseRequest) SetModelName(modelName string) {}
