package jimeng

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

type ImageResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    struct {
		BinaryDataBase64 []string `json:"binary_data_base64"`
		ImageUrls        []string `json:"image_urls"`
		RephraseResult   string   `json:"rephraser_result"`
		RequestID        string   `json:"request_id"`
		// Other fields are omitted for brevity
	} `json:"data"`
	RequestID   string `json:"request_id"`
	Status      int    `json:"status"`
	TimeElapsed string `json:"time_elapsed"`
}

// responseJimeng2OpenAIImage preserves URL and base64 entries in the client response;
// billable image counting handles the two representations separately.
func responseJimeng2OpenAIImage(_ *gin.Context, response *ImageResponse, info *relaycommon.RelayInfo) *dto.ImageResponse {
	imageResponse := dto.ImageResponse{
		Created: info.StartTime.Unix(),
	}

	for _, base64Data := range response.Data.BinaryDataBase64 {
		imageResponse.Data = append(imageResponse.Data, dto.ImageData{
			B64Json: base64Data,
		})
	}
	for _, imageUrl := range response.Data.ImageUrls {
		imageResponse.Data = append(imageResponse.Data, dto.ImageData{
			Url: imageUrl,
		})
	}

	return &imageResponse
}

// jimengImageHandler converts successful responses and bills the larger nonblank
// URL/base64 count so two representations of an image do not charge twice.
func jimengImageHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	var jimengResponse ImageResponse
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	service.CloseResponseBodyGracefully(resp)

	err = common.Unmarshal(responseBody, &jimengResponse)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	// Check if the response indicates an error
	if jimengResponse.Code != 10000 {
		return nil, types.WithOpenAIError(types.OpenAIError{
			Message: jimengResponse.Message,
			Type:    "jimeng_error",
			Param:   "",
			Code:    fmt.Sprintf("%d", jimengResponse.Code),
		}, resp.StatusCode)
	}

	// Convert Jimeng response to OpenAI format
	fullTextResponse := responseJimeng2OpenAIImage(c, &jimengResponse, info)
	jsonResponse, err := common.Marshal(fullTextResponse)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}

	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	_, err = c.Writer.Write(jsonResponse)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}

	var urls, base64Images int64
	for _, url := range jimengResponse.Data.ImageUrls {
		if strings.TrimSpace(url) != "" {
			urls++
		}
	}
	for _, payload := range jimengResponse.Data.BinaryDataBase64 {
		if strings.TrimSpace(payload) != "" {
			base64Images++
		}
	}
	info.UpdateImageCount(max(urls, base64Images))
	return &dto.Usage{}, nil
}
