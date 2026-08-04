package model

import (
	"errors"
	"fmt"
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
	Group      string `json:"group" gorm:"type:varchar(64);not null;uniqueIndex"`
	Visibility string `json:"visibility" gorm:"type:varchar(16);not null;index"`
	StartTime  int64  `json:"start_time" gorm:"type:bigint;default:0"`
	EndTime    int64  `json:"end_time" gorm:"type:bigint;default:0"`
}

type TokenGroupVisibilityTarget struct {
	Id           int `json:"id"`
	VisibilityId int `json:"visibility_id" gorm:"type:bigint;not null;index;uniqueIndex:idx_visibility_user"`
	UserId       int `json:"user_id" gorm:"type:bigint;not null;index;uniqueIndex:idx_visibility_user"`
}

type TokenGroupVisibilityPolicy struct {
	Group      string `json:"group"`
	Visibility string `json:"visibility"`
	StartTime  int64  `json:"start_time"`
	EndTime    int64  `json:"end_time"`
	// UserIds is the canonical targeting field. Authorization always compares
	// these immutable IDs; it never compares a mutable username.
	UserIds []int `json:"user_ids,omitempty"`
	// Usernames is accepted only as a legacy input compatibility field. It is
	// resolved to IDs during validation and is never persisted as a target.
	Usernames []string `json:"usernames,omitempty"`
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
	targetsByVisibility := make(map[int][]int, len(rows))
	if len(rows) > 0 {
		var targets []TokenGroupVisibilityTarget
		ids := make([]int, 0, len(rows))
		for _, row := range rows {
			ids = append(ids, row.Id)
		}
		if err := DB.Where("visibility_id IN ?", ids).Order("user_id asc").Find(&targets).Error; err != nil {
			return nil, err
		}
		for _, target := range targets {
			targetsByVisibility[target.VisibilityId] = append(targetsByVisibility[target.VisibilityId], target.UserId)
		}
	}
	for _, row := range rows {
		policies = append(policies, TokenGroupVisibilityPolicy{
			Group: row.Group, Visibility: row.Visibility, StartTime: row.StartTime,
			EndTime: row.EndTime, UserIds: targetsByVisibility[row.Id],
		})
	}
	return policies, nil
}

func resolveTokenGroupVisibilityTargetUserIds(userIds []int, usernames []string) ([]int, error) {
	ids := make([]int, 0, len(userIds)+len(usernames))
	seenIds := make(map[int]struct{}, len(userIds)+len(usernames))
	for _, userId := range userIds {
		if userId <= 0 {
			return nil, errors.New("定向展示策略包含无效用户 ID")
		}
		if _, exists := seenIds[userId]; !exists {
			seenIds[userId] = struct{}{}
			ids = append(ids, userId)
		}
	}

	normalizedNames := make([]string, 0, len(usernames))
	seenNames := make(map[string]struct{}, len(usernames))
	for _, username := range usernames {
		username = strings.TrimSpace(username)
		if username == "" {
			continue
		}
		if _, exists := seenNames[username]; !exists {
			seenNames[username] = struct{}{}
			normalizedNames = append(normalizedNames, username)
		}
	}
	if len(normalizedNames) > 0 {
		var users []User
		if err := DB.Where("username IN ?", normalizedNames).Select("id, username").Find(&users).Error; err != nil {
			return nil, err
		}
		idsByName := make(map[string]int, len(users))
		for _, user := range users {
			idsByName[user.Username] = user.Id
		}
		legacyIds := make([]int, 0, len(normalizedNames))
		for _, username := range normalizedNames {
			userId, exists := idsByName[username]
			if !exists {
				return nil, fmt.Errorf("定向展示策略包含不存在的用户名：%s", username)
			}
			legacyIds = append(legacyIds, userId)
		}
		if len(userIds) > 0 {
			// When both fields are supplied, IDs are authoritative. Reject a
			// mismatch instead of silently broadening a targeting policy.
			for _, userId := range legacyIds {
				if _, exists := seenIds[userId]; !exists {
					return nil, errors.New("user_ids 与 legacy usernames 不一致")
				}
			}
		} else {
			for _, userId := range legacyIds {
				if _, exists := seenIds[userId]; !exists {
					seenIds[userId] = struct{}{}
					ids = append(ids, userId)
				}
			}
		}
	}

	if len(ids) == 0 {
		return nil, errors.New("定向展示策略至少需要一个有效用户 ID")
	}
	var existingIds []int
	if err := DB.Model(&User{}).Where("id IN ?", ids).Pluck("id", &existingIds).Error; err != nil {
		return nil, err
	}
	if len(existingIds) != len(ids) {
		return nil, errors.New("定向展示策略包含不存在的用户 ID")
	}
	sort.Ints(ids)
	return ids, nil
}

func normalizeTokenGroupVisibilityPolicy(policy TokenGroupVisibilityPolicy, allowExistingOrphan bool) (TokenGroupVisibilityPolicy, error) {
	policy.Group = strings.TrimSpace(policy.Group)
	policy.Visibility = strings.TrimSpace(policy.Visibility)
	groupExists := ratio_setting.ContainsGroupRatio(policy.Group)
	if !groupExists && allowExistingOrphan && policy.Group != "auto" {
		var existing TokenGroupVisibility
		err := DB.Where(map[string]interface{}{"group": policy.Group}).First(&existing).Error
		switch {
		case err == nil:
			groupExists = true
		case errors.Is(err, gorm.ErrRecordNotFound):
			// A new group must still be present in GroupRatio. Only an
			// already-persisted orphan may pass the replacement path.
		default:
			return policy, err
		}
	}
	if !groupExists || policy.Group == "auto" {
		return policy, errors.New("令牌分组不存在或不能为 auto")
	}
	if policy.Visibility != TokenGroupVisibilityPublic && policy.Visibility != TokenGroupVisibilityTargeted && policy.Visibility != TokenGroupVisibilityHidden {
		return policy, errors.New("无效的令牌分组可见性策略")
	}
	if policy.EndTime != 0 && policy.StartTime != 0 && policy.EndTime <= policy.StartTime {
		return policy, errors.New("结束时间必须晚于开始时间")
	}
	if policy.Visibility == TokenGroupVisibilityTargeted {
		userIds, err := resolveTokenGroupVisibilityTargetUserIds(policy.UserIds, policy.Usernames)
		if err != nil {
			return policy, err
		}
		policy.UserIds = userIds
	} else {
		policy.UserIds = nil
	}
	// Legacy names are input-only and must not be echoed back into persisted
	// policy state or used by the runtime authorization path.
	policy.Usernames = nil
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
		for _, userId := range policy.UserIds {
			if err := tx.Create(&TokenGroupVisibilityTarget{VisibilityId: row.Id, UserId: userId}).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func SaveTokenGroupVisibilityPolicy(policy TokenGroupVisibilityPolicy) error {
	normalized, err := normalizeTokenGroupVisibilityPolicy(policy, false)
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
		// A policy for a group that was later removed from GroupRatio is an
		// inert, already-persisted row. Allowing it through a full replacement
		// lets the admin remove or retain that row instead of locking the whole
		// editor; runtime selection still intersects with the current usable set.
		item, err := normalizeTokenGroupVisibilityPolicy(policy, true)
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
