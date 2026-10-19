package yksd

import (
	"strings"

	"github.com/QuantumNous/new-api/model"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/tidwall/gjson"
)

// Upstream sd_2.0_special charges a flat CNY/second once the request carries a
// non-empty reference video. Measured from upstream amount / billed seconds:
// 720p = 1.27 (15s → 19.05), 1080p = 1.30 (15s → 19.50).
// Jobs without a reference video stay on the configured model price, which is
// already above the upstream output-only cost.
const (
	referenceVideoPrice720p  = 1.27
	referenceVideoPrice1080p = 1.30
)

func hasBillableReferenceVideo(body map[string]interface{}) bool {
	if body == nil {
		return false
	}
	for _, key := range []string{"reference_videos", "videos", "video_urls", "referenceVideos"} {
		if sliceHasURL(body[key]) {
			return true
		}
	}
	if nonEmptyMediaURL(body["video_url"]) {
		return true
	}
	items, ok := body["content"].([]interface{})
	if !ok {
		return false
	}
	for _, item := range items {
		entry, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		kind, _ := entry["type"].(string)
		role, _ := entry["role"].(string)
		if !strings.EqualFold(strings.TrimSpace(kind), "video_url") &&
			!strings.EqualFold(strings.TrimSpace(role), "reference_video") {
			continue
		}
		if nonEmptyMediaURL(entry["video_url"]) || nonEmptyMediaURL(entry["url"]) {
			return true
		}
	}
	return false
}

func sliceHasURL(v interface{}) bool {
	switch items := v.(type) {
	case []string:
		for _, item := range items {
			if strings.TrimSpace(item) != "" {
				return true
			}
		}
	case []interface{}:
		for _, item := range items {
			if s, ok := item.(string); ok && strings.TrimSpace(s) != "" {
				return true
			}
			if nonEmptyMediaURL(item) {
				return true
			}
		}
	case string:
		return strings.TrimSpace(items) != ""
	}
	return false
}

func nonEmptyMediaURL(v interface{}) bool {
	switch t := v.(type) {
	case string:
		return strings.TrimSpace(t) != ""
	case map[string]interface{}:
		if u, ok := t["url"].(string); ok && strings.TrimSpace(u) != "" {
			return true
		}
	}
	return false
}

func resolutionTierFromBody(body map[string]interface{}) string {
	if body == nil {
		return billing_setting.ResolutionTierOther
	}
	for _, key := range []string{"resolution", "size"} {
		s, ok := body[key].(string)
		if !ok {
			continue
		}
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		return billing_setting.NormalizeResolutionTier(s)
	}
	return billing_setting.ResolutionTierOther
}

func referenceVideoYuanPerSecond(modelName, tier string) (float64, bool) {
	if resolveUpstreamModel(modelName) != "sd_2.0_special" {
		return 0, false
	}
	switch tier {
	case billing_setting.ResolutionTier720p:
		return referenceVideoPrice720p, true
	case billing_setting.ResolutionTier1080p:
		return referenceVideoPrice1080p, true
	default:
		return 0, false
	}
}

// referenceVideoBillingRatio is the multiplier on ModelPrice that lifts a
// per-second price up to the reference-video rate. Absent when there is no
// usable reference video, or the configured price is already higher.
func referenceVideoBillingRatio(info *relaycommon.RelayInfo, body map[string]interface{}) (float64, bool) {
	if info == nil || !hasBillableReferenceVideo(body) || info.PriceData.ModelPrice <= 0 {
		return 0, false
	}
	price, ok := referenceVideoYuanPerSecond(info.OriginModelName, resolutionTierFromBody(body))
	if !ok {
		return 0, false
	}
	mult := billing_setting.ResolveUpstreamCostMultiplier(info.OriginModelName)
	if mult <= 0 {
		mult = 1
	}
	target := price * mult
	if target <= info.PriceData.ModelPrice {
		return 0, false
	}
	return target / info.PriceData.ModelPrice, true
}

func ykSdFormulaQuota(task *model.Task) int {
	if task == nil {
		return 0
	}
	bc := task.PrivateData.BillingContext
	if bc == nil || bc.ModelPrice <= 0 {
		return 0
	}
	sec := taskcommon.ExtractDurationSecondsFromJSON(task.Data)
	if sec <= 0 {
		return 0
	}
	return taskcommon.QuotaFromPerSecondModelPrice(bc.ModelPrice, sec, bc.GroupRatio, bc.OtherRatios)
}

// upstreamAmountQuota converts the upstream `amount` (CNY, same unit as model price)
// into quota. Group discounts cannot push the charge below what upstream billed.
func upstreamAmountQuota(task *model.Task) int {
	if task == nil || len(task.Data) == 0 {
		return 0
	}
	amount := gjson.GetBytes(task.Data, "amount").Float()
	if amount <= 0 {
		amount = gjson.GetBytes(task.Data, "data.amount").Float()
	}
	if amount <= 0 {
		return 0
	}
	group := 1.0
	mult := 1.0
	if bc := task.PrivateData.BillingContext; bc != nil {
		if bc.GroupRatio > 0 {
			group = bc.GroupRatio
		}
		if bc.UpstreamCostMultiplier > 0 {
			mult = bc.UpstreamCostMultiplier
		} else if bc.OriginModelName != "" {
			mult = billing_setting.ResolveUpstreamCostMultiplier(bc.OriginModelName)
		}
	}
	raw := taskcommon.QuotaFromUSDCost(amount, 1, mult)
	scaled := taskcommon.QuotaFromUSDCost(amount, group, mult)
	if scaled > raw {
		return scaled
	}
	return raw
}

func adjustYkSdBillingOnComplete(task *model.Task, taskResult *relaycommon.TaskInfo) int {
	if task == nil || taskResult == nil || taskResult.Status != model.TaskStatusSuccess {
		return 0
	}
	modelName := task.Properties.OriginModelName
	if bc := task.PrivateData.BillingContext; bc != nil && bc.OriginModelName != "" {
		modelName = bc.OriginModelName
	}
	if !billing_setting.IsPerSecondModel(modelName) && !isYkSdPerSecondModel(modelName) {
		return 0
	}
	formula := ykSdFormulaQuota(task)
	amountQuota := upstreamAmountQuota(task)
	floor := formula
	if task.Quota > floor {
		floor = task.Quota
	}
	// Only raise the charge. Output-only jobs are priced above upstream cost;
	// a lower amount must not refund that margin.
	if amountQuota > floor {
		return amountQuota
	}
	return formula
}
