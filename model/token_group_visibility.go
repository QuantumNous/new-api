package model

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	TokenGroupVisibilityPublic      = "public"
	TokenGroupVisibilityTargeted    = "targeted"
	TokenGroupVisibilityHidden      = "hidden"
	TokenGroupVisibilityModeLegacy  = "legacy"
	TokenGroupVisibilityModeShadow  = "shadow"
	TokenGroupVisibilityModeEnforce = "enforce"
	TokenGroupVisibilityModeInvalid = "invalid"
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

// TokenGroupVisibilityRevision is a singleton row used as a cross-process
// compare-and-swap mutex for administrative policy replacement. The policy
// tables remain the source of truth; this row only serializes writers.
type TokenGroupVisibilityRevision struct {
	Id        int       `json:"id" gorm:"primaryKey"`
	Digest    string    `json:"digest" gorm:"type:varchar(64);not null"`
	UpdatedAt time.Time `json:"updated_at"`
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
	// TargetUsers is populated on reads for administration UIs. It is never
	// accepted as an authorization input; UserIds remain canonical.
	TargetUsers []TokenGroupVisibilityTargetUser `json:"target_users,omitempty"`
}

type TokenGroupVisibilityTargetUser struct {
	Id       int    `json:"id"`
	Username string `json:"username"`
}

// TokenGroupVisibilityState is the administration read contract. Digest is
// a canonical snapshot token used for compare-and-swap writes.
type TokenGroupVisibilityState struct {
	Enabled    bool                         `json:"enabled"`
	Mode       string                       `json:"mode"`
	Policies   []TokenGroupVisibilityPolicy `json:"policies"`
	Digest     string                       `json:"digest"`
	ReadSource string                       `json:"read_source"`
	Degraded   bool                         `json:"degraded"`
}

var ErrTokenGroupVisibilityConflict = errors.New("令牌分组可见性策略已被其他管理员修改，请刷新后重试")

func TokenGroupVisibilityEnabled() bool {
	return common.GetEnvOrDefaultBool("TOKEN_GROUP_VISIBILITY_ENABLED", false)
}

// TokenGroupVisibilityMode separates rollout observation from enforcement.
// When the feature flag is enabled without an explicit mode, shadow is the
// safe default: decisions are compared and logged but legacy permissions are
// still returned. Production must opt into enforce explicitly.
func TokenGroupVisibilityMode() string {
	if !TokenGroupVisibilityEnabled() {
		return TokenGroupVisibilityModeLegacy
	}
	mode := strings.ToLower(strings.TrimSpace(common.GetEnvOrDefaultString("TOKEN_GROUP_VISIBILITY_MODE", TokenGroupVisibilityModeShadow)))
	switch mode {
	case TokenGroupVisibilityModeLegacy, TokenGroupVisibilityModeShadow, TokenGroupVisibilityModeEnforce:
		return mode
	default:
		return TokenGroupVisibilityModeInvalid
	}
}

func TokenGroupVisibilityEnforced() bool {
	return TokenGroupVisibilityMode() == TokenGroupVisibilityModeEnforce
}

// GetTokenGroupVisibilityPolicies deliberately reads through to the database.
// Visibility is an authorization boundary and this service can run on multiple
// nodes; an in-process cache could leave a node enforcing stale permissions.
func getTokenGroupVisibilityPoliciesFromDB(db *gorm.DB) ([]TokenGroupVisibilityPolicy, error) {
	var rows []TokenGroupVisibility
	if err := db.Order(clause.OrderByColumn{Column: clause.Column{Name: "group"}}).Find(&rows).Error; err != nil {
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
		if err := db.Where("visibility_id IN ?", ids).Order("user_id asc").Find(&targets).Error; err != nil {
			return nil, err
		}
		for _, target := range targets {
			targetsByVisibility[target.VisibilityId] = append(targetsByVisibility[target.VisibilityId], target.UserId)
		}
	}
	userIds := make([]int, 0)
	for _, row := range rows {
		userIds = append(userIds, targetsByVisibility[row.Id]...)
	}
	userNames := make(map[int]string)
	if len(userIds) > 0 {
		var users []User
		if err := db.Where("id IN ?", userIds).Select("id, username").Find(&users).Error; err != nil {
			return nil, err
		}
		for _, user := range users {
			userNames[user.Id] = user.Username
		}
	}
	for _, row := range rows {
		idsForPolicy := targetsByVisibility[row.Id]
		targetUsers := make([]TokenGroupVisibilityTargetUser, 0, len(idsForPolicy))
		for _, userId := range idsForPolicy {
			targetUsers = append(targetUsers, TokenGroupVisibilityTargetUser{Id: userId, Username: userNames[userId]})
		}
		policies = append(policies, TokenGroupVisibilityPolicy{
			Group: row.Group, Visibility: row.Visibility, StartTime: row.StartTime,
			EndTime: row.EndTime, UserIds: idsForPolicy, TargetUsers: targetUsers,
		})
	}
	return policies, nil
}

func GetTokenGroupVisibilityPolicies() ([]TokenGroupVisibilityPolicy, error) {
	return getTokenGroupVisibilityPoliciesFromDB(DB)
}

func TokenGroupVisibilityPoliciesDigest(policies []TokenGroupVisibilityPolicy) string {
	canonical := make([]TokenGroupVisibilityPolicy, len(policies))
	copy(canonical, policies)
	for i := range canonical {
		canonical[i].Usernames = nil
		canonical[i].TargetUsers = nil
		canonical[i].UserIds = append([]int(nil), canonical[i].UserIds...)
		sort.Ints(canonical[i].UserIds)
	}
	sort.Slice(canonical, func(i, j int) bool { return canonical[i].Group < canonical[j].Group })
	data, _ := json.Marshal(canonical)
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func GetTokenGroupVisibilityState() (TokenGroupVisibilityState, error) {
	state := TokenGroupVisibilityState{Enabled: TokenGroupVisibilityEnabled(), Mode: TokenGroupVisibilityMode(), ReadSource: "database"}
	if state.Enabled && state.Mode == TokenGroupVisibilityModeInvalid {
		state.Degraded = true
	}
	policies, err := GetTokenGroupVisibilityPolicies()
	if err != nil {
		// A flag-off deployment may legitimately precede the schema migration.
		// Keep this visible to the admin rather than fabricating an empty policy
		// set; an enabled deployment still fails closed to the caller.
		state.ReadSource = "database_error"
		state.Degraded = true
		state.Policies = []TokenGroupVisibilityPolicy{}
		if state.Enabled {
			return state, err
		}
		return state, nil
	}
	state.Policies = policies
	state.Digest = TokenGroupVisibilityPoliciesDigest(policies)
	return state, nil
}

func resolveTokenGroupVisibilityTargetUserIds(userIds []int, usernames []string) ([]int, error) {
	ids := make([]int, 0, len(userIds)+len(usernames))
	seenIds := make(map[int]struct{}, len(userIds)+len(usernames))
	for _, userId := range userIds {
		if userId <= 0 {
			return nil, errors.New("定向展示策略包含无效用户 ID")
		}
		if _, exists := seenIds[userId]; exists {
			return nil, errors.New("定向展示策略包含重复用户 ID")
		}
		seenIds[userId] = struct{}{}
		ids = append(ids, userId)
	}

	normalizedNames := make([]string, 0, len(usernames))
	seenNames := make(map[string]struct{}, len(usernames))
	for _, username := range usernames {
		username = strings.TrimSpace(username)
		if username == "" {
			continue
		}
		if _, exists := seenNames[username]; exists {
			return nil, errors.New("定向展示策略包含重复用户名")
		}
		seenNames[username] = struct{}{}
		normalizedNames = append(normalizedNames, username)
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
			// IDs are authoritative, but a user may not be supplied twice via
			// the legacy username compatibility field. Reject both an overlap
			// and a mismatch instead of silently broadening the policy.
			for _, userId := range legacyIds {
				if _, exists := seenIds[userId]; exists {
					return nil, errors.New("定向展示策略包含重复用户")
				}
				return nil, errors.New("user_ids 与 legacy usernames 不一致")
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
	if policy.StartTime < 0 || policy.EndTime < 0 {
		return policy, errors.New("开始和结束时间必须为非负 Unix 时间戳")
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
		if len(policy.UserIds) > 0 || len(policy.Usernames) > 0 {
			return policy, errors.New("非 targeted 策略不得携带 user_ids 或 usernames")
		}
		policy.UserIds = nil
	}
	// Legacy names are input-only and must not be echoed back into persisted
	// policy state or used by the runtime authorization path.
	policy.Usernames = nil
	policy.TargetUsers = nil
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
		if err := ensureTokenGroupVisibilityRevisionTx(tx); err != nil {
			return err
		}
		return saveTokenGroupVisibilityPolicyTx(tx, normalized)
	})
}

func ensureTokenGroupVisibilityRevisionTx(tx *gorm.DB) error {
	var revision TokenGroupVisibilityRevision
	err := tx.Where("id = ?", 1).First(&revision).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return tx.Create(&TokenGroupVisibilityRevision{Id: 1, Digest: "", UpdatedAt: time.Now()}).Error
	}
	return err
}

// ReplaceTokenGroupVisibilityPolicies validates the complete desired state
// before changing anything and applies saves and removals in one transaction.
func ReplaceTokenGroupVisibilityPolicies(policies []TokenGroupVisibilityPolicy) error {
	_, err := ReplaceTokenGroupVisibilityPoliciesCAS(policies, "")
	return err
}

// ReplaceTokenGroupVisibilityPoliciesCAS validates and replaces the complete
// policy set atomically. expectedDigest is optional for legacy callers; when
// present it must match the database snapshot read inside the transaction.
func ReplaceTokenGroupVisibilityPoliciesCAS(policies []TokenGroupVisibilityPolicy, expectedDigest string) (string, error) {
	normalized := make([]TokenGroupVisibilityPolicy, 0, len(policies))
	seenGroups := make(map[string]struct{}, len(policies))
	for _, policy := range policies {
		// Every replacement group must still exist in GroupRatio. This keeps
		// stale/orphaned rows from being silently retained by an admin save.
		item, err := normalizeTokenGroupVisibilityPolicy(policy, false)
		if err != nil {
			return "", err
		}
		if _, exists := seenGroups[item.Group]; exists {
			return "", errors.New("令牌分组可见性策略不能包含重复分组")
		}
		seenGroups[item.Group] = struct{}{}
		normalized = append(normalized, item)
	}
	var resultingDigest string
	err := DB.Transaction(func(tx *gorm.DB) error {
		// The singleton revision row is locked for the duration of this
		// transaction. It is created by the explicit schema migration before
		// enforcement; a missing row is a deployment-preparation failure.
		var revision TokenGroupVisibilityRevision
		lockErr := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&revision, 1).Error
		if lockErr != nil {
			return lockErr
		}
		current, err := getTokenGroupVisibilityPoliciesFromDB(tx)
		if err != nil {
			return err
		}
		if expectedDigest != "" && expectedDigest != TokenGroupVisibilityPoliciesDigest(current) {
			return ErrTokenGroupVisibilityConflict
		}
		if revision.Digest == "" {
			if err := tx.Model(&TokenGroupVisibilityRevision{}).Where("id = ?", 1).Update("digest", TokenGroupVisibilityPoliciesDigest(current)).Error; err != nil {
				return err
			}
		}
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
		updated, err := getTokenGroupVisibilityPoliciesFromDB(tx)
		if err != nil {
			return err
		}
		resultingDigest = TokenGroupVisibilityPoliciesDigest(updated)
		if err := tx.Model(&TokenGroupVisibilityRevision{}).Where("id = ?", 1).Updates(map[string]interface{}{"digest": resultingDigest, "updated_at": time.Now()}).Error; err != nil {
			return err
		}
		return nil
	})
	return resultingDigest, err
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
