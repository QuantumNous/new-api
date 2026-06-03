package cost_report

import (
	"crypto/sha256"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/expr-lang/expr"
	"github.com/expr-lang/expr/ast"
	"gorm.io/gorm"
)

const (
	DefaultTemplateKey = "claude_cost_default"

	PeriodModeDay    = "day"
	PeriodModeCustom = "custom"

	FieldKindDimension = "dimension"
	FieldKindMetric    = "metric"
	FieldKindManual    = "manual"
	FieldKindFormula   = "formula"

	FormulaModeStandard = "standard"
	FormulaModeRunning  = "running"
)

var (
	identifierRE     = regexp.MustCompile(`^[a-z][a-z0-9_]{0,63}$`)
	logOtherSourceRE = regexp.MustCompile(`^log_other\.[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$`)
)

type CostReportTemplateConfig struct {
	Timezone            string                     `json:"timezone"`
	PeriodMode          string                     `json:"period_mode"`
	Grouping            []string                   `json:"grouping"`
	Sort                []SortConfig               `json:"sort"`
	Fields              []FieldConfig              `json:"fields"`
	ClassificationRules []ClassificationRuleConfig `json:"classification_rules"`
	ExportLayout        ExportLayoutConfig         `json:"export_layout"`
}

type SortConfig struct {
	Field     string `json:"field"`
	Direction string `json:"direction"`
}

type FieldConfig struct {
	Key               string `json:"key"`
	Label             string `json:"label"`
	Kind              string `json:"kind"`
	ValueType         string `json:"value_type"`
	Source            string `json:"source,omitempty"`
	Aggregate         string `json:"aggregate,omitempty"`
	Expression        string `json:"expression,omitempty"`
	InitialExpression string `json:"initial_expression,omitempty"`
	FormulaMode       string `json:"formula_mode,omitempty"`
	DefaultValue      string `json:"default_value,omitempty"`
	Visible           bool   `json:"visible"`
	Exportable        bool   `json:"exportable"`
	Order             int    `json:"order"`
	ManualOverride    bool   `json:"manual_override,omitempty"`
	Generated         bool   `json:"generated,omitempty"`
}

type ClassificationRuleConfig struct {
	Key             string                         `json:"key"`
	Label           string                         `json:"label"`
	Priority        int                            `json:"priority"`
	Enabled         bool                           `json:"enabled"`
	Match           string                         `json:"match,omitempty"`
	Conditions      []ClassificationCondition      `json:"conditions,omitempty"`
	ConditionGroups []ClassificationConditionGroup `json:"condition_groups,omitempty"`
	OutputClass     string                         `json:"output_class"`
	Fallback        bool                           `json:"fallback,omitempty"`
}

type ClassificationConditionGroup struct {
	Match      string                    `json:"match"`
	Conditions []ClassificationCondition `json:"conditions"`
}

type ClassificationCondition struct {
	Source          string   `json:"source"`
	Operator        string   `json:"operator"`
	Value           string   `json:"value,omitempty"`
	Values          []string `json:"values,omitempty"`
	CaseInsensitive bool     `json:"case_insensitive,omitempty"`
}

type ExportLayoutConfig struct {
	SheetName     string `json:"sheet_name"`
	FreezeHeader  bool   `json:"freeze_header"`
	IncludeMeta   bool   `json:"include_meta"`
	DateFormat    string `json:"date_format"`
	DecimalFormat string `json:"decimal_format"`
}

func DefaultClaudeCostTemplateConfig() CostReportTemplateConfig {
	return CostReportTemplateConfig{
		Timezone:   "Asia/Shanghai",
		PeriodMode: PeriodModeDay,
		Grouping:   []string{"report_date", "customer", "channel_class", "channel_id"},
		Sort: []SortConfig{
			{Field: "report_date", Direction: "asc"},
			{Field: "customer", Direction: "asc"},
			{Field: "channel_class", Direction: "asc"},
			{Field: "channel_id", Direction: "asc"},
		},
		Fields: []FieldConfig{
			{Key: "row_index", Label: "序号", Kind: FieldKindDimension, ValueType: "integer", Source: "generated.row_index", Visible: true, Exportable: true, Order: 10, Generated: true},
			{Key: "report_date", Label: "日期", Kind: FieldKindDimension, ValueType: "date", Source: "period.date", Visible: true, Exportable: true, Order: 20},
			{Key: "customer", Label: "客户", Kind: FieldKindDimension, ValueType: "string", Source: "log.username", Visible: true, Exportable: true, Order: 30},
			{Key: "channel_class", Label: "渠道类型", Kind: FieldKindDimension, ValueType: "string", Source: "classification.output", Visible: true, Exportable: true, Order: 40},
			{Key: "channel_id", Label: "渠道id", Kind: FieldKindDimension, ValueType: "integer", Source: "log.channel_id", Visible: true, Exportable: true, Order: 50},
			{Key: "start_time", Label: "开始使用时间", Kind: FieldKindMetric, ValueType: "date", Source: "log.created_at", Aggregate: "min", Visible: true, Exportable: true, Order: 60},
			{Key: "end_time", Label: "结束使用时间", Kind: FieldKindMetric, ValueType: "date", Source: "log.created_at", Aggregate: "max", Visible: true, Exportable: true, Order: 70},
			{Key: "payment", Label: "打款", Kind: FieldKindManual, ValueType: "currency", Visible: true, Exportable: true, Order: 80},
			{Key: "balance_status", Label: "余额状态", Kind: FieldKindFormula, ValueType: "currency", FormulaMode: FormulaModeRunning, InitialExpression: "payment - receivable", Expression: "previous_balance_status + payment - receivable", Visible: true, Exportable: true, Order: 90},
			{Key: "actual_consumption", Label: "实际消耗数", Kind: FieldKindMetric, ValueType: "decimal", Source: "log.quota_per_unit", Aggregate: "sum", Visible: true, Exportable: true, Order: 100},
			{Key: "unit_price", Label: "（单价）", Kind: FieldKindManual, ValueType: "currency", Visible: true, Exportable: true, Order: 110},
			{Key: "discount", Label: "折扣", Kind: FieldKindFormula, ValueType: "decimal", Expression: "unit_price / 6.8", Visible: true, Exportable: true, Order: 120},
			{Key: "cost", Label: "成本", Kind: FieldKindFormula, ValueType: "currency", Expression: "discount * actual_consumption", Visible: true, Exportable: true, Order: 130},
			{Key: "supply_discount", Label: "供货折扣", Kind: FieldKindManual, ValueType: "decimal", Visible: true, Exportable: true, Order: 140},
			{Key: "receivable", Label: "应收账款", Kind: FieldKindFormula, ValueType: "currency", Expression: "actual_consumption * supply_discount", Visible: true, Exportable: true, Order: 150},
			{Key: "unallocated_profit", Label: "利润（未分配中间方）", Kind: FieldKindFormula, ValueType: "currency", Expression: "receivable - cost", Visible: true, Exportable: true, Order: 160},
			{Key: "middle_profit_ratio", Label: "中间利润比例", Kind: FieldKindFormula, ValueType: "percent", Expression: "(0.73 - 0.67) * 0.55", Visible: true, Exportable: true, Order: 170, ManualOverride: true},
			{Key: "middle_profit", Label: "中间利润（居间）", Kind: FieldKindFormula, ValueType: "currency", Expression: "actual_consumption * middle_profit_ratio", Visible: true, Exportable: true, Order: 180},
			{Key: "xx_profit_ratio", Label: "xx利润比例", Kind: FieldKindFormula, ValueType: "percent", Expression: "(0.73 - 0.67) * 0.45", Visible: true, Exportable: true, Order: 190, ManualOverride: true},
			{Key: "xx_profit", Label: "xx利润", Kind: FieldKindFormula, ValueType: "currency", Expression: "actual_consumption * xx_profit_ratio", Visible: true, Exportable: true, Order: 200},
		},
		ClassificationRules: []ClassificationRuleConfig{
			{
				Key:         "aws_claude_by_type_or_name",
				Label:       "AWS Claude渠道",
				Priority:    10,
				Enabled:     true,
				Match:       "any",
				OutputClass: "AWS",
				ConditionGroups: []ClassificationConditionGroup{
					{Match: "all", Conditions: []ClassificationCondition{{Source: "channel.type", Operator: "equals", Value: fmt.Sprintf("%d", constant.ChannelTypeAws)}}},
					{Match: "all", Conditions: []ClassificationCondition{{Source: "is_claude_related", Operator: "equals", Value: "true"}, {Source: "channel.name", Operator: "contains", Value: "aws", CaseInsensitive: true}}},
				},
			},
			{
				Key:         "claude_key",
				Label:       "Claude Key渠道",
				Priority:    20,
				Enabled:     true,
				Match:       "all",
				OutputClass: "Claude Key",
				Conditions:  []ClassificationCondition{{Source: "is_claude_related", Operator: "equals", Value: "true"}},
			},
			{
				Key:         "other",
				Label:       "其他渠道",
				Priority:    1000,
				Enabled:     true,
				OutputClass: "Other",
				Fallback:    true,
			},
		},
		ExportLayout: ExportLayoutConfig{
			SheetName:     "成本报表（总）",
			FreezeHeader:  true,
			IncludeMeta:   true,
			DateFormat:    "yyyy-mm-dd",
			DecimalFormat: "0.00",
		},
	}
}

func ValidateTemplateConfig(config CostReportTemplateConfig) error {
	if strings.TrimSpace(config.Timezone) == "" {
		return fmt.Errorf("timezone is required")
	}
	if _, err := time.LoadLocation(config.Timezone); err != nil {
		return fmt.Errorf("invalid timezone %q: %w", config.Timezone, err)
	}
	if config.PeriodMode != PeriodModeDay && config.PeriodMode != PeriodModeCustom {
		return fmt.Errorf("invalid period_mode %q", config.PeriodMode)
	}
	if len(config.Fields) == 0 {
		return fmt.Errorf("fields are required")
	}

	fieldsByKey := make(map[string]FieldConfig, len(config.Fields))
	for i, field := range config.Fields {
		if err := validateFieldConfig(field); err != nil {
			return fmt.Errorf("fields[%d] %q: %w", i, field.Key, err)
		}
		if _, exists := fieldsByKey[field.Key]; exists {
			return fmt.Errorf("duplicate field key %q", field.Key)
		}
		fieldsByKey[field.Key] = field
	}
	if err := validateGrouping(config.Grouping, fieldsByKey); err != nil {
		return err
	}
	if err := validateSort(config.Sort, fieldsByKey); err != nil {
		return err
	}
	if err := validateFormulas(config.Fields, fieldsByKey); err != nil {
		return err
	}
	if err := validateClassificationRules(config.ClassificationRules); err != nil {
		return err
	}
	if strings.TrimSpace(config.ExportLayout.SheetName) == "" {
		return fmt.Errorf("export_layout.sheet_name is required")
	}
	return nil
}

func validateFieldConfig(field FieldConfig) error {
	if !identifierRE.MatchString(field.Key) {
		return fmt.Errorf("invalid key")
	}
	if strings.TrimSpace(field.Label) == "" {
		return fmt.Errorf("label is required")
	}
	if !validFieldKinds[field.Kind] {
		return fmt.Errorf("invalid kind %q", field.Kind)
	}
	if !validValueTypes[field.ValueType] {
		return fmt.Errorf("invalid value_type %q", field.ValueType)
	}
	if field.Kind == FieldKindFormula {
		mode := field.FormulaMode
		if mode == "" {
			mode = FormulaModeStandard
		}
		if mode != FormulaModeStandard && mode != FormulaModeRunning {
			return fmt.Errorf("invalid formula_mode %q", field.FormulaMode)
		}
		if strings.TrimSpace(field.Expression) == "" {
			return fmt.Errorf("formula expression is required")
		}
		if mode == FormulaModeRunning && strings.TrimSpace(field.InitialExpression) == "" {
			return fmt.Errorf("running formula initial_expression is required")
		}
		return nil
	}
	if field.Expression != "" || field.InitialExpression != "" {
		return fmt.Errorf("only formula fields may define expressions")
	}
	if field.Kind == FieldKindMetric {
		if !validMetricSources[field.Source] && !validLogOtherSource(field.Source) {
			return fmt.Errorf("invalid metric source %q", field.Source)
		}
		if !validAggregates[field.Aggregate] {
			return fmt.Errorf("invalid aggregate %q", field.Aggregate)
		}
	}
	if field.Kind == FieldKindDimension {
		if !validDimensionSources[field.Source] && !validLogOtherSource(field.Source) {
			return fmt.Errorf("invalid dimension source %q", field.Source)
		}
	}
	return nil
}

func validateGrouping(grouping []string, fields map[string]FieldConfig) error {
	if len(grouping) == 0 {
		return fmt.Errorf("grouping is required")
	}
	seen := map[string]bool{}
	for _, key := range grouping {
		field, ok := fields[key]
		if !ok {
			return fmt.Errorf("grouping references unknown field %q", key)
		}
		if seen[key] {
			return fmt.Errorf("grouping contains duplicate field %q", key)
		}
		seen[key] = true
		if field.Kind != FieldKindDimension {
			return fmt.Errorf("grouping field %q must be a dimension", key)
		}
	}
	return nil
}

func validateSort(sortRules []SortConfig, fields map[string]FieldConfig) error {
	for i, rule := range sortRules {
		if _, ok := fields[rule.Field]; !ok {
			return fmt.Errorf("sort[%d] references unknown field %q", i, rule.Field)
		}
		dir := strings.ToLower(strings.TrimSpace(rule.Direction))
		if dir != "asc" && dir != "desc" {
			return fmt.Errorf("sort[%d] has invalid direction %q", i, rule.Direction)
		}
	}
	return nil
}

func validateFormulas(fields []FieldConfig, fieldsByKey map[string]FieldConfig) error {
	env := make(map[string]interface{}, len(fieldsByKey)+8)
	for key := range fieldsByKey {
		env[key] = float64(0)
		env["previous_"+key] = float64(0)
	}
	env["max"] = math.Max
	env["min"] = math.Min
	env["abs"] = math.Abs
	env["ceil"] = math.Ceil
	env["floor"] = math.Floor

	deps := make(map[string][]string)
	for _, field := range fields {
		if field.Kind != FieldKindFormula {
			continue
		}
		exprs := []string{field.Expression}
		if field.InitialExpression != "" {
			exprs = append(exprs, field.InitialExpression)
		}
		for _, expression := range exprs {
			prog, err := expr.Compile(expression, expr.Env(env), expr.AsFloat64())
			if err != nil {
				return fmt.Errorf("formula %q compile failed: %w", field.Key, err)
			}
			for ref, usage := range formulaRefs(prog.Node(), fieldsByKey) {
				if ref == field.Key && usage.Direct {
					return fmt.Errorf("formula %q references itself", field.Key)
				}
				if fieldsByKey[ref].Kind == FieldKindFormula && ref != field.Key {
					deps[field.Key] = append(deps[field.Key], ref)
				}
			}
		}
	}
	return validateFormulaAcyclic(deps)
}

type formulaRefUsage struct {
	Direct   bool
	Previous bool
}

func formulaRefs(node ast.Node, fields map[string]FieldConfig) map[string]formulaRefUsage {
	refs := map[string]formulaRefUsage{}
	ast.Find(node, func(n ast.Node) bool {
		id, ok := n.(*ast.IdentifierNode)
		if !ok {
			return false
		}
		name := id.Value
		previous := false
		if strings.HasPrefix(name, "previous_") {
			name = strings.TrimPrefix(name, "previous_")
			previous = true
		}
		if _, ok := fields[name]; ok {
			usage := refs[name]
			if previous {
				usage.Previous = true
			} else {
				usage.Direct = true
			}
			refs[name] = usage
		}
		return false
	})
	return refs
}

func validateFormulaAcyclic(deps map[string][]string) error {
	visiting := map[string]bool{}
	visited := map[string]bool{}
	var visit func(string) error
	visit = func(key string) error {
		if visiting[key] {
			return fmt.Errorf("formula dependency cycle detected at %q", key)
		}
		if visited[key] {
			return nil
		}
		visiting[key] = true
		for _, dep := range deps[key] {
			if err := visit(dep); err != nil {
				return err
			}
		}
		visiting[key] = false
		visited[key] = true
		return nil
	}
	keys := make([]string, 0, len(deps))
	for key := range deps {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		if err := visit(key); err != nil {
			return err
		}
	}
	return nil
}

func validateClassificationRules(rules []ClassificationRuleConfig) error {
	if len(rules) == 0 {
		return fmt.Errorf("classification_rules are required")
	}
	seen := map[string]bool{}
	fallbackCount := 0
	for i, rule := range rules {
		if !identifierRE.MatchString(rule.Key) {
			return fmt.Errorf("classification_rules[%d] has invalid key %q", i, rule.Key)
		}
		if seen[rule.Key] {
			return fmt.Errorf("duplicate classification rule key %q", rule.Key)
		}
		seen[rule.Key] = true
		if strings.TrimSpace(rule.OutputClass) == "" {
			return fmt.Errorf("classification rule %q output_class is required", rule.Key)
		}
		if rule.Fallback {
			fallbackCount++
			continue
		}
		if !validMatch(rule.Match) {
			return fmt.Errorf("classification rule %q has invalid match %q", rule.Key, rule.Match)
		}
		if len(rule.Conditions) == 0 && len(rule.ConditionGroups) == 0 {
			return fmt.Errorf("classification rule %q requires conditions or condition_groups", rule.Key)
		}
		for j, condition := range rule.Conditions {
			if err := validateClassificationCondition(condition); err != nil {
				return fmt.Errorf("classification rule %q condition[%d]: %w", rule.Key, j, err)
			}
		}
		for j, group := range rule.ConditionGroups {
			if !validMatch(group.Match) {
				return fmt.Errorf("classification rule %q group[%d] has invalid match %q", rule.Key, j, group.Match)
			}
			if len(group.Conditions) == 0 {
				return fmt.Errorf("classification rule %q group[%d] requires conditions", rule.Key, j)
			}
			for k, condition := range group.Conditions {
				if err := validateClassificationCondition(condition); err != nil {
					return fmt.Errorf("classification rule %q group[%d] condition[%d]: %w", rule.Key, j, k, err)
				}
			}
		}
	}
	if fallbackCount != 1 {
		return fmt.Errorf("exactly one fallback classification rule is required")
	}
	return nil
}

func validateClassificationCondition(condition ClassificationCondition) error {
	if !validClassificationSources[condition.Source] && !validLogOtherSource(condition.Source) {
		return fmt.Errorf("invalid source %q", condition.Source)
	}
	if !validClassificationOperators[condition.Operator] {
		return fmt.Errorf("invalid operator %q", condition.Operator)
	}
	if condition.Operator == "in" {
		if len(condition.Values) == 0 {
			return fmt.Errorf("operator in requires values")
		}
	} else if condition.Operator != "exists" && condition.Value == "" {
		return fmt.Errorf("operator %s requires value", condition.Operator)
	}
	if condition.Operator == "regex" {
		if len(condition.Value) > 256 {
			return fmt.Errorf("regex value is too long")
		}
		if _, err := regexp.Compile(condition.Value); err != nil {
			return fmt.Errorf("invalid regex: %w", err)
		}
	}
	return nil
}

func validMatch(match string) bool {
	return match == "" || match == "all" || match == "any"
}

func validLogOtherSource(source string) bool {
	return logOtherSourceRE.MatchString(source)
}

func ConfigJSONAndHash(config CostReportTemplateConfig) (string, string, error) {
	if err := ValidateTemplateConfig(config); err != nil {
		return "", "", err
	}
	payload, err := common.Marshal(config)
	if err != nil {
		return "", "", err
	}
	hash := sha256.Sum256(payload)
	return string(payload), fmt.Sprintf("%x", hash), nil
}

func EnsureDefaultTemplates(db *gorm.DB, actorID int) error {
	_, err := EnsureDefaultClaudeCostTemplate(db, actorID)
	return err
}

func EnsureDefaultClaudeCostTemplate(db *gorm.DB, actorID int) (*model.CostReportTemplate, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	configJSON, configHash, err := ConfigJSONAndHash(DefaultClaudeCostTemplateConfig())
	if err != nil {
		return nil, err
	}

	var template model.CostReportTemplate
	err = db.Where("key = ?", DefaultTemplateKey).First(&template).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return nil, err
	}
	reusableVersionID := 0
	if err == nil {
		if template.CurrentVersionId != nil {
			var currentVersion model.CostReportTemplateVersion
			versionErr := db.First(&currentVersion, *template.CurrentVersionId).Error
			if versionErr == nil && currentVersion.ConfigHash == configHash {
				return &template, nil
			}
			if versionErr != nil && versionErr != gorm.ErrRecordNotFound {
				return nil, versionErr
			}
		}
		var latestVersion model.CostReportTemplateVersion
		latestErr := db.Where("template_id = ?", template.Id).Order("status asc, version desc, id desc").First(&latestVersion).Error
		if latestErr == nil && latestVersion.ConfigHash == configHash {
			reusableVersionID = latestVersion.Id
		}
		if latestErr != nil && latestErr != gorm.ErrRecordNotFound {
			return nil, latestErr
		}
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		if template.Id == 0 {
			template = model.CostReportTemplate{
				Key:         DefaultTemplateKey,
				Name:        "Claude成本默认模板",
				Description: "对齐样例Excel的Claude渠道成本统计模板",
				Status:      model.CostReportTemplateStatusEnabled,
				CreatedBy:   actorID,
				UpdatedBy:   actorID,
			}
			if err := tx.Create(&template).Error; err != nil {
				return err
			}
		}

		if reusableVersionID > 0 {
			if err := tx.Model(&model.CostReportTemplateVersion{}).Where("template_id = ? AND id <> ?", template.Id, reusableVersionID).Update("status", model.CostReportTemplateVersionStatusArchived).Error; err != nil {
				return err
			}
			if err := tx.Model(&model.CostReportTemplateVersion{}).Where("id = ?", reusableVersionID).Update("status", model.CostReportTemplateVersionStatusActive).Error; err != nil {
				return err
			}
			template.CurrentVersionId = &reusableVersionID
			template.Name = "Claude成本默认模板"
			template.Description = "对齐样例Excel的Claude渠道成本统计模板"
			template.Status = model.CostReportTemplateStatusEnabled
			template.UpdatedBy = actorID
			return tx.Save(&template).Error
		}

		var maxVersion int
		if err := tx.Model(&model.CostReportTemplateVersion{}).Where("template_id = ?", template.Id).Select("COALESCE(MAX(version), 0)").Scan(&maxVersion).Error; err != nil {
			return err
		}
		version := model.CostReportTemplateVersion{
			TemplateId: template.Id,
			Version:    maxVersion + 1,
			Status:     model.CostReportTemplateVersionStatusActive,
			ConfigJson: configJSON,
			ConfigHash: configHash,
			CreatedBy:  actorID,
		}
		if err := tx.Create(&version).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.CostReportTemplateVersion{}).Where("template_id = ? AND id <> ?", template.Id, version.Id).Update("status", model.CostReportTemplateVersionStatusArchived).Error; err != nil {
			return err
		}
		template.CurrentVersionId = &version.Id
		template.Name = "Claude成本默认模板"
		template.Description = "对齐样例Excel的Claude渠道成本统计模板"
		template.Status = model.CostReportTemplateStatusEnabled
		template.UpdatedBy = actorID
		return tx.Save(&template).Error
	})
	if err != nil {
		return nil, err
	}
	return &template, nil
}

var validFieldKinds = map[string]bool{
	FieldKindDimension: true,
	FieldKindMetric:    true,
	FieldKindManual:    true,
	FieldKindFormula:   true,
}

var validValueTypes = map[string]bool{
	"string":   true,
	"integer":  true,
	"decimal":  true,
	"currency": true,
	"percent":  true,
	"date":     true,
}

var validAggregates = map[string]bool{
	"sum":   true,
	"count": true,
	"avg":   true,
	"min":   true,
	"max":   true,
}

var validDimensionSources = map[string]bool{
	"generated.row_index":   true,
	"period.date":           true,
	"log.username":          true,
	"log.user_id":           true,
	"log.channel_id":        true,
	"log.model_name":        true,
	"log.group":             true,
	"classification.output": true,
	"channel.name":          true,
	"channel.type":          true,
	"user.display_name":     true,
}

var validMetricSources = map[string]bool{
	"log.created_at":        true,
	"log.quota":             true,
	"log.quota_per_unit":    true,
	"log.prompt_tokens":     true,
	"log.completion_tokens": true,
	"log.total_tokens":      true,
	"log.request_count":     true,
}

var validClassificationSources = map[string]bool{
	"channel.type":      true,
	"channel.name":      true,
	"channel.id":        true,
	"model_name":        true,
	"group":             true,
	"is_claude_related": true,
}

var validClassificationOperators = map[string]bool{
	"equals":   true,
	"contains": true,
	"regex":    true,
	"in":       true,
	"exists":   true,
}
