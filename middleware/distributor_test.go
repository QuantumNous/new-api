package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestMain(m *testing.M) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		panic("failed to open test db: " + err.Error())
	}
	model.DB = db
	common.UsingSQLite = true

	if err := db.AutoMigrate(&model.Task{}); err != nil {
		panic("failed to migrate test db: " + err.Error())
	}

	os.Exit(m.Run())
}

func resetTasks(t *testing.T) {
	t.Helper()
	require.NoError(t, model.DB.Exec("DELETE FROM tasks").Error)
}

func TestGetModelRequestVideoFetchByIDLoadsModelFromTask(t *testing.T) {
	resetTasks(t)

	task := &model.Task{
		TaskID: "task_test_fetch_model",
		UserId: 123,
		Properties: model.Properties{
			OriginModelName: "doubao-seedance-2-0-260128",
		},
	}
	require.NoError(t, model.DB.Create(task).Error)

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/video/generations/task_test_fetch_model", nil)
	ctx.Params = gin.Params{{Key: "task_id", Value: "task_test_fetch_model"}}
	common.SetContextKey(ctx, constant.ContextKeyUserId, 123)

	req, shouldSelectChannel, err := getModelRequest(ctx)
	require.NoError(t, err)
	require.False(t, shouldSelectChannel)
	require.Equal(t, "doubao-seedance-2-0-260128", req.Model)
}
