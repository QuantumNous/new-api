package model

import (
	"errors"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// GroupMappingRule 描述「岗位 -> 分组」的自动分组映射规则。
// 创建用户（OAuth 登录、飞书批量创建、管理员手动创建）以及定时同步飞书用户信息时，
// 系统会根据用户的 job_title 命中这里的规则，自动决定其所属分组，
// 进而通过 SyncUserBindGroupSubscriptions 自动同步对应的订阅套餐。
type GroupMappingRule struct {
	Id          int    `json:"id" gorm:"primaryKey"`
	JobTitle    string `json:"job_title" gorm:"type:varchar(128);uniqueIndex"`
	TargetGroup string `json:"target_group" gorm:"type:varchar(64)"`
	Enabled     bool   `json:"enabled"`
	Priority    int    `json:"priority" gorm:"default:0"`
	Remark      string `json:"remark" gorm:"type:varchar(256)"`
	CreatedAt   int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt   int64  `json:"updated_at" gorm:"bigint"`
}

func (GroupMappingRule) TableName() string {
	return "group_mapping_rules"
}

// GetAllGroupMappingRules 返回全部规则，按 priority 降序、id 升序排列。
func GetAllGroupMappingRules() ([]GroupMappingRule, error) {
	var rules []GroupMappingRule
	err := DB.Order("priority desc, id asc").Find(&rules).Error
	return rules, err
}

// GetGroupMappingRuleByJobTitle 精确匹配 job_title（区分大小写），仅返回启用的规则。
// 未命中时返回 nil, nil（非 error）。
func GetGroupMappingRuleByJobTitle(jobTitle string) (*GroupMappingRule, error) {
	jobTitle = strings.TrimSpace(jobTitle)
	if jobTitle == "" {
		return nil, nil
	}
	var rule GroupMappingRule
	err := DB.Where("job_title = ? AND enabled = ?", jobTitle, true).First(&rule).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &rule, nil
}

// GetExistingJobTitles 批量查询已存在的 job_title，用于一键初始化时标记 exists。
func GetExistingJobTitles(jobTitles []string) (map[string]bool, error) {
	result := make(map[string]bool)
	if len(jobTitles) == 0 {
		return result, nil
	}
	var existing []string
	err := DB.Model(&GroupMappingRule{}).
		Where("job_title IN ?", jobTitles).
		Pluck("job_title", &existing).Error
	if err != nil {
		return result, err
	}
	for _, jt := range existing {
		result[jt] = true
	}
	return result, nil
}

func CreateGroupMappingRule(rule *GroupMappingRule) error {
	if rule == nil {
		return errors.New("rule is nil")
	}
	now := time.Now().Unix()
	rule.CreatedAt = now
	rule.UpdatedAt = now
	return DB.Create(rule).Error
}

func UpdateGroupMappingRule(rule *GroupMappingRule) error {
	if rule == nil || rule.Id == 0 {
		return errors.New("invalid rule")
	}
	rule.UpdatedAt = time.Now().Unix()
	return DB.Save(rule).Error
}

func DeleteGroupMappingRule(id int) error {
	if id <= 0 {
		return errors.New("invalid id")
	}
	return DB.Delete(&GroupMappingRule{}, id).Error
}

// UpdateUserGroup 更新用户分组列，处理 `group` 保留字跨库差异。
// 供自动分组 service 调用，避免在 service 层直接操作 SQL 列名。
// 注意：GORM 的 .Update(column, value) 会自动给 column 加引号（dialect-aware），
// 所以这里传不带引号的 raw 列名 "group"，GORM 会正确处理为 `group`（MySQL/SQLite）或 "group"（PostgreSQL）。
// 如果传 CommonGroupColumnName()（已带引号），GORM 会再加一层引号导致 SQL 语法错误。
func UpdateUserGroup(userId int, newGroup string) error {
	if userId <= 0 {
		return errors.New("invalid user id")
	}
	return DB.Model(&User{}).Where("id = ?", userId).
		Update("group", newGroup).Error
}

// UpdateGroupMappingRulesInTx 在单个事务内批量 upsert 规则，
// 用于一键初始化 apply。已存在的 job_title 更新 target_group，不存在的插入。
func UpdateGroupMappingRulesInTx(rules []GroupMappingRule) error {
	if len(rules) == 0 {
		return nil
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		now := time.Now().Unix()
		for i := range rules {
			r := &rules[i]
			r.JobTitle = strings.TrimSpace(r.JobTitle)
			if r.JobTitle == "" {
				continue
			}
			r.UpdatedAt = now
			var existing GroupMappingRule
			err := tx.Where("job_title = ?", r.JobTitle).First(&existing).Error
			if err == nil {
				existing.TargetGroup = r.TargetGroup
				existing.Remark = r.Remark
				existing.UpdatedAt = now
				if err := tx.Save(&existing).Error; err != nil {
					return err
				}
				rules[i].Id = existing.Id
			} else if errors.Is(err, gorm.ErrRecordNotFound) {
				r.CreatedAt = now
				if err := tx.Create(r).Error; err != nil {
					return err
				}
			} else {
				return err
			}
		}
		return nil
	})
}

// JobTitleGroupStat 用于一键初始化的聚合统计。
type JobTitleGroupStat struct {
	JobTitle string
	Group    string
	Count    int
}

// AggregateJobTitleGroupStats 按 job_title + group 聚合用户数，
// 排除 job_title 为空、group 为空、以及 protectedGroups 中的分组。
func AggregateJobTitleGroupStats(protectedGroups []string) ([]JobTitleGroupStat, error) {
	protected := make(map[string]bool, len(protectedGroups))
	for _, g := range protectedGroups {
		g = strings.TrimSpace(g)
		if g != "" {
			protected[g] = true
		}
	}
	groupCol := CommonGroupColumnName()

	query := DB.Model(&User{}).
		Select(groupCol + " as grp, job_title, count(*) as cnt").
		Where("job_title <> ''").
		Where("job_title IS NOT NULL").
		Where(groupCol + " <> ''").
		Where(groupCol + " IS NOT NULL").
		Group("job_title, " + groupCol)

	if len(protected) > 0 {
		keys := make([]string, 0, len(protected))
		for k := range protected {
			keys = append(keys, k)
		}
		query = query.Where(groupCol+" NOT IN ?", keys)
	}

	var stats []JobTitleGroupStat
	// GORM Select 里用别名 grp 避免和保留字 group 冲突，这里手动扫描
	rows, err := query.Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var grp, jobTitle string
		var cnt int
		if err := rows.Scan(&grp, &jobTitle, &cnt); err != nil {
			return nil, err
		}
		stats = append(stats, JobTitleGroupStat{
			JobTitle: jobTitle,
			Group:    grp,
			Count:    cnt,
		})
	}
	return stats, rows.Err()
}

// IsAutoGroupProtectedGroupsConfigured 返回 protected groups 配置是否非空，
// 仅供 service 层判断使用。实际配置值缓存在 common.OptionMap。
func IsAutoGroupProtectedGroupsConfigured() bool {
	return strings.TrimSpace(common.OptionMap["auto_group.protected_groups"]) != ""
}
