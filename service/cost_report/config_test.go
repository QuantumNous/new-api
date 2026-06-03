package cost_report

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestDefaultClaudeCostTemplateConfigValid(t *testing.T) {
	cfg := DefaultClaudeCostTemplateConfig()
	if err := ValidateTemplateConfig(cfg); err != nil {
		t.Fatalf("default template should validate: %v", err)
	}
	if len(cfg.Fields) != 20 {
		t.Fatalf("default template should contain 20 fields, got %d", len(cfg.Fields))
	}
	if cfg.ClassificationRules[0].Key != "aws_claude_by_type_or_name" {
		t.Fatalf("unexpected first classification rule: %s", cfg.ClassificationRules[0].Key)
	}
}

func TestValidateTemplateConfigRejectsDuplicateFieldKeys(t *testing.T) {
	cfg := DefaultClaudeCostTemplateConfig()
	cfg.Fields = append(cfg.Fields, cfg.Fields[0])
	assertValidationErrorContains(t, cfg, "duplicate field key")
}

func TestValidateTemplateConfigRejectsInvalidFieldKind(t *testing.T) {
	cfg := DefaultClaudeCostTemplateConfig()
	cfg.Fields[0].Kind = "spreadsheet"
	assertValidationErrorContains(t, cfg, "invalid kind")
}

func TestValidateTemplateConfigRejectsInvalidFormula(t *testing.T) {
	cfg := DefaultClaudeCostTemplateConfig()
	for i := range cfg.Fields {
		if cfg.Fields[i].Key == "cost" {
			cfg.Fields[i].Expression = "missing_field + 1"
			break
		}
	}
	assertValidationErrorContains(t, cfg, "compile failed")
}

func TestValidateTemplateConfigRejectsDirectSelfReferenceEvenWithPreviousReference(t *testing.T) {
	cfg := DefaultClaudeCostTemplateConfig()
	for i := range cfg.Fields {
		if cfg.Fields[i].Key == "balance_status" {
			cfg.Fields[i].Expression = "previous_balance_status - balance_status"
			break
		}
	}
	assertValidationErrorContains(t, cfg, "references itself")
}

func TestValidateTemplateConfigRejectsUnsafeLogOtherSource(t *testing.T) {
	cfg := DefaultClaudeCostTemplateConfig()
	cfg.Fields[0].Source = "log_other."
	assertValidationErrorContains(t, cfg, "invalid dimension source")
}

func TestValidateTemplateConfigAcceptsDottedLogOtherSource(t *testing.T) {
	cfg := DefaultClaudeCostTemplateConfig()
	cfg.Fields[0].Source = "log_other.admin_info.request_path"
	if err := ValidateTemplateConfig(cfg); err != nil {
		t.Fatalf("expected dotted log_other source to validate: %v", err)
	}
}

func TestValidateTemplateConfigRejectsFormulaCycle(t *testing.T) {
	cfg := DefaultClaudeCostTemplateConfig()
	for i := range cfg.Fields {
		switch cfg.Fields[i].Key {
		case "cost":
			cfg.Fields[i].Expression = "receivable + 1"
		case "receivable":
			cfg.Fields[i].Expression = "cost + 1"
		}
	}
	assertValidationErrorContains(t, cfg, "cycle")
}

func TestValidateTemplateConfigRejectsInvalidClassificationRule(t *testing.T) {
	cfg := DefaultClaudeCostTemplateConfig()
	cfg.ClassificationRules[0].ConditionGroups[0].Conditions[0].Operator = "starts_with"
	assertValidationErrorContains(t, cfg, "invalid operator")
}

func TestConfigJSONAndHashUsesCommonJSONWrapperSemantics(t *testing.T) {
	jsonText, hash, err := ConfigJSONAndHash(DefaultClaudeCostTemplateConfig())
	if err != nil {
		t.Fatalf("ConfigJSONAndHash failed: %v", err)
	}
	if jsonText == "" || hash == "" {
		t.Fatalf("expected json and hash")
	}
	if !strings.Contains(jsonText, DefaultTemplateKey[:6]) && !strings.Contains(jsonText, "成本报表") {
		t.Fatalf("json output does not look like default cost report config: %s", jsonText)
	}
}

func TestEnsureDefaultClaudeCostTemplateSeedsVersion(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.CostReportTemplate{}, &model.CostReportTemplateVersion{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	template, err := EnsureDefaultClaudeCostTemplate(db, 100)
	if err != nil {
		t.Fatalf("seed default template: %v", err)
	}
	if template.Key != DefaultTemplateKey || template.CurrentVersionId == nil {
		t.Fatalf("unexpected template after seed: %+v", template)
	}
	var versions int64
	if err := db.Model(&model.CostReportTemplateVersion{}).Where("template_id = ?", template.Id).Count(&versions).Error; err != nil {
		t.Fatalf("count versions: %v", err)
	}
	if versions != 1 {
		t.Fatalf("expected 1 version, got %d", versions)
	}

	if _, err := EnsureDefaultClaudeCostTemplate(db, 100); err != nil {
		t.Fatalf("second seed should be idempotent: %v", err)
	}
	if err := db.Model(&model.CostReportTemplateVersion{}).Where("template_id = ?", template.Id).Count(&versions).Error; err != nil {
		t.Fatalf("count versions after second seed: %v", err)
	}
	if versions != 1 {
		t.Fatalf("expected idempotent seed to keep 1 version, got %d", versions)
	}
}

func assertValidationErrorContains(t *testing.T, cfg CostReportTemplateConfig, want string) {
	t.Helper()
	err := ValidateTemplateConfig(cfg)
	if err == nil {
		t.Fatalf("expected validation error containing %q", want)
	}
	if !strings.Contains(err.Error(), want) {
		t.Fatalf("expected error containing %q, got %v", want, err)
	}
}
