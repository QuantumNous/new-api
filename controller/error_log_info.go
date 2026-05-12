package controller

import (
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func buildErrorLogOther(c *gin.Context, relayInfo *relaycommon.RelayInfo, channelError types.ChannelError, err *types.NewAPIError, useTimeSeconds int) map[string]interface{} {
	other := make(map[string]interface{})
	appendErrorLogRequestInfo(c, relayInfo, other, useTimeSeconds)
	appendErrorLogErrorInfo(other, err, channelError.UsingKey)
	appendErrorLogChannelInfo(c, channelError, other)
	appendErrorLogModelInfo(c, relayInfo, other)
	appendErrorLogRelayInfo(c, relayInfo, other)
	appendErrorLogRetryInfo(c, relayInfo, other)
	return other
}

func appendErrorLogRequestInfo(c *gin.Context, relayInfo *relaycommon.RelayInfo, other map[string]interface{}, useTimeSeconds int) {
	if c != nil && c.Request != nil {
		if c.Request.URL != nil {
			other["request_path"] = c.Request.URL.Path
		}
		if c.Request.Method != "" {
			other["request_method"] = c.Request.Method
		}
	}
	if _, ok := other["request_path"]; !ok && relayInfo != nil && relayInfo.RequestURLPath != "" {
		path := relayInfo.RequestURLPath
		if idx := strings.Index(path, "?"); idx != -1 {
			path = path[:idx]
		}
		other["request_path"] = path
	}
	if relayInfo != nil {
		other["is_stream"] = relayInfo.IsStream
	} else if c != nil {
		other["is_stream"] = common.GetContextKeyBool(c, constant.ContextKeyIsStream)
	}
	other["use_time_seconds"] = useTimeSeconds
	if elapsedMs := errorLogElapsedMilliseconds(c); elapsedMs > 0 {
		other["elapsed_ms"] = elapsedMs
	}
}

func appendErrorLogErrorInfo(other map[string]interface{}, err *types.NewAPIError, secrets ...string) {
	if err == nil {
		return
	}
	other["error_type"] = err.GetErrorType()
	other["error_code"] = err.GetErrorCode()
	other["status_code"] = err.StatusCode
	other["upstream_status_code"] = err.StatusCode
	other["error_source"] = service.ErrorSourceForLog(err)
	if summary := errorLogSummary(err, secrets...); len(summary) > 0 {
		other["upstream_error"] = summary
		if message, ok := summary["message"].(string); ok && message != "" {
			other["last_error_summary"] = message
		}
	}
}

func appendErrorLogChannelInfo(c *gin.Context, channelError types.ChannelError, other map[string]interface{}) {
	channelId := channelError.ChannelId
	channelType := channelError.ChannelType
	channelName := channelError.ChannelName
	if channelId == 0 && c != nil {
		channelId = c.GetInt("channel_id")
	}
	if channelType == 0 && c != nil {
		channelType = c.GetInt("channel_type")
	}
	if channelName == "" && c != nil {
		channelName = c.GetString("channel_name")
	}
	other["channel_id"] = channelId
	other["channel_name"] = channelName
	other["channel_type"] = channelType
	adminInfo := make(map[string]interface{})
	if c != nil {
		adminInfo["use_channel"] = c.GetStringSlice("use_channel")
		isMultiKey := common.GetContextKeyBool(c, constant.ContextKeyChannelIsMultiKey)
		if isMultiKey {
			adminInfo["is_multi_key"] = true
			adminInfo["multi_key_index"] = common.GetContextKeyInt(c, constant.ContextKeyChannelMultiKeyIndex)
		}
		service.AppendChannelAffinityAdminInfo(c, adminInfo)
	}
	other["admin_info"] = adminInfo
}

func appendErrorLogModelInfo(c *gin.Context, relayInfo *relaycommon.RelayInfo, other map[string]interface{}) {
	originalModel := ""
	finalModel := ""
	if relayInfo != nil {
		originalModel = relayInfo.OriginModelName
		if relayInfo.ChannelMeta != nil {
			finalModel = relayInfo.UpstreamModelName
		}
	}
	if originalModel == "" && c != nil {
		originalModel = c.GetString("original_model")
	}
	if finalModel == "" {
		finalModel = originalModel
	}
	if originalModel != "" {
		other["original_model_name"] = originalModel
	}
	if finalModel != "" {
		other["final_model_name"] = finalModel
	}
	if originalModel != "" && finalModel != "" && originalModel != finalModel {
		other["is_model_mapped"] = true
		other["upstream_model_name"] = finalModel
	}
}

func appendErrorLogRelayInfo(c *gin.Context, relayInfo *relaycommon.RelayInfo, other map[string]interface{}) {
	relayMode := relayconstant.RelayModeUnknown
	relayFormat := ""
	finalFormat := ""
	if relayInfo != nil {
		relayMode = relayInfo.RelayMode
		relayFormat = string(relayInfo.RelayFormat)
		finalFormat = string(relayInfo.GetFinalRequestRelayFormat())
	}
	if relayMode == relayconstant.RelayModeUnknown && c != nil {
		relayMode = c.GetInt("relay_mode")
	}
	if relayMode != relayconstant.RelayModeUnknown {
		other["relay_mode"] = relayModeName(relayMode)
		other["relay_mode_id"] = relayMode
	}
	if relayFormat != "" {
		other["relay_format"] = relayFormat
	}
	if finalFormat != "" {
		other["final_relay_format"] = finalFormat
	}
	if relayInfo != nil && len(relayInfo.RequestConversionChain) > 0 {
		chain := make([]string, 0, len(relayInfo.RequestConversionChain))
		for _, format := range relayInfo.RequestConversionChain {
			chain = append(chain, string(format))
		}
		other["request_conversion"] = chain
	}
}

func appendErrorLogRetryInfo(c *gin.Context, relayInfo *relaycommon.RelayInfo, other map[string]interface{}) {
	var useChannel []string
	if c != nil {
		useChannel = c.GetStringSlice("use_channel")
	}
	retryCount := 0
	if len(useChannel) > 1 {
		retryCount = len(useChannel) - 1
	}
	if relayInfo != nil && relayInfo.RetryIndex > retryCount {
		retryCount = relayInfo.RetryIndex
	}
	other["retry_count"] = retryCount
}

func relayModeName(mode int) string {
	switch mode {
	case relayconstant.RelayModeChatCompletions:
		return "chat_completions"
	case relayconstant.RelayModeCompletions:
		return "completions"
	case relayconstant.RelayModeEmbeddings:
		return "embeddings"
	case relayconstant.RelayModeModerations:
		return "moderations"
	case relayconstant.RelayModeImagesGenerations:
		return "images_generations"
	case relayconstant.RelayModeImagesEdits:
		return "images_edits"
	case relayconstant.RelayModeEdits:
		return "edits"
	case relayconstant.RelayModeMidjourneyImagine:
		return "midjourney_imagine"
	case relayconstant.RelayModeMidjourneyDescribe:
		return "midjourney_describe"
	case relayconstant.RelayModeMidjourneyBlend:
		return "midjourney_blend"
	case relayconstant.RelayModeMidjourneyChange:
		return "midjourney_change"
	case relayconstant.RelayModeMidjourneySimpleChange:
		return "midjourney_simple_change"
	case relayconstant.RelayModeMidjourneyNotify:
		return "midjourney_notify"
	case relayconstant.RelayModeMidjourneyTaskFetch:
		return "midjourney_task_fetch"
	case relayconstant.RelayModeMidjourneyTaskImageSeed:
		return "midjourney_task_image_seed"
	case relayconstant.RelayModeMidjourneyTaskFetchByCondition:
		return "midjourney_task_fetch_by_condition"
	case relayconstant.RelayModeMidjourneyAction:
		return "midjourney_action"
	case relayconstant.RelayModeMidjourneyModal:
		return "midjourney_modal"
	case relayconstant.RelayModeMidjourneyShorten:
		return "midjourney_shorten"
	case relayconstant.RelayModeSwapFace:
		return "swap_face"
	case relayconstant.RelayModeMidjourneyUpload:
		return "midjourney_upload"
	case relayconstant.RelayModeMidjourneyVideo:
		return "midjourney_video"
	case relayconstant.RelayModeMidjourneyEdits:
		return "midjourney_edits"
	case relayconstant.RelayModeAudioSpeech:
		return "audio_speech"
	case relayconstant.RelayModeAudioTranscription:
		return "audio_transcription"
	case relayconstant.RelayModeAudioTranslation:
		return "audio_translation"
	case relayconstant.RelayModeSunoFetch:
		return "suno_fetch"
	case relayconstant.RelayModeSunoFetchByID:
		return "suno_fetch_by_id"
	case relayconstant.RelayModeSunoSubmit:
		return "suno_submit"
	case relayconstant.RelayModeVideoFetchByID:
		return "video_fetch_by_id"
	case relayconstant.RelayModeVideoSubmit:
		return "video_submit"
	case relayconstant.RelayModeRerank:
		return "rerank"
	case relayconstant.RelayModeResponses:
		return "responses"
	case relayconstant.RelayModeRealtime:
		return "realtime"
	case relayconstant.RelayModeGemini:
		return "gemini"
	case relayconstant.RelayModeResponsesCompact:
		return "responses_compact"
	default:
		return fmt.Sprintf("unknown_%d", mode)
	}
}

func errorLogUseTimeSeconds(c *gin.Context) int {
	startTime := common.GetContextKeyTime(c, constant.ContextKeyRequestStartTime)
	if startTime.IsZero() {
		return 0
	}
	return int(time.Since(startTime).Seconds())
}

func errorLogElapsedMilliseconds(c *gin.Context) int64 {
	startTime := common.GetContextKeyTime(c, constant.ContextKeyRequestStartTime)
	if startTime.IsZero() {
		return 0
	}
	return time.Since(startTime).Milliseconds()
}

func errorLogSummary(err *types.NewAPIError, secrets ...string) map[string]interface{} {
	if err == nil {
		return nil
	}
	if len(err.ErrorLogSummary) > 0 {
		return sanitizeErrorLogSummary(err.ErrorLogSummary, secrets...)
	}
	return service.BuildErrorLogSummary(err, secrets...)
}

func sanitizeErrorLogSummary(summary map[string]interface{}, secrets ...string) map[string]interface{} {
	if len(summary) == 0 {
		return nil
	}
	safe := make(map[string]interface{}, len(summary))
	for key, value := range summary {
		if text, ok := value.(string); ok {
			snippet, _ := service.SafeErrorLogSnippet(text, 800, secrets...)
			safe[key] = snippet
			continue
		}
		safe[key] = value
	}
	return safe
}

func errorLogContent(err *types.NewAPIError, secrets ...string) string {
	if err == nil {
		return ""
	}
	summary := errorLogSummary(err, secrets...)
	message, _ := summary["message"].(string)
	if message == "" {
		message, _ = service.SafeErrorLogSnippet(err.MaskSensitiveError(), 800, secrets...)
	}
	if err.StatusCode == 0 {
		return message
	}
	if message == "" {
		return fmt.Sprintf("status_code=%d", err.StatusCode)
	}
	return fmt.Sprintf("status_code=%d, %s", err.StatusCode, message)
}
