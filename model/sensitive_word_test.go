package model

import (
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// legacySensitiveWordV1* mirror the first P-30 tables, before rule names,
// modes, rule-word rows, user columns, and the policy singleton existed.
type legacySensitiveWordV1Rule struct {
	ID        int64     `gorm:"primaryKey"`
	Word      string    `gorm:"type:varchar(200);not null;index"`
	Scope     string    `gorm:"type:varchar(16);not null;index"`
	Enabled   bool      `gorm:"not null;default:true;index"`
	CreatedBy int       `gorm:"index"`
	Version   int64     `gorm:"not null;default:1"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

func (legacySensitiveWordV1Rule) TableName() string { return "sensitive_word_rules" }

type legacySensitiveWordV1Audit struct {
	ID              int64     `gorm:"primaryKey"`
	RequestID       string    `gorm:"type:varchar(128);index"`
	UserID          int       `gorm:"index"`
	FullPrompt      string    `gorm:"type:text"`
	MatchedRuleIDs  string    `gorm:"type:text"`
	MatchedWords    string    `gorm:"type:text"`
	MatchedSnippets string    `gorm:"type:text"`
	CreatedAt       time.Time `gorm:"index"`
}

func (legacySensitiveWordV1Audit) TableName() string {
	return "sensitive_word_audit_events"
}

func setupSensitiveWordTest(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(
		&Option{}, &User{}, &UserSession{}, &Log{},
		&SensitiveWordRule{}, &SensitiveWordRuleWord{}, &SensitiveWordRuleGroup{},
		&SensitiveWordPolicy{}, &SensitiveWordAuditEvent{},
	))
	require.NoError(t, DB.Exec("DELETE FROM sensitive_word_audit_events").Error)
	require.NoError(t, DB.Exec("DELETE FROM sensitive_word_rule_words").Error)
	require.NoError(t, DB.Exec("DELETE FROM sensitive_word_rule_groups").Error)
	require.NoError(t, DB.Exec("DELETE FROM sensitive_word_rules").Error)
	require.NoError(t, DB.Exec("DELETE FROM sensitive_word_policy").Error)
	require.NoError(t, DB.Where("key IN ?", []string{
		"SensitiveWords", "SensitiveWordConfig", sensitiveWordMigrationKey,
	}).Delete(&Option{}).Error)
	require.NoError(t, LOG_DB.Where("type = ?", LogTypeSensitiveWordBlock).Delete(&Log{}).Error)
	invalidateSensitiveWordRuntime()

	t.Cleanup(func() {
		_ = DB.Exec("DELETE FROM sensitive_word_audit_events").Error
		_ = DB.Exec("DELETE FROM sensitive_word_rule_words").Error
		_ = DB.Exec("DELETE FROM sensitive_word_rule_groups").Error
		_ = DB.Exec("DELETE FROM sensitive_word_rules").Error
		_ = DB.Exec("DELETE FROM sensitive_word_policy").Error
		_ = DB.Where("key IN ?", []string{
			"SensitiveWords", "SensitiveWordConfig", sensitiveWordMigrationKey,
		}).Delete(&Option{}).Error
		_ = LOG_DB.Where("type = ?", LogTypeSensitiveWordBlock).Delete(&Log{}).Error
		invalidateSensitiveWordRuntime()
	})
}

func saveSensitiveWordTestPolicy(t *testing.T, retain bool, threshold int) {
	t.Helper()
	require.NoError(t, SaveSensitiveWordPolicy(SensitiveWordPolicy{
		Enabled: true, CheckPrompt: true, RetainFullPrompt: retain,
		BlockMessage: sensitiveWordBlockMessage, BanThreshold: threshold,
		FullPromptRetentionDays: 180, MaxPromptRunes: SensitiveWordMaxPromptRunes,
	}, 1))
}

func createSensitiveWordTestUser(t *testing.T, quota int, whitelisted bool) *User {
	t.Helper()
	id := time.Now().UnixNano()
	user := &User{
		Username: fmt.Sprintf("sensitive-test-%d", id), Password: "unused-password",
		Status: common.UserStatusEnabled, Role: common.RoleCommonUser,
		Group: "default", Quota: quota, AffCode: fmt.Sprintf("sw-%d", id),
		AuthVersion: 1, SensitiveWordWhitelist: whitelisted,
	}
	require.NoError(t, DB.Create(user).Error)
	t.Cleanup(func() {
		_ = DB.Where("user_id = ?", user.Id).Delete(&UserSession{}).Error
		_ = DB.Delete(&User{}, user.Id).Error
	})
	return user
}

func addSensitiveWordTestRule(t *testing.T, name string, words []string, scope string, groups []string, mode string) *SensitiveWordRuleDetail {
	t.Helper()
	detail, err := UpsertSensitiveWordRuleWithMode(0, name, words, scope, groups, 1, mode)
	require.NoError(t, err)
	return detail
}

func sensitiveWordTestInput(user *User, requestID, prompt string) SensitiveCheckInput {
	return SensitiveCheckInput{
		RequestID: requestID, UserID: user.Id, Username: user.Username,
		TokenID: 99, TokenName: "sensitive-test-key", GroupName: "default",
		ModelName: "gpt-test", Endpoint: "/v1/chat/completions",
		Protocol: "openai", Prompt: prompt,
	}
}

func sensitiveWordTestAudit(t *testing.T, requestID string) SensitiveWordAuditEvent {
	t.Helper()
	var event SensitiveWordAuditEvent
	require.NoError(t, DB.Where("request_id = ?", requestID).First(&event).Error)
	return event
}

func TestSensitiveWordValidationAndDefaults(t *testing.T) {
	setupSensitiveWordTest(t)
	require.NoError(t, MigrateSensitiveWordData())
	policy := GetSensitiveWordPolicy()
	require.True(t, policy.Enabled)
	require.True(t, policy.CheckPrompt)
	require.True(t, policy.RetainFullPrompt)
	require.Equal(t, 50, policy.BanThreshold)
	require.Equal(t, 180, policy.FullPromptRetentionDays)
	require.Equal(t, 65_536, policy.MaxPromptRunes)

	words, err := normalizeSensitiveWords([]string{" Alpha ", "alpha", "Beta"})
	require.NoError(t, err)
	require.Equal(t, []string{"Alpha", "Beta"}, words)
	_, err = normalizeSensitiveWords([]string{strings.Repeat("x", SensitiveWordMaxRunes+1)})
	require.Error(t, err)
	_, err = UpsertSensitiveWordRuleWithMode(0, "empty", nil, SensitiveWordScopeGlobal, nil, 1, SensitiveWordModeBlock)
	require.Error(t, err)
	_, err = UpsertSensitiveWordRuleWithMode(0, "bad", []string{"word"}, "bad-scope", nil, 1, SensitiveWordModeBlock)
	require.Error(t, err)
	_, err = UpsertSensitiveWordRuleWithMode(0, "bad", []string{"word"}, SensitiveWordScopeGroup, []string{"auto"}, 1, SensitiveWordModeBlock)
	require.Error(t, err)
	_, err = UpsertSensitiveWordRuleWithMode(0, "bad", []string{"word"}, SensitiveWordScopeGlobal, nil, 1, "invalid")
	require.Error(t, err)

	detail := addSensitiveWordTestRule(t, "default observe", []string{"word"}, SensitiveWordScopeGlobal, nil, SensitiveWordModeObserve)
	require.Equal(t, SensitiveWordModeObserve, detail.Mode)
	require.Equal(t, 1, detail.WordCount)
}

func TestSensitiveWordPolicyVersionIsServerOwned(t *testing.T) {
	setupSensitiveWordTest(t)
	require.NoError(t, MigrateSensitiveWordData())
	before := GetSensitiveWordPolicy()
	updated := before
	updated.Version = 9_999_999
	updated.BanThreshold = before.BanThreshold + 1

	require.NoError(t, SaveSensitiveWordPolicy(updated, 42))
	after := GetSensitiveWordPolicy()
	require.Equal(t, before.Version+1, after.Version)
	require.Equal(t, before.BanThreshold+1, after.BanThreshold)
}

func TestSensitiveWordPolicyReadFailureIsNotSilentlyDisabled(t *testing.T) {
	previousDB, previousLogDB := DB, LOG_DB
	previousMain, previousLog := common.MainDatabaseType(), common.LogDatabaseType()
	previousUnavailable := sensitiveWordRuntimeUnavailable.Load()
	t.Cleanup(func() {
		DB, LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(previousMain, previousLog)
		setSensitiveWordRuntimeUnavailable(previousUnavailable)
	})

	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/closed-policy.db"), &gorm.Config{})
	require.NoError(t, err)
	DB, LOG_DB = db, db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	setSensitiveWordRuntimeUnavailable(false)
	require.NoError(t, db.AutoMigrate(&Option{}, &SensitiveWordPolicy{}))
	require.NoError(t, db.Create(&Option{Key: sensitiveWordMigrationKey, Value: sensitiveWordMigrationValue}).Error)
	policy := defaultSensitiveWordPolicy()
	require.NoError(t, db.Create(&policy).Error)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, sqlDB.Close())

	_, err = GetSensitiveWordPolicyWithError()
	require.ErrorIs(t, err, ErrSensitiveWordPolicyUnavailable)
}

func TestSensitiveWordRuleModePriorityGroupsAndHotReload(t *testing.T) {
	setupSensitiveWordTest(t)
	require.NoError(t, MigrateSensitiveWordData())
	saveSensitiveWordTestPolicy(t, true, SensitiveWordBanThreshold)
	user := createSensitiveWordTestUser(t, 7_310_000, false)

	result, err := CheckSensitiveRequest(sensitiveWordTestInput(user, "before-rule", "hot marker"))
	require.NoError(t, err)
	require.False(t, result.Matched)
	observe := addSensitiveWordTestRule(t, "observe", []string{"hot marker"}, SensitiveWordScopeGlobal, nil, SensitiveWordModeObserve)
	groupBlock := addSensitiveWordTestRule(t, "vip block", []string{"hot marker"}, SensitiveWordScopeGroup, []string{"vip"}, SensitiveWordModeBlock)

	result, err = CheckSensitiveRequestForGroups(
		sensitiveWordTestInput(user, "observe-default", "HOT MARKER"), []string{"default"},
	)
	require.NoError(t, err)
	require.True(t, result.Matched)
	require.True(t, result.ObserveOnly)
	require.False(t, result.Blocked)
	require.Equal(t, 0, result.ViolationCount)
	require.Equal(t, []int64{observe.ID}, result.MatchedRuleIDs)

	result, err = CheckSensitiveRequestForGroups(
		sensitiveWordTestInput(user, "block-vip", "hot marker"), []string{"default", "vip", "vip"},
	)
	require.NoError(t, err)
	require.True(t, result.Blocked, "block must win when block and observe rules both match")
	require.False(t, result.ObserveOnly)
	require.Equal(t, 1, result.ViolationCount, "one request must increment only once")
	require.ElementsMatch(t, []int64{observe.ID, groupBlock.ID}, result.MatchedRuleIDs)
	require.Equal(t, "vip", sensitiveWordTestAudit(t, "block-vip").GroupName)

	require.NoError(t, SetSensitiveWordRuleMode(groupBlock.ID, SensitiveWordModeOff, 1))
	result, err = CheckSensitiveRequestForGroups(
		sensitiveWordTestInput(user, "after-mode-hot-reload", "hot marker"), []string{"vip"},
	)
	require.NoError(t, err)
	require.True(t, result.ObserveOnly)
	require.False(t, result.Blocked)
	require.Equal(t, 1, result.ViolationCount)
	require.NotContains(t, ListSensitiveWordGroups(), "auto")
}

func TestSensitiveWordPolicyVersionRefreshesRemoteRuntime(t *testing.T) {
	setupSensitiveWordTest(t)
	require.NoError(t, MigrateSensitiveWordData())
	saveSensitiveWordTestPolicy(t, false, SensitiveWordBanThreshold)
	user := createSensitiveWordTestUser(t, 7_420_000, false)
	rule := addSensitiveWordTestRule(t, "remote refresh", []string{"remote runtime marker"}, SensitiveWordScopeGlobal, nil, SensitiveWordModeObserve)

	result, err := CheckSensitiveRequest(sensitiveWordTestInput(user, "remote-observe", "remote runtime marker"))
	require.NoError(t, err)
	require.True(t, result.ObserveOnly)
	sensitiveRuntime.RLock()
	before := sensitiveRuntime.snapshot
	sensitiveRuntime.RUnlock()
	require.NotNil(t, before)

	// Simulate a successful rule mutation on another node: it changes durable
	// rows and the policy generation, but cannot clear this process's snapshot.
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&SensitiveWordRule{}).Where("id = ?", rule.ID).Updates(map[string]any{
			"mode": SensitiveWordModeBlock, "version": gorm.Expr("version + ?", 1),
		}).Error; err != nil {
			return err
		}
		return bumpSensitiveWordPolicyVersion(tx, 7)
	}))
	require.Greater(t, GetSensitiveWordPolicy().Version, before.policyVersion)

	result, err = CheckSensitiveRequest(sensitiveWordTestInput(user, "remote-block", "remote runtime marker"))
	require.NoError(t, err)
	require.True(t, result.Blocked)
	var stored User
	require.NoError(t, DB.First(&stored, user.Id).Error)
	require.Equal(t, 1, stored.SensitiveWordViolationCount)
}

func TestSensitiveWordWhitelistAndRequestIdempotency(t *testing.T) {
	setupSensitiveWordTest(t)
	require.NoError(t, MigrateSensitiveWordData())
	saveSensitiveWordTestPolicy(t, true, SensitiveWordBanThreshold)
	addSensitiveWordTestRule(t, "block", []string{"blocked marker"}, SensitiveWordScopeGlobal, nil, SensitiveWordModeBlock)

	whitelisted := createSensitiveWordTestUser(t, 1_900_000, true)
	result, err := CheckSensitiveRequest(sensitiveWordTestInput(whitelisted, "whitelist", "blocked marker"))
	require.NoError(t, err)
	require.True(t, result.WhitelistBypassed)
	require.False(t, result.Blocked)
	require.Zero(t, result.ViolationCount)
	require.NotEmpty(t, sensitiveWordTestAudit(t, "whitelist").FullPrompt)

	user := createSensitiveWordTestUser(t, 2_300_000, false)
	first, err := CheckSensitiveRequest(sensitiveWordTestInput(user, "same-request", "blocked marker"))
	require.NoError(t, err)
	second, err := CheckSensitiveRequest(sensitiveWordTestInput(user, "same-request", "blocked marker"))
	require.NoError(t, err)
	require.Equal(t, first.AuditID, second.AuditID)
	require.Equal(t, 1, second.ViolationCount)
	var auditCount int64
	require.NoError(t, DB.Model(&SensitiveWordAuditEvent{}).
		Where("request_id = ? AND user_id = ?", "same-request", user.Id).Count(&auditCount).Error)
	require.Equal(t, int64(1), auditCount)
	var stored User
	require.NoError(t, DB.First(&stored, user.Id).Error)
	require.Equal(t, 1, stored.SensitiveWordViolationCount)
}

func TestSensitiveWordConcurrentSameRequestCountsOnce(t *testing.T) {
	setupSensitiveWordTest(t)
	require.NoError(t, MigrateSensitiveWordData())
	saveSensitiveWordTestPolicy(t, false, SensitiveWordBanThreshold)
	addSensitiveWordTestRule(t, "concurrent", []string{"concurrent marker"}, SensitiveWordScopeGlobal, nil, SensitiveWordModeBlock)
	user := createSensitiveWordTestUser(t, 3_000_000, false)

	const workers = 8
	start := make(chan struct{})
	results := make(chan *SensitiveCheckResult, workers)
	errorsCh := make(chan error, workers)
	var wg sync.WaitGroup
	for range workers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			result, err := CheckSensitiveRequest(sensitiveWordTestInput(user, "concurrent-request", "concurrent marker"))
			results <- result
			errorsCh <- err
		}()
	}
	close(start)
	wg.Wait()
	close(results)
	close(errorsCh)
	for err := range errorsCh {
		require.NoError(t, err)
	}
	var auditID int64
	for result := range results {
		require.NotNil(t, result)
		require.Equal(t, 1, result.ViolationCount)
		if auditID == 0 {
			auditID = result.AuditID
		}
		require.Equal(t, auditID, result.AuditID)
	}
	var stored User
	require.NoError(t, DB.First(&stored, user.Id).Error)
	require.Equal(t, 1, stored.SensitiveWordViolationCount)
}

func TestSensitiveWordThresholdBanAndEnableResetPreserveAccounting(t *testing.T) {
	setupSensitiveWordTest(t)
	require.NoError(t, MigrateSensitiveWordData())
	saveSensitiveWordTestPolicy(t, true, 3)
	addSensitiveWordTestRule(t, "threshold", []string{"threshold marker"}, SensitiveWordScopeGlobal, nil, SensitiveWordModeBlock)
	user := createSensitiveWordTestUser(t, 88_800_000, false)
	user.UsedQuota = 123_456
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Update("used_quota", user.UsedQuota).Error)

	now := time.Now().Unix()
	session := UserSession{
		SID: fmt.Sprintf("sensitive-session-%d", user.Id), UserID: user.Id,
		Version: 1, UserAuthVersion: 1, Status: UserSessionStatusActive,
		RefreshHash: "sensitive-refresh", LoginMethod: "password",
		CreatedAt: now, LastActiveAt: now, ExpiresAt: now + 3600,
	}
	require.NoError(t, DB.Create(&session).Error)

	for count := 1; count <= 3; count++ {
		result, err := CheckSensitiveRequest(sensitiveWordTestInput(
			user, fmt.Sprintf("threshold-%d", count), "threshold marker",
		))
		require.NoError(t, err)
		require.True(t, result.Blocked)
		require.Equal(t, count, result.ViolationCount)
		require.Equal(t, count == 3, result.AutoBanned)
	}
	var banned User
	require.NoError(t, DB.First(&banned, user.Id).Error)
	require.Equal(t, common.UserStatusDisabled, banned.Status)
	require.Equal(t, 3, banned.SensitiveWordViolationCount)
	require.Equal(t, 88_800_000, banned.Quota)
	require.Equal(t, 123_456, banned.UsedQuota)
	require.Equal(t, int64(2), banned.AuthVersion)
	var revoked UserSession
	require.NoError(t, DB.First(&revoked, "sid = ?", session.SID).Error)
	require.Equal(t, UserSessionStatusRevoked, revoked.Status)
	require.Equal(t, "sensitive_word_threshold", revoked.RevokedReason)

	thresholdAudit := sensitiveWordTestAudit(t, "threshold-3")
	require.True(t, thresholdAudit.AutoBanned)
	require.Equal(t, 88_800_000, thresholdAudit.QuotaBefore)
	require.Equal(t, 88_800_000, thresholdAudit.QuotaAfter)
	var evidenceBefore int64
	require.NoError(t, DB.Model(&SensitiveWordAuditEvent{}).Where("user_id = ?", user.Id).Count(&evidenceBefore).Error)

	reset, err := EnableUserAndResetSensitiveWordViolations(user.Id)
	require.NoError(t, err)
	require.True(t, reset.StatusChanged)
	require.True(t, reset.ViolationCountReset)
	require.Equal(t, 3, reset.ViolationCountBefore)
	require.Zero(t, reset.ViolationCountAfter)
	require.Equal(t, int64(3), reset.AuthVersionAfter)
	require.Equal(t, 88_800_000, reset.QuotaAfter)
	require.Equal(t, 123_456, reset.UsedQuotaAfter)

	var enabled User
	require.NoError(t, DB.First(&enabled, user.Id).Error)
	require.Equal(t, common.UserStatusEnabled, enabled.Status)
	require.Zero(t, enabled.SensitiveWordViolationCount)
	require.Equal(t, banned.Quota, enabled.Quota)
	require.Equal(t, banned.UsedQuota, enabled.UsedQuota)
	var evidenceAfter int64
	require.NoError(t, DB.Model(&SensitiveWordAuditEvent{}).Where("user_id = ?", user.Id).Count(&evidenceAfter).Error)
	require.Equal(t, evidenceBefore, evidenceAfter)

	second, err := EnableUserAndResetSensitiveWordViolations(user.Id)
	require.NoError(t, err)
	require.False(t, second.StatusChanged)
	require.False(t, second.ViolationCountReset)
	require.Equal(t, enabled.AuthVersion, second.AuthVersionAfter)
}

func TestSensitiveWordAuditFailureRollsBackBlockingDecision(t *testing.T) {
	setupSensitiveWordTest(t)
	require.NoError(t, MigrateSensitiveWordData())
	saveSensitiveWordTestPolicy(t, true, SensitiveWordBanThreshold)
	addSensitiveWordTestRule(t, "audit failure", []string{"audit failure marker"}, SensitiveWordScopeGlobal, nil, SensitiveWordModeBlock)
	user := createSensitiveWordTestUser(t, 4_200_000, false)

	triggerName := fmt.Sprintf("sensitive_audit_failure_%d", time.Now().UnixNano())
	require.NoError(t, DB.Exec(fmt.Sprintf(
		"CREATE TRIGGER %s BEFORE INSERT ON sensitive_word_audit_events BEGIN SELECT RAISE(ABORT, 'forced audit failure'); END",
		triggerName,
	)).Error)
	t.Cleanup(func() { _ = DB.Exec("DROP TRIGGER " + triggerName).Error })

	result, err := CheckSensitiveRequest(sensitiveWordTestInput(user, "audit-failure", "audit failure marker"))
	require.ErrorIs(t, err, ErrSensitiveWordAuditPersistence)
	require.NotNil(t, result)
	require.True(t, result.Matched)
	require.False(t, result.Blocked, "rolled-back decisions cannot claim a recorded block")
	require.Zero(t, result.ViolationCount)
	var stored User
	require.NoError(t, DB.First(&stored, user.Id).Error)
	require.Zero(t, stored.SensitiveWordViolationCount)
}

func TestSensitiveWordObserveAuditFailureIsTyped(t *testing.T) {
	setupSensitiveWordTest(t)
	require.NoError(t, MigrateSensitiveWordData())
	saveSensitiveWordTestPolicy(t, true, SensitiveWordBanThreshold)
	addSensitiveWordTestRule(t, "observe failure", []string{"observe failure marker"}, SensitiveWordScopeGlobal, nil, SensitiveWordModeObserve)
	user := createSensitiveWordTestUser(t, 4_300_000, false)

	triggerName := fmt.Sprintf("sensitive_observe_failure_%d", time.Now().UnixNano())
	require.NoError(t, DB.Exec(fmt.Sprintf(
		"CREATE TRIGGER %s BEFORE INSERT ON sensitive_word_audit_events BEGIN SELECT RAISE(ABORT, 'forced audit failure'); END",
		triggerName,
	)).Error)
	t.Cleanup(func() { _ = DB.Exec("DROP TRIGGER " + triggerName).Error })

	result, err := CheckSensitiveRequest(sensitiveWordTestInput(user, "observe-failure", "observe failure marker"))
	require.ErrorIs(t, err, ErrSensitiveWordAuditPersistence)
	require.True(t, result.Matched)
	require.True(t, result.ObserveOnly)
	require.False(t, result.Blocked)
	var stored User
	require.NoError(t, DB.First(&stored, user.Id).Error)
	require.Zero(t, stored.SensitiveWordViolationCount)
}

func TestSensitiveWordPromptEvidenceLimits(t *testing.T) {
	require.Equal(t, "abc…", truncateSensitivePrompt("abcdef", 3))
	require.Equal(t, "ab", truncateSensitivePrompt("a\x00b", 10))
	value := truncateSensitivePrompt(strings.Repeat("界", 200_000), 200_000)
	require.True(t, utf8.ValidString(value))
	require.LessOrEqual(t, len([]byte(value)), SensitiveWordMaxPromptBytes)
	require.True(t, strings.HasSuffix(value, "…"))
	require.Equal(t, "mediumtext", sensitiveWordAuditPromptDBType(string(common.DatabaseTypeMySQL)))
	require.Equal(t, "text", sensitiveWordAuditPromptDBType(string(common.DatabaseTypePostgreSQL)))
	require.Equal(t, "text", sensitiveWordAuditPromptDBType(string(common.DatabaseTypeSQLite)))
}

func TestSensitiveWordAuditEvidenceRetentionCleanup(t *testing.T) {
	setupSensitiveWordTest(t)
	require.NoError(t, MigrateSensitiveWordData())
	policy := GetSensitiveWordPolicy()
	policy.FullPromptRetentionDays = 1
	require.NoError(t, SaveSensitiveWordPolicy(policy, 1))
	user := createSensitiveWordTestUser(t, 5_000_000, false)

	old := SensitiveWordAuditEvent{
		RequestID: "expired-evidence", UserID: user.Id, FullPrompt: "expired prompt",
		RedactedPreview: "expired preview", MatchedSnippets: `["expired snippet"]`,
		CreatedAt: time.Now().Add(-48 * time.Hour),
	}
	fresh := SensitiveWordAuditEvent{
		RequestID: "fresh-evidence", UserID: user.Id, FullPrompt: "fresh prompt",
		RedactedPreview: "fresh preview", MatchedSnippets: `["fresh snippet"]`,
		CreatedAt: time.Now(),
	}
	require.NoError(t, DB.Create(&old).Error)
	require.NoError(t, DB.Create(&fresh).Error)

	cleared, err := CleanupSensitiveWordAudits()
	require.NoError(t, err)
	require.Equal(t, int64(1), cleared)
	var storedOld, storedFresh SensitiveWordAuditEvent
	require.NoError(t, DB.First(&storedOld, old.ID).Error)
	require.NoError(t, DB.First(&storedFresh, fresh.ID).Error)
	require.Empty(t, storedOld.FullPrompt)
	require.Empty(t, storedOld.RedactedPreview)
	require.Equal(t, "[]", storedOld.MatchedSnippets)
	require.Equal(t, SensitiveWordAuditPrompt("fresh prompt"), storedFresh.FullPrompt)
	require.Equal(t, "fresh preview", storedFresh.RedactedPreview)

	cleared, err = CleanupSensitiveWordAudits()
	require.NoError(t, err)
	require.Zero(t, cleared, "already-cleared evidence must not be rewritten every day")
}

func TestSensitiveWordUserSafetyFieldsRequireExplicitUpdate(t *testing.T) {
	setupSensitiveWordTest(t)
	user := createSensitiveWordTestUser(t, 5_500_000, true)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).
		Update("sensitive_word_violation_count", 7).Error)

	ordinaryEdit := *user
	ordinaryEdit.DisplayName = "edited user"
	ordinaryEdit.SensitiveWordViolationCount = 0
	ordinaryEdit.SensitiveWordWhitelist = false
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return ordinaryEdit.EditWithTx(tx, false)
	}))
	var stored User
	require.NoError(t, DB.First(&stored, user.Id).Error)
	require.Equal(t, 7, stored.SensitiveWordViolationCount)
	require.True(t, stored.SensitiveWordWhitelist)

	count := 0
	whitelist := false
	require.NoError(t, UpdateSensitiveWordUserFields(user.Id, &count, &whitelist))
	require.NoError(t, DB.First(&stored, user.Id).Error)
	require.Zero(t, stored.SensitiveWordViolationCount)
	require.False(t, stored.SensitiveWordWhitelist)

	negative := -1
	require.Error(t, UpdateSensitiveWordUserFields(user.Id, &negative, nil))
}

func TestSensitiveWordMigrationIsOneWayAndIdempotent(t *testing.T) {
	setupSensitiveWordTest(t)
	checkPrompt := true
	legacyPolicy, err := common.Marshal(legacySensitiveWordConfig{
		Enabled: true, CheckPrompt: &checkPrompt, AuditEnabled: false,
		BlockMessage: "legacy {{threshold}}", BanThreshold: 9,
		FullPromptRetentionDays: 30, MaxPromptRunes: 4096, RuleVersion: 7,
	})
	require.NoError(t, err)
	require.NoError(t, DB.Create(&Option{Key: "SensitiveWordConfig", Value: string(legacyPolicy)}).Error)
	require.NoError(t, DB.Create(&Option{Key: "SensitiveWords", Value: "legacy-one\nlegacy-two\nLEGACY-ONE"}).Error)
	user := createSensitiveWordTestUser(t, 6_800_000, false)
	require.NoError(t, DB.Migrator().CreateTable(&legacySensitiveWordWhitelist{}))
	t.Cleanup(func() { _ = DB.Migrator().DropTable(&legacySensitiveWordWhitelist{}) })
	require.NoError(t, DB.Create(&legacySensitiveWordWhitelist{UserID: user.Id, Enabled: true}).Error)

	require.NoError(t, MigrateSensitiveWordData())
	require.NoError(t, MigrateSensitiveWordData())
	policy := GetSensitiveWordPolicy()
	require.True(t, policy.Enabled)
	require.False(t, policy.RetainFullPrompt)
	require.Equal(t, 9, policy.BanThreshold)
	require.Equal(t, 4096, policy.MaxPromptRunes)
	rules, err := ListSensitiveWordRules()
	require.NoError(t, err)
	require.Len(t, rules, 1)
	require.Equal(t, 2, rules[0].WordCount)
	detail, err := GetSensitiveWordRuleDetail(rules[0].ID)
	require.NoError(t, err)
	require.ElementsMatch(t, []string{"legacy-one", "legacy-two"}, detail.Words)
	var migrated User
	require.NoError(t, DB.First(&migrated, user.Id).Error)
	require.True(t, migrated.SensitiveWordWhitelist)
	var marker Option
	require.NoError(t, DB.Where(&Option{Key: sensitiveWordMigrationKey}).First(&marker).Error)
	require.Equal(t, sensitiveWordMigrationValue, marker.Value)

	require.NoError(t, DeleteSensitiveWordRule(detail.ID, 1))
	require.NoError(t, MigrateSensitiveWordData())
	rules, err = ListSensitiveWordRules()
	require.NoError(t, err)
	require.Empty(t, rules, "committed migration must never resurrect legacy options")
}

func TestSensitiveWordMigrationLeavesMarkerUnsetForInvalidLegacyWord(t *testing.T) {
	setupSensitiveWordTest(t)
	legacyWord := strings.Repeat("超长旧词", 80)
	require.Greater(t, len([]rune(legacyWord)), SensitiveWordMaxRunes)
	require.NoError(t, DB.Create(&Option{Key: "SensitiveWords", Value: legacyWord}).Error)
	require.NoError(t, MigrateSensitiveWordData())
	var markerCount int64
	require.NoError(t, DB.Model(&Option{}).Where(&Option{Key: sensitiveWordMigrationKey}).Count(&markerCount).Error)
	require.Zero(t, markerCount)
	require.False(t, GetSensitiveWordPolicy().Enabled, "incomplete migration must fail open")
	rules, err := ListSensitiveWordRules()
	require.NoError(t, err)
	require.Empty(t, rules)
}

func TestSensitiveWordMigratesInitialP30Schema(t *testing.T) {
	require.NoError(t, DB.Migrator().DropTable(
		&SensitiveWordAuditEvent{}, &SensitiveWordPolicy{}, &SensitiveWordRuleWord{},
		&SensitiveWordRuleGroup{}, &SensitiveWordRule{}, &legacySensitiveWordWhitelist{},
	))
	require.NoError(t, DB.AutoMigrate(
		&Option{}, &User{}, &legacySensitiveWordV1Rule{}, &SensitiveWordRuleGroup{},
		&legacySensitiveWordWhitelist{}, &legacySensitiveWordV1Audit{},
	))
	require.NoError(t, DB.Where("key IN ?", []string{
		"SensitiveWords", "SensitiveWordConfig", sensitiveWordMigrationKey,
	}).Delete(&Option{}).Error)
	setSensitiveWordRuntimeUnavailable(false)

	user := createSensitiveWordTestUser(t, 7_100_000, false)
	legacyRule := legacySensitiveWordV1Rule{
		Word: "initial-p30-rule", Scope: SensitiveWordScopeGlobal, Enabled: true,
		CreatedBy: 7, Version: 3, CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}
	require.NoError(t, DB.Create(&legacyRule).Error)
	require.NoError(t, DB.Create(&legacySensitiveWordV1Audit{
		RequestID: "initial-p30-audit", UserID: user.Id, FullPrompt: "legacy audit prompt",
		MatchedRuleIDs: "[1]", MatchedWords: `["initial-p30-rule"]`, MatchedSnippets: "[]",
		CreatedAt: time.Now(),
	}).Error)
	require.NoError(t, DB.Create(&legacySensitiveWordWhitelist{UserID: user.Id, Enabled: true}).Error)
	legacyConfig, err := common.Marshal(map[string]any{
		"enabled": true, "audit_enabled": true, "block_message": "legacy policy",
		"ban_threshold": 9, "full_prompt_retention_days": 30,
		"max_prompt_runes": 4096, "rule_version": 2,
	})
	require.NoError(t, err)
	require.NoError(t, DB.Create(&Option{Key: "SensitiveWordConfig", Value: string(legacyConfig)}).Error)
	require.NoError(t, DB.Create(&Option{Key: "SensitiveWords", Value: "initial-p30-option"}).Error)

	// This is the same AutoMigrate phase production performs before the
	// one-way import. In particular, old rows receive a NULL mode rather than
	// being silently converted to observe by a schema default.
	require.NoError(t, DB.AutoMigrate(
		&User{}, &SensitiveWordRule{}, &SensitiveWordRuleWord{}, &SensitiveWordRuleGroup{},
		&SensitiveWordPolicy{}, &SensitiveWordAuditEvent{},
	))
	require.NoError(t, MigrateSensitiveWordData())

	policy := GetSensitiveWordPolicy()
	require.True(t, policy.Enabled)
	require.True(t, policy.CheckPrompt, "missing v1 check_prompt must preserve the secure default")
	require.Equal(t, 9, policy.BanThreshold)

	detail, err := GetSensitiveWordRuleDetail(legacyRule.ID)
	require.NoError(t, err)
	require.Equal(t, SensitiveWordModeBlock, detail.Mode)
	require.Equal(t, []string{"initial-p30-rule"}, detail.Words)
	rules, err := ListSensitiveWordRules()
	require.NoError(t, err)
	require.Len(t, rules, 2, "legacy global option must not disappear beside an old global rule")

	var migratedUser User
	require.NoError(t, DB.First(&migratedUser, user.Id).Error)
	require.True(t, migratedUser.SensitiveWordWhitelist)
	var audit SensitiveWordAuditEvent
	require.NoError(t, DB.Where("request_id = ?", "initial-p30-audit").First(&audit).Error)
	require.Equal(t, SensitiveWordAuditPrompt("legacy audit prompt"), audit.FullPrompt)
	var marker Option
	require.NoError(t, DB.Where(&Option{Key: sensitiveWordMigrationKey}).First(&marker).Error)
	require.Equal(t, sensitiveWordMigrationValue, marker.Value)

	t.Cleanup(func() {
		_ = DB.Migrator().DropTable(&legacySensitiveWordWhitelist{})
		_ = DB.AutoMigrate(
			&SensitiveWordRule{}, &SensitiveWordRuleWord{}, &SensitiveWordRuleGroup{},
			&SensitiveWordPolicy{}, &SensitiveWordAuditEvent{},
		)
		_ = DB.Where("key IN ?", []string{
			"SensitiveWords", "SensitiveWordConfig", sensitiveWordMigrationKey,
		}).Delete(&Option{}).Error
		invalidateSensitiveWordRuntime()
	})
}

func TestSensitiveWordMigrationFailureDisablesRuntimeWithoutBlockingStartup(t *testing.T) {
	setupSensitiveWordTest(t)
	require.NoError(t, DB.Create(&Option{Key: "SensitiveWordConfig", Value: "not-json"}).Error)
	require.Error(t, MigrateSensitiveWordData())

	require.NoError(t, DB.Create(&SensitiveWordPolicy{
		ID: 1, Enabled: true, CheckPrompt: true, RetainFullPrompt: true,
		BlockMessage: sensitiveWordBlockMessage, BanThreshold: SensitiveWordBanThreshold,
		FullPromptRetentionDays: 180, MaxPromptRunes: SensitiveWordMaxPromptRunes, Version: 1,
	}).Error)
	require.False(t, GetSensitiveWordPolicy().Enabled, "failed migration must not activate partial state")

	require.NoError(t, DB.Where(&Option{Key: "SensitiveWordConfig"}).Delete(&Option{}).Error)
	require.NoError(t, MigrateSensitiveWordData())
	require.True(t, GetSensitiveWordPolicy().Enabled)
}

func TestSensitiveWordRuntimeRequiresCompletedMigrationMarker(t *testing.T) {
	setupSensitiveWordTest(t)
	require.NoError(t, DB.Create(&SensitiveWordPolicy{
		ID: 1, Enabled: true, CheckPrompt: true, RetainFullPrompt: true,
		BlockMessage: sensitiveWordBlockMessage, BanThreshold: SensitiveWordBanThreshold,
		FullPromptRetentionDays: 180, MaxPromptRunes: SensitiveWordMaxPromptRunes, Version: 1,
	}).Error)
	setSensitiveWordRuntimeUnavailable(false)

	policy := GetSensitiveWordPolicy()
	require.False(t, policy.Enabled, "a slave must not use partially migrated rules before the marker exists")

	require.NoError(t, DB.Create(&Option{
		Key: sensitiveWordMigrationKey, Value: sensitiveWordMigrationValue,
	}).Error)
	require.True(t, GetSensitiveWordPolicy().Enabled)
}
