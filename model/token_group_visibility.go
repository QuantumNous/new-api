package model

import (
	"errors"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	TokenGroupVisibilityPublic   = "public"
	TokenGroupVisibilityTargeted = "targeted"
	TokenGroupVisibilityHidden   = "hidden"
)

// TokenGroupVisibility is an optional policy layered over the established
// user-usable-group rules. A missing row intentionally preserves legacy behavior.
type TokenGroupVisibility struct {
	Id         int    `json:"id"`
	Group      string `json:"group" gorm:"type:varchar(64);uniqueIndex"`
	Visibility string `json:"visibility" gorm:"type:varchar(16);index"`
	StartTime  int64  `json:"start_time" gorm:"bigint;default:0"`
	EndTime    int64  `json:"end_time" gorm:"bigint;default:0"`
}

type TokenGroupVisibilityTarget struct {
	Id           int    `json:"id"`
	VisibilityId int    `json:"visibility_id" gorm:"index;uniqueIndex:idx_visibility_username"`
	Username     string `json:"username" gorm:"type:varchar(64);uniqueIndex:idx_visibility_username"`
}

type TokenGroupVisibilityPolicy struct {
	Group      string   `json:"group"`
	Visibility string   `json:"visibility"`
	StartTime  int64    `json:"start_time"`
	EndTime    int64    `json:"end_time"`
	Usernames  []string `json:"usernames"`
}

func TokenGroupVisibilityEnabled() bool {
	return common.GetEnvOrDefaultBool("TOKEN_GROUP_VISIBILITY_ENABLED", false)
}

// GetTokenGroupVisibilityPolicies deliberately reads through to the database.
// Visibility is an authorization boundary and this service can run on multiple
// nodes; an in-process cache could leave a node enforcing stale permissions.
func GetTokenGroupVisibilityPolicies() ([]TokenGroupVisibilityPolicy, error) {
	var rows []TokenGroupVisibility
	if err := DB.Order(clause.OrderByColumn{Column: clause.Column{Name: "group"}}).Find(&rows).Error; err != nil {
		return nil, err
	}
	policies := make([]TokenGroupVisibilityPolicy, 0, len(rows))
	for _, row := range rows {
		var targets []TokenGroupVisibilityTarget
		if err := DB.Where("visibility_id = ?", row.Id).Order("username asc").Find(&targets).Error; err != nil {
			return nil, err
		}
		policy := TokenGroupVisibilityPolicy{Group: row.Group, Visibility: row.Visibility, StartTime: row.StartTime, EndTime: row.EndTime}
		for _, target := range targets {
			policy.Usernames = append(policy.Usernames, target.Username)
		}
		policies = append(policies, policy)
	}
	return policies, nil
}

func normalizeTokenGroupVisibilityPolicy(policy TokenGroupVisibilityPolicy) (TokenGroupVisibilityPolicy, error) {
	policy.Group = strings.TrimSpace(policy.Group)
	policy.Visibility = strings.TrimSpace(policy.Visibility)
	if !ratio_setting.ContainsGroupRatio(policy.Group) || policy.Group == "auto" {
		return policy, errors.New("令牌分组不存在或不能为 auto")
	}
	if policy.Visibility != TokenGroupVisibilityPublic && policy.Visibility != TokenGroupVisibilityTargeted && policy.Visibility != TokenGroupVisibilityHidden {
		return policy, errors.New("无效的令牌分组可见性策略")
	}
	if policy.EndTime != 0 && policy.StartTime != 0 && policy.EndTime <= policy.StartTime {
		return policy, errors.New("结束时间必须晚于开始时间")
	}
	if policy.Visibility == TokenGroupVisibilityTargeted && len(policy.Usernames) == 0 {
		return policy, errors.New("定向展示策略至少需要一个用户名")
	}
	seen := make(map[string]struct{}, len(policy.Usernames))
	targets := make([]string, 0, len(policy.Usernames))
	for _, username := range policy.Usernames {
		username = strings.TrimSpace(username)
		if username == "" {
			continue
		}
		if _, ok := seen[username]; ok {
			continue
		}
		seen[username] = struct{}{}
		targets = append(targets, username)
	}
	sort.Strings(targets)
	if policy.Visibility == TokenGroupVisibilityTargeted && len(targets) == 0 {
		return policy, errors.New("定向展示策略至少需要一个有效用户名")
	}
	policy.Usernames = targets
	return policy, nil
}

func saveTokenGroupVisibilityPolicyTx(tx *gorm.DB, policy TokenGroupVisibilityPolicy) error {
	var row TokenGroupVisibility
	err := tx.Where(map[string]interface{}{"group": policy.Group}).First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		row = TokenGroupVisibility{Group: policy.Group}
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
	} else if err != nil {
		return err
	}
	if err := tx.Model(&row).Updates(map[string]interface{}{"visibility": policy.Visibility, "start_time": policy.StartTime, "end_time": policy.EndTime}).Error; err != nil {
		return err
	}
	if err := tx.Where("visibility_id = ?", row.Id).Delete(&TokenGroupVisibilityTarget{}).Error; err != nil {
		return err
	}
	if policy.Visibility == TokenGroupVisibilityTargeted {
		for _, username := range policy.Usernames {
			if err := tx.Create(&TokenGroupVisibilityTarget{VisibilityId: row.Id, Username: username}).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func SaveTokenGroupVisibilityPolicy(policy TokenGroupVisibilityPolicy) error {
	normalized, err := normalizeTokenGroupVisibilityPolicy(policy)
	if err != nil {
		return err
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		return saveTokenGroupVisibilityPolicyTx(tx, normalized)
	})
}

// ReplaceTokenGroupVisibilityPolicies validates the complete desired state
// before changing anything and applies saves and removals in one transaction.
func ReplaceTokenGroupVisibilityPolicies(policies []TokenGroupVisibilityPolicy) error {
	normalized := make([]TokenGroupVisibilityPolicy, 0, len(policies))
	seenGroups := make(map[string]struct{}, len(policies))
	for _, policy := range policies {
		item, err := normalizeTokenGroupVisibilityPolicy(policy)
		if err != nil {
			return err
		}
		if _, exists := seenGroups[item.Group]; exists {
			return errors.New("令牌分组可见性策略不能包含重复分组")
		}
		seenGroups[item.Group] = struct{}{}
		normalized = append(normalized, item)
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		for _, policy := range normalized {
			if err := saveTokenGroupVisibilityPolicyTx(tx, policy); err != nil {
				return err
			}
		}
		var obsolete []TokenGroupVisibility
		if err := tx.Find(&obsolete).Error; err != nil {
			return err
		}
		for _, row := range obsolete {
			if _, keep := seenGroups[row.Group]; keep {
				continue
			}
			if err := tx.Where("visibility_id = ?", row.Id).Delete(&TokenGroupVisibilityTarget{}).Error; err != nil {
				return err
			}
			if err := tx.Delete(&row).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func DeleteTokenGroupVisibilityPolicy(group string) error {
	err := DB.Transaction(func(tx *gorm.DB) error {
		var row TokenGroupVisibility
		if err := tx.Where(map[string]interface{}{"group": group}).First(&row).Error; errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		} else if err != nil {
			return err
		}
		if err := tx.Where("visibility_id = ?", row.Id).Delete(&TokenGroupVisibilityTarget{}).Error; err != nil {
			return err
		}
		return tx.Delete(&row).Error
	})
	return err
}
