package billing_setting

import (
	"encoding/json"
	"fmt"
	"maps"
	"math"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/samber/lo"
)

const (
	BillingModeRatio        = "ratio"
	BillingModeTieredExpr   = "tiered_expr"
	BillingModeField        = "billing_mode"
	BillingExprField        = "billing_expr"
	BillingModeOption       = "billing_setting." + BillingModeField
	BillingExprOption       = "billing_setting." + BillingExprField
	PluginBillingExprOption = "billing_setting.plugin_billing_expr"
	maxTaskExprSmokeTests   = 64
)

// BillingSetting is managed by config.GlobalConfig.Register.
// DB keys: billing_setting.billing_mode, billing_setting.billing_expr,
// billing_setting.plugin_billing_expr
type BillingSetting struct {
	BillingMode       map[string]string `json:"billing_mode"`
	BillingExpr       map[string]string `json:"billing_expr"`
	PluginBillingExpr map[string]string `json:"plugin_billing_expr"`
}

var billingSetting = BillingSetting{
	BillingMode:       make(map[string]string),
	BillingExpr:       make(map[string]string),
	PluginBillingExpr: make(map[string]string),
}

type BillingDecision struct {
	Mode             string
	Expression       string
	ExpressionExists bool
}

func init() {
	config.GlobalConfig.Register("billing_setting", &billingSetting)
}

// ---------------------------------------------------------------------------
// Read accessors (hot path, must be fast)
// ---------------------------------------------------------------------------

func getBillingMode(setting *BillingSetting, model string) string {
	if mode, ok := setting.BillingMode[model]; ok {
		return mode
	}
	if _, ok := builtinBillingExpr[model]; ok {
		// Existing administrator-configured legacy prices take precedence over
		// a newly introduced built-in expression unless a mode was explicit.
		if ratio_setting.HasConfiguredModelRatio(model) {
			return BillingModeRatio
		}
		if _, configured := ratio_setting.GetModelPrice(model, false); configured {
			return BillingModeRatio
		}
		return BillingModeTieredExpr
	}
	return BillingModeRatio
}

func getBillingExpr(setting *BillingSetting, model string) (string, bool) {
	if expr, ok := setting.BillingExpr[model]; ok {
		return expr, true
	}
	if getBillingMode(setting, model) == BillingModeTieredExpr {
		expr, ok := builtinBillingExpr[model]
		return expr, ok
	}
	return "", false
}

func resolveModelBillingDecision(setting *BillingSetting, model string) BillingDecision {
	mode := getBillingMode(setting, model)
	expression, exists := getBillingExpr(setting, model)
	return BillingDecision{Mode: mode, Expression: expression, ExpressionExists: exists}
}

func ResolveModelBillingDecision(model string) BillingDecision {
	decision := BillingDecision{Mode: BillingModeRatio}
	config.GlobalConfig.Read("billing_setting", func(value any) {
		decision = resolveModelBillingDecision(value.(*BillingSetting), model)
	})
	return decision
}

func GetBillingMode(model string) string {
	return ResolveModelBillingDecision(model).Mode
}

func GetBillingExpr(model string) (string, bool) {
	decision := ResolveModelBillingDecision(model)
	return decision.Expression, decision.ExpressionExists
}

func GetBuiltinBillingExpr(model string) (string, bool) {
	expression, ok := builtinBillingExpr[model]
	return expression, ok
}

func PluginBillingExprKey(pluginKey, model string) string {
	return pluginKey + "::" + model
}

func SplitPluginBillingExprKey(key string) (plugin, model string, ok bool) {
	plugin, model, ok = strings.Cut(key, "::")
	if !ok || !jsplugin.ValidPluginKey(plugin) || strings.TrimSpace(model) == "" {
		return "", "", false
	}
	return plugin, model, true
}

func GetPluginBillingExprCopy() map[string]string {
	var expressions map[string]string
	config.GlobalConfig.Read("billing_setting", func(value any) {
		expressions = maps.Clone(value.(*BillingSetting).PluginBillingExpr)
	})
	return expressions
}

func GetPluginBillingExpr(pluginKey, model string) (string, bool) {
	var expression string
	var ok bool
	config.GlobalConfig.Read("billing_setting", func(value any) {
		expression, ok = value.(*BillingSetting).PluginBillingExpr[PluginBillingExprKey(pluginKey, model)]
	})
	return expression, ok
}

func resolveTaskBillingDecision(setting *BillingSetting, pluginKey, model, mappedModel string) BillingDecision {
	if pluginKey != "" {
		if expression, ok := setting.PluginBillingExpr[PluginBillingExprKey(pluginKey, model)]; ok {
			return BillingDecision{Mode: BillingModeTieredExpr, Expression: expression, ExpressionExists: true}
		}
		if mappedModel != "" && mappedModel != model {
			if expression, ok := setting.PluginBillingExpr[PluginBillingExprKey(pluginKey, mappedModel)]; ok {
				return BillingDecision{Mode: BillingModeTieredExpr, Expression: expression, ExpressionExists: true}
			}
		}
	}
	decision := resolveModelBillingDecision(setting, model)
	if decision.Mode == BillingModeTieredExpr {
		return decision
	}
	if mappedModel != "" && mappedModel != model {
		mappedDecision := resolveModelBillingDecision(setting, mappedModel)
		if mappedDecision.Mode == BillingModeTieredExpr {
			mappedDecision.ExpressionExists = mappedDecision.ExpressionExists &&
				strings.TrimSpace(mappedDecision.Expression) != ""
			return mappedDecision
		}
	}
	return BillingDecision{Mode: BillingModeRatio}
}

// ResolveTaskBillingDecision selects the executing plugin's override before
// model and mapped-model expressions under one configuration read lock.
func ResolveTaskBillingDecision(pluginKey, model, mappedModel string) BillingDecision {
	decision := BillingDecision{Mode: BillingModeRatio}
	config.GlobalConfig.Read("billing_setting", func(value any) {
		decision = resolveTaskBillingDecision(value.(*BillingSetting), pluginKey, model, mappedModel)
	})
	return decision
}

// ResolveTaskBillingExpr preserves the expression-only API for existing callers.
func ResolveTaskBillingExpr(pluginKey, model, mappedModel string) (string, bool) {
	decision := ResolveTaskBillingDecision(pluginKey, model, mappedModel)
	return decision.Expression, decision.ExpressionExists
}

// TaskExprCompatible checks the schema contract even for usage references in
// branches that the current request would not evaluate.
func TaskExprCompatible(expression string, schema map[string]jsplugin.UsageFieldSchema) bool {
	if strings.TrimSpace(expression) == "" {
		return false
	}
	if _, err := billingexpr.CompileFromCache(expression); err != nil {
		return false
	}
	for key := range billingexpr.UsedUsageKeys(expression) {
		if _, exists := schema[key]; !exists {
			return false
		}
	}
	return !billingexpr.UsesFixedPricing(expression)
}

func GetBuiltinBillingExprCopy() map[string]string {
	return lo.Assign(builtinBillingExpr)
}

func getBillingModeCopy(setting *BillingSetting) map[string]string {
	modes := lo.Assign(setting.BillingMode)
	for model := range builtinBillingExpr {
		if _, configured := modes[model]; !configured && getBillingMode(setting, model) == BillingModeTieredExpr {
			modes[model] = BillingModeTieredExpr
		}
	}
	return modes
}

func getBillingExprCopy(setting *BillingSetting) map[string]string {
	expressions := lo.Assign(setting.BillingExpr)
	for model := range builtinBillingExpr {
		if _, configured := expressions[model]; configured {
			continue
		}
		if expression, ok := getBillingExpr(setting, model); ok {
			expressions[model] = expression
		}
	}
	return expressions
}

// GetBillingOptionSnapshot returns the complete API-facing billing bundle
// from one configuration generation.
func GetBillingOptionSnapshot() BillingSetting {
	var snapshot BillingSetting
	config.GlobalConfig.Read("billing_setting", func(value any) {
		setting := value.(*BillingSetting)
		snapshot = BillingSetting{
			BillingMode:       getBillingModeCopy(setting),
			BillingExpr:       getBillingExprCopy(setting),
			PluginBillingExpr: maps.Clone(setting.PluginBillingExpr),
		}
	})
	return snapshot
}

func GetBillingModeCopy() map[string]string {
	var modes map[string]string
	config.GlobalConfig.Read("billing_setting", func(value any) {
		modes = getBillingModeCopy(value.(*BillingSetting))
	})
	return modes
}

func GetBillingExprCopy() map[string]string {
	var expressions map[string]string
	config.GlobalConfig.Read("billing_setting", func(value any) {
		expressions = getBillingExprCopy(value.(*BillingSetting))
	})
	return expressions
}

func GetPricingSyncData(base map[string]any) map[string]any {
	extra := make(map[string]any, 2)
	config.GlobalConfig.Read("billing_setting", func(value any) {
		setting := value.(*BillingSetting)
		modes := getBillingModeCopy(setting)
		expressions := getBillingExprCopy(setting)
		if len(modes) > 0 {
			extra[BillingModeField] = modes
		}
		if len(expressions) > 0 {
			extra[BillingExprField] = expressions
		}
	})
	return lo.Assign(base, extra)
}

func IsBillingSettingOption(key string) bool {
	switch key {
	case BillingModeOption, BillingExprOption, PluginBillingExprOption:
		return true
	default:
		return false
	}
}

func validateBillingSettingMap(optionKey, value string) error {
	var parsed map[string]string
	if err := json.Unmarshal([]byte(value), &parsed); err != nil {
		return fmt.Errorf("invalid billing setting option %s: %w", optionKey, err)
	}
	if parsed == nil {
		return fmt.Errorf("invalid billing setting option %s: expected a non-null JSON object", optionKey)
	}
	return nil
}

// UpdateBillingSettingOptions validates every supplied map before publishing
// the complete partial update under the ConfigManager write lock.
func UpdateBillingSettingOptions(options map[string]string) error {
	values := make(map[string]string, len(options))
	for key, value := range options {
		var field string
		switch key {
		case BillingModeOption:
			field = BillingModeField
		case BillingExprOption:
			field = BillingExprField
		case PluginBillingExprOption:
			field = "plugin_billing_expr"
		default:
			return fmt.Errorf("unsupported billing setting option: %s", key)
		}
		if err := validateBillingSettingMap(key, value); err != nil {
			return err
		}
		values[field] = value
	}
	if len(values) == 0 {
		return nil
	}
	updated, err := config.GlobalConfig.UpdateFromMap("billing_setting", values)
	if err != nil {
		return err
	}
	if !updated {
		return fmt.Errorf("billing setting is not registered")
	}
	return nil
}

// ---------------------------------------------------------------------------
// Smoke test (called externally for validation before save)
// ---------------------------------------------------------------------------

func SmokeTestExpr(exprStr string) error {
	return smokeTestExpr(exprStr)
}

func smokeTestExpr(exprStr string) error {
	if _, err := billingexpr.CompileFromCache(exprStr); err != nil {
		return err
	}
	usageKeys := billingexpr.UsedUsageKeys(exprStr)
	if len(usageKeys) > 0 {
		sortedKeys := make([]string, 0, len(usageKeys))
		for key := range usageKeys {
			sortedKeys = append(sortedKeys, key)
		}
		sort.Strings(sortedKeys)
		return fmt.Errorf("expression references usage keys %v but the model has no task plugin usage schema", sortedKeys)
	}

	vectors := []billingexpr.TokenParams{
		{P: 0, C: 0, Len: 0},
		{P: 1000, C: 1000, Len: 1000},
		{P: 100000, C: 100000, Len: 100000},
		{P: 1000000, C: 1000000, Len: 1000000},
		{P: 300, C: 100, Len: 1000, CR: 100, Img: 400, ImgCR: 200},
		{P: 800, C: 50, Len: 1000, AI: 200, AO: 50},
		{Len: math.MaxInt32, ImgCR: math.MaxInt32},
	}

	for _, v := range vectors {
		for _, request := range billingExprSmokeRequests() {
			result, _, err := billingexpr.RunExprWithRequest(exprStr, v, request)
			if err != nil {
				return fmt.Errorf("vector {p=%g, c=%g}: run failed: %w", v.P, v.C, err)
			}
			if math.IsNaN(result) || math.IsInf(result, 0) || result < 0 {
				return fmt.Errorf("vector {p=%g, c=%g}: result must be finite and non-negative, got %f", v.P, v.C, result)
			}
		}
	}
	return nil
}

// SmokeTestTaskExpr validates a task usage expression against the usage facts
// declared by its plugin. Literal u() keys must be declared; dynamic calls are
// still exercised by the generated runtime vectors when possible.
func SmokeTestTaskExpr(exprStr string, schema map[string]jsplugin.UsageFieldSchema) error {
	if _, err := billingexpr.CompileFromCache(exprStr); err != nil {
		return err
	}
	if billingexpr.UsesFixedPricing(exprStr) {
		return fmt.Errorf("fixed pricing is not supported for task usage expressions")
	}
	for key := range billingexpr.UsedUsageKeys(exprStr) {
		if _, declared := schema[key]; !declared {
			return fmt.Errorf("usage key %q is not declared by the task plugin", key)
		}
	}

	for _, usage := range taskUsageSmokeVectors(schema) {
		for _, request := range billingExprSmokeRequests() {
			request.Usage = usage
			result, _, err := billingexpr.RunExprWithRequest(exprStr, billingexpr.TokenParams{}, request)
			if err != nil {
				return fmt.Errorf("usage vector %v: run failed: %w", usage, err)
			}
			if math.IsNaN(result) || math.IsInf(result, 0) || result < 0 {
				return fmt.Errorf("usage vector %v: result must be finite and non-negative, got %f", usage, result)
			}
		}
	}
	return nil
}

type usageSmokeDimension struct {
	name   string
	values []any
}

func taskUsageSmokeVectors(schema map[string]jsplugin.UsageFieldSchema) []map[string]any {
	names := make([]string, 0, len(schema))
	for name := range schema {
		names = append(names, name)
	}
	sort.Strings(names)

	dimensions := make([]usageSmokeDimension, 0, len(names))
	for _, name := range names {
		field := schema[name]
		if len(field.Enum) > 0 {
			values := make([]any, len(field.Enum))
			for index, value := range field.Enum {
				values[index] = value
			}
			dimensions = append(dimensions, usageSmokeDimension{name: name, values: values})
			continue
		}
		if field.Type == "boolean" {
			dimensions = append(dimensions, usageSmokeDimension{name: name, values: []any{false, true}})
			continue
		}
		limit := relaycommon.MaxTaskDurationSeconds
		if field.Unit == "count" {
			limit = dto.MaxImageN
		}
		if field.Unit == "token" || field.Unit == "credit" {
			limit = common.MaxQuota
		}
		dimensions = append(dimensions, usageSmokeDimension{
			name:   name,
			values: []any{float64(0), float64(1), float64(limit)},
		})
	}

	if usageSmokeCombinationCount(dimensions, maxTaskExprSmokeTests) > maxTaskExprSmokeTests {
		for index := range dimensions {
			field := schema[dimensions[index].name]
			if len(field.Enum) <= 2 {
				continue
			}
			dimensions[index].values = []any{field.Enum[0], field.Enum[len(field.Enum)-1]}
		}
	}

	vectors := make([]map[string]any, 0, maxTaskExprSmokeTests)
	var appendVectors func(int, map[string]any)
	appendVectors = func(index int, current map[string]any) {
		if len(vectors) >= maxTaskExprSmokeTests {
			return
		}
		if index == len(dimensions) {
			vector := make(map[string]any, len(current))
			maps.Copy(vector, current)
			vectors = append(vectors, vector)
			return
		}
		for _, value := range dimensions[index].values {
			current[dimensions[index].name] = value
			appendVectors(index+1, current)
		}
		delete(current, dimensions[index].name)
	}
	appendVectors(0, make(map[string]any, len(dimensions)))

	combinationCount := usageSmokeCombinationCount(dimensions, maxTaskExprSmokeTests)
	if combinationCount > maxTaskExprSmokeTests && len(vectors) > 0 {
		last := make(map[string]any, len(dimensions))
		for _, dimension := range dimensions {
			last[dimension.name] = dimension.values[len(dimension.values)-1]
		}
		vectors[len(vectors)-1] = last
	}
	return vectors
}

func usageSmokeCombinationCount(dimensions []usageSmokeDimension, stopAfter int) int {
	count := 1
	for _, dimension := range dimensions {
		if len(dimension.values) == 0 {
			return 0
		}
		if count > stopAfter/len(dimension.values) {
			return stopAfter + 1
		}
		count *= len(dimension.values)
	}
	return count
}

func billingExprSmokeRequests() []billingexpr.RequestInput {
	return []billingexpr.RequestInput{
		{},
		{
			Headers: map[string]string{
				"anthropic-beta": "fast-mode-2026-02-01",
			},
			Body: []byte(`{"service_tier":"fast","stream_options":{"include_usage":true},"messages":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21]}`),
		},
	}
}
