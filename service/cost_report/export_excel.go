package cost_report

import (
	"bytes"
	"context"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/xuri/excelize/v2"
)

var invalidSheetNameRE = regexp.MustCompile(`[\\/\?\*\[\]:]`)

func (s *Service) ExportRunXLSX(ctx context.Context, runID int) ([]byte, string, error) {
	detail, err := s.GetRunDetail(ctx, runID)
	if err != nil {
		return nil, "", err
	}
	file := excelize.NewFile()
	dataSheet := sanitizeSheetName(detail.Config.ExportLayout.SheetName)
	if dataSheet == "" {
		dataSheet = "Cost Report"
	}
	defaultSheet := file.GetSheetName(0)
	if defaultSheet == "" {
		defaultSheet = "Sheet1"
	}
	if err := file.SetSheetName(defaultSheet, dataSheet); err != nil {
		return nil, "", err
	}

	fields := exportableFields(detail.Config)
	for col, field := range fields {
		cell, _ := excelize.CoordinatesToCellName(col+1, 1)
		if err := file.SetCellValue(dataSheet, cell, field.Label); err != nil {
			return nil, "", err
		}
	}
	for rowIndex, row := range detail.Rows {
		for col, field := range fields {
			cell, _ := excelize.CoordinatesToCellName(col+1, rowIndex+2)
			if err := file.SetCellValue(dataSheet, cell, exportCellValue(field, row.Values, detail.Run.Timezone)); err != nil {
				return nil, "", err
			}
		}
	}
	if detail.Config.ExportLayout.FreezeHeader {
		_ = file.SetPanes(dataSheet, &excelize.Panes{
			Freeze:      true,
			YSplit:      1,
			TopLeftCell: "A2",
			ActivePane:  "bottomLeft",
			Selection: []excelize.Selection{{
				Pane:       "bottomLeft",
				ActiveCell: "A2",
				SQRef:      "A2",
			}},
		})
	}
	if len(fields) > 0 {
		lastCol, _ := excelize.ColumnNumberToName(len(fields))
		_ = file.SetColWidth(dataSheet, "A", lastCol, 16)
	}
	if detail.Config.ExportLayout.IncludeMeta {
		if err := writeMetaSheet(file, detail); err != nil {
			return nil, "", err
		}
	}
	var buf bytes.Buffer
	if err := file.Write(&buf); err != nil {
		return nil, "", err
	}
	filename := fmt.Sprintf("cost-report-%s-run-%d.xlsx", safeFilenamePart(detail.Run.PeriodKey), detail.Run.Id)
	return buf.Bytes(), filename, nil
}

func exportableFields(config CostReportTemplateConfig) []FieldConfig {
	fields := make([]FieldConfig, 0, len(config.Fields))
	for _, field := range config.Fields {
		if field.Exportable {
			fields = append(fields, field)
		}
	}
	sort.SliceStable(fields, func(i, j int) bool {
		if fields[i].Order == fields[j].Order {
			return fields[i].Key < fields[j].Key
		}
		return fields[i].Order < fields[j].Order
	})
	return fields
}

func exportCellValue(field FieldConfig, values map[string]interface{}, timezone string) interface{} {
	value := values[field.Key]
	if field.ValueType != "date" {
		return value
	}
	switch v := value.(type) {
	case int:
		return formatUnixTimestamp(int64(v), timezone)
	case int64:
		return formatUnixTimestamp(v, timezone)
	case float64:
		if v > 1000000000 {
			return formatUnixTimestamp(int64(v), timezone)
		}
		return v
	default:
		return value
	}
}

func formatUnixTimestamp(ts int64, timezone string) string {
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.UTC
	}
	return time.Unix(ts, 0).In(loc).Format("2006-01-02 15:04:05")
}

func writeMetaSheet(file *excelize.File, detail *RunDetail) error {
	metaSheet := uniqueSheetName(file, "Meta")
	if _, err := file.NewSheet(metaSheet); err != nil {
		return err
	}
	rulesJSON := "[]"
	if payload, err := common.Marshal(detail.Config.ClassificationRules); err == nil {
		rulesJSON = string(payload)
	}
	rows := [][]interface{}{
		{"template_id", detail.Run.TemplateId},
		{"template_version_id", detail.Run.TemplateVersionId},
		{"run_id", detail.Run.Id},
		{"period_key", detail.Run.PeriodKey},
		{"period_start", detail.Run.PeriodStart},
		{"period_end", detail.Run.PeriodEnd},
		{"timezone", detail.Run.Timezone},
		{"source_log_max_id", detail.Run.SourceLogMaxId},
		{"source_hash", detail.Run.SourceHash},
		{"row_count", detail.Run.RowCount},
		{"created_by", detail.Run.CreatedBy},
		{"created_at", detail.Run.CreatedAt},
		{"classification_rules_json", rulesJSON},
	}
	for i, row := range rows {
		for j, value := range row {
			cell, _ := excelize.CoordinatesToCellName(j+1, i+1)
			if err := file.SetCellValue(metaSheet, cell, value); err != nil {
				return err
			}
		}
	}
	_ = file.SetColWidth(metaSheet, "A", "A", 28)
	_ = file.SetColWidth(metaSheet, "B", "B", 80)
	return nil
}

func uniqueSheetName(file *excelize.File, base string) string {
	used := map[string]bool{}
	for _, name := range file.GetSheetList() {
		used[name] = true
	}
	base = sanitizeSheetName(base)
	if base == "" {
		base = "Sheet"
	}
	if !used[base] {
		return base
	}
	for i := 2; ; i++ {
		suffix := fmt.Sprintf(" %d", i)
		candidateBase := base
		if len([]rune(candidateBase))+len([]rune(suffix)) > 31 {
			runes := []rune(candidateBase)
			candidateBase = string(runes[:31-len([]rune(suffix))])
		}
		candidate := candidateBase + suffix
		if !used[candidate] {
			return candidate
		}
	}
}

func sanitizeSheetName(name string) string {
	name = strings.TrimSpace(invalidSheetNameRE.ReplaceAllString(name, "_"))
	if len([]rune(name)) <= 31 {
		return name
	}
	runes := []rune(name)
	return string(runes[:31])
}

func safeFilenamePart(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "period"
	}
	value = invalidSheetNameRE.ReplaceAllString(value, "-")
	value = strings.ReplaceAll(value, " ", "-")
	return value
}
