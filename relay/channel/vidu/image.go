package vidu

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

func oaiImage2ViduImageRequest(info *relaycommon.RelayInfo, request dto.ImageRequest) (*ImageRequest, error) {
	req := &ImageRequest{
		Model:  request.Model,
		Prompt: request.Prompt,
	}

	if request.Extra != nil {
		extraBytes, _ := json.Marshal(request.Extra)
		err := json.Unmarshal(extraBytes, req)
		if err != nil {
			return nil, err
		}
	}

	return req, nil
}

func imageEditFromOai(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (*ImageRequest, error) {
	req := &ImageRequest{
		Model:  request.Model,
		Prompt: request.Prompt,
	}

	imageBase64Data, err := relaycommon.GetImageBase64sFromForm(c)
	if err != nil {
		return nil, fmt.Errorf("get image base64s from form failed: %w", err)
	}

	req.Images = make([]string, len(imageBase64Data))
	for i, data := range imageBase64Data {
		req.Images[i] = data.String()
	}

	var reqMap = make(map[string]string)
	if err = common.UnmarshalBodyReusable(c, &reqMap); err != nil {
		return nil, fmt.Errorf("unmarshal body reusable failed: %w", err)
	}
	for key, value := range reqMap {
		switch key {
		case "seed":
			if req.Seed, err = strconv.Atoi(value); err != nil {
				return nil, fmt.Errorf("invalid seed field: %w", err)
			}
		case "aspect_ratio":
			req.AspectRatio = value
		case "resolution":
			req.Resolution = value
		case "payload":
			req.Payload = value
		case "callback_url":
			req.CallbackUrl = value
		}
	}

	return req, nil
}

func asyncTaskWait(c *gin.Context, info *relaycommon.RelayInfo, taskID string) (*TaskResultResponse, []byte, error) {
	time.Sleep(5 * time.Second)

	for step := 0; step < 20; step++ {
		logger.LogDebug(c, fmt.Sprintf("vidu image task wait step %d/20", step))
		rsp, body, err := queryTask(info, taskID)
		if err != nil {
			logger.LogWarn(c, "vidu query task error: "+err.Error())
			time.Sleep(10 * time.Second)
			continue
		}

		switch rsp.State {
		case "success":
			return rsp, body, nil
		case "failed":
			errMsg := "task failed"
			if rsp.ErrCode != "" {
				errMsg = rsp.ErrCode
			}
			return rsp, body, errors.New(errMsg)
		case "created", "queueing", "processing":
			time.Sleep(10 * time.Second)
			continue
		default:
			return rsp, body, fmt.Errorf("unknown task state: %s", rsp.State)
		}
	}

	return nil, nil, errors.New("task timeout")
}

func queryTask(info *relaycommon.RelayInfo, taskID string) (*TaskResultResponse, []byte, error) {
	url := fmt.Sprintf("%s/ent/v2/tasks/%s/creations", info.ChannelBaseUrl, taskID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, nil, err
	}

	req.Header.Set("Authorization", "Token "+info.ApiKey)
	req.Header.Set("Content-Type", "application/json")

	client := service.GetHttpClient()
	resp, err := client.Do(req)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, err
	}

	var res TaskResultResponse
	err = json.Unmarshal(body, &res)
	if err != nil {
		return nil, nil, err
	}

	return &res, body, nil
}

func response2OpenAIImage(c *gin.Context, response *TaskResultResponse, originBody []byte, info *relaycommon.RelayInfo) *dto.ImageResponse {
	imageResponse := dto.ImageResponse{
		Created:  info.StartTime.Unix(),
		Metadata: originBody,
	}

	for _, creation := range response.Creations {
		imageResponse.Data = append(imageResponse.Data, dto.ImageData{
			Url: creation.URL,
		})
	}

	return &imageResponse
}

func viduImageHandler(a *Adaptor, c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	service.CloseResponseBodyGracefully(resp)

	var viduTaskResp ImageResponse
	err = json.Unmarshal(responseBody, &viduTaskResp)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	if viduTaskResp.State == "failed" {
		return nil, types.NewError(errors.New("task failed"), types.ErrorCodeBadResponse)
	}

	viduResp, originBody, err := asyncTaskWait(c, info, viduTaskResp.TaskId)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponse)
	}

	if viduResp.State != "success" {
		errMsg := "task failed"
		if viduResp.ErrCode != "" {
			errMsg = viduResp.ErrCode
		}
		return nil, types.WithOpenAIError(types.OpenAIError{
			Message: errMsg,
			Type:    "vidu_error",
			Code:    viduResp.ErrCode,
		}, resp.StatusCode)
	}

	logger.LogDebug(c, "vidu image result: "+string(originBody))

	imageResponse := response2OpenAIImage(c, viduResp, originBody, info)

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
