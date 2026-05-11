package dto

import (
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// DocumentExtractRequest 文档解析请求（multipart/form-data格式）
type DocumentExtractRequest struct {
	BaseRequest
	// multipart 表单元数据，文件内容通过 c.Request.MultipartForm 获取
}

func (r *DocumentExtractRequest) IsStream(c *gin.Context) bool {
	return false
}

func (r *DocumentExtractRequest) GetTokenCountMeta() *types.TokenCountMeta {
	return &types.TokenCountMeta{TokenType: types.TokenTypeTokenizer}
}
