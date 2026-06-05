package service

import (
	"fmt"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupCompactReplacementTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	oldDB := model.DB
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	oldUsingSQLite := common.UsingSQLite
	oldUsingMySQL := common.UsingMySQL
	oldUsingPostgreSQL := common.UsingPostgreSQL

	gin.SetMode(gin.TestMode)
	common.MemoryCacheEnabled = false
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}))
	model.DB = db

	t.Cleanup(func() {
		model.DB = oldDB
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
		common.UsingSQLite = oldUsingSQLite
		common.UsingMySQL = oldUsingMySQL
		common.UsingPostgreSQL = oldUsingPostgreSQL
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func makeCompactReplacementChannel(id int, name string, status int, replacementID int) *model.Channel {
	channel := &model.Channel{
		Id:     id,
		Type:   1,
		Key:    fmt.Sprintf("key-%d", id),
		Status: status,
		Name:   name,
		Models: "gpt-5.4-openai-compact",
		Group:  "default",
	}
	channel.SetSetting(dto.ChannelSettings{CompactReplacementChannelID: replacementID})
	return channel
}

func TestResolveCompactReplacementChannel(t *testing.T) {
	db := setupCompactReplacementTestDB(t)
	source := makeCompactReplacementChannel(1, "source", common.ChannelStatusEnabled, 2)
	replacement := makeCompactReplacementChannel(2, "replacement", common.ChannelStatusEnabled, 0)
	require.NoError(t, db.Create(source).Error)
	require.NoError(t, db.Create(replacement).Error)

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	got, err := ResolveCompactReplacementChannel(ctx, source, "gpt-5.4-openai-compact", "", false)
	require.NoError(t, err)
	require.Equal(t, 2, got.Id)

	adminInfo := map[string]interface{}{}
	AppendCompactReplacementAdminInfo(ctx, adminInfo)
	require.Contains(t, adminInfo, "compact_replacement")
}

func TestResolveCompactReplacementChannelIgnoresNonCompactModel(t *testing.T) {
	_ = setupCompactReplacementTestDB(t)
	source := makeCompactReplacementChannel(1, "source", common.ChannelStatusEnabled, 2)

	got, err := ResolveCompactReplacementChannel(nil, source, "gpt-5.4", "", false)
	require.NoError(t, err)
	require.Equal(t, source, got)
}

func TestResolveCompactReplacementChannelSkipsStreamByDefault(t *testing.T) {
	db := setupCompactReplacementTestDB(t)
	source := makeCompactReplacementChannel(1, "source", common.ChannelStatusEnabled, 2)
	replacement := makeCompactReplacementChannel(2, "replacement", common.ChannelStatusEnabled, 0)
	require.NoError(t, db.Create(source).Error)
	require.NoError(t, db.Create(replacement).Error)

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	got, err := ResolveCompactReplacementChannel(ctx, source, "gpt-5.4-openai-compact", "", true)
	require.NoError(t, err)
	require.Equal(t, source, got)

	adminInfo := map[string]interface{}{}
	AppendCompactReplacementAdminInfo(ctx, adminInfo)
	require.NotContains(t, adminInfo, "compact_replacement")
}

func TestResolveCompactReplacementChannelUsesAllScopeForStream(t *testing.T) {
	db := setupCompactReplacementTestDB(t)
	source := makeCompactReplacementChannel(1, "source", common.ChannelStatusEnabled, 2)
	source.SetSetting(dto.ChannelSettings{
		CompactReplacementChannelID: 2,
		CompactReplacementScope:     dto.CompactReplacementScopeAll,
	})
	replacement := makeCompactReplacementChannel(2, "replacement", common.ChannelStatusEnabled, 0)
	require.NoError(t, db.Create(source).Error)
	require.NoError(t, db.Create(replacement).Error)

	got, err := ResolveCompactReplacementChannel(nil, source, "gpt-5.4-openai-compact", "", true)
	require.NoError(t, err)
	require.Equal(t, 2, got.Id)
}

func TestResolveCompactReplacementChannelRejectsDisabledTarget(t *testing.T) {
	db := setupCompactReplacementTestDB(t)
	source := makeCompactReplacementChannel(1, "source", common.ChannelStatusEnabled, 2)
	replacement := makeCompactReplacementChannel(2, "replacement", 2, 0)
	require.NoError(t, db.Create(source).Error)
	require.NoError(t, db.Create(replacement).Error)

	_, err := ResolveCompactReplacementChannel(nil, source, "gpt-5.4-openai-compact", "", false)
	require.Error(t, err)
	require.Contains(t, err.Error(), "未启用")
}

func TestResolveCompactReplacementChannelRejectsCycle(t *testing.T) {
	db := setupCompactReplacementTestDB(t)
	source := makeCompactReplacementChannel(1, "source", common.ChannelStatusEnabled, 2)
	replacement := makeCompactReplacementChannel(2, "replacement", common.ChannelStatusEnabled, 1)
	require.NoError(t, db.Create(source).Error)
	require.NoError(t, db.Create(replacement).Error)

	_, err := ResolveCompactReplacementChannel(nil, source, "gpt-5.4-openai-compact", "", false)
	require.Error(t, err)
	require.Contains(t, err.Error(), "存在循环")
}
