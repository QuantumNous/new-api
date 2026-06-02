package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	ChannelPreparationStatusPending   = 1
	ChannelPreparationStatusPromoted  = 2
	ChannelPreparationStatusArchived  = 3
	ChannelPreparationStatusPromoting = 4
)

type ChannelPreparation struct {
	Id                 int     `json:"id"`
	Type               int     `json:"type" gorm:"default:0"`
	Key                string  `json:"key" gorm:"not null"`
	OpenAIOrganization *string `json:"openai_organization"`
	TestModel          *string `json:"test_model"`
	Name               string  `json:"name" gorm:"index"`
	Weight             *uint   `json:"weight" gorm:"default:0"`
	CreatedTime        int64   `json:"created_time" gorm:"bigint"`
	UpdatedTime        int64   `json:"updated_time" gorm:"bigint"`
	BaseURL            *string `json:"base_url" gorm:"column:base_url;default:''"`
	Other              string  `json:"other"`
	Balance            float64 `json:"balance"`
	Models             string  `json:"models"`
	Group              string  `json:"group" gorm:"type:varchar(64);default:'default'"`
	ModelMapping       *string `json:"model_mapping" gorm:"type:text"`
	StatusCodeMapping  *string `json:"status_code_mapping" gorm:"type:varchar(1024);default:''"`
	Priority           *int64  `json:"priority" gorm:"bigint;default:0"`
	AutoBan            *int    `json:"auto_ban" gorm:"default:1"`
	OtherInfo          string  `json:"other_info"`
	Tag                *string `json:"tag" gorm:"index"`
	Setting            *string `json:"setting" gorm:"type:text"`
	ParamOverride      *string `json:"param_override" gorm:"type:text"`
	HeaderOverride     *string `json:"header_override" gorm:"type:text"`
	Remark             *string `json:"remark" gorm:"type:varchar(255)" validate:"max=255"`
	OtherSettings      string  `json:"settings" gorm:"column:settings"`

	Status            int    `json:"status" gorm:"default:1;index"`
	Source            string `json:"source" gorm:"type:varchar(64);index"`
	Note              string `json:"note" gorm:"type:text"`
	PromotedTime      *int64 `json:"promoted_time" gorm:"bigint"`
	PromotedChannelId *int   `json:"promoted_channel_id" gorm:"index"`
}

type ChannelPreparationResponse struct {
	Id                 int     `json:"id"`
	Type               int     `json:"type"`
	KeyPreview         string  `json:"key_preview"`
	OpenAIOrganization *string `json:"openai_organization"`
	TestModel          *string `json:"test_model"`
	Name               string  `json:"name"`
	Weight             *uint   `json:"weight"`
	CreatedTime        int64   `json:"created_time"`
	UpdatedTime        int64   `json:"updated_time"`
	BaseURL            *string `json:"base_url"`
	Other              string  `json:"other"`
	Balance            float64 `json:"balance"`
	Models             string  `json:"models"`
	Group              string  `json:"group"`
	ModelMapping       *string `json:"model_mapping"`
	StatusCodeMapping  *string `json:"status_code_mapping"`
	Priority           *int64  `json:"priority"`
	AutoBan            *int    `json:"auto_ban"`
	OtherInfo          string  `json:"other_info"`
	Tag                *string `json:"tag"`
	Setting            *string `json:"setting"`
	ParamOverride      *string `json:"param_override"`
	HeaderOverride     *string `json:"header_override"`
	Remark             *string `json:"remark"`
	OtherSettings      string  `json:"settings"`
	Status             int     `json:"status"`
	Source             string  `json:"source"`
	Note               string  `json:"note"`
	PromotedTime       *int64  `json:"promoted_time"`
	PromotedChannelId  *int    `json:"promoted_channel_id"`
}

type ChannelPreparationListOptions struct {
	Page     int
	PageSize int
	Keyword  string
	Group    string
	Type     *int
	Status   *int
	IDSort   bool
}

type ChannelPreparationCountRow struct {
	Value int   `json:"value"`
	Count int64 `json:"count"`
}

func (p *ChannelPreparation) NormalizeForCreate() {
	now := common.GetTimestamp()
	p.Id = 0
	p.Status = ChannelPreparationStatusPending
	p.CreatedTime = now
	p.UpdatedTime = now
	p.PromotedTime = nil
	p.PromotedChannelId = nil
	if strings.TrimSpace(p.Group) == "" {
		p.Group = "default"
	}
	if p.AutoBan == nil {
		defaultAutoBan := 1
		p.AutoBan = &defaultAutoBan
	}
}

func (p *ChannelPreparation) NormalizeForUpdate(existing *ChannelPreparation) {
	p.Id = existing.Id
	p.Status = existing.Status
	p.CreatedTime = existing.CreatedTime
	p.UpdatedTime = common.GetTimestamp()
	p.PromotedTime = existing.PromotedTime
	p.PromotedChannelId = existing.PromotedChannelId
	if strings.TrimSpace(p.Key) == "" {
		p.Key = existing.Key
	}
	if strings.TrimSpace(p.Group) == "" {
		p.Group = "default"
	}
	if p.AutoBan == nil {
		defaultAutoBan := 1
		p.AutoBan = &defaultAutoBan
	}
}

func (p *ChannelPreparation) KeyPreview() string {
	key := strings.TrimSpace(p.Key)
	if key == "" {
		return ""
	}
	if len(key) <= 12 {
		return key
	}
	return key[:8] + "..." + key[len(key)-4:]
}

func (p *ChannelPreparation) ToResponse() ChannelPreparationResponse {
	return ChannelPreparationResponse{
		Id:                 p.Id,
		Type:               p.Type,
		KeyPreview:         p.KeyPreview(),
		OpenAIOrganization: p.OpenAIOrganization,
		TestModel:          p.TestModel,
		Name:               p.Name,
		Weight:             p.Weight,
		CreatedTime:        p.CreatedTime,
		UpdatedTime:        p.UpdatedTime,
		BaseURL:            p.BaseURL,
		Other:              p.Other,
		Balance:            p.Balance,
		Models:             p.Models,
		Group:              p.Group,
		ModelMapping:       p.ModelMapping,
		StatusCodeMapping:  p.StatusCodeMapping,
		Priority:           p.Priority,
		AutoBan:            p.AutoBan,
		OtherInfo:          p.OtherInfo,
		Tag:                p.Tag,
		Setting:            p.Setting,
		ParamOverride:      p.ParamOverride,
		HeaderOverride:     p.HeaderOverride,
		Remark:             p.Remark,
		OtherSettings:      p.OtherSettings,
		Status:             p.Status,
		Source:             p.Source,
		Note:               p.Note,
		PromotedTime:       p.PromotedTime,
		PromotedChannelId:  p.PromotedChannelId,
	}
}

func ChannelPreparationResponses(preparations []ChannelPreparation) []ChannelPreparationResponse {
	responses := make([]ChannelPreparationResponse, 0, len(preparations))
	for _, preparation := range preparations {
		responses = append(responses, preparation.ToResponse())
	}
	return responses
}

func (p *ChannelPreparation) ToChannel() *Channel {
	group := p.Group
	if strings.TrimSpace(group) == "" {
		group = "default"
	}
	autoBan := p.AutoBan
	if autoBan == nil {
		defaultAutoBan := 1
		autoBan = &defaultAutoBan
	}
	return &Channel{
		Type:               p.Type,
		Key:                p.Key,
		OpenAIOrganization: p.OpenAIOrganization,
		TestModel:          p.TestModel,
		Status:             common.ChannelStatusEnabled,
		Name:               p.Name,
		Weight:             p.Weight,
		BaseURL:            p.BaseURL,
		Other:              p.Other,
		Balance:            p.Balance,
		Models:             p.Models,
		Group:              group,
		ModelMapping:       p.ModelMapping,
		StatusCodeMapping:  p.StatusCodeMapping,
		Priority:           p.Priority,
		AutoBan:            autoBan,
		OtherInfo:          p.OtherInfo,
		Tag:                p.Tag,
		Setting:            p.Setting,
		ParamOverride:      p.ParamOverride,
		HeaderOverride:     p.HeaderOverride,
		Remark:             p.Remark,
		OtherSettings:      p.OtherSettings,
	}
}

func applyChannelPreparationFilters(db *gorm.DB, opts ChannelPreparationListOptions, includeStatus bool, includeType bool) *gorm.DB {
	keyword := strings.TrimSpace(opts.Keyword)
	if keyword != "" {
		like := "%" + keyword + "%"
		db = db.Where("(id = ? OR name LIKE ? OR "+commonKeyCol+" = ? OR source LIKE ? OR note LIKE ?)", common.String2Int(keyword), like, keyword, like, like)
	}
	group := strings.TrimSpace(opts.Group)
	if group != "" {
		db = db.Where(commonGroupCol+" LIKE ?", "%"+group+"%")
	}
	if includeType && opts.Type != nil {
		db = db.Where("type = ?", *opts.Type)
	}
	if includeStatus && opts.Status != nil {
		db = db.Where("status = ?", *opts.Status)
	}
	return db
}

func GetDistinctChannelPreparationGroups() ([]string, error) {
	var groups []string
	err := DB.Model(&ChannelPreparation{}).
		Where(commonGroupCol+" IS NOT NULL AND "+commonGroupCol+" != ''").
		Distinct(commonGroupCol).
		Pluck(commonGroupCol, &groups).Error
	return groups, err
}

func GetChannelPreparations(opts ChannelPreparationListOptions) ([]ChannelPreparation, int64, []ChannelPreparationCountRow, []ChannelPreparationCountRow, error) {
	if opts.Page <= 0 {
		opts.Page = 1
	}
	if opts.PageSize <= 0 {
		opts.PageSize = 20
	}
	if opts.PageSize > 100 {
		opts.PageSize = 100
	}

	base := applyChannelPreparationFilters(DB.Model(&ChannelPreparation{}), opts, true, true)
	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, nil, nil, err
	}

	var preparations []ChannelPreparation
	order := "created_time desc, id desc"
	if opts.IDSort {
		order = "id desc"
	}
	err := base.Order(order).Limit(opts.PageSize).Offset((opts.Page - 1) * opts.PageSize).Find(&preparations).Error
	if err != nil {
		return nil, 0, nil, nil, err
	}

	var statusCounts []ChannelPreparationCountRow
	statusQuery := applyChannelPreparationFilters(DB.Model(&ChannelPreparation{}), opts, false, true)
	if err := statusQuery.Select("status as value, count(*) as count").Group("status").Scan(&statusCounts).Error; err != nil {
		return nil, 0, nil, nil, err
	}

	var typeCounts []ChannelPreparationCountRow
	typeQuery := applyChannelPreparationFilters(DB.Model(&ChannelPreparation{}), opts, true, false)
	if err := typeQuery.Select("type as value, count(*) as count").Group("type").Scan(&typeCounts).Error; err != nil {
		return nil, 0, nil, nil, err
	}

	return preparations, total, statusCounts, typeCounts, nil
}
