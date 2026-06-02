package model

type smsTableNamer interface {
	TableName() string
}

func SMSSidecarModels() []interface{} {
	return []interface{}{
		&SMSSendLog{},
	}
}

func SMSSidecarTableNames() []string {
	models := SMSSidecarModels()
	names := make([]string, 0, len(models))
	for _, model := range models {
		if namer, ok := model.(smsTableNamer); ok {
			names = append(names, namer.TableName())
		}
	}
	return names
}

type SMSSendLog struct {
	Id              int    `json:"id"`
	PhoneMasked     string `json:"phone_masked" gorm:"type:varchar(32);not null;default:'';index"`
	Scene           string `json:"scene" gorm:"type:varchar(32);not null;default:'';index"`
	Provider        string `json:"provider" gorm:"type:varchar(32);not null;default:'';index"`
	TemplateVersion string `json:"template_version" gorm:"type:varchar(64);not null;default:'';index"`
	ProviderCode    string `json:"provider_code" gorm:"type:varchar(64);not null;default:'';index"`
	DurationMs      int64  `json:"duration_ms" gorm:"bigint;not null;default:0"`
	CreatedAt       int64  `json:"created_at" gorm:"autoCreateTime;column:created_at;index"`
}

func (SMSSendLog) TableName() string {
	return "sms_send_logs"
}
