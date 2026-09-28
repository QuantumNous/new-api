package model

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

func expandSensitiveWordMessage(message string, threshold int) string {
	message = strings.TrimSpace(message)
	if message == "" {
		message = sensitiveWordBlockMessage
	}
	return strings.ReplaceAll(message, "{{threshold}}", fmt.Sprintf("%d", threshold))
}

func decodeSensitiveAuditSlice[T any](value string) []T {
	var result []T
	if value != "" {
		_ = common.UnmarshalJsonStr(value, &result)
	}
	return result
}

func sensitiveCheckResultFromAudit(event SensitiveWordAuditEvent) *SensitiveCheckResult {
	policy := GetSensitiveWordPolicy()
	return &SensitiveCheckResult{
		Matched: true, Blocked: event.Blocked,
		WhitelistBypassed: event.WhitelistBypassed,
		AutoBanned:        event.AutoBanned, ViolationCount: event.ViolationCount,
		MatchedWords:     decodeSensitiveAuditSlice[string](event.MatchedWords),
		MatchedRuleIDs:   decodeSensitiveAuditSlice[int64](event.MatchedRuleIDs),
		MatchedRuleNames: decodeSensitiveAuditSlice[string](event.MatchedRuleNames),
		MatchedScope:     event.MatchedScope, AuditID: event.ID,
		Message:          expandSensitiveWordMessage(policy.BlockMessage, policy.BanThreshold),
		UserStatusBefore: event.UserStatusBefore, UserStatusAfter: event.UserStatusAfter,
		QuotaBefore: event.QuotaBefore, QuotaAfter: event.QuotaAfter,
		ObserveOnly: event.ObserveOnly,
	}
}

func CheckSensitiveRequest(input SensitiveCheckInput) (*SensitiveCheckResult, error) {
	return CheckSensitiveRequestForGroups(input, []string{input.GroupName})
}

// CheckSensitiveRequestForGroups makes exactly one policy decision before any
// token estimate, reservation, channel selection, or upstream request.
func CheckSensitiveRequestForGroups(input SensitiveCheckInput, candidateGroups []string) (*SensitiveCheckResult, error) {
	if strings.TrimSpace(input.RequestID) == "" {
		input.RequestID = common.NewRequestId()
	}
	policy, err := GetSensitiveWordPolicyWithError()
	if err != nil {
		return nil, err
	}
	input.Prompt = normalizeSensitivePrompt(input.Prompt)
	if !policy.Enabled || !policy.CheckPrompt || input.Prompt == "" {
		return &SensitiveCheckResult{}, nil
	}
	rules, words, matchedGroup, err := matchSensitiveRulesForGroups(
		input.Prompt, candidateGroups, input.GroupName, policy.Version,
	)
	if err != nil {
		return nil, err
	}
	if len(rules) == 0 {
		return &SensitiveCheckResult{}, nil
	}
	if matchedGroup != "" {
		input.GroupName = matchedGroup
	}

	ids := make([]int64, 0, len(rules))
	names := make([]string, 0, len(rules))
	modes := make([]string, 0, len(rules))
	seenIDs := make(map[int64]struct{}, len(rules))
	seenModes := make(map[string]struct{}, len(rules))
	scopes := make(map[string]bool, 2)
	blockingRule := false
	ruleVersion := int64(1)
	for _, rule := range rules {
		if _, exists := seenIDs[rule.ID]; !exists {
			seenIDs[rule.ID] = struct{}{}
			ids = append(ids, rule.ID)
			if rule.Name != "" {
				names = append(names, rule.Name)
			}
		}
		scopes[rule.Scope] = true
		mode := normalizeSensitiveWordRuleMode(rule.Mode)
		blockingRule = blockingRule || mode == SensitiveWordModeBlock
		if _, exists := seenModes[mode]; !exists {
			seenModes[mode] = struct{}{}
			modes = append(modes, mode)
		}
		if rule.Version > ruleVersion {
			ruleVersion = rule.Version
		}
	}
	matchedScope := SensitiveWordScopeGlobal
	if !scopes[SensitiveWordScopeGlobal] {
		matchedScope = SensitiveWordScopeGroup
	} else if scopes[SensitiveWordScopeGroup] {
		matchedScope = "global+group"
	}
	observeOnly := !blockingRule
	result := &SensitiveCheckResult{
		Matched: true, ObserveOnly: observeOnly,
		MatchedWords: words, MatchedRuleIDs: ids, MatchedRuleNames: names,
		MatchedScope:     matchedScope,
		Message:          expandSensitiveWordMessage(policy.BlockMessage, policy.BanThreshold),
		MatchedRuleModes: modes,
	}

	var event SensitiveWordAuditEvent
	var existingEvent *SensitiveWordAuditEvent
	err = DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := lockForUpdate(tx).First(&user, input.UserID).Error; err != nil {
			return err
		}
		var prior SensitiveWordAuditEvent
		if err := tx.Where("request_id = ? AND user_id = ?", input.RequestID, input.UserID).
			Order("id asc").First(&prior).Error; err == nil {
			existingEvent = &prior
			return nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		result.UserStatusBefore = user.Status
		result.UserStatusAfter = user.Status
		result.QuotaBefore = user.Quota
		result.QuotaAfter = user.Quota
		result.WhitelistBypassed = user.SensitiveWordWhitelist
		result.Blocked = !user.SensitiveWordWhitelist && !observeOnly
		if result.Blocked {
			result.ViolationCount = user.SensitiveWordViolationCount + 1
			updates := map[string]any{
				"sensitive_word_violation_count": result.ViolationCount,
			}
			result.AutoBanned = result.ViolationCount >= policy.BanThreshold &&
				user.Role != common.RoleRootUser && user.Status != common.UserStatusDisabled
			if result.AutoBanned {
				nextVersion, err := IncrementUserAuthVersionWithTx(tx, input.UserID)
				if err != nil {
					return err
				}
				updates["status"] = common.UserStatusDisabled
				updates["auth_version"] = nextVersion
				result.UserStatusAfter = common.UserStatusDisabled
			}
			if err := tx.Model(&User{}).Where("id = ?", input.UserID).Updates(updates).Error; err != nil {
				return err
			}
		} else {
			result.ViolationCount = user.SensitiveWordViolationCount
		}

		preview, fullPrompt := "", ""
		snippets := make([]string, 0)
		if policy.RetainFullPrompt {
			preview = redactedSensitivePreview(input.Prompt)
			fullPrompt = truncateSensitivePrompt(input.Prompt, policy.MaxPromptRunes)
			snippets = sensitiveMatchSnippets(input.Prompt, words)
		}
		idsRaw, err := common.Marshal(ids)
		if err != nil {
			return fmt.Errorf("%w: %v", ErrSensitiveWordAuditPersistence, err)
		}
		namesRaw, err := common.Marshal(names)
		if err != nil {
			return fmt.Errorf("%w: %v", ErrSensitiveWordAuditPersistence, err)
		}
		wordsRaw, err := common.Marshal(words)
		if err != nil {
			return fmt.Errorf("%w: %v", ErrSensitiveWordAuditPersistence, err)
		}
		snippetsRaw, err := common.Marshal(snippets)
		if err != nil {
			return fmt.Errorf("%w: %v", ErrSensitiveWordAuditPersistence, err)
		}
		hash := sha256.Sum256([]byte(input.Prompt))
		event = SensitiveWordAuditEvent{
			RequestID: input.RequestID, UserID: input.UserID,
			UsernameSnapshot: input.Username, TokenID: input.TokenID,
			TokenNameSnapshot: input.TokenName, GroupName: input.GroupName,
			ModelName: input.ModelName, Endpoint: input.Endpoint, Protocol: input.Protocol,
			PromptHash: hex.EncodeToString(hash[:]), RedactedPreview: preview,
			FullPrompt:     SensitiveWordAuditPrompt(fullPrompt),
			MatchedRuleIDs: string(idsRaw), MatchedRuleNames: string(namesRaw),
			MatchedWords: string(wordsRaw), MatchedSnippets: string(snippetsRaw),
			MatchedScope: matchedScope, WhitelistBypassed: user.SensitiveWordWhitelist,
			Blocked: result.Blocked, ViolationCount: result.ViolationCount,
			AutoBanned: result.AutoBanned, ObserveOnly: observeOnly,
			UserStatusBefore: result.UserStatusBefore, UserStatusAfter: result.UserStatusAfter,
			QuotaBefore: result.QuotaBefore, QuotaAfter: result.QuotaAfter,
			RuleVersion: ruleVersion, CreatedAt: time.Now(),
		}
		if err := tx.Create(&event).Error; err != nil {
			return fmt.Errorf("%w: %v", ErrSensitiveWordAuditPersistence, err)
		}
		return nil
	})
	if err != nil {
		result.Blocked = false
		result.AutoBanned = false
		result.ViolationCount = 0
		return result, err
	}
	if existingEvent != nil {
		existing := sensitiveCheckResultFromAudit(*existingEvent)
		if existing.AutoBanned {
			refreshSensitiveWordAuthState(input.UserID, "sensitive_word_threshold")
		}
		return existing, nil
	}

	result.AuditID = event.ID
	if result.AutoBanned {
		refreshSensitiveWordAuthState(input.UserID, "sensitive_word_threshold")
	}
	writeSensitiveWordUsageLog(input, event, result, ids, names, words, modes, ruleVersion)
	return result, nil
}

func refreshSensitiveWordAuthState(userID int, reason string) int64 {
	if err := PublishUserAuthCache(userID); err != nil {
		common.SysLog(fmt.Sprintf("failed to publish sensitive-word auth cache for user %d: %s", userID, err.Error()))
	}
	revoked, err := RevokeAllUserSessions(userID, reason)
	if err != nil {
		common.SysLog(fmt.Sprintf("failed to revoke sensitive-word sessions for user %d: %s", userID, err.Error()))
	}
	if err := InvalidateUserTokensCache(userID); err != nil {
		common.SysLog(fmt.Sprintf("failed to invalidate sensitive-word token cache for user %d: %s", userID, err.Error()))
	}
	return revoked
}

func writeSensitiveWordUsageLog(input SensitiveCheckInput, event SensitiveWordAuditEvent, result *SensitiveCheckResult, ids []int64, names, words, modes []string, ruleVersion int64) {
	action := "blocked"
	if result.WhitelistBypassed {
		action = "whitelist_bypass"
	} else if result.ObserveOnly {
		action = "observe"
	}
	keywordFilter := map[string]any{
		"audit_id": event.ID, "action": action, "request_id": input.RequestID,
		"rule_ids": ids, "rule_names": names, "matched_words": words,
		"scope": result.MatchedScope, "group": input.GroupName, "model": input.ModelName,
		"endpoint": input.Endpoint, "protocol": input.Protocol,
		"violation_count":    result.ViolationCount,
		"whitelist_bypassed": result.WhitelistBypassed, "blocked": result.Blocked,
		"auto_banned": result.AutoBanned, "observe_only": result.ObserveOnly,
		"user_status_before": result.UserStatusBefore, "user_status_after": result.UserStatusAfter,
		"balance_changed": false, "prompt_hash": event.PromptHash,
		"rule_version": ruleVersion, "rule_modes": modes,
	}
	other := NewLogOther()
	other.SetPublic("action", SensitiveWordLogAction)
	other.SetAdmin("keyword_filter", keywordFilter)
	log := &Log{
		UserId: input.UserID, Username: input.Username, CreatedAt: common.GetTimestamp(),
		Type: LogTypeSensitiveWordBlock, Content: "关键词审计记录", TokenId: input.TokenID,
		TokenName: input.TokenName, ModelName: input.ModelName, Group: input.GroupName,
		RequestId: input.RequestID, Other: other.JSONString(),
	}
	if err := createLog(log); err != nil {
		common.SysLog("failed to record sensitive-word usage log: " + err.Error())
	}
}

// CleanupSensitiveWordAudits clears full-prompt evidence after the configured
// retention period while preserving the audit event and its enforcement facts.
func CleanupSensitiveWordAudits() (int64, error) {
	policy, err := GetSensitiveWordPolicyWithError()
	if err != nil {
		return 0, err
	}
	if policy.FullPromptRetentionDays <= 0 {
		return 0, nil
	}
	cutoff := time.Now().AddDate(0, 0, -policy.FullPromptRetentionDays)
	result := DB.Model(&SensitiveWordAuditEvent{}).
		Where("created_at < ? AND (full_prompt <> '' OR redacted_preview <> '' OR matched_snippets <> ?)", cutoff, "[]").
		Updates(map[string]any{"full_prompt": "", "redacted_preview": "", "matched_snippets": "[]"})
	return result.RowsAffected, result.Error
}

func truncateSensitivePrompt(value string, maxRunes int) string {
	value = strings.ReplaceAll(value, "\x00", "")
	runes := []rune(strings.TrimSpace(value))
	if maxRunes <= 0 {
		maxRunes = SensitiveWordMaxPromptRunes
	}
	truncated := len(runes) > maxRunes
	if truncated {
		runes = runes[:maxRunes]
	}
	value = string(runes)
	marker := "…"
	byteLimit := SensitiveWordMaxPromptBytes - len(marker)
	if len(value) > byteLimit {
		value = trimSensitivePromptBytes(value, byteLimit)
		truncated = true
	}
	if truncated {
		return value + marker
	}
	return value
}

func trimSensitivePromptBytes(value string, maxBytes int) string {
	if maxBytes <= 0 {
		return ""
	}
	if len(value) <= maxBytes {
		return value
	}
	value = value[:maxBytes]
	for len(value) > 0 && !utf8.ValidString(value) {
		value = value[:len(value)-1]
	}
	return value
}

// EnableUserAndResetSensitiveWordViolations is the only unban path owned by
// this feature. It never touches quota, usage, subscriptions, wallets, or
// historical audit rows.
func EnableUserAndResetSensitiveWordViolations(userID int) (*SensitiveWordEnableResetResult, error) {
	if userID <= 0 {
		return nil, errors.New("用户 ID 无效")
	}
	result := &SensitiveWordEnableResetResult{UserID: userID}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var current User
		if err := lockForUpdate(tx).First(&current, userID).Error; err != nil {
			return err
		}
		result.StatusBefore = current.Status
		result.StatusAfter = common.UserStatusEnabled
		result.ViolationCountBefore = current.SensitiveWordViolationCount
		result.ViolationCountAfter = 0
		result.AuthVersionBefore = current.AuthVersion
		result.AuthVersionAfter = current.AuthVersion
		result.QuotaBefore = current.Quota
		result.QuotaAfter = current.Quota
		result.UsedQuotaBefore = current.UsedQuota
		result.UsedQuotaAfter = current.UsedQuota
		result.StatusChanged = current.Status != common.UserStatusEnabled
		result.ViolationCountReset = current.SensitiveWordViolationCount != 0

		updates := map[string]any{
			"status": common.UserStatusEnabled, "sensitive_word_violation_count": 0,
		}
		if result.StatusChanged {
			nextVersion, err := IncrementUserAuthVersionWithTx(tx, userID)
			if err != nil {
				return err
			}
			result.AuthVersionAfter = nextVersion
			updates["auth_version"] = nextVersion
		}
		if result.StatusChanged || result.ViolationCountReset {
			return tx.Model(&User{}).Where("id = ?", userID).Updates(updates).Error
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if result.StatusChanged {
		// The state transition is already committed. Attempt every cache and
		// session invalidation so a transient transport failure cannot prevent
		// later invalidation work or misreport the persisted outcome to the
		// administrator.
		result.SessionsRevoked = refreshSensitiveWordAuthState(userID, "sensitive_word_enable")
	}
	return result, nil
}

// UpdateSensitiveWordUserFields applies only fields explicitly supplied by an
// administrator. Keeping this separate from User.EditWithTx prevents ordinary
// profile edits from writing Go zero values over the safety state.
func UpdateSensitiveWordUserFields(userID int, violationCount *int, whitelist *bool) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		return UpdateSensitiveWordUserFieldsWithTx(tx, userID, violationCount, whitelist)
	})
}

// UpdateSensitiveWordUserFieldsWithTx keeps an administrative user edit and
// safety-state edit atomic when the caller already owns a transaction.
func UpdateSensitiveWordUserFieldsWithTx(tx *gorm.DB, userID int, violationCount *int, whitelist *bool) error {
	if violationCount == nil && whitelist == nil {
		return nil
	}
	if violationCount != nil && *violationCount < 0 {
		return errors.New("敏感词违规次数不能为负数")
	}
	var current User
	if err := lockForUpdate(tx).First(&current, userID).Error; err != nil {
		return err
	}
	updates := make(map[string]any, 2)
	if violationCount != nil {
		updates["sensitive_word_violation_count"] = *violationCount
	}
	if whitelist != nil {
		updates["sensitive_word_whitelist"] = *whitelist
	}
	return tx.Model(&current).Updates(updates).Error
}
