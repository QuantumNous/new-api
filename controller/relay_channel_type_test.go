package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupVertexStorageRetryTest(t *testing.T) *gorm.DB {
	t.Helper()
	originalDB := model.DB
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))
	model.DB = db
	common.MemoryCacheEnabled = true
	t.Cleanup(func() {
		model.DB = originalDB
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		if originalMemoryCacheEnabled && originalDB != nil {
			model.InitChannelCache()
		}
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			require.NoError(t, sqlDB.Close())
		}
	})
	return db
}

func TestVertexStorageRetryKeepsVertexChannelType(t *testing.T) {
	db := setupVertexStorageRetryTest(t)
	modelName := "storage:gs:bucket-a"
	highPriority := int64(200)
	middlePriority := int64(100)
	lowPriority := int64(0)
	weight := uint(100)
	channels := []model.Channel{
		{Id: 6200, Name: "vertex-first", Type: constant.ChannelTypeVertexAi, Key: "vertex-first-key", Status: common.ChannelStatusEnabled, Group: "default", Models: modelName, Priority: &highPriority, Weight: &weight},
		{Id: 6201, Name: "gemini", Type: constant.ChannelTypeGemini, Key: "gemini-key", Status: common.ChannelStatusEnabled, Group: "default", Models: modelName, Priority: &middlePriority, Weight: &weight},
		{Id: 6202, Name: "vertex", Type: constant.ChannelTypeVertexAi, Key: "vertex-key", Status: common.ChannelStatusEnabled, Group: "default", Models: modelName, Priority: &lowPriority, Weight: &weight},
	}
	require.NoError(t, db.Create(&channels).Error)
	for _, channel := range channels {
		require.NoError(t, db.Create(&model.Ability{
			Group: channel.Group, Model: modelName, ChannelId: channel.Id,
			Enabled: true, Priority: channel.Priority, Weight: weight,
		}).Error)
	}
	model.InitChannelCache()

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/vertexai/storage/v1/b/bucket-a/o", nil)
	common.SetContextKey(c, constant.ContextKeyUserGroup, "default")

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: modelName,
		TokenGroup:      "default",
		ChannelMeta:     &relaycommon.ChannelMeta{},
	}
	retryParam := newRelayRetryParam(c, relayInfo)
	retryParam.SetRetry(1)

	assert.Equal(t, constant.ChannelTypeVertexAi, retryParam.RequiredChannelType)
	channel, relayErr := getChannel(c, relayInfo, retryParam)

	require.Nil(t, relayErr)
	require.NotNil(t, channel)
	assert.Equal(t, 6202, channel.Id)
	assert.Equal(t, constant.ChannelTypeVertexAi, channel.Type)
}
