package service

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newStreamErrorLogTestContext() *gin.Context {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	c.Set("channel_name", "test-channel")
	c.Set("channel_type", 1)
	return c
}

func countErrorLogs(t *testing.T) int64 {
	t.Helper()
	var count int64
	require.NoError(t, model.LOG_DB.Model(&model.Log{}).Where("type = ?", model.LogTypeError).Count(&count).Error)
	return count
}

func TestRecordStreamErrorLogWritesMonitorEvent(t *testing.T) {
	model.LOG_DB.Exec("DELETE FROM logs")
	oldErrorLogEnabled := constant.ErrorLogEnabled
	constant.ErrorLogEnabled = true
	t.Cleanup(func() {
		constant.ErrorLogEnabled = oldErrorLogEnabled
		model.LOG_DB.Exec("DELETE FROM logs")
	})

	info := &relaycommon.RelayInfo{
		UserId:          7,
		OriginModelName: "gpt-5.6-sol",
		UserGroup:       "default",
		TokenId:         11,
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: 23},
		RequestURLPath:  "/v1/responses",
		StreamStatus:    relaycommon.NewStreamStatus(),
	}
	info.StreamStatus.RecordError("http2: response body closed")
	info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonScannerErr, errors.New("http2: response body closed"))

	RecordStreamErrorLog(newStreamErrorLogTestContext(), info)

	var log model.Log
	require.NoError(t, model.LOG_DB.Order("id DESC").First(&log).Error)
	assert.Equal(t, model.LogTypeError, log.Type)
	assert.Equal(t, 23, log.ChannelId)
	assert.Equal(t, "gpt-5.6-sol", log.ModelName)
	assert.True(t, log.IsStream)
	other, err := common.StrToMap(log.Other)
	require.NoError(t, err)
	assert.Equal(t, "transport", other["error_type"])
	assert.Equal(t, "stream_incomplete", other["error_code"])
	assert.Equal(t, float64(0), other["status_code"])
	streamStatus, ok := other["stream_status"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "scanner_error", streamStatus["end_reason"])
	assert.Equal(t, float64(1), streamStatus["error_count"])
}

func TestRecordStreamErrorLogSkipsClientCancellation(t *testing.T) {
	model.LOG_DB.Exec("DELETE FROM logs")
	oldErrorLogEnabled := constant.ErrorLogEnabled
	constant.ErrorLogEnabled = true
	t.Cleanup(func() {
		constant.ErrorLogEnabled = oldErrorLogEnabled
		model.LOG_DB.Exec("DELETE FROM logs")
	})

	info := &relaycommon.RelayInfo{
		ChannelMeta:  &relaycommon.ChannelMeta{ChannelId: 23},
		StreamStatus: relaycommon.NewStreamStatus(),
	}
	info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonClientGone, errors.New("context canceled"))

	RecordStreamErrorLog(newStreamErrorLogTestContext(), info)

	assert.Equal(t, int64(0), countErrorLogs(t))
}
