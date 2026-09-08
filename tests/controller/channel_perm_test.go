package controller_test

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupChannelPermDB(t *testing.T) {
	t.Helper()
	// Redis 在测试环境未初始化，必须禁用，否则 GetUsernameById 调用 RDB 会 panic
	common.RedisEnabled = false
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err, "open in-memory sqlite")
	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}), "AutoMigrate")
}

// TestUpdateChannel_NonRootResponseOmitsActual 验证 C1 修复：
// UpdateChannel 对非 Root 用户的响应体中不含 actual_base_url / 真实地址。
// 修复前：UpdateWithOmit 末尾 First() 重新加载整行，致真实地址残留在 channel 对象并被序列化进响应。
// 修复后：c.JSON 之前对非 root 强制 nil，确保 omitempty 使该字段不出现在响应体中。
func TestUpdateChannel_NonRootResponseOmitsActual(t *testing.T) {
	setupChannelPermDB(t)
	gin.SetMode(gin.TestMode)

	realURL := "https://real.secret.example"
	ch := &model.Channel{
		Name:          "perm-test",
		Type:          1,
		Key:           "sk-test",
		Models:        "gpt-4",
		Group:         "default",
		ActualBaseURL: &realURL,
	}
	require.NoError(t, model.DB.Create(ch).Error, "create channel with ActualBaseURL")

	body := fmt.Sprintf(
		`{"id":%d,"name":"updated","type":1,"key":"sk-test","models":"gpt-4","group":"default"}`,
		ch.Id,
	)
	req := httptest.NewRequest(http.MethodPut, "/channel/", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("role", common.RoleAdminUser) // role=10, non-root (root requires >=100)

	controller.UpdateChannel(c)

	resp := w.Body.String()
	assert.NotContains(t, resp, "real.secret",
		"non-root UpdateChannel response must not expose the real ActualBaseURL value")
	assert.NotContains(t, resp, "actual_base_url",
		"non-root UpdateChannel response must not contain actual_base_url key")
}
