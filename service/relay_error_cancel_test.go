package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestClientCancellationStopsRetryAndSkipsChannelDisable(t *testing.T) {
	previousDB, previousType := model.DB, common.MainDatabaseType()
	previousCache, previousRedis := common.MemoryCacheEnabled, common.RedisEnabled
	previousAutoDisable, previousErrorLog := common.AutomaticDisableChannelEnabled, constant.ErrorLogEnabled
	previousRanges := operation_setting.AutomaticDisableStatusCodeRanges
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousType)
		common.MemoryCacheEnabled, common.RedisEnabled = previousCache, previousRedis
		common.AutomaticDisableChannelEnabled, constant.ErrorLogEnabled = previousAutoDisable, previousErrorLog
		operation_setting.AutomaticDisableStatusCodeRanges = previousRanges
	})

	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := database.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	require.NoError(t, database.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.User{}))

	model.DB = database
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.MemoryCacheEnabled, common.RedisEnabled = false, false
	common.AutomaticDisableChannelEnabled, constant.ErrorLogEnabled = true, false
	operation_setting.AutomaticDisableStatusCodeRanges = []operation_setting.StatusCodeRange{{Start: 500, End: 500}}

	channel := &model.Channel{Name: "healthy-channel", Key: "k", Type: 1, Status: common.ChannelStatusEnabled, Group: "default", Models: "gpt-4o"}
	require.NoError(t, channel.Insert())

	cancelErr := types.NewError(context.Canceled, types.ErrorCodeRequestCancelled, types.ErrOptionWithStatusCode(499), types.ErrOptionWithSkipRetry())
	assert.Equal(t, "local", RelayErrorSource(cancelErr))
	assert.False(t, ShouldDisableChannel(cancelErr))
	assert.True(t, operation_setting.IsAlwaysSkipRetryCode(types.ErrorCodeRequestCancelled))

	for _, tc := range []struct {
		name       string
		err        *types.NewAPIError
		wantSource string
	}{
		{
			name:       "normalized 499 request_cancelled",
			err:        cancelErr,
			wantSource: "local",
		},
		{
			name:       "unnormalized 500 do_request_failed with canceled request context",
			err:        types.NewError(context.Canceled, types.ErrorCodeDoRequestFailed),
			wantSource: "local",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			reqCtx, cancel := context.WithCancel(context.Background())
			cancel()
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil).WithContext(reqCtx)
			c.Set("auto_ban", true)

			decision := DecideRelayRetry(c, tc.err, 2)
			assert.Equal(t, PolicyDecision{Action: "stop", Reason: "client_cancelled", Source: "client"}, decision)

			RecordPolicyFailure(c, channel.Id, tc.err, decision)
			events := RequestPolicy(c).Events()
			require.Len(t, events, 2)
			assert.Equal(t, tc.wantSource, events[0].ErrorSource)
			assert.Equal(t, "client_cancelled", events[0].Decision.Reason)
			assert.Equal(t, "unchanged", events[1].Health)

			ProcessChannelError(c, types.ChannelError{ChannelId: channel.Id, ChannelName: channel.Name, AutoBan: true}, tc.err, nil)
			loaded, err := model.GetChannelById(channel.Id, true)
			require.NoError(t, err)
			assert.Equal(t, common.ChannelStatusEnabled, loaded.Status)
		})
	}
}

func TestDeadlineExceededContextDoesNotClassifyAsClientCancelled(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	reqCtx, cancel := context.WithDeadline(context.Background(), time.Now().Add(-time.Second))
	defer cancel()
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil).WithContext(reqCtx)

	doReqErr := types.NewError(context.DeadlineExceeded, types.ErrorCodeDoRequestFailed)
	assert.Equal(t, PolicyDecision{Action: "retry", Reason: "retry_status_matched", Source: "global"}, DecideRelayRetry(c, doReqErr, 1))
}
