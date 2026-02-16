package helper

import (
	"github.com/QuantumNous/new-api/i18n"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/samber/lo"

	"github.com/gin-gonic/gin"
)

func GetAndValidateRequest(c *gin.Context, format types.RelayFormat) (request dto.Request, err error) {
	relayMode := relayconstant.Path2RelayMode(c.Request.URL.Path)

	switch format {
	case types.RelayFormatOpenAI:
		request, err = GetAndValidateTextRequest(c, relayMode)
	case types.RelayFormatGemini:
		if strings.Contains(c.Request.URL.Path, ":embedContent") {
			request, err = GetAndValidateGeminiEmbeddingRequest(c)
		} else if strings.Contains(c.Request.URL.Path, ":batchEmbedContents") {
			request, err = GetAndValidateGeminiBatchEmbeddingRequest(c)
		} else {
			request, err = GetAndValidateGeminiRequest(c)
		}
	case types.RelayFormatClaude:
		request, err = GetAndValidateClaudeRequest(c)
	case types.RelayFormatOpenAIResponses:
		request, err = GetAndValidateResponsesRequest(c)
	case types.RelayFormatOpenAIResponsesCompaction:
		request, err = GetAndValidateResponsesCompactionRequest(c)

	case types.RelayFormatOpenAIImage:
		request, err = GetAndValidOpenAIImageRequest(c, relayMode)
	case types.RelayFormatEmbedding:
		request, err = GetAndValidateEmbeddingRequest(c, relayMode)
	case types.RelayFormatRerank:
		request, err = GetAndValidateRerankRequest(c)
	case types.RelayFormatOpenAIAudio:
		request, err = GetAndValidAudioRequest(c, relayMode)
	case types.RelayFormatOpenAIRealtime:
		request = &dto.BaseRequest{}
	default:
		return nil, fmt.Errorf(i18n.Translate("relay.unsupported_relay_format"), format)
	}
	return request, err
}

func GetAndValidAudioRequest(c *gin.Context, relayMode int) (*dto.AudioRequest, error) {
	audioRequest := &dto.AudioRequest{}
	err := common.UnmarshalBodyReusable(c, audioRequest)
	if err != nil {
		return nil, err
	}
	switch relayMode {
	case relayconstant.RelayModeAudioSpeech:
		if audioRequest.Model == "" {
			return nil, errors.New(i18n.Translate("svc.model_is_required"))
		}
	default:
		if audioRequest.Model == "" {
			return nil, errors.New(i18n.Translate("svc.model_is_required"))
		}
		if audioRequest.ResponseFormat == "" {
			audioRequest.ResponseFormat = "json"
		}
	}
	return audioRequest, nil
}

func GetAndValidateRerankRequest(c *gin.Context) (*dto.RerankRequest, error) {
	var rerankRequest *dto.RerankRequest
	err := common.UnmarshalBodyReusable(c, &rerankRequest)
	if err != nil {
		logger.LogError(c, fmt.Sprintf(i18n.Translate("relay.getandvalidatetextrequest_failed"), err.Error()))
		return nil, types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	if rerankRequest.Query == "" {
		return nil, types.NewError(errors.New(i18n.Translate("relay.query_is_empty")), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}
	if len(rerankRequest.Documents) == 0 {
		return nil, types.NewError(errors.New(i18n.Translate("relay.documents_is_empty")), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}
	return rerankRequest, nil
}

func GetAndValidateEmbeddingRequest(c *gin.Context, relayMode int) (*dto.EmbeddingRequest, error) {
	var embeddingRequest *dto.EmbeddingRequest
	err := common.UnmarshalBodyReusable(c, &embeddingRequest)
	if err != nil {
		logger.LogError(c, fmt.Sprintf(i18n.Translate("relay.getandvalidatetextrequest_failed"), err.Error()))
		return nil, types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	if embeddingRequest.Input == nil {
		return nil, errors.New(i18n.Translate("relay.input_is_empty"))
	}
	if relayMode == relayconstant.RelayModeModerations && embeddingRequest.Model == "" {
		embeddingRequest.Model = "omni-moderation-latest"
	}
	if relayMode == relayconstant.RelayModeEmbeddings && embeddingRequest.Model == "" {
		embeddingRequest.Model = c.Param("model")
	}
	return embeddingRequest, nil
}

func GetAndValidateResponsesRequest(c *gin.Context) (*dto.OpenAIResponsesRequest, error) {
	request := &dto.OpenAIResponsesRequest{}
	err := common.UnmarshalBodyReusable(c, request)
	if err != nil {
		return nil, err
	}
	if request.Model == "" {
		return nil, errors.New(i18n.Translate("svc.model_is_required"))
	}
	if request.Input == nil {
		return nil, errors.New(i18n.Translate("relay.input_is_required"))
	}
	return request, nil
}

func GetAndValidateResponsesCompactionRequest(c *gin.Context) (*dto.OpenAIResponsesCompactionRequest, error) {
	request := &dto.OpenAIResponsesCompactionRequest{}
	if err := common.UnmarshalBodyReusable(c, request); err != nil {
		return nil, err
	}
	if request.Model == "" {
		return nil, errors.New(i18n.Translate("svc.model_is_required"))
	}
	return request, nil
}

func GetAndValidOpenAIImageRequest(c *gin.Context, relayMode int) (*dto.ImageRequest, error) {
	imageRequest := &dto.ImageRequest{}

	switch relayMode {
	case relayconstant.RelayModeImagesEdits:
		if strings.Contains(c.Request.Header.Get("Content-Type"), "multipart/form-data") {
			_, err := c.MultipartForm()
			if err != nil {
				return nil, fmt.Errorf(i18n.Translate("relay.failed_to_parse_image_edit_form_request"), err)
			}
			formData := c.Request.PostForm
			imageRequest.Prompt = formData.Get("prompt")
			imageRequest.Model = formData.Get("model")
			imageRequest.N = common.GetPointer(uint(common.String2Int(formData.Get("n"))))
			imageRequest.Quality = formData.Get("quality")
			imageRequest.Size = formData.Get("size")
			if imageValue := formData.Get("image"); imageValue != "" {
				imageRequest.Image, _ = json.Marshal(imageValue)
			}

			if imageRequest.Model == "gpt-image-1" {
				if imageRequest.Quality == "" {
					imageRequest.Quality = "standard"
				}
			}
			if imageRequest.N == nil || *imageRequest.N == 0 {
				imageRequest.N = common.GetPointer(uint(1))
			}

			hasWatermark := formData.Has("watermark")
			if hasWatermark {
				watermark := formData.Get("watermark") == "true"
				imageRequest.Watermark = &watermark
			}
			break
		}
		fallthrough
	default:
		err := common.UnmarshalBodyReusable(c, imageRequest)
		if err != nil {
			return nil, err
		}

		if imageRequest.Model == "" {
			//imageRequest.Model = "dall-e-3"
			return nil, errors.New(i18n.Translate("svc.model_is_required"))
		}

		if strings.Contains(imageRequest.Size, "×") {
			return nil, errors.New(i18n.Translate("relay.size_an_unexpected_error_occurred_in_the_parameter"))
		}

		// Not "256x256", "512x512", or "1024x1024"
		if imageRequest.Model == "dall-e-2" || imageRequest.Model == "dall-e" {
			if imageRequest.Size != "" && imageRequest.Size != "256x256" && imageRequest.Size != "512x512" && imageRequest.Size != "1024x1024" {
				return nil, errors.New(i18n.Translate("relay.size_must_be_one_of_256x256_512x512_or"))
			}
			if imageRequest.Size == "" {
				imageRequest.Size = "1024x1024"
			}
		} else if imageRequest.Model == "dall-e-3" {
			if imageRequest.Size != "" && imageRequest.Size != "1024x1024" && imageRequest.Size != "1024x1792" && imageRequest.Size != "1792x1024" {
				return nil, errors.New(i18n.Translate("relay.size_must_be_one_of_1024x1024_1024x1792_or"))
			}
			if imageRequest.Quality == "" {
				imageRequest.Quality = "standard"
			}
			if imageRequest.Size == "" {
				imageRequest.Size = "1024x1024"
			}
		} else if imageRequest.Model == "gpt-image-1" {
			if imageRequest.Quality == "" {
				imageRequest.Quality = "auto"
			}
		}

		//if imageRequest.Prompt == "" {
		//	return nil, errors.New("prompt is required")
		//}

		if imageRequest.N == nil || *imageRequest.N == 0 {
			imageRequest.N = common.GetPointer(uint(1))
		}
	}

	return imageRequest, nil
}

func GetAndValidateClaudeRequest(c *gin.Context) (textRequest *dto.ClaudeRequest, err error) {
	textRequest = &dto.ClaudeRequest{}
	err = common.UnmarshalBodyReusable(c, textRequest)
	if err != nil {
		return nil, err
	}
	if textRequest.Messages == nil || len(textRequest.Messages) == 0 {
		return nil, errors.New(i18n.Translate("relay.field_messages_is_required"))
	}
	if textRequest.Model == "" {
		return nil, errors.New(i18n.Translate("relay.field_model_is_required"))
	}

	//if textRequest.Stream {
	//	relayInfo.IsStream = true
	//}

	return textRequest, nil
}

func GetAndValidateTextRequest(c *gin.Context, relayMode int) (*dto.GeneralOpenAIRequest, error) {
	textRequest := &dto.GeneralOpenAIRequest{}
	err := common.UnmarshalBodyReusable(c, textRequest)
	if err != nil {
		return nil, err
	}

	if relayMode == relayconstant.RelayModeModerations && textRequest.Model == "" {
		textRequest.Model = "text-moderation-latest"
	}
	if relayMode == relayconstant.RelayModeEmbeddings && textRequest.Model == "" {
		textRequest.Model = c.Param("model")
	}

	if lo.FromPtrOr(textRequest.MaxTokens, uint(0)) > math.MaxInt32/2 {
		return nil, errors.New(i18n.Translate("relay.max_tokens_is_invalid"))
	}
	if textRequest.Model == "" {
		return nil, errors.New(i18n.Translate("svc.model_is_required"))
	}
	if textRequest.WebSearchOptions != nil {
		if textRequest.WebSearchOptions.SearchContextSize != "" {
			validSizes := map[string]bool{
				"high":   true,
				"medium": true,
				"low":    true,
			}
			if !validSizes[textRequest.WebSearchOptions.SearchContextSize] {
				return nil, errors.New(i18n.Translate("relay.invalid_search_context_size_must_be_one_of"))
			}
		} else {
			textRequest.WebSearchOptions.SearchContextSize = "medium"
		}
	}
	switch relayMode {
	case relayconstant.RelayModeCompletions:
		if textRequest.Prompt == "" {
			return nil, errors.New(i18n.Translate("relay.field_prompt_is_required"))
		}
	case relayconstant.RelayModeChatCompletions:
		// For FIM (Fill-in-the-middle) requests with prefix/suffix, messages is optional
		// It will be filled by provider-specific adaptors if needed (e.g., SiliconFlow)。Or it is allowed by model vendor(s) (e.g., DeepSeek)
		if len(textRequest.Messages) == 0 && textRequest.Prefix == nil && textRequest.Suffix == nil {
			return nil, errors.New(i18n.Translate("relay.field_messages_is_required"))
		}
	case relayconstant.RelayModeEmbeddings:
	case relayconstant.RelayModeModerations:
		if textRequest.Input == nil || textRequest.Input == "" {
			return nil, errors.New(i18n.Translate("relay.field_input_is_required"))
		}
	case relayconstant.RelayModeEdits:
		if textRequest.Instruction == "" {
			return nil, errors.New(i18n.Translate("relay.field_instruction_is_required"))
		}
	}
	return textRequest, nil
}

func GetAndValidateGeminiRequest(c *gin.Context) (*dto.GeminiChatRequest, error) {
	request := &dto.GeminiChatRequest{}
	err := common.UnmarshalBodyReusable(c, request)
	if err != nil {
		return nil, err
	}
	if len(request.Contents) == 0 && len(request.Requests) == 0 {
		return nil, errors.New(i18n.Translate("relay.contents_is_required"))
	}

	//if c.Query("alt") == "sse" {
	//	relayInfo.IsStream = true
	//}

	return request, nil
}

func GetAndValidateGeminiEmbeddingRequest(c *gin.Context) (*dto.GeminiEmbeddingRequest, error) {
	request := &dto.GeminiEmbeddingRequest{}
	err := common.UnmarshalBodyReusable(c, request)
	if err != nil {
		return nil, err
	}
	return request, nil
}

func GetAndValidateGeminiBatchEmbeddingRequest(c *gin.Context) (*dto.GeminiBatchEmbeddingRequest, error) {
	request := &dto.GeminiBatchEmbeddingRequest{}
	err := common.UnmarshalBodyReusable(c, request)
	if err != nil {
		return nil, err
	}
	return request, nil
}
