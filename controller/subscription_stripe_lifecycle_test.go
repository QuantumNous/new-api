package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCancelRecurringRejectsInvalidBindingID(t *testing.T) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "binding_id", Value: "bad"}}
	ctx.Set("id", 901)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/subscription/self/recurring/bad/cancel", nil)

	CancelRecurringSubscription(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)
}

func TestResumeRecurringRejectsInvalidBindingID(t *testing.T) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "binding_id", Value: "0"}}
	ctx.Set("id", 901)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/subscription/self/recurring/0/resume", nil)

	ResumeRecurringSubscription(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)
}
