package common

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"

	"github.com/gin-gonic/gin"
)

// The generation routes rewrite their path before the session bootstrap runs, so
// the /pg prefix is gone by the time relay info is built. Billing keys off
// IsPlayground, and losing it bills the request against a temporary token that
// holds no quota.
func TestPlaygroundMarkerSurvivesPathRewrite(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/images/generations", nil)

	if info := genBaseRelayInfo(c, nil); info.IsPlayground {
		t.Fatal("a plain /v1 request must not be treated as playground traffic")
	}

	c.Set(string(constant.ContextKeyPlaygroundRequest), true)
	if info := genBaseRelayInfo(c, nil); !info.IsPlayground {
		t.Fatal("the rewritten playground request lost its IsPlayground flag")
	}
}

// The browser used to send a number while the struct declares a string, and the
// whole submission failed on the type mismatch. Both shapes have to land.
func TestTaskSubmitReqSecondsAcceptsBothTypes(t *testing.T) {
	for _, body := range []string{`{"seconds":4}`, `{"seconds":"4"}`} {
		var req TaskSubmitReq
		if err := req.UnmarshalJSON([]byte(body)); err != nil {
			t.Fatalf("%s: %v", body, err)
		}
		if req.Seconds != "4" {
			t.Fatalf("%s: got %q", body, req.Seconds)
		}
	}
}
