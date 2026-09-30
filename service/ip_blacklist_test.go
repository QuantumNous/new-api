package service_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRecordInvalidKeyIPFailureAutoBlacklists(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousDB := model.DB
	previousRedis := common.RedisEnabled
	previousThreshold := constant.InvalidKeyIPBanThreshold

	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := database.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, database.AutoMigrate(&model.IpBlacklist{}))
	model.DB = database
	common.RedisEnabled = false
	constant.InvalidKeyIPBanThreshold = 3
	service.ResetInvalidKeyIPFailureMemoryForTest()
	require.NoError(t, model.LoadIpBlacklistCache())
	t.Cleanup(func() {
		model.DB = previousDB
		common.RedisEnabled = previousRedis
		constant.InvalidKeyIPBanThreshold = previousThreshold
		service.ResetInvalidKeyIPFailureMemoryForTest()
		require.NoError(t, sqlDB.Close())
	})

	ip := "198.51.100.20"
	for range 2 {
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
		ctx.Request.RemoteAddr = ip + ":443"
		service.RecordInvalidKeyIPFailure(ctx)
		assert.False(t, model.IsIpBlacklisted(ip))
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Request.RemoteAddr = ip + ":443"
	service.RecordInvalidKeyIPFailure(ctx)

	assert.True(t, model.IsIpBlacklisted(ip))
	rows, total, err := model.GetIpBlacklistPage(0, 10)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, rows, 1)
	assert.Equal(t, ip, rows[0].Ip)
	assert.Equal(t, 3, rows[0].HitCount)

	require.NoError(t, model.RemoveIpFromBlacklist(rows[0].Id))
	assert.False(t, model.IsIpBlacklisted(ip))
}

func TestRecordInvalidKeyIPFailureSkipsLoopback(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousDB := model.DB
	previousRedis := common.RedisEnabled
	previousThreshold := constant.InvalidKeyIPBanThreshold

	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := database.DB()
	require.NoError(t, err)
	require.NoError(t, database.AutoMigrate(&model.IpBlacklist{}))
	model.DB = database
	common.RedisEnabled = false
	constant.InvalidKeyIPBanThreshold = 1
	service.ResetInvalidKeyIPFailureMemoryForTest()
	require.NoError(t, model.LoadIpBlacklistCache())
	t.Cleanup(func() {
		model.DB = previousDB
		common.RedisEnabled = previousRedis
		constant.InvalidKeyIPBanThreshold = previousThreshold
		service.ResetInvalidKeyIPFailureMemoryForTest()
		require.NoError(t, sqlDB.Close())
	})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Request.RemoteAddr = "127.0.0.1:443"
	service.RecordInvalidKeyIPFailure(ctx)
	assert.False(t, model.IsIpBlacklisted("127.0.0.1"))
}
