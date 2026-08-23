package helper

import (
	"encoding/json"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	hosttypes "github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// ApplySeedanceTaskPrice quotes Seedance tasks from the dedicated price table.
// ok is false when the model is not priced as Seedance, so callers fall back
// to the generic per-call helper.
func ApplySeedanceTaskPrice(c *gin.Context, info *relaycommon.RelayInfo) (bool, error) {
	if info == nil {
		return false, nil
	}
	modelNames := []string{info.OriginModelName, info.UpstreamModelName}
	if !ratio_setting.HasSeedancePrice(modelNames...) {
		return false, nil
	}

	groupRatioInfo := HandleGroupRatio(c, info)
	billingResolution, durationSeconds, hasVideo := seedanceRequestFacts(c)
	outputResolution := strings.TrimSpace(info.VideoOutputResolution)
	superResolution := info.ChannelType == constant.ChannelTypeDoubaoVideoMediaKit
	if superResolution && outputResolution == "" {
		outputResolution = billingResolution
	}

	quota, snap, clamp, ok := ratio_setting.EstimateSeedanceQuota(ratio_setting.SeedanceQuoteInput{
		ModelNames:        modelNames,
		BillingResolution: billingResolution,
		OutputResolution:  outputResolution,
		HasVideo:          hasVideo,
		DurationSeconds:   durationSeconds,
		SuperResolution:   superResolution,
		GroupRatio:        groupRatioInfo.GroupRatio,
	})
	if !ok {
		return false, modelPriceNotConfiguredError(info.OriginModelName, info.UserId)
	}

	freeModel := false
	if !operation_setting.GetQuotaSetting().EnableFreeModelPreConsume {
		if groupRatioInfo.GroupRatio == 0 {
			quota = 0
			freeModel = true
		}
	}

	info.SeedanceBilling = &snap
	info.QuotaClamp = clamp
	info.PriceData = hosttypes.PriceData{
		FreeModel:      freeModel,
		ModelPrice:     -1,
		ModelRatio:     ratio_setting.SeedanceModelRatio(snap.UnitPriceRMB),
		UsePrice:       false,
		Quota:          quota,
		GroupRatioInfo: groupRatioInfo,
	}
	if common.DebugEnabled {
		logger.LogDebug(c, "seedance_task_price model=%s billingRes=%s outputRes=%s video=%t sr=%t duration=%.2f quota=%d",
			info.OriginModelName, snap.BillingResolution, snap.OutputResolution, snap.HasVideo, snap.SuperResolution, snap.DurationSeconds, quota)
	}
	return true, nil
}

func seedanceRequestFacts(c *gin.Context) (resolution string, durationSeconds float64, hasVideo bool) {
	resolution = "720p"
	durationSeconds = 0
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return resolution, durationSeconds, false
	}
	if value := metadataString(req.Metadata, "resolution"); value != "" {
		resolution = value
	}
	durationSeconds = float64(req.Duration)
	if durationSeconds == 0 && strings.TrimSpace(req.Seconds) != "" {
		if parsed, convErr := strconv.Atoi(strings.TrimSpace(req.Seconds)); convErr == nil {
			durationSeconds = float64(parsed)
		}
	}
	if durationSeconds == 0 {
		durationSeconds = metadataFloat(req.Metadata, "duration")
	}
	return resolution, durationSeconds, metadataHasVideo(req)
}

func metadataString(metadata map[string]any, key string) string {
	if metadata == nil {
		return ""
	}
	value, _ := metadata[key].(string)
	return strings.TrimSpace(value)
}

func metadataFloat(metadata map[string]any, key string) float64 {
	if metadata == nil {
		return 0
	}
	switch value := metadata[key].(type) {
	case float64:
		return value
	case int:
		return float64(value)
	case int64:
		return float64(value)
	case json.Number:
		parsed, err := value.Float64()
		if err != nil {
			return 0
		}
		return parsed
	case string:
		parsed, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
		if err != nil {
			return 0
		}
		return parsed
	default:
		return 0
	}
}

func metadataHasVideo(req relaycommon.TaskSubmitReq) bool {
	if req.Metadata == nil {
		return false
	}
	content, ok := req.Metadata["content"].([]any)
	if !ok {
		return false
	}
	for _, item := range content {
		record, ok := item.(map[string]any)
		if !ok {
			continue
		}
		itemType, _ := record["type"].(string)
		if itemType == "video_url" || record["video_url"] != nil {
			return true
		}
	}
	return false
}
