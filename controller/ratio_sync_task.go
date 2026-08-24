package controller

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

const (
	pricingSyncSkipLowConfidence       = "low_confidence"
	pricingSyncSkipThresholdExceeded   = "threshold_exceeded"
	pricingSyncSkipBillingTypeConflict = "billing_type_conflict"
	pricingSyncSkipNewModel            = "new_model"
	pricingSyncSkipLocalNotNumeric     = "local_value_not_numeric"

	pricingSyncSampleLimit = 100
)

// pricingSyncNumericFieldOrder fixes the iteration order of the automatically
// syncable fields so task results and option writes stay deterministic.
// billing_mode/billing_expr are intentionally absent: flipping the billing
// category is never done without human review.
var pricingSyncNumericFieldOrder = []string{
	"model_ratio",
	"completion_ratio",
	"cache_ratio",
	"create_cache_ratio",
	"image_ratio",
	"audio_ratio",
	"audio_completion_ratio",
	"model_price",
}

var pricingSyncFieldOptions = map[string]struct {
	optionKey string
	localCopy func() map[string]float64
}{
	"model_ratio":            {"ModelRatio", ratio_setting.GetModelRatioCopy},
	"completion_ratio":       {"CompletionRatio", ratio_setting.GetCompletionRatioCopy},
	"cache_ratio":            {"CacheRatio", ratio_setting.GetCacheRatioCopy},
	"create_cache_ratio":     {"CreateCacheRatio", ratio_setting.GetCreateCacheRatioCopy},
	"image_ratio":            {"ImageRatio", ratio_setting.GetImageRatioCopy},
	"audio_ratio":            {"AudioRatio", ratio_setting.GetAudioRatioCopy},
	"audio_completion_ratio": {"AudioCompletionRatio", ratio_setting.GetAudioCompletionRatioCopy},
	"model_price":            {"ModelPrice", ratio_setting.GetModelPriceCopy},
}

// pricingSyncHandler runs the scheduled upstream pricing sync job. It
// automates the manual 模型定价 -> 上游价格同步 flow: fetch pricing from the
// configured upstreams, filter the differences through the safety policy, and
// apply the accepted values to the global ratio options.
type pricingSyncHandler struct{}

func (pricingSyncHandler) Type() string { return model.SystemTaskTypePricingSync }

func (pricingSyncHandler) Enabled() bool {
	setting := operation_setting.GetRatioSyncSetting()
	return setting.Enabled && strings.TrimSpace(setting.Upstreams) != ""
}

func (pricingSyncHandler) Interval() time.Duration {
	return operation_setting.GetRatioSyncSetting().SyncInterval()
}

func (pricingSyncHandler) NewPayload() any { return nil }

func (pricingSyncHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	summary, err := runPricingSyncTaskOnce(ctx)
	if err != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, summary, err)
		return
	}
	finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusSucceeded, summary, nil)
}

// CreatePricingSyncTask enqueues an on-demand pricing sync run. If a run is
// already pending or running, that task is returned instead of a new one.
func CreatePricingSyncTask(c *gin.Context) {
	task, _, err := service.EnqueueSystemTask(model.SystemTaskTypePricingSync, nil)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    task.ToResponse(),
	})
}

type pricingSyncChange struct {
	Model  string   `json:"model"`
	Field  string   `json:"field"`
	Old    *float64 `json:"old,omitempty"`
	New    float64  `json:"new"`
	Source string   `json:"source,omitempty"`
	Reason string   `json:"reason,omitempty"`
}

type pricingSyncSummary struct {
	UpstreamResults []dto.TestResult    `json:"upstream_results"`
	AppliedCount    int                 `json:"applied_count"`
	SkippedCount    int                 `json:"skipped_count"`
	AppliedFields   map[string]int      `json:"applied_fields,omitempty"`
	SkippedReasons  map[string]int      `json:"skipped_reasons,omitempty"`
	Applied         []pricingSyncChange `json:"applied,omitempty"`
	Skipped         []pricingSyncChange `json:"skipped,omitempty"`
}

// pricingSyncPolicy is the parsed, validated form of RatioSyncSetting used by
// buildPricingSyncPlan.
type pricingSyncPolicy struct {
	fields           map[string]bool
	allowList        map[string]bool
	blockList        map[string]bool
	thresholdPercent float64
	addNewModels     bool
}

type pricingSyncPlan struct {
	changes map[string]map[string]float64 // field -> model -> new value
	applied []pricingSyncChange
	skipped []pricingSyncChange
}

func buildPricingSyncPolicy(setting *operation_setting.RatioSyncSetting) (pricingSyncPolicy, error) {
	policy := pricingSyncPolicy{
		fields:           make(map[string]bool),
		allowList:        parsePricingSyncModelList(setting.ModelAllowList),
		blockList:        parsePricingSyncModelList(setting.ModelBlockList),
		thresholdPercent: setting.IncreaseThresholdPercent,
		addNewModels:     setting.AddNewModels,
	}
	if policy.thresholdPercent < 0 {
		policy.thresholdPercent = 0
	}

	trimmed := strings.TrimSpace(setting.SyncFields)
	if trimmed == "" {
		for _, field := range pricingSyncNumericFieldOrder {
			policy.fields[field] = true
		}
		return policy, nil
	}

	var fields []string
	if err := common.UnmarshalJsonStr(trimmed, &fields); err != nil {
		return policy, fmt.Errorf("invalid ratio sync fields config: %w", err)
	}
	for _, field := range fields {
		if numericPricingSyncFields[field] {
			policy.fields[field] = true
		}
	}
	if len(policy.fields) == 0 {
		return policy, fmt.Errorf("ratio sync fields config selects no syncable field")
	}
	return policy, nil
}

func parsePricingSyncModelList(raw string) map[string]bool {
	models := make(map[string]bool)
	for _, part := range strings.FieldsFunc(raw, func(r rune) bool { return r == '\n' || r == ',' }) {
		if name := strings.TrimSpace(part); name != "" {
			models[name] = true
		}
	}
	return models
}

// resolvePricingSyncUpstreams turns the configured upstream references into
// fetchable DTOs, resolving channel base URLs at run time so a changed channel
// URL is picked up on the next run. It returns the unique upstream names in
// configured order (the multi-upstream trust order) and one error result per
// unresolvable entry.
func resolvePricingSyncUpstreams(cfgs []operation_setting.RatioSyncUpstream) ([]dto.UpstreamDTO, []string, []dto.TestResult) {
	channelIds := make([]int, 0, len(cfgs))
	for _, cfg := range cfgs {
		if cfg.ID > 0 {
			channelIds = append(channelIds, cfg.ID)
		}
	}
	channelById := make(map[int]*model.Channel, len(channelIds))
	var channelQueryErr error
	if len(channelIds) > 0 {
		channels, err := model.GetChannelsByIds(channelIds)
		if err != nil {
			channelQueryErr = err
		} else {
			for _, ch := range channels {
				channelById[ch.Id] = ch
			}
		}
	}

	var upstreams []dto.UpstreamDTO
	var priority []string
	var failures []dto.TestResult

	for _, cfg := range cfgs {
		var upstream dto.UpstreamDTO
		switch cfg.ID {
		case officialRatioPresetID:
			endpoint := cfg.Endpoint
			if endpoint == "" {
				endpoint = officialRatioPresetEndpoint
			}
			upstream = dto.UpstreamDTO{ID: officialRatioPresetID, Name: officialRatioPresetName, BaseURL: officialRatioPresetBaseURL, Endpoint: endpoint}
		case modelsDevPresetID:
			endpoint := cfg.Endpoint
			if endpoint == "" {
				endpoint = modelsDevPath
			}
			upstream = dto.UpstreamDTO{ID: modelsDevPresetID, Name: modelsDevPresetName, BaseURL: modelsDevPresetBaseURL, Endpoint: endpoint}
		default:
			name := fmt.Sprintf("channel(%d)", cfg.ID)
			if channelQueryErr != nil {
				failures = append(failures, dto.TestResult{Name: name, Status: "error", Error: "failed to query channel: " + channelQueryErr.Error()})
				continue
			}
			ch, ok := channelById[cfg.ID]
			if !ok {
				failures = append(failures, dto.TestResult{Name: name, Status: "error", Error: "channel not found"})
				continue
			}
			base := ch.GetBaseURL()
			if !strings.HasPrefix(base, "http") {
				failures = append(failures, dto.TestResult{Name: fmt.Sprintf("%s(%d)", ch.Name, ch.Id), Status: "error", Error: "channel has no valid base url"})
				continue
			}
			upstream = dto.UpstreamDTO{ID: ch.Id, Name: ch.Name, BaseURL: strings.TrimRight(base, "/"), Endpoint: cfg.Endpoint}
		}
		upstreams = append(upstreams, upstream)
		priority = append(priority, fmt.Sprintf("%s(%d)", upstream.Name, upstream.ID))
	}

	return upstreams, priority, failures
}

// buildPricingSyncPlan filters the fetched differences through the safety
// policy and returns the values safe to auto-apply. It never removes local
// entries and never touches billing_mode/billing_expr; every rejected value is
// reported with a reason. Pure function; the unit tests live on this.
func buildPricingSyncPlan(
	differences map[string]map[string]dto.DifferenceItem,
	localData map[string]any,
	policy pricingSyncPolicy,
	upstreamPriority []string,
) pricingSyncPlan {
	plan := pricingSyncPlan{changes: make(map[string]map[string]float64)}

	localModelRatio := valueMap(localData["model_ratio"])
	localModelPrice := valueMap(localData["model_price"])
	localModels := make(map[string]bool)
	for _, field := range pricingSyncNumericFieldOrder {
		for modelName := range valueMap(localData[field]) {
			localModels[modelName] = true
		}
	}

	modelNames := make([]string, 0, len(differences))
	for modelName := range differences {
		modelNames = append(modelNames, modelName)
	}
	sort.Strings(modelNames)

	for _, modelName := range modelNames {
		if len(policy.allowList) > 0 && !policy.allowList[modelName] {
			continue
		}
		if policy.blockList[modelName] {
			continue
		}

		for _, field := range pricingSyncNumericFieldOrder {
			if !policy.fields[field] {
				continue
			}
			item, ok := differences[modelName][field]
			if !ok {
				continue
			}

			// Pick the first upstream in trust order offering a concrete,
			// confident numeric value.
			var candidate float64
			var source string
			var lowConfidence *pricingSyncChange
			found := false
			for _, upstreamName := range upstreamPriority {
				value, ok := item.Upstreams[upstreamName]
				if !ok || value == nil || value == "same" {
					continue
				}
				parsed, ok := asFloat64(value)
				if !ok {
					continue
				}
				if !item.Confidence[upstreamName] {
					if lowConfidence == nil {
						lowConfidence = &pricingSyncChange{Model: modelName, Field: field, New: parsed, Source: upstreamName, Reason: pricingSyncSkipLowConfidence}
					}
					continue
				}
				candidate = parsed
				source = upstreamName
				found = true
				break
			}
			if !found {
				if lowConfidence != nil {
					plan.skipped = append(plan.skipped, *lowConfidence)
				}
				continue
			}

			skip := func(reason string, old *float64) {
				plan.skipped = append(plan.skipped, pricingSyncChange{Model: modelName, Field: field, Old: old, New: candidate, Source: source, Reason: reason})
			}

			// Never flip a model between per-call pricing and ratio pricing.
			if _, priced := localModelPrice[modelName]; priced && (field == "model_ratio" || field == "completion_ratio") {
				skip(pricingSyncSkipBillingTypeConflict, nil)
				continue
			}
			if _, ratioed := localModelRatio[modelName]; ratioed && field == "model_price" {
				skip(pricingSyncSkipBillingTypeConflict, nil)
				continue
			}

			if item.Current == nil {
				if !localModels[modelName] && !policy.addNewModels {
					skip(pricingSyncSkipNewModel, nil)
					continue
				}
			} else {
				current, ok := asFloat64(item.Current)
				if !ok {
					skip(pricingSyncSkipLocalNotNumeric, nil)
					continue
				}
				if candidate > current {
					// Increases are bounded by the threshold; a value rising
					// from zero has no meaningful baseline and is always held
					// back for review. Decreases are applied unconditionally.
					allowed := current * (1 + policy.thresholdPercent/100)
					if current <= 0 || candidate > allowed+floatEpsilon {
						skip(pricingSyncSkipThresholdExceeded, &current)
						continue
					}
				}
				currentCopy := current
				plan.applyChange(field, modelName, candidate, source, &currentCopy)
				continue
			}
			plan.applyChange(field, modelName, candidate, source, nil)
		}
	}

	return plan
}

func (p *pricingSyncPlan) applyChange(field, modelName string, value float64, source string, old *float64) {
	if p.changes[field] == nil {
		p.changes[field] = make(map[string]float64)
	}
	rounded := roundRatioValue(value)
	p.changes[field][modelName] = rounded
	p.applied = append(p.applied, pricingSyncChange{Model: modelName, Field: field, Old: old, New: rounded, Source: source})
}

// applyPricingSyncPlan merges the planned values into the current in-memory
// pricing maps and persists every changed map in one transaction through the
// same option pipeline the manual sync uses. Untouched fields are never
// re-serialized.
func applyPricingSyncPlan(changes map[string]map[string]float64) error {
	updates := make(map[string]string, len(changes))
	for field, modelChanges := range changes {
		if len(modelChanges) == 0 {
			continue
		}
		spec, ok := pricingSyncFieldOptions[field]
		if !ok {
			return fmt.Errorf("unknown pricing sync field: %s", field)
		}
		merged := spec.localCopy()
		if merged == nil {
			merged = make(map[string]float64)
		}
		for modelName, value := range modelChanges {
			merged[modelName] = value
		}
		data, err := common.Marshal(merged)
		if err != nil {
			return fmt.Errorf("failed to marshal %s: %w", spec.optionKey, err)
		}
		updates[spec.optionKey] = string(data)
	}
	if len(updates) == 0 {
		return nil
	}
	return model.UpdateOptionsBulk(updates)
}

func runPricingSyncTaskOnce(ctx context.Context) (*pricingSyncSummary, error) {
	setting := operation_setting.GetRatioSyncSetting()

	upstreamCfgs, err := operation_setting.ParseRatioSyncUpstreams(setting.Upstreams)
	if err != nil {
		return nil, err
	}
	if len(upstreamCfgs) == 0 {
		return nil, fmt.Errorf("pricing sync has no upstreams configured")
	}

	policy, err := buildPricingSyncPolicy(setting)
	if err != nil {
		return nil, err
	}

	upstreams, priority, resolveFailures := resolvePricingSyncUpstreams(upstreamCfgs)
	if len(upstreams) == 0 {
		return &pricingSyncSummary{UpstreamResults: resolveFailures}, fmt.Errorf("no resolvable pricing sync upstream")
	}

	differences, testResults, err := fetchUpstreamRatioDifferences(ctx, dto.UpstreamRequest{Upstreams: upstreams})
	if err != nil {
		return &pricingSyncSummary{UpstreamResults: resolveFailures}, err
	}

	allResults := append(resolveFailures, testResults...)
	summary := &pricingSyncSummary{UpstreamResults: allResults}

	succeeded := false
	var firstError string
	for _, result := range testResults {
		if result.Status == "success" {
			succeeded = true
		} else if firstError == "" {
			firstError = fmt.Sprintf("%s: %s", result.Name, result.Error)
		}
	}
	if !succeeded {
		return summary, fmt.Errorf("all pricing sync upstreams failed (%s)", firstError)
	}

	plan := buildPricingSyncPlan(differences, getLocalPricingSyncData(), policy, priority)
	if err := applyPricingSyncPlan(plan.changes); err != nil {
		return summary, err
	}

	summary.AppliedCount = len(plan.applied)
	summary.SkippedCount = len(plan.skipped)
	summary.AppliedFields = make(map[string]int)
	for _, change := range plan.applied {
		summary.AppliedFields[change.Field]++
	}
	summary.SkippedReasons = make(map[string]int)
	for _, change := range plan.skipped {
		summary.SkippedReasons[change.Reason]++
	}
	summary.Applied = plan.applied
	if len(summary.Applied) > pricingSyncSampleLimit {
		summary.Applied = summary.Applied[:pricingSyncSampleLimit]
	}
	summary.Skipped = plan.skipped
	if len(summary.Skipped) > pricingSyncSampleLimit {
		summary.Skipped = summary.Skipped[:pricingSyncSampleLimit]
	}

	return summary, nil
}
