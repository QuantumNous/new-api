package dto

// BackupCategory 表示可备份/导出的数据类别。
type BackupCategory string

const (
	BackupCategoryUsers        BackupCategory = "users"
	BackupCategoryChannels     BackupCategory = "channels"
	BackupCategoryTokens       BackupCategory = "tokens"
	BackupCategoryModels       BackupCategory = "models"
	BackupCategoryVendors      BackupCategory = "vendors"
	BackupCategoryAbilities    BackupCategory = "abilities"
	BackupCategoryDeployments  BackupCategory = "deployments"
	BackupCategoryModelSources BackupCategory = "model_sources"
	BackupCategoryPrefillGroups BackupCategory = "prefill_groups"
	BackupCategoryLogs         BackupCategory = "logs"
	BackupCategoryOptions      BackupCategory = "options"
	BackupCategoryHealthChecks BackupCategory = "health_checks"
)

// AllBackupCategories 返回所有支持的备份类别及其显示名称。
var AllBackupCategories = []struct {
	Key     BackupCategory
	Display string
	IsLarge bool // 是否大数据集，影响前端"全选"默认值
}{
	{BackupCategoryUsers, "Users & sessions", false},
	{BackupCategoryChannels, "Channels", false},
	{BackupCategoryTokens, "API Tokens", false},
	{BackupCategoryModels, "Model metadata", false},
	{BackupCategoryVendors, "Vendors", false},
	{BackupCategoryAbilities, "Channel abilities", false},
	{BackupCategoryDeployments, "Model deployments", false},
	{BackupCategoryModelSources, "Model sources", false},
	{BackupCategoryPrefillGroups, "Prefill groups", false},
	{BackupCategoryLogs, "Request logs", true},
	{BackupCategoryOptions, "System options", false},
	{BackupCategoryHealthChecks, "Health check metrics", true},
}

// BackupExportRequest 导出请求。
type BackupExportRequest struct {
	Categories    []BackupCategory `json:"categories" binding:"required"`
	IncludeSecret bool             `json:"include_secret"` // 是否包含密钥（渠道 Key 等）
}

// BackupImportRequest 导入请求。
type BackupImportRequest struct {
	Categories      []BackupCategory `json:"categories"` // 空表示全部导入
	SkipExisting    bool             `json:"skip_existing"`
	OverwriteSecret bool             `json:"overwrite_secret"`
}

// BackupImportResult 单个类别的导入结果。
type BackupImportResult struct {
	Category string `json:"category"`
	Imported int    `json:"imported"`
	Skipped  int    `json:"skipped"`
	Errors   int    `json:"errors"`
	ErrorMsg string `json:"error_msg,omitempty"`
}

// BackupMeta 每个 JSON 文件的元数据头部。
type BackupMeta struct {
	Version       string           `json:"version"`
	Categories    []BackupCategory `json:"categories"`
	Timestamp     int64            `json:"timestamp"`
	Rows          map[string]int   `json:"rows"` // category -> 行数
	IncludeSecret bool             `json:"include_secret"`
}
