package service

import (
	"errors"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func withSnapshotTestDB(t *testing.T) {
	t.Helper()
	previousDB := model.DB
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.FailedRequestSnapshot{}))
	model.DB = db
	t.Cleanup(func() {
		model.DB = previousDB
	})
}

func TestSaveClientGoneRequestSnapshot(t *testing.T) {
	withSnapshotTestDB(t)
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest("POST", "/v1/responses", strings.NewReader(`{"model":"gpt-5.4","stream":true}`))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Request.Header.Set("User-Agent", "codex")
	ctx.Set(common.RequestIdKey, "req-client-gone")
	ctx.Set("channel_id", 50)
	ctx.Set("channel_name", "openai")
	ctx.Set("use_channel", []string{"50"})

	info := &relaycommon.RelayInfo{
		UserId:          1,
		TokenId:         2,
		OriginModelName: "gpt-5.4",
		RequestURLPath:  "/v1/responses",
		RelayFormat:     types.RelayFormatOpenAIResponses,
		StreamStatus:    relaycommon.NewStreamStatus(),
	}
	info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonClientGone, errors.New("context canceled"))

	SaveClientGoneRequestSnapshot(ctx, info)

	snapshot, err := model.GetFailedRequestSnapshotByRequestId("req-client-gone")
	require.NoError(t, err)
	require.Equal(t, model.FailedRequestSnapshotTypeClientGone, snapshot.SnapshotType)
	require.Equal(t, "/v1/responses", snapshot.RequestPath)
	require.Equal(t, "POST", snapshot.Method)
	require.Equal(t, 499, snapshot.StatusCode)
	require.Equal(t, "client_gone", snapshot.ErrorCode)
	require.Contains(t, snapshot.ErrorMessage, "context canceled")
	require.JSONEq(t, `{"model":"gpt-5.4","stream":true}`, snapshot.Body)
	require.Contains(t, snapshot.Headers, "User-Agent")
}

func TestSaveFinalFailedRequestSnapshot(t *testing.T) {
	withSnapshotTestDB(t)
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest("POST", "/v1/responses", strings.NewReader(`{"model":"gpt-5.4"}`))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set(common.RequestIdKey, "req-final-failed")
	ctx.Set("use_channel", []string{"38", "50"})

	info := &relaycommon.RelayInfo{
		UserId:          1,
		TokenId:         2,
		OriginModelName: "gpt-5.4",
		RequestURLPath:  "/v1/responses",
		RelayFormat:     types.RelayFormatOpenAIResponses,
	}
	newAPIError := types.NewErrorWithStatusCode(errors.New("bad gateway"), types.ErrorCodeBadResponseStatusCode, 502)

	SaveFinalFailedRequestSnapshot(ctx, info, newAPIError, `{"reason":"upstream_5xx"}`)

	snapshot, err := model.GetFailedRequestSnapshotByRequestId("req-final-failed")
	require.NoError(t, err)
	require.Equal(t, model.FailedRequestSnapshotTypeFinalFailed, snapshot.SnapshotType)
	require.Equal(t, "bad_response_status_code", snapshot.ErrorCode)
	require.Equal(t, 502, snapshot.StatusCode)
	require.Equal(t, `{"reason":"upstream_5xx"}`, snapshot.RetryDecision)
	require.JSONEq(t, `["38","50"]`, snapshot.UseChannel)
}
