package model

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupRequestLogRoutingTest(t *testing.T) *gin.Context {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/request-log-routing.db"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}, &Log{}, &CompanyLogSchema{}))

	originalDB := DB
	originalLogDB := LOG_DB
	originalDataExportEnabled := common.DataExportEnabled
	originalLogConsumeEnabled := common.LogConsumeEnabled
	originalCompanyLogRoutingEnabled := companyLogRoutingEnabled.Load()
	common.OptionMapRWMutex.Lock()
	originalOptionMap := common.OptionMap
	common.OptionMap = map[string]string{}
	common.OptionMapRWMutex.Unlock()
	DB = db
	LOG_DB = db
	common.DataExportEnabled = false
	common.LogConsumeEnabled = true
	companyLogRoutingEnabled.Store(false)
	t.Cleanup(func() {
		DB = originalDB
		LOG_DB = originalLogDB
		common.DataExportEnabled = originalDataExportEnabled
		common.LogConsumeEnabled = originalLogConsumeEnabled
		companyLogRoutingEnabled.Store(originalCompanyLogRoutingEnabled)
		common.OptionMapRWMutex.Lock()
		common.OptionMap = originalOptionMap
		common.OptionMapRWMutex.Unlock()
	})

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/responses", nil)
	c.Set("username", "routing-test")
	return c
}

func resetRequestLogRoutingTables(t *testing.T) {
	t.Helper()
	require.NoError(t, LOG_DB.Exec("DELETE FROM logs").Error)
	require.NoError(t, LOG_DB.Exec("DELETE FROM logs_company").Error)
}

func requireRequestLogTableCounts(t *testing.T, regular int64, company int64) {
	t.Helper()
	var regularCount int64
	var companyCount int64
	require.NoError(t, LOG_DB.Model(&Log{}).Count(&regularCount).Error)
	require.NoError(t, LOG_DB.Table((CompanyLogSchema{}).TableName()).Count(&companyCount).Error)
	require.Equal(t, regular, regularCount)
	require.Equal(t, company, companyCount)
}

func TestRecordConsumeLogRoutesOnlyCompanyCodexTokenTraffic(t *testing.T) {
	c := setupRequestLogRoutingTest(t)
	companyLogRoutingEnabled.Store(true)
	tests := []struct {
		name        string
		userID      int
		tokenID     int
		channelType int
		regular     int64
		company     int64
	}{
		{name: "company codex token", userID: 1, tokenID: 7, channelType: constant.ChannelTypeCodex, company: 1},
		{name: "different user", userID: 2, tokenID: 7, channelType: constant.ChannelTypeCodex, regular: 1},
		{name: "missing token", userID: 1, tokenID: 0, channelType: constant.ChannelTypeCodex, regular: 1},
		{name: "different channel", userID: 1, tokenID: 7, channelType: constant.ChannelTypeOpenAI, regular: 1},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			resetRequestLogRoutingTables(t)
			adsActivationSeen.Store(test.userID, struct{}{})
			t.Cleanup(func() { adsActivationSeen.Delete(test.userID) })

			RecordConsumeLog(c, test.userID, RecordConsumeLogParams{
				ChannelId:   11,
				ChannelType: test.channelType,
				ModelName:   "gpt-5-codex",
				TokenId:     test.tokenID,
				Other:       map[string]interface{}{},
			})

			requireRequestLogTableCounts(t, test.regular, test.company)
		})
	}
}

func TestRecordErrorLogRoutesOnlyCompanyCodexTokenTraffic(t *testing.T) {
	c := setupRequestLogRoutingTest(t)
	companyLogRoutingEnabled.Store(true)
	tests := []struct {
		name        string
		userID      int
		tokenID     int
		channelType int
		regular     int64
		company     int64
	}{
		{name: "company codex token", userID: 1, tokenID: 7, channelType: constant.ChannelTypeCodex, company: 1},
		{name: "different user", userID: 2, tokenID: 7, channelType: constant.ChannelTypeCodex, regular: 1},
		{name: "missing token", userID: 1, tokenID: 0, channelType: constant.ChannelTypeCodex, regular: 1},
		{name: "different channel", userID: 1, tokenID: 7, channelType: constant.ChannelTypeOpenAI, regular: 1},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			resetRequestLogRoutingTables(t)

			RecordErrorLog(c, test.userID, 11, test.channelType, "gpt-5-codex", "token", "upstream error", test.tokenID, 1, false, "default", map[string]interface{}{})

			requireRequestLogTableCounts(t, test.regular, test.company)
		})
	}
}

func TestRequestLogRoutingAllowsSameRequestIDAcrossTables(t *testing.T) {
	c := setupRequestLogRoutingTest(t)
	companyLogRoutingEnabled.Store(true)
	c.Set(common.RequestIdKey, "req_shared_across_log_tables")
	adsActivationSeen.Store(1, struct{}{})
	t.Cleanup(func() { adsActivationSeen.Delete(1) })

	RecordErrorLog(c, 1, 11, constant.ChannelTypeCodex, "gpt-5-codex", "token", "upstream error", 7, 1, false, "default", map[string]interface{}{})
	RecordConsumeLog(c, 1, RecordConsumeLogParams{
		ChannelId:   12,
		ChannelType: constant.ChannelTypeOpenAI,
		ModelName:   "gpt-5",
		TokenId:     7,
		Other:       map[string]interface{}{},
	})

	requireRequestLogTableCounts(t, 1, 1)
	var regularLog Log
	require.NoError(t, LOG_DB.First(&regularLog).Error)
	var companyLog CompanyLogSchema
	require.NoError(t, LOG_DB.Table(companyLog.TableName()).First(&companyLog).Error)
	require.Equal(t, "req_shared_across_log_tables", regularLog.RequestId)
	require.Equal(t, regularLog.RequestId, companyLog.RequestId)
}

func TestCompanyLogRoutingDisabledKeepsMatchingTrafficInDefaultTable(t *testing.T) {
	c := setupRequestLogRoutingTest(t)
	adsActivationSeen.Store(1, struct{}{})
	t.Cleanup(func() { adsActivationSeen.Delete(1) })

	RecordConsumeLog(c, 1, RecordConsumeLogParams{
		ChannelId:   11,
		ChannelType: constant.ChannelTypeCodex,
		ModelName:   "gpt-5-codex",
		TokenId:     7,
		Other:       map[string]interface{}{},
	})

	requireRequestLogTableCounts(t, 1, 0)
}

func TestCompanyLogRoutingOptionPersistsAndReloads(t *testing.T) {
	setupRequestLogRoutingTest(t)
	require.NoError(t, DB.AutoMigrate(&Option{}))
	require.False(t, companyLogRoutingEnabled.Load())

	require.NoError(t, UpdateOption(OptionKeyCompanyLogRoutingEnabled, "true"))
	require.True(t, companyLogRoutingEnabled.Load())

	var option Option
	require.NoError(t, DB.First(&option, "key = ?", OptionKeyCompanyLogRoutingEnabled).Error)
	require.Equal(t, "true", option.Value)

	companyLogRoutingEnabled.Store(false)
	LoadOptionsFromDatabase()
	require.True(t, companyLogRoutingEnabled.Load())

	require.NoError(t, UpdateOption(OptionKeyCompanyLogRoutingEnabled, "false"))
	require.False(t, companyLogRoutingEnabled.Load())
}
