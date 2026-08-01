package service

import (
	"encoding/json"
	"errors"
	"net"
	"net/textproto"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRecallActivitySMTPClassifiesAttemptOutcomes(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want recallSMTPAttemptOutcome
	}{
		{name: "accepted", want: recallSMTPAttemptAccepted},
		{name: "smtp_4xx_retryable", err: &textproto.Error{Code: 421, Msg: "service unavailable"}, want: recallSMTPAttemptRetryable},
		{name: "smtp_5xx_permanent", err: &textproto.Error{Code: 550, Msg: "mailbox unavailable user@example.com"}, want: recallSMTPAttemptPermanent},
		{name: "raw_4xx_uncertain", err: errors.New("451 temporary local problem for user@example.com"), want: recallSMTPAttemptUncertain},
		{name: "raw_5xx_uncertain", err: errors.New("550 mailbox unavailable user@example.com"), want: recallSMTPAttemptUncertain},
		{name: "connection_refused_retryable", err: &net.OpError{Op: "dial", Net: "tcp", Err: errors.New("connection refused")}, want: recallSMTPAttemptRetryable},
		{name: "post_data_uncertain", err: recallSMTPUncertainError{err: errors.New("connection reset after DATA")}, want: recallSMTPAttemptUncertain},
		{name: "deterministic_content_rejection_permanent", err: errors.New("email headers must not contain CR or LF"), want: recallSMTPAttemptPermanent},
		{name: "ambiguous_temporary_text_uncertain", err: errors.New("temporary provider failure"), want: recallSMTPAttemptUncertain},
		{name: "unknown_error_uncertain", err: errors.New("connection refused after DATA"), want: recallSMTPAttemptUncertain},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			require.Equal(t, testCase.want, classifyRecallSMTPAttempt(testCase.err).Outcome)
		})
	}
}

func TestRecallActivitySMTPRetryDelaysAreExactFourSlots(t *testing.T) {
	require.Equal(t, [...]time.Duration{
		30 * time.Second,
		time.Minute,
		2 * time.Minute,
		4 * time.Minute,
	}, recallSMTPRetryDelays)
}

func TestRecallSMTPOutcomeObservationLogsSanitizedPerAttempt(t *testing.T) {
	originalSysLog := recallSMTPOutcomeSysLog
	var logs []string
	recallSMTPOutcomeSysLog = func(message string) {
		logs = append(logs, message)
	}
	t.Cleanup(func() {
		recallSMTPOutcomeSysLog = originalSysLog
	})

	observeRecallSMTPAttemptOutcome(recallSMTPAttemptUncertain)

	require.Len(t, logs, 1)
	require.Contains(t, logs[0], "recall smtp attempt outcome")
	require.Contains(t, logs[0], "outcome=uncertain")
	require.Contains(t, logs[0], "scope=process")
	require.Contains(t, logs[0], "payload=none")
	require.NotContains(t, logs[0], "accepted=")
	require.NotContains(t, logs[0], "retryable=")
	require.NotContains(t, logs[0], "permanent=")
	require.NotContains(t, logs[0], "uncertain=")
	require.NotContains(t, logs[0], "@")
}

func setupRecallActivitySMTPServiceTest(t *testing.T) *gorm.DB {
	t.Helper()

	tempDir := t.TempDir()
	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalRedisEnabled := common.RedisEnabled
	originalOptionMap := common.OptionMap
	originalSQLitePath := common.SQLitePath
	originalIsMasterNode := common.IsMasterNode
	t.Setenv("SQL_DSN", "")
	common.SQLitePath = tempDir + "/init.db"
	common.IsMasterNode = false
	require.NoError(t, model.InitDB())
	if sqlDB, err := model.DB.DB(); err == nil {
		_ = sqlDB.Close()
	}

	db, err := gorm.Open(sqlite.Open(tempDir+"/recall-activity-smtp.db"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Option{}))

	model.DB = db
	model.LOG_DB = db
	common.RedisEnabled = false
	common.OptionMap = map[string]string{}

	resetRecallActivitySMTPSetting(t)
	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.RedisEnabled = originalRedisEnabled
		common.OptionMap = originalOptionMap
		common.SQLitePath = originalSQLitePath
		common.IsMasterNode = originalIsMasterNode
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func resetRecallActivitySMTPSetting(t *testing.T) {
	t.Helper()
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"recall_campaign_setting.enabled":               "true",
		"recall_campaign_setting.batch_size":            "100",
		"recall_campaign_setting.tick_seconds":          "30",
		"recall_campaign_setting.email_hourly_limit":    "100",
		"recall_campaign_setting.smtp_server":           "",
		"recall_campaign_setting.smtp_port":             "0",
		"recall_campaign_setting.smtp_account":          "",
		"recall_campaign_setting.email_from":            "",
		"recall_campaign_setting.smtp_token":            "",
		"recall_campaign_setting.smtp_ssl_enabled":      "false",
		"recall_campaign_setting.smtp_force_auth_login": "false",
		"recall_campaign_setting.reply_to":              "",
		"recall_campaign_setting.unsubscribe_mailto":    "",
	}))
}

func TestRecallActivitySMTPStatusReturnsOnlyRedactedFields(t *testing.T) {
	setupRecallActivitySMTPServiceTest(t)
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"recall_campaign_setting.smtp_server":           "smtp.activity.example.com",
		"recall_campaign_setting.smtp_port":             "587",
		"recall_campaign_setting.smtp_account":          "activity@example.com",
		"recall_campaign_setting.email_from":            "campaigns@example.com",
		"recall_campaign_setting.smtp_token":            "stored-secret",
		"recall_campaign_setting.smtp_ssl_enabled":      "true",
		"recall_campaign_setting.smtp_force_auth_login": "true",
		"recall_campaign_setting.reply_to":              "support@example.com",
		"recall_campaign_setting.unsubscribe_mailto":    "mailto:unsubscribe@example.com",
	}))

	status := GetRecallActivitySMTPStatus()
	raw, err := json.Marshal(status)
	require.NoError(t, err)

	require.JSONEq(t, `{
		"server":"smtp.activity.example.com",
		"port":587,
		"account":"activity@example.com",
		"email_from":"campaigns@example.com",
		"ssl_enabled":true,
		"force_auth_login":true,
		"token_configured":true,
		"configured":true,
		"reply_to":"support@example.com",
		"unsubscribe_mailto":"mailto:unsubscribe@example.com"
	}`, string(raw))
	require.NotContains(t, string(raw), "stored-secret")
	require.NotContains(t, strings.ToLower(string(raw)), `"token":`)
}

func TestRecallActivitySMTPStatusConfiguredRequiresCompleteValidConfig(t *testing.T) {
	setupRecallActivitySMTPServiceTest(t)
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"recall_campaign_setting.smtp_server":  "smtp.activity.example.com",
		"recall_campaign_setting.smtp_port":    "587",
		"recall_campaign_setting.smtp_account": "activity@example.com",
		"recall_campaign_setting.email_from":   "Campaigns <campaigns@example.com>",
		"recall_campaign_setting.smtp_token":   "stored-secret",
	}))

	status := GetRecallActivitySMTPStatus()

	require.True(t, status.TokenConfigured)
	require.False(t, status.Configured)
}

func TestRecallActivitySMTPUpdateRequiresEffectiveTokenAndRejectsInvalidInputs(t *testing.T) {
	setupRecallActivitySMTPServiceTest(t)

	_, err := UpdateRecallActivitySMTP(RecallActivitySMTPInput{
		Server: "smtp.activity.example.com", Port: 587, Account: "activity@example.com", EmailFrom: "campaigns@example.com",
	})
	require.ErrorContains(t, err, "SMTP token is required")

	_, err = UpdateRecallActivitySMTP(RecallActivitySMTPInput{
		Server: "smtp.activity.example.com", Port: 0, Account: "activity@example.com", EmailFrom: "campaigns@example.com", Token: "secret",
	})
	require.ErrorContains(t, err, "SMTP port")

	_, err = UpdateRecallActivitySMTP(RecallActivitySMTPInput{
		Server: "smtp.activity.example.com", Port: 587, Account: "activity@example.com", EmailFrom: "Campaigns <campaigns@example.com>", Token: "secret",
	})
	require.ErrorContains(t, err, "invalid SMTP sender")
}

func TestRecallActivitySMTPUpdateTrimsEditableFieldsAndPreservesBlankToken(t *testing.T) {
	db := setupRecallActivitySMTPServiceTest(t)
	status, err := UpdateRecallActivitySMTP(RecallActivitySMTPInput{
		Server:     " smtp.activity.example.com ",
		Port:       587,
		Account:    " activity@example.com ",
		EmailFrom:  " campaigns@example.com ",
		Token:      "  legitimate password contents  ",
		SSLEnabled: true,
	})
	require.NoError(t, err)
	require.True(t, status.Configured)
	require.True(t, status.TokenConfigured)
	require.Equal(t, "smtp.activity.example.com", operation_setting.GetRecallCampaignSetting().SMTPServer)
	require.Equal(t, "activity@example.com", operation_setting.GetRecallCampaignSetting().SMTPAccount)
	require.Equal(t, "campaigns@example.com", operation_setting.GetRecallCampaignSetting().EmailFrom)

	var token model.Option
	require.NoError(t, db.First(&token, "key = ?", "recall_campaign_setting.smtp_token").Error)
	require.Equal(t, "  legitimate password contents  ", token.Value)

	status, err = UpdateRecallActivitySMTP(RecallActivitySMTPInput{
		Server:         "smtp2.activity.example.com",
		Port:           2525,
		Account:        "activity2@example.com",
		EmailFrom:      "campaigns2@example.com",
		Token:          "",
		ForceAuthLogin: true,
	})
	require.NoError(t, err)
	require.True(t, status.Configured)
	require.True(t, status.TokenConfigured)
	require.NoError(t, db.First(&token, "key = ?", "recall_campaign_setting.smtp_token").Error)
	require.Equal(t, "  legitimate password contents  ", token.Value)
}

func TestRecallActivitySMTPUpdatePreservesTokenOnWhitespaceOnlyToken(t *testing.T) {
	db := setupRecallActivitySMTPServiceTest(t)
	status, err := UpdateRecallActivitySMTP(RecallActivitySMTPInput{
		Server:     "smtp.activity.example.com",
		Port:       587,
		Account:    "activity@example.com",
		EmailFrom:  "campaigns@example.com",
		Token:      "stored-secret",
		SSLEnabled: true,
	})
	require.NoError(t, err)
	require.True(t, status.Configured)
	require.True(t, status.TokenConfigured)

	status, err = UpdateRecallActivitySMTP(RecallActivitySMTPInput{
		Server:         "smtp2.activity.example.com",
		Port:           2525,
		Account:        "activity2@example.com",
		EmailFrom:      "campaigns2@example.com",
		Token:          "   ",
		ForceAuthLogin: true,
	})
	require.NoError(t, err)
	require.True(t, status.Configured)
	require.True(t, status.TokenConfigured)

	var token model.Option
	require.NoError(t, db.First(&token, "key = ?", "recall_campaign_setting.smtp_token").Error)
	require.Equal(t, "stored-secret", token.Value)
	require.Equal(t, "stored-secret", operation_setting.GetRecallCampaignSetting().SMTPToken)
}

func TestRecallActivitySMTPUpdateBlankTokenUsesPersistedTokenWhenRuntimeIsStale(t *testing.T) {
	db := setupRecallActivitySMTPServiceTest(t)
	require.NoError(t, db.Create(&model.Option{Key: "recall_campaign_setting.smtp_token", Value: "persisted-secret"}).Error)
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"recall_campaign_setting.smtp_server":           "stale.smtp.example.com",
		"recall_campaign_setting.smtp_port":             "587",
		"recall_campaign_setting.smtp_account":          "stale@example.com",
		"recall_campaign_setting.email_from":            "stale@example.com",
		"recall_campaign_setting.smtp_token":            "",
		"recall_campaign_setting.smtp_ssl_enabled":      "false",
		"recall_campaign_setting.smtp_force_auth_login": "false",
	}))

	status, err := UpdateRecallActivitySMTP(RecallActivitySMTPInput{
		Server:     "smtp.activity.example.com",
		Port:       587,
		Account:    "activity@example.com",
		EmailFrom:  "campaigns@example.com",
		Token:      "",
		SSLEnabled: true,
	})

	require.NoError(t, err)
	require.True(t, status.Configured)
	require.True(t, status.TokenConfigured)
	var token model.Option
	require.NoError(t, db.First(&token, "key = ?", "recall_campaign_setting.smtp_token").Error)
	require.Equal(t, "persisted-secret", token.Value)
	require.Equal(t, "persisted-secret", operation_setting.GetRecallCampaignSetting().SMTPToken)
}

func TestRecallActivitySMTPUpdateBlankTokenWithoutPersistedTokenLeavesRuntimeAndDBUnchanged(t *testing.T) {
	db := setupRecallActivitySMTPServiceTest(t)
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"recall_campaign_setting.smtp_server":           "old.smtp.example.com",
		"recall_campaign_setting.smtp_port":             "25",
		"recall_campaign_setting.smtp_account":          "old@example.com",
		"recall_campaign_setting.email_from":            "old@example.com",
		"recall_campaign_setting.smtp_token":            "runtime-only-secret",
		"recall_campaign_setting.smtp_ssl_enabled":      "false",
		"recall_campaign_setting.smtp_force_auth_login": "false",
	}))

	_, err := UpdateRecallActivitySMTP(RecallActivitySMTPInput{
		Server:         "smtp.activity.example.com",
		Port:           587,
		Account:        "activity@example.com",
		EmailFrom:      "campaigns@example.com",
		Token:          "",
		ForceAuthLogin: true,
	})

	require.ErrorContains(t, err, "SMTP token is required")
	var count int64
	require.NoError(t, db.Model(&model.Option{}).Where("key IN ?", []string{
		"recall_campaign_setting.smtp_server",
		"recall_campaign_setting.smtp_port",
		"recall_campaign_setting.smtp_account",
		"recall_campaign_setting.email_from",
		"recall_campaign_setting.smtp_token",
		"recall_campaign_setting.smtp_ssl_enabled",
		"recall_campaign_setting.smtp_force_auth_login",
	}).Count(&count).Error)
	require.Zero(t, count)
	require.Equal(t, "old.smtp.example.com", operation_setting.GetRecallCampaignSetting().SMTPServer)
	require.Equal(t, 25, operation_setting.GetRecallCampaignSetting().SMTPPort)
	require.Equal(t, "old@example.com", operation_setting.GetRecallCampaignSetting().SMTPAccount)
	require.Equal(t, "old@example.com", operation_setting.GetRecallCampaignSetting().EmailFrom)
	require.Equal(t, "runtime-only-secret", operation_setting.GetRecallCampaignSetting().SMTPToken)
	require.False(t, operation_setting.GetRecallCampaignSetting().SMTPForceAuthLogin)
}

func TestRecallActivitySMTPSnapshotValidatesWithoutGlobalSMTP(t *testing.T) {
	setupRecallActivitySMTPServiceTest(t)
	originalServer := common.SMTPServer
	originalAccount := common.SMTPAccount
	originalFrom := common.SMTPFrom
	originalToken := common.SMTPToken
	t.Cleanup(func() {
		common.SMTPServer = originalServer
		common.SMTPAccount = originalAccount
		common.SMTPFrom = originalFrom
		common.SMTPToken = originalToken
	})
	common.SMTPServer = ""
	common.SMTPAccount = ""
	common.SMTPFrom = ""
	common.SMTPToken = ""
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"recall_campaign_setting.smtp_server":  "smtp.activity.example.com",
		"recall_campaign_setting.smtp_port":    "587",
		"recall_campaign_setting.smtp_account": "activity@example.com",
		"recall_campaign_setting.email_from":   "campaigns@example.com",
		"recall_campaign_setting.smtp_token":   "stored-secret",
	}))

	snapshot, err := RecallActivitySMTPSnapshot()

	require.NoError(t, err)
	require.Equal(t, common.SMTPConfig{
		Server: "smtp.activity.example.com", Port: 587, Account: "activity@example.com", From: "campaigns@example.com", Token: "stored-secret",
	}, snapshot)
}
