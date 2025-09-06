package ali

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"one-api/common"
	oneapi_constant "one-api/constant"
	"one-api/dto"
	"one-api/model"
	"one-api/relay/channel"
	"one-api/relay/channel/claude"
	"one-api/relay/channel/openai"
	relaycommon "one-api/relay/common"
	"one-api/relay/constant"
	"one-api/service"
	"one-api/types"
	"strings"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
	imageProcessMode *ImageProcessMode
}

func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, req *dto.ClaudeRequest) (any, error) {
	return req, nil
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	a.imageProcessMode = selectImageProcessMode(info)
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	var fullRequestURL string
	switch info.RelayFormat {
	case types.RelayFormatClaude:
		fullRequestURL = fmt.Sprintf("%s/api/v2/apps/claude-code-proxy/v1/messages", info.ChannelBaseUrl)
	default:
		switch info.RelayMode {
		case constant.RelayModeEmbeddings:
			fullRequestURL = fmt.Sprintf("%s/compatible-mode/v1/embeddings", info.ChannelBaseUrl)
		case constant.RelayModeRerank:
			fullRequestURL = fmt.Sprintf("%s/api/v1/services/rerank/text-rerank/text-rerank", info.ChannelBaseUrl)
		case constant.RelayModeImagesGenerations, constant.RelayModeImagesEdits:
			{
				if a.imageProcessMode != nil {
					urlSuffix := a.imageProcessMode.Url
					fullRequestURL = fmt.Sprintf("%s%s", info.ChannelBaseUrl, urlSuffix)
				} else {
					fullRequestURL = fmt.Sprintf("%s/api/v1/services/aigc/text2image/image-synthesis", info.ChannelBaseUrl)
				}
			}
		case constant.RelayModeCompletions:
			fullRequestURL = fmt.Sprintf("%s/compatible-mode/v1/completions", info.ChannelBaseUrl)
		default:
			fullRequestURL = fmt.Sprintf("%s/compatible-mode/v1/chat/completions", info.ChannelBaseUrl)
		}
	}

	return fullRequestURL, nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Content-Type", "application/json")
	req.Set("Authorization", "Bearer "+info.ApiKey)
	if info.IsStream {
		req.Set("X-DashScope-SSE", "enable")
	}
	if c.GetString("plugin") != "" {
		req.Set("X-DashScope-Plugin", c.GetString("plugin"))
	}
	if a.imageProcessMode != nil && a.imageProcessMode.Async {
		req.Set("X-DashScope-Async", "enable")
	}
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	// docs: https://bailian.console.aliyun.com/?tab=api#/api/?type=model&url=2712216
	// fix: InternalError.Algo.InvalidParameter: The value of the enable_thinking parameter is restricted to True.
	if strings.Contains(request.Model, "thinking") {
		request.EnableThinking = true
		request.Stream = true
		info.IsStream = true
	}
	// fix: ali parameter.enable_thinking must be set to false for non-streaming calls
	if !info.IsStream {
		request.EnableThinking = false
	}

	switch info.RelayMode {
	default:
		aliReq := requestOpenAI2Ali(*request)
		return aliReq, nil
	}
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	aliRequest, err := oaiImage2Ali(a, c, info, request)
	if err != nil {
		return nil, fmt.Errorf("convert image request failed: %w", err)
	}

	return aliRequest, nil
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return ConvertRerankRequest(request), nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	// TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	switch info.RelayFormat {
	case types.RelayFormatClaude:
		if info.IsStream {
			return claude.ClaudeStreamHandler(c, resp, info, claude.RequestModeMessage)
		} else {
			return claude.ClaudeHandler(c, resp, info, claude.RequestModeMessage)
		}
	default:
		switch info.RelayMode {
		case constant.RelayModeImagesGenerations, constant.RelayModeImagesEdits:
			err, usage = aliImageHandler(a, c, resp, info)
		case constant.RelayModeRerank:
			err, usage = RerankHandler(c, resp, info)
		default:
			adaptor := openai.Adaptor{}
			usage, err = adaptor.DoResponse(c, resp, info)
		}
		return usage, err
	}
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}

type TaskAdaptor struct {
	videoProcessMode *VideoProcessMode
}

func (ta *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	ta.videoProcessMode = selectVideoProcessMode(info)
}

func (ta *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {

	// Accept only POST /v1/video/generations as "generate" action.
	action := oneapi_constant.TaskActionGenerate
	info.Action = action

	req := relaycommon.TaskSubmitReq{}
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		taskErr := service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
		return taskErr
	}
	if strings.TrimSpace(req.Prompt) == "" {
		taskErr := service.TaskErrorWrapperLocal(fmt.Errorf("prompt is required"), "invalid_request", http.StatusBadRequest)
		return taskErr
	}

	// Store into context for later usage
	c.Set("task_request", req)
	return nil
}

func (ta *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if ta.videoProcessMode != nil {
		return fmt.Sprintf("%s%s", info.ChannelBaseUrl, ta.videoProcessMode.Url), nil
	}
	return "", errors.ErrUnsupported
}

func (ta *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", info.ApiKey))
	req.Header.Set("X-DashScope-Async", "enable")
	return nil
}

func (ta *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	v, exists := c.Get("task_request")
	if !exists {
		return nil, fmt.Errorf("request not found in context")
	}
	req := v.(relaycommon.TaskSubmitReq)
	if ta.videoProcessMode != nil {
		return ta.videoProcessMode.ProcessRequest(c, info, req)
	}
	return nil, errors.ErrUnsupported

}

func (ta *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(ta, c, info, requestBody)
}

func (ta *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	return videoHandler(ta, c, resp, info)

}

func (ta *TaskAdaptor) GetModelList() []string {
	return []string{"wan2.2-i2v-flash", "wan2.2-i2v-plus", "wanx2.1-i2v-plus", "wanx2.1-i2v-turbo", "wanx2.1-kf2v-plus", "wan2.2-t2v-plus", "wanx2.1-t2v-turbo", "wanx2.1-t2v-plus", "wanx2.1-vace-plus"}
}

func (ta *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

// FetchTask
func (ta *TaskAdaptor) FetchTask(baseUrl string, key string, body map[string]any) (*http.Response, error) {

	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}
	url := fmt.Sprintf("%s/api/v1/tasks/%s", baseUrl, taskID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+key)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		common.SysLog("updateTask client.Do err: " + err.Error())
		return nil, err
	}
	return resp, nil
}

// 值：submited（已提交）、processing（处理中）、succeed（成功）、failed（失败）
var statusMapping = map[string]string{
	"PENDING":   model.TaskStatusSubmitted,
	"RUNNING":   model.TaskStatusInProgress,
	"SUCCEEDED": model.TaskStatusSuccess,
	"FAILED":    model.TaskStatusFailure,
	"CANCELED":  model.TaskStatusFailure,
	"UNKNOWN":   model.TaskStatusUnknown,
}

func (ta *TaskAdaptor) ParseTaskResult(responseBody []byte) (*relaycommon.TaskInfo, error) {

	var response VideoGenerationResponse
	err := common.Unmarshal(responseBody, &response)
	if err != nil {
		common.SysLog("updateTask NewDecoder err: " + err.Error())
		return nil, err
	}

	taskResult := relaycommon.TaskInfo{}
	if response.HasError() {
		taskResult.Code = 5000 // todo uni code
		taskResult.Reason = response.Message
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
		return &taskResult, nil
	}

	taskResult.Code = 0
	taskResult.Status = statusMapping[response.Output.TaskStatus]
	switch response.Output.TaskStatus {
	case "PENDING":
		taskResult.Status = model.TaskStatusQueued
		taskResult.Progress = "10%"
	case "RUNNING":
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = "50%"
	case "SUCCEEDED", "FAILED", "CANCELED", "UNKNOWN":
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Progress = "100%"
	}
	taskResult.Url = response.Output.VideoUrl
	return &taskResult, nil
}
