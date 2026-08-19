package ali

import (
	"bytes"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	taskdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/samber/lo"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

// ============================
// Request / Response structures
// ============================

// AliVideoRequest 阿里通义万相视频生成请求
type AliVideoRequest struct {
	Model      string              `json:"model"`
	Input      AliVideoInput       `json:"input"`
	Parameters *AliVideoParameters `json:"parameters,omitempty"`
}

// AliVideoMedia describes Wan2.7 image-to-video media inputs.
type AliVideoMedia struct {
	Type string `json:"type"`
	URL  string `json:"url"`
}

// AliVideoInput 视频输入参数
type AliVideoInput struct {
	Prompt         string          `json:"prompt,omitempty"`          // 文本提示词
	ImgURL         string          `json:"img_url,omitempty"`         // 首帧图像URL或Base64（图生视频）
	FirstFrameURL  string          `json:"first_frame_url,omitempty"` // 首帧图片URL（首尾帧生视频）
	LastFrameURL   string          `json:"last_frame_url,omitempty"`  // 尾帧图片URL（首尾帧生视频）
	AudioURL       string          `json:"audio_url,omitempty"`       // 音频URL（wan2.5支持）
	Media          []AliVideoMedia `json:"media,omitempty"`           // 媒体列表（wan2.7-i2v新协议）
	NegativePrompt string          `json:"negative_prompt,omitempty"` // 反向提示词
	Template       string          `json:"template,omitempty"`        // 视频特效模板
}

// AliVideoParameters 视频参数
type AliVideoParameters struct {
	Resolution   string  `json:"resolution,omitempty"`    // 分辨率: 480P/720P/1080P（图生视频、首尾帧生视频）
	Size         string  `json:"size,omitempty"`          // 尺寸: 如 "832*480"（文生视频）
	Duration     int     `json:"duration,omitempty"`      // 时长: 3-15秒
	Ratio        *string `json:"ratio,omitempty"`         // HappyHorse 输出画幅
	PromptExtend *bool   `json:"prompt_extend,omitempty"` // 是否开启prompt智能改写
	Watermark    *bool   `json:"watermark,omitempty"`     // 是否添加水印
	Audio        *bool   `json:"audio,omitempty"`         // 是否添加音频（wan2.5）
	AudioSetting *string `json:"audio_setting,omitempty"` // HappyHorse 视频编辑声音控制
	Seed         *int    `json:"seed,omitempty"`          // 随机数种子
}

// AliVideoResponse 阿里通义万相响应
type AliVideoResponse struct {
	Output    AliVideoOutput `json:"output"`
	RequestID string         `json:"request_id"`
	Code      string         `json:"code,omitempty"`
	Message   string         `json:"message,omitempty"`
	Usage     *AliUsage      `json:"usage,omitempty"`
}

// AliVideoOutput 输出信息
type AliVideoOutput struct {
	TaskID        string `json:"task_id"`
	TaskStatus    string `json:"task_status"`
	SubmitTime    string `json:"submit_time,omitempty"`
	ScheduledTime string `json:"scheduled_time,omitempty"`
	EndTime       string `json:"end_time,omitempty"`
	OrigPrompt    string `json:"orig_prompt,omitempty"`
	ActualPrompt  string `json:"actual_prompt,omitempty"`
	VideoURL      string `json:"video_url,omitempty"`
	Code          string `json:"code,omitempty"`
	Message       string `json:"message,omitempty"`
}

// AliUsage 使用统计
type AliUsage struct {
	Duration            dto.StringValue `json:"duration,omitempty"`
	InputVideoDuration  dto.StringValue `json:"input_video_duration,omitempty"`
	OutputVideoDuration dto.StringValue `json:"output_video_duration,omitempty"`
	VideoCount          dto.IntValue    `json:"video_count,omitempty"`
	SR                  dto.IntValue    `json:"SR,omitempty"`
}

type AliMetadata struct {
	// Input 相关
	AudioURL       string          `json:"audio_url,omitempty"`       // 音频URL
	ImgURL         string          `json:"img_url,omitempty"`         // 图片URL（图生视频）
	FirstFrameURL  string          `json:"first_frame_url,omitempty"` // 首帧图片URL（首尾帧生视频）
	LastFrameURL   string          `json:"last_frame_url,omitempty"`  // 尾帧图片URL（首尾帧生视频）
	Media          []AliVideoMedia `json:"media,omitempty"`           // 媒体列表（wan2.7-i2v新协议）
	NegativePrompt string          `json:"negative_prompt,omitempty"` // 反向提示词
	Template       string          `json:"template,omitempty"`        // 视频特效模板

	// Parameters 相关
	Resolution   *string `json:"resolution,omitempty"`    // 分辨率: 480P/720P/1080P
	Size         *string `json:"size,omitempty"`          // 尺寸: 如 "832*480"
	Duration     *int    `json:"duration,omitempty"`      // 时长
	Ratio        *string `json:"ratio,omitempty"`         // HappyHorse 输出画幅
	PromptExtend *bool   `json:"prompt_extend,omitempty"` // 是否开启prompt智能改写
	Watermark    *bool   `json:"watermark,omitempty"`     // 是否添加水印
	Audio        *bool   `json:"audio,omitempty"`         // 是否添加音频
	AudioSetting *string `json:"audio_setting,omitempty"` // HappyHorse 视频编辑声音控制
	Seed         *int    `json:"seed,omitempty"`          // 随机数种子
}

// ============================
// Adaptor implementation
// ============================

type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	apiKey      string
	baseURL     string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) (taskErr *taskdto.TaskError) {
	// ValidateMultipartDirect 负责解析并将原始 TaskSubmitReq 存入 context
	if taskErr := relaycommon.ValidateMultipartDirect(c, info); taskErr != nil {
		return taskErr
	}
	taskReq, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	modelName := taskReq.Model
	if info.IsModelMapped {
		modelName = info.UpstreamModelName
	}
	if !isHappyHorseModel(modelName) {
		return nil
	}
	if _, err := a.convertToAliRequest(info, taskReq); err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	return nil
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s/api/v1/services/aigc/video-generation/video-synthesis", a.baseURL), nil
}

// BuildRequestHeader sets required headers for Ali API
func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-DashScope-Async", "enable") // 阿里异步任务必须设置
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	taskReq, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, errors.Wrap(err, "get_task_request_failed")
	}

	aliReq, err := a.convertToAliRequest(info, taskReq)
	if err != nil {
		return nil, errors.Wrap(err, "convert_to_ali_request_failed")
	}
	logger.LogJson(c, "ali video request body", aliReq)

	bodyBytes, err := common.Marshal(aliReq)
	if err != nil {
		return nil, errors.Wrap(err, "marshal_ali_request_failed")
	}
	return bytes.NewReader(bodyBytes), nil
}

var (
	size480p = []string{
		"832*480",
		"480*832",
		"624*624",
	}
	size720p = []string{
		"1280*720",
		"720*1280",
		"960*960",
		"1088*832",
		"832*1088",
	}
	size1080p = []string{
		"1920*1080",
		"1080*1920",
		"1440*1440",
		"1632*1248",
		"1248*1632",
	}
)

const (
	happyHorseMinDurationSeconds     = 3
	happyHorseMaxDurationSeconds     = 15
	happyHorseEditPrechargeSeconds   = 30
	happyHorseMaxReferenceImages     = 9
	happyHorseMaxEditReferenceImages = 5
)

var happyHorseRatios = map[string]struct{}{
	"16:9": {},
	"9:16": {},
	"1:1":  {},
	"4:3":  {},
	"3:4":  {},
	"4:5":  {},
	"5:4":  {},
	"9:21": {},
	"21:9": {},
}

func boolPtr(value bool) *bool {
	return &value
}

func isHappyHorseModel(model string) bool {
	return strings.HasPrefix(model, "happyhorse-1.1-") || strings.HasPrefix(model, "happyhorse-1.0-")
}

func isHappyHorse11Model(model string) bool {
	return strings.HasPrefix(model, "happyhorse-1.1-")
}

func isHappyHorseI2VModel(model string) bool {
	return strings.HasSuffix(model, "-i2v")
}

func isHappyHorseR2VModel(model string) bool {
	return strings.HasSuffix(model, "-r2v")
}

func isHappyHorseT2VModel(model string) bool {
	return strings.HasSuffix(model, "-t2v")
}

func isHappyHorseVideoEditModel(model string) bool {
	return model == "happyhorse-1.0-video-edit"
}

func normalizeHappyHorseResolution(value string) (string, error) {
	resolution := strings.ToUpper(strings.TrimSpace(value))
	if resolution == "" {
		return "", nil
	}
	if strings.ContainsAny(resolution, "*X") {
		resolution = strings.ReplaceAll(resolution, "X", "*")
		return sizeToResolution(resolution)
	}
	if !strings.HasSuffix(resolution, "P") {
		resolution += "P"
	}
	switch resolution {
	case "480P", "720P", "1080P":
		return resolution, nil
	default:
		return "", fmt.Errorf("invalid HappyHorse resolution: %s", value)
	}
}

func validateHappyHorseResolution(model, resolution string) error {
	if resolution == "" {
		return fmt.Errorf("HappyHorse resolution is required")
	}
	if resolution != "720P" && resolution != "1080P" {
		return fmt.Errorf("%s only supports 720P and 1080P", model)
	}
	return nil
}

func appendUniqueURL(urls []string, seen map[string]struct{}, value string) []string {
	value = strings.TrimSpace(value)
	if value == "" {
		return urls
	}
	if _, ok := seen[value]; ok {
		return urls
	}
	seen[value] = struct{}{}
	return append(urls, value)
}

func taskReferenceImages(req relaycommon.TaskSubmitReq, excludedURL string) []string {
	seen := make(map[string]struct{})
	if excludedURL != "" {
		seen[strings.TrimSpace(excludedURL)] = struct{}{}
	}
	urls := make([]string, 0, len(req.Images)+2)
	urls = appendUniqueURL(urls, seen, req.Image)
	for _, image := range req.Images {
		urls = appendUniqueURL(urls, seen, image)
	}
	urls = appendUniqueURL(urls, seen, req.InputReference)
	return urls
}

func validateHappyHorseMedia(model string, media []AliVideoMedia) error {
	switch {
	case isHappyHorseT2VModel(model):
		if len(media) != 0 {
			return fmt.Errorf("%s does not accept input media", model)
		}
	case isHappyHorseI2VModel(model):
		if len(media) != 1 || media[0].Type != "first_frame" || strings.TrimSpace(media[0].URL) == "" {
			return fmt.Errorf("%s requires exactly one first_frame media item", model)
		}
	case isHappyHorseR2VModel(model):
		if len(media) < 1 || len(media) > happyHorseMaxReferenceImages {
			return fmt.Errorf("%s requires 1-%d reference_image items", model, happyHorseMaxReferenceImages)
		}
		for _, item := range media {
			if item.Type != "reference_image" || strings.TrimSpace(item.URL) == "" {
				return fmt.Errorf("%s only accepts non-empty reference_image items", model)
			}
		}
	case isHappyHorseVideoEditModel(model):
		videoCount := 0
		referenceCount := 0
		for _, item := range media {
			if strings.TrimSpace(item.URL) == "" {
				return fmt.Errorf("%s media URL cannot be empty", model)
			}
			switch item.Type {
			case "video":
				videoCount++
			case "reference_image":
				referenceCount++
			default:
				return fmt.Errorf("%s only accepts video and reference_image media", model)
			}
		}
		if videoCount != 1 || referenceCount > happyHorseMaxEditReferenceImages {
			return fmt.Errorf("%s requires one video and at most %d reference_image items", model, happyHorseMaxEditReferenceImages)
		}
	default:
		return fmt.Errorf("unsupported HappyHorse model: %s", model)
	}
	return nil
}

func normalizeHappyHorseInput(aliReq *AliVideoRequest, req relaycommon.TaskSubmitReq) error {
	model := aliReq.Model
	if !isHappyHorseModel(model) {
		return nil
	}

	if len(aliReq.Input.Media) == 0 {
		switch {
		case isHappyHorseT2VModel(model):
			if firstTaskImage(req) != "" || aliReq.Input.FirstFrameURL != "" || aliReq.Input.LastFrameURL != "" {
				return fmt.Errorf("%s does not accept input media", model)
			}
		case isHappyHorseI2VModel(model):
			images := taskReferenceImages(req, "")
			if len(images) != 1 {
				return fmt.Errorf("%s requires exactly one input image", model)
			}
			aliReq.Input.Media = []AliVideoMedia{{Type: "first_frame", URL: images[0]}}
		case isHappyHorseR2VModel(model):
			for _, image := range taskReferenceImages(req, "") {
				aliReq.Input.Media = append(aliReq.Input.Media, AliVideoMedia{Type: "reference_image", URL: image})
			}
		case isHappyHorseVideoEditModel(model):
			videoURL := strings.TrimSpace(req.InputReference)
			if videoURL != "" {
				aliReq.Input.Media = append(aliReq.Input.Media, AliVideoMedia{Type: "video", URL: videoURL})
			}
			for _, image := range taskReferenceImages(req, videoURL) {
				aliReq.Input.Media = append(aliReq.Input.Media, AliVideoMedia{Type: "reference_image", URL: image})
			}
		}
	}

	if err := validateHappyHorseMedia(model, aliReq.Input.Media); err != nil {
		return err
	}
	aliReq.Input.ImgURL = ""
	aliReq.Input.FirstFrameURL = ""
	aliReq.Input.LastFrameURL = ""
	aliReq.Input.AudioURL = ""
	return nil
}

func validateHappyHorseParameters(aliReq *AliVideoRequest) error {
	if aliReq.Parameters == nil {
		return fmt.Errorf("HappyHorse parameters cannot be null")
	}
	model := aliReq.Model
	if aliReq.Parameters.Size != "" {
		return fmt.Errorf("%s does not accept parameters.size; use resolution", model)
	}
	if aliReq.Parameters.PromptExtend != nil || aliReq.Parameters.Audio != nil {
		return fmt.Errorf("%s received unsupported parameters", model)
	}
	if aliReq.Parameters.Seed != nil && (*aliReq.Parameters.Seed < 0 || *aliReq.Parameters.Seed > common.MaxQuota) {
		return fmt.Errorf("HappyHorse seed must be between 0 and 2147483647")
	}
	resolution, err := normalizeHappyHorseResolution(aliReq.Parameters.Resolution)
	if err != nil {
		return err
	}
	if err := validateHappyHorseResolution(model, resolution); err != nil {
		return err
	}
	aliReq.Parameters.Resolution = resolution
	aliReq.Parameters.Size = ""

	if aliReq.Parameters.Ratio != nil {
		ratio := strings.TrimSpace(*aliReq.Parameters.Ratio)
		if _, ok := happyHorseRatios[ratio]; !ok {
			return fmt.Errorf("invalid HappyHorse ratio: %s", ratio)
		}
		if isHappyHorseI2VModel(model) || isHappyHorseVideoEditModel(model) {
			return fmt.Errorf("%s does not accept ratio", model)
		}
		aliReq.Parameters.Ratio = &ratio
	}

	if isHappyHorseVideoEditModel(model) {
		aliReq.Parameters.Duration = 0
		if aliReq.Parameters.AudioSetting != nil {
			audioSetting := strings.ToLower(strings.TrimSpace(*aliReq.Parameters.AudioSetting))
			if audioSetting != "auto" && audioSetting != "origin" {
				return fmt.Errorf("invalid HappyHorse audio_setting: %s", audioSetting)
			}
			aliReq.Parameters.AudioSetting = &audioSetting
		}
		return nil
	}

	if aliReq.Parameters.AudioSetting != nil {
		return fmt.Errorf("%s does not accept audio_setting", model)
	}
	if aliReq.Parameters.Duration < happyHorseMinDurationSeconds || aliReq.Parameters.Duration > happyHorseMaxDurationSeconds {
		return fmt.Errorf("%s duration must be between %d and %d seconds", model, happyHorseMinDurationSeconds, happyHorseMaxDurationSeconds)
	}
	return nil
}

func sizeToResolution(size string) (string, error) {
	if lo.Contains(size480p, size) {
		return "480P", nil
	} else if lo.Contains(size720p, size) {
		return "720P", nil
	} else if lo.Contains(size1080p, size) {
		return "1080P", nil
	}
	return "", fmt.Errorf("invalid size: %s", size)
}

func ProcessAliOtherRatios(aliReq *AliVideoRequest) (map[string]float64, error) {
	otherRatios := make(map[string]float64)
	if aliReq == nil || aliReq.Parameters == nil {
		return otherRatios, fmt.Errorf("Ali video parameters are required")
	}
	aliRatios := map[string]map[string]float64{
		"happyhorse-1.1-t2v": {
			"720P":  1,
			"1080P": 4.0 / 3.0,
		},
		"happyhorse-1.1-i2v": {
			"720P":  1,
			"1080P": 4.0 / 3.0,
		},
		"happyhorse-1.1-r2v": {
			"720P":  1,
			"1080P": 4.0 / 3.0,
		},
		"happyhorse-1.0-t2v": {
			"720P":  1,
			"1080P": 16.0 / 9.0,
		},
		"happyhorse-1.0-i2v": {
			"720P":  1,
			"1080P": 16.0 / 9.0,
		},
		"happyhorse-1.0-r2v": {
			"720P":  1,
			"1080P": 16.0 / 9.0,
		},
		"happyhorse-1.0-video-edit": {
			"720P":  1,
			"1080P": 16.0 / 9.0,
		},
		"wan2.6-i2v": {
			"720P":  1,
			"1080P": 1 / 0.6,
		},
		"wan2.5-t2v-preview": {
			"480P":  1,
			"720P":  2,
			"1080P": 1 / 0.3,
		},
		"wan2.2-t2v-plus": {
			"480P":  1,
			"1080P": 0.7 / 0.14,
		},
		"wan2.5-i2v-preview": {
			"480P":  1,
			"720P":  2,
			"1080P": 1 / 0.3,
		},
		"wan2.2-i2v-plus": {
			"480P":  1,
			"1080P": 0.7 / 0.14,
		},
		"wan2.2-kf2v-flash": {
			"480P":  1,
			"720P":  2,
			"1080P": 4.8,
		},
		"wan2.2-i2v-flash": {
			"480P": 1,
			"720P": 2,
		},
		"wan2.2-s2v": {
			"480P": 1,
			"720P": 0.9 / 0.5,
		},
	}
	var resolution string

	// size match
	if aliReq.Parameters.Size != "" {
		toResolution, err := sizeToResolution(aliReq.Parameters.Size)
		if err != nil {
			return nil, err
		}
		resolution = toResolution
	} else {
		resolution = strings.ToUpper(aliReq.Parameters.Resolution)
		if !strings.HasSuffix(resolution, "P") {
			resolution = resolution + "P"
		}
	}
	if otherRatio, ok := aliRatios[aliReq.Model]; ok {
		if ratio, ok := otherRatio[resolution]; ok {
			otherRatios[fmt.Sprintf("resolution-%s", resolution)] = ratio
		}
	}
	return otherRatios, nil
}

func isWan27I2VModel(model string) bool {
	return strings.HasPrefix(model, "wan2.7-i2v")
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func firstTaskImage(req relaycommon.TaskSubmitReq) string {
	if image := strings.TrimSpace(req.Image); image != "" {
		return image
	}
	for _, image := range req.Images {
		if trimmed := strings.TrimSpace(image); trimmed != "" {
			return trimmed
		}
	}
	if inputReference := strings.TrimSpace(req.InputReference); inputReference != "" {
		return inputReference
	}
	return ""
}

func secondTaskImage(req relaycommon.TaskSubmitReq) string {
	nonEmptyImages := 0
	for _, image := range req.Images {
		trimmed := strings.TrimSpace(image)
		if trimmed == "" {
			continue
		}
		nonEmptyImages++
		if nonEmptyImages == 2 {
			return trimmed
		}
	}
	return ""
}

func normalizeWan27I2VInput(aliReq *AliVideoRequest, req relaycommon.TaskSubmitReq) error {
	if !isWan27I2VModel(aliReq.Model) {
		return nil
	}

	if len(aliReq.Input.Media) == 0 {
		firstFrameURL := firstNonEmpty(aliReq.Input.FirstFrameURL, aliReq.Input.ImgURL, firstTaskImage(req))
		lastFrameURL := firstNonEmpty(aliReq.Input.LastFrameURL, secondTaskImage(req))
		audioURL := aliReq.Input.AudioURL

		if firstFrameURL != "" {
			aliReq.Input.Media = append(aliReq.Input.Media, AliVideoMedia{
				Type: "first_frame",
				URL:  firstFrameURL,
			})
		}
		if lastFrameURL != "" {
			aliReq.Input.Media = append(aliReq.Input.Media, AliVideoMedia{
				Type: "last_frame",
				URL:  lastFrameURL,
			})
		}
		if audioURL != "" {
			aliReq.Input.Media = append(aliReq.Input.Media, AliVideoMedia{
				Type: "driving_audio",
				URL:  audioURL,
			})
		}
	}

	if len(aliReq.Input.Media) == 0 {
		return fmt.Errorf("wan2.7-i2v requires image, images, input_reference, or input.media")
	}

	// Wan2.7 image-to-video uses the new input.media protocol. Avoid sending
	// legacy fields that belong to wan2.6 and earlier image-to-video APIs.
	aliReq.Input.ImgURL = ""
	aliReq.Input.FirstFrameURL = ""
	aliReq.Input.LastFrameURL = ""
	aliReq.Input.AudioURL = ""
	return nil
}

func applyFlatAliMetadata(aliReq *AliVideoRequest, metadata AliMetadata) {
	if metadata.AudioURL != "" {
		aliReq.Input.AudioURL = metadata.AudioURL
	}
	if metadata.ImgURL != "" {
		aliReq.Input.ImgURL = metadata.ImgURL
	}
	if metadata.FirstFrameURL != "" {
		aliReq.Input.FirstFrameURL = metadata.FirstFrameURL
	}
	if metadata.LastFrameURL != "" {
		aliReq.Input.LastFrameURL = metadata.LastFrameURL
	}
	if metadata.Media != nil {
		aliReq.Input.Media = metadata.Media
	}
	if metadata.NegativePrompt != "" {
		aliReq.Input.NegativePrompt = metadata.NegativePrompt
	}
	if metadata.Template != "" {
		aliReq.Input.Template = metadata.Template
	}

	if metadata.Resolution != nil {
		aliReq.Parameters.Resolution = *metadata.Resolution
	}
	if metadata.Size != nil {
		aliReq.Parameters.Size = *metadata.Size
	}
	if metadata.Duration != nil {
		aliReq.Parameters.Duration = *metadata.Duration
	}
	if metadata.Ratio != nil {
		aliReq.Parameters.Ratio = metadata.Ratio
	}
	if metadata.PromptExtend != nil {
		aliReq.Parameters.PromptExtend = metadata.PromptExtend
	}
	if metadata.Watermark != nil {
		aliReq.Parameters.Watermark = metadata.Watermark
	}
	if metadata.Audio != nil {
		aliReq.Parameters.Audio = metadata.Audio
	}
	if metadata.AudioSetting != nil {
		aliReq.Parameters.AudioSetting = metadata.AudioSetting
	}
	if metadata.Seed != nil {
		aliReq.Parameters.Seed = metadata.Seed
	}
}

func (a *TaskAdaptor) convertToAliRequest(info *relaycommon.RelayInfo, req relaycommon.TaskSubmitReq) (*AliVideoRequest, error) {
	upstreamModel := req.Model
	if info.IsModelMapped {
		upstreamModel = info.UpstreamModelName
	}
	aliReq := &AliVideoRequest{
		Model: upstreamModel,
		Input: AliVideoInput{
			Prompt: req.Prompt,
			ImgURL: firstTaskImage(req),
		},
		Parameters: &AliVideoParameters{
			PromptExtend: boolPtr(true), // 万相默认开启智能改写
		},
	}

	// 处理分辨率映射
	if isHappyHorseModel(upstreamModel) {
		resolution := "1080P"
		if req.Size != "" {
			var err error
			resolution, err = normalizeHappyHorseResolution(req.Size)
			if err != nil {
				return nil, err
			}
		}
		aliReq.Parameters.Resolution = resolution
		// HappyHorse API 没有 prompt_extend 参数。
		aliReq.Parameters.PromptExtend = nil
	} else if req.Size != "" {
		// text to video size must be contained *
		if strings.Contains(upstreamModel, "t2v") && !strings.Contains(req.Size, "*") {
			return nil, fmt.Errorf("invalid size: %s, example: %s", req.Size, "1920*1080")
		}
		if strings.Contains(req.Size, "*") {
			aliReq.Parameters.Size = req.Size
		} else {
			resolution := strings.ToUpper(req.Size)
			// 支持 480p, 720p, 1080p 或 480P, 720P, 1080P
			if !strings.HasSuffix(resolution, "P") {
				resolution = resolution + "P"
			}
			aliReq.Parameters.Resolution = resolution
		}
	} else {
		// 根据模型设置默认分辨率
		if strings.Contains(upstreamModel, "t2v") { // text to video
			if strings.HasPrefix(upstreamModel, "wan2.5") {
				aliReq.Parameters.Size = "1920*1080"
			} else if strings.HasPrefix(upstreamModel, "wan2.2") {
				aliReq.Parameters.Size = "1920*1080"
			} else {
				aliReq.Parameters.Size = "1280*720"
			}
		} else {
			if strings.HasPrefix(upstreamModel, "wan2.6") {
				aliReq.Parameters.Resolution = "1080P"
			} else if strings.HasPrefix(upstreamModel, "wan2.5") {
				aliReq.Parameters.Resolution = "1080P"
			} else if strings.HasPrefix(upstreamModel, "wan2.2-i2v-flash") {
				aliReq.Parameters.Resolution = "720P"
			} else if strings.HasPrefix(upstreamModel, "wan2.2-i2v-plus") {
				aliReq.Parameters.Resolution = "1080P"
			} else {
				aliReq.Parameters.Resolution = "720P"
			}
		}
	}

	// 处理时长
	if req.Duration > 0 {
		aliReq.Parameters.Duration = req.Duration
	} else if req.Seconds != "" {
		seconds, err := strconv.Atoi(req.Seconds)
		if err != nil {
			return nil, errors.Wrap(err, "convert seconds to int failed")
		} else {
			aliReq.Parameters.Duration = seconds
		}
	}
	if aliReq.Parameters.Duration <= 0 && !isHappyHorseVideoEditModel(upstreamModel) {
		aliReq.Parameters.Duration = 5 // 默认5秒
	}

	// 从 metadata 中提取额外参数
	if req.Metadata != nil {
		if metadataBytes, err := common.Marshal(req.Metadata); err == nil {
			var flatMetadata AliMetadata
			if err := common.Unmarshal(metadataBytes, &flatMetadata); err != nil {
				return nil, errors.Wrap(err, "unmarshal flat metadata failed")
			}
			applyFlatAliMetadata(aliReq, flatMetadata)
			// Nested input/parameters follows the upstream shape and takes
			// precedence when callers provide both metadata styles.
			err = common.Unmarshal(metadataBytes, aliReq)
			if err != nil {
				return nil, errors.Wrap(err, "unmarshal metadata failed")
			}
		} else {
			return nil, errors.Wrap(err, "marshal metadata failed")
		}
	}

	if aliReq.Model != upstreamModel {
		return nil, errors.New("can't change model with metadata")
	}

	if isHappyHorseModel(aliReq.Model) {
		if err := normalizeHappyHorseInput(aliReq, req); err != nil {
			return nil, err
		}
		if err := validateHappyHorseParameters(aliReq); err != nil {
			return nil, err
		}
	} else {
		if err := normalizeWan27I2VInput(aliReq, req); err != nil {
			return nil, err
		}
	}

	return aliReq, nil
}

// EstimateBilling 根据用户请求参数计算 OtherRatios（时长、分辨率等）。
// 在 ValidateRequestAndSetAction 之后、价格计算之前调用。
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	taskReq, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}

	aliReq, err := a.convertToAliRequest(info, taskReq)
	if err != nil {
		return nil
	}

	// metadata can override Duration past standard request validation;
	// cap it because it is used as a billing multiplier.
	seconds := aliReq.Parameters.Duration
	if isHappyHorseVideoEditModel(aliReq.Model) {
		// 编辑任务按输入和输出总秒数计费。提交时未知，按两个 15 秒上限预扣，
		// 成功轮询后再用 usage.duration 做差额结算。
		seconds = happyHorseEditPrechargeSeconds
	}
	otherRatios := map[string]float64{
		"seconds": float64(min(seconds, relaycommon.MaxTaskDurationSeconds)),
	}
	ratios, err := ProcessAliOtherRatios(aliReq)
	if err != nil {
		return otherRatios
	}
	for k, v := range ratios {
		otherRatios[k] = v
	}
	return otherRatios
}

func parseAliUsageSeconds(value dto.StringValue) float64 {
	seconds, err := strconv.ParseFloat(strings.TrimSpace(string(value)), 64)
	if err != nil || seconds <= 0 || math.IsNaN(seconds) || math.IsInf(seconds, 0) {
		return 0
	}
	return seconds
}

func happyHorseBillableSeconds(modelName string, usage *AliUsage) float64 {
	if usage == nil {
		return 0
	}
	seconds := parseAliUsageSeconds(usage.Duration)
	maxSeconds := float64(happyHorseMaxDurationSeconds)
	if isHappyHorseVideoEditModel(modelName) {
		maxSeconds = float64(happyHorseEditPrechargeSeconds)
		if seconds <= 0 {
			seconds = parseAliUsageSeconds(usage.InputVideoDuration) + parseAliUsageSeconds(usage.OutputVideoDuration)
		}
	} else if seconds <= 0 {
		seconds = parseAliUsageSeconds(usage.OutputVideoDuration)
	}
	return min(seconds, maxSeconds)
}

func happyHorseResolutionRatio(modelName string, sr int) (string, float64, bool) {
	resolution := fmt.Sprintf("%dP", sr)
	if isHappyHorse11Model(modelName) {
		switch sr {
		case 720:
			return resolution, 1, true
		case 1080:
			return resolution, 4.0 / 3.0, true
		}
	} else {
		switch sr {
		case 720:
			return resolution, 1, true
		case 1080:
			return resolution, 16.0 / 9.0, true
		}
	}
	return "", 0, false
}

func happyHorseTaskModelName(task *model.Task) string {
	if task.Properties.UpstreamModelName != "" {
		return task.Properties.UpstreamModelName
	}
	if task.Properties.OriginModelName != "" {
		return task.Properties.OriginModelName
	}
	if billingContext := task.PrivateData.BillingContext; billingContext != nil {
		return billingContext.OriginModelName
	}
	return ""
}

// AdjustBillingOnComplete replaces the conservative request-time seconds and
// resolution multipliers with the successful task's authoritative usage.
func (a *TaskAdaptor) AdjustBillingOnComplete(task *model.Task, taskResult *relaycommon.TaskInfo) int {
	if task == nil || taskResult == nil || taskResult.Status != model.TaskStatusSuccess {
		return 0
	}
	modelName := happyHorseTaskModelName(task)
	if !isHappyHorseModel(modelName) {
		return 0
	}
	billingContext := task.PrivateData.BillingContext
	if billingContext == nil || billingContext.GroupRatio <= 0 {
		return 0
	}

	var response AliVideoResponse
	if err := common.Unmarshal(task.Data, &response); err != nil {
		return 0
	}
	seconds := happyHorseBillableSeconds(modelName, response.Usage)
	if seconds <= 0 {
		// Missing usage is not guessed after completion: keep the conservative
		// precharge so a malformed upstream response cannot cause underbilling.
		return 0
	}

	baseQuota := 0.0
	if billingContext.ModelPrice > 0 {
		baseQuota = billingContext.ModelPrice * common.QuotaPerUnit * billingContext.GroupRatio
	} else if billingContext.ModelRatio > 0 {
		baseQuota = billingContext.ModelRatio / 2 * common.QuotaPerUnit * billingContext.GroupRatio
	}
	if baseQuota <= 0 {
		return 0
	}

	actualRatios := &hosttypes.PriceData{}
	for key, ratio := range billingContext.OtherRatios {
		if key == "seconds" || strings.HasPrefix(key, "resolution-") {
			continue
		}
		actualRatios.AddOtherRatio(key, ratio)
	}
	actualRatios.AddOtherRatio("seconds", seconds)
	if resolution, ratio, ok := happyHorseResolutionRatio(modelName, int(response.Usage.SR)); ok {
		actualRatios.AddOtherRatio("resolution-"+resolution, ratio)
	} else {
		// SR is expected on success. If it is missing, retain the request-time
		// resolution multiplier instead of silently billing at the base tier.
		for key, ratio := range billingContext.OtherRatios {
			if strings.HasPrefix(key, "resolution-") {
				actualRatios.AddOtherRatio(key, ratio)
			}
		}
	}

	actualQuota, clamp := common.QuotaFromFloatChecked(actualRatios.ApplyOtherRatiosToFloat(baseQuota))
	taskResult.QuotaClamp = clamp
	return actualQuota
}

// DoRequest delegates to common helper
func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

// DoResponse handles upstream response
func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *taskdto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	// 解析阿里响应
	var aliResp AliVideoResponse
	if err := common.Unmarshal(responseBody, &aliResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	// 检查错误
	if aliResp.Code != "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("%s: %s", aliResp.Code, aliResp.Message), "ali_api_error", resp.StatusCode)
		return
	}

	if aliResp.Output.TaskID == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id is empty"), "invalid_response", http.StatusInternalServerError)
		return
	}

	// 转换为 OpenAI 格式响应
	openAIResp := dto.NewOpenAIVideo()
	openAIResp.ID = info.PublicTaskID
	openAIResp.TaskID = info.PublicTaskID
	openAIResp.Model = c.GetString("model")
	if openAIResp.Model == "" && info != nil {
		openAIResp.Model = info.OriginModelName
	}
	openAIResp.Status = convertAliStatus(aliResp.Output.TaskStatus)
	openAIResp.CreatedAt = common.GetTimestamp()

	// 返回 OpenAI 格式
	c.JSON(http.StatusOK, openAIResp)

	return aliResp.Output.TaskID, responseBody, nil
}

// FetchTask 查询任务状态
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	uri := fmt.Sprintf("%s/api/v1/tasks/%s", baseUrl, taskID)

	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+key)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

// ParseTaskResult 解析任务结果
func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var aliResp AliVideoResponse
	if err := common.Unmarshal(respBody, &aliResp); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}

	taskResult := relaycommon.TaskInfo{
		Code: 0,
	}

	// 状态映射
	switch aliResp.Output.TaskStatus {
	case "PENDING":
		taskResult.Status = model.TaskStatusQueued
	case "RUNNING":
		taskResult.Status = model.TaskStatusInProgress
	case "SUCCEEDED":
		taskResult.Status = model.TaskStatusSuccess
		// 阿里直接返回视频URL，不需要额外的代理端点
		taskResult.Url = aliResp.Output.VideoURL
	case "FAILED", "CANCELED", "UNKNOWN":
		taskResult.Status = model.TaskStatusFailure
		if aliResp.Message != "" {
			taskResult.Reason = aliResp.Message
		} else if aliResp.Output.Message != "" {
			taskResult.Reason = fmt.Sprintf("task failed, code: %s , message: %s", aliResp.Output.Code, aliResp.Output.Message)
		} else {
			taskResult.Reason = "task failed"
		}
	default:
		taskResult.Status = model.TaskStatusQueued
	}

	return &taskResult, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	var aliResp AliVideoResponse
	if err := common.Unmarshal(task.Data, &aliResp); err != nil {
		return nil, errors.Wrap(err, "unmarshal ali response failed")
	}

	openAIResp := dto.NewOpenAIVideo()
	openAIResp.ID = task.TaskID
	openAIResp.Status = convertAliStatus(aliResp.Output.TaskStatus)
	openAIResp.Model = task.Properties.OriginModelName
	openAIResp.SetProgressStr(task.Progress)
	openAIResp.CreatedAt = task.CreatedAt
	openAIResp.CompletedAt = task.UpdatedAt

	// 设置视频URL（核心字段）
	openAIResp.SetMetadata("url", aliResp.Output.VideoURL)

	// 错误处理
	if aliResp.Code != "" {
		openAIResp.Error = &dto.OpenAIVideoError{
			Code:    aliResp.Code,
			Message: aliResp.Message,
		}
	} else if aliResp.Output.Code != "" {
		openAIResp.Error = &dto.OpenAIVideoError{
			Code:    aliResp.Output.Code,
			Message: aliResp.Output.Message,
		}
	}

	return common.Marshal(openAIResp)
}

func convertAliStatus(aliStatus string) string {
	switch aliStatus {
	case "PENDING":
		return dto.VideoStatusQueued
	case "RUNNING":
		return dto.VideoStatusInProgress
	case "SUCCEEDED":
		return dto.VideoStatusCompleted
	case "FAILED", "CANCELED", "UNKNOWN":
		return dto.VideoStatusFailed
	default:
		return dto.VideoStatusUnknown
	}
}
