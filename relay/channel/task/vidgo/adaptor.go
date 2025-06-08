package vidgo

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"one-api/common"
	"one-api/dto"
	relaycommon "one-api/relay/common"
	"one-api/service"

	vidgoSdk "github.com/feitianbubu/vidgo"
	"github.com/gin-gonic/gin"
)

// TaskAdaptor is a simple wrapper around vidgo SDK
type TaskAdaptor struct {
	sdkAdaptor *vidgoSdk.TaskAdaptor
}

func NewTaskAdaptor() *TaskAdaptor {
	return &TaskAdaptor{
		sdkAdaptor: vidgoSdk.NewTaskAdaptor(),
	}
}

func (a *TaskAdaptor) Init(info *relaycommon.TaskRelayInfo) {
	// Ensure sdkAdaptor is initialized
	if a.sdkAdaptor == nil {
		a.sdkAdaptor = vidgoSdk.NewTaskAdaptor()
	}

	// Convert to SDK TaskRelayInfo and initialize
	sdkInfo := &vidgoSdk.TaskRelayInfo{
		ChannelType: info.ChannelType,
		BaseUrl:     info.BaseUrl,
		ApiKey:      info.ApiKey,
		Action:      info.Action,
	}
	a.sdkAdaptor.Init(sdkInfo)
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.TaskRelayInfo) (taskErr *dto.TaskError) {
	// For video generation, the action is always "generate"
	action := "generate"
	info.Action = action

	// Store action in context for later use
	c.Set("vidgo_action", action)
	return nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.TaskRelayInfo, requestBody io.Reader) (*http.Response, error) {
	if a.sdkAdaptor == nil {
		a.sdkAdaptor = vidgoSdk.NewTaskAdaptor()
	}

	// Get request body from context, it's set by GetRequestBody in BuildRequestBody.
	storedBody, exists := c.Get(common.KeyRequestBody)
	if !exists {
		return nil, fmt.Errorf("request body not found in context")
	}
	requestBodyBytes, ok := storedBody.([]byte)
	if !ok {
		return nil, fmt.Errorf("invalid request body type in context")
	}

	sdkInfo := &vidgoSdk.TaskRelayInfo{
		ChannelType: info.ChannelType,
		BaseUrl:     info.BaseUrl,
		ApiKey:      info.ApiKey,
		Action:      info.Action,
	}
	a.sdkAdaptor.Init(sdkInfo)

	vidgoRequest, taskErr := a.sdkAdaptor.ValidateRequestAndSetAction(requestBodyBytes, info.Action)
	if taskErr != nil {
		return nil, fmt.Errorf("validate request failed: %s", taskErr.Message)
	}

	requestUrl, err := a.sdkAdaptor.BuildRequestURL(sdkInfo)
	if err != nil {
		return nil, fmt.Errorf("build request URL failed: %w", err)
	}

	headers := a.sdkAdaptor.BuildRequestHeader(sdkInfo)

	requestBodyBytes, err = a.sdkAdaptor.BuildRequestBody(vidgoRequest)
	if err != nil {
		return nil, fmt.Errorf("build request body failed: %w", err)
	}

	return a.sdkAdaptor.DoRequest(requestUrl, headers, requestBodyBytes)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.TaskRelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	var data dto.TaskResponse[map[string]any]
	taskID, taskData, sdkTaskErr := a.sdkAdaptor.DoResponse(resp)
	if sdkTaskErr != nil {
		taskErr = service.TaskErrorWrapperLocal(fmt.Errorf(sdkTaskErr.Message), sdkTaskErr.Code, sdkTaskErr.StatusCode)
		data.Code = sdkTaskErr.Code
		data.Message = sdkTaskErr.Message
	}
	data.Data = map[string]any{
		"task_id": taskID,
	}
	c.JSON(http.StatusOK, data)
	return
}

func (a *TaskAdaptor) SubmitTask(baseUrl, key string, request any) (*http.Response, error) {
	// This method is not used in the new architecture, but kept for compatibility
	return nil, fmt.Errorf("SubmitTask is deprecated, use DoRequest instead")
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	// Convert to SDK TaskRelayInfo
	sdkInfo := &vidgoSdk.TaskRelayInfo{
		BaseUrl: baseUrl,
		ApiKey:  key,
	}

	// Use SDK's high-level method to fetch task status
	return a.sdkAdaptor.ProcessTaskFetch(sdkInfo, taskID)
}

func (a *TaskAdaptor) GetModelList() []string {
	return a.sdkAdaptor.GetModelList()
}

func (a *TaskAdaptor) GetChannelName() string {
	return a.sdkAdaptor.GetChannelName()
}

// BuildRequestURL is kept for interface compatibility but delegates to SDK
func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.TaskRelayInfo) (string, error) {
	sdkInfo := &vidgoSdk.TaskRelayInfo{
		ChannelType: info.ChannelType,
		BaseUrl:     info.BaseUrl,
		ApiKey:      info.ApiKey,
		Action:      info.Action,
	}
	return a.sdkAdaptor.BuildRequestURL(sdkInfo)
}

// BuildRequestHeader is kept for interface compatibility
func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.TaskRelayInfo) error {
	sdkInfo := &vidgoSdk.TaskRelayInfo{
		ChannelType: info.ChannelType,
		BaseUrl:     info.BaseUrl,
		ApiKey:      info.ApiKey,
		Action:      info.Action,
	}
	headers := a.sdkAdaptor.BuildRequestHeader(sdkInfo)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	return nil
}

// BuildRequestBody is kept for interface compatibility but simplified
func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.TaskRelayInfo) (io.Reader, error) {
	if a.sdkAdaptor == nil {
		a.sdkAdaptor = vidgoSdk.NewTaskAdaptor()
	}

	requestBodyBytes, err := common.GetRequestBody(c)
	if err != nil {
		return nil, fmt.Errorf("get request body failed: %w", err)
	}

	return bytes.NewReader(requestBodyBytes), nil
}
