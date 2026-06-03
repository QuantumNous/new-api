package cost_report

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ManualCellInput struct {
	TemplateID int    `json:"template_id"`
	PeriodKey  string `json:"period_key"`
	RowKey     string `json:"row_key"`
	FieldKey   string `json:"field_key"`
	ValueType  string `json:"value_type"`
	ValueText  string `json:"value_text"`
	UpdatedBy  int    `json:"updated_by"`
}

type ManualValue struct {
	ValueType string      `json:"value_type"`
	ValueText string      `json:"value_text"`
	Value     interface{} `json:"value"`
	UpdatedBy int         `json:"updated_by"`
	UpdatedAt int64       `json:"updated_at"`
}

func (s *Service) UpsertManualCell(ctx context.Context, input ManualCellInput) (*model.CostReportManualCell, error) {
	if s == nil || s.db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	if input.TemplateID <= 0 {
		return nil, fmt.Errorf("template_id is required")
	}
	if strings.TrimSpace(input.PeriodKey) == "" || strings.TrimSpace(input.RowKey) == "" || strings.TrimSpace(input.FieldKey) == "" {
		return nil, fmt.Errorf("period_key, row_key and field_key are required")
	}
	if !validValueTypes[input.ValueType] {
		return nil, fmt.Errorf("invalid value_type %q", input.ValueType)
	}
	cell := model.CostReportManualCell{
		TemplateId: input.TemplateID,
		PeriodKey:  input.PeriodKey,
		RowKey:     input.RowKey,
		FieldKey:   input.FieldKey,
		ValueType:  input.ValueType,
		ValueText:  input.ValueText,
		UpdatedBy:  input.UpdatedBy,
	}
	err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "template_id"}, {Name: "period_key"}, {Name: "row_key"}, {Name: "field_key"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"value_type",
			"value_text",
			"updated_by",
			"updated_at",
		}),
	}).Create(&cell).Error
	if err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Where("template_id = ? AND period_key = ? AND row_key = ? AND field_key = ?", input.TemplateID, input.PeriodKey, input.RowKey, input.FieldKey).First(&cell).Error; err != nil {
		return nil, err
	}
	return &cell, nil
}

func (s *Service) ReadManualCells(ctx context.Context, templateID int, periodKey string, rowKeys []string) (map[string]map[string]ManualValue, error) {
	if s == nil || s.db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	if templateID <= 0 || strings.TrimSpace(periodKey) == "" {
		return nil, fmt.Errorf("template_id and period_key are required")
	}
	query := s.db.WithContext(ctx).Where("template_id = ? AND period_key = ?", templateID, periodKey)
	if len(rowKeys) > 0 {
		query = query.Where("row_key IN ?", rowKeys)
	}
	var cells []model.CostReportManualCell
	if err := query.Find(&cells).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return map[string]map[string]ManualValue{}, nil
		}
		return nil, err
	}
	result := make(map[string]map[string]ManualValue, len(cells))
	for _, cell := range cells {
		if result[cell.RowKey] == nil {
			result[cell.RowKey] = map[string]ManualValue{}
		}
		result[cell.RowKey][cell.FieldKey] = ManualValue{
			ValueType: cell.ValueType,
			ValueText: cell.ValueText,
			Value:     parseManualValue(cell.ValueType, cell.ValueText),
			UpdatedBy: cell.UpdatedBy,
			UpdatedAt: cell.UpdatedAt,
		}
	}
	return result, nil
}

func parseManualValue(valueType, text string) interface{} {
	text = strings.TrimSpace(text)
	if text == "" {
		switch valueType {
		case "integer":
			return int64(0)
		case "decimal", "currency", "percent":
			return float64(0)
		default:
			return ""
		}
	}
	switch valueType {
	case "integer":
		value, err := strconv.ParseInt(text, 10, 64)
		if err != nil {
			return int64(0)
		}
		return value
	case "decimal", "currency", "percent":
		value, err := strconv.ParseFloat(text, 64)
		if err != nil {
			return float64(0)
		}
		return value
	default:
		return text
	}
}
