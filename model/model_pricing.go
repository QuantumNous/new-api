package model

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"gorm.io/gorm"
)

const ModelPricingRevisionKey = "ModelPricingRevision"

var pricingOptionKeys = []string{
	"ModelPrice", "ModelRatio", "CompletionRatio", "CacheRatio", "CreateCacheRatio",
	"ImageRatio", "AudioRatio", "AudioCompletionRatio", "billing_setting.billing_mode", "billing_setting.billing_expr",
}

type ModelPricing struct {
	Mode                 string   `json:"mode"`
	ModelPrice           *float64 `json:"model_price,omitempty"`
	ModelRatio           *float64 `json:"model_ratio,omitempty"`
	CompletionRatio      *float64 `json:"completion_ratio,omitempty"`
	CacheRatio           *float64 `json:"cache_ratio,omitempty"`
	CreateCacheRatio     *float64 `json:"create_cache_ratio,omitempty"`
	ImageRatio           *float64 `json:"image_ratio,omitempty"`
	AudioRatio           *float64 `json:"audio_ratio,omitempty"`
	AudioCompletionRatio *float64 `json:"audio_completion_ratio,omitempty"`
	BillingExpr          *string  `json:"billing_expr,omitempty"`
}

type ModelPricingUpdate struct {
	ModelName string       `json:"model_name"`
	Pricing   ModelPricing `json:"pricing"`
}

type ModelPricingRow struct {
	ModelName             string       `json:"model_name"`
	HasChannel            bool         `json:"has_channel"`
	Configured            bool         `json:"configured"`
	CompletionRatioLocked bool         `json:"completion_ratio_locked"`
	Pricing               ModelPricing `json:"pricing"`
}

type PricingRevisionConflict struct{ CurrentRevision int64 }

func (e *PricingRevisionConflict) Error() string {
	return fmt.Sprintf("model pricing revision is stale; current revision is %d", e.CurrentRevision)
}

func IsCanonicalPricingOption(key string) bool {
	for _, pricingKey := range pricingOptionKeys {
		if key == pricingKey {
			return true
		}
	}
	return false
}

func currentPricingValues() map[string]string {
	return map[string]string{
		"ModelPrice":                   ratio_setting.ModelPrice2JSONString(),
		"ModelRatio":                   ratio_setting.ModelRatio2JSONString(),
		"CompletionRatio":              ratio_setting.CompletionRatio2JSONString(),
		"CacheRatio":                   ratio_setting.CacheRatio2JSONString(),
		"CreateCacheRatio":             ratio_setting.CreateCacheRatio2JSONString(),
		"ImageRatio":                   ratio_setting.ImageRatio2JSONString(),
		"AudioRatio":                   ratio_setting.AudioRatio2JSONString(),
		"AudioCompletionRatio":         ratio_setting.AudioCompletionRatio2JSONString(),
		"billing_setting.billing_mode": mustMarshalPricingMap(billing_setting.GetBillingModeCopy()),
		"billing_setting.billing_expr": mustMarshalPricingMap(billing_setting.GetBillingExprCopy()),
	}
}

func mustMarshalPricingMap(value any) string {
	data, err := common.Marshal(value)
	if err != nil {
		return "{}"
	}
	return string(data)
}

func readPricingRevision(db *gorm.DB) (int64, error) {
	var option Option
	err := db.Where("key = ?", ModelPricingRevisionKey).First(&option).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	revision, err := strconv.ParseInt(option.Value, 10, 64)
	if err != nil || revision < 0 {
		return 0, fmt.Errorf("invalid model pricing revision %q", option.Value)
	}
	return revision, nil
}

func GetModelPricingRevision() (int64, error) { return readPricingRevision(DB) }

func GetModelPricingRows() (int64, []ModelPricingRow, error) {
	var revision int64
	values := currentPricingValues()
	for attempt := 0; attempt < 3; attempt++ {
		before, err := GetModelPricingRevision()
		if err != nil {
			return 0, nil, err
		}
		var options []Option
		if err := DB.Where("key IN ?", pricingOptionKeys).Find(&options).Error; err != nil {
			return 0, nil, err
		}
		after, err := GetModelPricingRevision()
		if err != nil {
			return 0, nil, err
		}
		if before != after {
			continue
		}
		for _, option := range options {
			values[option.Key] = option.Value
		}
		revision = after
		break
	}
	if revision == 0 {
		latest, err := GetModelPricingRevision()
		if err != nil {
			return 0, nil, err
		}
		if latest != 0 {
			return 0, nil, errors.New("model pricing changed while loading; please retry")
		}
	}
	floatMaps := make(map[string]map[string]float64, len(pricingOptionKeys)-2)
	stringMaps := make(map[string]map[string]string, 2)
	for _, key := range pricingOptionKeys {
		if strings.HasPrefix(key, "billing_setting.") {
			value := make(map[string]string)
			if err := common.UnmarshalJsonStr(values[key], &value); err != nil {
				return 0, nil, fmt.Errorf("invalid %s option: %w", key, err)
			}
			stringMaps[key] = value
			continue
		}
		value := make(map[string]float64)
		if err := common.UnmarshalJsonStr(values[key], &value); err != nil {
			return 0, nil, fmt.Errorf("invalid %s option: %w", key, err)
		}
		floatMaps[key] = value
	}
	modes := stringMaps["billing_setting.billing_mode"]
	exprs := stringMaps["billing_setting.billing_expr"]
	names, channels := map[string]struct{}{}, map[string]bool{}
	for _, ability := range GetAllEnableAbilities() {
		if IsConcretePricingModel(ability.Model) {
			names[ability.Model], channels[ability.Model] = struct{}{}, true
		}
	}
	for _, values := range floatMaps {
		for name := range values {
			if IsConcretePricingModel(name) {
				names[name] = struct{}{}
			}
		}
	}
	for name := range modes {
		if IsConcretePricingModel(name) {
			names[name] = struct{}{}
		}
	}
	for name := range exprs {
		if IsConcretePricingModel(name) {
			names[name] = struct{}{}
		}
	}
	ordered := make([]string, 0, len(names))
	for name := range names {
		ordered = append(ordered, name)
	}
	sort.Strings(ordered)
	rows := make([]ModelPricingRow, 0, len(ordered))
	for _, name := range ordered {
		pricing := ModelPricing{Mode: "unset"}
		setFloatPointers(&pricing, name, floatMaps)
		completionInfo := ratio_setting.GetCompletionRatioInfo(name)
		if completionInfo.Locked {
			pricing.CompletionRatio = &completionInfo.Ratio
		}
		expr, hasExpr := exprs[name]
		if hasExpr {
			pricing.BillingExpr = &expr
		}
		if modes[name] == billing_setting.BillingModeTieredExpr {
			pricing.Mode = "tiered_expr"
		} else if pricing.ModelPrice != nil {
			pricing.Mode = "per-request"
		} else if pricing.ModelRatio != nil {
			pricing.Mode = "per-token"
		}
		configured := pricing.Mode != "unset"
		rows = append(rows, ModelPricingRow{ModelName: name, HasChannel: channels[name], Configured: configured,
			CompletionRatioLocked: completionInfo.Locked, Pricing: pricing})
	}
	return revision, rows, nil
}

func IsConcretePricingModel(name string) bool {
	name = strings.TrimSpace(name)
	return name != "" && !strings.Contains(name, "*") && !strings.HasSuffix(name, "-all")
}

func ptrFrom(values map[string]float64, name string) *float64 {
	value, ok := values[name]
	if !ok {
		return nil
	}
	return &value
}

func setFloatPointers(p *ModelPricing, name string, maps map[string]map[string]float64) {
	p.ModelPrice = ptrFrom(maps["ModelPrice"], name)
	p.ModelRatio = ptrFrom(maps["ModelRatio"], name)
	p.CompletionRatio = ptrFrom(maps["CompletionRatio"], name)
	p.CacheRatio = ptrFrom(maps["CacheRatio"], name)
	p.CreateCacheRatio = ptrFrom(maps["CreateCacheRatio"], name)
	p.ImageRatio = ptrFrom(maps["ImageRatio"], name)
	p.AudioRatio = ptrFrom(maps["AudioRatio"], name)
	p.AudioCompletionRatio = ptrFrom(maps["AudioCompletionRatio"], name)
}

func ValidateModelPricingUpdates(updates []ModelPricingUpdate) error {
	seen := make(map[string]struct{}, len(updates))
	for _, update := range updates {
		name := strings.TrimSpace(update.ModelName)
		if name == "" {
			return errors.New("model_name must not be empty")
		}
		if !IsConcretePricingModel(name) {
			return fmt.Errorf("model_name %q must be a concrete service model", name)
		}
		if _, ok := seen[name]; ok {
			return fmt.Errorf("duplicate model_name %q", name)
		}
		seen[name] = struct{}{}
		p := update.Pricing
		if p.Mode != "per-token" && p.Mode != "per-request" && p.Mode != "tiered_expr" && p.Mode != "unset" {
			return fmt.Errorf("invalid pricing mode %q", p.Mode)
		}
		for _, value := range []*float64{p.ModelPrice, p.ModelRatio, p.CompletionRatio, p.CacheRatio, p.CreateCacheRatio, p.ImageRatio, p.AudioRatio, p.AudioCompletionRatio} {
			if value != nil && (math.IsNaN(*value) || math.IsInf(*value, 0) || *value < 0) {
				return fmt.Errorf("pricing values must be finite and non-negative")
			}
		}
		if p.Mode == "per-request" && p.ModelPrice == nil {
			return errors.New("per-request pricing requires model_price")
		}
		if p.Mode == "per-token" && p.ModelRatio == nil {
			return errors.New("per-token pricing requires model_ratio")
		}
		if p.Mode == "tiered_expr" {
			if p.BillingExpr == nil || strings.TrimSpace(*p.BillingExpr) == "" {
				return errors.New("tiered_expr pricing requires billing_expr")
			}
			if err := billing_setting.SmokeTestExpr(*p.BillingExpr); err != nil {
				return fmt.Errorf("invalid billing_expr: %w", err)
			}
		}
	}
	return nil
}

func ReplaceModelPricing(expectedRevision int64, updates []ModelPricingUpdate) (int64, error) {
	if err := ValidateModelPricingUpdates(updates); err != nil {
		return 0, err
	}
	committed := map[string]string{}
	var next int64
	err := DB.Transaction(func(tx *gorm.DB) error {
		revisionOption := Option{Key: ModelPricingRevisionKey, Value: "0"}
		if err := tx.FirstOrCreate(&revisionOption, Option{Key: ModelPricingRevisionKey}).Error; err != nil {
			return err
		}
		if err := lockForUpdate(tx).Where("key = ?", ModelPricingRevisionKey).First(&revisionOption).Error; err != nil {
			return err
		}
		current, err := strconv.ParseInt(revisionOption.Value, 10, 64)
		if err != nil || current < 0 {
			return fmt.Errorf("invalid model pricing revision %q", revisionOption.Value)
		}
		if current != expectedRevision {
			return &PricingRevisionConflict{CurrentRevision: current}
		}
		values := currentPricingValues()
		var options []Option
		if err := lockForUpdate(tx).Where("key IN ?", pricingOptionKeys).Find(&options).Error; err != nil {
			return err
		}
		for _, option := range options {
			values[option.Key] = option.Value
		}
		floatMaps := make(map[string]map[string]float64)
		stringMaps := make(map[string]map[string]string)
		for _, key := range pricingOptionKeys {
			if strings.HasPrefix(key, "billing_setting.") {
				var value map[string]string
				if err := common.UnmarshalJsonStr(values[key], &value); err != nil {
					return err
				}
				if value == nil {
					value = make(map[string]string)
				}
				stringMaps[key] = value
			} else {
				var value map[string]float64
				if err := common.UnmarshalJsonStr(values[key], &value); err != nil {
					return err
				}
				if value == nil {
					value = make(map[string]float64)
				}
				floatMaps[key] = value
			}
		}
		for _, update := range updates {
			name, p := strings.TrimSpace(update.ModelName), update.Pricing
			completionLocked := ratio_setting.GetCompletionRatioInfo(name).Locked
			replaceFloat := func(key string, value *float64) {
				if value == nil {
					delete(floatMaps[key], name)
				} else {
					floatMaps[key][name] = *value
				}
			}
			if p.Mode == "unset" {
				for key := range floatMaps {
					if key == "CompletionRatio" && completionLocked {
						continue
					}
					delete(floatMaps[key], name)
				}
				delete(stringMaps["billing_setting.billing_mode"], name)
				delete(stringMaps["billing_setting.billing_expr"], name)
				continue
			}
			if p.Mode == "per-request" {
				p.ModelRatio = nil
				p.CompletionRatio = nil
				p.CacheRatio = nil
				p.CreateCacheRatio = nil
				p.ImageRatio = nil
				p.AudioRatio = nil
				p.AudioCompletionRatio = nil
				p.BillingExpr = nil
			} else if p.Mode == "per-token" {
				p.ModelPrice = nil
				p.BillingExpr = nil
			}
			replaceFloat("ModelPrice", p.ModelPrice)
			replaceFloat("ModelRatio", p.ModelRatio)
			if !completionLocked {
				replaceFloat("CompletionRatio", p.CompletionRatio)
			}
			replaceFloat("CacheRatio", p.CacheRatio)
			replaceFloat("CreateCacheRatio", p.CreateCacheRatio)
			replaceFloat("ImageRatio", p.ImageRatio)
			replaceFloat("AudioRatio", p.AudioRatio)
			replaceFloat("AudioCompletionRatio", p.AudioCompletionRatio)
			if p.Mode == "tiered_expr" {
				stringMaps["billing_setting.billing_mode"][name] = billing_setting.BillingModeTieredExpr
			} else {
				delete(stringMaps["billing_setting.billing_mode"], name)
			}
			if p.BillingExpr != nil {
				stringMaps["billing_setting.billing_expr"][name] = *p.BillingExpr
			} else {
				delete(stringMaps["billing_setting.billing_expr"], name)
			}
		}
		for key, value := range floatMaps {
			committed[key] = mustMarshalPricingMap(value)
		}
		for key, value := range stringMaps {
			committed[key] = mustMarshalPricingMap(value)
		}
		for key, value := range committed {
			if err := tx.Save(&Option{Key: key, Value: value}).Error; err != nil {
				return err
			}
		}
		if current == math.MaxInt64 {
			return errors.New("model pricing revision overflow")
		}
		next = current + 1
		revisionOption.Value = strconv.FormatInt(next, 10)
		return tx.Save(&revisionOption).Error
	})
	if err != nil {
		return 0, err
	}
	for _, key := range pricingOptionKeys {
		if err := updateOptionMap(key, committed[key]); err != nil {
			return 0, err
		}
	}
	_ = updateOptionMap(ModelPricingRevisionKey, strconv.FormatInt(next, 10))
	return next, nil
}
