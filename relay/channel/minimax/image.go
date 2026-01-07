package minimax

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	taskhailuo "github.com/QuantumNous/new-api/relay/channel/task/hailuo"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

func oaiImageToHailuoImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (*ImageGenerationRequest, error) {
	req := &ImageGenerationRequest{}
	if err := common.UnmarshalBodyReusable(c, req); err != nil {
		return nil, fmt.Errorf("unmarshal body reusable failed: %w", err)
	}
	if request.Extra != nil {
		extraBytes, _ := json.Marshal(request.Extra)
		_ = json.Unmarshal(extraBytes, req)
	}

	if len(request.Style) > 0 {
		var style StyleObject
		if err := json.Unmarshal(request.Style, &style); err == nil {
			req.Style = &style
		}
	}
	if request.Watermark != nil {
		req.AigcWatermark = request.Watermark
	}
	return req, nil
}

func imageEditFromOai(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (*ImageGenerationRequest, error) {
	req, err := oaiImageToHailuoImageRequest(c, info, request)
	if err != nil {
		return nil, err
	}
	imageBase64Data, err := relaycommon.GetImageBase64sFromForm(c)
	if err != nil {
		return nil, fmt.Errorf("get image base64s from form failed: %w", err)
	}
	for _, data := range imageBase64Data {
		req.SubjectReference = append(req.SubjectReference, ImageSubjectReference{
			Type:      "character",
			ImageFile: data.String(),
		})
	}
	return req, nil
}

func imageHandler(_ *Adaptor, c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	service.CloseResponseBodyGracefully(resp)

	var hlResp ImageGenerationResponse
	if err := json.Unmarshal(responseBody, &hlResp); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	if hlResp.BaseResp.StatusCode != taskhailuo.StatusSuccess {
		return nil, types.WithOpenAIError(types.OpenAIError{
			Message: hlResp.BaseResp.StatusMsg,
			Type:    "hailuo_error",
			Code:    strconv.Itoa(hlResp.BaseResp.StatusCode),
		}, http.StatusBadRequest)
	}

	imageResponse := responseToOpenAIImage(c, &hlResp, responseBody, info)

	if len(imageResponse.Data) > 1 {
		info.PriceData.AddOtherRatio("n", float64(len(imageResponse.Data)))
	}

	jsonResponse, err := json.Marshal(imageResponse)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}

	service.IOCopyBytesGracefully(c, resp, jsonResponse)
	return &dto.Usage{}, nil
}

func responseToOpenAIImage(c *gin.Context, resp *ImageGenerationResponse, originBody []byte, info *relaycommon.RelayInfo) *dto.ImageResponse {
	imageResponse := dto.ImageResponse{
		Created:  info.StartTime.Unix(),
		Metadata: originBody,
	}

	if resp.Data != nil {
		for _, url := range resp.Data.ImageUrls {
			imageResponse.Data = append(imageResponse.Data, dto.ImageData{
				Url: url,
			})
		}
		for _, b64 := range resp.Data.ImageBase64 {
			imageResponse.Data = append(imageResponse.Data, dto.ImageData{
				B64Json: b64,
			})
		}
	}

	logger.LogDebug(c, "hailuo image result: "+string(originBody))
	return &imageResponse
}
