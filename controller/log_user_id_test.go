package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	backendI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestLogHandlersRejectInvalidUserId(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)

	handlers := map[string]gin.HandlerFunc{
		"list": GetAllLogs,
		"stat": GetLogsStat,
	}
	for name, handler := range handlers {
		for _, userId := range []string{"abc", "0", "-1"} {
			t.Run(name+"/"+userId, func(t *testing.T) {
				recorder := httptest.NewRecorder()
				ctx, _ := gin.CreateTestContext(recorder)
				ctx.Request = httptest.NewRequest(http.MethodGet, "/?user_id="+userId, nil)

				handler(ctx)

				require.Equal(t, http.StatusBadRequest, recorder.Code)
				require.JSONEq(t, `{"success":false,"message":"Invalid user ID"}`, recorder.Body.String())
			})
		}
	}
}
