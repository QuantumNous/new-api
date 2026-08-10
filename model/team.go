package model

import (
	"strings"
	"time"

	"gorm.io/gorm"
)

// Team 企业团队空间：团队（部门 / 组织单元）实体。
type Team struct {
	Id          int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	Name        string `json:"name" gorm:"type:varchar(64);not null;uniqueIndex"`
	Description string `json:"description" gorm:"type:varchar(255)"`
	OwnerId     int64  `json:"owner_id" gorm:"not null;index"`
	CreatedAt   int64  `json:"created_at" gorm:"bigint;index"`
	UpdatedAt   int64  `json:"updated_at" gorm:"bigint"`
}

// TeamMember 团队成员与角色。
type TeamMember struct {
	Id        int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	TeamId    int64  `json:"team_id" gorm:"not null;index"`
	UserId    int64  `json:"user_id" gorm:"not null;index"`
	Role      string `json:"role" gorm:"type:varchar(16);not null;default:'member'"` // admin | member
	CreatedAt int64  `json:"created_at" gorm:"bigint"`
}

// TeamProject 团队内项目。
type TeamProject struct {
	Id          int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	TeamId      int64  `json:"team_id" gorm:"not null;index"`
	Name        string `json:"name" gorm:"type:varchar(64);not null"`
	Description string `json:"description" gorm:"type:varchar(255)"`
	CreatedAt   int64  `json:"created_at" gorm:"bigint;index"`
	UpdatedAt   int64  `json:"updated_at" gorm:"bigint"`
}

// 团队角色白名单。
var AllowedTeamMemberRoles = map[string]bool{
	"admin":  true,
	"member": true,
}

// CreateTeam 创建团队（调用方负责填充时间戳）。
func CreateTeam(t *Team) error {
	now := time.Now().Unix()
	t.CreatedAt = now
	t.UpdatedAt = now
	return DB.Create(t).Error
}

// GetTeamById 按 id 获取团队。
func GetTeamById(id int64) (*Team, error) {
	var t Team
	err := DB.Where("id = ?", id).First(&t).Error
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// ListTeams 分页列出团队；keyword 为空时不过滤（按名称模糊匹配）。
func ListTeams(page, pageSize int, keyword string) ([]*Team, int64, error) {
	var items []*Team
	var total int64
	q := DB.Model(&Team{})
	if strings.TrimSpace(keyword) != "" {
		q = q.Where("name LIKE ?", "%"+keyword+"%")
	}
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * pageSize
	if err := q.Order("id DESC").Offset(offset).Limit(pageSize).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// UpdateTeam 更新团队可编辑字段（Name 唯一键不可变概念上，此处允许改名）。
func UpdateTeam(t *Team) error {
	updates := map[string]interface{}{
		"description": t.Description,
		"owner_id":    t.OwnerId,
		"updated_at":  time.Now().Unix(),
	}
	return DB.Model(&Team{}).Where("id = ?", t.Id).Updates(updates).Error
}

// DeleteTeam 删除团队并级联删除其成员与项目。
func DeleteTeam(id int64) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("team_id = ?", id).Delete(&TeamMember{}).Error; err != nil {
			return err
		}
		if err := tx.Where("team_id = ?", id).Delete(&TeamProject{}).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", id).Delete(&Team{}).Error
	})
}

// CreateTeamMember 添加团队成员。
func CreateTeamMember(m *TeamMember) error {
	m.CreatedAt = time.Now().Unix()
	return DB.Create(m).Error
}

// ListTeamMembers 分页列出团队成员。
func ListTeamMembers(teamId int64, page, pageSize int) ([]*TeamMember, int64, error) {
	var items []*TeamMember
	var total int64
	q := DB.Model(&TeamMember{}).Where("team_id = ?", teamId)
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * pageSize
	if err := q.Order("id ASC").Offset(offset).Limit(pageSize).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// DeleteTeamMember 按 team + user 移除成员。
func DeleteTeamMember(teamId, userId int64) error {
	return DB.Where("team_id = ? AND user_id = ?", teamId, userId).Delete(&TeamMember{}).Error
}

// CreateTeamProject 添加团队项目。
func CreateTeamProject(p *TeamProject) error {
	now := time.Now().Unix()
	p.CreatedAt = now
	p.UpdatedAt = now
	return DB.Create(p).Error
}

// ListTeamProjects 列出团队全部项目。
func ListTeamProjects(teamId int64) ([]*TeamProject, error) {
	var items []*TeamProject
	err := DB.Where("team_id = ?", teamId).Order("id ASC").Find(&items).Error
	if err != nil {
		return nil, err
	}
	return items, nil
}

// DeleteTeamProject 删除团队项目。
func DeleteTeamProject(teamId, projectId int64) error {
	return DB.Where("team_id = ? AND id = ?", teamId, projectId).Delete(&TeamProject{}).Error
}

// TeamBilling 部门账单汇总：成员额度近似 + 团队实际用量（按 team_id 聚合消耗日志）。
type TeamBilling struct {
	TeamId           int64 `json:"team_id"`
	MemberCount      int64 `json:"member_count"`
	Allocated        int64 `json:"allocated"`         // 成员额度总和
	Used             int64 `json:"used"`              // 成员已用额度总和
	UsageQuota       int64 `json:"usage_quota"`       // 团队实际消耗配额（来自消耗日志，按 team_id 聚合）
	PromptTokens     int64 `json:"prompt_tokens"`     // 团队实际 prompt tokens
	CompletionTokens int64 `json:"completion_tokens"` // 团队实际 completion tokens
	RequestCount     int64 `json:"request_count"`     // 团队实际请求数
}

// GetTeamBilling 汇总团队成员的额度与用量。
func GetTeamBilling(teamId int64) (*TeamBilling, error) {
	var memberIds []int64
	if err := DB.Model(&TeamMember{}).Where("team_id = ?", teamId).Pluck("user_id", &memberIds).Error; err != nil {
		return nil, err
	}
	billing := &TeamBilling{TeamId: teamId, MemberCount: int64(len(memberIds))}
	if len(memberIds) == 0 {
		return billing, nil
	}
	var allocated, used int64
	if err := DB.Model(&User{}).
		Where("id IN ?", memberIds).
		Select("COALESCE(SUM(quota),0), COALESCE(SUM(used_quota),0)").
		Row().Scan(&allocated, &used); err != nil {
		return nil, err
	}
	billing.Allocated = allocated
	billing.Used = used

	// 实际用量：按 team_id 聚合消耗日志（LOG_DB 未启用时跳过，避免空指针）
	if LOG_DB != nil {
		var usageQuota, promptTokens, completionTokens, requestCount int64
		if err := LOG_DB.Table("logs").
			Select("COALESCE(SUM(quota),0), COALESCE(SUM(prompt_tokens),0), COALESCE(SUM(completion_tokens),0), COUNT(*)").
			Where("team_id = ? AND type = ?", teamId, LogTypeConsume).
			Row().Scan(&usageQuota, &promptTokens, &completionTokens, &requestCount); err != nil {
			return nil, err
		}
		billing.UsageQuota = usageQuota
		billing.PromptTokens = promptTokens
		billing.CompletionTokens = completionTokens
		billing.RequestCount = requestCount
	}

	return billing, nil
}
