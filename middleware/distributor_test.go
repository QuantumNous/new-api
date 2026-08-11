package middleware

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupVertexStorageDistributorTest(t *testing.T) *gorm.DB {
	t.Helper()
	require.NoError(t, i18n.Init())
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

func TestVertexStoragePathExtractsBucketAsModel(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/vertexai/storage/v1/b/bucket-a/o", nil)
	c.Params = gin.Params{{Key: "bucket", Value: "bucket-a"}}

	got, shouldSelect, err := getModelRequest(c)

	require.NoError(t, err)
	assert.True(t, shouldSelect)
	assert.Equal(t, "storage:gs:bucket-a", got.Model)
	assert.Equal(t, relayconstant.RelayModeVertexStorage, c.GetInt("relay_mode"))
}

func TestVertexStoragePathRejectsInvalidBucket(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/vertexai/storage/v1/b/bucket-a/o", nil)
	c.Params = gin.Params{{Key: "bucket", Value: "bucket-a/path"}}

	_, _, err := getModelRequest(c)

	require.Error(t, err)
}

func TestVertexStoragePinnedChannelRequiresExactVertexBucket(t *testing.T) {
	db := setupVertexStorageDistributorTest(t)
	channels := []model.Channel{
		{Id: 5101, Name: "vertex-a", Type: constant.ChannelTypeVertexAi, Key: "vertex-a", Status: common.ChannelStatusEnabled, Group: "default", Models: "storage:gs:bucket-a"},
		{Id: 5102, Name: "vertex-b", Type: constant.ChannelTypeVertexAi, Key: "vertex-b", Status: common.ChannelStatusEnabled, Group: "default", Models: "storage:gs:bucket-b"},
		{Id: 5103, Name: "gemini-a", Type: constant.ChannelTypeGemini, Key: "gemini-a", Status: common.ChannelStatusEnabled, Group: "default", Models: "storage:gs:bucket-a"},
	}
	require.NoError(t, db.Create(&channels).Error)
	priority := int64(0)
	for _, channel := range channels {
		require.NoError(t, db.Create(&model.Ability{
			Group: channel.Group, Model: channel.Models, ChannelId: channel.Id,
			Enabled: true, Priority: &priority, Weight: 100,
		}).Error)
	}
	model.InitChannelCache()

	for _, testCase := range []struct {
		name       string
		channelID  string
		wantStatus int
		wantNext   bool
	}{
		{name: "matching Vertex bucket", channelID: "5101", wantStatus: http.StatusOK, wantNext: true},
		{name: "different Vertex bucket", channelID: "5102", wantStatus: http.StatusForbidden},
		{name: "Gemini channel", channelID: "5103", wantStatus: http.StatusForbidden},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			downstreamRan := false
			engine := gin.New()
			engine.Use(func(c *gin.Context) {
				common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
				common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
				common.SetContextKey(c, constant.ContextKeyTokenSpecificChannelId, testCase.channelID)
			})
			engine.GET(relayconstant.VertexStorageListRoute,
				DistributeByChannelType(constant.ChannelTypeVertexAi),
				func(c *gin.Context) {
					downstreamRan = true
					models := common.GetContextKeyStringSlice(c, constant.ContextKeyChannelModels)
					assert.Equal(t, []string{"storage:gs:bucket-a"}, models)
					c.Status(http.StatusOK)
				},
			)

			request := httptest.NewRequest(http.MethodGet, "/vertexai/storage/v1/b/bucket-a/o", nil)
			response := httptest.NewRecorder()
			engine.ServeHTTP(response, request)

			assert.Equal(t, testCase.wantStatus, response.Code)
			assert.Equal(t, testCase.wantNext, downstreamRan)
		})
	}
}
