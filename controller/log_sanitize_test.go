package controller

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupLogSanitizeDB(t *testing.T) *model.Channel {
	t.Helper()
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousMain, previousLog := common.MainDatabaseType(), common.LogDatabaseType()
	previousRedis := common.RedisEnabled
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Log{}))
	model.DB, model.LOG_DB = db, db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(previousMain, previousLog)
		common.RedisEnabled = previousRedis
	})
	display, actual := "https://api.public.example", "https://real.internal.example"
	ch := &model.Channel{Type: 1, Key: "k", BaseURL: &display, ActualBaseURL: &actual, Status: 1}
	require.NoError(t, db.Create(ch).Error)
	return ch
}

func TestSanitizeLogsForRequesterRedactsForNonRoot(t *testing.T) {
	ch := setupLogSanitizeDB(t)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("role", common.RoleCommonUser)
	logs := []*model.Log{{ChannelId: ch.Id, Content: "upstream https://real.internal.example/v1 failed", Other: `{"url":"https://real.internal.example/x"}`}}
	sanitizeLogsForRequester(c, logs)
	assert.Equal(t, "upstream https://api.public.example/v1 failed", logs[0].Content)
	assert.Equal(t, `{"url":"https://api.public.example/x"}`, logs[0].Other)
}

func TestSanitizeLogsForRequesterKeepsRawForRoot(t *testing.T) {
	ch := setupLogSanitizeDB(t)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("role", common.RoleRootUser)
	logs := []*model.Log{{ChannelId: ch.Id, Content: "https://real.internal.example"}}
	sanitizeLogsForRequester(c, logs)
	assert.Equal(t, "https://real.internal.example", logs[0].Content)
}
