package suno

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

// OfficialSunoData 官方 Suno API 的数据结构
type OfficialSunoData struct {
	ID         string  `json:"id"`
	AudioURL   string  `json:"audioUrl"`
	StreamURL  string  `json:"streamAudioUrl"`
	ImageURL   string  `json:"imageUrl"`
	Prompt     string  `json:"prompt"`
	ModelName  string  `json:"modelName"`
	Title      string  `json:"title"`
	Tags       string  `json:"tags"`
	CreateTime int64   `json:"createTime"`
	Duration   float64 `json:"duration"`
}

// OfficialSunoResponseData 官方 Suno API 的响应数据
type OfficialSunoResponseData struct {
	TaskID        string `json:"taskId"`
	ParentMusicID string `json:"parentMusicId"`
	Param         string `json:"param"`
	Response      struct {
		TaskID   string             `json:"taskId"`
		SunoData []OfficialSunoData `json:"sunoData"`
	} `json:"response"`
	Status       string  `json:"status"`
	Type         string  `json:"type"`
	ErrorCode    *string `json:"errorCode"`
	ErrorMessage *string `json:"errorMessage"`
	CreateTime   int64   `json:"createTime"`
}

// OfficialSunoResponse 官方 Suno API 的完整响应结构 (导出供 controller 使用)
type OfficialSunoResponse struct {
	Code int                      `json:"code"`
	Msg  string                   `json:"msg"`
	Data OfficialSunoResponseData `json:"data"`
}

func (r *OfficialSunoResponse) IsSuccess() bool {
	return r.Code == 200
}

// ToStandardResponse 将官方 API 响应转换为标准的 TaskResponse 格式
func (r *OfficialSunoResponse) ToStandardResponse() dto.TaskResponse[[]dto.SunoDataResponse] {
	var failReason string
	if r.Data.ErrorMessage != nil {
		failReason = *r.Data.ErrorMessage
	}

	var finishTime int64
	var url string
	if r.Data.Status == "SUCCESS" {
		finishTime = time.Now().UnixMilli()
		if sunoData := r.Data.Response.SunoData; len(sunoData) > 0 {
			url = sunoData[0].AudioURL
		}
	}

	// 将官方数据转换为 JSON 存储
	var dataBytes []byte
	if len(r.Data.Response.SunoData) > 0 {
		dataBytes, _ = json.Marshal(r.Data.Response.SunoData)
	}

	sunoDataResponse := dto.SunoDataResponse{
		TaskID:     r.Data.TaskID,
		Status:     r.Data.Status,
		FailReason: failReason,
		Url:        url,
		SubmitTime: r.Data.CreateTime,
		StartTime:  r.Data.CreateTime,
		FinishTime: finishTime,
		Data:       dataBytes,
	}

	return dto.TaskResponse[[]dto.SunoDataResponse]{
		Code:    "success",
		Message: "success",
		Data:    []dto.SunoDataResponse{sunoDataResponse},
	}
}

func (a *TaskAdaptor) DoResponseOfficial(c *gin.Context, resp *http.Response, _ *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}

	var officialResp OfficialSunoResponse
	err = json.Unmarshal(responseBody, &officialResp)
	if err != nil {
		err = errors.Wrap(err, fmt.Sprintf("response body: %s", string(responseBody)))
		taskErr = service.TaskErrorWrapper(err, "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	if !officialResp.IsSuccess() {
		taskErr = service.TaskErrorWrapper(fmt.Errorf(officialResp.Msg), fmt.Sprintf("%d", officialResp.Code), http.StatusInternalServerError)
		return
	}

	for k, v := range resp.Header {
		c.Writer.Header().Set(k, v[0])
	}
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)

	_, err = io.Copy(c.Writer, bytes.NewBuffer(responseBody))
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "copy_response_body_failed", http.StatusInternalServerError)
		return
	}

	return officialResp.Data.TaskID, nil, nil
}

// FetchTaskOfficial 官方 Suno API 获取任务详情
func (a *TaskAdaptor) FetchTaskOfficial(baseUrl, key string, body map[string]any) (*http.Response, error) {
	ids, ok := body["ids"].([]string)
	if !ok || len(ids) == 0 {
		return nil, fmt.Errorf("ids array is required in body")
	}

	taskId := ids[0]
	if taskId == "" {
		return nil, fmt.Errorf("taskId cannot be empty")
	}

	requestUrl := fmt.Sprintf("%s/api/v1/generate/record-info?taskId=%s", baseUrl, taskId)

	req, err := http.NewRequest("GET", requestUrl, nil)
	if err != nil {
		common.SysLog(fmt.Sprintf("Get Task error: %v", err))
		return nil, err
	}

	// 使用带有超时的 context 创建新的请求
	req = req.WithContext(context.TODO())
	req.Header.Set("Authorization", "Bearer "+key)
	resp, err := service.GetHttpClient().Do(req)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

func ParseResponseItems(responseBody []byte) (dto.TaskResponse[[]dto.SunoDataResponse], error) {
	var responseItems dto.TaskResponse[[]dto.SunoDataResponse]
	var officialResp OfficialSunoResponse
	err := json.Unmarshal(responseBody, &officialResp)
	if err != nil {
		return responseItems, errors.Wrap(err, fmt.Sprintf("parse official API response error, body: %s", string(responseBody)))
	}
	if !officialResp.IsSuccess() {
		return responseItems, fmt.Errorf("official API error: %s", officialResp.Msg)
	}
	responseItems = officialResp.ToStandardResponse()
	return responseItems, nil
}
