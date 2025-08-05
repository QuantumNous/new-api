package relay

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"one-api/common"
	"one-api/constant"
	"one-api/dto"
	"one-api/model"
	relaycommon "one-api/relay/common"
	relayconstant "one-api/relay/constant"
	"one-api/relay/helper"
	"one-api/service"
	"one-api/setting"
	"one-api/setting/model_setting"
	"one-api/types"
	"strings"

	"github.com/gin-gonic/gin"
)

func getAndValidImageRequest(c *gin.Context, info *relaycommon.RelayInfo) (*dto.ImageRequest, error) {
	imageRequest := &dto.ImageRequest{}

	switch info.RelayMode {
	case relayconstant.RelayModeImagesEdits:
		_, err := c.MultipartForm()
		if err != nil {
			return nil, err
		}
		formData := c.Request.PostForm
		imageRequest.Prompt = formData.Get("prompt")
		imageRequest.Model = formData.Get("model")
		imageRequest.N = common.String2Int(formData.Get("n"))
		imageRequest.Quality = formData.Get("quality")
		imageRequest.Size = formData.Get("size")

		if imageRequest.Model == "gpt-image-1" {
			if imageRequest.Quality == "" {
				imageRequest.Quality = "standard"
			}
		}
		if imageRequest.N == 0 {
			imageRequest.N = 1
		}

		if info.ApiType == constant.APITypeVolcEngine {
			watermark := formData.Has("watermark")
			imageRequest.Watermark = &watermark
		}
	default:
		err := common.UnmarshalBodyReusable(c, imageRequest)
		if err != nil {
			return nil, err
		}

		if imageRequest.Model == "" {
			imageRequest.Model = "dall-e-3"
		}

		if strings.Contains(imageRequest.Size, "×") {
			return nil, errors.New("size an unexpected error occurred in the parameter, please use 'x' instead of the multiplication sign '×'")
		}

		// Not "256x256", "512x512", or "1024x1024"
		if imageRequest.Model == "dall-e-2" || imageRequest.Model == "dall-e" {
			if imageRequest.Size != "" && imageRequest.Size != "256x256" && imageRequest.Size != "512x512" && imageRequest.Size != "1024x1024" {
				return nil, errors.New("size must be one of 256x256, 512x512, or 1024x1024 for dall-e-2 or dall-e")
			}
			if imageRequest.Size == "" {
				imageRequest.Size = "1024x1024"
			}
		} else if imageRequest.Model == "dall-e-3" {
			if imageRequest.Size != "" && imageRequest.Size != "1024x1024" && imageRequest.Size != "1024x1792" && imageRequest.Size != "1792x1024" {
				return nil, errors.New("size must be one of 1024x1024, 1024x1792 or 1792x1024 for dall-e-3")
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

		if imageRequest.Prompt == "" {
			return nil, errors.New("prompt is required")
		}

		if imageRequest.N == 0 {
			imageRequest.N = 1
		}
	}

	if setting.ShouldCheckPromptSensitive() {
		words, err := service.CheckSensitiveInput(imageRequest.Prompt)
		if err != nil {
			common.LogWarn(c, fmt.Sprintf("user sensitive words detected: %s", strings.Join(words, ",")))
			return nil, err
		}
	}
	return imageRequest, nil
}

func ImageHelper(c *gin.Context) (newAPIError *types.NewAPIError) {
	relayInfo := relaycommon.GenRelayInfoImage(c)

	imageRequest, err := getAndValidImageRequest(c, relayInfo)
	if err != nil {
		common.LogError(c, fmt.Sprintf("getAndValidImageRequest failed: %s", err.Error()))
		return types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	err = helper.ModelMappedHelper(c, relayInfo, imageRequest)
	if err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}

	priceData, err := helper.ModelPriceHelper(c, relayInfo, len(imageRequest.Prompt), 0)
	if err != nil {
		return types.NewError(err, types.ErrorCodeModelPriceError, types.ErrOptionWithSkipRetry())
	}
	var preConsumedQuota int
	var quota int
	var userQuota int
	if !priceData.UsePrice {
		// modelRatio 16 = modelPrice $0.04
		// per 1 modelRatio = $0.04 / 16
		// priceData.ModelPrice = 0.0025 * priceData.ModelRatio
		preConsumedQuota, userQuota, newAPIError = preConsumeQuota(c, priceData.ShouldPreConsumedQuota, relayInfo)
		if newAPIError != nil {
			return newAPIError
		}
		defer func() {
			if newAPIError != nil {
				returnPreConsumedQuota(c, relayInfo, userQuota, preConsumedQuota)
			}
		}()

	} else {
		sizeRatio := 1.0
		qualityRatio := 1.0

		if strings.HasPrefix(imageRequest.Model, "dall-e") {
			// Size
			if imageRequest.Size == "256x256" {
				sizeRatio = 0.4
			} else if imageRequest.Size == "512x512" {
				sizeRatio = 0.45
			} else if imageRequest.Size == "1024x1024" {
				sizeRatio = 1
			} else if imageRequest.Size == "1024x1792" || imageRequest.Size == "1792x1024" {
				sizeRatio = 2
			}

			if imageRequest.Model == "dall-e-3" && imageRequest.Quality == "hd" {
				qualityRatio = 2.0
				if imageRequest.Size == "1024x1792" || imageRequest.Size == "1792x1024" {
					qualityRatio = 1.5
				}
			}
		}

		// reset model price
		priceData.ModelPrice *= sizeRatio * qualityRatio * float64(imageRequest.N)
		quota = int(priceData.ModelPrice * priceData.GroupRatioInfo.GroupRatio * common.QuotaPerUnit)
		userQuota, err = model.GetUserQuota(relayInfo.UserId, false)
		if err != nil {
			return types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
		}
		if userQuota-quota < 0 {
			return types.NewError(fmt.Errorf("image pre-consumed quota failed, user quota: %s, need quota: %s", common.FormatQuota(userQuota), common.FormatQuota(quota)), types.ErrorCodeInsufficientUserQuota, types.ErrOptionWithSkipRetry())
		}
	}

	adaptor := GetAdaptor(relayInfo.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", relayInfo.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(relayInfo)

	var requestBody io.Reader

	if model_setting.GetGlobalSettings().PassThroughRequestEnabled || relayInfo.ChannelSetting.PassThroughBodyEnabled {
		body, err := common.GetRequestBody(c)
		if err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		requestBody = bytes.NewBuffer(body)
	} else {
		convertedRequest, err := adaptor.ConvertImageRequest(c, relayInfo, *imageRequest)
		if err != nil {
			return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		if relayInfo.RelayMode == relayconstant.RelayModeImagesEdits {
			requestBody = convertedRequest.(io.Reader)
		} else {
			jsonData, err := json.Marshal(convertedRequest)
			if err != nil {
				return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
			}

			// apply param override
			if len(relayInfo.ParamOverride) > 0 {
				reqMap := make(map[string]interface{})
				_ = common.Unmarshal(jsonData, &reqMap)
				for key, value := range relayInfo.ParamOverride {
					reqMap[key] = value
				}
				jsonData, err = common.Marshal(reqMap)
				if err != nil {
					return types.NewError(err, types.ErrorCodeChannelParamOverrideInvalid, types.ErrOptionWithSkipRetry())
				}
			}

			if common.DebugEnabled {
				println(fmt.Sprintf("image request body: %s", string(jsonData)))
			}
			requestBody = bytes.NewBuffer(jsonData)
		}
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")

	resp, err := adaptor.DoRequest(c, relayInfo, requestBody)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}
	var httpResp *http.Response
	if resp != nil {
		httpResp = resp.(*http.Response)
		relayInfo.IsStream = relayInfo.IsStream || strings.HasPrefix(httpResp.Header.Get("Content-Type"), "text/event-stream")
		if httpResp.StatusCode != http.StatusOK {
			newAPIError = service.RelayErrorHandler(httpResp, false)
			// reset status code 重置状态码
			service.ResetStatusCode(newAPIError, statusCodeMappingStr)
			return newAPIError
		}
	}

	usage, newAPIError := adaptor.DoResponse(c, httpResp, relayInfo)
	if newAPIError != nil {
		// reset status code 重置状态码
		service.ResetStatusCode(newAPIError, statusCodeMappingStr)
		return newAPIError
	}

	if usage.(*dto.Usage).TotalTokens == 0 {
		usage.(*dto.Usage).TotalTokens = imageRequest.N
	}
	if usage.(*dto.Usage).PromptTokens == 0 {
		usage.(*dto.Usage).PromptTokens = imageRequest.N
	}
	quality := "standard"
	if imageRequest.Quality == "hd" {
		quality = "hd"
	}

	logContent := fmt.Sprintf("大小 %s, 品质 %s", imageRequest.Size, quality)
	postConsumeQuota(c, relayInfo, usage.(*dto.Usage), preConsumedQuota, userQuota, priceData, logContent)
	return nil
}
