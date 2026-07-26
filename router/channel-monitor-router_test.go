package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestChannelMonitorRoutesPreserveChannelCollectionRedirects(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)
	SetRelayRouter(engine)

	tests := []struct {
		name       string
		method     string
		statusCode int
	}{
		{name: "list", method: http.MethodGet, statusCode: http.StatusMovedPermanently},
		{name: "create", method: http.MethodPost, statusCode: http.StatusTemporaryRedirect},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(test.method, "/api/channel", nil)
			recorder := httptest.NewRecorder()

			engine.ServeHTTP(recorder, request)

			assert.Equal(t, test.statusCode, recorder.Code)
			assert.Equal(t, "/api/channel/", recorder.Header().Get("Location"))
		})
	}
}
