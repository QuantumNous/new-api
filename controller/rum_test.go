package controller

import (
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestValidateWebVitalSample(t *testing.T) {
	sample, ok := validateWebVitalSample(webVitalSample{Name: "lcp", Value: 2450, Rating: "good"})
	require.True(t, ok)
	require.Equal(t, "LCP", sample.Name)

	for _, invalid := range []webVitalSample{
		{Name: "FID", Value: 10, Rating: "good"},
		{Name: "INP", Value: -1, Rating: "poor"},
		{Name: "CLS", Value: math.NaN(), Rating: "good"},
		{Name: "LCP", Value: 1000, Rating: "unknown"},
	} {
		_, ok := validateWebVitalSample(invalid)
		require.False(t, ok)
	}
}

func TestRecordWebVitalIsDisabledWithMetrics(t *testing.T) {
	t.Setenv("METRICS_ENABLED", "false")
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/api/rum", RecordWebVital)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/rum", strings.NewReader(`{"name":"LCP","value":1000,"rating":"good"}`))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusNotFound, recorder.Code)
}
