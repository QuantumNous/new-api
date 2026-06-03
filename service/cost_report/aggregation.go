package cost_report

import (
	"context"
	"crypto/sha256"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

type Service struct {
	db    *gorm.DB
	logDB *gorm.DB
}

func NewService(db *gorm.DB, logDB *gorm.DB) *Service {
	if db == nil {
		db = model.DB
	}
	if logDB == nil {
		logDB = model.LOG_DB
	}
	return &Service{db: db, logDB: logDB}
}

type PreviewRequest struct {
	TemplateID        int                       `json:"template_id"`
	TemplateVersionID int                       `json:"template_version_id"`
	Config            *CostReportTemplateConfig `json:"config,omitempty"`
	PeriodStart       int64                     `json:"period_start"`
	PeriodEnd         int64                     `json:"period_end"`
	PeriodKey         string                    `json:"period_key"`
	IncludeManual     bool                      `json:"include_manual"`
	MaxLogs           int                       `json:"max_logs,omitempty"`
}

type PreviewResponse struct {
	TemplateID        int          `json:"template_id"`
	TemplateVersionID int          `json:"template_version_id"`
	PeriodStart       int64        `json:"period_start"`
	PeriodEnd         int64        `json:"period_end"`
	PeriodKey         string       `json:"period_key"`
	Timezone          string       `json:"timezone"`
	SourceLogMaxID    int          `json:"source_log_max_id"`
	Rows              []PreviewRow `json:"rows"`
	Warnings          []string     `json:"warnings,omitempty"`
}

type PreviewRow struct {
	RowKey          string                 `json:"row_key"`
	Dimensions      map[string]interface{} `json:"dimensions"`
	Metrics         map[string]interface{} `json:"metrics"`
	ManualValues    map[string]interface{} `json:"manual_values"`
	FormulaValues   map[string]interface{} `json:"formula_values"`
	Values          map[string]interface{} `json:"values"`
	ManualOverrides map[string]bool        `json:"-"`
}

type metricAccumulator struct {
	aggregate string
	count     int
	sum       float64
	min       float64
	max       float64
	set       bool
}

type rowAccumulator struct {
	row     PreviewRow
	metrics map[string]*metricAccumulator
}

const consumeLogScanBatchSize = 1000

func (s *Service) Preview(ctx context.Context, request PreviewRequest) (*PreviewResponse, error) {
	if s == nil || s.db == nil || s.logDB == nil {
		return nil, fmt.Errorf("db and log_db are required")
	}
	if request.PeriodStart <= 0 || request.PeriodEnd <= request.PeriodStart {
		return nil, fmt.Errorf("valid period_start and period_end are required")
	}

	config, templateID, versionID, err := s.resolvePreviewConfig(ctx, request)
	if err != nil {
		return nil, err
	}
	if err := ValidateTemplateConfig(config); err != nil {
		return nil, err
	}
	periodKey := request.PeriodKey
	if periodKey == "" {
		periodKey = defaultPeriodKey(config, request.PeriodStart)
	}
	loc, _ := time.LoadLocation(config.Timezone)

	sourceLogMaxID := 0
	channelIDs := map[int]bool{}
	userIDs := map[int]bool{}
	if err := s.scanConsumeLogs(ctx, request.PeriodStart, request.PeriodEnd, request.MaxLogs, func(logs []model.Log) error {
		for i := range logs {
			if logs[i].Id > sourceLogMaxID {
				sourceLogMaxID = logs[i].Id
			}
			if logs[i].ChannelId > 0 {
				channelIDs[logs[i].ChannelId] = true
			}
			if logs[i].UserId > 0 {
				userIDs[logs[i].UserId] = true
			}
		}
		return nil
	}); err != nil {
		return nil, err
	}
	channels, err := s.loadChannels(ctx, setKeys(channelIDs))
	if err != nil {
		return nil, err
	}
	users, err := s.loadUsers(ctx, setKeys(userIDs))
	if err != nil {
		return nil, err
	}

	fieldsByKey := map[string]FieldConfig{}
	for _, field := range config.Fields {
		fieldsByKey[field.Key] = field
	}
	rowsByKey := map[string]*rowAccumulator{}
	if err := s.scanConsumeLogs(ctx, request.PeriodStart, request.PeriodEnd, request.MaxLogs, func(logs []model.Log) error {
		for i := range logs {
			log := &logs[i]
			channel := channels[log.ChannelId]
			user := users[log.UserId]
			other := parseLogOther(log.Other)
			classification := Classify(config, ClassificationInput{Log: log, Channel: channel, User: user, LogOther: other})

			baseValues := map[string]interface{}{}
			for _, field := range config.Fields {
				if field.Kind != FieldKindDimension {
					continue
				}
				baseValues[field.Key] = dimensionValue(field.Source, log, channel, user, other, classification, loc)
			}
			rowKey := makeRowKey(config.Grouping, baseValues)
			acc := rowsByKey[rowKey]
			if acc == nil {
				acc = &rowAccumulator{
					row: PreviewRow{
						RowKey:          rowKey,
						Dimensions:      map[string]interface{}{},
						Metrics:         map[string]interface{}{},
						ManualValues:    map[string]interface{}{},
						FormulaValues:   map[string]interface{}{},
						Values:          map[string]interface{}{},
						ManualOverrides: map[string]bool{},
					},
					metrics: map[string]*metricAccumulator{},
				}
				for key, value := range baseValues {
					acc.row.Dimensions[key] = value
					acc.row.Values[key] = value
				}
				rowsByKey[rowKey] = acc
			}
			for _, field := range config.Fields {
				if field.Kind != FieldKindMetric {
					continue
				}
				value, ok := metricSourceValue(field.Source, log, other)
				if !ok {
					continue
				}
				ma := acc.metrics[field.Key]
				if ma == nil {
					ma = &metricAccumulator{aggregate: field.Aggregate}
					acc.metrics[field.Key] = ma
				}
				ma.add(value)
			}
		}
		return nil
	}); err != nil {
		return nil, err
	}

	rows := make([]PreviewRow, 0, len(rowsByKey))
	for _, acc := range rowsByKey {
		for _, field := range config.Fields {
			if field.Kind != FieldKindMetric {
				continue
			}
			value := interface{}(float64(0))
			if ma := acc.metrics[field.Key]; ma != nil {
				value = ma.value()
			}
			acc.row.Metrics[field.Key] = value
			acc.row.Values[field.Key] = value
		}
		rows = append(rows, acc.row)
	}
	sortPreviewRows(rows, config.Sort)
	for i := range rows {
		if field, ok := fieldsByKey["row_index"]; ok && field.Source == "generated.row_index" {
			rows[i].Dimensions["row_index"] = i + 1
			rows[i].Values["row_index"] = i + 1
		}
	}

	applyManualDefaults(fieldsByKey, rows)
	if request.IncludeManual && templateID > 0 {
		if err := s.mergePersistedManualValues(ctx, templateID, periodKey, fieldsByKey, rows); err != nil {
			return nil, err
		}
	}

	formulaEval, err := newFormulaEvaluator(config)
	if err != nil {
		return nil, err
	}
	warnings := formulaEval.evaluateRows(rows)

	return &PreviewResponse{
		TemplateID:        templateID,
		TemplateVersionID: versionID,
		PeriodStart:       request.PeriodStart,
		PeriodEnd:         request.PeriodEnd,
		PeriodKey:         periodKey,
		Timezone:          config.Timezone,
		SourceLogMaxID:    sourceLogMaxID,
		Rows:              rows,
		Warnings:          warnings,
	}, nil
}

func (s *Service) resolvePreviewConfig(ctx context.Context, request PreviewRequest) (CostReportTemplateConfig, int, int, error) {
	if request.Config != nil {
		return *request.Config, request.TemplateID, request.TemplateVersionID, nil
	}
	if request.TemplateVersionID > 0 {
		var version model.CostReportTemplateVersion
		if err := s.db.WithContext(ctx).First(&version, request.TemplateVersionID).Error; err != nil {
			return CostReportTemplateConfig{}, 0, 0, err
		}
		var config CostReportTemplateConfig
		if err := common.UnmarshalJsonStr(version.ConfigJson, &config); err != nil {
			return CostReportTemplateConfig{}, 0, 0, err
		}
		return config, version.TemplateId, version.Id, nil
	}
	if request.TemplateID <= 0 {
		return CostReportTemplateConfig{}, 0, 0, fmt.Errorf("template_id or config is required")
	}
	var template model.CostReportTemplate
	if err := s.db.WithContext(ctx).First(&template, request.TemplateID).Error; err != nil {
		return CostReportTemplateConfig{}, 0, 0, err
	}
	if template.CurrentVersionId == nil {
		return CostReportTemplateConfig{}, 0, 0, fmt.Errorf("template has no current version")
	}
	return s.resolvePreviewConfig(ctx, PreviewRequest{TemplateVersionID: *template.CurrentVersionId})
}

func (s *Service) fetchConsumeLogs(ctx context.Context, start, end int64, maxLogs int) ([]model.Log, error) {
	logs := []model.Log{}
	err := s.scanConsumeLogs(ctx, start, end, maxLogs, func(batch []model.Log) error {
		logs = append(logs, batch...)
		return nil
	})
	return logs, err
}

func (s *Service) scanConsumeLogs(ctx context.Context, start, end int64, maxLogs int, handle func([]model.Log) error) error {
	if handle == nil {
		return fmt.Errorf("consume log handler is required")
	}
	remaining := maxLogs
	lastCreatedAt := int64(-1)
	lastID := 0
	for {
		limit := consumeLogScanBatchSize
		if remaining > 0 && remaining < limit {
			limit = remaining
		}
		query := s.logDB.WithContext(ctx).
			Where("type = ? AND created_at >= ? AND created_at < ?", model.LogTypeConsume, start, end)
		if lastCreatedAt >= 0 {
			query = query.Where("created_at > ? OR (created_at = ? AND id > ?)", lastCreatedAt, lastCreatedAt, lastID)
		}
		var batch []model.Log
		if err := query.Order("created_at asc, id asc").Limit(limit).Find(&batch).Error; err != nil {
			return err
		}
		if len(batch) == 0 {
			return nil
		}
		if err := handle(batch); err != nil {
			return err
		}
		last := batch[len(batch)-1]
		lastCreatedAt = last.CreatedAt
		lastID = last.Id
		if remaining > 0 {
			remaining -= len(batch)
			if remaining <= 0 {
				return nil
			}
		}
		if len(batch) < limit {
			return nil
		}
	}
}

func (s *Service) loadChannels(ctx context.Context, ids []int) (map[int]*model.Channel, error) {
	result := map[int]*model.Channel{}
	if len(ids) == 0 {
		return result, nil
	}
	var channels []model.Channel
	if err := s.db.WithContext(ctx).Select("id", "type", "name", "models").Where("id IN ?", ids).Find(&channels).Error; err != nil {
		return nil, err
	}
	for i := range channels {
		channel := channels[i]
		result[channel.Id] = &channel
	}
	return result, nil
}

func (s *Service) loadUsers(ctx context.Context, ids []int) (map[int]*model.User, error) {
	result := map[int]*model.User{}
	if len(ids) == 0 {
		return result, nil
	}
	var users []model.User
	if err := s.db.WithContext(ctx).Select("id", "username", "display_name").Where("id IN ?", ids).Find(&users).Error; err != nil {
		return nil, err
	}
	for i := range users {
		user := users[i]
		result[user.Id] = &user
	}
	return result, nil
}

func applyManualDefaults(fields map[string]FieldConfig, rows []PreviewRow) {
	for i := range rows {
		for key, field := range fields {
			if field.Kind != FieldKindManual {
				continue
			}
			if _, exists := rows[i].Values[key]; exists {
				continue
			}
			value := parseManualValue(field.ValueType, field.DefaultValue)
			rows[i].ManualValues[key] = value
			rows[i].Values[key] = value
		}
	}
}

func (s *Service) mergePersistedManualValues(ctx context.Context, templateID int, periodKey string, fields map[string]FieldConfig, rows []PreviewRow) error {
	if templateID <= 0 || periodKey == "" || len(rows) == 0 {
		return nil
	}
	rowKeys := make([]string, 0, len(rows))
	for _, row := range rows {
		rowKeys = append(rowKeys, row.RowKey)
	}
	manuals, err := s.ReadManualCells(ctx, templateID, periodKey, rowKeys)
	if err != nil {
		return err
	}
	for i := range rows {
		for fieldKey, manual := range manuals[rows[i].RowKey] {
			field, ok := fields[fieldKey]
			if !ok || (field.Kind != FieldKindManual && !(field.Kind == FieldKindFormula && field.ManualOverride)) {
				continue
			}
			rows[i].ManualValues[fieldKey] = manual.Value
			rows[i].Values[fieldKey] = manual.Value
			if field.Kind == FieldKindFormula {
				rows[i].FormulaValues[fieldKey] = manual.Value
				rows[i].ManualOverrides[fieldKey] = true
			}
		}
	}
	return nil
}

func (ma *metricAccumulator) add(value float64) {
	ma.count++
	ma.sum += value
	if !ma.set || value < ma.min {
		ma.min = value
	}
	if !ma.set || value > ma.max {
		ma.max = value
	}
	ma.set = true
}

func (ma *metricAccumulator) value() interface{} {
	if ma == nil || !ma.set {
		return float64(0)
	}
	switch ma.aggregate {
	case "count":
		return ma.count
	case "avg":
		if ma.count == 0 {
			return float64(0)
		}
		return ma.sum / float64(ma.count)
	case "min":
		return ma.min
	case "max":
		return ma.max
	default:
		return ma.sum
	}
}

func dimensionValue(source string, log *model.Log, channel *model.Channel, user *model.User, other map[string]interface{}, classification ClassificationResult, loc *time.Location) interface{} {
	switch source {
	case "generated.row_index":
		return 0
	case "period.date":
		return time.Unix(log.CreatedAt, 0).In(loc).Format("2006-01-02")
	case "log.username":
		return log.Username
	case "log.user_id":
		return log.UserId
	case "log.channel_id":
		return log.ChannelId
	case "log.model_name":
		return log.ModelName
	case "log.group":
		return log.Group
	case "classification.output":
		return classification.Class
	case "channel.name":
		if channel == nil {
			return ""
		}
		return channel.Name
	case "channel.type":
		if channel == nil {
			return 0
		}
		return channel.Type
	case "user.display_name":
		if user == nil {
			return ""
		}
		return user.DisplayName
	default:
		if strings.HasPrefix(source, "log_other.") {
			value, _ := nestedMapValue(other, strings.TrimPrefix(source, "log_other."))
			return value
		}
		return ""
	}
}

func metricSourceValue(source string, log *model.Log, other map[string]interface{}) (float64, bool) {
	switch source {
	case "log.created_at":
		return float64(log.CreatedAt), true
	case "log.quota":
		return float64(log.Quota), true
	case "log.quota_per_unit":
		if common.QuotaPerUnit <= 0 {
			return float64(log.Quota), true
		}
		return float64(log.Quota) / common.QuotaPerUnit, true
	case "log.prompt_tokens":
		return float64(log.PromptTokens), true
	case "log.completion_tokens":
		return float64(log.CompletionTokens), true
	case "log.total_tokens":
		return float64(log.PromptTokens + log.CompletionTokens), true
	case "log.request_count":
		return 1, true
	default:
		if strings.HasPrefix(source, "log_other.") {
			value, ok := nestedMapValue(other, strings.TrimPrefix(source, "log_other."))
			if !ok {
				return 0, false
			}
			return toFloat64(value), true
		}
		return 0, false
	}
}

func parseLogOther(text string) map[string]interface{} {
	if strings.TrimSpace(text) == "" {
		return map[string]interface{}{}
	}
	var out map[string]interface{}
	if err := common.Unmarshal([]byte(text), &out); err != nil || out == nil {
		return map[string]interface{}{}
	}
	return out
}

func makeRowKey(grouping []string, values map[string]interface{}) string {
	parts := normalizedRowKeyParts(grouping, values)
	payload, err := common.Marshal(parts)
	if err != nil {
		payload = []byte(strings.Join(parts, "\x1f"))
	}
	hash := sha256.Sum256(payload)
	return fmt.Sprintf("%x", hash)
}

func normalizedRowKeyParts(grouping []string, values map[string]interface{}) []string {
	parts := make([]string, 0, len(grouping))
	for _, key := range grouping {
		parts = append(parts, key+"="+valueToString(values[key]))
	}
	return parts
}

func sortPreviewRows(rows []PreviewRow, sortRules []SortConfig) {
	sort.SliceStable(rows, func(i, j int) bool {
		for _, rule := range sortRules {
			cmp := compareValues(rows[i].Values[rule.Field], rows[j].Values[rule.Field])
			if cmp == 0 {
				continue
			}
			if strings.ToLower(rule.Direction) == "desc" {
				return cmp > 0
			}
			return cmp < 0
		}
		return rows[i].RowKey < rows[j].RowKey
	})
}

func compareValues(a, b interface{}) int {
	af, aok := numericValue(a)
	bf, bok := numericValue(b)
	if aok && bok {
		if af < bf {
			return -1
		}
		if af > bf {
			return 1
		}
		return 0
	}
	as := valueToString(a)
	bs := valueToString(b)
	if as < bs {
		return -1
	}
	if as > bs {
		return 1
	}
	return 0
}

func numericValue(value interface{}) (float64, bool) {
	switch v := value.(type) {
	case int:
		return float64(v), true
	case int64:
		return float64(v), true
	case float64:
		return v, true
	case float32:
		return float64(v), true
	default:
		return 0, false
	}
}

func toFloat64(value interface{}) float64 {
	if value == nil {
		return 0
	}
	if f, ok := numericValue(value); ok {
		return f
	}
	switch v := value.(type) {
	case string:
		f, _ := strconv.ParseFloat(strings.TrimSpace(v), 64)
		return f
	default:
		f, _ := strconv.ParseFloat(fmt.Sprint(v), 64)
		return f
	}
}

func valueToString(value interface{}) string {
	if value == nil {
		return ""
	}
	switch v := value.(type) {
	case string:
		return v
	case fmt.Stringer:
		return v.String()
	default:
		return fmt.Sprint(v)
	}
}

func setKeys(m map[int]bool) []int {
	keys := make([]int, 0, len(m))
	for key := range m {
		keys = append(keys, key)
	}
	sort.Ints(keys)
	return keys
}

func defaultPeriodKey(config CostReportTemplateConfig, start int64) string {
	loc, err := time.LoadLocation(config.Timezone)
	if err != nil {
		loc = time.UTC
	}
	return time.Unix(start, 0).In(loc).Format("2006-01-02")
}
