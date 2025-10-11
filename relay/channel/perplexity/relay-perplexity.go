package perplexity

import "github.com/QuantumNous/new-api/dto"

func requestOpenAI2Perplexity(request dto.GeneralOpenAIRequest) *dto.GeneralOpenAIRequest {
	messages := make([]dto.Message, 0, len(request.Messages))
	for _, message := range request.Messages {
		messages = append(messages, dto.Message{
			Role:    message.Role,
			Content: message.Content,
		})
	}
	return &dto.GeneralOpenAIRequest{
		Model:                  request.Model,
		Stream:                 request.Stream,
		Messages:               messages,
		Temperature:            request.Temperature,
		TopP:                   request.TopP,
		MaxTokens:              request.GetMaxTokens(),
		FrequencyPenalty:       request.FrequencyPenalty,
		PresencePenalty:        request.PresencePenalty,
		SearchDomainFilter:     request.SearchDomainFilter,
		SearchRecencyFilter:    request.SearchRecencyFilter,
		ReturnImages:           request.ReturnImages,
		ReturnRelatedQuestions: request.ReturnRelatedQuestions,
		SearchMode:             request.SearchMode,
	}
}
