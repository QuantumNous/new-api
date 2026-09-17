package controller

import (
	"bytes"
	"encoding/base64"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupAPIImageTasks(t *testing.T) (*gin.Engine, *model.Token, []byte) {
	t.Helper()
	_, png := setupDrawingTests(t)
	require.NoError(t, model.DB.AutoMigrate(&model.APIImageTask{}))
	token := &model.Token{UserId: 81001, Key: strings.Repeat("a", 48), Status: 1, RemainQuota: 1000000, ExpiredTime: -1, Group: "default"}
	require.NoError(t, model.DB.Create(token).Error)
	r := gin.New()
	r.Use(middleware.BodyStorageCleanup())
	r.POST("/v1/images/tasks", middleware.TokenAuth(), CreateAPIImageTask)
	r.GET("/v1/images/tasks/:id", middleware.TokenAuthReadOnly(), GetAPIImageTask)
	r.GET("/v1/images/tasks/:id/result", middleware.TokenAuthReadOnly(), GetAPIImageTask)
	r.GET("/v1/images/tasks/by-submission/:submission", middleware.TokenAuthReadOnly(), GetAPIImageTask)
	return r, token, png
}

func apiTaskCall(t *testing.T, r *gin.Engine, token *model.Token, method, path, key, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer sk-"+token.Key)
	req.Header.Set("Content-Type", "application/json")
	if key != "" {
		req.Header.Set("Idempotency-Key", key)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestAPIImageTaskDetachedIdempotentBillingAndAccess(t *testing.T) {
	r, token, png := setupAPIImageTasks(t)
	oldRate, oldRetry := operation_setting.USDExchangeRate, common.RetryTimes
	operation_setting.USDExchangeRate = 1
	common.RetryTimes = 2
	t.Cleanup(func() { operation_setting.USDExchangeRate = oldRate; common.RetryTimes = oldRetry })
	profile, err := model.UpdateAgentProfile(81001, 1, 2, true, 0, false)
	require.NoError(t, err)
	var calls atomic.Int32
	started, release := make(chan struct{}), make(chan struct{})
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		calls.Add(1)
		var input map[string]any
		raw, _ := io.ReadAll(req.Body)
		require.NoError(t, common.Unmarshal(raw, &input))
		assert.Equal(t, "low", input["quality"])
		assert.Equal(t, "jpeg", input["output_format"])
		assert.Equal(t, "960x1280", input["size"])
		assert.Equal(t, float64(100), input["output_compression"])
		close(started)
		<-release
		w.Header().Set("Content-Type", "application/json")
		data, _ := common.Marshal(map[string]any{"data": []map[string]any{{"b64_json": base64.StdEncoding.EncodeToString(png)}}, "usage": map[string]int{"input_tokens": 11, "output_tokens": 9, "total_tokens": 20}})
		_, _ = w.Write(data)
	}))
	defer upstream.Close()
	service.InitHttpClient()
	ch := model.Channel{Type: 1, Key: "fixture", Name: "async-test", BaseURL: &upstream.URL, Models: "gpt-image-2", Group: "default", Status: 1}
	require.NoError(t, ch.Insert())
	key := uuid.NewString()
	body := `{"model":"gpt-image-2","prompt":"async test","n":1,"quality":"low","output_format":"jpeg","output_compression":100,"size":"960x1280"}`
	response := apiTaskCall(t, r, token, "POST", "/v1/images/tasks", key, body)
	require.Equal(t, 202, response.Code, response.Body.String())
	var task model.APIImageTask
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &task))
	assert.Equal(t, "queued", task.Status)
	assert.EqualValues(t, 0, calls.Load(), "submission must not execute generation inline")
	again := apiTaskCall(t, r, token, "POST", "/v1/images/tasks", key, body)
	assert.Contains(t, again.Body.String(), task.ID)
	// A queued job must keep the price it was submitted at.
	_, err = model.UpdateAgentProfile(81001, 1, 6, true, profile.Version, false)
	require.NoError(t, err)
	conflict := apiTaskCall(t, r, token, "POST", "/v1/images/tasks", key, strings.Replace(body, "async test", "changed", 1))
	assert.Equal(t, 409, conflict.Code)
	claimed, err := model.ClaimAPIImageTask(time.Now().Unix())
	require.NoError(t, err)
	require.NotNil(t, claimed)
	done := make(chan struct{})
	go func() { defer close(done); executeAPIImageTask(claimed) }()
	<-started
	assert.Equal(t, 202, apiTaskCall(t, r, token, "GET", "/v1/images/tasks/"+task.ID+"/result", "", "").Code)
	close(release)
	<-done
	saved, err := model.GetAPIImageTask(token.UserId, token.Id, task.ID)
	require.NoError(t, err)
	require.Equal(t, "succeeded", saved.Status, saved.Error)
	result := apiTaskCall(t, r, token, "GET", "/v1/images/tasks/"+task.ID+"/result", "", "")
	require.Equal(t, 200, result.Code, result.Body.String())
	var parsed struct {
		Data []struct {
			Base64 string `json:"b64_json"`
			Size   string `json:"size"`
		}
		Usage map[string]int
	}
	require.NoError(t, common.Unmarshal(result.Body.Bytes(), &parsed))
	assert.Equal(t, "3x4", parsed.Data[0].Size)
	assert.Equal(t, 20, parsed.Usage["total_tokens"])
	decoded, err := base64.StdEncoding.DecodeString(parsed.Data[0].Base64)
	require.NoError(t, err)
	assert.True(t, bytes.Equal(png, decoded))
	for i := 0; i < 2; i++ {
		assert.Equal(t, 200, apiTaskCall(t, r, token, "GET", "/v1/images/tasks/"+task.ID+"/result", "", "").Code)
	}
	assert.EqualValues(t, 1, calls.Load())
	require.Eventually(t, func() bool {
		u, e := model.GetUserById(81001, false)
		tok, te := model.GetTokenById(token.Id)
		return e == nil && te == nil && u.Quota == 9990000 && tok.RemainQuota == 990000
	}, 2*time.Second, 10*time.Millisecond)
	other := &model.Token{UserId: 81002, Key: strings.Repeat("b", 48), Status: 1, RemainQuota: 1000000, ExpiredTime: -1}
	require.NoError(t, model.DB.Create(other).Error)
	assert.Equal(t, 404, apiTaskCall(t, r, other, "GET", "/v1/images/tasks/"+task.ID, "", "").Code)
	other.UserId = 81001
	require.NoError(t, model.DB.Model(other).Update("user_id", 81001).Error)
	assert.Equal(t, 404, apiTaskCall(t, r, other, "GET", "/v1/images/tasks/"+task.ID, "", "").Code)
	require.NoError(t, model.DB.Model(token).Updates(map[string]any{"remain_quota": 0, "status": common.TokenStatusExhausted}).Error)
	assert.Equal(t, 200, apiTaskCall(t, r, token, "GET", "/v1/images/tasks/"+task.ID+"/result", "", "").Code)
	assert.Contains(t, apiTaskCall(t, r, token, "GET", "/v1/images/tasks/by-submission/"+key, "", "").Body.String(), task.ID)
	// An interrupted worker becomes unknown; it must never be claimed a second time.
	require.NoError(t, model.DB.Model(saved).Updates(map[string]any{"status": "running", "started_at": time.Now().Unix() - 26*60}).Error)
	next, err := model.ClaimAPIImageTask(time.Now().Unix())
	require.NoError(t, err)
	assert.Nil(t, next)
	saved, err = model.GetAPIImageTask(token.UserId, token.Id, task.ID)
	require.NoError(t, err)
	assert.Equal(t, "unknown", saved.Status)
}

func TestAPIImageTaskSubmissionKeepsTransportContract(t *testing.T) {
	r, token, _ := setupAPIImageTasks(t)
	bad := apiTaskCall(t, r, token, "POST", "/v1/images/tasks", uuid.NewString(), `{"model":"gpt-image-2","prompt":"test","stream":true}`)
	assert.Equal(t, 400, bad.Code)
	assert.Equal(t, 400, apiTaskCall(t, r, token, "POST", "/v1/images/tasks", "", `{"model":"gpt-image-2","prompt":"test"}`).Code)
	assert.Equal(t, 202, apiTaskCall(t, r, token, "POST", "/v1/images/tasks", uuid.NewString(), `{"model":"gpt-image-2","prompt":"test","images":[{}]}`).Code)
	assert.Equal(t, 202, apiTaskCall(t, r, token, "POST", "/v1/images/tasks", uuid.NewString(), `{"model":"gpt-image-2","prompt":"test","n":21}`).Code)
}

func TestAPIImageTaskReferencesUseJSONEditRoute(t *testing.T) {
	r, token, png := setupAPIImageTasks(t)
	_, err := model.UpdateAgentProfile(81001, 1, 2, true, 0, false)
	require.NoError(t, err)
	var calls atomic.Int32
	reference := "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		calls.Add(1)
		assert.Equal(t, "/v1/images/edits", req.URL.Path)
		var input struct {
			Images []struct {
				URL string `json:"image_url"`
			}
		}
		raw, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		require.NoError(t, common.Unmarshal(raw, &input))
		require.Len(t, input.Images, 1)
		assert.Equal(t, reference, input.Images[0].URL)
		w.Header().Set("Content-Type", "application/json")
		body, _ := common.Marshal(map[string]any{"data": []map[string]string{{"b64_json": base64.StdEncoding.EncodeToString(png)}}})
		_, _ = w.Write(body)
	}))
	defer upstream.Close()
	service.InitHttpClient()
	ch := model.Channel{Type: 1, Key: "fixture", Name: "edit-route-test", BaseURL: &upstream.URL, Models: "gpt-image-2", Group: "default", Status: 1}
	require.NoError(t, ch.Insert())
	body, err := common.Marshal(map[string]any{"model": "gpt-image-2", "prompt": "reference test", "images": []string{reference}})
	require.NoError(t, err)
	response := apiTaskCall(t, r, token, "POST", "/v1/images/tasks", uuid.NewString(), string(body))
	require.Equal(t, 202, response.Code, response.Body.String())
	task, err := model.ClaimAPIImageTask(time.Now().Unix())
	require.NoError(t, err)
	require.NotNil(t, task)
	executeAPIImageTask(task)
	assert.Equal(t, "succeeded", task.Status, task.Error)
	assert.EqualValues(t, 1, calls.Load())
}

func TestAPIImageTasksDoNotAddLocalConcurrencyOrPendingLimits(t *testing.T) {
	r, token, _ := setupAPIImageTasks(t)
	// 21 jobs cross all former admission (10 jobs/20 images), per-user (2),
	// and drawing-pool (4) limits. No upstream requests are executed here.
	for i := 0; i < 21; i++ {
		response := apiTaskCall(t, r, token, "POST", "/v1/images/tasks", uuid.NewString(), `{"model":"gpt-image-2","prompt":"queue admission test","n":1}`)
		require.Equal(t, http.StatusAccepted, response.Code, response.Body.String())
	}
	claimedIDs := make(map[string]bool)
	for i := 0; i < 21; i++ {
		task, err := model.ClaimAPIImageTask(time.Now().Unix())
		require.NoError(t, err)
		require.NotNil(t, task, "every queued job remains eligible while other jobs of this user are running")
		assert.False(t, claimedIDs[task.ID], "a task must only be claimed once")
		claimedIDs[task.ID] = true
	}
	task, err := model.ClaimAPIImageTask(time.Now().Unix())
	require.NoError(t, err)
	assert.Nil(t, task, "all jobs are running, none may be replayed")
}
