package cost_report

import (
	"bytes"
	"context"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/xuri/excelize/v2"
	"gorm.io/gorm"
)

func TestClassifyDefaultRulesAWSClaudeOther(t *testing.T) {
	cfg := DefaultClaudeCostTemplateConfig()
	aws := Classify(cfg, ClassificationInput{
		Log:     &model.Log{ModelName: "claude-3-5-sonnet", ChannelId: 1},
		Channel: &model.Channel{Id: 1, Type: constant.ChannelTypeAws, Name: "bedrock"},
	})
	if aws.Class != "AWS" {
		t.Fatalf("expected AWS, got %+v", aws)
	}

	claudeKey := Classify(cfg, ClassificationInput{
		Log:     &model.Log{ModelName: "claude-3-haiku", ChannelId: 2},
		Channel: &model.Channel{Id: 2, Type: constant.ChannelTypeOpenAI, Name: "anthropic key"},
	})
	if claudeKey.Class != "Claude Key" {
		t.Fatalf("expected Claude Key, got %+v", claudeKey)
	}

	anthropicByType := Classify(cfg, ClassificationInput{
		Log:     &model.Log{ModelName: "provider-default", ChannelId: 4},
		Channel: &model.Channel{Id: 4, Type: constant.ChannelTypeAnthropic, Name: "direct"},
	})
	if anthropicByType.Class != "Claude Key" {
		t.Fatalf("expected Anthropic channel type to be Claude Key, got %+v", anthropicByType)
	}

	other := Classify(cfg, ClassificationInput{
		Log:     &model.Log{ModelName: "gpt-4o-mini", ChannelId: 3},
		Channel: &model.Channel{Id: 3, Type: constant.ChannelTypeOpenAI, Name: "openai"},
	})
	if other.Class != "Other" {
		t.Fatalf("expected Other, got %+v", other)
	}
}

func TestFormulaEvaluatorDefaultRunningBalanceAndWarnings(t *testing.T) {
	cfg := DefaultClaudeCostTemplateConfig()
	evaluator, err := newFormulaEvaluator(cfg)
	if err != nil {
		t.Fatalf("new evaluator: %v", err)
	}
	rows := []PreviewRow{
		{
			RowKey:          "r1",
			Values:          map[string]interface{}{"customer": "alice", "channel_class": "AWS", "channel_id": 1, "payment": float64(100), "actual_consumption": float64(10), "unit_price": float64(6.8), "supply_discount": float64(1)},
			FormulaValues:   map[string]interface{}{},
			ManualOverrides: map[string]bool{},
		},
		{
			RowKey:          "r2",
			Values:          map[string]interface{}{"customer": "alice", "channel_class": "AWS", "channel_id": 1, "payment": float64(5), "actual_consumption": float64(5), "unit_price": float64(6.8), "supply_discount": float64(2)},
			FormulaValues:   map[string]interface{}{},
			ManualOverrides: map[string]bool{},
		},
	}
	warnings := evaluator.evaluateRows(rows)
	if len(warnings) != 0 {
		t.Fatalf("unexpected warnings: %v", warnings)
	}
	if got := toFloat64(rows[0].Values["receivable"]); got != 10 {
		t.Fatalf("row1 receivable = %v, want 10", got)
	}
	if got := toFloat64(rows[0].Values["balance_status"]); got != 90 {
		t.Fatalf("row1 balance = %v, want 90", got)
	}
	if got := toFloat64(rows[1].Values["balance_status"]); got != 85 {
		t.Fatalf("row2 running balance = %v, want 85", got)
	}

	partitionRows := []PreviewRow{
		{RowKey: "p1", Values: map[string]interface{}{"customer": "alice", "channel_class": "AWS", "channel_id": 1, "payment": float64(100), "actual_consumption": float64(10), "unit_price": float64(6.8), "supply_discount": float64(1)}, FormulaValues: map[string]interface{}{}, ManualOverrides: map[string]bool{}},
		{RowKey: "p2", Values: map[string]interface{}{"customer": "bob", "channel_class": "AWS", "channel_id": 1, "payment": float64(50), "actual_consumption": float64(5), "unit_price": float64(6.8), "supply_discount": float64(2)}, FormulaValues: map[string]interface{}{}, ManualOverrides: map[string]bool{}},
		{RowKey: "p3", Values: map[string]interface{}{"customer": "alice", "channel_class": "AWS", "channel_id": 1, "payment": float64(2), "actual_consumption": float64(1), "unit_price": float64(6.8), "supply_discount": float64(10)}, FormulaValues: map[string]interface{}{}, ManualOverrides: map[string]bool{}},
	}
	warnings = evaluator.evaluateRows(partitionRows)
	if len(warnings) != 0 {
		t.Fatalf("unexpected partition warnings: %v", warnings)
	}
	if got := toFloat64(partitionRows[1].Values["balance_status"]); got != 40 {
		t.Fatalf("partitioned bob first balance = %v, want 40", got)
	}
	if got := toFloat64(partitionRows[2].Values["balance_status"]); got != 82 {
		t.Fatalf("non-contiguous alice balance = %v, want 82", got)
	}

	bad := cfg
	bad.Fields = []FieldConfig{
		{Key: "actual_consumption", Label: "actual", Kind: FieldKindMetric, ValueType: "decimal", Source: "log.quota", Aggregate: "sum", Visible: true, Exportable: true, Order: 1},
		{Key: "unit_price", Label: "unit", Kind: FieldKindManual, ValueType: "decimal", Visible: true, Exportable: true, Order: 2},
		{Key: "bad_formula", Label: "bad", Kind: FieldKindFormula, ValueType: "decimal", Expression: "actual_consumption / unit_price", Visible: true, Exportable: true, Order: 3},
	}
	bad.Grouping = []string{"actual_consumption"}
	bad.Sort = nil
	bad.ClassificationRules = cfg.ClassificationRules
	badEval, err := newFormulaEvaluator(bad)
	if err != nil {
		t.Fatalf("new bad evaluator: %v", err)
	}
	badRows := []PreviewRow{{RowKey: "bad", Values: map[string]interface{}{"actual_consumption": float64(1), "unit_price": float64(0)}, FormulaValues: map[string]interface{}{}, ManualOverrides: map[string]bool{}}}
	warnings = badEval.evaluateRows(badRows)
	if len(warnings) == 0 || !strings.Contains(warnings[0], "non-finite") {
		t.Fatalf("expected non-finite warning, got %v", warnings)
	}
}

func TestManualCellUpsertRead(t *testing.T) {
	db := openCostReportTestDB(t)
	svc := NewService(db, db)
	ctx := context.Background()

	if _, err := svc.UpsertManualCell(ctx, ManualCellInput{TemplateID: 1, PeriodKey: "2026-06-03", RowKey: "row", FieldKey: "payment", ValueType: "currency", ValueText: "12.5", UpdatedBy: 7}); err != nil {
		t.Fatalf("upsert manual: %v", err)
	}
	if _, err := svc.UpsertManualCell(ctx, ManualCellInput{TemplateID: 1, PeriodKey: "2026-06-03", RowKey: "row", FieldKey: "payment", ValueType: "currency", ValueText: "13.5", UpdatedBy: 8}); err != nil {
		t.Fatalf("second upsert manual: %v", err)
	}
	manuals, err := svc.ReadManualCells(ctx, 1, "2026-06-03", []string{"row"})
	if err != nil {
		t.Fatalf("read manual: %v", err)
	}
	if got := toFloat64(manuals["row"]["payment"].Value); got != 13.5 {
		t.Fatalf("manual payment = %v, want 13.5", got)
	}
}

func TestPreviewUsesSeparateLogAndMainDBs(t *testing.T) {
	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 100
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

	mainDB := openCostReportTestDB(t)
	logDB := openLogTestDB(t)
	svc := NewService(mainDB, logDB)
	ctx := context.Background()

	if err := mainDB.Create(&model.User{Id: 1, Username: "alice", DisplayName: "Alice", Password: "x"}).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	if err := mainDB.Create(&model.Channel{Id: 10, Type: constant.ChannelTypeAws, Name: "AWS Bedrock Claude", Key: "k", Models: "claude-3-5-sonnet"}).Error; err != nil {
		t.Fatalf("create channel: %v", err)
	}
	start := time.Date(2026, 6, 3, 0, 0, 0, 0, time.UTC).Unix()
	logs := []model.Log{
		{Id: 1, UserId: 1, Username: "alice", CreatedAt: start + 60, Type: model.LogTypeConsume, ModelName: "claude-3-5-sonnet", Quota: 250, ChannelId: 10, Group: "default"},
		{Id: 2, UserId: 1, Username: "alice", CreatedAt: start + 120, Type: model.LogTypeConsume, ModelName: "claude-3-5-sonnet", Quota: 150, ChannelId: 10, Group: "default"},
	}
	if err := logDB.Create(&logs).Error; err != nil {
		t.Fatalf("create logs: %v", err)
	}

	cfg := DefaultClaudeCostTemplateConfig()
	rowKey := makeRowKey(cfg.Grouping, map[string]interface{}{
		"report_date":   "2026-06-03",
		"customer":      "alice",
		"channel_class": "AWS",
		"channel_id":    10,
	})
	if _, err := svc.UpsertManualCell(ctx, ManualCellInput{TemplateID: 1, PeriodKey: "2026-06-03", RowKey: rowKey, FieldKey: "payment", ValueType: "currency", ValueText: "9", UpdatedBy: 1}); err != nil {
		t.Fatalf("upsert manual before preview: %v", err)
	}

	resp, err := svc.Preview(ctx, PreviewRequest{TemplateID: 1, Config: &cfg, PeriodStart: start, PeriodEnd: start + 24*3600, PeriodKey: "2026-06-03", IncludeManual: true})
	if err != nil {
		t.Fatalf("preview: %v", err)
	}
	if len(resp.Rows) != 1 {
		t.Fatalf("expected 1 row, got %d: %+v", len(resp.Rows), resp.Rows)
	}
	row := resp.Rows[0]
	if row.RowKey != rowKey {
		t.Fatalf("row key = %q, want %q", row.RowKey, rowKey)
	}
	if len(row.RowKey) != 64 {
		t.Fatalf("row key length = %d, want 64", len(row.RowKey))
	}
	if got := row.Dimensions["channel_class"]; got != "AWS" {
		t.Fatalf("channel_class = %v, want AWS", got)
	}
	if got := toFloat64(row.Metrics["actual_consumption"]); got != 4 {
		t.Fatalf("actual_consumption = %v, want 4", got)
	}
	if got := toFloat64(row.ManualValues["payment"]); got != 9 {
		t.Fatalf("manual payment = %v, want 9", got)
	}
	if resp.SourceLogMaxID != 2 {
		t.Fatalf("source log max id = %d, want 2", resp.SourceLogMaxID)
	}
}

func TestSaveRunAndExportXLSX(t *testing.T) {
	db := openCostReportTestDB(t)
	svc := NewService(db, db)
	ctx := context.Background()

	detail, err := svc.EnsureDefaultTemplate(ctx, 1)
	if err != nil {
		t.Fatalf("ensure default template: %v", err)
	}
	if detail.CurrentVersion == nil {
		t.Fatalf("default template has no version")
	}
	start := time.Date(2026, 6, 3, 0, 0, 0, 0, time.UTC).Unix()
	preview := &PreviewResponse{
		TemplateID:        detail.Template.Id,
		TemplateVersionID: detail.CurrentVersion.Id,
		PeriodStart:       start,
		PeriodEnd:         start + 24*3600,
		PeriodKey:         "2026-06-03",
		Timezone:          "Asia/Shanghai",
		SourceLogMaxID:    9,
		Rows: []PreviewRow{{
			RowKey: makeRowKey(DefaultClaudeCostTemplateConfig().Grouping, map[string]interface{}{
				"report_date":   "2026-06-03",
				"customer":      "alice",
				"channel_class": "AWS",
				"channel_id":    10,
			}),
			Dimensions:      map[string]interface{}{"row_index": 1, "report_date": "2026-06-03", "customer": "alice", "channel_class": "AWS", "channel_id": 10},
			Metrics:         map[string]interface{}{"start_time": float64(start + 60), "end_time": float64(start + 120), "actual_consumption": float64(4)},
			ManualValues:    map[string]interface{}{"payment": float64(9), "unit_price": float64(6.8), "supply_discount": float64(1)},
			FormulaValues:   map[string]interface{}{"discount": float64(1), "cost": float64(4), "receivable": float64(4)},
			Values:          map[string]interface{}{"row_index": 1, "report_date": "2026-06-03", "customer": "alice", "channel_class": "AWS", "channel_id": 10, "start_time": float64(start + 60), "end_time": float64(start + 120), "payment": float64(9), "unit_price": float64(6.8), "actual_consumption": float64(4), "supply_discount": float64(1), "discount": float64(1), "cost": float64(4), "receivable": float64(4)},
			ManualOverrides: map[string]bool{},
		}},
	}

	saved, err := svc.SaveRunFromPreview(ctx, preview, 1)
	if err != nil {
		t.Fatalf("save run: %v", err)
	}
	if saved.Run.RowCount != 1 || len(saved.Rows) != 1 {
		t.Fatalf("saved row count mismatch: run=%d rows=%d", saved.Run.RowCount, len(saved.Rows))
	}
	runDetail, err := svc.GetRunDetail(ctx, saved.Run.Id)
	if err != nil {
		t.Fatalf("get run detail: %v", err)
	}
	if got := runDetail.Rows[0].Values["customer"]; got != "alice" {
		t.Fatalf("snapshot customer = %v, want alice", got)
	}

	data, filename, err := svc.ExportRunXLSX(ctx, saved.Run.Id)
	if err != nil {
		t.Fatalf("export xlsx: %v", err)
	}
	if len(data) == 0 || !strings.HasSuffix(filename, ".xlsx") {
		t.Fatalf("bad export: len=%d filename=%q", len(data), filename)
	}
	book, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("open exported xlsx: %v", err)
	}
	defer func() { _ = book.Close() }()
	sheet := sanitizeSheetName(DefaultClaudeCostTemplateConfig().ExportLayout.SheetName)
	header, _ := book.GetCellValue(sheet, "A1")
	customer, _ := book.GetCellValue(sheet, "C2")
	metaKey, _ := book.GetCellValue("Meta", "A1")
	if header != "序号" || customer != "alice" || metaKey != "template_id" {
		t.Fatalf("unexpected xlsx cells: header=%q customer=%q meta=%q", header, customer, metaKey)
	}
}

func TestConsumeLogScanUsesBoundedBatchesAndMaxLogs(t *testing.T) {
	logDB := openLogTestDB(t)
	svc := NewService(openCostReportTestDB(t), logDB)
	ctx := context.Background()
	start := time.Date(2026, 6, 3, 0, 0, 0, 0, time.UTC).Unix()
	logs := make([]model.Log, 0, consumeLogScanBatchSize+5)
	for i := 1; i <= consumeLogScanBatchSize+5; i++ {
		logs = append(logs, model.Log{Id: i, CreatedAt: start + int64(i%3), Type: model.LogTypeConsume, Quota: i})
	}
	if err := logDB.Create(&logs).Error; err != nil {
		t.Fatalf("create logs: %v", err)
	}

	seen := 0
	batches := 0
	lastCreatedAt := int64(-1)
	lastID := 0
	if err := svc.scanConsumeLogs(ctx, start, start+10, consumeLogScanBatchSize+3, func(batch []model.Log) error {
		batches++
		if len(batch) > consumeLogScanBatchSize {
			t.Fatalf("batch size = %d, want <= %d", len(batch), consumeLogScanBatchSize)
		}
		for _, log := range batch {
			if lastCreatedAt > log.CreatedAt || (lastCreatedAt == log.CreatedAt && lastID >= log.Id) {
				t.Fatalf("logs not ordered after created_at=%d id=%d: got created_at=%d id=%d", lastCreatedAt, lastID, log.CreatedAt, log.Id)
			}
			lastCreatedAt = log.CreatedAt
			lastID = log.Id
			seen++
		}
		return nil
	}); err != nil {
		t.Fatalf("scan logs: %v", err)
	}
	if seen != consumeLogScanBatchSize+3 {
		t.Fatalf("seen logs = %d, want %d", seen, consumeLogScanBatchSize+3)
	}
	if batches < 2 {
		t.Fatalf("expected multiple batches, got %d", batches)
	}
}

func TestPreviewSourceHashIncludesRowContent(t *testing.T) {
	base := &PreviewResponse{
		TemplateID:        1,
		TemplateVersionID: 2,
		PeriodStart:       10,
		PeriodEnd:         20,
		PeriodKey:         "p",
		SourceLogMaxID:    3,
		Rows: []PreviewRow{{
			RowKey:        "row",
			Dimensions:    map[string]interface{}{"customer": "alice"},
			Metrics:       map[string]interface{}{"actual_consumption": float64(1)},
			ManualValues:  map[string]interface{}{"payment": float64(1)},
			FormulaValues: map[string]interface{}{"receivable": float64(1)},
			Values:        map[string]interface{}{"customer": "alice", "actual_consumption": float64(1), "payment": float64(1), "receivable": float64(1)},
		}},
	}
	hash1, err := previewSourceHash(base)
	if err != nil {
		t.Fatalf("hash1: %v", err)
	}
	base.Rows[0].Values["payment"] = float64(2)
	base.Rows[0].ManualValues["payment"] = float64(2)
	hash2, err := previewSourceHash(base)
	if err != nil {
		t.Fatalf("hash2: %v", err)
	}
	if hash1 == hash2 {
		t.Fatalf("source hash did not change when row content changed")
	}
}

func TestEnsureDefaultTemplateRepairsMissingCurrentVersion(t *testing.T) {
	db := openCostReportTestDB(t)
	ctx := context.Background()
	configJSON, configHash, err := ConfigJSONAndHash(DefaultClaudeCostTemplateConfig())
	if err != nil {
		t.Fatalf("default config hash: %v", err)
	}
	template := model.CostReportTemplate{Key: DefaultTemplateKey, Name: "existing", Status: model.CostReportTemplateStatusEnabled}
	if err := db.Create(&template).Error; err != nil {
		t.Fatalf("create template: %v", err)
	}
	version := model.CostReportTemplateVersion{TemplateId: template.Id, Version: 7, Status: model.CostReportTemplateVersionStatusActive, ConfigJson: configJSON, ConfigHash: configHash}
	if err := db.Create(&version).Error; err != nil {
		t.Fatalf("create version: %v", err)
	}

	detail, err := NewService(db, db).EnsureDefaultTemplate(ctx, 42)
	if err != nil {
		t.Fatalf("ensure default template: %v", err)
	}
	if detail.Template.CurrentVersionId == nil || *detail.Template.CurrentVersionId != version.Id {
		t.Fatalf("current version id = %v, want %d", detail.Template.CurrentVersionId, version.Id)
	}
	var count int64
	if err := db.Model(&model.CostReportTemplateVersion{}).Where("template_id = ?", template.Id).Count(&count).Error; err != nil {
		t.Fatalf("count versions: %v", err)
	}
	if count != 1 {
		t.Fatalf("version count = %d, want 1", count)
	}
}

func openCostReportTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.CostReportManualCell{}, &model.CostReportRun{}, &model.CostReportRowSnapshot{}, &model.Channel{}, &model.User{}, &model.CostReportTemplate{}, &model.CostReportTemplateVersion{}); err != nil {
		t.Fatalf("migrate main test db: %v", err)
	}
	return db
}

func openLogTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.Log{}); err != nil {
		t.Fatalf("migrate log test db: %v", err)
	}
	return db
}
