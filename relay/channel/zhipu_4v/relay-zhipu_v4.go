package zhipu_4v

import (
	"strings"

	"github.com/QuantumNous/new-api/dto"
)

func requestOpenAI2Zhipu(request dto.GeneralOpenAIRequest) *dto.GeneralOpenAIRequest {
	messages := make([]dto.Message, 0, len(request.Messages))
	for _, message := range request.Messages {
		if !message.IsStringContent() {
			mediaMessages := message.ParseContent()
			for j, mediaMessage := range mediaMessages {
				if mediaMessage.Type == dto.ContentTypeImageURL {
					imageUrl := mediaMessage.GetImageMedia()
					// check if base64
					if strings.HasPrefix(imageUrl.Url, "data:image/") {
						// 去除base64数据的URL前缀（如果有）
						if idx := strings.Index(imageUrl.Url, ","); idx != -1 {
							imageUrl.Url = imageUrl.Url[idx+1:]
						}
					}
					mediaMessage.ImageUrl = imageUrl
					mediaMessages[j] = mediaMessage
				}
			}
			message.SetMediaContent(mediaMessages)
		}
		messages = append(messages, dto.Message{
			Role:       message.Role,
			Content:    message.Content,
			ToolCalls:  message.ToolCalls,
			ToolCallId: message.ToolCallId,
		})
	}
	str, ok := request.Stop.(string)
	var Stop []string
	if ok {
		Stop = []string{str}
	} else {
		Stop, _ = request.Stop.([]string)
	}
	out := &dto.GeneralOpenAIRequest{
		Model:       request.Model,
		Stream:      request.Stream,
		Messages:    messages,
		Temperature: request.Temperature,
		TopP:        request.TopP,
		Stop:        Stop,
		Tools:       request.Tools,
		ToolChoice:  request.ToolChoice,
		THINKING:    request.THINKING,
	}
	if request.MaxTokens != nil || request.MaxCompletionTokens != nil {
		maxTokens := request.GetMaxTokens()
		out.MaxTokens = &maxTokens
	}
	return out
}

func injectZhipuWebSearch(req *dto.GeneralOpenAIRequest, opts *dto.WebSearchOptions) any {
	if opts == nil {
		return req
	}
	ws := map[string]any{
		"enable":        true,
		"search_engine": "search_pro_jina",
	}
	// medium 不显式设值，使用智谱上游默认。
	switch opts.SearchContextSize {
	case "low":
		ws["count"] = 5
	case "high":
		ws["count"] = 15
		ws["content_size"] = "high"
	}
	m := req.ToMap()
	tools, _ := m["tools"].([]any)
	m["tools"] = append(tools, map[string]any{"type": "web_search", "web_search": ws})
	return m
}
