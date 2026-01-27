package vidu

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/pkg/errors"
)

// ============================
// Request / Response structures
// ============================

type requestPayload struct {
	Model             string    `json:"model"`
	Images            []string  `json:"images,omitempty"`
	Videos            []string  `json:"videos,omitempty"`
	Prompt            string    `json:"prompt,omitempty"`
	Duration          float64   `json:"duration,omitempty"`
	Seed              int       `json:"seed,omitempty"`
	Resolution        string    `json:"resolution,omitempty"`
	MovementAmplitude string    `json:"movement_amplitude,omitempty"`
	Bgm               bool      `json:"bgm,omitempty"`
	Payload           string    `json:"payload,omitempty"`
	CallbackUrl       string    `json:"callback_url,omitempty"`
	AspectRatio       string    `json:"aspect_ratio,omitempty"`
	Style             string    `json:"style,omitempty"`
	OffPeak           bool      `json:"off_peak,omitempty"`
	Audio             bool      `json:"audio,omitempty"`
	VoiceId           string    `json:"voice_id,omitempty"`
	IsRec             bool      `json:"is_rec,omitempty"`
	Subjects          []subject `json:"subjects,omitempty"`
	VideoCreationId   string    `json:"video_creation_id,omitempty"`
	VideoUrl          string    `json:"video_url,omitempty"`
	UpscaleResolution string    `json:"upscale_resolution,omitempty"`
	Language          string    `json:"language,omitempty"`
	RemoveAudio       bool           `json:"remove_audio,omitempty"`
	AudioUrl          string         `json:"audio_url,omitempty"`
	AddSubtitle       bool           `json:"add_subtitle,omitempty"`
	StartImage        string         `json:"start_image,omitempty"`
	ImageSettings     []imageSetting `json:"image_settings,omitempty"`
	Object            string         `json:"object,omitempty"`
	Image             string         `json:"image,omitempty"`
	StartFrom         int            `json:"start_from,omitempty"`
	// TTS fields
	Text                string  `json:"text,omitempty"`
	VoiceSettingVoiceId string  `json:"voice_setting_voice_id,omitempty"`
	VoiceSettingSpeed   float64 `json:"voice_setting_speed,omitempty"`
	VoiceSettingVolume  int     `json:"voice_setting_volume,omitempty"`
	VoiceSettingPitch   int     `json:"voice_setting_pitch,omitempty"`
	VoiceSettingEmotion string  `json:"voice_setting_emotion,omitempty"`
}

type imageSetting struct {
	KeyImage string `json:"key_image"`
	Prompt   string `json:"prompt,omitempty"`
	Duration int    `json:"duration,omitempty"`
}

type subject struct {
	ID     string   `json:"id"`
	Images []string `json:"images"`
}

type responsePayload struct {
	TaskId            string    `json:"task_id"`
	State             string    `json:"state"`
	Model             string    `json:"model"`
	Images            []string  `json:"images,omitempty"`
	Videos            []string  `json:"videos,omitempty"`
	Prompt            string    `json:"prompt"`
	Duration          float64   `json:"duration"`
	Seed              int       `json:"seed"`
	AspectRatio       string    `json:"aspect_ratio,omitempty"`
	Resolution        string    `json:"resolution"`
	Bgm               bool      `json:"bgm"`
	MovementAmplitude string    `json:"movement_amplitude"`
	Payload           string    `json:"payload"`
	Credits           int       `json:"credits"`
	CreatedAt         string    `json:"created_at"`
	Audio             bool      `json:"audio,omitempty"`
	VoiceId           string    `json:"voice_id,omitempty"`
	OffPeak           bool      `json:"off_peak,omitempty"`
	Style             string    `json:"style,omitempty"`
	Subjects          []subject `json:"subjects,omitempty"`
	VideoCreationId   string    `json:"video_creation_id,omitempty"`
	VideoUrl          string    `json:"video_url,omitempty"`
	UpscaleResolution string    `json:"upscale_resolution,omitempty"`
	Language          string    `json:"language,omitempty"`
	RemoveAudio       bool      `json:"remove_audio,omitempty"`
	Id                string    `json:"id,omitempty"` // For AI-MV
}

type taskResultResponse struct {
	State     string     `json:"state"`
	ErrCode   string     `json:"err_code"`
	Credits   int        `json:"credits"`
	Payload   string     `json:"payload"`
	Creations []creation `json:"creations"`
	FileUrl   string     `json:"file_url,omitempty"` // For TTS
}

type creation struct {
	ID       string `json:"id"`
	URL      string `json:"url"`
	CoverURL string `json:"cover_url"`
}

// ============================
// Adaptor implementation
// ============================

type TaskAdaptor struct {
	ChannelType int
	baseURL     string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	if err := relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate); err != nil {
		return err
	}
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return service.TaskErrorWrapper(err, "get_task_request_failed", http.StatusBadRequest)
	}
	action := constant.TaskActionTextGenerate
	if meatAction, ok := req.Metadata["action"]; ok {
		action, _ = meatAction.(string)
	} else if req.HasImage() {
		action = constant.TaskActionGenerate
		if info.ChannelType == constant.ChannelTypeVidu {
			// vidu 增加 首尾帧生视频和参考图生视频
			if len(req.Images) == 2 {
				action = constant.TaskActionFirstTailGenerate
			} else if len(req.Images) > 2 {
				action = constant.TaskActionReferenceGenerate
			}
		}
	} else if req.Model == "audio1.0" {
		action = constant.TaskActionText2Audio
	}
	info.Action = action
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	v, exists := c.Get("task_request")
	if !exists {
		return nil, fmt.Errorf("request not found in context")
	}
	req := v.(relaycommon.TaskSubmitReq)

	body, err := a.convertToRequestPayload(&req)
	if err != nil {
		return nil, err
	}

	if info.Action == constant.TaskActionReferenceGenerate {
		if strings.Contains(body.Model, "viduq2") {
			// 参考图生视频只能用 viduq2 模型, 不能带有pro或turbo后缀 https://platform.vidu.cn/docs/reference-to-video
			body.Model = "viduq2"
		}
	}

	data, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	var path string
	switch info.Action {
	case constant.TaskActionGenerate:
		path = "/img2video"
	case constant.TaskActionFirstTailGenerate:
		path = "/start-end2video"
	case constant.TaskActionReferenceGenerate:
		path = "/reference2video"
	case constant.TaskActionText2Audio:
		path = "/text2audio"
	case constant.TaskActionAudioTTS:
		path = "/audio-tts"
	case constant.TaskActionExtend:
		path = "/extend"
	case constant.TaskActionUpscale:
		path = "/upscale-new"
	case constant.TaskActionAdOneClick:
		path = "/ad-one-click"
	case constant.TaskActionTrendingReplicate:
		path = "/trending-replicate"
	case constant.TaskActionMV:
		path = "/one-click/mv"
	case constant.TaskActionMultiFrame:
		path = "/multiframe"
	case constant.TaskActionReplace:
		path = "/replace"
	default:
		path = "/text2video"
	}
	return fmt.Sprintf("%s/ent/v2%s", a.baseURL, path), nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Token "+info.ApiKey)
	return nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}

	var vResp responsePayload
	err = json.Unmarshal(responseBody, &vResp)
	if err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrap(err, fmt.Sprintf("%s", responseBody)), "unmarshal_response_failed", http.StatusInternalServerError)
		return
	}

	if vResp.State == "failed" {
		taskErr = service.TaskErrorWrapperLocal(fmt.Errorf("task failed"), "task_failed", http.StatusBadRequest)
		return
	}

	taskID = vResp.TaskId
	if taskID == "" {
		taskID = vResp.Id
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = taskID
	ov.TaskID = taskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName
	c.JSON(http.StatusOK, ov)
	return taskID, responseBody, nil
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	url := fmt.Sprintf("%s/ent/v2/tasks/%s/creations", baseUrl, taskID)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Token "+key)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) GetModelList() []string {
	return []string{
		"viduq2-pro-fast", "viduq2-turbo", "viduq2-pro", "viduq1", "viduq1-classic", "vidu2.0", "viduq2",
		"audio1.0",
	}
}

func (a *TaskAdaptor) GetChannelName() string {
	return "vidu"
}

// ============================
// helpers
// ============================

func (a *TaskAdaptor) convertToRequestPayload(req *relaycommon.TaskSubmitReq) (*requestPayload, error) {
	r := requestPayload{
		Model:             defaultString(req.Model, "viduq1"),
		Images:            req.Images,
		Prompt:            req.Prompt,
		Duration:          float64(defaultInt(req.Duration, 0)),
		Resolution:        defaultString(req.Size, "1080p"),
		MovementAmplitude: "auto",
		Bgm:               false,
	}
	if r.Duration == 0 {
		if req.Model == "audio1.0" {
			r.Duration = 10
		} else {
			r.Duration = 5
		}
	}
	metadata := req.Metadata
	medaBytes, err := json.Marshal(metadata)
	if err != nil {
		return nil, errors.Wrap(err, "metadata marshal metadata failed")
	}
	err = json.Unmarshal(medaBytes, &r)
	if err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata failed")
	}
	return &r, nil
}

func defaultString(value, defaultValue string) string {
	if value == "" {
		return defaultValue
	}
	return value
}

func defaultInt(value, defaultValue int) int {
	if value == 0 {
		return defaultValue
	}
	return value
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	taskInfo := &relaycommon.TaskInfo{}

	var taskResp taskResultResponse
	err := json.Unmarshal(respBody, &taskResp)
	if err != nil {
		return nil, errors.Wrap(err, "failed to unmarshal response body")
	}

	state := taskResp.State
	switch state {
	case "created", "queueing":
		taskInfo.Status = model.TaskStatusSubmitted
	case "processing":
		taskInfo.Status = model.TaskStatusInProgress
	case "success":
		taskInfo.Status = model.TaskStatusSuccess
		if len(taskResp.Creations) > 0 {
			taskInfo.Url = taskResp.Creations[0].URL
		} else if taskResp.FileUrl != "" {
			taskInfo.Url = taskResp.FileUrl
		}
	case "failed":
		taskInfo.Status = model.TaskStatusFailure
		if taskResp.ErrCode != "" {
			taskInfo.Reason = taskResp.ErrCode
		}
	default:
		return nil, fmt.Errorf("unknown task state: %s", state)
	}

	return taskInfo, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	var viduResp taskResultResponse
	if err := json.Unmarshal(originTask.Data, &viduResp); err != nil {
		return nil, errors.Wrap(err, "unmarshal vidu task data failed")
	}

	openAIVideo := dto.NewOpenAIVideo()
	openAIVideo.ID = originTask.TaskID
	openAIVideo.Status = originTask.Status.ToVideoStatus()
	openAIVideo.SetProgressStr(originTask.Progress)
	openAIVideo.CreatedAt = originTask.CreatedAt
	openAIVideo.CompletedAt = originTask.UpdatedAt

	if len(viduResp.Creations) > 0 && viduResp.Creations[0].URL != "" {
		openAIVideo.SetMetadata("url", viduResp.Creations[0].URL)
	} else if viduResp.FileUrl != "" {
		openAIVideo.SetMetadata("url", viduResp.FileUrl)
	}

	if viduResp.State == "failed" && viduResp.ErrCode != "" {
		openAIVideo.Error = &dto.OpenAIVideoError{
			Message: viduResp.ErrCode,
			Code:    viduResp.ErrCode,
		}
	}

	jsonData, _ := common.Marshal(openAIVideo)
	return jsonData, nil
}
