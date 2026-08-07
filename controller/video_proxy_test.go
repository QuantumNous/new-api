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
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestVideoProxyForwardsRangeForXAIResult(t *testing.T) {
	gin.SetMode(gin.TestMode)

	requestHeaders := make(chan http.Header, 1)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestHeaders <- r.Header.Clone()
		w.Header().Set("Accept-Ranges", "bytes")
		w.Header().Set("Content-Range", "bytes 1-3/6")
		w.Header().Set("Content-Type", "video/mp4")
		w.WriteHeader(http.StatusPartialContent)
		_, _ = w.Write([]byte("bcd"))
	}))
	t.Cleanup(upstream.Close)

	previousDB := model.DB
	previousDatabaseType := common.MainDatabaseType()
	previousMemoryCacheEnabled := common.MemoryCacheEnabled
	fetchSetting := system_setting.GetFetchSetting()
	previousFetchSetting := *fetchSetting

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Task{}))
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.MemoryCacheEnabled = false
	fetchSetting.EnableSSRFProtection = false
	service.InitHttpClient()
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousDatabaseType)
		common.MemoryCacheEnabled = previousMemoryCacheEnabled
		*fetchSetting = previousFetchSetting
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
	})

	channel := model.Channel{
		Type:   constant.ChannelTypeXai,
		Key:    "xai-key",
		Status: common.ChannelStatusEnabled,
		Name:   "xai-video-test",
	}
	require.NoError(t, db.Create(&channel).Error)
	task := model.Task{
		TaskID:    "task_public",
		Platform:  constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeXai)),
		UserId:    42,
		ChannelId: channel.Id,
		Status:    model.TaskStatusSuccess,
		PrivateData: model.TaskPrivateData{
			ResultURL: upstream.URL + "/video.mp4",
		},
	}
	require.NoError(t, db.Create(&task).Error)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/v1/videos/task_public/content", nil)
	c.Request.Header.Set("Range", "bytes=1-3")
	c.Request.Header.Set("If-Range", `"video-etag"`)
	c.Params = []gin.Param{{Key: "task_id", Value: task.TaskID}}
	c.Set("id", task.UserId)

	VideoProxy(c)

	require.Equal(t, http.StatusPartialContent, recorder.Code)
	assert.Equal(t, "bcd", recorder.Body.String())
	assert.Equal(t, "bytes 1-3/6", recorder.Header().Get("Content-Range"))
	assert.Equal(t, "bytes", recorder.Header().Get("Accept-Ranges"))
	assert.Equal(t, "private, max-age=86400", recorder.Header().Get("Cache-Control"))
	assert.Contains(t, recorder.Header().Values("Vary"), "Authorization")

	forwardedHeaders := <-requestHeaders
	assert.Equal(t, "bytes=1-3", forwardedHeaders.Get("Range"))
	assert.Equal(t, `"video-etag"`, forwardedHeaders.Get("If-Range"))
}
