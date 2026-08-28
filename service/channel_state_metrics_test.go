package service

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelStateMetricsExportsOneCurrentSamplePerChannel(t *testing.T) {
	queryCalls := 0
	handler := newChannelStateMetricsHandler(func() ([]model.ChannelStateSnapshot, error) {
		queryCalls++
		return []model.ChannelStateSnapshot{
			{ID: 1, Type: 1, Status: common.ChannelStatusEnabled},
			{ID: 2, Type: 14, Status: common.ChannelStatusManuallyDisabled},
			{ID: 3, Type: 18, Status: common.ChannelStatusAutoDisabled},
			{ID: 4, Type: 0, Status: 99},
		}, nil
	})
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/metrics", nil))

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, 1, queryCalls)
	assert.Equal(t, `# HELP new_api_channel_state Current persisted state of an AI channel (1 = current state).
# TYPE new_api_channel_state gauge
new_api_channel_state{channel_id="1",channel_type="1",state="enabled"} 1
new_api_channel_state{channel_id="2",channel_type="14",state="manually_disabled"} 1
new_api_channel_state{channel_id="3",channel_type="18",state="auto_disabled"} 1
new_api_channel_state{channel_id="4",channel_type="0",state="unknown"} 1
`, recorder.Body.String())
}

func TestChannelStateMetricsReturnsRedacted500OnQueryError(t *testing.T) {
	handler := newChannelStateMetricsHandler(func() ([]model.ChannelStateSnapshot, error) {
		return nil, errors.New("postgres://user:secret@db/channel_state")
	})
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/metrics", nil))

	require.Equal(t, http.StatusInternalServerError, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "channel state snapshot unavailable")
	assert.NotContains(t, recorder.Body.String(), "secret")
	assert.NotContains(t, recorder.Body.String(), "postgres://")
	assert.NotContains(t, recorder.Body.String(), "new_api_channel_state{")
}

func TestChannelStateMetricsHandlersUseIsolatedRegistries(t *testing.T) {
	query := func() ([]model.ChannelStateSnapshot, error) { return nil, nil }
	require.NotPanics(t, func() {
		first := newChannelStateMetricsHandler(query)
		second := newChannelStateMetricsHandler(query)
		for _, handler := range []http.Handler{first, second} {
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/metrics", nil))
			assert.Equal(t, http.StatusOK, recorder.Code)
		}
	})
}
