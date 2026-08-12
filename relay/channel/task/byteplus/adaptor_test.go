package byteplus

import (
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func newTestContext(body string) *gin.Context {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c
}

func TestParseTaskResultScrubsProviderFailure(t *testing.T) {
	info, err := (&TaskAdaptor{}).ParseTaskResult([]byte(`{
		"status":"failed",
		"error":{"code":"BadRequest","message":"bytepluses.com endpoint ep-test-secret rejected the prompt"}
	}`))
	if err != nil {
		t.Fatalf("ParseTaskResult error: %v", err)
	}
	if info.Reason != "task failed at upstream provider" {
		t.Fatalf("failure reason = %q", info.Reason)
	}
}

func TestDoResponseMalformedSubmitDoesNotExposeProviderBody(t *testing.T) {
	a := &TaskAdaptor{}
	c := newTestContext(`{"model":"seedance-2.0","content":[{"type":"text","text":"hello"}]}`)
	info := newTestRelayInfo("https://ark.ap-southeast.bytepluses.com", "test-key")
	info.PublicTaskID = "task_public"
	info.OriginModelName = "seedance-2.0"

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body: io.NopCloser(strings.NewReader(
			`{"error":"BytePlus bytepluses.com endpoint ep-test-secret rejected"`)),
	}
	_, _, taskErr := a.DoResponse(c, resp, info)
	if taskErr == nil {
		t.Fatal("DoResponse should reject malformed submit body")
	}
	assertNoBytePlusLeak(t, taskErr)
}

func TestConvertToOpenAIVideoUsesProxyURLAndScrubsErrors(t *testing.T) {
	a := &TaskAdaptor{}
	success := &model.Task{
		TaskID:     "task_public",
		Status:     model.TaskStatusSuccess,
		Progress:   "100%",
		Properties: model.Properties{OriginModelName: "seedance-2.0"},
		PrivateData: model.TaskPrivateData{
			ResultURL: "https://flatkey.example/v1/videos/task_public/content",
		},
		Data: []byte(`{"status":"succeeded","content":{"video_url":"https://cdn.bytepluses.com/private.mp4"}}`),
	}
	raw, err := a.ConvertToOpenAIVideo(success)
	if err != nil {
		t.Fatalf("ConvertToOpenAIVideo success error: %v", err)
	}
	var got dto.OpenAIVideo
	if err := common.Unmarshal(raw, &got); err != nil {
		t.Fatalf("unmarshal converted response: %v", err)
	}
	if got.Metadata["url"] != success.GetResultURL() {
		t.Fatalf("metadata.url = %v, want proxy %q", got.Metadata["url"], success.GetResultURL())
	}
	if strings.Contains(string(raw), "byteplus") {
		t.Fatalf("success response leaked provider data: %s", raw)
	}

	failure := &model.Task{
		TaskID:     "task_failed",
		Status:     model.TaskStatusFailure,
		FailReason: "BytePlus endpoint ep-test-secret failed",
	}
	raw, err = a.ConvertToOpenAIVideo(failure)
	if err != nil {
		t.Fatalf("ConvertToOpenAIVideo failure error: %v", err)
	}
	if err := common.Unmarshal(raw, &got); err != nil {
		t.Fatalf("unmarshal failed response: %v", err)
	}
	if got.Error == nil || got.Error.Message != "task failed at upstream provider" {
		t.Fatalf("failure error = %+v", got.Error)
	}
}

func assertNoBytePlusLeak(t *testing.T, taskErr *dto.TaskError) {
	t.Helper()
	text := taskErr.Message
	if taskErr.Error != nil {
		text += " " + taskErr.Error.Error()
	}
	for _, marker := range []string{"bytepluses.com", "BytePlus", "ep-test-secret"} {
		if strings.Contains(text, marker) {
			t.Fatalf("error leaked %q in %q", marker, text)
		}
	}
}

func TestExtractUpstreamVideoURL(t *testing.T) {
	raw := []byte(`{"status":"succeeded","content":{"video_url":"https://cdn.bytepluses.com/private.mp4"}}`)
	if got := ExtractUpstreamVideoURL(raw); got != "https://cdn.bytepluses.com/private.mp4" {
		t.Fatalf("video URL = %q", got)
	}
	if got := ExtractUpstreamVideoURL([]byte(`{"content":{}}`)); got != "" {
		t.Fatalf("empty video URL = %q", got)
	}
}

func newTestRelayInfo(baseURL, apiKey string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: baseURL,
			ApiKey:         apiKey,
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}
}

func TestIdentityAndModelList(t *testing.T) {
	a := &TaskAdaptor{}
	if got := a.GetChannelName(); got != "BytePlus" {
		t.Fatalf("channel name = %q, want BytePlus", got)
	}
	want := []string{"seedance-2.0", "seedance2.0-pro", "seedance-2.0-fast", "seedance-2.0-mini"}
	got := a.GetModelList()
	if len(got) != len(want) {
		t.Fatalf("model list = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("model[%d] = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestEstimateBillingUsesPublicModelPricingAcrossEndpointMappings(t *testing.T) {
	tests := []struct {
		name       string
		model      string
		resolution string
		hasVideo   bool
		want       float64
		wantRatio  bool
	}{
		{name: "2.0 720p video", model: "seedance-2.0", resolution: "720p", hasVideo: true, want: 43.0 / 70.0, wantRatio: true},
		{name: "2.0 1080p no video", model: "seedance-2.0", resolution: "1080p", want: 77.0 / 70.0, wantRatio: true},
		{name: "2.0 1080p video", model: "seedance-2.0", resolution: "1080p", hasVideo: true, want: 47.0 / 70.0, wantRatio: true},
		{name: "2.0 4k no video", model: "seedance-2.0", resolution: "4K", want: 40.0 / 70.0, wantRatio: true},
		{name: "2.0 4k video", model: "seedance-2.0", resolution: "4K", hasVideo: true, want: 24.0 / 70.0, wantRatio: true},
		{name: "pro exact alias", model: "seedance2.0-pro", resolution: "720p", hasVideo: true, want: 43.0 / 70.0, wantRatio: true},
		{name: "pro exact case alias", model: "Seedance2.0-pro", resolution: "720p", hasVideo: true, want: 43.0 / 70.0, wantRatio: true},
		{name: "pro max boundary does not match", model: "seedance2.0-pro-max", resolution: "720p", hasVideo: true},
		{name: "fast video", model: "seedance-2.0-fast", resolution: "4K", hasVideo: true, want: 33.0 / 56.0, wantRatio: true},
		{name: "mini video", model: "seedance-2.0-mini", resolution: "1080p", hasVideo: true, want: 21.0 / 35.0, wantRatio: true},
		{name: "mini baseline", model: "seedance-2.0-mini", resolution: "4K"},
		{name: "unknown model", model: "seedance-unknown", resolution: "720p", hasVideo: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			content := `[{"type":"text","text":"hello"}]`
			if tt.hasVideo {
				content = `[{"type":"text","text":"hello"},{"type":"video_url","video_url":{"url":"https://example.com/input.mp4"}}]`
			}
			c := newTestContext(`{"model":"` + tt.model + `","resolution":"` + tt.resolution + `","content":` + content + `}`)
			info := newTestRelayInfo("https://ark.example", "test-key")
			info.OriginModelName = tt.model
			info.UpstreamModelName = "ep-private-endpoint"

			a := &TaskAdaptor{}
			if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
				t.Fatalf("ValidateRequestAndSetAction error: %+v", taskErr)
			}
			ratios := a.EstimateBilling(c, info)
			got, ok := ratios["video_input"]
			if !tt.wantRatio {
				if ok {
					t.Fatalf("video_input ratio = %v, want no ratio", got)
				}
				return
			}
			if !ok {
				t.Fatal("video_input ratio missing")
			}
			if got != tt.want {
				t.Fatalf("video_input ratio = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestDoRequestEnforcesModerationSkipHeader(t *testing.T) {
	service.InitHttpClient()
	var moderationHeader, authorizationHeader string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		moderationHeader = r.Header.Get("x-ark-moderation-scene")
		authorizationHeader = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"upstream-task"}`))
	}))
	defer server.Close()

	info := newTestRelayInfo(server.URL, "test-key")
	a := &TaskAdaptor{}
	a.Init(info)
	c := newTestContext(`{"model":"seedance-2.0","content":[{"type":"text","text":"hello"}]}`)
	c.Request.Header.Set("x-ark-moderation-scene", "client-value")

	resp, err := a.DoRequest(c, info, strings.NewReader(`{"model":"seedance-2.0"}`))
	if err != nil {
		t.Fatalf("DoRequest error: %v", err)
	}
	defer resp.Body.Close()

	if moderationHeader != "skip-ark-moderation" {
		t.Fatalf("moderation header = %q, want fixed skip-ark-moderation", moderationHeader)
	}
	if authorizationHeader != "Bearer test-key" {
		t.Fatalf("authorization header = %q", authorizationHeader)
	}
}

func TestBuildRequestHeaderUsesStructuredAPIKeyOnly(t *testing.T) {
	info := newTestRelayInfo("https://ark.example", `{
		"api_key": "sentinel-api-key",
		"access_key_id": "sentinel-access-key-id",
		"secret_access_key": "sentinel-secret-key",
		"project_name": "test-project"
	}`)
	a := &TaskAdaptor{}
	req := httptest.NewRequest(http.MethodPost, "/upstream", nil)

	if err := a.BuildRequestHeader(newTestContext(`{}`), req, info); err != nil {
		t.Fatalf("BuildRequestHeader error: %v", err)
	}

	if got := req.Header.Get("Authorization"); got != "Bearer sentinel-api-key" {
		t.Fatalf("Authorization = %q", got)
	}
}

func TestFetchTaskUsesStructuredAPIKeyOnly(t *testing.T) {
	service.InitHttpClient()
	var authorizationHeader string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authorizationHeader = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"task-1","status":"succeeded"}`))
	}))
	defer server.Close()

	key := `{
		"api_key": "sentinel-api-key",
		"access_key_id": "sentinel-access-key-id",
		"secret_access_key": "sentinel-secret-key",
		"project_name": "test-project"
	}`
	resp, err := (&TaskAdaptor{}).FetchTask(server.URL, key, map[string]any{"task_id": "task-1"}, "")
	if err != nil {
		t.Fatalf("FetchTask error: %v", err)
	}
	defer resp.Body.Close()

	if authorizationHeader != "Bearer sentinel-api-key" {
		t.Fatalf("Authorization = %q", authorizationHeader)
	}
}

func TestBuildRequestBodyUsesConfiguredModelMapping(t *testing.T) {
	a := &TaskAdaptor{}
	info := newTestRelayInfo("https://ark.example", "test-key")
	info.IsModelMapped = true
	info.UpstreamModelName = "ep-test-configured-endpoint"
	a.Init(info)
	c := newTestContext(`{"model":"seedance-2.0","content":[{"type":"text","text":"hello"}]}`)

	body, err := a.BuildRequestBody(c, info)
	if err != nil {
		t.Fatalf("BuildRequestBody error: %v", err)
	}
	raw, err := io.ReadAll(body)
	if err != nil {
		t.Fatalf("read request body: %v", err)
	}
	var payload map[string]any
	if err := common.Unmarshal(raw, &payload); err != nil {
		t.Fatalf("unmarshal request body: %v", err)
	}
	if payload["model"] != "ep-test-configured-endpoint" {
		t.Fatalf("upstream model = %v, want configured mapping", payload["model"])
	}
}

func TestBuildRequestBodyRewritesResolvedAssetURIsOnly(t *testing.T) {
	a := &TaskAdaptor{}
	info := newTestRelayInfo("https://ark.example", "test-key")
	c := newTestContext(`{
		"model":"seedance-2.0",
		"content":[
			{"type":"text","text":"hello"},
			{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"},
			{"type":"video_url","video_url":{"url":"https://example.com/v.mp4"},"role":"reference_video"}
		]
	}`)
	common.SetContextKey(c, constant.ContextKeyBytePlusAssetRewriteMap, map[string]string{
		"asset://ast_1234567890abcdefABCDEF1234567890": "asset://upstream-image",
	})

	body, err := a.BuildRequestBody(c, info)
	if err != nil {
		t.Fatalf("BuildRequestBody error: %v", err)
	}
	raw, err := io.ReadAll(body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	if !strings.Contains(string(raw), `"url":"asset://upstream-image"`) {
		t.Fatalf("rewritten body missing upstream asset URI: %s", raw)
	}
	if !strings.Contains(string(raw), `"url":"https://example.com/v.mp4"`) {
		t.Fatalf("ordinary URL changed or missing: %s", raw)
	}

	var original dto.SeedanceVideoRequest
	if err := common.UnmarshalBodyReusable(c, &original); err != nil {
		t.Fatalf("re-read original body: %v", err)
	}
	if original.Content[1].ImageURL.URL != "asset://ast_1234567890abcdefABCDEF1234567890" {
		t.Fatalf("reusable body was mutated: %+v", original.Content[1].ImageURL)
	}
}

func TestBytePlusAssetBuildRequestBodyUsesGeneralizedRewriteMapBeforeLegacyMap(t *testing.T) {
	a := &TaskAdaptor{}
	info := newTestRelayInfo("https://ark.example", "test-key")
	c := newTestContext(`{"model":"seedance-2.0","content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]}`)
	common.SetContextKey(c, constant.ContextKeyAssetRewriteMap, map[string]string{
		"asset://ast_1234567890abcdefABCDEF1234567890": "asset://generalized-channel-asset",
	})
	common.SetContextKey(c, constant.ContextKeyBytePlusAssetRewriteMap, map[string]string{
		"asset://ast_1234567890abcdefABCDEF1234567890": "asset://legacy-wrong-channel-asset",
	})

	body, err := a.BuildRequestBody(c, info)
	if err != nil {
		t.Fatalf("BuildRequestBody error: %v", err)
	}
	raw, err := io.ReadAll(body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	if !strings.Contains(string(raw), `"url":"asset://generalized-channel-asset"`) {
		t.Fatalf("generalized rewrite map was not used: %s", raw)
	}
	if strings.Contains(string(raw), "legacy-wrong-channel-asset") {
		t.Fatalf("legacy map was mixed into generalized rewrite: %s", raw)
	}
}

func TestBytePlusAssetBuildRequestBodyRejectsWhenGeneralizedMapMissingReferencedAssetEvenIfLegacyHasIt(t *testing.T) {
	a := &TaskAdaptor{}
	info := newTestRelayInfo("https://ark.example", "test-key")
	c := newTestContext(`{"model":"seedance-2.0","content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]}`)
	common.SetContextKey(c, constant.ContextKeyAssetRewriteMap, map[string]string{})
	common.SetContextKey(c, constant.ContextKeyBytePlusAssetRewriteMap, map[string]string{
		"asset://ast_1234567890abcdefABCDEF1234567890": "asset://legacy-wrong-channel-asset",
	})

	_, err := a.BuildRequestBody(c, info)
	if err == nil || !strings.Contains(err.Error(), "invalid byteplus asset reference") {
		t.Fatalf("BuildRequestBody error = %v, want invalid asset reference", err)
	}
	assertNoAssetRewriteLeak(t, err)
}

func TestBytePlusAssetRealPersonBuildRequestBodyRewritesTwoMediaReferencesAndPreservesTextMentions(t *testing.T) {
	a := &TaskAdaptor{}
	info := newTestRelayInfo("https://ark.example", "test-key")
	c := newTestContext(`{
		"model":"seedance-2.0",
		"content":[
			{"type":"text","text":"plain asset://ast_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb mention"},
			{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"},
			{"type":"audio_url","audio_url":{"url":"asset://ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},"role":"reference_audio"},
			{"type":"video_url","video_url":{"url":"https://example.com/input.mp4"},"role":"reference_video"}
		]
	}`)
	common.SetContextKey(c, constant.ContextKeyBytePlusAssetRewriteMap, map[string]string{
		"asset://ast_1234567890abcdefABCDEF1234567890": "asset://upstream-image",
		"asset://ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": "asset://upstream-audio",
	})

	body, err := a.BuildRequestBody(c, info)
	if err != nil {
		t.Fatalf("BuildRequestBody error: %v", err)
	}
	raw, err := io.ReadAll(body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	if !strings.Contains(string(raw), `"url":"asset://upstream-image"`) {
		t.Fatalf("rewritten body missing image upstream asset URI: %s", raw)
	}
	if !strings.Contains(string(raw), `"url":"asset://upstream-audio"`) {
		t.Fatalf("rewritten body missing audio upstream asset URI: %s", raw)
	}
	if !strings.Contains(string(raw), `plain asset://ast_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb mention`) {
		t.Fatalf("text mention changed: %s", raw)
	}
	if !strings.Contains(string(raw), `"url":"https://example.com/input.mp4"`) {
		t.Fatalf("ordinary https video URL changed or missing: %s", raw)
	}
}
func TestRewriteBytePlusAssetReferencesPreservesLargeIntegerSeed(t *testing.T) {
	raw := []byte(`{"model":"seedance-2.0","seed":9007199254740993,"content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]}`)

	rewritten, err := rewriteBytePlusAssetReferences(raw, map[string]string{
		"asset://ast_1234567890abcdefABCDEF1234567890": "asset://upstream-image",
	})
	if err != nil {
		t.Fatalf("rewriteBytePlusAssetReferences error: %v", err)
	}
	if !strings.Contains(string(rewritten), `"seed":9007199254740993`) {
		t.Fatalf("large integer seed was not preserved exactly: %s", rewritten)
	}
	if !strings.Contains(string(rewritten), `"url":"asset://upstream-image"`) {
		t.Fatalf("strict asset URI was not rewritten: %s", rewritten)
	}
}

func TestBuildRequestBodyRejectsUnresolvedStrictAssetURI(t *testing.T) {
	a := &TaskAdaptor{}
	info := newTestRelayInfo("https://ark.example", "test-key")
	c := newTestContext(`{
		"model":"seedance-2.0",
		"content":[{"type":"audio_url","audio_url":{"url":"asset://ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},"role":"reference_audio"}]
	}`)

	_, err := a.BuildRequestBody(c, info)
	if err == nil || !strings.Contains(err.Error(), "invalid byteplus asset reference") {
		t.Fatalf("BuildRequestBody error = %v, want invalid asset reference", err)
	}
}

func TestBuildRequestBodyExtendsResolvedLocalAssetLeasesBeforeUpstreamSubmit(t *testing.T) {
	newBytePlusAdaptorAssetDB(t)
	asset := model.BytePlusAsset{
		PublicId: "ast_1234567890abcdefABCDEF1234567890", UserId: 7, ChannelId: 131,
		UpstreamAssetId: "upstream-image", AssetType: "Image", Status: model.BytePlusAssetStatusActive,
		LeaseUntil: 1000, CreatedTime: 100, UpdatedTime: 100,
	}
	if err := model.DB.Create(&asset).Error; err != nil {
		t.Fatalf("create asset: %v", err)
	}
	oldNow := bytePlusAssetLeaseNow
	bytePlusAssetLeaseNow = func() int64 { return 2000 }
	t.Cleanup(func() { bytePlusAssetLeaseNow = oldNow })
	a := &TaskAdaptor{}
	info := newTestRelayInfo("https://ark.example", "test-key")
	c := newTestContext(`{
		"model":"seedance-2.0",
		"execution_expires_after":3600,
		"content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]
	}`)
	common.SetContextKey(c, constant.ContextKeyUserId, 7)
	common.SetContextKey(c, constant.ContextKeyBytePlusAssetRewriteMap, map[string]string{
		"asset://ast_1234567890abcdefABCDEF1234567890": "asset://upstream-image",
	})

	body, err := a.BuildRequestBody(c, info)
	if err != nil {
		t.Fatalf("BuildRequestBody error: %v", err)
	}
	raw, err := io.ReadAll(body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	if !strings.Contains(string(raw), `"execution_expires_after":3600`) {
		t.Fatalf("body lost execution_expires_after: %s", raw)
	}
	var stored model.BytePlusAsset
	if err := model.DB.First(&stored, asset.Id).Error; err != nil {
		t.Fatalf("reload asset: %v", err)
	}
	if stored.LeaseUntil != 2000+72*60*60 || stored.UpdatedTime != 2000 {
		t.Fatalf("lease not conservatively extended for 72h: %+v", stored)
	}
}

func TestBuildRequestBodyExtendsAssetLeaseToRequestedWindowWhenAboveDefault(t *testing.T) {
	newBytePlusAdaptorAssetDB(t)
	asset := model.BytePlusAsset{
		PublicId: "ast_1234567890abcdefABCDEF1234567890", UserId: 7, ChannelId: 131,
		UpstreamAssetId: "upstream-image", AssetType: "Image", Status: model.BytePlusAssetStatusActive,
		CreatedTime: 100, UpdatedTime: 100,
	}
	if err := model.DB.Create(&asset).Error; err != nil {
		t.Fatalf("create asset: %v", err)
	}
	oldNow := bytePlusAssetLeaseNow
	bytePlusAssetLeaseNow = func() int64 { return 2000 }
	t.Cleanup(func() { bytePlusAssetLeaseNow = oldNow })
	a := &TaskAdaptor{}
	info := newTestRelayInfo("https://ark.example", "test-key")
	c := newTestContext(`{
		"model":"seedance-2.0",
		"execution_expires_after":259200,
		"content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]
	}`)
	common.SetContextKey(c, constant.ContextKeyUserId, 7)
	common.SetContextKey(c, constant.ContextKeyBytePlusAssetRewriteMap, map[string]string{
		"asset://ast_1234567890abcdefABCDEF1234567890": "asset://upstream-image",
	})

	_, err := a.BuildRequestBody(c, info)
	if err != nil {
		t.Fatalf("BuildRequestBody error: %v", err)
	}

	var stored model.BytePlusAsset
	if err := model.DB.First(&stored, asset.Id).Error; err != nil {
		t.Fatalf("reload asset: %v", err)
	}
	if stored.LeaseUntil != 2000+259200 {
		t.Fatalf("lease_until = %d, want %d", stored.LeaseUntil, int64(2000+259200))
	}
}

func TestBuildRequestBodyWithoutLocalAssetReferencesDoesNotNeedDatabase(t *testing.T) {
	db := newBytePlusAdaptorAssetDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sqlite handle: %v", err)
	}
	if err := sqlDB.Close(); err != nil {
		t.Fatalf("close sqlite: %v", err)
	}
	a := &TaskAdaptor{}
	info := newTestRelayInfo("https://ark.example", "test-key")
	c := newTestContext(`{"model":"seedance-2.0","execution_expires_after":259200,"content":[{"type":"text","text":"hello"}]}`)

	if _, err := a.BuildRequestBody(c, info); err != nil {
		t.Fatalf("BuildRequestBody without references error: %v", err)
	}
}

func TestRewriteBytePlusAssetReferencesRejectsUnsafeAssetMediaURLs(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{
			name: "native asset URI",
			body: `{"content":[{"type":"image_url","image_url":{"url":"asset://native-portrait"}}]}`,
		},
		{
			name: "wrong asset colon prefix",
			body: `{"content":[{"type":"video_url","video_url":{"url":"asset:ast_1234567890abcdefABCDEF1234567890"}}]}`,
		},
		{
			name: "wrong asset slash prefix",
			body: `{"content":[{"type":"audio_url","audio_url":{"url":"asset:/ast_1234567890abcdefABCDEF1234567890"}}]}`,
		},
		{
			name: "uppercase scheme",
			body: `{"content":[{"type":"image_url","image_url":{"url":"ASSET://ast_1234567890abcdefABCDEF1234567890"}}]}`,
		},
		{
			name: "leading whitespace",
			body: `{"content":[{"type":"video_url","video_url":{"url":" asset://ast_1234567890abcdefABCDEF1234567890"}}]}`,
		},
		{
			name: "trailing whitespace",
			body: `{"content":[{"type":"audio_url","audio_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890 "}}]}`,
		},
		{
			name: "strict unresolved",
			body: `{"content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"}}]}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := rewriteBytePlusAssetReferences([]byte(tt.body), map[string]string{})
			if err == nil {
				t.Fatal("expected unsafe asset reference error")
			}
			assertNoAssetRewriteLeak(t, err)
		})
	}
}

func TestRewriteBytePlusAssetReferencesPreservesOrdinaryBodyAndTextMentions(t *testing.T) {
	raw := []byte(`{"content":[{"type":"text","text":"plain asset://native-portrait mention"},{"type":"image_url","image_url":{"url":"https://example.com/i.png"}},{"type":"video_url","video_url":{"url":"http://example.com/v.mp4"}}]}`)

	rewritten, err := rewriteBytePlusAssetReferences(raw, map[string]string{})
	if err != nil {
		t.Fatalf("rewriteBytePlusAssetReferences error: %v", err)
	}
	if string(rewritten) != string(raw) {
		t.Fatalf("ordinary body changed:\ngot  %s\nwant %s", rewritten, raw)
	}
}

func assertNoAssetRewriteLeak(t *testing.T, err error) {
	t.Helper()
	text := err.Error()
	for _, marker := range []string{
		"asset://native-portrait",
		"asset://ast_1234567890abcdefABCDEF1234567890",
		"asset:ast_1234567890abcdefABCDEF1234567890",
		"asset:/ast_1234567890abcdefABCDEF1234567890",
		"upstream",
		"internal",
	} {
		if strings.Contains(text, marker) {
			t.Fatalf("error leaked %q in %q", marker, text)
		}
	}
}

func newBytePlusAdaptorAssetDB(t *testing.T) *gorm.DB {
	t.Helper()
	oldDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	model.DB = db
	t.Cleanup(func() {
		model.DB = oldDB
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
	if err := db.AutoMigrate(&model.BytePlusAsset{}); err != nil {
		t.Fatalf("migrate assets: %v", err)
	}
	return db
}

func TestBytePlusResolveDimensions(t *testing.T) {
	got, ok := resolveDimensions("1080p", true)
	if !ok {
		t.Fatal("expected dimensions to resolve")
	}
	if got["resolution"] != "1080p" || got["has_video"] != "true" {
		t.Fatalf("unexpected dims: %v", got)
	}
}

func TestBytePlusResolveDimensions_RejectsUnknown(t *testing.T) {
	if _, ok := resolveDimensions("banana", false); ok {
		t.Fatal("unknown resolution must not resolve")
	}
}

// Documents the token-rate -> per-second conversion so a future reader can
// verify configured values rather than trusting them. A lower per-token rate
// does not imply a lower per-second rate: 4K is the cheapest per token and the
// most expensive per second, because it carries ~9x the pixels of 720p.
func TestBytePlusRateConversionReference(t *testing.T) {
	perSecond := func(w, h, fps, usdPer1M float64) float64 {
		return w * h * fps / 1024 / 1e6 * usdPer1M
	}
	cases := []struct {
		name             string
		w, h, fps, rate  float64
		wantTokensPerSec float64
		wantUSDPerSec    float64
	}{
		{"720p @ $7.0/1M", 1280, 720, 24, 7.0, 21600, 0.1512},
		{"1080p @ $7.7/1M", 1920, 1080, 24, 7.7, 48600, 0.37422},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tokens := tc.w * tc.h * tc.fps / 1024
			if math.Abs(tokens-tc.wantTokensPerSec) > 1e-9 {
				t.Fatalf("tokens/s = %v, want %v", tokens, tc.wantTokensPerSec)
			}
			got := perSecond(tc.w, tc.h, tc.fps, tc.rate)
			if math.Abs(got-tc.wantUSDPerSec) > 1e-9 {
				t.Fatalf("usd/s = %v, want %v", got, tc.wantUSDPerSec)
			}
		})
	}
}

func TestBytePlusSecondBillingRatios_UsesConfiguredPrice(t *testing.T) {
	a := &TaskAdaptor{}
	a.secondBillingModel = "m1"
	a.secondBillingDims = map[string]string{"resolution": "720p", "has_video": "false"}
	a.secondBillingSeconds = 5
	a.secondBillingModelPrice = 0.14
	a.secondBillingRules = []billing_setting.VideoPriceRule{
		{Model: "m1", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 0.1512, Basis: billing_setting.BasisOutputDuration},
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := 0.1512 * 5 / 0.14
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

func TestBytePlusSecondBillingRatios_NotCapturedIsNoOp(t *testing.T) {
	a := &TaskAdaptor{}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil ratios, got %v", got)
	}
}

func TestBytePlusSecondBillingRatios_ConfiguredButUnmatchedErrors(t *testing.T) {
	a := &TaskAdaptor{}
	a.secondBillingModel = "m1"
	a.secondBillingDims = map[string]string{"resolution": "4k", "has_video": "false"}
	a.secondBillingSeconds = 5
	a.secondBillingModelPrice = 0.14
	a.secondBillingRules = []billing_setting.VideoPriceRule{
		{Model: "m1", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 0.1512, Basis: billing_setting.BasisOutputDuration},
	}
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

// installBytePlusVideoPriceRules loads a rule set into the live config and
// restores the previous configuration afterwards. It exercises the real
// GetVideoPriceRules path rather than hand-setting adapter fields, so a test
// using it proves EstimateBilling actually consults the configured table.
func installBytePlusVideoPriceRules(t *testing.T, rulesJSON string) {
	t.Helper()
	saved := map[string]string{}
	if err := config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}); err != nil {
		t.Fatalf("snapshot config: %v", err)
	}
	t.Cleanup(func() {
		if err := config.GlobalConfig.LoadFromDB(saved); err != nil {
			t.Fatalf("restore config: %v", err)
		}
	})
	if err := config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting_video.video_price_rules": rulesJSON,
	}); err != nil {
		t.Fatalf("install video price rules: %v", err)
	}
	if len(billing_setting.GetVideoPriceRules()) == 0 {
		t.Fatal("video price rules did not load; the config module name or key is wrong")
	}
}

func newBytePlusSecondBillingContext(t *testing.T, body string, modelName string) (*TaskAdaptor, *gin.Context, *relaycommon.RelayInfo) {
	t.Helper()
	c := newTestContext(body)
	info := newTestRelayInfo("https://ark.example", "test-key")
	info.OriginModelName = modelName
	// Task model mapping rewrites the upstream name to a private ep-* endpoint;
	// per-second pricing must key on the stable client-facing name.
	info.UpstreamModelName = "ep-private-endpoint"
	info.PriceData.UsePrice = true
	info.PriceData.ModelPrice = 0.14
	a := &TaskAdaptor{}
	if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("ValidateRequestAndSetAction error: %+v", taskErr)
	}
	return a, c, info
}

// The whole point of the conversion: a configured model must be priced from the
// table via SecondBillingRatios. Because TaskAdaptor embeds doubao.TaskAdaptor,
// the promoted SecondBillingRatios compiles and silently returns (nil, nil)
// unless byteplus captures into its OWN fields — this test is what catches that.
func TestBytePlusEstimateBillingConfiguredModelPricesPerSecond(t *testing.T) {
	installBytePlusVideoPriceRules(t, `[
		{"model":"seedance-2.0","match":{"resolution":"1080p","has_video":"false"},
		 "price_per_second":0.37422,"basis":"output_duration"}
	]`)

	a, c, info := newBytePlusSecondBillingContext(t,
		`{"model":"seedance-2.0","resolution":"1080p","duration":5,"content":[{"type":"text","text":"hello"}]}`,
		"seedance-2.0")

	// Whitelist-strict: the legacy video_input ratio must not also apply.
	if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
		t.Fatalf("configured model still returned legacy ratios: %v", ratios)
	}

	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	want := 0.37422 * 5 / 0.14
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

// BytePlus supports 1080p and 4K, which modelapiseedance does not. Every tier
// the upstream accepts must resolve, or a configured request would be rejected
// at submit time.
func TestBytePlusEstimateBillingCoversEveryUpstreamResolutionTier(t *testing.T) {
	installBytePlusVideoPriceRules(t, `[
		{"model":"seedance-2.0","match":{"resolution":"480p"},"price_per_second":0.06,"basis":"output_duration"},
		{"model":"seedance-2.0","match":{"resolution":"720p"},"price_per_second":0.1512,"basis":"output_duration"},
		{"model":"seedance-2.0","match":{"resolution":"1080p"},"price_per_second":0.37422,"basis":"output_duration"},
		{"model":"seedance-2.0","match":{"resolution":"4k"},"price_per_second":0.7776,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		resolution string
		want       float64
	}{
		{"480p", 0.06},
		{"720p", 0.1512},
		{"1080p", 0.37422},
		{"4K", 0.7776},
	} {
		t.Run(tc.resolution, func(t *testing.T) {
			a, c, info := newBytePlusSecondBillingContext(t,
				`{"model":"seedance-2.0","resolution":"`+tc.resolution+`","duration":5,"content":[{"type":"text","text":"hello"}]}`,
				"seedance-2.0")
			a.EstimateBilling(c, info)
			got, err := a.SecondBillingRatios()
			if err != nil {
				t.Fatalf("SecondBillingRatios error: %v", err)
			}
			want := tc.want * 5 / 0.14
			if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
				t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
			}
		})
	}
}

// An omitted resolution renders at Ark's 720p tier; it must be priced from the
// 720p rule rather than failing to resolve.
func TestBytePlusEstimateBillingDefaultsOmittedResolutionTo720p(t *testing.T) {
	installBytePlusVideoPriceRules(t, `[
		{"model":"seedance-2.0","match":{"resolution":"720p"},"price_per_second":0.1512,"basis":"output_duration"}
	]`)

	a, c, info := newBytePlusSecondBillingContext(t,
		`{"model":"seedance-2.0","content":[{"type":"text","text":"hello"}]}`,
		"seedance-2.0")
	a.EstimateBilling(c, info)
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	// Ark's default length is 5s.
	want := 0.1512 * 5 / 0.14
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

// A model absent from the table keeps today's token-settled behaviour exactly:
// the legacy video_input ratio still applies and no per-second units appear.
func TestBytePlusEstimateBillingUnconfiguredModelKeepsLegacyRatio(t *testing.T) {
	installBytePlusVideoPriceRules(t, `[
		{"model":"some-other-model","match":{"resolution":"720p"},"price_per_second":0.1512,"basis":"output_duration"}
	]`)

	a, c, info := newBytePlusSecondBillingContext(t,
		`{"model":"seedance-2.0","resolution":"1080p","duration":5,"content":[{"type":"text","text":"hello"}]}`,
		"seedance-2.0")

	ratios := a.EstimateBilling(c, info)
	if got := ratios["video_input"]; got != 77.0/70.0 {
		t.Fatalf("legacy video_input ratio = %v, want %v", got, 77.0/70.0)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("unconfigured model produced per-second units: %v", got)
	}
}

// duration -1 and frames both make the rendered length unknowable. Capturing
// either would price the request off a fabricated length, so the adapter must
// leave it on the legacy path instead of guessing.
func TestBytePlusEstimateBillingSkipsCaptureWhenLengthIsUnknowable(t *testing.T) {
	installBytePlusVideoPriceRules(t, `[
		{"model":"seedance-2.0","match":{"resolution":"720p"},"price_per_second":0.1512,"basis":"output_duration"}
	]`)

	for _, tc := range []struct{ name, body string }{
		{"auto length -1", `{"model":"seedance-2.0","resolution":"720p","duration":-1,"content":[{"type":"text","text":"hello"}]}`},
		{"frames alone", `{"model":"seedance-2.0","resolution":"720p","frames":121,"content":[{"type":"text","text":"hello"}]}`},
		{"frames alongside duration", `{"model":"seedance-2.0","resolution":"720p","duration":5,"frames":121,"content":[{"type":"text","text":"hello"}]}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newBytePlusSecondBillingContext(t, tc.body, "seedance-2.0")
			a.EstimateBilling(c, info)
			got, err := a.SecondBillingRatios()
			if err != nil {
				t.Fatalf("unknowable length must not fail the request: %v", err)
			}
			if len(got) != 0 {
				t.Fatalf("unknowable length was priced anyway: %v", got)
			}
		})
	}
}

// A configured model whose dimensions match no rule must be rejected before the
// upstream call, not quietly priced by the legacy path.
func TestBytePlusEstimateBillingConfiguredModelWithNoMatchingRuleFails(t *testing.T) {
	installBytePlusVideoPriceRules(t, `[
		{"model":"seedance-2.0","match":{"resolution":"720p"},"price_per_second":0.1512,"basis":"output_duration"}
	]`)

	a, c, info := newBytePlusSecondBillingContext(t,
		`{"model":"seedance-2.0","resolution":"4K","duration":5,"content":[{"type":"text","text":"hello"}]}`,
		"seedance-2.0")
	a.EstimateBilling(c, info)
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

// Settlement re-prices from total_tokens unless PriceData.UsePrice is true
// (controller/relay.go derives PerCallBilling from it). A per-second reservation
// against a ModelRatio-priced model would therefore be silently overwritten at
// completion, so the request must be rejected before submission.
func TestBytePlusValidateTaskPriceDataRejectsNonFixedPriceForConfiguredModel(t *testing.T) {
	installBytePlusVideoPriceRules(t, `[
		{"model":"seedance-2.0","match":{"resolution":"720p"},"price_per_second":0.1512,"basis":"output_duration"}
	]`)

	cases := []struct {
		name       string
		usePrice   bool
		modelPrice float64
	}{
		{"ModelRatio instead of ModelPrice", false, -1},
		{"zero price", true, 0},
		{"negative price", true, -0.5},
		{"NaN price", true, math.NaN()},
		{"Inf price", true, math.Inf(1)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			info := newTestRelayInfo("https://ark.example", "test-key")
			info.OriginModelName = "seedance-2.0"
			info.PriceData.UsePrice = tc.usePrice
			info.PriceData.ModelPrice = tc.modelPrice
			if taskErr := (&TaskAdaptor{}).ValidateTaskPriceData(info); taskErr == nil {
				t.Fatal("configured model without a positive fixed price must be rejected")
			}
		})
	}
}

func TestBytePlusValidateTaskPriceDataAcceptsFixedPriceForConfiguredModel(t *testing.T) {
	installBytePlusVideoPriceRules(t, `[
		{"model":"seedance-2.0","match":{"resolution":"720p"},"price_per_second":0.1512,"basis":"output_duration"}
	]`)

	info := newTestRelayInfo("https://ark.example", "test-key")
	info.OriginModelName = "seedance-2.0"
	info.PriceData.UsePrice = true
	info.PriceData.ModelPrice = 0.14
	if taskErr := (&TaskAdaptor{}).ValidateTaskPriceData(info); taskErr != nil {
		t.Fatalf("fixed-price configured model rejected: %+v", taskErr)
	}
}

// Unconfigured models still settle from tokens, which requires ModelRatio and
// therefore UsePrice=false. The validator must not break them.
func TestBytePlusValidateTaskPriceDataAllowsTokenSettledUnconfiguredModel(t *testing.T) {
	installBytePlusVideoPriceRules(t, `[
		{"model":"some-other-model","match":{"resolution":"720p"},"price_per_second":0.1512,"basis":"output_duration"}
	]`)

	info := newTestRelayInfo("https://ark.example", "test-key")
	info.OriginModelName = "seedance-2.0"
	info.PriceData.UsePrice = false
	info.PriceData.ModelPrice = -1
	if taskErr := (&TaskAdaptor{}).ValidateTaskPriceData(info); taskErr != nil {
		t.Fatalf("token-settled unconfigured model rejected: %+v", taskErr)
	}
}

// The per-second table and ValidateTaskPriceData must agree on one key, and it
// has to be info.OriginModelName: that is the name ModelPriceHelperPerCall
// resolved ModelPrice from, and ModelPrice is ComputeSecondBilling's
// denominator. Keying capture on the request body's model instead would divide
// one model's per-second rate by another model's price.
func TestBytePlusEstimateBillingKeysPerSecondTableOnOriginModelNameNotBodyModel(t *testing.T) {
	installBytePlusVideoPriceRules(t, `[
		{"model":"seedance-2.0","match":{"resolution":"720p"},"price_per_second":0.1512,"basis":"output_duration"}
	]`)

	// A body model that IS in the table, behind a client-facing name that is not.
	c := newTestContext(`{"model":"seedance-2.0","resolution":"720p","duration":5,"content":[{"type":"text","text":"hello"}]}`)
	info := newTestRelayInfo("https://ark.example", "test-key")
	info.OriginModelName = "unpriced-alias"
	info.PriceData.UsePrice = false
	info.PriceData.ModelPrice = -1
	a := &TaskAdaptor{}
	if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("ValidateRequestAndSetAction error: %+v", taskErr)
	}

	// ValidateTaskPriceData keys on OriginModelName, so this passes.
	if taskErr := a.ValidateTaskPriceData(info); taskErr != nil {
		t.Fatalf("unconfigured client-facing name rejected: %+v", taskErr)
	}
	a.EstimateBilling(c, info)
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("body model must not drag an unconfigured alias onto the per-second path: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("priced per-second off the body model: %v", got)
	}
}

// The legacy path falls back to the request body's model when OriginModelName
// is empty. The per-second path must NOT: ValidateTaskPriceData keys strictly
// on OriginModelName, so a body-model fallback would let a request bypass the
// fixed-price guard and then divide the configured rate by a ModelPrice that
// was resolved for a different (here: empty) name.
func TestBytePlusEstimateBillingDoesNotFallBackToBodyModelForPerSecondCapture(t *testing.T) {
	installBytePlusVideoPriceRules(t, `[
		{"model":"seedance-2.0","match":{"resolution":"720p"},"price_per_second":0.1512,"basis":"output_duration"}
	]`)

	c := newTestContext(`{"model":"seedance-2.0","resolution":"720p","duration":5,"content":[{"type":"text","text":"hello"}]}`)
	info := newTestRelayInfo("https://ark.example", "test-key")
	info.OriginModelName = ""
	// What ModelPriceHelperPerCall would produce for an unpriced name.
	info.PriceData.UsePrice = false
	info.PriceData.ModelPrice = -1
	a := &TaskAdaptor{}
	if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("ValidateRequestAndSetAction error: %+v", taskErr)
	}

	// The guard sees "" and passes, so capture must not happen either.
	if taskErr := a.ValidateTaskPriceData(info); taskErr != nil {
		t.Fatalf("empty origin model rejected: %+v", taskErr)
	}
	a.EstimateBilling(c, info)
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("captured per-second billing the price guard never validated: %v", got)
	}
}
