package doubaomediakit

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	taskdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/doubao"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

const (
	channelName             = "doubao-video-mediakit"
	defaultMediaKitBaseURL  = "https://amk.cn-beijing.volces.com"
	mediaKitEnhancePath     = "/api/v1/tools/enhance-video"
	mediaKitTaskPath        = "/api/v1/tasks/"
	maxUpstreamResponseSize = 8 << 20
)

// TaskAdaptor composes the regular Doubao adaptor with an asynchronous
// MediaKit enhancement stage. Request conversion and Seedance billing remain
// centralized in the upstream adaptor; this type only owns the resolution
// policy and the stage transition.
type TaskAdaptor struct {
	doubao.TaskAdaptor
	credentials      Credentials
	credentialsErr   error
	targetResolution string
	mediaKitBaseURL  string
}

type mediaKitSubmitRequest struct {
	VideoURL    string `json:"video_url"`
	Scene       string `json:"scene"`
	ToolVersion string `json:"tool_version"`
	Resolution  string `json:"resolution"`
	ClientToken string `json:"client_token"`
}

type mediaKitResponse struct {
	Success   *bool          `json:"success,omitempty"`
	TaskID    string         `json:"task_id,omitempty"`
	TaskType  string         `json:"task_type,omitempty"`
	Status    string         `json:"status,omitempty"`
	Result    map[string]any `json:"result,omitempty"`
	Error     any            `json:"error,omitempty"`
	RequestID string         `json:"request_id,omitempty"`
}

type transitionResponse struct {
	Provider   string          `json:"provider"`
	Phase      string          `json:"phase"`
	Status     string          `json:"status"`
	NextTaskID string          `json:"next_task_id"`
	Source     json.RawMessage `json:"source,omitempty"`
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.targetResolution = ""
	a.mediaKitBaseURL = defaultMediaKitBaseURL
	a.credentials, a.credentialsErr = Credentials{}, fmt.Errorf("channel key is required")
	if info != nil {
		if info.ChannelMeta != nil {
			if baseURL := strings.TrimSpace(info.ChannelOtherSettings.MediaKitBaseURL); baseURL != "" {
				a.mediaKitBaseURL = strings.TrimRight(baseURL, "/")
			}
		}
		a.credentials, a.credentialsErr = ParseCredentials(info.ApiKey)
	}

	arkInfo := relaycommon.RelayInfo{}
	if info != nil {
		arkInfo = *info
	}
	if arkInfo.ChannelMeta != nil {
		channelMeta := *arkInfo.ChannelMeta
		arkInfo.ChannelMeta = &channelMeta
	} else {
		arkInfo.ChannelMeta = &relaycommon.ChannelMeta{}
	}
	if a.credentialsErr == nil {
		arkInfo.ApiKey = a.credentials.ArkAPIKey
	} else {
		arkInfo.ApiKey = ""
	}
	a.TaskAdaptor.Init(&arkInfo)
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *taskdto.TaskError {
	if a.credentialsErr != nil {
		return service.TaskErrorWrapperLocal(a.credentialsErr, "invalid_channel_key", http.StatusBadRequest)
	}
	if taskErr := a.TaskAdaptor.ValidateRequestAndSetAction(c, info); taskErr != nil {
		return taskErr
	}

	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	resolution, _ := req.Metadata["resolution"].(string)
	resolution = strings.ToLower(strings.TrimSpace(resolution))
	sourceResolution := ""
	switch resolution {
	case resolution720P:
		sourceResolution = resolution480P
	case resolution1080P:
		sourceResolution = resolution720P
	default:
		return service.TaskErrorWrapperLocal(
			fmt.Errorf("resolution must be either 720p or 1080p"),
			"invalid_resolution",
			http.StatusBadRequest,
		)
	}

	a.targetResolution = resolution
	if info != nil {
		info.VideoOutputResolution = resolution
	}
	req.Metadata["resolution"] = sourceResolution
	relaycommon.SetTaskRequest(c, req)
	return nil
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (string, []byte, *taskdto.TaskError) {
	arkTaskID, taskData, taskErr := a.TaskAdaptor.DoResponse(c, resp, info)
	if taskErr != nil {
		return "", taskData, taskErr
	}
	if a.targetResolution == "" {
		return "", taskData, service.TaskErrorWrapper(
			fmt.Errorf("target resolution is missing after validation"),
			"invalid_resolution_state",
			http.StatusInternalServerError,
		)
	}
	return newGenerationStage(a.targetResolution, arkTaskID), taskData, nil
}

func (a *TaskAdaptor) FetchTask(baseURL, key string, body map[string]any, proxy string) (*http.Response, error) {
	stageID, ok := body["task_id"].(string)
	if !ok || strings.TrimSpace(stageID) == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	stage, err := parseTaskStage(stageID)
	if err != nil {
		return nil, err
	}
	keys, err := ParseCredentials(key)
	if err != nil {
		return nil, err
	}

	switch stage.Phase {
	case stageGeneration:
		return a.fetchGenerationStage(baseURL, keys, stage, proxy)
	case stageEnhancement:
		return a.fetchEnhancementStage(keys.MediaKitAPIKey, stage, proxy)
	default:
		return nil, fmt.Errorf("unsupported task phase %q", stage.Phase)
	}
}

func (a *TaskAdaptor) fetchGenerationStage(baseURL string, keys Credentials, stage taskStage, proxy string) (*http.Response, error) {
	arkAdaptor := &doubao.TaskAdaptor{}
	arkResponse, err := arkAdaptor.FetchTask(baseURL, keys.ArkAPIKey, map[string]any{
		"task_id": stage.ArkTaskID,
	}, proxy)
	if err != nil {
		return nil, err
	}
	arkBody, err := readUpstreamResponse(arkResponse)
	if err != nil {
		return nil, err
	}
	if arkResponse.StatusCode >= http.StatusBadRequest {
		return nil, upstreamHTTPError("ark task query", arkResponse.StatusCode, arkBody)
	}

	arkResult, err := arkAdaptor.ParseTaskResult(arkBody)
	if err != nil {
		return nil, err
	}
	if arkResult.Status != string(model.TaskStatusSuccess) {
		return responseFromBytes(arkResponse, arkBody), nil
	}
	if strings.TrimSpace(arkResult.Url) == "" {
		return nil, fmt.Errorf("ark task succeeded without a video URL")
	}

	mediaKitTaskID, err := a.submitMediaKitEnhancement(
		keys.MediaKitAPIKey,
		stage,
		arkResult.Url,
		proxy,
	)
	if err != nil {
		return nil, err
	}
	transition := transitionResponse{
		Provider:   channelName,
		Phase:      "enhancement_submitted",
		Status:     "running",
		NextTaskID: newEnhancementStage(stage.TargetResolution, stage.ArkTaskID, mediaKitTaskID),
		Source:     json.RawMessage(arkBody),
	}
	return jsonResponse(http.StatusOK, transition)
}

func (a *TaskAdaptor) fetchEnhancementStage(mediaKitAPIKey string, stage taskStage, proxy string) (*http.Response, error) {
	requestURL := a.mediaKitBaseURL + mediaKitTaskPath + stage.MediaKitTaskID
	req, err := http.NewRequest(http.MethodGet, requestURL, nil)
	if err != nil {
		return nil, err
	}
	setMediaKitHeaders(req, mediaKitAPIKey)
	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("create proxy HTTP client: %w", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	body, err := readUpstreamResponse(resp)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= http.StatusBadRequest {
		return nil, upstreamHTTPError("mediakit task query", resp.StatusCode, body)
	}
	return responseFromBytes(resp, body), nil
}

func (a *TaskAdaptor) submitMediaKitEnhancement(apiKey string, stage taskStage, videoURL, proxy string) (string, error) {
	hash := sha256.Sum256([]byte(stage.ArkTaskID + "\x00" + stage.TargetResolution))
	payload := mediaKitSubmitRequest{
		VideoURL:    videoURL,
		Scene:       "aigc",
		ToolVersion: "standard",
		Resolution:  stage.TargetResolution,
		ClientToken: "new-api-" + hex.EncodeToString(hash[:16]),
	}
	body, err := common.Marshal(payload)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequest(http.MethodPost, a.mediaKitBaseURL+mediaKitEnhancePath, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	setMediaKitHeaders(req, apiKey)
	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return "", fmt.Errorf("create proxy HTTP client: %w", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	responseBody, err := readUpstreamResponse(resp)
	if err != nil {
		return "", err
	}
	if resp.StatusCode >= http.StatusBadRequest {
		return "", upstreamHTTPError("mediakit enhancement submit", resp.StatusCode, responseBody)
	}

	var result mediaKitResponse
	if err := common.Unmarshal(responseBody, &result); err != nil {
		return "", fmt.Errorf("decode MediaKit submit response: %w", err)
	}
	if result.Success != nil && !*result.Success {
		return "", fmt.Errorf("mediakit enhancement submit failed: %s", extractErrorMessage(result.Error))
	}
	if strings.TrimSpace(result.TaskID) == "" {
		return "", fmt.Errorf("mediakit enhancement submit response has no task_id")
	}
	return result.TaskID, nil
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var transition transitionResponse
	if err := common.Unmarshal(respBody, &transition); err == nil && transition.Provider == channelName {
		if transition.NextTaskID == "" {
			return nil, fmt.Errorf("mediakit transition response has no next_task_id")
		}
		taskResult := &relaycommon.TaskInfo{
			TaskID:   transition.NextTaskID,
			Status:   string(model.TaskStatusInProgress),
			Progress: "70%",
		}
		if len(transition.Source) > 0 {
			if arkResult, parseErr := a.TaskAdaptor.ParseTaskResult(transition.Source); parseErr == nil && arkResult != nil {
				taskResult.TotalTokens = arkResult.TotalTokens
				taskResult.CompletionTokens = arkResult.CompletionTokens
				taskResult.DurationSeconds = arkResult.DurationSeconds
			}
		}
		return taskResult, nil
	}

	var mediaResult mediaKitResponse
	if err := common.Unmarshal(respBody, &mediaResult); err == nil && isMediaKitTaskResponse(mediaResult) {
		return parseMediaKitTaskResult(mediaResult), nil
	}
	return a.TaskAdaptor.ParseTaskResult(respBody)
}

func parseMediaKitTaskResult(result mediaKitResponse) *relaycommon.TaskInfo {
	taskResult := &relaycommon.TaskInfo{Code: 0}
	status := strings.ToLower(strings.TrimSpace(result.Status))
	switch status {
	case "queued":
		taskResult.Status = string(model.TaskStatusQueued)
		taskResult.Progress = "75%"
	case "running", "processing":
		taskResult.Status = string(model.TaskStatusInProgress)
		taskResult.Progress = "85%"
	case "completed", "succeeded", "success":
		taskResult.Url = extractVideoURL(result.Result)
		if taskResult.Url == "" {
			taskResult.Status = string(model.TaskStatusFailure)
			taskResult.Reason = "MediaKit task completed without a video URL"
		} else {
			taskResult.Status = string(model.TaskStatusSuccess)
		}
		taskResult.Progress = "100%"
	case "failed", "canceled", "cancelled":
		taskResult.Status = string(model.TaskStatusFailure)
		taskResult.Progress = "100%"
		taskResult.Reason = extractErrorMessage(result.Error)
		if taskResult.Reason == "" {
			taskResult.Reason = "MediaKit task " + status
		}
	default:
		if result.Success != nil && !*result.Success {
			taskResult.Status = string(model.TaskStatusFailure)
			taskResult.Progress = "100%"
			taskResult.Reason = extractErrorMessage(result.Error)
		} else {
			taskResult.Status = string(model.TaskStatusInProgress)
			taskResult.Progress = "75%"
		}
	}
	return taskResult
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	video := dto.NewOpenAIVideo()
	video.ID = originTask.TaskID
	video.TaskID = originTask.TaskID
	video.Status = originTask.Status.ToVideoStatus()
	video.SetProgressStr(originTask.Progress)
	video.CreatedAt = originTask.CreatedAt
	video.CompletedAt = originTask.UpdatedAt
	video.Model = originTask.Properties.OriginModelName
	if resultURL := originTask.GetResultURL(); strings.TrimSpace(resultURL) != "" {
		video.SetMetadata("url", resultURL)
	}
	if originTask.Status == model.TaskStatusFailure {
		video.Error = &dto.OpenAIVideoError{Message: originTask.FailReason, Code: "mediakit_task_failed"}
	}
	return common.Marshal(video)
}

func (a *TaskAdaptor) ConvertToArkVideo(originTask *model.Task) ([]byte, error) {
	stage, _ := parseTaskStage(originTask.GetUpstreamTaskID())
	status := arkStatus(originTask.Status)
	result := map[string]any{
		"id":         originTask.TaskID,
		"model":      originTask.Properties.OriginModelName,
		"status":     status,
		"resolution": stage.TargetResolution,
		"created_at": originTask.CreatedAt,
		"updated_at": originTask.UpdatedAt,
	}
	if resultURL := strings.TrimSpace(originTask.GetResultURL()); resultURL != "" {
		result["content"] = map[string]any{"video_url": resultURL}
	}
	if originTask.Status == model.TaskStatusFailure {
		result["error"] = map[string]any{
			"code":    "mediakit_task_failed",
			"message": originTask.FailReason,
		}
	}
	return common.Marshal(result)
}

func (a *TaskAdaptor) GetModelList() []string {
	return doubao.ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return channelName
}

func isMediaKitTaskResponse(result mediaKitResponse) bool {
	return result.TaskID != "" || result.TaskType != "" || result.Status != "" || result.Result != nil || result.Success != nil
}

func extractVideoURL(result map[string]any) string {
	for _, key := range []string{"video_url", "output_url", "url"} {
		if value, ok := result[key].(string); ok && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	for _, value := range result {
		if nested, ok := value.(map[string]any); ok {
			if videoURL := extractVideoURL(nested); videoURL != "" {
				return videoURL
			}
		}
	}
	return ""
}

func extractErrorMessage(value any) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case map[string]any:
		for _, key := range []string{"message", "msg", "error"} {
			if message := extractErrorMessage(typed[key]); message != "" {
				return message
			}
		}
	}
	return ""
}

func arkStatus(status model.TaskStatus) string {
	switch status {
	case model.TaskStatusNotStart, model.TaskStatusSubmitted, model.TaskStatusQueued:
		return "queued"
	case model.TaskStatusInProgress:
		return "running"
	case model.TaskStatusSuccess:
		return "succeeded"
	case model.TaskStatusFailure:
		return "failed"
	default:
		return "unknown"
	}
}

func setMediaKitHeaders(req *http.Request, apiKey string) {
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)
}

func readUpstreamResponse(resp *http.Response) ([]byte, error) {
	defer func() {
		_ = resp.Body.Close()
	}()
	limited := io.LimitReader(resp.Body, maxUpstreamResponseSize+1)
	body, err := io.ReadAll(limited)
	if err != nil {
		return nil, err
	}
	if len(body) > maxUpstreamResponseSize {
		return nil, fmt.Errorf("upstream response exceeds %d bytes", maxUpstreamResponseSize)
	}
	return body, nil
}

func responseFromBytes(source *http.Response, body []byte) *http.Response {
	return &http.Response{
		Status:        source.Status,
		StatusCode:    source.StatusCode,
		Proto:         source.Proto,
		ProtoMajor:    source.ProtoMajor,
		ProtoMinor:    source.ProtoMinor,
		Header:        source.Header.Clone(),
		Body:          io.NopCloser(bytes.NewReader(body)),
		ContentLength: int64(len(body)),
		Request:       source.Request,
	}
}

func jsonResponse(status int, value any) (*http.Response, error) {
	body, err := common.Marshal(value)
	if err != nil {
		return nil, err
	}
	return &http.Response{
		Status:        fmt.Sprintf("%d %s", status, http.StatusText(status)),
		StatusCode:    status,
		Proto:         "HTTP/1.1",
		ProtoMajor:    1,
		ProtoMinor:    1,
		Header:        http.Header{"Content-Type": []string{"application/json"}},
		Body:          io.NopCloser(bytes.NewReader(body)),
		ContentLength: int64(len(body)),
	}, nil
}

func upstreamHTTPError(operation string, status int, body []byte) error {
	message := strings.TrimSpace(string(body))
	if len(message) > 512 {
		message = message[:512]
	}
	return fmt.Errorf("%s failed with HTTP %d: %s", operation, status, message)
}
