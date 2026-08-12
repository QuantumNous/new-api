package service

import (
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCaptureUpstreamBillingReferencePersistsOnlyAllowlistedSuccessHeader(t *testing.T) {
	c, _ := gin.CreateTestContext(nil)
	CaptureUpstreamBillingReference(c, &http.Response{StatusCode: http.StatusOK, Header: http.Header{
		"X-Request-Id":        []string{"supplier-req_123:abc"},
		"X-Oneapi-Request-Id": []string{"must-remain-local"},
	}})

	other := map[string]interface{}{}
	appendUpstreamBillingReference(c, other)
	require.Equal(t, "supplier-req_123:abc", other["upstream_request_id"])
	require.Equal(t, "", c.GetString("X-Oneapi-Request-Id"))
}

func TestCaptureUpstreamBillingReferenceRejectsErrorAndUnsafeValues(t *testing.T) {
	for _, response := range []*http.Response{
		{StatusCode: http.StatusBadGateway, Header: http.Header{"X-Request-Id": []string{"supplier-ok"}}},
		{StatusCode: http.StatusOK, Header: http.Header{"X-Request-Id": []string{"contains space"}}},
		{StatusCode: http.StatusOK, Header: http.Header{"X-Oneapi-Request-Id": []string{"local-only"}}},
	} {
		c, _ := gin.CreateTestContext(nil)
		CaptureUpstreamBillingReference(c, response)
		other := map[string]interface{}{}
		appendUpstreamBillingReference(c, other)
		require.NotContains(t, other, "upstream_request_id")
	}
}
