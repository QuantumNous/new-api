package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

func TestGetHomePageContentReturnsConfiguredValue(t *testing.T) {
	gin.SetMode(gin.TestMode)

	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	previousValue, hadValue := common.OptionMap["HomePageContent"]
	common.OptionMap["HomePageContent"] = ""
	common.OptionMapRWMutex.Unlock()

	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		if hadValue {
			common.OptionMap["HomePageContent"] = previousValue
		} else {
			delete(common.OptionMap, "HomePageContent")
		}
		common.OptionMapRWMutex.Unlock()
	})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/home_page_content", nil)

	GetHomePageContent(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}
	expected := `{"data":"","message":"","success":true}`
	if recorder.Body.String() != expected {
		t.Fatalf("expected %s, got %s", expected, recorder.Body.String())
	}
}
