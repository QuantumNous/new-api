package model

const (
	CostReportTemplateStatusEnabled  = 1
	CostReportTemplateStatusArchived = 2

	CostReportTemplateVersionStatusActive   = 1
	CostReportTemplateVersionStatusArchived = 2

	CostReportRunStatusPending   = 1
	CostReportRunStatusCompleted = 2
	CostReportRunStatusFailed    = 3
)

// CostReportTemplate stores report template metadata and points at the current immutable version.
// Cost report tables live in the main DB only; do not add them to LOG_DB migrations.
type CostReportTemplate struct {
	Id               int    `json:"id" gorm:"primaryKey"`
	Key              string `json:"key" gorm:"type:varchar(64);uniqueIndex;not null"`
	Name             string `json:"name" gorm:"type:varchar(128);not null"`
	Description      string `json:"description" gorm:"type:text"`
	Status           int    `json:"status" gorm:"not null;default:1;index"`
	CurrentVersionId *int   `json:"current_version_id" gorm:"index"`
	CreatedBy        int    `json:"created_by" gorm:"index"`
	UpdatedBy        int    `json:"updated_by" gorm:"index"`
	CreatedAt        int64  `json:"created_at" gorm:"type:bigint;autoCreateTime"`
	UpdatedAt        int64  `json:"updated_at" gorm:"type:bigint;autoUpdateTime"`
}

// CostReportTemplateVersion is an immutable snapshot of a template config.
type CostReportTemplateVersion struct {
	Id         int    `json:"id" gorm:"primaryKey"`
	TemplateId int    `json:"template_id" gorm:"uniqueIndex:idx_cost_report_template_version;index;not null"`
	Version    int    `json:"version" gorm:"uniqueIndex:idx_cost_report_template_version;not null"`
	Status     int    `json:"status" gorm:"not null;default:1;index"`
	ConfigJson string `json:"config_json" gorm:"type:text;not null"`
	ConfigHash string `json:"config_hash" gorm:"type:varchar(64);index;not null"`
	CreatedBy  int    `json:"created_by" gorm:"index"`
	CreatedAt  int64  `json:"created_at" gorm:"type:bigint;autoCreateTime"`
}

// CostReportRun stores one saved report snapshot for one period.
type CostReportRun struct {
	Id                 int    `json:"id" gorm:"primaryKey"`
	TemplateId         int    `json:"template_id" gorm:"index;not null"`
	TemplateVersionId  int    `json:"template_version_id" gorm:"index;not null"`
	PeriodStart        int64  `json:"period_start" gorm:"type:bigint;index;not null"`
	PeriodEnd          int64  `json:"period_end" gorm:"type:bigint;index;not null"`
	PeriodKey          string `json:"period_key" gorm:"type:varchar(64);index;not null"`
	Timezone           string `json:"timezone" gorm:"type:varchar(64);not null"`
	Status             int    `json:"status" gorm:"not null;default:1;index"`
	ConfigSnapshotJson string `json:"config_snapshot_json" gorm:"type:text;not null"`
	SourceLogMaxId     int    `json:"source_log_max_id" gorm:"index"`
	SourceHash         string `json:"source_hash" gorm:"type:varchar(64);index"`
	RowCount           int    `json:"row_count" gorm:"not null;default:0"`
	ErrorMessage       string `json:"error_message" gorm:"type:text"`
	CreatedBy          int    `json:"created_by" gorm:"index"`
	CreatedAt          int64  `json:"created_at" gorm:"type:bigint;autoCreateTime"`
	UpdatedAt          int64  `json:"updated_at" gorm:"type:bigint;autoUpdateTime"`
}

// CostReportRowSnapshot freezes computed row data for a saved run.
type CostReportRowSnapshot struct {
	Id                int    `json:"id" gorm:"primaryKey"`
	RunId             int    `json:"run_id" gorm:"uniqueIndex:idx_cost_report_run_row;index;not null"`
	RowKey            string `json:"row_key" gorm:"type:varchar(64);uniqueIndex:idx_cost_report_run_row;not null"`
	DimensionsJson    string `json:"dimensions_json" gorm:"type:text;not null"`
	MetricsJson       string `json:"metrics_json" gorm:"type:text;not null"`
	ManualValuesJson  string `json:"manual_values_json" gorm:"type:text;not null"`
	FormulaValuesJson string `json:"formula_values_json" gorm:"type:text;not null"`
	CreatedAt         int64  `json:"created_at" gorm:"type:bigint;autoCreateTime"`
}

// CostReportManualCell stores reusable root-entered manual values by stable row identity.
type CostReportManualCell struct {
	Id         int    `json:"id" gorm:"primaryKey"`
	TemplateId int    `json:"template_id" gorm:"uniqueIndex:idx_cost_report_manual_cell;index;not null"`
	PeriodKey  string `json:"period_key" gorm:"type:varchar(64);uniqueIndex:idx_cost_report_manual_cell;not null"`
	RowKey     string `json:"row_key" gorm:"type:varchar(64);uniqueIndex:idx_cost_report_manual_cell;not null"`
	FieldKey   string `json:"field_key" gorm:"type:varchar(64);uniqueIndex:idx_cost_report_manual_cell;not null"`
	ValueType  string `json:"value_type" gorm:"type:varchar(32);not null"`
	ValueText  string `json:"value_text" gorm:"type:text"`
	UpdatedBy  int    `json:"updated_by" gorm:"index"`
	CreatedAt  int64  `json:"created_at" gorm:"type:bigint;autoCreateTime"`
	UpdatedAt  int64  `json:"updated_at" gorm:"type:bigint;autoUpdateTime"`
}
