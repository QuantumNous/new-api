package controller

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
	"gorm.io/gorm"
)

func setupIQController(t *testing.T) (*model.User, *model.User) {
	t.Helper()
	previousDB, previousLog := model.DB, model.LOG_DB
	oldRedis, oldMemory, oldConsume, oldExport := common.RedisEnabled, common.MemoryCacheEnabled, common.LogConsumeEnabled, common.DataExportEnabled
	ratios, usable := ratio_setting.GroupRatio2JSONString(), setting.UserUsableGroups2JSONString()
	prices := ratio_setting.ModelPrice2JSONString()
	oldMainType, oldLogType := common.MainDatabaseType(), common.LogDatabaseType()
	initModelListColumnNames(t)
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(&model.IQConfig{}, &model.IQBatch{}, &model.IQAttempt{}, &model.IQResult{}, &model.SystemTask{}, &model.SystemTaskLock{}, &model.User{}, &model.Channel{}, &model.Ability{}, &model.Log{}))
	common.RedisEnabled = false
	common.MemoryCacheEnabled = false
	common.LogConsumeEnabled = true
	common.DataExportEnabled = false
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"public":2,"private":3}`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{}`))
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"gpt-4o":0.01,"gpt-4o-mini":0.01}`))
	service.InitHttpClient()
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetDatabaseTypes(oldMainType, oldLogType)
		model.LOG_DB = previousLog
		common.RedisEnabled = oldRedis
		common.MemoryCacheEnabled = oldMemory
		common.LogConsumeEnabled = oldConsume
		common.DataExportEnabled = oldExport
		_ = ratio_setting.UpdateGroupRatioByJSONString(ratios)
		_ = setting.UpdateUserUsableGroupsByJSONString(usable)
		_ = ratio_setting.UpdateModelPriceByJSONString(prices)
		_ = sqlDB.Close()
	})
	root := &model.User{Username: "iq-root", AffCode: "iq-root", Role: common.RoleRootUser, Status: common.UserStatusEnabled, Group: "default", Quota: 12345}
	viewer := &model.User{Username: "iq-viewer", AffCode: "iq-viewer", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Group: "public", Quota: 6789}
	require.NoError(t, db.Create(root).Error)
	require.NoError(t, db.Create(viewer).Error)
	return root, viewer
}
func iqContext(user *model.User, path, id string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, path, nil)
	c.Set("id", user.Id)
	c.Set("role", user.Role)
	c.Params = gin.Params{{Key: "id", Value: id}}
	return c, w
}
func TestIQSingleRoutingAttemptFundingAndGalleryAccess(t *testing.T) {
	root, viewer := setupIQController(t)
	var calls atomic.Int32
	var wrong atomic.Bool
	prompt := " exact IQ prompt\n"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		body, _ := io.ReadAll(r.Body)
		if gjson.GetBytes(body, "messages.0.content").String() != prompt || gjson.GetBytes(body, "max_tokens").Int() != model.IQOutputTokens {
			wrong.Store(true)
		}
		w.Header().Set("Content-Type", "application/json")
		if strings.Contains(string(body), "gpt-4o-mini") {
			w.WriteHeader(500)
			fmt.Fprint(w, `{"error":{"message":"secret-provider-key"}}`)
			return
		}
		fmt.Fprint(w, `{"choices":[{"index":0,"finish_reason":"stop","message":{"role":"assistant","content":"<html><body><canvas></canvas><script>const x = 1;</script><svg></svg></body></html>"}}],"usage":{"prompt_tokens":10,"completion_tokens":20}}`)
	}))
	defer server.Close()
	for i := 0; i < 3; i++ {
		ch := &model.Channel{Type: constant.ChannelTypeOpenAI, Status: common.ChannelStatusEnabled, Key: "mock-key", BaseURL: &server.URL, Name: fmt.Sprintf("iq-%d", i), Models: "gpt-4o,gpt-4o-mini,unselected", Group: "public,private,default"}
		require.NoError(t, model.DB.Create(ch).Error)
		require.NoError(t, ch.AddAbilities(nil))
	}
	defaultOnly := &model.Channel{Type: constant.ChannelTypeOpenAI, Status: common.ChannelStatusEnabled, Key: "mock", BaseURL: &server.URL, Models: "only-default", Group: "default"}
	require.NoError(t, model.DB.Create(defaultOnly).Error)
	require.NoError(t, defaultOnly.AddAbilities(nil))
	catalog, err := iqTargetCatalog()
	require.NoError(t, err)
	var defaultFound bool
	for _, g := range catalog {
		if g.Group == "default" {
			defaultFound = true
			require.Contains(t, g.Models, "only-default")
		}
	}
	require.True(t, defaultFound, "admin catalog must include default-only capabilities")
	cfg, err := model.GetIQConfig()
	require.NoError(t, err)
	cfg.Prompt = model.IQText(prompt)
	cfg.Targets = []model.IQTarget{{Group: "public", Models: []string{"gpt-4o"}}, {Group: "private", Models: []string{"gpt-4o-mini"}}}
	require.NoError(t, validateIQTargets(cfg))
	cfg, err = model.SaveIQConfig(*cfg, root.Id, time.Now())
	require.NoError(t, err)
	task, _, err := model.EnqueueIQBatch(false, time.Now())
	require.NoError(t, err)
	task, claimed, err := model.ClaimSystemTask(task.ID, model.SystemTaskTypeIQTest, "iq-runner", common.GetTimestamp()+60)
	require.NoError(t, err)
	require.True(t, claimed)
	require.NoError(t, runIQBatch(context.Background(), task, "iq-runner", *cfg, root.Id, executeIQPair))
	require.EqualValues(t, 2, calls.Load())
	require.False(t, wrong.Load())
	// Running the same checkpoint again cannot send any pair a second time.
	require.NoError(t, runIQBatch(context.Background(), task, "iq-runner", *cfg, root.Id, executeIQPair))
	require.EqualValues(t, 2, calls.Load())
	publicID, privateID := model.IQPairID("public", "gpt-4o"), model.IQPairID("private", "gpt-4o-mini")
	result, err := model.GetIQResult(publicID)
	require.NoError(t, err)
	require.Equal(t, "success", result.Status)
	require.Contains(t, string(result.Artifact), "<script>")
	failed, err := model.GetIQResult(privateID)
	require.NoError(t, err)
	require.Equal(t, "error", failed.Status)
	require.NotContains(t, failed.ErrorMessage, "secret")
	var log model.Log
	require.NoError(t, model.DB.Where("token_name = ?", "IQ test").First(&log).Error)
	require.Equal(t, "public", log.Group, "selected group must precede relay-info generation")
	c, w := iqContext(viewer, "/api/iq-tests/results", "")
	GetIQResults(c)
	require.Equal(t, 200, w.Code)
	require.NotContains(t, w.Body.String(), "private")
	require.NotContains(t, w.Body.String(), "<canvas")
	require.Contains(t, w.Body.String(), "public")
	// Seed a successful private artifact so denial proves authorization, not
	// merely the endpoint's non-success-result rule.
	require.NoError(t, model.DB.Model(&model.IQResult{}).Where("id = ?", privateID).Updates(map[string]any{"status": "success", "artifact": "<svg></svg>", "artifact_kind": "svg", "error_code": "", "error_message": ""}).Error)
	c, w = iqContext(viewer, "/api/iq-tests/results/"+privateID, privateID)
	GetIQArtifact(c)
	require.Equal(t, 404, w.Code)
	c, w = iqContext(viewer, "/api/iq-tests/results/"+publicID, publicID)
	GetIQArtifact(c)
	require.Equal(t, 200, w.Code)
	require.Contains(t, w.Header().Get("Content-Type"), "application/json")
	c, w = iqContext(root, "/api/iq-tests/results/"+privateID, privateID)
	GetIQArtifact(c)
	require.Equal(t, 200, w.Code)
	c, w = iqContext(root, "/api/iq-tests/results", "")
	GetIQResults(c)
	require.Contains(t, w.Body.String(), "private")
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"private":3}`))
	c, w = iqContext(viewer, "/api/iq-tests/results/"+publicID, publicID)
	GetIQArtifact(c)
	require.Equal(t, 404, w.Code, "current group revocation must also protect a directly known artifact ID")
	var unchanged model.User
	require.NoError(t, model.DB.First(&unchanged, root.Id).Error)
	require.Equal(t, root.Quota, unchanged.Quota)
	unchanged = model.User{}
	require.NoError(t, model.DB.First(&unchanged, viewer.Id).Error)
	require.Equal(t, viewer.Quota, unchanged.Quota)
	require.EqualValues(t, 2, calls.Load())
	var channels []model.Channel
	require.NoError(t, model.DB.Find(&channels).Error)
	for _, ch := range channels {
		require.Equal(t, common.ChannelStatusEnabled, ch.Status)
		require.Zero(t, ch.TestTime)
	}
}
func TestIQNativeRequestsAndOutputBounds(t *testing.T) {
	protected, err := restoreIQInput([]byte(`{"messages":[{"role":"user","content":"overridden"}],"tools":[{}],"n":4}`), []byte(`{"messages":[{"role":"user","content":"exact"}]}`))
	require.NoError(t, err)
	protected, err = boundIQRequest(protected, string(constant.EndpointTypeOpenAI))
	require.NoError(t, err)
	require.Equal(t, "exact", gjson.GetBytes(protected, "messages.0.content").String())
	require.False(t, gjson.GetBytes(protected, "tools").Exists())
	require.False(t, gjson.GetBytes(protected, "n").Exists())

	for _, endpoint := range []constant.EndpointType{constant.EndpointTypeOpenAI, constant.EndpointTypeOpenAIResponse, constant.EndpointTypeAnthropic, constant.EndpointTypeGemini} {
		request := buildIQRequest("model", string(endpoint), "exact", false)
		body, err := common.Marshal(request)
		require.NoError(t, err)
		require.Contains(t, string(body), "exact")
		bounded, err := boundIQRequest(body, string(endpoint))
		require.NoError(t, err)
		require.Contains(t, string(bounded), "16384")
	}
	require.Equal(t, string(constant.EndpointTypeOpenAIResponse), iqEndpoint(&model.Channel{Type: constant.ChannelTypeCodex}, "gpt-5-codex"))
	mapping := `{"alias":"gpt-5-codex"}`
	require.Equal(t, string(constant.EndpointTypeOpenAIResponse), iqEndpoint(&model.Channel{Type: constant.ChannelTypeOpenAI, ModelMapping: &mapping}, "alias"))
	require.Empty(t, iqEndpoint(&model.Channel{Type: constant.ChannelTypeOpenAI}, "text-embedding-3-small"))
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	r := executeIQPair(ctx, 1, "public", "m", "p")
	require.NotEqual(t, "success", r.Status)
}
