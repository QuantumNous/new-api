package model

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"gorm.io/gorm"
)

const sensitiveWordBlockMessage = "你的请求因命中敏感词已被拦截，已记录 1 次；累计达到 {{threshold}} 次将立即封号，余额不退，如果有攻击破解别人网站等情节严重的情况将会直接报警。请勿使用当前分组进行违规对话；如有误判，请联系群主审核并清理你的记录。"

func normalizeSensitiveWord(word string) (string, error) {
	word = strings.TrimSpace(word)
	if word == "" {
		return "", errors.New("敏感词不能为空")
	}
	if len([]rune(word)) > SensitiveWordMaxRunes {
		return "", fmt.Errorf("敏感词长度不能超过 %d", SensitiveWordMaxRunes)
	}
	return word, nil
}

func sensitiveWordHash(word string) string {
	hash := sha256.Sum256([]byte(strings.ToLower(strings.TrimSpace(word))))
	return hex.EncodeToString(hash[:])
}

func normalizeSensitiveWords(words []string) ([]string, error) {
	result := make([]string, 0, len(words))
	seen := make(map[string]struct{}, len(words))
	for _, raw := range words {
		word, err := normalizeSensitiveWord(raw)
		if err != nil {
			if strings.TrimSpace(raw) == "" {
				continue
			}
			return nil, err
		}
		key := strings.ToLower(word)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, word)
	}
	if len(result) == 0 {
		return nil, errors.New("敏感词规则至少包含一个有效词条")
	}
	if len(result) > SensitiveWordMaxRules {
		return nil, fmt.Errorf("单条规则最多包含 %d 个敏感词", SensitiveWordMaxRules)
	}
	return result, nil
}

func validSensitiveGroups(groups []string) ([]string, error) {
	available := ratio_setting.GetGroupRatioCopy()
	seen := make(map[string]struct{}, len(groups))
	result := make([]string, 0, len(groups))
	for _, group := range groups {
		group = strings.TrimSpace(group)
		if group == "" {
			continue
		}
		if _, exists := seen[group]; exists {
			continue
		}
		if group == "auto" {
			return nil, errors.New("局部敏感词规则不能绑定自动分组")
		}
		if _, exists := available[group]; !exists {
			return nil, fmt.Errorf("分组 %s 不在分组定价中", group)
		}
		seen[group] = struct{}{}
		result = append(result, group)
	}
	sort.Strings(result)
	return result, nil
}

func defaultSensitiveWordPolicy() SensitiveWordPolicy {
	return SensitiveWordPolicy{
		ID:                      1,
		Enabled:                 true,
		CheckPrompt:             true,
		RetainFullPrompt:        true,
		BlockMessage:            sensitiveWordBlockMessage,
		BanThreshold:            SensitiveWordBanThreshold,
		FullPromptRetentionDays: 180,
		MaxPromptRunes:          SensitiveWordMaxPromptRunes,
		Version:                 1,
	}
}

func normalizeSensitiveWordPolicy(policy SensitiveWordPolicy) SensitiveWordPolicy {
	policy.ID = 1
	if policy.BanThreshold <= 0 || policy.BanThreshold > 1000 {
		policy.BanThreshold = SensitiveWordBanThreshold
	}
	if policy.FullPromptRetentionDays <= 0 || policy.FullPromptRetentionDays > 3650 {
		policy.FullPromptRetentionDays = 180
	}
	if policy.MaxPromptRunes <= 0 || policy.MaxPromptRunes > SensitiveWordMaxPromptRunes {
		policy.MaxPromptRunes = SensitiveWordMaxPromptRunes
	}
	if strings.TrimSpace(policy.BlockMessage) == "" ||
		strings.Contains(policy.BlockMessage, "清空余额") ||
		strings.Contains(policy.BlockMessage, "清零余额") {
		policy.BlockMessage = sensitiveWordBlockMessage
	}
	if policy.Version <= 0 {
		policy.Version = 1
	}
	return policy
}

// GetSensitiveWordPolicyWithError distinguishes an intentionally unavailable
// runtime (before a one-way migration finishes) from an unexpected database
// read error. Relay callers must fail closed for the latter.
func GetSensitiveWordPolicyWithError() (SensitiveWordPolicy, error) {
	policy := defaultSensitiveWordPolicy()
	if sensitiveWordRuntimeUnavailable.Load() || DB == nil {
		policy.Enabled = false
		return policy, nil
	}
	// Slave nodes do not execute migrations. Require the durable marker as
	// well as the new table so a node started while the master is importing
	// legacy rows cannot enforce a partial rule set.
	var marker Option
	markerResult := DB.Select("key", "value").Where(&Option{Key: sensitiveWordMigrationKey}).Limit(1).Find(&marker)
	if markerResult.Error != nil {
		return policy, fmt.Errorf("%w: read migration marker: %v", ErrSensitiveWordPolicyUnavailable, markerResult.Error)
	}
	if markerResult.RowsAffected == 0 || marker.Value != sensitiveWordMigrationValue {
		policy.Enabled = false
		return policy, nil
	}
	var stored SensitiveWordPolicy
	if err := DB.First(&stored, 1).Error; err != nil {
		return policy, fmt.Errorf("%w: read policy: %v", ErrSensitiveWordPolicyUnavailable, err)
	}
	return normalizeSensitiveWordPolicy(stored), nil
}

// GetSensitiveWordPolicy is the non-critical convenience accessor used by UI
// and scheduled work. Request enforcement uses GetSensitiveWordPolicyWithError
// so a database failure becomes a 503 instead of a silent bypass.
func GetSensitiveWordPolicy() SensitiveWordPolicy {
	policy, err := GetSensitiveWordPolicyWithError()
	if err != nil {
		policy.Enabled = false
	}
	return policy
}

func SaveSensitiveWordPolicy(policy SensitiveWordPolicy, actor int) error {
	if DB == nil || !DB.Migrator().HasTable(&SensitiveWordPolicy{}) {
		return errors.New("敏感词策略表不可用，请先完成数据库迁移")
	}
	policy = normalizeSensitiveWordPolicy(policy)
	if err := DB.Transaction(func(tx *gorm.DB) error {
		var current SensitiveWordPolicy
		err := lockForUpdate(tx).First(&current, 1).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			policy.ID = 1
			policy.Version = 1
			policy.UpdatedBy = actor
			return tx.Create(&policy).Error
		}
		if err != nil {
			return err
		}
		// Version is a server-owned generation counter. Accepting a client
		// value here could skip generations or overflow a later rule update.
		policy.Version = current.Version + 1
		return tx.Model(&current).Updates(map[string]any{
			"enabled":                    policy.Enabled,
			"check_prompt":               policy.CheckPrompt,
			"retain_full_prompt":         policy.RetainFullPrompt,
			"block_message":              policy.BlockMessage,
			"ban_threshold":              policy.BanThreshold,
			"full_prompt_retention_days": policy.FullPromptRetentionDays,
			"max_prompt_runes":           policy.MaxPromptRunes,
			"version":                    policy.Version,
			"updated_by":                 actor,
			"updated_at":                 time.Now(),
		}).Error
	}); err != nil {
		return err
	}
	invalidateSensitiveWordRuntime()
	return nil
}

// bumpSensitiveWordPolicyVersion is called in the same transaction as every
// rule mutation. Other nodes read the policy on each request and rebuild their
// local automaton when this durable generation changes.
func bumpSensitiveWordPolicyVersion(tx *gorm.DB, actor int) error {
	if tx == nil {
		return errors.New("敏感词策略事务不可用")
	}
	result := tx.Model(&SensitiveWordPolicy{}).Where("id = ?", 1).Updates(map[string]any{
		"version":    gorm.Expr("version + ?", 1),
		"updated_by": actor,
		"updated_at": time.Now(),
	})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func normalizeSensitiveWordRuleMode(mode string) string {
	switch normalized := strings.ToLower(strings.TrimSpace(mode)); normalized {
	case SensitiveWordModeBlock, SensitiveWordModeObserve, SensitiveWordModeOff:
		return normalized
	default:
		return SensitiveWordModeOff
	}
}

func migrateSensitiveWordRuleMode(mode string, enabled bool) string {
	if strings.TrimSpace(mode) == "" {
		if enabled {
			return SensitiveWordModeBlock
		}
		return SensitiveWordModeOff
	}
	return normalizeSensitiveWordRuleMode(mode)
}

func ruleWords(rule SensitiveWordRule) []string {
	words := make([]string, 0, len(rule.Words))
	seen := make(map[string]struct{}, len(rule.Words))
	for _, item := range rule.Words {
		word := strings.TrimSpace(item.Word)
		if word == "" {
			continue
		}
		key := strings.ToLower(word)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		words = append(words, word)
	}
	return words
}

func buildSensitiveWordRuleSummaryWithCount(rule SensitiveWordRule, wordCount int) SensitiveWordRuleSummary {
	groups := make([]string, 0, len(rule.Groups))
	for _, item := range rule.Groups {
		groups = append(groups, item.GroupName)
	}
	sort.Strings(groups)
	return SensitiveWordRuleSummary{
		ID: rule.ID, Name: rule.Name, Scope: rule.Scope,
		Mode: normalizeSensitiveWordRuleMode(rule.Mode), Groups: groups,
		WordCount: wordCount, CreatedBy: rule.CreatedBy, Version: rule.Version,
		CreatedAt: rule.CreatedAt, UpdatedAt: rule.UpdatedAt,
	}
}

func buildSensitiveWordRuleSummary(rule SensitiveWordRule) SensitiveWordRuleSummary {
	return buildSensitiveWordRuleSummaryWithCount(rule, len(ruleWords(rule)))
}

func ListSensitiveWordRules() ([]SensitiveWordRuleSummary, error) {
	var rules []SensitiveWordRule
	if err := DB.Preload("Groups").Order("id desc").Find(&rules).Error; err != nil {
		return nil, err
	}
	ruleIDs := make([]int64, 0, len(rules))
	for _, rule := range rules {
		ruleIDs = append(ruleIDs, rule.ID)
	}
	countsByRule := make(map[int64]int, len(ruleIDs))
	if len(ruleIDs) > 0 {
		var counts []struct {
			RuleID    int64 `gorm:"column:rule_id"`
			WordCount int   `gorm:"column:word_count"`
		}
		if err := DB.Model(&SensitiveWordRuleWord{}).
			Select("rule_id, COUNT(*) AS word_count").
			Where("rule_id IN ?", ruleIDs).
			Group("rule_id").Scan(&counts).Error; err != nil {
			return nil, err
		}
		for _, count := range counts {
			countsByRule[count.RuleID] = count.WordCount
		}
	}
	result := make([]SensitiveWordRuleSummary, 0, len(rules))
	for _, rule := range rules {
		result = append(result, buildSensitiveWordRuleSummaryWithCount(rule, countsByRule[rule.ID]))
	}
	return result, nil
}

func GetSensitiveWordRuleDetail(id int64) (*SensitiveWordRuleDetail, error) {
	var rule SensitiveWordRule
	if err := DB.Preload("Groups").Preload("Words").First(&rule, id).Error; err != nil {
		return nil, err
	}
	return &SensitiveWordRuleDetail{
		SensitiveWordRuleSummary: buildSensitiveWordRuleSummary(rule),
		Words:                    ruleWords(rule),
	}, nil
}

func UpsertSensitiveWordRuleWithMode(id int64, name string, words []string, scope string, groups []string, actor int, mode string) (*SensitiveWordRuleDetail, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("规则名称不能为空")
	}
	if len([]rune(name)) > 64 {
		return nil, errors.New("规则名称不能超过 64 个字符")
	}
	words, err := normalizeSensitiveWords(words)
	if err != nil {
		return nil, err
	}
	if len(words) == 0 {
		return nil, errors.New("规则至少包含一个敏感词")
	}
	if scope != SensitiveWordScopeGlobal && scope != SensitiveWordScopeGroup {
		return nil, errors.New("规则范围无效")
	}
	groups, err = validSensitiveGroups(groups)
	if err != nil {
		return nil, err
	}
	if scope == SensitiveWordScopeGlobal {
		groups = nil
	} else if len(groups) == 0 {
		return nil, errors.New("局部规则至少选择一个分组")
	}
	mode = strings.ToLower(strings.TrimSpace(mode))
	if mode != SensitiveWordModeBlock && mode != SensitiveWordModeObserve && mode != SensitiveWordModeOff {
		return nil, errors.New("规则处理模式无效")
	}

	var rule SensitiveWordRule
	err = DB.Transaction(func(tx *gorm.DB) error {
		if id > 0 {
			if err := tx.First(&rule, id).Error; err != nil {
				return err
			}
			rule.Version++
		} else {
			rule = SensitiveWordRule{CreatedBy: actor, Version: 1}
		}
		rule.Name = name
		rule.Word = words[0]
		rule.Scope = scope
		rule.Mode = mode
		rule.Enabled = mode != SensitiveWordModeOff
		rule.UpdatedAt = time.Now()
		if err := tx.Save(&rule).Error; err != nil {
			return err
		}
		if err := tx.Where("rule_id = ?", rule.ID).Delete(&SensitiveWordRuleGroup{}).Error; err != nil {
			return err
		}
		for _, group := range groups {
			if err := tx.Create(&SensitiveWordRuleGroup{RuleID: rule.ID, GroupName: group}).Error; err != nil {
				return err
			}
		}
		if err := tx.Where("rule_id = ?", rule.ID).Delete(&SensitiveWordRuleWord{}).Error; err != nil {
			return err
		}
		for _, word := range words {
			item := SensitiveWordRuleWord{
				RuleID: rule.ID, Word: word,
				NormalizedHash: sensitiveWordHash(word), CreatedAt: time.Now(),
			}
			if err := tx.Create(&item).Error; err != nil {
				return err
			}
		}
		return bumpSensitiveWordPolicyVersion(tx, actor)
	})
	if err != nil {
		return nil, err
	}
	invalidateSensitiveWordRuntime()
	return GetSensitiveWordRuleDetail(rule.ID)
}

func SetSensitiveWordRuleMode(id int64, mode string, actor int) error {
	mode = strings.ToLower(strings.TrimSpace(mode))
	if mode != SensitiveWordModeBlock && mode != SensitiveWordModeObserve && mode != SensitiveWordModeOff {
		return errors.New("规则处理模式无效")
	}
	if err := DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&SensitiveWordRule{}).Where("id = ?", id).Updates(map[string]any{
			"mode": mode, "enabled": mode != SensitiveWordModeOff,
			"version": gorm.Expr("version + ?", 1),
		})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return bumpSensitiveWordPolicyVersion(tx, actor)
	}); err != nil {
		return err
	}
	invalidateSensitiveWordRuntime()
	return nil
}

func DeleteSensitiveWordRule(id int64, actor int) error {
	if id <= 0 {
		return errors.New("规则 ID 无效")
	}
	if err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("rule_id = ?", id).Delete(&SensitiveWordRuleWord{}).Error; err != nil {
			return err
		}
		if err := tx.Where("rule_id = ?", id).Delete(&SensitiveWordRuleGroup{}).Error; err != nil {
			return err
		}
		result := tx.Delete(&SensitiveWordRule{}, id)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return bumpSensitiveWordPolicyVersion(tx, actor)
	}); err != nil {
		return err
	}
	invalidateSensitiveWordRuntime()
	return nil
}

func ListSensitiveWordGroups() []string {
	groups := ratio_setting.GetGroupRatioCopy()
	result := make([]string, 0, len(groups))
	for group := range groups {
		if group != "auto" {
			result = append(result, group)
		}
	}
	sort.Strings(result)
	return result
}
