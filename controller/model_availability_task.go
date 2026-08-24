package controller

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"
)

const modelAvailabilityProbePrompt = "我发出'ping'命令，请你只回我'pong'"

type modelProbeClass string

const (
	modelProbeAvailable           modelProbeClass = "available"
	modelProbeTemporaryFailure    modelProbeClass = "temporary_failure"
	modelProbeOfficialUnsupported modelProbeClass = "official_unsupported"
	modelProbeUnknownFailure      modelProbeClass = "unknown_failure"
)

type modelProbeOutcome struct {
	Class      modelProbeClass
	ReasonType string
	Message    string
	ChannelID  int
}

var (
	modelAvailabilityTaskOnce    sync.Once
	modelAvailabilityRunLock     sync.Mutex
	modelAvailabilityRunInFlight bool
)

func modelAvailabilityCheckEnabled() bool {
	return common.GetEnvOrDefaultBool("MODEL_AVAILABILITY_CHECK_ENABLED", true)
}

func modelAvailabilityCheckInterval() time.Duration {
	seconds := common.GetEnvOrDefault("MODEL_AVAILABILITY_CHECK_INTERVAL_SECONDS", 60)
	if seconds < 1 {
		seconds = 60
	}
	return time.Duration(seconds) * time.Second
}

func modelAvailabilityUnsupportedThreshold() int {
	threshold := common.GetEnvOrDefault("MODEL_AVAILABILITY_OFFICIAL_UNSUPPORTED_THRESHOLD", 2)
	if threshold < 1 {
		return 1
	}
	return threshold
}

func modelAvailabilityCheckTime() (int, int) {
	value := strings.TrimSpace(common.GetEnvOrDefaultString("MODEL_AVAILABILITY_CHECK_TIME", "12:00"))
	parts := strings.Split(value, ":")
	if len(parts) != 2 {
		return 12, 0
	}
	var hour, minute int
	if _, err := fmt.Sscanf(value, "%d:%d", &hour, &minute); err != nil {
		return 12, 0
	}
	if hour < 0 || hour > 23 || minute < 0 || minute > 59 {
		return 12, 0
	}
	return hour, minute
}

func nextModelAvailabilityRunAt(now time.Time) time.Time {
	hour, minute := modelAvailabilityCheckTime()
	next := time.Date(now.Year(), now.Month(), now.Day(), hour, minute, 0, 0, now.Location())
	if !next.After(now) {
		next = next.Add(24 * time.Hour)
	}
	return next
}

func classifyModelProbeError(err error, apiErr *types.NewAPIError) modelProbeOutcome {
	statusCode := 0
	if apiErr != nil {
		statusCode = apiErr.StatusCode
	}
	message := ""
	if err != nil {
		message = err.Error()
	} else if apiErr != nil {
		message = apiErr.Error()
	}
	lower := strings.ToLower(message)

	officialUnsupportedPatterns := []string{
		"model is not supported",
		"model not supported",
		"not supported when using",
		"unsupported model",
		"model_not_found",
		"does not exist",
		"invalid model",
		"not available for",
		"has been deprecated",
		"has been retired",
		"sunset",
	}
	for _, pattern := range officialUnsupportedPatterns {
		if strings.Contains(lower, pattern) {
			return modelProbeOutcome{
				Class:      modelProbeOfficialUnsupported,
				ReasonType: "official_model_unsupported",
				Message:    message,
			}
		}
	}

	accountIssuePatterns := []string{
		"invalid api key",
		"unauthorized",
		"permission denied",
		"insufficient balance",
		"quota exceeded",
		"billing",
		"no available key",
	}
	for _, pattern := range accountIssuePatterns {
		if strings.Contains(lower, pattern) {
			return modelProbeOutcome{
				Class:      modelProbeUnknownFailure,
				ReasonType: "channel_account_issue",
				Message:    message,
			}
		}
	}

	if statusCode == http.StatusTooManyRequests ||
		statusCode == http.StatusRequestTimeout ||
		statusCode == http.StatusBadGateway ||
		statusCode == http.StatusServiceUnavailable ||
		statusCode == http.StatusGatewayTimeout ||
		strings.Contains(lower, "timeout") ||
		strings.Contains(lower, "temporarily unavailable") ||
		strings.Contains(lower, "service unavailable") ||
		strings.Contains(lower, "overloaded") ||
		strings.Contains(lower, "rate limit") {
		return modelProbeOutcome{
			Class:      modelProbeTemporaryFailure,
			ReasonType: "temporary_upstream_failure",
			Message:    message,
		}
	}

	return modelProbeOutcome{
		Class:      modelProbeUnknownFailure,
		ReasonType: "unknown_probe_failure",
		Message:    message,
	}
}

// modelProbeModality describes how (or whether) a model can be exercised by the
// synchronous availability probe. Non-chat modalities either need a different
// relay endpoint or cannot be probed with a live call at all.
type modelProbeModality int

const (
	modelProbeModalityChat modelProbeModality = iota
	modelProbeModalityImage
	modelProbeModalityEmbedding
	modelProbeModalityRerank
	// modelProbeModalityUntestable covers async-task / no-synchronous-probe
	// channels (video/audio/tts/realtime/moderation and similar). A live
	// ping→pong or single-shot relay call cannot meaningfully verify them.
	modelProbeModalityUntestable
)

// untestableProbeChannelTypes are async-task / media channels that expose no
// synchronous relay endpoint the probe can call. They are covered instead by
// the channel-test monitor, so the availability probe must not mark them failed.
var untestableProbeChannelTypes = map[int]bool{
	constant.ChannelTypeMidjourney:       true,
	constant.ChannelTypeMidjourneyPlus:   true,
	constant.ChannelTypeSunoAPI:          true,
	constant.ChannelTypeKling:            true,
	constant.ChannelTypeJimeng:           true,
	constant.ChannelTypeDoubaoVideo:      true,
	constant.ChannelTypeVidu:             true,
	constant.ChannelTypeSora:             true,
	constant.ChannelTypeBlockRunVideo:    true,
	constant.ChannelTypeBlockRunSeedance: true,
	constant.ChannelTypeTechMobiVideo:    true,
	constant.ChannelTypeBytePlus:         true,
}

var untestableProbeModelSubstrings = []string{
	"tts", "whisper", "audio", "speech", "voice", "transcrib",
	"realtime", "moderation", "video", "sora", "veo", "seedance",
	"runway", "sound", "music", "happyhorse", "minimax-h3",
}

var imageProbeModelSubstrings = []string{
	"seedream", "stable-diffusion", "sd3", "sdxl", "recraft", "ideogram",
	"kolors", "nano-banana", "hunyuan-image", "qwen-image", "wanx",
	"playground-v", "kontext",
}

var embeddingProbeModelSubstrings = []string{
	"embedding", "embed", "bge-", "m3e", "gte-", "text2vec",
}

// classifyModelProbeModality decides which relay modality the availability probe
// should use for a given (channel, model) pair. It is deliberately conservative:
// anything that cannot be exercised with a synchronous call is reported as
// untestable so the probe never mis-files a working media/task model as broken.
func classifyModelProbeModality(channelType int, modelName string) modelProbeModality {
	lower := strings.ToLower(strings.TrimSpace(modelName))

	if untestableProbeChannelTypes[channelType] {
		return modelProbeModalityUntestable
	}
	for _, s := range untestableProbeModelSubstrings {
		if strings.Contains(lower, s) {
			return modelProbeModalityUntestable
		}
	}

	// Rerank by explicit model name wins over everything below.
	if strings.Contains(lower, "rerank") {
		return modelProbeModalityRerank
	}
	// Embedding by name is checked before the Jina channel default so that a
	// Jina embeddings model is not mis-routed to the rerank endpoint.
	for _, s := range embeddingProbeModelSubstrings {
		if strings.Contains(lower, s) {
			return modelProbeModalityEmbedding
		}
	}
	if channelType == constant.ChannelTypeJina {
		return modelProbeModalityRerank
	}

	if common.IsImageGenerationModel(modelName) {
		return modelProbeModalityImage
	}
	for _, s := range imageProbeModelSubstrings {
		if strings.Contains(lower, s) {
			return modelProbeModalityImage
		}
	}

	return modelProbeModalityChat
}

// modelAvailabilityProbeConfig returns the relay endpoint type and test options
// for probing modelName on a channel of channelType. The bool return is false
// when the (channel, model) pair is untestable (async-task/media) and must be
// skipped rather than probed with a live call.
func modelAvailabilityProbeConfig(modelName string, channelType int) (string, channelTestOptions, bool) {
	options := channelTestOptions{
		Prompt:     modelAvailabilityProbePrompt,
		ExpectPong: true,
		TokenName:  "模型可用性检测",
		LogContent: "模型可用性检测",
		MaxTokens:  8,
		SkipLog:    true,
	}
	switch classifyModelProbeModality(channelType, modelName) {
	case modelProbeModalityUntestable:
		return "", options, false
	case modelProbeModalityImage:
		options.ExpectPong = false
		return string(constant.EndpointTypeImageGeneration), options, true
	case modelProbeModalityEmbedding:
		options.ExpectPong = false
		return string(constant.EndpointTypeEmbeddings), options, true
	case modelProbeModalityRerank:
		options.ExpectPong = false
		return string(constant.EndpointTypeJinaRerank), options, true
	default:
		return "", options, true
	}
}

func saveModelAvailabilityProbeResult(modelName string, outcome modelProbeOutcome) error {
	now := common.GetTimestamp()
	state := &model.ModelAvailabilityState{
		ModelName:     modelName,
		Status:        string(outcome.Class),
		ReasonType:    outcome.ReasonType,
		Reason:        buildModelAvailabilityReason(outcome),
		LastError:     outcome.Message,
		LastCheckedAt: now,
	}

	existing, _ := model.GetModelAvailabilityState(modelName)
	if outcome.Class == modelProbeAvailable {
		state.Status = model.ModelAvailabilityAvailable
		state.ReasonType = ""
		state.Reason = ""
		state.LastError = ""
		state.FirstDetectedAt = 0
		state.LastSuccessAt = now
		state.ConsecutiveFailures = 0
		return model.SaveModelAvailabilityState(state)
	}

	state.FirstDetectedAt = now
	state.ConsecutiveFailures = 1
	if existing != nil {
		if existing.FirstDetectedAt > 0 {
			state.FirstDetectedAt = existing.FirstDetectedAt
		}
		if existing.ReasonType == outcome.ReasonType ||
			(outcome.Class == modelProbeOfficialUnsupported && existing.ReasonType == "official_model_unsupported_candidate") {
			state.ConsecutiveFailures = existing.ConsecutiveFailures + 1
		}
		state.LastSuccessAt = existing.LastSuccessAt
	}

	if outcome.Class == modelProbeOfficialUnsupported &&
		state.ConsecutiveFailures < modelAvailabilityUnsupportedThreshold() {
		state.Status = model.ModelAvailabilityUnknownFailure
		state.ReasonType = "official_model_unsupported_candidate"
	}

	return model.SaveModelAvailabilityState(state)
}

func buildModelAvailabilityReason(outcome modelProbeOutcome) string {
	switch outcome.Class {
	case modelProbeOfficialUnsupported:
		return "上游明确返回该模型当前不受支持，模型可能已被官方下线或当前账号类型不再支持。"
	case modelProbeTemporaryFailure:
		return "检测时上游出现临时故障，暂不判定为模型下线。"
	default:
		return "检测失败但无法确认是官方下线，建议查看渠道、账号权限或上游错误。"
	}
}

func probeOneModelAvailability(modelName string, testUserID int) {
	targets, err := model.GetModelAvailabilityProbeTargets(modelName)
	if err != nil {
		_ = saveModelAvailabilityProbeResult(modelName, modelProbeOutcome{
			Class:      modelProbeUnknownFailure,
			ReasonType: "probe_target_query_failed",
			Message:    err.Error(),
		})
		return
	}
	if len(targets) == 0 {
		_ = saveModelAvailabilityProbeResult(modelName, modelProbeOutcome{
			Class:      modelProbeUnknownFailure,
			ReasonType: "no_available_channel",
			Message:    "no enabled channel found for model",
		})
		return
	}

	outcomes := make([]modelProbeOutcome, 0, len(targets))
	sawUntestable := false
	for _, target := range targets {
		channel, err := model.GetChannelById(target.ChannelID, true)
		if err != nil {
			outcomes = append(outcomes, modelProbeOutcome{
				Class:      modelProbeUnknownFailure,
				ReasonType: "channel_load_failed",
				Message:    err.Error(),
				ChannelID:  target.ChannelID,
			})
			continue
		}
		endpointType, options, testable := modelAvailabilityProbeConfig(modelName, channel.Type)
		if !testable {
			// Async-task / media channel: no synchronous probe is possible.
			// Skip without recording a failure so a working model is not
			// mis-filed as unknown_failure. Coverage is retained by the
			// channel-test monitor.
			sawUntestable = true
			continue
		}
		result := testChannelWithOptions(channel, testUserID, modelName, endpointType, false, options)
		if result.localErr == nil && result.newAPIError == nil {
			_ = saveModelAvailabilityProbeResult(modelName, modelProbeOutcome{
				Class: modelProbeAvailable,
			})
			model.InvalidatePricingCache()
			return
		}
		outcome := classifyModelProbeError(result.localErr, result.newAPIError)
		outcome.ChannelID = target.ChannelID
		outcomes = append(outcomes, outcome)
	}
	final := summarizeModelProbeOutcomes(outcomes, sawUntestable)
	if err := saveModelAvailabilityProbeResult(modelName, final); err != nil {
		common.SysError("failed to save model availability state: " + err.Error())
	}
	model.InvalidatePricingCache()
}

func summarizeModelProbeOutcomes(outcomes []modelProbeOutcome, sawUntestable bool) modelProbeOutcome {
	if sawUntestable {
		return modelProbeOutcome{Class: modelProbeAvailable}
	}
	if len(outcomes) == 0 {
		return modelProbeOutcome{Class: modelProbeUnknownFailure, ReasonType: "empty_probe_result"}
	}

	allOfficialUnsupported := true
	var temporary *modelProbeOutcome
	var unknown *modelProbeOutcome
	for i := range outcomes {
		if outcomes[i].Class != modelProbeOfficialUnsupported {
			allOfficialUnsupported = false
		}
		if outcomes[i].Class == modelProbeTemporaryFailure && temporary == nil {
			temporary = &outcomes[i]
		}
		if outcomes[i].Class == modelProbeUnknownFailure && unknown == nil {
			unknown = &outcomes[i]
		}
	}
	if allOfficialUnsupported {
		return outcomes[0]
	}
	if temporary != nil {
		return *temporary
	}
	if unknown != nil {
		return *unknown
	}
	return outcomes[0]
}

func runModelAvailabilityDetection() {
	testUserID, err := resolveChannelTestUserID(nil)
	if err != nil {
		common.SysError("model availability detection cannot resolve test user: " + err.Error())
		return
	}
	modelNames, err := model.GetModelAvailabilityProbeModelNames()
	if err != nil {
		common.SysError("model availability detection cannot load models: " + err.Error())
		return
	}
	interval := modelAvailabilityCheckInterval()
	common.SysLog(fmt.Sprintf("model availability detection started: models=%d interval=%s", len(modelNames), interval))
	for idx, modelName := range modelNames {
		probeOneModelAvailability(modelName, testUserID)
		if idx < len(modelNames)-1 {
			time.Sleep(interval)
		}
	}
	common.SysLog("model availability detection finished")
}

func tryRunModelAvailabilityDetection() {
	modelAvailabilityRunLock.Lock()
	if modelAvailabilityRunInFlight {
		modelAvailabilityRunLock.Unlock()
		common.SysLog("model availability detection skipped: previous run still in progress")
		return
	}
	modelAvailabilityRunInFlight = true
	modelAvailabilityRunLock.Unlock()

	defer func() {
		modelAvailabilityRunLock.Lock()
		modelAvailabilityRunInFlight = false
		modelAvailabilityRunLock.Unlock()
	}()

	runModelAvailabilityDetection()
}

func StartModelAvailabilityDetectionTask() {
	if !common.IsMasterNode {
		return
	}
	modelAvailabilityTaskOnce.Do(func() {
		gopool.Go(func() {
			for {
				if !modelAvailabilityCheckEnabled() {
					time.Sleep(time.Minute)
					continue
				}
				next := nextModelAvailabilityRunAt(time.Now())
				common.SysLog("next model availability detection scheduled at " + next.Format(time.RFC3339))
				time.Sleep(time.Until(next))
				if modelAvailabilityCheckEnabled() {
					tryRunModelAvailabilityDetection()
				}
			}
		})
	})
}
