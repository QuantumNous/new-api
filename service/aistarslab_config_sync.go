package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
)

const (
	aistarslabDefaultConfigURL       = "https://api.video.aistarslab.com/openapi/generation/config"
	aistarslabDefaultChannelID       = 17
	aistarslabDefaultCreditRate      = 100
	aistarslabDefaultMarkupRate      = 1.3
	aistarslabDefaultIntervalMinutes = 30
	aistarslabRequestTimeout         = 30 * time.Second
)

var (
	aistarslabSeedanceAliasPattern = regexp.MustCompile(`^seedance-[a-z0-9-]+-c[0-9]+$`)
	aistarslabRawSeedancePattern   = regexp.MustCompile(`^([0-9]+:)?seedance-2\.0`)
	aistarslabSyncOnce             sync.Once
	aistarslabSyncRunning          atomic.Bool
)

type AistarsLabSyncRequest struct {
	DryRun     bool    `json:"dry_run"`
	ChannelID  int     `json:"channel_id"`
	ConfigURL  string  `json:"config_url"`
	CreditRate float64 `json:"credit_rate"`
	MarkupRate float64 `json:"markup_rate"`
}

type AistarsLabSyncResult struct {
	DryRun          bool                       `json:"dry_run"`
	ChannelID       int                        `json:"channel_id"`
	ConfigURL       string                     `json:"config_url"`
	CreditRate      float64                    `json:"credit_rate"`
	MarkupRate      float64                    `json:"markup_rate"`
	TotalModels     int                        `json:"total_models"`
	AddedModels     []string                   `json:"added_models"`
	RemovedModels   []string                   `json:"removed_models"`
	PriceChanges    []AistarsLabPriceChange    `json:"price_changes"`
	TaskUnitChanges []AistarsLabTaskUnitChange `json:"task_unit_changes"`
	MappingChanges  []AistarsLabMappingChange  `json:"mapping_changes"`
	Models          []AistarsLabSeedanceModel  `json:"models"`
}

type AistarsLabPriceChange struct {
	Model string   `json:"model"`
	Old   *float64 `json:"old,omitempty"`
	New   *float64 `json:"new,omitempty"`
}

type AistarsLabTaskUnitChange struct {
	Model string `json:"model"`
	Old   string `json:"old,omitempty"`
	New   string `json:"new,omitempty"`
}

type AistarsLabMappingChange struct {
	Model string `json:"model"`
	Old   string `json:"old,omitempty"`
	New   string `json:"new,omitempty"`
}

type AistarsLabSeedanceModel struct {
	PublicModel       string   `json:"public_model"`
	UpstreamModel     string   `json:"upstream_model"`
	Channel           string   `json:"channel"`
	Quality           string   `json:"quality"`
	BillingUnit       string   `json:"billing_unit"`
	Price             float64  `json:"price"`
	RawCredits        float64  `json:"raw_credits"`
	Modes             []string `json:"modes,omitempty"`
	AspectRatios      []string `json:"aspect_ratios,omitempty"`
	DurationMin       *int     `json:"duration_min,omitempty"`
	DurationMax       *int     `json:"duration_max,omitempty"`
	InputImagesMax    int      `json:"input_images_max"`
	InputVideosMax    int      `json:"input_videos_max"`
	InputAudiosMax    int      `json:"input_audios_max"`
	DefaultOption     bool     `json:"default_option"`
	SourceTitle       string   `json:"source_title,omitempty"`
	SourceDescription string   `json:"source_description,omitempty"`
}

type aistarsLabConfigResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		VideoConfig []aistarsLabVideoConfig `json:"videoConfig"`
	} `json:"data"`
}

type aistarsLabVideoConfig struct {
	Channel       string                  `json:"channel"`
	Title         string                  `json:"title"`
	Description   string                  `json:"description"`
	DefaultOption bool                    `json:"defaultOption"`
	Models        []aistarsLabConfigModel `json:"models"`
}

type aistarsLabConfigModel struct {
	Model          string              `json:"model"`
	Label          string              `json:"label"`
	Qualities      []aistarsLabQuality `json:"qualities"`
	Modes          []string            `json:"modes"`
	AspectRatios   []string            `json:"aspectRatios"`
	Duration       aistarsLabDuration  `json:"duration"`
	InputImagesMax int                 `json:"inputImagesMax"`
	InputVideosMax int                 `json:"inputVideosMax"`
	InputAudiosMax int                 `json:"inputAudiosMax"`
}

type aistarsLabQuality struct {
	Quality string `json:"quality"`
	Pricing struct {
		Type    string  `json:"type"`
		Credits float64 `json:"credits"`
	} `json:"pricing"`
}

type aistarsLabDuration struct {
	Min     *int  `json:"min"`
	Max     *int  `json:"max"`
	Options []int `json:"options"`
}

func StartAistarsLabConfigSyncTask() {
	aistarslabSyncOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		if !common.GetEnvOrDefaultBool("AISTARSLAB_CONFIG_SYNC_ENABLED", false) {
			common.SysLog("AistarsLab config sync task disabled by AISTARSLAB_CONFIG_SYNC_ENABLED")
			return
		}

		intervalMinutes := common.GetEnvOrDefault("AISTARSLAB_CONFIG_SYNC_INTERVAL_MINUTES", aistarslabDefaultIntervalMinutes)
		if intervalMinutes < 1 {
			intervalMinutes = aistarslabDefaultIntervalMinutes
		}
		interval := time.Duration(intervalMinutes) * time.Minute

		gopool.Go(func() {
			common.SysLog(fmt.Sprintf("AistarsLab config sync task started: interval=%s", interval))
			runAistarsLabConfigSyncOnce()
			ticker := time.NewTicker(interval)
			defer ticker.Stop()
			for range ticker.C {
				runAistarsLabConfigSyncOnce()
			}
		})
	})
}

func runAistarsLabConfigSyncOnce() {
	if !aistarslabSyncRunning.CompareAndSwap(false, true) {
		return
	}
	defer aistarslabSyncRunning.Store(false)

	result, err := SyncAistarsLabConfig(context.Background(), AistarsLabSyncRequest{})
	if err != nil {
		logger.LogError(context.Background(), "AistarsLab config sync failed: "+err.Error())
		return
	}
	logger.LogInfo(context.Background(), fmt.Sprintf("AistarsLab config sync finished: models=%d added=%d removed=%d price_changes=%d",
		result.TotalModels, len(result.AddedModels), len(result.RemovedModels), len(result.PriceChanges)))
}

func SyncAistarsLabConfig(ctx context.Context, req AistarsLabSyncRequest) (*AistarsLabSyncResult, error) {
	normalized := normalizeAistarsLabSyncRequest(req)
	apiKey, err := getAistarsLabConfigAPIKey(normalized.ChannelID)
	if err != nil {
		return nil, err
	}
	config, err := fetchAistarsLabConfig(ctx, normalized.ConfigURL, apiKey)
	if err != nil {
		return nil, err
	}
	models := flattenAistarsLabSeedanceModels(config.Data.VideoConfig, normalized.CreditRate, normalized.MarkupRate)
	if len(models) == 0 {
		return nil, fmt.Errorf("no seedance models found in AistarsLab config")
	}
	result := buildAistarsLabSyncResult(normalized, models)
	if normalized.DryRun {
		return result, nil
	}
	if err := applyAistarsLabSeedanceSync(normalized.ChannelID, models); err != nil {
		return nil, err
	}
	model.RefreshPricing()
	return result, nil
}

func normalizeAistarsLabSyncRequest(req AistarsLabSyncRequest) AistarsLabSyncRequest {
	if req.ChannelID <= 0 {
		req.ChannelID = common.GetEnvOrDefault("AISTARSLAB_CONFIG_SYNC_CHANNEL_ID", aistarslabDefaultChannelID)
	}
	if strings.TrimSpace(req.ConfigURL) == "" {
		req.ConfigURL = strings.TrimSpace(common.GetEnvOrDefaultString("AISTARSLAB_CONFIG_URL", aistarslabDefaultConfigURL))
	}
	if req.CreditRate <= 0 {
		req.CreditRate = getAistarsLabEnvFloat("AISTARSLAB_CREDIT_RATE", aistarslabDefaultCreditRate)
	}
	if req.MarkupRate <= 0 {
		req.MarkupRate = getAistarsLabEnvFloat("AISTARSLAB_MARKUP_RATE", aistarslabDefaultMarkupRate)
	}
	return req
}

func getAistarsLabEnvFloat(env string, defaultValue float64) float64 {
	raw := strings.TrimSpace(common.GetEnvOrDefaultString(env, ""))
	if raw == "" {
		return defaultValue
	}
	value, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return defaultValue
	}
	return value
}

func getAistarsLabConfigAPIKey(channelID int) (string, error) {
	if key := strings.TrimSpace(common.GetEnvOrDefaultString("AISTARSLAB_API_KEY", "")); key != "" {
		return strings.TrimPrefix(key, "Bearer "), nil
	}
	channel, err := model.GetChannelById(channelID, true)
	if err != nil {
		return "", fmt.Errorf("get sync channel %d failed: %w", channelID, err)
	}
	key, _, apiErr := channel.GetNextEnabledKey()
	if apiErr != nil {
		return "", fmt.Errorf("get sync channel key failed: %s", apiErr.Error())
	}
	key = strings.TrimSpace(strings.TrimPrefix(key, "Bearer "))
	if key == "" {
		return "", fmt.Errorf("AistarsLab API key is empty")
	}
	return key, nil
}

func fetchAistarsLabConfig(ctx context.Context, configURL, apiKey string) (*aistarsLabConfigResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, aistarslabRequestTimeout)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, configURL, nil)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	httpReq.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("AistarsLab config returned %s", resp.Status)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 10<<20))
	if err != nil {
		return nil, err
	}
	var parsed aistarsLabConfigResponse
	if err := common.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}
	if parsed.Code != 0 {
		return nil, fmt.Errorf("AistarsLab config error: code=%d msg=%s", parsed.Code, parsed.Msg)
	}
	return &parsed, nil
}

func flattenAistarsLabSeedanceModels(configs []aistarsLabVideoConfig, creditRate, markupRate float64) []AistarsLabSeedanceModel {
	byAlias := make(map[string]AistarsLabSeedanceModel)
	for _, videoConfig := range configs {
		channel := strings.TrimSpace(videoConfig.Channel)
		if channel == "" {
			continue
		}
		for _, configModel := range videoConfig.Models {
			if !strings.HasPrefix(configModel.Model, "seedance-") {
				continue
			}
			for _, quality := range configModel.Qualities {
				billingUnit := aistarsLabBillingUnit(quality.Pricing.Type)
				if billingUnit == "" {
					continue
				}
				publicModel := buildAistarsLabSeedanceAlias(configModel.Model, quality.Quality, channel)
				if publicModel == "" {
					continue
				}
				item := AistarsLabSeedanceModel{
					PublicModel:       publicModel,
					UpstreamModel:     channel + ":" + configModel.Model,
					Channel:           channel,
					Quality:           strings.ToLower(strings.TrimSpace(quality.Quality)),
					BillingUnit:       billingUnit,
					Price:             roundAistarsLabPrice(quality.Pricing.Credits / creditRate * markupRate),
					RawCredits:        quality.Pricing.Credits,
					Modes:             append([]string(nil), configModel.Modes...),
					AspectRatios:      append([]string(nil), configModel.AspectRatios...),
					DurationMin:       configModel.Duration.Min,
					DurationMax:       configModel.Duration.Max,
					InputImagesMax:    configModel.InputImagesMax,
					InputVideosMax:    configModel.InputVideosMax,
					InputAudiosMax:    configModel.InputAudiosMax,
					DefaultOption:     videoConfig.DefaultOption,
					SourceTitle:       videoConfig.Title,
					SourceDescription: videoConfig.Description,
				}
				if existing, ok := byAlias[publicModel]; ok && existing.DefaultOption && !item.DefaultOption {
					continue
				}
				byAlias[publicModel] = item
			}
		}
	}

	models := make([]AistarsLabSeedanceModel, 0, len(byAlias))
	for _, item := range byAlias {
		models = append(models, item)
	}
	sort.Slice(models, func(i, j int) bool {
		return models[i].PublicModel < models[j].PublicModel
	})
	return models
}

func buildAistarsLabSeedanceAlias(upstreamModel, quality, channel string) string {
	quality = strings.ToLower(strings.TrimSpace(quality))
	upstreamModel = strings.ToLower(strings.TrimSpace(upstreamModel))
	if quality == "" || upstreamModel == "" || channel == "" {
		return ""
	}
	suffix := strings.TrimPrefix(upstreamModel, "seedance-2.0")
	suffix = strings.Trim(suffix, "-")
	parts := make([]string, 0)
	for _, part := range strings.Split(suffix, "-") {
		part = strings.TrimSpace(part)
		if part == "" || part == quality {
			continue
		}
		parts = append(parts, part)
	}
	aliasParts := []string{"seedance", quality}
	aliasParts = append(aliasParts, parts...)
	aliasParts = append(aliasParts, "c"+channel)
	return strings.Join(aliasParts, "-")
}

func aistarsLabBillingUnit(pricingType string) string {
	switch strings.TrimSpace(strings.ToLower(pricingType)) {
	case "fixed_total":
		return ratio_setting.TaskBillingUnitPerItem
	case "per_second":
		return ratio_setting.TaskBillingUnitPerSecond
	default:
		return ""
	}
}

func roundAistarsLabPrice(price float64) float64 {
	return math.Round(price*100) / 100
}

func buildAistarsLabSyncResult(req AistarsLabSyncRequest, models []AistarsLabSeedanceModel) *AistarsLabSyncResult {
	result := &AistarsLabSyncResult{
		DryRun:      req.DryRun,
		ChannelID:   req.ChannelID,
		ConfigURL:   req.ConfigURL,
		CreditRate:  req.CreditRate,
		MarkupRate:  req.MarkupRate,
		TotalModels: len(models),
		Models:      models,
	}
	newPrices := make(map[string]float64, len(models))
	newUnits := make(map[string]string, len(models))
	newMappings := make(map[string]string, len(models))
	for _, item := range models {
		newPrices[item.PublicModel] = item.Price
		newUnits[item.PublicModel] = item.BillingUnit
		newMappings[item.PublicModel] = item.UpstreamModel
	}

	oldPrices := ratio_setting.GetModelPriceCopy()
	oldUnits := ratio_setting.GetTaskBillingUnitCopy()
	oldMappings := getAistarsLabChannelMapping(req.ChannelID)

	for modelName, newPrice := range newPrices {
		if oldPrice, ok := oldPrices[modelName]; !ok {
			result.AddedModels = append(result.AddedModels, modelName)
			price := newPrice
			result.PriceChanges = append(result.PriceChanges, AistarsLabPriceChange{Model: modelName, New: &price})
		} else if math.Abs(oldPrice-newPrice) > 1e-9 {
			old := oldPrice
			price := newPrice
			result.PriceChanges = append(result.PriceChanges, AistarsLabPriceChange{Model: modelName, Old: &old, New: &price})
		}
		if oldUnit := oldUnits[modelName]; oldUnit != newUnits[modelName] {
			result.TaskUnitChanges = append(result.TaskUnitChanges, AistarsLabTaskUnitChange{Model: modelName, Old: oldUnit, New: newUnits[modelName]})
		}
		if oldMapping := oldMappings[modelName]; oldMapping != newMappings[modelName] {
			result.MappingChanges = append(result.MappingChanges, AistarsLabMappingChange{Model: modelName, Old: oldMapping, New: newMappings[modelName]})
		}
	}
	for modelName, oldPrice := range oldPrices {
		if !isAistarsLabSeedanceAlias(modelName) {
			continue
		}
		if _, ok := newPrices[modelName]; ok {
			continue
		}
		result.RemovedModels = append(result.RemovedModels, modelName)
		old := oldPrice
		result.PriceChanges = append(result.PriceChanges, AistarsLabPriceChange{Model: modelName, Old: &old})
	}

	sort.Strings(result.AddedModels)
	sort.Strings(result.RemovedModels)
	sort.Slice(result.PriceChanges, func(i, j int) bool { return result.PriceChanges[i].Model < result.PriceChanges[j].Model })
	sort.Slice(result.TaskUnitChanges, func(i, j int) bool { return result.TaskUnitChanges[i].Model < result.TaskUnitChanges[j].Model })
	sort.Slice(result.MappingChanges, func(i, j int) bool { return result.MappingChanges[i].Model < result.MappingChanges[j].Model })
	return result
}

func applyAistarsLabSeedanceSync(channelID int, modelsToSync []AistarsLabSeedanceModel) error {
	priceMap := ratio_setting.GetModelPriceCopy()
	unitMap := ratio_setting.GetTaskBillingUnitCopy()

	currentAliases := make(map[string]struct{}, len(modelsToSync))
	for _, item := range modelsToSync {
		currentAliases[item.PublicModel] = struct{}{}
		priceMap[item.PublicModel] = item.Price
		unitMap[item.PublicModel] = item.BillingUnit
	}
	for modelName := range priceMap {
		if isAistarsLabSeedanceAlias(modelName) {
			if _, ok := currentAliases[modelName]; !ok {
				delete(priceMap, modelName)
			}
		}
	}
	for modelName := range unitMap {
		if isAistarsLabSeedanceAlias(modelName) {
			if _, ok := currentAliases[modelName]; !ok {
				delete(unitMap, modelName)
			}
		}
	}

	priceJSON, err := common.Marshal(priceMap)
	if err != nil {
		return err
	}
	unitJSON, err := common.Marshal(unitMap)
	if err != nil {
		return err
	}
	if err := model.UpdateOption("ModelPrice", string(priceJSON)); err != nil {
		return err
	}
	if err := model.UpdateOption("TaskBillingUnit", string(unitJSON)); err != nil {
		return err
	}
	if err := upsertAistarsLabSeedanceModelMeta(modelsToSync); err != nil {
		return err
	}
	if err := disableAistarsLabRawSeedanceModelMeta(modelsToSync); err != nil {
		return err
	}
	return updateAistarsLabChannelModels(channelID, modelsToSync)
}

func upsertAistarsLabSeedanceModelMeta(modelsToSync []AistarsLabSeedanceModel) error {
	now := common.GetTimestamp()
	activeAliases := make([]string, 0, len(modelsToSync))
	for _, item := range modelsToSync {
		activeAliases = append(activeAliases, item.PublicModel)
		meta := model.Model{
			ModelName:    item.PublicModel,
			Description:  buildAistarsLabDescription(item),
			Icon:         "Jimeng.Color",
			Tags:         buildAistarsLabTags(item),
			VendorID:     17,
			Status:       1,
			SyncOfficial: 0,
			UpdatedTime:  now,
			CreatedTime:  now,
			NameRule:     model.NameRuleExact,
		}
		var existing model.Model
		err := model.DB.Where("model_name = ?", item.PublicModel).First(&existing).Error
		if err == nil {
			existing.Description = meta.Description
			existing.Icon = meta.Icon
			existing.Tags = meta.Tags
			existing.VendorID = meta.VendorID
			existing.Status = meta.Status
			existing.SyncOfficial = meta.SyncOfficial
			existing.NameRule = meta.NameRule
			if err := existing.Update(); err != nil {
				return err
			}
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if err := meta.Insert(); err != nil {
			return err
		}
	}
	if len(activeAliases) > 0 {
		if err := model.DB.Model(&model.Model{}).
			Where("model_name LIKE ? AND model_name NOT IN ?", "seedance-%-c%", activeAliases).
			Update("status", 0).Error; err != nil {
			return err
		}
	}
	return nil
}

func disableAistarsLabRawSeedanceModelMeta(modelsToSync []AistarsLabSeedanceModel) error {
	now := common.GetTimestamp()
	seen := make(map[string]struct{})
	for _, item := range modelsToSync {
		rawModel := strings.TrimSpace(item.UpstreamModel)
		if rawModel == "" {
			continue
		}
		if _, ok := seen[rawModel]; ok {
			continue
		}
		seen[rawModel] = struct{}{}
		meta := model.Model{
			ModelName:    rawModel,
			Description:  "Hidden raw Seedance upstream model",
			Icon:         "Jimeng.Color",
			Tags:         "video,seedance,raw",
			VendorID:     17,
			Status:       0,
			SyncOfficial: 0,
			UpdatedTime:  now,
			CreatedTime:  now,
			NameRule:     model.NameRuleExact,
		}
		var existing model.Model
		err := model.DB.Where("model_name = ?", rawModel).First(&existing).Error
		if err == nil {
			existing.Description = meta.Description
			existing.Icon = meta.Icon
			existing.Tags = meta.Tags
			existing.VendorID = meta.VendorID
			existing.Status = 0
			existing.SyncOfficial = meta.SyncOfficial
			existing.NameRule = meta.NameRule
			if err := existing.Update(); err != nil {
				return err
			}
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if err := meta.Insert(); err != nil {
			return err
		}
	}
	return nil
}

func buildAistarsLabDescription(item AistarsLabSeedanceModel) string {
	unit := "按秒计费"
	if item.BillingUnit == ratio_setting.TaskBillingUnitPerItem {
		unit = "按条计费"
	}
	return fmt.Sprintf("Seedance 2.0 %s，渠道 %s，%s", item.Quality, item.Channel, unit)
}

func buildAistarsLabTags(item AistarsLabSeedanceModel) string {
	tags := []string{"video", "seedance"}
	if item.BillingUnit == ratio_setting.TaskBillingUnitPerItem {
		tags = append(tags, "按条")
	} else {
		tags = append(tags, "按秒")
	}
	if strings.Contains(item.PublicModel, "fast") {
		tags = append(tags, "fast")
	}
	if strings.Contains(item.PublicModel, "4img") {
		tags = append(tags, "4img")
	}
	if common.StringsContains(item.Modes, "frames2video") {
		tags = append(tags, "首尾帧")
	}
	return strings.Join(tags, ",")
}

func updateAistarsLabChannelModels(channelID int, modelsToSync []AistarsLabSeedanceModel) error {
	channel, err := model.GetChannelById(channelID, true)
	if err != nil {
		return err
	}
	models := filterOutAistarsLabSeedanceAliases(channel.GetModels())
	mapping := parseStringMap(channel.GetModelMapping())

	for key := range mapping {
		if isAistarsLabSeedanceAlias(key) || isAistarsLabRawSeedanceModel(key) {
			delete(mapping, key)
		}
	}
	for _, item := range modelsToSync {
		models = append(models, item.PublicModel)
		mapping[item.PublicModel] = item.UpstreamModel
	}
	sort.Strings(models)
	mappingBytes, err := common.Marshal(mapping)
	if err != nil {
		return err
	}
	mappingStr := string(mappingBytes)
	channel.Models = strings.Join(models, ",")
	channel.ModelMapping = &mappingStr
	if err := channel.Update(); err != nil {
		return err
	}
	return nil
}

func filterOutAistarsLabSeedanceAliases(models []string) []string {
	out := make([]string, 0, len(models))
	seen := make(map[string]struct{})
	for _, modelName := range models {
		modelName = strings.TrimSpace(modelName)
		if modelName == "" || isAistarsLabSeedanceAlias(modelName) || isAistarsLabRawSeedanceModel(modelName) {
			continue
		}
		if _, ok := seen[modelName]; ok {
			continue
		}
		seen[modelName] = struct{}{}
		out = append(out, modelName)
	}
	return out
}

func getAistarsLabChannelMapping(channelID int) map[string]string {
	channel, err := model.GetChannelById(channelID, true)
	if err != nil {
		return map[string]string{}
	}
	return parseStringMap(channel.GetModelMapping())
}

func parseStringMap(raw string) map[string]string {
	result := make(map[string]string)
	if strings.TrimSpace(raw) == "" {
		return result
	}
	_ = common.Unmarshal([]byte(raw), &result)
	return result
}

func isAistarsLabSeedanceAlias(modelName string) bool {
	return aistarslabSeedanceAliasPattern.MatchString(modelName)
}

func isAistarsLabRawSeedanceModel(modelName string) bool {
	return aistarslabRawSeedancePattern.MatchString(strings.TrimSpace(modelName))
}
