package dto

// MinerURequest 表示 /v1/file_parse 的 multipart 表单请求。
// 表单内容（files 及解析参数）原样透传给上游 MinerU 服务，
// 这里只提取渠道选择所需的元信息（model，可省略，默认 mineru）。
type MinerURequest struct {
	BaseRequest
	Model string `json:"model" form:"model"`
}

func (r *MinerURequest) SetModelName(modelName string) {
	if modelName != "" {
		r.Model = modelName
	}
}
