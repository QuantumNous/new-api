package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// resetQuotaDataTokenCache 清空内存缓存，避免测试间互相污染。
// 进入测试时立刻清空，并通过 t.Cleanup 在测试退出时再清空一次，
// 让"测试结束 → 包级 map 必为空"的不变量成立。
func resetQuotaDataTokenCache(t *testing.T) {
	t.Helper()
	clear := func() {
		CacheQuotaDataTokenLock.Lock()
		CacheQuotaDataToken = make(map[string]*QuotaDataToken)
		CacheQuotaDataTokenLock.Unlock()
	}
	clear()
	t.Cleanup(clear)
}

// -----------------------------------------------------------------------------
// 缓存键与累计语义（纯逻辑，不依赖 DB）
// -----------------------------------------------------------------------------

// 同一 (user_id, token_id, model_name, hour) 的多次调用必须聚合到同一桶；
// 这里同时验证 token_name 改名不会产生新桶（label 字段仅作刷新）。
func TestLogQuotaDataToken_RenameKeepsSingleBucket(t *testing.T) {
	resetQuotaDataTokenCache(t)

	// 同一小时内（3600 之内），同一 user_id+token_id+model，前后两次 token_name 不同
	const hourTs int64 = 3600 // 已是小时对齐
	LogQuotaDataToken(7, "alice", 42, "dev-key", "gpt-4o-mini", 100, hourTs+12, 50)
	LogQuotaDataToken(7, "alice", 42, "prod-key", "gpt-4o-mini", 200, hourTs+34, 70)

	require.Len(t, CacheQuotaDataToken, 1, "rename within same hour must not create a new bucket")
	for _, row := range CacheQuotaDataToken {
		assert.Equal(t, 7, row.UserID)
		assert.Equal(t, 42, row.TokenID)
		assert.Equal(t, 2, row.Count)
		assert.Equal(t, 300, row.Quota)
		assert.Equal(t, 120, row.TokenUsed)
		// label 字段刷新为最新值
		assert.Equal(t, "prod-key", row.TokenName)
		assert.Equal(t, "alice", row.Username)
		assert.Equal(t, hourTs, row.CreatedAt)
	}
}

// 时间戳必须向下取整到小时；非整小时调用应落入同一桶。
func TestLogQuotaDataToken_HourTruncation(t *testing.T) {
	resetQuotaDataTokenCache(t)

	// 任意 epoch 中两个相隔几十分钟但在同一小时内的时间戳
	LogQuotaDataToken(1, "u", 1, "k", "m", 10, 1_700_000_000, 5)
	LogQuotaDataToken(1, "u", 1, "k", "m", 10, 1_700_000_000+1500, 5)

	require.Len(t, CacheQuotaDataToken, 1)
	for _, row := range CacheQuotaDataToken {
		assert.Equal(t, int64(1_700_000_000-(1_700_000_000%3600)), row.CreatedAt)
		assert.Equal(t, 2, row.Count)
		assert.Equal(t, 20, row.Quota)
	}
}

// 不同 token_id 即使同名也必须落到不同桶。
func TestLogQuotaDataToken_DistinctTokenIdsAreSeparate(t *testing.T) {
	resetQuotaDataTokenCache(t)

	LogQuotaDataToken(1, "u", 1, "default", "m", 100, 3600, 10)
	LogQuotaDataToken(1, "u", 2, "default", "m", 300, 3600, 30)

	require.Len(t, CacheQuotaDataToken, 2)
}

// tokenId<=0 必须在函数入口直接丢弃，防止 caller 漏判 (channel-test、violation_fee 等
// 内部调用) 污染令牌看板。
func TestLogQuotaDataToken_SkipsNonPositiveTokenId(t *testing.T) {
	resetQuotaDataTokenCache(t)

	LogQuotaDataToken(1, "sys", 0, "", "m", 100, 3600, 10)
	LogQuotaDataToken(1, "sys", -1, "manual", "m", 100, 3600, 10)
	require.Empty(t, CacheQuotaDataToken, "tokenId<=0 must not enter the cache")

	// 同一调用上下文中正常令牌依然落入
	LogQuotaDataToken(1, "u", 5, "k", "m", 50, 3600, 5)
	require.Len(t, CacheQuotaDataToken, 1)
}

// -----------------------------------------------------------------------------
// SaveQuotaDataTokenCache — 落盘 + 自然键唯一性 + 多次 flush 累加
// -----------------------------------------------------------------------------

// 空缓存 flush 不应触发任何 DB 操作或日志爆炸。
func TestSaveQuotaDataTokenCache_NoopOnEmpty(t *testing.T) {
	truncateTables(t)
	resetQuotaDataTokenCache(t)

	require.NotPanics(t, func() { SaveQuotaDataTokenCache() })

	var count int64
	require.NoError(t, DB.Table("quota_data_tokens").Count(&count).Error)
	assert.Equal(t, int64(0), count)
}

// 两次 flush 同一 (user_id, token_id, model_name, hour) 必须只产生一行；
// count / quota / token_used 应正确累加；标签字段刷新为最新写入值。
func TestSaveQuotaDataTokenCache_UpsertAccumulates(t *testing.T) {
	truncateTables(t)
	resetQuotaDataTokenCache(t)

	const hourTs int64 = 7200
	LogQuotaDataToken(11, "alice", 100, "dev-key", "gpt-4o", 50, hourTs+10, 25)
	LogQuotaDataToken(11, "alice", 100, "dev-key", "gpt-4o", 50, hourTs+20, 25)
	SaveQuotaDataTokenCache()

	var first QuotaDataToken
	require.NoError(t,
		DB.Table("quota_data_tokens").
			Where("user_id = ? AND token_id = ? AND model_name = ? AND created_at = ?",
				11, 100, "gpt-4o", hourTs).
			First(&first).Error)
	assert.Equal(t, 2, first.Count)
	assert.Equal(t, 100, first.Quota)
	assert.Equal(t, 50, first.TokenUsed)
	assert.Equal(t, "dev-key", first.TokenName)

	// 第二次 flush —— 此时令牌已改名，依旧应聚合到同一行，且 token_name 刷新
	LogQuotaDataToken(11, "alice2", 100, "prod-key", "gpt-4o", 200, hourTs+30, 80)
	SaveQuotaDataTokenCache()

	var rows []QuotaDataToken
	require.NoError(t, DB.Table("quota_data_tokens").Find(&rows).Error)
	require.Len(t, rows, 1, "rename + cross-flush must not create a duplicate row")
	assert.Equal(t, 3, rows[0].Count)
	assert.Equal(t, 300, rows[0].Quota)
	assert.Equal(t, 130, rows[0].TokenUsed)
	assert.Equal(t, "prod-key", rows[0].TokenName)
	assert.Equal(t, "alice2", rows[0].Username)
}

// 唯一索引保护：如果同一 (user, token, model, hour) 行已存在，新一轮 flush
// 不会因 OnConflict 而失败，且通过 Updates 路径累加。
func TestSaveQuotaDataTokenCache_OnConflictDoesNotDuplicate(t *testing.T) {
	truncateTables(t)
	resetQuotaDataTokenCache(t)

	const hourTs int64 = 10800
	// 直接预埋一行
	require.NoError(t, DB.Table("quota_data_tokens").Create(&QuotaDataToken{
		UserID:    9,
		Username:  "preexisting",
		TokenID:   55,
		TokenName: "old-name",
		ModelName: "m",
		CreatedAt: hourTs,
		Count:     5,
		Quota:     500,
		TokenUsed: 200,
	}).Error)

	// 触发一次 LogQuotaDataToken，应通过 OnConflict DoNothing + Updates 累加
	LogQuotaDataToken(9, "new-name", 55, "new-token-name", "m", 100, hourTs+5, 40)
	SaveQuotaDataTokenCache()

	var rows []QuotaDataToken
	require.NoError(t, DB.Table("quota_data_tokens").Find(&rows).Error)
	require.Len(t, rows, 1)
	assert.Equal(t, 6, rows[0].Count)
	assert.Equal(t, 600, rows[0].Quota)
	assert.Equal(t, 240, rows[0].TokenUsed)
	assert.Equal(t, "new-name", rows[0].Username)
	assert.Equal(t, "new-token-name", rows[0].TokenName)
}

// swap-then-flush 语义：flush 期间发生新的 LogQuotaDataToken 应进入下一次 flush，
// 而不会被丢弃。
func TestSaveQuotaDataTokenCache_SwapPreservesConcurrentWrites(t *testing.T) {
	truncateTables(t)
	resetQuotaDataTokenCache(t)

	const hourTs int64 = 14400
	LogQuotaDataToken(3, "u", 1, "k", "m", 10, hourTs, 1)
	SaveQuotaDataTokenCache()

	// flush 后立即写入：应是空 cache，新条目进入下一轮
	require.Empty(t, CacheQuotaDataToken)
	LogQuotaDataToken(3, "u", 1, "k", "m", 20, hourTs+30, 2)
	require.Len(t, CacheQuotaDataToken, 1)

	SaveQuotaDataTokenCache()
	var row QuotaDataToken
	require.NoError(t,
		DB.Table("quota_data_tokens").
			Where("user_id = ? AND token_id = ?", 3, 1).
			First(&row).Error)
	assert.Equal(t, 2, row.Count)
	assert.Equal(t, 30, row.Quota)
}

// -----------------------------------------------------------------------------
// GetTokenQuotaDates / GetUserTokenQuotaDates — 聚合 / 过滤 / 范围
// -----------------------------------------------------------------------------

func seedTokenAggregates(t *testing.T) {
	t.Helper()
	rows := []QuotaDataToken{
		{UserID: 1, Username: "alice", TokenID: 100, TokenName: "alice-k1", ModelName: "gpt-4o", CreatedAt: 3600, Count: 1, Quota: 10, TokenUsed: 5},
		{UserID: 1, Username: "alice", TokenID: 100, TokenName: "alice-k1", ModelName: "gpt-4o", CreatedAt: 7200, Count: 2, Quota: 20, TokenUsed: 10},
		{UserID: 1, Username: "alice", TokenID: 101, TokenName: "alice-k2", ModelName: "gpt-4o", CreatedAt: 3600, Count: 1, Quota: 5, TokenUsed: 3},
		{UserID: 2, Username: "bob", TokenID: 200, TokenName: "bob-k1", ModelName: "gpt-4o-mini", CreatedAt: 3600, Count: 4, Quota: 40, TokenUsed: 20},
		{UserID: 2, Username: "bob", TokenID: 200, TokenName: "bob-k1", ModelName: "gpt-4o", CreatedAt: 10800, Count: 1, Quota: 15, TokenUsed: 8}, // 范围外
	}
	for i := range rows {
		require.NoError(t, DB.Table("quota_data_tokens").Create(&rows[i]).Error)
	}
}

func TestGetTokenQuotaDates_AdminAllUsers(t *testing.T) {
	truncateTables(t)
	seedTokenAggregates(t)

	rows, err := GetTokenQuotaDates(0, 7200, "", "")
	require.NoError(t, err)
	// 期望：alice/100/gpt-4o (两小时) + alice/101/gpt-4o + bob/200/gpt-4o-mini = 4 行（按自然键聚合）
	assert.Len(t, rows, 4)
}

func TestGetTokenQuotaDates_FilterUsername(t *testing.T) {
	truncateTables(t)
	seedTokenAggregates(t)

	rows, err := GetTokenQuotaDates(0, 100000, "alice", "")
	require.NoError(t, err)
	for _, r := range rows {
		assert.Equal(t, "alice", r.Username)
		assert.Equal(t, 1, r.UserID)
	}
}

func TestGetTokenQuotaDates_FilterTokenName(t *testing.T) {
	truncateTables(t)
	seedTokenAggregates(t)

	rows, err := GetTokenQuotaDates(0, 100000, "", "alice-k2")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, 101, rows[0].TokenID)
}

func TestGetTokenQuotaDates_TimeRangeBound(t *testing.T) {
	truncateTables(t)
	seedTokenAggregates(t)

	// 排除 created_at=10800 的那行
	rows, err := GetTokenQuotaDates(0, 7200, "", "")
	require.NoError(t, err)
	for _, r := range rows {
		assert.LessOrEqual(t, r.CreatedAt, int64(7200))
	}
}

// 回归保护：跨 flush 改名到字典序更小的 token_name 时，查询必须返回最新的名字，
// 不能返回字典序更大的旧名（即不依赖 MAX 聚合）。
func TestGetTokenQuotaDates_RenameToLexSmaller(t *testing.T) {
	truncateTables(t)
	resetQuotaDataTokenCache(t)

	const hourTs int64 = 18000
	// 第一次写入旧名 "zeta-old"
	LogQuotaDataToken(20, "alice", 77, "zeta-old", "gpt-4o", 100, hourTs+5, 30)
	SaveQuotaDataTokenCache()

	// 第二次写入改名后的 "aaa-new"（字典序更小）
	LogQuotaDataToken(20, "alice", 77, "aaa-new", "gpt-4o", 200, hourTs+45, 60)
	SaveQuotaDataTokenCache()

	rows, err := GetTokenQuotaDates(0, hourTs+3600, "", "")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, "aaa-new", rows[0].TokenName, "should return latest name, not lex max")
	assert.Equal(t, 2, rows[0].Count)
	assert.Equal(t, 300, rows[0].Quota)
	assert.Equal(t, 90, rows[0].TokenUsed)
}

func TestGetUserTokenQuotaDates_ScopedToUser(t *testing.T) {
	truncateTables(t)
	seedTokenAggregates(t)

	rows, err := GetUserTokenQuotaDates(1, 0, 100000, "")
	require.NoError(t, err)
	require.NotEmpty(t, rows)
	for _, r := range rows {
		assert.Equal(t, 1, r.UserID)
	}
}
