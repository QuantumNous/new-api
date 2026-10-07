package model

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func seedFlowQuotaData(t *testing.T, quotaData QuotaData) {
	t.Helper()
	require.NoError(t, DB.Create(&quotaData).Error)
}

func seedFlowLookupData(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.Create(&Channel{Id: 1, Name: "east"}).Error)
	require.NoError(t, DB.Create(&Channel{Id: 2, Name: "west"}).Error)
	require.NoError(t, DB.Create(&Token{Id: 11, UserId: 1, Key: "sk-primary", Name: "primary"}).Error)
	require.NoError(t, DB.Create(&Token{Id: 22, UserId: 2, Key: "sk-backup", Name: "backup"}).Error)
	require.NoError(t, DB.Delete(&Token{Id: 11}).Error)
}

func TestGetFlowQuotaDataUsesQuotaDataRoleSpecificDimensions(t *testing.T) {
	truncateTables(t)
	seedFlowLookupData(t)

	seedFlowQuotaData(t, QuotaData{
		UserID:    1,
		Username:  "alice",
		NodeName:  "node-a",
		TokenID:   11,
		UseGroup:  "vip",
		ModelName: "gpt-a",
		ChannelID: 1,
		CreatedAt: 1000,
		Count:     2,
		Quota:     100,
		TokenUsed: 40,
	})
	seedFlowQuotaData(t, QuotaData{
		UserID:    1,
		Username:  "alice",
		NodeName:  "node-a",
		TokenID:   11,
		UseGroup:  "vip",
		ModelName: "gpt-a",
		ChannelID: 1,
		CreatedAt: 1100,
		Count:     1,
		Quota:     50,
		TokenUsed: 20,
	})
	seedFlowQuotaData(t, QuotaData{
		UserID:    1,
		Username:  "alice",
		NodeName:  "node-a",
		TokenID:   11,
		UseGroup:  "vip",
		ModelName: "gpt-a",
		ChannelID: 2,
		CreatedAt: 1200,
		Count:     1,
		Quota:     25,
		TokenUsed: 10,
	})
	seedFlowQuotaData(t, QuotaData{
		UserID:    2,
		Username:  "bob",
		NodeName:  "node-b",
		TokenID:   22,
		UseGroup:  "default",
		ModelName: "gpt-b",
		ChannelID: 1,
		CreatedAt: 1300,
		Count:     3,
		Quota:     70,
		TokenUsed: 30,
	})
	seedFlowQuotaData(t, QuotaData{
		UserID:    1,
		Username:  "alice",
		ModelName: "legacy",
		CreatedAt: 1400,
		Count:     99,
		Quota:     999,
		TokenUsed: 999,
	})

	rootRows, err := GetFlowQuotaData(900, 2000, "", 0, common.RoleRootUser)
	require.NoError(t, err)
	require.Len(t, rootRows, 3)
	// Token 11 was soft-deleted, so its name is intentionally left empty for the
	// frontend to render a localized "deleted (id)" label instead.
	require.Equal(t, FlowQuotaData{
		UserID:      1,
		Username:    "alice",
		NodeName:    "node-a",
		TokenID:     11,
		TokenName:   "",
		UseGroup:    "vip",
		ChannelID:   1,
		ChannelName: "east",
		ModelName:   "gpt-a",
		TokenUsed:   60,
		Count:       3,
		Quota:       150,
	}, *rootRows[0])
	// A token that still exists resolves to its current name.
	require.Equal(t, 22, rootRows[1].TokenID)
	require.Equal(t, "backup", rootRows[1].TokenName)

	adminRows, err := GetFlowQuotaData(900, 2000, "alice", 0, common.RoleAdminUser)
	require.NoError(t, err)
	require.Len(t, adminRows, 2)
	require.Equal(t, 0, adminRows[0].TokenID)
	require.Empty(t, adminRows[0].TokenName)
	require.Empty(t, adminRows[0].NodeName)
	require.Equal(t, "alice", adminRows[0].Username)
	require.Equal(t, "vip", adminRows[0].UseGroup)
	require.Equal(t, "east", adminRows[0].ChannelName)
	require.Equal(t, 150, adminRows[0].Quota)

	selfRows, err := GetFlowQuotaData(900, 2000, "", 1, common.RoleCommonUser)
	require.NoError(t, err)
	require.Len(t, selfRows, 1)
	require.Empty(t, selfRows[0].Username)
	require.Equal(t, 0, selfRows[0].ChannelID)
	require.Empty(t, selfRows[0].ChannelName)
	require.Empty(t, selfRows[0].TokenName)
	require.Equal(t, "vip", selfRows[0].UseGroup)
	require.Equal(t, 175, selfRows[0].Quota)
}

func TestLogQuotaDataSplitsRowsByUseGroupTokenChannelAndNode(t *testing.T) {
	truncateTables(t)
	CacheQuotaDataLock.Lock()
	CacheQuotaData = make(map[string]*QuotaData)
	CacheQuotaDataLock.Unlock()

	LogQuotaData(QuotaDataLogParams{
		UserID:    1,
		Username:  "alice",
		ModelName: "gpt-a",
		CreatedAt: 3661,
		UseGroup:  "vip",
		TokenID:   11,
		ChannelID: 1,
		NodeName:  "node-a",
		Quota:     100,
		TokenUsed: 40,
	})
	LogQuotaData(QuotaDataLogParams{
		UserID:    1,
		Username:  "alice",
		ModelName: "gpt-a",
		CreatedAt: 3700,
		UseGroup:  "vip",
		TokenID:   11,
		ChannelID: 1,
		NodeName:  "node-a",
		Quota:     50,
		TokenUsed: 20,
	})
	LogQuotaData(QuotaDataLogParams{
		UserID:    1,
		Username:  "alice",
		ModelName: "gpt-a",
		CreatedAt: 3700,
		UseGroup:  "default",
		TokenID:   11,
		ChannelID: 1,
		NodeName:  "node-a",
		Quota:     25,
		TokenUsed: 10,
	})

	SaveQuotaDataCache()

	var rows []QuotaData
	require.NoError(t, DB.Order("quota DESC").Find(&rows).Error)
	require.Len(t, rows, 2)
	require.Equal(t, int64(3600), rows[0].CreatedAt)
	require.Equal(t, "vip", rows[0].UseGroup)
	require.Equal(t, 11, rows[0].TokenID)
	require.Equal(t, 1, rows[0].ChannelID)
	require.Equal(t, "node-a", rows[0].NodeName)
	require.Equal(t, 2, rows[0].Count)
	require.Equal(t, 150, rows[0].Quota)
	require.Equal(t, 60, rows[0].TokenUsed)
	require.Equal(t, "default", rows[1].UseGroup)
	require.Equal(t, 25, rows[1].Quota)
}

// token_id = 0 表示这次调用没有经过 API 令牌（渠道测试、控制台 Playground），
// quota_data 必须保留它的来源枚举，才能让 Flow 区分这些来源。
// token_id > 0 时令牌名由 tokens 表实时解析，不得落库。
func TestLogQuotaDataStoresTokenSourceOnlyForTokenlessRows(t *testing.T) {
	truncateTables(t)
	CacheQuotaDataLock.Lock()
	CacheQuotaData = make(map[string]*QuotaData)
	CacheQuotaDataLock.Unlock()

	LogQuotaData(QuotaDataLogParams{
		UserID:      1,
		Username:    "alice",
		ModelName:   "gpt-a",
		CreatedAt:   3700,
		UseGroup:    "default",
		TokenID:     0,
		TokenSource: QuotaTokenSourceChannelTest,
		ChannelID:   1,
		Quota:       10,
	})
	LogQuotaData(QuotaDataLogParams{
		UserID:      1,
		Username:    "alice",
		ModelName:   "gpt-a",
		CreatedAt:   3700,
		UseGroup:    "default",
		TokenID:     0,
		TokenSource: QuotaTokenSourcePlayground,
		ChannelID:   1,
		Quota:       20,
	})
	LogQuotaData(QuotaDataLogParams{
		UserID:      1,
		Username:    "alice",
		ModelName:   "gpt-a",
		CreatedAt:   3700,
		UseGroup:    "default",
		TokenID:     11,
		TokenSource: QuotaTokenSourceChannelTest,
		ChannelID:   1,
		Quota:       30,
	})

	SaveQuotaDataCache()

	var rows []QuotaData
	require.NoError(t, DB.Order("quota DESC").Find(&rows).Error)
	require.Len(t, rows, 3)
	require.Equal(t, 11, rows[0].TokenID)
	require.Empty(t, rows[0].TokenSource)
	require.Equal(t, 0, rows[1].TokenID)
	require.Equal(t, QuotaTokenSourcePlayground, rows[1].TokenSource)
	require.Equal(t, 0, rows[2].TokenID)
	require.Equal(t, QuotaTokenSourceChannelTest, rows[2].TokenSource)
}

func TestRecordConsumeLogStoresTokenlessSourceEnumInQuotaData(t *testing.T) {
	truncateTables(t)
	CacheQuotaDataLock.Lock()
	CacheQuotaData = make(map[string]*QuotaData)
	CacheQuotaDataLock.Unlock()
	previousDataExportEnabled := common.DataExportEnabled
	common.DataExportEnabled = true
	t.Cleanup(func() {
		common.DataExportEnabled = previousDataExportEnabled
		CacheQuotaDataLock.Lock()
		CacheQuotaData = make(map[string]*QuotaData)
		CacheQuotaDataLock.Unlock()
	})

	gin.SetMode(gin.TestMode)
	t.Run("channel test", func(t *testing.T) {
		ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
		common.SetContextKey(ctx, constant.ContextKeyTokenSource, QuotaTokenSourceChannelTest)
		RecordConsumeLog(ctx, 1, RecordConsumeLogParams{
			ModelName:        "gpt-a",
			TokenName:        "模型测试",
			Quota:            10,
			TokenId:          0,
			PromptTokens:     3,
			CompletionTokens: 2,
			Group:            "default",
			Other:            NewLogOther(),
		})
	})
	t.Run("playground", func(t *testing.T) {
		ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
		common.SetContextKey(ctx, constant.ContextKeyTokenSource, QuotaTokenSourcePlayground)
		RecordConsumeLog(ctx, 1, RecordConsumeLogParams{
			ModelName:        "gpt-a",
			TokenName:        "playground-default",
			Quota:            20,
			TokenId:          0,
			PromptTokens:     4,
			CompletionTokens: 3,
			Group:            "default",
			Other:            NewLogOther(),
		})
	})
	// Regular token traffic must retain its existing bucket identity even if a
	// context was accidentally tagged by an upstream middleware.
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(ctx, constant.ContextKeyTokenSource, QuotaTokenSourcePlayground)
	RecordConsumeLog(ctx, 1, RecordConsumeLogParams{
		ModelName:        "gpt-a",
		TokenName:        "real-token",
		Quota:            30,
		TokenId:          123,
		PromptTokens:     5,
		CompletionTokens: 5,
		Group:            "default",
		Other:            NewLogOther(),
	})

	SaveQuotaDataCache()
	var rows []QuotaData
	require.NoError(t, DB.Order("quota DESC").Find(&rows).Error)
	require.Len(t, rows, 3)
	require.Equal(t, 123, rows[0].TokenID)
	require.Empty(t, rows[0].TokenSource)
	require.Equal(t, QuotaTokenSourcePlayground, rows[1].TokenSource)
	require.Equal(t, QuotaTokenSourceChannelTest, rows[2].TokenSource)

	var logs []Log
	require.NoError(t, DB.Order("quota DESC").Find(&logs).Error)
	require.Len(t, logs, 3)
	require.Equal(t, "real-token", logs[0].TokenName)
	require.Equal(t, "playground-default", logs[1].TokenName)
	require.Equal(t, "模型测试", logs[2].TokenName)
}

// Flow 的 Token 维度按 token_id 聚合：token_id = 0 的行必须再按来源枚举拆分，
// 否则渠道测试和 Playground 会被合并成同一个节点。
func TestGetFlowQuotaDataSplitsTokenlessRowsBySource(t *testing.T) {
	truncateTables(t)

	seedFlowQuotaData(t, QuotaData{
		UserID:      1,
		Username:    "alice",
		TokenID:     0,
		TokenSource: QuotaTokenSourceChannelTest,
		UseGroup:    "default",
		ModelName:   "gpt-a",
		ChannelID:   1,
		CreatedAt:   1000,
		Count:       1,
		Quota:       10,
		TokenUsed:   5,
	})
	seedFlowQuotaData(t, QuotaData{
		UserID:      1,
		Username:    "alice",
		TokenID:     0,
		TokenSource: QuotaTokenSourcePlayground,
		UseGroup:    "default",
		ModelName:   "gpt-a",
		ChannelID:   2,
		CreatedAt:   1000,
		Count:       1,
		Quota:       20,
		TokenUsed:   8,
	})

	rows, err := GetFlowQuotaData(900, 2000, "", 1, common.RoleCommonUser)
	require.NoError(t, err)
	require.Len(t, rows, 2)
	require.Equal(t, QuotaTokenSourcePlayground, rows[0].TokenSource)
	require.Equal(t, QuotaTokenSourceChannelTest, rows[1].TokenSource)
	require.Equal(t, 0, rows[0].TokenID)
	require.Equal(t, 20, rows[0].Quota)
}

// 升级过渡期：同一个小时桶里旧行（token_source 为空）与升级后的枚举行并存时，
// 必须拆成两个节点，且 quota 总量既不能丢也不能重复计。
func TestGetFlowQuotaDataKeepsLegacyAndSourcedTokenlessRowsSeparate(t *testing.T) {
	truncateTables(t)

	seedFlowQuotaData(t, QuotaData{
		UserID:    1,
		Username:  "alice",
		TokenID:   0,
		UseGroup:  "default",
		ModelName: "gpt-a",
		ChannelID: 1,
		CreatedAt: 1000,
		Count:     1,
		Quota:     10,
		TokenUsed: 5,
	})
	seedFlowQuotaData(t, QuotaData{
		UserID:      1,
		Username:    "alice",
		TokenID:     0,
		TokenSource: QuotaTokenSourceChannelTest,
		UseGroup:    "default",
		ModelName:   "gpt-a",
		ChannelID:   1,
		CreatedAt:   1000,
		Count:       1,
		Quota:       20,
		TokenUsed:   8,
	})

	rows, err := GetFlowQuotaData(900, 2000, "", 1, common.RoleCommonUser)
	require.NoError(t, err)
	require.Len(t, rows, 2)
	require.Equal(t, QuotaTokenSourceChannelTest, rows[0].TokenSource)
	require.Equal(t, 20, rows[0].Quota)
	require.Empty(t, rows[1].TokenSource)
	require.Equal(t, 10, rows[1].Quota)
	require.Equal(t, 30, rows[0].Quota+rows[1].Quota)
}
