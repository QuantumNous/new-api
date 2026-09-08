package model_test

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupChannelOmitDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err, "open in-memory sqlite")
	model.DB = db
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}), "AutoMigrate")
}

// TestUpdateWithOmit_PreservesActualBaseURL 核心不变量：
// 非 Root 路径调用 UpdateWithOmit("ActualBaseURL")，DB 中的 actual_base_url 不能被覆盖。
func TestUpdateWithOmit_PreservesActualBaseURL(t *testing.T) {
	setupChannelOmitDB(t)

	original := "https://real.upstream.example.com"
	ch := &model.Channel{
		Name:          "perm-test",
		Type:          1,
		Key:           "sk-x",
		Models:        "gpt-4",
		Group:         "default",
		ActualBaseURL: &original,
	}
	require.NoError(t, model.DB.Create(ch).Error, "create channel")
	t.Cleanup(func() { model.DB.Unscoped().Delete(ch) })

	// 模拟非 Root：更新其他字段，ActualBaseURL 设为 nil（客户端未传或已被置空）
	ch.Name = "perm-test-updated"
	ch.ActualBaseURL = nil
	require.NoError(t, ch.UpdateWithOmit("ActualBaseURL"), "UpdateWithOmit")

	var got model.Channel
	require.NoError(t, model.DB.First(&got, ch.Id).Error, "fetch after update")
	require.NotNil(t, got.ActualBaseURL, "actual_base_url should not be cleared by non-root update")
	assert.Equal(t, original, *got.ActualBaseURL, "actual_base_url value must be preserved")
	assert.Equal(t, "perm-test-updated", got.Name, "other fields should be updated normally")
}

// TestUpdate_RootClearsActualBaseURL 验证 root 路径普通 Update() 能将 ActualBaseURL 清为空串，
// 即 GORM v2 对非 nil 指针（指向 ""）会正常写库，Step 5.5 的额外 Select 属于 dead code。
func TestUpdate_RootClearsActualBaseURL(t *testing.T) {
	setupChannelOmitDB(t)

	original := "https://real.example.com"
	ch := &model.Channel{
		Name:          "root-clear-test",
		Type:          1,
		Key:           "sk-root",
		Models:        "gpt-4",
		Group:         "default",
		ActualBaseURL: &original,
	}
	require.NoError(t, model.DB.Create(ch).Error, "create channel")
	t.Cleanup(func() { model.DB.Unscoped().Delete(ch) })

	// 重新取出，模拟 root 请求将 ActualBaseURL 设为空串
	var fetched model.Channel
	require.NoError(t, model.DB.First(&fetched, ch.Id).Error, "fetch before update")
	empty := ""
	fetched.ActualBaseURL = &empty
	require.NoError(t, fetched.Update(), "Update with empty ActualBaseURL")

	var got model.Channel
	require.NoError(t, model.DB.First(&got, ch.Id).Error, "fetch after update")
	require.NotNil(t, got.ActualBaseURL, "ActualBaseURL should be non-nil (empty string pointer)")
	assert.Equal(t, "", *got.ActualBaseURL, "actual_base_url should have been cleared to empty string by Update()")
}

// TestActualBaseURL_OmitEmptyInJSON 非 Root 隐藏的底层保证：
// ActualBaseURL=nil 序列化后 JSON 中不应出现 actual_base_url 键（omitempty 标签）。
func TestActualBaseURL_OmitEmptyInJSON(t *testing.T) {
	ch := &model.Channel{
		Name:          "no-actual-url",
		Type:          1,
		Key:           "sk-y",
		Models:        "gpt-4",
		ActualBaseURL: nil, // 非 Root 路径会把这个设为 nil
	}

	data, err := common.Marshal(ch)
	require.NoError(t, err, "marshal channel")

	jsonStr := string(data)
	assert.NotContains(t, jsonStr, "actual_base_url",
		"ActualBaseURL=nil 时序列化 JSON 不应包含 actual_base_url 键（omitempty）")
}
