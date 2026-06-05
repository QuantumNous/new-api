package taskcommon

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

func newJSONCtx(body string) *gin.Context {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c
}

func newRelayInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		ChannelMeta:   &relaycommon.ChannelMeta{},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}
}

func TestBindSeedanceRequest_ValidSynthesizesTaskRequest(t *testing.T) {
	c := newJSONCtx(`{
		"model":"some-seedance-model",
		"content":[
			{"type":"text","text":"一只猫"},
			{"type":"image_url","image_url":{"url":"https://a/i.jpg"},"role":"first_frame"}
		]
	}`)
	info := newRelayInfo()

	req, err := BindSeedanceRequest(c, info, "generate")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if req.Model != "some-seedance-model" || req.PromptText() != "一只猫" {
		t.Errorf("parsed req mismatch: %+v", req)
	}
	if info.Action != "generate" {
		t.Errorf("info.Action = %q, want generate", info.Action)
	}

	stored, gerr := relaycommon.GetTaskRequest(c)
	if gerr != nil {
		t.Fatalf("task_request not stored: %v", gerr)
	}
	if stored.Prompt != "一只猫" {
		t.Errorf("synthesized prompt = %q", stored.Prompt)
	}
	if len(stored.Images) != 1 || stored.Images[0] != "https://a/i.jpg" {
		t.Errorf("synthesized images = %+v", stored.Images)
	}
}

func TestBindSeedanceRequest_Rejections(t *testing.T) {
	t.Run("empty content", func(t *testing.T) {
		if _, err := BindSeedanceRequest(newJSONCtx(`{"model":"m","content":[]}`), newRelayInfo(), "generate"); err == nil {
			t.Fatal("expected validation error")
		}
	})
	t.Run("malformed json", func(t *testing.T) {
		if _, err := BindSeedanceRequest(newJSONCtx(`{bad`), newRelayInfo(), "generate"); err == nil {
			t.Fatal("expected parse error")
		}
	})
}
