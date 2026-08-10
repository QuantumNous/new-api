package model

// CompanyLogSchema defines the independently migrated logs_company table.
// Keep its persisted fields compatible with Log while giving the table its own
// deliberately limited index set.
type CompanyLogSchema struct {
	Id                int    `json:"id" gorm:"primaryKey;index:idx_logs_company_created_id,priority:2;index:idx_logs_company_type_created_id,priority:3;index:idx_logs_company_model_created_id,priority:3;index:idx_logs_company_token_created_id,priority:3;index:idx_logs_company_channel_created_id,priority:3"`
	UserId            int    `json:"user_id"`
	CreatedAt         int64  `json:"created_at" gorm:"bigint;index:idx_logs_company_created_id,priority:1;index:idx_logs_company_type_created_id,priority:2;index:idx_logs_company_model_created_id,priority:2;index:idx_logs_company_token_created_id,priority:2;index:idx_logs_company_channel_created_id,priority:2"`
	Type              int    `json:"type" gorm:"index:idx_logs_company_type_created_id,priority:1"`
	Content           string `json:"content"`
	Username          string `json:"username" gorm:"type:varchar(191);default:''"`
	TokenName         string `json:"token_name" gorm:"type:varchar(191);index:idx_logs_company_token_created_id,priority:1;default:''"`
	ModelName         string `json:"model_name" gorm:"type:varchar(191);index:idx_logs_company_model_created_id,priority:1;default:''"`
	Quota             int    `json:"quota" gorm:"default:0"`
	PromptTokens      int    `json:"prompt_tokens" gorm:"default:0"`
	CompletionTokens  int    `json:"completion_tokens" gorm:"default:0"`
	UseTime           int    `json:"use_time" gorm:"default:0"`
	IsStream          bool   `json:"is_stream"`
	ChannelId         int    `json:"channel" gorm:"index:idx_logs_company_channel_created_id,priority:1"`
	TokenId           int    `json:"token_id" gorm:"default:0"`
	Group             string `json:"group" gorm:"type:varchar(191)"`
	Ip                string `json:"ip" gorm:"type:varchar(191);default:''"`
	RequestId         string `json:"request_id,omitempty" gorm:"type:varchar(64);index:idx_logs_company_request_id;default:''"`
	UpstreamRequestId string `json:"upstream_request_id,omitempty" gorm:"type:varchar(128);index:idx_logs_company_upstream_request_id;default:''"`
	Other             string `json:"other"`
}

func (CompanyLogSchema) TableName() string {
	return "logs_company"
}
