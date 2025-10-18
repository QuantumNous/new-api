package modelscope

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func oaiImage2MS(request dto.ImageRequest) (*MSImageRequest, error) {
	var imageRequest MSImageRequest
	imageRequest.Model = request.Model
	imageRequest.Prompt = request.Prompt
	if request.Size != "" {
		imageRequest.Size = request.Size
	}
	fieldMappings := map[string]interface{}{
		"negative_prompt": &imageRequest.NegativePrompt,
		"seed":           &imageRequest.Seed,
		"steps":          &imageRequest.Steps,
		"guidance":       &imageRequest.Guidance,
		"image_url":      &imageRequest.ImageUrl,
	}
	
	for key, target := range fieldMappings {
		if value, ok := request.Extra[key]; ok {
			if err := json.Unmarshal(value, target); err != nil {
				logger.LogWarn(context.Background(), fmt.Sprintf("failed to unmarshal %s, skip set to request", key))
				return nil, err
			}
		}
	}
	logger.LogJson(context.Background(), "oaiImage2MS request extra", request.Extra)

	return &imageRequest, nil
}

func updateTask(info *relaycommon.RelayInfo, taskID string) (*MSImageResponse, error, []byte) {
	url := fmt.Sprintf("%s/v1/tasks/%s", info.ChannelBaseUrl, taskID)

	var msResponse MSImageResponse

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return &msResponse, err, nil
	}

	req.Header.Set("Authorization", "Bearer "+info.ApiKey)
	
	if info.RelayMode == constant.RelayModeImagesGenerations {
		req.Header.Set("X-ModelScope-Task-Type", "image_generation")
	}

	client := &http.Client{Timeout: time.Second * 30}
	resp, err := client.Do(req)
	if err != nil {
		common.SysLog("updateTask client.Do err: " + err.Error())
		return &msResponse, err, nil
	}
	defer resp.Body.Close()
	
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
        responseBody, _ := io.ReadAll(resp.Body)
        return &msResponse, fmt.Errorf("updateTask HTTP %d: %s", resp.StatusCode, string(responseBody)), responseBody
    }

	responseBody, err := io.ReadAll(resp.Body)

	var response MSImageResponse
	err = common.Unmarshal(responseBody, &response)
	if err != nil {
		common.SysLog("updateTask NewDecoder err: " + err.Error())
		return &msResponse, err, nil
	}

	return &response, nil, responseBody
}

func asyncTaskWait(c *gin.Context, info *relaycommon.RelayInfo, taskID string) (*MSImageResponse, []byte, error) {
	waitSeconds := 10
	step := 0
	maxStep := 20

	var responseBody []byte

	for {
		logger.LogDebug(c, fmt.Sprintf("asyncTaskWait step %d/%d, wait %d seconds", step, maxStep, waitSeconds))
		step++
		rsp, err, body := updateTask(info, taskID)
		responseBody = body
		if err != nil {
			logger.LogWarn(c, "asyncTaskWait UpdateTask err: "+err.Error())
			time.Sleep(time.Duration(waitSeconds) * time.Second)
			continue
		}

		if rsp.TaskStatus == "" {
			return rsp, responseBody, nil
		}

		switch rsp.TaskStatus {
		case "FAILED":
			fallthrough
		case "CANCEL":
			fallthrough
		case "SUCCEED":
			fallthrough
		case "UNKNOWN":
			return rsp, responseBody, nil
		}
		if step >= maxStep {
			break
		}
		time.Sleep(time.Duration(waitSeconds) * time.Second)
	}

	return nil, nil, fmt.Errorf("msAsyncTaskWait timeout")
}

func responseMS2OpenAIImage(c *gin.Context, response *MSImageResponse, originBody []byte, info *relaycommon.RelayInfo, responseFormat string) *dto.ImageResponse {
	imageResponse := dto.ImageResponse{
		Created: info.StartTime.Unix(),
	}

	for _, data := range response.OutputImages {
		var b64Json string
		if responseFormat == "b64_json" {
			_, b64, err := service.GetImageFromUrl(data)
			if err != nil {
				logger.LogError(c, "get_image_data_failed: "+err.Error())
				continue
			}
			b64Json = b64
		} else {
			b64Json = ""
		}

		imageResponse.Data = append(imageResponse.Data, dto.ImageData{
			Url:           data,
			B64Json:       b64Json,
			RevisedPrompt: "",
		})
	}
	var mapResponse map[string]any
	_ = common.Unmarshal(originBody, &mapResponse)
	imageResponse.Extra = mapResponse
	return &imageResponse
}

func msImageHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*types.NewAPIError, *dto.Usage) {
	responseFormat := c.GetString("response_format")

	var msTaskResponse MSImageResponse
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError), nil
	}
	service.CloseResponseBodyGracefully(resp)
	err = common.Unmarshal(responseBody, &msTaskResponse)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError), nil
	}

	msResponse, originRespBody, err := asyncTaskWait(c, info, msTaskResponse.TaskId)
	if err != nil {
		return types.NewError(err, types.ErrorCodeBadResponse), nil
	}

	if msResponse.TaskStatus != "SUCCEED" {
		return types.WithOpenAIError(types.OpenAIError{
			Message: "Unknown ModelScope Image API error",
			Type:    "ms_error",
			Param:   "",
			Code:    400,
		}, resp.StatusCode), nil
	}

	fullTextResponse := responseMS2OpenAIImage(c, msResponse, originRespBody, info, responseFormat)
	jsonResponse, err := common.Marshal(fullTextResponse)
	if err != nil {
		return types.NewError(err, types.ErrorCodeBadResponseBody), nil
	}
	service.IOCopyBytesGracefully(c, resp, jsonResponse)
	return nil, &dto.Usage{}
}
