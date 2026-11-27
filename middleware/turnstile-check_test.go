package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTurnstileCheckVerifiesWithSiteverify(t *testing.T) {
	previousEnabled, previousSecret, previousURL := common.TurnstileCheckEnabled, common.TurnstileSecretKey, turnstileVerifyURL
	t.Cleanup(func() {
		common.TurnstileCheckEnabled, common.TurnstileSecretKey, turnstileVerifyURL = previousEnabled, previousSecret, previousURL
	})
	common.TurnstileCheckEnabled, common.TurnstileSecretKey = true, "turnstile-secret"
	siteverify := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, r.ParseForm())
		assert.Equal(t, "turnstile-secret", r.PostForm.Get("secret"))
		assert.Equal(t, "198.51.100.9", r.PostForm.Get("remoteip"))
		switch r.PostForm.Get("response") {
		case "hang":
			// Answers only once the caller gives up on the request.
			<-r.Context().Done()
		case "valid":
			_, _ = w.Write([]byte(`{"success":true}`))
		default:
			_, _ = w.Write([]byte(`{"success":false}`))
		}
	}))
	t.Cleanup(siteverify.Close)
	turnstileVerifyURL = siteverify.URL

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.POST("/login", TurnstileCheck(), func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true, "message": "passed"}) })
	login := func(ctx context.Context, token string) string {
		request := httptest.NewRequest(http.MethodPost, "/login?turnstile="+token, nil).WithContext(ctx)
		request.RemoteAddr = "198.51.100.9:1234"
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, request)
		return recorder.Body.String()
	}

	assert.Contains(t, login(context.Background(), "valid"), `"message":"passed"`)
	assert.Contains(t, login(context.Background(), "invalid"), `"success":false`)
	assert.Contains(t, login(context.Background(), ""), "Turnstile token is empty")
	// The siteverify call follows the client request: a dropped request stops
	// waiting for Cloudflare and never reaches the handler.
	canceled, cancel := context.WithCancel(context.Background())
	cancel()
	body := login(canceled, "hang")
	assert.Contains(t, body, `"success":false`)
	assert.NotContains(t, body, "passed")
}
