package model

// CanvasPrompt 画布提示词库条目。数据由离线同步脚本(cmd/canvas-prompts-sync)生成的
// seed 快照首次导入,之后可由运营在数据库中增删改;生产请求链路只读 DB/内存缓存,
// 不访问 GitHub raw。Tags 以 JSON 字符串存 TEXT,兼容 SQLite/MySQL/PostgreSQL。
type CanvasPrompt struct {
	Id            int64  `gorm:"primaryKey" json:"id"`
	Source        string `gorm:"size:64;uniqueIndex:idx_canvas_prompt_source_sid" json:"source"`
	SourceId      string `gorm:"size:128;uniqueIndex:idx_canvas_prompt_source_sid" json:"source_id"`
	Title         string `gorm:"size:255" json:"title"`
	Prompt        string `gorm:"type:text" json:"prompt"`
	Category      string `gorm:"size:64;index" json:"category"`
	Tags          string `gorm:"type:text" json:"tags"`
	GithubUrl     string `gorm:"size:512" json:"github_url"`
	CoverUrl      string `gorm:"size:1024" json:"cover_url"`
	CoverAssetUrl string `gorm:"size:1024" json:"cover_asset_url"`
	Preview       string `gorm:"type:text" json:"preview"`
	Sort          int    `gorm:"default:0" json:"sort"`
	Enabled       bool   `gorm:"default:true" json:"enabled"`
	CreatedAt     int64  `json:"created_at"`
	UpdatedAt     int64  `json:"updated_at"`
}

func GetEnabledCanvasPrompts() ([]*CanvasPrompt, error) {
	var prompts []*CanvasPrompt
	err := DB.Where("enabled = ?", true).Order("sort desc, id asc").Find(&prompts).Error
	return prompts, err
}

func CountCanvasPrompts() (int64, error) {
	var count int64
	err := DB.Model(&CanvasPrompt{}).Count(&count).Error
	return count, err
}

// InsertCanvasPrompts 批量导入 seed;调用方保证 Source+SourceId 不与现有数据重复。
func InsertCanvasPrompts(prompts []*CanvasPrompt) error {
	if len(prompts) == 0 {
		return nil
	}
	return DB.CreateInBatches(prompts, 100).Error
}
