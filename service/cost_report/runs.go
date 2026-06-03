package cost_report

import (
	"context"
	"crypto/sha256"
	"fmt"
	"sort"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

type SaveRunResult struct {
	Run  model.CostReportRun           `json:"run"`
	Rows []model.CostReportRowSnapshot `json:"rows,omitempty"`
}

type RunDetail struct {
	Run    model.CostReportRun      `json:"run"`
	Config CostReportTemplateConfig `json:"config"`
	Rows   []RunSnapshotRow         `json:"rows"`
}

type RunSnapshotRow struct {
	Id            int                    `json:"id"`
	RunId         int                    `json:"run_id"`
	RowKey        string                 `json:"row_key"`
	Dimensions    map[string]interface{} `json:"dimensions"`
	Metrics       map[string]interface{} `json:"metrics"`
	ManualValues  map[string]interface{} `json:"manual_values"`
	FormulaValues map[string]interface{} `json:"formula_values"`
	Values        map[string]interface{} `json:"values"`
	CreatedAt     int64                  `json:"created_at"`
}

func (s *Service) SaveRunFromPreview(ctx context.Context, preview *PreviewResponse, actorID int) (*SaveRunResult, error) {
	if s == nil || s.db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	if preview == nil {
		return nil, fmt.Errorf("preview is required")
	}
	if preview.TemplateID <= 0 || preview.TemplateVersionID <= 0 {
		return nil, fmt.Errorf("template_id and template_version_id are required to save a run")
	}
	version, config, err := s.loadTemplateVersionConfig(ctx, preview.TemplateVersionID)
	if err != nil {
		return nil, err
	}
	if version.TemplateId != preview.TemplateID {
		return nil, fmt.Errorf("template/version mismatch")
	}
	configJSON, _, err := ConfigJSONAndHash(*config)
	if err != nil {
		return nil, err
	}
	sourceHash, err := previewSourceHash(preview)
	if err != nil {
		return nil, err
	}

	result := &SaveRunResult{}
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		run := model.CostReportRun{
			TemplateId:         preview.TemplateID,
			TemplateVersionId:  preview.TemplateVersionID,
			PeriodStart:        preview.PeriodStart,
			PeriodEnd:          preview.PeriodEnd,
			PeriodKey:          preview.PeriodKey,
			Timezone:           preview.Timezone,
			Status:             model.CostReportRunStatusCompleted,
			ConfigSnapshotJson: configJSON,
			SourceLogMaxId:     preview.SourceLogMaxID,
			SourceHash:         sourceHash,
			RowCount:           len(preview.Rows),
			CreatedBy:          actorID,
		}
		if err := tx.Create(&run).Error; err != nil {
			return err
		}
		rows := make([]model.CostReportRowSnapshot, 0, len(preview.Rows))
		for _, row := range preview.Rows {
			dimensionsJSON, err := marshalMap(row.Dimensions)
			if err != nil {
				return err
			}
			metricsJSON, err := marshalMap(row.Metrics)
			if err != nil {
				return err
			}
			manualJSON, err := marshalMap(row.ManualValues)
			if err != nil {
				return err
			}
			formulaJSON, err := marshalMap(row.FormulaValues)
			if err != nil {
				return err
			}
			rows = append(rows, model.CostReportRowSnapshot{
				RunId:             run.Id,
				RowKey:            row.RowKey,
				DimensionsJson:    dimensionsJSON,
				MetricsJson:       metricsJSON,
				ManualValuesJson:  manualJSON,
				FormulaValuesJson: formulaJSON,
			})
		}
		if len(rows) > 0 {
			if err := tx.Create(&rows).Error; err != nil {
				return err
			}
		}
		result.Run = run
		result.Rows = rows
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (s *Service) ListRuns(ctx context.Context, templateID int, periodKey string, offset, limit int) ([]model.CostReportRun, int64, error) {
	if s == nil || s.db == nil {
		return nil, 0, fmt.Errorf("db is nil")
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	query := s.db.WithContext(ctx).Model(&model.CostReportRun{})
	if templateID > 0 {
		query = query.Where("template_id = ?", templateID)
	}
	if periodKey != "" {
		query = query.Where("period_key = ?", periodKey)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var runs []model.CostReportRun
	if err := query.Order("id desc").Offset(offset).Limit(limit).Find(&runs).Error; err != nil {
		return nil, 0, err
	}
	return runs, total, nil
}

func (s *Service) GetRunDetail(ctx context.Context, runID int) (*RunDetail, error) {
	if s == nil || s.db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	if runID <= 0 {
		return nil, fmt.Errorf("run id is required")
	}
	var run model.CostReportRun
	if err := s.db.WithContext(ctx).First(&run, runID).Error; err != nil {
		return nil, err
	}
	var config CostReportTemplateConfig
	if err := common.UnmarshalJsonStr(run.ConfigSnapshotJson, &config); err != nil {
		return nil, err
	}
	var snapshots []model.CostReportRowSnapshot
	if err := s.db.WithContext(ctx).Where("run_id = ?", runID).Order("id asc").Find(&snapshots).Error; err != nil {
		return nil, err
	}
	rows := make([]RunSnapshotRow, 0, len(snapshots))
	for _, snapshot := range snapshots {
		row, err := decodeSnapshotRow(snapshot)
		if err != nil {
			return nil, err
		}
		rows = append(rows, row)
	}
	return &RunDetail{Run: run, Config: config, Rows: rows}, nil
}

func decodeSnapshotRow(snapshot model.CostReportRowSnapshot) (RunSnapshotRow, error) {
	row := RunSnapshotRow{
		Id:            snapshot.Id,
		RunId:         snapshot.RunId,
		RowKey:        snapshot.RowKey,
		Dimensions:    map[string]interface{}{},
		Metrics:       map[string]interface{}{},
		ManualValues:  map[string]interface{}{},
		FormulaValues: map[string]interface{}{},
		Values:        map[string]interface{}{},
		CreatedAt:     snapshot.CreatedAt,
	}
	if err := unmarshalMap(snapshot.DimensionsJson, &row.Dimensions); err != nil {
		return row, err
	}
	if err := unmarshalMap(snapshot.MetricsJson, &row.Metrics); err != nil {
		return row, err
	}
	if err := unmarshalMap(snapshot.ManualValuesJson, &row.ManualValues); err != nil {
		return row, err
	}
	if err := unmarshalMap(snapshot.FormulaValuesJson, &row.FormulaValues); err != nil {
		return row, err
	}
	for key, value := range row.Dimensions {
		row.Values[key] = value
	}
	for key, value := range row.Metrics {
		row.Values[key] = value
	}
	for key, value := range row.ManualValues {
		row.Values[key] = value
	}
	for key, value := range row.FormulaValues {
		row.Values[key] = value
	}
	return row, nil
}

func marshalMap(value map[string]interface{}) (string, error) {
	if value == nil {
		value = map[string]interface{}{}
	}
	payload, err := common.Marshal(value)
	if err != nil {
		return "", err
	}
	return string(payload), nil
}

func unmarshalMap(text string, out *map[string]interface{}) error {
	if text == "" {
		*out = map[string]interface{}{}
		return nil
	}
	return common.UnmarshalJsonStr(text, out)
}

func previewSourceHash(preview *PreviewResponse) (string, error) {
	type hashRow struct {
		RowKey        string                 `json:"row_key"`
		Dimensions    map[string]interface{} `json:"dimensions"`
		Metrics       map[string]interface{} `json:"metrics"`
		ManualValues  map[string]interface{} `json:"manual_values"`
		FormulaValues map[string]interface{} `json:"formula_values"`
		Values        map[string]interface{} `json:"values"`
	}
	rows := make([]hashRow, 0, len(preview.Rows))
	for _, row := range preview.Rows {
		rows = append(rows, hashRow{
			RowKey:        row.RowKey,
			Dimensions:    row.Dimensions,
			Metrics:       row.Metrics,
			ManualValues:  row.ManualValues,
			FormulaValues: row.FormulaValues,
			Values:        row.Values,
		})
	}
	sort.SliceStable(rows, func(i, j int) bool { return rows[i].RowKey < rows[j].RowKey })
	payload, err := common.Marshal(map[string]interface{}{
		"template_id":         preview.TemplateID,
		"template_version_id": preview.TemplateVersionID,
		"period_start":        preview.PeriodStart,
		"period_end":          preview.PeriodEnd,
		"period_key":          preview.PeriodKey,
		"source_log_max_id":   preview.SourceLogMaxID,
		"rows":                rows,
	})
	if err != nil {
		return "", err
	}
	hash := sha256.Sum256(payload)
	return fmt.Sprintf("%x", hash), nil
}
