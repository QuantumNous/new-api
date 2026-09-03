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
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func putUpdateChannel(t *testing.T, userID, role int, body string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Set("id", userID)
	context.Set("role", role)
	context.Request = httptest.NewRequest(http.MethodPut, "/api/channel", strings.NewReader(body))
	context.Request.Header.Set("Content-Type", "application/json")
	UpdateChannel(context)
	return recorder
}

func insertKeyStorageChannel(t *testing.T, channel model.Channel) *model.Channel {
	t.Helper()
	channel.Status = common.ChannelStatusEnabled
	channel.Name = "key-storage"
	channel.Models = "gpt-4o"
	channel.Group = "default"
	require.NoError(t, channel.Insert())
	// Insert() does not persist ChannelInfo through the multi-key recalculation path,
	// so write the intended starting state explicitly.
	require.NoError(t, channel.SaveKeyAndChannelInfo())
	return &channel
}

func keyStorageUpdateBody(channelID int, channelType int, extra string) string {
	return fmt.Sprintf(
		`{"id":%d,"type":%d,"name":"key-storage","models":"gpt-4o","group":"default",%s}`,
		channelID, channelType, extra,
	)
}

func TestUpdateChannelConvertsSingleKeyChannelToMultiKey(t *testing.T) {
	setupTaskPluginBindChannelTest(t)
	channel := insertKeyStorageChannel(t, model.Channel{Type: 1, Key: "sk-old"})

	recorder := putUpdateChannel(t, 1, common.RoleRootUser, keyStorageUpdateBody(
		channel.Id, 1,
		`"key_storage_mode":"multi","multi_key_mode":"polling","key":"sk-a\nsk-b\nsk-c"`,
	))
	require.Contains(t, recorder.Body.String(), `"success":true`)

	stored, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	assert.True(t, stored.ChannelInfo.IsMultiKey)
	assert.Equal(t, 3, stored.ChannelInfo.MultiKeySize)
	assert.Equal(t, constant.MultiKeyModePolling, stored.ChannelInfo.MultiKeyMode)
	assert.Equal(t, []string{"sk-a", "sk-b", "sk-c"}, stored.GetKeys())
}

func TestUpdateChannelConvertsMultiKeyChannelToSingleKeyWithNewKey(t *testing.T) {
	setupTaskPluginBindChannelTest(t)
	channel := insertKeyStorageChannel(t, model.Channel{
		Type: 1,
		Key:  "sk-a\nsk-b",
		ChannelInfo: model.ChannelInfo{
			IsMultiKey:             true,
			MultiKeySize:           2,
			MultiKeyMode:           constant.MultiKeyModePolling,
			MultiKeyStatusList:     map[int]int{1: common.ChannelStatusAutoDisabled},
			MultiKeyDisabledReason: map[int]string{1: "quota"},
			MultiKeyPollingIndex:   1,
		},
	})

	recorder := putUpdateChannel(t, 1, common.RoleRootUser, keyStorageUpdateBody(
		channel.Id, 1,
		`"key_storage_mode":"single","key":"sk-fresh"`,
	))
	require.Contains(t, recorder.Body.String(), `"success":true`)

	stored, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	assert.False(t, stored.ChannelInfo.IsMultiKey)
	assert.Equal(t, "sk-fresh", stored.Key)
	assert.Equal(t, 0, stored.ChannelInfo.MultiKeySize)
	assert.Empty(t, stored.ChannelInfo.MultiKeyStatusList)
	assert.Empty(t, stored.ChannelInfo.MultiKeyDisabledReason)
	assert.Zero(t, stored.ChannelInfo.MultiKeyPollingIndex)

	// The single-key runtime path must hand out exactly the new key.
	usedKey, index, keyErr := stored.GetNextEnabledKey()
	require.Nil(t, keyErr)
	assert.Equal(t, "sk-fresh", usedKey)
	assert.Zero(t, index)
}

func TestUpdateChannelRejectsInvalidKeyStorageConversions(t *testing.T) {
	setupTaskPluginBindChannelTest(t)
	singleKeyChannel := insertKeyStorageChannel(t, model.Channel{Type: 1, Key: "sk-old"})
	multiKeyChannel := insertKeyStorageChannel(t, model.Channel{
		Type: 1,
		Key:  "sk-a\nsk-b",
		ChannelInfo: model.ChannelInfo{
			IsMultiKey:   true,
			MultiKeySize: 2,
			MultiKeyMode: constant.MultiKeyModeRandom,
		},
	})
	// Vertex AI in API Key mode is the type gate that reaches applyKeyStorageMode;
	// Codex is rejected earlier by its credential format validation.
	vertexAPIKeyChannel := insertKeyStorageChannel(t, model.Channel{
		Type:          constant.ChannelTypeVertexAi,
		Key:           "vertex-key",
		Other:         `{"default":"us-central1"}`,
		OtherSettings: `{"vertex_key_type":"api_key"}`,
	})

	cases := []struct {
		name            string
		channel         *model.Channel
		channelType     int
		extra           string
		expectedMessage string
	}{
		{
			name:            "converting to single without a new key is rejected",
			channel:         multiKeyChannel,
			channelType:     1,
			extra:           `"key_storage_mode":"single"`,
			expectedMessage: "转换密钥模式必须提供新的密钥",
		},
		{
			name:            "converting to single with multiple keys is rejected",
			channel:         multiKeyChannel,
			channelType:     1,
			extra:           `"key_storage_mode":"single","key":"sk-a\nsk-b"`,
			expectedMessage: "转换为单密钥时必须只提供一把新密钥",
		},
		{
			name:            "converting to multi with a single key is rejected",
			channel:         singleKeyChannel,
			channelType:     1,
			extra:           `"key_storage_mode":"multi","key":"sk-only"`,
			expectedMessage: "转换为多密钥时至少需要两把密钥",
		},
		{
			name:            "converting an already multi-key channel to multi is rejected",
			channel:         multiKeyChannel,
			channelType:     1,
			extra:           `"key_storage_mode":"multi","key":"sk-a\nsk-b"`,
			expectedMessage: "渠道已经是多密钥模式",
		},
		{
			name:            "converting an already single-key channel to single is rejected",
			channel:         singleKeyChannel,
			channelType:     1,
			extra:           `"key_storage_mode":"single","key":"sk-new"`,
			expectedMessage: "渠道已经是单密钥模式",
		},
		{
			name:            "unsupported storage mode is rejected",
			channel:         singleKeyChannel,
			channelType:     1,
			extra:           `"key_storage_mode":"rotate","key":"sk-new"`,
			expectedMessage: "不支持的密钥存储模式",
		},
		{
			name:            "vertex api key channels cannot become multi-key",
			channel:         vertexAPIKeyChannel,
			channelType:     constant.ChannelTypeVertexAi,
			extra:           `"key_storage_mode":"multi","key":"vertex-a\nvertex-b","other":"{\"default\":\"us-central1\"}","settings":"{\"vertex_key_type\":\"api_key\"}"`,
			expectedMessage: "当前渠道类型不支持多密钥模式",
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			before, err := model.GetChannelById(testCase.channel.Id, true)
			require.NoError(t, err)

			recorder := putUpdateChannel(t, 1, common.RoleRootUser, keyStorageUpdateBody(
				testCase.channel.Id, testCase.channelType, testCase.extra,
			))
			body := recorder.Body.String()
			assert.Contains(t, body, `"success":false`)
			assert.Contains(t, body, testCase.expectedMessage)

			after, err := model.GetChannelById(testCase.channel.Id, true)
			require.NoError(t, err)
			assert.Equal(t, before.Key, after.Key)
			assert.Equal(t, before.ChannelInfo, after.ChannelInfo)
		})
	}
}

func TestUpdateChannelKeyStorageConversionRequiresSensitiveWrite(t *testing.T) {
	setupTaskPluginBindChannelTest(t)
	channel := insertKeyStorageChannel(t, model.Channel{Type: 1, Key: "sk-old"})

	recorder := putUpdateChannel(t, 2, common.RoleAdminUser, keyStorageUpdateBody(
		channel.Id, 1,
		`"key_storage_mode":"multi","key":"sk-a\nsk-b"`,
	))
	assert.Contains(t, recorder.Body.String(), `"success":false`)

	stored, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	assert.False(t, stored.ChannelInfo.IsMultiKey)
	assert.Equal(t, "sk-old", stored.Key)
}

func TestUpdateChannelConvertsVertexJsonChannelToMultiKeyUsingJsonArray(t *testing.T) {
	setupTaskPluginBindChannelTest(t)
	channel := insertKeyStorageChannel(t, model.Channel{
		Type:          constant.ChannelTypeVertexAi,
		Key:           `{"type":"service_account","project_id":"a"}`,
		Other:         `{"default":"us-central1"}`,
		OtherSettings: `{"vertex_key_type":"json"}`,
	})

	// A pretty-printed JSON array must be split per element; newline splitting
	// would shred one service account into several bogus keys.
	newKeys := strings.Join([]string{
		"[",
		`  {"type": "service_account", "project_id": "a"},`,
		`  {"type": "service_account", "project_id": "b"}`,
		"]",
	}, "\n")
	encodedKeys, err := common.Marshal(newKeys)
	require.NoError(t, err)

	recorder := putUpdateChannel(t, 1, common.RoleRootUser, keyStorageUpdateBody(
		channel.Id, constant.ChannelTypeVertexAi,
		fmt.Sprintf(
			`"key_storage_mode":"multi","key":%s,"other":"{\"default\":\"us-central1\"}","settings":"{\"vertex_key_type\":\"json\"}"`,
			encodedKeys,
		),
	))
	require.Contains(t, recorder.Body.String(), `"success":true`)

	stored, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	assert.True(t, stored.ChannelInfo.IsMultiKey)
	assert.Equal(t, 2, stored.ChannelInfo.MultiKeySize)
	assert.Len(t, stored.GetKeys(), 2)
}

func TestUpdateChannelDoesNotTrustOmittedVertexCredentialSettings(t *testing.T) {
	setupTaskPluginBindChannelTest(t)
	channel := insertKeyStorageChannel(t, model.Channel{
		Type:          constant.ChannelTypeVertexAi,
		Key:           "vertex-key",
		Other:         `{"default":"us-central1"}`,
		OtherSettings: `{"vertex_key_type":"api_key"}`,
	})

	// A partial update may omit type/settings. The conversion guard must use
	// the persisted channel configuration instead of treating it as Vertex JSON.
	recorder := putUpdateChannel(t, 1, common.RoleRootUser, fmt.Sprintf(
		`{"id":%d,"key_storage_mode":"multi","key":"vertex-a\nvertex-b"}`,
		channel.Id,
	))
	assert.Contains(t, recorder.Body.String(), `"success":false`)
	assert.Contains(t, recorder.Body.String(), "当前渠道类型不支持多密钥模式")

	stored, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	assert.Equal(t, "vertex-key", stored.Key)
	assert.False(t, stored.ChannelInfo.IsMultiKey)
}
