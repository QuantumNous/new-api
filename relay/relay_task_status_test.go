package relay

import (
	"net/http/httptest"
	"testing"
	"time"

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

func initRelayTaskStatusTestDB(t *testing.T) {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	model.DB = db
	model.LOG_DB = db
	common.UsingSQLite = true

	require.NoError(t, db.AutoMigrate(&model.Task{}))
}

func TestUpsertPendingRelayTaskRecordKeepsInProgressStatus(t *testing.T) {
	initRelayTaskStatusTestDB(t)

	now := time.Now().Unix()
	existingTask := &model.Task{
		TaskID:     "task_async_video_existing",
		UserId:     1,
		Group:      "default",
		ChannelId:  9,
		Action:     constant.TaskActionGenerate,
		Status:     model.TaskStatusInProgress,
		Progress:   "30%",
		SubmitTime: now - 20,
		StartTime:  now - 10,
	}
	require.NoError(t, model.DB.Create(existingTask).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("task_request", relaycommon.TaskSubmitReq{
		Prompt:    "run forward only",
		RequestId: "creative-request-1",
	})

	info := &relaycommon.RelayInfo{
		UserId:          1,
		UsingGroup:      "vip",
		RequestId:       "internal-request-1",
		OriginModelName: "grok-imagine-1.0-video",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId: 11,
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			PublicTaskID: "task_async_video_existing",
			Action:       constant.TaskActionGenerate,
		},
	}

	upsertPendingRelayTaskRecord(ctx, info, constant.TaskPlatform("99"))

	var reloaded model.Task
	require.NoError(t, model.DB.Where("task_id = ?", existingTask.TaskID).First(&reloaded).Error)

	assert.EqualValues(t, model.TaskStatusInProgress, reloaded.Status)
	assert.Equal(t, "30%", reloaded.Progress)
	assert.Equal(t, "vip", reloaded.Group)
	assert.Equal(t, 11, reloaded.ChannelId)
	assert.Equal(t, "creative-request-1", reloaded.PrivateData.ClientRequestId)
	assert.Equal(t, "internal-request-1", reloaded.PrivateData.RequestId)
}
