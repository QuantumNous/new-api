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
	Model             string         `json:"model"`
	Images            []string       `json:"images,omitempty"`
	Videos            []string       `json:"videos,omitempty"`
	Prompt            string         `json:"prompt,omitempty"`
	Duration          float64        `json:"duration,omitempty"`
	Seed              int            `json:"seed,omitempty"`
	Resolution        string         `json:"resolution,omitempty"`
	MovementAmplitude string         `json:"movement_amplitude,omitempty"`
	Bgm               bool           `json:"bgm,omitempty"`
	Payload           string         `json:"payload,omitempty"`
	CallbackUrl       string         `json:"callback_url,omitempty"`
	AspectRatio       string         `json:"aspect_ratio,omitempty"`
	Style             string         `json:"style,omitempty"`
	OffPeak           bool           `json:"off_peak,omitempty"`
	Audio             bool           `json:"audio,omitempty"`
	VoiceId           string         `json:"voice_id,omitempty"`
	IsRec             bool           `json:"is_rec,omitempty"`
	Subjects          []subject      `json:"subjects,omitempty"`
	VideoCreationId   string         `json:"video_creation_id,omitempty"`
	VideoUrl          string         `json:"video_url,omitempty"`
	UpscaleResolution string         `json:"upscale_resolution,omitempty"`
	Language          string         `json:"language,omitempty"`
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

	// 动态计费
	if info.ChannelType == constant.ChannelTypeVidu {
		if info.PriceData.OtherRatios == nil {
			info.PriceData.OtherRatios = make(map[string]float64)
		}

		credits := 0
		duration := req.Duration
		if duration == 0 {
			if req.Model == "audio1.0" {
				duration = 10
			} else {
				duration = 4
			}
		}

		resolution := req.Size
		if resolution == "" {
			resolution = "1080p" // Default fallback
		}

		// 简单的分辨率归一化
		is540 := strings.Contains(resolution, "540")
		is720 := strings.Contains(resolution, "720")
		is1080 := strings.Contains(resolution, "1080")

		// 判定任务类型
		isImg2Vid := action == constant.TaskActionGenerate || action == constant.TaskActionFirstTailGenerate
		isRef2Vid := action == constant.TaskActionReferenceGenerate
		isText2Vid := action == constant.TaskActionTextGenerate

		// ------ Vidu Q2 Series (Dynamic) ------
		if strings.Contains(req.Model, "viduq2") {
			base := 0
			inc := 0

			if strings.Contains(req.Model, "turbo") {
				// Q2-turbo
				if is1080 {
					base = 35
					inc = 10
				} else if is720 {
					base = 8
					inc = 10
				} else { // 540p
					base = 6
					inc = 2
				}
			} else if strings.Contains(req.Model, "pro-fast") {
				// Q2-pro-fast (Usually 720P/1080P)
				if is1080 {
					base = 16
					inc = 4
				} else {
					// 720P default
					base = 8
					inc = 2
				}
			} else if strings.Contains(req.Model, "pro") {
				// Q2-pro
				if isRef2Vid {
					// Ref2Vid Q2-Pro
					if is1080 {
						base = 85
						inc = 10
					} else if is720 {
						base = 30
						inc = 5
					} else {
						base = 20
						inc = 5
					}
				} else {
					// Img2Vid / Text2Vid Q2-Pro
					if is1080 {
						base = 55
						inc = 15
					} else if is720 {
						base = 15
						inc = 10
					} else {
						base = 8
						inc = 5
					}
				}
			} else {
				// Q2 Standard
				if isRef2Vid {
					if is1080 {
						base = 75
						inc = 10
					} else if is720 {
						base = 25
						inc = 5
					} else {
						base = 15
						inc = 5
					}
				} else if isText2Vid {
					if is1080 {
						base = 20
						inc = 10
					} else if is720 {
						base = 15
						inc = 5
					} else {
						base = 10
						inc = 2
					}
				} else {
					// Default / Img2Vid ? logic not explicitly in summary provided but assuming similar to Text2Vid or based on standard Q2 table
					// Using Text2Vid values as safe fallback or specific Img2Vid logic if found
					if is1080 {
						base = 20
						inc = 10
					} else if is720 {
						base = 15
						inc = 5
					} else {
						base = 10
						inc = 2
					}
				}
			}

			// Calculation: Base + (Duration-1)*Inc
			if duration < 1 {
				duration = 1
			}
			credits = base + (duration-1)*inc

		} else {
			// ------ Vidu 2.0 / Legacy Fixed Pricing ------
			// Vidu 2.0 / 1.5 logic (4s / 8s fixed)

			if isRef2Vid {
				// Reference to Video
				if duration > 5 { // ~8s
					if is1080 {
						credits = 400
					} else {
						credits = 200
					}
				} else { // ~4s
					if is1080 {
						credits = 160
					} else {
						credits = 80
					}
				}
			} else {
				// Text/Image to Video
				if duration > 5 { // ~8s
					credits = 100 // 8s usually 100 for 720P/1080P
				} else { // ~4s
					if is1080 {
						credits = 100
					} else if is720 {
						credits = 40
					} else {
						credits = 20
					}
				}
			}
		}

		// 音效加价 (audio=true) -> +15 credits (Only for Img2Vid / Ref2Vid)
		// Assuming 'bgm' or 'audio' field in request triggers this
		// 暂不处理复杂的 audio 字段判断，如果需要可在此添加

		// Upscale 逻辑 (暂略，如果 action 是 upscale 需要单独处理)

		// Final Result stored in OtherRatios
		// 我们假设系统配置该模型的 modelPrice = $0.005 (即 1 credit 的价格)
		// 那么 OtherRatios["credits"] = calculated_credits 即可
		info.PriceData.OtherRatios["vidu_credits"] = float64(credits)
	}

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
