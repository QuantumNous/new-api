package controller

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupDrawingTests(t *testing.T) (*gin.Engine, []byte) {
	t.Helper()
	db := setupModelListControllerTestDB(t)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&model.AgentProfile{}, &model.AgentPriceChange{}, &model.AgentInvitation{}, &model.AgentCustomerPrice{}, &model.DrawingBatch{}, &model.DrawingItem{}, &model.DrawingQueueLock{}, &model.Log{}, &model.Token{}))
	require.NoError(t, model.InitDrawingQueue())
	t.Setenv("DRAWING_STORAGE_DIR", t.TempDir())
	oldMemory, oldBatch, oldLog := common.MemoryCacheEnabled, common.BatchUpdateEnabled, common.LogConsumeEnabled
	common.MemoryCacheEnabled, common.BatchUpdateEnabled, common.LogConsumeEnabled = false, false, false
	t.Cleanup(func() {
		common.MemoryCacheEnabled, common.BatchUpdateEnabled, common.LogConsumeEnabled = oldMemory, oldBatch, oldLog
	})
	for _, user := range []model.User{{Id: 81001, Username: "drawing-one", AffCode: "drawone", Group: "default", Status: common.UserStatusEnabled, Quota: 10_000_000, Setting: `{"billing_preference":"wallet_only"}`}, {Id: 81002, Username: "drawing-two", AffCode: "drawtwo", Group: "default", Status: common.UserStatusEnabled, Quota: 10_000_000, Setting: `{"billing_preference":"wallet_only"}`}} {
		require.NoError(t, db.Create(&user).Error)
	}
	r := gin.New()
	r.Use(func(c *gin.Context) {
		id := 81001
		if c.GetHeader("X-Test-User") == "second" {
			id = 81002
		}
		c.Set("id", id)
		c.Next()
	})
	r.POST("/batches", CreateDrawingBatch)
	r.GET("/batches", ListDrawingBatches)
	r.GET("/images/:id", DrawingImage)
	r.GET("/batches/:id/download", DownloadDrawingBatch)
	r.POST("/images/:id/recover", RecoverDrawing)
	var data bytes.Buffer
	require.NoError(t, png.Encode(&data, image.NewRGBA(image.Rect(0, 0, 3, 4))))
	return r, data.Bytes()
}

func submitDrawingTestBatch(t *testing.T, r *gin.Engine, input drawingSubmission, reference []byte, testUser ...string) *httptest.ResponseRecorder {
	t.Helper()
	var body bytes.Buffer
	form := multipart.NewWriter(&body)
	encoded, err := common.Marshal(input)
	require.NoError(t, err)
	require.NoError(t, form.WriteField("request", string(encoded)))
	if reference != nil {
		file, err := form.CreateFormFile("image", "product.png")
		require.NoError(t, err)
		_, err = file.Write(reference)
		require.NoError(t, err)
	}
	require.NoError(t, form.Close())
	request := httptest.NewRequest("POST", "/batches", &body)
	request.Header.Set("Content-Type", form.FormDataContentType())
	if len(testUser) > 0 {
		request.Header.Set("X-Test-User", testUser[0])
	}
	response := httptest.NewRecorder()
	r.ServeHTTP(response, request)
	return response
}

func TestDrawingSubmissionDefaultLimitsAndIdempotency(t *testing.T) {
	r, _ := setupDrawingTests(t)
	input := drawingSubmission{SubmissionID: uuid.NewString(), Model: "gpt-image-2", Group: "default", Ratio: "3:4", Prompt: "A product"}
	response := submitDrawingTestBatch(t, r, input, nil)
	require.Equal(t, 202, response.Code, response.Body.String())
	var first model.DrawingBatch
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &first))
	require.Len(t, first.Items, 1)
	response = submitDrawingTestBatch(t, r, input, nil)
	require.Equal(t, 202, response.Code, response.Body.String())
	var second model.DrawingBatch
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &second))
	assert.Equal(t, first.ID, second.ID)
	input.Prompt = "Changed"
	assert.Equal(t, 409, submitDrawingTestBatch(t, r, input, nil).Code)
	for _, n := range []int{-1, 0, 21, 1000000} {
		input.SubmissionID = uuid.NewString()
		input.Count = &n
		assert.Equal(t, 400, submitDrawingTestBatch(t, r, input, nil).Code)
	}
	var total int64
	require.NoError(t, model.DB.Model(&model.DrawingItem{}).Count(&total).Error)
	assert.EqualValues(t, 1, total)
}

func TestDrawingQueueUserLimitsRestartAndRetry(t *testing.T) {
	r, _ := setupDrawingTests(t)
	count := 8
	response := submitDrawingTestBatch(t, r, drawingSubmission{SubmissionID: uuid.NewString(), Model: "gpt-image-2", Group: "default", Ratio: "3:4", Prompt: "Product", Count: &count}, nil)
	require.Equal(t, 202, response.Code)
	now := service.DrawingNow()
	first, err := model.ClaimDrawingItem(now, 4)
	require.NoError(t, err)
	require.NotNil(t, first)
	second, err := model.ClaimDrawingItem(now, 4)
	require.NoError(t, err)
	require.NotNil(t, second)
	third, err := model.ClaimDrawingItem(now, 4)
	require.NoError(t, err)
	assert.Nil(t, third)
	assert.Equal(t, 1, first.Position)
	assert.Equal(t, 2, second.Position)
	first.Status = "succeeded"
	first.ExpiresAt = now + model.DrawingLifetime
	require.NoError(t, model.FinishDrawingItem(first))
	third, err = model.ClaimDrawingItem(now, 4)
	require.NoError(t, err)
	require.NotNil(t, third)
	assert.Equal(t, 3, third.Position)
	// Simulate a lost worker and reinitialize the queue, as on process restart.
	require.NoError(t, model.DB.Model(second).Update("started_at", now-25*60).Error)
	require.NoError(t, model.InitDrawingQueue())
	_, err = model.ClaimDrawingItem(now, 4)
	require.NoError(t, err)
	var interrupted model.DrawingItem
	require.NoError(t, model.DB.First(&interrupted, "id = ?", second.ID).Error)
	assert.Equal(t, "unknown", interrupted.Status)
	assert.Error(t, model.RetryDrawingItem(81001, second.ID, now, false, 40))
	require.NoError(t, model.RetryDrawingItem(81001, second.ID, now, true, 40))
	assert.Error(t, model.RetryDrawingItem(81001, first.ID, now, true, 40))
	assert.Error(t, model.RetryDrawingItem(81002, second.ID, now, true, 40))
}

func TestDrawingExpiryAuthorizationAndZip(t *testing.T) {
	r, pngData := setupDrawingTests(t)
	now := service.DrawingNow()
	batch := model.DrawingBatch{ID: uuid.NewString(), UserID: 81001, SubmissionID: uuid.NewString(), CreatedAt: now, ExpiresAt: now + 7200, Ratio: "3:4"}
	for i := 1; i <= 3; i++ {
		item := model.DrawingItem{ID: uuid.NewString(), BatchID: batch.ID, UserID: 81001, Position: i, Prompt: "Private prompt", Status: "succeeded", Mime: "image/png", ExpiresAt: now + 7200}
		if i == 2 {
			item.ExpiresAt = now - 1
		}
		batch.Items = append(batch.Items, item)
		require.NoError(t, service.WriteDrawingFile(item.ID, ".image", pngData))
	}
	require.NoError(t, model.DB.Create(&batch).Error)
	request := httptest.NewRequest("GET", "/images/"+batch.Items[0].ID, nil)
	request.Header.Set("X-Test-User", "second")
	response := httptest.NewRecorder()
	r.ServeHTTP(response, request)
	assert.Equal(t, 404, response.Code)
	response = httptest.NewRecorder()
	r.ServeHTTP(response, httptest.NewRequest("GET", "/images/"+batch.Items[1].ID, nil))
	assert.Equal(t, 410, response.Code)
	response = httptest.NewRecorder()
	r.ServeHTTP(response, httptest.NewRequest("GET", "/images/"+batch.Items[0].ID, nil))
	assert.Equal(t, 200, response.Code)
	assert.Contains(t, response.Header().Get("Cache-Control"), "no-store")
	assert.Equal(t, pngData, response.Body.Bytes())
	response = httptest.NewRecorder()
	r.ServeHTTP(response, httptest.NewRequest("GET", "/batches/"+batch.ID+"/download", nil))
	require.Equal(t, 200, response.Code)
	archive, err := zip.NewReader(bytes.NewReader(response.Body.Bytes()), int64(response.Body.Len()))
	require.NoError(t, err)
	require.Len(t, archive.File, 2)
	assert.Equal(t, "01.png", archive.File[0].Name)
	assert.Equal(t, "03.png", archive.File[1].Name)
	for _, file := range archive.File {
		reader, err := file.Open()
		require.NoError(t, err)
		data, err := io.ReadAll(reader)
		reader.Close()
		require.NoError(t, err)
		assert.Equal(t, pngData, data)
	}
	require.NoError(t, service.CleanupDrawings(now))
	path, err := service.DrawingFile(batch.Items[1].ID, ".image")
	require.NoError(t, err)
	_, err = os.Stat(path)
	assert.True(t, os.IsNotExist(err))
	var expired model.DrawingItem
	require.NoError(t, model.DB.First(&expired, "id = ?", batch.Items[1].ID).Error)
	assert.Equal(t, "expired", expired.Status)
	assert.Empty(t, expired.Prompt)
	path, err = service.DrawingFile(batch.Items[0].ID, ".image")
	require.NoError(t, err)
	_, err = os.Stat(path)
	assert.NoError(t, err)
}

func TestDrawingRealRelayBatchBillingAndRecovery(t *testing.T) {
	r, pngData := setupDrawingTests(t)
	var calls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.URL.Path == "/v1/images/edits" {
			require.NoError(t, r.ParseMultipartForm(1<<20))
			defer r.MultipartForm.RemoveAll()
			assert.Equal(t, "1", r.FormValue("n"))
			assert.Equal(t, "864x1152", r.FormValue("size"))
			assert.Equal(t, "Product", r.FormValue("prompt"), "forward the customer's prompt without appended instructions")
			file, _, err := r.FormFile("image")
			require.NoError(t, err)
			data, err := io.ReadAll(file)
			file.Close()
			require.NoError(t, err)
			assert.Equal(t, pngData, data)
		} else {
			assert.Equal(t, "/v1/images/generations", r.URL.Path)
			var payload struct {
				N      int    `json:"n"`
				Size   string `json:"size"`
				Prompt string `json:"prompt"`
			}
			require.NoError(t, common.DecodeJson(r.Body, &payload))
			assert.Equal(t, 1, payload.N)
			assert.Equal(t, "864x1152", payload.Size)
			assert.Contains(t, []string{"Product", "FORCE_FAILURE", "FORCE_UNKNOWN"}, payload.Prompt, "forward the exact submitted prompt")
			if strings.Contains(payload.Prompt, "FORCE_FAILURE") {
				w.WriteHeader(400)
				_, _ = w.Write([]byte(`{"error":{"message":"The image generation request was rejected by upstream safety checks.","type":"openai_error","code":"content_policy_violation"}}`))
				return
			}
			if strings.Contains(payload.Prompt, "FORCE_UNKNOWN") {
				w.WriteHeader(500)
				_, _ = w.Write([]byte(`{"error":{"message":"fixture uncertain","type":"server_error"}}`))
				return
			}
		}
		w.Header().Set("Content-Type", "application/json")
		body, err := common.Marshal(map[string]any{"created": service.DrawingNow(), "data": []map[string]string{{"b64_json": base64.StdEncoding.EncodeToString(pngData)}}})
		require.NoError(t, err)
		_, err = w.Write(body)
		assert.NoError(t, err)
	}))
	defer upstream.Close()
	service.InitHttpClient()
	oldPrices := ratio_setting.ModelPrice2JSONString()
	oldGroups := ratio_setting.GroupRatio2JSONString()
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"gpt-image-2":0.01}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1}`))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(oldPrices))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(oldGroups))
	})
	channel := model.Channel{Type: 1, Key: "local-test-only", Name: "drawing-test", BaseURL: &upstream.URL, Status: common.ChannelStatusEnabled, Models: "gpt-image-2", Group: "default"}
	require.NoError(t, channel.Insert())
	count := 8
	response := submitDrawingTestBatch(t, r, drawingSubmission{SubmissionID: uuid.NewString(), Model: "gpt-image-2", Group: "default", Ratio: "3:4", Prompt: "Product", Count: &count}, pngData)
	require.Equal(t, 202, response.Code, response.Body.String())
	var batch model.DrawingBatch
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &batch))
	for i := 0; i < count; i++ {
		item, err := model.ClaimDrawingItem(service.DrawingNow(), 4)
		require.NoError(t, err)
		require.NotNil(t, item)
		executeDrawingItem(item)
	}
	assert.EqualValues(t, 8, calls.Load())
	saved, err := model.GetDrawingBatch(81001, batch.ID)
	require.NoError(t, err)
	for _, item := range saved.Items {
		assert.Equal(t, "succeeded", item.Status, item.Error)
		assert.Equal(t, "image/png", item.Mime)
		assert.InDelta(t, service.DrawingNow()+7200, item.ExpiresAt, 5)
	}
	user, err := model.GetUserById(81001, false)
	require.NoError(t, err)
	assert.Equal(t, 10_000_000-8*5000, user.Quota)
	// Simulate successful generation whose image save needs to be recovered.
	item := saved.Items[0]
	path, err := service.DrawingFile(item.ID, ".image")
	require.NoError(t, err)
	require.NoError(t, os.Remove(path))
	require.NoError(t, model.DB.Model(&item).Update("status", "storage_failed").Error)
	response = httptest.NewRecorder()
	r.ServeHTTP(response, httptest.NewRequest("POST", "/images/"+item.ID+"/recover", strings.NewReader("{}")))
	require.Equal(t, 200, response.Code, response.Body.String())
	assert.EqualValues(t, 8, calls.Load())
	after, err := model.GetUserById(81001, false)
	require.NoError(t, err)
	assert.Equal(t, user.Quota, after.Quota)
	oldRetryTimes := common.RetryTimes
	common.RetryTimes = 3
	t.Cleanup(func() { common.RetryTimes = oldRetryTimes })
	sixteen := 16
	input := drawingSubmission{SubmissionID: uuid.NewString(), Model: "gpt-image-2", Group: "default", Ratio: "3:4", Prompt: "Product", Count: &sixteen}
	for i := 0; i < sixteen; i++ {
		prompt := "Product"
		if i == 4 {
			prompt = "FORCE_FAILURE"
		}
		if i == 6 {
			prompt = "FORCE_UNKNOWN"
		}
		input.Items = append(input.Items, DrawingPlanItem{Title: fmt.Sprint(i + 1), Prompt: prompt})
	}
	response = submitDrawingTestBatch(t, r, input, nil)
	require.Equal(t, 202, response.Code, response.Body.String())
	var secondBatch model.DrawingBatch
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &secondBatch))
	for i := 0; i < sixteen; i++ {
		item, err := model.ClaimDrawingItem(service.DrawingNow(), 4)
		require.NoError(t, err)
		require.NotNil(t, item)
		executeDrawingItem(item)
	}
	assert.EqualValues(t, 24, calls.Load(), "failed or uncertain upstream calls must not be retried automatically")
	results, err := model.GetDrawingBatch(81001, secondBatch.ID)
	require.NoError(t, err)
	require.Len(t, results.Items, 16)
	for i, item := range results.Items {
		expected := "succeeded"
		if i == 4 {
			expected = "failed"
			assert.Equal(t, "Image generation failed; see usage log", item.Error)
			responsePath, err := service.DrawingFile(item.ID, ".response")
			require.NoError(t, err)
			body, err := os.ReadFile(responsePath)
			require.NoError(t, err)
			var envelope struct {
				Error struct {
					Message string `json:"message"`
					Code    string `json:"code"`
				} `json:"error"`
			}
			require.NoError(t, common.Unmarshal(body, &envelope))
			assert.Contains(t, envelope.Error.Message, "The image generation request was rejected by upstream safety checks.")
			assert.Equal(t, "content_policy_violation", envelope.Error.Code)
		}
		if i == 6 {
			expected = "unknown"
		}
		assert.Equal(t, expected, item.Status)
		assert.Equal(t, i+1, item.Position)
	}
	after, err = model.GetUserById(81001, false)
	require.NoError(t, err)
	assert.Equal(t, 10_000_000-22*5000, after.Quota, "two rejected requests must refund their pre-consumption")

}

func TestDrawingFileAndRatios(t *testing.T) {
	_, err := service.DrawingFile("../outside", ".image")
	assert.Error(t, err)
	for ratio, size := range service.DrawingRatios {
		var w, h, rw, rh int
		_, err = fmt.Sscanf(size, "%dx%d", &w, &h)
		require.NoError(t, err)
		_, err = fmt.Sscanf(ratio, "%d:%d", &rw, &rh)
		require.NoError(t, err)
		assert.Equal(t, w*rh, h*rw)
	}
}

func TestDrawingGlobalAndChannelConcurrency(t *testing.T) {
	_, _ = setupDrawingTests(t)
	now := service.DrawingNow()
	for _, userID := range []int{81001, 81002} {
		batch := &model.DrawingBatch{ID: uuid.NewString(), UserID: userID, SubmissionID: uuid.NewString(), CreatedAt: now, ExpiresAt: now + 7200}
		for i := 1; i <= 3; i++ {
			batch.Items = append(batch.Items, model.DrawingItem{ID: uuid.NewString(), BatchID: batch.ID, UserID: userID, Position: i, Status: "queued", ExpiresAt: now + 7200})
		}
		_, err := model.CreateDrawingBatch(batch, 40)
		require.NoError(t, err)
	}
	var claimed []*model.DrawingItem
	counts := map[int]int{}
	for i := 0; i < 4; i++ {
		item, err := model.ClaimDrawingItem(now, 4)
		require.NoError(t, err)
		require.NotNil(t, item)
		claimed = append(claimed, item)
		counts[item.UserID]++
	}
	item, err := model.ClaimDrawingItem(now, 4)
	require.NoError(t, err)
	assert.Nil(t, item)
	assert.Equal(t, map[int]int{81001: 2, 81002: 2}, counts)
	ok, err := model.ReserveDrawingChannel(claimed[0].ID, 90)
	require.NoError(t, err)
	assert.True(t, ok)
	ok, err = model.ReserveDrawingChannel(claimed[1].ID, 90)
	require.NoError(t, err)
	assert.True(t, ok)
	ok, err = model.ReserveDrawingChannel(claimed[2].ID, 90)
	require.NoError(t, err)
	assert.False(t, ok)
	ok, err = model.ReserveDrawingChannel(claimed[2].ID, 91)
	require.NoError(t, err)
	assert.True(t, ok)
}
