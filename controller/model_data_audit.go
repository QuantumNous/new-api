package controller

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type ChannelDataAuditItem struct {
	ChannelID                  int      `json:"channel_id"`
	ChannelName                string   `json:"channel_name"`
	ModelName                  string   `json:"model_name"`
	FinalSource                string   `json:"final_source"`
	InputProcurementPrice      *float64 `json:"input_procurement_price"`
	OutputProcurementPrice     *float64 `json:"output_procurement_price"`
	CacheReadProcurementPrice  *float64 `json:"cache_read_procurement_price"`
	CacheWriteProcurementPrice *float64 `json:"cache_write_procurement_price"`
	Completeness               string   `json:"completeness"`
	MissingFields              []string `json:"missing_fields"`
	IsAnomaly                  bool     `json:"is_anomaly"`
	Note                       string   `json:"note,omitempty"`
}

type ChannelDataAuditSummary struct {
	TotalChannels  int `json:"total_channels"`
	PricingSources int `json:"pricing_sources"`
	ManualSources  int `json:"manual_sources"`
	GlobalSources  int `json:"global_sources"`
	NoneSources    int `json:"none_sources"`
	CompleteCount  int `json:"complete_count"`
	PartialCount   int `json:"partial_count"`
	MissingCount   int `json:"missing_count"`
	AnomalyCount   int `json:"anomaly_count"`
}

type ChannelDataAuditGroupMember struct {
	ChannelID   int    `json:"channel_id"`
	ChannelName string `json:"channel_name"`
}

type ChannelDataAuditBatchSummary struct {
	TotalModels   int `json:"total_models"`
	TotalChannels int `json:"total_channels"`
	MissingCount  int `json:"missing_count"`
}

// GetChannelDataAudit returns a read-only audit of the Channel Data page's
// final procurement prices for a single model.
func GetChannelDataAudit(c *gin.Context) {
	modelName := c.DefaultQuery("model", "claude-sonnet-4-6")
	items, _, _, _ := getModelDataItems(c.Request.Context(), modelName)
	auditItems, summary, groups := buildChannelDataAudit(modelName, items)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"model":   modelName,
		"data":    auditItems,
		"summary": summary,
		"groups":  groups,
	})
}

// GetChannelDataAuditBatch returns incomplete procurement-price rows across
// multiple channel-data model tabs. The caller controls the model list so the
// backend does not need to mirror frontend tab ordering.
func GetChannelDataAuditBatch(c *gin.Context) {
	rawModels := strings.TrimSpace(c.Query("models"))
	if rawModels == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "models is required"})
		return
	}

	modelNames := make([]string, 0)
	seen := map[string]bool{}
	for _, part := range strings.Split(rawModels, ",") {
		modelName := strings.TrimSpace(part)
		if modelName == "" || seen[modelName] || isHiddenChannelDataModel(modelName) {
			continue
		}
		seen[modelName] = true
		modelNames = append(modelNames, modelName)
	}

	missingItems := make([]ChannelDataAuditItem, 0)
	summary := ChannelDataAuditBatchSummary{TotalModels: len(modelNames)}
	for _, modelName := range modelNames {
		items, _, _, _ := getModelDataItems(c.Request.Context(), modelName)
		summary.TotalChannels += len(items)
		auditItems, _, _ := buildChannelDataAudit(modelName, items)
		for _, item := range auditItems {
			if !channelDataAuditShouldAlert(item) {
				continue
			}
			missingItems = append(missingItems, item)
		}
	}
	summary.MissingCount = len(missingItems)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"models":  modelNames,
		"data":    missingItems,
		"summary": summary,
	})
}

func buildChannelDataAudit(modelName string, items []ModelDataItem) ([]ChannelDataAuditItem, ChannelDataAuditSummary, map[string][]ChannelDataAuditGroupMember) {
	auditItems := make([]ChannelDataAuditItem, 0, len(items))
	summary := ChannelDataAuditSummary{TotalChannels: len(items)}
	groups := make(map[string][]ChannelDataAuditGroupMember)
	requiresFourPiece := channelDataAuditRequiresFourPiece(modelName)
	// cache_write is only required when the unified official price actually has a
	// cache-creation axis (系统设置→模型定价 配了 CreateCacheRatio). Many models
	// (grok, most gpt) have no official cache-write price at all, so an upstream
	// 0 there is "not applicable", not "missing".
	requiresCacheWrite := requiresFourPiece && channelDataAuditOfficialHasCacheWrite(modelName)

	addGroup := func(key string, item ModelDataItem) {
		groups[key] = append(groups[key], ChannelDataAuditGroupMember{
			ChannelID:   item.ChannelID,
			ChannelName: item.ChannelName,
		})
	}

	for _, item := range items {
		source := normalizedChannelDataAuditSource(item.PricingSource)
		switch source {
		case "pricing":
			summary.PricingSources++
		case "manual":
			summary.ManualSources++
		case "global":
			summary.GlobalSources++
		default:
			summary.NoneSources++
		}

		missingFields := make([]string, 0, 4)
		if channelDataAuditPriceMissing(item.ActualPrice) {
			missingFields = append(missingFields, "input")
		}
		if requiresFourPiece {
			if channelDataAuditPriceMissing(item.ActualOutputPrice) {
				missingFields = append(missingFields, "output")
			}
			if channelDataAuditPriceMissing(item.ActualCachePrice) {
				missingFields = append(missingFields, "cache_read")
			}
			if requiresCacheWrite && channelDataAuditPriceMissing(item.ActualCacheCreationPrice) {
				missingFields = append(missingFields, "cache_write")
			}
		}

		completeness := "complete"
		if len(missingFields) > 0 {
			if channelDataAuditPriceMissing(item.ActualPrice) {
				completeness = "missing"
			} else {
				completeness = "partial"
			}
		}

		switch completeness {
		case "complete":
			summary.CompleteCount++
		case "partial":
			summary.PartialCount++
		case "missing":
			summary.MissingCount++
		}

		isAnomaly := len(missingFields) > 0 || source == "global" || source == "none"
		if isAnomaly {
			summary.AnomalyCount++
		}

		noteParts := make([]string, 0, 2)
		if source == "global" {
			noteParts = append(noteParts, "页面依赖 global 兜底，按审计口径判错")
			addGroup("global_fallback", item)
		}
		if source == "none" || channelDataAuditPriceMissing(item.ActualPrice) {
			addGroup("missing_procurement_price", item)
		}
		if source == "pricing" || source == "manual" {
			for _, field := range missingFields {
				switch field {
				case "output":
					addGroup(source+"_missing_output", item)
				case "cache_read":
					addGroup(source+"_missing_cache_read", item)
				case "cache_write":
					addGroup(source+"_missing_cache_write", item)
				}
			}
		}

		auditItems = append(auditItems, ChannelDataAuditItem{
			ChannelID:                  item.ChannelID,
			ChannelName:                item.ChannelName,
			ModelName:                  modelName,
			FinalSource:                source,
			InputProcurementPrice:      item.ActualPrice,
			OutputProcurementPrice:     item.ActualOutputPrice,
			CacheReadProcurementPrice:  item.ActualCachePrice,
			CacheWriteProcurementPrice: item.ActualCacheCreationPrice,
			Completeness:               completeness,
			MissingFields:              missingFields,
			IsAnomaly:                  isAnomaly,
			Note:                       strings.Join(noteParts, "; "),
		})
	}

	return auditItems, summary, groups
}

func normalizedChannelDataAuditSource(source string) string {
	source = strings.TrimSpace(source)
	if source == "" {
		return "none"
	}
	if source == "api" {
		return "pricing"
	}
	return source
}

func channelDataAuditPriceMissing(price *float64) bool {
	return price == nil || *price <= 0
}

func channelDataAuditShouldAlert(item ChannelDataAuditItem) bool {
	return len(item.MissingFields) > 0
}

func channelDataAuditRequiresFourPiece(modelName string) bool {
	switch strings.TrimSpace(modelName) {
	case "gemini-3.1-flash-image", "gemini-3.1-flash-image-preview", "gpt-image-2", "sora-2", "sora-2-pro", "kling-v3-motion-control":
		return false
	default:
		return true
	}
}

// channelDataAuditOfficialHasCacheWrite reports whether the unified official
// price (系统设置→模型定价) defines a cache-creation axis for this model. When
// it doesn't (no CreateCacheRatio configured), upstream channels legitimately
// report cache_write=0, so we must not flag them as "missing price".
func channelDataAuditOfficialHasCacheWrite(modelName string) bool {
	_, _, _, cacheCreation, ok := service.GlobalModelPricingUSD(modelName)
	return ok && cacheCreation > 0
}
