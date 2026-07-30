package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestBytePlusAssetOriginResolverRunsWithPinnedLockedChannel(t *testing.T) {
	restoreDB := useControllerBytePlusAssetDBForTest(t)
	defer restoreDB()
	insertControllerBytePlusChannel(t, 131, common.ChannelStatusEnabled, constant.ChannelTypeBytePlus)

	c := newControllerBytePlusAssetContext()
	common.SetContextKey(c, constant.ContextKeyBytePlusAssetPinnedChannelID, 131)
	info := &relaycommon.RelayInfo{
		ChannelMeta:   &relaycommon.ChannelMeta{},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}

	called := false
	taskErr := resolveOriginTaskWithBytePlusAssetLock(c, info, func(_ *gin.Context, got *relaycommon.RelayInfo) *dto.TaskError {
		called = true
		locked, ok := got.LockedChannel.(*model.Channel)
		require.True(t, ok)
		require.NotNil(t, locked)
		require.Equal(t, 131, locked.Id)
		return nil
	})
	require.Nil(t, taskErr)
	require.True(t, called)
	locked, ok := info.LockedChannel.(*model.Channel)
	require.True(t, ok)
	require.Equal(t, 131, locked.Id)
}

func TestBytePlusAssetOriginResolverWithoutPinIsUnchanged(t *testing.T) {
	c := newControllerBytePlusAssetContext()
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}}

	called := false
	taskErr := resolveOriginTaskWithBytePlusAssetLock(c, info, func(_ *gin.Context, got *relaycommon.RelayInfo) *dto.TaskError {
		called = true
		require.Nil(t, got.LockedChannel)
		return nil
	})
	require.Nil(t, taskErr)
	require.True(t, called)
	require.Nil(t, info.LockedChannel)
}

func TestBytePlusAssetOriginResolverRejectsPinnedLockMutation(t *testing.T) {
	restoreDB := useControllerBytePlusAssetDBForTest(t)
	defer restoreDB()
	insertControllerBytePlusChannel(t, 131, common.ChannelStatusEnabled, constant.ChannelTypeBytePlus)

	c := newControllerBytePlusAssetContext()
	common.SetContextKey(c, constant.ContextKeyBytePlusAssetPinnedChannelID, 131)
	info := &relaycommon.RelayInfo{
		ChannelMeta:   &relaycommon.ChannelMeta{},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}

	taskErr := resolveOriginTaskWithBytePlusAssetLock(c, info, func(_ *gin.Context, got *relaycommon.RelayInfo) *dto.TaskError {
		got.LockedChannel = &model.Channel{Id: 132, Type: constant.ChannelTypeBytePlus, Status: common.ChannelStatusEnabled}
		return nil
	})
	requireBytePlusTaskError(t, taskErr, "asset_channel_conflict", http.StatusConflict)
}

func TestBytePlusAssetOriginResolverRejectsClearedPinnedLock(t *testing.T) {
	restoreDB := useControllerBytePlusAssetDBForTest(t)
	defer restoreDB()
	insertControllerBytePlusChannel(t, 131, common.ChannelStatusEnabled, constant.ChannelTypeBytePlus)

	c := newControllerBytePlusAssetContext()
	common.SetContextKey(c, constant.ContextKeyBytePlusAssetPinnedChannelID, 131)
	info := &relaycommon.RelayInfo{
		ChannelMeta:   &relaycommon.ChannelMeta{},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}

	taskErr := resolveOriginTaskWithBytePlusAssetLock(c, info, func(_ *gin.Context, got *relaycommon.RelayInfo) *dto.TaskError {
		got.LockedChannel = nil
		return nil
	})
	requireBytePlusTaskError(t, taskErr, "asset_channel_conflict", http.StatusConflict)
}

func TestBytePlusAssetOriginResolverRejectsPinnedLockMutationBeforeResolverError(t *testing.T) {
	restoreDB := useControllerBytePlusAssetDBForTest(t)
	defer restoreDB()
	insertControllerBytePlusChannel(t, 131, common.ChannelStatusEnabled, constant.ChannelTypeBytePlus)

	c := newControllerBytePlusAssetContext()
	common.SetContextKey(c, constant.ContextKeyBytePlusAssetPinnedChannelID, 131)
	info := &relaycommon.RelayInfo{
		ChannelMeta:   &relaycommon.ChannelMeta{},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}

	taskErr := resolveOriginTaskWithBytePlusAssetLock(c, info, func(_ *gin.Context, got *relaycommon.RelayInfo) *dto.TaskError {
		got.LockedChannel = &model.Channel{Id: 132, Type: constant.ChannelTypeBytePlus, Status: common.ChannelStatusEnabled}
		return &dto.TaskError{Code: "origin_resolver_failed", StatusCode: http.StatusBadGateway}
	})
	requireBytePlusTaskError(t, taskErr, "asset_channel_conflict", http.StatusConflict)
}

func TestBytePlusAssetOriginResolverRejectsSameIDUnavailablePinnedLockMutation(t *testing.T) {
	tests := []struct {
		name   string
		status int
		typ    int
	}{
		{name: "disabled", status: common.ChannelStatusManuallyDisabled, typ: constant.ChannelTypeBytePlus},
		{name: "non byteplus", status: common.ChannelStatusEnabled, typ: constant.ChannelTypeOpenAI},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			restoreDB := useControllerBytePlusAssetDBForTest(t)
			defer restoreDB()
			insertControllerBytePlusChannel(t, 131, common.ChannelStatusEnabled, constant.ChannelTypeBytePlus)

			c := newControllerBytePlusAssetContext()
			common.SetContextKey(c, constant.ContextKeyBytePlusAssetPinnedChannelID, 131)
			info := &relaycommon.RelayInfo{
				ChannelMeta:   &relaycommon.ChannelMeta{},
				TaskRelayInfo: &relaycommon.TaskRelayInfo{},
			}

			taskErr := resolveOriginTaskWithBytePlusAssetLock(c, info, func(_ *gin.Context, got *relaycommon.RelayInfo) *dto.TaskError {
				got.LockedChannel = &model.Channel{Id: 131, Type: tt.typ, Status: tt.status}
				return nil
			})
			requireBytePlusTaskError(t, taskErr, "asset_channel_unavailable", http.StatusServiceUnavailable)
		})
	}
}

func TestBytePlusAssetOriginResolverRechecksPinnedChannelAfterResolver(t *testing.T) {
	restoreDB := useControllerBytePlusAssetDBForTest(t)
	defer restoreDB()
	insertControllerBytePlusChannel(t, 131, common.ChannelStatusEnabled, constant.ChannelTypeBytePlus)

	c := newControllerBytePlusAssetContext()
	common.SetContextKey(c, constant.ContextKeyBytePlusAssetPinnedChannelID, 131)
	info := &relaycommon.RelayInfo{
		ChannelMeta:   &relaycommon.ChannelMeta{},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}

	taskErr := resolveOriginTaskWithBytePlusAssetLock(c, info, func(_ *gin.Context, _ *relaycommon.RelayInfo) *dto.TaskError {
		require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 131).Update("status", common.ChannelStatusManuallyDisabled).Error)
		return &dto.TaskError{Code: "task_channel_disable", StatusCode: http.StatusBadRequest}
	})
	requireBytePlusTaskError(t, taskErr, "asset_channel_unavailable", http.StatusServiceUnavailable)
}

func TestBytePlusAssetOriginResolverRejectsPinnedChannelMismatches(t *testing.T) {
	tests := []struct {
		name      string
		configure func(*gin.Context, *relaycommon.RelayInfo)
	}{
		{
			name: "context channel differs",
			configure: func(c *gin.Context, _ *relaycommon.RelayInfo) {
				common.SetContextKey(c, constant.ContextKeyChannelId, 132)
			},
		},
		{
			name: "relay info channel differs",
			configure: func(_ *gin.Context, info *relaycommon.RelayInfo) {
				info.ChannelMeta = &relaycommon.ChannelMeta{ChannelId: 132}
			},
		},
		{
			name: "locked channel differs",
			configure: func(_ *gin.Context, info *relaycommon.RelayInfo) {
				info.LockedChannel = &model.Channel{Id: 132}
			},
		},
		{
			name: "locked channel unexpected type",
			configure: func(_ *gin.Context, info *relaycommon.RelayInfo) {
				info.LockedChannel = "channel-131"
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			restoreDB := useControllerBytePlusAssetDBForTest(t)
			defer restoreDB()
			insertControllerBytePlusChannel(t, 131, common.ChannelStatusEnabled, constant.ChannelTypeBytePlus)

			c := newControllerBytePlusAssetContext()
			common.SetContextKey(c, constant.ContextKeyBytePlusAssetPinnedChannelID, 131)
			info := &relaycommon.RelayInfo{
				ChannelMeta:   &relaycommon.ChannelMeta{},
				TaskRelayInfo: &relaycommon.TaskRelayInfo{},
			}
			tt.configure(c, info)

			called := false
			taskErr := resolveOriginTaskWithBytePlusAssetLock(c, info, func(_ *gin.Context, _ *relaycommon.RelayInfo) *dto.TaskError {
				called = true
				return nil
			})
			require.False(t, called)
			requireBytePlusTaskError(t, taskErr, "asset_channel_conflict", http.StatusConflict)
		})
	}
}

func TestBytePlusAssetOriginResolverRejectsUnavailablePinnedChannel(t *testing.T) {
	tests := []struct {
		name   string
		status int
		typ    int
	}{
		{name: "disabled", status: common.ChannelStatusManuallyDisabled, typ: constant.ChannelTypeBytePlus},
		{name: "non byteplus", status: common.ChannelStatusEnabled, typ: constant.ChannelTypeOpenAI},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			restoreDB := useControllerBytePlusAssetDBForTest(t)
			defer restoreDB()
			insertControllerBytePlusChannel(t, 131, tt.status, tt.typ)

			c := newControllerBytePlusAssetContext()
			common.SetContextKey(c, constant.ContextKeyBytePlusAssetPinnedChannelID, 131)
			info := &relaycommon.RelayInfo{
				ChannelMeta:   &relaycommon.ChannelMeta{},
				TaskRelayInfo: &relaycommon.TaskRelayInfo{},
			}

			taskErr := resolveOriginTaskWithBytePlusAssetLock(c, info, func(_ *gin.Context, _ *relaycommon.RelayInfo) *dto.TaskError {
				t.Fatal("resolver should not run")
				return nil
			})
			requireBytePlusTaskError(t, taskErr, "asset_channel_unavailable", http.StatusServiceUnavailable)
			require.NotContains(t, strings.ToLower(taskErr.Message), "select")
			require.NotContains(t, strings.ToLower(taskErr.Message), "byte_plus")
		})
	}
}

func newControllerBytePlusAssetContext() *gin.Context {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	return c
}

func useControllerBytePlusAssetDBForTest(t *testing.T) func() {
	t.Helper()
	oldDB := model.DB
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}))
	sqlDB, err := db.DB()
	require.NoError(t, err)
	model.DB = db
	return func() {
		model.DB = oldDB
		model.InitChannelCache()
		if closeErr := sqlDB.Close(); closeErr != nil && !errors.Is(closeErr, gorm.ErrInvalidDB) {
			t.Fatalf("close sqlite: %v", closeErr)
		}
	}
}

func insertControllerBytePlusChannel(t *testing.T, id int, status int, typ int) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.Channel{
		Id:     id,
		Type:   typ,
		Key:    "test-api-key",
		Status: status,
		Name:   "byteplus-test",
		Group:  "default",
		Models: "seedance-2.0",
	}).Error)
}

func requireBytePlusTaskError(t *testing.T, taskErr *dto.TaskError, code string, status int) {
	t.Helper()
	require.NotNil(t, taskErr)
	require.Equal(t, code, taskErr.Code)
	require.Equal(t, status, taskErr.StatusCode)
	require.NotContains(t, taskErr.Message, "test-api-key")
}
