package controller

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupChannelCreateTest(t *testing.T) int {
	t.Helper()
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousType, previousLogType := common.MainDatabaseType(), common.LogDatabaseType()
	previousMaster, previousCache, previousRedis, previousSQLite := common.IsMasterNode, common.MemoryCacheEnabled, common.RedisEnabled, common.SQLitePath
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(previousType, previousLogType)
		common.IsMasterNode, common.MemoryCacheEnabled, common.RedisEnabled, common.SQLitePath = previousMaster, previousCache, previousRedis, previousSQLite
	})
	t.Setenv("SQL_DSN", os.Getenv("TEST_CHANNEL_SQL_DSN"))
	t.Setenv("LOG_SQL_DSN", "")
	common.IsMasterNode, common.MemoryCacheEnabled, common.RedisEnabled = false, false, false
	common.SQLitePath = filepath.Join(t.TempDir(), "channel.db")
	require.NoError(t, model.InitDB())
	database := model.DB
	sqlDB, err := database.DB()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	model.LOG_DB = database
	common.SetLogDatabaseType(common.MainDatabaseType())
	require.NoError(t, database.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.User{}, &model.Log{}, &model.AuditLog{}))
	root := &model.User{Username: "channel-create-review-root", Role: common.RoleRootUser, Status: common.UserStatusEnabled}
	require.NoError(t, database.Create(root).Error)
	t.Cleanup(func() { require.NoError(t, database.Unscoped().Delete(root).Error) })
	versionQuery := "SELECT VERSION()"
	if common.UsingMainDatabase(common.DatabaseTypeSQLite) {
		versionQuery = "SELECT sqlite_version()"
	}
	var version string
	require.NoError(t, database.Raw(versionQuery).Scan(&version).Error)
	t.Logf("database=%s version=%s", common.MainDatabaseType(), version)
	return root.Id
}

func TestAddChannelReturnsCreatedIDs(t *testing.T) {
	rootID := setupChannelCreateTest(t)
	const firstKey, secondKey = "sk-create-id-first", "sk-create-id-second"
	const vertexArray = `["", {"project_id":"one"}, " \n ", " {\"project_id\":\"two\"} ", {"project_id":"one"}, null, 42]`
	vertexKeys := []string{`{"project_id":"one"}`, `{"project_id":"two"}`, `{"project_id":"one"}`, "null", "42"}
	const vertexSingle = `{
  "project_id": "single",
  "type": "service_account"
}`
	batchKeys := make([]string, 51)
	batchIndices := make([]int, len(batchKeys))
	for i := range batchKeys {
		batchKeys[i] = fmt.Sprintf("sk-create-id-%02d", i)
		batchIndices[i] = i + 1
	}
	for _, tc := range []struct {
		name             string
		mode             string
		key              string
		channelType      int
		settings         string
		wantKeys         []string
		wantInputIndices []int
	}{
		{name: "single", mode: "single", key: firstKey, wantKeys: []string{firstKey}, wantInputIndices: []int{0}},
		{name: "batch duplicate keys", mode: "batch", key: "\n" + firstKey + "\n\n" + firstKey + "\n" + secondKey, wantKeys: []string{firstKey, firstKey, secondKey}, wantInputIndices: []int{1, 3, 4}},
		{name: "batch one channel", mode: "batch", key: firstKey + "\n", wantKeys: []string{firstKey}, wantInputIndices: []int{0}},
		{name: "batch preserves whitespace", mode: "batch", key: "\n \n" + firstKey, wantKeys: []string{" ", firstKey}, wantInputIndices: []int{1, 2}},
		{name: "multi to single", mode: "multi_to_single", key: "\n " + firstKey + " \n\n" + secondKey + "\n", wantKeys: []string{firstKey + "\n" + secondKey}, wantInputIndices: []int{1, 3}},
		{name: "multi preserves trimmed blank", mode: "multi_to_single", key: firstKey + "\n \n" + secondKey, wantKeys: []string{firstKey + "\n\n" + secondKey}, wantInputIndices: []int{0, 1, 2}},
		{name: "multi whitespace only", mode: "multi_to_single", key: " ", wantKeys: []string{}, wantInputIndices: []int{}},
		{name: "multiple chunks", mode: "batch", key: "\n" + strings.Join(batchKeys, "\n"), wantKeys: batchKeys, wantInputIndices: batchIndices},
		{name: "empty batch", mode: "batch", key: "\n", wantKeys: []string{}, wantInputIndices: []int{}},
		{name: "vertex array", mode: "batch", key: vertexArray, channelType: constant.ChannelTypeVertexAi, wantKeys: vertexKeys, wantInputIndices: []int{1, 3, 4, 5, 6}},
		{name: "vertex multi", mode: "multi_to_single", key: vertexArray, channelType: constant.ChannelTypeVertexAi, wantKeys: []string{strings.Join(vertexKeys, "\n")}, wantInputIndices: []int{1, 3, 4, 5, 6}},
		{name: "single multiline json", mode: "single", key: vertexSingle, channelType: constant.ChannelTypeVertexAi, wantKeys: []string{vertexSingle}, wantInputIndices: []int{0}},
		{name: "vertex api key batch", mode: "batch", key: "\n" + firstKey + "\n\n" + secondKey, channelType: constant.ChannelTypeVertexAi, settings: `{"vertex_key_type":"api_key"}`, wantKeys: []string{firstKey, secondKey}, wantInputIndices: []int{1, 3}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			name := "created-id-" + tc.name
			existing := &model.Channel{Name: name, Type: 1, Key: firstKey, Models: "test-model", Group: "default"}
			require.NoError(t, existing.Insert())
			t.Cleanup(func() {
				var ids []int
				require.NoError(t, model.DB.Model(&model.Channel{}).Where("name = ?", name).Pluck("id", &ids).Error)
				_, err := model.BatchDeleteChannels(ids)
				require.NoError(t, err)
			})
			channel := &model.Channel{Name: name, Type: tc.channelType, Key: tc.key, Models: "test-model", Group: "default", OtherSettings: tc.settings}
			if channel.Type == 0 {
				channel.Type = constant.ChannelTypeOpenAI
			}
			if channel.Type == constant.ChannelTypeVertexAi {
				channel.Other = `{"default":"us-central1"}`
			}
			request, err := common.Marshal(AddChannelRequest{Mode: tc.mode, Channel: channel})
			require.NoError(t, err)
			response := postAddChannel(t, rootID, common.RoleRootUser, string(request))
			require.Equal(t, http.StatusOK, response.Code)
			var result struct {
				Success bool   `json:"success"`
				Message string `json:"message"`
				Data    struct {
					ID      *int  `json:"id"`
					IDs     []int `json:"ids"`
					Results []struct {
						InputIndex int `json:"input_index"`
						ChannelID  int `json:"channel_id"`
					} `json:"results"`
				} `json:"data"`
			}
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
			require.True(t, result.Success, response.Body.String())
			assert.Empty(t, result.Message)
			require.NotNil(t, result.Data.IDs, "empty creations must return an array, not null")
			require.Len(t, result.Data.IDs, len(tc.wantKeys))
			assert.NotContains(t, result.Data.IDs, existing.Id)
			var created []model.Channel
			require.NoError(t, model.DB.Where("name = ? AND id <> ?", name, existing.Id).Order("id").Find(&created).Error)
			require.Len(t, created, len(tc.wantKeys))
			for i, channel := range created {
				assert.Positive(t, result.Data.IDs[i])
				assert.Equal(t, channel.Id, result.Data.IDs[i])
				assert.Equal(t, tc.wantKeys[i], channel.Key)
				assert.Equal(t, tc.mode == "multi_to_single", channel.ChannelInfo.IsMultiKey)
			}
			require.NotNil(t, result.Data.Results, "empty creations must return an empty results array")
			require.Len(t, result.Data.Results, len(tc.wantInputIndices))
			results := make([]map[string]int, 0, len(tc.wantInputIndices))
			for i, inputIndex := range tc.wantInputIndices {
				channelIndex := i
				if tc.mode == "multi_to_single" {
					channelIndex = 0
				}
				assert.Equal(t, inputIndex, result.Data.Results[i].InputIndex)
				assert.Equal(t, created[channelIndex].Id, result.Data.Results[i].ChannelID)
				results = append(results, map[string]int{"input_index": inputIndex, "channel_id": created[channelIndex].Id})
			}
			if tc.mode == "multi_to_single" && len(created) == 1 {
				assert.Equal(t, len(tc.wantInputIndices), created[0].ChannelInfo.MultiKeySize)
			}
			data := map[string]any{"ids": result.Data.IDs, "results": results}
			if len(created) == 1 {
				require.NotNil(t, result.Data.ID)
				assert.Equal(t, created[0].Id, *result.Data.ID)
				data["id"] = created[0].Id
			} else {
				assert.Nil(t, result.Data.ID)
			}
			expected, err := common.Marshal(map[string]any{"success": true, "message": "", "data": data})
			require.NoError(t, err)
			assert.JSONEq(t, string(expected), response.Body.String(), "the response must contain only IDs, not channel credentials")
		})
	}
}

func TestAddChannelInvalidVertexBatchDoesNotReturnResults(t *testing.T) {
	rootID := setupChannelCreateTest(t)
	for _, mode := range []string{"batch", "multi_to_single"} {
		for _, key := range []string{"[]", `["", "  "]`, "[{"} {
			t.Run(mode+"/"+key, func(t *testing.T) {
				request, err := common.Marshal(AddChannelRequest{Mode: mode, Channel: &model.Channel{
					Name: "invalid-vertex-array", Type: constant.ChannelTypeVertexAi, Key: key,
					Models: "test-model", Group: "default", Other: `{"default":"us-central1"}`,
				}})
				require.NoError(t, err)
				response := postAddChannel(t, rootID, common.RoleRootUser, string(request))
				assert.Equal(t, http.StatusOK, response.Code)
				var result map[string]any
				require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
				assert.Equal(t, false, result["success"])
				assert.NotEmpty(t, result["message"])
				assert.NotContains(t, result, "data")
				var count int64
				require.NoError(t, model.DB.Model(&model.Channel{}).Where("name = ?", "invalid-vertex-array").Count(&count).Error)
				assert.Zero(t, count)
			})
		}
	}
}

func TestAddChannelRollbackDoesNotReturnIDs(t *testing.T) {
	rootID := setupChannelCreateTest(t)
	// Force a real database error in the second chunk, after the first 50 rows
	// received IDs. This constraint exists only in the isolated test database.
	column := `"key"`
	if common.UsingMainDatabase(common.DatabaseTypeMySQL) {
		column = "`key`(191)"
	}
	const indexName = "channel_create_test_unique_key"
	require.NoError(t, model.DB.Exec("CREATE UNIQUE INDEX "+indexName+" ON channels ("+column+")").Error)
	t.Cleanup(func() { require.NoError(t, model.DB.Migrator().DropIndex(&model.Channel{}, indexName)) })
	keys := make([]string, 51)
	for i := range keys[:50] {
		keys[i] = fmt.Sprintf("sk-create-rollback-%02d", i)
	}
	keys[50] = keys[0]
	request, err := common.Marshal(AddChannelRequest{Mode: "batch", Channel: &model.Channel{
		Name: "created-id-rollback", Type: 1, Key: strings.Join(keys, "\n"), Models: "test-model", Group: "default",
	}})
	require.NoError(t, err)
	response := postAddChannel(t, rootID, common.RoleRootUser, string(request))
	assert.Equal(t, http.StatusOK, response.Code)
	var result map[string]any
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	assert.Equal(t, false, result["success"])
	assert.NotEmpty(t, result["message"])
	assert.NotContains(t, result, "data")
	var channels, abilities int64
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("name = ?", "created-id-rollback").Count(&channels).Error)
	require.NoError(t, model.DB.Model(&model.Ability{}).Count(&abilities).Error)
	assert.Zero(t, channels)
	assert.Zero(t, abilities)
}

func TestAddChannelPanicRollsBackWithoutSuccess(t *testing.T) {
	rootID := setupChannelCreateTest(t)
	database := model.DB
	channelCreates := 0
	const callback = "test:channel-create-panic"
	require.NoError(t, database.Callback().Create().Before("gorm:create").Register(callback, func(tx *gorm.DB) {
		if tx.Statement.Table == "channels" {
			channelCreates++
			if channelCreates == 2 {
				panic("second channel chunk failed")
			}
		}
	}))
	t.Cleanup(func() { require.NoError(t, database.Callback().Create().Remove(callback)) })
	keys := make([]string, 51)
	for i := range keys {
		keys[i] = fmt.Sprintf("sk-create-panic-%02d", i)
	}
	request, err := common.Marshal(AddChannelRequest{Mode: "batch", Channel: &model.Channel{
		Name: "created-id-panic", Type: 1, Key: strings.Join(keys, "\n"), Models: "test-model", Group: "default",
	}})
	require.NoError(t, err)
	require.PanicsWithValue(t, "second channel chunk failed", func() {
		postAddChannel(t, rootID, common.RoleRootUser, string(request))
	}, "a rolled-back transaction must not reach the success response")
	assert.Equal(t, 2, channelCreates)
	var channels, abilities int64
	require.NoError(t, database.Model(&model.Channel{}).Where("name = ?", "created-id-panic").Count(&channels).Error)
	require.NoError(t, database.Model(&model.Ability{}).Count(&abilities).Error)
	assert.Zero(t, channels)
	assert.Zero(t, abilities)
}
