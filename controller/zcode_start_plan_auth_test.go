package controller

import (
	"fmt"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
)

func TestParseZcodeStartPlanProvider(t *testing.T) {
	for _, tc := range []struct {
		body, want string
		valid      bool
	}{
		{"", "zai", true},
		{`{}`, "zai", true},
		{`{"provider":"zai"}`, "zai", true},
		{`{"provider":"bigmodel"}`, "bigmodel", true},
		{`{"provider":"unknown"}`, "", false},
		{`{"provider":123}`, "", false},
		{`{"provider":`, "", false},
	} {
		t.Run(tc.body, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest("POST", "/auth/init", strings.NewReader(tc.body))
			provider, err := parseZcodeStartPlanProvider(c)
			if (err == nil) != tc.valid || provider != tc.want {
				t.Fatalf("provider = %q, err = %v", provider, err)
			}
		})
	}
}

func TestInitZcodeStartPlanAuthRejectsInvalidProvider(t *testing.T) {
	db := setupChannelStatusControllerTestDB(t)
	base := "zcode-start-plan"
	channel := model.Channel{Type: constant.ChannelTypeZhipu_v4, BaseURL: &base, Key: "original-jwt", Status: common.ChannelStatusEnabled}
	if err := db.Create(&channel).Error; err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Params = gin.Params{{Key: "id", Value: fmt.Sprint(channel.Id)}}
	c.Request = httptest.NewRequest("POST", "/auth/init", strings.NewReader(`{"provider":"unknown"}`))
	InitZcodeStartPlanAuth(c)
	var response struct {
		Success bool `json:"success"`
	}
	if err := common.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Success {
		t.Fatal("accepted invalid provider")
	}
	var unchanged model.Channel
	if err := db.First(&unchanged, channel.Id).Error; err != nil {
		t.Fatal(err)
	}
	if unchanged.Key != "original-jwt" {
		t.Fatal("invalid init changed the channel key")
	}
}

func TestZcodeStartPlanProviderSessionIsolation(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("GET", "/auth/poll?provider=zai", nil)
	sessions.Sessions("zcode-auth-test", cookie.NewStore([]byte("zcode-auth-session-test-secret")))(c)
	session := sessions.Default(c)
	session.Set(zcodeStartPlanAuthSessionKey(69, "provider"), "bigmodel")
	session.Set(zcodeStartPlanAuthSessionKey(70, "provider"), "zai")
	for id, want := range map[int]string{69: "bigmodel", 70: "zai", 71: "zai"} {
		got, err := zcodeStartPlanSessionProvider(session, id)
		if err != nil || got != want {
			t.Fatalf("channel %d provider = %q, err = %v", id, got, err)
		}
	}
	clearZcodeStartPlanAuthSession(c, 69)
	if session.Get(zcodeStartPlanAuthSessionKey(69, "provider")) != nil {
		t.Fatal("provider survived flow cleanup")
	}
	if got, _ := zcodeStartPlanSessionProvider(session, 70); got != "zai" {
		t.Fatal("cleanup affected another channel")
	}
	session.Set(zcodeStartPlanAuthSessionKey(69, "provider"), "unknown")
	if _, err := zcodeStartPlanSessionProvider(session, 69); err == nil {
		t.Fatal("accepted invalid session provider")
	}
}
