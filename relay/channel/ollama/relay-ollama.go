package ollama

import (
	"fmt"
	"io"
	"net/http"
	"one-api/common"
	"one-api/dto"
	relaycommon "one-api/relay/common"
	"one-api/service"
	"one-api/types"
	"strings"

	"github.com/gin-gonic/gin"
)

func requestOpenAI2Ollama(request *dto.GeneralOpenAIRequest) (*OllamaRequest, error) {
	messages := make([]dto.Message, 0, len(request.Messages))
	for _, message := range request.Messages {
		if !message.IsStringContent() {
			mediaMessages := message.ParseContent()
			for j, mediaMessage := range mediaMessages {
				if mediaMessage.Type == dto.ContentTypeImageURL {
					imageUrl := mediaMessage.GetImageMedia()
					// check if not base64
					if strings.HasPrefix(imageUrl.Url, "http") {
						fileData, err := service.GetFileBase64FromUrl(imageUrl.Url)
						if err != nil {
							return nil, err
						}
						imageUrl.Url = fmt.Sprintf("data:%s;base64,%s", fileData.MimeType, fileData.Base64Data)
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
	ollamaRequest := &OllamaRequest{
		Model:            request.Model,
		Messages:         messages,
		Stream:           request.Stream,
		Temperature:      request.Temperature,
		Seed:             request.Seed,
		Topp:             request.TopP,
		TopK:             request.TopK,
		Stop:             Stop,
		Tools:            request.Tools,
		MaxTokens:        request.GetMaxTokens(),
		ResponseFormat:   request.ResponseFormat,
		FrequencyPenalty: request.FrequencyPenalty,
		PresencePenalty:  request.PresencePenalty,
		Prompt:           request.Prompt,
		StreamOptions:    request.StreamOptions,
		Suffix:           request.Suffix,
	}
	if think, ok := request.Extra["think"]; ok {
		ollamaRequest.Think = think
	}
	return ollamaRequest, nil
}

func requestOpenAI2Embeddings(request dto.EmbeddingRequest) *OllamaEmbeddingRequest {
	return &OllamaEmbeddingRequest{
		Model: request.Model,
		Input: request.ParseInput(),
		Options: &Options{
			Seed:             int(request.Seed),
			Temperature:      request.Temperature,
			TopP:             request.TopP,
			FrequencyPenalty: request.FrequencyPenalty,
			PresencePenalty:  request.PresencePenalty,
		},
	}
}

func ollamaEmbeddingHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	var ollamaEmbeddingResponse OllamaEmbeddingResponse
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	common.CloseResponseBodyGracefully(resp)
	err = common.Unmarshal(responseBody, &ollamaEmbeddingResponse)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if ollamaEmbeddingResponse.Error != "" {
		return nil, types.NewOpenAIError(fmt.Errorf("ollama error: %s", ollamaEmbeddingResponse.Error), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	flattenedEmbeddings := flattenEmbeddings(ollamaEmbeddingResponse.Embedding)
	data := make([]dto.OpenAIEmbeddingResponseItem, 0, 1)
	data = append(data, dto.OpenAIEmbeddingResponseItem{
		Embedding: flattenedEmbeddings,
		Object:    "embedding",
	})
	usage := &dto.Usage{
		TotalTokens:      info.PromptTokens,
		CompletionTokens: 0,
		PromptTokens:     info.PromptTokens,
	}
	embeddingResponse := &dto.OpenAIEmbeddingResponse{
		Object: "list",
		Data:   data,
		Model:  info.UpstreamModelName,
		Usage:  *usage,
	}
	doResponseBody, err := common.Marshal(embeddingResponse)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	common.IOCopyBytesGracefully(c, resp, doResponseBody)
	return usage, nil
}

func flattenEmbeddings(embeddings [][]float64) []float64 {
	flattened := []float64{}
	for _, row := range embeddings {
		flattened = append(flattened, row...)
	}
	return flattened
}
