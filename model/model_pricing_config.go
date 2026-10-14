package model

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"maps"
	"math"
	"reflect"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// PricingValues is one model's configuration, keyed by the existing option
// names. A missing key inherits the engine's default; an explicit zero is free.
type PricingValues map[string]any

type ModelPricingChange struct {
	ModelName              string            `json:"model_name"`
	ExpectedVersion        string            `json:"expected_version"`
	Pricing                PricingValues     `json:"pricing"`
	Reset                  bool              `json:"reset,omitempty"`
	PluginValidationModels map[string]string `json:"-"`
}

type ModelPricingEntry struct {
	ModelPricingDescription
	PluginVariants []ModelPricingPluginVariant          `json:"plugin_variants,omitempty"`
	ModelName      string                               `json:"model_name"`
	Version        string                               `json:"version"`
	Configured     PricingValues                        `json:"configured"`
	UsageSchema    map[string]jsplugin.UsageFieldSchema `json:"usage_schema,omitempty"`
}

type ModelPricingPluginVariant struct {
	PluginKey     string                               `json:"plugin_key"`
	PluginName    string                               `json:"plugin_name"`
	Icon          string                               `json:"icon,omitempty"`
	UsageSchema   map[string]jsplugin.UsageFieldSchema `json:"usage_schema"`
	UsageExamples []jsplugin.UsageExample              `json:"usage_examples,omitempty"`
	Configured    string                               `json:"configured"`
	Effective     string                               `json:"effective"`
	Compatible    bool                                 `json:"compatible"`
	Stale         bool                                 `json:"stale,omitempty"`
}

type ModelPricingSnapshot struct {
	Entries      []ModelPricingEntry `json:"entries"`
	Options      map[string]string   `json:"options"`
	EmptyVersion string              `json:"empty_version"`
}

var (
	ErrModelPricingConflict        = errors.New("model pricing changed; reload before saving")
	ErrModelPricingPayloadConflict = errors.New("conflicting model pricing payload")
)

var modelPricingOptionKeys = []string{
	"AudioCompletionRatio", "AudioRatio", "CacheRatio", "CompletionRatio",
	"CreateCacheRatio", "ImageRatio", "ModelPrice", "ModelRatio",
	"billing_setting.billing_expr", "billing_setting.billing_mode", billing_setting.PluginBillingExprOption,
}

var legacyWildcardPricingOptionKeys = []string{
	"ModelPrice", "ModelRatio", "CompletionRatio", "AudioRatio", "AudioCompletionRatio",
}

const (
	modelPricingRevisionOptionKey       = "model_pricing.revision"
	modelPricingCASMaxAttempts          = 8
	modelPricingAliasRefreshMaxAttempts = 3
)

var (
	errModelPricingCASMiss         = errors.New("model pricing revision changed")
	errModelPricingAliasCacheStale = errors.New("task alias cache changed")
)

var modelPricingMutationMu sync.Mutex

func IsModelPricingOption(key string) bool {
	return slices.Contains(modelPricingOptionKeys, key)
}

func ModelPricingVersion(values PricingValues) string {
	encoded, _ := common.Marshal(values)
	return fmt.Sprintf("%x", sha256.Sum256(encoded))
}

func defaultPricingMaps() map[string]map[string]any {
	result := make(map[string]map[string]any, len(modelPricingOptionKeys))
	for _, key := range modelPricingOptionKeys {
		result[key] = make(map[string]any)
	}
	for key, values := range ratio_setting.GetDefaultPricingMaps() {
		for name, value := range values {
			result[key][name] = value
		}
	}
	return result
}

func readModelPricingMaps(db *gorm.DB) (map[string]map[string]any, map[string]bool, []string, error) {
	var rows []Option
	if err := db.Where(map[string]any{"key": modelPricingOptionKeys}).Order(clause.OrderByColumn{Column: clause.Column{Name: "key"}}).Find(&rows).Error; err != nil {
		return nil, nil, nil, err
	}
	values := defaultPricingMaps()
	existing := make(map[string]bool)
	counts := make(map[string]int)
	for _, row := range rows {
		var entries map[string]any
		if err := common.UnmarshalJsonStr(row.Value, &entries); err != nil {
			return nil, nil, nil, fmt.Errorf("%s: %w", row.Key, err)
		}
		if entries == nil {
			return nil, nil, nil, fmt.Errorf("%s must be a JSON object", row.Key)
		}
		entries, err := normalizeLegacyPricingEntries(row.Key, entries)
		if err != nil {
			return nil, nil, nil, err
		}
		values[row.Key] = entries
		existing[row.Key] = true
		counts[row.Key]++
	}
	var duplicated []string
	for _, key := range modelPricingOptionKeys {
		if counts[key] > 1 {
			duplicated = append(duplicated, key)
		}
	}
	return values, existing, duplicated, nil
}

func modelPricingStorageName(key, name string) string {
	if slices.Contains(legacyWildcardPricingOptionKeys, key) {
		return ratio_setting.FormatMatchingModelName(name)
	}
	return name
}

func normalizeLegacyPricingEntries(key string, entries map[string]any) (map[string]any, error) {
	if !slices.Contains(legacyWildcardPricingOptionKeys, key) {
		return entries, nil
	}
	normalized := make(map[string]any, len(entries))
	for name, value := range entries {
		canonical := modelPricingStorageName(key, name)
		if name == canonical {
			normalized[canonical] = value
		}
	}
	for name, value := range entries {
		canonical := modelPricingStorageName(key, name)
		if name == canonical {
			continue
		}
		if _, exists := entries[canonical]; exists {
			continue
		}
		existing, exists := normalized[canonical]
		if !exists {
			normalized[canonical] = value
			continue
		}
		if reflect.DeepEqual(existing, value) {
			continue
		}
		return nil, fmt.Errorf("%s contains conflicting aliases for %s", key, canonical)
	}
	return normalized, nil
}

func modelPricingValues(values map[string]map[string]any, name string) PricingValues {
	result := make(PricingValues)
	for _, key := range modelPricingOptionKeys {
		if key == billing_setting.PluginBillingExprOption {
			variants := make(map[string]any)
			for variant, expression := range values[key] {
				if plugin, model, ok := billing_setting.SplitPluginBillingExprKey(variant); ok && model == name {
					variants[plugin] = expression
				}
			}
			if len(variants) > 0 {
				result[key] = variants
			}
			continue
		}
		if value, exists := values[key][modelPricingStorageName(key, name)]; exists {
			result[key] = value
		}
	}
	return result
}

func replaceModelPricingKey(values map[string]map[string]any, key, name string, draft PricingValues) {
	entries := values[key]
	if key == billing_setting.PluginBillingExprOption {
		for variant := range entries {
			if _, model, ok := billing_setting.SplitPluginBillingExprKey(variant); ok && model == name {
				delete(entries, variant)
			}
		}
		variants, _ := draft[key].(map[string]any)
		for plugin, expr := range variants {
			entries[billing_setting.PluginBillingExprKey(plugin, name)] = expr
		}
		return
	}
	if slices.Contains(legacyWildcardPricingOptionKeys, key) {
		storageName := modelPricingStorageName(key, name)
		for existingName := range entries {
			if modelPricingStorageName(key, existingName) == storageName {
				delete(entries, existingName)
			}
		}
		if value, exists := draft[key]; exists {
			entries[storageName] = value
		}
		return
	}
	delete(entries, name)
	if value, exists := draft[key]; exists {
		entries[name] = value
	}
}

func removeModelPricing(values map[string]map[string]any, name string) {
	for _, key := range modelPricingOptionKeys {
		replaceModelPricingKey(values, key, name, PricingValues{})
	}
}

// replaceModelPricing writes one complete model draft into the option maps.
// Plugin expressions are grouped in the draft and flattened only in storage.
func replaceModelPricing(values map[string]map[string]any, name string, draft PricingValues) {
	for _, key := range modelPricingOptionKeys {
		replaceModelPricingKey(values, key, name, draft)
	}
}

func cloneModelPricingMaps(values map[string]map[string]any) map[string]map[string]any {
	cloned := make(map[string]map[string]any, len(values))
	for key, entries := range values {
		cloned[key] = maps.Clone(entries)
	}
	return cloned
}

func effectiveModelPricing(values map[string]map[string]any, name string) PricingValues {
	result := modelPricingValues(values, name)
	// Legacy wildcard aliases are resolved by the same normalization as relay.
	alias := ratio_setting.FormatMatchingModelName(name)
	for _, key := range legacyWildcardPricingOptionKeys {
		delete(result, key)
		if value, exists := values[key][alias]; exists {
			result[key] = value
		}
	}
	mode, _ := result["billing_setting.billing_mode"].(string)
	if mode == "" {
		_, hasPrice := result["ModelPrice"]
		_, hasRatio := result["ModelRatio"]
		if _, builtin := billing_setting.GetBuiltinBillingExpr(name); builtin && !hasPrice && !hasRatio {
			mode = "tiered_expr"
		}
	}
	if mode == "tiered_expr" {
		result["billing_setting.billing_mode"] = mode
		if _, exists := result["billing_setting.billing_expr"]; !exists {
			if expression, ok := billing_setting.GetBuiltinBillingExpr(name); ok {
				result["billing_setting.billing_expr"] = expression
			}
		}
		return result
	}
	if _, exists := result["ModelPrice"]; exists {
		return result
	}
	if _, exists := result["ModelRatio"]; !exists && operation_setting.SelfUseModeEnabled {
		result["ModelRatio"] = float64(37.5)
	}
	// Completion ratios include engine-enforced model defaults. Expose their
	// effective value without persisting them into the editable configuration.
	var configuredCompletion *float64
	if ratio, exists := result["CompletionRatio"].(float64); exists {
		configuredCompletion = &ratio
	}
	result["CompletionRatio"] = ratio_setting.ResolveCompletionRatio(name, configuredCompletion).Ratio
	for key, fallback := range map[string]float64{
		"CacheRatio":       ratio_setting.DefaultCacheRatio,
		"CreateCacheRatio": ratio_setting.DefaultCreateCacheRatio,
		"ImageRatio":       ratio_setting.DefaultImageRatio,
	} {
		if _, exists := result[key]; !exists {
			result[key] = fallback
		}
	}
	return result
}

// PreviewModelPricing resolves a complete editable draft using the same defaults
// as the saved-price display and conversion. It has no write side effects.
func PreviewModelPricing(name string, draft PricingValues) (PricingValues, error) {
	if draft == nil {
		return nil, errors.New("pricing draft is required")
	}
	values, _, _, err := readModelPricingMaps(DB)
	if err != nil {
		return nil, err
	}
	aliasView, err := buildTaskAliasView(DB, jsplugin.DefaultRegistry.Generation())
	if err != nil {
		return nil, fmt.Errorf("read task model aliases: %w", err)
	}
	if err := validateModelPricing(name, draft, modelPricingValues(values, name), nil, values, aliasView); err != nil {
		return nil, err
	}
	replaceModelPricing(values, name, draft)
	return effectiveModelPricing(values, name), nil
}

// GetEffectiveModelPricingTx shares the pricing engine's resolution while
// reading authoritative options in the caller's current transaction.
func GetEffectiveModelPricingTx(tx *gorm.DB, names []string) (map[string]PricingValues, error) {
	values, _, _, err := readModelPricingMaps(lockForUpdate(tx))
	if err != nil {
		return nil, err
	}
	result := make(map[string]PricingValues, len(names))
	for _, name := range names {
		result[name] = effectiveModelPricing(values, name)
	}
	return result, nil
}

func activeTaskPluginVariants(generation *jsplugin.RoutingGeneration, aliases *taskAliasView, name string) ([]*jsplugin.LoadedPlugin, string) {
	if plugins := generation.PluginsByModel(name); len(plugins) > 0 {
		return plugins, name
	}
	target, resolved := resolveTaskModelAlias(aliases, name)
	if !resolved {
		return nil, ""
	}
	if target.Declared == "" {
		// A same-plugin alias with multiple canonical tails stays unpinned but
		// retains that plugin's default usage metadata.
		plugin, exists := generation.Get(target.PluginKey)
		if !exists {
			return nil, ""
		}
		return []*jsplugin.LoadedPlugin{plugin}, ""
	}
	return generation.PluginsByModel(target.Declared), target.Declared
}

func resolveActivePluginVariant(generation *jsplugin.RoutingGeneration, aliases *taskAliasView, pluginKey, name string) (*jsplugin.LoadedPlugin, string, bool) {
	plugin, exists := generation.Get(pluginKey)
	if !exists {
		return nil, "", false
	}
	plugins, schemaModel := activeTaskPluginVariants(generation, aliases, name)
	active := slices.ContainsFunc(plugins, func(candidate *jsplugin.LoadedPlugin) bool {
		return candidate == plugin
	})
	return plugin, schemaModel, active
}

func effectiveTaskPluginPricingExpression(values map[string]map[string]any, configured, effective PricingValues, pluginKey, name, mappedModel string) (string, bool) {
	if variants, _ := configured[billing_setting.PluginBillingExprOption].(map[string]any); variants != nil {
		if expression, ok := variants[pluginKey].(string); ok {
			return expression, true
		}
	}
	if mappedModel != "" && mappedModel != name {
		mapped := modelPricingValues(values, mappedModel)
		if variants, _ := mapped[billing_setting.PluginBillingExprOption].(map[string]any); variants != nil {
			if expression, ok := variants[pluginKey].(string); ok {
				return expression, true
			}
		}
	}
	if effective["billing_setting.billing_mode"] == billing_setting.BillingModeTieredExpr {
		expression, _ := effective["billing_setting.billing_expr"].(string)
		return expression, true
	}
	if mappedModel != "" && mappedModel != name {
		mapped := effectiveModelPricing(values, mappedModel)
		if mapped["billing_setting.billing_mode"] == billing_setting.BillingModeTieredExpr {
			expression, _ := mapped["billing_setting.billing_expr"].(string)
			return expression, true
		}
	}
	return "", false
}

func GetModelPricingSnapshot(names []string) (*ModelPricingSnapshot, error) {
	values, _, _, err := readModelPricingMaps(DB)
	if err != nil {
		return nil, err
	}
	if len(names) == 0 {
		nameSet := make(map[string]bool)
		for key, entries := range values {
			for name := range entries {
				if key == billing_setting.PluginBillingExprOption {
					_, model, ok := billing_setting.SplitPluginBillingExprKey(name)
					if !ok {
						continue
					}
					name = model
				}
				nameSet[name] = true
			}
		}
		for name := range billing_setting.GetBuiltinBillingExprCopy() {
			nameSet[name] = true
		}
		for name := range nameSet {
			names = append(names, name)
		}
	}
	sort.Strings(names)
	result := &ModelPricingSnapshot{Entries: make([]ModelPricingEntry, 0, len(names)), Options: make(map[string]string), EmptyVersion: ModelPricingVersion(PricingValues{})}
	generation := jsplugin.DefaultRegistry.Generation()
	aliasView := loadFreshTaskAliasView(generation)
	for _, name := range names {
		configured := modelPricingValues(values, name)
		entry := ModelPricingEntry{ModelName: name, Version: ModelPricingVersion(configured), Configured: configured,
			ModelPricingDescription: ModelPricingDescription{Effective: effectiveModelPricing(values, name)}}
		entry.CacheWriteMode = ResolveCacheWriteMode(name, configured)
		entry.BillingDetails = ResolveLegacyBillingDetails(name, entry.Effective, configured)
		_, aliasResolved := resolveTaskModelAlias(aliasView, name)
		plugins, schemaModel := activeTaskPluginVariants(generation, aliasView, name)
		if len(plugins) > 0 {
			entry.UsageSchema, _ = plugins[0].Meta.UsageForModel(schemaModel)
		}
		configuredVariants, _ := configured[billing_setting.PluginBillingExprOption].(map[string]any)
		if len(plugins) >= 2 || len(configuredVariants) > 0 || aliasResolved {
			keys := make(map[string]bool, len(plugins)+len(configuredVariants))
			for _, plugin := range plugins {
				keys[plugin.Meta.Key] = true
			}
			for key := range configuredVariants {
				keys[key] = true
			}
			for _, key := range slices.Sorted(maps.Keys(keys)) {
				configuredValue := configuredVariants[key]
				configuredExpr, _ := configuredValue.(string)
				plugin, schemaModel, active := resolveActivePluginVariant(generation, aliasView, key, name)
				if !active {
					variant := ModelPricingPluginVariant{
						PluginKey: key, PluginName: key, Configured: configuredExpr,
						UsageSchema: map[string]jsplugin.UsageFieldSchema{}, Stale: true,
					}
					if plugin != nil {
						variant.PluginName, variant.Icon = plugin.Meta.Name, plugin.Meta.Icon
					}
					entry.PluginVariants = append(entry.PluginVariants, variant)
					continue
				}
				schema, examples := plugin.Meta.UsageForModel(schemaModel)
				if schema == nil {
					schema = map[string]jsplugin.UsageFieldSchema{}
				}
				expression, _ := effectiveTaskPluginPricingExpression(values, configured, entry.Effective, key, name, schemaModel)
				entry.PluginVariants = append(entry.PluginVariants, ModelPricingPluginVariant{
					PluginKey: plugin.Meta.Key, PluginName: plugin.Meta.Name, Icon: plugin.Meta.Icon,
					UsageSchema: schema, UsageExamples: examples, Configured: configuredExpr, Effective: expression,
					Compatible: billing_setting.TaskExprCompatible(expression, schema),
				})
			}
		}
		result.Entries = append(result.Entries, entry)
	}
	// Preserve the existing settings editor's full-map interface. Built-in
	// expressions are display defaults only; per-model writes do not persist them.
	for name, expression := range billing_setting.GetBuiltinBillingExprCopy() {
		effective := effectiveModelPricing(values, name)
		if effective["billing_setting.billing_mode"] != "tiered_expr" {
			continue
		}
		if _, ok := values["billing_setting.billing_mode"][name]; !ok {
			values["billing_setting.billing_mode"][name] = "tiered_expr"
		}
		if _, ok := values["billing_setting.billing_expr"][name]; !ok {
			values["billing_setting.billing_expr"][name] = expression
		}
	}
	for key, entries := range values {
		encoded, err := common.Marshal(entries)
		if err != nil {
			return nil, err
		}
		result.Options[key] = string(encoded)
	}
	return result, nil
}

func ValidateModelPricing(name string, values PricingValues) error {
	variants := make(map[string]any)
	for key, expression := range billing_setting.GetPluginBillingExprCopy() {
		if plugin, model, ok := billing_setting.SplitPluginBillingExprKey(key); ok && model == name {
			variants[plugin] = expression
		}
	}
	previous := PricingValues{billing_setting.PluginBillingExprOption: variants}
	if expression, ok := billing_setting.GetBillingExpr(name); ok {
		previous["billing_setting.billing_expr"] = expression
	}
	generation := jsplugin.DefaultRegistry.Generation()
	if DB == nil {
		return validateModelPricing(name, values, previous, nil, nil, loadFreshTaskAliasView(generation))
	}
	pricingMaps, _, _, err := readModelPricingMaps(DB)
	if err != nil {
		return err
	}
	aliasView, err := buildTaskAliasView(DB, generation)
	if err != nil {
		return fmt.Errorf("read task model aliases: %w", err)
	}
	return validateModelPricing(name, values, previous, nil, pricingMaps, aliasView)
}

// Writes pass the locked database snapshot here, so allowing an unchanged stale
// override cannot bypass validation through an out-of-date process-local cache.
func validateModelPricing(name string, values, previous PricingValues, pluginValidationModels map[string]string, pricingMaps map[string]map[string]any, aliases *taskAliasView) error {
	if strings.TrimSpace(name) == "" {
		return errors.New("model name is required")
	}
	generation := jsplugin.DefaultRegistry.Generation()
	if target, resolved := resolveTaskModelAlias(aliases, name); resolved && target.Alias != name {
		return fmt.Errorf("model name %q must use canonical alias spelling %q", name, target.Alias)
	}
	previousVariants, _ := previous[billing_setting.PluginBillingExprOption].(map[string]any)
	variants := map[string]any{}
	if value, exists := values[billing_setting.PluginBillingExprOption]; exists {
		var ok bool
		variants, ok = value.(map[string]any)
		if !ok || variants == nil {
			return errors.New("plugin billing expressions must be a plugin-to-expression object")
		}
		for key, value := range variants {
			expression, ok := value.(string)
			if !ok || strings.TrimSpace(expression) == "" {
				return fmt.Errorf("model %s: plugin %s: billing expression is required", name, key)
			}
			pluginModel := name
			validationModel := strings.TrimSpace(pluginValidationModels[key])
			var plugin *jsplugin.LoadedPlugin
			var active bool
			if validationModel != "" {
				pluginModel = validationModel
				plugin, active = generation.Get(key)
				active = active && slices.Contains(plugin.Meta.Models, pluginModel)
			} else {
				plugin, pluginModel, active = resolveActivePluginVariant(generation, aliases, key, name)
			}
			if !active {
				if previousVariants[key] == expression {
					continue
				}
				return fmt.Errorf("model %s: plugin %s does not declare this model", name, key)
			}
			schema, _ := plugin.Meta.UsageForModel(pluginModel)
			if err := billing_setting.SmokeTestTaskExpr(expression, schema); err != nil {
				return fmt.Errorf("model %s: plugin %s: %w", name, key, err)
			}
		}
	}
	for key, value := range values {
		if key == billing_setting.PluginBillingExprOption {
			continue
		}
		if !IsModelPricingOption(key) {
			return fmt.Errorf("unsupported pricing field: %s", key)
		}
		if key == "billing_setting.billing_mode" {
			if value != "ratio" && value != "tiered_expr" {
				return errors.New("invalid billing mode")
			}
			continue
		}
		if key == "billing_setting.billing_expr" {
			expression, ok := value.(string)
			if !ok || strings.TrimSpace(expression) == "" {
				return errors.New("billing expression is required")
			}
			if err := validateMainModelPricingExpression(name, expression, variants, pricingMaps, aliases); err != nil {
				return err
			}
			continue
		}
		number, ok := value.(float64)
		if !ok || math.IsNaN(number) || math.IsInf(number, 0) || number < 0 {
			return fmt.Errorf("%s must be a finite, non-negative number", key)
		}
	}
	if values["billing_setting.billing_mode"] == "tiered_expr" {
		if _, exists := values["billing_setting.billing_expr"]; !exists {
			expression, builtin := billing_setting.GetBuiltinBillingExpr(name)
			if !builtin {
				return errors.New("billing expression is required")
			}
			if err := validateMainModelPricingExpression(name, expression, variants, pricingMaps, aliases); err != nil {
				return err
			}
		}
	}
	return nil
}

func validateMainModelPricingExpression(name, expression string, variants map[string]any, pricingMaps map[string]map[string]any, aliases *taskAliasView) error {
	if _, err := billingexpr.CompileFromCache(expression); err != nil {
		return fmt.Errorf("model %s: %w", name, err)
	}
	requestErr := smokeTestModelRequestExpr(expression)
	generation := jsplugin.DefaultRegistry.Generation()
	if plugins, schemaModel := activeTaskPluginVariants(generation, aliases, name); len(plugins) > 0 {
		compatible := requestErr == nil
		var compatibilityErr error
		configured := PricingValues{billing_setting.PluginBillingExprOption: variants}
		effective := PricingValues{
			"billing_setting.billing_mode": billing_setting.BillingModeTieredExpr,
			"billing_setting.billing_expr": expression,
		}
		for _, plugin := range plugins {
			schema, _ := plugin.Meta.UsageForModel(schemaModel)
			mainErr := billing_setting.SmokeTestTaskExpr(expression, schema)
			if mainErr == nil {
				compatible = true
			} else if compatibilityErr == nil {
				compatibilityErr = fmt.Errorf("model %s: plugin %s: %w", name, plugin.Meta.Key, mainErr)
			}
			selected, _ := effectiveTaskPluginPricingExpression(
				pricingMaps, configured, effective, plugin.Meta.Key, name, schemaModel,
			)
			if err := billing_setting.SmokeTestTaskExpr(selected, schema); err != nil {
				return fmt.Errorf("model %s: plugin %s: %w", name, plugin.Meta.Key, err)
			}
		}
		if !compatible {
			return compatibilityErr
		}
		return nil
	}
	if requestErr != nil {
		return fmt.Errorf("model %s: %w", name, requestErr)
	}
	return nil
}

func validateEffectiveTaskAliasPricing(name string, pricingMaps map[string]map[string]any, aliases *taskAliasView) error {
	generation := jsplugin.DefaultRegistry.Generation()
	plugins, schemaModel := activeTaskPluginVariants(generation, aliases, name)
	configured := modelPricingValues(pricingMaps, name)
	effective := effectiveModelPricing(pricingMaps, name)
	for _, plugin := range plugins {
		expression, selected := effectiveTaskPluginPricingExpression(
			pricingMaps, configured, effective, plugin.Meta.Key, name, schemaModel,
		)
		if !selected {
			continue
		}
		if strings.TrimSpace(expression) == "" {
			return fmt.Errorf("model %s: plugin %s: billing expression is required", name, plugin.Meta.Key)
		}
		schema, _ := plugin.Meta.UsageForModel(schemaModel)
		if err := billing_setting.SmokeTestTaskExpr(expression, schema); err != nil {
			return fmt.Errorf("model %s: plugin %s: %w", name, plugin.Meta.Key, err)
		}
	}
	return nil
}

func validateCandidateTaskAliases(changedModels map[string]bool, pricingMaps map[string]map[string]any, aliases *taskAliasView) error {
	if aliases == nil {
		return nil
	}
	aliasNames := make(map[string]bool)
	for _, target := range aliases.byFold {
		if changedModels[target.Alias] || target.Declared != "" && changedModels[target.Declared] {
			aliasNames[target.Alias] = true
		}
	}
	for _, name := range slices.Sorted(maps.Keys(aliasNames)) {
		if err := validateEffectiveTaskAliasPricing(name, pricingMaps, aliases); err != nil {
			return err
		}
	}
	return nil
}

func smokeTestModelRequestExpr(expression string) error {
	used := billingexpr.UsedVars(expression)
	if !used["images_up_to_1_5k"] && !used["images_above_1_5k"] && !used["input_images"] {
		return billing_setting.SmokeTestExpr(expression)
	}
	if len(billingexpr.UsedUsageKeys(expression)) > 0 {
		return errors.New("request expression cannot reference task usage")
	}
	scalar := func(value float64) *float64 { return &value }
	requests := []billingexpr.RequestInput{
		{ImagesUpTo1_5K: scalar(0), ImagesAbove1_5K: scalar(0), InputImages: scalar(0)},
		{ImagesUpTo1_5K: scalar(billingexpr.MaxRequestImageOutputs), ImagesAbove1_5K: scalar(0), InputImages: scalar(billingexpr.MaxRequestInputImages)},
		{ImagesUpTo1_5K: scalar(0), ImagesAbove1_5K: scalar(billingexpr.MaxRequestImageOutputs), InputImages: scalar(billingexpr.MaxRequestInputImages)},
		{ImagesUpTo1_5K: scalar(1), ImagesAbove1_5K: scalar(1), InputImages: scalar(1)},
	}
	for _, request := range requests {
		if _, _, err := billingexpr.RunExprWithRequest(expression, billingexpr.TokenParams{}, request); err != nil {
			return err
		}
	}
	return nil
}

func UpdateModelPricing(changes []ModelPricingChange) error {
	return updateModelPricing(changes, nil)
}

// UpdateModelPricingWithEvidence commits official pricing evidence in the same
// validated transaction as its model pricing snapshots.
func UpdateModelPricingWithEvidence(changes []ModelPricingChange, evidence []UpstreamPriceEvidence) error {
	return updateModelPricing(changes, func(tx *gorm.DB) error {
		if len(evidence) == 0 {
			return nil
		}
		return tx.CreateInBatches(&evidence, 50).Error
	})
}

func updateModelPricing(changes []ModelPricingChange, afterPricing func(*gorm.DB) error) error {
	modelPricingMutationMu.Lock()
	defer modelPricingMutationMu.Unlock()
	return commitModelPricingWithCoherentAliases(func(cachedAliases *taskAliasView) (map[string]map[string]any, error) {
		return updateModelPricingDatabaseWithAliasCache(DB, changes, afterPricing, cachedAliases)
	})
}

func updateModelPricingDatabase(db *gorm.DB, changes []ModelPricingChange, afterPricing func(*gorm.DB) error) (map[string]map[string]any, error) {
	return updateModelPricingDatabaseCore(db, changes, afterPricing, nil, false)
}

func updateModelPricingDatabaseWithAliasCache(db *gorm.DB, changes []ModelPricingChange, afterPricing func(*gorm.DB) error, cachedAliases *taskAliasView) (map[string]map[string]any, error) {
	return updateModelPricingDatabaseCore(db, changes, afterPricing, cachedAliases, true)
}

func updateModelPricingDatabaseCore(db *gorm.DB, changes []ModelPricingChange, afterPricing func(*gorm.DB) error, cachedAliases *taskAliasView, requireCoherentAliases bool) (map[string]map[string]any, error) {
	if len(changes) == 0 {
		return nil, errors.New("select model pricing changes before saving")
	}
	seen := make(map[string]bool)
	for _, change := range changes {
		if seen[change.ModelName] {
			return nil, errors.New("duplicate model pricing change")
		}
		seen[change.ModelName] = true
		if change.ExpectedVersion == "" {
			return nil, ErrModelPricingConflict
		}
	}
	return mutateModelPricingOptionsDatabaseWithAliasCache(db, cachedAliases, requireCoherentAliases, func(tx *gorm.DB, values map[string]map[string]any, aliases *taskAliasView) error {
		defaults := defaultPricingMaps()
		prepared := make([]PricingValues, len(changes))
		previous := make([]PricingValues, len(changes))
		type legacyStorageKey struct {
			option, model string
		}
		type legacyStorageIntent struct {
			value   any
			present bool
			source  string
		}
		legacyIntents := make(map[legacyStorageKey]legacyStorageIntent)
		legacyOrder := make([]legacyStorageKey, 0)
		for index, change := range changes {
			previous[index] = modelPricingValues(values, change.ModelName)
			if ModelPricingVersion(previous[index]) != change.ExpectedVersion {
				return fmt.Errorf("%w: %s", ErrModelPricingConflict, change.ModelName)
			}
			pricing := change.Pricing
			if change.Reset {
				pricing = modelPricingValues(defaults, change.ModelName)
			}
			prepared[index] = pricing
			for _, key := range legacyWildcardPricingOptionKeys {
				storageKey := legacyStorageKey{option: key, model: modelPricingStorageName(key, change.ModelName)}
				value, present := pricing[key]
				intent, exists := legacyIntents[storageKey]
				if !exists {
					legacyIntents[storageKey] = legacyStorageIntent{
						value: value, present: present, source: change.ModelName,
					}
					legacyOrder = append(legacyOrder, storageKey)
					continue
				}
				if intent.present != present || present && !reflect.DeepEqual(intent.value, value) {
					return fmt.Errorf("%w: %s %q has incompatible intents for %q and %q",
						ErrModelPricingPayloadConflict, key, storageKey.model, intent.source, change.ModelName)
				}
			}
		}
		candidate := cloneModelPricingMaps(values)
		for index, change := range changes {
			for _, key := range modelPricingOptionKeys {
				if slices.Contains(legacyWildcardPricingOptionKeys, key) {
					continue
				}
				replaceModelPricingKey(candidate, key, change.ModelName, prepared[index])
			}
		}
		for _, storageKey := range legacyOrder {
			intent := legacyIntents[storageKey]
			draft := make(PricingValues)
			if intent.present {
				draft[storageKey.option] = intent.value
			}
			replaceModelPricingKey(candidate, storageKey.option, storageKey.model, draft)
		}
		changedModels := make(map[string]bool, len(changes))
		for index, change := range changes {
			if err := validateModelPricing(change.ModelName, prepared[index], previous[index], change.PluginValidationModels, candidate, aliases); err != nil {
				return err
			}
			changedModels[change.ModelName] = true
		}
		if err := validateCandidateTaskAliases(changedModels, candidate, aliases); err != nil {
			return err
		}
		maps.Copy(values, candidate)
		if afterPricing != nil {
			return afterPricing(tx)
		}
		return nil
	})
}

// UpdateModelPricingOptions keeps legacy single-option callers on the same
// locking, validation and transaction path as the model-level API.
func UpdateModelPricingOptions(updates map[string]string) error {
	return mutateModelPricingOptionsWithAliases(func(_ *gorm.DB, values map[string]map[string]any, aliases *taskAliasView) error {
		previous := maps.Clone(values)
		names := make(map[string]bool)
		updatedKeys := make(map[string]bool)
		for key, raw := range updates {
			if !IsModelPricingOption(key) {
				return fmt.Errorf("unsupported pricing field: %s", key)
			}
			var entries map[string]any
			if err := common.UnmarshalJsonStr(raw, &entries); err != nil {
				return err
			}
			if entries == nil {
				return fmt.Errorf("%s must be a JSON object", key)
			}
			entries, err := normalizeLegacyPricingEntries(key, entries)
			if err != nil {
				return err
			}
			for _, entriesForKey := range []map[string]any{values[key], entries} {
				for name := range entriesForKey {
					if key == billing_setting.PluginBillingExprOption {
						_, model, ok := billing_setting.SplitPluginBillingExprKey(name)
						if !ok {
							return fmt.Errorf("invalid plugin billing expression key: %s", name)
						}
						name = model
					}
					names[name] = true
				}
			}
			values[key] = entries
			updatedKeys[key] = true
		}
		for name := range names {
			before := modelPricingValues(previous, name)
			after := modelPricingValues(values, name)
			if reflect.DeepEqual(before, after) {
				continue
			}
			changed := legacyModelPricingValidationDraft(name, after, before, updatedKeys, aliases)
			if err := validateModelPricing(name, changed, before, nil, values, aliases); err != nil {
				return err
			}
		}
		return nil
	})
}

func legacyModelPricingValidationDraft(name string, after, before PricingValues, updatedKeys map[string]bool, aliases *taskAliasView) PricingValues {
	changed := make(PricingValues)
	fieldChanged := func(key string) bool {
		afterValue, afterExists := after[key]
		beforeValue, beforeExists := before[key]
		return afterExists != beforeExists || !reflect.DeepEqual(afterValue, beforeValue)
	}
	for key := range updatedKeys {
		if !fieldChanged(key) {
			continue
		}
		if value, exists := after[key]; exists {
			changed[key] = value
		} else if key == billing_setting.PluginBillingExprOption {
			changed[key] = map[string]any{}
		}
	}

	mainChanged := fieldChanged("billing_setting.billing_expr")
	modeChanged := fieldChanged("billing_setting.billing_mode")
	variantsChanged := fieldChanged(billing_setting.PluginBillingExprOption)
	validateMain := mainChanged ||
		(modeChanged && after["billing_setting.billing_mode"] == billing_setting.BillingModeTieredExpr) ||
		(variantsChanged && !onlyStalePluginOverridesRemoved(name, after, before, aliases))
	if !validateMain {
		return changed
	}
	for _, key := range []string{"billing_setting.billing_mode", "billing_setting.billing_expr", billing_setting.PluginBillingExprOption} {
		if value, exists := after[key]; exists {
			changed[key] = value
		}
	}
	return changed
}

func onlyStalePluginOverridesRemoved(name string, after, before PricingValues, aliases *taskAliasView) bool {
	afterVariants, _ := after[billing_setting.PluginBillingExprOption].(map[string]any)
	beforeVariants, _ := before[billing_setting.PluginBillingExprOption].(map[string]any)
	removed := false
	generation := jsplugin.DefaultRegistry.Generation()
	for key, previousExpression := range beforeVariants {
		currentExpression, stillExists := afterVariants[key]
		if stillExists && reflect.DeepEqual(currentExpression, previousExpression) {
			continue
		}
		if stillExists {
			return false
		}
		if _, _, active := resolveActivePluginVariant(generation, aliases, key, name); active {
			return false
		}
		removed = true
	}
	for key := range afterVariants {
		if _, existed := beforeVariants[key]; !existed {
			return false
		}
	}
	return removed
}

func mutateModelPricingOptions(mutate func(*gorm.DB, map[string]map[string]any) error) error {
	modelPricingMutationMu.Lock()
	defer modelPricingMutationMu.Unlock()
	committed, err := mutateModelPricingOptionsDatabase(DB, mutate)
	if err != nil {
		return err
	}
	return publishModelPricingOptions(committed)
}

func mutateModelPricingOptionsWithAliases(mutate func(*gorm.DB, map[string]map[string]any, *taskAliasView) error) error {
	modelPricingMutationMu.Lock()
	defer modelPricingMutationMu.Unlock()
	return commitModelPricingWithCoherentAliases(func(cachedAliases *taskAliasView) (map[string]map[string]any, error) {
		return mutateModelPricingOptionsDatabaseWithAliasCache(DB, cachedAliases, true, mutate)
	})
}

func commitModelPricingWithCoherentAliases(commit func(*taskAliasView) (map[string]map[string]any, error)) error {
	for attempt := range modelPricingAliasRefreshMaxAttempts {
		taskAliasRebuildMu.Lock()
		cachedAliases := taskAliasViewPtr.Load()
		committed, err := commit(cachedAliases)
		taskAliasRebuildMu.Unlock()
		if err == nil {
			return publishModelPricingOptions(committed)
		}
		if !errors.Is(err, errModelPricingAliasCacheStale) {
			return err
		}
		if attempt+1 == modelPricingAliasRefreshMaxAttempts {
			return fmt.Errorf("%w: routing changed during pricing save", ErrModelPricingConflict)
		}
		if err := refreshChannelCache(); err != nil {
			return fmt.Errorf("refresh channel cache before model pricing save: %w", err)
		}
	}
	return fmt.Errorf("%w: routing changed during pricing save", ErrModelPricingConflict)
}

func mutateModelPricingOptionsDatabase(db *gorm.DB, mutate func(*gorm.DB, map[string]map[string]any) error) (map[string]map[string]any, error) {
	return mutateModelPricingOptionsDatabaseCore(db, mutate)
}

func mutateModelPricingOptionsDatabaseWithAliasCache(db *gorm.DB, cachedAliases *taskAliasView, requireCoherentAliases bool, mutate func(*gorm.DB, map[string]map[string]any, *taskAliasView) error) (map[string]map[string]any, error) {
	return mutateModelPricingOptionsDatabaseCore(db, func(tx *gorm.DB, values map[string]map[string]any) error {
		aliases, err := buildTaskAliasView(lockForUpdate(tx), jsplugin.DefaultRegistry.Generation())
		if err != nil {
			return fmt.Errorf("read task model aliases: %w", err)
		}
		if requireCoherentAliases && !taskAliasViewsSemanticallyEqual(cachedAliases, aliases) {
			return errModelPricingAliasCacheStale
		}
		return mutate(tx, values, aliases)
	})
}

func mutateModelPricingOptionsDatabaseCore(db *gorm.DB, mutate func(*gorm.DB, map[string]map[string]any) error) (map[string]map[string]any, error) {
	revision := Option{Key: modelPricingRevisionOptionKey, Value: "0"}
	if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&revision).Error; err != nil {
		return nil, err
	}
	for range modelPricingCASMaxAttempts {
		var anchor Option
		if err := db.Select("value").Where("key = ?", modelPricingRevisionOptionKey).First(&anchor).Error; err != nil {
			return nil, err
		}
		current, err := strconv.ParseUint(anchor.Value, 10, 64)
		if err != nil || current == math.MaxUint64 {
			return nil, fmt.Errorf("invalid model pricing revision %q", anchor.Value)
		}
		next := strconv.FormatUint(current+1, 10)
		var committed map[string]map[string]any
		err = db.Transaction(func(tx *gorm.DB) error {
			claim := tx.Model(&Option{}).
				Where("key = ? AND value = ?", modelPricingRevisionOptionKey, anchor.Value).
				Update("value", next)
			if claim.Error != nil {
				return claim.Error
			}
			if claim.RowsAffected != 1 {
				return errModelPricingCASMiss
			}
			values, existing, duplicated, readErr := readModelPricingMaps(lockForUpdate(tx))
			if readErr != nil {
				return readErr
			}
			if len(duplicated) > 0 {
				common.SysError("options table has duplicate pricing keys [" + strings.Join(duplicated, ", ") + "]; the table is missing a primary key")
			}
			if err := mutate(tx, values); err != nil {
				return err
			}
			defaults := defaultPricingMaps()
			for _, key := range modelPricingOptionKeys {
				if existing[key] {
					continue
				}
				encoded, err := common.Marshal(defaults[key])
				if err != nil {
					return err
				}
				row := Option{Key: key, Value: string(encoded)}
				if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error; err != nil {
					return err
				}
			}
			for _, key := range modelPricingOptionKeys {
				encoded, err := common.Marshal(values[key])
				if err != nil {
					return err
				}
				if err := tx.Model(&Option{}).Where(clause.Eq{
					Column: clause.Column{Name: "key"},
					Value:  key,
				}).Update("value", string(encoded)).Error; err != nil {
					return err
				}
			}
			committed = values
			return nil
		})
		if errors.Is(err, errModelPricingCASMiss) {
			continue
		}
		return committed, err
	}
	return nil, fmt.Errorf("%w: concurrent database updates", ErrModelPricingConflict)
}

func publishModelPricingOptions(committed map[string]map[string]any) error {
	encoded := make(map[string]string, len(modelPricingOptionKeys))
	for _, key := range modelPricingOptionKeys {
		value, err := common.Marshal(committed[key])
		if err != nil {
			return err
		}
		encoded[key] = string(value)
	}
	for _, key := range modelPricingOptionKeys {
		if billing_setting.IsBillingSettingOption(key) {
			continue
		}
		if err := updateOptionMap(key, encoded[key]); err != nil {
			return err
		}
	}
	if err := updateBillingSettingOptionMap(map[string]string{
		billing_setting.BillingModeOption:       encoded[billing_setting.BillingModeOption],
		billing_setting.BillingExprOption:       encoded[billing_setting.BillingExprOption],
		billing_setting.PluginBillingExprOption: encoded[billing_setting.PluginBillingExprOption],
	}); err != nil {
		return err
	}
	RefreshPricing()
	ratio_setting.InvalidateExposedDataCache()
	return nil
}
