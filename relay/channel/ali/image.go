package ali

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"one-api/common"
	"one-api/dto"
	relaycommon "one-api/relay/common"
	"one-api/service"
	"one-api/types"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func selectImageProcessMode(info *relaycommon.RelayInfo) *ImageProcessMode {
	switch info.UpstreamModelName {
	case "qwen-image", "wan2.2-t2i-flash", "wan2.2-t2i-plus", "wanx2.1-t2i-turbo", "wanx2.1-t2i-plus", "wanx2.0-t2i-turbo", "wanx-v1":
		return text2ImageMode()
	case "qwen-image-edit":
		return multimoalGenerationMode()
	case "wanx2.1-imageedit", "wanx-sketch-to-image-lite":
		return image2ImageMode()
	default:
		return nil
	}
}

func oaiImage2Ali(a *Adaptor, c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	if mode := a.imageProcessMode; mode != nil && mode.ProcessRequest != nil {
		return mode.ProcessRequest(c, info, request)
	}
	var imageRequest AliImageRequest
	imageRequest.Input.Prompt = request.Prompt
	imageRequest.Model = request.Model
	imageRequest.Parameters.Size = strings.Replace(request.Size, "x", "*", -1)
	imageRequest.Parameters.N = request.N
	imageRequest.ResponseFormat = request.ResponseFormat

	return &imageRequest, nil

}

func updateTask(info *relaycommon.RelayInfo, taskID string) (*AliResponse, error, []byte) {
	url := fmt.Sprintf("%s/api/v1/tasks/%s", info.BaseUrl, taskID)

	var aliResponse AliResponse

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return &aliResponse, err, nil
	}

	req.Header.Set("Authorization", "Bearer "+info.ApiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		common.SysError("updateTask client.Do err: " + err.Error())
		return &aliResponse, err, nil
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)

	var response AliResponse
	err = json.Unmarshal(responseBody, &response)
	if err != nil {
		common.SysError("updateTask NewDecoder err: " + err.Error())
		return &aliResponse, err, nil
	}

	return &response, nil, responseBody
}

func asyncTaskWait(info *relaycommon.RelayInfo, taskID string) (*AliResponse, []byte, error) {
	waitSeconds := 3
	step := 0
	maxStep := 20

	var taskResponse AliResponse
	var responseBody []byte

	for {
		step++
		rsp, err, body := updateTask(info, taskID)
		responseBody = body
		if err != nil {
			return &taskResponse, responseBody, err
		}

		if rsp.Output.TaskStatus == "" {
			return &taskResponse, responseBody, nil
		}

		switch rsp.Output.TaskStatus {
		case "FAILED":
			fallthrough
		case "CANCELED":
			fallthrough
		case "SUCCEEDED":
			fallthrough
		case "UNKNOWN":
			return rsp, responseBody, nil
		}
		if step >= maxStep {
			break
		}
		time.Sleep(time.Duration(waitSeconds) * time.Second)
	}

	return nil, nil, fmt.Errorf("aliAsyncTaskWait timeout")
}

func responseAli2OpenAIImage(c *gin.Context, response *AliResponse, info *relaycommon.RelayInfo, responseFormat string) *dto.ImageResponse {
	imageResponse := dto.ImageResponse{
		Created: info.StartTime.Unix(),
	}

	for _, data := range response.Output.Results {
		var b64Json string
		if responseFormat == "b64_json" {
			_, b64, err := service.GetImageFromUrl(data.Url)
			if err != nil {
				common.LogError(c, "get_image_data_failed: "+err.Error())
				continue
			}
			b64Json = b64
		} else {
			b64Json = data.B64Image
		}

		imageResponse.Data = append(imageResponse.Data, dto.ImageData{
			Url:           data.Url,
			B64Json:       b64Json,
			RevisedPrompt: "",
		})
	}
	return &imageResponse
}

func aliImageHandler(a *Adaptor, c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*types.NewAPIError, *dto.Usage) {
	if mode := a.imageProcessMode; mode != nil && mode.ProcessResponse != nil {
		return mode.ProcessResponse(c, resp, info)
	}

	responseFormat := c.GetString("response_format")

	var aliTaskResponse AliResponse
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return types.NewError(err, types.ErrorCodeReadResponseBodyFailed), nil
	}
	common.CloseResponseBodyGracefully(resp)
	err = json.Unmarshal(responseBody, &aliTaskResponse)
	if err != nil {
		return types.NewError(err, types.ErrorCodeBadResponseBody), nil
	}

	if aliTaskResponse.Message != "" {
		common.LogError(c, "ali_async_task_failed: "+aliTaskResponse.Message)
		return types.NewError(errors.New(aliTaskResponse.Message), types.ErrorCodeBadResponse), nil
	}

	aliResponse, _, err := asyncTaskWait(info, aliTaskResponse.Output.TaskId)
	if err != nil {
		return types.NewError(err, types.ErrorCodeBadResponse), nil
	}

	if aliResponse.Output.TaskStatus != "SUCCEEDED" {
		return types.WithOpenAIError(types.OpenAIError{
			Message: aliResponse.Output.Message,
			Type:    "ali_error",
			Param:   "",
			Code:    aliResponse.Output.Code,
		}, resp.StatusCode), nil
	}

	fullTextResponse := responseAli2OpenAIImage(c, aliResponse, info, responseFormat)
	jsonResponse, err := marshalWithoutHTMLEscape(fullTextResponse)
	if err != nil {
		return types.NewError(err, types.ErrorCodeBadResponseBody), nil
	}
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	c.Writer.Write(jsonResponse)
	return nil, &dto.Usage{}
}

// 9-1.png?Expires=1007170000&OSSAccessKeyId=
// 9-1.png?Expires=1007170000\\u0026OSSAccessKeyId=
func marshalWithoutHTMLEscape(v interface{}) ([]byte, error) {
	buffer := &bytes.Buffer{}
	encoder := json.NewEncoder(buffer)
	encoder.SetEscapeHTML(false) // 关闭HTML转义
	err := encoder.Encode(v)
	if err != nil {
		return nil, err
	}
	// 移除末尾的换行符
	result := buffer.Bytes()
	if len(result) > 0 && result[len(result)-1] == '\n' {
		result = result[:len(result)-1]
	}
	return result, nil
}
