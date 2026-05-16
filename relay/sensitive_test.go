package relay

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func TestCheckPromptSensitiveForTaskRechecksChangedAutoGroup(t *testing.T) {
	withRelaySensitiveSettings(t, "", `{
		"version": 1,
		"rules": [
			{"id":"r-vip-video","name":"VIP Video","enabled":true,"groups":["vip"],"models":["veo-3"],"include_global_words":false,"words":["vip_block"]}
		]
	}`)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", nil)
	c.Set("task_request", relaycommon.TaskSubmitReq{Prompt: "please include vip_block"})

	info := &relaycommon.RelayInfo{
		OriginModelName: "veo-3",
		UsingGroup:      "default",
		TokenGroup:      "auto",
		UserGroup:       "default",
	}
	checkedScopes := make(map[string]struct{})

	if err := checkPromptSensitiveForTask(c, info, checkedScopes); err != nil {
		t.Fatalf("default task sensitive check returned %v, want nil", err)
	}

	common.SetContextKey(c, constant.ContextKeyAutoGroup, "vip")
	err := checkPromptSensitiveForTask(c, info, checkedScopes)
	if err == nil {
		t.Fatal("vip retry task sensitive check returned nil, want sensitive error")
	}
	if err.StatusCode != http.StatusBadRequest {
		t.Fatalf("StatusCode = %d, want %d", err.StatusCode, http.StatusBadRequest)
	}
	if err.Code != string(types.ErrorCodeSensitiveWordsDetected) {
		t.Fatalf("Code = %s, want %s", err.Code, types.ErrorCodeSensitiveWordsDetected)
	}
	if !err.LocalError {
		t.Fatal("task sensitive error should be local")
	}
	if err := checkPromptSensitiveForTask(c, info, checkedScopes); err != nil {
		t.Fatalf("same checked scope returned %v, want nil", err)
	}
}

func TestCheckPromptSensitiveForTaskSupportsSunoAndMetadataFields(t *testing.T) {
	withRelaySensitiveSettings(t, "", `{
		"version": 1,
		"rules": [
			{"id":"r-suno","name":"Suno","enabled":true,"models":["suno_music"],"include_global_words":false,"words":["suno_block"]},
			{"id":"r-video","name":"Video","enabled":true,"models":["veo-3"],"include_global_words":false,"words":["negative_block"]}
		]
	}`)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/suno/submit/music", nil)
	c.Set("task_request", &dto.SunoSubmitReq{
		GptDescriptionPrompt: "make a suno_block song",
		Prompt:               "clean prompt",
		Title:                "title",
		Tags:                 "tags",
	})

	info := &relaycommon.RelayInfo{
		OriginModelName: "suno_music",
		UsingGroup:      "default",
		TokenGroup:      "default",
		UserGroup:       "default",
	}
	if err := checkPromptSensitiveForTask(c, info, make(map[string]struct{})); err == nil {
		t.Fatal("suno prompt sensitive check returned nil, want sensitive error")
	}

	videoCtx, _ := gin.CreateTestContext(httptest.NewRecorder())
	videoCtx.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", nil)
	videoCtx.Set("task_request", relaycommon.TaskSubmitReq{
		Prompt: "clean prompt",
		Metadata: map[string]any{
			"negative_prompt": "negative_block",
			"content": []any{
				map[string]any{"type": "text", "text": "nested text"},
			},
		},
	})
	videoInfo := &relaycommon.RelayInfo{
		OriginModelName: "veo-3",
		UsingGroup:      "default",
		TokenGroup:      "default",
		UserGroup:       "default",
	}
	if err := checkPromptSensitiveForTask(videoCtx, videoInfo, make(map[string]struct{})); err == nil {
		t.Fatal("task metadata sensitive check returned nil, want sensitive error")
	}
}

func TestCheckPromptSensitiveForMidjourneyOnlyBlocksTextSubmitModes(t *testing.T) {
	withRelaySensitiveSettings(t, "", `{
		"version": 1,
		"rules": [
			{"id":"r-mj","name":"Midjourney","enabled":true,"models":["mj_imagine"],"include_global_words":false,"words":["mj_block"]}
		]
	}`)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/mj/submit/imagine", nil)

	info := &relaycommon.RelayInfo{
		RelayMode:  relayconstant.RelayModeMidjourneyImagine,
		UsingGroup: "default",
		TokenGroup: "default",
		UserGroup:  "default",
	}
	err := checkPromptSensitiveForMidjourney(c, info, &dto.MidjourneyRequest{
		Action: constant.MjActionImagine,
		Prompt: "paint mj_block skyline",
	})
	if err == nil {
		t.Fatal("midjourney imagine sensitive check returned nil, want sensitive error")
	}
	if err.Description != string(types.ErrorCodeSensitiveWordsDetected) {
		t.Fatalf("Description = %s, want %s", err.Description, types.ErrorCodeSensitiveWordsDetected)
	}

	fetchInfo := &relaycommon.RelayInfo{
		RelayMode:  relayconstant.RelayModeMidjourneyTaskFetch,
		UsingGroup: "default",
		TokenGroup: "default",
		UserGroup:  "default",
	}
	if err := checkPromptSensitiveForMidjourney(c, fetchInfo, &dto.MidjourneyRequest{
		Action: constant.MjActionImagine,
		Prompt: "paint mj_block skyline",
	}); err != nil {
		t.Fatalf("midjourney fetch sensitive check returned %v, want nil", err)
	}
}

func withRelaySensitiveSettings(t *testing.T, words string, rules string) {
	t.Helper()

	originalRules := setting.GetSensitiveCheckRulesCopy()
	originalWords := setting.GetSensitiveWordsCopy()
	originalCheckEnabled := setting.CheckSensitiveEnabled
	originalPromptEnabled := setting.CheckSensitiveOnPromptEnabled
	t.Cleanup(func() {
		setting.SensitiveWordsFromString(strings.Join(originalWords, "\n"))
		jsonRules, err := common.Marshal(originalRules)
		if err != nil {
			t.Errorf("marshal original sensitive rules: %v", err)
		} else if err := setting.SensitiveCheckRulesFromString(string(jsonRules)); err != nil {
			t.Errorf("restore sensitive rules: %v", err)
		}
		setting.CheckSensitiveEnabled = originalCheckEnabled
		setting.CheckSensitiveOnPromptEnabled = originalPromptEnabled
	})

	setting.CheckSensitiveEnabled = true
	setting.CheckSensitiveOnPromptEnabled = true
	setting.SensitiveWordsFromString(words)
	if err := setting.SensitiveCheckRulesFromString(rules); err != nil {
		t.Fatalf("SensitiveCheckRulesFromString returned error: %v", err)
	}
}
