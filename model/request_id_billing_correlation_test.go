// This file is an external test package on purpose: it exercises the request
// id as it actually reaches billing, which means running the middleware that
// mints it, and middleware imports model.
package model_test

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// A same-stack upstream may return its own X-Oneapi-Request-Id. Response
// passthrough must never replace the local ID already handed to billing.
func TestUpstreamResponseCannotOverrideBillingRequestId(t *testing.T) {
	truncateLogs(t)

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(middleware.RequestId())
	engine.POST("/v1/images/generations", func(c *gin.Context) {
		c.Set("username", "image2-caller")
		upstream := &http.Response{
			StatusCode: http.StatusOK,
			Header: http.Header{
				"x-oneapi-request-id": []string{"upstream-new-api-request-id"},
				"X-Upstream-Note":     []string{"keep-me"},
				"Content-Length":      []string{"999"},
			},
			Body: io.NopCloser(bytes.NewReader([]byte(`{"ok":true}`))),
		}
		service.IOCopyBytesGracefully(c, upstream, []byte(`{"ok":true}`))
		model.RecordConsumeLog(c, 4242, model.RecordConsumeLogParams{
			ChannelId: 77,
			ModelName: "gpt-image-2",
			TokenName: "image-token",
			Quota:     250000,
			Group:     "gpt-image-2-4k",
		})
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	engine.ServeHTTP(recorder, request)

	var logs []model.Log
	require.NoError(t, model.LOG_DB.Where("type = ?", model.LogTypeConsume).Find(&logs).Error)
	require.Len(t, logs, 1)
	require.Equal(t, logs[0].RequestId, recorder.Header().Get(common.RequestIdKey),
		"upstream response headers must not break client-to-billing correlation")
	require.Equal(t, "keep-me", recorder.Header().Get("X-Upstream-Note"))
	require.Equal(t, "11", recorder.Header().Get("Content-Length"))
}

// A billing row is only auditable if the operator can get to it from something
// the caller was given. That path is one string: middleware.RequestId mints an
// id, sets it on the context and echoes it as a response header, and the
// consume log stores the value read back off that same context.
//
// Nothing had pinned the two ends together. Either half can be changed without
// breaking a compile -- a different header name, a different context key, a
// log write that forgets the field -- and the result is a charge that no
// support request can be traced to.
//
// These tests run the real middleware and the real log writer against the
// in-process SQLite database the model suite already uses. No production
// database, no network, no credentials.

func truncateLogs(t *testing.T) {
	t.Helper()
	require.NoError(t, model.LOG_DB.Exec("DELETE FROM logs").Error)
	t.Cleanup(func() { model.LOG_DB.Exec("DELETE FROM logs") })
}

// billingRoute builds an engine whose handler bills the caller, so the id in
// the response header and the id on the persisted row come from one request.
func billingRoute(t *testing.T, bill func(c *gin.Context)) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(middleware.RequestId())
	engine.GET("/v1/images/generations", func(c *gin.Context) {
		c.Set("username", "image2-caller")
		bill(c)
		c.Status(http.StatusOK)
	})
	return engine
}

func TestRequestIdOnTheResponseIndexesTheConsumeLog(t *testing.T) {
	truncateLogs(t)

	engine := billingRoute(t, func(c *gin.Context) {
		model.RecordConsumeLog(c, 4242, model.RecordConsumeLogParams{
			ChannelId:    77,
			ModelName:    "gpt-image-2",
			TokenName:    "image-token",
			Quota:        123456,
			Group:        "image2",
			Content:      "image2 smart routing acceptance",
			PromptTokens: 11,
		})
	})

	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/v1/images/generations", nil))

	headerId := recorder.Header().Get(common.RequestIdKey)
	require.NotEmpty(t, headerId, "the caller must be handed a request id it can quote")

	var logs []model.Log
	require.NoError(t, model.LOG_DB.Where("type = ?", model.LogTypeConsume).Find(&logs).Error)
	require.Len(t, logs, 1)
	require.Equal(t, headerId, logs[0].RequestId,
		"the billing row must carry the same id the caller was given")
	require.Equal(t, 123456, logs[0].Quota)
	require.Equal(t, 77, logs[0].ChannelId)

	// And the operator's actual lookup finds it by that id and nothing else.
	found, total, err := model.GetAllLogs(model.LogTypeConsume, 0, 0, "", "", "", 0, 10, 0, "", headerId)
	require.NoError(t, err)
	require.EqualValues(t, 1, total)
	require.Len(t, found, 1)
	require.Equal(t, 123456, found[0].Quota)

	_, total, err = model.GetAllLogs(model.LogTypeConsume, 0, 0, "", "", "", 0, 10, 0, "", headerId+"-not-this-one")
	require.NoError(t, err)
	require.EqualValues(t, 0, total, "a request id must not match a row it does not belong to")
}

// Two calls must not share an id, or one caller's quoted id would pull up
// another caller's charge.
func TestRequestIdsAreDistinctPerRequestAndBillSeparately(t *testing.T) {
	truncateLogs(t)

	quota := 1000
	engine := billingRoute(t, func(c *gin.Context) {
		quota += 500
		model.RecordConsumeLog(c, 4242, model.RecordConsumeLogParams{
			ChannelId: 77,
			ModelName: "gpt-image-2",
			Quota:     quota,
			Group:     "image2",
		})
	})

	ids := make([]string, 0, 2)
	for range 2 {
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/v1/images/generations", nil))
		ids = append(ids, recorder.Header().Get(common.RequestIdKey))
	}
	require.NotEqual(t, ids[0], ids[1], "each request must mint its own id")

	for index, id := range ids {
		found, total, err := model.GetAllLogs(model.LogTypeConsume, 0, 0, "", "", "", 0, 10, 0, "", id)
		require.NoError(t, err)
		require.EqualValues(t, 1, total, "request id %s must resolve to exactly one billing row", id)
		require.Equal(t, 1500+index*500, found[0].Quota)
	}
}

// Image2 smart routing can try more than one channel for a single client
// request. Every attempt it records, failed or charged, has to hang off the
// one id the caller holds, or a failover incident cannot be reconstructed from
// what the caller can tell you.
func TestOneRequestIdSpansEveryAttemptOfAFailover(t *testing.T) {
	truncateLogs(t)

	engine := billingRoute(t, func(c *gin.Context) {
		// First candidate is refused by the upstream.
		model.RecordErrorLog(c, 4242, 77, "gpt-image-2", "image-token", "upstream 503", 0, 1, false, "image2", nil)
		// The chain moves on and the second candidate serves the request.
		model.RecordConsumeLog(c, 4242, model.RecordConsumeLogParams{
			ChannelId: 88,
			ModelName: "gpt-image-2",
			Quota:     9000,
			Group:     "image2",
		})
	})

	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/v1/images/generations", nil))
	headerId := recorder.Header().Get(common.RequestIdKey)
	require.NotEmpty(t, headerId)

	var rows []model.Log
	require.NoError(t, model.LOG_DB.Where("request_id = ?", headerId).Order("channel_id asc").Find(&rows).Error)
	require.Len(t, rows, 2, "both the failed attempt and the charged attempt must carry the request id")
	require.Equal(t, model.LogTypeError, rows[0].Type)
	require.Equal(t, 77, rows[0].ChannelId)
	require.Equal(t, model.LogTypeConsume, rows[1].Type)
	require.Equal(t, 88, rows[1].ChannelId)
	require.Equal(t, 9000, rows[1].Quota)
}

// A handler that never went through the middleware has no id to record. The
// write must still succeed and simply leave the column empty: billing is not
// allowed to fail because tracing is missing, and an empty id must not be
// mistaken for a match.
func TestBillingWithoutARequestIdRecordsAnEmptyCorrelation(t *testing.T) {
	truncateLogs(t)

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.GET("/v1/images/generations", func(c *gin.Context) {
		model.RecordConsumeLog(c, 4242, model.RecordConsumeLogParams{
			ChannelId: 77,
			ModelName: "gpt-image-2",
			Quota:     42,
			Group:     "image2",
		})
		c.Status(http.StatusOK)
	})

	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/v1/images/generations", nil))
	require.Empty(t, recorder.Header().Get(common.RequestIdKey))

	var logs []model.Log
	require.NoError(t, model.LOG_DB.Where("type = ?", model.LogTypeConsume).Find(&logs).Error)
	require.Len(t, logs, 1)
	require.Empty(t, logs[0].RequestId)
	require.Equal(t, 42, logs[0].Quota)

	// An empty filter must not be read as "match the untraced rows".
	_, total, err := model.GetAllLogs(model.LogTypeConsume, 0, 0, "", "", "", 0, 10, 0, "", "")
	require.NoError(t, err)
	require.EqualValues(t, 1, total)
}
